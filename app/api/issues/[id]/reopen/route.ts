import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { reopenIssue } from "@/lib/services/issues";

// Guarded admin correction; reopens finance + delivery together.
export const POST = route(async (_req, params) => {
  return ok(await reopenIssue(params.id));
});
