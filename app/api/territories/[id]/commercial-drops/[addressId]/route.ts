import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { removeCommercialDropFromTerritory } from "@/lib/services/territories";

export const DELETE = route(async (_req, params) => {
  return ok(await removeCommercialDropFromTerritory(params.id, params.addressId));
});
