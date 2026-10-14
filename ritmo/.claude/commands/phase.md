---
description: Run one build phase of Ritmo as defined in docs/PRODUCT_SPEC.md
argument-hint: <phase number 0-5>
---
Run Phase $ARGUMENTS of Ritmo.

1. Re-read `CLAUDE.md` and the Phase $ARGUMENTS section of `docs/PRODUCT_SPEC.md`. For any UI in this phase, read `docs/brand/BRAND.md`, the relevant `docs/brand/components/*.md`, and the matching reference screen in `docs/screens/` (see `docs/screens/SCREENS.md`).
2. Show me a short plan first: scope, files/packages you will create or change, data model changes, risks, and any question whose answer would change the plan. Wait for my answer if you asked one.
3. Implement. Use design tokens only, logical CSS properties, LTR-isolated numbers/times inside Hebrew, light + dark themes.
4. Verify against the Definition of Done in the spec: run the tests, check RTL and LTR, light and dark, keyboard and focus, loading/empty/error states, permissions.
5. Stop and report: what was built, how to run and test it, known limitations, and what Phase $ARGUMENTS+1 will cover. Do not start the next phase.
