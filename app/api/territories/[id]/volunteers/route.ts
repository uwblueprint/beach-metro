import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { assignVolunteerToTerritory } from "@/lib/services/territories";
import { assignTerritoryVolunteer } from "@/lib/validation/people";

export const POST = route(async (req, params) => {
  const { volunteerId } = await parseBody(req, assignTerritoryVolunteer);
  return ok(await assignVolunteerToTerritory(params.id, volunteerId));
});
