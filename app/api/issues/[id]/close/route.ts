import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { closeIssue } from "@/lib/services/issues";

// One shared close: locks payout values + delivery actuals together.
export const POST = route(async (_req, params) => {
  return ok(await closeIssue(params.id));
});
