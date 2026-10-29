import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, minor, oneOf, ts, updatedAt } from "./_shared";
import { JOB_STATUSES, OFFER_STATUSES, QC_VERDICTS, SUPPLIER_STATUSES } from "./enums";
import { materialVariants } from "./catalog";
import { orders } from "./orders";

export interface SupplierStats {
  qualityScore: number;
  onTimeRate: number;
  acceptanceRate: number;
  reprintRate: number;
  cancellationRate: number;
  completedJobs: number;
  computedAt?: string;
}

export interface OnboardingChecklist {
  company: boolean;
  location: boolean;
  machines: boolean;
  payout: boolean;
  agreement: boolean;
}

export const suppliers = pgTable(
  "suppliers",
  {
    id: id(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    taxId: text("tax_id"),
    status: text("status").notNull().default("invited"),
    contactEmail: text("contact_email").notNull(),
    phone: text("phone"),
    city: text("city"),
    addressLine: text("address_line"),
    postalCode: text("postal_code"),
    region: text("region").notNull().default("center"),
    leadTimeDays: integer("lead_time_days").notNull().default(3),
    minimumJobMinor: minor("minimum_job_minor").notNull().default(0),
    payoutCard: jsonb("payout_card").$type<Record<string, unknown> | null>(),
    payoutDetails: jsonb("payout_details").$type<Record<string, unknown> | null>(),
    payoutDetailsChangedAt: ts("payout_details_changed_at"),
    onboarding: jsonb("onboarding").$type<OnboardingChecklist>().notNull().default({
      company: false,
      location: false,
      machines: false,
      payout: false,
      agreement: false,
    }),
    agreementAcceptedAt: ts("agreement_accepted_at"),
    stats: jsonb("stats").$type<SupplierStats>().notNull().default({
      qualityScore: 0.8,
      onTimeRate: 0.9,
      acceptanceRate: 0.9,
      reprintRate: 0,
      cancellationRate: 0,
      completedJobs: 0,
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  () => [oneOf("suppliers_status_ck", "status", SUPPLIER_STATUSES)],
);

export const machines = pgTable(
  "machines",
  {
    id: id(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    processCode: text("process_code").notNull().default("FDM"),
    name: text("name").notNull(),
    buildXMm: numeric("build_x_mm", { precision: 8, scale: 1, mode: "number" }).notNull(),
    buildYMm: numeric("build_y_mm", { precision: 8, scale: 1, mode: "number" }).notNull(),
    buildZMm: numeric("build_z_mm", { precision: 8, scale: 1, mode: "number" }).notNull(),
    dailyCapacityMinutes: integer("daily_capacity_minutes").notNull().default(1200),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    index("machines_supplier_idx").on(t.supplierId),
    oneOf("machines_status_ck", "status", ["active", "maintenance", "retired"]),
  ],
);

export const machineMaterials = pgTable(
  "machine_materials",
  {
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machines.id),
    materialVariantId: uuid("material_variant_id")
      .notNull()
      .references(() => materialVariants.id),
  },
  (t) => [primaryKey({ columns: [t.machineId, t.materialVariantId] })],
);

export const routingRuleSets = pgTable("routing_rule_sets", {
  id: id(),
  version: integer("version").notNull().unique(),
  status: text("status").notNull().default("draft"),
  weights: jsonb("weights").$type<Record<string, number>>().notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  createdAt: createdAt(),
  activatedAt: ts("activated_at"),
});

export interface RoutingCandidate {
  supplierId: string;
  supplierName: string;
  excludedReason?: string;
  score?: number;
  components?: Record<string, number>;
}

export const routingDecisions = pgTable(
  "routing_decisions",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    ruleSetId: uuid("rule_set_id").references(() => routingRuleSets.id),
    candidates: jsonb("candidates").$type<RoutingCandidate[]>().notNull(),
    chosenSupplierId: uuid("chosen_supplier_id"),
    mode: text("mode").notNull(),
    actorId: uuid("actor_id"),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("routing_decisions_order_idx").on(t.orderId),
    oneOf("routing_decisions_mode_ck", "mode", [
      "proposal",
      "auto",
      "manual_confirmed",
      "manual_override",
    ]),
  ],
);

export const productionJobs = pgTable(
  "production_jobs",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    status: text("status").notNull().default("OFFERED"),
    attemptNo: integer("attempt_no").notNull().default(1),
    payoutMinor: minor("payout_minor"),
    currency: text("currency").notNull().default("ILS"),
    /** Estimated machine time, used for supplier capacity checks. */
    estimatedMinutes: integer("estimated_minutes").notNull().default(0),
    dueAt: ts("due_at"),
    acceptedAt: ts("accepted_at"),
    startedAt: ts("started_at"),
    producedAt: ts("produced_at"),
    handedOffAt: ts("handed_off_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("production_jobs_supplier_idx").on(t.supplierId, t.status, t.dueAt),
    index("production_jobs_order_idx").on(t.orderId),
    oneOf("production_jobs_status_ck", "status", JOB_STATUSES),
  ],
);

export const jobOffers = pgTable(
  "job_offers",
  {
    id: id(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => productionJobs.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    status: text("status").notNull().default("pending"),
    payoutMinor: minor("payout_minor").notNull(),
    offeredAt: createdAt(),
    expiresAt: ts("expires_at").notNull(),
    respondedAt: ts("responded_at"),
    respondedBy: uuid("responded_by"),
    declineReason: text("decline_reason"),
  },
  (t) => [
    index("job_offers_supplier_idx").on(t.supplierId, t.status, t.expiresAt),
    uniqueIndex("job_offers_one_accept_uq")
      .on(t.jobId)
      .where(sql`${t.status} = 'accepted'`),
    oneOf("job_offers_status_ck", "status", OFFER_STATUSES),
  ],
);

export interface QcMeasurement {
  name: string;
  expectedMm: number;
  toleranceMm: number;
  measuredMm?: number;
}

export const qcInspections = pgTable(
  "qc_inspections",
  {
    id: id(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => productionJobs.id),
    stage: text("stage").notNull(),
    authorId: uuid("author_id"),
    verdict: text("verdict"),
    measurements: jsonb("measurements").$type<QcMeasurement[]>().notNull().default([]),
    checklist: jsonb("checklist").$type<Record<string, boolean>>().notNull().default({}),
    photoFileIds: jsonb("photo_file_ids").$type<string[]>().notNull().default([]),
    defects: jsonb("defects")
      .$type<{ code: string; severity: string; description?: string }[]>()
      .notNull()
      .default([]),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("qc_inspections_job_idx").on(t.jobId),
    oneOf("qc_inspections_stage_ck", "stage", ["supplier_evidence", "platform_review"]),
    oneOf("qc_inspections_verdict_ck", "verdict", QC_VERDICTS),
  ],
);

export const reprintRequests = pgTable("reprint_requests", {
  id: id(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => productionJobs.id),
  newJobId: uuid("new_job_id").references(() => productionJobs.id),
  reasonCode: text("reason_code").notNull(),
  rootCause: text("root_cause"),
  correctiveAction: text("corrective_action"),
  costBearer: text("cost_bearer").notNull(),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});
