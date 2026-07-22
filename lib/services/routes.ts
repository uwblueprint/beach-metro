// Routes: CRUD (soft delete), assignment actions, and nearest-vacant ranking.
// Lifecycle (assigned/vacant), suspended, and needs-attention are all derived —
// never stored (route flow §3a).
import type { z } from "zod";

import { conflict, notFound } from "@/lib/api/errors";
import { getMapsProvider } from "@/lib/maps";
import type {
  createRoute,
  nearestVacantQuery,
  routesQuery,
  updateRoute,
} from "@/lib/validation/routes";
import type {
  CaptainRow,
  CaptainTerritoryRow,
  RouteSide,
  VolunteerRouteRow,
  VolunteerRow,
} from "@/types/db";

import {
  createAddress,
  getAddressDetail,
  getAddressDetails,
  type AddressDetail,
} from "./addresses";
import { volunteerStatus } from "./derive";
import { db, throwDb, today } from "./shared";

export interface RouteSummary {
  id: string;
  streetName: string;
  side: RouteSide | null;
  lifecycle: "assigned" | "vacant";
  suspended: boolean; // derived: assigned volunteer is on vacation
  needsAttention: boolean; // derived: assigned volunteer retired or past end date
  houseCount: number;
  houseCountOverride: number | null;
  effectiveHouseCount: number;
  papers: number;
  notes: string | null;
  assignedVolunteer: { id: string; firstName: string; lastName: string; status: string } | null;
  captain: { id: string; name: string } | null;
  /** Cached start/end coordinates so the map can draw every polyline from one
   * list call (null when the 30-day coordinate cache is empty). */
  start: { latitude: number; longitude: number } | null;
  end: { latitude: number; longitude: number } | null;
}

export interface RouteDetail extends RouteSummary {
  startAddress: AddressDetail;
  endAddress: AddressDetail;
}

interface Context {
  volunteers: VolunteerRow[];
  territories: CaptainTerritoryRow[];
  captains: Pick<CaptainRow, "id" | "first_name" | "last_name">[];
}

async function fetchContext(): Promise<Context> {
  const client = db();
  const [vRes, tRes, cRes] = await Promise.all([
    client.from("volunteers").select("*"),
    client.from("captain_territories").select("*"),
    client.from("captains").select("id, first_name, last_name"),
  ]);
  if (vRes.error) throwDb(vRes.error);
  if (tRes.error) throwDb(tRes.error);
  if (cRes.error) throwDb(cRes.error);
  return {
    volunteers: (vRes.data ?? []) as VolunteerRow[],
    territories: (tRes.data ?? []) as CaptainTerritoryRow[],
    captains: (cRes.data ?? []) as Pick<CaptainRow, "id" | "first_name" | "last_name">[],
  };
}

function coord(detail: AddressDetail | undefined): { latitude: number; longitude: number } | null {
  return detail && detail.latitude !== null && detail.longitude !== null
    ? { latitude: detail.latitude, longitude: detail.longitude }
    : null;
}

function toSummary(
  r: VolunteerRouteRow,
  ctx: Context,
  date: string,
  addresses?: Map<string, AddressDetail>,
): RouteSummary {
  const volunteer = r.assigned_volunteer_id
    ? (ctx.volunteers.find((v) => v.id === r.assigned_volunteer_id) ?? null)
    : null;
  const status = volunteer ? volunteerStatus(volunteer, date) : null;
  const territory = volunteer?.captain_territory_id
    ? (ctx.territories.find((t) => t.id === volunteer.captain_territory_id) ?? null)
    : null;
  const captain = territory?.assigned_captain_id
    ? (ctx.captains.find((c) => c.id === territory.assigned_captain_id) ?? null)
    : null;

  return {
    id: r.id,
    streetName: r.street_name,
    side: r.side,
    lifecycle: r.assigned_volunteer_id ? "assigned" : "vacant",
    suspended: status === "on-vacation",
    needsAttention:
      volunteer !== null &&
      (status === "retired" ||
        (volunteer.end_date !== null && volunteer.end_date < date && !volunteer.retired_at)),
    houseCount: r.house_count,
    houseCountOverride: r.house_count_override,
    effectiveHouseCount: r.house_count_override ?? r.house_count,
    papers: r.papers,
    notes: r.notes,
    assignedVolunteer: volunteer
      ? {
          id: volunteer.id,
          firstName: volunteer.first_name,
          lastName: volunteer.last_name,
          status: status ?? "active",
        }
      : null,
    captain: captain
      ? { id: captain.id, name: `${captain.first_name} ${captain.last_name}` }
      : null,
    start: coord(addresses?.get(r.start_address_id)),
    end: coord(addresses?.get(r.end_address_id)),
  };
}

