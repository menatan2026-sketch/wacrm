# 0006 — Geometry analysis as a sandboxed Python service

- **Status:** Accepted (planning)
- **Date:** 2026-10-29

## Context
Mesh analysis (STL/3MF/OBJ, later STEP) benefits from Python's ecosystem (trimesh, numpy, and OpenCascade bindings for STEP). Parsing untrusted files is a security boundary.

## Decision
`services/geometry` (FastAPI) runs in a hardened container: non-root, read-only FS, no egress, resource and time limits, reachable only from the worker. It returns typed metrics and failure codes, plus a decimated GLB preview.

## Consequences
An extra deployable (justified). Contract published as a zod schema. Fuzz testing nightly. Slicer-CLI estimation may later run here as a separate process (licence review first).
