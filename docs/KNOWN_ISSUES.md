# Known Issues

> Status: **Draft v0.1** · Severity: CRITICAL / HIGH / MEDIUM / LOW. Quality-audit findings and accepted limitations are recorded here. Close an entry by linking the PR or decision that resolved it.

## Open

| ID | Severity | Issue | Impact | Resolution path | Status |
|---|---|---|---|---|---|
| KI-002 | HIGH | No product name or brand yet; documents use "the Platform" and scope `@mfg/*` | Visual identity can't be finalized; domains/emails can't be set up | Brand workshop (D-2) before M0C visual sign-off | Open |
| KI-003 | HIGH | Pricing coefficients, margins and payout rate cards are placeholders | Quotes are not commercially valid until set | Owner + finance set the values in M2 (D-5); calibrate in the concierge pilot | Open |
| KI-004 | HIGH | Hebrew and Russian glossary terms are proposals, not native-reviewed (e.g. the ru term for the Israeli tax invoice-receipt) | Risk of unnatural copy | Native reviewers (D-10) in M0E-T07 | Open |
| KI-005 | HIGH | Legal content missing: terms, privacy policy, cancellation policy for custom goods, restricted-use policy, supplier agreement, merchant-of-record opinion | Launch blocker | Legal review track (ROADMAP business track) | Open |
| KI-006 | MEDIUM | Payment capture strategy (immediate charge vs authorize-then-capture) depends on the selected PSP | Affects the refund volume and the cancellation UX | Decide in M5-T01 with the PSP docs | Open |
| KI-007 | MEDIUM | PSP, invoicing and courier vendors are not selected. Adapter details are intentionally unspecified (no invented APIs) | M5 scope uncertainty | Vendor shortlist in M1, contracts by M3 (D-4) | Open |
| KI-008 | MEDIUM | STEP/STP support feasibility unknown (OpenCascade tessellation, container size, licence) | Customers with STEP files must convert or use Flow B | Spike M1-T09 | Open |
| KI-009 | MEDIUM | Print-time estimation is heuristic in the MVP; slicer-based estimation needs an AGPL licence review | Quote accuracy | Calibrate in the pilot; evaluate slicer CLI in M3–M4 | Open |
| KI-011 | MEDIUM | Hosting region/provider not decided (ADR-0016 Proposed) | Staging setup, data residency | D-8 before staging is needed (M0R end) | Open |
| KI-013 | LOW | Chart time-axis direction in Hebrew is decided as LTR (common practice) but not user-tested | Minor comprehension risk | Validate in the M9 analytics usability check | Open |
| KI-014 | LOW | The supplier surface is a responsive web app, not a PWA/native app; offline support is limited to queued uploads | Floor connectivity issues | Re-evaluate PWA after the M4 field feedback | Open |
| KI-015 | HIGH | Payments use the **fake PSP adapter** (signed webhooks + a development payment page). No real provider is integrated (KI-007), so `APP_ENV=production` refuses to start with it | Production cannot take payments yet | Choose the PSP (D-4), implement its adapter behind the existing `PaymentProvider` port, run the provider's sandbox through the e2e suite | Open — needs owner decision |
| KI-016 | HIGH | Receipts and credit notes come from the **internal invoice register** — sequential numbering, VAT from data — but it is **not a certified Israeli invoicing provider** and doesn't request allocation numbers | Documents are not legally valid tax invoices | Pick a certified provider (D-4) and implement `InvoiceProvider`; keep the internal register as an audit mirror | Open — needs owner decision |
| KI-017 | MEDIUM | Courier integration is the fake/manual adapter: ops enter tracking numbers by hand and mark delivery; `APP_ENV=production` refuses the fake courier | Manual shipping work per order | Select the courier (D-4) and implement `ShippingProvider`; manual entry stays as the fallback | Open |
| KI-018 | MEDIUM | Surfaces are path-based (`/{locale}`, `/{locale}/partners`, `/{locale}/ops`) on one host. Sessions are already separated per surface (distinct host-only cookies) | Ops shares an origin with the public site | Move ops to its own subdomain behind SSO/IP allow-list before launch (SECURITY §2) | Open |
| KI-019 | MEDIUM | The business-day calculation (promised ship dates, offer SLAs) skips Friday/Saturday but has **no Israeli holiday calendar** | Dates around holidays can be optimistic | Add a holiday table (data, not code) and use it in `addBusinessDays` / `workingDaysUntil` | Open |
| KI-020 | LOW | Staff MFA enrollment shows the setup key as text (no QR code) | Slightly slower setup on a phone authenticator | Render the `otpauth://` URI as a QR code (local library, no third-party service) | Open |
| KI-021 | LOW | Ops routing table shows score components by internal names (`cost`, `load`, `onTime`…) in every locale | Ops-only English jargon in he/ru | Add catalog labels for routing components | Open |
| KI-022 | LOW | Legal pages (terms, privacy, accessibility statement, restricted use, shipping) are clearly marked drafts with no content | Launch blocker (with KI-005) | Legal provides text; pages render catalog/CMS content | Open |
| KI-023 | LOW | Supplier performance stats start from smoothed neutral priors (e.g. 90 % on-time) until real jobs accumulate | Early routing can't tell suppliers apart | Expected; review after the pilot's first 50 jobs | Accepted |

## Accepted limitations (MVP)

| ID | Limitation | Rationale | Revisit |
|---|---|---|---|
| AL-001 | One supplier per order (no split fulfilment) | Simplicity; most early orders are 1–3 items | Post-M5 |
| AL-002 | ILS only, Israel shipping only | Initial market; the data model is multi-currency-ready | Post-M9 |
| AL-003 | Flow B/C fulfilled manually (concierge) | Validate demand and build the AI evaluation dataset | M6 |
| AL-004 | Platform QC review on every job (not sampled) | Trust-building while supplier stats mature | M9 (sampling + automated QC assists) |
| AL-005 | Supplier payouts by manual bank transfer export | Volume is low; avoids payment-facilitation complexity | Post-M8 |

## Resolved

| ID | Resolution |
|---|---|
| KI-001 | Owner chose to replace the CRM in this repository (scope decision before M0R). All CRM files were removed and the Platform monorepo lives on `claude/elegant-curie-ig4cs4`. The CRM's commits remain in git history; if the repository is published, check the upstream licence and consider a fresh history |
| KI-010 | ADR-0010 accepted: in-house passwordless email OTP (HMAC codes, attempt limits, per-surface sessions) plus TOTP for staff via `otpauth`, with seeds sealed by AES-GCM |
| KI-012 | Palette machine-verified: `packages/tokens` tests check every WCAG pair, and four values were adjusted (see UI_DESIGN_SYSTEM §3) |
