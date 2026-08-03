"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { MemberDetail } from "@/lib/stubs/members";
import { getStubTerritoryIdForCaptainName } from "@/lib/stubs/members";
import { NewTerritoryDropDialog, type DropSelection } from "@/components/new-territory-drop-dialog";
import { NotesSection } from "@/components/notes-section";
import { ReimbursementsSection } from "@/components/reimbursements-section";
import { RouteDetailsDialog } from "@/components/route-details-dialog";
import { SidePanelRow } from "@/components/side-panel-row";
import { SidePanelSection } from "@/components/side-panel-section";
import { useCaptainsList, useTerritory } from "@/features/territory-drops/api";
import { useVolunteerRoutes } from "@/features/routes/api";
import type { RouteSummary } from "@/lib/services/routes";

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

function routeMeta(route: RouteSummary): string {
  const bundleN = route.bundles.length;
  return `${bundleN}B / ${route.papers}P`;
}

function VolunteerContent({ member }: { member: Extract<MemberDetail, { role: "volunteer" }> }) {
  const { data: routes = [], isPending, refetch } = useVolunteerRoutes(member.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

  function openCreate() {
    setEditingRouteId(null);
    setDialogOpen(true);
  }

  function openEdit(routeId: string) {
    setEditingRouteId(routeId);
    setDialogOpen(true);
  }

  const totalBundles = routes.reduce((s, r) => s + r.bundles.length, 0);
  const totalPapers = routes.reduce((s, r) => s + r.papers, 0);

  return (
    <>
      <div className="flex flex-col gap-1 px-1 pb-6 pt-1">
        <InfoField label="Email" value={member.email} />
        <InfoField label="Phone" value={member.phone} />
        <InfoField label="Address" value={member.address} />
        <InfoField label="Start Date" value={member.startDate} />
        <InfoField label="Captain" value={member.captainName} />
      </div>

      <NotesSection notes={member.notes} />

      <SidePanelSection title="Route Info" onAdd={openCreate}>
        {isPending ? null : routes.length === 0 ? (
          <SidePanelRow className="text-secondary">No routes</SidePanelRow>
        ) : (
          <>
            {routes.map((route) => (
              <SidePanelRow
                key={route.id}
                meta={routeMeta(route)}
                onClick={() => openEdit(route.id)}
                onEdit={() => openEdit(route.id)}
              >
                <span className="inline-flex items-center rounded-lg bg-secondary-fill px-2 py-1 text-md text-primary">
                  {route.streetName}
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

      <RouteDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        volunteerId={member.id}
        routeId={editingRouteId}
        onSuccess={() => void refetch()}
      />
    </>
  );
}

function CaptainContent({ member }: { member: Extract<MemberDetail, { role: "captain" }> }) {
  const { data: captains = [] } = useCaptainsList();
  const apiCaptain = useMemo(
    () =>
      captains.find(
        (c) => `${c.firstName} ${c.lastName}`.toLowerCase() === member.name.toLowerCase(),
      ) ?? null,
    [captains, member.name],
  );
  const apiTerritoryId = apiCaptain?.territory?.id ?? null;
  // Stub fallback so Confirm can enable on the stub members page before API match lands.
  const territoryId = apiTerritoryId ?? getStubTerritoryIdForCaptainName(member.name);
  const { data: territory, refetch: refetchTerritory } = useTerritory(apiTerritoryId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialDrop, setInitialDrop] = useState<DropSelection | null>(null);

  const liveDrops = territory?.commercialDrops;
  const showingLive = liveDrops !== undefined;

  function openAdd() {
    setInitialDrop(null);
    setDialogOpen(true);
  }

  function openEditCommercial(drop: {
    id: string;
    placeId: string;
    formattedAddress: string | null;
  }) {
    setInitialDrop({
      kind: "commercial",
      addressId: drop.id,
      placeId: drop.placeId,
      label: drop.formattedAddress ?? "Address not geocoded yet",
      territoryId: territoryId!,
    });
    setDialogOpen(true);
  }

  function openEditStub(location: string) {
    // Stub rows have no placeId — prefill as a create-address draft matching the label.
    setInitialDrop({ kind: "create-address", label: location });
    setDialogOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-1 px-1 pb-6 pt-1">
        <InfoField label="Email" value={member.email} />
        <InfoField label="Phone" value={member.phone} />
        <InfoField label="Rate" value={member.rate} />
        <InfoField label="Cadence" value={member.cadence} />
      </div>

      <NotesSection notes={member.notes} />

      <ReimbursementsSection key={member.id} captainId={member.id} />

      <SidePanelSection title="Territory Drops" onAdd={openAdd}>
        {showingLive ? (
          liveDrops.length === 0 ? (
            <SidePanelRow className="text-secondary">No Drops</SidePanelRow>
          ) : (
            liveDrops.map((drop) => (
              <SidePanelRow key={drop.id} meta="—" onEdit={() => openEditCommercial(drop)}>
                <span className="text-primary">
                  {drop.formattedAddress ?? "Address not geocoded yet"}
                </span>
              </SidePanelRow>
            ))
          )
        ) : member.territoryDrops.length === 0 ? (
          <SidePanelRow className="text-secondary">No Drops</SidePanelRow>
        ) : (
          member.territoryDrops.map((drop) => (
            <SidePanelRow
              key={drop.id}
              meta={`${drop.bundles} bundle${drop.bundles !== 1 ? "s" : ""}`}
              onEdit={() => openEditStub(drop.location)}
            >
              <span className="text-primary">{drop.location}</span>
            </SidePanelRow>
          ))
        )}
      </SidePanelSection>

      <NewTerritoryDropDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        captainName={member.name}
        territoryId={territoryId}
        initialDrop={initialDrop}
        onSuccess={() => {
          void refetchTerritory();
        }}
      />
    </>
  );
}

function MemberSidePanel({ member, onClose }: MemberSidePanelProps) {
  const [displayed, setDisplayed] = useState<MemberDetail | null>(member);
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
            <VolunteerContent key={displayed.id} member={displayed} />
          ) : (
            <CaptainContent key={displayed.id} member={displayed} />
          )}
        </div>
      </div>
    </div>
  );
}

export { MemberSidePanel };
