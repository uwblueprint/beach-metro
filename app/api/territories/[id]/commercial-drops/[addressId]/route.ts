import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import {
  removeCommercialDropFromTerritory,
  updateCommercialDropCount,
} from "@/lib/services/territories";
import { updateCommercialDrop } from "@/lib/validation/people";

// Standing bundle count only. Separate from add so a count can be filled in later
// without re-validating (and re-billing) the address through Google.
export const PATCH = route(async (req, params) => {
  const input = await parseBody(req, updateCommercialDrop);
  return ok(await updateCommercialDropCount(params.id, params.addressId, input));
});

export const DELETE = route(async (_req, params) => {
  return ok(await removeCommercialDropFromTerritory(params.id, params.addressId));
});
