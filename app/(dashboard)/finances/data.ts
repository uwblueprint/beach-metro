export const CAPTAINS = [
  "Walter Wren",
  "Rudy Peel",
  "Doug Kim",
  "Carol Fenn",
  "Morris Hatch",
] as const;

export type CaptainName = (typeof CAPTAINS)[number];

export type SubstituteCaptainName = CaptainName | "Susan Drake";

export type SubstituteCaptainAssignment = SubstituteCaptainName | "None";

export const SUBSTITUTE_CAPTAINS: SubstituteCaptainName[] = [...CAPTAINS, "Susan Drake"];

export type PaymentDetail = {
  captainName: string;
  issueLabel: string;
  lastModified: string;
  territory: string;
  bundleCount: number;
  ratePerBundle: number;
};

export const CAPTAIN_META: Record<
  CaptainName,
  { territory: string; bundleCount: number; ratePerBundle: number }
> = {
  "Walter Wren": { territory: "Territory 4", bundleCount: 16, ratePerBundle: 1.25 },
  "Rudy Peel": { territory: "Territory 2", bundleCount: 12, ratePerBundle: 1.25 },
  "Doug Kim": { territory: "Territory 1", bundleCount: 8, ratePerBundle: 1.5 },
  "Carol Fenn": { territory: "Territory 3", bundleCount: 20, ratePerBundle: 1.25 },
  "Morris Hatch": { territory: "Territory 5", bundleCount: 24, ratePerBundle: 2 },
};

const ISSUE_LAST_MODIFIED: Record<number, string> = {
  26: "Jun 10, 2026",
  25: "May 28, 2026",
  24: "May 14, 2026",
  23: "Apr 30, 2026",
  22: "Apr 16, 2026",
  21: "Apr 2, 2026",
  20: "Mar 19, 2026",
  19: "Mar 5, 2026",
};

export function formatIssuePopoverLabel(issue: Issue): string {
  return issue.label
    .replace("December", "Dec")
    .replace("November", "Nov")
    .replace("October", "Oct")
    .replace("September", "Sep");
}

export function getPaymentDetail(captain: CaptainName, issue: Issue): PaymentDetail {
  const meta = CAPTAIN_META[captain];

  return {
    captainName: captain,
    issueLabel: formatIssuePopoverLabel(issue),
    lastModified: ISSUE_LAST_MODIFIED[issue.id] ?? "Jun 10, 2026",
    territory: meta.territory,
    bundleCount: meta.bundleCount,
    ratePerBundle: meta.ratePerBundle,
  };
}

export type IssueStatus = "open" | "closed";

export type Issue = {
  id: number;
  label: string;
  status: IssueStatus;
  /** ISO date (YYYY-MM-DD) for range filtering */
  date: string;
};

export const INITIAL_ISSUES: Issue[] = [
  { id: 26, label: "Issue 26, December 16th", date: "2026-12-16", status: "open" },
  { id: 25, label: "Issue 25, December 2nd", date: "2026-12-02", status: "closed" },
  { id: 24, label: "Issue 24, November 18th", date: "2026-11-18", status: "closed" },
  { id: 23, label: "Issue 23, November 4th", date: "2026-11-04", status: "closed" },
  { id: 22, label: "Issue 22, October 20th", date: "2026-10-20", status: "closed" },
  { id: 21, label: "Issue 21, October 7th", date: "2026-10-07", status: "closed" },
  { id: 20, label: "Issue 20, September 23rd", date: "2026-09-23", status: "closed" },
  { id: 19, label: "Issue 19, September 9th", date: "2026-09-09", status: "closed" },
];

export type CellKey = `${number}-${string}`;

export type CellOverride = {
  amount: number;
  originalValue: number;
  note: string;
};

export function initialCellComments(): Partial<Record<CellKey, string>> {
  return {
    "24-Rudy Peel": "Captain switching to monthly",
  };
}

const AMOUNTS = [48, 52, 55, 50, 60, 45, 58, 53];
const AMOUNTS_HIGH = [96, 104, 110, 102, 120, 95, 116, 106];

