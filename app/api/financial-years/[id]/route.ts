import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { getYearDetail } from "@/lib/services/financial-years";

// The table: issues × captain payout cells.
export const GET = route(async (_req, params) => {
  return ok(await getYearDetail(params.id));
});
