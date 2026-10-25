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
  /** The provider's own flag for having inferred or replaced a component. */
  needsConfirmation: boolean;
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
 * Two signals. Losing the house number means the point is a road rather than a
 * door. The provider's own confirmation flag catches the subtler case, where it
 * swapped a component it was unsure about and still answered with a building.
 */
export function checkResolved(source: string, resolved: ResolvedShape): AddressVerdict {
  if (!keptItsBuilding(resolved.streetNumber)) {
    return {
      ok: false,
      reason: `resolved to a street rather than a building, so "${source}" would point at the wrong place`,
      billed: true,
    };
  }
  if (resolved.needsConfirmation) {
    return {
      ok: false,
      reason: `the geocoder replaced part of "${source}" and flagged it for confirmation`,
      billed: true,
    };
  }
  return { ok: true };
}
