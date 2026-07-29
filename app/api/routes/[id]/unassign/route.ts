import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { unassignRouteVolunteer } from "@/lib/services/routes";

export const POST = route(async (_req, params) => {
  return ok(await unassignRouteVolunteer(params.id));
});
