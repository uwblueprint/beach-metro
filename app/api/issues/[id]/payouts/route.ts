import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { listPayouts } from "@/lib/services/payouts";

export const GET = route(async (_req, params) => {
  return ok(await listPayouts(params.id));
});
