"use client";

import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidePanelRowProps {
  children: ReactNode;
  meta?: string;
  onEdit?: () => void;
  /** When set, the row is clickable (e.g. selectable deliveries). Uses a div when onEdit is also set. */
  onClick?: () => void;
  className?: string;
}

function SidePanelRow({ children, meta, onEdit, onClick, className }: SidePanelRowProps) {
  // Left pad is 0 so row text sits on the panel’s 24px content inset.
  // Tags/stickers with their own px should use -ml equal to that px so inner text aligns.
  const classes = cn(
    "group/row relative flex h-8 items-center gap-2 overflow-hidden rounded-[4px] py-1 pr-2",
    onClick &&
      "w-full cursor-pointer text-left outline-none transition-colors hover:bg-tag-hover focus-visible:ring-3 focus-visible:ring-ring/50",
    className,
  );

  const content = (
    <>
      <div className="min-w-0 flex-1 truncate text-md">{children}</div>
      {meta ? <span className="shrink-0 text-md text-secondary">{meta}</span> : null}
      {onEdit && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 rounded-[4px] bg-gradient-to-r from-transparent to-tag-hover opacity-0 transition-opacity group-hover/row:opacity-100"
          />
          <div className="absolute right-0 top-0 flex h-full items-center justify-end px-1 opacity-0 transition-opacity group-hover/row:opacity-100">
            <Button
              type="button"
              variant="text"
              size="icon-sm"
              aria-label="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="size-3" />
            </Button>
          </div>
        </>
      )}
    </>
  );

  if (onClick && !onEdit) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={classes}
    >
      {content}
    </div>
  );
}

export { SidePanelRow };
