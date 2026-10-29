# 0013 — Tokens in OKLCH CSS variables, Tailwind v4, Base UI, IBM Plex

- **Status:** Accepted (planning); palette values subject to contrast verification (M0C-T03)
- **Date:** 2026-10-29
- **Related:** UI_DESIGN_SYSTEM.md

## Decision
- `packages/tokens` is the source of truth, built into CSS custom properties (OKLCH, light/dark) and a Tailwind v4 theme; arbitrary values are banned.
- Headless accessible primitives (Base UI, already proven in wacrm) with our own visual layer in `packages/ui`; no off-the-shelf themed look.
- Typography: IBM Plex Sans + IBM Plex Sans Hebrew + IBM Plex Mono (OFL), self-hosted, subset per script.
- Icons: Lucide plus custom domain icons on the same grid.

## Consequences
A coherent identity across three scripts. Component docs and visual regression run in the workbench. A brand name/logo (KI-002) can be added without redesigning the system.
