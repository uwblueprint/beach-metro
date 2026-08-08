import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { listRoutePaths } from "@/lib/services/routes";

// Road-following polylines for the map, cached server-side. Separate from the
// list endpoint so filtering/searching never re-spends Routes API quota and the
// list stays fast while paths load progressively.
export const GET = route(async () => {
  return ok(await listRoutePaths());
});
