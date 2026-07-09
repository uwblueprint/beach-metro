// Route deliveries: per-route-per-issue actuals (delivery flow §4a).
// Editable only while the issue is Open; every edit re-runs the live payout calc.
import type { z } from "zod";

import { conflict, invalid, notFound } from "@/lib/api/errors";
import type { updateDelivery } from "@/lib/validation/delivery";
import type { IssueRow, RouteBundle, RouteDeliveryRow, VolunteerRouteRow } from "@/types/db";

import { bundleCount, greedySplit } from "./derive";
import { recalculateIssue } from "./recalc";
import { db, throwDb } from "./shared";

export interface DeliverySummary {
  id: string;
  issueId: string;
  routeId: string;
  streetName: string;
  paperCount: number;
  bundles: RouteBundle[];
  bundleCount: number; // derived, never stored
  dropCount: number;
  missedCount: number;
}

function toSummary(d: RouteDeliveryRow, streetName: string): DeliverySummary {
  return {
    id: d.id,
    issueId: d.issue_id,
    routeId: d.route_id,
    streetName,
    paperCount: d.paper_count,
    bundles: d.bundles,
    bundleCount: bundleCount(d.bundles),
    dropCount: d.drop_count,
    missedCount: d.missed_count,
  };
}

async function streetNames(routeIds: string[]): Promise<Map<string, string>> {
  if (routeIds.length === 0) return new Map();
  const { data, error } = await db()
    .from("volunteer_routes")
    .select("id, street_name")
    .in("id", routeIds);
  if (error) throwDb(error);
  return new Map(
    ((data ?? []) as Pick<VolunteerRouteRow, "id" | "street_name">[]).map((r) => [
      r.id,
      r.street_name,
    ]),
  );
}

export async function listDeliveries(issueId: string): Promise<DeliverySummary[]> {
  const { data: issueData, error: issueError } = await db()
    .from("issues")
    .select("id")
    .eq("id", issueId)
    .maybeSingle();
  if (issueError) throwDb(issueError);
  if (!issueData) throw notFound("Issue");

  const { data, error } = await db().from("route_deliveries").select("*").eq("issue_id", issueId);
  if (error) throwDb(error);
  const rows = (data ?? []) as RouteDeliveryRow[];
  const names = await streetNames(rows.map((r) => r.route_id));
  return rows
    .map((d) => toSummary(d, names.get(d.route_id) ?? ""))
    .sort((a, b) => a.streetName.localeCompare(b.streetName));
}

async function fetchDelivery(id: string): Promise<RouteDeliveryRow> {
  const { data, error } = await db()
    .from("route_deliveries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Delivery");
  return data as RouteDeliveryRow;
}

export async function getDelivery(id: string): Promise<DeliverySummary> {
  const d = await fetchDelivery(id);
  const names = await streetNames([d.route_id]);
  return toSummary(d, names.get(d.route_id) ?? "");
}

/**
 * Edit actuals. Rules (delivery flow §4a, data model invariant):
 * - 409 when the issue is Closed (locked; reopen to correct).
 * - paperCount change reseeds the greedy split unless bundles are also provided.
 * - provided bundles must sum to the effective paperCount (422).
 * - saved counts immediately roll up into the captain payouts (live calc).
 */
export async function updateDeliveryRecord(
  id: string,
  input: z.infer<typeof updateDelivery>,
): Promise<DeliverySummary> {
  const d = await fetchDelivery(id);

  const { data: issueData, error: issueError } = await db()
    .from("issues")
    .select("status")
    .eq("id", d.issue_id)
    .maybeSingle();
  if (issueError) throwDb(issueError);
  if ((issueData as Pick<IssueRow, "status"> | null)?.status !== "open") {
    throw conflict("Delivery actuals are locked — the issue is closed.");
  }

  const nextPaperCount = input.paperCount ?? d.paper_count;
  let nextBundles: RouteBundle[];
  if (input.bundles !== undefined) {
    const sum = input.bundles.reduce((s, b) => s + b.papers, 0);
    if (sum !== nextPaperCount) {
      throw invalid(`bundles must sum to paperCount (${sum} != ${nextPaperCount}).`);
    }
    nextBundles = input.bundles;
  } else if (input.paperCount !== undefined && input.paperCount !== d.paper_count) {
    nextBundles = greedySplit(input.paperCount); // reseed
  } else {
    nextBundles = d.bundles;
  }

  const { error } = await db()
    .from("route_deliveries")
    .update({
      paper_count: nextPaperCount,
      bundles: nextBundles,
      drop_count: input.dropCount ?? d.drop_count,
      missed_count: input.missedCount ?? d.missed_count,
    })
    .eq("id", id);
  if (error) throwDb(error);

  await recalculateIssue(d.issue_id);
  return getDelivery(id);
}
