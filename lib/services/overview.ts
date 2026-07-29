// Overview dashboard aggregates.
//
// Everything here is read-only and derived on demand — none of these totals are
// stored. Grouped in one endpoint because the dashboard renders them together
// and deriving six figures from four list endpoints client-side would be both
// wasteful and racy.
import type { z } from "zod";

import { notFound } from "@/lib/api/errors";

import type { periodQuery } from "@/lib/validation/finance";
import type {
  CaptainPayoutRow,
  CaptainRow,
  FinancialYearRow,
  IssueRow,
  RouteDeliveryRow,
  VolunteerRouteRow,
  VolunteerRow,
} from "@/types/db";

import { effectiveAmount, volunteerStatus } from "./derive";
import { db, throwDb, today } from "./shared";

export type Period = "ytd" | "q1" | "q2" | "q3" | "q4";

export interface DateRange {
  from: string;
  to: string;
}

/** Add whole months to a YYYY-MM-DD date, clamping to the month's last day. */
function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayBefore(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

/**
 * Resolve a period to a date range. Quarters are relative to the financial
 * year's own start month, not the calendar — a year starting in March has
 * Q1 = March–May. Pure, so the quarter maths is unit-testable.
 */
export function periodRange(yearStart: string, period: Period): DateRange {
  if (period === "ytd") {
    return { from: yearStart, to: dayBefore(addMonths(yearStart, 12)) };
  }
  const offset = { q1: 0, q2: 3, q3: 6, q4: 9 }[period];
  const from = addMonths(yearStart, offset);
  return { from, to: dayBefore(addMonths(from, 3)) };
}

export interface CaptainPaymentLine {
  captainId: string;
  captainName: string;
  payType: string;
  payCadence: string;
  amount: number;
}

export interface SubstitutePaymentLine {
  captainId: string;
  captainName: string;
  /** Whose issues they covered, and how many. */
  coveredFor: Array<{ captainId: string; captainName: string; issueCount: number }>;
  issueCount: number;
  amount: number;
}

export interface Overview {
  year: { id: string; name: string; startDate: string };
  range: DateRange;
  stats: {
    /** Papers on the next dated issue at or after today (null if none scheduled). */
    nextIssue: { id: string; name: string; date: string; papers: number } | null;
    activeVolunteers: number;
    totalVolunteers: number;
    routesMissingCarrier: number;
    captainCosts: number;
    issueCount: number;
  };
  /** Cost per calendar month across the year, in the year's own month order. */
  monthlyCosts: Array<{ month: string; amount: number }>;
  captainPayments: CaptainPaymentLine[];
  /** Broken out from captainPayments: money owed to whoever covered an issue. */
  substitutePayments: SubstitutePaymentLine[];
  papersPerIssue: Array<{ issueId: string; name: string; date: string; papers: number }>;
}

async function resolveYear(yearId?: string): Promise<FinancialYearRow> {
  const client = db();
  const query = yearId
    ? client.from("financial_years").select("*").eq("id", yearId)
    : client.from("financial_years").select("*").eq("archived", false).order("start_date", {
        ascending: false,
      });
  const { data, error } = await query.limit(1);
  if (error) throwDb(error);
  const rows = (data ?? []) as FinancialYearRow[];
  if (rows.length === 0) throw notFound("Financial year");
  return rows[0];
}

export async function getOverview(filters: z.infer<typeof periodQuery>): Promise<Overview> {
  const year = await resolveYear(filters.yearId);
  // An explicit from/to wins over the named period, for the custom date range.
  const range =
    filters.from && filters.to
      ? { from: filters.from, to: filters.to }
      : periodRange(year.start_date, filters.period ?? "ytd");

  const client = db();
  const [issuesRes, volunteersRes, routesRes, captainsRes] = await Promise.all([
    client.from("issues").select("*").eq("financial_year_id", year.id).order("date"),
    client.from("volunteers").select("*"),
    client.from("volunteer_routes").select("*").is("deleted_at", null),
    client.from("captains").select("*"),
  ]);
  if (issuesRes.error) throwDb(issuesRes.error);
  if (volunteersRes.error) throwDb(volunteersRes.error);
  if (routesRes.error) throwDb(routesRes.error);
  if (captainsRes.error) throwDb(captainsRes.error);

  const allIssues = (issuesRes.data ?? []) as IssueRow[];
  const volunteers = (volunteersRes.data ?? []) as VolunteerRow[];
  const routes = (routesRes.data ?? []) as VolunteerRouteRow[];
  const captains = (captainsRes.data ?? []) as CaptainRow[];

  const inRange = allIssues.filter((i) => i.date >= range.from && i.date <= range.to);
  const issueIds = inRange.map((i) => i.id);

  const [payoutsRes, deliveriesRes] = await Promise.all([
    issueIds.length
      ? client.from("captain_payouts").select("*").in("issue_id", issueIds)
      : Promise.resolve({ data: [], error: null }),
    issueIds.length
      ? client.from("route_deliveries").select("*").in("issue_id", issueIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (payoutsRes.error) throwDb(payoutsRes.error);
  if (deliveriesRes.error) throwDb(deliveriesRes.error);
  const payouts = (payoutsRes.data ?? []) as CaptainPayoutRow[];
  const deliveries = (deliveriesRes.data ?? []) as RouteDeliveryRow[];

  const date = today();
  const nameOf = (id: string) => {
    const c = captains.find((x) => x.id === id);
    return c ? `${c.first_name} ${c.last_name}` : "Unknown captain";
  };
  const papersFor = (issueId: string) =>
    deliveries.filter((d) => d.issue_id === issueId).reduce((s, d) => s + d.paper_count, 0);

  // Next scheduled issue. Deliveries may not exist for it yet, in which case the
  // standing route papers are the number the office would order.
  const upcoming = allIssues.find((i) => i.date >= date) ?? null;
  const standingPapers = routes.reduce((s, r) => s + r.papers, 0);

  // Substitute pay is attributed to whoever covered, and excluded from the
  // covered captain's own line so the two lists don't double-count.
  const substituteBy = new Map<string, { amount: number; covered: Map<string, number> }>();
  const ownAmount = new Map<string, number>();
  for (const p of payouts) {
    const amount = effectiveAmount(p);
    if (p.substitute_captain_id) {
      const acc = substituteBy.get(p.substitute_captain_id) ?? { amount: 0, covered: new Map() };
      acc.amount += amount;
      acc.covered.set(p.captain_id, (acc.covered.get(p.captain_id) ?? 0) + 1);
      substituteBy.set(p.substitute_captain_id, acc);
    } else {
      ownAmount.set(p.captain_id, (ownAmount.get(p.captain_id) ?? 0) + amount);
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;

  const captainPayments: CaptainPaymentLine[] = [...ownAmount.entries()]
    .map(([captainId, amount]) => {
      const c = captains.find((x) => x.id === captainId);
      return {
        captainId,
        captainName: nameOf(captainId),
        payType: c?.pay_type ?? "",
        payCadence: c?.pay_cadence ?? "",
        amount: round(amount),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const substitutePayments: SubstitutePaymentLine[] = [...substituteBy.entries()]
    .map(([captainId, acc]) => ({
      captainId,
      captainName: nameOf(captainId),
      coveredFor: [...acc.covered.entries()].map(([id, issueCount]) => ({
        captainId: id,
        captainName: nameOf(id),
        issueCount,
      })),
      issueCount: [...acc.covered.values()].reduce((s, n) => s + n, 0),
      amount: round(acc.amount),
    }))
    .sort((a, b) => b.amount - a.amount);

  // Twelve buckets from the year's start month, so the chart reads in the
  // office's own year order rather than January-first.
  const monthlyCosts = Array.from({ length: 12 }, (_, i) => {
    const monthStart = addMonths(year.start_date, i);
    const monthEnd = dayBefore(addMonths(year.start_date, i + 1));
    const ids = new Set(
      allIssues.filter((x) => x.date >= monthStart && x.date <= monthEnd).map((x) => x.id),
    );
    return {
      month: monthStart.slice(0, 7),
      amount: round(
        payouts.filter((p) => ids.has(p.issue_id)).reduce((s, p) => s + effectiveAmount(p), 0),
      ),
    };
  });

  return {
    year: { id: year.id, name: year.name, startDate: year.start_date },
    range,
    stats: {
      nextIssue: upcoming
        ? {
            id: upcoming.id,
            name: upcoming.name,
            date: upcoming.date,
            papers: papersFor(upcoming.id) || standingPapers,
          }
        : null,
      // Retiring drops a volunteer from active but keeps them in the total;
      // deleting is what removes them from both.
      activeVolunteers: volunteers.filter((v) => volunteerStatus(v, date) === "active").length,
      totalVolunteers: volunteers.length,
      routesMissingCarrier: routes.filter((r) => r.assigned_volunteer_id === null).length,
      captainCosts: round(payouts.reduce((s, p) => s + effectiveAmount(p), 0)),
      issueCount: inRange.length,
    },
    monthlyCosts,
    captainPayments,
    substitutePayments,
    papersPerIssue: inRange
      .map((i) => ({ issueId: i.id, name: i.name, date: i.date, papers: papersFor(i.id) }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}
