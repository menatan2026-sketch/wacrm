# Known Issues

> Status: **Draft v0.1** · Severity: CRITICAL / HIGH / MEDIUM / LOW. Quality-audit findings and accepted limitations are recorded here. Close an entry by linking the PR or decision that resolved it.

## Open — planning phase

| ID | Severity | Issue | Impact | Resolution path | Status |
|---|---|---|---|---|---|
| KI-001 | **CRITICAL** | This repository contains **wacrm**, an unrelated WhatsApp CRM (Next.js 16 + Supabase). Building the Platform inside it would mix two products | Wrong foundation, confusing history, licence/brand confusion | Owner decides D-1 / ADR-0001 before M0R: new repository (recommended) or remove the CRM code from this repository | Open — blocks M0R |
| KI-002 | HIGH | No product name or brand yet; documents use "the Platform" and scope `@mfg/*` | Visual identity can't be finalized; domains/emails can't be set up | Brand workshop (D-2) before M0C visual sign-off | Open |
| KI-003 | HIGH | Pricing coefficients, margins and payout rate cards are placeholders | Quotes are not commercially valid until set | Owner + finance set the values in M2 (D-5); calibrate in the concierge pilot | Open |
| KI-004 | HIGH | Hebrew and Russian glossary terms are proposals, not native-reviewed (e.g. the ru term for the Israeli tax invoice-receipt) | Risk of unnatural copy | Native reviewers (D-10) in M0E-T07 | Open |
| KI-005 | HIGH | Legal content missing: terms, privacy policy, cancellation policy for custom goods, restricted-use policy, supplier agreement, merchant-of-record opinion | Launch blocker | Legal review track (ROADMAP business track) | Open |
| KI-006 | MEDIUM | Payment capture strategy (immediate charge vs authorize-then-capture) depends on the selected PSP | Affects the refund volume and the cancellation UX | Decide in M5-T01 with the PSP docs | Open |
| KI-007 | MEDIUM | PSP, invoicing and courier vendors are not selected. Adapter details are intentionally unspecified (no invented APIs) | M5 scope uncertainty | Vendor shortlist in M1, contracts by M3 (D-4) | Open |
| KI-008 | MEDIUM | STEP/STP support feasibility unknown (OpenCascade tessellation, container size, licence) | Customers with STEP files must convert or use Flow B | Spike M1-T09 | Open |
| KI-009 | MEDIUM | Print-time estimation is heuristic in the MVP; slicer-based estimation needs an AGPL licence review | Quote accuracy | Calibrate in the pilot; evaluate slicer CLI in M3–M4 | Open |
| KI-010 | MEDIUM | Auth library not chosen (ADR-0010 Proposed) | M0F estimate uncertainty | Spike M0F-T02 | Open |
| KI-011 | MEDIUM | Hosting region/provider not decided (ADR-0016 Proposed) | Staging setup, data residency | D-8 before staging is needed (M0R end) | Open |
| KI-012 | LOW | Color palette values are proposals; contrast not yet machine-verified | Possible palette tweaks | M0C-T03 | Open |
| KI-013 | LOW | Chart time-axis direction in Hebrew is decided as LTR (common practice) but not user-tested | Minor comprehension risk | Validate in the M9 analytics usability check | Open |
| KI-014 | LOW | The supplier surface is a responsive web app, not a PWA/native app; offline support is limited to queued uploads | Floor connectivity issues | Re-evaluate PWA after the M4 field feedback | Open |

## Accepted limitations (MVP)

| ID | Limitation | Rationale | Revisit |
|---|---|---|---|
| AL-001 | One supplier per order (no split fulfilment) | Simplicity; most early orders are 1–3 items | Post-M5 |
| AL-002 | ILS only, Israel shipping only | Initial market; the data model is multi-currency-ready | Post-M9 |
| AL-003 | Flow B/C fulfilled manually (concierge) | Validate demand and build the AI evaluation dataset | M6 |
| AL-004 | Platform QC review on every job (not sampled) | Trust-building while supplier stats mature | M9 (sampling + automated QC assists) |
| AL-005 | Supplier payouts by manual bank transfer export | Volume is low; avoids payment-facilitation complexity | Post-M8 |

## Resolved

_None yet._
