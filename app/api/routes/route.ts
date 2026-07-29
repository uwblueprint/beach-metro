import { parseBody, parseQuery, route } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/respond";
import { createRouteRecord, listRoutes } from "@/lib/services/routes";
import { createRoute, routesQuery } from "@/lib/validation/routes";

export const GET = route(async (req) => {
  return ok(await listRoutes(parseQuery(req, routesQuery)));
});

export const POST = route(async (req) => {
  return created(await createRouteRecord(await parseBody(req, createRoute)));
});
