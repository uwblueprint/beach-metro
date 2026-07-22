// Territories: created implicitly with their captain; this service manages the
// two memberships (volunteers, commercial drops) and the map colour.
import type { z } from "zod";

import { conflict, notFound } from "@/lib/api/errors";
import type { addCommercialDrop, territoriesQuery, updateTerritory } from "@/lib/validation/people";
import type { AddressRow, CaptainRow, CaptainTerritoryRow, VolunteerRow } from "@/types/db";

import { createAddress, getAddressDetails, type AddressDetail } from "./addresses";
import { volunteerStatus, type VolunteerStatus } from "./derive";
import { db, throwDb, today } from "./shared";

export interface TerritorySummary {
  id: string;
  color: string | null;
  captain: { id: string; name: string; retired: boolean } | null;
  volunteerCount: number;
  commercialDropCount: number;
}

export interface TerritoryDetail extends Omit<
  TerritorySummary,
  "volunteerCount" | "commercialDropCount"
> {
  volunteers: Array<{ id: string; firstName: string; lastName: string; status: VolunteerStatus }>;
  commercialDrops: AddressDetail[];
}

export async function listTerritories(
  filters: z.infer<typeof territoriesQuery>,
): Promise<TerritorySummary[]> {
  const client = db();
  const [tRes, cRes, vRes, aRes] = await Promise.all([
    client.from("captain_territories").select("*"),
    client.from("captains").select("id, first_name, last_name, retired_at"),
    client.from("volunteers").select("id, captain_territory_id"),
    client.from("addresses").select("id, territory_id").eq("type", "commercial"),
  ]);
  if (tRes.error) throwDb(tRes.error);
  if (cRes.error) throwDb(cRes.error);
  if (vRes.error) throwDb(vRes.error);
  if (aRes.error) throwDb(aRes.error);

  const captains = (cRes.data ?? []) as Pick<
    CaptainRow,
    "id" | "first_name" | "last_name" | "retired_at"
  >[];
  const volunteers = (vRes.data ?? []) as Pick<VolunteerRow, "id" | "captain_territory_id">[];
  const drops = (aRes.data ?? []) as Pick<AddressRow, "id" | "territory_id">[];

  let all = ((tRes.data ?? []) as CaptainTerritoryRow[]).map((t): TerritorySummary => {
    const captain = t.assigned_captain_id
      ? (captains.find((c) => c.id === t.assigned_captain_id) ?? null)
      : null;
    return {
      id: t.id,
      color: t.color,
      captain: captain
        ? {
            id: captain.id,
            name: `${captain.first_name} ${captain.last_name}`,
            retired: captain.retired_at !== null,
          }
        : null,
      volunteerCount: volunteers.filter((v) => v.captain_territory_id === t.id).length,
      commercialDropCount: drops.filter((d) => d.territory_id === t.id).length,
    };
  });

  if (filters.hasCaptain !== undefined) {
    all = all.filter((t) => (t.captain !== null) === filters.hasCaptain);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    all = all.filter((t) => t.captain?.name.toLowerCase().includes(q));
  }
  return all;
}

async function fetchTerritory(id: string): Promise<CaptainTerritoryRow> {
  const { data, error } = await db()
    .from("captain_territories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Territory");
  return data as CaptainTerritoryRow;
}

