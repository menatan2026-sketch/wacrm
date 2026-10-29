# Product Definition

> Status: **Draft v0.1 — awaiting owner approval** · Phase 0A · Owner: Product / Architecture
> Related: [MASTER_PLAN](./MASTER_PLAN.md) · [UX_ARCHITECTURE](./UX_ARCHITECTURE.md) · [ROADMAP](./ROADMAP.md)

The working name in these documents is **"the Platform"**. The package scope is `@mfg/*`. Naming and branding are open business decisions (see [KNOWN_ISSUES](./KNOWN_ISSUES.md) KI-002).

---

## 1. Vision

Make ordering a custom manufactured part as easy as ordering a normal product online.

The customer describes *what the part is for*. The Platform works out *how to make it*, prices it, routes it to a suitable manufacturing partner, makes sure it meets a quality bar, and delivers it. Customers never need manufacturing knowledge.

## 2. Problem

| Who | Today | Pain |
|---|---|---|
| Consumer with a broken part (appliance clip, car trim, furniture fitting) | Searches for the spare part, gives up, or asks a "guy with a 3D printer" on a forum or Facebook group | No CAD file, no idea which material survives heat or load, no price certainty, no quality guarantee |
| Maker / hobbyist with an STL | Uploads to a quoting site or messages a local print shop | Has to choose infill, layer height and material; quotes are slow or opaque; quality varies |
| SMB / maintenance team (workshops, clinics, small factories) | Calls a local supplier and emails drawings | Slow back-and-forth, no reorder history, invoices handled by hand, no approval workflow |
| Small print farm / workshop (supplier) | Gets inconsistent, badly specified jobs from many channels | Idle capacity, chasing payment, unclear quality expectations |

## 3. Value proposition

- **Customers:** answer plain questions (where is it used, does it get hot, does it carry weight), get a firm price and lead time, track production, receive a part that passed QC, and reorder in one tap.
- **Suppliers:** a stream of well-specified, pre-paid jobs with production-ready files, a known payout, clear quality requirements and a simple mobile workflow.
- **Platform:** owns the customer relationship, the data, pricing, routing, quality standards and the experience. It earns the margin between customer price and supplier payout, plus service fees.

## 4. Business model

Customer pays the Platform → the Platform assigns the job to an approved supplier → the supplier receives a predefined payout → the Platform keeps the difference.

The Platform is **merchant of record** (proposed, ADR-0012). It sells a finished manufactured part to the customer and buys manufacturing services from the supplier. Suppliers invoice the Platform and are paid on a payout cycle. This keeps the marketplace fund flow simple and avoids holding funds on a supplier's behalf (legal review pending, RISK R-010).

### Revenue streams (the system must support all of them; only the first three are MVP)

| # | Stream | MVP | Mechanism in the system |
|---|---|---|---|
| 1 | Manufacturing margin | ✅ | Pricing engine: customer price minus expected supplier payout |
| 2 | Expedited manufacturing | ✅ | Urgency tier modifier on the quote, and a stricter SLA on routing |
| 3 | Shipping margin | ✅ | Shipping quote line with a configurable markup |
| 4 | CAD / design fees | Phase 1 (manual) → Phase 6 | `design_fee` quote line, DESIGN_REQUIRED workflow |
| 5 | Service fees | Config only | Fee lines in the pricing rule set |
| 6 | Premium priority production | Phase 3 | Routing priority plus a price modifier |
| 7 | Digital part catalog sales | Phase 7 | Digital Part → quote with a pre-approved production profile |
| 8 | Recurring part programs | Phase 8 | Scheduled reorders against approved parts |
| 9 | Subscriptions / B2B plans | Phase 8 | Plan entitlements (discounts, priority, monthly billing) |
| 10 | Enterprise plans, private part libraries | Phase 8 | Organization-scoped Digital Part visibility, invoicing, purchase orders |

## 5. Core principles

1. **Never expose manufacturing complexity to normal users.** Usage questions in; technical requirements out. Advanced mode is opt-in.
2. **The Platform owns the customer relationship.** Suppliers never see customer contact details. All communication goes through the Platform.
3. **Outsource uncertain demand. Own predictable high-volume production later**, and only where the economics justify it.
4. **Automation with manual fallback, always.** Every automated decision (AI requirements, material, pricing, routing, QC, shipping, refunds) can be overridden by an authorized human, and the override is audited.
5. **Deterministic money and routing.** AI may advise. It never sets a price, a payout or a supplier assignment by itself.
6. **Trust through visibility.** Show real state (never fake progress), show what happens next, and show why.
7. **Three languages from day one:** Hebrew (RTL), English and Russian.

## 6. Personas (summary — full detail in [UX_ARCHITECTURE §2](./UX_ARCHITECTURE.md#2-personas))

| ID | Persona | Surface |
|---|---|---|
| P1 | **Dana — "fix it" consumer** (broken part, no CAD, mobile, Hebrew) | Customer |
| P2 | **Alex — maker with a file** (STL ready, wants price and speed, English or Russian) | Customer |
| P3 | **Yossi — SMB maintenance lead** (recurring parts, needs invoices and approvals) | Customer B2B |
| P4 | **Marina — print-farm operator** (works on the production floor, phone in hand) | Supplier |
| P5 | **Avi — supplier manager** (capacity, payouts, machines) | Supplier |
| P6 | **Noa — operations admin** (exceptions, routing overrides, margins) | Admin |
| P7 | **Igor — quality reviewer** (photos, measurements, pass/fail) | Admin |
| P8 | **Lior — CAD designer** (turns briefs into models) | Admin / Designer |
| P9 | **Finance admin** (payments, payouts, refunds, invoices) | Admin |
| P10 | **Support agent** (customer questions, status, escalations) | Admin |

