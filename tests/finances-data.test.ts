import { describe, expect, it } from "vitest";

import { formatChangedDate } from "@/app/(dashboard)/finances/data";

describe("formatChangedDate", () => {
  it("reads a late-evening change as that evening in Toronto, not the next day", () => {
    // 03:30 UTC on the 18th is 22:30 on the 17th in Toronto.
    expect(formatChangedDate("2026-11-18T03:30:00Z")).toBe("November 17th");
  });

  it("reads a midday change as the same day", () => {
    expect(formatChangedDate("2026-12-01T17:00:00+00:00")).toBe("December 1st");
  });
});
