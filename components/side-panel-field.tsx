import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Editable labeled control for side panels.
 * Label matches body weight; 8px gap to the control. Text starts at the panel
 * content inset (24px).
 */
function SidePanelField({
  label,
  htmlFor,
  labelSuffix,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  labelSuffix?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-md font-normal text-primary">
        {label}
        {labelSuffix ? <span className="text-secondary"> {labelSuffix}</span> : null}
      </label>
      {children}
    </div>
  );
}

export { SidePanelField };
