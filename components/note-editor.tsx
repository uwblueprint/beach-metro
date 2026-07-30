"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";

interface NoteEditorProps {
  /** Existing note text when editing; omitted when adding a new note. */
  initialText?: string;
  onSave: (text: string) => void;
  /** Permanently removes the note (or, for an unsaved new note, cancels it). */
  onDelete: () => void;
  /** Reverts to the previous view without saving or deleting anything. */
  onCancel: () => void;
}

function NoteEditor({ initialText = "", onSave, onDelete, onCancel }: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionTakenRef = useRef(false);

  function handleSave() {
    const trimmed = textareaRef.current?.value.trim() ?? "";
    if (!trimmed) return;
    actionTakenRef.current = true;
    onSave(trimmed);
  }

  function handleDelete() {
    actionTakenRef.current = true;
    onDelete();
  }

  return (
    <div className="flex flex-col gap-1.5 px-1 py-1">
      <textarea
        ref={textareaRef}
        autoFocus
        defaultValue={initialText}
        rows={2}
        placeholder="Add a note"
        className="w-full resize-y rounded-[4px] border border-ring bg-bg px-2 py-1.5 text-md text-primary outline-none placeholder:text-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
          } else if (e.key === "Escape") {
            e.preventDefault();
            actionTakenRef.current = true;
            onCancel();
          }
        }}
        onBlur={() => {
          if (actionTakenRef.current) return;
          onCancel();
        }}
      />
      <div className="flex justify-end gap-1.5">
        {/* Keep the textarea focused through the click so blur-to-cancel doesn't fire first. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleDelete}
        >
          Delete
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export { NoteEditor };
