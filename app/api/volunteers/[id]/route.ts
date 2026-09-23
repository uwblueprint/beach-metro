import { parseBody, route } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/respond";
import { deleteVolunteer, getVolunteer, updateVolunteerRecord } from "@/lib/services/volunteers";
import { updateVolunteer } from "@/lib/validation/people";

export const GET = route(async (_req, params) => {
  return ok(await getVolunteer(params.id));
});

export const PATCH = route(async (req, params) => {
  return ok(await updateVolunteerRecord(params.id, await parseBody(req, updateVolunteer)));
});

export const DELETE = route(async (_req, params) => {
  await deleteVolunteer(params.id);
  return noContent();
});
