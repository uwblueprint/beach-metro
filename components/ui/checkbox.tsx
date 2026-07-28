"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/lib/utils";

/** Figma check glyph (12×12) — stroke matches text/secondary. */
function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M10 3L4.5 8.5L2 6"
        stroke="currentColor"
        strokeWidth="0.665"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const checkboxSurfaceClassName = [
  "flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border bg-bg",
  "transition-colors outline-none",
].join(" ");

/**
 * Non-interactive checkbox graphic — Figma Checkbox (Checked=True / False).
 * Use inside list/menu rows where the parent handles selection.
 */
function CheckboxIcon({ checked = false, className }: { checked?: boolean; className?: string }) {
  return (
    <span
      data-slot="checkbox-icon"
      data-checked={checked || undefined}
      className={cn(
        checkboxSurfaceClassName,
        checked ? "border-secondary text-secondary" : "border-border text-transparent",
        className,
      )}
      aria-hidden
    >
      {checked ? <CheckGlyph className="size-3" /> : null}
    </span>
  );
}

/**
 * Interactive checkbox — Figma Design System Checkbox (16px, 4px radius).
 * Unchecked: border/divider. Checked: border text/secondary + check.
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        checkboxSurfaceClassName,
        "border-border text-secondary",
        "focus-visible:border-active focus-visible:ring-3 focus-visible:ring-active/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-checked:border-secondary",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current"
      >
        <CheckGlyph className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox, CheckboxIcon };
