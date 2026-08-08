// Display types and helpers for the finances screen.
//
// The stub data that used to live here (a fixed list of five captains, generated
// payment amounts, hard-coded issues and years) is gone: the page reads
// GET /api/financial-years/{id} now. What is left is formatting, the filter shape,
// and the small display types the payment cell takes.
//
// Captain names are plain strings now rather than a union of five literals, because
// the real set comes from the database and changes as captains are added or retire.

/** A cell is addressed by its payout id, which is unique across the whole grid. */
export type CellKey = string;

/** "None" is a real selectable value in the substitute picker, not an absence. */
export const NO_SUBSTITUTE = "None" as const;
export type SubstituteCaptainAssignment = string;

export type PaymentDetail = {
  captainName: string;
  issueLabel: string;
  lastModified: string;
  territory: string;
  bundleCount: number;
  ratePerBundle: number;
};

export type CellOverride = {
  amount: number;
  originalValue: number;
  note: string;
};

export function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function ordinal(day: number): string {
  if (day % 10 === 1 && day !== 11) return `${day}st`;
  if (day % 10 === 2 && day !== 12) return `${day}nd`;
  if (day % 10 === 3 && day !== 13) return `${day}rd`;
  return `${day}th`;
}

/** "2026-03-10" -> "March 10th", the long form used in the issue column. */
export function formatIssueDateLong(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  if (!month || !day) return iso;
  return `${MONTHS_LONG[month - 1]} ${ordinal(day)}`;
}

/** "2026-03-10" -> "Mar 10th", the short form used inside the cell popover. */
export function formatIssueDateShort(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  if (!month || !day) return iso;
  return `${MONTHS_SHORT[month - 1]} ${ordinal(day)}`;
}

/** "2026-03-01" -> "Mar 2026 – Feb 2027", the twelve months from the year's start. */
export function yearDateRange(startDate: string): string {
  const [year, month] = startDate.split("-").map(Number);
  if (!year || !month) return startDate;
  const endMonthIndex = (month - 2 + 12) % 12;
  const endYear = month === 1 ? year : year + 1;
  return `${MONTHS_SHORT[month - 1]} ${year} – ${MONTHS_SHORT[endMonthIndex]} ${endYear}`;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type IssueFilterValue = "all" | "open" | "closed";
export type PaymentFilterValue = "all" | "paid" | "unpaid";

export type FinancesFilterState = {
  issue: IssueFilterValue;
  payment: PaymentFilterValue;
  startDate: string;
  endDate: string;
  /** Captain ids to show as columns. Empty means all of them. */
  captains: string[];
};

export const DEFAULT_FINANCES_FILTERS: FinancesFilterState = {
  issue: "all",
  payment: "all",
  startDate: "",
  endDate: "",
  captains: [],
};

/** Minimal shape the filters need, so this stays testable without the API types. */
type FilterableIssue = {
  date: string;
  status: "open" | "closed";
  cells: Array<{ captainId: string; paid: boolean }>;
};

/**
 * Filters run over the rows the API already returned rather than as query params.
 * Deliberate: paid/unpaid here means "every visible captain's cell is paid", which
 * depends on which captain columns are showing, so it cannot be answered
 * server-side without also sending the column selection.
 */
export function filterFinancesIssues<T extends FilterableIssue>(
  issues: readonly T[],
  filters: FinancesFilterState,
  visibleCaptainIds: readonly string[],
): T[] {
  return issues.filter((issue) => {
    if (filters.issue === "open" && issue.status !== "open") return false;
    if (filters.issue === "closed" && issue.status !== "closed") return false;

    if (filters.startDate && issue.date < filters.startDate) return false;
    if (filters.endDate && issue.date > filters.endDate) return false;

    const visible = issue.cells.filter((c) => visibleCaptainIds.includes(c.captainId));
    if (filters.payment === "paid" && !visible.every((c) => c.paid)) return false;
    if (filters.payment === "unpaid" && !visible.some((c) => !c.paid)) return false;

    return true;
  });
}

/** Which captain columns to show. An empty filter means every column. */
export function filterFinancesCaptains<T extends { id: string }>(
  captains: readonly T[],
  filters: FinancesFilterState,
): T[] {
  if (filters.captains.length === 0) return [...captains];
  return captains.filter((c) => filters.captains.includes(c.id));
}
