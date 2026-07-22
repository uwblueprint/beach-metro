import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { getTerritory, updateTerritoryRecord } from "@/lib/services/territories";
import { updateTerritory } from "@/lib/validation/people";

export const GET = route(async (_req, params) => {
  return ok(await getTerritory(params.id));
});

export const PATCH = route(async (req, params) => {
  return ok(await updateTerritoryRecord(params.id, await parseBody(req, updateTerritory)));
});
