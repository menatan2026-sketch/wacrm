# 0009 — Customer-facing order machine + domain sub-machines

- **Status:** Accepted (planning)
- **Date:** 2026-10-29
- **Related:** DATABASE §5, ARCHITECTURE §5

## Context
The spec lists one order state set spanning requirements, design, quoting, payment, routing, production, QC, shipping and disputes. One aggregate owning all of these becomes brittle, especially for multi-item orders and retries.

## Decision
Keep the spec's states as the **Order** (customer-facing commercial) lifecycle. Model Quote, DesignRequest, ProductionJob, Payment and Shipment as their own machines, whose events advance the order. `on_hold` is an orthogonal flag. Every machine is a pure transition table enforcing guards, permissions, timestamps, history, audit and outbox. MVP: one supplier per order.

## Consequences
Exhaustive transition tests per machine. Split fulfilment can be added later (jobs already reference order items). Customer labels collapse internal states (see the glossary).
