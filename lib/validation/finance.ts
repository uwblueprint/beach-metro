// Request schemas for the finance domain (years, issues, payouts).
import { z } from "zod";

import { boolQuery, isoDate, uuid } from "./common";

export const yearsQuery = z.object({ archived: boolQuery });

export const createFinancialYear = z.object({
  name: z.string().trim().min(1), // e.g. "2026–2027"
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

/** Reallocate this cell's amount to another captain (finance flow §4g). */
export const transferPayout = z.object({ toCaptainId: uuid });
