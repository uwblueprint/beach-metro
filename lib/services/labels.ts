// Label printing (PRD Flow 6): pick the bundles that need a sticker this issue,
// mark them off, and render them to a printable PDF sheet.
//
// The unit is the BUNDLE, not the route. A route with three bundles can have one
// labelled and two not, so everything here — selection, marking, export — is
// addressed as (deliveryId, bundleIndex). See the bundle_labels migration for why
// that key is positional.
import type { z } from "zod";

import { conflict, notFound } from "@/lib/api/errors";
import { renderLabelSheet, type LabelContent } from "@/lib/pdf/label-sheet";
import type { exportLabels, markLabels } from "@/lib/validation/labels";
import type {
  BundleLabelRow,
  CaptainRow,
  CaptainTerritoryRow,
  IssueRow,
  RouteDeliveryRow,
  VolunteerRouteRow,
  VolunteerRow,
} from "@/types/db";

import { getAddressDetails } from "./addresses";
import { routeLabel } from "./derive";
import { db, throwDb } from "./shared";

export interface LabelBundle {
  deliveryId: string;
  bundleIndex: number;
  papers: number;
  labelled: boolean;
}

export interface LabelRoute {
  deliveryId: string;
  routeId: string;
  /** e.g. "Queen St E · 2038 → 2190", via the shared routeLabel helper. */
  routeName: string;
  volunteerName: string | null;
  address: string | null;
  papers: number;
  bundles: LabelBundle[];
  bundleCount: number;
  labelledCount: number;
  /**
   * Confirmed by design (Kristen, Slack, 2026-08-23): Carrier = a normal
   * volunteer route; Commercial = a bulk drop at a business; Residential =
   * a bulk drop at an apartment/condo. Always "carrier" today — this service
   * only reads `route_deliveries`, which only ever comes from
   * `volunteer_routes`. Widen this union once commercial/residential drops
   * get a per-issue delivery record of their own (label_printing_flow.md §7).
   */
  type: "carrier";
}

export interface LabelGroup {
  captainId: string | null;
  captainName: string;
  /**
   * The captain's RT number, printed as the label's chip. Null when the office
   * has not assigned one, or when the route has no captain at all.
   */
  rtNumber: string | null;
  routes: LabelRoute[];
  bundleCount: number;
  labelledCount: number;
}

/** An issue the label screen can be pointed at. */
export interface LabelIssueOption {
  id: string;
  name: string;
  date: string;
  status: string;
}

export interface LabelSheet {
  issue: { id: string; name: string; date: string; status: string };
  /**
   * Issues this screen can show, newest first — the open one plus recent closed
   * ones, so a past run can be reprinted. Returned with the sheet rather than
   * from a second endpoint: the picker is useless without the sheet anyway.
   */
  issues: LabelIssueOption[];
  groups: LabelGroup[];
  bundleCount: number;
  labelledCount: number;
}

/** How many past issues the picker offers alongside the open one. */
const REPRINTABLE_ISSUES = 12;

/**
 * Issues the label screen offers, newest first.
 *
 * Capped rather than unbounded: reprints are for "we jammed the printer on the
 * last run", not for trawling years of history.
 */
export async function listLabelIssues(): Promise<IssueRow[]> {
  const { data, error } = await db()
    .from("issues")
    .select("*")
    .order("date", { ascending: false })
    .limit(REPRINTABLE_ISSUES);
  if (error) throwDb(error);
  return (data ?? []) as IssueRow[];
}

/**
 * The issue labels belong to.
 *
 * Defaults to the most recent OPEN one, because the flow is inherently "this
 * run" — you label the bundles you are about to send out. An explicit id lets
 * the office reprint a past issue after a printer jam or a torn sheet, which
 * they asked for on 2026-08-24. Reprinting is read-only in spirit: nothing about
 * a closed issue changes except the `labelled` flags the caller opts into.
 */
