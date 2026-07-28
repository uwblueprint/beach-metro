"use client";

import { useState } from "react";

import { NoteEditor } from "@/components/note-editor";
import { SidePanelRow } from "@/components/side-panel-row";
import { SidePanelSection } from "@/components/side-panel-section";
import { formatToday, type Note } from "@/lib/stubs/members";

const NEW_NOTE_ID = "__new-note__";

interface NotesSectionProps {
  notes: Note[];
}

function NotesSection({ notes: initialNotes }: NotesSectionProps) {
  // In-memory only: no data layer exists yet for notes (see lib/stubs/members.ts).
  const [notes, setNotes] = useState(initialNotes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isAdding = editingId === NEW_NOTE_ID;

  function stopEditing() {
    setEditingId(null);
  }

  function saveNewNote(text: string) {
    setNotes((current) => [{ id: crypto.randomUUID(), text, date: formatToday() }, ...current]);
    stopEditing();
  }

  function saveEditedNote(id: string, text: string) {
    setNotes((current) => current.map((note) => (note.id === id ? { ...note, text } : note)));
    stopEditing();
  }

  function deleteNote(id: string) {
    setNotes((current) => current.filter((note) => note.id !== id));
    stopEditing();
  }

  return (
    <SidePanelSection title="Notes" onAdd={() => setEditingId(NEW_NOTE_ID)}>
      {isAdding && (
        <NoteEditor onSave={saveNewNote} onDelete={stopEditing} onCancel={stopEditing} />
      )}
      {notes.length === 0 && !isAdding ? (
        <SidePanelRow className="text-secondary">No notes</SidePanelRow>
      ) : (
        notes.map((note) =>
          editingId === note.id ? (
            <NoteEditor
              key={note.id}
              initialText={note.text}
              onSave={(text) => saveEditedNote(note.id, text)}
              onDelete={() => deleteNote(note.id)}
              onCancel={stopEditing}
            />
          ) : (
            <SidePanelRow key={note.id} meta={note.date} onEdit={() => setEditingId(note.id)}>
              <span className="text-primary">{note.text}</span>
            </SidePanelRow>
          ),
        )
      )}
    </SidePanelSection>
  );
}

export { NotesSection };
