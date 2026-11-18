// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceError } from "@/lib/api/errors";
import { fakeMapsProvider } from "@/lib/maps/fake";
import { walkingLine } from "@/lib/services/routes";

// Two corners about 300 m apart on one north-south street.
const start = { latitude: 43.67, longitude: -79.29 };
const end = { latitude: 43.6727, longitude: -79.29 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("walkingLine", () => {
  it("asks for the walk from just inside each end and joins it to the corners", async () => {
    const routePath = vi.spyOn(fakeMapsProvider, "routePath");
    const line = await walkingLine(start, end);

    const [from, to] = routePath.mock.calls[0];
    expect((from.latitude - start.latitude) * 110_540).toBeCloseTo(20, 0);
    expect((end.latitude - to.latitude) * 110_540).toBeCloseTo(20, 0);
    expect(line![0]).toEqual({ lat: start.latitude, lng: start.longitude });
    expect(line!.at(-1)).toEqual({ lat: end.latitude, lng: end.longitude });
  });

  it("gives no line when the walk goes around a block", async () => {
    vi.spyOn(fakeMapsProvider, "routePath").mockResolvedValue([
      start,
      { latitude: 43.67, longitude: -79.2915 },
      { latitude: 43.6727, longitude: -79.2915 },
      end,
    ]);

    expect(await walkingLine(start, end)).toBeNull();
  });

  it("gives no line when Google refuses the request", async () => {
    vi.spyOn(fakeMapsProvider, "routePath").mockRejectedValue(
      new ServiceError("internal", "Compute Routes failed: 400", 502),
    );

    expect(await walkingLine(start, end)).toBeNull();
  });
});