export async function listRoutes(filters: z.infer<typeof routesQuery>): Promise<RouteSummary[]> {
  const { data, error } = await db()
    .from("volunteer_routes")
    .select("*")
    .is("deleted_at", null)
    .order("street_name");
  if (error) throwDb(error);
  const ctx = await fetchContext();
  const date = today();

  const rows = (data ?? []) as VolunteerRouteRow[];
  const addresses = await getAddressDetails([
    ...new Set(rows.flatMap((r) => [r.start_address_id, r.end_address_id])),
  ]);

  let all = rows.map((r) => toSummary(r, ctx, date, addresses));
  if (filters.vacancy) all = all.filter((r) => r.lifecycle === filters.vacancy);
  if (filters.side) all = all.filter((r) => r.side === filters.side);
  if (filters.needsAttention !== undefined) {
    all = all.filter((r) => r.needsAttention === filters.needsAttention);
  }
  if (filters.territoryId) {
    // Territory is reached via the assigned volunteer (route → volunteer → territory).
    const volunteerIds = new Set(
      ctx.volunteers.filter((v) => v.captain_territory_id === filters.territoryId).map((v) => v.id),
    );
    all = all.filter((r) => r.assignedVolunteer && volunteerIds.has(r.assignedVolunteer.id));
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    all = all.filter((r) => r.streetName.toLowerCase().includes(q));
  }
  return all;
}

async function fetchRoute(id: string): Promise<VolunteerRouteRow> {
  const { data, error } = await db()
    .from("volunteer_routes")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Route");
  return data as VolunteerRouteRow;
}

export async function getRoute(id: string): Promise<RouteDetail> {
  const r = await fetchRoute(id);
  const ctx = await fetchContext();
  const addresses = await getAddressDetails([r.start_address_id, r.end_address_id]);
  return {
    ...toSummary(r, ctx, today(), addresses),
    startAddress: await getAddressDetail(r.start_address_id),
    endAddress: await getAddressDetail(r.end_address_id),
  };
}

async function assertAssignableVolunteer(volunteerId: string): Promise<void> {
  const { data, error } = await db()
    .from("volunteers")
    .select("id, retired_at")
    .eq("id", volunteerId)
    .maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Volunteer");
  if ((data as VolunteerRow).retired_at) {
    throw conflict("Cannot assign a retired volunteer to a route.");
  }
}

export async function createRouteRecord(input: z.infer<typeof createRoute>): Promise<RouteDetail> {
  if (input.assignedVolunteerId) await assertAssignableVolunteer(input.assignedVolunteerId);
  // Route endpoints are stored as residential addresses (they're intersections /
  // street points, not commercial drops) — recorded as an interpretation.
  const [start, end] = await Promise.all([
    createAddress(input.startAddress, "residential"),
    createAddress(input.endAddress, "residential"),
  ]);

  const { data, error } = await db()
    .from("volunteer_routes")
    .insert({
      start_address_id: start.address.id,
      end_address_id: end.address.id,
      street_name: input.streetName,
      side: input.side ?? null,
      assigned_volunteer_id: input.assignedVolunteerId ?? null,
      house_count: input.houseCount,
      papers: input.papers,
      notes: input.note ?? null,
    })
    .select()
    .single();
  if (error) throwDb(error);
  return getRoute((data as VolunteerRouteRow).id);
}

export async function updateRouteRecord(
  id: string,
  input: z.infer<typeof updateRoute>,
): Promise<RouteDetail> {
  await fetchRoute(id);

  const patch: Record<string, unknown> = {};
  if (input.streetName !== undefined) patch.street_name = input.streetName;
  if (input.side !== undefined) patch.side = input.side;
  if (input.houseCount !== undefined) patch.house_count = input.houseCount;
  if (input.houseCountOverride !== undefined) patch.house_count_override = input.houseCountOverride;
  if (input.papers !== undefined) patch.papers = input.papers;
  if (input.note !== undefined) patch.notes = input.note;
  if (input.startAddress !== undefined) {
    patch.start_address_id = (await createAddress(input.startAddress, "residential")).address.id;
  }
  if (input.endAddress !== undefined) {
    patch.end_address_id = (await createAddress(input.endAddress, "residential")).address.id;
  }

  const { error } = await db().from("volunteer_routes").update(patch).eq("id", id);
  if (error) throwDb(error);
  return getRoute(id);
}

