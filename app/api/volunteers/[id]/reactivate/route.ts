import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { reactivateVolunteer } from "@/lib/services/volunteers";

export const POST = route(async (_req, params) => {
  return ok(await reactivateVolunteer(params.id));
});
