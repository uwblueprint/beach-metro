# Beach Metro: PRD

## 🧠 Context

Beach Metro is a newspaper NPO that delivers newspapers to the Beaches neighbourhood via a network of volunteer carriers and captain drivers. These newspapers are delivered to residential homes, but also commercial locations like churches and stores.

Volunteer carriers are assigned routes, which is a group of houses on a street, and they walk these routes every time a new issue is printed (typically bi-weekly). Volunteers are typically high school students, so there is a revolving door of incoming and outgoing volunteers.

Captains use cars, and they drop off bundles of newspapers at the volunteer carrier houses, and also at commercial locations. Captains are paid for their deliveries.

### ✏️ Helpful Vocabulary:

- Route: the path that a volunteer walks to make paper deliveries at houses
    - described with a start and end address, and a street name
- Territory: the collection of addresses that a Captain has to make bundle drops at
    - each Captain “owns” one territory
- Bundle: a tied up collection of newspapers
    - by default, bundles come in packs of 25 or 50, but they are often unbundled and tied up with a custom number of papers
- Issue: the release of a newspaper
    - typically a bi-weekly cadence (but tri-weekly during summer)
    - although Captain pay periods do not exactly follow issues (captains paid monthly), the drops that a Captain gets paid for is calculated on a per-issue basis
    - for every issue, papers need to be ordered and bundles need to be put together and labelled
- Labels: a sticker that is attached to some bundles, which specifies the paper count, the volunteer name, volunteer address, and territory
    - labels are used so that captains know which bundles to grab and which bundles to drop off where
    - not all bundles need to be labelled
- Volunteer Drop: a volunteer’s house that would receive bundle drops for delivery
- Commercial Drop: an address that collects bundles from Captains, to be stored in a pile
    - some examples are Residential buildings, schools, churches, food and beverage institutions
- Vacant Route: a route with no assigned volunteer carrier
    - the state the admin spends the most time managing
- Substitution: when someone other than a route’s assigned volunteer actually delivers that route for an issue
- House Count: the number of houses on a route, used to size routes and estimate paper/bundle needs
    - calculated automatically, with a manual override

## 📌 Goals for Different Pain Points

1. Captain Drop-Off Reimbursement
    1. Having pay checks for Captains be automatically calculated from Territory + Route data
        1. Having this calculation be communicated clearly, and also easy to manually adjust
    2. Accounting for Captain pay substitutions
    3. Seeing historic annual financial data
    4. Marking pay checks as paid or unpaid
    5. Easily adjusting Captain pay structure (rate, unit of pay)
2. Route Management
    1. Assign routes to volunteers
    2. Edit routes (splitting into multiple routes, or extending a route)
    3. Easily see which routes are vacant
        1. And seeing the nearest vacant route to a new volunteer’s address
    4. Track paper + bundle count for a route
3. Volunteer Management
    1. Store all relevant Volunteer info in a profile (contact info, route info)
    2. Retire Volunteers
    3. Assign volunteers to be part of a Captain’s territory
4. Label Printing
    1. Bulk-print labels for a specific subset of bundles for each new issue

## 🌊 Flows / Features

### Flow 1 — Route Management

**Solves:** P2
**What it does:** Lets the admin create, edit, and split the delivery routes that volunteers walk, each defined by a start address, end address, street name, and side.
**Key behavior:**

- Create a route from a start + end address, street name, and side (N / S / E / W / Both); assigning a territory and a volunteer is optional at creation and can be done later.
- Edit a route's geography (start, end, side) or its territory and notes.
- Splitting and extending are manual: shrinking a route's range orphans the leftover houses, and the admin creates a new route to cover them — there is no "smart" auto-split.
- House count per route is calculated automatically with a manual override, and feeds the route's paper/bundle counts.
- "Deleting" a route hides it from all operational views but preserves it for historical and financial records; its addresses, street, and ranges can be freely reused by new routes.

**Out of scope:** drawing or editing routes directly on a map; routing at the individual-household level (routes are street-segment level).

