// Suggested house count — the pure geometry/matching core.
//
// Deliberately free of DB and network access so it can be unit-tested directly
// (same reasoning as ./derive.ts). The I/O half lives in ./routes.ts.
//
// The route model is start address -> end address, and an endpoint may be either
// a real street address ("123 Queen St") or an intersection ("Queen St E &
// Woodbine Ave", which has no street number). Both always carry coordinates, so
// each endpoint is snapped to the nearest known address point on the street and
// the count is taken between the two resulting house numbers.
import type { RouteSide } from "@/types/db";

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** One Toronto Open Data address point, already narrowed to what we need. */
export interface AddressPoint {
  /** Source ADDRESS_NUMBER, e.g. "2962B" — display and audit only. */
  addressNumber: string;
  /** Source LO_NUM — the numeric key the range comparison uses. */
  streetNumber: number;
  /** Toronto's side-of-centreline flag, relative to digitization direction. */
  centrelineSide: "L" | "R" | null;
  latitude: number;
  longitude: number;
  addressFull: string;
}

export type SuggestionReason =
  "ok" | "no-coordinates" | "street-not-found" | "no-matches" | "too-many-matches";

export interface HouseCountSuggestion {
  /** null whenever reason !== "ok" — callers must not fall back to 0. */
  count: number | null;
  reason: SuggestionReason;
  /** The normalized name actually queried, so a miss is diagnosable. */
  streetName: string;
  side: RouteSide | null;
  numberRange: { from: number; to: number } | null;
  /** Matched addresses, ascending — makes the count auditable. */
  addresses: string[];
  /** Self-check: a one-sided route should be all-odd or all-even. */
  parityConsistent: boolean;
}

// Long forms Google returns -> the abbreviations Toronto publishes. Applied to
// whole tokens only, so "Northcliffe Blvd" isn't mangled into "ncliffe blvd".
// Toronto does not abbreviate "Lane", and uses "Crt" rather than "Ct".
const ABBREVIATIONS: Record<string, string> = {
  avenue: "ave",
  street: "st",
  road: "rd",
  drive: "dr",
  crescent: "cres",
  boulevard: "blvd",
  court: "crt",
  place: "pl",
  terrace: "terr",
  gardens: "gdns",
  square: "sq",
  parkway: "pkwy",
  trail: "trl",
  circle: "crcl",
  heights: "hts",
  grove: "grv",
  east: "e",
  west: "w",
  north: "n",
  south: "s",
};

/**
 * Fold a route's street name toward Toronto's canonical spelling. The DB side
 * lowercases too (`linear_name_norm`), so the two meet in the middle.
 *
 * `%` and `_` are stripped because the result is used in a SQL LIKE prefix.
 */
export function normalizeStreetName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,%_]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ABBREVIATIONS[token] ?? token)
    .join(" ");
}

/**
 * Coarse corridor around the route. Its job is only to disambiguate same-named
 * streets elsewhere in the city and to absorb curvature — the house-number range
 * is what actually bounds the route, so padding generously is the safe error.
 */
export function boundingBox(a: LatLng, b: LatLng) {
  const pad = (lo: number, hi: number) => Math.max(0.0015, (hi - lo) * 0.15);
  const minLat = Math.min(a.latitude, b.latitude);
  const maxLat = Math.max(a.latitude, b.latitude);
  const minLng = Math.min(a.longitude, b.longitude);
  const maxLng = Math.max(a.longitude, b.longitude);
  const padLat = pad(minLat, maxLat);
  const padLng = pad(minLng, maxLng);
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLng: minLng - padLng,
    maxLng: maxLng + padLng,
  };
}

/** Longitude degrees shrink toward the poles; scale them before doing planar math. */
function lngScale(latitude: number): number {
  return Math.cos((latitude * Math.PI) / 180);
}

/** Signed offset from the start->end chord; > 0 is left of travel direction. */
function crossValue(start: LatLng, end: LatLng, p: LatLng): number {
  const kx = lngScale((start.latitude + end.latitude) / 2);
  const dx = (end.longitude - start.longitude) * kx;
  const dy = end.latitude - start.latitude;
  const px = (p.longitude - start.longitude) * kx;
  const py = p.latitude - start.latitude;
  return dx * py - dy * px;
}

/** Turn a signed offset into a compass label, using the route's dominant axis. */
function labelFromCross(start: LatLng, end: LatLng, cross: number): RouteSide {
  const kx = lngScale((start.latitude + end.latitude) / 2);
  const dx = (end.longitude - start.longitude) * kx;
  const dy = end.latitude - start.latitude;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return cross > 0 === dx >= 0 ? "NORTH" : "SOUTH";
  }
  return cross > 0 === dy >= 0 ? "WEST" : "EAST";
}

/**
 * Which compass side of the start->end line a point falls on.
 *
 * Uses a signed cross product rather than comparing mean latitudes, because a
 * diagonal street (Kingston Rd runs NE-SW) differs on both axes at once and mean
 * comparison picks the wrong axis.
 */
export function compassSide(start: LatLng, end: LatLng, p: LatLng): RouteSide {
  return labelFromCross(start, end, crossValue(start, end, p));
}

function squaredDistance(a: LatLng, b: LatLng): number {
  const kx = lngScale((a.latitude + b.latitude) / 2);
  const dx = (a.longitude - b.longitude) * kx;
  const dy = a.latitude - b.latitude;
  return dx * dx + dy * dy;
}