export async function resolveLabelIssue(issueId?: string): Promise<IssueRow> {
  const client = db();
  if (issueId) {
    const { data, error } = await client.from("issues").select("*").eq("id", issueId).maybeSingle();
    if (error) throwDb(error);
    if (!data) throw notFound("Issue");
    return data as IssueRow;
  }
  const { data, error } = await client
    .from("issues")
    .select("*")
    .eq("status", "open")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwDb(error);
  if (data) return data as IssueRow;

  // No open issue. Fall back to the most recent closed one rather than failing,
  // so the screen still loads and the issue picker is reachable — otherwise
  // reprinting would be impossible in exactly the situation that most often
  // calls for it, the stretch after the last run of the year was closed.
  const [latest] = await listLabelIssues();
  if (!latest) throw conflict("No issues yet — create one before printing labels.");
  return latest;
}

/**
 * Every bundle in an issue, grouped by the captain who drops it.
 *
 * Grouping is by captain because that is the physical workflow: labels come off
 * the printer and get sorted into one pile per captain.
 *
 * Defaults to the open issue; pass `issueId` to reprint a past one.
 */
export async function listLabels(issueId?: string): Promise<LabelSheet> {
  const client = db();
  const [issue, issues] = await Promise.all([resolveLabelIssue(issueId), listLabelIssues()]);

  const { data: deliveryData, error: deliveryError } = await client
    .from("route_deliveries")
    .select("*")
    .eq("issue_id", issue.id);
  if (deliveryError) throwDb(deliveryError);
  const deliveries = (deliveryData ?? []) as RouteDeliveryRow[];

  const summary = {
    issue: { id: issue.id, name: issue.name, date: issue.date, status: issue.status },
    issues: issues.map((i) => ({ id: i.id, name: i.name, date: i.date, status: i.status })),
    groups: [] as LabelGroup[],
    bundleCount: 0,
    labelledCount: 0,
  };
  if (deliveries.length === 0) return summary;

  const [routesRes, volunteersRes, territoriesRes, captainsRes, labelsRes] = await Promise.all([
    client
      .from("volunteer_routes")
      .select("id, street_name, assigned_volunteer_id, start_address_id, end_address_id")
      .in(
        "id",
        deliveries.map((d) => d.route_id),
      ),
    client.from("volunteers").select("id, display_name, address_id, captain_territory_id"),
    client.from("captain_territories").select("id, assigned_captain_id"),
    client.from("captains").select("id, display_name, rt_number"),
    client
      .from("bundle_labels")
      .select("delivery_id, bundle_index")
      .in(
        "delivery_id",
        deliveries.map((d) => d.id),
      ),
  ]);
  if (routesRes.error) throwDb(routesRes.error);
  if (volunteersRes.error) throwDb(volunteersRes.error);
  if (territoriesRes.error) throwDb(territoriesRes.error);
  if (captainsRes.error) throwDb(captainsRes.error);
  if (labelsRes.error) throwDb(labelsRes.error);

  const routes = (routesRes.data ?? []) as Pick<
    VolunteerRouteRow,
    "id" | "street_name" | "assigned_volunteer_id" | "start_address_id" | "end_address_id"
  >[];
  const volunteers = (volunteersRes.data ?? []) as Pick<
    VolunteerRow,
    "id" | "display_name" | "address_id" | "captain_territory_id"
  >[];
  const territories = (territoriesRes.data ?? []) as Pick<
    CaptainTerritoryRow,
    "id" | "assigned_captain_id"
  >[];
  const captains = (captainsRes.data ?? []) as Pick<
    CaptainRow,
    "id" | "display_name" | "rt_number"
  >[];

  const routeById = new Map(routes.map((r) => [r.id, r]));
  const volunteerById = new Map(volunteers.map((v) => [v.id, v]));
  const territoryById = new Map(territories.map((t) => [t.id, t]));
  const captainById = new Map(captains.map((c) => [c.id, c]));

  const labelled = new Set(
    ((labelsRes.data ?? []) as Pick<BundleLabelRow, "delivery_id" | "bundle_index">[]).map(
      (l) => `${l.delivery_id}:${l.bundle_index}`,
    ),
  );

  const addresses = await getAddressDetails([
    ...volunteers.map((v) => v.address_id),
    ...routes.flatMap((r) => [r.start_address_id, r.end_address_id]),
  ]);

  // Bucket by captain. A route whose volunteer has no territory (or whose
  // territory has no captain) still needs labelling, so it lands in a single
  // "Unassigned" group rather than being dropped.
  const groups = new Map<string, LabelGroup>();

  for (const delivery of deliveries) {
    const route = routeById.get(delivery.route_id);
    if (!route) continue; // deleted route with a delivery still attached

    const volunteer = route.assigned_volunteer_id
      ? (volunteerById.get(route.assigned_volunteer_id) ?? null)
      : null;
    const territory = volunteer?.captain_territory_id
      ? (territoryById.get(volunteer.captain_territory_id) ?? null)
      : null;
    const captain = territory?.assigned_captain_id
      ? (captainById.get(territory.assigned_captain_id) ?? null)
      : null;

    const bundles: LabelBundle[] = delivery.bundles.map((b, i) => ({
      deliveryId: delivery.id,
      bundleIndex: i,
      papers: b.papers,
      labelled: labelled.has(`${delivery.id}:${i}`),
    }));

    const labelledHere = bundles.filter((b) => b.labelled).length;
    const entry: LabelRoute = {
      deliveryId: delivery.id,
      routeId: route.id,
      routeName: routeLabel(
        route.street_name,
        addresses.get(route.start_address_id)?.formattedAddress ?? null,
        addresses.get(route.end_address_id)?.formattedAddress ?? null,
      ),
      volunteerName: volunteer ? volunteer.display_name : null,
      address: volunteer ? (addresses.get(volunteer.address_id)?.formattedAddress ?? null) : null,
      papers: delivery.paper_count,
      bundles,
      bundleCount: bundles.length,
      labelledCount: labelledHere,
      type: "carrier",
    };

    const key = captain?.id ?? "unassigned";
    const group = groups.get(key) ?? {
      captainId: captain?.id ?? null,
      captainName: captain ? captain.display_name : "Unassigned",
      rtNumber: captain?.rt_number ?? null,
      routes: [],
      bundleCount: 0,
      labelledCount: 0,
    };
    group.routes.push(entry);
    group.bundleCount += bundles.length;
    group.labelledCount += labelledHere;
    groups.set(key, group);

    summary.bundleCount += bundles.length;
    summary.labelledCount += labelledHere;
  }

  // Captains alphabetically; Unassigned last so it reads as the exception.
  summary.groups = [...groups.values()]
    .map((g) => ({
      ...g,
      routes: g.routes.sort((a, b) => a.routeName.localeCompare(b.routeName)),
    }))
    .sort((a, b) => {
      if (a.captainId === null) return 1;
      if (b.captainId === null) return -1;
      return a.captainName.localeCompare(b.captainName);
    });

  return summary;
}

