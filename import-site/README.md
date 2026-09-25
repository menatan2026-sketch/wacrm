# Portolan — personal vehicle import, as a cinematic 3D site

A standalone Next.js 16 app that lives next to the wacrm CRM in this
repository. It's the public face of a premium personal car-import
business in Israel: one continuous, scroll-driven 3D story plus the
practical tools that turn visitors into qualified leads.

```
desire → discovery → global search → verification → import → arrival → ownership
```

## Run it

```bash
cd import-site
npm install
npm run build && npm start     # http://localhost:3100
npm run dev                    # dev server on :3100 (Turbopack)
npm run lint && npm run typecheck && npm test
```

Copy `.env.example` to `.env.local` to connect lead delivery (see below).

Useful query flags while developing:

| Flag | Effect |
| --- | --- |
| `?quality=low\|medium\|high` | Force a rendering tier |
| `?snap` | Settle every camera move instantly (screenshots on slow GPUs) |
| `?debug` | Expose the Three.js scene as `window.__scene` |

## What's on the site

| Route | What it is |
| --- | --- |
| `/` | The story: hero → configurator ("You know the car") → discovery search → globe ("We find it") → inspection close-ups ("We verify it") → trust → pinned import journey with container/customs/plates sequence → services → calculator → dusk arrival → about → delivered case files → sourcing form → final night-road scene |
| `/vehicles` | Search engine: natural-language "I know what I want" + structured filters, URL-synced |
| `/vehicles/[slug]` | Immersive vehicle page: 3D viewer or studio plate, progressive specs, *Why this car?*, verification file, import estimate, request form |
| `/import` | Full personal-import calculator with its assumptions |
| `/request` | Sourcing brief / vehicle request / specialist contact (pre-fills from query params) |
| `/privacy`, `/terms`, `/accessibility` | Legal templates — have counsel review before launch |
| `POST /api/leads` | Lead intake → CRM / webhook |
| `GET /api/vehicles` | Read-only inventory search (same criteria as the UI) |

## Replacing or adding a 3D vehicle

All scenes ask the registry in `src/config/vehicle-models.ts` for a model
by id, so swapping the car is a data change:

1. Put a Draco- or Meshopt-compressed GLB in `public/models/` (bump the
   file name when replacing — assets are cached immutably).
2. Add an entry: `url`, normalisation (`scale`, `offset`, `rotationY` so
   the nose points +Z and wheels sit on y = 0), and a `parts` map from
   our material slots (paint, glass, rims, lights, wheels…) to mesh/node
   names in the file. `npx @gltf-transform/cli inspect model.glb` lists them.
3. Optionally recolour badges via `materialOverrides` and adjust the
   inspection `anchors`.
4. Point `HERO_MODEL_ID` at it (homepage) and/or set `modelId` on a
   vehicle record (detail page viewer).

The bundled studio model is "Ferrari 458 Italia" by vicent091036
(CC BY 4.0), credited in the footer. Its brand-coloured badge materials
are neutralised through `materialOverrides`.

## Vehicle imagery

Listings render real photography from `vehicle.images` when present.
Until then they show a **studio plate** — a technical side-elevation
drawing in the car's actual paint colour, chosen by body style
(`src/components/vehicles/StudioPlate.tsx`). It's labelled as an
illustration on detail pages.

## Data architecture

```
src/domain/types.ts        ← the contract (Vehicle, Market, Lead, …)
src/data/*                 ← mock data (inventory, markets, journey, services, stories)
src/lib/repositories       ← VehicleRepository / ContentRepository interfaces + mock impl
src/lib/import-cost        ← landed-cost engine (tested)
src/lib/search             ← free-text parser + filtering (tested)
src/lib/leads              ← validation + sinks (tested)
src/config/*               ← brand/nav, 3D models, import rules
```

Components never import mock data directly for inventory — they go
through `repositories`. To move to Supabase/Postgres or an inventory API,
implement the two interfaces and swap them in
`src/lib/repositories/index.ts`. Keep methods async; they already are.

Every landed price on the site — cards, detail pages, calculator — comes
from one function (`calculateImportCost`) and one rules object
(`src/config/import-rules.ts`). **Those rates are illustrative planning
assumptions.** Have them owned and checked against the Israel Tax
Authority and a licensed customs broker; `rulesVersion` is shown next to
every estimate.

### Leads → CRM

`POST /api/leads` validates, normalises phones to E.164 (Israeli local
numbers default to +972), parses free-text specs into structured
criteria, and fans out to every configured sink:

- **wacrm** (this repo's CRM): set `WACRM_API_URL` and `WACRM_API_KEY`
  (a key with `contacts:write`). Leads are find-or-created by phone and
  tagged `web-lead`, `lead:<source>`, `make:<make>`, `vehicle:<slug>` —
  ready for wacrm automations (e.g. a WhatsApp template reply).
- **Webhook**: `LEAD_WEBHOOK_URL` receives the full JSON (Zapier, Make, n8n…).
- **Console**: always in development; in production only when nothing
  else is configured, so leads are never silently dropped.

There's a honeypot field and a per-IP rate limit (in-memory — move it to
a shared store when running more than one instance).

### Admin (future)

The public site is read-only by design. A separate admin app (or the
CRM) should own vehicles, prices, availability, images, specs, import
rules, markets, testimonials and services, writing to the same database
the repositories read from. Nothing in this app needs to change except
the repository implementations.

## How the 3D story works

- One fixed `<Canvas>` (`src/components/three/StageCanvas.tsx`) sits
  behind the whole homepage. Each 3D chapter is a tall `<section
  data-chapter>` whose content is sticky.
- A ticker reads section positions every frame and tells the **director**
  (`director.ts`) which chapter owns the screen and its progress. It also
  writes `--p` onto each section, so CSS choreographs typography from the
  same value.
- `poses.ts` maps each chapter's progress to a camera/lighting/effects
  pose; `StageScene.tsx` damps the live scene toward it.
- The studio lighting is procedural (`DynamicEnvironment.tsx`): light
  formers rendered into a cube map, re-rendered only while the palette
  changes (studio → inspection → transit → dusk → night).
- The globe is the same scene zoomed out ~150×: the car literally sits
  on Israel as the planet unfolds beneath it.
- When no 3D chapter is on screen, the canvas stops rendering.

### Performance

- Quality tiers (`high` / `medium` / `low`) by device; the low tier drops
  the reflector floor, halves globe points and particles, and throttles
  environment updates. `PerformanceMonitor` adapts pixel ratio live.
- The WebGL bundle is lazy-loaded after first paint; the GLB is Draco
  compressed (1.7 MB) with the decoder served locally.
- `prefers-reduced-motion`: native scrolling, no idle camera drift, no
  grain animation, instant transitions.
