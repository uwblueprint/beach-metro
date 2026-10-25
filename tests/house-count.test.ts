import { describe, expect, it } from "vitest";

import {
  boundingBox,
  compassSide,
  computeHouseCountSuggestion,
  normalizeStreetName,
  type AddressPoint,
} from "@/lib/services/house-count";

describe("normalizeStreetName", () => {
  it("folds Google's long forms to Toronto's abbreviations", () => {
    expect(normalizeStreetName("Wineva Avenue")).toBe("wineva ave");
    expect(normalizeStreetName("Glen Manor Drive")).toBe("glen manor dr");
    expect(normalizeStreetName("Queen Street East")).toBe("queen st e");
  });

  it("normalizes punctuation and casing", () => {
    expect(normalizeStreetName("QUEEN ST. E")).toBe("queen st e");
    expect(normalizeStreetName("  Lee   Ave  ")).toBe("lee ave");
  });

  it("leaves already-canonical names alone", () => {
    expect(normalizeStreetName("Glen Manor Dr W")).toBe("glen manor dr w");
    expect(normalizeStreetName("Kingston Rd")).toBe("kingston rd");
  });

  it("only abbreviates whole tokens", () => {
    // "north" inside "Northcliffe" must not become "n".
    expect(normalizeStreetName("Northcliffe Blvd")).toBe("northcliffe blvd");
    expect(normalizeStreetName("Eastwood Rd")).toBe("eastwood rd");
  });

  it("strips LIKE metacharacters, since the result is used as a SQL prefix", () => {
    expect(normalizeStreetName("Queen%_St")).toBe("queenst");
  });
});

describe("compassSide", () => {
  // A short east-west street and a short north-south one, around the Beaches.
  const west = { latitude: 43.67, longitude: -79.3 };
  const east = { latitude: 43.67, longitude: -79.29 };
  const south = { latitude: 43.665, longitude: -79.295 };
  const north = { latitude: 43.675, longitude: -79.295 };

  it("labels north and south of an east-west street", () => {
    expect(compassSide(west, east, { latitude: 43.671, longitude: -79.295 })).toBe("NORTH");
    expect(compassSide(west, east, { latitude: 43.669, longitude: -79.295 })).toBe("SOUTH");
  });

  it("is independent of which end the route was drawn from", () => {
    const p = { latitude: 43.671, longitude: -79.295 };
    expect(compassSide(east, west, p)).toBe("NORTH");
  });

  it("labels east and west of a north-south street", () => {
    expect(compassSide(south, north, { latitude: 43.67, longitude: -79.294 })).toBe("EAST");
    expect(compassSide(south, north, { latitude: 43.67, longitude: -79.296 })).toBe("WEST");
    expect(compassSide(north, south, { latitude: 43.67, longitude: -79.294 })).toBe("EAST");
  });

  it("handles a diagonal street (the Kingston Rd case)", () => {
    // Kingston Rd runs NE-SW, so both endpoints differ in lat AND lng —
    // comparing mean latitude alone would pick the wrong axis here.
    const sw = { latitude: 43.6802, longitude: -79.2905 };
    const ne = { latitude: 43.6828, longitude: -79.2852 };
    // Perpendicular offsets from the midpoint of that chord.
    expect(compassSide(sw, ne, { latitude: 43.6825, longitude: -79.2895 })).toBe("NORTH");
    expect(compassSide(sw, ne, { latitude: 43.6805, longitude: -79.2862 })).toBe("SOUTH");
  });
});

describe("boundingBox", () => {
  it("applies a floor so a very short route still has a usable corridor", () => {
    const p = { latitude: 43.67, longitude: -79.295 };
    const box = boundingBox(p, p);
    expect(box.maxLat - box.minLat).toBeCloseTo(0.003, 6);
    expect(box.maxLng - box.minLng).toBeCloseTo(0.003, 6);
  });

  it("pads proportionally for a long route", () => {
    const box = boundingBox(
      { latitude: 43.66, longitude: -79.3 },
      { latitude: 43.7, longitude: -79.25 },
    );
    expect(box.minLat).toBeLessThan(43.66);
    expect(box.maxLat).toBeGreaterThan(43.7);
    expect(box.maxLat - box.minLat).toBeCloseTo(0.04 * 1.3, 6);
  });
});

/**
 * A north-south street shaped like Wineva Ave: even numbers on the west side
 * (Toronto's "L"), odd on the east ("R"). Numbers 2..60 — the real loaded data
 * for that range is 48 points, 25 even / 23 odd.
 */
function winevaFixture(): AddressPoint[] {
  const points: AddressPoint[] = [];
  for (let n = 2; n <= 60; n += 2) {
    points.push({
      addressNumber: String(n),
      streetNumber: n,
      centrelineSide: "L",
      latitude: 43.665 + n * 0.0002,
      longitude: -79.2955, // west side
      addressFull: `${n} Wineva Ave`,
    });
  }
  for (let n = 1; n <= 59; n += 2) {
    points.push({
      addressNumber: String(n),
      streetNumber: n,
      centrelineSide: "R",
      latitude: 43.665 + n * 0.0002,
      longitude: -79.2945, // east side
      addressFull: `${n} Wineva Ave`,
    });
  }
  return points;
}

const WINEVA_START = { latitude: 43.6654, longitude: -79.295 };
const WINEVA_END = { latitude: 43.6772, longitude: -79.295 };

