import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { freezePayout } from "@/lib/services/payouts";

// Lock the calculated amount (bundling day) without marking the captain paid.
export const POST = route(async (_req, params) => {
  return ok(await freezePayout(params.id));
});
