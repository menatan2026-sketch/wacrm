import * as OTPAuth from "otpauth";
import { schema, uuidv7, and, desc, eq, gt, isNull, sql, type Role, type Surface } from "@mfg/db";
import type { Deps } from "../../deps";
import { audit } from "../../platform/audit";
import { enforce } from "../../platform/rate-limit";
import type { Actor, Ctx, RoleGrant, UserActor } from "../../shared/context";
import { hmac, randomDigits, randomToken, safeEqual, seal, sha256, unseal } from "../../shared/crypto";
import { DomainError } from "../../shared/errors";
import { renderEmail } from "../notifications/email";
import { STAFF_ROLES, SUPPLIER_ROLES } from "./rbac";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const SESSION_TTL_MS: Record<Surface, number> = {
  customer: 7 * 24 * 3600 * 1000,
  supplier: 7 * 24 * 3600 * 1000,
  admin: 8 * 3600 * 1000,
};
const MFA_PURPOSE = "mfa-totp";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const codeHash = (d: Deps, email: string, code: string) => hmac(d.secret, `login:${normalizeEmail(email)}:${code}`);

export async function requestLoginCode(d: Deps, input: { email: string; locale: string; ip: string }): Promise<void> {
  const email = normalizeEmail(input.email);
  await enforce(d.rateLimiter, `login-code:email:${sha256(email)}`, 5, 15 * 60);
  await enforce(d.rateLimiter, `login-code:ip:${input.ip}`, 20, 15 * 60);
  const code = randomDigits(6);
  await d.db.insert(schema.loginCodes).values({
    id: uuidv7(),
    email,
    codeHash: codeHash(d, email, code),
    expiresAt: new Date(d.clock.now().getTime() + CODE_TTL_MS),
  });
  await d.email.send({ to: email, ...renderEmail("login_code", input.locale, { code }) });
}

export async function loadRoles(db: Deps["db"] | Ctx["db"], userId: string): Promise<RoleGrant[]> {
  const rows = await db
    .select({ role: schema.roleAssignments.role, scopeType: schema.roleAssignments.scopeType, scopeId: schema.roleAssignments.scopeId })
    .from(schema.roleAssignments)
    .where(and(eq(schema.roleAssignments.userId, userId), isNull(schema.roleAssignments.revokedAt)));
  return rows.map((r) => ({ role: r.role as Role, scopeType: r.scopeType as RoleGrant["scopeType"], scopeId: r.scopeId }));
}

export const surfaceAllowed = (surface: Surface, roles: RoleGrant[]): boolean => {
  if (surface === "customer") return true;
  if (surface === "supplier") return roles.some((r) => SUPPLIER_ROLES.includes(r.role) || r.role === "SUPER_ADMIN");
  return roles.some((r) => STAFF_ROLES.includes(r.role));
};

export interface VerifyResult {
  sessionToken: string;
  expiresAt: Date;
  userId: string;
  /** Staff sessions are usable only after TOTP verification. */
  mfa: "not_required" | "verify" | "enroll";
}

