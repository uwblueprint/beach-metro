# Beach Metro Distribution System
## Product Requirements Document

**Status:** in active design. Schema and route management flow are drafted; remaining flows and screens are being designed.
**Last updated:** v1 of this PRD.
**Owners:** Eric Martin (PM), Kenzy Soror (PL).

---

## 1. Overview

A web-based volunteer and distribution management system for Beach Metro Community News, replacing a fragile 30-page Excel spreadsheet that currently runs the operation. The system manages volunteers, captains, delivery routes, publication runs ("issues"), and captain payments. Built by UW Blueprint over a roughly 4-month engagement starting May 2026.

Primary users are two Beach Metro staff: Melinda (production and distribution manager) handles routes and volunteers; Hope (accounts manager) handles captain payments and financial cycles. The system is internal-facing; volunteers and most captains do not log in.

The single highest-value outcome is replacing the spreadsheet's annual reset and copy-paste-of-formula-results with a structured, time-aware data model where closed publication issues are immutable snapshots, vacant routes are representable, and operational knowledge stops being concentrated in one person's head.

---

## 2. Background

### About Beach Metro

Beach Metro Community News is a non-profit community newspaper publishing continuously since 1972, originally as Ward 9 Community News. Print and digital distribution serves the Beach, East York, and Southwest Scarborough neighbourhoods of Toronto. The organization is funded through advertising revenue, government funding, and community support, and is built on a volunteer-driven model. Around 200 volunteers distribute the paper, organized into 4 captain territories. Issues are published 1 to 3 times per month.

The organization is going through a generational transition. The original creators of the operational system are no longer involved, and current leadership is preparing to pass the torch. Knowledge transfer is an explicit goal of this project, not just a side effect.

### The current system and its pain points

Today's operations run on an interconnected Excel workbook of roughly 30 tabs.

**System fragility.** Formulas span tabs and are not well understood by current staff. Staff keep multiple backup copies because unintended edits risk breaking core functionality. Original formula authors are gone.

**No single source of truth.** Operational data is split across the spreadsheet, three colour-coded Google MyMaps maintained by Melinda, physical maps, and individual knowledge.

**Annual financial reset.** Every January 1st, Hope manually copies formulas to new year tabs, resets paid amounts to zero, and archives the previous year's data. Hours of error-prone copy-paste work.

**Knowledge concentration.** Melinda is the primary holder of operational knowledge: route descriptions, mail-merge label generation, bundle counting conventions, custom Google MyMaps, and the spreadsheet's idiosyncrasies. Replacing her or onboarding a successor would be very difficult today.

**Specific operational pain points.** Route overlap is hard to prevent and harder to detect. Surplus and shortage reporting after a run is manual. Captain payment formulas are partially broken and partially unknown. Substitution tracking (when a different volunteer covers a route) is verbal, not recorded. House counting per street is currently done by Melinda manually on her maps.

### Why now

Beach Metro reached out to UW Blueprint to build a modern replacement. They have funding for basic hosting costs and have committed to migrating existing spreadsheet data during the transition. They have explicitly asked us not to disrupt the community-driven nature of the operation; this is a tooling upgrade, not a process reinvention.

---

## 3. Team and stakeholders

### UW Blueprint team

- **Eric Martin** (ericmartin@uwblueprint.org), Product Manager
- **Kenzy Soror** (kenzysoror@uwblueprint.org), Project Lead
- **Abeer Das**, Developer (backend lead)
- **David Stirling**, Designer
- **Kristen Balisi**, Designer

Project commitment: roughly 40 hours/month per person, over approximately 4 months. Senior team members allocated; targeting completion within one term where typical Blueprint engagements run a full year.

### Beach Metro stakeholders

- **Susan Legge** (susan@beachmetro.com), Publisher and General Manager
- **Melinda Drake** (melinda@beachmetro.com), Production and Distribution Manager. Primary user of the route-management side.
- **Hope Armstrong** (hope@beachmetro.com), Accounts Manager. Primary user of the financial side.
- **Shawn**, IT support (not in regular meetings).

Cadence: weekly Friday client meetings at 2:30 PM, with email updates during non-meeting weeks.

