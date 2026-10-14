# 03 · Folder structure

pnpm + Turborepo monorepo. Package scope `@repo/*` stays name-neutral, so
the product name can change without touching imports.

```
tempo/                                   # repo root (name TBD, see Q1)
├── apps/
│   ├── web/                             # Next.js 16 · admin dashboard + employee web + kiosk + public API
│   │   ├── src/app/
│   │   │   ├── (marketing)/[locale]/    # public site, pricing, legal (locale in URL for SEO)
│   │   │   ├── (auth)/                  # sign-in, sign-up, OTP, SSO callback, invite accept
│   │   │   ├── (onboarding)/setup/      # 10-minute setup wizard
│   │   │   ├── (app)/[org]/             # authenticated app, org slug in path
│   │   │   │   ├── home/                # executive / manager dashboard
│   │   │   │   ├── people/              # directory, profiles, org chart, import
│   │   │   │   ├── time/                # live board, timesheets, approvals, exports
│   │   │   │   ├── schedule/            # scheduler, templates, open shifts, requests
│   │   │   │   ├── chat/
│   │   │   │   ├── activity/            # Phase 2: productivity, timeline, tracking policies
│   │   │   │   ├── me/                  # my timesheet, my schedule, my privacy dashboard
│   │   │   │   └── settings/            # org, locations, roles, policies, integrations, billing
│   │   │   ├── kiosk/[deviceToken]/     # shared-tablet punch clock (PWA)
│   │   │   └── api/
│   │   │       ├── app/                 # first-party JSON API for mobile and desktop (JWT)
│   │   │       ├── v1/                  # public REST API (API keys, OpenAPI)
│   │   │       ├── scim/v2/             # Phase 5
│   │   │       └── webhooks/            # inbound: Stripe, WhatsApp, payroll
│   │   ├── src/features/<module>/       # feature-sliced: components, hooks, server actions, queries
│   │   ├── src/server/                  # withUserTx, auth helpers, rate limit, command dispatcher
│   │   ├── e2e/                         # Playwright (he-RTL / en-LTR × light/dark projects)
│   │   └── next.config.ts
│   │
│   ├── mobile/                          # Expo (React Native) · employees + managers + kiosk build
│   │   ├── app/                         # Expo Router
│   │   │   ├── (auth)/
│   │   │   ├── (tabs)/                  # Home(clock) · Schedule · Chat · Tasks · More
│   │   │   ├── manager/                 # approvals, live board, quick scheduling
│   │   │   └── kiosk/                   # locked-down shared-device mode
│   │   ├── src/offline/                 # SQLite outbox, sync engine, conflict policy
│   │   ├── src/native/                  # geofencing, widgets, Live Activities, haptics
│   │   ├── targets/                     # iOS widget / Android quick-settings tile (expo-apple-targets)
│   │   └── e2e/                         # Maestro flows
│   │
│   ├── desktop/                         # Tauri 2 agent (Phase 2)
│   │   ├── src-tauri/
│   │   │   ├── src/
│   │   │   │   ├── state.rs             # tracking state machine
│   │   │   │   ├── sampler/             # idle.rs, focus.rs, input.rs (per-OS modules)
│   │   │   │   ├── aggregate.rs         # 1-minute buckets
│   │   │   │   ├── store.rs             # SQLCipher queue
│   │   │   │   ├── sync.rs
│   │   │   │   ├── screenshot.rs        # capture + blur + grace window
│   │   │   │   ├── integrity.rs
│   │   │   │   └── tray.rs
│   │   │   ├── tauri.conf.json
│   │   │   └── installers/              # WiX (MSI), pkg scripts, MDM profiles (PPPC)
│   │   ├── src/                         # on-demand webview UI (React + @repo/ui)
│   │   └── browser-extension/           # optional domain reporter (Chrome/Edge/Firefox)
│   │
│   └── worker/                          # Node · pgmq consumers + cron handlers
│       └── src/jobs/                    # webhooks, notifications, timesheet-recompute,
│                                        # payroll-export, retention-purge, rollups, ai-*
│
├── services/
│   └── solver/                          # Phase 4 · Python + OR-Tools CP-SAT (FastAPI, gRPC later)
│
├── packages/
│   ├── tokens/                          # design tokens: DTCG JSON → CSS vars, Tailwind theme, RN theme
│   ├── ui/                              # web components (shadcn/Base UI), Storybook stories, a11y tests
│   ├── ui-native/                       # React Native components sharing tokens + API shape with ui
│   ├── icons/                           # icon set + RTL-mirroring metadata
│   ├── i18n/                            # ICU catalogs he/en, formatters (dates, numbers, Hebrew calendar), dir()
│   ├── contracts/                       # zod schemas: commands, API payloads, events → OpenAPI
│   ├── core/                            # PURE domain logic: overtime, breaks, rest rules, rounding,
│   │                                    # scheduling conflicts, labor cost, accruals, permissions
│   ├── db/                              # Kysely types (generated), withUserTx, query helpers
│   ├── api-client/                      # typed client for /api/app used by mobile + desktop
│   ├── sync/                            # outbox + idempotent replay shared by mobile & desktop UI
│   ├── ai/                              # gateway, provider adapters, prompts/, tools/, evals/
│   ├── auth/                            # session helpers, device enrollment, permission checks (client side)
│   ├── analytics/                       # PostHog wrapper, typed event catalog (no PII)
│   ├── testing/                         # factories, seed builders, RLS test helpers
│   └── config/                          # eslint, tsconfig, prettier, tailwind presets
│
├── supabase/
│   ├── migrations/                      # SQL source of truth (NNN_name.sql)
│   ├── tests/                           # pgTAP: rls/, functions/, triggers/
│   ├── seed/                            # demo company (he + en), deterministic
│   └── config.toml
│
├── docs/
│   ├── platform/                        # these Phase 0 docs
│   ├── adr/                             # architecture decision records
│   ├── api/                             # generated OpenAPI + guides
│   ├── privacy/                         # monitoring notice templates, DPIA template, data map
│   └── runbooks/                        # incidents, restore, key rotation
│
├── tooling/
│   ├── scripts/                         # setup.sh, gen-types, check-contrast, perf budgets
│   └── github/                          # reusable workflow pieces
├── .github/workflows/                   # ci.yml, mobile.yml (EAS), desktop.yml (Tauri matrix), deploy.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Dependency rules (enforced with eslint `import/no-restricted-paths` + `dependency-cruiser`)

```
apps/*  ──►  packages/*            (never app → app)
ui, ui-native ──► tokens, icons, i18n
core      ──► contracts            (no React, no I/O, no Supabase: pure functions only)
db        ──► contracts
ai        ──► core, contracts      (tools wrap commands)
api-client──► contracts
```

`@repo/core` staying pure is what lets the same overtime calculation run
on the server (the truth), in the web scheduler (live cost preview) and on
the phone (instant "you're in overtime" hint).
