# UI Design System

> Status: **Draft v0.1 — awaiting owner approval** · Phase 0C
> Source of truth in code: `packages/tokens` (tokens) → `packages/ui` (components). Values here are **proposed**. Every color pair must pass the automated contrast check (M0C-T03) before it's adopted.

## 1. Visual identity — "Precision, made visible"

The Platform looks like **an instrument, not a storefront**: calm graphite surfaces, precise hairlines, a coordinate grid that appears where measurement matters, and one warm signature color, the color of a heated nozzle, used only where something is being *made*.

### Motifs (used with purpose)

| Motif | Where it appears | Where it never appears |
|---|---|---|
| **Layer lines** (horizontal 1 px strata) | Progress of production, the brand mark, section dividers in the hero | Behind body text, in admin tables |
| **Coordinate grid** (8 px dot / 40 px line grid) | The 3D viewer floor, dimension-confirmation step, empty states for files | Long-form reading surfaces |
| **Measurement callouts** (dimension lines with end ticks, mono numerics) | The size confirmation, the QC measurement view, part cards | Decorative headers |
| **Toolpath line** (a single continuous path being drawn) | The upload → analysis animation, the routing explainer, loading for long operations | Buttons, small spinners |
| **Material cross-section** (infill pattern swatch) | Material cards, advanced mode | Customer default path (keep it simple) |
| **Wireframe → solid** | The preview progression: original → analyzed → manufacturing preview → final | Everywhere else |

**Recognizability test:** with the logo removed, a screenshot must still read as *ours* because of graphite + signature amber + hairline precision + mono measurements. Reviewed at each UI review step.

**Avoid:** neon glows, glassmorphism stacks, gradient blobs, sci-fi HUD chrome, stock "3D printer" photography, default component-library look.

## 2. Typography

### 2.1 Typeface strategy (ADR-0013)
- **Primary:** **IBM Plex Sans** (Latin + Cyrillic) and **IBM Plex Sans Hebrew**. One superfamily with matching metrics across all three scripts, an engineering heritage that fits the product, and the SIL Open Font License.
- **Technical / numeric:** **IBM Plex Mono** for measurements, IDs, file names and technical tables. Mono has no Hebrew glyphs, so it is used only for LTR technical data, which is always bidi-isolated.
- **Fallback stack:** `"IBM Plex Sans", "IBM Plex Sans Hebrew", system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Hebrew", Arial, sans-serif`.
- **Loading:** self-hosted WOFF2 via `next/font/local`, subset per script (`latin`, `latin-ext`, `cyrillic`, `hebrew`), weights 400/500/600 (+ 700 for display only), `font-display: swap`, size-adjusted fallbacks to avoid CLS. Only the subsets for the active locale are preloaded.

### 2.2 Type scale (rem, 16 px root; fluid on display sizes)

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `display-xl` | clamp(2.5rem, 5vw, 4rem) / 1.05 | 600 | Marketing hero only |
| `display-l` | clamp(2rem, 4vw, 3rem) / 1.1 | 600 | Wizard step titles on desktop |
| `heading-1` | 1.75rem / 1.2 | 600 | Page titles |
| `heading-2` | 1.375rem / 1.3 | 600 | Section titles |
| `heading-3` | 1.125rem / 1.4 | 600 | Card titles |
| `body-l` | 1.125rem / 1.6 | 400 | Customer explanatory copy |
| `body` | 1rem / 1.55 | 400 | Default |
| `body-s` | 0.875rem / 1.5 | 400 | Secondary text, admin default |
| `caption` | 0.75rem / 1.4 | 500 | Helper text, timestamps |
| `label` | 0.875rem / 1.3 | 500 | Form labels, buttons |
| `overline` | 0.75rem / 1.3, tracking +0.06em (Latin/Cyrillic only) | 600 | Section eyebrows, step numbers |
| `numeric-l` | 2rem / 1.1, `tabular-nums` | 500 | Prices, KPIs |
| `numeric` | inherit, `tabular-nums lining-nums` | — | All numbers in tables and money |
| `mono` | 0.875rem / 1.5 Plex Mono | 400 | Dimensions, order numbers, file names |

