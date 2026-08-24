// Request-schema edge cases that guard business rules at the boundary.
import { describe, expect, it } from "vitest";

import { addressInput } from "@/lib/validation/common";
import { updateDelivery } from "@/lib/validation/delivery";
import { createIssues } from "@/lib/validation/finance";
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
