"use client";

import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidePanelRowProps {
  children: ReactNode;
  meta?: ReactNode;
  onEdit?: () => void;
  /** When set, the row is clickable (e.g. selectable deliveries). */
  onClick?: () => void;
  /**
   * Same geometry as a list row (h-10, p-2, rounded-md) without hover/press.
   * Use for read-only values that should optically match list rows.
   */
  static?: boolean;
  /** Accessible name when the row is interactive. */
  "aria-label"?: string;
  /**
   * Hover-revealed control on the right edge (e.g. copy icon). Aligns with the
   * panel close button / section header actions.
   */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Compact list row for member side-panel sections — same chrome as members
 * `table-row` / sidebar ListItem (h-10, p-2, rounded-md, hover fill).
 */
function SidePanelRow({
  children,
  meta,
  onEdit,
  onClick,
  static: isStatic = false,
  "aria-label": ariaLabel,
  trailing,
  className,
}: SidePanelRowProps) {
  const interactive = !isStatic && Boolean(onClick || onEdit || trailing);
  const showTrailing = Boolean(trailing || onEdit) && !isStatic;
  const classes = cn(
    interactive
      ? // pr-3 (12px): room for trailing icons; right edge aligns with panel close (content pr-6).
        "table-row group/row relative gap-2 overflow-hidden pr-3"
      : "relative flex h-10 w-full cursor-default items-center gap-2 overflow-hidden rounded-md p-2 text-md",
    className,
  );

  const metaContent =
    meta == null ? null : typeof meta === "string" ? (
      <span className="shrink-0 text-md text-tertiary">{meta}</span>
    ) : (
      meta
    );

  const content = (
    <>
      <div className="min-w-0 flex-1 truncate">{children}</div>
      {metaContent}
      {showTrailing && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 rounded-md bg-gradient-to-r from-transparent to-bg-secondary opacity-0 transition-opacity group-hover/row:opacity-100"
          />
          <div className="absolute right-0 top-0 flex h-full items-center justify-end opacity-0 transition-opacity group-hover/row:opacity-100">
            {trailing}
            {onEdit ? (
              <Button
                type="button"
                variant="text"
                size="icon-sm"
                aria-label="Edit"
                className="text-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil className="size-3" />
              </Button>
            ) : null}
          </div>
        </>
      )}
    </>
  );

  // Deliberately a div, never a <button>: `meta` carries interactive content on
  // the deliveries list (the route actions menu renders its own <button>), and a
  // button inside a button is invalid HTML — the parser closes the outer one,
  // and Enter/Space on the inner trigger stops being reliable.
  return (
    <div
      role={onClick && !isStatic ? "button" : undefined}
      tabIndex={onClick && !isStatic ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={isStatic ? undefined : onClick}
      onKeyDown={
        onClick && !isStatic
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
