import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client (service-role key).
 *
 * Used only inside route handlers / server code. The service-role key is
 * server-only and must never be shipped to the browser. This is a factory so
 * nothing runs at import time and the build does not require env vars.
 */
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase server env vars missing. Copy .env.example to .env.local and fill them in.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
