import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { lockIssue } from "@/lib/services/issues";

// Locking settles an issue's numbers so a later route edit cannot move them. It
// says nothing about anyone having been paid. Freezes every unpaid cell at once;
// the per-cell freeze endpoints still exist underneath.
export const POST = route(async (_req, params) => {
  return ok(await lockIssue(params.id));
});
