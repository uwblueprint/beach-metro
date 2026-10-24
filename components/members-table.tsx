"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, type ReactNode, useMemo, useState } from "react";

import { RouteTag } from "@/app/(dashboard)/routes/route-tag";
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
  /** Fixed width in px; never grows or shrinks. */
  width?: number;
  /** Share of the free width relative to other flexible columns (default 1). */
  grow?: number;
  /** Cap in px; space a capped column can't use goes to the others. */
  maxWidth?: number;
  /** Floor in px; the column truncates down to this before the table scrolls. */
  minWidth?: number;
  /**
   * Cells may render a tag. Tags are pulled left by their border + padding (8px) so
   * the tag text lines up with the header and with plain text in the same column.
   */
  tags?: boolean;
  /** Makes the header a sort toggle. */
  sortKey?: SortKey;
  /** Optional className for the body cells. */
  cellClassName?: string;
  render: (member: MemberRow) => ReactNode;
}

type SortKey = "name" | "startDate";
type SortDirection = "asc" | "desc";
interface Sort {
  key: SortKey;
  direction: SortDirection;
}

/**
 * `first` is the direction of the first click: A→Z for names, most recent first
 * for dates. A second click reverses it; a third returns to the server's order.
 */
const SORTERS: Record<
  SortKey,
  { first: SortDirection; compare: (a: MemberRow, b: MemberRow) => number }
> = {
  name: { first: "asc", compare: (a, b) => a.name.localeCompare(b.name) },
  startDate: {
    first: "desc",
    // ISO dates compare correctly as strings.
    compare: (a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""),
  },
};

const SORT_LABEL: Record<SortKey, Record<SortDirection, string>> = {
  name: { asc: "A to Z", desc: "Z to A" },
  startDate: { desc: "most recent first", asc: "oldest first" },
};

function nextSort(current: Sort | null, key: SortKey): Sort | null {
  const { first } = SORTERS[key];
  if (current?.key !== key) return { key, direction: first };
  if (current.direction === first) return { key, direction: first === "asc" ? "desc" : "asc" };
  return null;
}