---

## 4. Users

### Melinda (route and volunteer management)

Daily user. Manages the full lifecycle of routes and volunteers. Assigns volunteers to vacant routes. Splits routes when they get too big. Onboards new volunteers and matches them to nearby vacant routes. Handles substitutions when volunteers cancel. Maintains the colour-coded maps that visualize coverage.

### Hope (financial)

Regular but lower-frequency user, mostly around issue close and pay periods. Computes and processes captain payments. Handles the annual financial reset (today, a major pain point). Needs reliable, immutable records of past payments for accounting.

### Captains (4 total)

Potential users, depending on whether captain self-reporting makes it into MVP. Today they receive their bundles from Melinda and report back to her verbally. The system might give them read-only access to their territory and routes, plus a way to self-report missed drops. Decision still open.

### Volunteers (around 200)

Not users of the system in MVP. Volunteer information is managed *about* them, not *by* them. Email and SMS notifications go to them but they do not log in.

### Future / edge

Donors and advertisers may eventually interact with the volunteer credit ledger (nice-to-have); for MVP they are not users.

---

## 5. Goals and non-goals

### Primary objectives

1. Provide a single source of truth for volunteer data, delivery routes, and distribution logistics.
2. Replace the spreadsheet workflow with a structured, reliable system that does not break when edited.
3. Enable Melinda to efficiently onboard, assign, and manage volunteers, including vacant-route triage.
4. Support knowledge transfer as leadership transitions. The system itself should be self-documenting enough that a new admin can learn it.
5. Improve operational efficiency without disrupting the community-driven nature of the organization.

### Non-goals (explicit)

- Volunteer-facing app or portal in MVP.
- Customer or recipient address database. Newspapers are dropped at residences but we do not store recipient data.
- Replacing print or distribution operations themselves. This is a management layer over the existing physical operation.
- Door-to-door delivery routing. Apartments and condos get bundles dropped in the lobby; routes are at the street-segment level, not the household level.
- Replicating every spreadsheet feature 1:1. Some current workarounds will become unnecessary in the new model.
- **Notifications, alerts, badges, toasts, banners, modal warnings, or any other system-driven messaging that isn't explicitly listed as a scoped feature.** Default is to not show one. This rule applies to designers and developers building any flow: if a feature spec doesn't call for a notification, don't add one. "Helpful" touches like change confirmations, FYI banners, spot-check flags, or freshness warnings should not be invented mid-build. When in doubt, leave it out and ask. Notifications are a category that creeps in unscoped, adds maintenance burden, and clutters the UI.

---

## 6. Scope

### MVP

Everything in this list is in scope for the first release.

- **Volunteer management.** Add, edit, retire volunteers. Store name, address, email, phone, notes. Active/inactive derived from start and end dates.
- **Captain management.** Add, edit, retire captains. Store contact info, pay terms, territories, payment cadence. Support Wally-style captains who invoice externally.
- **Route management.** Create, edit, retire routes. Assign and unassign volunteers. House count per route derived from Toronto Open Data with manual override. Vacant routes are first-class. See `route_management_flow_v2.md` for the detailed flow.
- **Captain territories.** Captains own one or more territories; territories contain routes; routes have a captain via the territory link.
- **Publication runs (Issues).** Open and close issues. Each issue is a publication run for which deliveries and payouts are tracked. Closed issues lock their payouts as fixed values.
- **Delivery records per issue.** Track assigned vs completed bundles, missed drops, paper count, drop count per route per issue. Substitution is captured (who actually delivered if not the assigned volunteer).
- **Captain payouts per issue.** Each issue generates one payout per captain. Pay terms (type, rate, quantities, amount) are snapshotted on the payout row, so closing an issue freezes the math. Status tracks paid vs unpaid.
- **Authentication.** Admin login. Password-protected access. Financial sections may require additional protection.
- **Notes system.** Free-form notes attachable to volunteers, routes, and (probably) other entities.
- **Basic reporting.** Lists, counts, simple summaries: how many vacant routes per territory, paid vs unpaid payouts per issue, etc.

### Nice-to-have, post-MVP, in priority order

