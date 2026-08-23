import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { unarchiveYear } from "@/lib/services/financial-years";

export const POST = route(async (_req, params) => {
  return ok(await unarchiveYear(params.id));
});
