import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { retireCaptain } from "@/lib/services/captains";

export const POST = route(async (_req, params) => {
  return ok(await retireCaptain(params.id));
});
