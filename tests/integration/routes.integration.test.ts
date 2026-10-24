// Drops on the routes screen, against the REAL (hosted) database through the
// service layer. Self-skips unless SUPABASE_DB_URL and SUPABASE_SECRET_KEY are
// set and the assigned_captain_id migration is applied. Every row created here
// is deleted in afterAll.
// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

const HAS_ENV = Boolean(process.env.SUPABASE_DB_URL && process.env.SUPABASE_SECRET_KEY);

async function schemaReady(): Promise<boolean> {
  if (!HAS_ENV) return false;
  try {
    // Probe assigned_captain_id: a project that has not run the
    // route_assigned_captain migration should skip, not fail.
    const { error } = await createAdminClient()
      .from("volunteer_routes")
      .select("assigned_captain_id")
      .limit(1);
    if (error) {
      console.warn(`[integration] skipping routes suite — ${error.message}.`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** The drop_kind migration is newer than the rest of this suite's schema. */
async function dropKindReady(): Promise<boolean> {
  if (!HAS_ENV) return false;
  try {
    const { error } = await createAdminClient()
      .from("volunteer_routes")
      .select("drop_kind")
      .limit(1);
    if (error) {
      console.warn(`[integration] skipping drop-kind tests — ${error.message}.`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const RUN = await schemaReady();
const RUN_KIND = RUN && (await dropKindReady());

const services = RUN
  ? {
      routes: await import("@/lib/services/routes"),
    }
  : null;

function S() {
  if (!services) throw new Error("services unavailable");
  return services;
}

/** Marker on every fixture row, so the afterAll sweep finds only its own. */
const TAG = "ITROUTES";
// Counter as well as the clock: two addresses built in the same millisecond
// would be byte-identical, and the service would correctly share one row for
// them, which is the opposite of what a two-endpoint route is testing.
let seq = 0;
const unique = (label: string) => `${TAG}-${label}-${Date.now()}-${++seq}`;

const created = { routeIds: [] as string[], captainIds: [] as string[] };

/**
 * Inserted straight through the admin client rather than the captains service,
 * so the fixture does not depend on the service's own create path staying put.
 */
async function makeCaptain(label: string) {
  const name = unique(label);
  const { data, error } = await createAdminClient()
    .from("captains")
    .insert({
      first_name: TAG,
      last_name: name,
      display_name: `${TAG} ${name}`,
      email: `${name.toLowerCase()}@example.com`,
      phone: "416-555-0431",
      pay_type: "drop",
      pay_rate: 1,
      pay_cadence: "biweekly",
      start_date: "2026-01-01",
    })
    .select("id")
    .single();
  if (error) throw new Error(`captain fixture failed: ${error.message}`);
  created.captainIds.push(data.id);
  return data.id as string;
}

const dropAddress = () => ({
  addressLines: [`${unique("Addr")} 1900 Queen St E`],
  locality: "Toronto",
  administrativeArea: "ON",
  regionCode: "CA" as const,
});

afterAll(async () => {
  if (!RUN) return;
  const db = createAdminClient();
  for (const id of created.routeIds) await db.from("volunteer_routes").delete().eq("id", id);
  for (const id of created.captainIds) await db.from("captains").delete().eq("id", id);
});

describe.runIf(RUN)("drops", () => {
  it("stores one address row for both endpoints and reports isDrop", async () => {
    const captainId = await makeCaptain("Drop");
    const address = dropAddress();

    const drop = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: address,
      endAddress: address,
      houseCount: 12,
      bundles: [{ papers: 50 }],
      assignedCaptainId: captainId,
    });
    created.routeIds.push(drop.id);

    expect(drop.isDrop).toBe(true);
    expect(drop.startAddress.id).toBe(drop.endAddress.id);
    expect(drop.captain?.id).toBe(captainId);
  });

  it("reads lifecycle off the captain, so a drop is not vacant", async () => {
    const captainId = await makeCaptain("Lifecycle");
    const address = dropAddress();

    const drop = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 25 }],
      assignedCaptainId: captainId,
    });
    created.routeIds.push(drop.id);

    // Lifecycle is volunteer-based for routes; a drop has no volunteer at all.
    expect(drop.assignedVolunteer).toBeNull();
    expect(drop.lifecycle).toBe("assigned");
  });

  it("keeps a drop a drop when its address moves", async () => {
    const captainId = await makeCaptain("Move");
    const address = dropAddress();

    const drop = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 25 }],
      assignedCaptainId: captainId,
    });
    created.routeIds.push(drop.id);

    const moved = await S().routes.updateRouteRecord(drop.id, { startAddress: dropAddress() });

    expect(moved.isDrop).toBe(true);
    expect(moved.startAddress.id).toBe(moved.endAddress.id);
    expect(moved.startAddress.id).not.toBe(drop.startAddress.id);
  });

  it("keeps two address rows for a street route, which is not a drop", async () => {
    const route = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: dropAddress(),
      endAddress: dropAddress(),
      houseCount: 30,
      bundles: [{ papers: 50 }],
    });
    created.routeIds.push(route.id);

    expect(route.isDrop).toBe(false);
    expect(route.startAddress.id).not.toBe(route.endAddress.id);
    expect(route.lifecycle).toBe("vacant");
  });

  it("refuses to carry a drop by a volunteer and a captain at once", async () => {
    const captainId = await makeCaptain("Both");
    await expect(
      S().routes.createRouteRecord({
        streetName: "Queen St E",
        startAddress: dropAddress(),
        endAddress: dropAddress(),
        houseCount: 0,
        bundles: [{ papers: 25 }],
        assignedVolunteerId: "00000000-0000-0000-0000-000000000000",
        assignedCaptainId: captainId,
      }),
    ).rejects.toThrow();
  });
});

