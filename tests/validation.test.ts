// Request-schema edge cases that guard business rules at the boundary.
import { describe, expect, it } from "vitest";

import { addressInput } from "@/lib/validation/common";
import { updateDelivery } from "@/lib/validation/delivery";
import { createIssues } from "@/lib/validation/finance";
import { exportLabels } from "@/lib/validation/labels";
import { createCaptain, createVolunteer, setVacation } from "@/lib/validation/people";
import { createRoute, nearestVacantQuery, updateRoute } from "@/lib/validation/routes";

describe("updateDelivery", () => {
  it("accepts bundles that sum to the same-request paperCount", () => {
    const parsed = updateDelivery.parse({
      paperCount: 70,
      bundles: [{ papers: 50 }, { papers: 20 }],
    });
    expect(parsed.paperCount).toBe(70);
  });

  it("rejects bundles that do not sum to the same-request paperCount", () => {
    expect(() =>
      updateDelivery.parse({ paperCount: 70, bundles: [{ papers: 50 }, { papers: 25 }] }),
    ).toThrow();
  });

  it("rejects an empty patch", () => {
    expect(() => updateDelivery.parse({})).toThrow();
  });

  it("rejects non-positive bundle sizes and unknown bundleCount writes", () => {
    expect(() => updateDelivery.parse({ bundles: [{ papers: 0 }] })).toThrow();
    // bundleCount is derived — the schema has no such field, so it is ignored
    const parsed = updateDelivery.parse({ dropCount: 3, bundleCount: 99 });
    expect("bundleCount" in parsed).toBe(false);
  });
});

describe("captain RT number", () => {
  const captain = {
    displayName: "Wally Hucker",
    payType: "bundle" as const,
    payRate: 1.25,
    payCadence: "biweekly" as const,
    startDate: "2026-01-06",
  };

  // Text, not a number: the office prints the leading zero, and one captain's
  // designation is a span of driven routes.
  it("keeps a leading zero and accepts a range", () => {
    expect(createCaptain.parse({ ...captain, rtNumber: "01" }).rtNumber).toBe("01");
    expect(createCaptain.parse({ ...captain, rtNumber: "31-71" }).rtNumber).toBe("31-71");
  });

  it("is optional — a captain can exist before the office assigns one", () => {
    expect(createCaptain.parse(captain).rtNumber).toBeUndefined();
  });

  it("rejects a blank number rather than storing whitespace", () => {
    expect(() => createCaptain.parse({ ...captain, rtNumber: "   " })).toThrow();
  });
});

describe("label export", () => {
  const bundles = [{ deliveryId: "11111111-1111-4111-8111-111111111111", bundleIndex: 0 }];

  it("defaults to the open issue when no issue is named", () => {
    expect(exportLabels.parse({ bundles }).issueId).toBeUndefined();
  });

  it("carries an issue id for a reprint", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(exportLabels.parse({ bundles, issueId: id }).issueId).toBe(id);
  });

  // Exporting the whole issue by accident wastes a stack of label stock.
  it("still refuses an empty selection", () => {
    expect(() => exportLabels.parse({ bundles: [] })).toThrow();
  });
});

describe("recipient display name", () => {
  const base = {
    address: { street: "1 Queen St E", placeId: "place-1" },
    startDate: "2026-01-06",
  };

  it("composes a person's display name from first and last", () => {
    const parsed = createVolunteer.parse({ ...base, firstName: "Ada", lastName: "Lovelace" });
    expect(parsed.displayName).toBe("Ada Lovelace");
    expect(parsed.firstName).toBe("Ada");
  });

  // The cases the office's sheet is full of: churches, buildings, households.
  it("accepts a name that is not a person, with no first or last", () => {
    const parsed = createVolunteer.parse({ ...base, displayName: "St. Aidan's Church" });
    expect(parsed.displayName).toBe("St. Aidan's Church");
    expect(parsed.firstName).toBeUndefined();
  });

  it("lets an explicit display name win over the composed one", () => {
    const parsed = createVolunteer.parse({
      ...base,
      displayName: "Ruth, Genevieve and Jamie Neal-Ellis",
      firstName: "Ruth",
      lastName: "Neal-Ellis",
    });
    expect(parsed.displayName).toBe("Ruth, Genevieve and Jamie Neal-Ellis");
    expect(parsed.lastName).toBe("Neal-Ellis");
  });

  it("composes from whichever half is present", () => {
    expect(createVolunteer.parse({ ...base, firstName: "Cher" }).displayName).toBe("Cher");
  });

  it("rejects a record with no name at all", () => {
    expect(() => createVolunteer.parse({ ...base })).toThrow();
    expect(() =>
      createCaptain.parse({
        payType: "bundle",
        payRate: 1,
        payCadence: "biweekly",
        startDate: "2026-01-06",
      }),
    ).toThrow();
  });
});