### 2.3 Script-specific rules
- **Hebrew:** no letter-spacing (tracking 0 on all sizes; `overline` renders without uppercase/tracking). Line height +0.05 on body sizes (Hebrew glyphs sit tall). Never uppercase transforms. Use gender-neutral copy (see Localization Glossary §4).
- **Russian:** plan for **+30 % text length** vs English. Buttons and tabs must not truncate (min-width, wrap allowed in cards, never in primary buttons. Shorten copy instead). Avoid all-caps (Cyrillic caps get wide).
- **English:** sentence case everywhere, no title case.
- Numerals are Western Arabic digits in all locales.

## 3. Spacing (4 px base, tokenized — no arbitrary values)

| Token | px | Typical use |
|---|---|---|
| `space-0` | 0 | — |
| `space-0.5` | 2 | Hairline offsets, icon nudges |
| `space-1` | 4 | Icon ↔ label tight |
| `space-2` | 8 | Inline gaps, chip padding |
| `space-3` | 12 | Input padding-inline, dense rows |
| `space-4` | 16 | Default gap, card padding (mobile), page gutter (mobile) |
| `space-5` | 20 | — |
| `space-6` | 24 | Card padding (desktop), form row gap |
| `space-8` | 32 | Section gap (mobile) |
| `space-10` | 40 | — |
| `space-12` | 48 | Section gap (desktop) |
| `space-16` | 64 | Page section separation |
| `space-20` | 80 | Hero padding |
| `space-24` | 96 | Marketing sections |

Enforcement: Tailwind theme restricted to these tokens. Stylelint/ESLint rule rejects arbitrary `[13px]`-style values outside `packages/ui` internals (each exception needs a comment).

## 4. Grid, breakpoints and layout

| Breakpoint | Min width | Columns | Gutter | Margin |
|---|---|---|---|---|
| `xs` | 0 | 4 | 16 | 16 |
| `sm` | 480 | 4 | 16 | 20 |
| `md` | 768 | 8 | 24 | 32 |
| `lg` | 1024 | 12 | 24 | 40 |
| `xl` | 1280 | 12 | 32 | 48 |
| `2xl` | 1536 | 12 | 32 | auto |

- **Max content width:** customer 1200 px (reading text max 68ch); supplier 960 px; admin fluid to 1680 px.
- **Customer layouts:** single column on mobile; wizard = content column (7/12) + a sticky summary panel (5/12) on `lg+`. The summary becomes a bottom sheet on mobile.
- **Admin layouts:** a collapsible side nav (240 / 64 px), list–detail split (`lg+`: list 5/12, detail 7/12), a dense 12-col dashboard grid with 16 px gaps, KPI tiles at span-3 and charts at span-6.
- **Supplier layouts:** a single column with a bottom tab bar on mobile, and a top nav on desktop.
- Use **container queries** for cards so the same card adapts inside a narrow panel or a wide grid.

## 5. Color system

Tokens are defined in **OKLCH** in code (the hex values here are for reference), and come in light and dark themes. The customer and supplier surfaces default to light; the admin offers dark mode; the 3D viewer canvas is always dark graphite for model contrast.

### 5.1 Brand

| Token | Light (hex) | Role |
|---|---|---|
| `brand-primary` "Calibration Blue" | `#1F4FE0` | Primary actions, links, focus ring base, selected states |
| `brand-primary-hover` | `#1A43C2` | — |
| `brand-signature` "Nozzle Amber" | `#D4630A` (was `#F2780C`; darkened to pass 3:1 for UI graphics on white — M0C-T03) | **Making-related moments only:** the layer-buildup animation, the active production stage, the brand mark accent, the "printing now" indicator. Never for warnings, never for primary buttons |
| `brand-ink` "Graphite" | `#14171C` | Display text, dark surfaces |

