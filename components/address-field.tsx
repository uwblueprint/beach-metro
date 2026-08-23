"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export interface AddressSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

/**
 * Address field with Places Autocomplete. Picking a suggestion captures its
 * placeId so the API resolves exactly — no re-guessing from free text. Typing
 * again clears the placeId (caller responsibility via onChange) and falls back
 * to text resolution.
 */
export function AddressField(props: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  onPick: (placeId: string, text: string) => void;
  id?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const sessionRef = useRef<string>("");
  const justPickedRef = useRef(false);

  const { value } = props;
  const visible = value.trim().length >= 3 ? suggestions : [];

  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    if (value.trim().length < 3) return;
    if (!sessionRef.current) sessionRef.current = crypto.randomUUID();

    const timer = setTimeout(async () => {
      try {
        const results = await api.get<AddressSuggestion[]>("/api/addresses/autocomplete", {
          q: value,
          session: sessionRef.current,
        });
        setSuggestions(results);
        setHighlight(0);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

  function pick(s: AddressSuggestion) {
    justPickedRef.current = true;
    const text = [s.primaryText, s.secondaryText].filter(Boolean).join(", ");
    props.onPick(s.placeId, text);
    sessionRef.current = "";
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className={cn("relative", props.className)}>
      {props.label ? (
        <Label htmlFor={props.id} className="text-xs">
          {props.label}
        </Label>
      ) : null}
      <Input
        id={props.id}
        className="h-8 text-sm"
        placeholder={props.placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => props.onChange(e.target.value)}
        onFocus={() => setOpen(visible.length > 0)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || visible.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % visible.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + visible.length) % visible.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(visible[highlight]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && visible.length > 0 ? (
        <ul className="bg-bg absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border shadow-md">
          {visible.map((s, i) => (
            <li key={s.placeId}>
              <button
                type="button"
                className={cn(
                  "block w-full px-2 py-1.5 text-left text-sm",
                  i === highlight ? "bg-muted" : "hover:bg-muted/50",
                )}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(s)}
              >
                <span className="block">{s.primaryText}</span>
                <span className="text-muted-foreground block text-xs">{s.secondaryText}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
