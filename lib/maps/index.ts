import { fakeMapsProvider } from "./fake";
import type { MapsProvider } from "./types";

export type { AddressLinesInput, MapsProvider, ResolvedAddress } from "./types";

/**
 * Returns the active MapsProvider.
 *
 * Currently always the deterministic fake — no Google keys exist yet. When
 * GOOGLE_MAPS_SERVER_KEY is provisioned, add lib/maps/google.ts implementing
 * MapsProvider (Address Validation, Geocoding, Compute Route Matrix per the
 * research doc) and return it here when the key is set. Tests keep the fake.
 */
export function getMapsProvider(): MapsProvider {
  return fakeMapsProvider;
}
