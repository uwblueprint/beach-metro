"use client";

import { Search } from "lucide-react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function SearchBar({
  value,
  onChange,
  placeholder = "Search",
  className,
  disabled = false,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "@container flex w-full items-center gap-3 rounded-full border border-border px-3 py-2 transition-colors",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50", // TODO: define the focus ring style more deliberately.
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <Search className="size-3 shrink-0 text-secondary" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-md text-primary outline-none placeholder:text-transparent @[10rem]:placeholder:text-secondary"
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
            inputRef.current?.focus();
          }}
          className="shrink-0 cursor-pointer text-md text-secondary transition-colors hover:text-primary"
        >
          clear
        </button>
      )}
    </div>
  );
}

export { SearchBar };
export type { SearchBarProps };
