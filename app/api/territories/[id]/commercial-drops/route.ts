import { parseBody, route } from "@/lib/api/handler";
import { created } from "@/lib/api/respond";
import { addCommercialDropToTerritory } from "@/lib/services/territories";
import { addCommercialDrop } from "@/lib/validation/people";

export const POST = route(async (req, params) => {
  return created(
    await addCommercialDropToTerritory(params.id, await parseBody(req, addCommercialDrop)),
  );
});
