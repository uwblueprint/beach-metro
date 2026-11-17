// Reading the captain roster off a payments sheet.
//
// The left-hand block of each Payments year is the captain list, one row per RT
// code. There are more codes than captains, because one person can hold several
// areas, so rows collapse by name. Every RT code the roster uses appears here,
// which is what lets a person be placed in their captain's territory.
import { clean, normalise } from "./csv";
import type { PayType } from "@/types/db";

/**
 * The sheet's Car column is left unread. The office no longer pays a car
 * allowance, so it is not modelled (docs/reference/route_labels_spreadsheet.md §2.3).
 */
const COL = {
  rt: 0,
  name: 2,
  per: 6,
  rate: 7,
} as const;

/** How the sheet writes a pay basis against what the app stores. */
const PAY_BASIS: Record<string, PayType> = {
  bundle: "bundle",
  paper: "paper",
  dropoff: "drop",
  drop: "drop",
};

/** How a note names each pay basis the sheet uses. */
const PAY_BASIS_WORDS: Record<string, string> = {
  bundle: "bundle",
  paper: "paper",
  dropoff: "drop off",
  drop: "drop off",
};

/** What the sheet puts in the name column for an area nobody covers. */
const NO_CAPTAIN = "no captain";

export interface Captain {
  sourceKey: string;
  displayName: string;
  payType: PayType;
  payRate: number;
  /** Every RT code this person holds, in sheet order. */
  rtCodes: string[];
  notes: string[];
  firstRow: number;
}

export interface CaptainsResult {
  captains: Captain[];
  rejected: { sourceKey: string; displayName: string; firstRow: number; reason: string }[];
  /** RT code to captain source key, for placing people in a territory. */
  byRt: Map<string, string>;
  /** RT codes the sheet marks as having no captain, whose carriers come in without one. */
  uncovered: string[];
}

/** One area's pay as the sheet states it, such as `$0.18 per paper in RT 24`. */
function areaPay(row: string[]): string {
  const basis = PAY_BASIS_WORDS[normalise(row[COL.per])];
  const pay = basis
    ? `$${clean(row[COL.rate])} per ${basis}`
    : `on a pay basis of "${clean(row[COL.per])}"`;
  return `${pay} in RT ${clean(row[COL.rt])}`;
}

/** `a`, `a and b`, or `a, b and c`. */
function listed(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The captains a payments sheet describes.
 *
 * A pay basis of `N/A` means no arrangement rather than a missing value, and is
 * stored as a rate of zero, which the app already allows for a captain who
 * donates their pay back.
 */
export function readCaptains(rows: string[][]): CaptainsResult {
  const body = rows.slice(1);
  const groups = new Map<string, { rows: string[][]; firstRow: number }>();
  const uncovered: string[] = [];

  body.forEach((row, i) => {
    if (!clean(row[COL.name])) return;
    const key = normalise(row[COL.name]);
    if (key === NO_CAPTAIN) {
      uncovered.push(clean(row[COL.rt]));
      return;
    }
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { rows: [row], firstRow: i + 2 });
  });

  const captains: Captain[] = [];
  const rejected: CaptainsResult["rejected"] = [];
  const byRt = new Map<string, string>();

  for (const [sourceKey, group] of groups) {
    const first = group.rows[0];
    const displayName = clean(first[COL.name]);
    const per = normalise(first[COL.per]);
    const rateRaw = clean(first[COL.rate]);
    const rate = Number(rateRaw);

    if (rateRaw && !Number.isFinite(rate)) {
      rejected.push({
        sourceKey,
        displayName,
        firstRow: group.firstRow,
        reason: `pay rate "${rateRaw}" is not a number`,
      });
      continue;
    }

    // "N/A" is the only basis the sheet uses that the app has no value for, and
    // it means the captain takes nothing rather than that nobody recorded it.
    const payType = PAY_BASIS[per] ?? "drop";
    const notes: string[] = [];
    if (!PAY_BASIS[per]) {
      notes.push(`Pay basis on the office sheet reads "${clean(first[COL.per])}", rate set to 0.`);
    }

    const rtCodes = group.rows.map((r) => clean(r[COL.rt])).filter(Boolean);
    // Only the first code reaches the captain's own field, because the app
    // allows one per captain. The rest are recorded so they are not simply lost.
    if (rtCodes.length > 1) {
      notes.push(`Also covers RT ${rtCodes.slice(1).join(", ")}.`);
    }

    // The app holds one pay arrangement per captain, the first area's, so an
    // area paid any other way is written down rather than lost.
    const otherPay = group.rows
      .slice(1)
      .filter((r) => normalise(r[COL.per]) !== per || clean(r[COL.rate]) !== rateRaw)
      .map(areaPay);
    if (otherPay.length > 0) notes.push(`Paid ${listed(otherPay)}.`);

    for (const code of rtCodes) byRt.set(normalise(code), sourceKey);

    captains.push({
      sourceKey,
      displayName,
      payType,
      payRate: PAY_BASIS[per] ? (Number.isFinite(rate) ? rate : 0) : 0,
      rtCodes,
      notes,
      firstRow: group.firstRow,
    });
  }

  return { captains, rejected, byRt, uncovered };
}

/** The note text for a captain, or null when there is nothing worth recording. */
export function captainNote(captain: Captain): string | null {
  return captain.notes.length > 0 ? captain.notes.join(" ") : null;
}
