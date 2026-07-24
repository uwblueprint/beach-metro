export const CAPTAINS = [
  "Walter Wren",
  "Rudy Peel",
  "Doug Kim",
  "Carol Fenn",
  "Morris Hatch",
] as const

export type Issue = {
  id: number
  label: string
}

export const INITIAL_ISSUES: Issue[] = [
  { id: 26, label: "Issue 26, December 16th" },
  { id: 25, label: "Issue 25, December 2nd" },
  { id: 24, label: "Issue 24, November 18th" },
  { id: 23, label: "Issue 23, November 4th" },
  { id: 22, label: "Issue 22, October 20th" },
  { id: 21, label: "Issue 21, October 7th" },
  { id: 20, label: "Issue 20, September 23rd" },
  { id: 19, label: "Issue 19, September 9th" },
]

export type CellKey = `${number}-${string}`

const AMOUNTS = [48, 52, 55, 50, 60, 45, 58, 53]
const AMOUNTS_HIGH = [96, 104, 110, 102, 120, 95, 116, 106]

export function generatePaymentsForIssues(issues: readonly Issue[]): Record<CellKey, number> {
  const payments: Record<CellKey, number> = {}

  issues.forEach((issue, index) => {
    Object.assign(payments, generatePaymentsForIssueAtIndex(issue, index))
  })

  return payments
}

/** @deprecated Use generatePaymentsForIssues */
export function generatePayments(): Record<CellKey, number> {
  return generatePaymentsForIssues(INITIAL_ISSUES)
}

export function generatePaymentsForIssueAtIndex(
  issue: Issue,
  index: number,
): Record<CellKey, number> {
  const payments: Record<CellKey, number> = {}

  CAPTAINS.forEach((captain) => {
    const key: CellKey = `${issue.id}-${captain}`
    if (captain === "Morris Hatch") {
      payments[key] = AMOUNTS_HIGH[index] ?? AMOUNTS_HIGH[AMOUNTS_HIGH.length - 1]
    } else {
      payments[key] = AMOUNTS[index] ?? AMOUNTS[AMOUNTS.length - 1]
    }
  })

  return payments
}

export function initialPaidCells(): Set<CellKey> {
  const set = new Set<CellKey>()
  INITIAL_ISSUES.forEach((issue) => {
    CAPTAINS.forEach((captain) => {
      const key: CellKey = `${issue.id}-${captain}`
      if (issue.id === 26 && captain === "Morris Hatch") return
      if (issue.id <= 25) set.add(key)
    })
  })
  return set
}

export function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`
}

export function nextIssueId(issues: readonly Issue[]): number {
  return issues.reduce((max, issue) => Math.max(max, issue.id), 0) + 1
}
