import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { retireVolunteer } from "@/lib/services/volunteers";

export const POST = route(async (_req, params) => {
  return ok(await retireVolunteer(params.id));
});
