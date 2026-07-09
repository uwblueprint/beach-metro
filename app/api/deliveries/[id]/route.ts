import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { getDelivery, updateDeliveryRecord } from "@/lib/services/deliveries";
import { updateDelivery } from "@/lib/validation/delivery";

export const GET = route(async (_req, params) => {
  return ok(await getDelivery(params.id));
});

// 409 when the issue is closed; edits re-run the live payout calculation.
export const PATCH = route(async (req, params) => {
  return ok(await updateDeliveryRecord(params.id, await parseBody(req, updateDelivery)));
});
