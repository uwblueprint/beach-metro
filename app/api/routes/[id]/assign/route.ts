import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { assignRouteVolunteer } from "@/lib/services/routes";
import { assignRoute } from "@/lib/validation/routes";

export const POST = route(async (req, params) => {
  const { volunteerId } = await parseBody(req, assignRoute);
  return ok(await assignRouteVolunteer(params.id, volunteerId));
});
