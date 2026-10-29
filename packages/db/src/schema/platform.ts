import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, oneOf, ts, updatedAt } from "./_shared";
import { users } from "./identity";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    at: createdAt(),
    actorId: uuid("actor_id"),
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    reason: text("reason"),
    requestId: text("request_id"),
  },
  (t) => [
    index("audit_events_resource_idx").on(t.resourceType, t.resourceId, t.at),
    index("audit_events_actor_idx").on(t.actorId, t.at),
    index("audit_events_at_idx").on(t.at),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: id(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    requestId: text("request_id"),
    createdAt: createdAt(),
    availableAt: ts("available_at").notNull().defaultNow(),
    publishedAt: ts("published_at"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (t) => [
    index("outbox_unpublished_idx")
      .on(t.availableAt)
      .where(sql`${t.publishedAt} IS NULL`),
  ],
);

export const processedEvents = pgTable(
  "processed_events",
  {
    handler: text("handler").notNull(),
    eventId: uuid("event_id").notNull(),
    processedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.handler, t.eventId] })],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    scope: text("scope").notNull(),
    actorKey: text("actor_key").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response").$type<unknown>(),
    createdAt: createdAt(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.actorKey, t.key] })],
);

export interface FlagRollout {
  roles?: string[];
  userIds?: string[];
  percentage?: number;
}

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  rollout: jsonb("rollout").$type<FlagRollout>().notNull().default({}),
  description: text("description").notNull().default(""),
  updatedBy: uuid("updated_by"),
  updatedAt: updatedAt(),
});

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    name: text("name").notNull(),
    at: createdAt(),
    sessionId: text("session_id"),
    userId: uuid("user_id"),
    orderId: uuid("order_id"),
    props: jsonb("props").$type<Record<string, unknown>>().notNull().default({}),
    locale: text("locale"),
    surface: text("surface"),
  },
  (t) => [index("analytics_events_name_idx").on(t.name, t.at)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id),
    kind: text("kind").notNull(),
    channel: text("channel").notNull(),
    locale: text("locale").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    readAt: ts("read_at"),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    oneOf("notifications_channel_ck", "channel", ["email", "in_app"]),
    oneOf("notifications_status_ck", "status", ["pending", "sent", "failed", "skipped"]),
  ],
);

/** Operational record of transactional email (and the dev mailbox when EMAIL_DRIVER=log). Purged after 30 days. */
export const emailMessages = pgTable(
  "email_messages",
  {
    id: id(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    text: text("text").notNull(),
    html: text("html").notNull(),
    template: text("template").notNull(),
    locale: text("locale").notNull(),
    status: text("status").notNull().default("sent"),
    createdAt: createdAt(),
  },
  (t) => [index("email_messages_to_idx").on(t.toAddress, t.createdAt)],
);

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: updatedAt(),
});
