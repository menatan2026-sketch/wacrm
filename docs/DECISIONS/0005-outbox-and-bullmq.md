# 0005 — Transactional outbox + BullMQ on Redis

- **Status:** Accepted (planning)
- **Date:** 2026-10-29

## Context
Domain changes trigger side effects (notifications, geometry, routing, provider sync). We must never lose an event or emit one for a rolled-back change.

## Options considered
Enqueue directly to Redis after commit (lost events on crash) · pg-boss (Postgres-only queue; fewer moving parts, but the spec asks for Redis, and Redis is also needed for rate limiting) · **outbox table + relay → BullMQ**.

## Decision
Write events to `outbox_events` in the same transaction. A relay publishes them to BullMQ. Handlers are idempotent (processed-event table), with retries, backoff and a DLQ.

## Consequences
Small publish latency (≤ 1 s). Redis is not a system of record. If Redis is lost, the relay re-publishes unpublished outbox rows.
