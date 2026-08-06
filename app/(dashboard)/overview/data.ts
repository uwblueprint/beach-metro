export type PaymentPeriod = "ytd" | "q1" | "q2" | "q3" | "q4";

export type OverviewYear = "2025-26" | "2024-25" | "2023-24" | "2022-23" | "2021-22" | "2020-21";

export type OverviewYearOption = {
  id: OverviewYear;
  label: string;
  archived: boolean;
};

export const OVERVIEW_YEAR_OPTIONS: OverviewYearOption[] = [
  { id: "2025-26", label: "2025-26 Payments", archived: false },
  { id: "2024-25", label: "2024-25 Payments (archived)", archived: true },
  { id: "2023-24", label: "2023-24 Payments (archived)", archived: true },
  { id: "2022-23", label: "2022-23 Payments (archived)", archived: true },
  { id: "2021-22", label: "2021-22 Payments (archived)", archived: true },
  { id: "2020-21", label: "2020-21 Payments (archived)", archived: true },
];

export const OVERVIEW_YEAR_DATE_RANGES: Record<OverviewYear, string> = {
  "2025-26": "Mar 2025 – Feb 2026",
  "2024-25": "Mar 2024 – Feb 2025",
  "2023-24": "Mar 2023 – Feb 2024",
  "2022-23": "Mar 2022 – Feb 2023",
  "2021-22": "Mar 2021 – Feb 2022",
  "2020-21": "Mar 2020 – Feb 2021",
};

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
  { issue: 23, date: "Nov 4th", count: 2948 },
  { issue: 22, date: "Oct 21st", count: 2801 },
  { issue: 21, date: "Oct 7th", count: 2654 },
  { issue: 20, date: "Sep 23rd", count: 2945 },
  { issue: 19, date: "Sep 9th", count: 2784 },
  { issue: 18, date: "Aug 26th", count: 2879 },
  { issue: 17, date: "Aug 12th", count: 2623 },
  { issue: 16, date: "Jul 29th", count: 2788 },
  { issue: 15, date: "Jul 15th", count: 3012 },
  { issue: 14, date: "Jul 1st", count: 2567 },
  { issue: 13, date: "Jun 17th", count: 2891 },
  { issue: 12, date: "Jun 3rd", count: 2733 },
  { issue: 11, date: "May 20th", count: 2645 },
  { issue: 10, date: "May 6th", count: 2987 },
  { issue: 9, date: "Apr 22nd", count: 2512 },
  { issue: 8, date: "Apr 8th", count: 2834 },
  { issue: 7, date: "Mar 25th", count: 2766 },
  { issue: 6, date: "Mar 11th", count: 2923 },
  { issue: 5, date: "Feb 25th", count: 2589 },
  { issue: 4, date: "Feb 11th", count: 3045 },
  { issue: 3, date: "Jan 28th", count: 2678 },
  { issue: 2, date: "Jan 14th", count: 2812 },
  { issue: 1, date: "Dec 31st", count: 2534 },
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
