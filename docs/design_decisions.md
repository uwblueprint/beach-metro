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
