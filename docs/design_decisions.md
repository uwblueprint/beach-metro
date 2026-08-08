# Design Decisions — Living Log

Running log of locked design decisions, kept out of the individual specs so they
stay lean. When a decision is locked (client call, review round, team discussion),
append it here with a one-line rationale and update the docs that implement it.

## Finances data layer (2026-08)

Wiring the finances and overview screens. **Where the design and the backend
disagreed, the design won**: the design engineers are closer to how the office
works, so the backend bent. All six have since been confirmed by design; the
answers and what each one changed are recorded in
[`finances_pending_decisions.md`](finances_pending_decisions.md).

- **Locking is per issue, implemented as a bulk freeze.** Settled: locking means
  the numbers are settled so a later route edit cannot move them, *not* that anyone
  has been paid. Rather than add a `locked` column, `POST /api/issues/{id}/lock`
  freezes every unpaid cell and the grid derives `locked` from them, so the
  per-cell endpoints still work underneath.
- ~~**Paid can only be toggled once the issue is closed.**~~ **Superseded.**
  Settled: tick paid whenever the issue is open. The office ticks people off as
  they are paid and closes afterwards.
- **A closed issue or archived year settles its payments.** Settled, and this
  *reverses* the earlier "an unpaid cell stays editable while closed" rule. Every
  payout mutation and issue lock/unlock now goes through `assertIssueEditable`.
  `POST /api/issues/{id}/reopen` is the way back.
- **Paid has no untick, and paid is final.** Settled and deliberate. The UI hook
  was removed. `unmark-paid` survives as an admin-only correction for a mis-tick
  and must not be wired into the UI without design agreeing.
- **A cell comment is its own column, separate from the override reason.** Settled:
  two different things. A comment must survive on a cell that was never overridden,
  and clearing an override must not delete a note the office left itself.
- **One person may cover several captains.** Settled: nothing caps it, and the
  overview lists them all rather than dropping any. *Open:* how the grid should
  show more than one covered captain per row — design is exploring it, no backend
  work expected either way.
- **Transfer is deleted.** Settled: recording a substitute replaced it. The service
  function, endpoint, schema and test are gone. A substitute keeps the cell on its
  own captain and re-attributes the payment, which is what makes substitute pay
  reportable at all.
- **A financial year can be renamed but not re-dated.** New:
  `PATCH /api/financial-years/{id}` takes a name only. The start date fixes the
  reporting quarters, so moving it would silently reshuffle the overview.
- **The seed now creates issues, deliveries and payout cells.** It previously
  stopped at the financial year so issue creation would be exercised through the
  API, which left both screens rendering empty. A test checks the seeded amounts
  against the real formula, so the seed cannot drift into claiming numbers the app
  would never produce.

## Members data layer (2026-07)

Decisions made wiring the members screen to the backend.

- ~~**Notes are one free-form string per person.**~~ **Superseded.** Notes are a real
  entity again: `member_notes`, one row per note, each with its own `created_at`,
  editable and deletable individually. Reason: the members-page design that came
  through Figma and review is a full multi-note UI (an add button, a date per note,
  per-note edit and delete), so a single string cannot back the screen. The original
  decision dropped timestamps as "unneeded for MVP"; the design says otherwise.
  Parent is two nullable FKs (`volunteer_id` / `captain_id`) with a check that
  exactly one is set, so Postgres keeps referential integrity and cascades on
  delete — a polymorphic `parent_type`/`parent_id` pair would silently orphan rows.
