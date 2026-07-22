import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { listDeliveries } from "@/lib/services/deliveries";

export const GET = route(async (_req, params) => {
  return ok(await listDeliveries(params.id));
});
