import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { listCommercialDropCandidates } from "@/lib/services/territories";

/** All commercial drops system-wide (for Drop Details pickers). */
export const GET = route(async () => {
  return ok(await listCommercialDropCandidates());
});
