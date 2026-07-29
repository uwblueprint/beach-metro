import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { markPayoutPaid } from "@/lib/services/payouts";

// Only when the issue is Closed; marking paid locks the cell from edits.
export const POST = route(async (_req, params) => {
  return ok(await markPayoutPaid(params.id));
});
