// Display helpers for the overview screen.
//
// The stub arrays that used to live here (STATS, CHART_MONTHS, PERIOD_DATA,
// PAPERS_PER_ISSUE and the hard-coded year list) are gone: the page reads
// GET /api/overview now. What is left is formatting and the period menu labels,
// which are genuinely static UI text rather than data.

export type PaymentPeriod = "ytd" | "q1" | "q2" | "q3" | "q4";

export const PERIOD_OPTIONS: { id: PaymentPeriod; menuLabel: string }[] = [
  { id: "ytd", menuLabel: "YTD" },
  { id: "q1", menuLabel: "Q1" },
  { id: "q2", menuLabel: "Q2" },
  { id: "q3", menuLabel: "Q3" },
  { id: "q4", menuLabel: "Q4" },
];

export function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

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

/** "2026-03" -> "Mar". The chart labels its twelve buckets with these. */
export function monthLabel(isoMonth: string): string {
  const month = Number(isoMonth.split("-")[1]);
  return MONTHS_SHORT[month - 1] ?? isoMonth;
}

/** "2026-03-10" -> "Mar 10th", matching how the office writes issue dates. */
export function formatIssueDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  if (!month || !day) return iso;
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${MONTHS_SHORT[month - 1]} ${day}${suffix}`;
}

/** "2026-03-01" -> "Mar 2026 – Feb 2027", the twelve months from the year's start. */
export function yearDateRange(startDate: string): string {
  const [year, month] = startDate.split("-").map(Number);
  if (!year || !month) return startDate;
  const endMonthIndex = (month - 2 + 12) % 12;
  const endYear = month === 1 ? year : year + 1;
  return `${MONTHS_SHORT[month - 1]} ${year} – ${MONTHS_SHORT[endMonthIndex]} ${endYear}`;
}
