import { fakeMapsProvider } from "./fake";
import { googleMapsProvider } from "./google";
import type { MapsProvider } from "./types";

export type { AddressLinesInput, MapsProvider, ResolvedAddress } from "./types";

/**
 * Returns the active MapsProvider.
 *
 * - Real Google implementation when GOOGLE_MAPS_SERVER_KEY is set.
 * - The deterministic fake otherwise, and ALWAYS under vitest — tests must never
 *   spend API quota or depend on network determinism.
 */
export function getMapsProvider(): MapsProvider {
  if (process.env.VITEST) return fakeMapsProvider;
  return process.env.GOOGLE_MAPS_SERVER_KEY ? googleMapsProvider : fakeMapsProvider;
}
