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
  /** Checked ⇒ this bundle gets a printed label. Controlled when `onLabelledChange` is set. */
  labelled?: boolean[];
  onLabelledChange?: (next: boolean[]) => void;
  /** When true, the last row's papers cell starts in the active editing state. */
  startEditingLast?: boolean;
  /** Called when every row is either filled or removed — no empty error cells remain. */
  onValidityChange?: (valid: boolean) => void;
  className?: string;
}

function resizeFlags(prev: boolean[], length: number): boolean[] {
  if (prev.length === length) return prev;
  if (length > prev.length) {
    return [...prev, ...Array.from({ length: length - prev.length }, () => false)];
  }
  return prev.slice(0, length);
}

function shiftInvalidAfterRemove(prev: Set<number>, removedIndex: number): Set<number> {
  const next = new Set<number>();
  for (const i of prev) {
    if (i === removedIndex) continue;
    next.add(i > removedIndex ? i - 1 : i);
  }
  return next;
}

function parsePapersDraft(draft: string): number {
  const parsed = draft.trim() === "" ? 0 : Number.parseInt(draft, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function BundlePapersTable({
  value,
  onChange,
  labelled: labelledProp,
  onLabelledChange,
  startEditingLast = false,
  onValidityChange,
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
  /** Row indices left empty after blur — shown with a destructive border until filled or removed. */
  const [invalidRows, setInvalidRows] = useState<Set<number>>(() => new Set());
  const [internalLabelled, setInternalLabelled] = useState<boolean[]>(() => value.map(() => false));
  const labelledControlled = onLabelledChange !== undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  function updateLabelled(next: boolean[]) {
    if (labelledControlled) onLabelledChange(next);
    else setInternalLabelled(next);
  }

  useEffect(() => {
    if (editingIndex != null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingIndex]);

  useEffect(() => {
    if (value.length === 0) onChange([0]);
  }, [value.length, onChange]);

  useEffect(() => {
    setInvalidRows((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < value.length && value[i] === 0) next.add(i);
      }
      return next.size === prev.size && [...next].every((i) => prev.has(i)) ? prev : next;
    });
  }, [value]);

  useEffect(() => {
    // Block save while any row is still empty — including a newly added draft row
    // before blur marks it with the destructive border.
    onValidityChange?.(value.every((papers) => papers > 0));
  }, [value, onValidityChange]);

  function setRowInvalid(index: number, invalid: boolean) {
    setInvalidRows((prev) => {
      const next = new Set(prev);
      if (invalid) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setDraft(value[index] ? String(value[index]) : "");
  }

  function finishEdit(index: number, nextVal: number) {
    const next = [...value];
    next[index] = nextVal;
    onChange(next);
    setRowInvalid(index, nextVal === 0);
    setEditingIndex(null);
  }

  function commitEdit() {
    if (editingIndex == null) return;
    finishEdit(editingIndex, parsePapersDraft(draft));
  }

  function cancelEdit(index: number) {
    if (draft.trim() === "" || parsePapersDraft(draft) === 0) {
      setRowInvalid(index, true);
    }
    setEditingIndex(null);
  }

  function addRow() {
    const next = [...value, 0];
    onChange(next);
    const prevFlags = labelledControlled
      ? resizeFlags(labelledProp ?? [], value.length)
      : resizeFlags(internalLabelled, value.length);
    updateLabelled([...prevFlags, false]);
    setEditingIndex(next.length - 1);
    setDraft("");
  }

  function removeRow(index: number) {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== index));
    const prevFlags = labelledControlled
      ? resizeFlags(labelledProp ?? [], value.length)
      : resizeFlags(internalLabelled, value.length);
    updateLabelled(prevFlags.filter((_, i) => i !== index));
    setInvalidRows((prev) => shiftInvalidAfterRemove(prev, index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex != null && editingIndex > index) setEditingIndex(editingIndex - 1);
  }

  function setRowLabelled(index: number, next: boolean) {
    const prevFlags = labelledControlled
      ? resizeFlags(labelledProp ?? [], value.length)
      : resizeFlags(internalLabelled, value.length);
    const copy = [...prevFlags];
    copy[index] = next;
    updateLabelled(copy);
  }

  function toggleAllLabelled() {
    const flags = labelledControlled
      ? resizeFlags(labelledProp ?? [], value.length)
      : resizeFlags(internalLabelled, value.length);
    const allOn = flags.length > 0 && flags.every(Boolean);
    updateLabelled(Array.from({ length: value.length }, () => !allOn));
  }

  const canRemoveRow = value.length > 1;
  const flags = labelledControlled
    ? resizeFlags(labelledProp ?? [], value.length)
    : resizeFlags(internalLabelled, value.length);
  const labelledCount = flags.filter(Boolean).length;
  const allLabelled = flags.length > 0 && labelledCount === flags.length;
  const someLabelled = labelledCount > 0 && !allLabelled;

  const papersCellClassName = "h-8 rounded-[4px] px-2 py-1";

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

      {value.map((papers, index) => {
        const invalid = invalidRows.has(index);

        return (
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
                  aria-invalid={invalid && draft.trim() === "" ? true : undefined}
                  value={draft}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, "");
                    setDraft(next);
                    if (next.trim() !== "") setRowInvalid(index, false);
                  }}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEdit();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit(index);
                    }
                  }}
                  className={cn(inputFieldClassName, papersCellClassName)}
                />
              ) : (
                <button
                  type="button"
                  aria-invalid={invalid || undefined}
                  className={cn(
                    "flex h-8 w-full cursor-text items-center rounded-[4px] text-left text-md tabular-nums outline-none",
                    invalid
                      ? cn(inputFieldClassName, papersCellClassName, "text-secondary")
                      : cn(
                          "px-0 focus-visible:ring-2 focus-visible:ring-active/40",
                          papers > 0 ? "text-primary" : "text-secondary",
                        ),
                  )}
                  onClick={() => startEdit(index)}
                  onDoubleClick={() => startEdit(index)}
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
        );
      })}

      <p className="px-2 pt-1 text-md text-secondary">A checked bundle row will be labelled</p>
    </div>
  );
}

/** True when row count or any paper count differs — includes draft `0` rows. */
function papersRowsDiffer(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((papers, index) => papers !== b[index]);
}

export { BundlePapersTable, papersRowsDiffer };
