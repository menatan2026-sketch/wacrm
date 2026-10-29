import { schema, uuidv7, and, desc, eq, gte, lte, type SQL } from "@mfg/db";
import { authorize } from "../modules/identity/rbac";
import { actorId, actorType, type Ctx } from "../shared/context";

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

const SENSITIVE = /^(password|token|code|mfaSecret|mfa_secret|payoutDetails|payout_details|secret)$/i;

/** Strip secrets from audit payloads; audit rows are long-lived and widely readable by staff. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : redact(v)]),
    );
  }
  return value;
}

/** Record an audit event inside the caller's transaction. */
export async function audit(ctx: Ctx, entry: AuditEntry): Promise<void> {
  await ctx.db.insert(schema.auditEvents).values({
    id: uuidv7(),
    actorId: actorId(ctx.actor),
    actorType: actorType(ctx.actor),
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    before: entry.before === undefined ? null : redact(entry.before),
    after: entry.after === undefined ? null : redact(entry.after),
    reason: entry.reason ?? null,
    requestId: ctx.requestId ?? null,
  });
}

export interface AuditQuery {
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export async function queryAudit(ctx: Ctx, q: AuditQuery) {
  authorize(ctx.actor, "audit.read");
  const t = schema.auditEvents;
  const where: SQL[] = [];
  if (q.resourceType) where.push(eq(t.resourceType, q.resourceType));
  if (q.resourceId) where.push(eq(t.resourceId, q.resourceId));
  if (q.actorId) where.push(eq(t.actorId, q.actorId));
  if (q.from) where.push(gte(t.at, q.from));
  if (q.to) where.push(lte(t.at, q.to));
  return ctx.db
    .select()
    .from(t)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(t.at))
    .limit(Math.min(q.limit ?? 100, 500));
}
