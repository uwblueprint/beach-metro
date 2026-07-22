import { parseBody, route } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/respond";
import { getRoute, softDeleteRoute, updateRouteRecord } from "@/lib/services/routes";
import { updateRoute } from "@/lib/validation/routes";

export const GET = route(async (_req, params) => {
  return ok(await getRoute(params.id));
});

export const PATCH = route(async (req, params) => {
  return ok(await updateRouteRecord(params.id, await parseBody(req, updateRoute)));
});

// Soft delete: sets deleted_at; the row is retained so history resolves.
export const DELETE = route(async (_req, params) => {
  await softDeleteRoute(params.id);
  return noContent();
});
