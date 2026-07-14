# Open Items — Still To Be Calculated / Decided

Everything marked `[OPEN]` in the specs plus what the backend build surfaced.
Each entry says what's missing, who unblocks it, and where it lands in code.
Remove entries as they're resolved (and record the decision in
[`design_decisions.md`](design_decisions.md)).

## Calculations awaiting client confirmation

- **Override rounding / validation rules.** Overrides accept any non-negative
  amount today; the calculated side rounds to cents (half-up via
  `Math.round`). Whether the client wants whole-dollar rounding, caps, or
  validation on overrides is unconfirmed. → `lib/services/derive.ts`
  (`calculatedAmount`), `lib/validation/finance.ts` (`overridePayout`).
- **Historical data migration mechanics.** Past years exist in cloud-backup
  spreadsheets; how they're entered (manual re-keying vs a one-off import
  script) and how much history matters is undecided. Nothing is built.
- **Papers-to-order allowance.** The office may order spare/office copies on
  top of the route sum. Removed from MVP scope in review; the endpoint returns
  the bare route sum. → `lib/services/issues.ts` (`papersToOrder`).
- **Reporting dashboard metrics.** Blocked on Susan's finalized list; the
  read-only aggregate endpoints don't exist yet. Payout cost figures will read
  from `captain_payouts`.
- **Commercial-drop standing counts.** Whether commercial drops carry expected
  per-drop counts (like routes carry `papers`) — not modeled.

## Product/tech decisions still open

- **Google Maps go-live.** Real `GOOGLE_MAPS_SERVER_KEY` +
  `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, a `lib/maps/google.ts` implementing
  `MapsProvider` (Address Validation, Geocoding, Route Matrix), key
  restrictions + per-day quota caps in Cloud Console. Everything runs on the
  deterministic fake until then.
- **Coordinate-refresh scheduling.** `pnpm refresh-coords` implements the
  25-day refresh / 30-day evict pass but nothing schedules it (Vercel cron is
  the natural home once deployed).
- **Places Autocomplete.** Nice-to-have for address entry; billed SKU;
  undecided (research doc §8.2).
- **House-count auto-calculation.** Manual entry for MVP (locked); Toronto
  Open Data + PostGIS ingestion is post-MVP. `house_count_override` exists in
  the schema but only becomes meaningful then.
- **Volunteer/captain reactivation.** The people-flow state machine allows
  Retired → Active ("clear retirement") but the API spec never defined an
  endpoint, so none is implemented. Decide whether reactivation ships and add
  `POST /{id}/reactivate` (or PATCH of `retiredAt`) when it does.
- **Auth roles.** Both admins have identical permissions (locked for MVP);
  the `AdminRole` concept remains SUBJECT TO CHANGE if role gating ever lands.

## Operational follow-ups

- **Disable legacy API keys.** A real `sb_secret_...` key is now in use
  (verified against the auth admin API), but the legacy `service_role` JWT that
  leaked into a chat transcript stays valid until someone clicks
  **Disable legacy API keys** in the dashboard (API Keys page). One click, do it.
- ~~Database password~~ — **resolved.** Schema pushed, seed loaded (`pnpm db:push`
  / `db:seed`), and the full suite (46 unit + 8 live integration) plus
  `pnpm smoke` all pass against the hosted project. Smoke admin
  (`smoke-admin@example.com`) is live.
- **CI secrets.** Integration tests self-skip in CI until
  `SUPABASE_DB_URL` + `SUPABASE_SECRET_KEY` are added as GitHub Actions
  secrets (decide whether CI should touch the hosted DB at all).
- **`pnpm db:types` fails locally.** `--db-url` shells out to Docker for
  introspection (none running here); `--project-id` needs an interactive
  `supabase login`. Types were instead hand-verified via a direct
  `information_schema` query against the live schema — zero drift from
  `types/db.ts` across all 10 tables. Regenerate for real once Docker or a
  login session is available.
- **Idempotency keys / rate limiting.** API-spec open questions; neither is
  implemented (single-office tool, low risk — revisit before any exposure).
