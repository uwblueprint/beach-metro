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
  address: string;
  bundles?: string;
  phone?: string;
  note?: string;
}) {
  return [
    o.rt ?? "T1",
    "50",
    named(o.who),
    o.address,
    o.bundles ?? "",
    "",
    o.phone ?? "",
    "",
    "",
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
};

const NOTE = "Daughter is taking over the route.";

/** The next copy. One phone fixed, one carrier moved to T2, one note, two gone. */
const SECOND = {
  steady: FIRST.steady,
  phone: person({ who: "Phone", address: "12 Testing Ave.", phone: "416 555-0199" }),
  mover: person({ who: "Mover", rt: "T2", address: "13 Testing Ave." }),
  noted: person({ who: "Noted", address: "14 Testing Ave.", note: NOTE }),
  uncovered: FIRST.uncovered,
};

async function runImport(
  roster: string[][],
  quits: string[][],
  payments = PAYMENTS,
): Promise<{ captains: Outcome; people: Outcome }> {
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
  return { captains, people };
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
  let second: Outcome;
  let secondCaptains: Outcome;
  let third: Outcome;
  let thirdCaptains: Outcome;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ({ people: first, captains: firstCaptains } = await runImport(Object.values(FIRST), []));
    for (const who of ["Steady", "Phone", "Mover", "Noted", "Quitter", "Vanisher", "Uncovered"]) {
      ids[who] = await volunteerId(who);
    }
    // The office moves the quitter's row to QUITS, and the vanisher's row is
    // simply gone, as when the sheet is reorganised.
    ({ people: second, captains: secondCaptains } = await runImport(
      Object.values(SECOND),
      [FIRST.quitter],
      LATER_PAYMENTS,
    ));
    ({ people: third, captains: thirdCaptains } = await runImport(
      Object.values(SECOND),
      [FIRST.quitter],
      LATER_PAYMENTS,
    ));
  }, 120_000);

  it("creates everyone on the first copy", () => {
    expect(first.created).toBe(7);
  });

  it("holds back both halves of a route split across two addresses, rather than two people", () => {
    expect(first.splitRoutes).toHaveLength(2);
    expect(first.rejected.map((r) => r.name)).toEqual([named("Household"), named("Household")]);
    expect(first.rejected.every((r) => r.reason.includes("other bundles"))).toBe(true);
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
