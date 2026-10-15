#!/usr/bin/env bash
# Vercel build: bring the database schema up to date, make sure the demo
# company exists, then build the web app. Runs from apps/web.
set -euo pipefail
if [ -n "${ADMIN_DATABASE_URL:-}" ]; then
  pnpm --filter @ritmo/db migrate
  pnpm --filter @ritmo/db seed -- --if-missing
else
  echo "ADMIN_DATABASE_URL not set; skipping migrations"
fi
next build