1. **Interactive map visualization.** Replaces Melinda's three colour-coded Google MyMaps. Shows routes, vacant routes, territory boundaries, with click-to-detail.
2. **Proximity-based vacant route recommendations.** When assigning a new volunteer, suggest the closest vacant routes to their home address (via Google Routes API Compute Route Matrix).
3. **Volunteer credit ledger.** $100/year advertising credit per volunteer, with categories (garage sale, announcement, landscape, trade work) and invoice numbers. Also covers non-volunteer employees who receive credits.
4. **Volunteer onboarding resources / email templates.** Stored in-app, sent at signup.
5. **Email marketing tools.** Blast email to all volunteers for weather updates, appreciation, scheduling changes. CSV export of email lists is the bare minimum; a built-in sender is the richer version.
6. **Bulk operations on routes.** Bulk reassign to a new territory, bulk retire. Highest-value when a captain leaves and their routes need to move.

### Explicitly out

- Drag-and-drop route editing on the map. Technically complex and the Google Maps Drawing Library was deprecated in 2025. If we ever want this, Terra Draw is the recommended replacement.
- Mobile-first or PWA experience. Web-responsive for laptop and mobile browsers is sufficient.
- Customer or recipient address storage.
- Real-time tracking of captains during delivery.
- Inventory management beyond per-route bundle counts.

---

## 7. Core operational concepts

This section is the domain language. Understanding these concepts is required before reading the schema or flows.

### Routes

A **route** is a street segment that one volunteer delivers to. Defined by:
- A street name (e.g. Queen Street East)
- A specific start address (e.g. 100 Queen Street East)
- A specific end address (e.g. 200 Queen Street East)
- A side: North, South, East, West, or Both
- An optional house-number range when split mid-block

A route may live inside one captain territory, and may or may not be currently assigned to a volunteer. Both the territory and the volunteer are optional at creation time; either can be set during the create flow or assigned later via Edit. A route with no assigned volunteer is **vacant** and is the thing Melinda spends the most time managing. A route with no territory is **unaffiliated** and won't appear in captain or territory rollups until a territory is set.

Routes can span multiple intersections if a single volunteer takes a longer stretch, and can be split mid-street by house count. Splitting is not a "smart" operation in the system: if Melinda shrinks a route's range, the leftover houses become orphaned and she must manually create a new route to cover them.

### Captain territories

A **territory** is a geographic area covered by one captain. Today there are 4 territories. Routes belong to exactly one territory; territories belong to exactly one captain. A captain typically covers one territory but can cover multiple if needed (e.g. when filling in for a departed captain).

### Issues (publication runs)

An **issue** is one publication run. The paper goes out 1 to 3 times per month, and each run is an issue. Issues are the backbone of the time/event dimension in the data model: every delivery and every captain payout is associated with exactly one issue.

Issues have an open/closed lifecycle:
- **Open** while editable. Deliveries can be recorded, payouts can be adjusted.
- **Closed** locks the issue. All captain payouts for that issue become immutable snapshots, their amounts frozen. This replaces the spreadsheet's "copy formula values into a static column" workflow.

### Captain payment

Captains are paid per issue. Three payment models exist; each captain has a default:
- **Per bundle.** $X per bundle delivered. Default for most captains. Standard rate is $1/bundle.
- **Per paper.** Total paper count times a rate.
- **Per drop.** Total drop-off count times a rate.

Rate and pay type are stored on the captain (not the territory). Each captain payout snapshots the rate and type at the time the issue closes, so changing a captain's rate later does not retroactively change closed payouts.

**Special cases.**
- **Wally** self-calculates his pay and invoices externally. Modeled as a captain with an `invoicesExternally: true` flag. The system stores his payouts for completeness but does not compute his amounts.
- **Substitutes.** When a different volunteer covers a missed route, the delivery record captures both the route's assigned volunteer and the actual deliverer. Payment goes to the captain whose territory the route is in, regardless.
- **Missed drops.** If a captain misses N bundles out of an assigned total, the missed count is recorded on the delivery and deducted from the payout (e.g. 20 assigned, 3 missed, pay for 17).

