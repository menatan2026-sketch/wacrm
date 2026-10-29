import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, oneOf, ts, updatedAt } from "./_shared";
import { ORDER_FLOWS, ORDER_STATUSES, URGENCY_TIERS } from "./enums";
import { fileObjects } from "./files";
import { users } from "./identity";

export const wizardDrafts = pgTable(
  "wizard_drafts",
  {
    id: id(),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    anonTokenHash: text("anon_token_hash"),
    flow: text("flow").notNull(),
    step: text("step").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    payloadVersion: integer("payload_version").notNull().default(1),
    convertedOrderId: uuid("converted_order_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [
    index("wizard_drafts_owner_idx").on(t.ownerUserId),
    index("wizard_drafts_anon_idx").on(t.anonTokenHash),
    oneOf("wizard_drafts_flow_ck", "flow", ORDER_FLOWS),
  ],
);

export const addresses = pgTable("addresses", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  recipientName: text("recipient_name").notNull(),
  phone: text("phone").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  postalCode: text("postal_code"),
  country: text("country").notNull().default("IL"),
  notes: text("notes"),
  createdAt: createdAt(),
});

/** Customer-provided description for Flow B (object) and Flow C (idea). */
export interface OrderRequest {
  description?: string;
  photoFileIds?: string[];
  dimensions?: { name: string; valueMm: number }[];
  referenceObject?: string;
}

export const orders = pgTable(
  "orders",
  {
    id: id(),
    orderNumber: text("order_number").notNull(),
    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => users.id),
    flow: text("flow").notNull(),
    status: text("status").notNull().default("DRAFT"),
    onHold: boolean("on_hold").notNull().default(false),
    holdReason: text("hold_reason"),
    urgencyTier: text("urgency_tier").notNull().default("standard"),
    currency: text("currency").notNull().default("ILS"),
    locale: text("locale").notNull(),
    request: jsonb("request").$type<OrderRequest>().notNull().default({}),
    /** Why automation handed this order to a person (pricing/requirements guards). */
    reviewReasons: jsonb("review_reasons").$type<string[]>().notNull().default([]),
    shipToAddressId: uuid("ship_to_address_id").references(() => addresses.id),
    currentQuoteId: uuid("current_quote_id"),
    assignedSupplierId: uuid("assigned_supplier_id"),
    assignedStaffId: uuid("assigned_staff_id"),
    promisedShipDate: date("promised_ship_date"),
    promisedDeliveryDate: date("promised_delivery_date"),
    statusChangedAt: ts("status_changed_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
    shippedAt: ts("shipped_at"),
    deliveredAt: ts("delivered_at"),
    completedAt: ts("completed_at"),
    cancelledAt: ts("cancelled_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_number_uq").on(t.orderNumber),
    index("orders_customer_idx").on(t.customerUserId, t.createdAt),
    index("orders_attention_idx")
      .on(t.status, t.statusChangedAt)
      .where(
        sql`${t.onHold} OR ${t.status} IN ('REVIEW_REQUIRED','QC_PENDING','QC_FAILED','DISPUTED','ROUTING')`,
      ),
    oneOf("orders_status_ck", "status", ORDER_STATUSES),
    oneOf("orders_flow_ck", "flow", ORDER_FLOWS),
    oneOf("orders_urgency_ck", "urgency_tier", URGENCY_TIERS),
  ],
);

/** Plain-language usage answers collected by the wizard. */
export interface UsageAnswers {
  environment?: "indoor" | "outdoor" | "car" | "wet";
  heat?: "none" | "warm" | "hot" | "very_hot";
  load?: "none" | "light" | "moderate" | "heavy";
  flexibility?: "rigid" | "slight" | "rubber";
  appearance?: "functional" | "clean" | "showpiece";
  foodContact?: boolean;
  criticalDimensions?: string;
}

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    position: integer("position").notNull().default(0),
    title: text("title").notNull(),
    fileId: uuid("file_id").references(() => fileObjects.id),
    quantity: integer("quantity").notNull().default(1),
    processCode: text("process_code").notNull().default("FDM"),
    materialVariantId: uuid("material_variant_id"),
    qualityProfileCode: text("quality_profile_code"),
    unitsConfirmed: text("units_confirmed"),
    scale: numeric("scale", { precision: 8, scale: 4, mode: "number" }).notNull().default(1),
    usage: jsonb("usage").$type<UsageAnswers>().notNull().default({}),
    requirements: jsonb("requirements").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    event: text("event").notNull(),
    actorId: uuid("actor_id"),
    actorType: text("actor_type").notNull(),
    reason: text("reason"),
    at: createdAt(),
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId, t.at)],
);

export const orderMessages = pgTable(
  "order_messages",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    authorId: uuid("author_id"),
    authorType: text("author_type").notNull(),
    visibility: text("visibility").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("order_messages_order_idx").on(t.orderId, t.createdAt),
    oneOf("order_messages_visibility_ck", "visibility", ["customer", "internal"]),
    oneOf("order_messages_author_ck", "author_type", ["customer", "staff", "system"]),
  ],
);
