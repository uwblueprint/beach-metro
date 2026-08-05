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
- **Commercial-drop standing counts.** Now modelled **provisionally** as a nullable
  `addresses.standing_bundles`, because the member panel's Territory Drops section
  shows a count. Nullable so "unknown" stays distinct from zero. **Still needs the
  client to confirm** that a commercial drop really carries an expected per-issue
  quantity; if not, drop the column. → `supabase/migrations/20260730000001_*.sql`.
- **Territory Drops has no date.** The design shows a date per drop, but a commercial
  drop is an address, not an event, so there is nothing to date. A real date needs
  per-issue drop deliveries (the route-delivery equivalent for drops), which do not
  exist. The panel renders without a date. Decide whether drops need per-issue
  actuals at all.
- **Territories have no name or number.** The members table describes a captain's
  territory by its contents ("4 volunteers, 2 drops") because there is nothing else
  to show. If the office refers to territories by number, that needs a schema field
  and a migration. → `lib/services/members.ts`.

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
- **House-count auto-calculation.** Shipped as an advisory suggestion:
  `GET /api/routes/{id}/suggested-house-count` counts Toronto Open Data address
  points between a route's two endpoints, filtered to its side. Computed on read
  and never stored, so there is no freshness state to track and the
  `Pending/Ready/Stale/Manual` machine in the route flow §3b was deliberately
  not built. PostGIS turned out to be unnecessary — the address points carry
  their own centreline side, so the match is a house-number range plus a
  bounding box. Reference data is loaded by `pnpm load-addresses`.
  Still open: **no ground truth.** Accuracy is currently asserted only by
  self-consistency (one-sided routes must be all-odd or all-even). Real counts
  for 15–20 routes would let us state an error bar; until then the number stays
  a suggestion a human accepts, and apartments count as one delivery because the
  source has one point per building.
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

## Surfaced by the members data layer (2026-07)

- **The seed is not idempotent, and there is no reset path.** `supabase/seed.sql` is
  insert-only, so `pnpm db:seed` fails against a database that already has rows. The
  only reset tool was `POST /api/playground/reset`, which was removed with the
  playground (it truncated every table). Anyone needing a clean database currently
  has to truncate by hand. Options: make the seed idempotent with `on conflict do
  nothing`, or add a `pnpm db:reset` script. → `supabase/seed.sql`, `scripts/db.sh`.
- **Migration history had drifted from the schema.** `20260729000000`
  (finance reconciliation) was applied to the hosted project without being recorded
  in `supabase_migrations.schema_migrations`, so `supabase db push` refused to run.
  Recorded it retroactively after verifying its columns really existed. Separately,
  `20260728000000` (Toronto address points, on the unmerged #23) IS in the remote
  history with no local file, which will keep `db push` unhappy until #23 merges.
  Lesson: apply migrations with `pnpm db:push`, not by hand, or the history lies.
- **Integration tests share one mutable database.** Suites run in parallel against
  the hosted project, so any assertion comparing two independent reads is flaky, and
  a test that throws before its cleanup leaks rows into everyone's `/members`. Both
  happened while writing this. The members suite now asserts only on single-read
  properties or its own fixture rows, and its `afterAll` sweeps strays by a
  suite-specific marker (`ITMembers`, deliberately not the plain `IT` the other suite
  uses — sweeping that deleted rows the other suite was still using). **This is the
  concrete argument for a separate CI database** before adding
  `SUPABASE_DB_URL` / `SUPABASE_SECRET_KEY` as Actions secrets.
- **No reactivation, but retirement is now reachable from the UI.** The members table
  can retire someone; the people flow allows Retired → Active but no endpoint exists
  (see above). The row action confirms first and disables itself for someone already
  retired, but an accidental retirement currently needs a database edit to undo.
  Worth closing before this ships to the office.
- **Add Member is still a no-op.** The button has no form and no design. What it
  needs is written up in the PR description: volunteers need address validation
  through `POST /api/addresses/validate`; captains need pay type, rate and cadence,
  and creating one also creates their territory.
- **Status is not surfaced in the table.** `GET /api/members` returns `status` and
  `needsAttention` for every row, and the side panel shows status, but the table's
  pills filter by role only. The people flow §4b asks for status filtering. Needs a
  design decision (column, second pill row, or badge).

## Structural follow-ups (backend review)

- **API response contract has no single source of truth.** Request shapes are
  double-sourced (prose in [`api/api_spec.md`](api/api_spec.md) + Zod in
  `lib/validation/`), but *response* shapes exist only as hand-written interfaces
  inside each service (`PayoutSummary`, `CaptainSummary`, …) and aren't in the
  spec (e.g. `calculatedAmount`/`effectiveAmount` appear nowhere in it). When the
  frontend consumes them it re-declares them — a third copy to drift. Consider a
  server-agnostic `types/api.ts` both services return and the client imports.
  → `types/db.ts` header, all `lib/services/*.ts` return types.
- **Money is JS floats.** `Math.round(x*100)/100` against `numeric(10,2)`; consider
  integer cents / a decimal at the boundary. → `lib/services/derive.ts`,
  `lib/services/shared.ts` (`coerce*Numerics`). Note the numeric string→number
  coercion itself is now centralized there; this item is only about the float
  representation of money, which remains.
- **Transfer isn't atomic.** `transferPayoutAmount` does two sequential writes
  (source-first, so a partial failure underpays). For a money path, move to a
  Postgres function/RPC for a real transaction (`postgres` is already a dep).
  → `lib/services/payouts.ts`.
- **Payout breakdown vs stored amount can disagree.** `getPayout`'s per-route
  breakdown is rebuilt from *current* territory membership, but the amount is
  stored — for a paid (frozen) cell they can differ. Snapshot the breakdown at
  freeze, or label it a current estimate. → `lib/services/payouts.ts`.
- **`recalc` reads whole tables.** `recalculateIssue` fetches all
  routes/volunteers/territories/captains per call; `recalculateOpenIssues` repeats
  it per open issue. O(all data) per edit — fine now; scope the reads or use a SQL
  view/function for scale. → `lib/services/recalc.ts`.
- **The numeric-as-string premise didn't reproduce.** The `coerce*Numerics` helpers
  in `lib/services/shared.ts` were added on the stated grounds that "PostgREST
  serializes `numeric` columns as JSON strings." Probing the live project directly
  (`GET /rest/v1/captains?select=pay_rate`) returns **unquoted JSON numbers**
  (`[{"pay_rate":1.25},{"pay_rate":2.00}]`), i.e. `typeof === "number"`, so the
  helpers are currently no-ops rather than fixes. Left in place as harmless
  insurance and deliberately not modified — @kenzysoror to confirm what they
  observed (a different PostgREST/supabase-js version, or a column type other than
  `numeric(10,2)`, would both explain it) and then either keep them with a
  corrected comment or drop them. Consequence if the premise *is* ever true for
  some deployment: `lib/services/overview.ts` is the one reader that never got a
  coercer, and its `+=` accumulators would produce `NaN` past the first row.
  → `lib/services/shared.ts`, `lib/services/overview.ts`.
