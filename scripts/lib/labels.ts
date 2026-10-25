// Turning the office's LABELS sheet into the people this app stores.
//
// A row on that sheet is one bundle, not one person. Someone whose route is
// split into two bundles has two rows, and one recipient has twelve, so the 468
// rows are 338 recipients. The papers figure on each row is that bundle's
// count, which makes a recipient's total the sum of their rows.
import { greedySplit } from "@/lib/services/derive";
import type { RouteBundle } from "@/types/db";

import { clean, cleanOrNull, intOrNull, normalise } from "./csv";

/** Column order on the sheet. The header row names most but not all of these. */
const COL = {
  rt: 0,
  papers: 1,
  name: 2,
  address: 3,
  bundles: 4,
  phone: 6,
  email: 7,
  route: 8,
  notes: 9,
  startDate: 10,
} as const;

export interface Recipient {
  /** Stable identity across workbook versions. Name, RT and address. */
  sourceKey: string;
  displayName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  startDate: string | null;
  /** The office's territory code for this person's captain. */
  rt: string | null;
  /** Whatever the roster says about their route, which names a street at best. */
  routeHint: string | null;
  /** Free text from the notes column, plus any handling instruction found. */
  notes: string[];
  /** Summed across the recipient's rows. */
  papers: number;
  /** Rebuilt as 50s, 25s and a remainder, not the sizes the sheet records. */
  bundles: RouteBundle[];
  /** How many rows on the sheet produced this person. */
  rowCount: number;
  /** First sheet row, 1-based including the header, for the report. */
  firstRow: number;
}

export interface Rejection {
  sourceKey: string;
  displayName: string;
  firstRow: number;
  reason: string;
}

export interface LabelsResult {
  recipients: Recipient[];
  /** Entries the office marks as a business or a building, which are drops. */
  drops: Recipient[];
  rejected: Rejection[];
  /** Rows that are the office's own bundle tallies rather than anybody. */
  tallyLines: number;
}

/**
 * The `N of M` marker that says a row is one bundle of a larger route.
 *
 * Returns null for anything else in that column, which on a bulk-drop row holds
 * a handling instruction such as `Tie Loosely` instead. One row reads `1of 3`
 * with the space missing, so the separator is optional.
 */
export function bundleSpec(value: string | undefined): { index: number; total: number } | null {
  const match = /^(\d+)\s*of\s*(\d+)$/i.exec(clean(value));
  if (!match) return null;
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (index < 1 || total < 1 || index > total) return null;
  return { index, total };
}

/**
 * Whether the office marks this entry as somewhere papers are dropped rather
 * than a carrier who delivers them.
 *
 * The route column reads `BUSINESS` or `BUILDING` on 92 entries. A business
 * becomes a commercial drop and an unnamed building a residential one, and a
 * handful are a person at a unit number who looks after their own building, so
 * telling those apart needs a person rather than a rule. The importer builds
 * neither kind of drop yet, so these are held back and listed.
 */
export function isDropEntry(routeHint: string | null): boolean {
  return /^(business|building)$/i.test((routeHint ?? "").trim());
}

/**
 * Whether a row is the office's running tally rather than a recipient.
 *
 * The sheet carries a line per route reading `4 x 50's   3 x 25's`, with no
 * address and no papers, which counts the bundles to tie for that route. It
 * sits in the name column, so without this it reads as a person with no
 * address.
 */
export function isTallyLine(row: string[]): boolean {
  if (cleanOrNull(row[COL.address])) return false;
  return /^\d+\s*x\s*\d+\s*'?s\b/i.test(clean(row[COL.name]));
}

/** Name, RT and address together. Measured to separate all 338 recipients. */
export function recipientKey(row: string[]): string {
  return [normalise(row[COL.name]), normalise(row[COL.rt]), normalise(row[COL.address])].join("|");
}

/**
 * Every recipient the sheet describes, and every row that cannot become one.
 *
 * `rows` is the sheet including its header, which is dropped here so reported
 * row numbers match what someone sees when they open the file.
 */
export function readLabels(rows: string[][]): LabelsResult {
  const body = rows.slice(1);
  const groups = new Map<string, { rows: string[][]; firstRow: number }>();

  let tallyLines = 0;

  body.forEach((row, i) => {
    if (!clean(row[COL.name])) return; // spacer row
    if (isTallyLine(row)) {
      tallyLines += 1;
      return;
    }
    const key = recipientKey(row);
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { rows: [row], firstRow: i + 2 });
  });

  const recipients: Recipient[] = [];
  const drops: Recipient[] = [];
  const rejected: Rejection[] = [];

  for (const [sourceKey, group] of groups) {
    const first = group.rows[0];
    const displayName = clean(first[COL.name]);
    const reject = (reason: string) =>
      rejected.push({ sourceKey, displayName, firstRow: group.firstRow, reason });

    const specs = group.rows.map((r) => bundleSpec(r[COL.bundles]));
    const totals = new Set(specs.filter((s) => s !== null).map((s) => s.total));
    if (totals.size > 1) {
      reject(`bundle markers disagree, the sheet says ${[...totals].join(" and ")}`);
      continue;
    }

    const papers = group.rows.reduce((sum, r) => sum + (intOrNull(r[COL.papers]) ?? 0), 0);
    const address = cleanOrNull(first[COL.address]);

    if (!address) {
      reject("no address, and a volunteer record needs one");
      continue;
    }
    if (papers <= 0) {
      reject("no papers on any of its rows");
      continue;
    }

    // Anything in the bundles column that is not an `N of M` marker is a
    // handling instruction for a drop, which belongs in the notes.
    const instructions = group.rows
      .map((r, i) => (specs[i] === null ? cleanOrNull(r[COL.bundles]) : null))
      .filter((v): v is string => v !== null);

    const recipient: Recipient = {
      sourceKey,
      displayName,
      address,
      phone: cleanOrNull(first[COL.phone]),
      email: cleanOrNull(first[COL.email]),
      startDate: cleanOrNull(first[COL.startDate]),
      rt: cleanOrNull(first[COL.rt]),
      routeHint: cleanOrNull(first[COL.route]),
      notes: [...new Set([cleanOrNull(first[COL.notes]), ...instructions].filter(Boolean))].map(
        String,
      ),
      papers,
      bundles: greedySplit(papers),
      rowCount: group.rows.length,
      firstRow: group.firstRow,
    };
    if (isDropEntry(recipient.routeHint)) drops.push(recipient);
    else recipients.push(recipient);
  }

  return { recipients, drops, rejected, tallyLines };
}