/** Soft delete: hidden from all views; the row stays so past deliveries resolve. */
export async function softDeleteRoute(id: string): Promise<void> {
  await fetchRoute(id); // 404s if missing or already deleted
  const { error } = await db()
    .from("volunteer_routes")
    .update({ deleted_at: new Date().toISOString(), assigned_volunteer_id: null })
    .eq("id", id);
  if (error) throwDb(error);
}

export async function assignRouteVolunteer(id: string, volunteerId: string): Promise<RouteDetail> {
  const r = await fetchRoute(id);
  if (r.assigned_volunteer_id) {
    throw conflict("Route already has a volunteer — use reassign.");
  }
  await assertAssignableVolunteer(volunteerId);
  const { error } = await db()
    .from("volunteer_routes")
    .update({ assigned_volunteer_id: volunteerId })
    .eq("id", id);
  if (error) throwDb(error);
  return getRoute(id);
}

export async function unassignRouteVolunteer(id: string): Promise<RouteDetail> {
  const r = await fetchRoute(id);
  if (!r.assigned_volunteer_id) throw conflict("Route is already vacant.");
  const { error } = await db()
    .from("volunteer_routes")
    .update({ assigned_volunteer_id: null })
    .eq("id", id);
  if (error) throwDb(error);
  return getRoute(id);
}

export async function reassignRouteVolunteer(
  id: string,
  volunteerId: string,
): Promise<RouteDetail> {
  const r = await fetchRoute(id);
  if (!r.assigned_volunteer_id) throw conflict("Route is vacant — use assign.");
  if (r.assigned_volunteer_id === volunteerId) {
    throw conflict("Route is already assigned to this volunteer.");
  }
  await assertAssignableVolunteer(volunteerId);
  const { error } = await db()
    .from("volunteer_routes")
    .update({ assigned_volunteer_id: volunteerId })
    .eq("id", id);
  if (error) throwDb(error);
  return getRoute(id);
}

export interface NearestVacantEntry {
  route: RouteSummary;
  distanceMeters: number;
  durationSeconds: number;
}

/** Rank vacant routes by travel time from a volunteer's home (or a placeId). */
export async function nearestVacantRoutes(
  query: z.infer<typeof nearestVacantQuery>,
): Promise<NearestVacantEntry[]> {
  const provider = getMapsProvider();

  // Origin coordinates.
  let origin: { latitude: number; longitude: number };
  if (query.volunteerId) {
    const { data, error } = await db()
      .from("volunteers")
      .select("address_id")
      .eq("id", query.volunteerId)
      .maybeSingle();
    if (error) throwDb(error);
    if (!data) throw notFound("Volunteer");
    const home = await getAddressDetail((data as VolunteerRow).address_id);
    if (home.latitude !== null && home.longitude !== null) {
      origin = { latitude: home.latitude, longitude: home.longitude };
    } else {
      const refreshed = await provider.geocodePlaceId(home.placeId);
      origin = { latitude: refreshed.latitude, longitude: refreshed.longitude };
    }
  } else {
    const resolved = await provider.geocodePlaceId(query.placeId!);
    origin = { latitude: resolved.latitude, longitude: resolved.longitude };
  }

  // Vacant routes — list summaries already carry start coordinates.
  const vacant = (await listRoutes({ vacancy: "vacant" })).slice(0, 100);
  const destinations: Array<{ route: RouteSummary; latitude: number; longitude: number }> = [];
  for (const route of vacant) {
    if (route.start) {
      destinations.push({
        route,
        latitude: route.start.latitude,
        longitude: route.start.longitude,
      });
    }
  }
  if (destinations.length === 0) return [];

  const matrix = await provider.routeMatrix(
    origin,
    destinations.map((d) => ({ latitude: d.latitude, longitude: d.longitude })),
  );

  return matrix
    .map((entry) => ({
      route: destinations[entry.destinationIndex].route,
      distanceMeters: entry.distanceMeters,
      durationSeconds: entry.durationSeconds,
    }))
    .sort((a, b) => a.durationSeconds - b.durationSeconds)
    .slice(0, query.limit);
}
