"use client";

import * as React from "react";
import { Check, ArrowLeftRight, MoreHorizontal, Pencil } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type {
  CellOverride,
  PaymentDetail,
  SubstituteCaptainAssignment,
} from "@/app/(dashboard)/finances/data";
import { formatCurrency } from "@/app/(dashboard)/finances/data";

const HOVER_OPEN_DELAY_MS = 200;
const HOVER_CLOSE_DELAY_MS = 150;

function CommentCornerIndicator() {
  return (
    <span
      aria-hidden
      className="absolute top-0 right-0 size-[16px] bg-[#7DD3FC]"
      style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
    />
  );
}

function PopoverComment({
  comment,
  readOnly,
  editing,
  onSave,
  onEditingChange,
}: {
  comment: string;
  readOnly?: boolean;
  editing: boolean;
  onSave?: (comment: string | null) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  // Optimistic cache updates the `comment` prop quickly; keep a short-lived local
  // override so the note stays visible if the parent is a frame behind.
  const [pendingComment, setPendingComment] = React.useState<string | undefined>(undefined);
  const [draft, setDraft] = React.useState(comment);
  const [editSession, setEditSession] = React.useState(false);
  const [actionTaken, setActionTaken] = React.useState(false);

  const displayComment = pendingComment !== undefined ? pendingComment : comment;

  // Prop caught up to what we saved — drop the local override (render-time adjust).
  if (pendingComment !== undefined && pendingComment === comment) {
    setPendingComment(undefined);
  }

  // Entering an edit session (pencil or ⋯ → Add comment) seeds the draft once.
  if (editing && !editSession) {
    setEditSession(true);
    setActionTaken(false);
    setDraft(displayComment);
  } else if (!editing && editSession) {
    setEditSession(false);
  }

  function startEditing() {
    setActionTaken(false);
    setDraft(displayComment);
    onEditingChange(true);
  }

  function commit(raw: string) {
    if (actionTaken) return;
    setActionTaken(true);
    const next = raw.trim() || null;
    setPendingComment(next ?? "");
    onSave?.(next);
    onEditingChange(false);
  }

  function cancel() {
    setActionTaken(true);
    setDraft(displayComment);
    onEditingChange(false);
  }

  const isEmpty = !displayComment.trim();
  const commentRowClassName =
    "relative flex min-h-6 w-full min-w-0 items-center overflow-visible outline-none focus:outline-none focus-visible:outline-none";

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 overflow-visible whitespace-normal rounded-lg bg-bg-tertiary p-2">
      <p className="shrink-0 text-md text-primary">Note</p>
      {editing ? (
        <div className={commentRowClassName}>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter") {
                event.preventDefault();
                commit(event.currentTarget.value);
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
            onBlur={(event) => commit(event.currentTarget.value)}
            onFocus={(event) => event.target.select()}
            aria-label={isEmpty ? "Add comment" : "Edit comment"}
            placeholder="Add a note…"
            className="h-6 min-h-6 w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-md leading-[1.3] text-primary outline-none placeholder:text-muted-foreground"
          />
        </div>
      ) : (
        <div className={cn("group/comment-row gap-1", commentRowClassName)}>
          {!readOnly && isEmpty ? (
            <button
              type="button"
              className="flex h-6 min-w-0 flex-1 cursor-text items-center text-left text-md leading-[1.3] break-words text-muted-foreground outline-none focus:outline-none focus-visible:outline-none"
              onClick={startEditing}
            >
              Add a note…
            </button>
          ) : (
            <p className="flex min-h-6 min-w-0 flex-1 items-center text-md leading-[1.3] break-words text-primary">
              {displayComment}
            </p>
          )}
          {!readOnly && (
            <div className="flex h-6 shrink-0 items-center self-center opacity-0 transition-opacity group-hover/comment-row:opacity-100 group-focus-within/comment-row:opacity-100">
              <button
                type="button"
                aria-label={isEmpty ? "Add comment" : "Edit comment"}
                className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent text-muted-foreground outline-none transition-colors hover:bg-bg-secondary focus:outline-none focus-visible:outline-none [&_svg]:block [&_svg]:fill-none [&_svg]:stroke-current"
                onClick={(event) => {
                  event.stopPropagation();
                  startEditing();
                }}
              >
                <Pencil className="size-3 fill-none" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type PaymentCellProps = {
  value: number;
  paid: boolean;
  onMarkPaid: () => void;
  substituteCaptain: SubstituteCaptainAssignment;
  onSubstituteChange: (captain: string) => void;
  /**
   * Who can be picked as a substitute. Passed in rather than imported, because the
   * real set is every other active captain and changes as people join or retire.
   */
  substituteOptions: readonly string[];
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
  onCommentChange?: (comment: string | null) => void;
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
  onCommentChange,
  readOnly,
  commentEditRequest = 0,
}: {
  value: number;
  paid: boolean;
  overridden?: boolean;
  override?: CellOverride;
  paymentDetail: PaymentDetail;
  substituteCaptain: SubstituteCaptainAssignment;
  comment?: string;
  onCommentChange?: (comment: string | null) => void;
  readOnly?: boolean;
  commentEditRequest?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [editingComment, setEditingComment] = React.useState(false);
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditingCommentRef = React.useRef(false);

  const clearOpenTimeout = React.useCallback(() => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
  }, []);

  const clearCloseTimeout = React.useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleHoverEnter = React.useCallback(() => {
    clearCloseTimeout();
    if (openTimeoutRef.current) return;
    openTimeoutRef.current = setTimeout(() => {
      openTimeoutRef.current = null;
      setOpen(true);
    }, HOVER_OPEN_DELAY_MS);
  }, [clearCloseTimeout]);

  const handleHoverLeave = React.useCallback(() => {
    if (isEditingCommentRef.current) return;
    clearOpenTimeout();
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      setOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearOpenTimeout, clearCloseTimeout]);

  const handleCommentEditingChange = React.useCallback(
    (editing: boolean) => {
      isEditingCommentRef.current = editing;
      setEditingComment(editing);
      if (editing) {
        clearCloseTimeout();
        setOpen(true);
      }
    },
    [clearCloseTimeout],
  );

  React.useEffect(() => {
    if (commentEditRequest > 0) {
      const id = setTimeout(() => handleCommentEditingChange(true), 0);
      return () => clearTimeout(id);
    }
  }, [commentEditRequest, handleCommentEditingChange]);

  React.useEffect(() => {
    return () => {
      clearOpenTimeout();
      clearCloseTimeout();
    };
  }, [clearOpenTimeout, clearCloseTimeout]);

  const bundleLabel = `${paymentDetail.bundleCount} ${paymentDetail.bundleCount === 1 ? "bundle" : "bundles"}`;
  const calculatedValue = override?.originalValue ?? value;
  const hasSubstitute = substituteCaptain !== "None";
  const hasComment = Boolean(comment?.trim());

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isEditingCommentRef.current) return;
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger
        nativeButton={false}
        render={
          <span
            className={cn(
              "inline-flex w-full min-w-0 cursor-default flex-col items-start justify-center text-md tabular-nums outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
              paid ? "text-muted-foreground opacity-40" : "text-primary",
            )}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
            onClick={(event) => event.preventDefault()}
          >
            {hasComment && <CommentCornerIndicator />}
            <span className="max-w-full truncate">
              ${value.toFixed(2)}
              {overridden && <span aria-hidden>*</span>}
            </span>
            {hasSubstitute && (
              <span className="max-w-full truncate text-xs leading-tight text-muted-foreground">
                {substituteCaptain} (sub)
              </span>
            )}
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
        className="box-border w-max min-w-[200px] max-w-[400px] gap-3 overflow-visible rounded-lg bg-bg p-3 text-md smooth-shadow-ring-sm!"
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
      >
        <div className="flex w-full min-w-0 flex-col gap-3 whitespace-nowrap">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <p className="shrink-0 text-md text-primary">
                {hasSubstitute ? substituteCaptain : paymentDetail.captainName}
              </p>
              {hasSubstitute && <ArrowLeftRight className="size-3 shrink-0 text-secondary" />}
            </div>
            <p className="shrink-0 text-md text-secondary">
              {paymentDetail.issueLabel} • Last Modified {paymentDetail.lastModified}
            </p>
          </div>

          <div className="border-t border-border" />

          <div className="flex flex-col gap-1">
            <p className="shrink-0 text-md text-secondary">Routes</p>
            <div className="flex items-center justify-between gap-3">
              <span className="shrink-0 text-md text-primary">{paymentDetail.territory}</span>
              <span className="shrink-0 text-md text-secondary">{bundleLabel}</span>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-md text-secondary">
              {bundleLabel} × {formatCurrency(paymentDetail.ratePerBundle)}
            </span>
            <span className="shrink-0 text-md tabular-nums text-primary">
              {formatCurrency(calculatedValue)}
              {overridden && <span aria-hidden>*</span>}
            </span>
          </div>

          {(hasComment || (onCommentChange && !readOnly && !paid)) && (
            <PopoverComment
              comment={comment ?? ""}
              readOnly={readOnly || paid || !onCommentChange}
              editing={editingComment}
              onSave={onCommentChange}
              onEditingChange={handleCommentEditingChange}
            />
          )}

          {override && (
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="shrink-0 text-md font-medium text-amber-700">Manually overridden</p>
              <p className="mt-0.5 shrink-0 text-md text-primary">
                {formatCurrency(override.originalValue)} → {formatCurrency(value)}
              </p>
              <p className="mt-2 shrink-0 text-md font-medium text-amber-700">Note</p>
              <p className="mt-0.5 shrink-0 text-md text-primary">{override.note}</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type CellMenuView = "actions" | "substitute";

function SubstituteCaptainPicker({
  selectedCaptain,
  onSelect,
  options,
}: {
  selectedCaptain: string;
  onSelect: (captain: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="px-2 text-md text-muted-foreground">Assign substitute captain</p>
      <div className="flex flex-col">
        {options.map((captain) => {
          const isSelected = captain === selectedCaptain;

          return (
            // Must be DropdownMenuItem (Base UI Menu.Item): plain buttons inside the
            // popup get a dismiss on pointerdown, so onClick never fires and the
            // substitute never saves.
            <DropdownMenuItem
              key={captain}
              onClick={() => onSelect(captain)}
              className={cn("justify-between rounded-md px-3 py-2.5", isSelected && "font-medium")}
            >
              <span>{captain}</span>
              {isSelected && <Check className="size-4 shrink-0" strokeWidth={2} />}
            </DropdownMenuItem>
          );
        })}
      </div>
    </div>
  );
}

function CellActionsMenu({
  substituteCaptain,
  onSubstituteChange,
  substituteOptions,
  comment,
  onCommentAction,
}: {
  substituteCaptain: SubstituteCaptainAssignment;
  onSubstituteChange: (captain: string) => void;
  substituteOptions: readonly string[];
  comment?: string;
  onCommentAction?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [menuView, setMenuView] = React.useState<CellMenuView>("actions");
  const hasComment = Boolean(comment?.trim());

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setMenuView("actions");
  }

  function openSubstituteView(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setMenuView("substitute");
    setOpen(true);
  }

  function handleCommentAction(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    handleOpenChange(false);
    onCommentAction?.();
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Cell actions"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,background-color,color] duration-300 ease-out",
              "pointer-events-none group-hover/cell:pointer-events-auto group-hover/cell:bg-muted group-hover/cell:text-primary group-hover/cell:opacity-100",
              "data-popup-open:pointer-events-auto data-popup-open:bg-muted data-popup-open:text-primary data-popup-open:opacity-100 data-popup-open:hover:bg-bg-secondary data-popup-open:hover:text-primary",
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
        className={cn(menuView === "substitute" && "w-[312px] rounded-lg p-3")}
      >
        {menuView === "actions" ? (
          <>
            <DropdownMenuItem
              // Keep menu open so we can swap into the substitute picker view.
              closeOnClick={false}
              onClick={openSubstituteView}
            >
              Assign substitute captain
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCommentAction}>
              {hasComment ? "Edit comment" : "Add comment"}
            </DropdownMenuItem>
          </>
        ) : (
          <SubstituteCaptainPicker
            // Show the real assignment ("None" or the sub). Do NOT remap empty →
            // columnCaptain: that put a check on the cell owner, so clicking the
            // checked row cleared the sub / no-op'd instead of assigning.
            selectedCaptain={substituteCaptain}
            onSelect={(captain) => {
              onSubstituteChange(captain);
              handleOpenChange(false);
            }}
            options={substituteOptions}
          />
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
  substituteOptions,
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
  const [commentEditRequest, setCommentEditRequest] = React.useState(0);
  const skipBlurCancelRef = React.useRef(false);

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
          type="text"
          inputMode="decimal"
          value={editValue}
          onChange={(e) => onEditValueChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // Blur would otherwise cancel before submit finishes mounting the dialog.
              skipBlurCancelRef.current = true;
              onEditSubmit?.();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              skipBlurCancelRef.current = true;
              onEditCancel?.();
            }
          }}
          onBlur={() => {
            if (skipBlurCancelRef.current) {
              skipBlurCancelRef.current = false;
              return;
            }
            // Clicking away should try to save (opens override note dialog if changed).
            onEditSubmit?.();
          }}
          onFocus={(e) => e.target.select()}
          autoFocus
          aria-label="Edit payment amount"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-md tabular-nums text-primary outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/cell relative flex h-12 w-full min-w-0 items-center gap-1 overflow-hidden px-3 outline-none transition-colors focus:outline-none focus-visible:outline-none",
        !readOnly && "hover:bg-bg-secondary",
        flashTrigger > 0 && "payment-cell-flash",
        className,
      )}
      onDoubleClick={nonInteractive ? undefined : onDoubleClick}
    >
      {/* Amount may include a long "(sub)" line — must shrink/truncate so it
          cannot spill into the check column or the next captain cell. */}
      <div className="min-w-0 flex-1 overflow-hidden">
        {paymentDetail ? (
          <PaymentAmountPopover
            value={value}
            paid={paid}
            overridden={overridden}
            override={override}
            paymentDetail={paymentDetail}
            substituteCaptain={substituteCaptain}
            comment={comment}
            onCommentChange={onCommentChange}
            readOnly={readOnly}
            commentEditRequest={commentEditRequest}
          />
        ) : (
          <span
            className={cn(
              "inline-flex w-full min-w-0 flex-col items-start justify-center text-md tabular-nums",
              paid ? "text-muted-foreground opacity-40" : "text-primary",
            )}
          >
            {hasComment && <CommentCornerIndicator />}
            <span className="max-w-full truncate">
              ${value.toFixed(2)}
              {overridden && <span aria-hidden>*</span>}
            </span>
            {hasSubstitute && (
              <span className="max-w-full truncate text-xs leading-tight text-muted-foreground">
                {substituteCaptain} (sub)
              </span>
            )}
          </span>
        )}
      </div>

      {readOnly ? (
        paid ? (
          <Check aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={0.5} />
        ) : null
      ) : (
        <div className={cn("flex shrink-0 items-center justify-end gap-1", paid ? "w-4" : "w-12")}>
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

          {!paid && (
            <CellActionsMenu
              substituteCaptain={substituteCaptain}
              onSubstituteChange={onSubstituteChange}
              substituteOptions={substituteOptions}
              comment={comment}
              onCommentAction={() => setCommentEditRequest((n) => n + 1)}
            />
          )}
        </div>
      )}
    </div>
  );
}
