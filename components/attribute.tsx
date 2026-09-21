"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SidePanelRow } from "@/components/side-panel-row";
import { cn } from "@/lib/utils";

/**
 * Read-only labeled value for side panels.
 * Renders as a static row so spacing matches list sections (header gap + row rhythm).
 * Pass `copyable` for email/phone: hover reveals a copy icon, click copies, then
 * the icon swaps to a check via `t-icon-swap`.
 */
function Attribute({
  label,
  value,
  copyable = false,
  className,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setCopied(false), 1500);
  }

  if (!copyable) {
    return (
      <SidePanelRow static className={cn("text-secondary", className)}>
        {/* Labels hidden under a shared "Personal Details" section header. */}
        {value}
      </SidePanelRow>
    );
  }

  return (
    <SidePanelRow
      onClick={() => void handleCopy()}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      className={cn(
        "text-secondary transition-colors duration-150 ease-out hover:text-primary",
        className,
      )}
      trailing={
        <span
          className="t-icon-swap size-6 text-current"
          data-state={copied ? "b" : "a"}
          aria-hidden
        >
          <span className="t-icon flex size-6 items-center justify-center" data-icon="a">
            <Copy className="size-3" strokeWidth={1.75} />
          </span>
          <span className="t-icon flex size-6 items-center justify-center" data-icon="b">
            <Check className="size-3" strokeWidth={1.75} />
          </span>
        </span>
      }
    >
      {value}
    </SidePanelRow>
  );
}

export { Attribute };
