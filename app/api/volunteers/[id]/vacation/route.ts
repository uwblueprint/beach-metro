import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { setVolunteerVacation } from "@/lib/services/volunteers";
import { setVacation } from "@/lib/validation/people";

export const POST = route(async (req, params) => {
  return ok(await setVolunteerVacation(params.id, await parseBody(req, setVacation)));
});
