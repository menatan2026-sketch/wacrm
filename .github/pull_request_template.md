## What and why

<!-- The problem, and the change that solves it. Link the backlog item or issue. -->

## How it was verified

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm i18n:check && pnpm test`
- [ ] New or changed behaviour has a test (a bug fix has a test that fails without it)
- [ ] UI: checked in Hebrew (RTL) and on a phone width; loading, empty and error states covered
- [ ] E2E (`pnpm test:e2e`) when the order loop or a surface changed

## Checklist

- [ ] Authorization enforced in the domain service, not only the page
- [ ] No user-visible literals; keys added in he, en and ru
- [ ] Manual fallback and audit reason for any new automation or staff action
- [ ] Migration reviewed (if any); no secrets, no card data
- [ ] Docs / ADR / KNOWN_ISSUES updated if behaviour or a limitation changed
