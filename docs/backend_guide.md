# Backend Guide

Everything the backend track added in `feat/backend-api` (PR #12), for a
developer who's comfortable with TypeScript but new to this codebase. It's both
an **architecture walkthrough** (how it's built, what to review) and an **API
quick-reference** (how to call it).

Companion docs — this guide links to them rather than repeating them:

- [`backend_testing.md`](backend_testing.md) — how to run/verify everything (suites, invariant→test map, curl recipes).
- [`open_items.md`](open_items.md) — every calculation/decision still open (the "holes").
- [`design_decisions.md`](design_decisions.md) — locked decisions + the **backend interpretation log** (judgment calls, each covered by a test).
- [`api/api_spec.md`](api/api_spec.md), [`schema/data_model.md`](schema/data_model.md), and the flow specs in [`flows/`](flows/) — the source-of-truth specs this was built from.

> **Verified against the live database.** Schema pushed, seed loaded, all 54
> tests pass (46 unit + **8 integration, live against the hosted project**),
> `pnpm smoke` passes (real login through the form, every list endpoint,
> error-shape checks), and the schema was introspected column-by-column against
> `types/db.ts` with zero drift. The claims in this guide are backed by that run,
> not just construction. Re-run anytime with `pnpm test && pnpm smoke` (see
> [backend_testing.md](backend_testing.md)). `pnpm db:types` itself still fails
> locally (the CLI's `--db-url` path shells out to Docker for introspection,
> which isn't running here) — types were verified by hand instead; regenerate
> once Docker or `supabase login` is available.

---

## 1. What was added

The backend track of the [build plan](plan/backend_build_plan.md), Phases 2–5 + tests:

| Phase | Commit | Landed |
|---|---|---|
| 2 — schema + seed | `6bd950b` | `supabase/migrations/*.sql`, `supabase/seed.sql`, DB tooling scripts |
| 3 — CRUD | `73dff4e` | `lib/api`, `lib/validation`, `lib/maps`, `lib/services` (foundation + people/routes), `app/api/*` |
| 4 — business logic | `a7e263d` | issue lifecycle, live payout calc, payout actions, deliveries, finance handlers |
| 5 — Maps stub | `1d37473` | `scripts/refresh-coords.ts` (provider seam + fake shipped in Phase 3) |
| tests + docs | `7951e24` | unit + integration + smoke suites, this guide's companion docs |

**39 API route handlers**, a 5-file service layer split by domain, DB migrations
with in-database invariants, and a swappable Google Maps provider (fake for now).

---

## 2. Architecture at a glance

Every write goes through the same four layers. The browser never touches the
database directly; all authorization and business rules live server-side.

```
HTTP request
   │
   ▼
app/api/**/route.ts        thin handler — declares the method, nothing else
   │  route() wrapper
   ▼
lib/api/handler.ts         AUTH gate (401) → run handler → error translation
   │                       (ZodError→422, ServiceError→its status, else 500)
   ▼
lib/validation/*.ts        Zod parse of body/query  → 422 with issue details
   │
   ▼
lib/services/*.ts          ALL business logic + invariants; throws ServiceError
   │                       (conflict 409 / notFound 404 / invalid 422)
   ▼
lib/supabase/admin.ts      service-role client (bypasses RLS) → Postgres
   │
   ▼
{ data } | { error }       envelope (lib/api/respond.ts)
```

### Layer responsibilities

- **`app/api/**/route.ts`** — one file per URL, exporting `GET`/`POST`/`PATCH`/`DELETE`.
  Each is 3–10 lines: parse input, call a service, wrap the result. No logic here.
- **`lib/api/`** — the plumbing shared by every route:
  - `handler.ts` — `route(fn)` wraps a handler with the auth check and the
    try/catch that maps errors to HTTP. `parseBody` / `parseQuery` apply a Zod schema.
  - `errors.ts` — `ServiceError` (code + message + status) and the `notFound` /
    `conflict` / `invalid` constructors services throw.
  - `respond.ts` — `ok` / `created` / `noContent` / `fail` build the envelope.
- **`lib/validation/`** — Zod schemas, one file per domain, shared by handlers
  (and later the client). This is where request shape + cross-field rules live
  (e.g. bundles must sum to paperCount, vacation start ≤ end).
- **`lib/services/`** — the real backend. Pure derivations, DB reads/writes,
  state-machine enforcement. Throws typed `ServiceError`s the wrapper turns into
  409/404/422. Returns API-shaped (camelCase) objects.
- **`lib/supabase/admin.ts`** — the service-role client. It bypasses RLS, so it
  must stay server-only (guarded by `import "server-only"`).
- **`lib/maps/`** — provider seam so address flows work before Google keys exist.

### Directory map

```
app/api/…                 39 route handlers (see §5)
lib/
  api/        errors.ts · handler.ts · respond.ts     (HTTP plumbing)
  validation/ common.ts · people.ts · routes.ts · finance.ts · delivery.ts
  services/   shared.ts · derive.ts · addresses.ts
              volunteers.ts · captains.ts · territories.ts · routes.ts
              issues.ts · payouts.ts · deliveries.ts · financial-years.ts
              recalc.ts                                (the live payout calc)
  maps/       types.ts (interface) · fake.ts (impl) · index.ts (selector)
  supabase/   admin.ts (service role) · server.ts (user session) · auth.ts (getClaims)
types/db.ts               hand-written row types (snake_case); replace via `pnpm db:types`
supabase/
  migrations/20260706200000_initial_schema.sql        the whole schema
  seed.sql                                             deterministic fixtures
scripts/    db.sh · seed.ts · create-admin.ts · refresh-coords.ts
tests/      *.test.ts (unit) · integration/ (hosted-DB) · e2e/api-smoke.spec.ts
```

---

## 3. Conventions worth knowing before reading code

- **snake_case in Postgres, camelCase in the API.** Services translate at the
  boundary. `types/db.ts` holds the row shapes; the service return types are the
  API shapes.
- **Derived, never stored.** Volunteer status (active/on-vacation/retired), route
  lifecycle (assigned/vacant) + suspended flag, needs-attention, bundle count,
  and payout calculation-status are all computed at read time in
  `lib/services/derive.ts`. Don't add columns for them.
- **Envelope.** Success `{ "data": … }` (lists are `{ "data": [] }`, no
  pagination — decided). Error `{ "error": { code, message, details? } }`.
- **Status codes.** 200/201/204; 401 unauthenticated; 404 not found; 409 conflict
  (state-machine violation, e.g. editing a closed issue's actuals); 422 validation
  (Zod or a service-level invariant like bundles-don't-sum); 500 only for the
  unexpected (logged; message is generic).
- **Auth.** `middleware`/`proxy.ts` refreshes the session; `getClaims()` in each
  wrapped handler returns 401 if there's no session. See §7 for the caveat.
- **RLS is on for every table with no policies** — intentional. Access is only via
  the service-role handlers; RLS is defense-in-depth (infra spec).
- **No cross-statement transactions.** PostgREST has no multi-statement
  transaction, so multi-write operations (e.g. create-captain-then-territory,
  create-issue-then-payouts-then-deliveries) run as separate calls. The
  captain/territory path does a manual compensating delete on failure; others
  don't. See §7.

---

## 4. The domains

- **People** (`volunteers.ts`, `captains.ts`, `territories.ts`) — CRUD + lifecycle
  actions. Creating a captain also creates their empty 1:1 territory; retiring a
  volunteer detaches their routes (→ vacant); retiring a captain frees the
  territory. Territory manages its two memberships (volunteers via assignment,
  commercial drops) + colour.
- **Routes** (`routes.ts`) — CRUD with **soft delete** (`deleted_at`; hidden
  everywhere, row retained so past deliveries resolve), assign/unassign/reassign,
  and `nearest-vacant` (ranks vacant routes by travel time via the Maps provider).
- **Finance** (`financial-years.ts`, `issues.ts`, `payouts.ts`, `recalc.ts`) — the
  yearly table, the shared issue lifecycle, and the per-cell payout actions. This
  is the heart of the branch; read `recalc.ts` first (it's the live calculation).
- **Delivery** (`deliveries.ts`) — per-route-per-issue actuals; editable only while
  the issue is Open; every edit re-runs the payout calc.
- **Addresses / Maps** (`addresses.ts`, `lib/maps/*`) — resolve input through the
  provider, persist the `place_id` cache + address row.

### The one flow to understand: issue lifecycle + live calc

1. **Create issue** (`issues.createIssuesBatch`) — born **Open** (no draft).
   Inserts a `route_deliveries` row per *carried* route (assigned + volunteer not
   on vacation; vacant/suspended/deleted skipped), seeded from the route's standing
   `papers` and the **greedy 50/25 split**. Inserts a `captain_payouts` cell per
   captain **active at that moment**. Then runs the live calc.
2. **Live calc** (`recalc.recalculateIssue`) — for each **unpaid** cell of an
   **open** issue: roll deliveries up the chain (delivery → route → volunteer →
   territory → captain), compute `rate × billable quantity` (missed deducted in the
   captain's pay unit, clamped at 0), write `calculated_amount`. Paid cells and
   closed issues are never touched.
3. **Edit a delivery** → reseed bundles (unless bundles supplied; they must sum to
   paperCount) → recalc. **Edit a captain's pay config** → recalc every open issue.
4. **Close** → status Closed; deliveries lock (409 on edit); payouts freeze;
   paid becomes toggleable. **Mark paid** → locks that cell. **Reopen** → unpaid
   cells resume live calc; paid cells stay frozen.
5. **Transfer** → paired overrides (source→0, recipient up), auto reasons.

---

## 5. API quick-reference

Base `/api`. All require a session (else the 401 envelope). Full request shapes
are in [`api/api_spec.md`](api/api_spec.md); Zod schemas in `lib/validation/`.

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/volunteers` | list (filters: status, territoryId, hasRoute, needsAttention, q) / create |
| GET/PATCH | `/volunteers/{id}` | detail / edit |
| POST | `/volunteers/{id}/vacation` | set (`{vacationStart,vacationEnd}`) or clear (`{clear:true}`) window |
| POST | `/volunteers/{id}/retire` | soft retire; detaches routes |
| GET/POST | `/captains` | list (status, q) / create (+ empty territory) |
| GET/PATCH | `/captains/{id}` | detail / edit (pay-config edits recalc open issues) |
| POST | `/captains/{id}/retire` | soft retire; frees territory |
| GET | `/territories` | list (hasCaptain, q) |
| GET/PATCH | `/territories/{id}` | detail (captain, volunteers, drops) / edit colour + reassign captain |
| POST/DELETE | `/territories/{id}/volunteers[/{volunteerId}]` | assign / unassign a volunteer |
| POST/DELETE | `/territories/{id}/commercial-drops[/{addressId}]` | add / remove a commercial drop |
| GET/POST | `/routes` | list (vacancy, territoryId, side, needsAttention, q) / create |
| GET/PATCH/DELETE | `/routes/{id}` | detail / edit / **soft** delete |
| POST | `/routes/{id}/assign` `/unassign` `/reassign` | carrier changes |
| GET | `/routes/nearest-vacant` | rank vacant routes (`?volunteerId=` or `?placeId=`, `?limit=`) |
| GET/POST | `/financial-years` | list (archived) / create |
| GET | `/financial-years/{id}` | the table: issues × captain cells |
| POST | `/financial-years/{id}/archive` | archive (stays readable) |
| GET | `/financial-years/{id}/export` | CSV download |
| GET/POST | `/financial-years/{id}/issues` | list / batch-create (born Open) |
| GET/PATCH | `/issues/{id}` | detail / edit name+date |
| POST | `/issues/{id}/close` `/reopen` | shared lifecycle transitions |
| GET | `/issues/{id}/payouts` `/deliveries` `/papers-to-order` | issue rollups |
| GET | `/payouts/{id}` | detail + calculation breakdown |
| POST | `/payouts/{id}/override` `/clear-override` | manual amount (unpaid only) |
| POST | `/payouts/{id}/mark-paid` `/unmark-paid` | payment marker (closed only; paid locks cell) |
| POST | `/payouts/{id}/transfer` | reallocate to another captain (`{toCaptainId}`) |
| GET/PATCH | `/deliveries/{id}` | detail / edit actuals (Open only) |
| POST | `/addresses/validate` `/geocode` | Maps provider wrappers |

**Calling it (cookie session).** Log in at `localhost:3000`, then either use the
browser, or copy the `sb-…` auth cookies into curl. Recipes are in
[`backend_testing.md`](backend_testing.md#re-testing-by-hand-curl).

---

## 6. What to review / scrutinize

Where the risk and the subtlety live — a reviewer's checklist:

- **`lib/services/recalc.ts`** — the money. Confirm the rollup chain, the
  unpaid-only / open-only guards, and that it's invoked everywhere inputs change
  (delivery edit, issue create/reopen, captain pay-config edit). Covered by the
  integration suite.
- **`lib/services/derive.ts`** — the pure math (greedy split, missed deduction,
  rounding). Unit-tested exhaustively; if a client answer changes rounding, change
  the fn + its test together.
- **`lib/services/payouts.ts` `transferPayoutAmount`** — paired-overrides is an
  interpretation (§8). Check the guards (existing recipient cell, unpaid, non-zero,
  not self).
- **Multi-write atomicity** — see §3/§7. Decide whether the non-atomic paths
  (issue creation especially) need a Postgres function/RPC for real transactions.
- **`supabase/migrations/*.sql`** — the invariant triggers/checks (bundles sum,
  override-needs-reason, vacation window). These back up the service layer.
- **`lib/supabase/middleware.ts` auth gate** — see §7 (accepts any Supabase user).

---

## 7. Subject to change (interpretations) + a few structural notes

Full list with rationale + covering test: [`design_decisions.md`](design_decisions.md)
(backend interpretation log). Highlights that a reviewer might push back on:

- **Transfer = paired overrides** (vs a dedicated transfer record).
- **No pagination** (internal-tool row counts).
- **Payout cells = captains active at issue creation** (no snapshot table; the
  year table's columns derive from existing cells).
- **Detached/soft-deleted routes' deliveries roll up to nobody** while open;
  close freezes whatever's current.
- **Route endpoint addresses stored as `residential`**; orphaned address rows are
  left in place when an entity re-points.
- **Reactivation (Retired → Active) isn't exposed** — the flow allows it, the API
  spec never defined it.

Structural notes for a reviewer (not yet deep-audited — this guide summarizes
documented items, per scope):

- **No cross-statement transactions** over PostgREST (§3). Compensating-delete
  only on the captain/territory path.
- **`types/db.ts` is hand-written** — regenerate with `pnpm db:types` after the
  first `db:push` and reconcile.
- **Auth checks presence of a session, not an admin allowlist** — fine today
  (admins are the only users, created via service role, no public signup), but
  revisit if signup is ever enabled.

---

## 8. Open holes — what's still missing / to be calculated

Summarized from [`open_items.md`](open_items.md) (the authoritative list — read it
for the full detail, owner, and code location of each).

**Calculations awaiting a client answer**
- Override **rounding / validation** rules (currently: any non-negative amount; calc side rounds to cents half-up).
- **Historical data migration** mechanics (past years live in backup spreadsheets).
- **Papers-to-order allowance** (spare/office copies on top of the route sum) — endpoint returns the bare sum.
- **Reporting dashboard metrics** — blocked on the finalized list; no aggregate endpoints yet.
- **Commercial-drop standing counts** — not modeled.

**Product / tech decisions still open**
- **Google Maps go-live** — real keys + `lib/maps/google.ts` implementing `MapsProvider`; everything runs on the deterministic fake today.
- **Coordinate-refresh scheduling** — `pnpm refresh-coords` exists; nothing schedules it (Vercel cron once deployed).
- **House-count auto-calc** — manual for MVP; Toronto Open Data + PostGIS is post-MVP.
- **Reactivation endpoint**, **Places Autocomplete**, **auth roles** — see open_items.

**Operational**
- **Disable legacy API keys** in the dashboard — a real `sb_secret_...` key is in use now, but the leaked legacy `service_role` JWT stays valid until that click.
- **`pnpm db:types` still fails locally** — its `--db-url` path needs Docker; `--project-id` needs `supabase login`. Types were hand-verified against a live schema introspection instead (zero drift); regenerate for real once one of those is available.
- **CI secrets** — integration tests self-skip until `SUPABASE_DB_URL` + `SUPABASE_SECRET_KEY` are added as GitHub Actions secrets (decide if CI should touch the hosted DB).
- **Idempotency keys / rate limiting** — not implemented.

---

## 9. Run & verify

Setup + the full suite/invariant map + curl recipes: [`backend_testing.md`](backend_testing.md).
Quick version:

```bash
pnpm typecheck && pnpm lint && pnpm test   # static + unit (integration self-skips w/o creds)
# once SUPABASE_DB_URL + SUPABASE_SECRET_KEY are in .env.local:
pnpm db:push && pnpm db:seed               # apply schema + fixtures to the hosted project
pnpm create-admin you@example.com <pw>     # a login
pnpm test                                  # now the integration suite runs live
pnpm smoke                                 # HTTP end-to-end (needs SMOKE_ADMIN_* too)
```
