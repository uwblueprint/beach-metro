# Design Decisions — Living Log

Running log of locked design decisions, kept out of the individual specs so they
stay lean. When a decision is locked (client call, review round, team discussion),
append it here with a one-line rationale and update the docs that implement it.

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
