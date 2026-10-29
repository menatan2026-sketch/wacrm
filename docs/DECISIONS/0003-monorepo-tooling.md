# 0003 — pnpm workspaces + Turborepo

- **Status:** Accepted (planning)
- **Date:** 2026-10-29

## Context
We need multiple TS packages, one Python service, fast CI and strict dependency hygiene.

## Options considered
npm workspaces (slower installs, weaker strictness) · Nx (powerful, heavier conventions) · **pnpm + Turborepo** (strict node_modules, content-addressed store, simple task graph with caching).

## Decision
pnpm workspaces + Turborepo. The Python service is managed with `uv`, and invoked via Turbo tasks for a uniform `lint/test/build`.

## Consequences
Remote caching is optional later. dependency-cruiser handles architectural boundaries, which Turbo does not enforce.
