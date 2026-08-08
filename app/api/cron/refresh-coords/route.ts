// Scheduled coordinate-cache refresh (research doc §1.3): re-resolve cached
// lat/lng older than ~25 days; evict anything past the 30-day Google ToS
// ceiling that could not be refreshed. Triggered by Vercel Cron (vercel.json).
//
// Cron requests carry no user session, so this route is NOT behind the normal
// auth wrapper — it requires `Authorization: Bearer ${CRON_SECRET}` instead
// (Vercel sends that automatically when the CRON_SECRET env var is set).
// For local/manual runs use `pnpm refresh-coords`.
import { NextRequest, NextResponse } from "next/server";

import { getMapsProvider } from "@/lib/maps";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GoogleMapsLocationRow } from "@/types/db";

const REFRESH_AFTER_DAYS = 25;
const EVICT_AFTER_DAYS = 30;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: "internal", message: "CRON_SECRET is not configured." } },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Invalid cron secret." } },
      { status: 401 },
    );
  }

  const provider = getMapsProvider();
  const supabase = createAdminClient();
  const now = Date.now();
  const refreshCutoff = new Date(now - REFRESH_AFTER_DAYS * 86_400_000).toISOString();
  const evictCutoff = new Date(now - EVICT_AFTER_DAYS * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("google_maps_locations")
    .select("id, cached_at")
    .or(`cached_at.lt.${refreshCutoff},cached_at.is.null`);
  if (error) {
    return NextResponse.json(
      { error: { code: "internal", message: `Query failed: ${error.message}` } },
      { status: 500 },
    );
  }

  let refreshed = 0;
  let evicted = 0;
  let failed = 0;
  for (const row of (data ?? []) as Pick<GoogleMapsLocationRow, "id" | "cached_at">[]) {
    try {
      const resolved = await provider.geocodePlaceId(row.id);
      const { error: updateError } = await supabase
        .from("google_maps_locations")
        .update({
          cached_latitude: resolved.latitude,
          cached_longitude: resolved.longitude,
          cached_formatted_address: resolved.formattedAddress,
          cached_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
      refreshed++;
    } catch {
      failed++;
      // Refresh failed: past the 30-day ceiling the cache MUST go (Google ToS).
      if (row.cached_at && row.cached_at < evictCutoff) {
        await supabase
          .from("google_maps_locations")
          .update({
            cached_latitude: null,
            cached_longitude: null,
            cached_formatted_address: null,
            cached_at: null,
          })
          .eq("id", row.id);
        evicted++;
      }
    }
  }

  return NextResponse.json({ data: { checked: (data ?? []).length, refreshed, evicted, failed } });
}
