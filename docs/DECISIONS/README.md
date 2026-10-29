# Architecture Decision Records

Format: [MADR](https://adr.github.io/madr/)-style. Each ADR has a status: **Proposed** (needs owner or spike decision), **Accepted**, **Superseded by NNNN**, or **Deprecated**. ADRs are never edited after acceptance except to change status. A new decision supersedes the old one.

| # | Title | Status |
|---|---|---|
| [0000](./0000-template.md) | Template | — |
| [0001](./0001-repository-strategy.md) | Greenfield monorepo, separate from the wacrm CRM | **Proposed — owner decision required** |
| [0002](./0002-modular-monolith-single-web-app.md) | Modular monolith; one Next.js app with three surfaces | Accepted (planning) |
| [0003](./0003-monorepo-tooling.md) | pnpm workspaces + Turborepo | Accepted (planning) |
| [0004](./0004-postgres-drizzle-migrations.md) | PostgreSQL 16, Drizzle ORM, reviewed SQL migrations | Accepted (planning) |
| [0005](./0005-outbox-and-bullmq.md) | Transactional outbox + BullMQ on Redis | Accepted (planning) |
| [0006](./0006-geometry-service-python-sandbox.md) | Geometry analysis as a sandboxed Python service | Accepted (planning) |
| [0007](./0007-i18n-next-intl-locale-routing.md) | next-intl, locale-prefixed routes, logical CSS for RTL | Accepted (planning) |
| [0008](./0008-money-and-quote-snapshots.md) | Integer minor-unit money; immutable quote snapshots; versioned rules | Accepted (planning) |
| [0009](./0009-order-lifecycle-state-machines.md) | Customer-facing order machine + domain sub-machines | Accepted (planning) |
| [0010](./0010-authentication-and-rbac.md) | Authentication library (spike) and scoped RBAC | **Accepted** — in-house OTP + `otpauth` TOTP |
| [0011](./0011-provider-ports-and-adapters.md) | Ports & adapters with fake implementations for every provider | Accepted (planning) |
| [0012](./0012-merchant-of-record.md) | Platform as merchant of record; supplier payouts via invoices | **Proposed — legal review** |
| [0013](./0013-design-system-foundations.md) | Tokens in OKLCH CSS variables, Tailwind v4, Base UI, IBM Plex | Accepted (planning) |
| [0014](./0014-motion-library.md) | CSS for micro-interactions; Motion (motion.dev) for orchestration | Accepted (planning) |
| [0015](./0015-3d-viewer.md) | three.js / React Three Fiber, lazy-loaded, server-decimated previews | Accepted (planning) |
| [0016](./0016-hosting-and-data-residency.md) | Managed containers + managed Postgres/Redis/S3, region near Israel | **Proposed — owner decision D-8** |

"Accepted (planning)" means accepted as the plan of record. It can still be revisited in the milestone that first implements it, if implementation evidence contradicts it.
