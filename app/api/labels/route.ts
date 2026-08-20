import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { listLabels } from "@/lib/services/labels";

/**
 * Every bundle in the current open issue, grouped by captain, with its labelled
 * flag. No issueId param — the flow is always "the run we are about to send out".
 */
export const GET = route(async () => {
  return ok(await listLabels());
});
