# API Spec — Endpoints & CRUD

The REST surface for the Beach Metro app: every endpoint, grouped by resource, with
the standard CRUD methods plus the custom actions the flows need (close an issue,
override a payout, assign a volunteer, validate an address). Derived from the flow
specs in [`docs/flows/`](../flows/) and the [data model](../schema/data_model.md),
and consistent with the [infrastructure spec](../infra/infrastructure_spec.md).

**Design stance** (resource-oriented, after the [Google API Design Guide](https://google.aip.dev/)):
model nouns as collections, expose the five standard methods (List / Get / Create /
Update / Delete), and use **custom actions** for state transitions that don't fit
CRUD. Transport is typed REST via Next.js App Router route handlers, validated with
Zod, consumed by TanStack Query — per the infra spec.

---

## 1. Conventions

**Base path.** `/api`. Resource collections are plural nouns (`/api/volunteers`).

**Transport & layering.** Each endpoint is an App Router route handler
(`app/api/<resource>/route.ts`). The request lifecycle is:

```
Route handler  ──►  Zod validate input  ──►  service function (business logic)  ──►  Supabase (service-role)
```

The browser never writes to Supabase directly; all writes and all business
invariants (locking, calculation, vacancy triggers) live in the server-side service
layer. Reads may also go through handlers for a consistent shape.

**Auth.** Every endpoint requires a valid Supabase admin session (else `401`).
**Both admin roles have identical permissions** — the distribution-manager vs
accounts-manager distinction is a UI/navigation concern only, not enforced at the
API. (If that changes, role checks slot in as a `403` gate; out of scope now.)

**Response envelope.**
- Success: `{ "data": <payload> }` (lists: `{ "data": T[], "nextCursor"?: string }`).
- Error: `{ "error": { "code": string, "message": string, "details"?: unknown } }`.

**Status codes.** `200` OK, `201` Created, `204` No Content, `400`/`422` validation,
`401` unauthenticated, `404` not found, `409` conflict (e.g. writing a closed issue),
`500` server error.

**Validation.** Zod schemas in `lib/validation/`, shared by the handler and the
client fetchers so request/response shapes stay in sync. Validation failure → `422`
with `details`.

**IDs.** UUID path params, except `GoogleMapsLocation`, keyed by Google `place_id`.

**Lists.** Support `?limit` + `?cursor` (cursor pagination), `?sort`, and
resource-specific filters (documented per resource).

**Custom actions.** Non-CRUD transitions are `POST /api/<resource>/{id}/<action>`
(the AIP custom-method concept, spelled as a sub-path since Next file routing has no
`:action` syntax). They exist precisely so invariants stay server-side rather than
being assembled from raw field writes.

**Notes.** A `Note` is created/updated through its parent entity's write (the
handler upserts the `Note` and sets `authorId` from the session); there is no
standalone notes API in MVP.

---

## 2. People domain

### Volunteers — `/api/volunteers`

| Method | Path | Purpose | Flow |
|---|---|---|---|
| GET | `/api/volunteers` | List. Filters: `status` (active/on-vacation/retired), `territoryId`, `hasRoute`, `needsAttention`, `q` | people 4b |
| POST | `/api/volunteers` | Create (validates address, creates `Address` + `GoogleMapsLocation`) | 4a |
| GET | `/api/volunteers/{id}` | Detail (includes derived status, routes carried, territory) | 4c |
| PATCH | `/api/volunteers/{id}` | Edit fields / note / territory assignment | 4d |
| POST | `/api/volunteers/{id}/vacation` | Set or clear the vacation window (suspends/auto-resumes routes) | 4e |
| POST | `/api/volunteers/{id}/retire` | Soft retire (`retiredAt`); detaches routes → they become vacant | 4f |

No `DELETE` — volunteers are soft-retired, never deleted.

```ts
// POST /api/volunteers
type CreateVolunteer = {
  firstName: string; lastName: string; email: string; phone: string
  address: AddressInput            // raw address OR { placeId } from autocomplete
  captainTerritoryId?: string | null
  startDate: string; endDate?: string | null
  note?: string
}
// 201 -> { data: Volunteer }

// POST /api/volunteers/{id}/vacation
type SetVacation = { vacationStart: string; vacationEnd: string } | { clear: true }

// AddressInput is validated via /api/addresses/validate (see §6) before persistence.
type AddressInput =
  | { addressLines: string[]; locality?: string; administrativeArea?: string; postalCode?: string; regionCode?: "CA" }
  | { placeId: string }
```

### Captains — `/api/captains`

| Method | Path | Purpose | Flow |
|---|---|---|---|
| GET | `/api/captains` | List. Filters: `status`, `q` | people 4h |
| POST | `/api/captains` | Create (no address; pay config required; **also creates the 1:1 empty territory**) | 4g |
| GET | `/api/captains/{id}` | Detail (includes territory) | 4i |
| PATCH | `/api/captains/{id}` | Edit fields / pay config (type, rate, cadence) / note | 4j |
| POST | `/api/captains/{id}/retire` | Soft retire; leaves the territory captain-less and prompts reassignment | 4k |

```ts
// POST /api/captains
type CreateCaptain = {
  firstName: string; lastName: string; email: string; phone: string
  payType: "bundle" | "paper" | "drop"
  payRate: number            // 0 is valid (temp/substitute captains, donate-back)
  payCadence: "weekly" | "biweekly"
  startDate: string; endDate?: string | null
  note?: string
}
// 201 -> { data: { captain: Captain, territory: CaptainTerritory } }
```

A **substitute/temporary captain** uses this same endpoint with `payRate: 0`; no
special type. See the finance substitution action (§4).

### Territories — `/api/territories`

Territories are created implicitly with their captain. This resource manages the
two memberships (volunteers, commercial drops) and the map colour.

| Method | Path | Purpose | Flow |
|---|---|---|---|
| GET | `/api/territories` | List (filters: `hasCaptain`, `q`) | people |
| GET | `/api/territories/{id}` | Detail (captain, volunteers, commercial drops) | people |
| PATCH | `/api/territories/{id}` | Edit colour (and reassign captain) | people |
| POST | `/api/territories/{id}/volunteers` | Assign a volunteer (`{ volunteerId }`) | 4l-style |
| DELETE | `/api/territories/{id}/volunteers/{volunteerId}` | Unassign a volunteer | |
| POST | `/api/territories/{id}/commercial-drops` | Add a commercial drop (`{ address }`, validated) | 4l |
| DELETE | `/api/territories/{id}/commercial-drops/{addressId}` | Remove a commercial drop | 4l |

---

## 3. Routes domain

### Routes — `/api/routes`

| Method | Path | Purpose | Flow |
|---|---|---|---|
| GET | `/api/routes` | List. Filters: `vacancy` (vacant/assigned), `territoryId`, `needsAttention`, `side`, `q` | route 4b |
| POST | `/api/routes` | Create (start/end address, street, side; volunteer optional) | 4a |
| GET | `/api/routes/{id}` | Detail (derived lifecycle + suspended flag, house count, counts) | 4c |
| PATCH | `/api/routes/{id}` | Edit definition (addresses, street, side, `houseCountOverride`, note) | 4d |
| DELETE | `/api/routes/{id}` | **Hard delete** (route flow deletes rather than retires; addresses reusable) | route flow |
| POST | `/api/routes/{id}/assign` | Assign a volunteer (`{ volunteerId }`) → Active-Assigned | 4e |
| POST | `/api/routes/{id}/unassign` | Unassign → Active-Vacant | 4f |
| POST | `/api/routes/{id}/reassign` | Swap carrier (`{ volunteerId }`) | 4f |
| GET | `/api/routes/nearest-vacant` | Rank vacant routes by proximity to a volunteer home (`?volunteerId=` or `?placeId=`) — Routes Matrix | PRD Flow 2 |

Splitting/extending is manual (PATCH the geography, then POST a new route) — no
dedicated endpoint, per the route flow. House count is auto-calculated; a manual
recompute is `POST /api/routes/{id}/refresh-house-count` (route 4g) — `SUBJECT TO
CHANGE`: recompute trigger may be a background job instead.

```ts
// GET /api/routes/nearest-vacant?volunteerId=...&limit=5
// -> { data: Array<{ route: VolunteerRoute, distanceMeters: number, durationSeconds: number }> }
```

---

## 4. Finance domain

### Financial years — `/api/financial-years`

| Method | Path | Purpose | Flow |
|---|---|---|---|
| GET | `/api/financial-years` | List (filter: `archived`) | finance 4a |
| POST | `/api/financial-years` | Create (names the year; snapshots active-captain columns) | 4a |
| GET | `/api/financial-years/{id}` | Detail (the table: issues + payouts grid) | finance |
| POST | `/api/financial-years/{id}/archive` | Archive (stays fully accessible) | 4i |
| GET | `/api/financial-years/{id}/export?format=csv` | Read-only CSV export of the table or a filtered view | 4h |

### Issues — `/api/issues`

| Method | Path | Purpose | Flow |
|---|---|---|---|
| GET | `/api/financial-years/{yearId}/issues` | List rows | finance 4a |
| POST | `/api/financial-years/{yearId}/issues` | Create one or many **Draft** issues (batch via array body — lay out the year) | 4b |
| GET | `/api/issues/{id}` | Detail | |
| PATCH | `/api/issues/{id}` | Edit name / date | 4b |
| POST | `/api/issues/{id}/open` | Draft → Open; auto-populate payouts + delivery rows; start live calc | 4c / delivery 4a |
| POST | `/api/issues/{id}/close` | Open → Closed; **lock payout values + delivery actuals together**; payouts default unpaid | 4f / delivery 4e |
| POST | `/api/issues/{id}/reopen` | Closed → Open (guarded admin correction) | finance 3a |

```ts
// POST /api/financial-years/{yearId}/issues
type CreateIssues = { issues: Array<{ name: string; date: string }> } // 1..n, created Draft
```

### Captain payouts — `/api/payouts`

| Method | Path | Purpose | Flow |
|---|---|---|---|
| GET | `/api/issues/{id}/payouts` | List the issue's payout cells | finance 4c |
| GET | `/api/payouts/{id}` | Detail + calculation breakdown | 4c |
| POST | `/api/payouts/{id}/override` | Manual override (`{ amount, reason }`) → Overridden | 4d |
| POST | `/api/payouts/{id}/clear-override` | Revert to auto-calculated | 4d |
| POST | `/api/payouts/{id}/mark-paid` | Mark paid (**only if the issue is Closed**, else `409`) | 4e/4g |
| POST | `/api/payouts/{id}/unmark-paid` | Clear paid marker | 4e/4g |
| POST | `/api/payouts/{id}/substitute` | Finance-only substitution (see below) | 4h |

There is no create/delete for payouts — they are created by opening an issue and
removed only with the issue.

```ts
// POST /api/payouts/{id}/override
type OverridePayout = { amount: number; reason: string } // reason required; no prior-value audit

// POST /api/payouts/{id}/substitute
// Redirects this issue's payout to a substitute and zeroes the original for the issue.
type SubstitutePayout =
  | { substituteCaptainId: string }   // an existing captain
  | { newCaptain: CreateCaptain }     // create a temp captain (zero rate) on the spot
```

Override / mark-paid / substitute all reject (`409`) when the issue state forbids
them (e.g. editing a closed issue's calculation, or paying on an open issue).

---

## 5. Delivery domain

### Route deliveries — `/api/deliveries`

| Method | Path | Purpose | Flow |
|---|---|---|---|
| GET | `/api/issues/{id}/deliveries` | List the issue's per-route delivery rows | delivery 4b |
| GET | `/api/deliveries/{id}` | Detail | |
| PATCH | `/api/deliveries/{id}` | Edit actuals (paper/bundle/drop/missed) + substitute deliverer | 4b/4c |

Rows are created automatically when the issue is opened (§4 `open`), for routes that
are carried (Active-Assigned, volunteer not on vacation); vacant/suspended routes are
skipped. Rows are **editable only while the issue is Open** — PATCH on a closed
issue's delivery returns `409`. No create/delete endpoint.

| GET | `/api/issues/{id}/papers-to-order` | Derived total papers to order for the issue (feeds reporting) | delivery 4d |

```ts
// PATCH /api/deliveries/{id}
type UpdateDelivery = Partial<{
  paperCount: number          // changing this re-derives bundleCount unless bundles set manually
  bundleCount: number
  bundles: { papers: number }[]
  dropCount: number
  missedCount: number         // in the unit matching the route's captain pay type
  substituteDeliverer: string | null
}>
```

---

## 6. Address & Google integration — `/api/addresses`

Server-side wrappers over Google Maps so keys stay off the client and results are
persisted under our caching rules (durable `place_id`; lat/lng on a 30-day refresh).
See the [Google research doc](../integrations/google_maps_research.md).

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/addresses/validate` | Address Validation (Canada). Returns verdict + standardized address + `placeId` + `residential`/`commercial` metadata |
| POST | `/api/addresses/geocode` | Geocoding. Resolve to `placeId` + cached coords + parsed components |

```ts
// POST /api/addresses/validate
type ValidateAddress = { address: AddressInput }
// -> { data: { addressComplete: boolean, formattedAddress: string, placeId: string,
//              type: "residential" | "commercial", needsConfirmation: boolean,
//              suggested?: AddressInput } }
```

These back the address fields in the volunteer/captain/commercial-drop forms: the
client validates, the user confirms any corrections, then the create/assign call
persists the resulting `Address` + `GoogleMapsLocation`. A scheduled refresh job
re-resolves `cached*` coordinates older than ~25 days and evicts anything past 30.

---

## 7. Endpoint summary (by HTTP shape)

- **Collections:** `volunteers`, `captains`, `territories`, `routes`,
  `financial-years`, `issues` (under a year), `payouts` (under an issue),
  `deliveries` (under an issue).
- **Standard methods:** List/Create on the collection; Get/Update on the item;
  Delete only on `routes` (hard) — people are soft-retired, finance/delivery rows are
  lifecycle-bound.
- **Custom actions:** volunteer `vacation`/`retire`; captain `retire`; route
  `assign`/`unassign`/`reassign`/`refresh-house-count` + `nearest-vacant`; year
  `archive`/`export`; issue `open`/`close`/`reopen`; payout
  `override`/`clear-override`/`mark-paid`/`unmark-paid`/`substitute`; address
  `validate`/`geocode`.

---

## 8. Open questions

- **Pagination style.** Cursor (recommended) vs page/offset — pick one and apply uniformly.
- **Batch issue creation.** Array body vs a dedicated `:batchCreate`; and whether
  opening is always manual per issue (it is, per the finance decision).
- **House-count recompute.** A manual endpoint vs a background job (Toronto Open Data
  ingestion) — tied to the infra spec's open question.
- **Idempotency.** Whether `POST` creates accept an `Idempotency-Key` header.
- **Rate limiting.** On the Google-backed endpoints especially (cost guardrail).
- **Notes.** Confirm the embed-in-parent approach is enough, or promote to a
  sub-resource if multiple notes per entity are needed.
- **Reporting endpoints.** The reporting dashboard's aggregates (papers to order,
  active counts, running cost) will add read-only endpoints once that flow is specced;
  the cost figures read from the payouts here.