/**
 * Set or clear the labelled flag on a set of bundles.
 *
 * Labelling upserts (ignoring conflicts) so re-marking an already-labelled bundle
 * is a no-op rather than a 409 — the office ticks boxes off in whatever order.
 */
export async function setLabelled(
  input: z.infer<typeof markLabels>,
): Promise<{ labelled: number }> {
  const client = db();
  await assertBundlesExist(input.bundles);

  if (input.labelled) {
    const { error } = await client.from("bundle_labels").upsert(
      input.bundles.map((b) => ({ delivery_id: b.deliveryId, bundle_index: b.bundleIndex })),
      { onConflict: "delivery_id,bundle_index", ignoreDuplicates: true },
    );
    if (error) throwDb(error);
  } else {
    // No composite `in` in PostgREST, so delete per delivery: one call per
    // delivery, with all of that delivery's indices in a single `in` filter.
    const byDelivery = new Map<string, number[]>();
    for (const b of input.bundles) {
      byDelivery.set(b.deliveryId, [...(byDelivery.get(b.deliveryId) ?? []), b.bundleIndex]);
    }
    for (const [deliveryId, indices] of byDelivery) {
      const { error } = await client
        .from("bundle_labels")
        .delete()
        .eq("delivery_id", deliveryId)
        .in("bundle_index", indices);
      if (error) throwDb(error);
    }
  }

  return { labelled: input.bundles.length };
}

