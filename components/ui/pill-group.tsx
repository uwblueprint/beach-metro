"use client";

import { cn } from "@/lib/utils";
import { Pill, type PillVariant } from "./pill";

interface PillOption {
  value: string;
  label: string;
  variant?: PillVariant;
}

type PillGroupProps =
  | {
      exclusive: true;
      options: PillOption[];
      value: string | null;
      onChange: (value: string | null) => void;
      className?: string;
    }
  | {
      exclusive?: false;
      options: PillOption[];
      value: string[];
      onChange: (value: string[]) => void;
      className?: string;
    };

export function PillGroup(props: PillGroupProps) {
  const { options, className } = props;

  function handleClick(optionValue: string) {
    if (props.exclusive) {
      props.onChange(props.value === optionValue ? null : optionValue);
    } else {
      const current = props.value;
      props.onChange(
        current.includes(optionValue)
          ? current.filter((v) => v !== optionValue)
          : [...current, optionValue],
      );
    }
  }

  function isSelected(optionValue: string) {
    if (props.exclusive) return props.value === optionValue;
    return props.value.includes(optionValue);
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => (
        <Pill
          key={option.value}
          variant={option.variant ?? "default"}
          selected={isSelected(option.value)}
          onClick={() => handleClick(option.value)}
        >
          {option.label}
        </Pill>
      ))}
    </div>
  );
}
