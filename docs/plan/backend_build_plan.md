# Backend Build Plan

The bridge from specs to code for the backend track. This is the "plan → tasks" step
of spec-driven development: the specs (PRD, flows, [data model](../schema/data_model.md),
[API spec](../api/api_spec.md), [infra spec](../infra/infrastructure_spec.md)) are the
durable artifacts; this sequences the work that turns them into a running backend.

**Division of labour.** This plan covers the **backend track** (one developer):
infrastructure, schema, endpoints, business logic, integrations, plus thin screens
to exercise the API. The **frontend design engineers** build the real UI separately
(vibe-coding the flows against Figma via the Figma MCP, debugging UX). The
[API spec](../api/api_spec.md) is the contract that lets the two tracks run in
parallel: once endpoint shapes are stable (Phase 3), the frontend can build against
them without waiting for every handler to be finished.

Phases are ordered by dependency, not time. Each lists a "done when" check (no
calendar estimates, per the project's no-cadence rule).

---

## Phase 0 — Repo scaffold

Stand up the skeleton from the infra spec.

- Next.js (App Router, TS strict, Turbopack) initialized with pnpm.
- ESLint (eslint-config-next) + Prettier; Tailwind + shadcn/ui.
- Vitest + Playwright configured; GitHub Actions CI (typecheck, lint, format, test, build).
- Supabase CLI initialized (`supabase/` with config); `.env.example` committed.
- Repo structure per infra spec section 3.

**Done when:** `pnpm install && supabase start && pnpm dev` boots the app locally, and CI is green on the empty project.

**FE picks up:** the shared shell (layout, theme, shadcn setup) once it exists.

---

## Phase 1 — Auth & session

- Supabase Auth (email + password + reset) wired.
- Next middleware + a server-side session helper protecting `/api/*` and protected pages (`401` when unauthenticated).
- A minimal login screen and "current admin" helper.
- Both admins full access (no role gating yet).

**Done when:** an admin can log in; protected endpoints/pages reject unauthenticated requests; the session is readable in route handlers.

**FE picks up:** the real login/auth screens; this phase only needs a functional stub.

---

## Phase 2 — Schema migrations & seed

Translate the data model into the database.

- SQL migrations under `supabase/migrations` for every entity in the [data model](../schema/data_model.md): tables, enums (matching the status types), foreign keys (child-side, per the data model's convention), indexes.
- `supabase/seed.sql` with a couple of admin users and a small sample set (volunteers, captains + territories, routes, a financial year + an open issue).
- Generate `types/` from the DB and cross-check against the data model.
- Enable PostGIS only if the house-count work starts here (otherwise defer to Phase 5).

**Done when:** `supabase db reset` builds the full schema + seed from scratch and generated types match the data model.

---

## Phase 3 — Core CRUD endpoints

Implement the standard List/Get/Create/Update/Delete handlers from the [API spec](../api/api_spec.md), domain by domain:

1. People — volunteers, captains, territories.
2. Routes — routes (+ vacancy/needs-attention filters).
3. Finance — financial years, issues, payouts (read + create scaffolding).
4. Delivery — route deliveries (read).

Each handler: Zod validation → `lib/services/` function → Supabase (service role) → `{ data }`/`{ error }` envelope. Shared Zod schemas in `lib/validation/`.

**Done when:** every collection has working CRUD with validation and the consistent envelope, behind the auth check, covered by endpoint tests.

**FE picks up:** this is the unblock point — with endpoint shapes stable, the frontend builds the list/detail/edit screens against the real API in parallel with Phases 4–7.

---

## Phase 4 — Custom actions & business logic

The state transitions and invariants that aren't plain CRUD (in `lib/services/`):

- **Issue lifecycle:** issues are created Open (creation auto-populates payouts + delivery rows and starts live calc); `close` (lock payout values + delivery actuals together; default payouts unpaid), `reopen`. Writes to a closed issue's deliveries rejected (`409`); payout edits are gated by paid status, not just issue state.
- **Payouts:** live calculation from pay config + delivery rollup (bundle auto-calc, missed deduction in the captain's pay unit); `override`/`clear-override` (reason kept, no prior-value audit; only while unpaid); `mark-paid`/`unmark-paid` (only when closed; paid locks the cell); `transfer` (reallocate a cell's amount to another captain, zero original).
- **Routes:** `assign`/`unassign`/`reassign`; suspended-as-derived-flag (assigned volunteer on vacation); hard `delete`.
- **People:** volunteer `vacation` (suspends routes, auto-resume) and `retire` (detaches routes → vacant); captain `retire` (territory becomes captain-less).

**Done when:** each transition enforces its invariant (verified by unit tests), matching the flow docs' state machines.

---

## Phase 5 — Google Maps integration

Server-side wrappers per the [Google research doc](../integrations/google_maps_research.md):

- `addresses/validate` (Address Validation, `regionCode: CA`, residential/commercial metadata) and `addresses/geocode` (place_id + cached coords + components).
- Persist `Address` + `GoogleMapsLocation` (durable `place_id`; lat/lng treated as a 30-day cache).
- A refresh job stub for cached coordinates older than ~25 days (evict past 30).
- `routes/nearest-vacant` via Compute Route Matrix (one origin → vacant-route destinations, ranked).
- Keys server-side and restricted; per-day quota caps set in Cloud Console.

**Done when:** the address-create path validates + geocodes and persists under the caching rules; nearest-vacant returns ranked routes.

---

## Phase 6 — Thin screens to exercise the API

Minimal, unstyled-beyond-shadcn screens so the backend is demonstrably usable end to end — **not** the final UI (the frontend engineers build that from Figma).

- People list/detail, routes list (+ vacant filter), the finance table (issues × captains), the delivery grid for an open issue.

**Done when:** each domain is reachable and CRUD-able through a barebones screen, exercising the real endpoints.

---

## Phase 7 — Tests & hardening

- Vitest endpoint/integration tests across the handlers and services (the transition invariants especially).
- A few Playwright smoke flows (log in → create a volunteer → assign a route; create an issue → record a delivery → see the payout).
- Confirm CI runs the full suite and coverage holds.

**Done when:** the suite runs green in CI and the core flows have smoke coverage.

---

## Not in this plan (deferred / other tracks)

- **Reporting dashboard** (read-only aggregate endpoints) — blocked on the finalized metrics list; add endpoints once specced. Cost figures read from the payouts built in Phase 4.
- **Label printing** (PRD Flow 6) — frontend-led; backend involvement is minimal and later.
- **All production UI** — the frontend design-engineer track, built from Figma against the API contract.
