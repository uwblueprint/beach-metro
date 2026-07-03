import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Refreshes the Supabase auth session and redirects unauthenticated requests
  // to /auth/login (see lib/supabase/middleware.ts). Both admins have identical
  // access, so this is an authentication gate only, not role-based.
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every request except static assets and image files, so the auth
     * session is kept fresh and protected routes are gated.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
