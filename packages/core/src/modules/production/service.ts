import { z } from "zod";
import { schema, uuidv7, and, desc, eq, inArray, lt, type QcMeasurement } from "@mfg/db";
import { audit } from "../../platform/audit";
import { publish } from "../../platform/outbox";
import { track } from "../../platform/analytics";
import type { Ctx } from "../../shared/context";
import { DomainError, forbidden, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { authorize, can, requireUser } from "../identity/rbac";
import { lockOrder, systemHold, transitionOrder } from "../orders/service";
import { currentQuote } from "../quotes/service";
import { partSummaries } from "./summary";

export type JobRow = typeof schema.productionJobs.$inferSelect;

export const QC_CHECKLIST = ["no_warping", "no_layer_shift", "surface_ok", "color_matches", "quantity_correct"] as const;
export const DEFECT_CODES = ["warping", "layer_shift", "stringing", "under_extrusion", "dimension_out_of_tolerance", "surface", "color", "missing_feature", "other"] as const;
export const MIN_QC_PHOTOS = 2;

/** FDM tolerance used for QC measurements: ±0.5 mm or ±1 %, whichever is larger. */
export const toleranceFor = (mm: number) => Math.round(Math.max(0.5, mm * 0.01) * 100) / 100;

/** The measurements a supplier must report, generated from the dimensions frozen in the quote. */
export async function qcRequirements(ctx: Ctx, orderId: string): Promise<{ measurements: QcMeasurement[]; checklist: readonly string[] }> {
  const quote = await currentQuote(ctx, orderId);
  const items = (quote?.snapshot.inputs as { items?: { bboxMm: [number, number, number] }[]; engineInput?: { items?: { bboxMm: [number, number, number] }[] } }) ?? {};
  const bbox = items.items?.[0]?.bboxMm ?? items.engineInput?.items?.[0]?.bboxMm;
  const measurements: QcMeasurement[] = bbox
    ? (["x", "y", "z"] as const).map((axis, i) => ({ name: axis, expectedMm: Math.round(bbox[i]! * 10) / 10, toleranceMm: toleranceFor(bbox[i]!) }))
    : [];
  return { measurements, checklist: QC_CHECKLIST };
}

async function lockJobFor(ctx: Ctx, jobId: string, permission: "job.update" | "job.read.own"): Promise<JobRow> {
  const [job] = await ctx.db.select().from(schema.productionJobs).where(eq(schema.productionJobs.id, jobId)).for("update");
  if (!job) throw notFound("job");
  if (!job.supplierId || !can(ctx.actor, permission, { supplierId: job.supplierId })) throw forbidden();
  return job;
}

/** Jobs for a supplier's floor view (no customer personal data — SECURITY §9). */
export async function supplierJobs(ctx: Ctx, supplierId: string) {
  if (!can(ctx.actor, "job.read.own", { supplierId })) throw forbidden();
  const rows = await ctx.db
    .select({ job: schema.productionJobs, orderNumber: schema.orders.orderNumber, urgencyTier: schema.orders.urgencyTier })
    .from(schema.productionJobs)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.productionJobs.orderId))
    .where(and(eq(schema.productionJobs.supplierId, supplierId), inArray(schema.productionJobs.status, ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "QC_FAILED", "QC_PASSED", "HANDED_OFF"])))
    .orderBy(schema.productionJobs.dueAt);
  const summaries = await partSummaries(ctx, rows.map((r) => r.job.orderId));
  return rows.map((r) => ({ ...r, part: summaries.get(r.job.orderId)! }));
}

