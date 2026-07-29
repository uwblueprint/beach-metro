// Coordinate-cache refresh (research doc §1.3): re-resolve google_maps_locations
// rows whose cached lat/lng is older than ~25 days; evict (null out) anything
// past the 30-day ToS ceiling that could not be refreshed.
//
//   pnpm refresh-coords
//
// This is the Phase 5 "refresh job stub" — run manually for now; scheduling
// (e.g. Vercel cron) is an open item in docs/open_items.md.
import { createClient } from "@supabase/supabase-js";

import { fakeMapsProvider } from "../lib/maps/fake";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY missing in .env.local.");
  process.exit(1);
}

// Same provider selection as lib/maps — the fake until Google keys exist.
const provider = fakeMapsProvider;
const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const REFRESH_AFTER_DAYS = 25;
const EVICT_AFTER_DAYS = 30;
const now = Date.now();
const refreshCutoff = new Date(now - REFRESH_AFTER_DAYS * 86_400_000).toISOString();
const evictCutoff = new Date(now - EVICT_AFTER_DAYS * 86_400_000).toISOString();

const { data, error } = await supabase
  .from("google_maps_locations")
  .select("id, cached_at")
  .or(`cached_at.lt.${refreshCutoff},cached_at.is.null`);
if (error) {
  console.error("query failed:", error.message);
  process.exit(1);
}

let refreshed = 0;
let evicted = 0;
for (const row of data ?? []) {
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
    // Refresh failed: if the cache is past the 30-day ceiling, evict it (ToS).
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

console.log(`coordinate refresh: ${refreshed} refreshed, ${evicted} evicted`);