### 5.2 Neutral palette (cool graphite, 12 steps)
`neutral-0 #FFFFFF` · `25 #F8F9FA` · `50 #F1F3F5` · `100 #E6E9ED` · `200 #D3D8DE` · `300 #B6BDC6` · `400 #8E97A3` · `500 #6B7480` · `600 #535B66` · `700 #3D444D` · `800 #2A2F36` · `900 #1B1F24` · `950 #111418`

Semantic aliases (light): `surface-base = neutral-25`, `surface-raised = neutral-0`, `surface-sunken = neutral-50`, `border-subtle = neutral-100`, `border-default = neutral-200`, `border-strong = neutral-500` (was neutral-400; raised to meet 3:1 non-text contrast), `text-primary = neutral-950`, `text-secondary = neutral-600`, `text-tertiary = neutral-500` (large text only), `text-inverse = neutral-0`.

### 5.3 Semantic colors (each has `fg`, `bg-subtle`, `border`, `solid`)

| Semantic | Solid | Meaning | Paired icon |
|---|---|---|---|
| `success` | `#127540` (was `#16834A`; 4.5:1 on its subtle background) | Completed, passed, paid | check-circle |
| `warning` | `#8F5F0F` (ochre — deliberately distinct from Nozzle Amber; was `#B7791F`, darkened for 4.5:1) | Needs attention soon, at risk | alert-triangle |
| `danger` | `#C8312B` | Failed, blocked, destructive | x-octagon |
| `info` | `#2563A8` | Neutral information, in review | info |
| `neutral-status` | `neutral-600` | Draft, inactive, cancelled | circle-dashed |

### 5.4 Domain status palettes

Every status renders as **icon + label + color + tooltip** (never color alone).

| Domain | Status → semantic |
|---|---|
| **Order** | DRAFT, REQUIREMENTS_PENDING → neutral · REVIEW_REQUIRED, DESIGN_* → info · QUOTE_READY, PAYMENT_PENDING → primary · PAID, ROUTING, SUPPLIER_* → info · PRODUCTION → **signature** · QC_PENDING → info · QC_FAILED, REPRINT_REQUIRED → warning · READY_FOR_SHIPMENT, SHIPPED → info · DELIVERED, COMPLETED → success · CANCELLED → neutral · REFUNDED → neutral · DISPUTED → danger · `on_hold` overlay → warning badge |
| **Payment** | pending → neutral · authorized → info · captured → success · partially_refunded → warning · refunded → neutral · failed → danger |
| **Production** | offered → info · accepted → info · in_production → signature · produced → success-subtle · declined/expired → neutral · overdue (derived) → danger |
| **QC** | pending → info · pass → success · needs_info → warning · fail → danger |
| **Shipping** | label_created → neutral · in_transit → info · out_for_delivery → info · delivered → success · exception → danger · returned → warning |
| **Supplier availability** | available → success · busy (≥ 80 % capacity) → warning · paused → neutral · suspended → danger |

### 5.5 Dark theme
Surfaces from `neutral-950/900/800`. Dark mode tokens ship in `packages/tokens` (signature `#FF9A3D`, success `#4CC385`, warning `#E8B04B`). Text `neutral-50/300`. Brand primary lifted to `#5B82FF`, signature to `#FF9A3D`. Semantic solids lifted ~15 % lightness. The same contrast thresholds apply.

### 5.6 Contrast and data-viz
- Text ≥ 4.5:1 (body) / 3:1 (≥ 24 px or 19 px bold). UI component boundaries and focus indicators ≥ 3:1.
- Charts use a categorical palette of 8 hues validated for color-vision deficiency, plus pattern/shape encoding for the primary series. Charts mirror correctly in RTL: the time axis runs right-to-left **only** when the locale convention expects it. **Decision: time axes stay left-to-right in all locales** (common practice in Hebrew dashboards); legends and labels follow locale direction.

