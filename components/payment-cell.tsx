"use client";

import * as React from "react";
import { Check, ArrowLeftRight, MoreHorizontal } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOriginalLook } from "@/components/dev-look-toggle";
import { cn } from "@/lib/utils";

import type {
  CellOverride,
  PaymentDetail,
  SubstituteCaptainAssignment,
} from "@/app/(dashboard)/finances/data";
import { formatCurrency } from "@/app/(dashboard)/finances/data";

const HOVER_OPEN_DELAY_MS = 450;
const HOVER_CLOSE_DELAY_MS = 120;

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
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const skipCommitRef = React.useRef(false);
  const [pendingComment, setPendingComment] = React.useState<string | undefined>(undefined);
  const [focused, setFocused] = React.useState(false);

  const displayComment = pendingComment !== undefined ? pendingComment : comment;

  // Prop caught up to what we saved — drop the local override (render-time adjust).
  if (pendingComment !== undefined && pendingComment === comment) {
    setPendingComment(undefined);
  }

  const [draft, setDraft] = React.useState(displayComment);
  if (!focused && draft !== displayComment) {
    setDraft(displayComment);
  }

  React.useEffect(() => {
    if (!editing) return;
    textareaRef.current?.focus();
  }, [editing]);

  function commit(raw: string) {
    const next = raw.trim() || null;
    const current = displayComment.trim() || null;
    if (next !== current) {
      setPendingComment(next ?? "");
      onSave?.(next);
    }
    onEditingChange(false);
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 whitespace-normal">
      <p className="text-md text-tertiary">Note</p>
      <Textarea
        ref={textareaRef}
        rows={2}
        value={draft}
        readOnly={readOnly}
        placeholder="Add a note"
        aria-label={displayComment.trim() ? "Edit comment" : "Add comment"}
        className={cn("min-h-16 resize-none", readOnly && "cursor-not-allowed")}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setFocused(true)}
        onPointerDown={(event) => {
          if (readOnly) {
            event.preventDefault();
            return;
          }
          onEditingChange(true);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            event.preventDefault();
            skipCommitRef.current = true;
            setDraft(displayComment);
            onEditingChange(false);
            event.currentTarget.blur();
          }
        }}
        onBlur={(event) => {
          setFocused(false);
          if (skipCommitRef.current) {
            skipCommitRef.current = false;
            return;
          }
          if (readOnly) return;
          commit(event.currentTarget.value);
        }}
      />
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
  issueClosed?: boolean;
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
  issueClosed = false,
  commentEditRequest = 0,
  dismissRef,
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
  /** Closed issues reject note edits, same as the other payment changes. */
  issueClosed?: boolean;
  commentEditRequest?: number;
  /** Parent calls this when the pointer moves onto the check or ⋯. */
  dismissRef?: React.RefObject<() => void>;
}) {
  const original = useOriginalLook();
  const [open, setOpen] = React.useState(false);
  const [editingComment, setEditingComment] = React.useState(false);
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditingCommentRef = React.useRef(false);
  const openRef = React.useRef(false);
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const popupInnerRef = React.useRef<HTMLDivElement>(null);
  const pointerRef = React.useRef({ x: 0, y: 0, seen: false });

  // These refs exist so the hover callbacks, which are created once, can read
  // the current value without being rebuilt on every render. They are written
  // after the render commits, since a render React discards must not leave a
  // value behind. Every read of them happens inside a later callback.
  React.useEffect(() => {
    openRef.current = open;
  });

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

  const pointerInside = React.useCallback(() => {
    if (!pointerRef.current.seen) return false;
    const el = document.elementFromPoint(pointerRef.current.x, pointerRef.current.y);
    if (!el) return false;
    if (triggerRef.current?.contains(el)) return true;
    const shell = popupInnerRef.current?.parentElement;
    return Boolean(shell?.contains(el));
  }, []);

  const dismissDetail = React.useCallback(() => {
    clearOpenTimeout();
    clearCloseTimeout();
    setOpen(false);
  }, [clearOpenTimeout, clearCloseTimeout]);

  React.useEffect(() => {
    if (!dismissRef) return;
    dismissRef.current = dismissDetail;
    return () => {
      dismissRef.current = () => {};
    };
  }, [dismissRef, dismissDetail]);

  const rememberPointer = React.useCallback((event: { clientX: number; clientY: number }) => {
    pointerRef.current = { x: event.clientX, y: event.clientY, seen: true };
  }, []);

  const pointerInsideRef = React.useRef(pointerInside);
  const clearCloseTimeoutRef = React.useRef(clearCloseTimeout);
  React.useEffect(() => {
    pointerInsideRef.current = pointerInside;
    clearCloseTimeoutRef.current = clearCloseTimeout;
  });

  const stopTrackingRef = React.useRef<(() => void) | null>(null);
  const scheduleCloseRef = React.useRef<() => void>(() => {});

  const ensureTracking = React.useCallback(() => {
    if (stopTrackingRef.current) return;
    function onPointerMove(event: PointerEvent) {
      pointerRef.current = { x: event.clientX, y: event.clientY, seen: true };
      if (pointerInsideRef.current()) {
        clearCloseTimeoutRef.current();
        return;
      }
      clearOpenTimeout();
      if (openRef.current) scheduleCloseRef.current();
      else stopTrackingRef.current?.();
    }
    function onScroll() {
      if (pointerInsideRef.current()) return;
      clearOpenTimeout();
      if (openRef.current) scheduleCloseRef.current();
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("scroll", onScroll, true);
    stopTrackingRef.current = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll, true);
      stopTrackingRef.current = null;
    };
  }, [clearOpenTimeout]);

  const scheduleClose = React.useCallback(() => {
    if (isEditingCommentRef.current) return;
    clearOpenTimeout();
    if (closeTimeoutRef.current) return;
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      if (isEditingCommentRef.current || pointerInside()) return;
      setOpen(false);
      stopTrackingRef.current?.();
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearOpenTimeout, pointerInside]);
  React.useEffect(() => {
    scheduleCloseRef.current = scheduleClose;
  });

  const handleHoverEnter = React.useCallback(
    (event: React.MouseEvent) => {
      rememberPointer(event);
      ensureTracking();
      clearCloseTimeout();
      if (openTimeoutRef.current || openRef.current) return;
      openTimeoutRef.current = setTimeout(() => {
        openTimeoutRef.current = null;
        if (pointerInside()) setOpen(true);
        else stopTrackingRef.current?.();
      }, HOVER_OPEN_DELAY_MS);
    },
    [clearCloseTimeout, ensureTracking, pointerInside, rememberPointer],
  );

  const handleHoverLeave = React.useCallback(
    (event: React.MouseEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node) {
        if (triggerRef.current?.contains(next)) return;
        const shell = popupInnerRef.current?.parentElement;
        if (shell?.contains(next)) return;
      }
      scheduleClose();
    },
    [scheduleClose],
  );

  const handleCommentEditingChange = React.useCallback(
    (editing: boolean) => {
      isEditingCommentRef.current = editing;
      setEditingComment(editing);
      if (editing) {
        clearCloseTimeout();
        setOpen(true);
        return;
      }
      if (!pointerInside()) scheduleClose();
    },
    [clearCloseTimeout, pointerInside, scheduleClose],
  );

  React.useEffect(() => {
    if (commentEditRequest > 0) {
      const id = setTimeout(() => handleCommentEditingChange(true), 0);
      return () => clearTimeout(id);
    }
  }, [commentEditRequest, handleCommentEditingChange]);

  React.useEffect(() => {
    if (!open) return;
    // The popup can flip after it opens (rows like issue 04). That move does
    // not fire mouseleave, so re-check once layout settles.
    let frame2 = 0;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        if (!pointerInside()) scheduleClose();
      });
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [open, pointerInside, scheduleClose]);

  React.useEffect(() => {
    return () => {
      clearOpenTimeout();
      clearCloseTimeout();
      stopTrackingRef.current?.();
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
            ref={triggerRef}
            className={cn(
              "inline-flex w-full min-w-0 cursor-default flex-col items-start justify-center text-md tabular-nums outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
              paid ? "text-muted-foreground opacity-40" : "text-primary",
            )}
            onMouseEnter={(event) => {
              triggerRef.current = event.currentTarget;
              handleHoverEnter(event);
            }}
            onMouseLeave={handleHoverLeave}
            onClick={(event) => event.preventDefault()}
          >
            {(hasComment || (!original && overridden)) && <CommentCornerIndicator />}
            <span className="max-w-full truncate">
              ${value.toFixed(2)}
              {original && overridden ? <span aria-hidden>*</span> : null}
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
        initialFocus={false}
        className="box-border w-max min-w-[200px] max-w-[400px] gap-3 overflow-visible rounded-lg bg-bg p-3 text-md smooth-shadow-ring-sm!"
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
      >
        <div ref={popupInnerRef} className="flex w-full min-w-0 flex-col gap-3 whitespace-nowrap">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <p className="shrink-0 text-md text-primary">
                {hasSubstitute ? substituteCaptain : paymentDetail.captainName}
              </p>
              {hasSubstitute && <ArrowLeftRight className="size-3 shrink-0 text-secondary" />}
            </div>
            <p className="shrink-0 text-md text-tertiary">
              {paymentDetail.issueLabel} • Last Modified {paymentDetail.lastModified}
            </p>
          </div>

          <div className="border-t border-border" />

          <div className="flex flex-col gap-1">
            <p className="shrink-0 text-md text-tertiary">Routes</p>
            <p className="shrink-0 text-md text-primary">{paymentDetail.territory}</p>
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-md text-tertiary">
              {bundleLabel} × {formatCurrency(paymentDetail.ratePerBundle)}
            </span>
            <span className="shrink-0 text-md tabular-nums text-primary">
              {formatCurrency(calculatedValue)}
              {original && overridden ? <span aria-hidden>*</span> : null}
            </span>
          </div>

          {(hasComment || (onCommentChange && !readOnly && !issueClosed && !paid)) && (
            <PopoverComment
              comment={comment ?? ""}
              readOnly={readOnly || issueClosed || paid || !onCommentChange}
              editing={editingComment}
              onSave={onCommentChange}
              onEditingChange={handleCommentEditingChange}
            />
          )}

          {override && (
            <>
              <div className="border-t border-border" />
              <div className="flex w-full min-w-0 flex-col gap-1 whitespace-normal">
                <p className="text-md text-tertiary">Manually overridden</p>
                <p className="text-md tabular-nums text-primary">
                  {formatCurrency(override.originalValue)} → {formatCurrency(value)}
                </p>
                {override.note ? <p className="text-md text-secondary">{override.note}</p> : null}
              </div>
            </>
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
              "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,background-color,color] duration-150 ease-out",
              "pointer-events-none group-hover/cell:pointer-events-auto group-hover/cell:opacity-100 hover:bg-bg-tertiary hover:text-primary",
              "data-popup-open:pointer-events-auto data-popup-open:bg-bg-quaternary data-popup-open:text-primary data-popup-open:opacity-100",
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
  issueClosed = false,
  isLocked = false,
  className,
}: PaymentCellProps) {
  const original = useOriginalLook();
  const cellHeight = original ? "h-12" : "h-10";
  const hasSubstitute = substituteCaptain !== "None";
  const hasComment = Boolean(comment?.trim());
  const nonInteractive = readOnly || isLocked;
  const [commentEditRequest, setCommentEditRequest] = React.useState(0);
  const dismissDetailRef = React.useRef<() => void>(() => {});
  const skipBlurCancelRef = React.useRef(false);

  if (isEditing) {
    return (
      <div
        className={cn(
          "relative z-10 flex w-full min-w-0 items-center bg-bg px-3 outline outline-2 outline-active -outline-offset-2",
          cellHeight,
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
        "group/cell relative flex w-full min-w-0 items-center gap-1 overflow-hidden px-3 outline-none transition-colors focus:outline-none focus-visible:outline-none",
        cellHeight,
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
            issueClosed={issueClosed}
            commentEditRequest={commentEditRequest}
            dismissRef={dismissDetailRef}
          />
        ) : (
          <span
            className={cn(
              "inline-flex w-full min-w-0 flex-col items-start justify-center text-md tabular-nums",
              paid ? "text-muted-foreground opacity-40" : "text-primary",
            )}
          >
            {(hasComment || (!original && overridden)) && <CommentCornerIndicator />}
            <span className="max-w-full truncate">
              ${value.toFixed(2)}
              {original && overridden ? <span aria-hidden>*</span> : null}
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
        <div
          className={cn("flex shrink-0 items-center justify-end gap-1", paid ? "w-4" : "w-12")}
          onMouseEnter={() => dismissDetailRef.current()}
        >
          <div className="relative flex size-4 shrink-0 items-center justify-center">
            <button
              type="button"
              aria-label="Mark paid"
              disabled={paid}
              onClick={onMarkPaid}
              className={cn(
                "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 ease-out",
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
                "pointer-events-none size-4 text-muted-foreground transition-all duration-150 ease-out",
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
