import { boolean, date, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, minor, oneOf, ts, updatedAt } from "./_shared";
import { PAYMENT_STATUSES, SHIPMENT_STATUSES } from "./enums";
import { fileObjects } from "./files";
import { orders } from "./orders";
import { quotes } from "./pricing";
import { productionJobs, suppliers } from "./suppliers";

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    quoteId: uuid("quote_id").notNull().references(() => quotes.id),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    status: text("status").notNull().default("PENDING"),
    amountMinor: minor("amount_minor").notNull(),
    refundedMinor: minor("refunded_minor").notNull().default(0),
    currency: text("currency").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    checkoutUrl: text("checkout_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payments_idem_uq").on(t.idempotencyKey),
    uniqueIndex("payments_provider_ref_uq").on(t.provider, t.providerRef),
    index("payments_order_idx").on(t.orderId),
    oneOf("payments_status_ck", "status", PAYMENT_STATUSES),
  ],
);

export const paymentTransactions = pgTable("payment_transactions", {
  id: id(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  kind: text("kind").notNull(),
  amountMinor: minor("amount_minor").notNull(),
  providerEventId: text("provider_event_id"),
  at: createdAt(),
});

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id),
    amountMinor: minor("amount_minor").notNull(),
    reasonCode: text("reason_code").notNull(),
    note: text("note"),
    status: text("status").notNull().default("requested"),
    requestedBy: uuid("requested_by"),
    approvedBy: uuid("approved_by"),
    providerRef: text("provider_ref"),
    createdAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  () => [oneOf("refunds_status_ck", "status", ["requested", "approved", "completed", "failed", "rejected"])],
);

export const invoices = pgTable("invoices", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  kind: text("kind").notNull(),
  documentNumber: text("document_number").notNull().unique(),
  provider: text("provider").notNull(),
  netMinor: minor("net_minor").notNull(),
  taxMinor: minor("tax_minor").notNull(),
  totalMinor: minor("total_minor").notNull(),
  currency: text("currency").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  issuedAt: createdAt(),
});

export const payoutStatements = pgTable("payout_statements", {
  id: id(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  totalMinor: minor("total_minor").notNull(),
  currency: text("currency").notNull().default("ILS"),
  status: text("status").notNull().default("closed"),
  supplierInvoiceFileId: uuid("supplier_invoice_file_id").references(() => fileObjects.id),
  paidAt: ts("paid_at"),
  createdAt: createdAt(),
});

export const payoutLedgerEntries = pgTable(
  "payout_ledger_entries",
  {
    id: id(),
    supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
    jobId: uuid("job_id").references(() => productionJobs.id),
    statementId: uuid("statement_id").references(() => payoutStatements.id),
    kind: text("kind").notNull(),
    amountMinor: minor("amount_minor").notNull(),
    currency: text("currency").notNull().default("ILS"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("payout_ledger_supplier_idx").on(t.supplierId, t.createdAt), oneOf("payout_ledger_kind_ck", "kind", ["earning", "adjustment", "clawback", "payment"])],
);

export const inboundWebhooks = pgTable(
  "inbound_webhooks",
  {
    id: id(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    signatureValid: boolean("signature_valid").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("received"),
    error: text("error"),
    receivedAt: createdAt(),
    processedAt: ts("processed_at"),
  },
  (t) => [uniqueIndex("inbound_webhooks_uq").on(t.provider, t.providerEventId)],
);

export const shipments = pgTable(
  "shipments",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    provider: text("provider").notNull(),
    serviceLevel: text("service_level").notNull().default("standard"),
    status: text("status").notNull().default("LABEL_CREATED"),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    labelFileId: uuid("label_file_id").references(() => fileObjects.id),
    costMinor: minor("cost_minor"),
    currency: text("currency").notNull().default("ILS"),
    createdBy: uuid("created_by"),
    deliveredAt: ts("delivered_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("shipments_order_idx").on(t.orderId), oneOf("shipments_status_ck", "status", SHIPMENT_STATUSES)],
);

export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: id(),
    shipmentId: uuid("shipment_id").notNull().references(() => shipments.id),
    status: text("status").notNull(),
    providerEventId: text("provider_event_id"),
    description: text("description"),
    at: createdAt(),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("shipment_events_provider_uq").on(t.shipmentId, t.providerEventId)],
);
