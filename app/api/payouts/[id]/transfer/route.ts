import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { transferPayoutAmount } from "@/lib/services/payouts";
import { transferPayout } from "@/lib/validation/finance";

// Reallocate this cell's amount to another captain (paired overrides).
export const POST = route(async (req, params) => {
  return ok(await transferPayoutAmount(params.id, await parseBody(req, transferPayout)));
});
