import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

const listItemVariants = cva(
  [
    "group/list-item inline-flex w-full items-center rounded-[4px] font-normal whitespace-nowrap transition-colors",
    "outline-none select-none",
    "text-primary",
    "hover:bg-tag-hover",
    "focus-visible:ring-3 focus-visible:ring-ring/50",
    "data-[active=true]:bg-tag-active data-[active=true]:text-active",
    "data-[active=true]:hover:bg-tag-active",
    "disabled:pointer-events-none disabled:text-disabled disabled:hover:bg-transparent",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-6 gap-2 p-2 text-sm [&_svg:not([class*='size-'])]:size-3",
        md: "gap-2 px-2 py-[7px] text-md [&_svg:not([class*='size-'])]:size-4",
      },
      type: {
        text: "",
        "leading-icon": "",
        "trailing-icon": "justify-between",
      },
    },
    defaultVariants: {
      size: "md",
      type: "text",
    },
  },
);

type ListItemSharedProps = VariantProps<typeof listItemVariants> & {
  /** Visual type: text only, leading icon, or trailing icon. */
  type?: "text" | "leading-icon" | "trailing-icon";
  /** Selected / current state (maps to Figma "active"). */
  active?: boolean;
  /** Icon shown for leading-icon or trailing-icon types. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

type ListItemButtonProps = ListItemSharedProps &
  Omit<ComponentProps<"button">, "type" | "children"> & {
    href?: undefined;
    /** Native button type. Defaults to "button". */
    nativeType?: "button" | "submit" | "reset";
  };

type ListItemLinkProps = ListItemSharedProps &
  Omit<ComponentProps<typeof Link>, "children" | "type"> & {
    href: string;
    disabled?: never;
  };

type ListItemProps = ListItemButtonProps | ListItemLinkProps;

function ListItemContent({
  type,
  icon,
  children,
}: {
  type: "text" | "leading-icon" | "trailing-icon";
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {type === "leading-icon" && icon != null ? (
        <span data-slot="list-item-icon" className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      <span data-slot="list-item-label" className="truncate">
        {children}
      </span>
      {type === "trailing-icon" && icon != null ? (
        <span data-slot="list-item-icon" className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
    </>
  );
}

function ListItem({
  className,
  size = "md",
  type = "text",
  active = false,
  icon,
  children,
  ...props
}: ListItemProps) {
  const classes = cn(listItemVariants({ size, type, className }));
  const content = (
    <ListItemContent type={type ?? "text"} icon={icon}>
      {children}
    </ListItemContent>
  );

  if ("href" in props && props.href != null) {
    const { href, ...linkProps } = props;
    return (
      <Link
        href={href}
        data-slot="list-item"
        data-active={active || undefined}
        aria-current={active ? "page" : undefined}
        className={classes}
        {...linkProps}
      >
        {content}
      </Link>
    );
  }

  const buttonProps = props as ListItemButtonProps;
  const {
    disabled = false,
    nativeType = "button",
    // Visual `type` is already handled above; keep it out of the DOM button.
    type: _visualType,
    ...rest
  } = buttonProps;

  return (
    <button
      type={nativeType}
      data-slot="list-item"
      data-active={active || undefined}
      disabled={disabled}
      className={classes}
      {...rest}
    >
      {content}
    </button>
  );
}

export { ListItem, listItemVariants };
export type { ListItemProps };
