#!/usr/bin/env bash
# Database operations against the hosted Supabase project.
# Reads SUPABASE_DB_URL (and friends) from .env.local — see .env.example.
#
#   pnpm db:push   — apply supabase/migrations to the hosted DB
#   pnpm db:seed   — load supabase/seed.sql
#   pnpm db:types  — regenerate types/database.ts from the live schema
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.local ]]; then
  echo "error: .env.local not found (copy .env.example and fill it in)" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env.local
set +a

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "error: SUPABASE_DB_URL is empty in .env.local (Dashboard → Connect → Session pooler URI)" >&2
  exit 1
fi

case "${1:-}" in
  push)
    supabase db push --db-url "$SUPABASE_DB_URL"
    ;;
  seed)
    node --env-file=.env.local scripts/seed.ts
    ;;
  types)
    supabase gen types typescript --db-url "$SUPABASE_DB_URL" --schema public > types/database.ts
    pnpm exec prettier --write types/database.ts >/dev/null
    echo "wrote types/database.ts"
    ;;
  *)
    echo "usage: scripts/db.sh {push|seed|types}" >&2
    exit 1
    ;;
esac
