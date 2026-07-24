import { cn } from "@/lib/utils";

const pillVariantClasses = {
  default: "bg-tag border-hairline text-primary hover:bg-tag-hover",
  active: "bg-tag-active border-active-border text-active hover:bg-tag-active-hover",
  success: "bg-tag-success border-success-border text-success",
  warning: "bg-tag-warning border-warning-border text-warning",
  danger: "bg-tag-destructive border-destructive-border text-destructive",
  disabled: "bg-tag border-hairline text-disabled pointer-events-none",
} as const;

export type PillVariant = keyof typeof pillVariantClasses;

interface PillProps {
  variant?: PillVariant;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function Pill({
  variant = "default",
  selected = false,
  disabled = false,
  onClick,
  className,
  children,
}: PillProps) {
  const resolvedVariant: PillVariant = disabled ? "disabled" : selected ? "active" : variant;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-full border px-4 py-[7px] text-md font-normal whitespace-nowrap transition-colors select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        !onClick && "pointer-events-none",
        pillVariantClasses[resolvedVariant],
        className,
      )}
    >
      {children}
    </button>
  );
}
