import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { lockIssue } from "@/lib/services/issues";

// PENDING(Q1): the design locks a whole issue at once, so this freezes every
// unpaid cell in it. The per-cell freeze endpoints still exist underneath.
export const POST = route(async (_req, params) => {
  return ok(await lockIssue(params.id));
});