Payment cadence varies by captain:
- **Biweekly** (Wally, Surge): aggregate multiple issues per disbursement.
- **Monthly** (all others): pay after the final issue of the month.

In the data model, each issue generates one payout per captain. Aggregating multiple payouts into a single disbursement is a future refinement, not modeled in MVP.

### Bundles

Newspapers arrive from the printer in factory bundles of 25 or 50. Captains rebundle them into custom quantities per volunteer's needs. Bundle notation in the current spreadsheet uses labels like "1 of 3" to indicate sequence when one volunteer's load exceeds a single bundle.

In the model, a route carries a list of `RouteBundle` objects describing its standard make-up. Per-issue actuals (assigned vs completed, paper count, drop count) live on `RouteDelivery`.

### Vacancy and substitution

A route can be vacant (no assigned volunteer). When a volunteer leaves, their routes flip to vacant automatically based on their `endDate`.

A substitute is captured at the delivery level: `RouteDelivery.deliveredByVolunteerId` records who actually delivered. If it differs from the route's `assignedVolunteerId`, that's a substitution.

### Volunteer credit (nice-to-have)

Each volunteer receives a $100/year advertising credit, redeemable for ads in the paper. The current spreadsheet tracks this in a manual ledger with categories like "garage sale," "announcement," "landscape," "trade work." Non-volunteer employees also receive credits, so the credit holder is a loose reference rather than a strict volunteer FK.

---

## 8. Domain model

The full TypeScript schema is in `schema.ts`. This section is the human-readable map.

### Conventions

- Every entity primary key is a `UUID`, except `GoogleMapsLocation` which uses Google's `place_id` string directly.
- Foreign keys are typed as `Entity["id"]` rather than embedding the referenced object.
- Money is stored as `Cents` (integer). $1.00 = 100.
- Dates are ISO-8601 strings: `Timestamp` for datetime, `DateOnly` for date.
- "Active vs inactive" status on people is derived from `startDate` and `endDate`, not stored.

### Entity inventory

**People.**
- `AdminUser`: Melinda and Hope. Has a role (`"finance management" | "route management"`).
- `Volunteer`: the ~200 distributors. Has address, contact info, routes, captain territory.
- `Captain`: the 4 (or more, with temps) captains. Has pay terms, territories, payout history.

**Geography.**
- `Address`: a civic address. FK to `GoogleMapsLocation` for the canonical Google reference.
- `GoogleMapsLocation`: stores the Google `place_id` (durable) plus a 30-day cache of lat/lng and the formatted address.
- `CaptainTerritory`: a captain's coverage area.
- `VolunteerRoute`: a street segment, with start/end addresses, side, bundles, papers, and house count.
- `RouteBundle`: a single bundle within a route's standard make-up.

**Operations (per publication run).**
- `Issue`: a publication run. Open or closed.
- `RouteDelivery`: per-route, per-issue actuals (assigned/completed bundles, missed, papers, drops, actual deliverer).
- `CaptainPayout`: per-captain, per-issue payout. Snapshots pay terms and quantities; locks when the issue closes.

**Supporting.**
- `Note`: free-form note with author and timestamp.

**Nice-to-have (post-MVP).**
- `VolunteerCredit`: annual ad credit holder + total.
- `CreditTransaction`: a single use of credit, with invoice ref and category.
- `VolunteerInstruction`: placeholder for delivery instructions; whole entity SUBJECT TO CHANGE.

### Key relationships

- `Volunteer.volunteerRouteIds` references multiple `VolunteerRoute`s; one volunteer can carry multiple routes.
- `VolunteerRoute.assignedVolunteerId` is nullable; a null value means the route is vacant.
- `VolunteerRoute.territoryId` references `CaptainTerritory` and is nullable. When set, the territory determines which captain owns the route. When null, the route is unaffiliated.
- `CaptainTerritory.assignedCaptainId` references `Captain`.
- `Captain.payoutIds` and `CaptainPayout.captainId` are a bidirectional foreign-key link, so payout history is reachable from both directions.
- `RouteDelivery.issueId` and `RouteDelivery.routeId` join issues to per-route actuals.
- `CaptainPayout.issueId` joins payouts to issues; closing the issue locks all child payouts.

