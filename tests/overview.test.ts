import { describe, expect, it } from "vitest";

import { periodRange } from "@/lib/services/overview";

// The office's year does not start in January, so quarters are relative to the
// year's own start month. These are the ranges the overview's filter produces.
describe("periodRange", () => {
  const MARCH = "2026-03-01";

  it("YTD spans the full twelve months from the year's start", () => {
    expect(periodRange(MARCH, "ytd")).toEqual({ from: "2026-03-01", to: "2027-02-28" });
  });

  it("quarters are relative to the start month, not the calendar", () => {
    expect(periodRange(MARCH, "q1")).toEqual({ from: "2026-03-01", to: "2026-05-31" });
    expect(periodRange(MARCH, "q2")).toEqual({ from: "2026-06-01", to: "2026-08-31" });
    expect(periodRange(MARCH, "q3")).toEqual({ from: "2026-09-01", to: "2026-11-30" });
    expect(periodRange(MARCH, "q4")).toEqual({ from: "2026-12-01", to: "2027-02-28" });
  });

  it("the four quarters tile the year with no gaps or overlaps", () => {
    const quarters = (["q1", "q2", "q3", "q4"] as const).map((q) => periodRange(MARCH, q));
    const ytd = periodRange(MARCH, "ytd");
    expect(quarters[0].from).toBe(ytd.from);
    expect(quarters[3].to).toBe(ytd.to);
    for (let i = 1; i < quarters.length; i++) {
      const prevEnd = new Date(`${quarters[i - 1].to}T00:00:00Z`);
      prevEnd.setUTCDate(prevEnd.getUTCDate() + 1);
      expect(prevEnd.toISOString().slice(0, 10)).toBe(quarters[i].from);
    }
  });

  it("handles a January start (the calendar-aligned case)", () => {
    expect(periodRange("2026-01-01", "q1")).toEqual({ from: "2026-01-01", to: "2026-03-31" });
    expect(periodRange("2026-01-01", "ytd")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("crosses a leap year correctly", () => {
    // 2028 is a leap year, so a March 2027 year ends on Feb 29 2028.
    expect(periodRange("2027-03-01", "ytd").to).toBe("2028-02-29");
  });

  it("survives a start day that later months are too short for", () => {
    // Jan 31 + 1 month has to clamp to Feb 28, not roll into March.
    expect(periodRange("2026-01-31", "q1").from).toBe("2026-01-31");
    expect(periodRange("2026-01-31", "q2").from).toBe("2026-04-30");
  });
});
