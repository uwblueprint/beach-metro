"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Info, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const bannerVariants = cva(
  "flex w-full items-center justify-between gap-2 rounded-[8px] border p-4 text-md text-primary",
  {
    variants: {
      variant: {
        default: "border-border bg-tag",
        warning: "border-warning-border bg-tag-warning",
        danger: "border-destructive-border bg-tag-destructive",
        active: "border-active-border bg-tag-active",
      },
      /**
       * inline — in document flow inside page content (default).
       * page — fixed overlay matching the white page panel width,
       *         always 12px from the right edge of the viewport.
       */
      placement: {
        inline: "",
        // Override base `w-full` so left+right define width (= page width).
        page: "fixed top-3 right-3 left-[var(--sidebar-width)] z-40 w-auto max-w-none shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      placement: "inline",
    },
  },
);

type BannerProps = React.ComponentProps<"div"> &
  VariantProps<typeof bannerVariants> & {
    /** Leading info icon. Defaults to true. */
    showIcon?: boolean;
    /** When set, shows a dismiss control on the right. */
    onDismiss?: () => void;
  };

function Banner({
  className,
  variant = "default",
  placement = "inline",
  showIcon = true,
  onDismiss,
  children,
  ...props
}: BannerProps) {
  return (
    <div
      data-slot="banner"
      data-placement={placement ?? "inline"}
      role="status"
      className={cn(bannerVariants({ variant, placement }), className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {showIcon ? <Info className="size-4 shrink-0 text-primary" aria-hidden /> : null}
        <div className="min-w-0 text-md text-primary">{children}</div>
      </div>
      {onDismiss ? (
        <Button
          type="button"
          variant="text"
          size="icon-sm"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

export { Banner, bannerVariants };
export type { BannerProps };
