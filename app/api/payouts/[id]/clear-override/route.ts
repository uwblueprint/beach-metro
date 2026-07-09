import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { clearPayoutOverride } from "@/lib/services/payouts";

export const POST = route(async (_req, params) => {
  return ok(await clearPayoutOverride(params.id));
});