describe.runIf(RUN_KIND)("drop kind and name", () => {
  it("defaults a new drop to commercial, which is where the office's records start", async () => {
    const captainId = await makeCaptain("KindDefault");
    const address = dropAddress();

    const drop = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 25 }],
      assignedCaptainId: captainId,
    });
    created.routeIds.push(drop.id);

    expect(drop.dropKind).toBe("commercial");
    expect(drop.dropName).toBeNull();
  });

  it("keeps the kind and the name it was created with", async () => {
    const captainId = await makeCaptain("KindGiven");
    const address = dropAddress();

    const drop = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 50 }],
      assignedCaptainId: captainId,
      dropKind: "residential",
      dropName: "Harbourview Apartments",
    });
    created.routeIds.push(drop.id);

    expect(drop.dropKind).toBe("residential");
    expect(drop.dropName).toBe("Harbourview Apartments");
  });

  it("leaves a street route without either, since it is always Carrier", async () => {
    const route = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: dropAddress(),
      endAddress: dropAddress(),
      houseCount: 30,
      bundles: [{ papers: 50 }],
    });
    created.routeIds.push(route.id);

    expect(route.isDrop).toBe(false);
    expect(route.dropKind).toBeNull();
    expect(route.dropName).toBeNull();
  });

  it("carries the kind and the name along when the drop moves", async () => {
    const captainId = await makeCaptain("KindMove");
    const address = dropAddress();

    const drop = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 25 }],
      assignedCaptainId: captainId,
      dropName: "Corner store",
    });
    created.routeIds.push(drop.id);

    // Two different endpoints do not split a drop in two. Both ends take the
    // first of them, so the drop moves and stays one place with one name.
    const moved = await S().routes.updateRouteRecord(drop.id, {
      startAddress: dropAddress(),
      endAddress: dropAddress(),
    });

    expect(moved.isDrop).toBe(true);
    expect(moved.startAddress.id).toBe(moved.endAddress.id);
    expect(moved.dropKind).toBe("commercial");
    expect(moved.dropName).toBe("Corner store");
  });

  it("classifies a street route that becomes a drop", async () => {
    const route = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: dropAddress(),
      endAddress: dropAddress(),
      houseCount: 12,
      bundles: [{ papers: 25 }],
    });
    created.routeIds.push(route.id);
    expect(route.dropKind).toBeNull();

    // Both endpoints named as one place: the route collapses to a drop, and a
    // drop must carry a kind for the labels screen to have anything to show.
    const sameAddress = dropAddress();
    const collapsed = await S().routes.updateRouteRecord(route.id, {
      startAddress: sameAddress,
      endAddress: sameAddress,
    });

    expect(collapsed.isDrop).toBe(true);
    expect(collapsed.dropKind).toBe("commercial");
  });

  it("reclassifies a drop without touching anything else", async () => {
    const captainId = await makeCaptain("KindEdit");
    const address = dropAddress();

    const drop = await S().routes.createRouteRecord({
      streetName: "Queen St E",
      startAddress: address,
      endAddress: address,
      houseCount: 0,
      bundles: [{ papers: 25 }],
      assignedCaptainId: captainId,
    });
    created.routeIds.push(drop.id);

    const moved = await S().routes.updateRouteRecord(drop.id, { dropKind: "residential" });

    expect(moved.dropKind).toBe("residential");
    expect(moved.isDrop).toBe(true);
    expect(moved.startAddress.id).toBe(drop.startAddress.id);
  });
});
