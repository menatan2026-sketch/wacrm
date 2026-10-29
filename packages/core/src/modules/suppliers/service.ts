import { z } from "zod";
import { schema, uuidv7, and, eq, inArray, sql } from "@mfg/db";
import type { Deps } from "../../deps";
import { audit } from "../../platform/audit";
import { publish } from "../../platform/outbox";
import type { Ctx } from "../../shared/context";
import { DomainError, forbidden, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { createSupplierInvitation } from "../identity/auth";
import { authorize, can, requireUser, supplierScopes } from "../identity/rbac";

export type SupplierRow = typeof schema.suppliers.$inferSelect;

export const supplierProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).optional(),
  taxId: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
  addressLine: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().max(20).optional(),
  leadTimeDays: z.number().int().min(1).max(30).optional(),
});

export const machineSchema = z.object({
  name: z.string().trim().min(1).max(80),
  buildXMm: z.number().positive().max(2000),
  buildYMm: z.number().positive().max(2000),
  buildZMm: z.number().positive().max(2000),
  dailyCapacityMinutes: z.number().int().min(60).max(1440),
  materialVariantIds: z.array(z.uuid()).min(1),
});

/** Supplier managers act on their own supplier; platform staff with supplier.manage on any. */
function assertSupplierAccess(ctx: Ctx, supplierId: string) {
  if (can(ctx.actor, "supplier.manage")) return;
  if (can(ctx.actor, "supplier.self.manage", { supplierId })) return;
  throw forbidden();
}

export async function getSupplier(ctx: Ctx, supplierId: string): Promise<SupplierRow> {
  if (!can(ctx.actor, "supplier.manage") && !supplierScopes(ctx.actor).includes(supplierId)) throw notFound("supplier");
  const [row] = await ctx.db.select().from(schema.suppliers).where(eq(schema.suppliers.id, supplierId));
  if (!row) throw notFound("supplier");
  return row;
}

export async function listSuppliers(ctx: Ctx) {
  authorize(ctx.actor, "supplier.manage");
  return ctx.db.select().from(schema.suppliers).orderBy(schema.suppliers.name);
}

/** Staff creates a supplier and invites its manager by email (invite-only network in the MVP). */
export async function inviteSupplier(d: Deps, ctx: Ctx, input: { name: string; contactEmail: string; locale: string }) {
  authorize(ctx.actor, "supplier.manage");
  return inTx(ctx, async (ctx) => {
    const id = uuidv7();
    await ctx.db.insert(schema.suppliers).values({ id, name: input.name.trim(), contactEmail: input.contactEmail.trim().toLowerCase(), status: "invited" });
    const token = await createSupplierInvitation(ctx, d, { supplierId: id, email: input.contactEmail, locale: input.locale, supplierName: input.name });
    const link = `${d.appUrl}/${input.locale}/partners/invite/${token}`;
    await publish(ctx, "notify.email", { to: input.contactEmail.trim().toLowerCase(), locale: input.locale, template: "supplier_invite", vars: { supplier: input.name, link } });
    return { supplierId: id, inviteLink: link };
  });
}

export async function updateSupplierProfile(ctx: Ctx, supplierId: string, input: unknown) {
  assertSupplierAccess(ctx, supplierId);
  const data = supplierProfileSchema.parse(input);
  return inTx(ctx, async (ctx) => {
    const [before] = await ctx.db.select().from(schema.suppliers).where(eq(schema.suppliers.id, supplierId)).for("update");
    if (!before) throw notFound("supplier");
    const onboarding = { ...before.onboarding, company: true, location: Boolean(data.city && data.addressLine) || before.onboarding.location };
    await ctx.db.update(schema.suppliers).set({ ...data, onboarding }).where(eq(schema.suppliers.id, supplierId));
    await audit(ctx, { action: "supplier.profile_updated", resourceType: "supplier", resourceId: supplierId, before, after: data });
  });
}

export async function listMachines(ctx: Ctx, supplierId: string) {
  await getSupplier(ctx, supplierId);
  const machines = await ctx.db.select().from(schema.machines).where(eq(schema.machines.supplierId, supplierId)).orderBy(schema.machines.createdAt);
  if (!machines.length) return [];
  const mm = await ctx.db.select().from(schema.machineMaterials).where(inArray(schema.machineMaterials.machineId, machines.map((m) => m.id)));
  return machines.map((m) => ({ ...m, materialVariantIds: mm.filter((x) => x.machineId === m.id).map((x) => x.materialVariantId) }));
}

export async function upsertMachine(ctx: Ctx, supplierId: string, input: unknown, machineId?: string) {
  assertSupplierAccess(ctx, supplierId);
  const data = machineSchema.parse(input);
  return inTx(ctx, async (ctx) => {
    const id = machineId ?? uuidv7();
    const values = { name: data.name, buildXMm: data.buildXMm, buildYMm: data.buildYMm, buildZMm: data.buildZMm, dailyCapacityMinutes: data.dailyCapacityMinutes };
    if (machineId) {
      const res = await ctx.db.update(schema.machines).set(values).where(and(eq(schema.machines.id, machineId), eq(schema.machines.supplierId, supplierId))).returning({ id: schema.machines.id });
      if (!res.length) throw notFound("machine");
      await ctx.db.delete(schema.machineMaterials).where(eq(schema.machineMaterials.machineId, machineId));
    } else {
      await ctx.db.insert(schema.machines).values({ id, supplierId, ...values });
    }
    await ctx.db.insert(schema.machineMaterials).values(data.materialVariantIds.map((v) => ({ machineId: id, materialVariantId: v })));
    await ctx.db
      .update(schema.suppliers)
      .set({ onboarding: sql`jsonb_set(${schema.suppliers.onboarding}, '{machines}', 'true')` })
      .where(eq(schema.suppliers.id, supplierId));
    await audit(ctx, { action: machineId ? "machine.updated" : "machine.created", resourceType: "machine", resourceId: id, after: data });
    return id;
  });
}

