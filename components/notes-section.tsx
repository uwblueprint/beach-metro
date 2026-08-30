"use client";

import { useState } from "react";

import { NoteEditor } from "@/components/note-editor";
import { SidePanelRow } from "@/components/side-panel-row";
import { SidePanelSection } from "@/components/side-panel-section";
import {
  useCreateNote,
  useDeleteNote,
  useMemberNotes,
  useUpdateNote,
  type MemberNote,
  type MemberRole,
} from "@/features/members/api";
import { cn } from "@/lib/utils";

const NEW_NOTE_ID = "__new-note__";
const VISIBLE_COUNT = 4;

interface NotesSectionProps {
  role: MemberRole;
  memberId: string;
}

const MONTHS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
];

/**
 * "2024-03-15T16:00:00Z" -> "Mar. 15, 2024".
 *
 * Resolved in America/Toronto rather than the viewer's local zone, matching the
 * `today()` convention the services already use. Without it, a timestamp stored at
 * UTC midnight renders as the previous day for anyone west of Greenwich, so a note
 * written on the 15th reads "Mar. 14".
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const month = get("month");
  const day = get("day");
  const year = get("year");
  if (!month || !day || !year) return iso;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function NotesSection({ role, memberId }: NotesSectionProps) {
  const { data: notes, isPending, isError } = useMemberNotes(role, memberId);
  const createNote = useCreateNote(role, memberId);
  const updateNote = useUpdateNote(role, memberId);
  const deleteNote = useDeleteNote(role, memberId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const isAdding = editingId === NEW_NOTE_ID;

  function stopEditing() {
    setEditingId(null);
  }

  const rows = notes ?? [];
  const preview = rows.slice(0, VISIBLE_COUNT);
  const extra = rows.slice(VISIBLE_COUNT);
  const hasMore = extra.length > 0;

  function renderNoteRow(note: MemberNote) {
    if (editingId === note.id) {
      return (
        <NoteEditor
          key={note.id}
          initialText={note.text}
          onSave={(text) => {
            updateNote.mutate({ id: note.id, text });
            stopEditing();
          }}
          onDelete={() => {
            deleteNote.mutate(note.id);
            stopEditing();
          }}
          onCancel={stopEditing}
        />
      );
    }

    return (
      <SidePanelRow
        key={note.id}
        meta={formatTimestamp(note.createdAt)}
        // An optimistic row has no server id yet, so editing it would 404.
        onEdit={note.id.startsWith("optimistic-") ? undefined : () => setEditingId(note.id)}
      >
        <span className="text-primary">{note.text}</span>
      </SidePanelRow>
    );
  }

  return (
    <SidePanelSection title="Notes" onAdd={() => setEditingId(NEW_NOTE_ID)}>
      {isAdding && (
        <NoteEditor
          onSave={(text) => {
            createNote.mutate(text);
            stopEditing();
          }}
          onDelete={stopEditing}
          onCancel={stopEditing}
        />
      )}
      {isError ? (
        <SidePanelRow className="text-secondary">Could not load notes</SidePanelRow>
      ) : isPending ? (
        <SidePanelRow className="text-secondary">Loading notes…</SidePanelRow>
      ) : rows.length === 0 && !isAdding ? (
        <SidePanelRow className="text-secondary">No notes</SidePanelRow>
      ) : (
        <>
          {preview.map((note) => renderNoteRow(note))}
          {hasMore ? (
            <>
              <div className="t-reimburse-list-expand grid" data-open={expanded ? "true" : "false"}>
                <div className="min-h-0 overflow-hidden">
                  {extra.map((note) => renderNoteRow(note))}
                </div>
              </div>
              <button
                type="button"
                aria-expanded={expanded}
                className={cn(
                  "mt-1 self-start text-md text-secondary transition-colors",
                  "hover:text-primary active:scale-[0.98]",
                )}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? "See less" : "See more"}
              </button>
            </>
          ) : null}
        </>
      )}
    </SidePanelSection>
  );
}

export { NotesSection };