### Important modeling decisions and rationale

These calls are worth knowing because they shape everything.

**Issue as the time backbone.** Adding `Issue` as a first-class entity is what makes the new system structurally different from the spreadsheet. It gives deliveries and payouts an event scope, and lets us snapshot data at issue close.

**Snapshot pattern on closed payouts.** `CaptainPayout` carries `payType`, `rate`, `billableQuantity`, `missedDeductionQuantity`, and `amount` as stored values. When the parent issue closes, `locked` flips to true and the values stop changing. This replaces the spreadsheet's manual copy-paste-of-formula-results and removes the annual reset entirely.

**Pay terms on captain, not territory.** Earlier versions of the schema put `payType` and `payRate` on `CaptainTerritory`. Domain notes are clear that pay is per captain (captains can cover multiple territories with the same rate). Moved to `Captain` and snapshotted on `CaptainPayout`.

**`assignedVolunteerId` is nullable.** Vacant routes are a real state, not a missing assignment. Null is the correct representation.

**`GoogleMapsLocation.id` is a `place_id` string, not a UUID.** Google's place ID is the only field their Terms of Service let us store indefinitely. Lat/lng and formatted address are a 30-day cache. Using `place_id` as the primary key removes the need for a UUID-to-place_id mapping table.

**House count is derived data with a freshness state.** A route's house count comes from Toronto Open Data, not user input by default. The count has its own state machine (Pending, Ready, Stale, Manual) tracked separately from the route's lifecycle state.

**Money as integer cents.** Avoids floating-point errors in payment math. $1 = 100.

**Routes use soft delete, not hard delete.** When Melinda "deletes" a route, the row stays in the database with a `deletedAt` timestamp and is hidden from all UI lists and operational views. This preserves past RouteDelivery records, payment audit data, and the history of route combinations, while letting Melinda freely reuse the addresses, street name, side, or overlapping ranges in new routes. The deleted row does not participate in any uniqueness or coverage checks; it exists only for historical lookup.

---

## 9. Core user flows

A list of the flows the system needs, with status.

| Flow | Status | Reference |
|---|---|---|
| Route management (create, edit, assign, unassign, retire, house count refresh) | Drafted | `route_management_flow_v2.md` |
| Volunteer management (add, edit, retire, view routes) | Not yet drafted | Next priority |
| Captain management | Not yet drafted | After volunteer mgmt |
| Issue lifecycle (open, record deliveries, close) | Not yet drafted | Critical for Hope's workflow |
| Captain payout processing (review, mark paid) | Not yet drafted | Critical for Hope |
| Substitution / missed-drop recording | Not yet drafted | Likely part of delivery recording |
| Reporting / dashboards | Not yet drafted | Lower priority |
| Authentication and admin onboarding | Not yet drafted | Lower priority |
| Map view (nice-to-have) | Not yet drafted | Post-MVP |
| Proximity-based vacant route assignment | Not yet drafted | Post-MVP |
| Volunteer credit ledger | Not yet drafted | Post-MVP |

The route management flow doc establishes the diagram and prose conventions for the others. Reuse that format.

---

## 10. Technical architecture

### Stack

Working assumptions, not yet fully locked in.

- **Language:** TypeScript end-to-end.
- **Frontend:** Web app, responsive for laptop and mobile browsers. Framework TBD (likely React).
- **Backend:** Node.js API. Framework TBD.
- **Database:** Postgres, almost certainly with PostGIS extension enabled (needed for the Toronto Open Data spatial queries and any future map features).
- **Hosting:** TBD. Beach Metro has agreed to cover basic hosting costs.
- **Auth:** TBD. Likely passwordless or password + session, with elevated checks on financial routes.

### Dev tooling

- Linear for sprint management (board + list views, ongoing + upcoming cycles).
- Figma for design.
- Claude Code / Cursor for development.
- Notion AI for documentation.
- Granola for meeting notes.

### Phasing

Per the team's working plan:

