# 0001 — Greenfield monorepo, separate from the wacrm CRM

- **Status:** Proposed — **owner decision required before M0R**
- **Date:** 2026-10-29
- **Related:** KNOWN_ISSUES KI-001, RISK R-020, MASTER_PLAN §2

## Context
The current repository is a fork of `ArnasDon/wacrm`: an MIT-licensed, self-hostable WhatsApp CRM template (Next.js 16, Supabase auth/DB/storage, next-intl, Tailwind v4, 36 migrations covering inbox, broadcasts, pipelines, automations and AI replies). The manufacturing platform shares the frontend stack family but none of the domain, data model or product.

## Options considered
1. **Evolve wacrm in place.** Reuses auth/UI scaffolding. But it inherits an unrelated schema, Supabase coupling, a single-surface structure and a non-monorepo layout, and every CRM feature would need removing. Git history and the README would describe another product. Long-term debt.
2. **New repository, greenfield monorepo (recommended).** A clean architecture per ARCHITECTURE.md, with the planning docs moved over. wacrm stays as the CRM fork and as a reference for proven patterns (security headers, next-intl setup, API-key hashing, SSRF guard, rate limiting, encrypted secrets, CI layout).
3. **Same repository, CRM code removed** (history kept). A clean tree but a confusing history, and fork-upstream links keep pointing to wacrm.

## Decision (proposed)
Option 2. If the owner prefers a single repository, option 3 is acceptable: it requires a dedicated commit removing the CRM code and the fork relationship, with the README rewritten.

## Consequences
- M0R-T01 starts from an empty monorepo.
- Code is never copied wholesale. A specific pattern may be re-implemented with attribution (MIT licence notice retained if any code is copied).
- The planning package in `/docs` here moves to the new repository at M0R start.
