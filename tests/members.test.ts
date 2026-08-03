// Pure logic behind the members screen: route endpoint labels and the merged
// members row shape. No I/O — the DB-backed paths live in the integration suite.
import { describe, expect, it } from "vitest";

import { routeEndpointLabel, routeLabel } from "@/lib/services/derive";

describe("routeEndpointLabel", () => {
  it("strips the trailing street name from a house address, leaving the number", () => {
    expect(routeEndpointLabel("2038 Queen St E, Toronto, ON, Canada", "Queen St E")).toBe("2038");
  });

  it("strips the route's own street from an intersection, leaving the cross street", () => {
    expect(routeEndpointLabel("Queen St E & Willow Ave, Toronto, ON, Canada", "Queen St E")).toBe(
      "Willow Ave",
    );
  });

  it("handles an intersection written the other way round", () => {
    expect(routeEndpointLabel("Willow Ave & Queen St E, Toronto, ON, Canada", "Queen St E")).toBe(
      "Willow Ave",
    );
  });

  it("keeps the whole segment when the street name doesn't appear at all", () => {
    expect(routeEndpointLabel("Somewhere Else, Toronto, ON", "Queen St E")).toBe("Somewhere Else");
  });

  it("keeps both sides of an intersection that doesn't mention the route's street", () => {
    expect(routeEndpointLabel("Lee Ave & Beech Ave, Toronto", "Queen St E")).toBe(
      "Lee Ave & Beech Ave",
    );
  });

  it("is case insensitive about the street name", () => {
    expect(routeEndpointLabel("2038 QUEEN ST E, Toronto", "queen st e")).toBe("2038");
  });

  it("does not reduce a bare street name to an empty string", () => {
    expect(routeEndpointLabel("Queen St E, Toronto, ON", "Queen St E")).toBe("Queen St E");
  });

  it("returns null when there are no cached coordinates yet", () => {
    expect(routeEndpointLabel(null, "Queen St E")).toBeNull();
  });
});

describe("routeLabel", () => {
  it("joins two house-number endpoints", () => {
    expect(routeLabel("Queen St E", "2038 Queen St E, Toronto", "2190 Queen St E, Toronto")).toBe(
      "Queen St E · 2038 → 2190",
    );
  });

  it("joins two intersection endpoints", () => {
    expect(
      routeLabel(
        "Queen St E",
        "Queen St E & Willow Ave, Toronto",
        "Queen St E & Beech Ave, Toronto",
      ),
    ).toBe("Queen St E · Willow Ave → Beech Ave");
  });

  it("falls back to the street name when either endpoint is not geocoded", () => {
    expect(routeLabel("Lee Ave", null, "206 Lee Ave, Toronto")).toBe("Lee Ave");
    expect(routeLabel("Lee Ave", "150 Lee Ave, Toronto", null)).toBe("Lee Ave");
    expect(routeLabel("Lee Ave", null, null)).toBe("Lee Ave");
  });

  it("collapses to one endpoint when both ends resolve to the same label", () => {
    expect(routeLabel("Lee Ave", "150 Lee Ave, Toronto", "150 Lee Ave, Toronto")).toBe(
      "Lee Ave · 150",
    );
  });
});
