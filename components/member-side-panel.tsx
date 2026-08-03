"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { NotesSection } from "@/components/notes-section";
import { SidePanelRow } from "@/components/side-panel-row";
import { SidePanelSection } from "@/components/side-panel-section";
import {
  useCaptain,
  useCaptainPayouts,
  useTerritory,
  useVolunteer,
  type MemberRole,
} from "@/features/members/api";

/** The row the user clicked. Name comes along so the header renders immediately. */
export interface MemberSelection {
  id: string;
  role: MemberRole;
  name: string;
}

interface MemberSidePanelProps {
  member: MemberSelection | null;
  onClose: () => void;
}

function readCssDurationMs(variable: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw) || fallback;
}

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

const PAY_TYPE_LABEL: Record<string, string> = {
  bundle: "by bundle",
  paper: "by paper",
  drop: "by drop",
};

const CADENCE_LABEL: Record<string, string> = {
  biweekly: "Bi-Weekly",
  monthly: "Monthly",
};

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[4px] px-2 pb-2 pt-1">
      <span className="text-md text-secondary">{label}</span>
      <span className="text-md text-primary">{value}</span>
    </div>
  );
}

function RoleTag({ role }: { role: MemberRole }) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg bg-tag-active px-2 py-1 text-md text-active">
      {role === "captain" ? "Captain" : "Volunteer"}
    </span>
  );
}

function VolunteerContent({ id }: { id: string }) {
  const { data: volunteer, isPending, isError, error } = useVolunteer(id);

  if (isError) {
    return (
      <p className="px-2 text-md text-secondary">
        {error instanceof Error ? error.message : "Could not load this volunteer."}
      </p>
    );
  }
  if (isPending || !volunteer) {
    return <p className="px-2 text-md text-secondary">Loading…</p>;
  }

  const totalBundles = volunteer.routesCarried.reduce((s, r) => s + r.bundleCount, 0);
  const totalPapers = volunteer.routesCarried.reduce((s, r) => s + r.papers, 0);

  return (
    <>
      <div className="flex flex-col gap-1 px-1 pb-6 pt-1">
        <InfoField label="Email" value={volunteer.email} />
        <InfoField label="Phone" value={volunteer.phone} />
        <InfoField
          label="Address"
          value={volunteer.address.formattedAddress ?? "Not geocoded yet"}
        />
        <InfoField label="Start Date" value={formatDate(volunteer.startDate)} />
        <InfoField label="Captain" value={volunteer.territory?.captainName ?? "No captain"} />
        <InfoField
          label="Status"
          value={
            volunteer.status === "on-vacation"
              ? `On vacation until ${formatDate(volunteer.vacationEnd)}`
              : volunteer.status === "retired"
                ? `Retired ${formatDate(volunteer.retiredAt)}`
                : volunteer.needsAttention
                  ? "Active (end date passed)"
                  : "Active"
          }
        />
      </div>

      <NotesSection role="volunteer" memberId={id} />

      <SidePanelSection title="Route Info">
        {volunteer.routesCarried.length === 0 ? (
          <SidePanelRow className="text-secondary">No routes</SidePanelRow>
        ) : (
          <>
            {volunteer.routesCarried.map((route) => (
              <SidePanelRow key={route.id} meta={`${route.bundleCount}B / ${route.papers}P`}>
                <span className="inline-flex items-center rounded-lg bg-secondary-fill px-2 py-1 text-md text-primary">
                  {route.label}
                </span>
              </SidePanelRow>
            ))}
            <div className="flex h-8 items-center justify-between px-2 py-1 text-md text-secondary">
              <span>Totals</span>
              <span>
                {totalBundles} Bundles, {totalPapers} Papers
              </span>
            </div>
          </>
        )}
      </SidePanelSection>
    </>
  );
}

function CaptainContent({ id }: { id: string }) {
  const { data: captain, isPending, isError, error } = useCaptain(id);
  const { data: payouts, isPending: payoutsPending } = useCaptainPayouts(id);
  const { data: territory } = useTerritory(captain?.territory?.id);

  if (isError) {
    return (
      <p className="px-2 text-md text-secondary">
        {error instanceof Error ? error.message : "Could not load this captain."}
      </p>
    );
  }
  if (isPending || !captain) {
    return <p className="px-2 text-md text-secondary">Loading…</p>;
  }

  const drops = territory?.commercialDrops ?? [];

  return (
    <>
      <div className="flex flex-col gap-1 px-1 pb-6 pt-1">
        <InfoField label="Email" value={captain.email} />
        <InfoField label="Phone" value={captain.phone} />
        <InfoField
          label="Rate"
          value={`$${captain.payRate.toFixed(2)} ${PAY_TYPE_LABEL[captain.payType] ?? captain.payType}`}
        />
        <InfoField
          label="Cadence"
          value={CADENCE_LABEL[captain.payCadence] ?? captain.payCadence}
        />
        <InfoField label="Start Date" value={formatDate(captain.startDate)} />
        <InfoField
          label="Status"
          value={
            captain.status === "retired" ? `Retired ${formatDate(captain.retiredAt)}` : "Active"
          }
        />
      </div>

      <NotesSection role="captain" memberId={id} />

      <SidePanelSection title="Reimbursements">
        {payoutsPending ? (
          <SidePanelRow className="text-secondary">Loading…</SidePanelRow>
        ) : (payouts ?? []).length === 0 ? (
          <SidePanelRow className="text-secondary">No Record of Reimbursement</SidePanelRow>
        ) : (
          (payouts ?? []).map((entry) => (
            <SidePanelRow key={entry.id} meta={formatDate(entry.issueDate)}>
              <span className="text-primary">
                ${entry.amount.toFixed(2)} · {entry.issueName}
                {entry.paid ? " · paid" : ""}
                {entry.substitutedBy ? ` · covered by ${entry.substitutedBy}` : ""}
              </span>
            </SidePanelRow>
          ))
        )}
      </SidePanelSection>

      <SidePanelSection title="Territory Drops">
        {!captain.territory ? (
          <SidePanelRow className="text-secondary">No territory</SidePanelRow>
        ) : drops.length === 0 ? (
          <SidePanelRow className="text-secondary">No Drops</SidePanelRow>
        ) : (
          drops.map((drop) => (
            <SidePanelRow
              key={drop.id}
              // Null is "nobody has told us yet", which is not the same as zero.
              meta={
                drop.standingBundles === null
                  ? "Count unknown"
                  : `${drop.standingBundles} bundle${drop.standingBundles === 1 ? "" : "s"}`
              }
            >
              <span className="text-primary">
                {drop.formattedAddress ?? "Address not geocoded yet"}
              </span>
            </SidePanelRow>
          ))
        )}
      </SidePanelSection>
    </>
  );
}

function MemberSidePanel({ member, onClose }: MemberSidePanelProps) {
  const [displayed, setDisplayed] = useState<MemberSelection | null>(member);
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadMemberRef = useRef(false);

  // Keep panel content in sync with the selected member during render.
  // Clearing on close stays in the effect so the close animation can finish first.
  // Compare by id — parent recreates the member object every render.
  if (member && member.id !== displayed?.id) {
    setDisplayed(member);
  }

  useEffect(() => {
    if (member) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      const isOpening = !hadMemberRef.current;
      hadMemberRef.current = true;

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
            <VolunteerContent key={displayed.id} id={displayed.id} />
          ) : (
            <CaptainContent key={displayed.id} id={displayed.id} />
          )}
        </div>
      </div>
    </div>
  );
}

export { MemberSidePanel };
