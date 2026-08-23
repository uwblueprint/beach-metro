import * as React from "react";

import { inputFieldClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Multi-line field — same chrome and active-blue focus as {@link Input}.
 * Keeps its own `min-h-24`: callers that pass neither `rows` nor a height
 * (e.g. the Finances override note) rely on it for a usable default size.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputFieldClassName, "min-h-24 resize-y", className)}
      {...props}
    />
  );
}

export { Textarea };
