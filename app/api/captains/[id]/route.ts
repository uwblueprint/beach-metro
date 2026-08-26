import { parseBody, route } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/respond";
import { deleteCaptain, getCaptain, updateCaptainRecord } from "@/lib/services/captains";
import { updateCaptain } from "@/lib/validation/people";

export const GET = route(async (_req, params) => {
  return ok(await getCaptain(params.id));
});

export const PATCH = route(async (req, params) => {
  return ok(await updateCaptainRecord(params.id, await parseBody(req, updateCaptain)));
});

export const DELETE = route(async (_req, params) => {
  await deleteCaptain(params.id);
  return noContent();
});
