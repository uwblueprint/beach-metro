"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { SidePanelRow } from "@/components/side-panel-row";

export const SIDE_PANEL_COLLAPSE_LIMIT = 3;

function readCssDurationMsFrom(el: Element, variable: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(variable).trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw) || fallback;
}

/**
 * Height-tweened reveal (transitions-dev card resize) for show-more content.
 */
function SidePanelHeightReveal({ open, children }: { open: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(open);
  const [height, setHeight] = useState(0);

  if (open && !mounted) {
    setMounted(true);
  }
  if (!open && height !== 0) {
    setHeight(0);
  }

  useLayoutEffect(() => {
    if (open) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      return;
    }
    if (!mounted) return;

    if (!innerRef.current) {
      const t = setTimeout(() => setMounted(false), 0);
      return () => clearTimeout(t);
    }
    const ms = readCssDurationMsFrom(innerRef.current, "--resize-dur", 300);
    closeTimerRef.current = setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
    }, ms);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, mounted]);

  useLayoutEffect(() => {
    if (!open || !mounted) return;
    const node = innerRef.current;
    if (!node) return;

    const measure = () => setHeight(node.scrollHeight);
    let nested = 0;
    const outer = requestAnimationFrame(() => {
      nested = requestAnimationFrame(measure);
    });
    const ro = new ResizeObserver(measure);
    ro.observe(node);

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(nested);
      ro.disconnect();
    };
  }, [open, mounted]);

  if (!mounted) return null;

  return (
    <div className="t-resize overflow-hidden" style={{ height }}>
      <div
        ref={innerRef}
        className={
          open
            ? "flex flex-col gap-1 opacity-100 transition-opacity duration-[var(--resize-dur)] ease-[var(--resize-ease)]"
            : "flex flex-col gap-1 opacity-0 transition-opacity duration-[var(--resize-dur)] ease-[var(--resize-ease)]"
        }
      >
        {children}
      </div>
    </div>
  );
}

function SidePanelShowMoreRow({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const isFirstRef = useRef(true);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const next = expanded ? "Show less" : "Show more";

    if (isFirstRef.current) {
      el.textContent = next;
      isFirstRef.current = false;
      return;
    }
    if (el.textContent === next) return;

    let cancelled = false;
    el.classList.add("is-exit");
    const dur = readCssDurationMsFrom(el, "--text-swap-dur", 200);
    const timer = setTimeout(() => {
      if (cancelled) return;
      el.textContent = next;
      el.classList.add("is-enter-start");
      void el.offsetWidth;
      el.classList.remove("is-exit", "is-enter-start");
    }, dur);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      el.classList.remove("is-exit", "is-enter-start");
    };
  }, [expanded]);

  return (
    <SidePanelRow onClick={onToggle} className="text-tertiary">
      <span ref={textRef} className="t-text-swap" />
    </SidePanelRow>
  );
}

/**
 * Renders list children with a trailing "Show more" row when `items.length` exceeds
 * the collapse limit. Extra rows height-tween open/closed via `.t-resize`.
 */
function SidePanelCollapsibleList<T>({
  items,
  renderItem,
  limit = SIDE_PANEL_COLLAPSE_LIMIT,
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = items.length > limit;
  const head = collapsible ? items.slice(0, limit) : items;
  const rest = collapsible ? items.slice(limit) : [];

  return (
    <>
      {head.map((item, index) => renderItem(item, index))}
      {collapsible ? (
        <>
          <SidePanelHeightReveal open={expanded}>
            {rest.map((item, index) => renderItem(item, limit + index))}
          </SidePanelHeightReveal>
          <SidePanelShowMoreRow expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        </>
      ) : null}
    </>
  );
}

export { SidePanelCollapsibleList, SidePanelHeightReveal, SidePanelShowMoreRow };