/**
 * Validate that every referenced bundle actually exists in its delivery.
 *
 * Worth the extra read: bundle_index has no foreign key into the JSONB array, so
 * without this an out-of-range index would happily persist and then silently
 * print nothing.
 */
async function assertBundlesExist(
  refs: ReadonlyArray<{ deliveryId: string; bundleIndex: number }>,
  /** When given, every bundle must belong to this issue. */
  issueId?: string,
): Promise<Map<string, RouteDeliveryRow>> {
  const ids = [...new Set(refs.map((r) => r.deliveryId))];
  const { data, error } = await db().from("route_deliveries").select("*").in("id", ids);
  if (error) throwDb(error);
  const byId = new Map(((data ?? []) as RouteDeliveryRow[]).map((d) => [d.id, d]));

  for (const ref of refs) {
    const delivery = byId.get(ref.deliveryId);
    if (!delivery) throw notFound("Delivery");
    if (issueId !== undefined && delivery.issue_id !== issueId) {
      throw conflict("Those bundles belong to a different issue.");
    }
    if (ref.bundleIndex >= delivery.bundles.length) {
      throw conflict(
        `Bundle ${ref.bundleIndex + 1} no longer exists on this route — the bundle split changed.`,
      );
    }
  }
  return byId;
}

/**
 * Render the chosen bundles to a printable PDF and (by default) mark them
 * labelled, because printing a label IS labelling it.
 *
 * Marking happens AFTER the bytes render, so a failed render leaves the flags
 * untouched and the office can just hit export again.
 */
export async function exportLabelSheet(
  input: z.infer<typeof exportLabels>,
): Promise<{ filename: string; bytes: Uint8Array; labelCount: number }> {
  // listLabels resolves the issue itself, so take it from there rather than
  // resolving twice and risking two different answers.
  const sheet = await listLabels(input.issueId);
  const deliveries = await assertBundlesExist(input.bundles, sheet.issue.id);

  // Flatten the grouped view into a lookup so each ref picks up its route's
  // volunteer name and address without re-querying.
  const routeByDelivery = new Map(
    sheet.groups.flatMap((g) => g.routes.map((r) => [r.deliveryId, r] as const)),
  );
  // The RT belongs to the captain, and groups are keyed by captain, so the chip
  // is looked up per group rather than per route.
  const rtByDelivery = new Map(
    sheet.groups.flatMap((g) => g.routes.map((r) => [r.deliveryId, g.rtNumber] as const)),
  );

  const labels: LabelContent[] = input.bundles.map((ref) => {
    const route = routeByDelivery.get(ref.deliveryId);
    const delivery = deliveries.get(ref.deliveryId);
    const total = delivery?.bundles.length ?? 1;
    return {
      // "XX" when the captain has no RT yet, or the route has no captain. Keeps
      // the physical layout intact and makes the gap obvious on paper rather
      // than inventing a number that would look authoritative.
      routeCode: rtByDelivery.get(ref.deliveryId) ?? "XX",
      papers: delivery?.bundles[ref.bundleIndex]?.papers ?? 0,
      name: route?.volunteerName ?? "Vacant route",
      address: route?.address ?? "",
      bundleLine: total > 1 ? `Bundle ${ref.bundleIndex + 1} of ${total}` : "",
    };
  });

  const bytes = await renderLabelSheet(labels);

  // Only a live run records what was labelled. Reprinting a shipped issue is
  // read-only: its bundles are history, and some were deliberately never
  // labelled (whole 50s and 25s go out unlabelled — see
  // docs/reference/route_labels_spreadsheet.md §3). Marking them here would
  // rewrite that record with no way back. Enforced server-side rather than by
  // the caller passing markLabelled: false, so no client can get it wrong.
  if (input.markLabelled && sheet.issue.status === "open") {
    await setLabelled({ bundles: input.bundles, labelled: true });
  }

  const slug = sheet.issue.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    filename: `labels-${slug || sheet.issue.date}.pdf`,
    bytes,
    labelCount: labels.length,
  };
}
