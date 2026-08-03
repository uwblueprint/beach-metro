// Member notes: per-note history on a volunteer or a captain (people flow §4c/§4i).
//
// Notes were a single free-form string until the members-page design made per-note
// dates and per-note edit/delete a requirement. See docs/design_decisions.md and
// supabase/migrations/20260730000000_member_notes.sql.
import type { z } from "zod";

import { notFound } from "@/lib/api/errors";
import type { createNote, updateNote } from "@/lib/validation/notes";
import type { MemberNoteRow } from "@/types/db";

import { db, throwDb } from "./shared";

export interface MemberNote {
  id: string;
  text: string;
  /** ISO timestamp. The UI formats it for display. */
  createdAt: string;
  updatedAt: string | null;
}

/** Which kind of person a note hangs off. Mirrors the table's two nullable FKs. */
export type NoteParent = "volunteer" | "captain";

const COLUMN: Record<NoteParent, "volunteer_id" | "captain_id"> = {
  volunteer: "volunteer_id",
  captain: "captain_id",
};

const PARENT_TABLE: Record<NoteParent, "volunteers" | "captains"> = {
  volunteer: "volunteers",
  captain: "captains",
};

function toNote(row: MemberNoteRow): MemberNote {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 404 rather than silently returning an empty list for a person who isn't there. */
async function assertParentExists(parent: NoteParent, parentId: string): Promise<void> {
  const { data, error } = await db()
    .from(PARENT_TABLE[parent])
    .select("id")
    .eq("id", parentId)
    .maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound(parent === "volunteer" ? "Volunteer" : "Captain");
}

/** Newest first, which is the order the side panel renders and prepends into. */
export async function listNotes(parent: NoteParent, parentId: string): Promise<MemberNote[]> {
  await assertParentExists(parent, parentId);
  const { data, error } = await db()
    .from("member_notes")
    .select("*")
    .eq(COLUMN[parent], parentId)
    .order("created_at", { ascending: false });
  if (error) throwDb(error);
  return ((data ?? []) as MemberNoteRow[]).map(toNote);
}

export async function createNoteRecord(
  parent: NoteParent,
  parentId: string,
  input: z.infer<typeof createNote>,
): Promise<MemberNote> {
  await assertParentExists(parent, parentId);
  const { data, error } = await db()
    .from("member_notes")
    .insert({ [COLUMN[parent]]: parentId, text: input.text })
    .select("*")
    .single();
  if (error) throwDb(error);
  return toNote(data as MemberNoteRow);
}

async function fetchNote(id: string): Promise<MemberNoteRow> {
  const { data, error } = await db().from("member_notes").select("*").eq("id", id).maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Note");
  return data as MemberNoteRow;
}

export async function getNote(id: string): Promise<MemberNote> {
  return toNote(await fetchNote(id));
}

/** Edit stamps updated_at so the panel can show "edited" if it ever wants to. */
export async function updateNoteRecord(
  id: string,
  input: z.infer<typeof updateNote>,
): Promise<MemberNote> {
  await fetchNote(id);
  const { data, error } = await db()
    .from("member_notes")
    .update({ text: input.text, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwDb(error);
  return toNote(data as MemberNoteRow);
}

/** Hard delete. Notes are the one thing here with no historical value once removed. */
export async function deleteNoteRecord(id: string): Promise<void> {
  await fetchNote(id);
  const { error } = await db().from("member_notes").delete().eq("id", id);
  if (error) throwDb(error);
}
