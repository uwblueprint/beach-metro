import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { getYearDetail, updateYearRecord } from "@/lib/services/financial-years";
import { updateFinancialYear } from "@/lib/validation/finance";

// The table: issues × captain payout cells.
export const GET = route(async (_req, params) => {
  return ok(await getYearDetail(params.id));
});

// Rename only. The start date is deliberately not editable: it fixes the
// reporting quarters, so moving it would silently reshuffle the overview.
export const PATCH = route(async (req, params) => {
  const input = await parseBody(req, updateFinancialYear);
  return ok(await updateYearRecord(params.id, input));
});
