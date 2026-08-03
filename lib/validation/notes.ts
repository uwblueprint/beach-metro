// Request schemas for member notes (people flow: volunteer + captain notes).
import { z } from "zod";

/** Note body. Trimmed, and blank is a validation error rather than an empty note. */
const noteText = z.string().trim().min(1, "A note cannot be empty.");

export const createNote = z.object({ text: noteText });

export const updateNote = z.object({ text: noteText });
