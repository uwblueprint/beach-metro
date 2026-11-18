// The label sheet for a drop, against the REAL (hosted) database through the
// service layer. Self-skips unless SUPABASE_DB_URL and SUPABASE_SECRET_KEY are
// set and the drop_kind migration is applied. Every row created here is deleted
// in afterAll.
//
// This suite exists because the route-level tests cannot see it: a drop can
// carry the right kind, name and captain and still land in the wrong group on
// the sheet, since the sheet resolves all three for itself. The captain's pay
// and territory resolve the drop's captain for themselves too, so they are
// checked here as well.
// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";

import { today } from "@/lib/services/shared";
import { createAdminClient } from "@/lib/supabase/admin";

const HAS_ENV = Boolean(process.env.SUPABASE_DB_URL && process.env.SUPABASE_SECRET_KEY);

async function schemaReady(): Promise<boolean> {
  if (!HAS_ENV) return false;
  try {
    const { error } = await createAdminClient()
      .from("volunteer_routes")
      .select("drop_kind")
      .limit(1);
    if (error) {
      console.warn(`[integration] skipping labels suite — ${error.message}.`);
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
      labels: await import("@/lib/services/labels"),
      routes: await import("@/lib/services/routes"),
      issues: await import("@/lib/services/issues"),
      years: await import("@/lib/services/financial-years"),
      payouts: await import("@/lib/services/payouts"),
      addresses: await import("@/lib/services/addresses"),
      territories: await import("@/lib/services/territories"),
    }
  : null;

function S() {
  if (!services) throw new Error("services unavailable");
  return services;
}

/** Marker on every fixture row, so the afterAll sweep finds only its own. */
const TAG = "ITLABELS";
let seq = 0;
const unique = (label: string) => `${TAG}-${label}-${Date.now()}-${++seq}`;

const created = {
  yearIds: [] as string[],
  routeIds: [] as string[],
  captainIds: [] as string[],
  territoryIds: [] as string[],
};

async function makeCaptain(rtNumber: string, payType: "bundle" | "paper" | "drop" = "drop") {
  const name = unique("Cap");
  const { data, error } = await createAdminClient()
    .from("captains")
    .insert({
      first_name: TAG,
      last_name: name,
      display_name: `${TAG} ${name}`,
      email: `${name.toLowerCase()}@example.com`,
      phone: "416-555-0431",
      rt_number: rtNumber,
      pay_type: payType,
      pay_rate: 1,
      pay_cadence: "biweekly",
      start_date: "2026-01-01",
    })
    .select("id, display_name")
    .single();
  if (error) throw new Error(`captain fixture failed: ${error.message}`);
  created.captainIds.push(data.id);
  return data as { id: string; display_name: string };
}

const dropAddress = () => ({
  addressLines: [`${unique("Addr")} 1900 Queen St E`],
  locality: "Toronto",
  administrativeArea: "ON",
  regionCode: "CA" as const,
});

/** An issue of its own, so this suite never asserts against another's rows. */
async function makeIssue() {
  const year = await S().years.createYear({ name: unique("Year"), startDate: "2026-03-01" });
  created.yearIds.push(year.id);
  const [issue] = await S().issues.createIssuesBatch(year.id, {
    issues: [{ name: unique("Issue"), date: "2026-04-01" }],
  });
  return issue;
}

/**
 * A vacant street route gets no delivery of its own, so this suite gives it one
 * by hand. A carried route, drop or otherwise, is seeded by issue creation.
 */
async function deliver(issueId: string, routeId: string, papers: number) {
  const { error } = await createAdminClient()
    .from("route_deliveries")
    .insert({
      issue_id: issueId,
      route_id: routeId,
      paper_count: papers,
      bundles: [{ papers }],
      drop_count: 1,
      missed_count: 0,
    });
  if (error) throw new Error(`delivery fixture failed: ${error.message}`);
}

function findRoute(
  sheet: Awaited<ReturnType<typeof import("@/lib/services/labels").listLabels>>,
  routeId: string,
) {
  for (const group of sheet.groups) {
    const route = group.routes.find((r) => r.routeId === routeId);
    if (route) return { group, route };
  }
  return null;
}

afterAll(async () => {
  if (!RUN) return;
  const db = createAdminClient();
  for (const id of created.yearIds) await db.from("financial_years").delete().eq("id", id);
  for (const id of created.routeIds) {
    await db.from("route_deliveries").delete().eq("route_id", id);
    await db.from("volunteer_routes").delete().eq("id", id);
  }
  for (const id of created.territoryIds) await db.from("captain_territories").delete().eq("id", id);
  for (const id of created.captainIds) await db.from("captains").delete().eq("id", id);
});

describe.runIf(RUN)("a drop on the label sheet", () => {
  it("is given a delivery by issue creation, the same as a carried street route", async () => {
    const captain = await makeCaptain(unique("RT").slice(-8));
    const address = dropAddress();
    const drop = await S().routes.createRouteRecord({
      streetName: "Kingston Rd",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 50 }],
      assignedCaptainId: captain.id,
    });
    created.routeIds.push(drop.id);

    const issue = await makeIssue();
    const { data, error } = await createAdminClient()
      .from("route_deliveries")
      .select("route_id, paper_count")
      .eq("issue_id", issue.id)
      .eq("route_id", drop.id);
    if (error) throw new Error(error.message);

    // Seeding only routes with a volunteer left every drop without a delivery,
    // which kept them off the label sheet no matter how they were classified.
    expect(data).toHaveLength(1);
    expect(data![0].paper_count).toBe(50);
  });

  it("heads the group of the captain who carries it, with their RT", async () => {
    const captain = await makeCaptain(unique("RT").slice(-8));
    const address = dropAddress();
    const drop = await S().routes.createRouteRecord({
      streetName: "Kingston Rd",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 50 }],
      assignedCaptainId: captain.id,
      dropName: "Councillor's office",
    });
    created.routeIds.push(drop.id);

    // Issue creation seeds the delivery, which is the only reason the drop can
    // appear at all. Nothing is inserted by hand here.
    const issue = await makeIssue();
    const sheet = await S().labels.listLabels(issue.id);
    const found = findRoute(sheet, drop.id);

    // A drop holds no volunteer, so reading the carrier off one would file every
    // drop under Unassigned and print RTXX where the captain's number belongs.
    expect(found).not.toBeNull();
    expect(found!.group.captainId).toBe(captain.id);
    expect(found!.group.captainName).toBe(captain.display_name);
    expect(found!.group.rtNumber).not.toBeNull();
  });

  it("prints its own name and address, not a volunteer's", async () => {
    const captain = await makeCaptain(unique("RT").slice(-8));
    const address = dropAddress();
    const drop = await S().routes.createRouteRecord({
      streetName: "Kingston Rd",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 25 }],
      assignedCaptainId: captain.id,
      dropKind: "commercial",
      dropName: "Henley Gardens Pharmacy",
    });
    created.routeIds.push(drop.id);

    const issue = await makeIssue();
    const found = findRoute(await S().labels.listLabels(issue.id), drop.id)!;

    expect(found.route.type).toBe("commercial");
    expect(found.route.volunteerName).toBe("Henley Gardens Pharmacy");
    expect(found.route.address).not.toBeNull();
  });

  it("reports the kind it was given, so the pills can tell two drops apart", async () => {
    const captain = await makeCaptain(unique("RT").slice(-8));
    const address = dropAddress();
    const drop = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 25 }],
      assignedCaptainId: captain.id,
      dropKind: "residential",
    });
    created.routeIds.push(drop.id);

    const issue = await makeIssue();
    const found = findRoute(await S().labels.listLabels(issue.id), drop.id)!;

    expect(found.route.type).toBe("residential");
    // No name on file, so the label's name line stays empty rather than
    // inheriting a volunteer's.
    expect(found.route.volunteerName).toBeNull();
  });

  it("leaves a street route reading as Carrier", async () => {
    const route = await S().routes.createRouteRecord({
      streetName: "Lee Ave",
      startAddress: dropAddress(),
      endAddress: dropAddress(),
      houseCount: 20,
      bundles: [{ papers: 25 }],
    });
    created.routeIds.push(route.id);

    const issue = await makeIssue();
    await deliver(issue.id, route.id, 25);
    const found = findRoute(await S().labels.listLabels(issue.id), route.id)!;

    expect(found.route.type).toBe("carrier");
    // No volunteer and no captain, so it falls to the Unassigned pile.
    expect(found.group.captainId).toBeNull();
  });
});

