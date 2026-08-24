"use client";

import { MoreHorizontal } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDeleteMember,
  useReactivateMember,
  useRetireMember,
  type MemberRole,
  type MemberRow,
  type MemberStatus,
} from "@/features/members/api";
import { cn } from "@/lib/utils";

type MembersTableState = "all" | "captains" | "volunteers";

// TODO: revisit passing full row objects vs UUIDs if list payloads get heavy.
interface MembersTableProps {
  state: MembersTableState;
  /** Qualifying members for the current state, already filtered by the parent. */
  members: MemberRow[];
  /** Externally-controlled selected row (for sidepanel highlighting). */
  selectedId?: string | null;
  /** Called when a row is clicked with the member's id. */
  onRowClick?: (memberId: string) => void;
  /** Called after a member is hard-deleted so the parent can clear selection. */
  onDeleted?: (memberId: string) => void;
}

interface Column {
  key: string;
  header: string;
  /** Fixed cell width; cells are full (equal flex) width by default. */
  width?: CSSProperties["width"];
  /** Optional className for the header cell. */
  headerClassName?: string;
  render: (member: MemberRow) => ReactNode;
}

const ROLE_LABEL: Record<MemberRole, string> = {
  volunteer: "Volunteer",
  captain: "Captain",
};

const ROLE_TAG_STATUS_CLASSES: Record<MemberStatus, string> = {
  active: "bg-tag text-primary",
  "on-vacation": "bg-tag-warning text-warning",
  retired: "bg-tag-destructive text-destructive",
};

function RoleTag({ role, status }: { role: MemberRole; status: MemberStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2 py-1",
        ROLE_TAG_STATUS_CLASSES[status],
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

/** "2020-06-03" -> "Jun. 3, 2020". The API returns ISO; display is the UI's job. */
const MONTHS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
];

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

const volunteerColumns: Column[] = [
  { key: "name", header: "Name", render: (m) => m.name },
  { key: "routeInfo", header: "Route Info", render: (m) => m.routeInfo },
  { key: "captain", header: "Captain", render: (m) => m.captainName },
  {
    key: "startDate",
    header: "Start Date",
    render: (m) => <span className="text-secondary">{formatDate(m.startDate)}</span>,
  },
  {
    key: "role",
    header: "Role",
    headerClassName: "pl-1",
    render: (m) => <RoleTag role={m.role} status={m.status} />,
  },
];

// All states share the volunteer columns for now; keyed per state so each can
// diverge once the captain / all-members designs land.
const COLUMNS: Record<MembersTableState, Column[]> = {
  all: volunteerColumns,
  captains: volunteerColumns,
  volunteers: volunteerColumns,
};

function TableCell({
  width,
  className,
  children,
}: {
  width?: CSSProperties["width"];
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("table-cell", width != null && "flex-none", className)}
      style={width != null ? { width } : undefined}
    >
      {children}
    </div>
  );
}

function RowActions({
  member,
  onOpenDetails,
  onDeleted,
}: {
  member: MemberRow;
  onOpenDetails?: (memberId: string) => void;
  onDeleted?: (memberId: string) => void;
}) {
  const retire = useRetireMember();
  const reactivate = useReactivateMember();
  const deleteMember = useDeleteMember();
  const isRetired = member.status === "retired";
  const isBusy = retire.isPending || reactivate.isPending || deleteMember.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${member.name}`}
        render={
          <Button
            variant="text"
            size="icon-sm"
            className="text-secondary"
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onOpenDetails?.(member.id)}>
          Member details
        </DropdownMenuItem>
        {isRetired ? (
          <DropdownMenuItem
            disabled={isBusy}
            onClick={() => reactivate.mutate({ id: member.id, role: member.role })}
          >
            {reactivate.isPending ? "Reactivating…" : "Un-retire member"}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={isBusy}
            onClick={() => {
              const detail =
                member.role === "volunteer"
                  ? "Their routes will become vacant."
                  : "Their territory will be left without a captain.";
              if (!window.confirm(`Retire ${member.name}? ${detail}`)) return;
              retire.mutate({ id: member.id, role: member.role });
            }}
          >
            {retire.isPending ? "Retiring…" : "Retire member"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          disabled={isBusy}
          onClick={() => {
            const detail =
              member.role === "volunteer"
                ? "Their routes will become vacant."
                : "Their territory and all associated data will be removed.";
            if (
              !window.confirm(`Permanently delete ${member.name}? This cannot be undone. ${detail}`)
            )
              return;
            deleteMember.mutate(
              { id: member.id, role: member.role },
              { onSuccess: () => onDeleted?.(member.id) },
            );
          }}
        >
          {deleteMember.isPending ? "Deleting…" : "Delete member"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MembersTable({ state, members, selectedId, onRowClick, onDeleted }: MembersTableProps) {
  const columns = COLUMNS[state];

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex h-10 w-full items-center gap-10 px-2 py-1 text-secondary">
        {columns.map((col) => (
          <TableCell key={col.key} width={col.width} className={col.headerClassName}>
            {col.header}
          </TableCell>
        ))}
        {/* Spacer matching the row actions button, keeps columns aligned. */}
        <div className="size-6 shrink-0" />
      </div>
      {members.map((member) => (
        <div
          key={member.id}
          className="table-row group/table-row"
          data-active={selectedId === member.id || undefined}
          onClick={() => onRowClick?.(member.id)}
        >
          {columns.map((col) => (
            <TableCell key={col.key} width={col.width}>
              {col.render(member)}
            </TableCell>
          ))}
          <RowActions member={member} onOpenDetails={onRowClick} onDeleted={onDeleted} />
        </div>
      ))}
    </div>
  );
}

export { MembersTable };
export type { MembersTableProps, MembersTableState };
