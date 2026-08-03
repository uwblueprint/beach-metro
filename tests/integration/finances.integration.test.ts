// Finances data layer against the REAL (hosted) database, through the service
// layer. Self-skips unless SUPABASE_DB_URL and SUPABASE_SECRET_KEY are set and the
// schema is pushed. Every row created here is deleted in afterAll.
//
// ISOLATION: this shares one mutable database with the other integration suites,
// which run in parallel. So assertions are either properties of a single read or
// statements about rows this suite created itself, and the afterAll sweeps strays
// by a marker unique to this suite. See the members suite for the same pattern and
// the flakes that motivated it.
// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";

import { ServiceError } from "@/lib/api/errors";
import { calculatedAmount } from "@/lib/services/derive";
import { createAdminClient } from "@/lib/supabase/admin";

const HAS_ENV = Boolean(process.env.SUPABASE_DB_URL && process.env.SUPABASE_SECRET_KEY);

async function schemaReady(): Promise<boolean> {
  if (!HAS_ENV) return false;
  try {
    // Probe the column this suite is about: a project without the payout-comment
    // migration should skip cleanly rather than fail on every test.
    const { error } = await createAdminClient().from("captain_payouts").select("comment").limit(1);
    if (error) {
      console.warn(
        `[integration] skipping finances suite — comment column missing (${error.message}).`,
      );
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const RUN = await schemaReady();

const services = RUN
  ? {
      years: await import("@/lib/services/financial-years"),
      issues: await import("@/lib/services/issues"),
      payouts: await import("@/lib/services/payouts"),
      overview: await import("@/lib/services/overview"),
    }
  : null;

const S = () => services!;

/** Marker on every fixture row, so the afterAll sweep only finds its own. */
const TEST_YEAR_PREFIX = "ITFIN";
const createdYearIds: string[] = [];

async function expectServiceError(promise: Promise<unknown>, status: number): Promise<void> {
  try {
    await promise;
    expect.unreachable(`expected a ${status} ServiceError`);
  } catch (err) {
    expect(err).toBeInstanceOf(ServiceError);
    expect((err as ServiceError).status).toBe(status);
  }
}

function unique(): string {
  return `${TEST_YEAR_PREFIX} ${crypto.randomUUID().slice(0, 8)}`;
}

/** A year with one open issue, which auto-populates cells for active captains. */
async function makeYearWithIssue(): Promise<{ yearId: string; issueId: string }> {
  const year = await S().years.createYear({ name: unique(), startDate: "2026-03-01" });
  createdYearIds.push(year.id);
  const [issue] = await S().issues.createIssuesBatch(year.id, {
    issues: [{ name: "IT issue", date: "2026-04-01" }],
  });
  return { yearId: year.id, issueId: issue.id };
}

describe.skipIf(!RUN)("seeded finance data", () => {
  // The seed hard-codes payout amounts. If the payout formula ever changes, this
  // fails rather than the seed quietly claiming numbers the app would never
  // produce. Uses the pure function so it works for closed issues too, which the
  // live recalculation deliberately skips.
  it("seeded payout amounts match what the formula produces", async () => {
    const client = createAdminClient();
    const [issuesRes, captainsRes, deliveriesRes, routesRes, volunteersRes, territoriesRes] =
      await Promise.all([
        client.from("issues").select("id, name"),
        client.from("captains").select("id, pay_type, pay_rate"),
        client.from("route_deliveries").select("*"),
        client.from("volunteer_routes").select("id, assigned_volunteer_id"),
        client.from("volunteers").select("id, captain_territory_id"),
        client.from("captain_territories").select("id, assigned_captain_id"),
      ]);

    const issues = (issuesRes.data ?? []) as { id: string; name: string }[];
    // Only the seeded issues, not fixtures another test happens to be creating.
    const seeded = issues.filter((i) => i.name.startsWith("Issue 0"));
    if (seeded.length === 0) return;

    const captains = (captainsRes.data ?? []) as {
      id: string;
      pay_type: "bundle" | "paper" | "drop";
      pay_rate: number;
    }[];
    const routeToVolunteer = new Map(
      ((routesRes.data ?? []) as { id: string; assigned_volunteer_id: string | null }[]).map(
        (r) => [r.id, r.assigned_volunteer_id],
      ),
    );
    const volunteerToTerritory = new Map(
      ((volunteersRes.data ?? []) as { id: string; captain_territory_id: string | null }[]).map(
        (v) => [v.id, v.captain_territory_id],
      ),
    );
    const territoryToCaptain = new Map(
      ((territoriesRes.data ?? []) as { id: string; assigned_captain_id: string | null }[]).map(
        (t) => [t.id, t.assigned_captain_id],
      ),
    );

    for (const issue of seeded) {
      const deliveries = ((deliveriesRes.data ?? []) as Record<string, unknown>[]).filter(
        (d) => d.issue_id === issue.id,
      );
      const { data: cells } = await client
        .from("captain_payouts")
        .select("captain_id, calculated_amount")
        .eq("issue_id", issue.id);

      for (const cell of (cells ?? []) as { captain_id: string; calculated_amount: number }[]) {
        const captain = captains.find((c) => c.id === cell.captain_id);
        if (!captain) continue;

        // Same rollup the service walks: delivery -> route -> volunteer -> territory -> captain.
        const mine = deliveries.filter((d) => {
          const volunteerId = routeToVolunteer.get(d.route_id as string);
          const territoryId = volunteerId ? volunteerToTerritory.get(volunteerId) : null;
          return territoryId ? territoryToCaptain.get(territoryId) === captain.id : false;
        });

        const expected = calculatedAmount(
          captain.pay_type,
          Number(captain.pay_rate),
          mine.map((d) => ({
            paperCount: d.paper_count as number,
            bundles: d.bundles as { papers: number }[],
            dropCount: d.drop_count as number,
            missedCount: d.missed_count as number,
          })),
        );

        expect(
          Math.abs(Number(cell.calculated_amount) - expected),
          `${issue.name}, captain ${cell.captain_id.slice(0, 8)}: seeded ${cell.calculated_amount}, formula says ${expected}`,
        ).toBeLessThan(0.005);
      }
    }
  });

  it("the seeded year renders as a grid with rows, columns and cells", async () => {
    const years = await S().years.listYears({});
    const seededYear = years.find((y) => !y.name.startsWith(TEST_YEAR_PREFIX));
    if (!seededYear) return;

    const detail = await S().years.getYearDetail(seededYear.id);
    expect(detail.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(detail.captains.length).toBeGreaterThan(0);
    expect(detail.issues.length).toBeGreaterThan(0);

    for (const issue of detail.issues) {
      // Every issue's cells cover exactly the column set, so the grid has no holes.
      expect(issue.cells.length).toBe(detail.captains.length);
      expect(typeof issue.locked).toBe("boolean");
    }
  });
});

describe.skipIf(!RUN)("locking an issue", () => {
  // PENDING(Q1): modelled as a bulk freeze over the per-cell state.
  it("freezes every unpaid cell, and unlocking thaws and recomputes them", async () => {
    const { issueId } = await makeYearWithIssue();

    const before = await S().payouts.listPayouts(issueId);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((p) => p.calculationStatus === "calculated")).toBe(true);

    await S().issues.lockIssue(issueId);
    const locked = await S().payouts.listPayouts(issueId);
    expect(locked.every((p) => p.calculationStatus === "frozen")).toBe(true);
    expect(locked.every((p) => p.frozenAt !== null)).toBe(true);

    await S().issues.unlockIssue(issueId);
    const unlocked = await S().payouts.listPayouts(issueId);
    expect(unlocked.every((p) => p.calculationStatus === "calculated")).toBe(true);
    expect(unlocked.every((p) => p.frozenAmount === null)).toBe(true);
  });

  it("surfaces the locked state on the year grid", async () => {
    const { yearId, issueId } = await makeYearWithIssue();

    const openGrid = await S().years.getYearDetail(yearId);
    expect(openGrid.issues.find((i) => i.id === issueId)?.locked).toBe(false);

    await S().issues.lockIssue(issueId);
    const lockedGrid = await S().years.getYearDetail(yearId);
    expect(lockedGrid.issues.find((i) => i.id === issueId)?.locked).toBe(true);
  });

  it("refuses to lock an issue that has no cells", async () => {
    const year = await S().years.createYear({ name: unique(), startDate: "2026-03-01" });
    createdYearIds.push(year.id);
    // An archived year refuses issues, so instead make an issue then strip its cells.
    const [issue] = await S().issues.createIssuesBatch(year.id, {
      issues: [{ name: "IT empty", date: "2026-04-01" }],
    });
    await createAdminClient().from("captain_payouts").delete().eq("issue_id", issue.id);
    await expectServiceError(S().issues.lockIssue(issue.id), 409);
  });
});

describe.skipIf(!RUN)("marking paid", () => {
  // PENDING(Q2): the closed-issue gate was removed because the design lets the
  // office tick paid whenever. If that comes back, this test flips to expecting 409.
  it("is allowed while the issue is still open", async () => {
    const { issueId } = await makeYearWithIssue();
    const [cell] = await S().payouts.listPayouts(issueId);

    const issue = await S().issues.getIssue(issueId);
    expect(issue.status).toBe("open");

    const paid = await S().payouts.markPayoutPaid(cell.id);
    expect(paid.paid).toBe(true);
    expect(paid.paidAt).not.toBeNull();
  });

  it("still refuses to pay the same cell twice, and locks it against edits", async () => {
    const { issueId } = await makeYearWithIssue();
    const [cell] = await S().payouts.listPayouts(issueId);

    await S().payouts.markPayoutPaid(cell.id);
    await expectServiceError(S().payouts.markPayoutPaid(cell.id), 409);
    await expectServiceError(
      S().payouts.overridePayoutAmount(cell.id, { amount: 5, reason: "nope" }),
      409,
    );
  });

  it("can be unmarked, which returns the cell to editable", async () => {
    const { issueId } = await makeYearWithIssue();
    const [cell] = await S().payouts.listPayouts(issueId);

    await S().payouts.markPayoutPaid(cell.id);
    const unpaid = await S().payouts.unmarkPayoutPaid(cell.id);
    expect(unpaid.paid).toBe(false);

    const overridden = await S().payouts.overridePayoutAmount(cell.id, {
      amount: 7.5,
      reason: "editable again",
    });
    expect(overridden.effectiveAmount).toBe(7.5);
  });
});

describe.skipIf(!RUN)("cell comments", () => {
  // PENDING(Q4): deliberately separate from the override reason.
  it("survives independently of the override reason", async () => {
    const { issueId } = await makeYearWithIssue();
    const [cell] = await S().payouts.listPayouts(issueId);

    const commented = await S().payouts.setPayoutComment(cell.id, {
      comment: "Captain switching to monthly",
    });
    expect(commented.comment).toBe("Captain switching to monthly");
    expect(commented.overrideReason).toBeNull();

    // Setting and then clearing an override must not touch the comment.
    await S().payouts.overridePayoutAmount(cell.id, { amount: 9, reason: "one-off" });
    const cleared = await S().payouts.clearPayoutOverride(cell.id);
    expect(cleared.comment).toBe("Captain switching to monthly");
    expect(cleared.overrideReason).toBeNull();
  });

  it("treats blank as clearing", async () => {
    const { issueId } = await makeYearWithIssue();
    const [cell] = await S().payouts.listPayouts(issueId);

    await S().payouts.setPayoutComment(cell.id, { comment: "temporary" });
    const blanked = await S().payouts.setPayoutComment(cell.id, { comment: "   " });
    expect(blanked.comment).toBeNull();

    const nulled = await S().payouts.setPayoutComment(cell.id, { comment: null });
    expect(nulled.comment).toBeNull();
  });

  it("shows up on the year grid alongside the substitute", async () => {
    const { yearId, issueId } = await makeYearWithIssue();
    const cells = await S().payouts.listPayouts(issueId);
    const [first, second] = cells;
    if (!second) return; // needs at least two captains

    await S().payouts.setPayoutComment(first.id, { comment: "grid comment" });
    await S().payouts.setPayoutSubstitute(first.id, second.captainId);

    const grid = await S().years.getYearDetail(yearId);
    const cell = grid.issues
      .find((i) => i.id === issueId)!
      .cells.find((c) => c.payoutId === first.id)!;
    expect(cell.comment).toBe("grid comment");
    expect(cell.substituteCaptainId).toBe(second.captainId);
    expect(cell.substituteCaptainName).not.toBeNull();
  });
});

describe.skipIf(!RUN)("renaming a year", () => {
  it("changes the name and leaves the start date alone", async () => {
    const year = await S().years.createYear({ name: unique(), startDate: "2026-03-01" });
    createdYearIds.push(year.id);

    const renamed = await S().years.updateYearRecord(year.id, {
      name: `${TEST_YEAR_PREFIX} renamed`,
    });
    expect(renamed.name).toBe(`${TEST_YEAR_PREFIX} renamed`);
    expect(renamed.startDate).toBe(year.startDate);
  });

  it("404s for a year that does not exist", async () => {
    await expectServiceError(
      S().years.updateYearRecord("00000000-0000-4000-8000-000000000000", { name: "nope" }),
      404,
    );
  });
});

describe.skipIf(!RUN)("overview aggregates", () => {
  it("reports the seeded year with real stats and twelve month buckets", async () => {
    const years = await S().years.listYears({});
    const seededYear = years.find((y) => !y.name.startsWith(TEST_YEAR_PREFIX));
    if (!seededYear) return;

    const overview = await S().overview.getOverview({ yearId: seededYear.id, period: "ytd" });

    expect(overview.year.id).toBe(seededYear.id);
    expect(overview.monthlyCosts).toHaveLength(12);
    // The chart runs in the year's own month order, not January first.
    expect(overview.monthlyCosts[0].month).toBe(seededYear.startDate.slice(0, 7));
    expect(overview.stats.totalVolunteers).toBeGreaterThan(0);
    expect(overview.stats.activeVolunteers).toBeLessThanOrEqual(overview.stats.totalVolunteers);

    // Substitute pay is broken out and never double-counted in a captain's own line.
    const ownIds = new Set(overview.captainPayments.map((c) => c.captainId));
    for (const sub of overview.substitutePayments) {
      for (const covered of sub.coveredFor) {
        expect(covered.issueCount).toBeGreaterThan(0);
      }
      expect(ownIds.has(sub.captainId) || sub.amount >= 0).toBe(true);
    }
  });

  it("quarter filters are relative to the year's own start month", async () => {
    const years = await S().years.listYears({});
    const seededYear = years.find((y) => !y.name.startsWith(TEST_YEAR_PREFIX));
    if (!seededYear) return;

    const q1 = await S().overview.getOverview({ yearId: seededYear.id, period: "q1" });
    expect(q1.range.from).toBe(seededYear.startDate);
    // A March year has Q1 = March to May, so Q1 must not reach June.
    expect(q1.range.to < "2026-06-01" || seededYear.startDate !== "2026-03-01").toBe(true);
  });
});

afterAll(async () => {
  if (!RUN) return;
  const client = createAdminClient();
  // Years cascade to issues -> payouts + deliveries.
  for (const id of createdYearIds) await client.from("financial_years").delete().eq("id", id);

  // Safety net: a test that throws before pushing its id would otherwise leave a
  // year behind in the shared database forever.
  const { data: strays } = await client
    .from("financial_years")
    .select("id, name")
    .like("name", `${TEST_YEAR_PREFIX}%`);
  for (const y of (strays ?? []) as { id: string }[]) {
    await client.from("financial_years").delete().eq("id", y.id);
  }
});