describe("computeHouseCountSuggestion", () => {
  const base = {
    streetName: "wineva ave",
    start: WINEVA_START,
    end: WINEVA_END,
    truncated: false,
  };

  // The endpoints snap to the nearest real address, so the range is 2..60 —
  // #1 sits across the street and just south of the start anchor. That is the
  // documented +/-1-per-end slack of anchoring, not a bug.
  it("counts both sides when no side is set", () => {
    const r = computeHouseCountSuggestion({ ...base, side: null, points: winevaFixture() });
    expect(r.reason).toBe("ok");
    expect(r.numberRange).toEqual({ from: 2, to: 60 });
    expect(r.count).toBe(59); // 30 even (2..60) + 29 odd (3..59)
  });

  it("treats BOTH the same as no side", () => {
    const r = computeHouseCountSuggestion({ ...base, side: "BOTH", points: winevaFixture() });
    expect(r.count).toBe(59);
  });

  it("splits by side, and each side is parity-consistent", () => {
    const west = computeHouseCountSuggestion({ ...base, side: "WEST", points: winevaFixture() });
    const east = computeHouseCountSuggestion({ ...base, side: "EAST", points: winevaFixture() });

    expect(west.count).toBe(30);
    expect(east.count).toBe(29);
    expect(west.count! + east.count!).toBe(59); // additivity

    // The self-check that proves the side filter is real and not arbitrary.
    expect(west.parityConsistent).toBe(true);
    expect(east.parityConsistent).toBe(true);
    expect(west.addresses.every((a) => Number(a.split(" ")[0]) % 2 === 0)).toBe(true);
    expect(east.addresses.every((a) => Number(a.split(" ")[0]) % 2 === 1)).toBe(true);
  });

  it("gives the same count when start and end are swapped", () => {
    const forward = computeHouseCountSuggestion({ ...base, side: null, points: winevaFixture() });
    const reverse = computeHouseCountSuggestion({
      ...base,
      start: WINEVA_END,
      end: WINEVA_START,
      side: null,
      points: winevaFixture(),
    });
    expect(reverse.count).toBe(forward.count);
  });

  it("narrows to a sub-range when the endpoints are mid-street", () => {
    const points = winevaFixture();
    const r = computeHouseCountSuggestion({
      ...base,
      // ~#20 to ~#40 on the fixture's latitude ramp.
      start: { latitude: 43.665 + 20 * 0.0002, longitude: -79.295 },
      end: { latitude: 43.665 + 40 * 0.0002, longitude: -79.295 },
      side: null,
      points,
    });
    expect(r.numberRange!.from).toBeGreaterThanOrEqual(19);
    expect(r.numberRange!.to).toBeLessThanOrEqual(41);
    expect(r.count).toBeLessThan(30);
  });

  it("counts a multi-point civic address once", () => {
    const points = winevaFixture();
    points.push({ ...points[0] });
    const r = computeHouseCountSuggestion({ ...base, side: null, points });
    expect(r.count).toBe(59);
  });

  it("labels an east-west street with NORTH/SOUTH", () => {
    // A Queen St E shape: numbers run west to east, evens on the north side.
    const points: AddressPoint[] = [];
    for (let n = 2; n <= 20; n += 2) {
      points.push({
        addressNumber: String(n),
        streetNumber: n,
        centrelineSide: "L",
        latitude: 43.6695,
        longitude: -79.3 + n * 0.0004,
        addressFull: `${n} Queen St E`,
      });
    }
    for (let n = 1; n <= 19; n += 2) {
      points.push({
        addressNumber: String(n),
        streetNumber: n,
        centrelineSide: "R",
        latitude: 43.6685,
        longitude: -79.3 + n * 0.0004,
        addressFull: `${n} Queen St E`,
      });
    }
    const start = { latitude: 43.669, longitude: -79.3005 };
    const end = { latitude: 43.669, longitude: -79.2915 };
    const north = computeHouseCountSuggestion({
      streetName: "queen st e",
      side: "NORTH",
      start,
      end,
      points,
      truncated: false,
    });
    expect(north.count).toBe(10);
    expect(north.parityConsistent).toBe(true);
    expect(north.addresses.every((a) => Number(a.split(" ")[0]) % 2 === 0)).toBe(true);
  });

  it("still separates the sides when the centreline digitization flips", () => {
    // A route spanning two segments digitized in opposite directions: the L/R
    // flag no longer agrees with itself, so the consensus must be discarded.
    const points = winevaFixture().map((p, i) =>
      i % 2 === 0
        ? p
        : { ...p, centrelineSide: (p.centrelineSide === "L" ? "R" : "L") as "L" | "R" },
    );
    const west = computeHouseCountSuggestion({ ...base, side: "WEST", points });
    expect(west.count).toBe(30);
    expect(west.parityConsistent).toBe(true);
  });

  it("reports street-not-found rather than zero when nothing matched", () => {
    const r = computeHouseCountSuggestion({ ...base, side: null, points: [] });
    expect(r.count).toBeNull();
    expect(r.reason).toBe("street-not-found");
  });

  it("refuses to answer when the row cap was hit", () => {
    const r = computeHouseCountSuggestion({
      ...base,
      side: null,
      points: winevaFixture(),
      truncated: true,
    });
    expect(r.count).toBeNull();
    expect(r.reason).toBe("too-many-matches");
  });
});
