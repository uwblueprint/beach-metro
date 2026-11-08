// Reading the office's roster sheet. Pure functions, no database and no file.
//
// The fixtures here are shaped like the real sheet but hold invented people.
// The real one holds 322 names and 310 home addresses and never enters the repo.
import { describe, expect, it } from "vitest";

import { parseCsv } from "@/scripts/lib/csv";
import {
  bundleSpec,
  isDropEntry,
  isTallyLine,
  pairMoved,
  quitKeys,
  readLabels,
  recipientKey,
} from "@/scripts/lib/labels";

const HEADER = [
  "Route",
  "Papers",
  "Name",
  "Address",
  "Bundles",
  "",
  "Phone",
  "Email",
  "Route",
  "NOTES",
  "Start Date",
];

/** One sheet row in column order, so a test reads like the spreadsheet does. */
function row(o: {
  rt?: string;
  papers?: string;
  name: string;
  address?: string;
  bundles?: string;
  phone?: string;
  email?: string;
  route?: string;
  notes?: string;
  startDate?: string;
}): string[] {
  return [
    o.rt ?? "01",
    o.papers ?? "50",
    o.name,
    o.address ?? "1 Queen St E",
    o.bundles ?? "",
    "",
    o.phone ?? "",
    o.email ?? "",
    o.route ?? "",
    o.notes ?? "",
    o.startDate ?? "",
  ];
}

describe("bundleSpec", () => {
  it("reads the marker that says a row is one bundle of several", () => {
    expect(bundleSpec("1 of 2")).toEqual({ index: 1, total: 2 });
    expect(bundleSpec("12 of 12")).toEqual({ index: 12, total: 12 });
  });

  it("tolerates the row that is missing its space", () => {
    expect(bundleSpec("1of 3")).toEqual({ index: 1, total: 3 });
  });

  it("reads a handling instruction as not a marker", () => {
    // These share the column with the markers, on bulk-drop rows only.
    expect(bundleSpec("Tie Loosely")).toBeNull();
    expect(bundleSpec("Open and leave in lobby")).toBeNull();
    expect(bundleSpec("")).toBeNull();
  });

  it("refuses a marker that counts past its own total", () => {
    expect(bundleSpec("3 of 2")).toBeNull();
    expect(bundleSpec("0 of 2")).toBeNull();
  });
});

