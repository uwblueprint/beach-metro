import { cn } from "@/lib/utils";

/** 36px — shared fixed height for SearchBar and toolbar icon buttons. */
export const toolbarControlHeightClass = "h-9";

/** Circular toolbar icon button — fill hover; focus ring only when selected. */
export const toolbarIconButtonClass = cn(
  "rounded-full border border-border bg-bg text-primary transition-colors",
  "hover:bg-tag-hover",
  "focus-visible:border-border focus-visible:ring-0",
  "disabled:pointer-events-none disabled:opacity-50",
);

/** Selected / pressed toolbar icon (e.g. filters open) — ring on focus. */
export const toolbarIconButtonSelectedClass = cn(
  "border-active-border bg-tag-active text-active",
  "hover:bg-tag-active-hover",
  "focus-visible:border-active focus-visible:ring-3 focus-visible:ring-active/40",
);

/** SearchBar shell — same border/focus treatment, no hover ring on the container. */
export const toolbarSearchBarShellClass = cn(
  "rounded-full border border-border bg-bg transition-colors",
  "focus-within:border-active focus-within:ring-3 focus-within:ring-active/40",
);
