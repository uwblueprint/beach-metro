import { parseQuery, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { nearestVacantRoutes } from "@/lib/services/routes";
import { nearestVacantQuery } from "@/lib/validation/routes";

export const GET = route(async (req) => {
  return ok(await nearestVacantRoutes(parseQuery(req, nearestVacantQuery)));
});
