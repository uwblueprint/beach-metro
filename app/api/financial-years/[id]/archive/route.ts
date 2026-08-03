import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { archiveYear } from "@/lib/services/financial-years";

export const POST = route(async (_req, params) => {
  return ok(await archiveYear(params.id));
});
