export type PaymentPeriod = "ytd" | "q1" | "q2" | "q3" | "q4";

export type CaptainPayment = {
  name: string;
  type: "Drop" | "Bundle";
  frequency: "Biweekly" | "Monthly";
  amount: number;
};

export type SubstitutePayment = {
  name: string;
  coveredCaptain: string;
  issueCount: number;
  amount: number;
};

export type PeriodData = {
  label: string;
  range: string;
  captains: CaptainPayment[];
  substitutes: SubstitutePayment[];
};

export const STATS = {
  nextIssuePapers: 2847,
  nextIssueLabel: "Issue 27 • Dec 30th",
  activeVolunteers: 48,
  totalVolunteers: 53,
  routesMissingCarrier: 3,
  ytdCaptainCosts: 1847,
  ytdIssueCount: 26,
} as const;

export const CHART_MONTHS = [
  { label: "Mar", amount: 148, isPast: true },
  { label: "Apr", amount: 175, isPast: true },
  { label: "May", amount: 156, isPast: true },
  { label: "Jun", amount: 216, isCurrent: true },
  { label: "Jul", amount: 81, isFuture: true },
  { label: "Aug", amount: 0, isFuture: true },
  { label: "Sep", amount: 0, isFuture: true },
  { label: "Oct", amount: 0, isFuture: true },
  { label: "Nov", amount: 0, isFuture: true },
  { label: "Dec", amount: 0, isFuture: true },
  { label: "Jan", amount: 0, isFuture: true },
  { label: "Feb", amount: 0, isFuture: true },
] as const;

export const CHART_YTD_TOTAL = {
  label: "2026 total",
  amount: 1847,
} as const;

export const PAPERS_PER_ISSUE = [
  { issue: 26, date: "Dec 16th", count: 2901 },
  { issue: 25, date: "Dec 2nd", count: 2846 },
  { issue: 24, date: "Nov 18th", count: 2734 },
] as const;

const captainMeta = (
  name: string,
  type: "Drop" | "Bundle",
  frequency: "Biweekly" | "Monthly",
  amount: number,
): CaptainPayment => ({ name, type, frequency, amount });

const subMeta = (
  name: string,
  coveredCaptain: string,
  issueCount: number,
  amount: number,
): SubstitutePayment => ({ name, coveredCaptain, issueCount, amount });

export const PERIOD_DATA: Record<PaymentPeriod, PeriodData> = {
  ytd: {
    label: "YTD",
    range: "Mar 2025 – July 2026 (full year)",
    captains: [
      captainMeta("Walter Wren", "Drop", "Biweekly", 438),
      captainMeta("Rudy Peel", "Bundle", "Biweekly", 612),
      captainMeta("Carol Fenn", "Bundle", "Monthly", 402),
      captainMeta("Morris Hatch", "Drop", "Biweekly", 256),
      captainMeta("Doug Kim", "Bundle", "Monthly", 214),
    ],
    substitutes: [
      subMeta("Susan Drake", "Carol Fenn", 2, 50),
      subMeta("Lena Park", "Doug Kim", 1, 25),
    ],
  },
  q1: {
    label: "Q1",
    range: "Mar 1 – May 31, 2026",
    captains: [
      captainMeta("Walter Wren", "Drop", "Biweekly", 312),
      captainMeta("Rudy Peel", "Bundle", "Biweekly", 445),
      captainMeta("Carol Fenn", "Bundle", "Monthly", 289),
      captainMeta("Morris Hatch", "Drop", "Biweekly", 178),
      captainMeta("Doug Kim", "Bundle", "Monthly", 156),
    ],
    substitutes: [subMeta("Susan Drake", "Carol Fenn", 1, 25)],
  },
  q2: {
    label: "Q2",
    range: "Jun 1 – Aug 31, 2026",
    captains: [
      captainMeta("Walter Wren", "Drop", "Biweekly", 126),
      captainMeta("Rudy Peel", "Bundle", "Biweekly", 167),
      captainMeta("Carol Fenn", "Bundle", "Monthly", 113),
      captainMeta("Morris Hatch", "Drop", "Biweekly", 78),
      captainMeta("Doug Kim", "Bundle", "Monthly", 58),
    ],
    substitutes: [subMeta("Lena Park", "Doug Kim", 1, 25)],
  },
  q3: {
    label: "Q3",
    range: "Sep 1 – Nov 30, 2026",
    captains: [
      captainMeta("Walter Wren", "Drop", "Biweekly", 0),
      captainMeta("Rudy Peel", "Bundle", "Biweekly", 0),
      captainMeta("Carol Fenn", "Bundle", "Monthly", 0),
      captainMeta("Morris Hatch", "Drop", "Biweekly", 0),
      captainMeta("Doug Kim", "Bundle", "Monthly", 0),
    ],
    substitutes: [],
  },
  q4: {
    label: "Q4",
    range: "Dec 1, 2026 – Feb 28, 2027",
    captains: [
      captainMeta("Walter Wren", "Drop", "Biweekly", 0),
      captainMeta("Rudy Peel", "Bundle", "Biweekly", 0),
      captainMeta("Carol Fenn", "Bundle", "Monthly", 0),
      captainMeta("Morris Hatch", "Drop", "Biweekly", 0),
      captainMeta("Doug Kim", "Bundle", "Monthly", 0),
    ],
    substitutes: [],
  },
};

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
