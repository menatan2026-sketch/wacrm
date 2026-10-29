# Quality Plan

> Status: **Draft v0.1 — awaiting owner approval**
> Quality beats speed. Polish is part of Done.

## 1. Test strategy (pyramid)

| Layer | Tool | Scope | Runs |
|---|---|---|---|
| Static | TypeScript strict, ESLint (incl. i18n literal-string rule, logical-CSS rule), Prettier, dependency-cruiser (module boundaries), Ruff + mypy (geometry) | Everything | Pre-commit (lint-staged) + CI |
| Unit | Vitest (TS), pytest (Python) | Domain logic, state machines, pricing, routing, formatters, permission policy | CI, < 2 min |
| Property-based | fast-check, Hypothesis | Pricing determinism and monotonicity, money rounding, state-machine reachability, routing determinism | CI |
| Integration | Vitest + Testcontainers (Postgres, Redis, MinIO) | Application commands end to end with a real DB: transactions, outbox, idempotency, webhooks, RLS, migrations | CI |
| Contract | Vitest | Provider adapters vs ports (fake + sandbox nightly); geometry API schema | CI + nightly |
| Component | Storybook + test runner | Each `packages/ui` component: interaction, axe, he/en/ru, light/dark, reduced motion | CI |
| Visual regression | Playwright screenshots (or Chromatic) | Workbench stories + key pages × locale × viewport | CI (PR) |
| E2E | Playwright | Critical journeys across the six-cell matrix | CI smoke on PR, full nightly |
| Accessibility | axe-core (component + E2E), manual screen-reader passes (NVDA + VoiceOver, he and en/ru) | All customer & supplier flows | CI + per milestone |
| Performance | Lighthouse CI, bundle analyzer budgets, Playwright traces for animation FPS, k6 (Phase 5/9) | Budgets in ARCHITECTURE §14 | CI (budgets), per milestone |
| Security | CodeQL, OSV/`pnpm audit`, Trivy, secret scanning, ZAP baseline (staging), pentest before launch | — | CI + per milestone + pre-launch |
| Fuzz | Atheris / Hypothesis on geometry parsers | STL/3MF/OBJ malformed inputs | Nightly |

## 2. Areas requiring heavy testing (non-negotiable coverage)

| Area | What must be proven | Minimum |
|---|---|---|
| Pricing | Determinism; every rule input affects output in the documented direction; rounding; min-price floor; override keeps the computed baseline; currency handling | 100 % branch on `pricing`; property tests |
| Margins | Margin = price − expected payout − costs; floors trigger review | Unit + property |
| Financial snapshots | Immutability (DB trigger + domain); a historical quote is never recomputed after a rule change | Integration |
| State transitions | Every (state, event) pair: valid → correct next state + timestamp + audit + outbox; invalid → typed error, no side effects | Exhaustive table test per machine |
| Routing | Hard filters exclude correctly (incl. build volume rotations); scoring follows weights; deterministic tie-break; explanation is stored; fallback after decline/timeout; escalation | Unit + property + integration |
| Permissions | Command × role × scope matrix; IDOR attempts on orders/files/jobs | Generated matrix test |
| Payments | Amount from snapshot only; webhook signature; dedup; out-of-order events; reconciliation; double-click checkout → one payment | Integration with fake PSP + sandbox contract |
| Refunds | Total ≤ captured; approvals above threshold; partial refunds; PSP failure → manual path | Integration |
| Webhooks | Replay, invalid signature, unknown type, concurrent delivery | Integration |
| Quote expiry | Expired quote can't be paid; scheduler expires; re-quote creates a new snapshot | Integration + clock control |
| QC & reprints | Verdict transitions, reprint attempt counting, escalation at the second failure, cost bearer | Unit + integration |
| Supplier assignment | One accepted offer per attempt (concurrency test), payout frozen at acceptance, file access granted/revoked | Integration |
| Idempotency | Same key → same response; different payload with the same key → conflict error | Integration |

## 3. Coverage targets
`packages/core` domain: ≥ 90 % lines, 100 % on pricing/state machines/permissions. Application layer: ≥ 80 %. UI components: interaction tests for every interactive component. Coverage is a floor, not a goal. Reviewers check that assertions are meaningful.

## 4. Critical E2E journeys (grow per milestone)

| ID | Journey | From |
|---|---|---|
| E2E-01 | Visitor switches language; the choice persists across navigation and reload | M0F |
| E2E-02 | Customer signs in with OTP (Mailpit) and sees an empty orders state | M0F |
| E2E-03 | Flow A: upload STL → analysis → confirm units → usage → visual review | M1 |
| E2E-04 | Upload a broken file → friendly error → re-upload keeps answers | M1 |
| E2E-05 | Refresh mid-wizard → resumes at the same step with data | M1 |
| E2E-06 | Flow B request with photos → appears in the admin queue | M1 |
| E2E-07 | Quote shown with breakdown → change quantity → price updates → quote email received | M2 |
| E2E-08 | Admin manual quote override with reason → audit entry | M2 |
| E2E-09 | Paid order routes → supplier accepts on mobile → job card shows details | M3 |
| E2E-10 | Supplier declines → next candidate receives the offer | M3 |
| E2E-11 | Supplier uploads QC evidence → reviewer fails → reprint → pass | M4 |
| E2E-12 | Checkout with the fake PSP → webhook → PAID → invoice issued | M5 |
| E2E-13 | Ship → tracking updates → delivered → reorder | M5 |
| E2E-14 | Cancel after payment before acceptance → automatic refund | M5 |
| E2E-15 | Permission probes: a customer can't open another customer's order/file; a supplier can't open a non-assigned job | M0F → each milestone |

