// The live payout calculation (finance flow §3b/§5): recompute every UNPAID
// cell of an open issue from current pay config + territory membership +
// delivery actuals. Paid cells are never touched (paid locks the cell — even
// across a reopen). Closed issues are never recalculated (close freezes values).
import type {
  CaptainPayoutRow,
  CaptainRow,
  CaptainTerritoryRow,
  IssueRow,
  RouteDeliveryRow,
  VolunteerRouteRow,
  VolunteerRow,
} from "@/types/db";

import { calculatedAmount } from "./derive";
import { db, throwDb } from "./shared";

export async function recalculateIssue(issueId: string): Promise<void> {
  const client = db();

  const { data: issueData, error: issueError } = await client
    .from("issues")
    .select("id, status")
    .eq("id", issueId)
    .maybeSingle();
  if (issueError) throwDb(issueError);
  const issue = issueData as Pick<IssueRow, "id" | "status"> | null;
  if (!issue || issue.status !== "open") return; // closed = frozen; nothing to do

  const [payoutsRes, deliveriesRes, routesRes, volunteersRes, territoriesRes, captainsRes] =
    await Promise.all([
      client.from("captain_payouts").select("*").eq("issue_id", issueId),
      client.from("route_deliveries").select("*").eq("issue_id", issueId),
      client.from("volunteer_routes").select("id, assigned_volunteer_id"),
      client.from("volunteers").select("id, captain_territory_id"),
      client.from("captain_territories").select("id, assigned_captain_id"),
      client.from("captains").select("id, pay_type, pay_rate"),
    ]);
  for (const res of [
    payoutsRes,
    deliveriesRes,
    routesRes,
    volunteersRes,
    territoriesRes,
    captainsRes,
  ]) {
    if (res.error) throwDb(res.error);
  }

  const payouts = (payoutsRes.data ?? []) as CaptainPayoutRow[];
  const deliveries = (deliveriesRes.data ?? []) as RouteDeliveryRow[];
  const routes = (routesRes.data ?? []) as Pick<
    VolunteerRouteRow,
    "id" | "assigned_volunteer_id"
  >[];
  const volunteers = (volunteersRes.data ?? []) as Pick<
    VolunteerRow,
    "id" | "captain_territory_id"
  >[];
  const territories = (territoriesRes.data ?? []) as Pick<
    CaptainTerritoryRow,
    "id" | "assigned_captain_id"
  >[];
  const captains = (captainsRes.data ?? []) as Pick<CaptainRow, "id" | "pay_type" | "pay_rate">[];

  // Rollup chain (data model ERD): delivery → route → volunteer → territory → captain.
  const volunteerByRoute = new Map(routes.map((r) => [r.id, r.assigned_volunteer_id]));
  const territoryByVolunteer = new Map(volunteers.map((v) => [v.id, v.captain_territory_id]));
  const captainByTerritory = new Map(territories.map((t) => [t.id, t.assigned_captain_id]));

  const deliveriesByCaptain = new Map<string, RouteDeliveryRow[]>();
  for (const d of deliveries) {
    const volunteerId = volunteerByRoute.get(d.route_id);
    if (!volunteerId) continue; // detached/deleted route: contributes to nobody while open
    const territoryId = territoryByVolunteer.get(volunteerId);
    if (!territoryId) continue;
    const captainId = captainByTerritory.get(territoryId);
    if (!captainId) continue;
    const list = deliveriesByCaptain.get(captainId) ?? [];
    list.push(d);
    deliveriesByCaptain.set(captainId, list);
  }

  for (const payout of payouts) {
    if (payout.paid) continue; // paid locks the cell, even on a reopened issue
    const captain = captains.find((c) => c.id === payout.captain_id);
    if (!captain) continue;
    const rows = (deliveriesByCaptain.get(payout.captain_id) ?? []).map((d) => ({
      paperCount: d.paper_count,
      bundles: d.bundles,
      dropCount: d.drop_count,
      missedCount: d.missed_count,
    }));
    const amount = calculatedAmount(captain.pay_type, captain.pay_rate, rows);
    if (amount !== payout.calculated_amount) {
      const { error } = await client
        .from("captain_payouts")
        .update({ calculated_amount: amount })
        .eq("id", payout.id);
      if (error) throwDb(error);
    }
  }
}

/** Recalculate every open issue (e.g. after a captain's pay config changes). */
export async function recalculateOpenIssues(): Promise<void> {
  const { data, error } = await db().from("issues").select("id").eq("status", "open");
  if (error) throwDb(error);
  for (const row of (data ?? []) as Pick<IssueRow, "id">[]) {
    await recalculateIssue(row.id);
  }
}