describe.runIf(RUN)("a drop carried by a captain", () => {
  async function territoryFor(captainId: string) {
    const { data, error } = await createAdminClient()
      .from("captain_territories")
      .insert({ assigned_captain_id: captainId })
      .select("id")
      .single();
    if (error) throw new Error(`territory fixture failed: ${error.message}`);
    created.territoryIds.push(data.id);
    return data.id as string;
  }

  it("is paid to that captain and listed in their pay breakdown", async () => {
    const captain = await makeCaptain(unique("RT").slice(-8), "bundle");
    const address = dropAddress();
    const drop = await S().routes.createRouteRecord({
      streetName: "Kingston Rd",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 50 }, { papers: 25 }],
      assignedCaptainId: captain.id,
    });
    created.routeIds.push(drop.id);

    const issue = await makeIssue();
    const { data, error } = await createAdminClient()
      .from("captain_payouts")
      .select("id, calculated_amount")
      .eq("issue_id", issue.id)
      .eq("captain_id", captain.id)
      .single();
    if (error) throw new Error(error.message);

    // Two bundles at the fixture's rate of 1. A drop holds no volunteer, so
    // reaching its captain through a volunteer paid nothing for it.
    expect(Number(data.calculated_amount)).toBe(2);
    const detail = await S().payouts.getPayout(data.id);
    expect(detail.breakdown.perRoute.map((r) => r.routeId)).toEqual([drop.id]);
  });

  it("is counted and listed in that captain's territory", async () => {
    const captain = await makeCaptain(unique("RT").slice(-8));
    const territoryId = await territoryFor(captain.id);
    const address = dropAddress();
    const drop = await S().routes.createRouteRecord({
      streetName: "Kingston Rd",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 40 }],
      assignedCaptainId: captain.id,
      dropName: "Corner Store",
    });
    created.routeIds.push(drop.id);

    const detail = await S().territories.getTerritory(territoryId);
    expect(detail.carriedDrops).toEqual([{ id: drop.id, name: "Corner Store", papers: 40 }]);
    const summaries = await S().territories.listTerritories({});
    expect(summaries.find((t) => t.id === territoryId)?.carriedDropCount).toBe(1);
  });
});

