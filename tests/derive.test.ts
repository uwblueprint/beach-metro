// Pure business-math derivations (finance flow §5, people flow §3a).
import { describe, expect, it } from "vitest";

import {
  billableQuantity,
  bundleCount,
  calculatedAmount,
  calculationStatus,
  effectiveAmount,
  greedySplit,
  volunteerNeedsAttention,
  volunteerStatus,
} from "@/lib/services/derive";

describe("greedySplit", () => {
  it("splits 130 into [50,50,25,5] (finance flow example)", () => {
    expect(greedySplit(130)).toEqual([
      { papers: 50 },
      { papers: 50 },
      { papers: 25 },
      { papers: 5 },
    ]);
  });

  it("splits 70 into [50,20] — 2 bundles, paid as 2 (finance flow example)", () => {
    expect(greedySplit(70)).toEqual([{ papers: 50 }, { papers: 20 }]);
  });

  it("handles exact multiples and small remainders", () => {
    expect(greedySplit(50)).toEqual([{ papers: 50 }]);
    expect(greedySplit(100)).toEqual([{ papers: 50 }, { papers: 50 }]);
    expect(greedySplit(25)).toEqual([{ papers: 25 }]);
    expect(greedySplit(75)).toEqual([{ papers: 50 }, { papers: 25 }]);
    expect(greedySplit(24)).toEqual([{ papers: 24 }]);
    expect(greedySplit(1)).toEqual([{ papers: 1 }]);
  });

  it("returns [] for zero papers", () => {
    expect(greedySplit(0)).toEqual([]);
  });

  it("rejects negative and non-integer input", () => {
    expect(() => greedySplit(-1)).toThrow();
    expect(() => greedySplit(12.5)).toThrow();
  });

  it("always sums back to the paper count (invariant)", () => {
    for (const n of [0, 1, 24, 25, 26, 49, 50, 51, 74, 75, 76, 99, 100, 130, 1234]) {
      expect(greedySplit(n).reduce((s, b) => s + b.papers, 0)).toBe(n);
    }
  });
});

describe("billableQuantity — missed deducts in the captain's pay unit", () => {
  const delivery = {
    paperCount: 130,
    bundles: greedySplit(130), // 4 bundles
    dropCount: 7,
    missedCount: 3,
  };

  it("per-bundle: bundles minus missed (20 bundles, 3 missed pays 17)", () => {
    expect(billableQuantity("bundle", delivery)).toBe(1); // 4 bundles - 3 missed
  });

  it("per-paper: papers minus missed", () => {
    expect(billableQuantity("paper", delivery)).toBe(127);
  });

  it("per-drop: drops minus missed", () => {
    expect(billableQuantity("drop", delivery)).toBe(4);
  });

  it("clamps at zero — missed can never bill negative (interpretation)", () => {
    expect(billableQuantity("bundle", { ...delivery, missedCount: 10 })).toBe(0);
  });
});

describe("calculatedAmount", () => {
  it("rate × summed billable quantity, rounded to cents", () => {
    const rows = [
      { paperCount: 130, bundles: greedySplit(130), dropCount: 0, missedCount: 0 }, // 4 bundles
      { paperCount: 70, bundles: greedySplit(70), dropCount: 0, missedCount: 1 }, // 2 - 1 = 1
    ];
    expect(calculatedAmount("bundle", 1.25, rows)).toBe(6.25); // 5 × 1.25
  });

  it("zero-rate captains: counts tracked, amount zero", () => {
    const rows = [{ paperCount: 55, bundles: greedySplit(55), dropCount: 2, missedCount: 0 }];
    expect(calculatedAmount("paper", 0, rows)).toBe(0);
  });

  it("rounds floating point to cents", () => {
    const rows = [{ paperCount: 3, bundles: greedySplit(3), dropCount: 0, missedCount: 0 }];
    expect(calculatedAmount("paper", 0.1, rows)).toBe(0.3); // not 0.30000000000000004
  });
});

describe("volunteerStatus / needsAttention", () => {
  const base = {
    retired_at: null,
    vacation_start: null,
    vacation_end: null,
    end_date: null,
  };

  it("retired wins over everything", () => {
    expect(
      volunteerStatus(
        {
          ...base,
          retired_at: "2026-01-15",
          vacation_start: "2026-07-01",
          vacation_end: "2026-07-31",
        },
        "2026-07-08",
      ),
    ).toBe("retired");
  });

  it("on-vacation when today is inside the window (inclusive bounds)", () => {
    const v = { ...base, vacation_start: "2026-07-01", vacation_end: "2026-07-15" };
    expect(volunteerStatus(v, "2026-07-01")).toBe("on-vacation");
    expect(volunteerStatus(v, "2026-07-15")).toBe("on-vacation");
    expect(volunteerStatus(v, "2026-06-30")).toBe("active");
    expect(volunteerStatus(v, "2026-07-16")).toBe("active");
  });

  it("needs attention only when end date passed and not retired", () => {
    expect(
      volunteerNeedsAttention({ end_date: "2026-07-01", retired_at: null }, "2026-07-08"),
    ).toBe(true);
    expect(
      volunteerNeedsAttention({ end_date: "2026-07-08", retired_at: null }, "2026-07-08"),
    ).toBe(false);
    expect(
      volunteerNeedsAttention({ end_date: "2026-07-01", retired_at: "2026-07-02" }, "2026-07-08"),
    ).toBe(false);
    expect(volunteerNeedsAttention({ end_date: null, retired_at: null }, "2026-07-08")).toBe(false);
  });
});

describe("payout cell derivations", () => {
  it("effective amount: override wins; else calculated", () => {
    expect(effectiveAmount({ calculated_amount: 20, override_amount: null })).toBe(20);
    expect(effectiveAmount({ calculated_amount: 20, override_amount: 12.5 })).toBe(12.5);
    expect(effectiveAmount({ calculated_amount: 20, override_amount: 0 })).toBe(0); // zeroed by transfer
  });

  it("calculation status derives from override presence", () => {
    expect(calculationStatus({ override_amount: null })).toBe("calculated");
    expect(calculationStatus({ override_amount: 0 })).toBe("overridden");
  });

  it("bundleCount derives from the stored breakdown", () => {
    expect(bundleCount(greedySplit(130))).toBe(4);
    expect(bundleCount([])).toBe(0);
  });
});
