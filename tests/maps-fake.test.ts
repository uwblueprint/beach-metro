// The deterministic fake MapsProvider: stability is the contract tests rely on.
import { describe, expect, it } from "vitest";

import { fakeMapsProvider } from "@/lib/maps/fake";

describe("fakeMapsProvider", () => {
  it("same input always resolves to the same placeId and coordinates", async () => {
    const input = { addressLines: ["12 Willow Ave"], locality: "Toronto" };
    const a = await fakeMapsProvider.validateAddress(input);
    const b = await fakeMapsProvider.validateAddress(input);
    expect(a.placeId).toBe(b.placeId);
    expect(a.latitude).toBe(b.latitude);
    expect(a.longitude).toBe(b.longitude);
  });

  it("normalizes case/whitespace to the same place", async () => {
    const a = await fakeMapsProvider.validateAddress({ addressLines: ["12 Willow Ave"] });
    const b = await fakeMapsProvider.validateAddress({ addressLines: ["  12  willow ave "] });
    expect(a.placeId).toBe(b.placeId);
  });

  it("different addresses resolve to different places", async () => {
    const a = await fakeMapsProvider.validateAddress({ addressLines: ["12 Willow Ave"] });
    const b = await fakeMapsProvider.validateAddress({ addressLines: ["48 Beech Ave"] });
    expect(a.placeId).not.toBe(b.placeId);
  });

  it("coordinates land near the Beaches coverage area", async () => {
    const r = await fakeMapsProvider.validateAddress({ addressLines: ["155 Lee Ave"] });
    expect(r.latitude).toBeGreaterThan(43.6);
    expect(r.latitude).toBeLessThan(43.75);
    expect(r.longitude).toBeGreaterThan(-79.4);
    expect(r.longitude).toBeLessThan(-79.2);
  });

  it("extracts street number and name components", async () => {
    const r = await fakeMapsProvider.validateAddress({ addressLines: ["221 Blantyre Ave"] });
    expect(r.components.streetNumber).toBe("221");
    expect(r.components.streetName).toBe("Blantyre Ave");
  });

  it("geocodePlaceId is stable for a given id", async () => {
    const a = await fakeMapsProvider.geocodePlaceId("seed-place-vol-1");
    const b = await fakeMapsProvider.geocodePlaceId("seed-place-vol-1");
    expect(a.latitude).toBe(b.latitude);
    expect(a.longitude).toBe(b.longitude);
  });

  it("routeMatrix: zero distance to self, monotone with real separation, indexes preserved", async () => {
    const origin = { latitude: 43.671, longitude: -79.308 };
    const near = { latitude: 43.672, longitude: -79.309 };
    const far = { latitude: 43.7, longitude: -79.25 };
    const matrix = await fakeMapsProvider.routeMatrix(origin, [far, origin, near]);
    expect(matrix.map((m) => m.destinationIndex)).toEqual([0, 1, 2]);
    expect(matrix[1].distanceMeters).toBe(0);
    expect(matrix[2].distanceMeters).toBeLessThan(matrix[0].distanceMeters);
    expect(matrix[0].durationSeconds).toBeGreaterThan(0);
  });
});
