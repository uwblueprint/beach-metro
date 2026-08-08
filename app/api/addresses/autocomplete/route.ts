import { z } from "zod";

import { parseQuery, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { getMapsProvider } from "@/lib/maps";

const query = z.object({
  q: z.string().trim().min(1),
  /** Groups one field's keystrokes into a single billed session (research doc §4). */
  session: z.string().trim().min(1),
});

// Address suggestions for form inputs (server-side; keys never reach the client).
// Returns [] rather than erroring when Places is unavailable, so the address
// field degrades to plain free text instead of blocking the form.
export const GET = route(async (req) => {
  const { q, session } = parseQuery(req, query);
  try {
    return ok(await getMapsProvider().autocompleteAddress(q, session));
  } catch {
    return ok([]);
  }
});
