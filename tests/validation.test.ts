// Request-schema edge cases that guard business rules at the boundary.
import { describe, expect, it } from "vitest";

import { addressInput } from "@/lib/validation/common";
import { updateDelivery } from "@/lib/validation/delivery";
import { createIssues } from "@/lib/validation/finance";
import { setVacation } from "@/lib/validation/people";
import { nearestVacantQuery } from "@/lib/validation/routes";

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

describe("createIssues", () => {
  it("requires at least one issue", () => {
    expect(() => createIssues.parse({ issues: [] })).toThrow();
    expect(() =>
      createIssues.parse({ issues: [{ name: "June 9", date: "2026-06-09" }] }),
    ).not.toThrow();
  });
});
