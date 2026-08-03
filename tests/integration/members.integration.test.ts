// Members-screen data layer against the REAL (hosted) database, through the
// service layer. Self-skips unless SUPABASE_DB_URL and SUPABASE_SECRET_KEY are set
// and the schema is pushed. Every row created here is deleted in afterAll.
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ServiceError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const HAS_ENV = Boolean(process.env.SUPABASE_DB_URL && process.env.SUPABASE_SECRET_KEY);

async function schemaReady(): Promise<boolean> {
  if (!HAS_ENV) return false;
  try {
    // Probe the notes table specifically: it is the thing this suite is about, and
    // a project that has not run the member_notes migration should skip, not fail.
    const { error } = await createAdminClient().from("member_notes").select("id").limit(1);
    if (error) {
      console.warn(
        `[integration] skipping members suite — member_notes not reachable (${error.message}).`,
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
      members: await import("@/lib/services/members"),
      notes: await import("@/lib/services/notes"),
      volunteers: await import("@/lib/services/volunteers"),
      captains: await import("@/lib/services/captains"),
      payouts: await import("@/lib/services/payouts"),
      territories: await import("@/lib/services/territories"),
    }
  : null;

const S = () => services!;

const createdYearIds: string[] = [];
const created = {
  volunteerIds: [] as string[],
  captainIds: [] as string[],
  territoryIds: [] as string[],
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

/**
 * Marker on every fixture person this suite creates, so the afterAll sweep can
 * find its own strays. Deliberately NOT plain "IT": backend.integration.test.ts
 * uses that, and a sweep on "IT" would delete rows that suite is still using
 * (which is exactly what happened the first time this net was written).
 */
const TEST_FIRST_NAME = "ITMembers";

function unique(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

describe.skipIf(!RUN)("members list", () => {
  // ISOLATION: this suite shares the hosted database with other suites that create
  // and delete people while it runs. So every assertion is either a property of a
  // SINGLE read, or a statement about the fixture row this suite owns. Comparing
  // the contents of two independent reads is inherently racy here and was the
  // original source of a flake: a concurrently-created captain could appear in the
  // role-filtered read but not in the unfiltered one taken moments earlier.
  let fixtureCaptainId = "";
  let fixtureSurname = "";

  beforeAll(async () => {
    if (!RUN) return;
    fixtureSurname = unique("ZzListFixture");
    const captain = await S().captains.createCaptainRecord({
      firstName: TEST_FIRST_NAME,
      lastName: fixtureSurname,
      email: `${unique("it-listrole")}@example.com`,
      phone: "416-555-0410",
      payType: "bundle",
      payRate: 1,
      payCadence: "biweekly",
      startDate: "2026-01-01",
      endDate: null,
      note: null,
    });
    fixtureCaptainId = captain.id;
    created.captainIds.push(captain.id);
    if (captain.territory) created.territoryIds.push(captain.territory.id);
  });

  it("partitions by role, and the merged list contains both kinds", async () => {
    const [all, volunteersOnly, captainsOnly] = await Promise.all([
      S().members.listMembers({}),
      S().members.listMembers({ role: "volunteer" }),
      S().members.listMembers({ role: "captain" }),
    ]);

    // Properties of each single read: exhaustive and mutually exclusive roles.
    expect(volunteersOnly.every((m) => m.role === "volunteer")).toBe(true);
    expect(captainsOnly.every((m) => m.role === "captain")).toBe(true);
    expect(all.some((m) => m.role === "volunteer")).toBe(true);
    expect(all.some((m) => m.role === "captain")).toBe(true);

    // Statements about the row this suite owns, which nothing else touches.
    expect(all.some((m) => m.id === fixtureCaptainId && m.role === "captain")).toBe(true);
    expect(captainsOnly.some((m) => m.id === fixtureCaptainId)).toBe(true);
    expect(volunteersOnly.some((m) => m.id === fixtureCaptainId)).toBe(false);
  });

  it("filters by status, and every row carries a usable display shape", async () => {
    const retired = await S().members.listMembers({ status: "retired" });
    expect(retired.every((m) => m.status === "retired")).toBe(true);

    for (const m of await S().members.listMembers({})) {
      expect(m.name.trim().length).toBeGreaterThan(0);
      expect(m.routeInfo.trim().length).toBeGreaterThan(0);
      expect(m.captainName.trim().length).toBeGreaterThan(0);
      // ISO, so the UI can format it however it likes.
      expect(m.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("searches by name, case insensitively", async () => {
    // Searches for this suite's own unique surname, so the expected hit cannot be
    // deleted mid-test by another suite.
    const hits = await S().members.listMembers({ q: fixtureSurname.toUpperCase() });
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe(fixtureCaptainId);

    const lower = await S().members.listMembers({ q: fixtureSurname.toLowerCase() });
    expect(lower.map((m) => m.id)).toEqual([fixtureCaptainId]);

    const miss = await S().members.listMembers({ q: `${fixtureSurname}-nope` });
    expect(miss).toHaveLength(0);
  });

  it("gives a volunteer's route label, not just the street name", async () => {
    const volunteers = await S().volunteers.listVolunteers({});
    const withRoute = volunteers.find((v) => v.routesCarried.length === 1);
    if (!withRoute) return; // seed-dependent; nothing to assert against

    const route = withRoute.routesCarried[0];
    expect(route.label).toContain(route.streetName);
    expect(route.papers).toBeGreaterThan(0);
    expect(route.bundleCount).toBeGreaterThan(0);

    const row = (await S().members.listMembers({ role: "volunteer" })).find(
      (m) => m.id === withRoute.id,
    )!;
    expect(row.routeInfo).toBe(route.label);
  });
});

describe.skipIf(!RUN)("member notes", () => {
  it("creates, lists newest-first, edits and deletes", async () => {
    const captain = await S().captains.createCaptainRecord({
      firstName: TEST_FIRST_NAME,
      lastName: unique("Notes"),
      email: `${unique("it-notes")}@example.com`,
      phone: "416-555-0400",
      payType: "bundle",
      payRate: 1,
      payCadence: "biweekly",
      startDate: "2026-01-01",
      endDate: null,
      note: "Created with a note",
    });
    created.captainIds.push(captain.id);
    if (captain.territory) created.territoryIds.push(captain.territory.id);

    // The note supplied at creation became the captain's first note.
    let notes = await S().notes.listNotes("captain", captain.id);
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe("Created with a note");

    const second = await S().notes.createNoteRecord("captain", captain.id, { text: "Second note" });
    notes = await S().notes.listNotes("captain", captain.id);
    expect(notes).toHaveLength(2);
    // Newest first, which is the order the side panel prepends into.
    expect(notes[0].id).toBe(second.id);

    const edited = await S().notes.updateNoteRecord(second.id, { text: "Edited note" });
    expect(edited.text).toBe("Edited note");
    expect(edited.updatedAt).not.toBeNull();

    await S().notes.deleteNoteRecord(second.id);
    notes = await S().notes.listNotes("captain", captain.id);
    expect(notes).toHaveLength(1);
  });

  it("cascades notes when the person is deleted, rather than orphaning them", async () => {
    const captain = await S().captains.createCaptainRecord({
      firstName: TEST_FIRST_NAME,
      lastName: unique("Cascade"),
      email: `${unique("it-cascade")}@example.com`,
      phone: "416-555-0401",
      payType: "paper",
      payRate: 0.1,
      payCadence: "monthly",
      startDate: "2026-01-01",
      endDate: null,
      note: null,
    });
    const territoryId = captain.territory?.id;
    await S().notes.createNoteRecord("captain", captain.id, { text: "Doomed note" });
    expect(await S().notes.listNotes("captain", captain.id)).toHaveLength(1);

    const client = createAdminClient();
    if (territoryId) await client.from("captain_territories").delete().eq("id", territoryId);
    await client.from("captains").delete().eq("id", captain.id);

    const { data } = await client.from("member_notes").select("id").eq("captain_id", captain.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("404s for a person who does not exist, rather than returning an empty list", async () => {
    await expectServiceError(
      S().notes.listNotes("volunteer", "00000000-0000-4000-8000-000000000000"),
      404,
    );
  });

  it("rejects a blank note", async () => {
    const captain = await S().captains.createCaptainRecord({
      firstName: TEST_FIRST_NAME,
      lastName: unique("Blank"),
      email: `${unique("it-blank")}@example.com`,
      phone: "416-555-0402",
      payType: "drop",
      payRate: 2,
      payCadence: "biweekly",
      startDate: "2026-01-01",
      endDate: null,
      note: null,
    });
    created.captainIds.push(captain.id);
    if (captain.territory) created.territoryIds.push(captain.territory.id);

    // Whitespace-only text is blocked by the DB check even if validation is bypassed.
    const client = createAdminClient();
    const { error } = await client
      .from("member_notes")
      .insert({ captain_id: captain.id, text: "   " });
    expect(error).not.toBeNull();
  });

  it("refuses a note with two parents, and a note with none", async () => {
    const client = createAdminClient();
    const captain = await S().captains.createCaptainRecord({
      firstName: TEST_FIRST_NAME,
      lastName: unique("Parent"),
      email: `${unique("it-parent")}@example.com`,
      phone: "416-555-0403",
      payType: "bundle",
      payRate: 1,
      payCadence: "biweekly",
      startDate: "2026-01-01",
      endDate: null,
      note: null,
    });
    created.captainIds.push(captain.id);
    if (captain.territory) created.territoryIds.push(captain.territory.id);

    const volunteers = await S().volunteers.listVolunteers({});
    const volunteerId = volunteers[0]?.id;
    if (volunteerId) {
      const both = await client
        .from("member_notes")
        .insert({ captain_id: captain.id, volunteer_id: volunteerId, text: "two parents" });
      expect(both.error).not.toBeNull();
    }

    const neither = await client.from("member_notes").insert({ text: "no parents" });
    expect(neither.error).not.toBeNull();
  });
});

describe.skipIf(!RUN)("captain payout history", () => {
  // Builds its own captain, year and issues rather than sweeping every captain in
  // the database: other suites mutate shared rows concurrently, so a sweep can see
  // a payout vanish between the two reads it compares.
  it("agrees with the per-issue payout list, newest issue first", async () => {
    const captain = await S().captains.createCaptainRecord({
      firstName: TEST_FIRST_NAME,
      lastName: unique("History"),
      email: `${unique("it-history")}@example.com`,
      phone: "416-555-0420",
      payType: "bundle",
      payRate: 1.5,
      payCadence: "biweekly",
      startDate: "2026-01-01",
      endDate: null,
      note: null,
    });
    created.captainIds.push(captain.id);
    if (captain.territory) created.territoryIds.push(captain.territory.id);

    const years = await import("@/lib/services/financial-years");
    const issues = await import("@/lib/services/issues");

    const year = await years.createYear({
      name: `IT-HIST ${crypto.randomUUID().slice(0, 8)}`,
      startDate: "2026-01-01",
    });
    createdYearIds.push(year.id);

    // Two issues, so the newest-first ordering has something to order.
    await issues.createIssuesBatch(year.id, {
      issues: [
        { name: "Hist A", date: "2026-04-10" },
        { name: "Hist B", date: "2026-05-10" },
      ],
    });

    const history = await S().payouts.listCaptainPayoutHistory(captain.id);
    expect(history.length).toBe(2);

    // Newest issue date first.
    expect(history.map((h) => h.issueDate)).toEqual(["2026-05-10", "2026-04-10"]);
    expect(history.map((h) => h.issueName)).toEqual(["Hist B", "Hist A"]);

    // History must not re-derive amounts differently from the per-issue list.
    for (const entry of history) {
      const cells = await S().payouts.listPayouts(entry.issueId);
      const cell = cells.find((c) => c.id === entry.id);
      expect(cell).toBeDefined();
      expect(entry.amount).toBe(cell!.effectiveAmount);
      expect(entry.calculationStatus).toBe(cell!.calculationStatus);
      expect(entry.paid).toBe(cell!.paid);
    }

    // An override on one cell must show through in the history's amount too.
    const firstIssueId = history[0].issueId;
    const cell = (await S().payouts.listPayouts(firstIssueId)).find(
      (c) => c.captainId === captain.id,
    )!;
    await S().payouts.overridePayoutAmount(cell.id, { amount: 42.5, reason: "IT override" });

    const afterOverride = await S().payouts.listCaptainPayoutHistory(captain.id);
    const overridden = afterOverride.find((h) => h.issueId === firstIssueId)!;
    expect(overridden.amount).toBe(42.5);
    expect(overridden.calculationStatus).toBe("overridden");
    expect(overridden.overrideReason).toBe("IT override");
  });

  it("404s for an unknown captain", async () => {
    await expectServiceError(
      S().payouts.listCaptainPayoutHistory("00000000-0000-4000-8000-000000000000"),
      404,
    );
  });
});

describe.skipIf(!RUN)("commercial drop standing counts", () => {
  it("distinguishes a known count from an unknown one, and can be edited", async () => {
    const territories = await S().territories.listTerritories({});
    const withDrops = territories.find((t) => t.commercialDropCount > 0);
    if (!withDrops) return; // seed-dependent

    const detail = await S().territories.getTerritory(withDrops.id);
    expect(detail.commercialDrops.length).toBeGreaterThan(0);

    const drop = detail.commercialDrops[0];
    const original = drop.standingBundles;

    const updated = await S().territories.updateCommercialDropCount(withDrops.id, drop.id, {
      standingBundles: 7,
    });
    expect(updated.commercialDrops.find((d) => d.id === drop.id)?.standingBundles).toBe(7);

    // Null is a real value: "nobody has told us", not zero.
    const cleared = await S().territories.updateCommercialDropCount(withDrops.id, drop.id, {
      standingBundles: null,
    });
    expect(cleared.commercialDrops.find((d) => d.id === drop.id)?.standingBundles).toBeNull();

    await S().territories.updateCommercialDropCount(withDrops.id, drop.id, {
      standingBundles: original,
    });
  });

  it("404s when the drop is not in that territory", async () => {
    const territories = await S().territories.listTerritories({});
    if (territories.length === 0) return;
    await expectServiceError(
      S().territories.updateCommercialDropCount(
        territories[0].id,
        "00000000-0000-4000-8000-000000000000",
        { standingBundles: 1 },
      ),
      404,
    );
  });
});

afterAll(async () => {
  if (!RUN) return;
  const client = createAdminClient();
  // Years cascade to issues -> payouts + deliveries, so they go first.
  for (const id of createdYearIds) await client.from("financial_years").delete().eq("id", id);
  // Notes cascade with their parent, so they need no explicit cleanup.
  for (const id of created.volunteerIds) await client.from("volunteers").delete().eq("id", id);
  for (const id of created.addressIds) await client.from("addresses").delete().eq("id", id);
  for (const id of created.territoryIds)
    await client.from("captain_territories").delete().eq("id", id);
  for (const id of created.captainIds) await client.from("captains").delete().eq("id", id);

  // Safety net. A test that throws before pushing its id would otherwise leave a
  // row behind in the SHARED dev database forever, and that really happened while
  // this suite was being written. Sweep anything matching the fixture pattern, in
  // FK-safe order, so a failed run cannot silently pollute everyone's /members.
  const { data: strays } = await client
    .from("captains")
    .select("id")
    .eq("first_name", TEST_FIRST_NAME);
  const strayIds = ((strays ?? []) as { id: string }[]).map((c) => c.id);
  if (strayIds.length > 0) {
    await client.from("captain_payouts").delete().in("captain_id", strayIds);
    await client
      .from("captain_payouts")
      .update({ substitute_captain_id: null })
      .in("substitute_captain_id", strayIds);
    await client.from("captain_territories").delete().in("assigned_captain_id", strayIds);
    await client.from("captains").delete().in("id", strayIds);
  }

  const { data: strayVolunteers } = await client
    .from("volunteers")
    .select("id")
    .eq("first_name", TEST_FIRST_NAME);
  const strayVolunteerIds = ((strayVolunteers ?? []) as { id: string }[]).map((v) => v.id);
  if (strayVolunteerIds.length > 0) {
    await client.from("volunteer_routes").delete().in("assigned_volunteer_id", strayVolunteerIds);
    await client.from("volunteers").delete().in("id", strayVolunteerIds);
  }
});
