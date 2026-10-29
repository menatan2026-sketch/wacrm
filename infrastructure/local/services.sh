#!/usr/bin/env bash
# Runs PostgreSQL 16 and Redis 7 natively under ./.local for environments
# without Docker (CI runners, cloud sandboxes). With Docker available, prefer:
#   docker compose -f infrastructure/docker/docker-compose.yml up -d
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$ROOT/.local"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PGPORT="${PGPORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6379}"
mkdir -p "$DATA"
# PostgreSQL refuses to run as root; drop to the postgres user when needed.
PG_DATA="$DATA/pg"
if [ "$(id -u)" = "0" ]; then
  PG_DATA="${PG_DATA_ROOT:-/var/tmp/mfg-pg}"
  pgrun() { runuser -u postgres -- "$@"; }
else
  pgrun() { "$@"; }
fi

start() {
  if [ ! -d "$PG_DATA" ]; then
    mkdir -p "$PG_DATA" && [ "$(id -u)" = "0" ] && chown postgres "$PG_DATA"
    pgrun "$PGBIN/initdb" -D "$PG_DATA" -U mfg --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
  fi
  if ! pgrun "$PGBIN/pg_ctl" -D "$PG_DATA" status >/dev/null 2>&1; then
    pgrun "$PGBIN/pg_ctl" -D "$PG_DATA" -l "$PG_DATA/server.log" -o "-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1" -w start >/dev/null
  fi
  for db in mfg mfg_test; do
    "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U mfg -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
      || "$PGBIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U mfg "$db"
  done
  if ! redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    redis-server --port "$REDIS_PORT" --dir "$DATA" --daemonize yes --pidfile "$DATA/redis.pid" --logfile "$DATA/redis.log" --save "" >/dev/null
  fi
  echo "postgres://mfg@127.0.0.1:$PGPORT/mfg  redis://127.0.0.1:$REDIS_PORT"
}

stop() {
  pgrun "$PGBIN/pg_ctl" -D "$PG_DATA" stop -m fast >/dev/null 2>&1 || true
  if [ -f "$DATA/redis.pid" ]; then kill "$(cat "$DATA/redis.pid")" 2>/dev/null || true; fi
  echo "stopped"
}

"${1:-start}"