function sortMembers(members: MemberRow[], sort: Sort | null): MemberRow[] {
  if (!sort) return members;
  const { compare } = SORTERS[sort.key];
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...members].sort((a, b) => {
    // Members without a start date stay at the bottom in both directions.
    if (sort.key === "startDate" && !a.startDate !== !b.startDate) return a.startDate ? -1 : 1;
    return sign * compare(a, b);
  });
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort | null;
  onSort: (key: SortKey) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const active = sort?.key === sortKey;
  const direction = active ? sort.direction : SORTERS[sortKey].first;
  const state = active ? SORT_LABEL[sortKey][direction] : "default order";
  const iconState = active
    ? direction === "asc"
      ? "a"
      : "b"
    : hovered || focusVisible
      ? "c"
      : "none";
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
      onBlur={() => setFocusVisible(false)}
      aria-label={`Sort by ${label}, currently ${state}`}
      className={cn(
        "inline-flex max-w-full cursor-pointer items-center gap-1 rounded-sm outline-none transition-colors duration-150 ease-out hover:text-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
        active && "text-secondary",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="t-icon-swap size-3 shrink-0" data-state={iconState} aria-hidden>
        <span className="t-icon flex size-3 items-center justify-center" data-icon="a">
          <ArrowUp className="size-3" strokeWidth={1.75} />
        </span>
        <span className="t-icon flex size-3 items-center justify-center" data-icon="b">
          <ArrowDown className="size-3" strokeWidth={1.75} />
        </span>
        <span className="t-icon flex size-3 items-center justify-center" data-icon="c">
          <ArrowUpDown className="size-3" strokeWidth={1.75} />
        </span>
      </span>
    </button>
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** Pull a tag left by its 1px border + 7px padding, and let it use that 8px of width. */
const TAG_BLEED = "-ml-2 max-w-[calc(100%+0.5rem)]";

// Start Date is fixed, so it keeps its distance from the menu. In Captains and
// Volunteers, Name and Captain cap at 160px and Route Info takes a double share, so
// it stays the widest column at any width. All members shares nothing else with
// them, so its columns split evenly.
const nameColumn: Column = {
  key: "name",
  header: "Name",
  sortKey: "name",
  maxWidth: 160,
  minWidth: 48,
  render: (m) => m.name,
};
const flexibleNameColumn: Column = { ...nameColumn, maxWidth: undefined };
const routeInfoColumn: Column = {
  key: "routeInfo",
  header: "Route Info",
  grow: 2,
  minWidth: 48,
  tags: true,
  render: (m) =>
    m.routeId ? (
      <Link
        href={`/routes?route=${encodeURIComponent(m.routeId)}`}
        aria-label={`Open route ${m.routeInfo}`}
        className={cn(
          "inline-flex rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          TAG_BLEED,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <RouteTag
          label={m.routeInfo}
          className="text-secondary transition-colors duration-150 ease-out hover:bg-tag-hover"
        />
      </Link>
    ) : (
      <span className="block truncate">{m.routeInfo}</span>
    ),
};
const captainColumn: Column = {
  key: "captain",
  header: "Captain",
  maxWidth: 160,
  minWidth: 48,
  render: (m) => m.captainName,
};
const startDateColumn: Column = {
  key: "startDate",
  header: "Start Date",
  sortKey: "startDate",
  width: 112,
  cellClassName: "text-tertiary",
  render: (m) => formatDate(m.startDate),
};
const roleColumn: Column = {
  key: "role",
  header: "Role",
  minWidth: 48,
  tags: true,
  render: (m) => (
    <RoleTag role={m.role} status={m.status} neutral className={cn("rounded-md", TAG_BLEED)} />
  ),
};

const STATUS_LABEL: Record<MemberRow["status"], string> = {
  active: "Active",
  "on-vacation": "On vacation",
  retired: "Retired",
};

const statusColumn: Column = {
  key: "status",
  header: "Status",
  minWidth: 48,
  render: (m) => STATUS_LABEL[m.status],
};

const COLUMNS: Record<MembersTableState, Column[]> = {
  all: [flexibleNameColumn, roleColumn, statusColumn, startDateColumn],
  captains: [nameColumn, routeInfoColumn, startDateColumn],
  volunteers: [nameColumn, routeInfoColumn, captainColumn, startDateColumn],
};

/**
 * Column gap: 16px while the table is narrow (side panel open, small window), 40px
 * once it has room. A variable inside the `@container` so header and body rows share it.
 */
const GAP_VARIABLE = "[--members-gap:1rem] @2xl:[--members-gap:2.5rem]";
const GAP_STYLE: CSSProperties = { columnGap: "var(--members-gap)" };

/** Row px-2 (16) + the narrow 16px gap before each column and the menu + 32px menu button. */
function tableMinWidth(columns: Column[]): number {
  return columns.reduce((sum, col) => sum + (col.width ?? col.minWidth ?? 0) + 16, 16 + 32);
}

function TableCell({
  column,
  tags,
  className,
  children,
}: {
  column: Column;
  tags?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const style: CSSProperties =
    column.width != null
      ? { flex: `0 0 ${column.width}px` }
      : {
          flex: `${column.grow ?? 1} 1 0%`,
          minWidth: column.minWidth,
          maxWidth: column.maxWidth,
        };
  // Tags bleed 8px left into the gap; plain text in these cells truncates itself.
  if (tags) style.overflow = "visible";
  return (
    <div className={cn("table-cell", className)} style={style}>
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
            size="icon"
            className="text-secondary hover:bg-bg-tertiary data-popup-open:bg-bg-quaternary"
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
  const [sort, setSort] = useState<Sort | null>(null);
  const rows = useMemo(() => sortMembers(members, sort), [members, sort]);

  return (
    <>
      <div className="@container w-full">
        <div
          className={cn("flex w-full flex-col gap-1", GAP_VARIABLE)}
          style={{ minWidth: tableMinWidth(columns) }}
        >
          <div className="flex h-10 w-full items-center px-2 py-1 text-tertiary" style={GAP_STYLE}>
            {columns.map((col) => (
              <TableCell key={col.key} column={col}>
                {col.sortKey ? (
                  <SortHeader
                    label={col.header}
                    sortKey={col.sortKey}
                    sort={sort}
                    onSort={(key) => setSort((current) => nextSort(current, key))}
                  />
                ) : (
                  col.header
                )}
              </TableCell>
            ))}
            {/* Spacer matching the row actions button, keeps columns aligned. */}
            <div className="size-8 shrink-0" />
          </div>
          {rows.map((member) => (
            <div
              key={member.id}
              className="table-row group/table-row text-secondary"
              style={GAP_STYLE}
              data-active={selectedId === member.id || undefined}
              onClick={() => onRowClick?.(member.id)}
            >
              {columns.map((col) => (
                <TableCell key={col.key} column={col} tags={col.tags} className={col.cellClassName}>
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
