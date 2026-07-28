import { parseQuery, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { getOverview } from "@/lib/services/overview";
import { periodQuery } from "@/lib/validation/finance";

// Dashboard aggregates for one financial year. Filters: `yearId`, `period`
// (ytd/q1..q4, relative to the year's own start month), or an explicit
// `from`/`to` custom range.
export const GET = route(async (req) => {
  return ok(await getOverview(parseQuery(req, periodQuery)));
});