## 6. Borders and radii

| Token | Value | Use |
|---|---|---|
| `border-hairline` | 1 px | Default borders, dividers |
| `border-strong` | 1.5 px | Selected cards, technical panels |
| `border-focus` | 2 px ring + 2 px offset, `brand-primary` | All focusable elements (`:focus-visible`) |
| `border-measure` | 1 px dashed `neutral-400` with 6 px end ticks | Dimension callouts, bounding boxes |
| `radius-xs` | 4 px | Chips, tags, inputs (dense) |
| `radius-s` | 6 px | Inputs, buttons |
| `radius-m` | 10 px | Cards |
| `radius-l` | 16 px | Dialogs, sheets, hero cards |
| `radius-full` | 9999 px | Avatars, pills, toggles |

The geometric character comes from small radii (6–10 px), which reads as precise but not harsh.

## 7. Elevation (minimal shadow, borders do most of the work)

| Level | Token | Treatment | Use |
|---|---|---|---|
| 0 | `flat` | No shadow, `border-subtle` | Page sections, table rows |
| 1 | `raised` | `0 1px 2px rgb(17 20 24 / 0.06)` + hairline border | Cards |
| 2 | `floating` | `0 4px 12px rgb(17 20 24 / 0.08)` | Popovers, dropdowns, sticky bars |
| 3 | `overlay` | `0 12px 32px rgb(17 20 24 / 0.14)` | Drawers, bottom sheets |
| 4 | `modal` | `0 24px 48px rgb(17 20 24 / 0.18)` + scrim `rgb(17 20 24 / 0.48)` | Dialogs |

Dark theme: elevation is expressed by a lighter surface step instead of shadows.

## 8. Surfaces

| Surface | Spec |
|---|---|
| Primary surface | `surface-base`, the page background |
| Secondary surface | `surface-sunken`, grouped regions, wizard background |
| Card (elevated) | `surface-raised`, `radius-m`, `raised`, padding `space-4` (mobile) / `space-6` |
| Interactive card | Card + hover `border-strong`, pressed scale 0.99, selected: 1.5 px `brand-primary` border + check badge at inline-end |
| Dialog | `radius-l`, `modal`, max-width 560 (form) / 720 (content). Full-screen sheet on mobile |
| Drawer | Side panel from **inline-end** (mirrors in RTL), 480 / 640 px, `overlay` |
| Technical panel | `surface-sunken`, `border-strong`, mono values, a small coordinate-grid background (5 % opacity) |
| Data panel | Flat, hairline dividers, dense rows (admin) |
| Viewer canvas | `neutral-950` with grid floor `neutral-800`, overlay text `viewer-text` (`neutral-50`, its own token so viewer labels never use raw colors), accent model highlight in `brand-primary`, issues in `danger`/`warning` overlays |

## 9. Iconography

- **Family:** Lucide (24 px grid, 1.5 px stroke, round joins). It's already familiar to the team from wacrm, and it's MIT licensed. **Custom domain icons** (nozzle, layer stack, build plate, infill, spool, caliper, QC loupe, routing fork, toolpath) are drawn on the same grid and stroke, and live in `packages/ui/icons/custom`.
- **Sizes:** 16 (dense/admin inline), 20 (default), 24 (navigation, cards), 32/48 (empty states, flow entry cards).
- **Domain mapping:**

| Domain | Icons |
|---|---|
| Manufacturing | `layers`, custom `nozzle`, custom `build-plate`, `cog` (process) |
| Files | `file-box` (3D file), `image` (photo), `file-text` (drawing), `upload-cloud` |
| Materials | custom `spool`, `droplet` (finish), `thermometer` (heat), `sun` (UV) |
| Orders | `package`, `clipboard-list` |
| Payments | `credit-card`, `receipt`, `undo-2` (refund) |
| Shipping | `truck`, `map-pin`, `package-check` |
| QC | custom `caliper`, `scan-search`, `badge-check`, `badge-x` |
| AI | `sparkles` (only for AI-generated content; always paired with an "AI-suggested" label) |
| Suppliers | `factory`, `users`, `calendar-clock` (capacity) |
| Analytics | `chart-line`, `chart-bar`, `gauge` |

