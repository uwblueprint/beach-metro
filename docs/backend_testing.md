# Backend Testing Guide

How to verify the backend — what runs automatically, what each suite proves,
and how to re-test any behavior by hand later.

## One-time setup

1. `.env.local` (copy from `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY` (sb_secret_...), `SUPABASE_DB_URL` (Session pooler URI).
2. `pnpm db:push` — apply `supabase/migrations` to the hosted project.
3. `pnpm db:seed` — load the deterministic fixtures (fixed UUIDs).
4. `pnpm create-admin you@example.com <password>` — make a login.
5. Optional, for the smoke suite: add `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD`
   to `.env.local` (the admin from step 4).

## The suites

| Command | What it proves | Needs |
|---|---|---|
| `pnpm test` | Unit: pure business math + schema edges + the handler envelope. Integration: every state-machine invariant against the real DB (auto-skips without creds). | nothing / creds+push for integration |
| `pnpm smoke` | HTTP end-to-end: real login → every list endpoint 200, 401/404/422 envelope shapes, Maps provider path. Read-only, safe to rerun. | dev server env + SMOKE_ADMIN_* |
| `pnpm test:e2e` | UI smoke (login page renders) + the API smoke above. | same |
| `pnpm typecheck` / `lint` / `format:check` / `build` | Static gates (CI runs all of these + `pnpm test`). | nothing |

## What each automated test covers

**Unit — `tests/derive.test.ts`** (the money math):
greedy split (`130→[50,50,25,5]`, `70→[50,20]`, sums-back invariant, rejects
negatives/floats); missed-count deduction per pay unit with clamp-at-zero;
`rate × quantity` rounding to cents; zero-rate captains; volunteer status
window boundaries (inclusive) and needs-attention; effective amount /
calculation status / derived bundle count.

**Unit — `tests/maps-fake.test.ts`**: provider determinism (same address →
same place/coords), normalization, Beaches-area coords, component extraction,
route-matrix sanity.

**Unit — `tests/validation.test.ts`**: bundles-must-sum-to-paperCount,
empty-patch rejection, `bundleCount` not writable, vacation-window ordering,
AddressInput variants, nearest-vacant query rules, batch-create ≥ 1.

**Unit — `tests/api-handler.test.ts`**: 401 envelope when signed out, `{data}`
wrapping, zod → 422 with details, ServiceError → status/code, unexpected →
generic 500, empty-body tolerance.

**Integration — `tests/integration/backend.integration.test.ts`** (each maps to
a flow-doc invariant):

| Invariant (spec) | Verified by |
|---|---|
| Captain create ⇒ 1:1 empty territory (people 4g) | "creates captains…" |
| Issue born Open, cells for active captains, deliveries seeded w/ greedy split, vacant/suspended skipped (finance 4b, delivery 4a) | "creates an issue born Open…" |
| Delivery edit reseeds split unless bundles given; bundles must sum (422); live recalc; missed deducts in pay unit | "delivery edits reseed…" |
| Override / transfer-as-paired-overrides; zero-amount transfer rejected (finance 4d/4g) | "override and transfer…" |
| Close locks actuals (409) + enables paid; paid locks the cell; unpaid still editable after close (finance 4e/4f) | "close locks deliveries…" |
| Mark-paid only when closed; reopen keeps paid cells frozen (finance 3a/3c) | "mark-paid requires…" |
| Vacation ⇒ derived suspended; retire detaches routes ⇒ vacant; retired can't take routes; soft delete hides but 404s cleanly | "volunteer vacation suspends…" |

## Re-testing by hand (curl)

The API uses cookie sessions. Two options:

- **Easiest:** log in at `localhost:3000` in the browser, copy the `sb-…`
  cookies from DevTools → Application → Cookies, and pass them to curl:
  `curl -H "Cookie: sb-xxenwykmzugzlronzmdi-auth-token=…" localhost:3000/api/volunteers`
- **No cookie:** any `/api/*` call without one returns the 401 envelope —
  itself a useful check.

Recipes once authenticated (seed UUIDs are stable — see `supabase/seed.sql`):

```bash
B="localhost:3000/api"; C='Cookie: <paste sb cookies>'
curl -H "$C" "$B/volunteers?needsAttention=true"        # Liam (end date passed)
curl -H "$C" "$B/routes?vacancy=vacant"                 # seeded vacant routes
curl -H "$C" "$B/routes/nearest-vacant?volunteerId=d0000000-0000-4000-8000-000000000001"
curl -H "$C" -X POST "$B/financial-years/f0000000-0000-4000-8000-000000000001/issues" \
  -H 'Content-Type: application/json' -d '{"issues":[{"name":"July 9","date":"2026-07-09"}]}'
# grab ids from the response, then:
curl -H "$C" "$B/issues/<issueId>/payouts"              # live-calculated cells
curl -H "$C" -X PATCH "$B/deliveries/<deliveryId>" \
  -H 'Content-Type: application/json' -d '{"paperCount":70}'   # bundles reseed
curl -H "$C" -X POST "$B/issues/<issueId>/close"
curl -H "$C" -X POST "$B/payouts/<payoutId>/mark-paid"
curl -H "$C" "$B/financial-years/f0000000-0000-4000-8000-000000000001/export"  # CSV
```

Expected failure shapes worth spot-checking: PATCH a delivery on a closed
issue → `409 conflict`; override a paid cell → `409`; bundles that don't sum →
`422`; unknown UUID → `404`; malformed UUID → `422`.

## Interpretations under test

Implementation calls that went beyond the letter of the specs live in
[`design_decisions.md`](design_decisions.md) (backend-interpretations section);
each lists the covering test. If a client answer contradicts one, change the
service + its test together.
