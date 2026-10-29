# 0011 — Ports & adapters with fake implementations for every provider

- **Status:** Accepted (planning)
- **Date:** 2026-10-29
- **Related:** ARCHITECTURE §9

## Decision
Every external dependency (payments, shipping, invoicing, storage, email, SMS, WhatsApp, AI, geometry, analytics sink, monitoring) is a TypeScript port in `packages/core`, with:
1. a deterministic fake adapter (tests, local, E2E);
2. real adapters written **only from official documentation**. We never invent endpoints, and unknowns are spiked first;
3. typed config + `.env.example` docs;
4. contract tests (fake always; real nightly against sandboxes).

## Consequences
Development proceeds before vendor contracts exist. Vendors can be swapped. A manual adapter (e.g. `ManualShippingProvider`) doubles as the operational fallback.
