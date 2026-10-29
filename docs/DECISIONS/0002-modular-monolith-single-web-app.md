# 0002 — Modular monolith; one Next.js app with three surfaces

- **Status:** Accepted (planning)
- **Date:** 2026-10-29
- **Related:** ARCHITECTURE §1–§3, §6

## Context
The spec requests a modular monolith with no unnecessary microservices, and suggests separate apps for customer, admin, supplier and API. The team is small, and the domain logic must be shared by all surfaces.

## Options considered
1. Four apps (customer-web, admin, supplier, api) + per-domain services: strong isolation, but 4× build/deploy/config/auth overhead, and duplicated layouts and providers.
2. **One Next.js app with three route-group surfaces separated by host, plus a worker and a geometry service**; domain logic in `packages/core` with enforced module boundaries.
3. A single app with no host separation: the simplest, but admin cookies would share the customer origin.

## Decision
Option 2. Python only for geometry (sandboxing + ecosystem). Pricing, routing, notifications and AI are in-process modules.

## Consequences
- Per-route code splitting keeps admin code out of customer bundles (verified in M0F-T01).
- Host-only cookies per surface.
- **Split criteria:** move admin to its own deployable if network-level isolation is required, or if build time exceeds 10 min. The split is mechanical because logic lives in packages.
