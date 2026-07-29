import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { overridePayoutAmount } from "@/lib/services/payouts";
import { overridePayout } from "@/lib/validation/finance";

export const POST = route(async (req, params) => {
  return ok(await overridePayoutAmount(params.id, await parseBody(req, overridePayout)));
});
