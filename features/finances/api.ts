// Data layer for the finances and overview screens: query keys, fetchers, mutations.
//
// Response types come from the services that produce them rather than being
// re-declared here, same as features/members/api.ts. Type-only imports, so no
// server code reaches the bundle.
//
// Several mutations here are marked PENDING(Qn) — they encode an assumption about
// how the office works that design has not confirmed yet. Each one names the
// question; docs/finances_pending_decisions.md has the full list and what changes
// when an answer lands.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { YearDetail, YearSummary } from "@/lib/services/financial-years";
import type { IssueSummary } from "@/lib/services/issues";
import type { Overview, Period } from "@/lib/services/overview";
import type { PayoutDetail } from "@/lib/services/payouts";

export type { YearSummary, YearDetail, Overview, Period, IssueSummary, PayoutDetail };

/** One cell of the issues x captains grid. */
export type GridCell = YearDetail["issues"][number]["cells"][number];
/** One row of the grid. */
export type GridIssue = YearDetail["issues"][number];

export const financeKeys = {
  all: ["finances"] as const,
  years: () => ["finances", "years"] as const,
  year: (id: string) => ["finances", "year", id] as const,
  payout: (id: string) => ["finances", "payout", id] as const,
  overview: (yearId: string | undefined, period: Period) =>
    ["finances", "overview", yearId ?? "current", period] as const,
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Every year, newest first, for the table picker. Includes archived ones. */
export function useYears() {
  return useQuery({
    queryKey: financeKeys.years(),
    queryFn: () => api.get<YearSummary[]>("/api/financial-years"),
  });
}

/** The whole grid for one year: captain columns, issue rows, and every cell. */
export function useYearDetail(yearId: string | null) {
  return useQuery({
    queryKey: financeKeys.year(yearId ?? ""),
    queryFn: () => api.get<YearDetail>(`/api/financial-years/${yearId}`),
    enabled: !!yearId,
  });
}

/** Cell detail with the quantity x rate breakdown, for the amount popover. */
export function usePayoutDetail(payoutId: string | null) {
  return useQuery({
    queryKey: financeKeys.payout(payoutId ?? ""),
    queryFn: () => api.get<PayoutDetail>(`/api/payouts/${payoutId}`),
    enabled: !!payoutId,
  });
}

export function useOverview(yearId: string | undefined, period: Period) {
  return useQuery({
    queryKey: financeKeys.overview(yearId, period),
    queryFn: () => api.get<Overview>("/api/overview", { yearId, period }),
    // Keep the previous figures up while a new period loads, so the stat tiles
    // do not blank out every time the filter changes.
    placeholderData: (previous) => previous,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Anything that touches a cell changes the grid, the cell's own detail, and the
 * overview totals. One helper so no mutation forgets one of the three.
 */
function useGridInvalidation(yearId: string | null) {
  const queryClient = useQueryClient();
  return () => {
    if (yearId) queryClient.invalidateQueries({ queryKey: financeKeys.year(yearId) });
    queryClient.invalidateQueries({ queryKey: ["finances", "overview"] });
    queryClient.invalidateQueries({ queryKey: ["finances", "payout"] });
  };
}

export function useCreateYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; startDate: string }) =>
      api.post<YearSummary>("/api/financial-years", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.years() }),
  });
}

/** Rename only. The start date is fixed once the year exists (it sets quarters). */
export function useRenameYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ yearId, name }: { yearId: string; name: string }) =>
      api.patch<YearSummary>(`/api/financial-years/${yearId}`, { name }),
    onSuccess: (_data, { yearId }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.years() });
      queryClient.invalidateQueries({ queryKey: financeKeys.year(yearId) });
    },
  });
}

export function useArchiveYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (yearId: string) => api.post<YearSummary>(`/api/financial-years/${yearId}/archive`),
    onSuccess: (_data, yearId) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.years() });
      queryClient.invalidateQueries({ queryKey: financeKeys.year(yearId) });
    },
  });
}

/**
 * Add an issue. Creating one auto-populates a payout cell per active captain and a
 * delivery row per carried route, so the whole grid changes, not just one row.
 */
export function useAddIssue(yearId: string | null) {
  const invalidate = useGridInvalidation(yearId);
  return useMutation({
    mutationFn: ({ name, date }: { name: string; date: string }) =>
      api.post<IssueSummary[]>(`/api/financial-years/${yearId}/issues`, {
        issues: [{ name, date }],
      }),
    onSuccess: invalidate,
  });
}

