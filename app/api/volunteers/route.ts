import { parseBody, parseQuery, route } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/respond";
import { createVolunteerRecord, listVolunteers } from "@/lib/services/volunteers";
import { createVolunteer, volunteersQuery } from "@/lib/validation/people";

export const GET = route(async (req) => {
  return ok(await listVolunteers(parseQuery(req, volunteersQuery)));
});

export const POST = route(async (req) => {
  return created(await createVolunteerRecord(await parseBody(req, createVolunteer)));
});
