# Workforce platform · Phase 0

> Codename **Tempo** (placeholder). An all-in-one workforce platform
> for mixed teams: deskless workers on mobile _and_ computer workers on a
> desktop agent, in one timeline, at one price.

| #   | Deliverable                                                                                                                             | File                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Architecture (system context, stack decisions, tenancy, RBAC, command layer, time core, desktop agent, AI, security, quality, ADR list) | [01-architecture.md](./01-architecture.md)         |
| 2   | Data model / ERD (Phase 1–2 tables in full, Phase 3–5 outlined, RLS sketch)                                                             | [02-data-model.md](./02-data-model.md)             |
| 3   | Folder structure (monorepo layout + dependency rules)                                                                                   | [03-folder-structure.md](./03-folder-structure.md) |
| 4   | Design system (principles, color, type, motion, RTL rules, components, a11y)                                                            | [04-design-system.md](./04-design-system.md)       |
| 4a  | Design tokens: source, generator, generated outputs, contrast report (152/152 AA)                                                       | [tokens/](./tokens/)                               |
| 5   | Screen map (web, mobile, kiosk, desktop + key flows, phase-tagged)                                                                      | [05-screen-map.md](./05-screen-map.md)             |
| 6   | Phase 1 plan (for approval)                                                                                                             | [06-phase-1-plan.md](./06-phase-1-plan.md)         |

Regenerate tokens: `node docs/platform/tokens/build.mjs` (exits non-zero
on any contrast failure).

---

## Clarifying questions

Each question has a **default**. If you reply "defaults are fine", I
proceed with them. Only Q1 blocks the start of Phase 1.

| #      | Question                                                                                                                                                                                                                                                                   | Why it matters                                                                                                                                                                                                        | Default if you don't answer                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Q1** | **Where does the code live?** This repo (`wacrm`) is a WhatsApp CRM. Options: **(a)** a new repo (cleanest; you create it and add it to this session), or **(b)** restructure _this_ repo into the monorepo on this branch, moving the CRM out.                            | Everything in Phase 1 depends on it. A fork would carry an unrelated CRM domain. Either way, the reusable pieces (RLS helpers, API keys, webhooks + SSRF guard, AI adapters, WhatsApp client, MCP server) are ported. | **(a) New repo.** If you want work to start immediately in this session, choose (b).               |
| Q2     | **Must customer data be hosted in Israel?** (government, defense, health, some enterprises require it)                                                                                                                                                                     | Supabase Cloud's nearest region is Frankfurt; in-Israel means self-hosted Supabase on AWS `il-central-1` (Tel Aviv) and more ops.                                                                                     | EU (Frankfurt) for MVP, with an architecture kept portable to `il-central-1`.                      |
| Q3     | **Payroll integrations: which first, and can you get file specs or partner access** for Hilan, Michpal (and Synel hardware clocks)?                                                                                                                                        | These providers' import formats aren't public; we need specs or a design-partner customer's sample files.                                                                                                             | Generic CSV/XLSX + configurable pay codes in Phase 1; Hilan + Michpal in Phase 5 once specs exist. |
| Q4     | **Product name, logo, brand color?**                                                                                                                                                                                                                                       | Domain, app-store listings, package IDs (`com.<name>.app`), signing certificates.                                                                                                                                     | Codename "Tempo", Iris blue-violet accent; rename is cheap (package scope is neutral).             |
| Q5     | **Kiosk face verification:** biometrics are data of special sensitivity under the Israeli Privacy Protection Law (Amendment 13) and GDPR. OK to ship **PIN + photo snapshot** first, with face _matching_ later as an explicit opt-in and an always-available alternative? | Legal exposure and the security level required for the database.                                                                                                                                                      | Yes: PIN + photo in Phase 1; face match no earlier than Phase 3, opt-in.                           |
| Q6     | **Screenshots in the desktop agent:** include (off by default, gated by an acknowledged notice) _or_ drop entirely and market "monitoring without screenshots" as a trust differentiator?                                                                                  | A product-positioning decision more than a technical one.                                                                                                                                                             | Include, off by default, blur on, employee delete grace window.                                    |
| Q7     | **Launch market and default language:** Israel first, Hebrew default, English available from day one, currency ILS, Sunday week start?                                                                                                                                     | Seed data, onboarding presets, labor-law preset priority.                                                                                                                                                             | Yes.                                                                                               |

**Not blocking, but you'll need these later:** Supabase and Vercel
accounts (Phase 1), an Apple Developer account and a Google Play console
(end of Phase 1 for TestFlight / internal testing), a Windows code-signing
certificate (EV or Azure Trusted Signing) and an Apple Developer ID for
notarization (Phase 2), and **Israeli labor counsel** to validate the
`il_standard` overtime/rest preset and the monitoring notice before GA.

## Assumptions made in these documents

- Org size of 5–2,000 employees per tenant; worst case ~1,000 desktop-tracked
  users per tenant (drives partitioning and rollups).
- Web admin is used mostly on laptops (14 px dense UI); employees use mobile
  (16 px).
- AI features are opt-out per org and per module; desktop activity data is
  excluded from AI by default.
- No feature is ever paywalled in the UI. Plan limits are by seat count only,
  with a free tier for small teams (thresholds decided in Phase 5).

## Where we beat Connecteam (design-level summary)

| Dimension        | Typical in Connecteam (per public pricing pages; verify before marketing use) | Tempo                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Pricing          | Separately priced hubs (Operations / Communications / HR & Skills) and tiers  | One price per user, every module included                                                                               |
| Computer workers | Mobile-first; no desktop activity agent                                       | Native agent, unified timeline with mobile punches and schedule                                                         |
| Privacy          | n/a for desktop                                                               | Aggregate-only by default, no stealth, employee privacy dashboard, "who viewed my data"                                 |
| AI               | Feature-level add-ons                                                         | Command-based assistant with preview/undo across every module; real optimizer for scheduling                            |
| Israel           | Hebrew supported                                                              | Hebrew-first copy, IL labor presets, reserve-duty (מילואים) absence type, Hilan/Michpal exports, WhatsApp notifications |
| Design           | Functional                                                                    | Premium, dense where managers need it, one-tap on mobile                                                                |

## Next step

Answer the questions (or reply "defaults are fine" plus your Q1 choice).
I then start Phase 1 per [06-phase-1-plan.md](./06-phase-1-plan.md).
