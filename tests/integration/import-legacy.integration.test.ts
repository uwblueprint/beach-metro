// The legacy importer run against the REAL (hosted) database three times, the way
// newer copies of the office workbook arrive. Self-skips unless SUPABASE_DB_URL and
// SUPABASE_SECRET_KEY are set and the import ledger exists. Addresses resolve
// through the fake maps provider, which the app always uses under vitest, and the
// ledger rows go under this run's own source names, apart from the real import's.
// Every row created here is deleted in afterAll.
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Options, Outcome } from "@/scripts/import-legacy";
import { readCaptains } from "@/scripts/lib/captains";

const HAS_ENV = Boolean(process.env.SUPABASE_DB_URL && process.env.SUPABASE_SECRET_KEY);

async function schemaReady(): Promise<boolean> {
  if (!HAS_ENV) return false;
  try {
    const { error } = await createAdminClient().from("import_rows").select("source").limit(1);
    if (error) {
      console.warn(
        `[integration] skipping import suite — import_rows not reachable (${error.message}).`,
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
      importer: await import("@/scripts/import-legacy"),
      notes: await import("@/lib/services/notes"),
      routes: await import("@/lib/services/routes"),
      volunteers: await import("@/lib/services/volunteers"),
    }
  : null;

const S = () => services!;

/** Marks every person and ledger row this run makes, so cleanup takes only those. */
const RUN_ID = crypto.randomUUID().slice(0, 8);
const SOURCE = { captains: `it-import-${RUN_ID}-captains`, people: `it-import-${RUN_ID}-people` };
const named = (who: string) => `ITImport ${who} ${RUN_ID}`;

const OPTIONS: Options = {
  apply: true,
  checkAddresses: true,
  only: ["captains", "people"],
  limit: null,
};

/** The captain block of a payments sheet, two captains and an area nobody covers. */
const PAYMENTS = [
  ["RT", "", "Captain", "", "", "", "Per", "Rate", "Car"],
  ["T1", "", named("Captain One"), "", "", "", "bundle", "1", ""],
  ["T2", "", named("Captain Two"), "", "", "", "bundle", "1", ""],
  ["T9", "", "No Captain", "", "", "", "N/A", "0", ""],
];

/** The next copy, where the second captain also takes an area paid per paper. */
const LATER_PAYMENTS = [
  ...PAYMENTS,
  ["T3", "", named("Captain Two"), "", "", "", "paper", "0.18", ""],
];

const ROSTER_HEADER = ["Route", "Papers", "Name", "Address", "Bundles", "", "Phone", "Email"];

/** One roster row in the sheet's column order. */
function person(o: {
  who: string;
  rt?: string;
  papers?: string;
  address: string;
  bundles?: string;
  phone?: string;
  route?: string;
  note?: string;
}) {
  return [
    o.rt ?? "T1",
    o.papers ?? "50",
    named(o.who),
    o.address,
    o.bundles ?? "",
    "",
    o.phone ?? "",
    "",
    o.route ?? "",
    o.note ?? "",
    "2026-01-06",
  ];
}

const FIRST = {
  steady: person({ who: "Steady", address: "11 Testing Ave." }),
  phone: person({ who: "Phone", address: "12 Testing Ave.", phone: "416 555-0101" }),
  mover: person({ who: "Mover", address: "13 Testing Ave." }),
  noted: person({ who: "Noted", address: "14 Testing Ave." }),
  quitter: person({ who: "Quitter", address: "15 Testing Ave." }),
  vanisher: person({ who: "Vanisher", address: "16 Testing Ave." }),
  uncovered: person({ who: "Uncovered", rt: "T9", address: "17 Testing Ave." }),
  // One household's route, its two bundles under two spellings of its address.
  splitFirst: person({ who: "Household", address: "18 Testing Ave.", bundles: "1 of 2" }),
  splitSecond: person({ who: "Household", address: "18 Testing Avenue", bundles: "2 of 2" }),
  shop: person({ who: "Corner Shop", address: "20 Testing Ave.", route: "BUSINESS" }),
  flats: person({ who: "Flats", rt: "T2", address: "21 Testing Ave.", route: "BUILDING" }),
  // A captain who delivers a route of their own is on the roster too.
  captainRoute: person({ who: "Captain One", address: "22 Testing Ave." }),
  converted: person({ who: "Converted", address: "23 Testing Ave." }),
};

const NOTE = "Daughter is taking over the route.";

/** The next copy. One phone fixed, one carrier moved to T2, one note, two gone. */
const SECOND = {
  steady: FIRST.steady,
  phone: person({ who: "Phone", address: "12 Testing Ave.", phone: "416 555-0199" }),
  mover: person({ who: "Mover", rt: "T2", address: "13 Testing Ave." }),
  noted: person({ who: "Noted", address: "14 Testing Ave.", note: NOTE }),
  uncovered: FIRST.uncovered,
  shop: FIRST.shop,
  flats: person({
    who: "Flats",
    rt: "T2",
    papers: "75",
    address: "21 Testing Ave.",
    route: "BUILDING",
  }),
  captainRoute: FIRST.captainRoute,
  converted: FIRST.converted,
};

async function runImport(
  roster: string[][],
  quits: string[][],
  payments = PAYMENTS,
): Promise<{ captains: Outcome; people: Outcome; drops: Outcome }> {
  const territories = new Map<string, string>();
  const { byRt } = readCaptains(payments);
  const captains = await S().importer.importCaptains(
    payments,
    OPTIONS,
    territories,
    SOURCE.captains,
  );
  const people = await S().importer.importPeople(
    [ROSTER_HEADER, ...roster],
    quits,
    OPTIONS,
    byRt,
    territories,
    SOURCE.people,
  );
  const drops = await S().importer.importDrops(
    [ROSTER_HEADER, ...roster],
    OPTIONS,
    byRt,
    SOURCE.people,
    SOURCE.captains,
  );
  return { captains, people, drops };
}

/** The drop-off the ledger holds for a fixture entry, by the name it was given. */
async function dropId(who: string): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("import_rows")
    .select("source_key, entity_id")
    .eq("source", SOURCE.people)
    .eq("entity_type", "drop");
  if (error) throw new Error(error.message);
  const matches = data.filter((r) => r.source_key.startsWith(`${named(who).toLowerCase()}|`));
  expect(matches).toHaveLength(1);
  return matches[0].entity_id;
}

/** The captain the ledger holds for a fixture captain, by the name it was given. */
async function captainId(who: string): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("import_rows")
    .select("entity_id")
    .eq("source", SOURCE.captains)
    .eq("source_key", named(who).toLowerCase());
  if (error) throw new Error(error.message);
  expect(data).toHaveLength(1);
  return data[0].entity_id;
}

/** The volunteer the ledger holds for a fixture person, by the name it was given. */
async function volunteerId(who: string): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("import_rows")
    .select("source_key, entity_id")
    .eq("source", SOURCE.people);
  if (error) throw new Error(error.message);
  const matches = data.filter((r) => r.source_key.startsWith(`${named(who).toLowerCase()}|`));
  expect(matches).toHaveLength(1);
  return matches[0].entity_id;
}

