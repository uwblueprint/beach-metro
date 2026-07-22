// Address resolution: run input through the Maps provider, persist the
// GoogleMapsLocation (durable place_id + 30-day cache fields) and the Address row.
import { notFound } from "@/lib/api/errors";
import { getMapsProvider } from "@/lib/maps";
import type { ResolvedAddress } from "@/lib/maps";
import type { AddressInput } from "@/lib/validation/common";
import type { AddressRow, AddressType } from "@/types/db";

import { db, throwDb } from "./shared";

/** Resolve raw input or a known placeId to a normalized address. */
export async function resolveAddress(input: AddressInput): Promise<ResolvedAddress> {
  const provider = getMapsProvider();
  return "placeId" in input
    ? provider.geocodePlaceId(input.placeId)
    : provider.validateAddress(input);
}

/**
 * Resolve + persist: upsert the google_maps_locations cache row, insert an
 * addresses row of the given type. Returns the new address id.
 *
 * Old address rows are NOT deleted when an entity re-points (route endpoints can
 * share addresses; orphans are harmless and cheap — recorded as an interpretation).
 */
export async function createAddress(
  input: AddressInput,
  type: AddressType,
  territoryId: string | null = null,
): Promise<{ address: AddressRow; resolved: ResolvedAddress }> {
  const resolved = await resolveAddress(input);
  const client = db();

  const { error: gmlError } = await client.from("google_maps_locations").upsert({
    id: resolved.placeId,
    cached_latitude: resolved.latitude,
    cached_longitude: resolved.longitude,
    cached_formatted_address: resolved.formattedAddress,
    cached_at: new Date().toISOString(),
    street_number: resolved.components.streetNumber,
    street_name: resolved.components.streetName,
    locality: resolved.components.locality,
    sublocality: resolved.components.sublocality,
    administrative_area: resolved.components.administrativeArea,
    postal_code: resolved.components.postalCode,
    country_code: resolved.components.countryCode,
    location_type: resolved.locationType,
  });
  if (gmlError) throwDb(gmlError);

  const { data, error } = await client
    .from("addresses")
    .insert({ google_maps_id: resolved.placeId, type, territory_id: territoryId })
    .select()
    .single();
  if (error) throwDb(error);

  return { address: data as AddressRow, resolved };
}

export interface AddressDetail {
  id: string;
  placeId: string;
  type: AddressType;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Fetch address rows joined with their cached location, keyed by address id. */
export async function getAddressDetails(ids: string[]): Promise<Map<string, AddressDetail>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db()
    .from("addresses")
    .select(
      "id, type, google_maps_id, google_maps_locations(cached_formatted_address, cached_latitude, cached_longitude)",
    )
    .in("id", ids);
  if (error) throwDb(error);

  const map = new Map<string, AddressDetail>();
  // PostgREST returns the many-to-one embed as a single object; the untyped
  // client infers an array, so cast through unknown until types are generated.
  for (const row of (data ?? []) as unknown as Array<{
    id: string;
    type: AddressType;
    google_maps_id: string;
    google_maps_locations: {
      cached_formatted_address: string | null;
      cached_latitude: number | null;
      cached_longitude: number | null;
    } | null;
  }>) {
    map.set(row.id, {
      id: row.id,
      placeId: row.google_maps_id,
      type: row.type,
      formattedAddress: row.google_maps_locations?.cached_formatted_address ?? null,
      latitude: row.google_maps_locations?.cached_latitude ?? null,
      longitude: row.google_maps_locations?.cached_longitude ?? null,
    });
  }
  return map;
}

export async function getAddressDetail(id: string): Promise<AddressDetail> {
  const detail = (await getAddressDetails([id])).get(id);
  if (!detail) throw notFound("Address");
  return detail;
}
