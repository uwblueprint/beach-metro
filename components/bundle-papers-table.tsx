"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

function resizeFlags(prev: boolean[], length: number): boolean[] {
  if (prev.length === length) return prev;
  if (length > prev.length) {
    return [...prev, ...Array.from({ length: length - prev.length }, () => false)];
  }
  return prev.slice(0, length);
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
  /** Checked ⇒ this bundle gets a printed label. */
  const [labelled, setLabelled] = useState<boolean[]>(() => value.map(() => false));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex != null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingIndex]);

  useEffect(() => {
    if (value.length === 0) onChange([0]);
  }, [value.length, onChange]);

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
    setLabelled((prev) => [...resizeFlags(prev, value.length), false]);
    setEditingIndex(next.length - 1);
    setDraft("");
  }

  function removeRow(index: number) {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== index));
    setLabelled((prev) => resizeFlags(prev, value.length).filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex != null && editingIndex > index) setEditingIndex(editingIndex - 1);
  }

  function setRowLabelled(index: number, next: boolean) {
    setLabelled((prev) => {
      const flags = resizeFlags(prev, value.length);
      const copy = [...flags];
      copy[index] = next;
      return copy;
    });
  }

  function toggleAllLabelled() {
    const flags = resizeFlags(labelled, value.length);
    const allOn = flags.length > 0 && flags.every(Boolean);
    setLabelled(Array.from({ length: value.length }, () => !allOn));
  }

  const canRemoveRow = value.length > 1;
  const flags = resizeFlags(labelled, value.length);
  const labelledCount = flags.filter(Boolean).length;
  const allLabelled = flags.length > 0 && labelledCount === flags.length;
  const someLabelled = labelledCount > 0 && !allLabelled;

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      <div className="flex h-10 items-center rounded-[8px] bg-bg-secondary px-2 py-2">
        <div className="flex w-fit shrink-0 items-center pr-2">
          <Checkbox
            checked={allLabelled}
            indeterminate={someLabelled}
            aria-label={allLabelled ? "Unlabel all bundles" : "Label all bundles"}
            onCheckedChange={() => toggleAllLabelled()}
          />
        </div>
        <span className="ml-1 min-w-0 flex-1 text-md text-secondary">Bundle</span>
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
        <div key={index} className="group/bundle flex h-10 items-center px-2 py-1">
          <div className="flex w-fit shrink-0 items-center pr-2">
            <Checkbox
              checked={flags[index] === true}
              aria-label={`Label bundle ${index + 1}`}
              onCheckedChange={(checked) => setRowLabelled(index, checked === true)}
            />
          </div>
          <span className="ml-1 min-w-0 flex-1 tabular-nums text-md text-secondary">
            {index + 1}
          </span>
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
                className={cn(inputFieldClassName, "h-8 rounded-[4px] px-0 py-1")}
              />
            ) : (
              <button
                type="button"
                className="flex h-8 w-full cursor-text items-center rounded-[4px] px-0 text-left text-md tabular-nums text-secondary outline-none focus-visible:ring-2 focus-visible:ring-active/40"
                onDoubleClick={() => startEdit(index)}
                // Keyboard parity with the double-click: the cell is focusable,
                // so it has to be openable without a pointer.
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startEdit(index);
                  }
                }}
              >
                {papers > 0 ? papers : ""}
              </button>
            )}
          </div>
          <div className="flex w-6 shrink-0 items-center justify-end">
            {canRemoveRow ? (
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
            ) : null}
          </div>
        </div>
      ))}

      <p className="px-2 pt-1 text-md text-secondary">A checked bundle row will be labelled</p>
    </div>
  );
}

export { BundlePapersTable };