afterAll(async () => {
  if (!RUN) return;
  const client = createAdminClient();
  const { data: ledger } = await client
    .from("import_rows")
    .select("entity_type, entity_id")
    .in("source", [SOURCE.captains, SOURCE.people]);
  const { data: strayDrops } = await client
    .from("volunteer_routes")
    .select("id")
    .like("drop_name", `ITImport % ${RUN_ID}`);
  const routeIds = [
    ...(ledger ?? []).filter((r) => r.entity_type === "drop").map((r) => r.entity_id),
    ...((strayDrops ?? []) as { id: string }[]).map((r) => r.id),
  ];
  const { data: stops } = await client
    .from("volunteer_routes")
    .select("start_address_id")
    .in("id", routeIds);
  await client.from("route_deliveries").delete().in("route_id", routeIds);
  await client.from("volunteer_routes").delete().in("id", routeIds);
  const stopIds = ((stops ?? []) as { start_address_id: string }[]).map((s) => s.start_address_id);
  await client.from("addresses").delete().in("id", stopIds);

  const { data: strays } = await client
    .from("volunteers")
    .select("id")
    .like("display_name", `ITImport % ${RUN_ID}`);
  const volunteerIds = [
    ...(ledger ?? []).filter((r) => r.entity_type === "volunteer").map((r) => r.entity_id),
    ...((strays ?? []) as { id: string }[]).map((v) => v.id),
  ];
  const { data: homes } = await client
    .from("volunteers")
    .select("address_id")
    .in("id", volunteerIds);
  // Notes cascade with their volunteer, so they need no explicit cleanup.
  await client.from("volunteers").delete().in("id", volunteerIds);
  const addressIds = ((homes ?? []) as { address_id: string }[]).map((h) => h.address_id);
  await client.from("addresses").delete().in("id", addressIds);

  const { data: captains } = await client
    .from("captains")
    .select("id")
    .like("display_name", `ITImport % ${RUN_ID}`);
  const captainIds = ((captains ?? []) as { id: string }[]).map((c) => c.id);
  await client.from("captain_payouts").delete().in("captain_id", captainIds);
  await client.from("captain_territories").delete().in("assigned_captain_id", captainIds);
  await client.from("captains").delete().in("id", captainIds);

  await client.from("import_rows").delete().in("source", [SOURCE.captains, SOURCE.people]);
});