- **RTL rules:** directional icons mirror in RTL via a `data-directional` attribute → `scale-x: -1` under `[dir=rtl]`: arrows, chevrons, `undo/redo`, `log-out`, `reply`, list-indent, "next/back" and send. **Do not mirror:** clocks/time, media play/pause, checkmarks, numerals, brand logos, real-world objects (truck, printer, caliper), charts' time direction, and slash-like icons with physical meaning.
- Icons are `aria-hidden` when paired with text. Icon-only buttons require an `aria-label` from translations.

## 10. Buttons

| Variant | Visual | Use |
|---|---|---|
| `primary` | Solid `brand-primary`, `text-inverse`, `radius-s` | One per view region |
| `secondary` | `surface-raised` + `border-default`, text-primary | Alternatives |
| `tertiary` | Text-only, `brand-primary` text, underline on hover | Low-emphasis navigation |
| `ghost` | Transparent, hover `surface-sunken` | Toolbars, table row actions |
| `danger` | Solid `danger` (destructive confirm) / `danger` outline (initiating) | Delete, cancel order, refund |
| `icon` | Square, ghost or secondary, 40 px (44 px touch on mobile) | Toolbars |

Sizes: `sm` 32 px (admin dense), `md` 40 px (default), `lg` 48 px (customer primary CTA), `xl` 56 px (supplier primary actions, full-width on mobile).

States: default · hover (−6 % lightness) · active/pressed (scale 0.98, −10 %) · focus-visible (focus ring) · **loading** (label stays, a spinner replaces the leading icon, width locked, `aria-busy`, not re-clickable) · **disabled** (40 % opacity text, no pointer; prefer explaining *why* via helper text over disabling) · **success** (check icon morph for 1.2 s, then return or navigate).

The label is a verb in the user's language ("Get price", "Accept job"). Never "OK"/"Submit".

## 11. Forms

| Control | Spec |
|---|---|
| Input | 40 px (48 px mobile customer), `radius-s`, `border-default`, label above (never placeholder-as-label), helper below, `space-1.5` label gap |
| Select | Native `<select>` on mobile for ≤ 7 options; custom listbox (searchable) for long lists |
| Radio cards | The preferred choice control in the customer wizard: large, icon + title + one-line explanation, full-card hit area |
| Checkbox / switch | Checkbox for consent and multi-select; switch only for immediate-effect settings |
| Upload control | Dropzone with the toolpath outline animation on drag-over, accepted formats + max size visible, a per-file row with stage progress, cancel, retry and remove. Camera capture button on mobile for photos |
| **Measurement input** | Number field (`inputmode="decimal"`) + an attached **unit selector** (mm / cm / in), mono digits, `dir="ltr"` inside RTL with the unit on the correct visual side, locale-aware decimal separator (accept both `.` and `,` in ru/he input), min/max hints, a stepper on desktop |
| Unit selector | Segmented control; remembers the user preference; conversion shown in helper text ("= 4.72 in") |
| Validation | On blur, then live after the first error. Messages are specific and actionable, from the `validation` namespace. Error = `danger` border + icon + text (not color alone). An error summary with anchor links on submit |
| Success presentation | A subtle inline check on validated critical fields (address, measurement within limits); a toast after save with undo where possible |

## 12. Tables (admin and supplier)

Built on TanStack Table + virtualization (> 100 rows). Features: global search, faceted filters (chips), multi-column sort, server-side pagination (cursor), bulk select + bulk actions bar, pinned first column (ID) and pinned actions column (inline-end), column visibility menu (persisted per user), **density** toggle (compact 32 px / comfortable 44 px rows), row actions menu (ghost icon button), keyboard navigation (↑/↓, Enter opens, X selects), saved views (Phase 3), sticky header, numeric columns aligned to the inline-end with `tabular-nums`, and money via the formatter. Mobile: tables collapse to stacked cards with the 3 key fields plus a status chip.

