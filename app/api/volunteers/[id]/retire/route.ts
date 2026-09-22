import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { retireVolunteer } from "@/lib/services/volunteers";
import { retireMember } from "@/lib/validation/people";

export const POST = route(async (req, params) => {
  const input = await parseBody(req, retireMember);
  return ok(await retireVolunteer(params.id, input));
});
