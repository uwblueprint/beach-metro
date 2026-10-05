import { parseBody, route } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/respond";
import { deleteIssue, getIssue, updateIssueRecord } from "@/lib/services/issues";
import { updateIssue } from "@/lib/validation/finance";

export const GET = route(async (_req, params) => {
  return ok(await getIssue(params.id));
});

export const PATCH = route(async (req, params) => {
  return ok(await updateIssueRecord(params.id, await parseBody(req, updateIssue)));
});

export const DELETE = route(async (_req, params) => {
  await deleteIssue(params.id);
  return noContent();
});
