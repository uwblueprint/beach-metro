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

const RUN = await schemaReady();

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
 * Inserted straight through the admin client rather than the captains service.
 * The hosted schema carries display_name NOT NULL from an unmerged branch, and
 * the service on this branch does not set it, so a created captain would 422.
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