- **Phase 1 (about 2 weeks).** Whole team collaborates on user flows and feature scoping. Schema and core flows agreed.
- **Phase 2.** Parallel streams. Abeer scaffolds backend (DB, models, migrations, API). David and Kristen build the design system and high-fidelity mockups in Figma.
- **Phase 3.** Staggered sprint handoffs. Design engineers complete frontend; Abeer integrates backend. 1 to 2 week cycles per feature. MVP completion before nice-to-haves.

---

## 11. External integrations

Full detail in `google_maps_research.md`. Summary below.

### Google Maps Platform

Used for converting addresses to coordinates, validating user-entered addresses, rendering the map (post-MVP), and proximity recommendations (post-MVP). Specific APIs in scope:

- **Geocoding API.** Address to coordinates and place_id. Workhorse of the integration.
- **Address Validation API.** Used at volunteer and captain signup to standardize and verify Canadian addresses. Returns place_id, formatted address, structured components, and residential vs business metadata.
- **Maps JavaScript API.** Renders the interactive map for the post-MVP map view.
- **Maps Static API.** Optional, for small thumbnail maps on profiles or run sheets.
- **Routes API: Compute Route Matrix.** Post-MVP. Many-to-many origin-destination distance/duration for the "recommend nearest vacant route" feature.

**Not used:** Places API (no business search), Directions API and Distance Matrix API (legacy as of March 2025; replaced by Routes API), Roads API, Street View, Aerial View, Elevation, Pollen, Weather.

**Critical constraint.** Per Google's Terms of Service, only `place_id` may be stored indefinitely. Latitude, longitude, and formatted address may be cached for at most 30 consecutive days, after which the cache must be deleted or refreshed. The schema's `GoogleMapsLocation` interface reflects this: `id` is the durable identifier, all other fields are explicitly cached with a `cachedAt` timestamp.

**Pricing.** Each Maps SKU has its own monthly free tier (10,000 events for Essentials-tier APIs including Geocoding, Maps JS, Routes Compute Route Matrix). At expected Beach Metro volume (a few hundred geocodes per month, a few thousand map loads, a handful of route matrix calls), the system is expected to operate within the free tier at $0/month. Verify against current pricing at `mapsplatform.google.com/pricing` before launch.

### Toronto Open Data

Used for house counting per route. Free, royalty-free with attribution under Open Government Licence Toronto.

**Datasets:**
- **Address Points (Municipal) - Toronto One Address Repository.** ~500,000 civic addresses with street number, name, side of street, and coordinates. Each address is tagged with the Centreline segment it sits on.
- **Toronto Centreline.** Street segments with intersection endpoints. The segments are how we precisely bound a route between two intersections.

**Both datasets are active in the City's CKAN backend at `ckan0.cf.opendata.inter.prod-toronto.ca`.** Some legacy URLs on the open.toronto.ca frontend show as "Retired" but the underlying data is current; the active pages and CKAN API endpoints work fine. Datasets refresh daily.

**House counting query (conceptual):**
1. Given a route (street name + two intersection-bounding addresses + side), find the Centreline segment(s) that span between those intersections on that street.
2. Filter Address Points where `CENTRELINE_ID` is in that segment set and `CENTRELINE_SIDE` matches the route's side.
3. Count rows.

**Ingestion pattern.** Pull the full datasets as GeoJSON once, load into PostGIS, refresh weekly via a background job. Local queries; no per-request API calls to the City.

