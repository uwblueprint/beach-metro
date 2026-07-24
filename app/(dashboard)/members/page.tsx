"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PillGroup } from "@/components/ui/pill-group";
import { SearchBar } from "@/components/ui/search-bar";
import { MembersTable, type MembersTableState } from "@/components/members-table";
import { MemberSidePanel } from "@/components/member-side-panel";
import { getMemberDetail, memberRows } from "@/lib/stubs/members";

const STATES: { value: MembersTableState; label: string }[] = [
  { value: "all", label: "All members" },
  { value: "captains", label: "Captains" },
  { value: "volunteers", label: "Volunteers" },
];

export default function MembersPage() {
  const [state, setState] = useState<MembersTableState>("all");
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const filtered = memberRows
    .filter((m) => state === "all" || m.role === (state === "captains" ? "captain" : "volunteer"))
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  const selectedMember = selectedMemberId ? getMemberDetail(selectedMemberId) : null;

  function handleRowClick(memberId: string) {
    setSelectedMemberId((current) => (current === memberId ? null : memberId));
  }

  return (
    <div className="page-container">
      <div className="page">
        <div className="flex h-full flex-col">
          <div className="page-header-container">
            <div className="flex items-center gap-2">
              <h1 className="text-md text-primary">Members</h1>
              <p className="text-md text-secondary">
                Showing {filtered.length} of {memberRows.length}
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
              <MembersTable
                state={state}
                members={filtered}
                selectedId={selectedMemberId}
                onRowClick={handleRowClick}
              />
            </div>
            <MemberSidePanel member={selectedMember} onClose={() => setSelectedMemberId(null)} />
          </div>
        </div>
      </div>
    </div>
  );
}
