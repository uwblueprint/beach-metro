import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

/**
 * Text input — Figma Design System `Input` (state=Default, type=text).
 * Tokens: bg/primary, border/hairline, body/md, text/primary + text/secondary placeholder.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-auto w-full min-w-0 rounded-[8px] border border-hairline bg-bg px-3 py-2 text-md text-primary transition-colors outline-none",
        "placeholder:text-secondary",
        "focus-visible:border-active focus-visible:ring-3 focus-visible:ring-active/40",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:text-disabled disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-md file:font-medium file:text-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
