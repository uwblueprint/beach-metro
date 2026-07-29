import { parseBody, route } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/respond";
import { createIssuesBatch, listIssues } from "@/lib/services/issues";
import { createIssues } from "@/lib/validation/finance";

export const GET = route(async (_req, params) => {
  return ok(await listIssues(params.id));
});

// Create 1..n issues; each is born Open with payouts + delivery rows populated.
export const POST = route(async (req, params) => {
  return created(await createIssuesBatch(params.id, await parseBody(req, createIssues)));
});
