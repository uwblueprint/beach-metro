import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { suggestRouteHouseCount } from "@/lib/services/routes";

// Read-only house-count suggestion from the Toronto address points. Computed on
// demand and never stored, so there is nothing to refresh — the manual
// house_count stays authoritative until someone accepts this via PATCH.
export const GET = route(async (_req, params) => {
  return ok(await suggestRouteHouseCount(params.id));
});
