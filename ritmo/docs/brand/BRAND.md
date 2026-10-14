# Ritmo — Brand Book

Ritmo is an all-in-one workforce platform for mixed teams: frontline people who clock in on a phone and office people who work at a computer, on one timeline. The name is Italian and Spanish for *rhythm*; in Hebrew it is written **ריטמו**. The brand promise is a calm, predictable workday, so the identity is calm too: warm paper grounds, one deep green, and a single flash of lime for the moment work starts.

**Tagline:** "The rhythm of your workday." · **בעברית:** "הקצב של יום העבודה."

## Brand principles

1. **Calm over busy.** Managers open Ritmo when something is wrong. Every screen should lower the pulse: generous space, few colors, one clear next action.
2. **One beat of energy.** `pulse` (lime) appears once per screen, on the action that starts the clock. Everything else is green, ink and paper.
3. **Transparent by design.** Ritmo tracks work, never people's private lives. Anything we collect, the employee can see. The UI says so out loud (see TrackingIndicator).
4. **Bilingual by default.** Hebrew and English are equal citizens. Every component works in `dir="rtl"` and `dir="ltr"` without a special version.
5. **Numbers you can trust.** Times, durations and money are set in the `mono` family with tabular figures, so columns align and timers never jitter.

## Voice and copy

Ritmo speaks like a good shift lead: brief, warm, specific. Second person ("you", "את/ה" with gender-neutral slash forms, or rephrase to avoid gender), sentence case, no exclamation marks, no emoji in product UI.

| Do | Don't |
| --- | --- |
| "Dana swapped Thursday with Omer. Approve?" | "A shift swap request has been submitted for your review!" |
| "You're on shift since 08:02." / "את/ה במשמרת מ־08:02." | "Session active" |
| "3 timesheets need you." | "Pending items: 3" |
| "Tracking pauses outside work hours." | "Monitoring is enabled." |
| "Couldn't sync. We'll retry when you're online." | "Error 503" |

- Buttons: verb first, 1–3 words ("Clock in", "Approve", "כניסה", "אישור").
- Times: 24-hour (`08:00–16:30`), durations as `7h 45m` / `7:45 ש׳`, dates as `Thu 16 Oct` / `ה׳ 16.10`.
- Never call it "monitoring" or "surveillance" in UI; it is "activity" and "time tracking". Never hide what it does.
- AI features speak as Ritmo, in the same voice, and always show what they're about to do before doing it: "I'll draft next week's schedule for Haifa under ₪42,000. Review before publishing."

## Logo

The mark is three rounded bars of different lengths and one dot: shifts on a timeline, and a rhythm with a beat. Bars and dot are built on a 48-unit grid from `radius-pill` geometry.

![Ritmo lockup](logos/ritmo-lockup.svg)

- **Lockup (English):** mark left, `ritmo` wordmark right, lowercase always. File `ritmo-lockup.svg`.
- **Lockup (Hebrew):** wordmark `ריטמו` left, mark right (the mark leads in reading order). File `ritmo-lockup-he.svg`.
- **On dark grounds:** `ritmo-lockup-on-dark.svg` and `ritmo-lockup-he-on-dark.svg` (light ink, white bars, lime dot, transparent). `ritmo-lockup-reversed.svg` carries its own night tile for photos and slides.
- **Mark alone:** app icons, favicons, avatars, loading states. `ritmo-mark.svg` on light grounds, `ritmo-mark-reversed.svg` on `surface-inverse`, `brand` or photos, `ritmo-mark-ink.svg` for single-color print and fax.
- **App icon:** `ritmo-app-icon.svg` (green tile) is the default; `ritmo-app-icon-dark.svg` is for dark-mode icon sets.
- Clear space: one bar height (7/48 of the mark) on every side. Minimum size: mark 16px, lockup 88px wide.
- Don't recolor the bars into multiple colors, don't animate the bars out of order, don't set the name in another typeface, don't capitalize it in the wordmark (in running text write "Ritmo").

## Color

The palette is semantic; always use token names, never raw hex.

