import { sql } from "drizzle-orm";
import { date, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, minor, oneOf, ts } from "./_shared";
import { QUOTE_STATUSES } from "./enums";
import { orders } from "./orders";

export const pricingRuleSets = pgTable(
  "pricing_rule_sets",
  {
    id: id(),
    processCode: text("process_code").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull().default("draft"),
    rules: jsonb("rules").$type<Record<string, unknown>>().notNull(),
    createdBy: uuid("created_by"),
    activatedBy: uuid("activated_by"),
    activatedAt: ts("activated_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("pricing_rule_sets_version_uq").on(t.processCode, t.version),
    uniqueIndex("pricing_rule_sets_active_uq").on(t.processCode).where(sql`${t.status} = 'active'`),
    oneOf("pricing_rule_sets_status_ck", "status", ["draft", "active", "retired"]),
  ],
);

export const taxRates = pgTable("tax_rates", {
  id: id(),
  country: text("country").notNull(),
  kind: text("kind").notNull().default("vat"),
  rateBps: integer("rate_bps").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
});

export const quotes = pgTable(
  "quotes",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    status: text("status").notNull().default("ready"),
    mode: text("mode").notNull(),
    ruleSetId: uuid("rule_set_id").references(() => pricingRuleSets.id),
    overrideReason: text("override_reason"),
    createdBy: uuid("created_by"),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("quotes_order_idx").on(t.orderId, t.createdAt),
    oneOf("quotes_status_ck", "status", QUOTE_STATUSES),
    oneOf("quotes_mode_ck", "mode", ["auto", "manual"]),
  ],
);

export interface QuoteLine {
  kind: "manufacturing" | "urgency" | "design_fee" | "shipping" | "discount" | "service_fee";
  labelKey: string;
  amountNetMinor: number;
  meta?: Record<string, unknown>;
}

/** Immutable record of exactly what the customer was offered. Never recomputed. */
export const quoteSnapshots = pgTable("quote_snapshots", {
  quoteId: uuid("quote_id")
    .primaryKey()
    .references(() => quotes.id),
  inputs: jsonb("inputs").$type<Record<string, unknown>>().notNull(),
  lines: jsonb("lines").$type<QuoteLine[]>().notNull(),
  subtotalNetMinor: minor("subtotal_net_minor").notNull(),
  taxMinor: minor("tax_minor").notNull(),
  totalMinor: minor("total_minor").notNull(),
  computedTotalMinor: minor("computed_total_minor").notNull(),
  expectedPayoutMinor: minor("expected_payout_minor").notNull(),
  expectedMarginMinor: minor("expected_margin_minor").notNull(),
  taxRateBps: integer("tax_rate_bps").notNull(),
  currency: text("currency").notNull(),
  engineVersion: text("engine_version").notNull(),
  hash: text("hash").notNull(),
  createdAt: createdAt(),
});
