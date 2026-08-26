import { cn } from "@/lib/utils";

/** Shared chip shape so the label and state chips sit on the same baseline. */
const chipClass = "inline-flex max-w-full items-center truncate rounded-lg px-2 py-1 text-md";

/** Route label chip — shared by deliveries list and map hover preview. */
export function RouteTag({
  label,
  vacant,
  className,
}: {
  label: string;
  vacant?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        chipClass,
        vacant ? "bg-tag-destructive text-destructive" : "bg-tag text-primary",
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Derived attention flag on a route (route flow §4f / §4g): the carrier has gone
 * inactive, or is on vacation so the route is suspended for these issues. Both
 * are derived indicators rather than lifecycle states, and the deliveries list
 * is where they get triaged — so they have to be visible per row.
 *
 * Status rides on the background tint with text-primary on top: the tinted
 * foregrounds (text-destructive on bg-tag-destructive, text-warning on
 * bg-tag-warning) are 3.13:1 and 1.74:1 against a 4.5:1 AA floor for 14px text.
 * This matches the members RoleTag and keeps both chips distinct from the grey
 * route label chip sitting beside them.
 */
export function RouteStateTag({
  state,
  className,
}: {
  state: "attention" | "suspended";
  className?: string;
}) {
  const attention = state === "attention";
  return (
    <span
      className={cn(
        chipClass,
        "text-primary",
        attention ? "bg-tag-destructive" : "bg-tag-warning",
        className,
      )}
    >
      {attention ? "Needs attention" : "Suspended"}
    </span>
  );
}