**Geographic scope limitation.** Toronto Open Data only covers the City of Toronto, which includes the Beach, East York, and Southwest Scarborough (Beach Metro's coverage area). If the paper ever expands beyond Toronto's municipal boundaries, this data source no longer applies.

### Other potential integrations (not in MVP)

- **Canada Post Precision Targeter / Householder Counts.** Authoritative paid product for address counts. Considered and deferred; Toronto Open Data is sufficient.
- **Email service provider (SendGrid, Postmark, etc.).** For the post-MVP email marketing tools.
- **CSV export.** Lightweight alternative to email marketing; just export volunteer email lists.

---

## 12. Constraints and compliance

### Privacy and PII

Volunteer and captain records contain names, addresses, email, and phone. This is PII and must be:
- Securely stored (encrypted at rest, HTTPS in transit).
- Access-controlled (admin login required).
- Disclosed in the privacy policy as being processed by us and by Google (for address validation and geocoding).
- Never exported to non-Google maps (per Google ToS).

We do not store customer or recipient PII; Beach Metro does not deliver to specific recipients.

### Google Maps Terms of Service

- `place_id` storable indefinitely.
- Latitude, longitude, formatted address: cache for max 30 days, then delete or refresh.
- No bulk export or pre-fetching of Maps data.
- Maps content must be displayed on a Google map (cannot use Geocoding output on Leaflet, Mapbox, etc.).
- Attribution required when displaying Maps content.

### API security

All API keys restricted by referrer (frontend) and enabled API (backend). Per-day quota caps set in Google Cloud Console to prevent runaway billing from key leakage.

### License

Source code is open-sourced under the MIT License (per the SOW). UW Blueprint retains the right to distribute components however they see fit.

### Hosting and infrastructure

Beach Metro will fund basic hosting costs. Specific provider and SLA not yet determined.

---

## 13. Timeline

- **Project start:** May 2026.
- **Expected duration:** 4 months.
- **Workload:** ~40 hours/month per Blueprint team member.
- **Meeting cadence:** weekly Friday client meeting at 2:30 PM, with email updates between meetings.
- **Phase 1 (~2 weeks):** flows and scoping finalized.
- **Phase 2:** parallel design and backend scaffolding.
- **Phase 3:** sprint-based feature delivery, MVP first, then nice-to-haves if time permits.

---

## 14. Open questions

Grouped by category. Some have proposed defaults; nothing is locked.

### Product / UX

- Is captain self-reporting in scope for MVP, or admin-only? Default: admin-only.
- Where does the "show vacant routes only" filter live on the routes list? Default: prominent toggle, possibly the default view.
- Should Melinda be able to override the Open Data house count, or only enter manually when the lookup fails? Default: soft override allowed, flagged as manual.
- When a route's range is shrunk and leftover houses are orphaned, should the UI surface a "create leftover route" shortcut? Default: yes, non-blocking notice.
- Where does "recommended volunteers" (proximity-based) live in the assign flow when the map ships? Default: tab in the volunteer picker.
- What's the "significant change" threshold for the background house-count refresh job to flag for spot-check? Default: 10% or 5 houses, whichever is larger.

### Domain / data model

- Is `Note.authorId` always an `AdminUser`, or can it be a captain or system event? Default: AdminUser, revisit.
- Is the `Note.category` field a free-text tag or an enum? Default: free text, revisit.
- Should `Address.type` ("residential" | "commercial") be set from Google Address Validation metadata at signup, or always picked manually? Default: from metadata, manual override allowed.
- Should `VolunteerInstruction` survive as an entity, or get absorbed into Note? Whole entity is currently a placeholder.
- How do we model recurring volunteer credits when the same person holds credit across multiple years? Default: one `VolunteerCredit` per holder per year.

### Technical / integration

- Lazy refresh of cached lat/lng (on read, when older than 25 days) vs proactive (nightly batch). Default: lazy.
- Do we use Address Validation API at every signup, or only Geocoding API? Default: Address Validation for the verdict and metadata.
- Do we use Places Autocomplete in address input fields? Default: no, not worth the added cost for Beach Metro's volume.
- PostGIS vs simpler bounding-box approximation for the house-count query? Default: PostGIS for accuracy on curved streets.

### Business / operational

- Wally's custom payment formula: reverse-engineer from the spreadsheet, or treat as "invoices externally" and not compute his amounts? Default: invoices externally, don't compute.
- What is the labelled vs unlabelled bundle distinction in the current spreadsheet? Open from client meeting notes.
- How are captains currently informed of route assignments and bundle counts? Open question for client.
- What is Territory 91 in the spreadsheet (where Wally has more drop-offs than bundles)? Open.
- How are advertising-credit transactions recorded after the first one? Open.
- How are non-volunteer employees onboarded into the credit ledger? Open.

---

## 15. Risks

**Spreadsheet reverse engineering.** Payment formulas are partially broken and partially unknown. We may discover during ingestion that some math the spreadsheet appears to do is actually done by hand and only the result is stored. Mitigation: validate assumptions against Hope's actual process before locking the payout formula.

**Wally as edge case.** One captain's payment calculations are outside the standard model. If we can't isolate him cleanly (via `invoicesExternally: true`), his case may force model complexity. Mitigation: treat him as opaque from day one.

**Toronto Open Data dataset stability.** The frontend URLs for Address Points and Centreline have already been retired once (the data moved to CKAN). If the City retires the datasets entirely, the automated house count breaks. Mitigation: manual entry remains a first-class fallback; the system never depends on Open Data being available.

**Google API ToS compliance.** The 30-day caching rule is easy to forget and easy to violate accidentally if a developer adds a "store the formatted address forever" shortcut. Mitigation: explicit `cachedAt` field on `GoogleMapsLocation` and a background eviction job from day one.

**Address Validation API cost.** If the system gets noisier than expected (lots of test signups, repeated edits), Address Validation could push out of the free tier. Cost is bounded but worth monitoring. Mitigation: per-day quota caps in Cloud Console.

**Scope creep.** Nice-to-haves are well-defined and explicitly post-MVP, but client enthusiasm could push them in. Mitigation: explicit MVP scope agreement in the SOW; change management process for any additions.

**Volunteer onboarding/training for the new system.** Even a good UI is a behaviour change for Melinda and Hope. Mitigation: include onboarding time in the timeline; design with their current mental models, not against them.

---

## 16. Reference documents

The source-of-truth artifacts for this project, all stored alongside this PRD.

- **`schema.ts`** — TypeScript type interfaces for all entities. The data model lives here.
- **`route_management_flow_v2.md`** — User flow doc for route management, with Mermaid state and flow diagrams. Format reference for future flow docs.
- **`google_maps_research.md`** — Detailed research on Google Maps Platform APIs, response schemas, pricing, and ToS constraints. Source for the integration section above.
- **Statement of Work** — Original SOW between UW Blueprint and Beach Metro.
- **Client meeting notes** — Two meetings worth of notes captured separately, with operational details on payment structure, bundle conventions, edge cases.

---

## 17. Glossary

- **Blueprint** — UW Blueprint, the University of Waterloo student-led design and development team partnering with nonprofits.
- **Bundle** — A pre-packaged stack of newspapers. Factory bundles come in 25s or 50s; captains often rebundle to custom quantities per volunteer.
- **Captain** — One of (currently) four people who drive route runs, delivering bundles to volunteers.
- **CKAN** — Comprehensive Knowledge Archive Network. The data management system backing Toronto Open Data. Datasets are exposed via `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/...`.
- **Centreline** — Toronto Open Data dataset of street segments, where each segment is the stretch of road between two intersections. Used to bound routes geographically.
- **FSA** — Forward Sortation Area. The first three characters of a Canadian postal code. Mentioned in early conversations as a potential data source; not currently used.
- **Issue** — One publication run of the newspaper. Papers go out 1 to 3 times per month, and each run is an issue.
- **MVP** — Minimum Viable Product. The smallest version of the system that delivers core value.
- **NPO** — Non-Profit Organization.
- **PII** — Personally Identifiable Information.
- **PostGIS** — A spatial extension for Postgres that adds geographic data types and spatial query functions. Used for the route-to-Centreline spatial joins.
- **place_id** — Google's stable, globally unique identifier for a location. The only Google Maps field that may be stored indefinitely under ToS.
- **Route** — A street segment between two specific addresses, on one or both sides of the street, delivered by one volunteer.
- **Run sheet** — Printable summary of a captain's deliveries for one issue. Mentioned as a future Static Maps use case.
- **Snapshot pattern** — Storing computed values (rate, quantity, amount) as fixed numbers on a payout row when the parent issue closes, so the math is frozen and immune to later upstream changes.
- **SOW** — Statement of Work. The contract between UW Blueprint and Beach Metro defining the engagement.
- **Substitute / substitution** — When a volunteer other than the route's assigned carrier actually delivers the issue. Captured on `RouteDelivery.deliveredByVolunteerId`.
- **Territory** — A geographic area covered by one captain. Contains many routes.
- **Vacant route** — A route with no assigned volunteer. The state Melinda spends the most time managing.