## 5. Three-language test matrix

Every major workflow runs in **six cells**:

| | Desktop (1440×900, Chromium + WebKit) | Mobile (390×844 iPhone-class WebKit; 412×915 Android-class Chromium) |
|---|---|---|
| **Hebrew (RTL)** | ✅ | ✅ |
| **English (LTR)** | ✅ | ✅ |
| **Russian (LTR, longest text)** | ✅ | ✅ |

Checklist per cell: RTL/LTR mirroring · text expansion (no truncation/overflow in buttons, tabs, chips, table headers) · forms (labels, errors, measurement inputs, decimal separators) · tables (column order, numeric alignment, mobile card fallback) · modals/drawers (open side, focus trap, scroll lock) · navigation (side nav, bottom tabs, breadcrumbs) · step indicators and timelines (direction) · icons (mirrored vs not) · animation (direction of transitions; reduced-motion variant) · 3D viewer (controls, axes not mirrored, keyboard) · money/date/number formats · bidi-isolated codes (order numbers, file names).

Automation: Playwright projects = locale × device. Visual snapshots per cell for key screens. A manual exploratory pass per cell at milestone STEP 6–7.

## 6. Accessibility standard
WCAG 2.2 AA (Israel: IS 5568 compliance + accessibility statement). Zero axe violations of serious/critical severity in CI. Manual: keyboard-only completion of every customer/supplier journey; screen reader in Hebrew (NVDA/VoiceOver) and English; 200 % zoom/reflow at 320 px; reduced motion; forced-colors mode for focus visibility.

## 7. Definition of Done (every task)

- [ ] Acceptance criteria met and demonstrated
- [ ] Code reviewed; no business logic in UI components; module boundaries respected
- [ ] Types strict, no `any` without a justified comment; zod at boundaries
- [ ] Tests written per §2/§3; all suites green; migrations run on a fresh DB and an upgrade path
- [ ] All user-visible text in he/en/ru catalogs (no literals); native review requested for new terms
- [ ] RTL and Russian expansion verified (screenshots attached to the PR)
- [ ] All states designed: loading, empty, error, success, disabled, offline where relevant; no raw backend errors
- [ ] Accessibility: keyboard, labels, focus, contrast, reduced motion
- [ ] Security checklist ([SECURITY §13](./SECURITY.md#13-security-review-checklist-run-at-every-milestone-step-9)) for any new endpoint/data/file/provider
- [ ] Logs/audit/analytics events emitted where specified
- [ ] Performance budgets respected (bundle diff in the PR)
- [ ] Docs updated (relevant `/docs` file, ADR if a decision was made, `API.md` for endpoints, `KNOWN_ISSUES.md` for accepted limitations)

## 8. Milestone protocol and quality audits

Each milestone follows the 11 steps: READ, PLAN, IMPLEMENT, VERIFY, FULL TEST, UX REVIEW, UI REVIEW, MOTION REVIEW, SECURITY REVIEW, DOCUMENTATION, REPORT. The REPORT template: Completed · Business capability added · Files changed · DB changes · APIs · UX work · UI work · Motion work · Localization work · Tests · Security review · Performance · Known limitations · Technical debt · Risks · Next milestone.

**Quality audits:** QA-1 (after M2), QA-2 (after M4), QA-3 (after M7), QA-4 (after M9). Each audit covers architecture, maintainability, domain boundaries, security, DB, tests, UX, UI, motion, RTL/LTR, localization, accessibility, performance, observability, dependencies and technical debt. Findings are classified **CRITICAL / HIGH / MEDIUM / LOW** and recorded in `KNOWN_ISSUES.md`. CRITICAL and HIGH are fixed before feature work resumes (or explicitly accepted by the owner with a dated plan).

## 9. Release gates

| Gate | Criteria |
|---|---|
| Merge to main | CI green (lint, types, unit, integration, component, smoke E2E, build, budgets, scans) + 1 review |
| Staging deploy | Main green, migrations applied, smoke E2E on staging |
| Pilot (after QA-1) | E2E-01…08 green in all six cells; QA-1 has no open CRITICAL/HIGH; legal pages published |
| MVP launch (after M5) | E2E-01…15 green in all cells; pentest with no open high/critical; a11y audit + statement; backup restore drill done; on-call + runbooks; native translation sign-off he/ru; performance budgets met on staging |