/** Everything the supplier needs on the job card: part, material, quantity, payout, deadline, QC. */
export async function jobCard(ctx: Ctx, jobId: string) {
  const [job] = await ctx.db.select().from(schema.productionJobs).where(eq(schema.productionJobs.id, jobId));
  if (!job) throw notFound("job");
  const staff = can(ctx.actor, "order.read.any");
  if (!staff && !(job.supplierId && can(ctx.actor, "job.read.own", { supplierId: job.supplierId }))) throw notFound("job");
  const [order] = await ctx.db.select({ orderNumber: schema.orders.orderNumber, urgencyTier: schema.orders.urgencyTier, status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, job.orderId));
  const items = await ctx.db
    .select({ item: schema.orderItems, variant: schema.materialVariants, material: schema.materials })
    .from(schema.orderItems)
    .leftJoin(schema.materialVariants, eq(schema.materialVariants.id, schema.orderItems.materialVariantId))
    .leftJoin(schema.materials, eq(schema.materials.id, schema.materialVariants.materialId))
    .where(eq(schema.orderItems.orderId, job.orderId));
  const inspections = await ctx.db.select().from(schema.qcInspections).where(eq(schema.qcInspections.jobId, jobId)).orderBy(desc(schema.qcInspections.createdAt));
  return { job, order: order!, items, inspections, qc: await qcRequirements(ctx, job.orderId) };
}

export async function startProduction(ctx: Ctx, jobId: string) {
  return inTx(ctx, async (ctx) => {
    const job = await lockJobFor(ctx, jobId, "job.update");
    if (job.status !== "ACCEPTED") throw new DomainError("jobs.invalid_transition", 409);
    await ctx.db.update(schema.productionJobs).set({ status: "IN_PRODUCTION", startedAt: ctx.clock.now() }).where(eq(schema.productionJobs.id, jobId));
    await transitionOrder(ctx, job.orderId, "production_started", { trigger: "system" });
    await audit(ctx, { action: "job.started", resourceType: "production_job", resourceId: jobId });
    await publish(ctx, "notify.customer", { orderId: job.orderId, template: "production_started" });
    await track(ctx, "production_started", {}, { orderId: job.orderId });
  });
}

export const evidenceSchema = z.object({
  photoFileIds: z.array(z.uuid()).min(MIN_QC_PHOTOS).max(20),
  measurements: z.array(z.object({ name: z.string(), measuredMm: z.number().positive().max(5000) })),
  checklist: z.record(z.string(), z.boolean()),
  notes: z.string().max(2000).optional(),
});

/** Supplier uploads QC evidence; the job then waits for platform review. */
export async function submitEvidence(ctx: Ctx, jobId: string, input: unknown) {
  const user = requireUser(ctx.actor);
  const data = evidenceSchema.safeParse(input);
  if (!data.success) throw new DomainError("jobs.evidence_incomplete", 422, { issues: data.error.issues.map((i) => i.path.join(".")) });
  return inTx(ctx, async (ctx) => {
    const job = await lockJobFor(ctx, jobId, "job.update");
    if (job.status !== "IN_PRODUCTION" && job.status !== "QC_PENDING") throw new DomainError("jobs.invalid_transition", 409);
    const required = await qcRequirements(ctx, job.orderId);
    const byName = new Map(data.data.measurements.map((m) => [m.name, m.measuredMm]));
    if (required.measurements.some((m) => !byName.has(m.name)) || QC_CHECKLIST.some((c) => !(c in data.data.checklist))) {
      throw new DomainError("jobs.evidence_incomplete", 422);
    }
    for (const fileId of data.data.photoFileIds) {
      const [f] = await ctx.db.select().from(schema.fileObjects).where(eq(schema.fileObjects.id, fileId));
      if (!f || f.ownerUserId !== user.userId || f.kind !== "qc_photo" || f.status !== "uploaded") throw new DomainError("jobs.evidence_incomplete", 422, { fileId });
      await ctx.db.update(schema.fileObjects).set({ retentionClass: "qc" }).where(eq(schema.fileObjects.id, fileId));
    }
    await ctx.db.insert(schema.qcInspections).values({
      id: uuidv7(),
      jobId,
      stage: "supplier_evidence",
      authorId: user.userId,
      measurements: required.measurements.map((m) => ({ ...m, measuredMm: byName.get(m.name) })),
      checklist: data.data.checklist,
      photoFileIds: data.data.photoFileIds,
      notes: data.data.notes ?? null,
    });
    if (job.status === "IN_PRODUCTION") {
      await ctx.db.update(schema.productionJobs).set({ status: "QC_PENDING", producedAt: ctx.clock.now() }).where(eq(schema.productionJobs.id, jobId));
      await transitionOrder(ctx, job.orderId, "production_completed", { trigger: "system" });
    }
    await audit(ctx, { action: "job.evidence_submitted", resourceType: "production_job", resourceId: jobId });
  });
}

