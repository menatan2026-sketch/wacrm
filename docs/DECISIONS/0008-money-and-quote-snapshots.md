# 0008 — Integer minor-unit money; immutable quote snapshots; versioned rules

- **Status:** Accepted (planning)
- **Date:** 2026-10-29
- **Related:** MASTER_PLAN §13, DATABASE §1, §3

## Decision
- Money = `bigint` minor units + ISO 4217 currency, as a `Money` value object. No floats.
- Pricing and routing rules are versioned rows; exactly one is active per scope.
- A quote stores an insert-only snapshot (inputs, rule-set version, engine version, lines, expected payout, margin, tax, expiry, hash). Historical quotes are never recomputed.
- VAT and other tax rates are data with effective dates.
- Manual overrides store the computed baseline alongside the override, with a reason.

## Consequences
Auditable financials, and margin-variance analysis is possible. Rule changes don't affect issued quotes. The engine version must be bumped on any formula change.
