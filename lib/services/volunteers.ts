// Volunteers: CRUD + vacation/retire actions (people flow §4a–4f).
import type { z } from "zod";

import { conflict, notFound } from "@/lib/api/errors";
import type {
  createVolunteer,
  setVacation,
  updateVolunteer,
  volunteersQuery,
} from "@/lib/validation/people";
import type { CaptainRow, CaptainTerritoryRow, VolunteerRow } from "@/types/db";

import {
  createAddress,
  getAddressDetail,
  getAddressDetails,
  type AddressDetail,
} from "./addresses";
import { volunteerNeedsAttention, volunteerStatus, type VolunteerStatus } from "./derive";
import { db, throwDb, today } from "./shared";

type RouteLite = { id: string; street_name: string; assigned_volunteer_id: string | null };

export interface VolunteerSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: VolunteerStatus;
  needsAttention: boolean;
  territory: { id: string; captainId: string | null; captainName: string | null } | null;
  routesCarried: Array<{ id: string; streetName: string }>;
  /** Cached home coordinates for the map (null when the coordinate cache is empty). */
  home: { latitude: number; longitude: number } | null;
  startDate: string;
  endDate: string | null;
  vacationStart: string | null;
  vacationEnd: string | null;
  retiredAt: string | null;
  notes: string | null;
}

export interface VolunteerDetail extends VolunteerSummary {
  address: AddressDetail;
}

interface Context {
  routes: RouteLite[];
  territories: CaptainTerritoryRow[];
  captains: Pick<CaptainRow, "id" | "first_name" | "last_name">[];
}

async function fetchContext(): Promise<Context> {
  const client = db();
  const [routesRes, territoriesRes, captainsRes] = await Promise.all([
    client
      .from("volunteer_routes")
      .select("id, street_name, assigned_volunteer_id")
      .is("deleted_at", null),
    client.from("captain_territories").select("*"),
    client.from("captains").select("id, first_name, last_name"),
  ]);
  if (routesRes.error) throwDb(routesRes.error);
  if (territoriesRes.error) throwDb(territoriesRes.error);
  if (captainsRes.error) throwDb(captainsRes.error);
  return {
    routes: (routesRes.data ?? []) as RouteLite[],
    territories: (territoriesRes.data ?? []) as CaptainTerritoryRow[],
    captains: (captainsRes.data ?? []) as Pick<CaptainRow, "id" | "first_name" | "last_name">[],
  };
}

function toSummary(
  v: VolunteerRow,
  ctx: Context,
  date: string,
  addresses?: Map<string, AddressDetail>,
): VolunteerSummary {
  const homeDetail = addresses?.get(v.address_id);
  const territory = v.captain_territory_id
    ? (ctx.territories.find((t) => t.id === v.captain_territory_id) ?? null)
    : null;
  const captain = territory?.assigned_captain_id
    ? (ctx.captains.find((c) => c.id === territory.assigned_captain_id) ?? null)
    : null;
  return {
    id: v.id,
    firstName: v.first_name,
    lastName: v.last_name,
    email: v.email,
    phone: v.phone,
    status: volunteerStatus(v, date),
    needsAttention: volunteerNeedsAttention(v, date),
    territory: territory
      ? {
          id: territory.id,
          captainId: captain?.id ?? null,
          captainName: captain ? `${captain.first_name} ${captain.last_name}` : null,
        }
      : null,
    routesCarried: ctx.routes
      .filter((r) => r.assigned_volunteer_id === v.id)
      .map((r) => ({ id: r.id, streetName: r.street_name })),
    home:
      homeDetail && homeDetail.latitude !== null && homeDetail.longitude !== null
        ? { latitude: homeDetail.latitude, longitude: homeDetail.longitude }
        : null,
    startDate: v.start_date,
    endDate: v.end_date,
    vacationStart: v.vacation_start,
    vacationEnd: v.vacation_end,
    retiredAt: v.retired_at,
    notes: v.notes,
  };
}