export async function verifyLoginCode(
  d: Deps,
  input: { email: string; code: string; surface: Surface; locale: string; ip: string; userAgent?: string; inviteToken?: string },
): Promise<VerifyResult> {
  const email = normalizeEmail(input.email);
  await enforce(d.rateLimiter, `login-verify:ip:${input.ip}`, 30, 15 * 60);
  const now = d.clock.now();
  const [row] = await d.db
    .select()
    .from(schema.loginCodes)
    .where(and(eq(schema.loginCodes.email, email), isNull(schema.loginCodes.consumedAt)))
    .orderBy(desc(schema.loginCodes.createdAt))
    .limit(1);
  if (!row) throw new DomainError("auth.code_invalid", 400);
  if (row.expiresAt <= now) throw new DomainError("auth.code_expired", 400);
  if (row.attempts >= MAX_CODE_ATTEMPTS) throw new DomainError("auth.too_many_attempts", 429);
  if (!safeEqual(row.codeHash, codeHash(d, email, input.code.trim()))) {
    // Committed on its own so a failed guess always counts against the code.
    await d.db
      .update(schema.loginCodes)
      .set({ attempts: sql`${schema.loginCodes.attempts} + 1` })
      .where(eq(schema.loginCodes.id, row.id));
    throw new DomainError("auth.code_invalid", 400);
  }
  return d.db.transaction(async (tx) => {
    const ctx: Ctx = { db: tx, actor: { kind: "guest", anonKey: null }, clock: d.clock, inTransaction: true };
    // Consume atomically: two concurrent requests with the same code cannot both succeed.
    const consumed = await tx
      .update(schema.loginCodes)
      .set({ consumedAt: now })
      .where(and(eq(schema.loginCodes.id, row.id), isNull(schema.loginCodes.consumedAt)))
      .returning({ id: schema.loginCodes.id });
    if (consumed.length === 0) throw new DomainError("auth.code_invalid", 400);

    let [user] = await tx.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`);
    if (!user) {
      if (input.surface === "admin") throw new DomainError("auth.no_access_to_surface", 403);
      [user] = await tx
        .insert(schema.users)
        .values({ id: uuidv7(), email, preferredLocale: (["he", "en", "ru"].includes(input.locale) ? input.locale : "he") as "he" })
        .returning();
      await tx.insert(schema.roleAssignments).values({ id: uuidv7(), userId: user!.id, role: "CUSTOMER", scopeType: "platform" });
      await audit({ ...ctx, actor: { kind: "system", name: "auth" } }, { action: "user.registered", resourceType: "user", resourceId: user!.id });
    }
    const u = user!;
    if (u.status !== "active") throw new DomainError("auth.no_access_to_surface", 403);

    if (input.inviteToken) await acceptInvitationTx(ctx, d, u.id, email, input.inviteToken);

    const roles = await loadRoles(tx, u.id);
    if (!surfaceAllowed(input.surface, roles)) throw new DomainError("auth.no_access_to_surface", 403);

    const token = randomToken(32);
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS[input.surface]);
    await tx.insert(schema.sessions).values({
      id: uuidv7(),
      userId: u.id,
      tokenHash: sha256(token),
      surface: input.surface,
      expiresAt,
      ipHash: sha256(input.ip).slice(0, 16),
      userAgent: input.userAgent?.slice(0, 300) ?? null,
    });
    const mfa = input.surface !== "admin" ? "not_required" : u.mfaEnabled ? "verify" : "enroll";
    return { sessionToken: token, expiresAt, userId: u.id, mfa };
  });
}

/** Resolve a session cookie into an actor. Returns null for missing, expired or revoked sessions. */
export async function resolveSession(d: Deps, token: string | undefined, surface: Surface): Promise<UserActor | null> {
  if (!token) return null;
  const now = d.clock.now();
  const [row] = await d.db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, sha256(token)), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, now)));
  if (!row || row.session.surface !== surface || row.user.status !== "active") return null;
  if (now.getTime() - row.session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await d.db.update(schema.sessions).set({ lastSeenAt: now }).where(eq(schema.sessions.id, row.session.id));
  }
  const roles = await loadRoles(d.db, row.user.id);
  if (!surfaceAllowed(surface, roles)) return null;
  return {
    kind: "user",
    userId: row.user.id,
    email: row.user.email,
    locale: row.user.preferredLocale,
    roles,
    sessionId: row.session.id,
    surface,
    mfaVerified: row.session.mfaVerifiedAt !== null,
  };
}

export async function revokeSession(d: Deps, token: string): Promise<void> {
  await d.db.update(schema.sessions).set({ revokedAt: d.clock.now() }).where(eq(schema.sessions.tokenHash, sha256(token)));
}

const totpFor = (email: string, secretBase32: string) =>
  new OTPAuth.TOTP({ issuer: "Platform Ops", label: email, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secretBase32) });

/** Begin (or restart) TOTP enrollment. The seed is stored sealed and enabled only after a valid code. */
export async function startMfaEnrollment(d: Deps, actor: UserActor): Promise<{ secret: string; uri: string }> {
  const [user] = await d.db.select().from(schema.users).where(eq(schema.users.id, actor.userId));
  if (!user || user.mfaEnabled) throw new DomainError("auth.forbidden", 403);
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  await d.db.update(schema.users).set({ mfaSecret: seal(d.secret, MFA_PURPOSE, secret) }).where(eq(schema.users.id, actor.userId));
  return { secret, uri: totpFor(user.email, secret).toString() };
}

export async function verifyMfa(d: Deps, actor: UserActor, code: string): Promise<void> {
  await enforce(d.rateLimiter, `mfa:${actor.userId}`, 10, 15 * 60);
  const [user] = await d.db.select().from(schema.users).where(eq(schema.users.id, actor.userId));
  if (!user?.mfaSecret) throw new DomainError("auth.mfa_required", 400);
  const secret = unseal(d.secret, MFA_PURPOSE, user.mfaSecret);
  if (totpFor(user.email, secret).validate({ token: code.trim(), window: 1 }) === null) {
    throw new DomainError("auth.mfa_invalid", 400);
  }
  await d.db.transaction(async (tx) => {
    if (!user.mfaEnabled) await tx.update(schema.users).set({ mfaEnabled: true }).where(eq(schema.users.id, user.id));
    await tx.update(schema.sessions).set({ mfaVerifiedAt: d.clock.now() }).where(eq(schema.sessions.id, actor.sessionId));
    await audit({ db: tx, actor, clock: d.clock, inTransaction: true }, { action: user.mfaEnabled ? "mfa.verified" : "mfa.enrolled", resourceType: "user", resourceId: user.id });
  });
}

/** Test helper: generate the current TOTP for a user's stored seed. */
export function currentTotp(d: Deps, email: string, sealedSecret: string): string {
  return totpFor(email, unseal(d.secret, MFA_PURPOSE, sealedSecret)).generate();
}

export async function createSupplierInvitation(ctx: Ctx, d: Deps, input: { supplierId: string; email: string; locale: string; supplierName: string; role?: Role }): Promise<string> {
  const token = randomToken(24);
  await ctx.db.insert(schema.supplierInvitations).values({
    id: uuidv7(),
    supplierId: input.supplierId,
    email: normalizeEmail(input.email),
    role: input.role ?? "SUPPLIER_MANAGER",
    tokenHash: sha256(token),
    expiresAt: new Date(d.clock.now().getTime() + 14 * 24 * 3600 * 1000),
    createdBy: ctx.actor.kind === "user" ? ctx.actor.userId : null,
  });
  await audit(ctx, { action: "supplier.invited", resourceType: "supplier", resourceId: input.supplierId, after: { role: input.role ?? "SUPPLIER_MANAGER" } });
  return token;
}

export async function findInvitation(d: Deps, token: string) {
  const [row] = await d.db
    .select({ invitation: schema.supplierInvitations, supplierName: schema.suppliers.name })
    .from(schema.supplierInvitations)
    .innerJoin(schema.suppliers, eq(schema.suppliers.id, schema.supplierInvitations.supplierId))
    .where(and(eq(schema.supplierInvitations.tokenHash, sha256(token)), isNull(schema.supplierInvitations.acceptedAt), gt(schema.supplierInvitations.expiresAt, d.clock.now())));
  return row ?? null;
}

async function acceptInvitationTx(ctx: Ctx, d: Deps, userId: string, email: string, token: string): Promise<void> {
  const [inv] = await ctx.db
    .select()
    .from(schema.supplierInvitations)
    .where(and(eq(schema.supplierInvitations.tokenHash, sha256(token)), isNull(schema.supplierInvitations.acceptedAt), gt(schema.supplierInvitations.expiresAt, d.clock.now())))
    .for("update");
  if (!inv || inv.email !== email) throw new DomainError("auth.invitation_invalid", 400);
  await ctx.db.update(schema.supplierInvitations).set({ acceptedAt: d.clock.now() }).where(eq(schema.supplierInvitations.id, inv.id));
  await ctx.db.insert(schema.roleAssignments).values({ id: uuidv7(), userId, role: inv.role, scopeType: "supplier", scopeId: inv.supplierId, grantedBy: inv.createdBy });
  await ctx.db
    .update(schema.suppliers)
    .set({ status: sql`CASE WHEN ${schema.suppliers.status} = 'invited' THEN 'onboarding' ELSE ${schema.suppliers.status} END` })
    .where(eq(schema.suppliers.id, inv.supplierId));
  await audit({ ...ctx, actor: { kind: "user", userId, email, locale: "he", roles: [], sessionId: "", surface: "supplier", mfaVerified: false } as Actor }, {
    action: "supplier.invitation_accepted",
    resourceType: "supplier",
    resourceId: inv.supplierId,
  });
}
