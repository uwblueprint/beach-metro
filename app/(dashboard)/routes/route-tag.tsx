import { cn } from "@/lib/utils";

/**
 * Shared chip shell. Padding lives on the outer; truncate on the inner label so
 * a max-width clamp keeps px-2 on both sides and ellipsizes the text (…).
 */
const chipClass =
  "inline-flex max-w-full min-w-0 items-center overflow-hidden rounded-sm border px-[7px] py-[3px] text-md shadow-[var(--stroke-inner)]";

/**
 * Route label chip — shared by deliveries list and map hover preview. Always
 * neutral: route state is carried by RouteStateTag beside it, never by the chip.
 */
export function RouteTag({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn(chipClass, "border-hairline bg-tag text-primary", className)}>
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

export type RouteState = "vacant" | "attention" | "suspended";

const STATE_TAG: Record<RouteState, { label: string; className: string }> = {
  vacant: {
    label: "Vacant",
    className: "border-destructive-border bg-tag-destructive text-destructive",
  },
  attention: {
    label: "Needs attention",
    className: "border-destructive-border bg-tag-destructive text-destructive",
  },
  suspended: {
    label: "Suspended",
    className: "border-warning-border bg-tag-warning text-warning",
  },
};

/**
 * The one state a route can show (route flow §3a, §4f, §4g): Vacant is the
 * lifecycle state; Needs attention and Suspended are derived flags that only
 * exist on assigned routes, so a route never needs more than one tag.
 * Shrink-0 so the route label truncates first and the state stays readable.
 */
export function RouteStateTag({ state, className }: { state: RouteState; className?: string }) {
  const { label, className: stateClass } = STATE_TAG[state];
  return (
    <span className={cn(chipClass, "max-w-none shrink-0", stateClass, className)}>
      <span className="truncate">{label}</span>
    </span>
  );
}
