import * as React from "react";

import { inputFieldClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Multi-line field — same chrome and active-blue focus as {@link Input}.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputFieldClassName, "resize-y", className)}
      {...props}
    />
  );
}

export { Textarea };
