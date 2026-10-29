# 0010 — Authentication library and scoped RBAC

- **Status:** **Proposed** — library choice finalized by spike M0F-T02
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
