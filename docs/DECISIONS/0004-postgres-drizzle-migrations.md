# 0004 — PostgreSQL 16, Drizzle ORM, reviewed SQL migrations

- **Status:** Accepted (planning); RLS addendum due in M0F-T07
- **Date:** 2026-10-29
- **Related:** DATABASE.md

## Context
We need a relational system of record with strong constraints, transactions, JSONB, full-text search, partitioning, and type-safe access from TypeScript.

## Options considered
Prisma (great DX, less SQL control, heavier runtime) · Kysely (excellent query builder, no schema/migration story) · **Drizzle** (TS schema, SQL-like queries, SQL migrations we can review) · Supabase (good auth+DB bundle, but couples auth/storage to one vendor; the spec asks for Postgres + Redis + S3 + Docker Compose).

## Decision
Plain PostgreSQL 16 + Drizzle. Migrations are generated, then **reviewed and committed as SQL**. Triggers enforce insert-only tables. UUIDv7 ids.

## Consequences
Raw SQL is allowed for reporting and complex queries via tagged templates. Expand/contract migration discipline. Whether to add Postgres RLS as defense in depth is decided in M0F-T07.
