# 04 · Design system

> Source of truth: [`tokens/tokens.mjs`](./tokens/tokens.mjs).
> `node docs/platform/tokens/build.mjs` generates
> [`tokens.css`](./tokens/tokens.css) (Tailwind v4 theme),
> [`tokens.json`](./tokens/tokens.json) (W3C DTCG, for Figma/Tokens Studio),
> [`tokens.native.json`](./tokens/tokens.native.json) (hex, for React
> Native, which can't parse `oklch()`) and
> [`contrast-report.md`](./tokens/contrast-report.md).
> **The build fails if any declared color pair misses WCAG AA**; currently
> 152/152 checks pass in light and dark. It becomes `packages/tokens` in
> Phase 1.

## 1. Design principles

1. **Calm by default.** Neutral canvas, one accent, color reserved for
   meaning (status, attendance, categories). A manager scanning 200 shifts
   should see the three problems, not a rainbow.
2. **Numbers are the interface.** Hours, costs and times use tabular
   figures, align on the decimal, and never wrap. The big clock is set like
   a watch face.
3. **Speed you can feel.** Optimistic updates, instant previews from
   `@repo/core`, skeletons that match final layout (no layout shift), and
   ⌘K/Ctrl+K for everything.
4. **One hand, one thumb.** On mobile, primary actions sit in the bottom
   third, targets are ≥ 48 px, and clocking in is one tap.
5. **Trust is designed.** Monitoring features always show _what_ is
   collected, _when_, and _who saw it_. No dark patterns, no hidden states.
6. **Bidirectional from day one.** Every component is built and reviewed in
   Hebrew RTL first, then English LTR. Not translated after the fact.

## 2. Color

- **Space.** OKLCH, so every hue's step `600` has the same perceived
  lightness. That keeps 10 shift colors balanced side by side. Chroma is
  automatically clamped into sRGB by the build.
- **Primitives.** `neutral` (0, 25, 50, 100 … 950, 1000; cool, near-zero
  chroma) and 10 hues × 11 steps: `iris` (brand), `blue`, `sky`, `teal`,
  `green`, `lime`, `amber`, `orange`, `red`, `magenta`.
- **Brand accent: Iris** (`oklch(0.555 0.21 277)`), a calm blue-violet. A
  placeholder until branding (Q4), and swappable by changing one hue in
  `tokens.mjs`. White-label tenants (Phase 5) override `--primary*` only;
  contrast is re-validated server-side when a tenant picks a color.
- **Semantic tokens** are the only colors components may use (lint rule
  bans raw palette classes in `packages/ui`):

| Group      | Tokens                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces   | `background` (canvas), `surface` (cards), `surface-raised` (menus, popovers), `surface-sunken` (wells, table headers), `surface-hover`, `surface-selected`, `overlay`      |
| Text       | `foreground`, `foreground-muted`, `foreground-subtle` (all ≥ 4.5:1), `foreground-disabled`                                                                                 |
| Lines      | `border` (decorative), `border-strong`, `border-input` (≥ 3:1, WCAG 1.4.11)                                                                                                |
| Accent     | `primary`, `primary-hover`, `on-primary`, `primary-soft`, `on-primary-soft`, `ring`, `link`                                                                                |
| Status     | `success / warning / danger / info` × `solid · on-solid · soft · on-soft · border · fg`                                                                                    |
| Attendance | `on-shift` (green) · `on-break` (amber) · `late` (orange) · `absent` (red) · `scheduled` (blue) · `overtime` (magenta) · `off` (neutral), each with `dot · soft · on-soft` |
| Activity   | `productive` (teal) · `neutral` · `unproductive` (**amber, deliberately not red**) · `idle`                                                                                |
| Shifts     | `shift-1 … shift-10` × `bg · border · fg · accent`, assigned to positions                                                                                                  |
| Charts     | `chart-1 … chart-8` (≥ 3:1 against surface)                                                                                                                                |

- **Never color alone.** Every status also carries an icon or label
  (WCAG 1.4.1). Attendance dots pair with a text badge; chart series pair
  with direct labels or patterns.
- **Dark mode** is a first-class theme, not an inversion: depth comes from
  lighter surfaces (`background` 0.152 → `surface` 0.182 → `raised` 0.215)
  plus a faint top highlight, since shadows barely read on dark.
  Selected by user preference, defaulting to system.

## 3. Typography

| Token         | Size / line       | Use                                                   |
| ------------- | ----------------- | ----------------------------------------------------- |
| `2xs`         | 11 / 16           | Badges, eyebrow labels only                           |
| `xs`          | 12 / 18           | Captions, timestamps                                  |
| `sm`          | 13 / 20           | Dense tables, secondary text                          |
| `base`        | 14 / 22           | **Web app body** (desktop density, Linear-like)       |
| `md`          | 16 / 24           | **Mobile body**, all touch inputs (prevents iOS zoom) |
| `lg` · `xl`   | 18 / 26 · 20 / 28 | Section titles                                        |
| `2xl` · `3xl` | 24 / 32 · 30 / 38 | Page titles                                           |
| `4xl` · `5xl` | 36 / 44 · 48 / 56 | Marketing, empty-state heroes                         |
| `clock`       | 64 / 72           | Mobile clock / running timer                          |

- **Families.** `Inter Variable` for Latin + **`Heebo`** for Hebrew in one
  stack: Inter has no Hebrew glyphs, so Hebrew characters fall through to
  Heebo automatically, while Latin words, numbers and codes inside Hebrew
  sentences stay in Inter. `JetBrains Mono` for codes and API keys.
  Alternatives considered: Rubik (too rounded for a premium tool),
  Assistant (lighter color, weaker at 13 px), IBM Plex Sans Hebrew
  (excellent, the fallback choice if we want a single superfamily).
- **Tabular figures** (`tabular-nums`) on all time, duration and money
  values.
- **Tracking.** Latin sizes ≥ `lg` are tightened slightly. **Hebrew is
  never letter-spaced**: `:root:lang(he)` resets all tracking tokens to 0
  automatically (verified to resolve through Tailwind v4's generated
  utilities).
- **Weights**: 400 / 500 / 600 / 700 only. Hebrew at 13 px uses ≥ 500 for
  labels.

## 4. Space, size, shape, depth

- **Spacing**: 4 px base (`p-1` = 4, `p-4` = 16 …). Layout rhythm uses 4,
  8, 12, 16, 24, 32, 48, 64.
- **Sizes**: `touch-min` 44, `touch-mobile` 48, `clock-button` 168, table
  rows 36 (compact) / 44 (default), sidebar 248 / 64 collapsed.
  **Density setting** (comfortable / compact) on tables and the scheduler,
  saved per user.
- **Radius**: `xs 4 · sm 6 · md 8 (inputs, buttons) · lg 12 (cards) ·
xl 16 (sheets, dialogs) · 2xl 24 (mobile sheets) · full`.
- **Elevation**: `xs`, `sm` (cards on hover), `md` (dropdowns), `lg`
  (popovers, dialogs), `xl` (command palette), with separate light and dark
  recipes.
- **Layers**: `sticky 100 · dropdown 1000 · overlay 1200 · modal 1300 ·
popover 1400 · toast 1500 · tooltip 1600`.

## 5. Motion

| Token                            | Value                                               | Use                                                                     |
| -------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `instant`                        | 80 ms                                               | Hover, press feedback                                                   |
| `fast`                           | 140 ms                                              | Toggles, chips, tooltips                                                |
| `base`                           | 200 ms                                              | Menus, popovers, tab changes                                            |
| `slow`                           | 320 ms                                              | Sheets, dialogs, page transitions                                       |
| `slower`                         | 480 ms                                              | Onboarding, celebratory moments                                         |
| `ease-standard`                  | `cubic-bezier(0.2,0,0,1)`                           | Default                                                                 |
| `ease-decelerate` / `accelerate` |                                                     | Enter / exit                                                            |
| springs                          | `snappy` 420/34 · `gentle` 260/28 · `bouncy` 500/22 | Motion & Reanimated. `bouncy` is reserved for the clock-in confirmation |

- **Purposeful only**: motion explains a change (where a shift went, what
  was added), never decorates.
- **Signature moments** (designed in Phase 1): the clock-in button
  (press-and-fill, haptic, animated check), drag-drop settling on the
  scheduler, the live "on shift now" counter, the publish-schedule
  confirmation.
- **Reduced motion**: all durations collapse to 0 under
  `prefers-reduced-motion`; essential state changes become instant fades.
- **Mobile haptics**: light impact on toggles, success notification on
  punch, warning on a rejected punch, selection ticks while dragging in the
  scheduler.

## 6. RTL & internationalization rules

1. **Logical properties only**: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`,
   `end-*`, `text-start`, `border-s`. A lint rule bans `ml-`, `mr-`, `pl-`,
   `pr-`, `left-`, `right-`, `text-left` and `text-right` in app code.
2. **`dir` and `lang`** are set on `<html>` from the user's locale. Never
   mix them per component, except to isolate embedded content.
3. **Bidi isolation**: user-generated names, emails, phone numbers, codes
   and numbers inside sentences are wrapped in `<bdi>` (or `unicode-bidi:
isolate`). Phone numbers and IDs always render LTR.
4. **Icons**: directional icons (arrows, chevrons, back, undo/redo, send,
   "next", progress) mirror via `rtl:-scale-x-100`, declared in
   `@repo/icons` metadata. **Not mirrored**: clocks, checkmarks, media
   play, charts' value axes, brand logos, the slash in fractions.
5. **Time-based visuals mirror**: in RTL the scheduler's time axis and
   the timeline run right → left, and "next week" is on the left. Numeric
   values and their axis labels stay Western digits (the Israeli
   standard).
6. **Dates and numbers** always go through `Intl` with the user's locale
   (`he-IL`, `en-IL`, `en-US`…). Week starts on Sunday for IL orgs
   (configurable). An optional Hebrew-calendar date shows alongside
   (`Intl.DateTimeFormat('he-IL-u-ca-hebrew')`). Holidays come from a
   seeded data table; note that `@hebcal/core` is GPL-2.0, so it is not
   bundled into distributed clients.
7. **Hebrew is gendered.** UI copy addressing the user avoids gendered
   imperatives: infinitive ("להתחיל משמרת"), plural, or noun forms. Where
   unavoidable, the user picks a grammatical form in their profile.
   ICU `select` handles it. Copy guidelines and a glossary live in
   `packages/i18n/GLOSSARY.md`.
8. **Text expansion**: English↔Hebrew lengths differ by ±30%. Components
   never fix widths for labels; truncation is always paired with a tooltip.
9. **Pseudo-locale in dev** (`en-XA` long strings + `ar-XB` RTL) catches
   hard-coded strings and overflow before translation.

## 7. Component library (`packages/ui` + `packages/ui-native`)

Built on shadcn/ui with Base UI primitives (web) and a matching API in
React Native. Documented in **Storybook**, where every story renders in
{he-RTL, en-LTR} × {light, dark} with an axe check, plus visual regression
via Chromatic or Playwright screenshots.

| Tier        | Components                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundations | Text, Heading, Icon, Numeric (tabular, unit-aware), Bdi, VisuallyHidden, FocusRing                                                                                                                                                                                                                                                                              |
| Inputs      | Button (primary, secondary, ghost, danger; sizes sm/md/lg/touch), IconButton, Input, Textarea, Select, Combobox, MultiSelect, Checkbox, Radio, Switch, Slider, DatePicker, DateRangePicker, **TimePicker** (24 h, keyboard + scroll wheel), **DurationInput**, PhoneInput (E.164, IL default), PinPad, FileDrop, ColorSwatchPicker (shift palette), SearchField |
| Display     | Avatar (+ presence + attendance ring), AvatarStack, Badge, StatusDot, **AttendanceBadge**, Tag, Tooltip, Card, StatCard (value + delta + sparkline), EmptyState, Skeleton, Kbd, Timeline, Callout                                                                                                                                                               |
| Navigation  | AppShell (sidebar + topbar, collapsible), Tabs, SegmentedControl, Breadcrumbs, Pagination, CommandPalette (⌘K), OrgSwitcher, BottomTabs (native)                                                                                                                                                                                                                |
| Overlays    | Dialog, AlertDialog (destructive confirm), Sheet/Drawer, Popover, DropdownMenu, ContextMenu, Toast (with undo), HoverCard                                                                                                                                                                                                                                       |
| Data        | DataTable (virtualized, sticky header/first column, column pinning, density, inline edit, bulk actions, saved views), FilterBar, **WeekGrid** (scheduler core), **ShiftChip**, **TimesheetRow**, **ClockButton**, **GeofenceMap**, Chart wrappers (Recharts on web, Victory Native on mobile) using `chart-*` tokens                                            |
| Feedback    | ProgressBar, Spinner (only after 400 ms), InlineError, FormField (label, hint, error, required)                                                                                                                                                                                                                                                                 |

**Every data component ships four designed states**: loading (skeleton
matching the final layout), empty (illustration + one clear next action),
error (what happened + retry + support code), and no-permission (who to
ask).

## 8. Accessibility (WCAG 2.2 AA + IS 5568)

- Token-level contrast is enforced by the build (§2). Component-level
  checks run as axe in Storybook and Playwright.
- Focus is always visible: 2 px `ring` with 2 px offset (≥ 3:1). Focus
  is never hidden under sticky headers (WCAG 2.4.11).
- Targets ≥ 24 × 24 px everywhere (2.5.8), ≥ 44 px on touch.
- Drag-and-drop in the scheduler always has a keyboard and single-pointer
  alternative ("Move to…" menu) (2.5.7).
- No re-entering data already provided (3.3.7); accessible authentication
  with OTP paste and password managers allowed (3.3.8).
- Full keyboard support, roving tabindex in grids, ARIA live regions for
  the live attendance board and toasts.
- Screen readers: VoiceOver and NVDA tested in Hebrew and English per
  release; TalkBack and VoiceOver on mobile.
- An accessibility statement page and a feedback channel, as required in
  Israel under IS 5568.

## 9. Mobile UX specifics

- **Clock-in ≤ 2 taps, usually 1**: launch → giant `ClockButton` (168 px,
  bottom third) → punch. Location acquisition starts on launch, so it is
  usually ready before the tap. A job-code sheet appears only if the org
  requires it; an out-of-geofence warning only if the policy flags.
- **0 taps** via the iOS widget / Android quick-settings tile, and a Live
  Activity / ongoing notification with the running timer.
- **Offline-first**: every punch succeeds locally with a "queued" chip,
  then syncs. The UI never blocks on the network for core actions.
- **Cold start < 2 s**: Hermes, lazy tab screens, cached schedule and
  last state rendered from SQLite before the network returns.
- Bottom sheets over modals; swipe actions in lists (approve / reject) with
  button equivalents; pull to refresh; platform-native date pickers.

## 10. Voice & tone

Clear, warm, brief, in that order. Speak like a competent colleague: "3
shifts still need someone" rather than "Unassigned shift count: 3".
Errors say what happened and what to do next. Monitoring copy is
explicitly reassuring and factual: "Tracking is on while you're clocked
in. We record app names and active time, never what you type." Hebrew copy
is written natively, not translated, and reviewed by a Hebrew UX writer.
