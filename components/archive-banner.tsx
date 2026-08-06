"use client";

import { Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

type ArchiveBannerProps = {
  dateRange: string;
  onDismiss: () => void;
  className?: string;
};

export function ArchiveBanner({ dateRange, onDismiss, className }: ArchiveBannerProps) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center justify-between rounded-lg bg-tag px-4 py-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Info className="size-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Viewing {dateRange} (archived) • Read-only</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss archive banner"
        onClick={onDismiss}
        className="shrink-0 text-muted-foreground hover:text-primary"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
