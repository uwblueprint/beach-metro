import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { getVolunteer, updateVolunteerRecord } from "@/lib/services/volunteers";
import { updateVolunteer } from "@/lib/validation/people";

export const GET = route(async (_req, params) => {
  return ok(await getVolunteer(params.id));
});

export const PATCH = route(async (req, params) => {
  return ok(await updateVolunteerRecord(params.id, await parseBody(req, updateVolunteer)));
});
