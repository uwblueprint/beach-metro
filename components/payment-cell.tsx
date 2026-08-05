"use client";

import * as React from "react";
import { Check, ArrowLeftRight, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

import type {
  CaptainName,
  CellOverride,
  PaymentDetail,
  SubstituteCaptainAssignment,
  SubstituteCaptainName,
} from "@/app/(dashboard)/finances/data";
import { formatCurrency, SUBSTITUTE_CAPTAINS } from "@/app/(dashboard)/finances/data";

const HOVER_OPEN_DELAY_MS = 400;

type PaymentCellProps = {
  value: number;
  paid: boolean;
  onMarkPaid: () => void;
  substituteCaptain: SubstituteCaptainAssignment;
  onSubstituteChange: (captain: SubstituteCaptainName) => void;
  columnCaptain: CaptainName;
  paymentDetail?: PaymentDetail;
  overridden?: boolean;
  override?: CellOverride;
  flashTrigger?: number;
  isEditing?: boolean;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  onEditSubmit?: () => void;
  onEditCancel?: () => void;
  onDoubleClick?: () => void;
  comment?: string;
  onCommentChange?: (comment: string) => void;
  readOnly?: boolean;
  isLocked?: boolean;
  className?: string;
};

function PaymentAmountPopover({
  value,
  paid,
  overridden,
  override,
  paymentDetail,
  substituteCaptain,
  comment,
  onDoubleClick,
}: {
  value: number;
  paid: boolean;
  overridden?: boolean;
  override?: CellOverride;
  paymentDetail: PaymentDetail;
  substituteCaptain: SubstituteCaptainAssignment;
  comment?: string;
  onDoubleClick?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimeout = React.useCallback(() => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
  }, []);

  const handleAmountMouseEnter = React.useCallback(() => {
    clearOpenTimeout();
    openTimeoutRef.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS);
  }, [clearOpenTimeout]);

  const handleAmountMouseLeave = React.useCallback(() => {
    clearOpenTimeout();
    setOpen(false);
  }, [clearOpenTimeout]);

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      clearOpenTimeout();
      setOpen(false);
      onDoubleClick?.();
    },
    [clearOpenTimeout, onDoubleClick],
  );

  React.useEffect(() => {
    return () => {
      clearOpenTimeout();
    };
  }, [clearOpenTimeout]);

  const bundleLabel = `${paymentDetail.bundleCount} ${paymentDetail.bundleCount === 1 ? "bundle" : "bundles"}`;
  const calculatedValue = override?.originalValue ?? value;
  const hasSubstitute = substituteCaptain !== "None";
  const hasComment = Boolean(comment?.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <span
            className={cn(
              "block min-w-0 cursor-pointer truncate text-md leading-[1.3] tabular-nums",
              paid ? "text-muted-foreground opacity-40" : "text-primary",
            )}
            onMouseEnter={handleAmountMouseEnter}
            onMouseLeave={handleAmountMouseLeave}
            onClick={(event) => event.preventDefault()}
            onDoubleClick={handleDoubleClick}
          >
            ${value.toFixed(2)}
            {overridden && <span aria-hidden>*</span>}
          </span>
        }
      />
      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        collisionAvoidance={{
          side: "flip",
          align: "shift",
          fallbackAxisSide: "end",
        }}
        className="box-border w-auto min-w-[280px] max-w-[min(100vw-2rem,420px)] gap-0 overflow-visible rounded-lg border-[0.5px] border-solid border-[#e8eaef] bg-bg p-3 text-md shadow-[0px_1px_2.5px_rgba(0,0,0,0.1)] ring-0"
        onMouseEnter={handleAmountMouseEnter}
        onMouseLeave={handleAmountMouseLeave}
      >
        <div
          className={cn(
            "flex w-max min-w-[280px] max-w-full flex-col whitespace-normal",
            override ? "gap-3" : "gap-2",
          )}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <p className="shrink-0 text-md font-semibold text-primary">
                {hasSubstitute ? substituteCaptain : paymentDetail.captainName}
              </p>
              {hasSubstitute && <ArrowLeftRight className="size-3 shrink-0 text-secondary" />}
            </div>
            <p className="whitespace-nowrap text-md text-secondary">
              {paymentDetail.issueLabel} • Last Modified {paymentDetail.lastModified}
            </p>
          </div>

          <div className="border-t-[0.5px] border-[#e8eaef]" />

          <div className="flex w-full flex-col gap-1">
            {override && <p className="text-md text-secondary">Routes</p>}
            <div className="flex items-center justify-between gap-3">
              <span className="text-md text-primary">{paymentDetail.territory}</span>
              <span className="text-md text-secondary">{bundleLabel}</span>
            </div>
          </div>

          <div className="border-t-[0.5px] border-[#e8eaef]" />

          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-md text-secondary">
              {bundleLabel} × {formatCurrency(paymentDetail.ratePerBundle)}
            </span>
            <span className="text-md tabular-nums text-primary">
              {formatCurrency(calculatedValue)}
            </span>
          </div>

          {hasComment && !override && (
            <div className="flex w-full flex-col gap-1 rounded-lg bg-bg-secondary p-2">
              <p className="text-md text-primary">Note</p>
              <p className="text-md text-primary">{comment}</p>
            </div>
          )}

          {override && (
            <div className="flex w-full flex-col gap-2 rounded-lg bg-tag-warning p-2">
              <div className="flex flex-col gap-1">
                <p className="text-md text-[#92610a]">Manually overridden</p>
                <p className="text-md text-primary">
                  {formatCurrency(override.originalValue)} → {formatCurrency(value)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-md text-[#92610a]">Note</p>
                <p className="text-md text-primary">{override.note}</p>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type CellMenuView = "actions" | "substitute" | "comment";

const cellMenuItemClassName =
  "flex w-full rounded-md px-3 py-1.5 text-left text-sm text-primary hover:bg-tag-hover active:bg-secondary-fill-hover";

function SubstituteCaptainPicker({
  selectedCaptain,
  onSelect,
}: {
  selectedCaptain: SubstituteCaptainName;
  onSelect: (captain: SubstituteCaptainName) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-md font-semibold text-muted-foreground">Assign substitute captain</p>
      <div className="flex flex-col">
        {SUBSTITUTE_CAPTAINS.map((captain) => {
          const isSelected = captain === selectedCaptain;

          return (
            <button
              key={captain}
              type="button"
              onClick={() => onSelect(captain)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-md text-primary transition-colors hover:bg-[#F3F4F6]",
                isSelected && "font-medium",
              )}
            >
              <span>{captain}</span>
              {isSelected && <Check className="size-4 shrink-0" strokeWidth={2} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CellActionsMenu({
  substituteCaptain,
  columnCaptain,
  onSubstituteChange,
  comment,
  onCommentChange,
}: {
  substituteCaptain: SubstituteCaptainAssignment;
  columnCaptain: CaptainName;
  onSubstituteChange: (captain: SubstituteCaptainName) => void;
  comment?: string;
  onCommentChange?: (comment: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [menuView, setMenuView] = React.useState<CellMenuView>("actions");
  const [commentText, setCommentText] = React.useState("");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setMenuView("actions");
      setCommentText("");
    }
  }

  function openCommentView() {
    setCommentText(comment ?? "");
    setMenuView("comment");
  }

  function handleSaveComment() {
    onCommentChange?.(commentText);
    handleOpenChange(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Cell actions"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,background-color,color] duration-300 ease-out",
              "pointer-events-none group-hover/cell:pointer-events-auto group-hover/cell:bg-muted group-hover/cell:text-primary group-hover/cell:opacity-100",
              "data-popup-open:pointer-events-auto data-popup-open:bg-muted data-popup-open:text-primary data-popup-open:opacity-100 data-popup-open:hover:bg-muted data-popup-open:hover:text-primary",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </button>
        }
      />
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={4}
        className={cn(
          "min-w-0 shadow-md ring-1 ring-foreground/10",
          menuView === "substitute"
            ? "w-[312px] rounded-lg p-3"
            : menuView === "comment"
              ? "w-[320px] rounded-xl p-4"
              : "w-auto rounded-xl px-1 py-1",
        )}
      >
        {menuView === "actions" ? (
          <>
            <button
              type="button"
              className={cellMenuItemClassName}
              onClick={() => setMenuView("substitute")}
            >
              Assign substitute captain
            </button>
            <button type="button" className={cellMenuItemClassName} onClick={openCommentView}>
              Add comment
            </button>
          </>
        ) : menuView === "substitute" ? (
          <SubstituteCaptainPicker
            selectedCaptain={substituteCaptain === "None" ? columnCaptain : substituteCaptain}
            onSelect={onSubstituteChange}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-md font-semibold text-primary">Add comment</p>
            <Textarea
              rows={4}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              placeholder="Add a note…"
              className="min-h-0 resize-none border border-border rounded-lg p-3 text-sm outline-none transition-colors focus:border-active focus:ring-1 focus:ring-active focus-visible:border-active focus-visible:ring-1 focus-visible:ring-active"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMenuView("actions")}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleSaveComment}>
                Save
              </Button>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PaymentCell({
  value,
  paid,
  onMarkPaid,
  substituteCaptain,
  onSubstituteChange,
  columnCaptain,
  paymentDetail,
  overridden = false,
  override,
  flashTrigger = 0,
  isEditing = false,
  editValue = "",
  onEditValueChange,
  onEditSubmit,
  onEditCancel,
  onDoubleClick,
  comment,
  onCommentChange,
  readOnly = false,
  isLocked = false,
  className,
}: PaymentCellProps) {
  const hasSubstitute = substituteCaptain !== "None";
  const hasComment = Boolean(comment?.trim());
  const nonInteractive = readOnly || isLocked;

  const skipBlurSubmitRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const blurArmedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isEditing) {
      blurArmedRef.current = false;
      return;
    }

    blurArmedRef.current = false;
    const input = inputRef.current;
    input?.focus();
    input?.select();

    const armTimer = window.setTimeout(() => {
      blurArmedRef.current = true;
    }, 50);

    return () => window.clearTimeout(armTimer);
  }, [isEditing]);

  if (isEditing) {
    return (
      <div
        className={cn(
          "relative z-10 flex h-12 w-full min-w-0 items-center bg-bg px-3 outline outline-2 outline-active -outline-offset-2",
          className,
        )}
      >
        <span className="shrink-0 text-md tabular-nums text-primary">$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={editValue}
          onChange={(e) => onEditValueChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              skipBlurSubmitRef.current = true;
              onEditSubmit?.();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              skipBlurSubmitRef.current = true;
              onEditCancel?.();
            }
          }}
          onBlur={() => {
            if (skipBlurSubmitRef.current) {
              skipBlurSubmitRef.current = false;
              return;
            }
            if (!blurArmedRef.current) return;
            onEditSubmit?.();
          }}
          aria-label="Edit payment amount"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-md tabular-nums text-primary outline-none"
        />
      </div>
    );
  }

  return (
    <div
      key={flashTrigger > 0 ? `flash-${flashTrigger}` : "cell"}
      className={cn(
        "group/cell relative flex h-12 max-h-12 w-full min-w-0 items-center gap-1 overflow-hidden px-3 transition-colors",
        isLocked && "cursor-not-allowed",
        !nonInteractive && "hover:bg-bg-secondary",
        flashTrigger > 0 && "payment-cell-flash",
        className,
      )}
      onDoubleClick={nonInteractive ? undefined : onDoubleClick}
    >
      {hasComment && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 size-[16px] bg-[#7DD3FC]"
          style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center overflow-visible leading-[1.3]">
        {paymentDetail && !nonInteractive ? (
          <PaymentAmountPopover
            value={value}
            paid={paid}
            overridden={overridden}
            override={override}
            paymentDetail={paymentDetail}
            substituteCaptain={substituteCaptain}
            comment={comment}
            onDoubleClick={onDoubleClick}
          />
        ) : (
          <span
            className={cn(
              "block min-w-0 truncate text-md tabular-nums",
              paid ? "text-muted-foreground opacity-40" : "text-primary",
            )}
          >
            ${value.toFixed(2)}
            {overridden && <span aria-hidden>*</span>}
          </span>
        )}
        {hasSubstitute && (
          <span
            className={cn(
              "block whitespace-nowrap text-md text-secondary",
              // Idle: use the reserved actions width so the full name can show.
              // Hover: shrink back and ellipsize so it doesn't collide with controls.
              !nonInteractive &&
                (paid
                  ? "w-[calc(100%+2rem)] group-hover/cell:w-full group-hover/cell:truncate"
                  : "w-[calc(100%+3.25rem)] group-hover/cell:w-full group-hover/cell:truncate"),
              nonInteractive && "truncate",
              paid && "opacity-40",
            )}
          >
            {substituteCaptain} (sub)
          </span>
        )}
      </div>

      {nonInteractive ? (
        paid ? (
          <Check aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={0.5} />
        ) : null
      ) : (
        <div
          className={cn(
            "relative z-10 flex w-12 shrink-0 items-center gap-1 group-hover/cell:bg-bg-secondary",
            paid && "flex-row-reverse",
          )}
        >
          <div className="relative flex size-4 shrink-0 items-center justify-center">
            <button
              type="button"
              aria-label="Mark paid"
              disabled={paid}
              onClick={onMarkPaid}
              className={cn(
                "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 ease-out",
                "pointer-events-none group-hover/cell:pointer-events-auto",
                !paid && "group-hover/cell:opacity-100",
                paid && "pointer-events-none",
              )}
            >
              <span aria-hidden className="block size-4 rounded-[4px] border border-border bg-bg" />
            </button>

            <Check
              aria-hidden={!paid}
              className={cn(
                "pointer-events-none size-4 text-muted-foreground transition-all duration-300 ease-out",
                paid ? "opacity-100 scale-100" : "opacity-0 scale-75",
              )}
              strokeWidth={0.5}
            />
          </div>

          <CellActionsMenu
            substituteCaptain={substituteCaptain}
            columnCaptain={columnCaptain}
            onSubstituteChange={onSubstituteChange}
            comment={comment}
            onCommentChange={onCommentChange}
          />
        </div>
      )}
    </div>
  );
}
