import { parseBody, route } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/respond";
import { createNoteRecord, listNotes } from "@/lib/services/notes";
import { createNote } from "@/lib/validation/notes";

// Newest first, matching the order the side panel renders and prepends into.
export const GET = route(async (_req, params) => {
  return ok(await listNotes("volunteer", params.id));
});

export const POST = route(async (req, params) => {
  const input = await parseBody(req, createNote);
  return created(await createNoteRecord("volunteer", params.id, input));
});
