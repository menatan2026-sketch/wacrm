# Platform — custom manufactured parts, made simple

Customers describe what a part is for (or upload a 3D file). The Platform analyzes it, prices it,
routes it to an approved manufacturing partner, checks quality and ships it. Hebrew (RTL), English
and Russian from day one.

> **Status:** MVP build (milestones M0R–M5) on branch `claude/elegant-curie-ig4cs4`. The full
> order loop works end to end in all three languages, on desktop and mobile. **Payments, tax
> invoices and courier booking run on development adapters** until vendors are chosen. See
> [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) and the open owner decisions below.

## What's in the box

| Surface    | Path                 | Who                                                                                                                                                                                                                                                      |
| ---------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer   | `/{he,en,ru}`        | Order wizard (upload → usage questions → size → 3D review → firm price), sign-in by emailed code, checkout, order tracking, messages, cancel/report a problem, reorder                                                                                   |
| Partner    | `/{locale}/partners` | Invitation, onboarding (company, machines, payout details, agreement), time-limited job offers, phone-first production and QC evidence (camera photos, caliper measurements, checklist), payouts                                                         |
| Operations | `/{locale}/ops`      | TOTP-protected. Dashboard and attention queue, orders (manual quotes, routing, holds, messages, shipments, refunds, disputes), QC review and reprints, suppliers, versioned pricing rules, refund approvals, payout statements, feature flags, audit log |

Architecture: a modular monolith ([ADR-0002](docs/DECISIONS/0002-modular-monolith-single-web-app.md)).

```
apps/web          Next.js 16 app: three surfaces, server actions, API routes (uploads, webhooks, health)
apps/worker       Outbox relay, BullMQ jobs, schedulers (offer expiry, quote expiry, tracking, auto-complete)
packages/core     Domain services: identity/RBAC, catalog, files, drafts, orders, pricing, quotes,
                  routing, production/QC, payments, shipping, payouts, notifications, admin
packages/db       Drizzle schema + reviewed SQL migrations (append-only triggers, sequences)
packages/i18n     he/en/ru message catalogs, formatting, catalog checks
packages/ui       Components (Base UI), tokens, motion, 3D viewer
services/geometry Python FastAPI + trimesh: sandboxed STL/3MF validation and measurement
tests/e2e         Playwright: he/en/ru × desktop/mobile, full order loop
docs/             Product, architecture, security, quality and design documentation; ADRs
```

## Run it locally

Prerequisites: Node 22, pnpm 10 (`corepack enable`), Python 3.12 with [uv](https://docs.astral.sh/uv/),
and PostgreSQL 16 + Redis 7 (Docker or native).

```bash
pnpm install
cp .env.example .env
# Replace every placeholder secret, e.g.: openssl rand -hex 32
#   APP_SECRET, GEOMETRY_SHARED_SECRET, PAYMENT_WEBHOOK_SECRET

# Databases — either Docker …
docker compose -f infrastructure/docker/docker-compose.yml up -d
# … or native Postgres + Redis (no Docker, e.g. a cloud sandbox)
pnpm dev:services

pnpm db:migrate
pnpm db:seed          # catalog, pricing rules, flags, plus dev staff and partner accounts

pnpm dev:geometry     # terminal 1 — geometry service on :8001
pnpm dev              # terminal 2 — web on :3000 and the worker
```

Open <http://localhost:3000>. `/api/readyz` reports database, Redis and geometry status.

**Signing in during development.** Email goes to the `email_messages` table (`EMAIL_DRIVER=log`), so
read the code with:

```bash
psql "$DATABASE_URL" -c "select to_address, subject from email_messages order by created_at desc limit 5"
```

Seeded accounts: `admin@`, `finance@`, `qc@`, `support@`, `super@mfg.local` (ops; set up TOTP on
first sign-in) and `partner1@`, `partner2@mfg.local` (partners). Any other address signs up as a
customer.

**Paying during development.** With `PAYMENT_PROVIDER=fake` and `DEV_TOOLS_ENABLED=true`, checkout
opens a clearly labelled test payment page that sends a signed webhook. Both settings are refused
when `APP_ENV=production`.

## Checks

```bash
pnpm format:check && pnpm lint   # Prettier, ESLint (no UI string literals, logical CSS only), module boundaries
pnpm typecheck
pnpm i18n:check                  # key parity, ICU syntax, placeholders, he/ru plural forms
pnpm test                        # unit + integration (integration uses the mfg_test database)
(cd services/geometry && uv run ruff check . && uv run pytest -q)
pnpm test:e2e                    # needs the stack running and seeded; runs he/en/ru × desktop/mobile
```

CI runs all of these ([.github/workflows/ci.yml](.github/workflows/ci.yml)), with the e2e matrix
against a production build.

## Configuration

All settings are environment variables, validated at startup by `packages/config`; see
[.env.example](.env.example). Notable ones:

- `APP_ENV` — `development | ci | staging | production`. Required when `NODE_ENV=production`.
  `production` refuses dev tools and every simulator (fake PSP, fake courier, log-only email).
- `STORAGE_DRIVER=s3` with `S3_*` for object storage. Files are private; downloads use short-lived
  signed URLs after a permission check.
- Feature flags (`AUTO_PRICING`, `AUTO_ROUTING`, …) live in the database and are toggled from
  `/ops/flags`. Every automation has a manual path.

## Decisions waiting on the owner

These block launch, not development. Each is tracked in [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md):

1. **Payment provider** (KI-007/KI-015) and the capture strategy (KI-006).
2. **Certified invoicing provider** (KI-016).
3. **Courier** (KI-017).
4. **Prices, margins, payout rate cards** (KI-003): current values are placeholders, editable as a new
   pricing-rule version at `/ops/pricing`.
5. **Brand and name** (KI-002), **legal texts** (KI-005, KI-022) and **native review of he/ru copy** (KI-004).
6. **Hosting region** (KI-011).

## Documentation

Start with [docs/PRODUCT.md](docs/PRODUCT.md) and [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md), then
[ARCHITECTURE](docs/ARCHITECTURE.md), [DATABASE](docs/DATABASE.md), [SECURITY](docs/SECURITY.md),
[QUALITY_PLAN](docs/QUALITY_PLAN.md) and the [ADRs](docs/DECISIONS/README.md).
