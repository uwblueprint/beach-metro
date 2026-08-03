"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BundlePapersTableProps {
  /** Papers per bundle row. Use `0` for an empty/draft cell. */
  value: number[];
  onChange: (next: number[]) => void;
  /** When true, the last row's papers cell starts in the active editing state. */
  startEditingLast?: boolean;
  className?: string;
}

function BundlePapersTable({
  value,
  onChange,
  startEditingLast = false,
  className,
}: BundlePapersTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(
    startEditingLast && value.length > 0 ? value.length - 1 : null,
  );
  const [draft, setDraft] = useState(() => {
    if (startEditingLast && value.length > 0) {
      const papers = value[value.length - 1];
      return papers ? String(papers) : "";
    }
    return "";
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex != null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingIndex]);

  function startEdit(index: number) {
    setEditingIndex(index);
    setDraft(value[index] ? String(value[index]) : "");
  }

  function commitEdit() {
    if (editingIndex == null) return;
    const parsed = draft.trim() === "" ? 0 : Number.parseInt(draft, 10);
    const nextVal = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    const next = [...value];
    next[editingIndex] = nextVal;
    onChange(next);
    setEditingIndex(null);
  }

  function addRow() {
    const next = [...value, 0];
    onChange(next);
    setEditingIndex(next.length - 1);
    setDraft("");
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex != null && editingIndex > index) setEditingIndex(editingIndex - 1);
  }

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      <div className="flex h-10 items-center rounded-[8px] bg-bg-secondary p-2">
        <span className="min-w-0 flex-1 text-md text-secondary">Bundle</span>
        <span className="min-w-0 flex-1 text-md text-secondary">Papers</span>
        <div className="flex w-6 shrink-0 items-center justify-end">
          <Button
            type="button"
            variant="text"
            size="icon-sm"
            aria-label="Add bundle"
            onClick={addRow}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>

      {value.map((papers, index) => (
        <div key={index} className="group/bundle flex h-10 items-center justify-between px-2 py-1">
          <span className="min-w-0 flex-1 tabular-nums text-md text-secondary">{index + 1}</span>
          <div className="min-w-0 flex-1">
            {editingIndex === index ? (
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                aria-label={`Papers for bundle ${index + 1}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEdit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingIndex(null);
                  }
                }}
                className={cn(inputFieldClassName, "h-8 rounded-[4px] px-2 py-1")}
              />
            ) : (
              <button
                type="button"
                className="flex h-8 w-full cursor-text items-center rounded-[4px] px-0 text-left text-md tabular-nums text-secondary outline-none focus-visible:ring-2 focus-visible:ring-active/40"
                onDoubleClick={() => startEdit(index)}
              >
                {papers > 0 ? papers : ""}
              </button>
            )}
          </div>
          <div className="flex w-6 shrink-0 items-center justify-end">
            <Button
              type="button"
              variant="text"
              size="icon-sm"
              aria-label={`Remove bundle ${index + 1}`}
              className="opacity-0 transition-opacity group-hover/bundle:opacity-100 focus-visible:opacity-100"
              onClick={() => removeRow(index)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export { BundlePapersTable };
