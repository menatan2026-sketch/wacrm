import { z } from "zod";
import { schema, uuidv7, and, desc, eq, gt, isNull, type OrderFlow, type UsageAnswers } from "@mfg/db";
import type { Deps } from "../../deps";
import { track } from "../../platform/analytics";
import { publish } from "../../platform/outbox";
import type { Ctx } from "../../shared/context";
import { sha256 } from "../../shared/crypto";
import { DomainError, forbidden, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { listMaterials } from "../catalog/service";
import { getAnalysis, scaledGeometry } from "../geometry/service";
import { requireUser } from "../identity/rbac";
import { nextOrderNumber, transitionOrder } from "../orders/service";
import { calculatePrice, type PriceBreakdown } from "../pricing/engine";
import { activeRuleSet, vatRateBps } from "../pricing/service";
import { autoQuote } from "../quotes/service";
import { deriveRequirements, missingUsage, recommendMaterials, type Requirements } from "../requirements/rules";

const DRAFT_TTL_MS = 30 * 24 * 3600 * 1000;

export const usageSchema = z.object({
  environment: z.enum(["indoor", "outdoor", "car", "wet"]).optional(),
  heat: z.enum(["none", "warm", "hot", "very_hot"]).optional(),
  load: z.enum(["none", "light", "moderate", "heavy"]).optional(),
  flexibility: z.enum(["rigid", "slight", "rubber"]).optional(),
  appearance: z.enum(["functional", "clean", "showpiece"]).optional(),
  foodContact: z.boolean().optional(),
  criticalDimensions: z.string().max(500).optional(),
});

/** Versioned wizard payload (v1). Every field has a downstream consumer (UX_ARCHITECTURE §4.2). */
export const draftPayloadSchema = z.object({
  title: z.string().trim().max(120).optional(),
  fileId: z.uuid().optional(),
  units: z.enum(["mm", "in"]).optional(),
  scale: z.number().min(0.1).max(10).optional(),
  usage: usageSchema.optional(),
  materialVariantId: z.uuid().optional(),
  quantity: z.number().int().min(1).max(500).optional(),
  urgency: z.enum(["standard", "fast", "urgent"]).optional(),
  description: z.string().trim().max(4000).optional(),
  photoFileIds: z.array(z.uuid()).max(20).optional(),
  dimensions: z.array(z.object({ name: z.string().trim().min(1).max(80), valueMm: z.number().positive().max(5000) })).max(10).optional(),
  referenceObject: z.string().trim().max(200).optional(),
});
export type DraftPayload = z.infer<typeof draftPayloadSchema>;

export const STEPS: Record<OrderFlow, readonly string[]> = {
  file: ["upload", "usage", "size", "review", "price"],
  object: ["describe", "usage", "size", "submit"],
  idea: ["describe", "usage", "size", "submit"],
};

type DraftRow = typeof schema.wizardDrafts.$inferSelect;

function ownerFilter(ctx: Ctx) {
  if (ctx.actor.kind === "user") return { ownerUserId: ctx.actor.userId, anonTokenHash: null };
  if (ctx.actor.kind === "guest" && ctx.actor.anonKey) return { ownerUserId: null, anonTokenHash: sha256(ctx.actor.anonKey) };
  throw new DomainError("auth.unauthenticated", 401);
}

export async function startDraft(ctx: Ctx, flow: OrderFlow): Promise<DraftRow> {
  const owner = ownerFilter(ctx);
  const [row] = await ctx.db
    .insert(schema.wizardDrafts)
    .values({ id: uuidv7(), ...owner, flow, step: STEPS[flow][0]!, payload: {}, expiresAt: new Date(ctx.clock.now().getTime() + DRAFT_TTL_MS) })
    .returning();
  return row!;
}

export async function getDraft(ctx: Ctx, draftId: string): Promise<DraftRow> {
  const [row] = await ctx.db.select().from(schema.wizardDrafts).where(eq(schema.wizardDrafts.id, draftId));
  if (!row) throw notFound("draft");
  const owner = ownerFilter(ctx);
  const owns = (owner.ownerUserId && row.ownerUserId === owner.ownerUserId) || (owner.anonTokenHash && row.anonTokenHash === owner.anonTokenHash);
  if (!owns) throw notFound("draft");
  if (row.expiresAt <= ctx.clock.now()) throw new DomainError("drafts.expired", 410);
  return row;
}

export async function latestOpenDrafts(ctx: Ctx) {
  const owner = ownerFilter(ctx);
  const t = schema.wizardDrafts;
  return ctx.db
    .select()
    .from(t)
    .where(and(owner.ownerUserId ? eq(t.ownerUserId, owner.ownerUserId) : eq(t.anonTokenHash, owner.anonTokenHash!), isNull(t.convertedOrderId), gt(t.expiresAt, ctx.clock.now())))
    .orderBy(desc(t.updatedAt))
    .limit(5);
}

export async function saveDraft(ctx: Ctx, draftId: string, input: { step?: string; patch: unknown }): Promise<DraftRow> {
  const draft = await getDraft(ctx, draftId);
  if (draft.convertedOrderId) throw new DomainError("orders.invalid_transition", 409);
  const patch = draftPayloadSchema.parse(input.patch);
  const step = input.step && STEPS[draft.flow as OrderFlow].includes(input.step) ? input.step : draft.step;
  const payload = { ...(draft.payload as DraftPayload), ...patch, usage: { ...(draft.payload as DraftPayload).usage, ...patch.usage } };
  const [row] = await ctx.db
    .update(schema.wizardDrafts)
    .set({ payload, step, expiresAt: new Date(ctx.clock.now().getTime() + DRAFT_TTL_MS) })
    .where(eq(schema.wizardDrafts.id, draftId))
    .returning();
  if (patch.usage && missingUsage(payload.usage ?? {}).length === 0 && missingUsage((draft.payload as DraftPayload).usage ?? {}).length > 0) {
    await track(ctx, "requirements_completed", { flow: draft.flow });
  }
  return row!;
}

/** Move guest drafts to the user who just signed in with the same browser. */
export async function claimDrafts(ctx: Ctx, anonKey: string, userId: string): Promise<void> {
  await ctx.db
    .update(schema.wizardDrafts)
    .set({ ownerUserId: userId, anonTokenHash: null })
    .where(and(eq(schema.wizardDrafts.anonTokenHash, sha256(anonKey)), isNull(schema.wizardDrafts.convertedOrderId)));
  await ctx.db.update(schema.fileObjects).set({ ownerUserId: userId, anonTokenHash: null }).where(eq(schema.fileObjects.anonTokenHash, sha256(anonKey)));
}

export interface MaterialOption {
  materialId: string;
  code: string;
  costTier: number;
  recommended: boolean;
  variants: { id: string; colorCode: string; colorHex: string }[];
}

export interface DraftEvaluation {
  analysis: Awaited<ReturnType<typeof getAnalysis>>;
  requirements: Requirements | null;
  materials: MaterialOption[];
  selectedVariantId: string | null;
  dimensionsMm: [number, number, number] | null;
  price: PriceBreakdown | null;
  /** Why this draft goes to manual review instead of an instant price. */
  reviewReasons: string[];
}

/** Everything the wizard shows for a file draft: analysis, fitting materials and a live price preview. */
export async function evaluateDraft(ctx: Ctx, draftId: string): Promise<DraftEvaluation> {
  const draft = await getDraft(ctx, draftId);
  const p = draft.payload as DraftPayload;
  const analysis = p.fileId ? await getAnalysis(ctx, p.fileId) : null;
  const usage = (p.usage ?? {}) as UsageAnswers;
  const usageComplete = missingUsage(usage).length === 0;
  const requirements = usageComplete ? deriveRequirements(usage) : null;
  const catalog = await listMaterials(ctx);
  const fitting = requirements ? recommendMaterials(catalog, requirements) : [];
  const materials: MaterialOption[] = fitting.map((m, i) => ({
    materialId: m.id,
    code: m.code,
    costTier: m.costTier,
    recommended: i === 0,
    variants: m.variants.map((v) => ({ id: v.id, colorCode: v.colorCode, colorHex: v.colorHex })),
  }));
  const chosen = materials.flatMap((m) => m.variants).find((v) => v.id === p.materialVariantId);
  const selectedVariantId = chosen?.id ?? materials[0]?.variants[0]?.id ?? null;
  const reviewReasons = [...(requirements?.reviewReasons ?? [])];
  if (requirements && fitting.length === 0) reviewReasons.push("no_material_fits");
  if (analysis?.status === "failed") reviewReasons.push(`geometry_${analysis.failureCode}`);
  if (analysis?.status === "succeeded" && !analysis.isWatertight) reviewReasons.push("mesh_not_watertight");

  let dimensionsMm: [number, number, number] | null = null;
  let price: PriceBreakdown | null = null;
  if (analysis?.status === "succeeded") {
    const g = scaledGeometry(analysis, p.units ?? (analysis.unitsDetected === "in" ? "in" : "mm"), p.scale ?? 1);
    dimensionsMm = g.bboxMm;
    const material = fitting.find((m) => m.variants.some((v) => v.id === selectedVariantId));
    if (material && requirements) {
      const rules = await activeRuleSet(ctx);
      price = calculatePrice(
        {
          items: [{ ...g, materialCode: material.code, densityGCm3: material.densityGCm3, qualityProfile: requirements.qualityProfile, quantity: p.quantity ?? 1 }],
          urgency: p.urgency ?? "standard",
          includeShipping: true,
          taxRateBps: await vatRateBps(ctx),
        },
        rules.rules,
      );
      reviewReasons.push(...price.reviewReasons);
    }
  }
  return { analysis, requirements, materials, selectedVariantId, dimensionsMm, price, reviewReasons: [...new Set(reviewReasons)] };
}

/** Turn a completed draft into an order. Flow A is auto-quoted when every guard passes. */
export async function submitDraft(d: Deps, ctx: Ctx, draftId: string, locale: string): Promise<{ orderId: string; outcome: "quoted" | "review" }> {
  const user = requireUser(ctx.actor);
  const result = await inTx(ctx, async (ctx) => {
    const draft = await getDraft(ctx, draftId);
    if (draft.convertedOrderId) return { orderId: draft.convertedOrderId, flow: draft.flow as OrderFlow, existing: true };
    const p = draft.payload as DraftPayload;
    const flow = draft.flow as OrderFlow;
    const usage = (p.usage ?? {}) as UsageAnswers;
    if (missingUsage(usage).length) throw new DomainError("orders.incomplete", 422, { missing: missingUsage(usage) });
    if (flow === "file" && !p.fileId) throw new DomainError("orders.incomplete", 422, { missing: ["file"] });
    if (flow !== "file" && !p.description) throw new DomainError("orders.incomplete", 422, { missing: ["description"] });

    const fileIds = [p.fileId, ...(p.photoFileIds ?? [])].filter((x): x is string => !!x);
    for (const id of fileIds) {
      const [f] = await ctx.db.select().from(schema.fileObjects).where(eq(schema.fileObjects.id, id));
      if (!f || f.ownerUserId !== user.userId) throw forbidden();
      await ctx.db.update(schema.fileObjects).set({ retentionClass: "order" }).where(eq(schema.fileObjects.id, id));
    }

    const evaluation = flow === "file" ? await evaluateDraft(ctx, draftId) : null;
    const orderId = uuidv7();
    await ctx.db.insert(schema.orders).values({
      id: orderId,
      orderNumber: await nextOrderNumber(ctx),
      customerUserId: user.userId,
      flow,
      status: "DRAFT",
      urgencyTier: p.urgency ?? "standard",
      locale,
      request: { description: p.description, photoFileIds: p.photoFileIds, dimensions: p.dimensions, referenceObject: p.referenceObject },
    });
    await ctx.db.insert(schema.orderItems).values({
      id: uuidv7(),
      orderId,
      title: p.title?.trim() || (flow === "file" ? "model" : "request"),
      fileId: p.fileId ?? null,
      quantity: p.quantity ?? 1,
      materialVariantId: evaluation?.selectedVariantId ?? null,
      qualityProfileCode: evaluation?.requirements?.qualityProfile ?? deriveRequirements(usage).qualityProfile,
      unitsConfirmed: p.units ?? (evaluation?.analysis?.unitsDetected === "in" ? "in" : "mm"),
      scale: p.scale ?? 1,
      usage,
      requirements: (evaluation?.requirements ?? deriveRequirements(usage)) as unknown as Record<string, unknown>,
    });
    await ctx.db.update(schema.wizardDrafts).set({ convertedOrderId: orderId }).where(eq(schema.wizardDrafts.id, draftId));
    await track(ctx, "order_created", { flow }, { orderId, locale });
    if (flow === "file") {
      await transitionOrder(ctx, orderId, "submit_requirements");
    } else {
      await transitionOrder(ctx, orderId, "needs_review", { reason: `flow_${flow}` });
      await ctx.db.update(schema.orders).set({ reviewReasons: [`flow_${flow}`] }).where(eq(schema.orders.id, orderId));
      if (flow === "idea") await track(ctx, "design_requested", {}, { orderId });
      await publish(ctx, "notify.customer", { orderId, template: "request_received" });
    }
    return { orderId, flow, existing: false };
  });
  if (result.existing || result.flow !== "file") return { orderId: result.orderId, outcome: "review" };
  return { orderId: result.orderId, outcome: await autoQuote(d, ctx, result.orderId) };
}
