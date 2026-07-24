"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { MemberDetail } from "@/lib/stubs/members";
import { SidePanelRow } from "@/components/side-panel-row";
import { SidePanelSection } from "@/components/side-panel-section";

interface MemberSidePanelProps {
  member: MemberDetail | null;
  onClose: () => void;
}

function readCssDurationMs(variable: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw) || fallback;
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[4px] px-2 pb-2 pt-1">
      <span className="text-md text-secondary">{label}</span>
      <span className="text-md text-primary">{value}</span>
    </div>
  );
}

function RoleTag({ role }: { role: "volunteer" | "captain" }) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg bg-tag-active px-2 py-1 text-md text-active">
      {role === "captain" ? "Captain" : "Volunteer"}
    </span>
  );
}

function VolunteerContent({ member }: { member: Extract<MemberDetail, { role: "volunteer" }> }) {
  return (
    <>
      <div className="flex flex-col gap-1 px-1 pb-6 pt-1">
        <InfoField label="Email" value={member.email} />
        <InfoField label="Phone" value={member.phone} />
        <InfoField label="Address" value={member.address} />
        <InfoField label="Start Date" value={member.startDate} />
        <InfoField label="Captain" value={member.captainName} />
      </div>

      <SidePanelSection title="Notes" onAdd={() => {}}>
        {member.notes.length === 0 ? (
          <SidePanelRow className="text-secondary">No notes</SidePanelRow>
        ) : (
          member.notes.map((note) => (
            <SidePanelRow key={note.id} meta={note.date} onEdit={() => {}}>
              <span className="text-primary">{note.text}</span>
            </SidePanelRow>
          ))
        )}
      </SidePanelSection>

      <SidePanelSection title="Route Info" onAdd={() => {}}>
        {member.routes.length === 0 ? (
          <SidePanelRow className="text-secondary">No routes</SidePanelRow>
        ) : (
          <>
            {member.routes.map((route) => (
              <SidePanelRow
                key={route.id}
                meta={`${route.bundles}B / ${route.papers}P`}
                onEdit={() => {}}
              >
                <span className="inline-flex items-center rounded-lg bg-secondary-fill px-2 py-1 text-md text-primary">
                  {route.name}
                </span>
              </SidePanelRow>
            ))}
            <div className="flex h-8 items-center justify-between px-2 py-1 text-md text-secondary">
              <span>Totals</span>
              <span>
                {member.routes.reduce((s, r) => s + r.bundles, 0)} Bundles,{" "}
                {member.routes.reduce((s, r) => s + r.papers, 0)} Papers
              </span>
            </div>
          </>
        )}
      </SidePanelSection>
    </>
  );
}

function CaptainContent({ member }: { member: Extract<MemberDetail, { role: "captain" }> }) {
  return (
    <>
      <div className="flex flex-col gap-1 px-1 pb-6 pt-1">
        <InfoField label="Email" value={member.email} />
        <InfoField label="Phone" value={member.phone} />
        <InfoField label="Rate" value={member.rate} />
        <InfoField label="Cadence" value={member.cadence} />
      </div>

      <SidePanelSection title="Notes" onAdd={() => {}}>
        {member.notes.length === 0 ? (
          <SidePanelRow className="text-secondary">No notes</SidePanelRow>
        ) : (
          member.notes.map((note) => (
            <SidePanelRow key={note.id} meta={note.date} onEdit={() => {}}>
              <span className="text-primary">{note.text}</span>
            </SidePanelRow>
          ))
        )}
      </SidePanelSection>

      <SidePanelSection title="Reimbursements">
        {member.reimbursements.length === 0 ? (
          <SidePanelRow className="text-secondary">No Record of Reimbursement</SidePanelRow>
        ) : (
          member.reimbursements.map((r) => (
            <SidePanelRow key={r.id} meta={r.date} onEdit={() => {}}>
              <span className="text-primary">
                ${r.amount.toFixed(2)} — {r.description}
              </span>
            </SidePanelRow>
          ))
        )}
      </SidePanelSection>

      <SidePanelSection title="Territory Drops" onAdd={() => {}}>
        {member.territoryDrops.length === 0 ? (
          <SidePanelRow className="text-secondary">No Drops</SidePanelRow>
        ) : (
          member.territoryDrops.map((drop) => (
            <SidePanelRow
              key={drop.id}
              meta={`${drop.bundles} bundle${drop.bundles !== 1 ? "s" : ""}`}
              onEdit={() => {}}
            >
              <span className="text-primary">{drop.location}</span>
            </SidePanelRow>
          ))
        )}
      </SidePanelSection>
    </>
  );
}

function MemberSidePanel({ member, onClose }: MemberSidePanelProps) {
  const [displayed, setDisplayed] = useState<MemberDetail | null>(member);
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadMemberRef = useRef(false);

  useEffect(() => {
    if (member) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      const isOpening = !hadMemberRef.current;
      hadMemberRef.current = true;
      setDisplayed(member);

      if (isOpening) {
        setOpen(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setOpen(true));
        });
      }
      return;
    }

    if (!hadMemberRef.current) return;

    setOpen(false);
    const closeMs = readCssDurationMs("--panel-close-dur", 350);
    closeTimerRef.current = setTimeout(() => {
      setDisplayed(null);
      hadMemberRef.current = false;
      closeTimerRef.current = null;
    }, closeMs);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [member]);

  if (!displayed) return null;

  return (
    <div
      className="t-side-panel shrink-0 border-l border-border bg-bg"
      data-open={open ? "true" : "false"}
    >
      <div className="t-side-panel-content flex h-full w-[400px] flex-col">
        <div className="page-header-container">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-md font-semibold text-primary">{displayed.name}</span>
            <RoleTag role={displayed.role} />
          </div>
          <Button
            variant="text"
            size="icon-sm"
            aria-label="Close panel"
            onClick={onClose}
            className="mr-2"
          >
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {displayed.role === "volunteer" ? (
            <VolunteerContent member={displayed} />
          ) : (
            <CaptainContent member={displayed} />
          )}
        </div>
      </div>
    </div>
  );
}

export { MemberSidePanel };
