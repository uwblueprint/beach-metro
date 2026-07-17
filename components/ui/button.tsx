import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-transparent bg-clip-padding text-md font-normal whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-secondary-fill text-primary hover:bg-secondary-fill-hover disabled:text-disabled",
        primary: "bg-active text-bg hover:bg-active-hover disabled:bg-active/50",
        outline:
          "border-hairline text-primary hover:border-transparent hover:bg-secondary-fill-hover disabled:text-disabled",
        danger: "bg-destructive text-bg hover:bg-destructive-hover disabled:bg-destructive/50",
        text: "text-primary hover:bg-secondary-fill-hover disabled:text-disabled",
        link: "text-active underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-2 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-5 gap-1 px-1.5 text-xs [&_svg:not([class*='size-'])]:size-2.5",
        sm: "h-6 gap-1 px-2 text-sm [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 gap-2 px-4 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "size-8 p-2",
        "icon-xs": "size-5 p-1 [&_svg:not([class*='size-'])]:size-2.5",
        "icon-sm": "size-6 p-1.5 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-9 p-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