export function generatePaymentsForIssues(issues: readonly Issue[]): Record<CellKey, number> {
  const payments: Record<CellKey, number> = {};

  issues.forEach((issue, index) => {
    Object.assign(payments, generatePaymentsForIssueAtIndex(issue, index));
  });

  return payments;
}

/** @deprecated Use generatePaymentsForIssues */
export function generatePayments(): Record<CellKey, number> {
  return generatePaymentsForIssues(INITIAL_ISSUES);
}

export function generatePaymentsForIssueAtIndex(
  issue: Issue,
  index: number,
): Record<CellKey, number> {
  const payments: Record<CellKey, number> = {};

  CAPTAINS.forEach((captain) => {
    const key: CellKey = `${issue.id}-${captain}`;
    if (captain === "Morris Hatch") {
      payments[key] = AMOUNTS_HIGH[index] ?? AMOUNTS_HIGH[AMOUNTS_HIGH.length - 1];
    } else {
      payments[key] = AMOUNTS[index] ?? AMOUNTS[AMOUNTS.length - 1];
    }
  });

  return payments;
}

export function initialPaidCells(): Set<CellKey> {
  const set = new Set<CellKey>();
  INITIAL_ISSUES.forEach((issue) => {
    CAPTAINS.forEach((captain) => {
      const key: CellKey = `${issue.id}-${captain}`;
      if (issue.id === 26 && captain === "Morris Hatch") return;
      if (issue.id <= 25) set.add(key);
    });
  });
  return set;
}

export function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export function nextIssueId(issues: readonly Issue[]): number {
  return issues.reduce((max, issue) => Math.max(max, issue.id), 0) + 1;
}

export const PAYMENT_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020] as const;

export type PaymentYear = (typeof PAYMENT_YEARS)[number];

export type PaymentYearOption = {
  year: PaymentYear;
  label: string;
  archived: boolean;
};

export const PAYMENT_YEAR_OPTIONS: PaymentYearOption[] = PAYMENT_YEARS.map((year) => ({
  year,
  label: year === 2026 ? "2026 Payments" : `${year} Payments (archived)`,
  archived: year !== 2026,
}));

export const PAYMENT_YEAR_DATE_RANGES: Record<PaymentYear, string> = {
  2026: "Mar 2025 – Feb 2026",
  2025: "Mar 2024 – Feb 2025",
  2024: "Mar 2023 – Feb 2024",
  2023: "Mar 2022 – Feb 2023",
  2022: "Mar 2021 – Feb 2022",
  2021: "Mar 2020 – Feb 2021",
  2020: "Mar 2019 – Feb 2020",
};

export type PaymentYearTable = {
  year: PaymentYear;
  archived: boolean;
  issues: Issue[];
  payments: Record<CellKey, number>;
  paid: Set<CellKey>;
};

const ARCHIVED_ISSUE_DATES = [
  "December 16th",
  "December 2nd",
  "November 18th",
  "November 4th",
  "October 20th",
  "October 7th",
  "September 23rd",
  "September 9th",
] as const;

const ARCHIVED_ISSUE_ISO_DATES = [
  "12-16",
  "12-02",
  "11-18",
  "11-04",
  "10-20",
  "10-07",
  "09-23",
  "09-09",
] as const;

function allPaidCellsForIssues(issues: readonly Issue[]): Set<CellKey> {
  const set = new Set<CellKey>();

  issues.forEach((issue) => {
    CAPTAINS.forEach((captain) => {
      set.add(`${issue.id}-${captain}`);
    });
  });

  return set;
}

function generateArchivedIssues(year: PaymentYear): Issue[] {
  const startId = 14 + (year - 2020) * 2;

  return ARCHIVED_ISSUE_DATES.map((date, index) => ({
    id: startId - index,
    label: `Issue ${startId - index}, ${date}`,
    date: `${year}-${ARCHIVED_ISSUE_ISO_DATES[index]}`,
    status: "closed" as const,
  }));
}

