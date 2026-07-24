"use client"

import * as React from "react"
import { Check, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

type PaymentCellProps = {
  value: number
  paid: boolean
  onMarkPaid: () => void
  overridden?: boolean
  flashTrigger?: number
  isEditing?: boolean
  editValue?: string
  onEditValueChange?: (value: string) => void
  onEditSubmit?: () => void
  onEditCancel?: () => void
  onDoubleClick?: () => void
  className?: string
}

export function PaymentCell({
  value,
  paid,
  onMarkPaid,
  overridden = false,
  flashTrigger = 0,
  isEditing = false,
  editValue = "",
  onEditValueChange,
  onEditSubmit,
  onEditCancel,
  onDoubleClick,
  className,
}: PaymentCellProps) {
  if (isEditing) {
    return (
      <div className={cn("px-3 py-3", className)}>
        <input
          type="text"
          value={editValue}
          onChange={(e) => onEditValueChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditSubmit?.()
            if (e.key === "Escape") onEditCancel?.()
          }}
          onBlur={onEditCancel}
          autoFocus
          className="h-7 w-full min-w-0 rounded-md border border-border bg-bg px-2 text-md outline-none focus:border-active"
        />
      </div>
    )
  }

  return (
    <div
      key={flashTrigger > 0 ? `flash-${flashTrigger}` : "cell"}
      className={cn(
        "group/cell relative flex h-12 w-full min-w-0 items-center gap-1 px-3 transition-colors hover:bg-bg-secondary",
        flashTrigger > 0 && "payment-cell-flash",
        className,
      )}
      onDoubleClick={onDoubleClick}
    >
      {/* Dollar value — left-aligned */}
      <span
        className={cn(
          "min-w-0 shrink-0 text-md tabular-nums",
          paid ? "text-muted-foreground opacity-40" : "text-primary",
        )}
      >
        ${value.toFixed(2)}
        {overridden && <span aria-hidden>*</span>}
      </span>

      {/* Spacer */}
      <span aria-hidden className="min-w-0 flex-1" />

      {/* Fixed-width control strip — always 48px (16 + 4 gap + 28) */}
      <div
        className={cn(
          "flex w-12 shrink-0 items-center gap-1",
          paid && "flex-row-reverse",
        )}
      >
        {/* Checkbox / checkmark slot — always 16×16 */}
        <div className="relative flex size-4 shrink-0 items-center justify-center">
          <button
            type="button"
            aria-label="Mark paid"
            disabled={paid}
            onClick={onMarkPaid}
            className={cn(
              "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150",
              "pointer-events-none group-hover/cell:pointer-events-auto",
              !paid && "group-hover/cell:opacity-100",
              paid && "pointer-events-none",
            )}
          >
            <span
              aria-hidden
              className="block size-4 rounded-[4px] border border-border bg-bg"
            />
          </button>

          <Check
            aria-hidden={!paid}
            className={cn(
              "pointer-events-none size-4 text-muted-foreground transition-opacity duration-150",
              paid ? "opacity-100" : "opacity-0",
            )}
            strokeWidth={0.5}
          />
        </div>

        {/* Overflow slot — always 28×28; sits left of checkmark when paid */}
        <button
          type="button"
          aria-label="Cell actions"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity duration-150",
            "pointer-events-none group-hover/cell:pointer-events-auto group-hover/cell:opacity-100",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
