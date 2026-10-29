import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, oneOf, ts, updatedAt } from "./_shared";
import { LOCALES, ROLES, SURFACES } from "./enums";

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    phone: text("phone"),
    preferredLocale: text("preferred_locale").notNull().default("he"),
    reducedMotion: text("reduced_motion"),
    marketingConsentAt: ts("marketing_consent_at"),
    termsAcceptedAt: ts("terms_accepted_at"),
    status: text("status").notNull().default("active"),
    mfaSecret: text("mfa_secret"),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(sql`lower(${t.email})`),
    oneOf("users_locale_ck", "preferred_locale", LOCALES),
    oneOf("users_status_ck", "status", ["active", "disabled", "anonymized"]),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    surface: text("surface").notNull(),
    mfaVerifiedAt: ts("mfa_verified_at"),
    createdAt: createdAt(),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
  },
  (t) => [
    uniqueIndex("sessions_token_uq").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
    oneOf("sessions_surface_ck", "surface", SURFACES),
  ],
);

export const loginCodes = pgTable(
  "login_codes",
  {
    id: id(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("login_codes_email_idx").on(sql`lower(${t.email})`, t.createdAt)],
);

export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
    scopeType: text("scope_type").notNull().default("platform"),
    scopeId: uuid("scope_id"),
    grantedBy: uuid("granted_by"),
    createdAt: createdAt(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [
    index("role_assignments_user_idx").on(t.userId),
    oneOf("role_assignments_role_ck", "role", ROLES),
    oneOf("role_assignments_scope_ck", "scope_type", ["platform", "supplier", "organization"]),
  ],
);

export const supplierInvitations = pgTable("supplier_invitations", {
  id: id(),
  supplierId: uuid("supplier_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("SUPPLIER_MANAGER"),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  acceptedAt: ts("accepted_at"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});
