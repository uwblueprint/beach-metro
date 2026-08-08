import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { setPayoutComment } from "@/lib/services/payouts";
import { setPayoutComment as setPayoutCommentSchema } from "@/lib/validation/finance";

// A free-standing note on the cell, a different thing from the reason attached to
// an override. Sending null or an empty string clears it.
export const PATCH = route(async (req, params) => {
  const input = await parseBody(req, setPayoutCommentSchema);
  return ok(await setPayoutComment(params.id, input));
});
