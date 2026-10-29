# 0007 — next-intl, locale-prefixed routes, logical CSS for RTL

- **Status:** Accepted (planning)
- **Date:** 2026-10-29
- **Related:** LOCALIZATION_GLOSSARY.md

## Context
Hebrew (RTL), English and Russian from day one. Language must never switch unexpectedly. SEO matters for the marketing/customer pages.

## Decision
next-intl with ICU messages and `/{locale}/` path prefixes. Detection: explicit choice > URL > Accept-Language > `he`, redirecting only on `/`. Namespaced JSON catalogs with CI completeness and ICU argument checks. Lint bans literal strings and physical CSS direction utilities. `Intl` formatters for all money, number and date values.

## Consequences
Every route lives under `[locale]`. hreflang alternates for public pages. Emails are rendered per the recipient's preferred locale.