### Flow 2 — Vacant Route Triage & Assignment

**Solves:** P2, P3
**What it does:** Surfaces routes that have no assigned carrier and helps the admin fill them, including suggesting the nearest vacant route to a new volunteer's home.
**Key behavior:**

- A route with no assigned volunteer is "vacant"; vacant routes are first-class, filterable, and surfaced through a prominent "vacant only" view.
- Assign a volunteer to a vacant route, unassign a volunteer (route returns to vacant), or reassign to swap carriers.
- When a volunteer's end date passes, their routes automatically flip to vacant.
- When onboarding a new volunteer, recommend the closest vacant routes to their home address.

**Out of scope:** automatic re-balancing of routes across volunteers.

### Flow 3 — Volunteer Management

**Solves:** P3
**What it does:** Maintains a profile for each volunteer and manages their lifecycle and territory membership.
**Key behavior:**

- Store each volunteer's contact info (name, address, email, phone), notes, and assigned routes.
- Active vs. inactive status is derived from start and end dates — important given the high turnover of student volunteers.
- Retire a volunteer; their routes become vacant for reassignment.
- Assign a volunteer to a Captain's territory.

**Out of scope:** a volunteer-facing login or portal — volunteers do not log in; their information is managed about them.

### Flow 4 — Captain Reimbursement

**Solves:** P1
**What it does:** Automatically calculates each Captain's pay from their territory and route/drop data on a per-issue basis, presented clearly and easy to adjust.
**Key behavior:**

- Pay is auto-calculated from territory + route/drop data; the calculation is shown transparently and can be manually overridden.
- Each Captain has an editable pay structure: a rate and a unit of pay (per bundle, per paper, or per drop).
- Substitutions are accounted for so pay is attributed correctly when someone covers a drop.
- Per-issue amounts roll up into the Captain's monthly pay period; each pay check can be marked paid or unpaid.
- Historic annual financial data is viewable for accounting.

**Out of scope:** computing pay for Captains who invoice externally — their amounts are recorded but not auto-calculated.

### Flow 5 — Issue Lifecycle & Delivery Recording

**Solves:** P1
**What it does:** Tracks each publication run (issue) and the drops actually made, which is the data Captain reimbursement is calculated from.
**Key behavior:**

- Open an issue for each publication run; record per-route and per-drop actuals (assigned vs. delivered bundles, paper count, drop count, missed drops, and the substitute deliverer if any).
- Closing an issue locks its numbers so the pay math is frozen and historical records stay immutable.
- Per-issue drop data drives Captain pay even though Captains are paid monthly.

**Out of scope:** real-time tracking of Captains during delivery.

### Flow 6 — Label Printing

**Solves:** P4
**What it does:** Bulk-prints bundle labels for a chosen subset of bundles each new issue.
**Key behavior:**

- For a new issue, select the subset of bundles that need labels and bulk-print them in one action.
- Each label shows paper count, volunteer name, volunteer address, and territory, so Captains know which bundles to grab and where to drop them.
- Not all bundles are labelled — only the subset that requires it.

**Out of scope:** designing custom label layouts per Captain.

## Out of Scope

What we are explicitly not building:

- A volunteer-facing app or portal; volunteers (and, for now, captains) do not log in.
- A customer or recipient address database — we do not store who receives papers.
- Door-to-door / household-level delivery routing; routes stay at the street-segment level.
- Drag-and-drop route editing on a map.
- Replacing the physical print and distribution operation itself — this is a management layer over the existing operation.
- Unscoped system messaging: notifications, alerts, badges, toasts, banners, or modal warnings. The default is to not show one unless a feature explicitly calls for it.

## Later (Post-MVP)

Valuable, but not in the first release:

- Interactive map visualization to replace the colour-coded maps used today.
- Volunteer credit ledger (e.g. an annual advertising credit per volunteer).
- Email marketing / blast tools for volunteers (CSV export of email lists at minimum).
- Bulk route operations (bulk reassign to a new territory, bulk retire) — most useful when a captain leaves.
