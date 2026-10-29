import type { Role } from "@mfg/db";
import type { Actor, UserActor } from "../../shared/context";
import { DomainError, forbidden } from "../../shared/errors";

/** Permission catalog. The full role matrix is generated from ROLE_PERMISSIONS (SECURITY.md §3). */
export const PERMISSIONS = [
  "order.create",
  "order.read.own",
  "order.read.any",
  "order.manage",
  "order.message",
  "quote.manual",
  "quote.override",
  "catalog.manage",
  "pricing.rules.manage",
  "pricing.rules.activate",
  "supplier.manage",
  "supplier.self.manage",
  "routing.manage",
  "job.read.own",
  "job.respond",
  "job.update",
  "qc.verdict",
  "payment.read.any",
  "refund.request",
  "refund.approve",
  "shipment.manage",
  "payout.read.own",
  "payout.manage",
  "audit.read",
  "flags.manage",
  "users.roles.manage",
  "staff.access",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF_BASE: Permission[] = ["staff.access", "order.read.any"];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  CUSTOMER: ["order.create", "order.read.own", "order.message"],
  ENTERPRISE_ADMIN: ["order.create", "order.read.own", "order.message"],
  SUPPLIER_OPERATOR: ["job.read.own", "job.respond", "job.update"],
  SUPPLIER_MANAGER: [
    "job.read.own",
    "job.respond",
    "job.update",
    "supplier.self.manage",
    "payout.read.own",
  ],
  CAD_DESIGNER: [...STAFF_BASE, "order.message"],
  QUALITY_REVIEWER: [...STAFF_BASE, "qc.verdict"],
  SUPPORT_AGENT: [
    ...STAFF_BASE,
    "order.manage",
    "order.message",
    "refund.request",
    "shipment.manage",
    "payment.read.any",
  ],
  ADMIN: [
    ...STAFF_BASE,
    "order.manage",
    "order.message",
    "quote.manual",
    "quote.override",
    "catalog.manage",
    "pricing.rules.manage",
    "supplier.manage",
    "routing.manage",
    "qc.verdict",
    "payment.read.any",
    "refund.request",
    "shipment.manage",
    "audit.read",
    "flags.manage",
    "users.roles.manage",
  ],
  FINANCE_ADMIN: [
    ...STAFF_BASE,
    "pricing.rules.manage",
    "pricing.rules.activate",
    "payment.read.any",
    "refund.request",
    "refund.approve",
    "payout.manage",
    "audit.read",
  ],
  SUPER_ADMIN: [...PERMISSIONS],
};

export const STAFF_ROLES: readonly Role[] = [
  "CAD_DESIGNER",
  "QUALITY_REVIEWER",
  "SUPPORT_AGENT",
  "ADMIN",
  "FINANCE_ADMIN",
  "SUPER_ADMIN",
];
export const SUPPLIER_ROLES: readonly Role[] = ["SUPPLIER_OPERATOR", "SUPPLIER_MANAGER"];

export interface Scope {
  supplierId?: string;
}

/**
 * Server-side authorization. Supplier-scoped roles only grant permissions for their own
 * supplier; platform-scoped roles grant them everywhere.
 */
export function can(actor: Actor, permission: Permission, scope: Scope = {}): boolean {
  if (actor.kind === "system") return true;
  if (actor.kind !== "user") return false;
  return actor.roles.some((grant) => {
    if (!ROLE_PERMISSIONS[grant.role].includes(permission)) return false;
    if (grant.scopeType === "platform") return true;
    if (grant.scopeType === "supplier")
      return scope.supplierId !== undefined && scope.supplierId === grant.scopeId;
    return false;
  });
}

export function authorize(actor: Actor, permission: Permission, scope: Scope = {}): void {
  if (actor.kind === "guest" && permission === "order.create") return;
  if (!can(actor, permission, scope)) throw forbidden({ permission });
}

export function requireUser(actor: Actor): UserActor {
  if (actor.kind !== "user") throw new DomainError("auth.unauthenticated", 401);
  return actor;
}

/** The supplier ids a user acts for (via supplier-scoped roles). */
export function supplierScopes(actor: Actor): string[] {
  if (actor.kind !== "user") return [];
  return actor.roles.filter((g) => g.scopeType === "supplier" && g.scopeId).map((g) => g.scopeId!);
}

export const isStaff = (actor: Actor): boolean =>
  actor.kind === "user" && actor.roles.some((g) => STAFF_ROLES.includes(g.role));
