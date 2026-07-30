"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PillGroup } from "@/components/ui/pill-group";
import { SearchBar } from "@/components/ui/search-bar";
import { MembersTable, type MembersTableState } from "@/components/members-table";
import { MemberSidePanel, type MemberSelection } from "@/components/member-side-panel";
import { useMembers, type MemberRole } from "@/features/members/api";

const STATES: { value: MembersTableState; label: string }[] = [
  { value: "all", label: "All members" },
  { value: "captains", label: "Captains" },
  { value: "volunteers", label: "Volunteers" },
];

const ROLE_FOR_STATE: Record<MembersTableState, MemberRole | undefined> = {
  all: undefined,
  captains: "captain",
  volunteers: "volunteer",
};

/** Debounce the search box so typing doesn't fire a request per keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function MembersPage() {
  const [state, setState] = useState<MembersTableState>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MemberSelection | null>(null);

  const debouncedSearch = useDebounced(search.trim(), 250);

  const filters = { role: ROLE_FOR_STATE[state], q: debouncedSearch || undefined };
  const { data: members, isPending, isError, error } = useMembers(filters);
  // The "of Y" total is the unfiltered count. With no filters applied this shares
  // a cache key with the query above, so it costs nothing on the default view.
  const { data: allMembers } = useMembers({});

  const rows = members ?? [];

  function handleRowClick(memberId: string) {
    const member = rows.find((m) => m.id === memberId);
    if (!member) return;
    setSelected((current) =>
      current?.id === memberId ? null : { id: member.id, role: member.role, name: member.name },
    );
  }

  return (
    <div className="page-container">
      <div className="page">
        <div className="flex h-full flex-col">
          <div className="page-header-container">
            <div className="flex items-center gap-2">
              <h1 className="text-md text-primary">Members</h1>
              <p className="text-md text-secondary">
                Showing {rows.length} of {allMembers?.length ?? rows.length}
              </p>
            </div>
            <Button variant="primary">
              <Plus data-icon="inline-start" />
              Add Member
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div className="flex items-center gap-2">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by name"
                  className="min-w-0 flex-1"
                />
                <PillGroup
                  exclusive
                  options={STATES}
                  value={state}
                  onChange={(value) => {
                    if (value != null) setState(value as MembersTableState);
                  }}
                  className="shrink-0"
                />
              </div>
              {isError ? (
                <p className="text-md text-secondary p-2">
                  {error instanceof Error ? error.message : "Could not load members."}
                </p>
              ) : isPending ? (
                <p className="text-md text-secondary p-2">Loading members…</p>
              ) : rows.length === 0 ? (
                <p className="text-md text-secondary p-2">
                  {debouncedSearch ? `No members match “${debouncedSearch}”.` : "No members yet."}
                </p>
              ) : (
                <MembersTable
                  state={state}
                  members={rows}
                  selectedId={selected?.id ?? null}
                  onRowClick={handleRowClick}
                />
              )}
            </div>
            <MemberSidePanel member={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      </div>
    </div>
  );
}
