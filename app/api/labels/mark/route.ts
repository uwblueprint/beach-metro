import type { NextRequest } from "next/server";

import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { setLabelled } from "@/lib/services/labels";
import { markLabels } from "@/lib/validation/labels";

/** Bulk set/clear the labelled flag on a set of bundles. */
export const POST = route(async (req: NextRequest) => {
  const body = await parseBody(req, markLabels);
  return ok(await setLabelled(body));
});
