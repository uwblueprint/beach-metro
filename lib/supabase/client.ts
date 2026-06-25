import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (anon/publishable key).
 *
 * Phase 1 will switch this to `@supabase/ssr` for cookie-based auth sessions.
 * For now it is a thin factory so nothing runs at import time and the build does
 * not require env vars to be set.
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase env vars missing. Copy .env.example to .env.local and fill them in.");
  }

  return createClient(url, anonKey);
}