describe("readLabels", () => {
  it("treats several rows with one name, RT and address as one person", () => {
    const { recipients } = readLabels([
      HEADER,
      row({ name: "Pat Carrier", papers: "55", bundles: "1 of 2" }),
      row({ name: "Pat Carrier", papers: "55", bundles: "2 of 2" }),
    ]);

    expect(recipients).toHaveLength(1);
    expect(recipients[0].displayName).toBe("Pat Carrier");
    expect(recipients[0].rowCount).toBe(2);
  });

  it("sums the papers across a person's rows, because each row is one bundle", () => {
    const { recipients } = readLabels([
      HEADER,
      row({ name: "Pat Carrier", papers: "55", bundles: "1 of 2" }),
      row({ name: "Pat Carrier", papers: "55", bundles: "2 of 2" }),
    ]);

    expect(recipients[0].papers).toBe(110);
  });

  it("rebuilds the split as 50s and 25s rather than keeping the office's sizes", () => {
    const { recipients } = readLabels([
      HEADER,
      row({ name: "Pat Carrier", papers: "55", bundles: "1 of 2" }),
      row({ name: "Pat Carrier", papers: "55", bundles: "2 of 2" }),
    ]);

    // Two bundles of 55 on the sheet, three here. The office ties one more.
    expect(recipients[0].bundles).toEqual([{ papers: 50 }, { papers: 50 }, { papers: 10 }]);
  });

  it("keeps two people apart when they share a name but not an address", () => {
    const { recipients } = readLabels([
      HEADER,
      row({ name: "Chris Lee", address: "1 Queen St E" }),
      row({ name: "Chris Lee", address: "9 Lee Ave" }),
    ]);

    expect(recipients).toHaveLength(2);
  });

  it("moves a handling instruction into the notes", () => {
    const { recipients } = readLabels([
      HEADER,
      row({ name: "Henley Pharmacy", bundles: "Tie Loosely", notes: "side door" }),
    ]);

    expect(recipients[0].notes).toContain("Tie Loosely");
    expect(recipients[0].notes).toContain("side door");
  });

  it("refuses a person with no address, since a volunteer record needs one", () => {
    const { recipients, rejected } = readLabels([
      HEADER,
      row({ name: "No Address Person", address: "" }),
    ]);

    expect(recipients).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toContain("no address");
    expect(rejected[0].firstRow).toBe(2);
  });

  it("holds back an entry the office marks as a business or a building", () => {
    const { recipients, drops } = readLabels([
      HEADER,
      row({ name: "Corner Store", route: "BUSINESS" }),
      row({ name: "Real Carrier", route: "Queen St. E. (Lee - Hammersmith)" }),
    ]);

    expect(recipients.map((r) => r.displayName)).toEqual(["Real Carrier"]);
    expect(drops.map((d) => d.displayName)).toEqual(["Corner Store"]);
  });

  it("holds back a school, church, library or hospital, since none of them carries a route", () => {
    for (const place of ["SCHOOL", "CHURCH", "LIBRARY", "HOSPITAL"]) {
      expect(isDropEntry(place)).toBe(true);
    }
  });

  it("reads the marker whatever case the office typed it in", () => {
    expect(isDropEntry("BUILDING")).toBe(true);
    expect(isDropEntry("Building")).toBe(true);
    // A street description is a carrier's route, not a marker.
    expect(isDropEntry("Kingston Rd. (Main - Woodbine)")).toBe(false);
    expect(isDropEntry(null)).toBe(false);
  });

  it("passes over the office's bundle tally without calling it a refused person", () => {
    const { recipients, rejected, tallyLines } = readLabels([
      HEADER,
      row({ name: "4 x 50's   3 x 25's", papers: "0", address: "" }),
      row({ name: "Real Person" }),
    ]);

    expect(recipients.map((r) => r.displayName)).toEqual(["Real Person"]);
    expect(rejected).toHaveLength(0);
    expect(tallyLines).toBe(1);
  });

  it("keeps a tally-shaped name that has an address, since then it is a recipient", () => {
    expect(isTallyLine(["01", "0", "4 x 50's 3 x 25's", "12 Main St."])).toBe(false);
  });

  it("refuses a person whose rows add up to no papers", () => {
    const { rejected } = readLabels([HEADER, row({ name: "Dormant Person", papers: "0" })]);

    expect(rejected[0].reason).toContain("no papers");
  });

  it("refuses a group whose bundle markers disagree with each other", () => {
    const { recipients, rejected } = readLabels([
      HEADER,
      row({ name: "Muddled Entry", bundles: "1 of 2" }),
      row({ name: "Muddled Entry", bundles: "2 of 3" }),
    ]);

    expect(recipients).toHaveLength(0);
    expect(rejected[0].reason).toContain("disagree");
  });

  it("skips a spacer row rather than making a person out of it", () => {
    const { recipients, rejected } = readLabels([HEADER, row({ name: "" }), row({ name: "Real" })]);

    expect(recipients).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("reports the row number someone would see in the spreadsheet", () => {
    const { recipients } = readLabels([
      HEADER,
      row({ name: "First" }),
      row({ name: "Second", address: "2 Lee Ave" }),
    ]);

    expect(recipients.find((r) => r.displayName === "Second")!.firstRow).toBe(3);
  });
});

describe("pairMoved", () => {
  const key = (name: string, rt: string, address: string) =>
    recipientKey(row({ name, rt, address }));

  it("pairs a carrier the office moved to another RT at the same house", () => {
    const before = key("Pat Lee", "22", "81 Queensbury Ave.");
    const after = key("Pat Lee", "23", "81 Queensbury Ave.");

    expect(pairMoved([before], [after])).toEqual(new Map([[after, before]]));
  });

  it("pairs a carrier whose address the office corrected on the same RT", () => {
    const before = key("Pat Lee", "15", "90 Edgewood Ave.");
    const after = key("Pat Lee", "15", "90 Edgewood Rd.");

    expect(pairMoved([before], [after])).toEqual(new Map([[after, before]]));
  });

  it("keeps apart a carrier who changed both RT and address, since only the name is left", () => {
    const before = key("Pat Lee", "22", "81 Queensbury Ave.");
    const after = key("Pat Lee", "23", "5 Lee Ave.");

    expect(pairMoved([before], [after]).size).toBe(0);
  });

  it("keeps apart a leaver and a newcomer on the same RT with different names", () => {
    const before = key("Pat Lee", "04", "179 Neville Park Blvd.");
    const after = key("Sam Roy", "04", "188 Neville Park Blvd.");

    expect(pairMoved([before], [after]).size).toBe(0);
  });

  it("pairs nobody when two newcomers could be the one who moved", () => {
    const before = key("Pat Lee", "22", "81 Queensbury Ave.");
    const first = key("Pat Lee", "23", "81 Queensbury Ave.");
    const second = key("Pat Lee", "22", "4 Lee Ave.");

    expect(pairMoved([before], [first, second]).size).toBe(0);
  });

  it("pairs nobody when two who left could be the one who moved", () => {
    const first = key("Pat Lee", "22", "81 Queensbury Ave.");
    const second = key("Pat Lee", "23", "4 Lee Ave.");
    const after = key("Pat Lee", "23", "81 Queensbury Ave.");

    expect(pairMoved([first, second], [after]).size).toBe(0);
  });
});

describe("quitKeys", () => {
  it("keys a QUITS row the way the roster keyed the same person", () => {
    const person = row({ name: "Pat Lee", rt: "07", address: "277 Lee Ave." });

    expect(quitKeys([person]).has(recipientKey(person))).toBe(true);
  });

  it("reads the first row as a person, since the sheet has no header", () => {
    expect(quitKeys([row({ name: "Pat Lee" }), row({ name: "Sam Roy" })]).size).toBe(2);
  });

  it("skips a spacer row", () => {
    expect(quitKeys([row({ name: "" })]).size).toBe(0);
  });
});

describe("parseCsv", () => {
  it("keeps a comma that belongs to an address", () => {
    expect(parseCsv('a,"1 Queen St E, Toronto",c')).toEqual([["a", "1 Queen St E, Toronto", "c"]]);
  });

  it("reads a doubled quote as one quote, which business names contain", () => {
    expect(parseCsv('"Joe ""Big"" Pizza",2')).toEqual([['Joe "Big" Pizza', "2"]]);
  });

  it("keeps empty trailing fields, since a blank column is still a column", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("does not invent a row for the newline that ends the file", () => {
    expect(parseCsv("a,b\nc,d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("handles a newline inside a quoted field", () => {
    expect(parseCsv('"line one\nline two",x')).toEqual([["line one\nline two", "x"]]);
  });
});
