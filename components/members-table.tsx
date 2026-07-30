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
import type { MemberRole, MemberRow } from "@/lib/stubs/members";
import { cn } from "@/lib/utils";

type MembersTableState = "all" | "captains" | "volunteers";

// TODO: revisit passing full row objects vs UUIDs once a real data layer
// exists (optimization review).
interface MembersTableProps {
  state: MembersTableState;
  /** Qualifying members for the current state, already filtered by the parent. */
  members: MemberRow[];
  /** Externally-controlled selected row (for sidepanel highlighting). */
  selectedId?: string | null;
  /** Called when a row is clicked with the member's id. */
  onRowClick?: (memberId: string) => void;
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

function RoleTag({ role }: { role: MemberRole }) {
  return (
    <span className="inline-flex items-center justify-center rounded-md bg-tag px-2 py-1 text-primary">
      {ROLE_LABEL[role]}
    </span>
  );
}

const volunteerColumns: Column[] = [
  { key: "name", header: "Name", render: (m) => m.name },
  { key: "routeInfo", header: "Route Info", render: (m) => m.routeInfo },
  { key: "captain", header: "Captain", render: (m) => m.captainName },
  {
    key: "startDate",
    header: "Start Date",
    render: (m) => <span className="text-secondary">{m.startDate}</span>,
  },
  {
    key: "role",
    header: "Role",
    headerClassName: "pl-1",
    render: (m) => <RoleTag role={m.role} />,
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

function RowActions({ member }: { member: MemberRow }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${member.name}`}
        render={<Button variant="text" size="icon-sm" onClick={(e) => e.stopPropagation()} />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* TODO: wire to the member details view once it exists. */}
        <DropdownMenuItem>Member details</DropdownMenuItem>
        {/* TODO: wire to the retire mutation once the data layer exists. */}
        <DropdownMenuItem variant="destructive">Retire member</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MembersTable({ state, members, selectedId, onRowClick }: MembersTableProps) {
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
          <RowActions member={member} />
        </div>
      ))}
    </div>
  );
}

export { MembersTable };
export type { MembersTableProps, MembersTableState };
