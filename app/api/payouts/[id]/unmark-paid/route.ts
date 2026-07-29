import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { unmarkPayoutPaid } from "@/lib/services/payouts";

export const POST = route(async (_req, params) => {
  return ok(await unmarkPayoutPaid(params.id));
});
