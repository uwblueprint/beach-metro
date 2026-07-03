import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for the server-side data layer.
 *
 * Uses the secret key (`sb_secret_...`), so it BYPASSES Row Level Security and has
 * full DB access. It must never reach the browser — the `server-only` import above
 * makes importing this from a Client Component a build error.
 *
 * Per the API spec, all writes and business invariants run here in server-side
 * service functions; authorization is enforced in the handlers, not by RLS.
 * For anything that should act as the signed-in admin (respecting their session),
 * use `lib/supabase/server.ts` instead.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Supabase admin env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.",
    );
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
