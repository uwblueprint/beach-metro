import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { reactivateCaptain } from "@/lib/services/captains";

export const POST = route(async (_req, params) => {
  return ok(await reactivateCaptain(params.id));
});
