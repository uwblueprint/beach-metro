"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function parseISODate(iso: string): Date | null {
  if (!iso) return null;

  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMonthYearLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(date: Date, month: Date): boolean {
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

type CalendarDay = {
  date: Date;
  outside: boolean;
};

function getCalendarDays(viewMonth: Date): CalendarDay[] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const days: CalendarDay[] = [];

  for (let index = startOffset - 1; index >= 0; index -= 1) {
    days.push({ date: new Date(year, month, -index), outside: true });
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({ date: new Date(year, month, day), outside: false });
  }

  while (days.length % 7 !== 0) {
    const lastDate = days[days.length - 1].date;
    const nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1);
    days.push({ date: nextDate, outside: !isSameMonth(nextDate, viewMonth) });
  }

  return days;
}

function DatePickerCalendar({
  selected,
  onSelect,
  viewMonth,
  onViewMonthChange,
}: {
  selected: string;
  onSelect: (iso: string) => void;
  viewMonth: Date;
  onViewMonthChange: (date: Date) => void;
}) {
  const today = React.useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const selectedDate = selected ? parseISODate(selected) : null;
  const days = getCalendarDays(viewMonth);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() =>
            onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
          }
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <span className="text-sm font-medium text-primary">{getMonthYearLabel(viewMonth)}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
          }
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="flex size-8 items-center justify-center text-xs text-muted-foreground"
          >
            {label}
          </div>
        ))}

        {days.map(({ date, outside }) => {
          const iso = formatISODate(date);
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isToday = isSameDay(date, today);

          return (
            <button
              key={iso}
              type="button"
              aria-label={iso}
              aria-pressed={isSelected}
              onClick={() => onSelect(iso)}
              className={cn(
                "flex size-8 items-center justify-center rounded-md text-sm transition-colors",
                !isSelected && "hover:bg-muted",
                isToday && !isSelected && "font-medium",
                isSelected && "bg-active text-white",
                outside && !isSelected && "text-muted-foreground opacity-40",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [viewMonth, setViewMonth] = React.useState(() => parseISODate(value) ?? new Date());

  // Reset the visible month when the popover opens, in the open handler rather
  // than an effect: setState inside an effect is a lint error, and doing it here
  // also avoids yanking the calendar to a new month if `value` changes while the
  // user is still browsing.
  function handleOpenChange(next: boolean) {
    if (next) setViewMonth(parseISODate(value) ?? new Date());
    setOpen(next);
  }

  function handleSelect(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className={cn(
              "flex h-8 w-full min-w-0 items-center rounded-md border border-border bg-bg px-2.5 text-left text-sm transition-colors",
              value ? "text-primary" : "text-muted-foreground",
              "data-popup-open:border-ring",
            )}
          >
            {value ? formatDisplayDate(value) : label}
          </button>
        }
      />
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-auto min-w-[280px] gap-0 rounded-xl border border-border bg-bg p-3 shadow-sm ring-0"
      >
        <DatePickerCalendar
          selected={value}
          onSelect={handleSelect}
          viewMonth={viewMonth}
          onViewMonthChange={setViewMonth}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