function nearest(points: AddressPoint[], to: LatLng): AddressPoint {
  let best = points[0];
  let bestDistance = squaredDistance(best, to);
  for (const p of points) {
    const d = squaredDistance(p, to);
    if (d < bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * Label each point with a compass side.
 *
 * Toronto's L/R flag is the authoritative side-of-street — it is computed
 * against the true, curved centreline — so the only thing left to decide is
 * which compass direction each of the two groups corresponds to. That is done
 * from the group's *mean* offset rather than per-point offsets: averaging
 * cancels the local wander of a curved street (Glen Manor Dr bends around the
 * ravine, so individual houses fall on the wrong side of a straight
 * start->end chord even when their L/R flag is right).
 *
 * Falls back to per-point labels when the two groups don't separate — one group
 * missing, or both averaging to the same side, which is what a route spanning
 * oppositely-digitized segments looks like.
 */
function labelSides(
  start: LatLng,
  end: LatLng,
  points: AddressPoint[],
): Map<AddressPoint, RouteSide> {
  const offsets = new Map<AddressPoint, number>();
  for (const p of points) offsets.set(p, crossValue(start, end, p));

  const totals = new Map<"L" | "R", { sum: number; n: number }>();
  for (const p of points) {
    if (p.centrelineSide === null) continue;
    const acc = totals.get(p.centrelineSide) ?? { sum: 0, n: 0 };
    acc.sum += offsets.get(p)!;
    acc.n += 1;
    totals.set(p.centrelineSide, acc);
  }
  const mean = (side: "L" | "R") => {
    const acc = totals.get(side);
    return acc && acc.n > 0 ? acc.sum / acc.n : null;
  };
  const meanL = mean("L");
  const meanR = mean("R");

  // Compare the two groups against each other, not against zero. A route whose
  // endpoints happen to be two houses on the same side puts the chord along
  // that side, so every point — including its own group — lands on one side of
  // it and an absolute sign test collapses. Their relative order still holds.
  //
  // Requiring the groups to actually sit apart (not merely to differ) is what
  // rejects a scrambled L/R flag, e.g. a route spanning segments digitized in
  // opposite directions: there the two groups interleave and neither clusters.
  const clustered = (side: "L" | "R", groupMean: number, midpoint: number) => {
    const group = points.filter((p) => p.centrelineSide === side);
    if (group.length === 0) return false;
    const onOwnSide = group.filter(
      (p) => offsets.get(p)! > midpoint === groupMean > midpoint,
    ).length;
    return onOwnSide / group.length >= 0.8;
  };
  const midpoint = meanL !== null && meanR !== null ? (meanL + meanR) / 2 : 0;
  const separated =
    meanL !== null &&
    meanR !== null &&
    meanL !== meanR &&
    clustered("L", meanL, midpoint) &&
    clustered("R", meanR, midpoint);

  if (separated) {
    const higher: RouteSide = labelFromCross(start, end, 1);
    const lower: RouteSide = labelFromCross(start, end, -1);
    const labelL = meanL > meanR ? higher : lower;
    const resolved = new Map<AddressPoint, RouteSide>();
    for (const p of points) {
      if (p.centrelineSide === "L") resolved.set(p, labelL);
      else if (p.centrelineSide === "R") resolved.set(p, labelL === higher ? lower : higher);
      else resolved.set(p, labelFromCross(start, end, offsets.get(p)!));
    }
    return resolved;
  }

  // Only one group present (or a dead tie): fall back to per-point geometry.
  const resolved = new Map<AddressPoint, RouteSide>();
  for (const p of points) resolved.set(p, labelFromCross(start, end, offsets.get(p)!));
  return resolved;
}

export interface HouseCountInput {
  streetName: string;
  side: RouteSide | null;
  start: LatLng;
  end: LatLng;
  points: AddressPoint[];
  /** True when the query hit PostgREST's row cap and the set is incomplete. */
  truncated: boolean;
}

/**
 * Count the addresses between a route's two endpoints.
 *
 * Returns `count: null` with a reason rather than guessing — an under-count that
 * looks plausible is worse than no suggestion at all.
 */
export function computeHouseCountSuggestion(input: HouseCountInput): HouseCountSuggestion {
  const { streetName, side, start, end, points, truncated } = input;
  const base = { streetName, side, numberRange: null, addresses: [], parityConsistent: true };

  if (truncated) return { ...base, count: null, reason: "too-many-matches" };
  if (points.length === 0) return { ...base, count: null, reason: "street-not-found" };

  // Snap both endpoints to real addresses; min/max makes the result independent
  // of which end the route was drawn from.
  const from = nearest(points, start).streetNumber;
  const to = nearest(points, end).streetNumber;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const numberRange = { from: lo, to: hi };

  let inRange = points.filter((p) => p.streetNumber >= lo && p.streetNumber <= hi);

  const filterBySide = side !== null && side !== "BOTH";
  if (filterBySide) {
    const labels = labelSides(start, end, inRange);
    inRange = inRange.filter((p) => labels.get(p) === side);
  }

  // One point per civic address. Toronto publishes one point per building, so a
  // multi-unit building counts once (a locked product decision); this also
  // collapses the rare multi-point address.
  const seen = new Set<string>();
  const deduped = inRange
    .filter((p) => !seen.has(p.addressFull) && seen.add(p.addressFull))
    .sort((a, b) => a.streetNumber - b.streetNumber);

  if (deduped.length === 0) {
    return { ...base, numberRange, count: null, reason: "no-matches" };
  }

  // Street numbering alternates by side, so a one-sided result that mixes odd
  // and even means the side filter or the range is wrong.
  const parityConsistent = filterBySide
    ? deduped.every((p) => p.streetNumber % 2 === deduped[0].streetNumber % 2)
    : true;

  return {
    count: deduped.length,
    reason: "ok",
    streetName,
    side,
    numberRange,
    addresses: deduped.map((p) => p.addressFull),
    parityConsistent,
  };
}