- **Ground:** `bg` (warm paper / deep night) under everything; `surface` for cards and inputs; `surface-sunken` for wells and empty lanes; `surface-inverse` for toasts and tooltips; `hero` (dark in both themes, text `on-hero`) for the ClockCard.
- **Text:** `ink` for primary text, `ink-muted` for secondary, `ink-faint` for placeholders and axis ticks only. On `surface-inverse` use `ink-inverse`.
- **Ritmo Green** (`brand`, `brand-strong`, `brand-tint`, `brand-text`): primary actions, selection, links, success. Text on a `brand` fill is `on-brand` (white in light, deep green in dark), never literal white.
- **Pulse Lime** (`pulse`, `on-pulse`): the clock-in moment only, and the live dot. Never text, never a background for a whole area.
- **Beat Amber** (`beat`, `on-beat`, `beat-tint`): breaks, pending items, notification counts, the dot in the mark.
- **Status:** `success` (alias of `brand-text`), `warning`, `danger`, `info`, each with a `*-tint` for banners. Status is never shown by color alone: always add a word or icon. Success (green) and danger (orange-red) also differ in icon (check vs. alert).
- **Schedule tints:** `shift-green`, `shift-sun`, `shift-sky`, `shift-clay`, `shift-stone` encode role, in that order. Text on all of them is `ink`.
- **Activity timeline:** `track-focus`, `track-neutral`, `track-idle` (idle is always hatched).

Every text pair named in a token's usage note meets WCAG AA (4.5:1) in both themes; control borders (`line-strong`) and the `focus-ring` meet 3:1. Dark theme is designed, not inverted: `brand` lightens to a mint and its label flips to dark (`on-brand`).

## Typography

- **IBM Plex Sans Hebrew** (400, 500, 600, 700) is the single UI family for Hebrew and Latin; the two scripts were drawn together, so mixed lines sit on one rhythm. Its digits are tabular by default, so numbers align in tables without a monospace. Files: `design/fonts/IBMPlexSansHebrew-*.woff2` (Latin + Hebrew in each).
- **IBM Plex Mono** (400, 500) appears in exactly two places: the live `timer` and `mono` (keyboard shortcuts, IDs). Everything else, including times and money, is sans.
- The wordmark is drawn from Rubik and is never retyped; UI text never uses Rubik.
- Scale (web): `h1` 24 / `h2` 18 / `h3` 15 / `body` 14 / `caption` 12 / `label` 12. Numbers: `figure-lg` 28 for headline stats, `figure` 14/500 in tables. Mobile body copy uses `body-lg` 16. `display` 40 and `display-xl` 60 are for onboarding and marketing only.
- Weights: 600 headings, 500 names/values/buttons, 400 reading. One weight change per line at most.
- Latin display sizes get slight negative tracking; Hebrew is always 0. Labels are sentence case in both languages: no uppercase overlines.
- Line length 60–75 characters; headings use `text-wrap: balance`.

## Layout and spacing

- 4px base. Use `space-*` tokens only: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **App frame:** a 232px sidebar sits directly on `bg` (inline-start side, so on the right in Hebrew). All page content lives on one raised **sheet** (`surface`, 1px `line`, `radius-lg`, `shadow-sm`, 8px from the window edge). The sheet has a 52px bar with breadcrumbs, search (⌘K) and "Ask Ritmo".
- **Inside the sheet** use sections and hairlines, not a card per idea. Panels (`line` border, `radius-lg`) only group a table or list with its header. Headline numbers go in one **stat strip** (`rt-stats`) divided by hairlines, never in floating metric cards.
- Density: web rows 40–44px, controls 36px (28px small). Mobile: 16px gutters, 48px primary buttons, bottom tab bar of 5 items.
- Use CSS logical properties everywhere (`margin-inline-start`, `inset-inline-end`, `padding-inline`). Never `left`/`right` in component code.
- Times, numbers, currency, emails and code stay LTR inside Hebrew: wrap them in `<bdi>` or `.rt-num`. Without it, `07:00–15:00` renders reversed.

## Shape and elevation

- Radii are tight and consistent: `radius-xs` 4 (checkboxes, kbd, timeline), `radius-sm` 6 (inputs, badges, shift blocks), `radius-md` 8 (buttons, menus), `radius-lg` 12 (panels, the sheet, dialogs), `radius-xl` 16 (mobile cards, the clock card, sheets), `radius-pill` (status dots, toggles, avatars, the mark).
- Elevation is mostly borders. `shadow-sm` for the sheet and secondary controls, `shadow-md` for menus, toasts and a dragged shift, `shadow-lg` for dialogs and the desktop agent. No glows, no gradients, no glass.

