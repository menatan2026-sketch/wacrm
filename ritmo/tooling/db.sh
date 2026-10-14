#!/usr/bin/env bash
# Local development Postgres for Ritmo: a private cluster in .data/pg on port 54329.
# Usage: tooling/db.sh start|stop|status
# Uses the Postgres 16 server binaries already on the machine (no Docker needed).
# Production runs on managed Postgres (Supabase); this is only for local work and CI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/.data/pg"
PORT="${RITMO_PG_PORT:-54329}"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"

if [[ -z "$BIN" || ! -x "$BIN/pg_ctl" ]]; then
  echo "Postgres server binaries not found. Install PostgreSQL 16+ or set PG_BIN." >&2
  exit 1
fi

# Postgres refuses to run as root; when we are root, run it as the postgres system user.
as_pg() {
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}

start() {
  if [[ ! -s "$DATA/PG_VERSION" ]]; then
    mkdir -p "$DATA"
    [[ "$(id -u)" == "0" ]] && chown -R postgres:postgres "$ROOT/.data"
    as_pg "$BIN/initdb" -D "$DATA" -U ritmo --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
    echo "listen_addresses = '127.0.0.1'" >>"$DATA/postgresql.conf"
    echo "unix_socket_directories = '$DATA'" >>"$DATA/postgresql.conf"
    echo "port = $PORT" >>"$DATA/postgresql.conf"
  fi
  if as_pg "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
    echo "Postgres already running on 127.0.0.1:$PORT"
    return
  fi
  as_pg "$BIN/pg_ctl" -D "$DATA" -l "$DATA/server.log" -w start >/dev/null
  echo "Postgres running on 127.0.0.1:$PORT"
}

stop() {
  if as_pg "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
    as_pg "$BIN/pg_ctl" -D "$DATA" -m fast -w stop >/dev/null
    echo "Postgres stopped"
  else
    echo "Postgres is not running"
  fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) as_pg "$BIN/pg_ctl" -D "$DATA" status ;;
  *) echo "usage: $0 start|stop|status" >&2; exit 2 ;;
esac
