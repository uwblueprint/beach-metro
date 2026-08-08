// Request schemas for the finance domain (years, issues, payouts).
import { z } from "zod";

import { boolQuery, isoDate, uuid } from "./common";

export const yearsQuery = z.object({ archived: boolQuery });

export const createFinancialYear = z.object({
  name: z.string().trim().min(1), // e.g. "2026–2027"
  // The year starts whenever the office starts it, not in January; quarter
  // filters on the overview are relative to this month.
  startDate: isoDate,
});

/** Overview/finance period filter. Quarters are relative to the year's start. */
export const periodQuery = z.object({
  yearId: uuid.optional(),
  period: z.enum(["ytd", "q1", "q2", "q3", "q4"]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

/** Batch create: 1..n issues, each created Open (no draft state). */
export const createIssues = z.object({
  issues: z.array(z.object({ name: z.string().trim().min(1), date: isoDate })).min(1),
});

export const updateIssue = z
  .object({ name: z.string().trim().min(1), date: isoDate })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." });

export const overridePayout = z.object({
  amount: z.number().min(0),
  reason: z.string().trim().min(1), // required; no prior-value audit
});

/** Assign the captain who covered this issue (existing captains only). */
export const setSubstitute = z.object({ substituteCaptainId: uuid });

/**
 * Free-standing comment on a payout cell. Null or empty clears it.
 * Separate from `overridePayout.reason` on purpose (settled): a comment is a
 * general heads-up, not a justification for changing an amount.
 */
export const setPayoutComment = z.object({
  comment: z.string().max(1000).nullish(),
});

/** Rename a financial year. The start date is fixed once the year exists. */
export const updateFinancialYear = z.object({
  name: z.string().trim().min(1),
});