## Motion

Calm, quick and physical: 120–260ms for almost everything, ease-out to enter, ease-in to leave, nothing bounces, everything respects `prefers-reduced-motion`. The one signature moment is **clock in**: a single lime ring expands from the button as the fill turns amber and the timer rises into place. The full spec, every choreography and the haptics map are in `MOTION.md`; tokens are `--dur-*`, `--ease-*`, `--stagger` and `--press-scale`.

## Iconography

No icon set ships with this system yet. Use **Lucide** (outline, 24px grid, 1.6–1.75px stroke, round caps and joins) at 16px in buttons, 18px in navigation and lists, 24px in the mobile tab bar. Icons take `currentColor`. Never use emoji as icons. Every status icon has a text label beside it. *This is a recommendation, not a licensed brand asset; replace it with a custom set when one exists.*

## What Ritmo never looks like

These are the tells of generic, template-made software. Reject them in review:

- A row of four identical floating metric cards with icons in colored circles. Use the stat strip.
- Everything in its own rounded card with a drop shadow. Use one sheet, sections and hairlines.
- Big friendly greetings as page titles ("Good morning, Michal!"). The page title says what the page is.
- Blue-to-purple gradients, glassmorphism, glows, 3D blobs, isometric illustrations, sparkle icons for AI.
- Colored left-border accent cards. Tinted badges on every row of a table (use `rt-status`: dot + word).
- Pill-shaped everything. Radius follows the scale; pills are for status dots, toggles and avatars.
- Filler stats, fake trends, decorative charts without a comparison.
- Emoji in UI, exclamation marks, "Oops!", "Awesome!".
- AI presented as a separate glowing box. AI suggestions sit in the work list, labelled "Ritmo suggests", with the same controls as everything else.

## Imagery and illustration

- Photography: real workplaces (kitchens, warehouses, clinics, offices), natural light, people mid-task, never posed handshakes or stock "teamwork".
- Graphics: build from the mark's vocabulary (pill bars, dots, the timeline). No 3D blobs, no purple-blue gradients, no isometric office scenes.

## Desktop tracking: transparency rules

These are product rules, enforced in design:

- The TrackingIndicator is visible whenever the agent is running; there is no silent mode.
- Every employee has a "What's collected" page linked from that indicator, showing exactly what the manager sees.
- Idle and personal time are labeled as such, never as "unproductive".
- Screenshots (if a company enables them) are blurred by default in lists and open only on explicit click, with the employee notified.

## Accessibility

- WCAG 2.2 AA and Israeli Standard IS 5568: 4.5:1 text, 3:1 controls and focus, 44px touch targets, full keyboard support.
- Focus: 2px solid `focus-ring` with 2px offset, on every interactive element, never removed.
- Never encode state in color alone (pills have words, idle has a hatch, deltas have arrows).

## Components

Plain CSS in `design/components.css` (class prefix `rt-`) and `design/motion.css`, no JavaScript required. Load `tokens.css`, `components.css`, `motion.css`, then add `class="rt-root"` to the app root. Rules per component: `components/*.md`. Live gallery: `components.html`.

- **Button** — `primary`, `pulse`, `secondary`, `ghost`, `link`, `danger`; sizes sm 28 / md 36 / lg 48; icon-only.
- **Status** — dot + word for tables and dense lists; **StatusPill** (badge) for mobile and single emphasized states.
- **Field** — labeled input with hint and error; **Segmented** control.
- **StatStrip** — headline numbers in one hairline-divided strip, with sparkline or meter.
- **Table** — data table with person cell, numeric alignment and hover.
- **ClockCard** — the live timer and the one-tap clock in/out.
- **ShiftBlock** — a shift on the schedule grid, tinted by role.
- **ActivityTimeline** — the desktop agent's day: focused, neutral, idle.
- **TrackingIndicator** — the always-visible transparency chip.
- **Banner**, **Toast**, **EmptyState** — system feedback.
- **MetricTile** — a single number for small widgets.
