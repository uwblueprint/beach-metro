import { cn } from "@/lib/utils";

/**
 * Read-only labeled value for side panels.
 * Label is muted; value is body primary. Horizontal inset comes from the panel
 * content pad (24px) — do not add extra left padding here.
 */
function Attribute({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-[4px] pb-2 pt-1", className)}>
      <span className="text-md text-secondary">{label}</span>
      <span className="text-md text-primary">{value}</span>
    </div>
  );
}

export { Attribute };
