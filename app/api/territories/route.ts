import { parseQuery, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { listTerritories } from "@/lib/services/territories";
import { territoriesQuery } from "@/lib/validation/people";

export const GET = route(async (req) => {
  return ok(await listTerritories(parseQuery(req, territoriesQuery)));
});
