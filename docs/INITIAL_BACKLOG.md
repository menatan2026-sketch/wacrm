# Initial Backlog — fully specified tasks

> Status: **Draft v0.1 — not started. Implementation begins only after owner approval.**
> Covers the foundation milestones and M1: **M0R, M0C, M0D, M0E, M0F, M1**. Later milestones are listed by task ID in [MASTER_PLAN §24.2](./MASTER_PLAN.md#242-task-breakdown) and expanded in their own STEP 2 (PLAN).
> **DoD** for every task = the standard Definition of Done ([QUALITY_PLAN §7](./QUALITY_PLAN.md#7-definition-of-done-every-task)) + the task-specific items listed.
> Execution order: M0R → (M0C ∥ M0D ∥ M0E) → M0F → M1.

---

## M0R — Repository & platform foundation

**Gate to start:** ADR-0001 decided (where the code lives).

### M0R-T01 — Monorepo bootstrap
- **Purpose:** One consistent, strict, fast workspace for all apps/packages.
- **Depends on:** ADR-0001, ADR-0003.
- **Modules:** root, `apps/*`, `packages/*`, `services/geometry`.
- **Implementation:** pnpm workspaces + Turborepo pipelines (`lint`, `typecheck`, `test`, `build`); `tsconfig` base (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); ESLint flat config + Prettier; `.editorconfig`; Node version pinned (`.nvmrc` + `engines`); `packages/types` with branded `Id<T>`; lint-staged + a pre-commit hook; the Python project for geometry managed with `uv`, plus Ruff + mypy.
- **Tests:** A sample unit test per package runs through Turbo; the cache works on a second run.
- **Acceptance:** `pnpm i && pnpm turbo lint typecheck test build` passes from a clean clone in < 5 min.
- **DoD:** README "Repository layout" section written.

### M0R-T02 — CI pipeline
- **Purpose:** Every PR is proven before merge.
- **Depends on:** T01.
- **Modules:** `.github/workflows/*`.
- **Implementation:** Jobs: install (cached) → lint/format check → typecheck → unit → integration (service containers: postgres, redis, minio) → build → dependency-cruiser → `pnpm audit`/OSV → CodeQL → secret scanning settings documented → Python lint/test. Concurrency cancel. Required checks on main. Dependabot/Renovate config.
- **Tests:** A deliberately failing lint/test on a branch blocks merge (verified once).
- **Acceptance:** PR checks are green in < 12 min; failures report clearly.
- **DoD:** CI badge + description in README.

### M0R-T03 — Local environment (Docker Compose)
- **Purpose:** A new engineer runs everything locally in minutes.
- **Depends on:** T01.
- **Modules:** `infrastructure/docker`.
- **Implementation:** Compose services: Postgres 16, Redis 7, MinIO (+ bucket init with block-public policy), Mailpit, a geometry service stub (health only, until M1-T03). Named volumes, health checks. `pnpm dev:infra` / `pnpm dev`.
- **Tests:** Integration test bootstrap connects to all services.
- **Acceptance:** clone → copy `.env.example` → `pnpm i` → `pnpm dev:infra` → `pnpm db:migrate && pnpm db:seed` → `pnpm dev` works on macOS and Linux.
- **DoD:** README "Local development" verified by a second person from scratch.

### M0R-T04 — Typed configuration
- **Purpose:** Fail fast on bad config; no secret in code.
- **Depends on:** T01.
- **Modules:** `packages/config`.
- **Implementation:** zod schemas per app (server/public split), loaded once, frozen; `.env.example` with every variable, its description and a safe placeholder; a guard ensuring no server secret is in a `NEXT_PUBLIC_*` variable.
- **Tests:** Unit: missing/invalid vars produce readable errors.
- **Acceptance:** An app refuses to start with an actionable message when config is invalid.
- **DoD:** Config documented in `.env.example` comments.

### M0R-T05 — Database package
- **Purpose:** Schema, migrations and seeds with a safe workflow.
- **Depends on:** T03, T04, ADR-0004.
- **Modules:** `packages/db`.
- **Implementation:** Drizzle schema files per module; migration generation → **reviewed SQL** committed; a migration runner (CLI + CI); a seed framework (idempotent); a UUIDv7 helper; `updated_at` trigger; an insert-only guard trigger function (used by later tables); a per-test-worker DB (template database clone) for fast integration tests.
- **Tests:** Migrations up on an empty DB; idempotent seed; the insert-only trigger rejects UPDATE/DELETE.
- **Acceptance:** `pnpm db:migrate`, `pnpm db:seed` and `pnpm db:reset` work locally and in CI.
- **DoD:** `DATABASE.md` conventions section confirmed or updated.

### M0R-T06 — Structured logging & request context
- **Purpose:** Every log line is traceable to a request, user and order.
- **Depends on:** T01.
- **Modules:** `packages/logging`.
- **Implementation:** pino; AsyncLocalStorage context (`request_id`, `user_id`, `org_id`, `order_id`, `job_id`, `supplier_id`); a redaction allow-list (emails/phones hashed); pretty output in dev, JSON otherwise; a child-logger API for workers.
- **Tests:** Unit: context propagation across async boundaries; redaction.
- **Acceptance:** A request log shows a consistent `request_id` across web → worker (propagated via job metadata).
- **DoD:** Logging guidelines added to `ARCHITECTURE.md §11`.

### M0R-T07 — Error model
- **Purpose:** No raw backend error ever reaches a user.
- **Depends on:** T01.
- **Modules:** `packages/core` (shared kernel), `packages/validation`.
- **Implementation:** `DomainError` with `code` (namespaced, e.g. `orders.invalid_transition`), `httpStatus`, `details`; a `Result` helper; mapping utilities for server actions/route handlers → `{ok:false, code}`; an unknown-error fallback with a reference code = `request_id`.
- **Tests:** Unit mapping tests.
- **Acceptance:** The error-code catalog is generated and its codes are checked against the `errors` i18n namespace in CI (from M0E-T05).
- **DoD:** —

### M0R-T08 — Outbox & worker skeleton
- **Purpose:** Reliable, idempotent background processing.
- **Depends on:** T05, T06, ADR-0005.
- **Modules:** `packages/core/outbox`, `apps/worker`.
- **Implementation:** An `outbox_events` table; `publish(tx, event)` API; a relay (poll + `FOR UPDATE SKIP LOCKED`) → BullMQ; a handler base with idempotency (processed-event table), retries with backoff, DLQ, graceful shutdown; a scheduler (repeatable jobs).
- **Tests:** Integration: an event written in a rolled-back transaction is never published; duplicate delivery runs the handler once; failure → retry → DLQ.
- **Acceptance:** A demo event flows web → outbox → worker → log within 2 s locally.
- **DoD:** —

### M0R-T09 — Audit module
- **Purpose:** Every sensitive change is attributable.
- **Depends on:** T05.
- **Modules:** `packages/core/modules/audit`.
- **Implementation:** An insert-only, monthly-partitioned `audit_events`; `audit.record(tx, {...})`, with before/after diff redaction; a query API (filters) for the admin.
- **Tests:** Integration: immutability; recorded in the same transaction (rollback → no row).
- **Acceptance:** The API supports filtering by resource, actor and time range with indexes.
- **DoD:** —

### M0R-T10 — Feature flags
- **Purpose:** Roll out risky features safely.
- **Depends on:** T05, T09.
- **Modules:** `packages/core/modules/flags`, `packages/config`.
- **Implementation:** A `feature_flags` table; evaluation by role/org/percentage (stable hashing); a cached client (Redis, TTL 30 s + invalidation); flags seeded: `AI_INTAKE`, `AUTO_PRICING`, `AUTO_ROUTING`, `AUTOMATED_QC`, `B2B_SUBSCRIPTIONS`, `PILOT_MANUAL_PAYMENT`, `ADVANCED_MODE`, `STEP_UPLOADS`, `SMS_NOTIFICATIONS`; changes audited.
- **Tests:** Unit evaluation; integration cache invalidation.
- **Acceptance:** A flag change takes effect in ≤ 30 s without a deploy.
- **DoD:** —

### M0R-T11 — Telemetry & error monitoring
- **Purpose:** See failures and latency from day one.
- **Depends on:** T06.
- **Modules:** `apps/*`, `services/geometry`.
- **Implementation:** OpenTelemetry SDK (traces + metrics; no-op exporter locally, OTLP configurable); an error-monitoring SDK with PII scrubbing in web/worker/geometry; source-map upload in CI (when credentials exist).
- **Tests:** A smoke test that a thrown error is captured with `request_id` (using a fake transport).
- **Acceptance:** A trace spans web → DB → outbox → worker in staging.
- **DoD:** —

### M0R-T12 — Test harness
- **Purpose:** Writing good tests is the easy path.
- **Depends on:** T05.
- **Modules:** `packages/testing`, `tests/e2e`.
- **Implementation:** A Vitest workspace; Testcontainers helpers; data factories; a fake clock; fake provider base classes; a Playwright project matrix (he/en/ru × desktop/mobile) scaffold; fast-check set up.
- **Tests:** —
- **Acceptance:** A sample integration and a sample E2E run in CI.
- **DoD:** Testing guide in `CONTRIBUTING.md`.

### M0R-T13 — Developer documentation
- **Purpose:** Onboarding in one sitting.
- **Depends on:** T01–T12.
- **Modules:** `README.md`, `CONTRIBUTING.md`, PR template.
- **Implementation:** An accurate local setup, scripts, conventions, the milestone protocol link, the commit convention, the ADR process.
- **Tests:** Fresh-clone dry run by someone who didn't write it.
- **Acceptance:** The new engineer is running locally in ≤ 30 min.
- **DoD:** —

### M0R-T14 — Module boundary enforcement
- **Purpose:** Keep the monolith modular.
- **Depends on:** T01.
- **Modules:** root config.
- **Implementation:** dependency-cruiser rules: modules import other modules only via `index.ts`; the domain can't import adapters/Next/Drizzle; UI packages can't import `core` internals; no cycles.
- **Tests:** A fixture violation fails CI.
- **Acceptance:** Rules run in CI with a readable report.
- **DoD:** Rules documented in `ARCHITECTURE.md §3`.

---

## M0C — Design system implementation

### M0C-T01 — Tokens package
- **Purpose:** One source of truth for visual decisions.
- **Depends on:** M0R-T01; UI_DESIGN_SYSTEM approved.
- **Modules:** `packages/tokens`.
- **Implementation:** Token source (TS/JSON, W3C design-token format) for color (OKLCH, light/dark), typography, spacing, radii, borders, elevation, breakpoints, z-index and motion references; a build to CSS custom properties + TS constants + Tailwind v4 `@theme` block.
- **Tests:** Snapshot of the generated CSS; schema validation.
- **Acceptance:** Changing one token updates every consumer with no hardcoded values found (grep check).
- **DoD:** Token table in UI_DESIGN_SYSTEM synced (script-generated).

### M0C-T02 — Fonts
- **Purpose:** Consistent, fast typography in three scripts.
- **Depends on:** T01.
- **Modules:** `packages/ui/fonts`, `apps/web`.
- **Implementation:** Self-hosted IBM Plex Sans / Sans Hebrew / Mono WOFF2 subsets; `next/font/local` with size-adjusted fallbacks; per-locale preload; Hebrew/Russian script rules as CSS (`:lang(he)` tracking 0, line-height delta).
- **Tests:** Visual snapshots he/en/ru; a CLS check in Lighthouse CI.
- **Acceptance:** CLS from fonts < 0.01; only the needed subsets download per locale.
- **DoD:** Licence files included.

### M0C-T03 — Contrast verification
- **Purpose:** Never ship inaccessible color pairs.
- **Depends on:** T01.
- **Modules:** `packages/tokens/scripts`.
- **Implementation:** A script that evaluates the declared foreground/background pairs (text, UI, status chips, both themes) against WCAG thresholds; fails CI.
- **Tests:** Self-tests with known pairs.
- **Acceptance:** All declared pairs pass; failures name the pair and ratio.
- **DoD:** The final palette values are recorded in UI_DESIGN_SYSTEM.

### M0C-T04 — Tailwind theme and style lint
- **Purpose:** Make the right thing the default.
- **Depends on:** T01, M0E-T04.
- **Modules:** `packages/ui`, root lint config.
- **Implementation:** A Tailwind v4 theme bound to tokens only (default palette removed); lint rules: no arbitrary values, no physical direction utilities, no raw hex.
- **Tests:** Lint fixtures.
- **Acceptance:** CI rejects `ml-4`, `text-[#123456]` and `p-[13px]` in app code.
- **DoD:** —

### M0C-T05 — Component workbench
- **Purpose:** Build and review components in isolation across locale/direction/theme/motion.
- **Depends on:** T01, T02, M0E-T01.
- **Modules:** `apps/workbench` (Storybook) or `packages/ui` stories.
- **Implementation:** Toolbar globals: locale (he/en/ru + pseudo), direction, theme, reduced motion, density; a docs page per component with usage rules.
- **Tests:** The Storybook test runner in CI.
- **Acceptance:** Every component story renders in all globals without errors.
- **DoD:** —

### M0C-T06 — Primitives batch 1 (inputs & actions)
- **Purpose:** The core interaction set.
- **Depends on:** T04, T05, M0D-T01.
- **Modules:** `packages/ui`.
- **Implementation:** Button (all variants/states incl. loading/success), IconButton, Link, Input, Textarea, Label, HelperText, FieldError, Checkbox, RadioGroup, **RadioCard**, Switch, NumberInput, **MeasurementInput + UnitSelector** (locale decimal parsing, `dir=ltr` value), on Base UI primitives.
- **Tests:** Interaction + axe per story; unit tests for measurement parsing (`1,5`/`1.5`, mm/in conversion).
- **Acceptance:** Keyboard behaviour per WAI-ARIA APG; RTL snapshots correct.
- **DoD:** —

### M0C-T07 — Primitives batch 2 (overlays & navigation)
- **Purpose:** Overlays and navigation patterns.
- **Depends on:** T06.
- **Modules:** `packages/ui`.
- **Implementation:** Select, Combobox, Dialog, Sheet/Drawer (opens from inline-end), Popover, Tooltip, DropdownMenu, Tabs (sliding indicator), Stepper, Breadcrumbs, Pagination, Toast.
- **Tests:** Focus trap, scroll lock, Escape, return focus; RTL.
- **Acceptance:** No axe violations; works with screen readers (manual pass in he + en).
- **DoD:** —

### M0C-T08 — Feedback & data components
- **Purpose:** Every state looks finished.
- **Depends on:** T06, M0E-T03.
- **Modules:** `packages/ui`.
- **Implementation:** Skeleton, Progress (linear + staged), Banner, InlineAlert, EmptyState, Badge, **StatusChip** (domain registry), Money, DateTime, Measurement display, KPI tile, the Table foundation (TanStack, density, sticky header, column visibility, mobile card fallback).
- **Tests:** Formatting snapshots per locale; table keyboard navigation.
- **Acceptance:** StatusChip covers all statuses in UI_DESIGN_SYSTEM §5.4 with icon + label + tooltip.
- **DoD:** —

### M0C-T09 — Icons
- **Purpose:** A coherent icon language with correct RTL behaviour.
- **Depends on:** T01.
- **Modules:** `packages/ui/icons`.
- **Implementation:** A Lucide wrapper with size tokens; the custom domain icons (nozzle, build-plate, spool, caliper, layers-stack, routing-fork, toolpath) on a 24 px grid; the `directional` metadata → mirroring in RTL; an icon gallery story.
- **Tests:** RTL snapshot: directional icons mirrored, non-directional not.
- **Acceptance:** The design review approves the custom icons at 16/20/24 px.
- **DoD:** —

### M0C-T10 — Visual regression & a11y CI
- **Purpose:** Catch regressions automatically.
- **Depends on:** T05.
- **Modules:** CI.
- **Implementation:** Playwright screenshots of stories × (he, en, ru) × (light, dark) × (mobile, desktop); axe in the test runner; a threshold + review workflow.
- **Tests:** —
- **Acceptance:** A PR changing a component shows its diffs; serious/critical axe violations fail.
- **DoD:** —

---

## M0D — Motion implementation

### M0D-T01 — Motion tokens
- **Purpose:** Consistent motion everywhere.
- **Depends on:** M0C-T01.
- **Modules:** `packages/motion`.
- **Implementation:** Duration/easing/spring/distance tokens as CSS vars + TS; a logical inline axis variable (`--motion-inline`).
- **Tests:** Unit snapshot.
- **Acceptance:** Tokens consumed by `packages/ui` with no literal durations.
- **DoD:** —

### M0D-T02 — Reduced-motion provider and user override
- **Purpose:** Motion is never required to understand state.
- **Depends on:** T01.
- **Modules:** `packages/motion`, account settings later (M0F).
- **Implementation:** A provider combining `prefers-reduced-motion` + the user setting (cookie/account); a `useMotionPreference()` hook; a CSS `[data-reduced-motion]` hook.
- **Tests:** Unit; E2E with emulated reduced motion.
- **Acceptance:** All primitives switch to instant/fade variants.
- **DoD:** —

### M0D-T03 — Motion primitives
- **Purpose:** Reusable, interruptible transitions.
- **Depends on:** T01, T02.
- **Modules:** `packages/motion`.
- **Implementation:** `Presence`, `Fade`, `SlideInline` (direction-aware), `Collapse`, `StepTransition` (next/back mirrored), `SuccessCheck`, `LayerBuildup` glyph; Motion library via `LazyMotion` (code-split).
- **Tests:** Story interaction tests; bundle size check.
- **Acceptance:** Motion adds 0 KB to routes that don't use orchestrated primitives.
- **DoD:** —

### M0D-T04 — Staged-progress framework
- **Purpose:** Informational animations bound to real events.
- **Depends on:** T03.
- **Modules:** `packages/motion`, `packages/ui`.
- **Implementation:** A `StagedProgress` component fed by an event stream (stage id → pending/active/done/failed), with an aria-live announcer, an "explain after 10 s" message slot, and a static reduced-motion variant.
- **Tests:** Unit: never advances without an event; a11y announcements.
- **Acceptance:** A demo with a fake event source in the workbench.
- **DoD:** —

### M0D-T05 — Animation performance harness
- **Purpose:** Prove 60 fps on target devices.
- **Depends on:** T03.
- **Modules:** `tests/perf`.
- **Implementation:** A Playwright + Chrome trace script measuring frame times for named scenes; a budget assertion; CPU throttling ×4.
- **Tests:** —
- **Acceptance:** The report runs in CI nightly.
- **DoD:** —

---

## M0E — i18n / RTL foundation

### M0E-T01 — i18n package and next-intl integration
- **Purpose:** Three languages from the first screen.
- **Depends on:** M0R-T01, ADR-0007.
- **Modules:** `packages/i18n`, `apps/web`.
- **Implementation:** Locale config (`he` RTL, `en`, `ru`); namespaces per LOCALIZATION_GLOSSARY §1; message loading per route segment; `<html lang dir>`; typed message keys (TS augmentation).
- **Tests:** A unit test for config; a render test per locale.
- **Acceptance:** A sample page renders in three locales with the correct `dir`.
- **DoD:** —

### M0E-T02 — Locale detection, switcher and persistence
- **Purpose:** The right language, and never an unexpected switch.
- **Depends on:** T01.
- **Modules:** `apps/web` proxy, `packages/i18n`.
- **Implementation:** Detection order explicit > URL > Accept-Language > `he`, with a redirect only on `/`; a `LanguageSwitcher` (names in their own language: עברית / English / Русский) that keeps the current path; a cookie + (after M0F) the account preference.
- **Tests:** E2E-01; unit for the detection order.
- **Acceptance:** Switching language keeps the page and scroll position, and persists across sessions.
- **DoD:** —

### M0E-T03 — Formatters
- **Purpose:** Correct numbers, money, dates and measurements.
- **Depends on:** T01.
- **Modules:** `packages/i18n/format`.
- **Implementation:** `formatMoney(Money, locale)`, `formatNumber`, `formatPercent`, `formatDate/Time/Relative` (timezone aware), `formatMeasurement(value_mm, unit, locale)`, `parseDecimal(input, locale)`; an Israeli business calendar helper (Sun–Thu, holidays, data-driven).
- **Tests:** A snapshot table per locale (LOCALIZATION_GLOSSARY §2); property tests for parse/format round-trips.
- **Acceptance:** No currency symbol concatenation anywhere (lint/grep check).
- **DoD:** —

### M0E-T04 — Lint rules (literals & physical CSS)
- **Purpose:** Prevent the two most common i18n/RTL bugs.
- **Depends on:** M0R-T01.
- **Modules:** root ESLint config.
- **Implementation:** A no-literal-string rule for JSX text and user-visible attributes; a ban on physical direction classes/properties; documented escape hatches.
- **Tests:** Rule fixtures.
- **Acceptance:** CI fails on violations with a fix hint.
- **DoD:** —

### M0E-T05 — Catalog CI and pseudo-locales
- **Purpose:** Catalogs are never incomplete or inconsistent.
- **Depends on:** T01.
- **Modules:** `packages/i18n/scripts`.
- **Implementation:** Checks: missing keys, extra keys, ICU syntax, argument parity, plural categories per locale (he: one/two/other; ru: one/few/many/other), max-length metadata, error-code coverage (M0R-T07). Pseudo-locales `en-XA` (+40 %) and `he-XB` in dev/staging.
- **Tests:** Script self-tests.
- **Acceptance:** A PR adding an en-only key fails with a clear list.
- **DoD:** —

### M0E-T06 — Bidi helpers and direction hook
- **Purpose:** Mixed-direction content renders correctly.
- **Depends on:** T01.
- **Modules:** `packages/i18n`, `packages/ui`.
- **Implementation:** `<Bdi>`, `<LtrValue>` (codes, measurements, file names, emails), `useDirection()`; guidance in the workbench.
- **Tests:** RTL snapshots with order numbers, file names with parentheses, measurements.
- **Acceptance:** No punctuation jumping in the he snapshots for the sample set.
- **DoD:** —

### M0E-T07 — Glossary seed and native review workflow
- **Purpose:** Native-quality terminology.
- **Depends on:** T05; owner decision D-10.
- **Modules:** `packages/i18n/messages`, PR template.
- **Implementation:** Seed `common`, `navigation`, `orders.status.*`, `manufacturing`, `materials` from the glossary; a `needs-native-review` label workflow; reviewer sign-off recorded in the glossary.
- **Tests:** —
- **Acceptance:** Native reviewers for he and ru are assigned and have reviewed the glossary v0.1.
- **DoD:** The glossary status updated to v0.2 (reviewed).

---

## M0F — Application shells, auth, RBAC

### M0F-T01 — Web app skeleton and surface routing
- **Purpose:** Three surfaces, one app, cleanly separated.
- **Depends on:** M0R, M0E-T01. Read `node_modules/next/dist/docs` for Next 16 conventions first (AGENTS.md).
- **Modules:** `apps/web`.
- **Implementation:** App Router with `[locale]` + `(customer)`, `(supplier)`, `(admin)` route groups; a host → surface resolution in the request proxy (dev: path prefixes `/partners`, `/ops` or local hostnames); a per-surface root layout and error boundary; a composition root for `core` services.
- **Tests:** Unit for host resolution; E2E that each surface renders.
- **Acceptance:** Customer pages ship no admin code (bundle analysis).
- **DoD:** ADR-0002 updated with any deviations.

### M0F-T02 — Authentication spike and decision
- **Purpose:** Choose an auth foundation that fits RBAC, orgs, MFA and three surfaces.
- **Depends on:** T01.
- **Modules:** spike branch; `docs/DECISIONS/0010-*`.
- **Implementation:** A time-boxed (3 days) evaluation of 2 candidates against the criteria: email OTP/magic link, TOTP/WebAuthn MFA, organization support, Postgres adapter with Drizzle, session revocation, host-only cookies, maintenance health, licence. Read official docs only.
- **Tests:** A prototype login on two surfaces with separate cookies.
- **Acceptance:** ADR-0010 moves to *Accepted*, with the rationale.
- **DoD:** —

### M0F-T03 — Authentication implementation
- **Purpose:** Secure sign-in for customers, suppliers and staff.
- **Depends on:** T02.
- **Modules:** `packages/auth`, `apps/web`, `identity` module.
- **Implementation:** Customer email OTP (+ optional password); supplier invite acceptance; staff SSO/password + mandatory MFA; step-up re-auth API; sessions with revocation; rate limits on auth endpoints; localized auth emails (React Email, he/en/ru); guest draft-claim hook (used in M1).
- **Tests:** Integration: OTP expiry/single use; MFA enforcement for staff; rate limiting; E2E-02.
- **Acceptance:** Staff can't access `ops.` without MFA; cookies are host-only `__Host-`.
- **DoD:** SECURITY §2 updated with the actual implementation.

### M0F-T04 — RBAC policy engine
- **Purpose:** Authorization that is server-side, scoped and testable.
- **Depends on:** T03.
- **Modules:** `packages/auth`, `identity`, `organizations`.
- **Implementation:** A permission catalog (typed), role → permissions, scoped role assignments, `can(actor, permission, resource)`, an `authorize()` guard helper for commands; an admin UI to grant/revoke roles (audited, step-up); a generated permission-matrix doc.
- **Tests:** A matrix test: all permissions × roles × scope cases; IDOR tests (E2E-15 base).
- **Acceptance:** No command executes without an explicit authorization call (lint/test that checks the command registry).
- **DoD:** The SECURITY §3 matrix regenerated.

### M0F-T05 — Customer shell
- **Purpose:** A premium, trilingual frame for the customer experience.
- **Depends on:** M0C-T06–T08, M0E-T02, T03.
- **Modules:** `apps/web (customer)`.
- **Implementation:** Header (logo slot, primary nav, language switcher, account menu), a mobile nav sheet, footer (legal links, accessibility statement), a home page skeleton with the three entry cards (static, final copy pending), an empty orders page, account settings (profile, language, reduced-motion, notifications placeholder).
- **Tests:** Six-cell visual snapshots; axe.
- **Acceptance:** The UI review passes the UI_DESIGN_SYSTEM checklist; no placeholder icons or default styles.
- **DoD:** —

### M0F-T06 — Supplier shell
- **Purpose:** A glove-friendly mobile frame.
- **Depends on:** same as T05.
- **Modules:** `apps/web (supplier)`.
- **Implementation:** A bottom tab bar (Today, Offers, Jobs, Payouts, More), a top nav on desktop, a Today empty state, a profile page skeleton, large touch targets per the density rules.
- **Tests:** Mobile snapshots in three locales; target-size check.
- **Acceptance:** All primary actions ≥ 48 px; usable at 320 px width.
- **DoD:** —

### M0F-T07 — Admin shell and RLS decision
- **Purpose:** A dense, fast operations frame.
- **Depends on:** same as T05.
- **Modules:** `apps/web (admin)`, `packages/db`.
- **Implementation:** A collapsible side nav (all sections from UX §3.3, with unbuilt ones hidden behind flags), a command palette skeleton, the attention-queue placeholder, the audit-log viewer (from M0R-T09), the feature-flag admin (from M0R-T10), a role management page (T04). A **decision on Postgres RLS** as defense in depth for orders/files (prototype + ADR addendum).
- **Tests:** E2E: staff navigation, flag toggle audited.
- **Acceptance:** The audit log and flags are usable by ops staff.
- **DoD:** The RLS decision recorded in ADR-0004.

### M0F-T08 — Security headers, CSP and rate limiting
- **Purpose:** Baseline web hardening.
- **Depends on:** T01.
- **Modules:** `apps/web`.
- **Implementation:** HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors, a nonce-based CSP (report-only in dev/staging → enforced before the pilot), a Redis sliding-window rate limiter middleware for actions/route handlers.
- **Tests:** Integration: headers present; rate limit returns a localized error.
- **Acceptance:** Security headers scan grade A on staging.
- **DoD:** —

### M0F-T09 — Health, request id and error pages
- **Purpose:** Operability and graceful failure.
- **Depends on:** T01, M0R-T06.
- **Modules:** `apps/web`, `apps/worker`.
- **Implementation:** `/healthz`, `/readyz`; request id generation/propagation; localized 404/500/maintenance pages showing a reference code; offline banner component.
- **Tests:** E2E: a forced error shows the friendly page with a reference code; the log contains the same id.
- **Acceptance:** No stack trace is ever rendered.
- **DoD:** —

### M0F-T10 — Legal and accessibility pages scaffold
- **Purpose:** Placeholders for required policies.
- **Depends on:** T05.
- **Modules:** `apps/web (customer)`.
- **Implementation:** CMS-less MDX pages per locale: Terms, Privacy, Cookies, Accessibility statement, Restricted uses, Shipping & returns. The content is provided by the business/legal team; the pages are clearly marked draft until approved.
- **Tests:** Link checks; three-locale rendering.
- **Acceptance:** Pages exist and are linked from the footer/checkout points.
- **DoD:** KNOWN_ISSUES tracks the pending legal content.

### M0F-T11 — Six-cell E2E smoke
- **Purpose:** Lock in the multilingual/responsive baseline.
- **Depends on:** T05–T09.
- **Modules:** `tests/e2e`.
- **Implementation:** Playwright projects for he/en/ru × desktop/mobile running E2E-01, E2E-02 and a basic E2E-15 probe; visual snapshots of shells.
- **Tests:** —
- **Acceptance:** Green in CI on every PR (smoke), full nightly.
- **DoD:** —

### M0F-T12 — API documentation v0
- **Purpose:** Start `API.md` alongside the first endpoints.
- **Depends on:** T03, T04.
- **Modules:** `docs/API.md`.
- **Implementation:** Conventions (auth, idempotency, error format, pagination, versioning for future public API), the list of server actions/route handlers with permissions.
- **Tests:** —
- **Acceptance:** Reviewed with the code.
- **DoD:** —

---

## M1 — Customers & orders

### M1-T01 — Catalog module
- **Purpose:** Data-driven processes, materials and quality profiles.
- **Depends on:** M0F-T04, M0F-T07.
- **Modules:** `catalog`, `packages/db`, admin UI.
- **Implementation:** Tables per DATABASE §2 catalog; seed FDM + six materials + colors + three quality profiles; admin CRUD with translations (he/en/ru fields, fallback flagged); a material properties editor (heat, UV, flexibility, strength, food-contact-certifiable).
- **Tests:** Integration CRUD + authorization; translation fallback.
- **Acceptance:** Ops can add a color variant without a deploy; customers only see `active` items.
- **DoD:** —

### M1-T02 — Files module
- **Purpose:** Secure, resumable uploads.
- **Depends on:** M0R-T03, M0F-T04.
- **Modules:** `files`, `StorageProvider` port + S3 adapter + fake.
- **Implementation:** Upload sessions (ext/size/quota validation), presigned PUT (exact length, 5 min), multipart for > 20 MB, completion endpoint, `file_objects`, quotas, presigned GET with authorization + audit, retention class, an abandoned-upload purge job.
- **Tests:** Integration with MinIO: expired URL, wrong size, other user's file → denied; purge job.
- **Acceptance:** A 100 MB STL uploads on a throttled connection with progress and resume.
- **DoD:** Security review STEP 9 completed for the upload boundary.

### M1-T03 — Geometry service v1
- **Purpose:** Trustworthy geometry metrics from untrusted files.
- **Depends on:** M0R-T03.
- **Modules:** `services/geometry`.
- **Implementation:** FastAPI `/analyze` with a stage event stream; STL (ascii/binary) + 3MF parsing; limits (size, triangles, time, zip ratio); metrics per ARCHITECTURE §7; a unit heuristic; a decimated preview GLB; typed failure codes (`unsupported_format`, `corrupt_file`, `too_large`, `too_complex`, `timeout`, `non_manifold`, `multiple_shells`…); hardened container (non-root, read-only, no egress).
- **Tests:** pytest with a fixture corpus (valid, broken, inch-scaled, huge, zip bomb); Hypothesis/Atheris fuzz nightly; metric accuracy against known solids (cube, cylinder) within 0.5 %.
- **Acceptance:** p95 ≤ 20 s for a 50 MB STL on the staging size; no crash on the fuzz corpus.
- **DoD:** The geometry API schema is published as a zod contract in `packages/validation`.

### M1-T04 — Geometry pipeline and live status
- **Purpose:** Real-time, honest analysis progress.
- **Depends on:** T02, T03, M0R-T08, M0D-T04.
- **Modules:** `geometry` module, `apps/worker`, `apps/web`.
- **Implementation:** `file.uploaded` → geometry job → stage events persisted → SSE endpoint (with a polling fallback) → `geometry_analyses`; retries for transient errors only; a manual-review fallback when analysis fails ("continue anyway").
- **Tests:** Integration with a fake geometry client: stages are emitted in order; a failure path; a duplicate job → one analysis.
- **Acceptance:** The UI shows only stages that actually happened; dimensions are shown as soon as available.
- **DoD:** —

### M1-T05 — Wizard drafts
- **Purpose:** Never lose customer progress.
- **Depends on:** M0F-T03.
- **Modules:** `orders` (drafts), `apps/web`.
- **Implementation:** A `wizard_drafts` table, a versioned payload schema, autosave on step change (debounced), an anonymous token for guests, a claim-on-sign-in, a 30-day expiry, a resume link.
- **Tests:** Integration: claim, expiry, schema migration of payload versions; E2E-05.
- **Acceptance:** Refreshing or switching device after sign-in resumes at the same step.
- **DoD:** —

### M1-T06 — Wizard UI, steps 1–5 (Flow A)
- **Purpose:** The core guided experience up to visual review.
- **Depends on:** T04, T05, T07, T08, M0C, M0D.
- **Modules:** `apps/web (customer)`.
- **Implementation:** Step 1 entry cards; Step 2 upload with staged progress; Step 3 usage questions (radio cards + "why we ask"); Step 4 dimension/unit confirmation with scaling; Step 5 visual review (viewer + issues list + summary). Mobile sticky action bar; desktop summary panel; flow-adaptive stepper.
- **Tests:** E2E-03, E2E-04 in six cells; axe; a visual regression of every step and state.
- **Acceptance:** Median time from landing to step 5 ≤ 2 min in the usability test; zero unfinished states.
- **DoD:** UX, UI and motion reviews (STEPS 6–8) signed off.

### M1-T07 — 3D viewer
- **Purpose:** A distinctive, performant model preview.
- **Depends on:** T03 (preview GLB), ADR-0015.
- **Modules:** `packages/ui/viewer` (lazy).
- **Implementation:** three.js/R3F, dynamically imported on visibility; a static preview image first; orbit/zoom/pan; a bounding box with dimension callouts (mono, LTR); issue overlays; a grid floor; keyboard controls; reduced motion (no auto-rotate); WebGL-unavailable fallback (image + dimensions table).
- **Tests:** Bundle budget; an FPS trace on the reference device profile; keyboard E2E; a fallback test with WebGL disabled.
- **Acceptance:** ≥ 50 fps for ≤ 200k-triangle previews on the mid-range profile; the viewer chunk ≤ 250 KB gzip.
- **DoD:** —

### M1-T08 — Requirements rules and restricted-use policy
- **Purpose:** Translate plain answers into technical requirements.
- **Depends on:** T01.
- **Modules:** `requirements`.
- **Implementation:** A rule table (data-driven) mapping usage answers → constraints (min heat resistance, UV, flexibility class, strength class, appearance tier, food-contact) + review flags; a restricted-use policy with plain-language explanations; outputs the `RequirementSet` with assumptions.
- **Tests:** Unit table tests for every rule; contradiction cases.
- **Acceptance:** Every answer has a documented downstream effect; restricted uses route to review.
- **DoD:** The rule table is documented for ops.

### M1-T09 — STEP/STP and OBJ feasibility spike
- **Purpose:** Decide on format scope with evidence.
- **Depends on:** T03.
- **Modules:** spike.
- **Implementation:** 3-day evaluation: OBJ via trimesh (units/scale ambiguity, multi-object); STEP via an OpenCascade binding (tessellation quality, container size, licence, performance, security).
- **Tests:** The fixture corpus per format.
- **Acceptance:** An ADR addendum: OBJ in/out of MVP; STEP phase recommendation.
- **DoD:** —

### M1-T10 — Orders module and state machine
- **Purpose:** The validated commercial lifecycle.
- **Depends on:** M0R-T08, M0R-T09, M0F-T04.
- **Modules:** `orders`.
- **Implementation:** Orders, items, addresses, the order number generator, the transition table per DATABASE §5.1, the generic `transition()` (validation, permission, timestamps, history, audit, outbox), `on_hold` handling, admin hold/unhold with a reason.
- **Tests:** An exhaustive (state × event) table test; concurrency (two transitions racing → one wins); a permission matrix.
- **Acceptance:** Invalid transitions return typed errors with no side effects.
- **DoD:** The state diagram regenerated from code into DATABASE.md.

### M1-T11 — Flow B and Flow C request UIs
- **Purpose:** Capture object/idea requests for the concierge service.
- **Depends on:** T02, T05, T08, T10.
- **Modules:** `apps/web (customer)`, `orders`.
- **Implementation:** Flow B: camera/library photos (≥ 1, ≤ 20), a reference-scale guide, key dimensions with MeasurementInput, usage questions, a short description. Flow C: a description with gentle prompts, optional sketch/photos, size constraints. Submit → `REVIEW_REQUIRED` with an SLA message; a confirmation email.
- **Tests:** E2E-06 in six cells; photo upload on mobile (camera emulation).
- **Acceptance:** Submission takes ≤ 5 min in the usability test; the SLA text comes from settings.
- **DoD:** —

### M1-T12 — Admin request queue and order detail
- **Purpose:** Ops can handle B/C requests and inspect any order.
- **Depends on:** T10, T11, M0C-T08.
- **Modules:** `apps/web (admin)`.
- **Implementation:** A queue (filters: flow, status, age, SLA breach), an order detail (files, viewer, answers, requirements, timeline, audit), an internal notes thread, a customer clarification message (email + in-app) that sets the request to awaiting customer, assignment to a staff member.
- **Tests:** E2E: request → clarify → customer replies; authorization.
- **Acceptance:** Ops sees SLA breaches first; every action is audited.
- **DoD:** —

### M1-T13 — Customer orders list and detail
- **Purpose:** The customer always knows the state and the next step.
- **Depends on:** T10, M0C-T08.
- **Modules:** `apps/web (customer)`.
- **Implementation:** A list (cards on mobile), a detail with StatusTimeline (customer labels per the glossary), the NextStepPanel, files, the request summary, a cancel (pre-payment) action, an empty state.
- **Tests:** Six-cell snapshots for each status; E2E cancel pre-payment.
- **Acceptance:** Every order status maps to a customer label + next-step sentence in three languages.
- **DoD:** —

### M1-T14 — Analytics capture v1
- **Purpose:** Collect KPI data from day one.
- **Depends on:** M0R-T08.
- **Modules:** `analytics`.
- **Implementation:** An `analytics_events` table (partitioned); server-side `track()` inside transactions for business events; a client `track()` endpoint (consent-aware, rate limited) for `session_started`, `upload_started`, `upload_completed`, `requirements_completed`, `order_created`, `design_requested`; the `manual_action_taken` event on admin actions.
- **Tests:** Integration: events emitted once per action; consent respected.
- **Acceptance:** A basic funnel query (upload → requirements) works on seeded data.
- **DoD:** The event dictionary documented in MASTER_PLAN §20.

### M1-T15 — Usability round 1
- **Purpose:** Validate Flow A and Flow B with real users in each language.
- **Depends on:** T06, T11 on staging.
- **Modules:** —
- **Implementation:** 5 participants per language (he, en, ru), mobile-first, moderated; tasks: upload and reach the visual review; submit a broken-part request. Measure success, time, SUS, terminology confusion.
- **Tests:** —
- **Acceptance:** Task success ≥ 80 % per language; findings triaged into KNOWN_ISSUES with a severity; CRITICAL/HIGH fixed before M2 ends.
- **DoD:** A report in `docs/research/usability-round-1.md`.
