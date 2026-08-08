import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { unlockIssue } from "@/lib/services/issues";

// Unfreezes every frozen, unpaid cell and recomputes them, since the live numbers
// may have moved while the issue was locked.
export const POST = route(async (_req, params) => {
  return ok(await unlockIssue(params.id));
});
