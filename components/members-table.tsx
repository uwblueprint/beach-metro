"use client";

import { MoreHorizontal } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteMember, useReactivateMember, type MemberRow } from "@/features/members/api";
import { RetireMemberDialog, type RetireMemberTarget } from "@/components/retire-member-dialog";
import { RoleTag } from "@/components/role-tag";
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
    render: (m) => <RoleTag role={m.role} status={m.status} className="rounded-md" />,
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
  onRequestRetire,
}: {
  member: MemberRow;
  onOpenDetails?: (memberId: string) => void;
  onDeleted?: (memberId: string) => void;
  onRequestRetire: (member: RetireMemberTarget) => void;
}) {
  const reactivate = useReactivateMember();
  const deleteMember = useDeleteMember();
  const isRetired = member.status === "retired";
  const isBusy = reactivate.isPending || deleteMember.isPending;

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
            onClick={() => onRequestRetire({ id: member.id, role: member.role, name: member.name })}
          >
            Retire member
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          disabled={isBusy}
          onClick={() => {
            const detail =
              member.role === "volunteer"
                ? "Their routes will become vacant."
                : "Their territory will be deleted and every volunteer in it will be left without a territory.";
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
  const [retireTarget, setRetireTarget] = useState<RetireMemberTarget | null>(null);

  return (
    <>
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
            <RowActions
              member={member}
              onOpenDetails={onRowClick}
              onDeleted={onDeleted}
              onRequestRetire={setRetireTarget}
            />
          </div>
        ))}
      </div>

      <RetireMemberDialog
        member={retireTarget}
        open={retireTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRetireTarget(null);
        }}
      />
    </>
  );
}

export { MembersTable };
export type { MembersTableProps, MembersTableState };
