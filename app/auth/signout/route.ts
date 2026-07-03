import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Signs the admin out and returns them to the login page. */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 so the browser follows the redirect with a GET.
  return NextResponse.redirect(new URL("/auth/login", request.url), { status: 303 });
}
