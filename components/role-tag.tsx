import type { MemberRole, MemberStatus } from "@/features/members/api";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<MemberRole, string> = {
  volunteer: "Volunteer",
  captain: "Captain",
};

const STATUS_LABEL: Record<MemberStatus, string> = {
  active: "active",
  "on-vacation": "on vacation",
  retired: "retired",
};

/**
 * Status tint. Active keeps `text-primary`; on-vacation uses `text-warning` on
 * `bg-tag-warning`; retired uses `text-destructive` on `bg-tag-destructive` (same
 * pairing as the Vacant RouteStateTag).
 */
const STATUS_CLASSES: Record<MemberStatus, string> = {
  active: "border-hairline bg-tag text-primary",
  "on-vacation": "border-warning-border bg-tag-warning text-warning",
  retired: "border-destructive-border bg-tag-destructive text-destructive",
};

/**
 * Member role chip, tinted by status — shared by the members table and the
 * member side panel so the two can't drift.
 *
 * The visible text is the role, so status is carried in the accessible name as
 * well: conveying it through colour alone would hide it from colourblind and
 * screen-reader users (WCAG 1.4.1 Use of Color).
 */
export function RoleTag({
  role,
  status,
  className,
}: {
  role: MemberRole;
  status: MemberStatus;
  className?: string;
}) {
  return (
    <span
      aria-label={`${ROLE_LABEL[role]}, ${STATUS_LABEL[status]}`}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center justify-center overflow-hidden border px-[7px] py-[3px] shadow-[var(--stroke-inner)]",
        STATUS_CLASSES[status],
        className,
      )}
    >
      <span className="min-w-0 truncate">{ROLE_LABEL[role]}</span>
    </span>
  );
}
