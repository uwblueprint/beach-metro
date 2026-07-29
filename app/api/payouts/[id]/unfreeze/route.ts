import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { unfreezePayout } from "@/lib/services/payouts";

// Drop the snapshot; the cell tracks the live calculation again.
export const POST = route(async (_req, params) => {
  return ok(await unfreezePayout(params.id));
});