export async function listVolunteers(
  filters: z.infer<typeof volunteersQuery>,
): Promise<VolunteerSummary[]> {
  const { data, error } = await db().from("volunteers").select("*").order("last_name");
  if (error) throwDb(error);
  const ctx = await fetchContext();
  const date = today();

  const rows = (data ?? []) as VolunteerRow[];
  const addresses = await getAddressDetails(rows.map((v) => v.address_id));
  let all = rows.map((v) => toSummary(v, ctx, date, addresses));
  if (filters.status) all = all.filter((v) => v.status === filters.status);
  if (filters.territoryId) all = all.filter((v) => v.territory?.id === filters.territoryId);
  if (filters.hasRoute !== undefined) {
    all = all.filter((v) => v.routesCarried.length > 0 === filters.hasRoute);
  }
  if (filters.needsAttention !== undefined) {
    all = all.filter((v) => v.needsAttention === filters.needsAttention);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    all = all.filter((v) => `${v.firstName} ${v.lastName} ${v.email}`.toLowerCase().includes(q));
  }
  return all;
}

async function fetchVolunteer(id: string): Promise<VolunteerRow> {
  const { data, error } = await db().from("volunteers").select("*").eq("id", id).maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Volunteer");
  return data as VolunteerRow;
}

export async function getVolunteer(id: string): Promise<VolunteerDetail> {
  const v = await fetchVolunteer(id);
  const ctx = await fetchContext();
  return { ...toSummary(v, ctx, today()), address: await getAddressDetail(v.address_id) };
}

async function assertTerritoryExists(territoryId: string): Promise<void> {
  const { data, error } = await db()
    .from("captain_territories")
    .select("id")
    .eq("id", territoryId)
    .maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Territory");
}

export async function createVolunteerRecord(
  input: z.infer<typeof createVolunteer>,
): Promise<VolunteerDetail> {
  if (input.captainTerritoryId) await assertTerritoryExists(input.captainTerritoryId);
  const { address } = await createAddress(input.address, "residential");

  const { data, error } = await db()
    .from("volunteers")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      address_id: address.id,
      captain_territory_id: input.captainTerritoryId ?? null,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      notes: input.note ?? null,
    })
    .select()
    .single();
  if (error) throwDb(error);
  return getVolunteer((data as VolunteerRow).id);
}

export async function updateVolunteerRecord(
  id: string,
  input: z.infer<typeof updateVolunteer>,
): Promise<VolunteerDetail> {
  await fetchVolunteer(id);
  if (input.captainTerritoryId) await assertTerritoryExists(input.captainTerritoryId);

  const patch: Record<string, unknown> = {};
  if (input.firstName !== undefined) patch.first_name = input.firstName;
  if (input.lastName !== undefined) patch.last_name = input.lastName;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.captainTerritoryId !== undefined) patch.captain_territory_id = input.captainTerritoryId;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.note !== undefined) patch.notes = input.note;
  if (input.address !== undefined) {
    const { address } = await createAddress(input.address, "residential");
    patch.address_id = address.id;
  }

  const { error } = await db().from("volunteers").update(patch).eq("id", id);
  if (error) throwDb(error);
  return getVolunteer(id);
}

export async function setVolunteerVacation(
  id: string,
  input: z.infer<typeof setVacation>,
): Promise<VolunteerDetail> {
  await fetchVolunteer(id);
  const window =
    "clear" in input
      ? { vacation_start: null, vacation_end: null }
      : { vacation_start: input.vacationStart, vacation_end: input.vacationEnd };
  const { error } = await db().from("volunteers").update(window).eq("id", id);
  if (error) throwDb(error);
  return getVolunteer(id);
}

/** Soft retire; detaches carried routes, which become Vacant (people flow §4f). */
export async function retireVolunteer(id: string): Promise<VolunteerDetail> {
  const v = await fetchVolunteer(id);
  if (v.retired_at) throw conflict("Volunteer is already retired.");

  const client = db();
  const { error: retireError } = await client
    .from("volunteers")
    .update({ retired_at: today() })
    .eq("id", id);
  if (retireError) throwDb(retireError);

  const { error: detachError } = await client
    .from("volunteer_routes")
    .update({ assigned_volunteer_id: null })
    .eq("assigned_volunteer_id", id)
    .is("deleted_at", null);
  if (detachError) throwDb(detachError);

  return getVolunteer(id);
}
