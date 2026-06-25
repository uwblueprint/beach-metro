# supabase

Local Supabase configuration and database migrations live here.

The Supabase CLI and a real project are **not wired up yet** (deferred to Phase 1,
when an account exists). At that point:

1. Add the CLI: `pnpm add -D supabase` (then approve its build script).
2. `pnpm exec supabase init` generates `config.toml` here.
3. Author migrations under `supabase/migrations/` from
   [`docs/schema/data_model.md`](../docs/schema/data_model.md).
4. `pnpm exec supabase start` boots the local stack (Docker);
   `pnpm exec supabase db reset` applies migrations + `seed.sql`.

Until then, the app talks to Supabase only through the factory clients in
`lib/supabase/` (which read env vars at call time, so the build does not need them).
