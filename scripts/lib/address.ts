// Deciding whether an address is safe to store.
//
// A bad address does not fail. Google answers a string like
// `danforth don't want` with a point partway along Danforth, and the record
// looks correct forever. So the result is checked rather than trusted, and the
// cheap check runs first so the obvious ones cost nothing.

/** A leading house number, which is what distinguishes a building from a street. */
const HOUSE_NUMBER = /^\s*\d+[a-z]?\b/i;

/**
 * Whether the office's own text names a building.
 *
 * Catches a plaza or park name before any billed lookup happens. `Shoppers
 * World` and `Goodwood Park` are places, but not somewhere a bundle can be left
 * without someone knowing the building already.
 */
export function looksLikeStreetAddress(source: string): boolean {
  return HOUSE_NUMBER.test(source);
}

/**
 * Whether a resolved address kept the building the office wrote down.
 *
 * Google answers an unrecognised string with the street it best matches, and
 * drops the house number when it cannot place one. Losing the number means the
 * record points at a road rather than a door.
 */
export function keptItsBuilding(streetNumber: string | null | undefined): boolean {
  return Boolean(streetNumber && streetNumber.trim());
}

/** What the check needs from a resolved address. */
export interface ResolvedShape {
  streetNumber: string | null;
  /** Which of the provider's objections are about the building, not the unit. */
  doubts: {
    nextAction: "ACCEPT" | "CONFIRM" | "FIX" | null;
    houseNumberReplaced: boolean;
    streetUnclear: boolean;
  };
}

export type AddressVerdict = { ok: true } | { ok: false; reason: string; billed: boolean };

/** The free check, run before anything is sent to Google. */
export function checkSource(source: string): AddressVerdict {
  if (!source.trim()) return { ok: false, reason: "no address on the sheet", billed: false };
  if (!looksLikeStreetAddress(source)) {
    return {
      ok: false,
      reason: "names a place rather than a street address, so it has no house number",
      billed: false,
    };
  }
  return { ok: true };
}

/**
 * The check that needs the lookup, since only the answer shows what was lost.
 *
 * Three signals, all about the building. Losing the house number means the point
 * is a road rather than a door. A swapped house number or an unclear street
 * means the point moved to somewhere nobody wrote down. `FIX` is the provider
 * saying it could not place the address at all.
 *
 * An unverifiable apartment number is not one of them. Google cannot see inside
 * a building, so it reports every unit as unconfirmed, and refusing those would
 * hold back a tenth of the roster over addresses that are correct.
 */
export function checkResolved(source: string, resolved: ResolvedShape): AddressVerdict {
  if (!keptItsBuilding(resolved.streetNumber)) {
    return {
      ok: false,
      reason: `resolved to a street rather than a building, so "${source}" would point at the wrong place`,
      billed: true,
    };
  }
  if (resolved.doubts.houseNumberReplaced) {
    return {
      ok: false,
      reason: `the geocoder swapped the house number in "${source}" for ${resolved.streetNumber}`,
      billed: true,
    };
  }
  if (resolved.doubts.streetUnclear) {
    return {
      ok: false,
      reason: `"${source}" resolved against a street that was not the one written down`,
      billed: true,
    };
  }
  if (resolved.doubts.nextAction === "FIX") {
    return {
      ok: false,
      reason: `the geocoder could not place "${source}" and asks for it to be corrected`,
      billed: true,
    };
  }
  return { ok: true };
}
