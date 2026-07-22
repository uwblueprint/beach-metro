// Pure derivations from the flow docs — no I/O, unit-tested directly.
// Derived values are computed, never stored (data model convention).
import type { CaptainPayoutRow, PayType, RouteBundle, VolunteerRow } from "@/types/db";

export type VolunteerStatus = "active" | "on-vacation" | "retired";

/** Volunteer status (people flow §3a): retiredAt → Retired; today in window → On vacation. */
export function volunteerStatus(
  v: Pick<VolunteerRow, "retired_at" | "vacation_start" | "vacation_end">,
  today: string,
): VolunteerStatus {
  if (v.retired_at) return "retired";
  if (v.vacation_start && v.vacation_end && v.vacation_start <= today && today <= v.vacation_end) {
    return "on-vacation";
  }
  return "active";
}

/** Needs attention: end date passed but not retired (a planning flag, never an auto-retire). */
export function volunteerNeedsAttention(
  v: Pick<VolunteerRow, "end_date" | "retired_at">,
  today: string,
): boolean {
  return v.end_date !== null && v.end_date < today && v.retired_at === null;
}

/**
 * Greedy bundle split (finance flow §5): take 50s first, then 25s, then the
 * remainder as a final tied bundle. 130 → [50,50,25,5]; 70 → [50,20]; 0 → [].
 */
export function greedySplit(paperCount: number): RouteBundle[] {
  if (!Number.isInteger(paperCount) || paperCount < 0) {
    throw new Error(`paperCount must be a non-negative integer, got ${paperCount}`);
  }
  const bundles: RouteBundle[] = [];
  let rest = paperCount;
  while (rest >= 50) {
    bundles.push({ papers: 50 });
    rest -= 50;
  }
  while (rest >= 25) {
    bundles.push({ papers: 25 });
    rest -= 25;
  }
  if (rest > 0) bundles.push({ papers: rest });
  return bundles;
}

/** Bundle count is DERIVED from the stored per-bundle breakdown. */
export function bundleCount(bundles: RouteBundle[]): number {
  return bundles.length;
}

export interface DeliveryCounts {
  paperCount: number;
  bundles: RouteBundle[];
  dropCount: number;
  missedCount: number;
}

/**
 * A route delivery's billable quantity in the captain's pay unit, with the
 * missed count deducted in that same unit (no cross-unit conversion) and
 * clamped at zero (interpretation: missed can never make a route bill negative).
 */
export function billableQuantity(payType: PayType, d: DeliveryCounts): number {
  const unitCount =
    payType === "bundle" ? d.bundles.length : payType === "paper" ? d.paperCount : d.dropCount;
  return Math.max(0, unitCount - d.missedCount);
}

/**
 * A captain's calculated payout for an issue: rate × the summed billable
 * quantity across their territory's route deliveries. Rounded to cents
 * (interpretation — exact rounding rules are an [OPEN] client item).
 */
export function calculatedAmount(
  payType: PayType,
  payRate: number,
  deliveries: DeliveryCounts[],
): number {
  const quantity = deliveries.reduce((sum, d) => sum + billableQuantity(payType, d), 0);
  return Math.round(payRate * quantity * 100) / 100;
}

/** Effective amount of a payout cell: override wins over the live calculation. */
export function effectiveAmount(
  p: Pick<CaptainPayoutRow, "calculated_amount" | "override_amount">,
): number {
  return p.override_amount ?? p.calculated_amount;
}

/** Calculation status is derived: an override present means Overridden. */
export function calculationStatus(
  p: Pick<CaptainPayoutRow, "override_amount">,
): "calculated" | "overridden" {
  return p.override_amount === null ? "calculated" : "overridden";
}
