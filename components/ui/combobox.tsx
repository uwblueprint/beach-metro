"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { inputFieldClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional trailing badge text (e.g. territory name). */
  badge?: string | null;
  disabled?: boolean;
}

interface ComboboxProps {
  id?: string;
  value: string | null;
  /** Selected option label shown when the menu is closed and query is idle. */
  displayValue?: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (option: ComboboxOption) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Extra row(s) pinned at the bottom of the open menu (e.g. Create new…). */
  footer?: ReactNode;
  emptyMessage?: string;
  "aria-labelledby"?: string;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

/**
 * Typable filter field with an Input-styled shell and a dropdown list.
 * Menu is portaled to `document.body` so it is not clipped by modal overflow.
 */
function Combobox({
  id,
  value,
  displayValue,
  query,
  onQueryChange,
  onSelect,
  options,
  placeholder = "Input text",
  disabled = false,
  className,
  footer,
  emptyMessage = "No matches",
  "aria-labelledby": ariaLabelledBy,
}: ComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const optionId = (index: number) => `${listId}-option-${index}`;
  // Options can shrink as the query narrows, so never trust the stored index.
  const active = Math.min(activeIndex, Math.max(0, options.length - 1));

  /** Next selectable option in `step` direction, wrapping, skipping disabled. */
  function moveActive(step: number) {
    if (options.length === 0) return;
    let next = active;
    for (let i = 0; i < options.length; i++) {
      next = (next + step + options.length) % options.length;
      if (!options[next]?.disabled) break;
    }
    setActiveIndex(next);
  }

  /** Open (or re-open) the menu with the highlight back at the top. */
  function openMenu() {
    setOpen(true);
    setActiveIndex(0);
  }

  // Keep the active option visible when arrowing past the scroll edge.
  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const showQuery = open || query.length > 0;
  const fieldText = showQuery ? query : (displayValue ?? "");

  const menu =
    open && position ? (
      <ul
        ref={menuRef}
        id={listId}
        role="listbox"
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          width: position.width,
        }}
        className={cn(
          // Above dialog overlay/content (z-50); ~200px content cap.
          "z-[60] max-h-[200px] overflow-y-auto rounded-[8px] bg-bg p-1",
          "shadow-[0px_4px_8px_rgba(0,0,0,0.25)] outline-none",
        )}
      >
        {options.length === 0 && !footer ? (
          <li className="px-2 py-2 text-sm text-secondary">{emptyMessage}</li>
        ) : null}
        {options.map((option, index) => {
          const selected = option.value === value;
          const isActive = index === active;
          return (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={selected}
              className={cn("rounded-[4px]", isActive && "bg-tag-hover")}
            >
              <button
                type="button"
                tabIndex={-1}
                disabled={option.disabled}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-[4px] p-2 text-left text-sm text-primary outline-none transition-colors",
                  "hover:bg-tag-hover",
                  selected && "bg-active-grey hover:bg-active-grey",
                  option.disabled && "pointer-events-none text-disabled",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.badge ? (
                  <span className="inline-flex shrink-0 items-center rounded-lg bg-secondary-fill px-2 py-0.5 text-xs text-secondary">
                    {option.badge}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
        {footer ? (
          <li className="mt-0.5 border-t border-hairline pt-0.5" onClick={() => setOpen(false)}>
            {footer}
          </li>
        ) : null}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options.length > 0 ? optionId(active) : undefined}
          aria-labelledby={ariaLabelledBy}
          disabled={disabled}
          placeholder={placeholder}
          value={fieldText}
          autoComplete="off"
          className={cn(inputFieldClassName, "pr-8")}
          onChange={(e) => {
            // A new query is a new list, so the highlight goes back to the top.
            onQueryChange(e.target.value);
            openMenu();
          }}
          onFocus={openMenu}
          onClick={openMenu}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) openMenu();
              else moveActive(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) openMenu();
              else moveActive(-1);
            } else if (e.key === "Enter") {
              if (!open) return;
              const option = options[active];
              if (!option || option.disabled) return;
              e.preventDefault();
              onSelect(option);
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-primary"
          aria-hidden
        />
      </div>

      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

export { Combobox };
