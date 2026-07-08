import { parseBody, parseQuery, route } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/respond";
import { createCaptainRecord, listCaptains } from "@/lib/services/captains";
import { captainsQuery, createCaptain } from "@/lib/validation/people";

export const GET = route(async (req) => {
  return ok(await listCaptains(parseQuery(req, captainsQuery)));
});

export const POST = route(async (req) => {
  return created(await createCaptainRecord(await parseBody(req, createCaptain)));
});
