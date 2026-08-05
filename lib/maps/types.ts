// Provider seam for Google Maps Platform (research doc §1). The app codes against
// this interface; the fake implementation keeps every address-dependent flow
// working before real keys exist, and tests always use the fake.
import type { LocationType } from "@/types/db";

export interface AddressLinesInput {
  addressLines: string[];
  locality?: string;
  administrativeArea?: string;
  postalCode?: string;
  regionCode?: "CA";
}

/** Normalized result of Address Validation / Geocoding for our persistence shape. */
export interface ResolvedAddress {
  placeId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  locationType: LocationType;
  addressComplete: boolean;
  /** True when the provider inferred/replaced components — UI should confirm. */
  needsConfirmation: boolean;
  /** residential/business metadata when the provider supplies it. */
  residential: boolean | null;
  components: {
    streetNumber: string | null;
    streetName: string | null;
    locality: string | null;
    sublocality: string | null;
    administrativeArea: string | null;
    postalCode: string | null;
    countryCode: string | null;
  };
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteMatrixEntry {
  destinationIndex: number;
  distanceMeters: number;
  durationSeconds: number;
}

/** One Places Autocomplete suggestion, split for two-line rendering. */
export interface AddressSuggestion {
  placeId: string;
  /** Street line, e.g. "2 Wineva Avenue". */
  primaryText: string;
  /** Locality remainder, e.g. "Toronto, ON, Canada". */
  secondaryText: string;
}

export interface MapsProvider {
  /** Address Validation: standardize + geocode free-text address input. */
  validateAddress(input: AddressLinesInput): Promise<ResolvedAddress>;
  /**
   * Places Autocomplete (New) for address fields. `sessionToken` groups every
   * keystroke of one address entry into a single billed session (research doc
   * §4) — callers must reuse one token per field until a suggestion is picked.
   */
  autocompleteAddress(input: string, sessionToken: string): Promise<AddressSuggestion[]>;
  /** Resolve a known place_id (autocomplete input, or 30-day cache refresh). */
  geocodePlaceId(placeId: string): Promise<ResolvedAddress>;
  /** Compute Route Matrix: one origin → many destinations, for nearest-vacant. */
  routeMatrix(origin: LatLng, destinations: LatLng[]): Promise<RouteMatrixEntry[]>;
  /** Compute Routes: the walking path along real streets between two points,
   * decoded to lat/lng vertices — so the map traces roads, not straight lines. */
  routePath(origin: LatLng, destination: LatLng): Promise<LatLng[]>;
}
