# 06 · Phase 1 (MVP) plan, for approval

**Scope (from the brief):** auth, multi-tenancy, roles, employee
management, time clock (web + mobile), basic scheduling, chat, admin
dashboard, design system.

**Explicitly out of Phase 1:** desktop agent (Phase 2), AI features (Phase 4;
⌘K _search_ is in), provider-specific payroll formats, SAML/SCIM, billing
(Phase 5), tasks/forms/time-off (Phase 3).

Built in vertical slices: each milestone ends with something working end
to end, tested, in both languages and both themes.

## M0 · Foundations

- Monorepo (pnpm + Turborepo), shared configs, CI (lint, typecheck, unit,
  pgTAP, build, Playwright smoke), Renovate, gitleaks, CodeQL.
- `@repo/tokens` from `docs/platform/tokens`, `@repo/ui` with Storybook
  (he/en × light/dark + axe), `@repo/i18n` (he, en, pseudo-locales, RTL),
  `@repo/contracts`, `@repo/core`, `@repo/db` (`withUserTx` + Kysely).
- Local dev: `pnpm setup` → Supabase CLI up, migrations, seed, `.env` scaffold.
- **Exit:** a Storybook with core components passing axe in 4 modes; CI green.

## M1 · Tenancy, identity, RBAC, audit

- Migrations: organizations, legal entities, locations, departments, teams,
  members, profiles, devices, permissions, roles, role assignments,
  member visibility, invitations, audit log (hash chain), domain events,
  API keys.
- RLS helpers + **pgTAP isolation suite** (two-tenant tests for every table).
- Auth: email+password, magic link, **phone OTP**, Google, Microsoft; TOTP
  2FA; invite via email/SMS/WhatsApp link; org switcher.
- **Exit:** cross-tenant read/write impossible (proved by tests); a manager
  scoped to one location sees only that location's people.

## M2 · Onboarding & people

- Setup wizard (W-04) targeting ≤ 10 minutes, with a timed usability test.
- Directory, profile, add/edit, positions, custom fields, CSV/XLSX import
  with dry-run preview; restricted tables (sensitive data, pay rates).
- Roles & permissions UI (matrix + scoped assignment + "view as").
- **Exit:** a new owner sets up a 3-location company with 50 imported
  employees in under 10 minutes.

## M3 · Time & attendance

- `@repo/core` time engine: entry derivation from events, breaks,
  rounding, `il_standard` overtime tiers, rest-between-shifts, auto
  clock-out, anomalies. **≥ 95% branch coverage + property tests.**
- Clock in/out on web (W-12) and the kiosk PWA (K-01…K-04: PIN + photo).
- Live attendance board (W-30), timesheets (W-31/32), anomalies (W-33),
  approval engine, period lock, CSV/XLSX export with pay-code mapping (W-34).
- **Exit:** E2E: punch (web + kiosk) → entry → anomaly → manager edit with
  reason (audited) → approve → lock → export file matches a golden file.

## M4 · Mobile app

- Expo dev-client app: sign in (phone OTP first), permissions primer,
  Home/Clock (M-10…M-12) with **geofencing** and an **offline outbox**,
  schedule (M-20…M-23), timesheet (M-40), notifications, manager mode
  (M-100…M-102). Haptics, RTL, dark mode.
- Push via Expo; WhatsApp + SMS notification channels through the worker.
- **Exit:** Maestro E2E: clock in while offline → sync → appears on the
  web live board; cold start < 2 s on a mid-range Android device.

## M5 · Scheduling (basic)

- Scheduler (W-40): week/day views by employee/position/location,
  drag-drop with a keyboard alternative, copy week, templates, inline
  conflict / availability / overtime warnings from `@repo/core`, live
  labor cost vs budget.
- Publish with diff + notifications (W-41); open shifts, swap/drop/claim
  with approvals (W-42, M-21/22); availability.
- **Exit:** E2E: build week → conflict flagged → publish → employee claims
  open shift on mobile → manager approves → cost updates.

## M6 · Chat & dashboard

- Chat (W-50/M-30): DMs, groups, channels with auto-membership by
  location/team, threads, reactions, read state, file/photo attachments
  (virus-scanned), realtime over private Broadcast channels, push.
- Manager dashboard (W-10): on shift now, late/absent, open shifts,
  pending approvals, hours and cost vs budget, anomalies; ⌘K search.
- Demo company seed (Hebrew and English data, Tel Aviv / Haifa / Jerusalem
  branches, 60 employees, 4 weeks of history).
- **Exit:** full Definition of Done audit on every Phase 1 screen (RTL/LTR,
  light/dark, responsive, axe clean, all four states, permissions, no
  console errors), performance budgets met.

## Phase 1 test plan (critical flows gate the release)

| Flow                                             | Layers                             |
| ------------------------------------------------ | ---------------------------------- |
| Tenant isolation & scoped access                 | pgTAP                              |
| Overtime / break / rest calculations             | Vitest + fast-check property tests |
| Clock-in (web, kiosk, mobile online + offline)   | Playwright, Maestro                |
| Timesheet approve → lock → export                | Playwright + golden files          |
| Schedule build → publish → claim → approve       | Playwright + Maestro               |
| Chat send/receive realtime across web ↔ mobile   | Playwright + Maestro               |
| Every screen: axe, RTL/LTR, light/dark snapshots | Playwright + Storybook             |

At the end of Phase 1 I deliver: what was built, how to run and test it,
known limitations, and the Phase 2 plan (desktop agent + unified timeline

- productivity dashboard + privacy controls).
