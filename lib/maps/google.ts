// Real Google Maps Platform implementation of MapsProvider (research doc §1.2):
// Address Validation, Geocoding (by place_id), and Routes Compute Route Matrix.
// Field masks are kept tight per the cost guidance (§1.8/§1.9). The server key
// never leaves this module; the browser talks only to our own API routes.
import { ServiceError, invalid } from "@/lib/api/errors";
import type { LocationType } from "@/types/db";

import type {
  AddressLinesInput,
  LatLng,
  MapsProvider,
  ResolvedAddress,
  RouteMatrixEntry,
} from "./types";

function serverKey(): string {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    throw new ServiceError("internal", "GOOGLE_MAPS_SERVER_KEY is not configured.", 500);
  }
  return key;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Decode Google's Encoded Polyline Algorithm string into lat/lng vertices. */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/** Map Address Validation granularity → our geocode-confidence enum. */
function granularityToLocationType(granularity: string | undefined): LocationType {
  switch (granularity) {
    case "PREMISE":
    case "SUB_PREMISE":
      return "ROOFTOP";
    case "PREMISE_PROXIMITY":
    case "ROUTE":
    case "BLOCK":
      return "RANGE_INTERPOLATED";
    default:
      return "APPROXIMATE";
  }
}

/** Pull our structured components out of either API's component list. */
function extractComponents(
  components: Array<{
    types?: string[];
    componentType?: string;
    long_name?: string;
    componentName?: { text?: string };
  }>,
): ResolvedAddress["components"] {
  const get = (type: string) => {
    const hit = components.find((c) =>
      c.types ? c.types.includes(type) : c.componentType === type,
    );
    return hit ? (hit.long_name ?? hit.componentName?.text) || null : null;
  };
  return {
    streetNumber: get("street_number"),
    streetName: get("route"),
    locality: get("locality"),
    sublocality: get("sublocality") ?? get("sublocality_level_1"),
    administrativeArea: get("administrative_area_level_1"),
    postalCode: get("postal_code"),
    countryCode: get("country"),
  };
}

export const googleMapsProvider: MapsProvider = {
  /** Address Validation API (research doc §3) — CA region, full verdict. */
  async validateAddress(input: AddressLinesInput): Promise<ResolvedAddress> {
    const res = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${serverKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            regionCode: input.regionCode ?? "CA",
            addressLines: input.addressLines,
            ...(input.locality ? { locality: input.locality } : {}),
            ...(input.administrativeArea ? { administrativeArea: input.administrativeArea } : {}),
            ...(input.postalCode ? { postalCode: input.postalCode } : {}),
          },
        }),
      },
    );
    const json: any = await res.json();
    if (!res.ok) {
      throw new ServiceError(
        "internal",
        `Address Validation failed: ${json?.error?.message ?? res.status}`,
        502,
      );
    }

    const result = json.result;
    const placeId: string | undefined = result?.geocode?.placeId;
    const location = result?.geocode?.location;
    if (!placeId || !location) {
      throw invalid("Address could not be resolved to a location — check it and try again.");
    }

    const verdict = result.verdict ?? {};
    return {
      placeId,
      formattedAddress: result.address?.formattedAddress ?? input.addressLines.join(", "),
      latitude: location.latitude,
      longitude: location.longitude,
      locationType: granularityToLocationType(verdict.geocodeGranularity),
      addressComplete: verdict.addressComplete === true,
      // Research §1.5: confirm-with-user when Google replaced or couldn't
      // confirm parts; inferred components alone are fine.
      needsConfirmation:
        verdict.hasReplacedComponents === true || verdict.hasUnconfirmedComponents === true,
      residential:
        result.metadata?.residential === true
          ? true
          : result.metadata?.business === true
            ? false
            : null,
      components: extractComponents(result.address?.addressComponents ?? []),
    };
  },

  /** Geocoding API by place_id (research doc §2) — cache refresh + autocomplete input. */
  async geocodePlaceId(placeId: string): Promise<ResolvedAddress> {
    const params = new URLSearchParams({ place_id: placeId, key: serverKey() });
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const json: any = await res.json();
    if (json.status === "ZERO_RESULTS") {
      throw invalid(`No location found for place_id ${placeId}.`);
    }
    if (json.status !== "OK") {
      throw new ServiceError(
        "internal",
        `Geocoding failed: ${json.status}${json.error_message ? ` — ${json.error_message}` : ""}`,
        502,
      );
    }

    const top = json.results[0];
    return {
      placeId: top.place_id,
      formattedAddress: top.formatted_address,
      latitude: top.geometry.location.lat,
      longitude: top.geometry.location.lng,
      locationType: (top.geometry.location_type as LocationType) ?? "APPROXIMATE",
      addressComplete: true,
      needsConfirmation: false,
      residential: null, // Geocoding has no residential metadata (Address Validation does)
      components: extractComponents(top.address_components ?? []),
    };
  },

  /** Routes API Compute Route Matrix (research doc §5.2) — tight field mask. */
  async routeMatrix(origin: LatLng, destinations: LatLng[]): Promise<RouteMatrixEntry[]> {
    if (destinations.length === 0) return [];
    const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": serverKey(),
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
      },
      body: JSON.stringify({
        origins: [{ waypoint: { location: { latLng: origin } } }],
        destinations: destinations.map((d) => ({ waypoint: { location: { latLng: d } } })),
        travelMode: "DRIVE",
      }),
    });
    const json: any = await res.json();
    if (!res.ok) {
      throw new ServiceError(
        "internal",
        `Route Matrix failed: ${json?.error?.message ?? res.status}`,
        502,
      );
    }

    return (json as any[])
      .filter((entry) => entry.condition === "ROUTE_EXISTS")
      .map((entry) => ({
        destinationIndex: entry.destinationIndex ?? 0,
        distanceMeters: entry.distanceMeters ?? 0,
        durationSeconds: entry.duration ? parseInt(String(entry.duration), 10) : 0,
      }));
  },

  /** Routes API Compute Routes (research doc §4) — walking path, polyline-only
   * field mask. Returns [] when no route exists so callers fall back to a line. */
  async routePath(origin: LatLng, destination: LatLng): Promise<LatLng[]> {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": serverKey(),
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode: "WALK",
      }),
    });
    const json: any = await res.json();
    if (!res.ok) {
      throw new ServiceError(
        "internal",
        `Compute Routes failed: ${json?.error?.message ?? res.status}`,
        502,
      );
    }
    const encoded: string | undefined = json.routes?.[0]?.polyline?.encodedPolyline;
    return encoded ? decodePolyline(encoded) : [];
  },
};
