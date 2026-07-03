import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in admin's verified JWT claims, or null if unauthenticated.
 *
 * Uses `getClaims()` (asymmetric JWT verification) rather than `getSession()`,
 * so it can be trusted in Server Components and route handlers. Routes are
 * already gated by the middleware; use this when a page or handler needs the
 * user's identity (e.g. to show who is signed in, or to return 401).
 */
export async function getClaims() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
}
