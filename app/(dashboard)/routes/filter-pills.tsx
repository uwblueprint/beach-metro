"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

export function readCssDurationMsFrom(el: Element, variable: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(variable).trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw) || fallback;
}

export function ActiveFilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Pill
      selected
      onClick={onClear}
      className="group/filter-pill relative w-max shrink-0 overflow-hidden hover:bg-tag-active active:scale-[0.96]"
    >
      <span className="relative z-0">{label}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[80%] bg-gradient-to-l from-tag-active from-50% to-transparent opacity-0 transition-opacity duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover/filter-pill:opacity-100"
      />
      <X
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2 z-[2] size-3 origin-center -translate-y-1/2 scale-[0.25] text-active opacity-0 blur-[4px] transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover/filter-pill:scale-100 group-hover/filter-pill:opacity-100 group-hover/filter-pill:blur-none"
      />
    </Pill>
  );
}

/** Width-tweened slot so the search bar (or pill row) can flex as pills enter and leave. */
export function FilterPillSlot({
  open,
  label,
  onClear,
}: {
  open: boolean;
  label: string;
  onClear: () => void;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(open);
  const [width, setWidth] = useState(0);

  if (open && !mounted) {
    setMounted(true);
  }
  if (!open && width !== 0) {
    setWidth(0);
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
    let nested = 0;
    const outer = requestAnimationFrame(() => {
      nested = requestAnimationFrame(() => {
        setWidth(node.scrollWidth);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(nested);
    };
  }, [open, mounted, label]);

  if (!mounted) return null;

  return (
    <div className="t-resize shrink-0 overflow-hidden" style={{ width }}>
      <div
        ref={innerRef}
        className={cn(
          "flex w-max shrink-0 pl-2.5 whitespace-nowrap transition-opacity duration-[var(--resize-dur)] ease-[var(--resize-ease)]",
          open ? "opacity-100" : "opacity-0",
        )}
      >
        <ActiveFilterPill label={label} onClear={onClear} />
      </div>
    </div>
  );
}
