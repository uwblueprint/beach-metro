// Financial years: the yearly tables (finance flow §4a, §4h, §4i).
import type { z } from "zod";

import { conflict, notFound } from "@/lib/api/errors";
import type { createFinancialYear, yearsQuery } from "@/lib/validation/finance";
import type { CaptainPayoutRow, CaptainRow, FinancialYearRow, IssueRow } from "@/types/db";

import { calculationStatus, effectiveAmount } from "./derive";
import { db, throwDb } from "./shared";

export interface YearSummary {
  id: string;
  name: string;
  archived: boolean;
  issueCount: number;
}

export interface YearDetail {
  id: string;
  name: string;
  archived: boolean;
  /** Column set: every captain appearing in this year's payout cells. */
  captains: Array<{ id: string; name: string }>;
  issues: Array<{
    id: string;
    name: string;
    date: string;
    status: "open" | "closed";
    cells: Array<{
      payoutId: string;
      captainId: string;
      effectiveAmount: number;
      calculationStatus: "calculated" | "overridden";
      paid: boolean;
    }>;
  }>;
}

export async function listYears(filters: z.infer<typeof yearsQuery>): Promise<YearSummary[]> {
  const client = db();
  const [yRes, iRes] = await Promise.all([
    client.from("financial_years").select("*").order("name"),
    client.from("issues").select("id, financial_year_id"),
  ]);
  if (yRes.error) throwDb(yRes.error);
  if (iRes.error) throwDb(iRes.error);
  const issues = (iRes.data ?? []) as Pick<IssueRow, "id" | "financial_year_id">[];

  let all = ((yRes.data ?? []) as FinancialYearRow[]).map((y) => ({
    id: y.id,
    name: y.name,
    archived: y.archived,
    issueCount: issues.filter((i) => i.financial_year_id === y.id).length,
  }));
  if (filters.archived !== undefined) all = all.filter((y) => y.archived === filters.archived);
  return all;
}

async function fetchYear(id: string): Promise<FinancialYearRow> {
  const { data, error } = await db().from("financial_years").select("*").eq("id", id).maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Financial year");
  return data as FinancialYearRow;
}

/** The table: issues × captain payout cells (finance flow §1). */
export async function getYearDetail(id: string): Promise<YearDetail> {
  const year = await fetchYear(id);
  const client = db();

  const { data: issueData, error: issueError } = await client
    .from("issues")
    .select("*")
    .eq("financial_year_id", id)
    .order("date");
  if (issueError) throwDb(issueError);
  const issues = (issueData ?? []) as IssueRow[];

  const issueIds = issues.map((i) => i.id);
  const { data: payoutData, error: payoutError } =
    issueIds.length > 0
      ? await client.from("captain_payouts").select("*").in("issue_id", issueIds)
      : { data: [], error: null };
  if (payoutError) throwDb(payoutError);
  const payouts = (payoutData ?? []) as CaptainPayoutRow[];

  const { data: captainData, error: captainError } = await client
    .from("captains")
    .select("id, first_name, last_name");
  if (captainError) throwDb(captainError);
  const captains = (captainData ?? []) as Pick<CaptainRow, "id" | "first_name" | "last_name">[];

  const columnCaptainIds = [...new Set(payouts.map((p) => p.captain_id))];

  return {
    id: year.id,
    name: year.name,
    archived: year.archived,
    captains: columnCaptainIds.map((cid) => {
      const c = captains.find((x) => x.id === cid);
      return { id: cid, name: c ? `${c.first_name} ${c.last_name}` : "Unknown captain" };
    }),
    issues: issues.map((i) => ({
      id: i.id,
      name: i.name,
      date: i.date,
      status: i.status,
      cells: payouts
        .filter((p) => p.issue_id === i.id)
        .map((p) => ({
          payoutId: p.id,
          captainId: p.captain_id,
          effectiveAmount: effectiveAmount(p),
          calculationStatus: calculationStatus(p),
          paid: p.paid,
        })),
    })),
  };
}

export async function createYear(input: z.infer<typeof createFinancialYear>): Promise<YearSummary> {
  const { data, error } = await db()
    .from("financial_years")
    .insert({ name: input.name })
    .select()
    .single();
  if (error) throwDb(error); // unique name violation → 409
  const y = data as FinancialYearRow;
  return { id: y.id, name: y.name, archived: y.archived, issueCount: 0 };
}

/** Archive: the table stays fully accessible (finance flow §4i). */
export async function archiveYear(id: string): Promise<YearSummary> {
  const year = await fetchYear(id);
  if (year.archived) throw conflict("Financial year is already archived.");
  const { error } = await db().from("financial_years").update({ archived: true }).eq("id", id);
  if (error) throwDb(error);
  const detail = await fetchYear(id);
  const { data } = await db().from("issues").select("id").eq("financial_year_id", id);
  return {
    id: detail.id,
    name: detail.name,
    archived: detail.archived,
    issueCount: (data ?? []).length,
  };
}

/** Read-only CSV export of the year table (finance flow §4h). */
export async function exportYearCsv(id: string): Promise<{ filename: string; csv: string }> {
  const detail = await getYearDetail(id);
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);

  const header = ["Issue", "Date", "Status", ...detail.captains.map((c) => esc(c.name))];
  const lines = [header.join(",")];
  for (const issue of detail.issues) {
    const cells = detail.captains.map((c) => {
      const cell = issue.cells.find((x) => x.captainId === c.id);
      if (!cell) return "";
      return `${cell.effectiveAmount.toFixed(2)}${cell.paid ? " (paid)" : ""}`;
    });
    lines.push([esc(issue.name), issue.date, issue.status, ...cells].join(","));
  }
  return { filename: `${detail.name.replaceAll(/\s+/g, "-")}.csv`, csv: lines.join("\n") + "\n" };
}
