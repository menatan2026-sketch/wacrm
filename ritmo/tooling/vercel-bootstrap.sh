#!/usr/bin/env bash
# Deploys Ritmo to Vercel without a GitHub integration: the deployment holds
# only this script and apps/web/package.json; the build fetches the pinned
# commit from the public repository.
#   install:  bash vercel-bootstrap.sh install
#   build:    bash vercel-bootstrap.sh build
set -euo pipefail
REPO=menatan2026-sketch/wacrm
SHA=${RITMO_SHA:?RITMO_SHA is not set}
ROOT="$(cd ../.. && pwd)"   # runs from ritmo/apps/web
PNPM="npx -y pnpm@10.28.0"

case "${1:-}" in
  install)
    tmp="$(mktemp -d)"
    curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$SHA" | tar -xz -C "$tmp" --strip-components=1
    cp -a "$tmp/ritmo/." "$ROOT/"
    (cd "$ROOT" && $PNPM install --frozen-lockfile)
    ;;
  build)
    if [ -n "${ADMIN_DATABASE_URL:-}" ]; then
      $PNPM --filter @ritmo/db migrate
      $PNPM --filter @ritmo/db seed --if-missing
    fi
    ./node_modules/.bin/next build
    ;;
  *) echo "usage: $0 install|build" >&2; exit 2 ;;
esac
