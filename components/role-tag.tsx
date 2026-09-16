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
 * Status tint. Active and on-vacation keep `text-primary` on their backgrounds;
 * retired uses `text-destructive` on `bg-tag-destructive` (same pairing as vacant
 * RouteTag chips).
 */
const STATUS_CLASSES: Record<MemberStatus, string> = {
  active: "bg-tag text-primary",
  "on-vacation": "bg-tag-warning text-primary",
  retired: "bg-tag-destructive text-destructive",
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
        "inline-flex items-center justify-center px-2 py-1",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
