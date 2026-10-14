# Ritmo — project instructions for Claude Code

You are building **Ritmo (ריטמו)**: an all-in-one workforce management platform that beats Connecteam on every axis — features, UX, design, AI, pricing clarity, and especially **computer-based work tracking** — for mixed teams of deskless workers (mobile) and computer workers (desktop agent), on one timeline. Hebrew/RTL and English are first-class.

This file is the contract. Read it fully before every phase.

## Read in this order

1. `docs/PRODUCT_SPEC.md` — the full product spec: modules, platforms, stack, security, phases, definition of done. **Source of truth for WHAT to build.**
2. `docs/brand/BRAND.md` — brand book: principles, voice, logo, color, type, layout, motion, iconography, transparency rules. **Source of truth for HOW it looks and sounds.**
3. `design/tokens.json` → compiled to `design/tokens.css` — every color, size, radius, shadow, z-index and font. **Never hard-code a value that exists here.**
4. `design/components.css` + `docs/brand/components/*.md` (+ live gallery `docs/brand/components.html`) — the 15 reference components and their usage rules.
5. `docs/brand/MOTION.md` + `design/motion.css` + `design/motion.ts` — the motion system: tokens, every choreography, haptics, reduced-motion rules.
6. `docs/screens/SCREENS.md` + `docs/screens/*.html` (open in a browser) + `docs/screens/screenshots/` — five reference screens, including the interactive states & motion board. Match their layout, density and tone.

## Non-negotiables

**Design system**
- Use tokens only (`var(--brand)`, `--space-4`, `--radius-lg`, …). In Tailwind, use the mapped utilities from `design/tailwind-theme.css` (`bg-brand`, `text-ink-muted`, `rounded-lg`). No raw hex, no arbitrary px values that duplicate a token.
- Themes: light + dark from day one. Default follows `prefers-color-scheme`; `<html data-theme="light|dark">` overrides. Never invert colors; the dark values are designed in `tokens.json`.
- Text on a fill uses its `on-*` token (`on-brand`, `on-pulse`, `on-beat`, `on-danger`, `on-hero`). Never literal white.
- `pulse` (lime) appears **once per screen**, only on the action that starts the clock (clock in / start tracking) or the live dot. Never as text.
- Status is never color alone: always a word and/or icon (pills, hatched idle, arrows on deltas).
- Fonts: IBM Plex Sans Hebrew (all UI, Hebrew + Latin; digits are tabular) and IBM Plex Mono (the live timer and keyboard shortcuts only), from `design/fonts/`. Never Inter, Roboto or system defaults.
- Layout: sidebar on `bg`, all content on one raised sheet; sections and hairlines inside it; headline numbers in one `rt-stats` strip; data in `rt-table` with `rt-status` (dot + word). Read "What Ritmo never looks like" in BRAND.md and treat every item as a review blocker.
- Motion: use the tokens and presets only (`--dur-*`, `--ease-*`, `design/motion.ts`). 120–260ms, ease-out in / ease-in out, no bounce, transform + opacity only, interruptible, reduced-motion fallbacks. The clock-in choreography in MOTION.md is the signature moment; implement it exactly.
- Icons: Lucide, 24px grid, 1.75px stroke, `currentColor`. No emoji in product UI.
- Logo: use the files in `docs/brand/logos/` as-is. `*-on-dark.svg` on dark grounds. Never retype the wordmark.

**RTL / bidi**
- Every layout uses CSS logical properties (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `border-inline-end`). Never `left`/`right` in component code.
- Wrap every time, time range, number, currency and email inside Hebrew text in an isolated LTR span (`<bdi>` or the `.rt-num` class). Without this, `07:00–15:00` renders reversed in RTL.
- Israeli week starts on Sunday (א׳). 24-hour clock everywhere. Currency `₪` before the number.
- Hebrew: zero letter-spacing, no uppercase-style overlines. Gender-neutral copy ("את/ה") or rephrase.

**Accessibility**: WCAG 2.2 AA + Israeli standard IS 5568. 4.5:1 text, 3:1 controls/focus, 44px touch targets, full keyboard support, visible `--focus-ring` (2px solid, 2px offset) on every interactive element, `prefers-reduced-motion` respected.

**Desktop tracking ethics** (product rules, not suggestions)
- Transparent only: visible tray/menu-bar icon and TrackingIndicator whenever the agent runs. No stealth mode, ever.
- Never capture keystroke content, passwords, message/document content, or anything outside clocked-in hours. Screenshots are off by default; if a company enables them they are blurred in lists and the employee is notified.
- Every employee has a "What's collected about me" page (see `docs/screens/04-desktop-tracking.html`) showing exactly what their manager sees, with download and correction requests.
- Configurable retention with automatic deletion. Design for the Israeli Privacy Protection Law (incl. Amendment 13) and GDPR; have the client's lawyer review the monitoring policy before launch.

**AI features**: every AI action is previewed and reversible; nothing is published, sent or deleted without explicit user confirmation. AI speaks in Ritmo's voice (BRAND.md → Voice).

## How to work

- Work in the phases defined in `docs/PRODUCT_SPEC.md`. **Stop after each phase** and report: what was built, how to run and test it, known limitations, what's next. Do not start the next phase until I approve.
- Phase 0 first: ask your critical clarifying questions, then deliver the architecture doc, data model (ERD), folder structure, and screen map. Put the design tokens into the codebase in Phase 0 (copy `design/` into the web/mobile/desktop packages or a shared `packages/ui`).
- Prefer working, tested, polished features over breadth. Every feature must meet the Definition of Done in the spec (RTL + LTR, light + dark, responsive, accessible, loading/empty/error states, permissions enforced, tests passing).
- When a decision is ambiguous and expensive to reverse (data model, auth, multi-tenancy, billing), ask before building.
- Custom commands in `.claude/commands/`: `/phase <n>` runs a phase per the spec; `/design-review` audits the current UI against this file.

## Kit map

```
CLAUDE.md                      ← this file
README.md                      ← how to use this kit (Hebrew + English)
docs/PRODUCT_SPEC.md           ← full product spec and phases
docs/brand/BRAND.md            ← brand book (English)
docs/brand/BRAND-HE.md         ← brand summary (Hebrew)
docs/brand/MOTION.md           ← motion system: tokens, choreographies, haptics
docs/brand/components/*.md     ← component usage rules (15 components)
docs/brand/components.html     ← live gallery of all components (open in a browser)
docs/brand/logos/*.svg         ← logo, mark, wordmarks, app icons
docs/screens/SCREENS.md        ← what each reference screen shows and must preserve
docs/screens/*.html            ← 5 reference screens incl. interactive states & motion board
docs/screens/screenshots/*.png ← light + dark captures of each screen
design/tokens.json             ← design tokens (source)
design/tokens.css              ← compiled CSS custom properties + @font-face + type classes
design/tailwind-theme.css      ← Tailwind v4 theme mapping to the tokens
design/components.css          ← reference component CSS (rt- prefix)
design/motion.css              ← motion primitives and choreographies (m- prefix)
design/motion.ts               ← Motion (Framer) + Reanimated presets, haptics map
design/fonts/*.woff2           ← IBM Plex Sans Hebrew 400–700 (Hebrew + Latin), IBM Plex Mono 400/500 (OFL)
.claude/commands/*.md          ← /phase and /design-review
```