describe.skipIf(!RUN)("a later copy of the workbook", () => {
  let first: Outcome;
  let firstCaptains: Outcome;
  let firstDrops: Outcome;
  let second: Outcome;
  let secondCaptains: Outcome;
  let secondDrops: Outcome;
  let third: Outcome;
  let thirdCaptains: Outcome;
  let thirdDrops: Outcome;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ({
      people: first,
      captains: firstCaptains,
      drops: firstDrops,
    } = await runImport(Object.values(FIRST), []));
    for (const who of [
      "Steady",
      "Phone",
      "Mover",
      "Noted",
      "Quitter",
      "Vanisher",
      "Uncovered",
      "Converted",
    ]) {
      ids[who] = await volunteerId(who);
    }

    // A person turns a carrier who is really a business into a drop-off by hand,
    // pointing the roster entry's ledger row at the new drop.
    const converted = await S().volunteers.getVolunteer(ids.Converted);
    const place = { placeId: converted.address.placeId };
    const drop = await S().routes.createRouteRecord({
      startAddress: place,
      endAddress: place,
      streetName: "Testing Ave",
      houseCount: 0,
      papers: 50,
      dropName: named("Converted"),
    });
    await S().volunteers.deleteVolunteer(ids.Converted);
    await createAdminClient()
      .from("import_rows")
      .update({ entity_type: "drop", entity_id: drop.id })
      .eq("source", SOURCE.people)
      .eq("entity_id", ids.Converted);

    // The office moves the quitter's row to QUITS, and the vanisher's row is
    // simply gone, as when the sheet is reorganised.
    ({
      people: second,
      captains: secondCaptains,
      drops: secondDrops,
    } = await runImport(Object.values(SECOND), [FIRST.quitter], LATER_PAYMENTS));
    ({
      people: third,
      captains: thirdCaptains,
      drops: thirdDrops,
    } = await runImport(Object.values(SECOND), [FIRST.quitter], LATER_PAYMENTS));
  }, 180_000);

  it("creates everyone on the first copy", () => {
    expect(first.created).toBe(8);
  });

  it("holds back both halves of a route split across two addresses, rather than two people", () => {
    expect(first.splitRoutes).toHaveLength(2);
    const held = first.rejected.filter((r) => r.reason.includes("other bundles"));
    expect(held.map((r) => r.name)).toEqual([named("Household"), named("Household")]);
  });

  it("keeps a captain who delivers a route as the captain, not a second record", async () => {
    const refused = first.rejected.find((r) => r.name === named("Captain One"));
    expect(refused?.reason).toContain("captain");
    const { data } = await createAdminClient()
      .from("volunteers")
      .select("id")
      .eq("display_name", named("Captain One"));
    expect(data).toEqual([]);
  });

  it("brings in the roster's drop-offs, carried by the captain of their area", async () => {
    expect(firstDrops.created).toBe(2);
    const shop = await S().routes.getRoute(await dropId("Corner Shop"));
    expect(shop.isDrop).toBe(true);
    expect(shop.dropKind).toBe("commercial");
    expect(shop.dropName).toBe(named("Corner Shop"));
    expect(shop.captain?.id).toBe(await captainId("Captain One"));
    const flats = await S().routes.getRoute(await dropId("Flats"));
    expect(flats.dropKind).toBe("residential");
    expect(flats.captain?.id).toBe(await captainId("Captain Two"));
  });

  it("updates a drop-off whose papers changed, and leaves the rest alone", async () => {
    expect(secondDrops.updated).toBe(1);
    expect(secondDrops.unchanged).toBe(1);
    expect((await S().routes.getRoute(await dropId("Flats"))).papers).toBe(75);
    expect(thirdDrops.created + thirdDrops.updated).toBe(0);
    expect(thirdDrops.unchanged).toBe(2);
  });

  it("leaves an entry made a drop-off by hand as a drop-off", async () => {
    const skipped = second.rejected.find((r) => r.name === named("Converted"));
    expect(skipped?.reason).toContain("drop-off by hand");
    const { data } = await createAdminClient()
      .from("volunteers")
      .select("id")
      .eq("display_name", named("Converted"));
    expect(data).toEqual([]);
  });

  it("brings in a carrier from an area nobody covers without a captain", async () => {
    expect(firstCaptains.created).toBe(2);
    expect(firstCaptains.uncovered).toEqual(["T9"]);
    expect((await S().volunteers.getVolunteer(ids.Uncovered)).territory).toBeNull();
  });

  it("adds a captain's new area and its pay to their notes once", async () => {
    const captain = await captainId("Captain Two");
    expect(secondCaptains.updated).toBe(1);
    expect(secondCaptains.notesAdded).toBe(1);
    expect(thirdCaptains.notesAdded).toBe(0);
    const notes = await S().notes.listNotes("captain", captain);
    expect(notes.map((n) => n.text)).toEqual(["Also covers RT T3. Paid $0.18 per paper in RT T3."]);
  });

  it("keeps a carrier moved to another RT as the same person, under the new captain", async () => {
    expect(second.created).toBe(0);
    expect(second.moved).toEqual([named("Mover")]);
    expect(await volunteerId("Mover")).toBe(ids.Mover);

    const mover = await S().volunteers.getVolunteer(ids.Mover);
    const steady = await S().volunteers.getVolunteer(ids.Steady);
    expect(mover.territory?.id).toBeDefined();
    expect(mover.territory?.id).not.toBe(steady.territory?.id);
  });

  it("patches a changed phone without looking the unchanged address up again", async () => {
    expect(second.updated).toBe(3);
    expect(second.unchanged).toBe(2);
    expect(second.lookups).toBe(0);
    expect((await S().volunteers.getVolunteer(ids.Phone)).phone).toBe("416 555-0199");
  });

  it("adds a note that appeared on the sheet to the person's notes", async () => {
    expect(second.notesAdded).toBe(1);
    const notes = await S().notes.listNotes("volunteer", ids.Noted);
    expect(notes.map((n) => n.text)).toEqual([NOTE]);
  });

  it("retires someone the office moved to QUITS", async () => {
    expect(second.retired).toEqual([named("Quitter")]);
    expect((await S().volunteers.getVolunteer(ids.Quitter)).status).toBe("retired");
  });

  it("leaves someone who vanished without reaching QUITS active, and lists them", async () => {
    expect(second.disappeared).toHaveLength(1);
    expect(second.disappeared[0].startsWith(named("Vanisher").toLowerCase())).toBe(true);
    expect((await S().volunteers.getVolunteer(ids.Vanisher)).status).toBe("active");
  });

  it("changes nothing when the same copy is imported again", async () => {
    expect(third.created).toBe(0);
    expect(third.updated).toBe(0);
    expect(third.unchanged).toBe(5);
    expect(third.lookups).toBe(0);
    expect(third.notesAdded).toBe(0);
    expect(third.retired).toEqual([]);
    expect(third.moved).toEqual([]);
    const notes = await S().notes.listNotes("volunteer", ids.Noted);
    expect(notes).toHaveLength(1);
  });
});