describe("optional contact details", () => {
  const volunteer = {
    firstName: "Ada",
    lastName: "Lovelace",
    address: { street: "1 Queen St E", placeId: "place-1" },
    startDate: "2026-01-06",
  };
  const captain = {
    firstName: "Ada",
    lastName: "Lovelace",
    payType: "bundle" as const,
    payRate: 1.25,
    payCadence: "biweekly" as const,
    startDate: "2026-01-06",
  };

  it("creates a volunteer with no contact details at all", () => {
    const parsed = createVolunteer.parse(volunteer);
    expect(parsed.email).toBeNull();
    expect(parsed.phone).toBeNull();
  });

  it("creates a captain with no contact details at all", () => {
    const parsed = createCaptain.parse(captain);
    expect(parsed.email).toBeNull();
    expect(parsed.phone).toBeNull();
  });

  // A cleared form field arrives as "", not as an absent key. All three absent
  // forms have to land on one representation or "not on file" is three states.
  it("normalises empty, blank and null to null", () => {
    expect(createVolunteer.parse({ ...volunteer, email: "", phone: "   " }).email).toBeNull();
    expect(createVolunteer.parse({ ...volunteer, email: "", phone: "   " }).phone).toBeNull();
    expect(createVolunteer.parse({ ...volunteer, email: null, phone: null }).phone).toBeNull();
  });

  it("still rejects a malformed email when one is given", () => {
    expect(() => createVolunteer.parse({ ...volunteer, email: "not-an-address" })).toThrow();
    expect(() => createCaptain.parse({ ...captain, email: "not-an-address" })).toThrow();
  });

  // z.email() does not trim, so a whitespace-only address used to surface as
  // "Invalid email address" instead of simply "not on file".
  it("treats a whitespace-only email as not on file, and trims a real one", () => {
    expect(createVolunteer.parse({ ...volunteer, email: "   " }).email).toBeNull();
    expect(createVolunteer.parse({ ...volunteer, email: " ada@example.com " }).email).toBe(
      "ada@example.com",
    );
  });

  it("keeps real contact details intact and trims the phone", () => {
    const parsed = createVolunteer.parse({
      ...volunteer,
      email: "ada@example.com",
      phone: "  416-555-0134  ",
    });
    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBe("416-555-0134");
  });
});

describe("setVacation", () => {
  it("accepts an ordered window and the clear form", () => {
    expect(() =>
      setVacation.parse({ vacationStart: "2026-07-01", vacationEnd: "2026-07-15" }),
    ).not.toThrow();
    expect(() => setVacation.parse({ clear: true })).not.toThrow();
  });

  it("rejects start after end", () => {
    expect(() =>
      setVacation.parse({ vacationStart: "2026-07-16", vacationEnd: "2026-07-15" }),
    ).toThrow();
  });
});

describe("addressInput", () => {
  it("accepts a placeId or address lines", () => {
    expect(() => addressInput.parse({ placeId: "seed-place-vol-1" })).not.toThrow();
    expect(() =>
      addressInput.parse({ addressLines: ["12 Willow Ave"], regionCode: "CA" }),
    ).not.toThrow();
  });

  it("rejects empty lines and empty placeId", () => {
    expect(() => addressInput.parse({ addressLines: [] })).toThrow();
    expect(() => addressInput.parse({ placeId: "" })).toThrow();
  });
});

describe("nearestVacantQuery", () => {
  it("requires volunteerId or placeId and coerces limit", () => {
    expect(() => nearestVacantQuery.parse({})).toThrow();
    const parsed = nearestVacantQuery.parse({ placeId: "x", limit: "7" });
    expect(parsed.limit).toBe(7);
  });
});

const sampleAddress = { addressLines: ["12 Willow Ave"], regionCode: "CA" as const };

describe("createRoute bundles", () => {
  it("accepts bundles that sum to papers", () => {
    expect(() =>
      createRoute.parse({
        startAddress: sampleAddress,
        endAddress: sampleAddress,
        streetName: "Queen St E",
        papers: 70,
        bundles: [{ papers: 50 }, { papers: 20 }],
      }),
    ).not.toThrow();
  });

  it("rejects bundles that do not sum to papers", () => {
    expect(() =>
      createRoute.parse({
        startAddress: sampleAddress,
        endAddress: sampleAddress,
        streetName: "Queen St E",
        papers: 70,
        bundles: [{ papers: 50 }, { papers: 25 }],
      }),
    ).toThrow();
  });

  it("rejects zero and non-integer bundle sizes", () => {
    expect(() =>
      createRoute.parse({
        startAddress: sampleAddress,
        endAddress: sampleAddress,
        streetName: "Queen St E",
        bundles: [{ papers: 0 }],
      }),
    ).toThrow();
    expect(() =>
      createRoute.parse({
        startAddress: sampleAddress,
        endAddress: sampleAddress,
        streetName: "Queen St E",
        bundles: [{ papers: 10.5 }],
      }),
    ).toThrow();
  });
});

describe("updateRoute bundles", () => {
  it("rejects a patch where bundles do not sum to papers", () => {
    expect(() =>
      updateRoute.parse({ papers: 70, bundles: [{ papers: 50 }, { papers: 25 }] }),
    ).toThrow();
  });

  it("accepts bundles alone (papers derived server-side)", () => {
    expect(() => updateRoute.parse({ bundles: [{ papers: 50 }, { papers: 20 }] })).not.toThrow();
  });
});

describe("createIssues", () => {
  it("requires at least one issue", () => {
    expect(() => createIssues.parse({ issues: [] })).toThrow();
    expect(() =>
      createIssues.parse({ issues: [{ name: "June 9", date: "2026-06-09" }] }),
    ).not.toThrow();
  });
});