export async function getTerritory(id: string): Promise<TerritoryDetail> {
  const t = await fetchTerritory(id);
  const client = db();

  const [cRes, vRes, aRes] = await Promise.all([
    t.assigned_captain_id
      ? client
          .from("captains")
          .select("id, first_name, last_name, retired_at")
          .eq("id", t.assigned_captain_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client.from("volunteers").select("*").eq("captain_territory_id", id),
    client.from("addresses").select("id").eq("territory_id", id).eq("type", "commercial"),
  ]);
  if (cRes.error) throwDb(cRes.error);
  if (vRes.error) throwDb(vRes.error);
  if (aRes.error) throwDb(aRes.error);

  const captain = cRes.data as Pick<
    CaptainRow,
    "id" | "first_name" | "last_name" | "retired_at"
  > | null;
  const date = today();
  const dropIds = ((aRes.data ?? []) as Pick<AddressRow, "id">[]).map((a) => a.id);
  const dropDetails = await getAddressDetails(dropIds);

  return {
    id: t.id,
    color: t.color,
    captain: captain
      ? {
          id: captain.id,
          name: `${captain.first_name} ${captain.last_name}`,
          retired: captain.retired_at !== null,
        }
      : null,
    volunteers: ((vRes.data ?? []) as VolunteerRow[]).map((v) => ({
      id: v.id,
      firstName: v.first_name,
      lastName: v.last_name,
      status: volunteerStatus(v, date),
    })),
    commercialDrops: dropIds
      .map((id) => dropDetails.get(id))
      .filter((d): d is AddressDetail => !!d),
  };
}

export async function updateTerritoryRecord(
  id: string,
  input: z.infer<typeof updateTerritory>,
): Promise<TerritoryDetail> {
  await fetchTerritory(id);

  const patch: Record<string, unknown> = {};
  if (input.color !== undefined) patch.color = input.color;
  if (input.assignedCaptainId !== undefined) {
    if (input.assignedCaptainId !== null) {
      const { data, error } = await db()
        .from("captains")
        .select("id, retired_at")
        .eq("id", input.assignedCaptainId)
        .maybeSingle();
      if (error) throwDb(error);
      if (!data) throw notFound("Captain");
      if ((data as CaptainRow).retired_at) {
        throw conflict("Cannot assign a retired captain to a territory.");
      }
    }
    patch.assigned_captain_id = input.assignedCaptainId;
  }

  const { error } = await db().from("captain_territories").update(patch).eq("id", id);
  if (error) throwDb(error); // unique violation (captain already owns a territory) → 409
  return getTerritory(id);
}

export async function assignVolunteerToTerritory(
  territoryId: string,
  volunteerId: string,
): Promise<TerritoryDetail> {
  await fetchTerritory(territoryId);
  const { data, error } = await db()
    .from("volunteers")
    .select("id, retired_at")
    .eq("id", volunteerId)
    .maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Volunteer");
  if ((data as VolunteerRow).retired_at) {
    throw conflict("Cannot assign a retired volunteer to a territory.");
  }

  const { error: updateError } = await db()
    .from("volunteers")
    .update({ captain_territory_id: territoryId })
    .eq("id", volunteerId);
  if (updateError) throwDb(updateError);
  return getTerritory(territoryId);
}

export async function unassignVolunteerFromTerritory(
  territoryId: string,
  volunteerId: string,
): Promise<TerritoryDetail> {
  await fetchTerritory(territoryId);
  const { data, error } = await db()
    .from("volunteers")
    .select("id, captain_territory_id")
    .eq("id", volunteerId)
    .maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Volunteer");
  if ((data as VolunteerRow).captain_territory_id !== territoryId) {
    throw conflict("Volunteer is not in this territory.");
  }

  const { error: updateError } = await db()
    .from("volunteers")
    .update({ captain_territory_id: null })
    .eq("id", volunteerId);
  if (updateError) throwDb(updateError);
  return getTerritory(territoryId);
}

export async function addCommercialDropToTerritory(
  territoryId: string,
  input: z.infer<typeof addCommercialDrop>,
): Promise<TerritoryDetail> {
  await fetchTerritory(territoryId);
  await createAddress(input.address, "commercial", territoryId);
  return getTerritory(territoryId);
}

export async function removeCommercialDropFromTerritory(
  territoryId: string,
  addressId: string,
): Promise<TerritoryDetail> {
  await fetchTerritory(territoryId);
  const { data, error } = await db()
    .from("addresses")
    .select("id, type, territory_id")
    .eq("id", addressId)
    .maybeSingle();
  if (error) throwDb(error);
  const address = data as AddressRow | null;
  if (!address || address.type !== "commercial" || address.territory_id !== territoryId) {
    throw notFound("Commercial drop");
  }

  const { error: deleteError } = await db().from("addresses").delete().eq("id", addressId);
  if (deleteError) throwDb(deleteError);
  return getTerritory(territoryId);
}
