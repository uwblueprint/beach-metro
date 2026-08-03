import { parseQuery, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { listRecentPaidPayoutsForCaptain } from "@/lib/services/payouts";
import { captainPayoutsQuery } from "@/lib/validation/people";

export const GET = route(async (req, params) => {
  const { limit } = parseQuery(req, captainPayoutsQuery);
  return ok(await listRecentPaidPayoutsForCaptain(params.id, limit));
});