/**
 * Payout bank details. Changes are audited and, per SECURITY §3, hold payouts for 48 hours
 * (payoutDetailsChangedAt) until finance verifies them out of band.
 */
export async function setPayoutDetails(ctx: Ctx, supplierId: string, details: { accountName: string; bank: string; branch: string; account: string }) {
  if (!can(ctx.actor, "supplier.self.manage", { supplierId })) throw forbidden();
  const parsed = z.object({ accountName: z.string().trim().min(2).max(120), bank: z.string().trim().min(1).max(10), branch: z.string().trim().min(1).max(10), account: z.string().trim().min(3).max(20) }).parse(details);
  return inTx(ctx, async (ctx) => {
    await ctx.db
      .update(schema.suppliers)
      .set({ payoutDetails: parsed, payoutDetailsChangedAt: ctx.clock.now(), onboarding: sql`jsonb_set(${schema.suppliers.onboarding}, '{payout}', 'true')` })
      .where(eq(schema.suppliers.id, supplierId));
    await audit(ctx, { action: "supplier.payout_details_changed", resourceType: "supplier", resourceId: supplierId, after: { account: `***${parsed.account.slice(-3)}` } });
  });
}

export async function acceptAgreement(ctx: Ctx, supplierId: string) {
  if (!can(ctx.actor, "supplier.self.manage", { supplierId })) throw forbidden();
  return inTx(ctx, async (ctx) => {
    await ctx.db
      .update(schema.suppliers)
      .set({ agreementAcceptedAt: ctx.clock.now(), onboarding: sql`jsonb_set(${schema.suppliers.onboarding}, '{agreement}', 'true')` })
      .where(eq(schema.suppliers.id, supplierId));
    await audit(ctx, { action: "supplier.agreement_accepted", resourceType: "supplier", resourceId: supplierId });
  });
}

export const onboardingComplete = (s: SupplierRow) => Object.values(s.onboarding).every(Boolean);

/** Admin activation requires the full onboarding checklist. Pausing and suspension need a reason. */
export async function setSupplierStatus(ctx: Ctx, supplierId: string, status: "active" | "paused" | "suspended", reason: string) {
  authorize(ctx.actor, "supplier.manage");
  requireUser(ctx.actor);
  return inTx(ctx, async (ctx) => {
    const [s] = await ctx.db.select().from(schema.suppliers).where(eq(schema.suppliers.id, supplierId)).for("update");
    if (!s) throw notFound("supplier");
    if (status === "active" && !onboardingComplete(s)) throw new DomainError("suppliers.onboarding_incomplete", 409);
    await ctx.db.update(schema.suppliers).set({ status }).where(eq(schema.suppliers.id, supplierId));
    await audit(ctx, { action: "supplier.status", resourceType: "supplier", resourceId: supplierId, before: { status: s.status }, after: { status }, reason });
  });
}

/** Recompute performance projections from raw job and offer history (stats are never hand-edited). */
export async function recomputeSupplierStats(ctx: Ctx): Promise<void> {
  const rows = await ctx.db.execute(sql`
    SELECT s.id,
      count(o.*) FILTER (WHERE o.status IN ('accepted','declined','expired')) AS offers,
      count(o.*) FILTER (WHERE o.status = 'accepted') AS accepted,
      (SELECT count(*) FROM production_jobs j WHERE j.supplier_id = s.id AND j.status = 'HANDED_OFF') AS done,
      (SELECT count(*) FROM production_jobs j WHERE j.supplier_id = s.id AND j.status = 'HANDED_OFF' AND j.handed_off_at <= j.due_at) AS on_time,
      (SELECT count(*) FROM reprint_requests r JOIN production_jobs j ON j.id = r.job_id WHERE j.supplier_id = s.id AND r.cost_bearer = 'supplier') AS reprints,
      (SELECT count(*) FROM qc_inspections q JOIN production_jobs j ON j.id = q.job_id WHERE j.supplier_id = s.id AND q.stage = 'platform_review' AND q.verdict = 'pass') AS qc_pass,
      (SELECT count(*) FROM qc_inspections q JOIN production_jobs j ON j.id = q.job_id WHERE j.supplier_id = s.id AND q.stage = 'platform_review' AND q.verdict IN ('pass','fail')) AS qc_total
    FROM suppliers s LEFT JOIN job_offers o ON o.supplier_id = s.id
    GROUP BY s.id`);
  for (const r of rows.rows as Record<string, string>[]) {
    const n = (k: string) => Number(r[k] ?? 0);
    // Bayesian smoothing toward neutral priors so a new supplier isn't judged on one job.
    const stats = {
      acceptanceRate: (n("accepted") + 9) / (n("offers") + 10),
      onTimeRate: (n("on_time") + 9) / (n("done") + 10),
      reprintRate: n("reprints") / (n("done") + 10),
      qualityScore: (n("qc_pass") + 8) / (n("qc_total") + 10),
      cancellationRate: 0,
      completedJobs: n("done"),
      computedAt: ctx.clock.now().toISOString(),
    };
    await ctx.db.update(schema.suppliers).set({ stats }).where(eq(schema.suppliers.id, r.id!));
  }
}

