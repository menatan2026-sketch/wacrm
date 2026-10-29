# Contributing

## Ground rules

- **Server-side authorization.** Every domain service checks `can(actor, permission, scope)` itself;
  pages and navigation only mirror it. Add an integration test when you add a permission.
- **No user-visible literals.** Text, accessible names and placeholders come from
  `packages/i18n/messages/{he,en,ru}`. Add keys to all three locales; `pnpm i18n:check` must pass.
  ESLint rejects literals in UI code.
- **RTL first.** Use logical utilities (`ms-/me-/ps-/pe-/start-/end-/text-start`); ESLint rejects
  physical ones. Wrap LTR values inside RTL text with `isolate()` or `<Ltr>`.
- **Money** is integer minor units; VAT, prices, lead times and supplier ids come from data, never code.
- **Append-only records** (quote snapshots, audit events, status history, payment transactions,
  routing decisions) are never updated; the database rejects it.
- **Every automation has a manual path**, and manual actions record a reason in the audit log.
- **No secrets in the repository.** No card data anywhere. CAD files are private.
- **Migrations** are reviewed SQL in `packages/db/migrations`; never edit one that has shipped.

## Workflow

1. Branch from the main branch. Keep each change focused.
2. Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm i18n:check && pnpm test` locally.
   For UI changes, also run `pnpm test:e2e` (or at least one RTL and one mobile project) and look at
   the Hebrew layout.
3. A bug fix ships with a test that fails without the fix.
4. Open a pull request using the template; CI must be green before review.
