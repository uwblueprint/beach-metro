# supabase

Supabase project config, database migrations, and seed data.

- `config.toml` — CLI project config (`supabase init` output; local ports etc.).
- `migrations/` — SQL migrations, the source of truth for the schema. Authored
  from [`docs/schema/data_model.md`](../docs/schema/data_model.md); every entity,
  enum, FK, index, and invariant trigger lives here.
- `seed.sql` — deterministic sample data (fixed UUIDs) used by the curl smoke
  script and integration tests. Admin users are **not** seeded — create them with
  `pnpm tsx scripts/create-admin.ts <email> <password>`.

## Workflow (hosted project — the current setup)

We develop directly against the hosted Supabase project (no local Docker stack).

1. Put the connection string in `.env.local` as `SUPABASE_DB_URL`
   (Dashboard → Connect → Session pooler URI), plus `SUPABASE_SECRET_KEY`
   (Dashboard → Project Settings → API keys → `sb_secret_...`).
2. Apply migrations: `pnpm db:push` (wraps
   `supabase db push --db-url "$SUPABASE_DB_URL"`).
3. Load seed data: `pnpm db:seed`.
4. Regenerate DB types after schema changes: `pnpm db:types`
   (writes `types/database.ts`).

RLS is enabled on every table with **no policies** on purpose: the browser never
touches these tables. All reads/writes go through server-side route handlers using
the service-role client (`lib/supabase/admin.ts`), which bypasses RLS — RLS here is
defense-in-depth only (see the infra spec).

## If you later want the local stack

`supabase start` (needs Docker running) boots a local instance;
`supabase db reset` applies all migrations + `seed.sql` from scratch. The app can
point at it by swapping the URL/keys in `.env.local`.
