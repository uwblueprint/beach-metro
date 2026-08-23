"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { inputFieldClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown when no option matches the current value. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * Controlled select-style dropdown backed by DropdownMenu primitives.
 * Selecting an option closes the menu automatically.
 */
function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <div className="relative w-full">
        <DropdownMenuTrigger
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            inputFieldClassName,
            "flex w-full items-center pr-8 text-left",
            !selected && "text-secondary",
            className,
          )}
        >
          <span className="flex-1 truncate">{selected?.label ?? placeholder}</span>
        </DropdownMenuTrigger>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-primary"
        />
      </div>
      <DropdownMenuContent align="start" className="min-w-(--anchor-width)">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => {
            onChange(v);
            setOpen(false);
          }}
        >
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { Select };