export const verdictSchema = z.object({
  verdict: z.enum(["pass", "fail", "needs_info"]),
  defects: z.array(z.object({ code: z.enum(DEFECT_CODES), severity: z.enum(["minor", "major", "critical"]), description: z.string().max(500).optional() })).default([]),
  notes: z.string().max(2000).optional(),
});

/**
 * Platform QC review. Pass → ready to ship and the payout is earned. Fail → QC_FAILED; the
 * reviewer then orders a reprint (or ops accepts a concession). needs_info asks the supplier again.
 */
export async function reviewQc(ctx: Ctx, jobId: string, input: unknown) {
  authorize(ctx.actor, "qc.verdict");
  const user = requireUser(ctx.actor);
  const data = verdictSchema.parse(input);
  if (data.verdict === "fail" && data.defects.length === 0) throw new DomainError("common.validation", 422, { field: "defects" });
  return inTx(ctx, async (ctx) => {
    const [job] = await ctx.db.select().from(schema.productionJobs).where(eq(schema.productionJobs.id, jobId)).for("update");
    if (!job || job.status !== "QC_PENDING") throw new DomainError("jobs.invalid_transition", 409);
    const [evidence] = await ctx.db.select().from(schema.qcInspections).where(and(eq(schema.qcInspections.jobId, jobId), eq(schema.qcInspections.stage, "supplier_evidence"))).orderBy(desc(schema.qcInspections.createdAt)).limit(1);
    if (!evidence) throw new DomainError("jobs.evidence_incomplete", 409);
    await ctx.db.insert(schema.qcInspections).values({
      id: uuidv7(),
      jobId,
      stage: "platform_review",
      authorId: user.userId,
      verdict: data.verdict,
      measurements: evidence.measurements,
      checklist: evidence.checklist,
      photoFileIds: evidence.photoFileIds,
      defects: data.defects,
      notes: data.notes ?? null,
    });
    await audit(ctx, { action: `qc.${data.verdict}`, resourceType: "production_job", resourceId: jobId, after: { defects: data.defects } });
    if (data.verdict === "needs_info") return;
    if (data.verdict === "pass") {
      await ctx.db.update(schema.productionJobs).set({ status: "QC_PASSED" }).where(eq(schema.productionJobs.id, jobId));
      if (job.payoutMinor && job.supplierId) {
        await ctx.db.insert(schema.payoutLedgerEntries).values({ id: uuidv7(), supplierId: job.supplierId, jobId, kind: "earning", amountMinor: job.payoutMinor, currency: job.currency });
      }
      await transitionOrder(ctx, job.orderId, "qc_passed", { trigger: "system" });
      await track(ctx, "qc_passed", { attempt: job.attemptNo }, { orderId: job.orderId });
      return;
    }
    await ctx.db.update(schema.productionJobs).set({ status: "QC_FAILED" }).where(eq(schema.productionJobs.id, jobId));
    await transitionOrder(ctx, job.orderId, "qc_failed", { trigger: "system" });
    await track(ctx, "qc_failed", { attempt: job.attemptNo, defects: data.defects.map((x) => x.code) }, { orderId: job.orderId });
    await publish(ctx, "notify.supplier_job", { jobId, template: "qc_failed_supplier", vars: { reason: data.defects.map((x) => x.code).join(", ") } });
    // A second failure escalates to ops instead of looping (UX_ARCHITECTURE §8).
    if (job.attemptNo >= 2) await systemHold(ctx, job.orderId, "qc_failed_twice");
  });
}

export const reprintSchema = z.object({
  reasonCode: z.enum(DEFECT_CODES),
  costBearer: z.enum(["supplier", "platform", "customer"]),
  rootCause: z.string().max(1000).optional(),
  correctiveAction: z.string().max(1000).optional(),
});