- **`VolunteerRoute.notes` stays a plain string.** Deliberately inconsistent with
  people, for now: the routes page (#17) edits it as one field and changing it would
  conflict for no gain. `member_notes` can take a `route_id` later. Tracked in
  `open_items.md` so the inconsistency reads as a choice, not an oversight.
- **A note supplied at create becomes the person's first note.** `POST /api/volunteers`
  and `/api/captains` keep their `note` field. `PATCH` dropped it: a single field on
  an update could not say *which* note it meant.
- **Notes are not on the list or summary responses.** They are fetched per person
  from their own endpoint, so the members list payload stays small and the notes list
  has one source of truth.
- **The members list is a unified read; details stay typed per role.**
  `GET /api/members` merges volunteers and captains into one flat row (with `role`)
  server-side, because the merge is testable there and the "Showing X of Y" count
  then reflects a real query. Detail views stay on `/api/volunteers/{id}` and
  `/api/captains/{id}`, whose shapes genuinely differ.
- **A captain's territory is described by its contents**, e.g. "4 volunteers, 2 drops".
  Territories have no name or number in the schema, so `Territory 1` (which the stub
  faked from array position) is not reproducible. Open question in `open_items.md` if
  the office really refers to them by number.
- **Route labels are derived, not stored**: `"Queen St E · 2038 → 2190"`, built from
  the two endpoint addresses with the route's own street name stripped from each.
  Handles both endpoint shapes in the data — house addresses and intersections
  (`"Queen St E & Willow Ave"` → `"Willow Ave"`) — and falls back to the bare street
  name when an endpoint has not been geocoded.
- **Commercial drops gain a nullable `standing_bundles`.** PROVISIONAL, pending client
  confirmation: `open_items.md` had the per-drop count as unmodelled because nobody
  confirmed drops carry an expected quantity. Nullable so "unknown" stays distinct
  from "zero" and the panel shows an empty state rather than a misleading 0. The
  design's per-drop *date* is deliberately not modelled — a drop is an address, not
  an event, so a date needs per-issue drop deliveries that do not exist.

## Backend implementation interpretations (feat/backend-api, 2026-07)

Calls made where the specs were silent; each is covered by a test (see
[`backend_testing.md`](backend_testing.md)). Flag any that read wrong.

- **No pagination.** List endpoints return everything (filters/sort intact);
  `{ data: T[] }` stays forwards-compatible with cursors. Locked for MVP row counts.
- **Transfer = paired overrides.** Recipient overridden up by the source's
  effective amount, source overridden to 0, auto reasons both ways; undo by
  clearing overrides. Requires an existing recipient cell (a captain added
  after issue creation has none), rejects self/zero-amount/paid targets.
- **Live calc skips paid cells** — and closed issues entirely. So a reopen
  resumes recalculation for unpaid cells only; paid cells stay frozen.
- **Missed clamps at zero** per route (a route can't bill negative), and
  calculated amounts round to cents (half-up). Exact rounding is still an
  [OPEN] client item.
- **Payout cells = captains active at issue creation**; the year table's
  columns derive from the cells that exist (no snapshot table).
- **Pay-config edits recalc every open issue** immediately (cadence excluded —
  informational only).
- **Deliveries of routes that later lose their volunteer** (detach/soft delete)
  roll up to no captain while the issue is open; close freezes whatever is
  current. The transfer action is the correction tool.
- **Issue name/date stay editable after close** (metadata, not a locked value).
- **Archived years refuse new issues** (409).
- **Route endpoint addresses are stored as `residential`**; `commercial` is
  reserved for drops. Old address rows are left in place when an entity
  re-points (endpoints can be shared; orphans are harmless).
- **Retired volunteers/captains can't take routes/territories** (409), and
  vacation windows use inclusive bounds.
- **Reactivation isn't exposed** — the people flow allows Retired → Active but
  the API spec never defined it; recorded in `open_items.md`.
- **Soft-deleted routes 404** on direct fetch and are filtered from every list;
  the row (and its deliveries) remain for history.

## Issue lifecycle & finance (locked 2026-06, review round with client)

- **No Draft issue state.** Issues are created Open and calculations start
  immediately; the lifecycle is Open → Closed. (`flows/finances_flow.md`,
  `flows/delivery_recording_flow.md`, `IssueStatus` in the data model.)
- **Closing is always manual.** Adding a new issue never auto-closes a prior one;
  multiple issues can be Open at the same time, each attached to the live formula
  (identical inputs may show the same number in multiple cells).
- **Paid locks the cell.** Only unpaid cells are editable: closing detaches a
  payout from the live calculation, and marking it paid locks it from any further
  edits (unmark to edit again).
- ~~**No captain substitutes.**~~ **Superseded (client review, July 2026).**
  Substitutes are real: a captain can be recorded as covering one issue for
  another, and the payment is the substitute's. `captain_payouts` carries
  `substitute_captain_id`; assign/clear via `POST`/`DELETE` on
  `/api/payouts/{id}/substitute`. Substitutes must be existing captains (no
  guest records). The transfer action stays for genuine money reallocation, but
  it is no longer the substitute mechanism — it recorded the substitution only
  as free text in `override_reason`, which made substitute pay impossible to
  total or filter on, and the overview needs both.
- **No substitute deliverer.** Informal route coverage (e.g. a neighbour) is not
  recorded on `RouteDelivery`.
- **Reopen stays.** A closed issue can be reopened as a guarded admin correction;
  it reopens finance and delivery together.

## Post-design reconciliation (client review, July 2026)

- **Freeze is separate from paid.** Bundling day locks a captain's calculated
  amount so later route or carrier edits cannot move it, which is not the same
  as having paid them. `captain_payouts.frozen_amount` holds the snapshot;
  precedence is override → frozen → calculated. Freezing does not require the
  issue to be closed, and a frozen-but-unpaid cell can be unfrozen.
  Creating an issue still never closes another one — the manual freeze button
  replaces the auto-close idea that was considered and rejected.
- **The financial year has an explicit start month.** It begins whenever the
  office starts it, not in January, so `financial_years.start_date` is required
  and the overview's quarter filters are relative to it (a March year has
  Q1 = March–May).
- **Reimbursement history is derived, not stored.** A captain's payment history
  is their payout cells; there is no separate reimbursement entity. This keeps
  the earlier decision that replaced `Reimbursement` with
  `FinancialYear → Issue → CaptainPayout`.

## Pre-code reconciliation (locked 2026-06)

- ~~**`Note` entity removed** in favour of a plain `notes?: string` field on Volunteer /
  Captain / VolunteerRoute (the flows only need free-form notes).~~
  **Superseded for people (members data layer, 2026-07)** — see below. Still true for
  `VolunteerRoute`, whose `notes` stays a plain string.
- **`RouteBundle` / `RouteDelivery.bundles[]` kept** (reversed after review — PR #10):
  we persist each bundle's paper count, not just a count. `bundles` is an embedded
  JSONB array seeded by the greedy split and hand-editable; `bundleCount` is derived
  (`bundles.length`); invariant: the bundles sum to `paperCount`, and editing
  `paperCount` reseeds the split unless the bundles were set manually. Rationale: the
  office needs the exact bundle breakdown per issue (to physically make up the bundles
  and preserve irregular splits), which a bare count can't reconstruct.
- **`VolunteerRoute.deletedAt`** added — routes are **soft-deleted** (hidden, row
  retained) so historical `RouteDelivery` records still resolve.
- **House count** is manual for MVP (`houseCount`); auto-calc via Toronto Open Data +
  PostGIS is post-MVP.

## Data model — changes from the ideation board

- `Reimbursement` (flat amount/paid) **replaced** by `FinancialYear` → `Issue` →
  `CaptainPayout`, matching the finance flow.
- Added `RouteDelivery` (per route per issue actuals) — the core of the delivery flow.
- `PayCadence`: `"biweekly" | "monthly"` → `"weekly" | "biweekly"` →
  **reverted to `"biweekly" | "monthly"`** (client review, July 2026: nobody is
  paid weekly; monthly is real). Migration `20260729000000` remaps any
  `weekly` row to `biweekly`.
- `Captain.address` **removed** (captains have no address); pay config (type, rate,
  cadence) **moved onto the captain** (was split across territory/captain).
- `Captain.territoryIds[]` → **1:1** (the FK lives on `CaptainTerritory.assignedCaptainId`);
  `Captain.reimbursementIds[]` dropped.
- `VolunteerRoute.territoryId` **removed** — the captain link is indirect
  (route → volunteer → captain → territory); `assignedVolunteerId` made optional;
  `streetName` and `houseCount` added.
- `CaptainTerritory`: `payType`/`payRate` moved to `Captain`. Its volunteers and
  commercial drops attach via inverse FKs (`Volunteer.captainTerritoryId` and
  `Address.territoryId`), not id arrays on the territory.
- `Volunteer.LuckyVolunteerDate` dropped (post-MVP volunteer credit); vacation-window
  fields added; retirement modeled as a stored timestamp.
- `GoogleMapsLocation` PLACEHOLDER **filled in** (place_id durable, lat/lng 30-day cache).
- `RouteSide` gains `"BOTH"`.

## Google Maps integration

- **Stay inside the free tiers.** Geocode the ~200 addresses once, store the
  durable `place_id` indefinitely, and treat lat/lng as a ≤30-day cache refreshed
  at ~25 days. (Research doc §1.)
- **Only volunteers have addresses.** Captains carry no address, so the Maps
  integration (geocoding, validation, PII disclosure) touches volunteer and
  route/commercial-drop addresses only.
