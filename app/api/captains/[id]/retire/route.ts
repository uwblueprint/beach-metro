import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { retireCaptain } from "@/lib/services/captains";
import { retireMember } from "@/lib/validation/people";

export const POST = route(async (req, params) => {
  const input = await parseBody(req, retireMember);
  return ok(await retireCaptain(params.id, input));
});
