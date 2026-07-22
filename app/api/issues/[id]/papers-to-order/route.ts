import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { papersToOrder } from "@/lib/services/issues";

// Derived: sum of the issue's route paper counts (feeds the reporting dashboard).
export const GET = route(async (_req, params) => {
  return ok(await papersToOrder(params.id));
});
