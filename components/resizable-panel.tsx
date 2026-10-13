"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

const KEYBOARD_STEP_PX = 16;

interface ResizablePanelProps {
  children: ReactNode;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** Edge the drag handle sits on — "left" for a panel docked to the right of the page. */
  handleSide?: "left" | "right";
  /** Accessible name for the drag handle. */
  handleLabel?: string;
  className?: string;
}

/**
 * Fixed-height column whose width the user can drag (or arrow-key) between
 * `minWidth` and `maxWidth`. The handle straddles the chosen edge and highlights
 * on hover / focus / drag, so a `border-l` or `border-r` on the panel reads as
 * the grab line.
 */
function ResizablePanel({
  children,
  defaultWidth,
  minWidth,
  maxWidth,
  handleSide = "left",
  handleLabel = "Resize panel",
  className,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const clamp = (next: number) => Math.min(maxWidth, Math.max(minWidth, next));

  // The pointer leaves the thin handle mid-drag, so the resize cursor and the
  // no-select state have to live on the document until the drag ends.
  useEffect(() => {
    if (!dragging) return;
    const root = document.documentElement;
    const prevCursor = root.style.cursor;
    const prevUserSelect = root.style.userSelect;
    root.style.cursor = "col-resize";
    root.style.userSelect = "none";
    return () => {
      root.style.cursor = prevCursor;
      root.style.userSelect = prevUserSelect;
    };
  }, [dragging]);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startWidth: width };
    setDragging(true);
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = e.clientX - drag.startX;
    setWidth(clamp(drag.startWidth + (handleSide === "left" ? -delta : delta)));
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const growKey = handleSide === "left" ? "ArrowLeft" : "ArrowRight";
    const shrinkKey = handleSide === "left" ? "ArrowRight" : "ArrowLeft";
    if (e.key === growKey) setWidth((w) => clamp(w + KEYBOARD_STEP_PX));
    else if (e.key === shrinkKey) setWidth((w) => clamp(w - KEYBOARD_STEP_PX));
    else if (e.key === "Home") setWidth(minWidth);
    else if (e.key === "End") setWidth(maxWidth);
    else return;
    e.preventDefault();
  }

  return (
    <div className={cn("relative h-full shrink-0", className)} style={{ width }}>
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={handleLabel}
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        data-dragging={dragging || undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        className={cn(
          // 9px hit area centred on the 1px panel edge.
          "group/resize absolute inset-y-0 z-10 flex w-[9px] cursor-col-resize touch-none justify-center outline-none",
          handleSide === "left" ? "-left-1" : "-right-1",
        )}
      >
        <div className="h-full w-px transition-colors duration-150 ease-out group-hover/resize:bg-active group-focus-visible/resize:bg-active group-data-dragging/resize:bg-active" />
      </div>
    </div>
  );
}

export { ResizablePanel };