## 13. Cards (reusable patterns)

| Card | Content (priority order) |
|---|---|
| **Order card** | Thumbnail · title · order number (mono) · status chip · next step · ETA · total |
| **Quote card** | Total (numeric-l) incl. VAT · delivery window · expires-in · "View breakdown" disclosure · primary CTA |
| **Material card** | Name · one-line "good for…" · property icons (heat/UV/flex/strength meters, 5-step, with text values) · price indicator (₪–₪₪₪) · selected state |
| **Supplier card** (admin) | Name · availability chip · capabilities icons · quality score · on-time rate · open jobs / capacity bar |
| **Job card** (supplier) | **Payout** · **due** (relative + absolute) · material + color swatch · qty · size · QC requirements count · primary next-action button (xl) |
| **QC card** | Photo grid · checklist progress · measurements vs tolerance (pass/fail per row) · verdict buttons |
| **Digital part card** (Phase 7) | Preview · title · compatibility line · revision · price from · reorder |

## 14. Status components

- `StatusChip(domain, status)`: icon + label (from i18n) + color + tooltip with a one-sentence explanation and timestamp. Sizes `sm`/`md`.
- `StatusTimeline(order)`: vertical on mobile, horizontal on desktop. Stages: Requirements → Quote → Payment → Production → Quality check → Shipping → Delivered. It shows the current stage (animated signature color only while production is actually in progress), completed stages with timestamps, upcoming ones with estimates, and exception branches (QC failed → reprint) inline.
- `NextStepPanel`: the one sentence + one action (or "nothing needed from you — we'll notify you by …").
- `SupplierAvailabilityIndicator`, `PaymentStatusBadge`, `ShippingTracker` (carrier, tracking number with copy, events list).

## 15. Responsive and density modes

| Surface | Default density | Touch targets |
|---|---|---|
| Customer | Comfortable (spacious) | ≥ 44 px, primary CTA 48 px |
| Supplier | Comfortable, **large actions** | ≥ 48 px, primary 56 px, ≥ 8 px between targets (gloves) |
| Admin | Compact | ≥ 32 px (desktop), 44 px on touch devices (`pointer: coarse` media query) |

## 16. Accessibility requirements (design-system level)
- Every component ships with keyboard behaviour per WAI-ARIA APG, a visible focus state, screen-reader labels from i18n, reduced-motion behaviour, RTL rendering and a 200 % zoom check.
- Tested in the workbench with axe in all three locales and both themes. Visual regression snapshots: he-RTL, en, ru × light/dark × mobile/desktop.

## 17. Component inventory (M0C deliverable list)

Foundations: tokens, fonts, icons, theme provider, direction provider.
Primitives: Button, IconButton, Link, Input, Textarea, NumberInput, MeasurementInput, UnitSelector, Select, Combobox, Checkbox, RadioGroup, RadioCard, Switch, Slider, FileDropzone, Label, HelperText, FieldError, Form summary.
Feedback: Toast, Banner, InlineAlert, Skeleton, Progress (linear, staged), Spinner (small only), EmptyState.
Overlays: Dialog, Sheet/Drawer, Popover, Tooltip, DropdownMenu, CommandPalette.
Navigation: TopNav, SideNav, BottomTabBar, Breadcrumbs (direction-aware separators), Tabs, Stepper, Pagination.
Data: Table, DataList, KPI tile, Chart wrappers, Money, DateTime, Measurement (formatted display), Badge, StatusChip, StatusTimeline.
Domain: OrderCard, QuoteCard, MaterialCard, JobCard, QCChecklist, PriceBreakdown, NextStepPanel, ViewerFrame (lazy 3D), LanguageSwitcher.
