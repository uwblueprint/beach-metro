// TEMPORARY PAGE — guided walkthrough definitions.
// Each step builds a real request (often from ids captured in earlier steps),
// says what to notice, and optionally expects a "failure" on purpose — the
// 409s ARE the business rules, so we show them off.

import { SEED } from "./catalog";

export type Ctx = Record<string, string>;

export interface StepRequest {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
}

export interface WalkthroughStep {
  title: string;
  /** What this step demonstrates — shown before running. */
  note: string;
  build: (ctx: Ctx) => StepRequest;
  /** Pull ids out of the response envelope for later steps. */
  extract?: (data: unknown, ctx: Ctx) => void;
  /** Expected status; defaults to 2xx. A step expecting 409 "passes" on 409. */
  expectStatus?: number;
  /** Shown after a successful run. */
  after?: string;
}

export interface Walkthrough {
  id: string;
  title: string;
  intro: string;
  steps: WalkthroughStep[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const d = (data: unknown) => data as any;

const uniq = () => Math.random().toString(36).slice(2, 6);
const todayPlus = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export const WALKTHROUGHS: Walkthrough[] = [
  {
    id: "finance",
    title: "Finance lifecycle — issue → live calc → override → transfer → close → paid",
    intro:
      "The heart of the system. You'll create an issue and watch payout cells and delivery rows appear automatically, change a delivery and watch the money recalculate live, override and transfer a payout, then close the issue and see the locks kick in.",
    steps: [
      {
        title: "Create a financial year",
        note: "A year is just a named table. Issues become its rows, captains its columns.",
        build: () => ({
          method: "POST",
          path: "/api/financial-years",
          body: { name: `Walkthrough ${uniq()}` },
        }),
        extract: (data, ctx) => {
          ctx.yearId = d(data).id;
        },
      },
      {
        title: "Create an issue — born Open",
        note: "No draft state (locked decision). Creation auto-creates a payout cell for every active captain and a delivery row for every carried route, seeded with the greedy 50/25 bundle split — then the live calculation runs.",
        build: (ctx) => ({
          method: "POST",
          path: `/api/financial-years/${ctx.yearId}/issues`,
          body: { issues: [{ name: "Walkthrough issue", date: todayPlus(0) }] },
        }),
        extract: (data, ctx) => {
          ctx.issueId = d(data)[0].id;
        },
        after: 'Notice the response: status is already "open".',
      },
      {
        title: "See the auto-created delivery rows",
        note: "One row per carried route (vacant + suspended routes are skipped). Marcus's Queen St E route has 70 standing papers → the greedy split seeded [50, 20] = 2 bundles.",
        build: (ctx) => ({ method: "GET", path: `/api/issues/${ctx.issueId}/deliveries` }),
        extract: (data, ctx) => {
          const row = d(data).find((x: any) => x.routeId === SEED.queenStRoute);
          if (row) ctx.deliveryId = row.id;
        },
      },
      {
        title: "See the auto-calculated payouts",
        note: "Emily is paid $1.25 per bundle across her territory's routes. Her cell was computed the moment the issue was created — no spreadsheet copy-paste.",
        build: (ctx) => ({ method: "GET", path: `/api/issues/${ctx.issueId}/payouts` }),
        extract: (data, ctx) => {
          const emily = d(data).find((x: any) => x.captainId === SEED.emily);
          const oliver = d(data).find((x: any) => x.captainId === SEED.oliver);
          if (emily) ctx.emilyPayoutId = emily.id;
          if (oliver) ctx.oliverPayoutId = oliver.id;
        },
      },
      {
        title: "Edit a delivery — watch the split reseed",
        note: "Bump Queen St E to 130 papers. The bundle breakdown reseeds to [50, 50, 25, 5] = 4 bundles, and Emily's payout recalculates instantly.",
        build: (ctx) => ({
          method: "PATCH",
          path: `/api/deliveries/${ctx.deliveryId}`,
          body: { paperCount: 130 },
        }),
        after: "Check bundles in the response — then look at the next step's amount.",
      },
      {
        title: "Emily's payout, recalculated — with the receipt",
        note: "The breakdown shows exactly how the number happened: per-route billable bundles × $1.25.",
        build: (ctx) => ({ method: "GET", path: `/api/payouts/${ctx.emilyPayoutId}` }),
      },
      {
        title: "Override the payout",
        note: "Manual amount + required reason. This is how donate-back and self-calculated captains are handled — no special model, just an override. The previous value is NOT audited (locked decision).",
        build: (ctx) => ({
          method: "POST",
          path: `/api/payouts/${ctx.emilyPayoutId}/override`,
          body: { amount: 20, reason: "Walkthrough demo override" },
        }),
        after: 'calculationStatus flipped to "overridden"; effectiveAmount is now 20.',
      },
      {
        title: "Transfer the payout to Oliver",
        note: "The reallocate-money feature: Oliver's cell is overridden UP by $20, Emily's is overridden to $0, both with auto-generated reasons. Undo = clear the overrides.",
        build: (ctx) => ({
          method: "POST",
          path: `/api/payouts/${ctx.emilyPayoutId}/transfer`,
          body: { toCaptainId: SEED.oliver },
        }),
        after: "The response is Emily's zeroed cell — note the reason text.",
      },
      {
        title: "Close the issue",
        note: "ONE close locks both sides at once: every payout value freezes and every delivery row locks. Paid/unpaid becomes toggleable.",
        build: (ctx) => ({ method: "POST", path: `/api/issues/${ctx.issueId}/close` }),
      },
      {
        title: "Try to edit the delivery anyway (this SHOULD fail)",
        note: "Expected result: 409 conflict. The amber error below is the invariant doing its job — actuals are immutable once closed.",
        expectStatus: 409,
        build: (ctx) => ({
          method: "PATCH",
          path: `/api/deliveries/${ctx.deliveryId}`,
          body: { dropCount: 1 },
        }),
      },
      {
        title: "Mark Oliver's payout paid",
        note: "A pure status marker — the amount never changes. Marking paid also LOCKS the cell from any further edits.",
        build: (ctx) => ({ method: "POST", path: `/api/payouts/${ctx.oliverPayoutId}/mark-paid` }),
      },
      {
        title: "Try to override the paid cell (this SHOULD fail)",
        note: "Expected: 409 — paid cells are locked until unmarked. That's the whole editability rule: unpaid = editable, paid = frozen.",
        expectStatus: 409,
        build: (ctx) => ({
          method: "POST",
          path: `/api/payouts/${ctx.oliverPayoutId}/override`,
          body: { amount: 1, reason: "should not work" },
        }),
      },
    ],
  },
  {
    id: "volunteer",
    title: "Volunteer lifecycle — create → carry a route → vacation → suspended → retire → vacant",
    intro:
      "How people-state ripples into routes. Status is never stored — it's derived from dates — and a vacation automatically suspends the routes they carry.",
    steps: [
      {
        title: "Create a volunteer",
        note: "The address goes through validation + geocoding (fake Maps provider for now) and is stored as a durable place_id.",
        build: (ctx) => {
          ctx.suffix = uniq();
          return {
            method: "POST",
            path: "/api/volunteers",
            body: {
              firstName: "Walkthrough",
              lastName: `Volunteer-${ctx.suffix}`,
              email: `walkthrough.${ctx.suffix}@example.com`,
              phone: "416-555-0142",
              address: { addressLines: ["31 Playground Cres"] },
              captainTerritoryId: SEED.emilyTerritory,
              startDate: todayPlus(0),
            },
          };
        },
        extract: (data, ctx) => {
          ctx.volunteerId = d(data).id;
        },
      },
      {
        title: "Assign them the vacant Beech Ave route",
        note: "Vacant → Assigned. (If this 409s, an earlier run already assigned it — hit “Reset sandbox data” up top and start over.)",
        build: (ctx) => ({
          method: "POST",
          path: `/api/routes/${SEED.beechAveRoute}/assign`,
          body: { volunteerId: ctx.volunteerId },
        }),
      },
      {
        title: "Send them on vacation",
        note: "A window that includes today. Watch their derived status flip to on-vacation in the response.",
        build: (ctx) => ({
          method: "POST",
          path: `/api/volunteers/${ctx.volunteerId}/vacation`,
          body: { vacationStart: todayPlus(-1), vacationEnd: todayPlus(6) },
        }),
      },
      {
        title: "The route is now Suspended — derived, not stored",
        note: "Nothing wrote a “suspended” flag anywhere. The route derives it from its carrier's vacation window; it auto-resumes when the window ends.",
        build: () => ({ method: "GET", path: `/api/routes/${SEED.beechAveRoute}` }),
        after:
          "suspended: true — and if an issue were created right now, this route would be skipped.",
      },
      {
        title: "Retire the volunteer",
        note: "Soft retire (history preserved). Their routes are detached and become Vacant immediately.",
        build: (ctx) => ({ method: "POST", path: `/api/volunteers/${ctx.volunteerId}/retire` }),
        after: "routesCarried is now empty.",
      },
      {
        title: "Beech Ave is vacant again",
        note: "Full circle — ready for the route-matching walkthrough below.",
        build: () => ({ method: "GET", path: `/api/routes/${SEED.beechAveRoute}` }),
      },
    ],
  },
  {
    id: "matching",
    title: "Route matching — nearest vacant routes for a volunteer",
    intro:
      "The recommendation feature for placing new volunteers: rank vacant routes by travel time from their home. (Distances come from the deterministic fake provider until Google keys exist — the ranking mechanics are real.)",
    steps: [
      {
        title: "Rank vacant routes near Marcus",
        note: "One call: Marcus's home coordinates against every vacant route's start point, sorted by drive time.",
        build: () => ({
          method: "GET",
          path: `/api/routes/nearest-vacant?volunteerId=${SEED.marcus}&limit=5`,
        }),
        extract: (data, ctx) => {
          const top = d(data)[0];
          if (top) ctx.topRouteId = top.route.id;
        },
        after: "Note distanceMeters / durationSeconds per candidate.",
      },
      {
        title: "Assign the closest one to Marcus",
        note: "In the real UI this is the “assign recommended route” button.",
        build: (ctx) => ({
          method: "POST",
          path: `/api/routes/${ctx.topRouteId}/assign`,
          body: { volunteerId: SEED.marcus },
        }),
      },
      {
        title: "Unassign it again (leave the sandbox tidy)",
        note: "Back to Vacant so the walkthrough can be re-run.",
        build: (ctx) => ({ method: "POST", path: `/api/routes/${ctx.topRouteId}/unassign` }),
      },
    ],
  },
];
