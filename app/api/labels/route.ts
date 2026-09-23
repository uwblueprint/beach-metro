import type { NextRequest } from "next/server";

import { parseQuery, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { listLabels } from "@/lib/services/labels";
import { labelsQuery } from "@/lib/validation/labels";

/**
 * Every bundle in an issue, grouped by captain, with its labelled flag.
 *
 * No `issueId` means the open issue — the everyday case, since the flow is "the
 * run we are about to send out". An explicit id reprints a past issue.
 */
export const GET = route(async (req: NextRequest) => {
  const { issueId } = parseQuery(req, labelsQuery);
  return ok(await listLabels(issueId));
});
