import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { getPayout } from "@/lib/services/payouts";

// Detail + calculation breakdown (quantity × rate, per route).
export const GET = route(async (_req, params) => {
  return ok(await getPayout(params.id));
});
