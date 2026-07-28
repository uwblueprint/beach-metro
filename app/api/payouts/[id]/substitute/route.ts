import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { clearPayoutSubstitute, setPayoutSubstitute } from "@/lib/services/payouts";
import { setSubstitute } from "@/lib/validation/finance";

// Record (or clear) the captain who covered this issue. The payment is theirs;
// the cell stays on the original captain so the issue x captain grid is intact.
export const POST = route(async (req, params) => {
  const { substituteCaptainId } = await parseBody(req, setSubstitute);
  return ok(await setPayoutSubstitute(params.id, substituteCaptainId));
});

export const DELETE = route(async (_req, params) => {
  return ok(await clearPayoutSubstitute(params.id));
});