describe.runIf(RUN)("an issue as large as the real roster", () => {
  it("reads the addresses of hundreds of routes in one call", async () => {
    const address = dropAddress();
    const drop = await S().routes.createRouteRecord({
      streetName: "Kingston Rd",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 25 }],
    });
    created.routeIds.push(drop.id);
    const { data, error } = await createAdminClient()
      .from("volunteer_routes")
      .select("start_address_id")
      .eq("id", drop.id)
      .single();
    if (error) throw new Error(error.message);

    // The sheet asks for every route's and carrier's address at once, about 450
    // on the office's roster, which is past what one request URL can carry.
    const ids = [...Array.from({ length: 599 }, () => crypto.randomUUID()), data.start_address_id];
    const details = await S().addresses.getAddressDetails(ids);
    expect(details.has(data.start_address_id)).toBe(true);
  });
});

describe.runIf(RUN)("the issue labels open on", () => {
  it("is the next open issue, not the last one created ahead", async () => {
    const date = today();
    const later = new Date(`${date}T12:00:00Z`);
    later.setUTCDate(later.getUTCDate() + 28);
    const year = await S().years.createYear({ name: unique("Year"), startDate: "2026-03-01" });
    created.yearIds.push(year.id);
    await S().issues.createIssuesBatch(year.id, {
      issues: [
        { name: unique("Next"), date },
        { name: unique("Later"), date: later.toISOString().slice(0, 10) },
      ],
    });

    // With a run created ahead of time, the newest open issue is not the one
    // whose bundles go out next.
    const resolved = await S().labels.resolveLabelIssue();
    expect(resolved.date).toBe(date);
  });
});
