// A note is edited and deleted by its own id, independent of which person it
// hangs off, so these two live here rather than under volunteers/captains.
import { parseBody, route } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/respond";
import { deleteNoteRecord, updateNoteRecord } from "@/lib/services/notes";
import { updateNote } from "@/lib/validation/notes";

export const PATCH = route(async (req, params) => {
  const input = await parseBody(req, updateNote);
  return ok(await updateNoteRecord(params.id, input));
});

export const DELETE = route(async (_req, params) => {
  await deleteNoteRecord(params.id);
  return noContent();
});
