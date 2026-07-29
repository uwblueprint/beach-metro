// Deterministic fake MapsProvider: same input → same place_id and coordinates,
// so seeds, tests, and the curl script are stable. Coordinates land in a ~2 km
// box around Beach Metro's coverage area (the Beaches, Toronto).
import type {
  AddressLinesInput,
  LatLng,
  MapsProvider,
  ResolvedAddress,
  RouteMatrixEntry,
} from "./types";

const BASE = { latitude: 43.671, longitude: -79.308 };

/** FNV-1a — tiny, stable string hash (not crypto; just determinism). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function coordsFor(key: string): LatLng {
  const h = hash(key);
  // Spread across ±0.01° (~1.1 km) in each axis.
  const dLat = (((h & 0xffff) / 0xffff) * 2 - 1) * 0.01;
  const dLng = ((((h >>> 16) & 0xffff) / 0xffff) * 2 - 1) * 0.01;
  return { latitude: BASE.latitude + dLat, longitude: BASE.longitude + dLng };
}

function normalize(input: AddressLinesInput): string {
  return [
    ...input.addressLines,
    input.locality ?? "Toronto",
    input.administrativeArea ?? "ON",
    input.postalCode ?? "",
  ]
    .map((part) => part.trim().replace(/\s+/g, " ").toLowerCase())
    .filter((part) => part.length > 0)
    .join(", ");
}

function resolve(placeId: string, formattedAddress: string, line1: string): ResolvedAddress {
  const { latitude, longitude } = coordsFor(placeId);
  const streetNumber = /^(\d+)\s/.exec(line1)?.[1] ?? null;
  const streetName = streetNumber ? line1.slice(streetNumber.length).trim() : line1 || null;
  return {
    placeId,
    formattedAddress,
    latitude,
    longitude,
    locationType: "ROOFTOP",
    addressComplete: true,
    needsConfirmation: false,
    residential: true,
    components: {
      streetNumber,
      streetName,
      locality: "Toronto",
      sublocality: "The Beaches",
      administrativeArea: "ON",
      postalCode: null,
      countryCode: "CA",
    },
  };
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export const fakeMapsProvider: MapsProvider = {
  async validateAddress(input) {
    const key = normalize(input);
    const placeId = `fake-pl-${hash(key).toString(36)}`;
    const formatted = `${input.addressLines.join(", ")}, ${input.locality ?? "Toronto"}, ${input.administrativeArea ?? "ON"}${input.postalCode ? " " + input.postalCode : ""}, Canada`;
    return resolve(placeId, formatted, input.addressLines[0] ?? "");
  },

  async geocodePlaceId(placeId) {
    // Same placeId → same coords; formatted address is synthesized (a real
    // provider returns the canonical one).
    return resolve(placeId, `Resolved location ${placeId}, Toronto, ON, Canada`, "");
  },

  async routeMatrix(origin, destinations) {
    const AVG_SPEED_MPS = 35_000 / 3600; // ~35 km/h drive
    return destinations.map((d, destinationIndex): RouteMatrixEntry => {
      const distanceMeters = haversineMeters(origin, d);
      return {
        destinationIndex,
        distanceMeters,
        durationSeconds: Math.round(distanceMeters / AVG_SPEED_MPS),
      };
    });
  },
};