/**
 * Lock or unlock a whole issue.
 *
 * PENDING(Q1). The design has one lock per issue row; the backend models freezing
 * per cell. This calls a bulk endpoint that freezes every unpaid cell in the issue,
 * so the per-cell endpoints stay available if the answer turns out to be per cell.
 */
export function useToggleIssueLock(yearId: string | null) {
  const invalidate = useGridInvalidation(yearId);
  return useMutation({
    mutationFn: ({ issueId, locked }: { issueId: string; locked: boolean }) =>
      api.post<IssueSummary>(`/api/issues/${issueId}/${locked ? "unlock" : "lock"}`),
    onSuccess: invalidate,
  });
}

/** Manual amount with a required reason. Rejected on a paid cell (409). */
export function useOverridePayout(yearId: string | null) {
  const invalidate = useGridInvalidation(yearId);
  return useMutation({
    mutationFn: ({
      payoutId,
      amount,
      reason,
    }: {
      payoutId: string;
      amount: number;
      reason: string;
    }) => api.post<PayoutDetail>(`/api/payouts/${payoutId}/override`, { amount, reason }),
    onSuccess: invalidate,
  });
}

export function useClearOverride(yearId: string | null) {
  const invalidate = useGridInvalidation(yearId);
  return useMutation({
    mutationFn: (payoutId: string) =>
      api.post<PayoutDetail>(`/api/payouts/${payoutId}/clear-override`),
    onSuccess: invalidate,
  });
}

/**
 * PENDING(Q2 / Q3). The design ticks paid whenever, with no way to untick, so this
 * is what the UI calls. The backend no longer requires the issue to be closed, and
 * `useUnmarkPaid` below stays available even though nothing renders it yet — an
 * accidental tick currently needs a database edit to undo.
 */
export function useMarkPaid(yearId: string | null) {
  const invalidate = useGridInvalidation(yearId);
  return useMutation({
    mutationFn: (payoutId: string) => api.post<PayoutDetail>(`/api/payouts/${payoutId}/mark-paid`),
    onSuccess: invalidate,
  });
}

/** Wired but not surfaced. See PENDING(Q3). */
export function useUnmarkPaid(yearId: string | null) {
  const invalidate = useGridInvalidation(yearId);
  return useMutation({
    mutationFn: (payoutId: string) =>
      api.post<PayoutDetail>(`/api/payouts/${payoutId}/unmark-paid`),
    onSuccess: invalidate,
  });
}

/**
 * Record or clear who covered this issue.
 *
 * PENDING(Q6). The design shows one covered captain per line. The backend already
 * allows the same person to cover several different captains, so nothing here caps
 * it; the picker just does not offer that yet.
 */
export function useSetSubstitute(yearId: string | null) {
  const invalidate = useGridInvalidation(yearId);
  return useMutation({
    mutationFn: ({
      payoutId,
      substituteCaptainId,
    }: {
      payoutId: string;
      substituteCaptainId: string | null;
    }) =>
      substituteCaptainId === null
        ? api.del<PayoutDetail>(`/api/payouts/${payoutId}/substitute`)
        : api.post<PayoutDetail>(`/api/payouts/${payoutId}/substitute`, { substituteCaptainId }),
    onSuccess: invalidate,
  });
}

/**
 * PENDING(Q4). A free-standing note on a cell, deliberately not the same field as
 * the reason attached to an override. Sending null or blank clears it.
 */
export function useSetCellComment(yearId: string | null) {
  const invalidate = useGridInvalidation(yearId);
  return useMutation({
    mutationFn: ({ payoutId, comment }: { payoutId: string; comment: string | null }) =>
      api.patch<PayoutDetail>(`/api/payouts/${payoutId}/comment`, { comment }),
    onSuccess: invalidate,
  });
}

/**
 * PENDING(Q7). Moving a whole payment to another captain still exists on the
 * backend but is deliberately not wired, because the design replaced it with
 * recording a substitute. If Q7 comes back as (b), this is where it hooks in:
 *
 *   api.post(`/api/payouts/${payoutId}/transfer`, { toCaptainId })
 */

/** CSV export is a file download, so it bypasses the JSON client entirely. */
export function yearCsvUrl(yearId: string): string {
  return `/api/financial-years/${yearId}/export?format=csv`;
}