function generateArchivedPayments(
  issues: readonly Issue[],
  year: PaymentYear,
): Record<CellKey, number> {
  const payments: Record<CellKey, number> = {};
  const yearOffset = year - 2020;

  issues.forEach((issue, index) => {
    CAPTAINS.forEach((captain, captainIndex) => {
      const key: CellKey = `${issue.id}-${captain}`;
      const base =
        captain === "Morris Hatch"
          ? (AMOUNTS_HIGH[index] ?? AMOUNTS_HIGH[AMOUNTS_HIGH.length - 1])
          : (AMOUNTS[index] ?? AMOUNTS[AMOUNTS.length - 1]);

      payments[key] = base + yearOffset * 4 + captainIndex * 2;
    });
  });

  return payments;
}

export function getPaymentYearTable(year: PaymentYear): PaymentYearTable {
  if (year === 2026) {
    return {
      year,
      archived: false,
      issues: [...INITIAL_ISSUES],
      payments: generatePaymentsForIssues(INITIAL_ISSUES),
      paid: initialPaidCells(),
    };
  }

  const issues = generateArchivedIssues(year);

  return {
    year,
    archived: true,
    issues,
    payments: generateArchivedPayments(issues, year),
    paid: allPaidCellsForIssues(issues),
  };
}

export function getPaymentYearLabel(year: PaymentYear): string {
  return PAYMENT_YEAR_OPTIONS.find((option) => option.year === year)?.label ?? `${year} Payments`;
}

export type FinanceTableOption = {
  id: string;
  label: string;
  archived: boolean;
};

export type CustomFinanceTable = {
  issues: Issue[];
  payments: Record<CellKey, number>;
  paid: Set<CellKey>;
};

export function createFinanceTableOptions(): FinanceTableOption[] {
  return PAYMENT_YEAR_OPTIONS.map((option) => ({
    id: String(option.year),
    label: option.label,
    archived: option.archived,
  }));
}

export function createEmptyCustomTable(): CustomFinanceTable {
  return {
    issues: [],
    payments: {},
    paid: new Set(),
  };
}

export function createCustomTableId(label: string, existingIds: readonly string[]): string {
  const base = `custom:${label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

  if (!existingIds.includes(base)) return base;

  let index = 2;
  while (existingIds.includes(`${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

export type IssueFilterValue = "all" | "open" | "closed";
export type PaymentFilterValue = "all" | "paid" | "unpaid";

export type FinancesFilterState = {
  issue: IssueFilterValue;
  payment: PaymentFilterValue;
  startDate: string;
  endDate: string;
  captains: CaptainName[];
};

export const DEFAULT_FINANCES_FILTERS: FinancesFilterState = {
  issue: "all",
  payment: "all",
  startDate: "",
  endDate: "",
  captains: [],
};

export function hasActiveFinancesFilters(filters: FinancesFilterState): boolean {
  return (
    filters.issue !== DEFAULT_FINANCES_FILTERS.issue ||
    filters.payment !== DEFAULT_FINANCES_FILTERS.payment ||
    filters.startDate !== DEFAULT_FINANCES_FILTERS.startDate ||
    filters.endDate !== DEFAULT_FINANCES_FILTERS.endDate ||
    filters.captains.length > 0
  );
}

export function filterFinancesIssues(
  issues: readonly Issue[],
  filters: FinancesFilterState,
  paid: Set<CellKey>,
): Issue[] {
  const captainsToCheck =
    filters.captains.length > 0 ? filters.captains : ([...CAPTAINS] as CaptainName[]);

  return issues.filter((issue) => {
    if (filters.issue === "open" && issue.status !== "open") return false;
    if (filters.issue === "closed" && issue.status !== "closed") return false;

    if (filters.startDate && issue.date < filters.startDate) return false;
    if (filters.endDate && issue.date > filters.endDate) return false;

    const cells = captainsToCheck.map((captain) => `${issue.id}-${captain}` as CellKey);
    const allPaid = cells.every((key) => paid.has(key));
    const anyUnpaid = cells.some((key) => !paid.has(key));

    if (filters.payment === "paid" && !allPaid) return false;
    if (filters.payment === "unpaid" && !anyUnpaid) return false;

    return true;
  });
}

export function filterFinancesCaptains(filters: FinancesFilterState): CaptainName[] {
  return filters.captains.length > 0 ? filters.captains : ([...CAPTAINS] as CaptainName[]);
}