## 7. Customer entry flows

| Flow | Customer says | MVP scope | Later |
|---|---|---|---|
| **A — I have a file** | "Here's my STL" | STL, 3MF (OBJ if parser validation passes in M1). Geometry analysis → automated quote (with manual review if a rule flags it) → checkout | STEP/STP (M1 spike; Phase 6 if feasible), multi-part assemblies |
| **B — I have an object or broken part** | "Here are photos of the broken clip" | Guided structured intake (photos, reference scale, dimensions, usage questions), **human-reviewed** manufacturing brief, manual quote | AI-assisted brief (Phase 6, flag `AI_INTAKE`), photogrammetry |
| **C — I have an idea** | "I need a wall mount for my router" | Guided description with minimal clarification questions → **human** requirement summary → DESIGN_REQUIRED → design fee quote | AI clarification and brief drafting (Phase 6) |

Flows B and C launch as a "concierge" service: the customer UX is final, and the back office is human. The feedback validates demand and builds the labeled dataset that AI intake (Phase 6) is later evaluated against.

## 8. MVP definition

**MVP = a customer can complete Flow A end to end and pay. The order is fulfilled by an approved FDM supplier, passes QC and is shipped. Flows B and C are captured and fulfilled manually. Everything works in Hebrew, English and Russian on mobile and desktop.**

### In MVP

- Customer: account (email magic link / OTP + optional password), guided wizard (save and resume), STL/3MF upload, geometry analysis with an interactive 3D preview, usage questions, material and process recommendation (rule-based), instant quote with breakdown, checkout, order tracking timeline, notifications (email + in-app), simple reorder from order history, Flow B/C request forms.
- Supplier: onboarding (by invitation), profile (machines, materials, build volume, capacity), job inbox, accept/decline, production status, QC photo and measurement upload, ready-for-pickup, payout statement view.
- Admin: attention dashboard, orders, quotes (with manual override), customers, suppliers, machines, materials, pricing rules (versioned), routing (deterministic scoring + manual confirmation), QC review, payments/refunds, shipments, audit log, feature flags, manual request handling (B/C).
- Platform: FDM only; ILS only (multi-currency-ready data model); Israel shipping only; one payment provider; one shipping provider (plus a manual-label fallback); RBAC; audit trail; structured logs; locale formatting.

### Explicitly not in MVP (see [MASTER_PLAN §25 Deferred scope](./MASTER_PLAN.md#25-deferred-scope))

AI intake and assistants, STEP/STP, non-FDM processes, the Digital Part Library (beyond simple reorder), B2B organizations/approvals/invoicing, subscriptions, WhatsApp/SMS notifications, automated QC, international shipping, multi-supplier split orders, supplier self-signup.

### MVP success metrics (first 90 days after launch)

| Metric | Target (hypothesis; validate in the pilot) |
|---|---|
| Quote → purchase conversion (Flow A) | ≥ 15 % |
| Gross margin per order | ≥ 35 % |
| Supplier acceptance within SLA (4 business hours) | ≥ 90 % |
| On-time delivery against promised date | ≥ 90 % |
| Reprint rate | ≤ 5 % |
| Refund rate | ≤ 3 % |
| Touchless Flow A orders (no human action quote→ship except QC) | ≥ 50 % |
| Human minutes per Flow A order | ≤ 15 |
| Repeat purchase within 90 days | ≥ 20 % |

## 9. Business KPIs (system-wide)

Gross Margin · Contribution Margin · Average Order Value · Quote-to-Purchase Conversion · Repeat Purchase Rate · Reprint Rate · Refund Rate · Supplier Acceptance Rate · Supplier On-Time Rate · Touchless Order Rate · Human Minutes Per Order · Design Reuse Rate · Average Lead Time · (future) CAC and LTV.

The formulas are defined in [MASTER_PLAN §20](./MASTER_PLAN.md#20-analytics-and-kpis). The data needed for them is captured from M1 onward, even though the dashboards arrive in Phase 9.

## 10. Market and regulatory context (initial market: Israel)

These must be verified with professionals before launch (tracked in [RISK_REGISTER](./RISK_REGISTER.md)):

- **Consumer protection:** cancellation rights for distance sales, with the possible exemption for goods made to the customer's specification. Needs a legal opinion. This drives the cancellation and refund policy UX.
- **Tax invoicing:** VAT is configurable (never hardcoded). Tax invoices / receipts go through a certified invoicing provider. The Israel Tax Authority's invoice-allocation-number requirement applies to qualifying B2B invoices.
- **Privacy:** Israeli Protection of Privacy Law, including Amendment 13. GDPR readiness for future EU customers.
- **Accessibility:** Israeli accessibility regulations reference IS 5568 (based on WCAG). The target is **WCAG 2.2 AA** plus a published accessibility statement (הצהרת נגישות).
- **Marketplace / payments:** whether the merchant-of-record model needs any payment-services licensing (ADR-0012).
- **Product liability:** parts used for safety-critical, load-bearing, medical, food-contact or automotive-structural purposes. These are restricted by policy and flagged in intake (see UX "restricted use" flow).

## 11. Product guardrails (policy)

- **Restricted uses** (refused, or routed to manual review with a disclaimer): weapons and weapon parts, safety-critical load-bearing parts (lifting, climbing, vehicle braking/steering), medical devices, pressurized components, food-contact parts unless the material and process are certified.
- **IP:** the customer warrants they have the right to manufacture the uploaded design. A takedown / IP complaint process exists (admin flow).
- **Files are confidential:** never public, and visible to an assigned supplier only for the duration of the job.