/** Order a reprint after a QC failure. The supplier at fault reprints without a second payout. */
export async function orderReprint(ctx: Ctx, jobId: string, input: unknown) {
  if (!can(ctx.actor, "qc.verdict") && !can(ctx.actor, "order.manage")) throw forbidden();
  const user = requireUser(ctx.actor);
  const data = reprintSchema.parse(input);
  return inTx(ctx, async (ctx) => {
    const [job] = await ctx.db.select().from(schema.productionJobs).where(eq(schema.productionJobs.id, jobId)).for("update");
    if (!job || job.status !== "QC_FAILED") throw new DomainError("jobs.invalid_transition", 409);
    const order = await lockOrder(ctx, job.orderId);
    const newJobId = uuidv7();
    const delayDays = 2;
    const due = new Date(Math.max(ctx.clock.now().getTime(), job.dueAt?.getTime() ?? 0) + delayDays * 24 * 3600 * 1000);
    await ctx.db.insert(schema.productionJobs).values({
      id: newJobId,
      orderId: job.orderId,
      supplierId: job.supplierId,
      status: "ACCEPTED",
      attemptNo: job.attemptNo + 1,
      payoutMinor: data.costBearer === "supplier" ? 0 : job.payoutMinor,
      currency: job.currency,
      estimatedMinutes: job.estimatedMinutes,
      dueAt: due,
      acceptedAt: ctx.clock.now(),
    });
    await ctx.db.update(schema.productionJobs).set({ status: "CANCELLED" }).where(eq(schema.productionJobs.id, jobId));
    await ctx.db.insert(schema.reprintRequests).values({ id: uuidv7(), jobId, newJobId, ...data, createdBy: user.userId });
    const shipDate = due.toISOString().slice(0, 10);
    await transitionOrder(ctx, job.orderId, "reprint_ordered", { patch: { promisedShipDate: shipDate }, trigger: can(ctx.actor, "order.manage") && order.status === "DISPUTED" ? "staff" : "system" });
    await publish(ctx, "notify.customer", { orderId: job.orderId, template: "order_delayed", vars: { shipDate } });
    return newJobId;
  });
}

/** Ops accepts a failed part with the customer's consent (logged concession). */
export async function acceptWithConcession(ctx: Ctx, jobId: string, reason: string) {
  authorize(ctx.actor, "order.manage");
  return inTx(ctx, async (ctx) => {
    const [job] = await ctx.db.select().from(schema.productionJobs).where(eq(schema.productionJobs.id, jobId)).for("update");
    if (!job || job.status !== "QC_FAILED") throw new DomainError("jobs.invalid_transition", 409);
    await ctx.db.update(schema.productionJobs).set({ status: "QC_PASSED" }).where(eq(schema.productionJobs.id, jobId));
    if (job.payoutMinor && job.supplierId) await ctx.db.insert(schema.payoutLedgerEntries).values({ id: uuidv7(), supplierId: job.supplierId, jobId, kind: "earning", amountMinor: job.payoutMinor, currency: job.currency });
    await transitionOrder(ctx, job.orderId, "accepted_with_concession", { reason });
  });
}

/** QC queue for reviewers. */
export async function qcQueue(ctx: Ctx) {
  authorize(ctx.actor, "qc.verdict");
  return ctx.db
    .select({ job: schema.productionJobs, orderNumber: schema.orders.orderNumber, supplierName: schema.suppliers.name })
    .from(schema.productionJobs)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.productionJobs.orderId))
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.productionJobs.supplierId))
    .where(inArray(schema.productionJobs.status, ["QC_PENDING", "QC_FAILED"]))
    .orderBy(schema.productionJobs.producedAt);
}

/** Jobs past their due date that haven't been handed off (attention queue input). */
export async function lateJobs(ctx: Ctx) {
  return ctx.db
    .select({ job: schema.productionJobs, orderNumber: schema.orders.orderNumber })
    .from(schema.productionJobs)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.productionJobs.orderId))
    .where(and(inArray(schema.productionJobs.status, ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING"]), lt(schema.productionJobs.dueAt, ctx.clock.now())));
}

