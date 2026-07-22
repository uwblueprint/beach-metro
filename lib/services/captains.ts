// Captains: CRUD + retire (people flow §4g–4k). Creating a captain also creates
// their 1:1 empty territory; retiring leaves the territory captain-less.
import type { z } from "zod";

import { conflict, notFound } from "@/lib/api/errors";
import type { captainsQuery, createCaptain, updateCaptain } from "@/lib/validation/people";
import type { CaptainRow, CaptainTerritoryRow, PayCadence, PayType } from "@/types/db";

import { recalculateOpenIssues } from "./recalc";
import { db, throwDb, today } from "./shared";

export interface CaptainSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: "active" | "retired";
  payType: PayType;
  payRate: number;
  payCadence: PayCadence;
  startDate: string;
  endDate: string | null;
  retiredAt: string | null;
  notes: string | null;
  territory: { id: string; color: string | null } | null;
}

function toSummary(c: CaptainRow, territories: CaptainTerritoryRow[]): CaptainSummary {
  const territory = territories.find((t) => t.assigned_captain_id === c.id) ?? null;
  return {
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    email: c.email,
    phone: c.phone,
    status: c.retired_at ? "retired" : "active",
    payType: c.pay_type,
    payRate: c.pay_rate,
    payCadence: c.pay_cadence,
    startDate: c.start_date,
    endDate: c.end_date,
    retiredAt: c.retired_at,
    notes: c.notes,
    territory: territory ? { id: territory.id, color: territory.color } : null,
  };
}

async function fetchTerritories(): Promise<CaptainTerritoryRow[]> {
  const { data, error } = await db().from("captain_territories").select("*");
  if (error) throwDb(error);
  return (data ?? []) as CaptainTerritoryRow[];
}

export async function listCaptains(
  filters: z.infer<typeof captainsQuery>,
): Promise<CaptainSummary[]> {
  const { data, error } = await db().from("captains").select("*").order("last_name");
  if (error) throwDb(error);
  const territories = await fetchTerritories();

  let all = ((data ?? []) as CaptainRow[]).map((c) => toSummary(c, territories));
  if (filters.status) all = all.filter((c) => c.status === filters.status);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    all = all.filter((c) => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q));
  }
  return all;
}

async function fetchCaptain(id: string): Promise<CaptainRow> {
  const { data, error } = await db().from("captains").select("*").eq("id", id).maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Captain");
  return data as CaptainRow;
}

export async function getCaptain(id: string): Promise<CaptainSummary> {
  const c = await fetchCaptain(id);
  return toSummary(c, await fetchTerritories());
}

/** Create the captain AND their empty 1:1 territory (people flow §4g). */
export async function createCaptainRecord(
  input: z.infer<typeof createCaptain>,
): Promise<CaptainSummary> {
  const client = db();
  const { data, error } = await client
    .from("captains")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      pay_type: input.payType,
      pay_rate: input.payRate,
      pay_cadence: input.payCadence,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      notes: input.note ?? null,
    })
    .select()
    .single();
  if (error) throwDb(error);
  const captain = data as CaptainRow;

  const { error: territoryError } = await client
    .from("captain_territories")
    .insert({ assigned_captain_id: captain.id });
  if (territoryError) {
    // No cross-statement transaction over PostgREST — undo the captain insert.
    await client.from("captains").delete().eq("id", captain.id);
    throwDb(territoryError);
  }

  return getCaptain(captain.id);
}

export async function updateCaptainRecord(
  id: string,
  input: z.infer<typeof updateCaptain>,
): Promise<CaptainSummary> {
  await fetchCaptain(id);

  const patch: Record<string, unknown> = {};
  if (input.firstName !== undefined) patch.first_name = input.firstName;
  if (input.lastName !== undefined) patch.last_name = input.lastName;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.payType !== undefined) patch.pay_type = input.payType;
  if (input.payRate !== undefined) patch.pay_rate = input.payRate;
  if (input.payCadence !== undefined) patch.pay_cadence = input.payCadence;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.note !== undefined) patch.notes = input.note;

  const { error } = await db().from("captains").update(patch).eq("id", id);
  if (error) throwDb(error);

  // Pay config feeds the live calculation: rate/type changes ripple into every
  // open issue's unpaid cells immediately (cadence is informational only).
  if (input.payType !== undefined || input.payRate !== undefined) {
    await recalculateOpenIssues();
  }
  return getCaptain(id);
}

/** Soft retire; the territory becomes captain-less and awaits reassignment (§4k). */
export async function retireCaptain(id: string): Promise<CaptainSummary> {
  const c = await fetchCaptain(id);
  if (c.retired_at) throw conflict("Captain is already retired.");

  const client = db();
  const { error: retireError } = await client
    .from("captains")
    .update({ retired_at: today() })
    .eq("id", id);
  if (retireError) throwDb(retireError);

  const { error: territoryError } = await client
    .from("captain_territories")
    .update({ assigned_captain_id: null })
    .eq("assigned_captain_id", id);
  if (territoryError) throwDb(territoryError);

  return getCaptain(id);
}
