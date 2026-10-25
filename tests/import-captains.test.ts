// Reading the captain roster and deciding whether an address is safe to store.
// Pure functions, no database and no geocoder. Fixtures are invented people.
import { describe, expect, it } from "vitest";

import { checkResolved, checkSource, looksLikeStreetAddress } from "@/scripts/lib/address";
import { readCaptains } from "@/scripts/lib/captains";
import { hash } from "@/scripts/lib/ledger";

const HEADER = ["RT", "$", "CPT", "B", "D", "P", "PER", "Rate", "Car", "per copy"];

function row(o: { rt: string; name: string; per?: string; rate?: string; car?: string }): string[] {
  return ["", "", o.name, "", "", "", o.per ?? "Bundle", o.rate ?? "1.25", o.car ?? "0", ""].map(
    (v, i) => (i === 0 ? o.rt : v),
  );
}

describe("readCaptains", () => {
  it("collapses a captain who holds several RT codes into one person", () => {
    const { captains } = readCaptains([
      HEADER,
      row({ rt: "31", name: "Wally Driver" }),
      row({ rt: "41", name: "Wally Driver" }),
      row({ rt: "51", name: "Wally Driver" }),
    ]);

    expect(captains).toHaveLength(1);
    expect(captains[0].rtCodes).toEqual(["31", "41", "51"]);
  });

  it("records the codes it cannot store, since a captain gets one", () => {
    const { captains } = readCaptains([
      HEADER,
      row({ rt: "31", name: "Wally Driver" }),
      row({ rt: "41", name: "Wally Driver" }),
    ]);

    expect(captains[0].notes.join(" ")).toContain("Also covers RT 41");
  });

  it("maps every RT code to its captain, so a person can be placed", () => {
    const { byRt } = readCaptains([
      HEADER,
      row({ rt: "31", name: "Wally Driver" }),
      row({ rt: "41", name: "Wally Driver" }),
      row({ rt: "02", name: "Dana Walker" }),
    ]);

    expect(byRt.get("31")).toBe(byRt.get("41"));
    expect(byRt.get("02")).not.toBe(byRt.get("31"));
  });

  it("translates the sheet's pay basis into what the app stores", () => {
    const { captains } = readCaptains([
      HEADER,
      row({ rt: "01", name: "Bundle Person", per: "Bundle" }),
      row({ rt: "02", name: "Paper Person", per: "Paper" }),
      row({ rt: "03", name: "Drop Person", per: "Dropoff" }),
    ]);

    expect(captains.map((c) => c.payType)).toEqual(["bundle", "paper", "drop"]);
  });

  it("reads a pay basis of N/A as taking nothing, and says so in the notes", () => {
    const { captains } = readCaptains([
      HEADER,
      row({ rt: "18", name: "No Arrangement", per: "N/A", rate: "1.50" }),
    ]);

    expect(captains[0].payRate).toBe(0);
    expect(captains[0].notes.join(" ")).toContain("N/A");
  });

  it("keeps a car allowance in the notes, since a payout has nowhere for it", () => {
    const { captains } = readCaptains([
      HEADER,
      row({ rt: "91", name: "Driving Person", car: "50" }),
    ]);

    expect(captains[0].notes.join(" ")).toContain("$50");
  });

  it("refuses a pay rate that is not a number rather than storing a guess", () => {
    const { captains, rejected } = readCaptains([
      HEADER,
      row({ rt: "07", name: "Odd Rate", rate: "ask susan" }),
    ]);

    expect(captains).toHaveLength(0);
    expect(rejected[0].reason).toContain("not a number");
  });
});

describe("address checks", () => {
  it("passes a street address and refuses a place name, before any lookup", () => {
    expect(looksLikeStreetAddress("1230 Kingston Rd")).toBe(true);
    expect(looksLikeStreetAddress("Shoppers World")).toBe(false);
    expect(checkSource("Goodwood Park").ok).toBe(false);
    expect(checkSource("12 Willow Ave").ok).toBe(true);
  });

  const clean = {
    nextAction: "ACCEPT" as const,
    houseNumberReplaced: false,
    streetUnclear: false,
  };

  it("says a free refusal cost nothing, which is the point of checking first", () => {
    const verdict = checkSource("Shoppers World");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.billed).toBe(false);
  });

  it("refuses a result that came back as a street rather than a building", () => {
    const verdict = checkResolved("danforth dont want", {
      streetNumber: null,
      doubts: clean,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("point at the wrong place");
  });

  it("refuses a result whose house number the geocoder swapped", () => {
    const verdict = checkResolved("1230 Kingston Rd", {
      streetNumber: "1232",
      doubts: { ...clean, houseNumberReplaced: true },
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("swapped the house number");
  });

  it("refuses a result that resolved against a street nobody wrote down", () => {
    const verdict = checkResolved("360 Lake Front, Foot of Beech Ave.", {
      streetNumber: "360",
      doubts: { ...clean, streetUnclear: true },
    });
    expect(verdict.ok).toBe(false);
  });

  it("refuses a result the geocoder asks to have corrected", () => {
    const verdict = checkResolved("7 Balsam Ave., Unit 4", {
      streetNumber: "7",
      doubts: { ...clean, nextAction: "FIX" },
    });
    expect(verdict.ok).toBe(false);
  });

  it("accepts an apartment the geocoder cannot verify, since it never can", () => {
    // Google reports every unit as unconfirmed because it cannot see inside a
    // building, and the street address below it is right.
    expect(
      checkResolved("11 Main St. #601", {
        streetNumber: "11",
        doubts: { ...clean, nextAction: "CONFIRM" },
      }).ok,
    ).toBe(true);
  });

  it("accepts a clean result", () => {
    expect(checkResolved("1230 Kingston Rd", { streetNumber: "1230", doubts: clean }).ok).toBe(
      true,
    );
  });
});

describe("hash", () => {
  it("changes when any field changes, which is what decides a row is stale", () => {
    expect(hash(["a", "b"])).toBe(hash(["a", "b"]));
    expect(hash(["a", "b"])).not.toBe(hash(["a", "c"]));
  });

  it("does not confuse two fields with one joined field", () => {
    // Without a separator no field can contain, ["a","b"] and ["ab"] would hash
    // the same, and a real edit would read as no change at all.
    expect(hash(["a", "b"])).not.toBe(hash(["ab"]));
  });

  it("treats a missing value as different from an empty one being absent", () => {
    expect(hash(["a", null])).toBe(hash(["a", ""]));
    expect(hash(["a", null])).not.toBe(hash(["a"]));
  });
});
