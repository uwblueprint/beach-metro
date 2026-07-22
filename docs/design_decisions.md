# Design Decisions — Living Log

Running log of locked design decisions, kept out of the individual specs so they
stay lean. When a decision is locked (client call, review round, team discussion),
append it here with a one-line rationale and update the docs that implement it.

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
- **No captain substitutes.** Replaced by a reallocate/transfer feature that moves
  a cell's amount to another captain for that issue (original zeroed, finance-only;
  routes/territory untouched). No temp-captain creation, no substitute modeling in
  the schema. (Finance flow §4g; payout `transfer` action in the API spec.)
- **No substitute deliverer.** Informal route coverage (e.g. a neighbour) is not
  recorded on `RouteDelivery`.
- **Reopen stays.** A closed issue can be reopened as a guarded admin correction;
  it reopens finance and delivery together.

## Pre-code reconciliation (locked 2026-06)

- **`Note` entity removed** in favour of a plain `notes?: string` field on Volunteer /
  Captain / VolunteerRoute (the flows only need free-form notes).
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
- `PayCadence`: `"biweekly" | "monthly"` → **`"weekly" | "biweekly"`**.
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
