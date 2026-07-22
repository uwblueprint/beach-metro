// End-to-end business-invariant tests against the REAL (hosted) database, through
// the service layer. They self-skip unless SUPABASE_DB_URL and SUPABASE_SECRET_KEY
// are set in .env.local AND the schema has been pushed (pnpm db:push).
// Every row created here is deleted in afterAll.
// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";

import { ServiceError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const HAS_ENV = Boolean(process.env.SUPABASE_DB_URL && process.env.SUPABASE_SECRET_KEY);

// Env present isn't enough — the schema must actually be reachable (pushed).
// Probe one table so a fresh project skips cleanly instead of failing 40 ways.
async function schemaReady(): Promise<boolean> {
  if (!HAS_ENV) return false;
  try {
    const { error } = await createAdminClient().from("captains").select("id").limit(1);
    if (error) {
      console.warn(
        `[integration] skipping — schema not reachable (${error.message}). Run pnpm db:push.`,
      );
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const RUN = await schemaReady();

// Import services lazily so a missing env never breaks the unit-only run.
const services = RUN
  ? {
      captains: await import("@/lib/services/captains"),
      volunteers: await import("@/lib/services/volunteers"),
      routes: await import("@/lib/services/routes"),
      years: await import("@/lib/services/financial-years"),
      issues: await import("@/lib/services/issues"),
      payouts: await import("@/lib/services/payouts"),
      deliveries: await import("@/lib/services/deliveries"),
    }
  : null;

const S = () => services!;
const created = {
  captainIds: [] as string[],
  volunteerIds: [] as string[],
  routeIds: [] as string[],
  yearIds: [] as string[],
  addressIds: [] as string[],
};

async function expectServiceError(promise: Promise<unknown>, status: number): Promise<void> {
  try {
    await promise;
    expect.unreachable(`expected a ${status} ServiceError`);
  } catch (err) {
    expect(err).toBeInstanceOf(ServiceError);
    expect((err as ServiceError).status).toBe(status);
  }
}

describe.skipIf(!RUN)("backend business invariants (hosted DB)", () => {
  // Shared scenario state, built up across sequential tests.
  let bundleCaptainId: string; // pay: bundle @ 1.25
  let dropCaptainId: string; // pay: drop @ 2.00
  let territoryId: string;
  let volunteerId: string;
  let routeId: string;
  let vacantRouteId: string;
  let yearId: string;
  let issueId: string;
  let deliveryId: string;
  let bundlePayoutId: string;
  let dropPayoutId: string;

  it("creates captains with their 1:1 territories", async () => {
    const c1 = await S().captains.createCaptainRecord({
      firstName: "IT",
      lastName: "BundleCaptain",
      email: "it-bundle@example.com",
      phone: "416-555-0001",
      payType: "bundle",
      payRate: 1.25,
      payCadence: "weekly",
      startDate: "2026-01-01",
      endDate: null,
      note: null,
    });
    const c2 = await S().captains.createCaptainRecord({
      firstName: "IT",
      lastName: "DropCaptain",
      email: "it-drop@example.com",
      phone: "416-555-0002",
      payType: "drop",
      payRate: 2,
      payCadence: "biweekly",
      startDate: "2026-01-01",
      endDate: null,
      note: null,
    });
    created.captainIds.push(c1.id, c2.id);
    bundleCaptainId = c1.id;
    dropCaptainId = c2.id;
    expect(c1.territory).not.toBeNull();
    territoryId = c1.territory!.id;
  });

  it("creates a volunteer in the bundle captain's territory and routes", async () => {
    const v = await S().volunteers.createVolunteerRecord({
      firstName: "IT",
      lastName: "Volunteer",
      email: "it-volunteer@example.com",
      phone: "416-555-0003",
      address: { addressLines: ["12 Integration Ave"] },
      captainTerritoryId: territoryId,
      startDate: "2026-01-01",
      endDate: null,
      note: null,
    });
    volunteerId = v.id;
    created.volunteerIds.push(v.id);
    created.addressIds.push(v.address.id);
    expect(v.status).toBe("active");
    expect(v.territory?.id).toBe(territoryId);

    const r = await S().routes.createRouteRecord({
      startAddress: { addressLines: ["1 Integration St"] },
      endAddress: { addressLines: ["99 Integration St"] },
      streetName: "Integration St",
      side: "NORTH",
      assignedVolunteerId: volunteerId,
      houseCount: 60,
      papers: 130,
      note: null,
    });
    routeId = r.id;
    created.routeIds.push(r.id);
    created.addressIds.push(r.startAddress.id, r.endAddress.id);
    expect(r.lifecycle).toBe("assigned");
    expect(r.captain?.id).toBe(bundleCaptainId);

    const vacant = await S().routes.createRouteRecord({
      startAddress: { addressLines: ["2 Vacant Rd"] },
      endAddress: { addressLines: ["50 Vacant Rd"] },
      streetName: "Vacant Rd",
      side: null,
      assignedVolunteerId: null,
      houseCount: 20,
      papers: 40,
      note: null,
    });
    vacantRouteId = vacant.id;
    created.routeIds.push(vacant.id);
    created.addressIds.push(vacant.startAddress.id, vacant.endAddress.id);
    expect(vacant.lifecycle).toBe("vacant");
  });

  it("creates an issue born Open with seeded deliveries and payout cells", async () => {
    const year = await S().years.createYear({ name: `IT ${crypto.randomUUID().slice(0, 8)}` });
    yearId = year.id;
    created.yearIds.push(year.id);

    const [issue] = await S().issues.createIssuesBatch(yearId, {
      issues: [{ name: "IT Issue 1", date: "2026-07-09" }],
    });
    issueId = issue.id;
    expect(issue.status).toBe("open");

    // Issue creation is global (every currently-carried route gets seeded), so
    // seed.sql's own active routes (Marcus x2, Sofia) also get delivery rows
    // here alongside ours — find ours by routeId rather than assuming exclusivity.
    const deliveries = await S().deliveries.listDeliveries(issueId);
    const ourDelivery = deliveries.find((d) => d.routeId === routeId)!;
    expect(ourDelivery).toBeDefined();
    expect(ourDelivery.paperCount).toBe(130);
    expect(ourDelivery.bundles).toEqual([
      { papers: 50 },
      { papers: 50 },
      { papers: 25 },
      { papers: 5 },
    ]);
    expect(ourDelivery.bundleCount).toBe(4);
    deliveryId = ourDelivery.id;

    // Cells for every active captain (seed's 3 + our 2); live calc ran on ours:
    // 4 bundles × 1.25 = 5.00.
    const payouts = await S().payouts.listPayouts(issueId);
    const bundleCell = payouts.find((p) => p.captainId === bundleCaptainId)!;
    const dropCell = payouts.find((p) => p.captainId === dropCaptainId)!;
    expect(bundleCell.calculatedAmount).toBe(5);
    expect(bundleCell.effectiveAmount).toBe(5);
    expect(dropCell.calculatedAmount).toBe(0);
    bundlePayoutId = bundleCell.id;
    dropPayoutId = dropCell.id;

    // Self-consistent: papersToOrder must equal the sum of every delivery's
    // paperCount for the issue (seed's routes included), not just ours.
    const expectedTotal = deliveries.reduce((sum, d) => sum + d.paperCount, 0);
    expect((await S().issues.papersToOrder(issueId)).total).toBe(expectedTotal);
  });

  it("delivery edits reseed the split and re-run the live calc", async () => {
    const d = await S().deliveries.updateDeliveryRecord(deliveryId, { paperCount: 70 });
    expect(d.bundles).toEqual([{ papers: 50 }, { papers: 20 }]); // reseeded
    expect(d.bundleCount).toBe(2);

    let cell = await S().payouts.getPayout(bundlePayoutId);
    expect(cell.calculatedAmount).toBe(2.5); // 2 × 1.25

    // Manual bundle breakdown (irregular split) — count still derives.
    const manual = await S().deliveries.updateDeliveryRecord(deliveryId, {
      bundles: [{ papers: 40 }, { papers: 30 }],
    });
    expect(manual.paperCount).toBe(70);
    expect(manual.bundleCount).toBe(2);

    // Mismatched bundles rejected (422).
    await expectServiceError(
      S().deliveries.updateDeliveryRecord(deliveryId, { bundles: [{ papers: 10 }] }),
      422,
    );

    // Missed deducts in the captain's pay unit: (2 - 1) × 1.25.
    await S().deliveries.updateDeliveryRecord(deliveryId, { missedCount: 1 });
    cell = await S().payouts.getPayout(bundlePayoutId);
    expect(cell.calculatedAmount).toBe(1.25);
    expect(cell.breakdown.totalQuantity).toBe(1);
  });

  it("override and transfer follow the paid/unpaid editability rules", async () => {
    const overridden = await S().payouts.overridePayoutAmount(bundlePayoutId, {
      amount: 10,
      reason: "IT override",
    });
    expect(overridden.effectiveAmount).toBe(10);
    expect(overridden.calculationStatus).toBe("overridden");

    // Transfer to the drop captain: paired overrides.
    const source = await S().payouts.transferPayoutAmount(bundlePayoutId, {
      toCaptainId: dropCaptainId,
    });
    expect(source.effectiveAmount).toBe(0);
    expect(source.overrideReason).toContain("Transferred to");
    const recipient = await S().payouts.getPayout(dropPayoutId);
    expect(recipient.effectiveAmount).toBe(10);
    expect(recipient.overrideReason).toContain("transferred from");

    // Nothing left to transfer back (source is 0 now).
    await expectServiceError(
      S().payouts.transferPayoutAmount(bundlePayoutId, { toCaptainId: dropCaptainId }),
      409,
    );
  });

  it("close locks deliveries and enables paid; paid locks the cell", async () => {
    await S().issues.closeIssue(issueId);
    await expectServiceError(S().issues.closeIssue(issueId), 409); // already closed
    await expectServiceError(
      S().deliveries.updateDeliveryRecord(deliveryId, { dropCount: 1 }),
      409,
    ); // actuals locked

    const paid = await S().payouts.markPayoutPaid(dropPayoutId);
    expect(paid.paid).toBe(true);
    await expectServiceError(
      S().payouts.overridePayoutAmount(dropPayoutId, { amount: 1, reason: "x" }),
      409,
    ); // paid cell locked
    await expectServiceError(
      S().payouts.transferPayoutAmount(dropPayoutId, { toCaptainId: bundleCaptainId }),
      409,
    );

    // Unpaid cell IS still editable while closed (locked decision).
    const stillEditable = await S().payouts.overridePayoutAmount(bundlePayoutId, {
      amount: 3,
      reason: "post-close correction",
    });
    expect(stillEditable.effectiveAmount).toBe(3);
  });

  it("mark-paid requires a closed issue; reopen keeps paid cells frozen", async () => {
    await S().issues.reopenIssue(issueId);
    await expectServiceError(S().payouts.markPayoutPaid(bundlePayoutId), 409); // open again

    // Paid cell survived the reopen untouched.
    const paidCell = await S().payouts.getPayout(dropPayoutId);
    expect(paidCell.paid).toBe(true);
    expect(paidCell.effectiveAmount).toBe(10);

    const unmarked = await S().payouts.unmarkPayoutPaid(dropPayoutId);
    expect(unmarked.paid).toBe(false);
    await S().issues.closeIssue(issueId); // leave closed for cleanup realism
  });

  it("volunteer vacation suspends; retire detaches routes; soft delete hides", async () => {
    const onVacation = await S().volunteers.setVolunteerVacation(volunteerId, {
      vacationStart: "2020-01-01",
      vacationEnd: "2099-01-01",
    });
    expect(onVacation.status).toBe("on-vacation");
    const suspended = await S().routes.getRoute(routeId);
    expect(suspended.suspended).toBe(true);

    const retired = await S().volunteers.retireVolunteer(volunteerId);
    expect(retired.status).toBe("retired");
    expect(retired.routesCarried).toHaveLength(0);
    const detached = await S().routes.getRoute(routeId);
    expect(detached.lifecycle).toBe("vacant");
    await expectServiceError(S().volunteers.retireVolunteer(volunteerId), 409);
    await expectServiceError(
      S().routes.assignRouteVolunteer(routeId, volunteerId),
      409, // retired volunteers can't take routes
    );

    await S().routes.softDeleteRoute(vacantRouteId);
    const listed = await S().routes.listRoutes({});
    expect(listed.find((r) => r.id === vacantRouteId)).toBeUndefined();
    await expectServiceError(S().routes.getRoute(vacantRouteId), 404);
  });

  afterAll(async () => {
    if (!RUN) return;
    const client = createAdminClient();
    // FK-safe order; issues/payouts/deliveries cascade from the year.
    for (const id of created.yearIds) await client.from("financial_years").delete().eq("id", id);
    for (const id of created.routeIds) await client.from("volunteer_routes").delete().eq("id", id);
    for (const id of created.volunteerIds) await client.from("volunteers").delete().eq("id", id);
    for (const id of created.addressIds) await client.from("addresses").delete().eq("id", id);
    await client.from("captain_territories").delete().in("assigned_captain_id", created.captainIds);
    for (const id of created.captainIds) await client.from("captains").delete().eq("id", id);
  });
});
