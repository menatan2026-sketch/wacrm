# 0010 — Authentication library and scoped RBAC

- **Status:** **Accepted** (M0F) — in-house OTP sessions + `otpauth` TOTP; see Decision
- **Date:** 2026-10-29
- **Related:** SECURITY §2–§3

## Context
Requirements: customer email OTP/magic link, supplier invitations, staff SSO/password with mandatory MFA (TOTP/WebAuthn), step-up re-auth, session revocation, host-only cookies per surface, a Postgres adapter compatible with Drizzle, and organization membership. Authorization must be server-side, scoped and testable.

## Options (to evaluate in the spike, against official docs only)
- A self-hostable TypeScript auth library with organization and MFA support and a Drizzle adapter.
- Auth.js with custom MFA/organization layers.
- A hosted identity provider (faster MFA/SSO, but vendor cost, and data residency must be reviewed).

## Decision (partial, accepted)
- **RBAC is ours regardless of the library:** a typed permission catalog, scoped role assignments (`platform` / `organization:<id>` / `supplier:<id>`), `can(actor, permission, resource)` in every command, and generated matrix tests.
- The library choice is pending the spike.

## Consequences
The auth library is isolated behind `packages/auth`, so the domain never imports it.

## Decision (M0F)
Built in-house on primitives instead of adopting a full auth library, because every option either
lacked per-surface sessions or needed adapter work as large as the feature itself:

- **Sign-in:** passwordless email OTP for all three surfaces. 6-digit codes are stored as HMAC (never
  plaintext), expire after 10 minutes, allow 5 attempts (counted outside the verify transaction so a
  failed guess is never rolled back), and are consumed atomically. Rate limits: 5 codes per email and
  20 per IP per 15 minutes; 30 verifications per IP.
- **Sessions:** random token in a host-only, HttpOnly, SameSite=Lax cookie (`__Host-` prefix on
  HTTPS), stored as SHA-256. One cookie per surface (customer / supplier / admin), so an ops session
  never authorizes the public site and vice versa. Revocable; idle-touch every 5 minutes.
- **Staff MFA:** TOTP via the `otpauth` library (RFC 6238). The seed is sealed with AES-GCM under a
  key derived (HKDF) from `APP_SECRET`. Enrollment starts on the server render; verification is rate
  limited and marks the session `mfa_verified`. Every ops page requires it.
- **Suppliers:** invitation tokens (hashed, 14-day expiry) bind the invited email to a
  supplier-scoped role on first sign-in.
- **Authorization:** `can(actor, permission, { supplierId })` with role → permission tables and scoped
  grants, enforced in the domain services (not only in pages). Covered by unit tests and the
  `staff-access` integration suite.

Not yet built (tracked): SSO for staff, WebAuthn, step-up re-auth for refunds/payout changes.

