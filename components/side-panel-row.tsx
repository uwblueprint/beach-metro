"use client";

import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SidePanelRowProps {
  children: ReactNode;
  meta?: string;
  onEdit?: () => void;
  className?: string;
}

function SidePanelRow({ children, meta, onEdit, className }: SidePanelRowProps) {
  return (
    <div
      className={cn(
        "group/row relative flex h-8 items-center gap-2 overflow-hidden rounded-[4px] px-2 py-1",
        className,
      )}
    >
      <div className="min-w-0 flex-1 truncate text-md">{children}</div>
      {meta && <span className="shrink-0 text-md text-secondary">{meta}</span>}
      {onEdit && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 rounded-[4px] bg-gradient-to-r from-transparent to-tag-hover opacity-0 transition-opacity group-hover/row:opacity-100"
          />
          <div className="absolute right-0 top-0 flex h-full items-center justify-end px-1 opacity-0 transition-opacity group-hover/row:opacity-100">
            <button
              type="button"
              className="flex cursor-pointer items-center justify-center rounded-[4px] p-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="size-3 text-primary" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export { SidePanelRow };
