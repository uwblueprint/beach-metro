// Issues: the shared lifecycle (finance flow §3a, delivery flow §3a).
// Created OPEN (no draft): creation auto-populates payout cells for captains
// active at that moment and delivery rows for carried routes, then starts live
// calc. Close locks payouts + actuals together; reopen is a guarded correction.
import type { z } from "zod";

import { conflict, notFound } from "@/lib/api/errors";
import type { createIssues, updateIssue } from "@/lib/validation/finance";
import type {
  CaptainPayoutRow,
  CaptainRow,
  FinancialYearRow,
  IssueRow,
  IssueStatus,
  RouteDeliveryRow,
  VolunteerRouteRow,
  VolunteerRow,
} from "@/types/db";

import { greedySplit, volunteerStatus } from "./derive";
import { recalculateIssue } from "./recalc";
import { coercePayoutNumerics, db, throwDb, today } from "./shared";

export interface IssueSummary {
  id: string;
  financialYearId: string;
  name: string;
  date: string;
  status: IssueStatus;
}

function toSummary(i: IssueRow): IssueSummary {
  return {
    id: i.id,
    financialYearId: i.financial_year_id,
    name: i.name,
    date: i.date,
    status: i.status,
  };
}

export async function fetchIssue(id: string): Promise<IssueRow> {
  const { data, error } = await db().from("issues").select("*").eq("id", id).maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Issue");
  return data as IssueRow;
}

export async function listIssues(yearId: string): Promise<IssueSummary[]> {
  const { data, error } = await db()
    .from("issues")
    .select("*")
    .eq("financial_year_id", yearId)
    .order("date");
  if (error) throwDb(error);
  return ((data ?? []) as IssueRow[]).map(toSummary);
}

export async function getIssue(id: string): Promise<IssueSummary> {
  return toSummary(await fetchIssue(id));
}

/**
 * Create 1..n issues in a year, each born Open:
 * - a route_deliveries row per carried route (assigned + volunteer not on
 *   vacation; vacant/suspended/deleted routes are skipped), seeded from the
 *   route's standing paper count and the greedy bundle split;
 * - a captain_payouts cell per captain active at creation;
 * - live calculation runs immediately.
 * Creating an issue never closes another one (locked decision).
 */
export async function createIssuesBatch(
  yearId: string,
  input: z.infer<typeof createIssues>,
): Promise<IssueSummary[]> {
  const client = db();

  const { data: yearData, error: yearError } = await client
    .from("financial_years")
    .select("*")
    .eq("id", yearId)
    .maybeSingle();
  if (yearError) throwDb(yearError);
  const year = yearData as FinancialYearRow | null;
  if (!year) throw notFound("Financial year");
  if (year.archived) throw conflict("Cannot add issues to an archived year.");

  // Context for population, fetched once for the batch.
  const [routesRes, volunteersRes, captainsRes] = await Promise.all([
    client
      .from("volunteer_routes")
      .select("id, papers, assigned_volunteer_id")
      .is("deleted_at", null)
      .not("assigned_volunteer_id", "is", null),
    client.from("volunteers").select("id, retired_at, vacation_start, vacation_end"),
    client.from("captains").select("id, retired_at"),
  ]);
  if (routesRes.error) throwDb(routesRes.error);
  if (volunteersRes.error) throwDb(volunteersRes.error);
  if (captainsRes.error) throwDb(captainsRes.error);

  const date = today();
  const volunteers = (volunteersRes.data ?? []) as Pick<
    VolunteerRow,
    "id" | "retired_at" | "vacation_start" | "vacation_end"
  >[];
  const carriableRoutes = (
    (routesRes.data ?? []) as Pick<VolunteerRouteRow, "id" | "papers" | "assigned_volunteer_id">[]
  ).filter((r) => {
    const v = volunteers.find((x) => x.id === r.assigned_volunteer_id);
    // Skip suspended (volunteer on vacation) and defensive: retired carriers.
    return v !== undefined && volunteerStatus(v, date) === "active";
  });
  const activeCaptainIds = ((captainsRes.data ?? []) as Pick<CaptainRow, "id" | "retired_at">[])
    .filter((c) => c.retired_at === null)
    .map((c) => c.id);

  const created: IssueSummary[] = [];
  for (const item of input.issues) {
    const { data: issueData, error: issueError } = await client
      .from("issues")
      .insert({ financial_year_id: yearId, name: item.name, date: item.date, status: "open" })
      .select()
      .single();
    if (issueError) throwDb(issueError);
    const issue = issueData as IssueRow;

    try {
      if (carriableRoutes.length > 0) {
        const { error: deliveriesError } = await client.from("route_deliveries").insert(
          carriableRoutes.map((r) => ({
            issue_id: issue.id,
            route_id: r.id,
            paper_count: r.papers,
            bundles: greedySplit(r.papers),
            drop_count: 0,
            missed_count: 0,
          })),
        );
        if (deliveriesError) throwDb(deliveriesError);
      }

      if (activeCaptainIds.length > 0) {
        const { error: payoutsError } = await client.from("captain_payouts").insert(
          activeCaptainIds.map((captainId) => ({
            issue_id: issue.id,
            captain_id: captainId,
            calculated_amount: 0,
          })),
        );
        if (payoutsError) throwDb(payoutsError);
      }

      await recalculateIssue(issue.id);
    } catch (err) {
      await client.from("issues").delete().eq("id", issue.id);
      throw err;
    }

    created.push(toSummary(issue));
  }
  return created;
}

