# 0015 — three.js / React Three Fiber, lazy-loaded, server-decimated previews

- **Status:** Accepted (planning)
- **Date:** 2026-10-29

## Decision
The viewer uses three.js through @react-three/fiber (+ drei helpers). It's dynamically imported on visibility/interaction, never in the global bundle. A static preview image renders first. The geometry service produces a decimated GLB (≤ 200k triangles) for display, so the original file is never shipped to the browser for viewing. A WebGL-unavailable fallback shows the image plus a dimensions table.

## Consequences
The viewer chunk budget is ≤ 250 KB gzip. Model IP exposure is reduced (a decimated preview, not the source). Axes are never mirrored in RTL.
