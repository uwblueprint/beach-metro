"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/50 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Modal shell — top/middle/bottom segments are composed via
 * DialogHeader, DialogBody, and DialogFooter as children.
 */
function DialogContent({
  className,
  children,
  size = "default",
  ...props
}: DialogPrimitive.Popup.Props & {
  /** `default` ≈ 400px (single-step). `lg` ≈ 600px (Figma wizard). */
  size?: "default" | "lg";
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-size={size}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-bg text-md text-primary outline-none",
          size === "lg" ? "sm:max-w-[600px]" : "sm:max-w-[400px]",
          "ring-1 ring-border duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

/** Top segment — title + optional close. Border-bottom divider. */
function DialogHeader({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex shrink-0 items-center justify-between border-b border-border py-4 pl-4 pr-2",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {showCloseButton ? (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          render={<Button variant="text" size="icon-sm" />}
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      ) : null}
    </div>
  );
}

/**
 * Middle segment — put any number of fields, helpers, or custom content here.
 * Default gap matches Figma input-group stacking (24px).
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-body" className={cn("flex flex-col gap-6 p-4", className)} {...props} />
  );
}

/**
 * Label + control stack used inside DialogBody.
 * Keep this thin so forms stay composable.
 */
function DialogField({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-field"
      className={cn("flex w-full flex-col gap-2", className)}
      {...props}
    />
  );
}

/** Bottom segment — actions. Border-top divider.
 * `wizard`: step label left, actions right (Figma multi-step modals). */
function DialogFooter({
  className,
  children,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "wizard";
}) {
  return (
    <div
      data-slot="dialog-footer"
      data-variant={variant}
      className={cn(
        "flex shrink-0 items-center gap-2 border-t border-border p-4",
        variant === "wizard" ? "justify-between" : "justify-end",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Secondary “Step x of y” label for wizard footers. */
function DialogStep({
  step,
  of: total,
  className,
  ...props
}: Omit<React.ComponentProps<"p">, "children"> & {
  step: number;
  of: number;
}) {
  return (
    <p
      data-slot="dialog-step"
      className={cn("text-md text-secondary tabular-nums", className)}
      {...props}
    >
      Step {step} of {total}
    </p>
  );
}

/** Right-aligned action cluster inside a wizard footer. */
function DialogFooterActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer-actions"
      className={cn("flex shrink-0 items-center justify-end gap-2", className)}
      {...props}
    />
  );
}

type DialogWizardFooterProps = {
  step: number;
  steps: number;
  onBack?: () => void;
  onNext?: () => void;
  onConfirm?: () => void;
  /** Primary label on the last step. Default: Confirm. */
  confirmLabel?: string;
  nextLabel?: string;
  className?: string;
};

/**
 * Standard wizard footer — Figma multi-step dialogs.
 * First: Cancel + Next. Middle: Back + Next. Last: Back + Confirm.
 */
function DialogWizardFooter({
  step,
  steps,
  onBack,
  onNext,
  onConfirm,
  confirmLabel = "Confirm",
  nextLabel = "Next",
  className,
}: DialogWizardFooterProps) {
  const isFirst = step <= 1;
  const isLast = step >= steps;

  return (
    <DialogFooter variant="wizard" className={className}>
      <DialogStep step={step} of={steps} />
      <DialogFooterActions>
        {isFirst ? (
          <DialogClose render={<Button variant="default" />}>Cancel</DialogClose>
        ) : (
          <Button type="button" variant="default" onClick={onBack}>
            Back
          </Button>
        )}
        {isLast ? (
          onConfirm ? (
            <Button type="button" variant="primary" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          ) : (
            <DialogClose render={<Button variant="primary" />}>{confirmLabel}</DialogClose>
          )
        ) : (
          <Button type="button" variant="primary" onClick={onNext}>
            {nextLabel}
          </Button>
        )}
      </DialogFooterActions>
    </DialogFooter>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-md font-semibold text-primary", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-md text-secondary", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogField,
  DialogFooter,
  DialogFooterActions,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogStep,
  DialogTitle,
  DialogTrigger,
  DialogWizardFooter,
};