/** Name/date are manual metadata, editable regardless of status (interpretation). */
export async function updateIssueRecord(
  id: string,
  input: z.infer<typeof updateIssue>,
): Promise<IssueSummary> {
  await fetchIssue(id);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.date !== undefined) patch.date = input.date;
  const { error } = await db().from("issues").update(patch).eq("id", id);
  if (error) throwDb(error);
  return getIssue(id);
}

/** One shared close: locks payout values + delivery actuals together. */
export async function closeIssue(id: string): Promise<IssueSummary> {
  const issue = await fetchIssue(id);
  if (issue.status === "closed") throw conflict("Issue is already closed.");
  const { error } = await db().from("issues").update({ status: "closed" }).eq("id", id);
  if (error) throwDb(error);
  return getIssue(id);
}

/** Guarded admin correction; unpaid cells resume live calc, paid cells stay frozen. */
export async function reopenIssue(id: string): Promise<IssueSummary> {
  const issue = await fetchIssue(id);
  if (issue.status === "open") throw conflict("Issue is already open.");
  const { error } = await db().from("issues").update({ status: "open" }).eq("id", id);
  if (error) throwDb(error);
  await recalculateIssue(id);
  return getIssue(id);
}

/** Papers to order: sum of the issue's route paper counts (delivery flow §4b). */
export async function papersToOrder(issueId: string): Promise<{ issueId: string; total: number }> {
  await fetchIssue(issueId);
  const { data, error } = await db()
    .from("route_deliveries")
    .select("paper_count")
    .eq("issue_id", issueId);
  if (error) throwDb(error);
  const total = ((data ?? []) as Pick<RouteDeliveryRow, "paper_count">[]).reduce(
    (sum, d) => sum + d.paper_count,
    0,
  );
  return { issueId, total };
}

/**
 * Lock an issue: freeze every unpaid cell in it at once.
 *
 * PENDING(Q1). The backend models freezing per cell (finance flow §3b): one
 * captain's amount is snapshotted so later route or carrier edits cannot move it.
 * The finances design instead puts a single lock on the whole issue row, which is
 * a better fit for how the office actually works — on bundling day you settle the
 * whole run, not one captain at a time.
 *
 * So this is deliberately a BULK ACTION over the existing per-cell freeze rather
 * than a new `locked` column on the issue. Nothing is lost either way: if Q1 comes
 * back saying locking really is per captain, the per-cell endpoints are still
 * there and this just stops being used.
 *
 * Paid cells are skipped, not an error: paid already locks a cell against every
 * edit, so they are locked by definition and freezing them would be redundant.
 */
export async function lockIssue(id: string): Promise<IssueSummary> {
  const issue = await fetchIssue(id);
  const client = db();

  const { data, error } = await client.from("captain_payouts").select("*").eq("issue_id", issue.id);
  if (error) throwDb(error);

  const cells = ((data ?? []) as CaptainPayoutRow[]).map(coercePayoutNumerics);
  const toFreeze = cells.filter((c) => !c.paid && c.frozen_amount === null);
  if (cells.length === 0) throw conflict("This issue has no payout cells to lock.");

  const stamp = today();
  for (const cell of toFreeze) {
    const { error: freezeError } = await client
      .from("captain_payouts")
      .update({ frozen_amount: cell.calculated_amount, frozen_at: stamp })
      .eq("id", cell.id);
    if (freezeError) throwDb(freezeError);
  }

  return getIssue(id);
}

/** Unlock an issue: unfreeze every frozen, unpaid cell so they track live again. */
export async function unlockIssue(id: string): Promise<IssueSummary> {
  const issue = await fetchIssue(id);
  const client = db();

  const { data, error } = await client.from("captain_payouts").select("*").eq("issue_id", issue.id);
  if (error) throwDb(error);

  const cells = ((data ?? []) as CaptainPayoutRow[]).map(coercePayoutNumerics);
  const toThaw = cells.filter((c) => !c.paid && c.frozen_amount !== null);

  for (const cell of toThaw) {
    const { error: thawError } = await client
      .from("captain_payouts")
      .update({ frozen_amount: null, frozen_at: null })
      .eq("id", cell.id);
    if (thawError) throwDb(thawError);
  }

  // Cells that just went back to tracking the live calculation need recomputing,
  // since the numbers may have moved while they were frozen.
  await recalculateIssue(id);
  return getIssue(id);
}
