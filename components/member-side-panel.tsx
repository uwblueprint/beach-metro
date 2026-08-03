"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { NewTerritoryDropDialog, type DropSelection } from "@/components/new-territory-drop-dialog";
import { NotesSection } from "@/components/notes-section";
import { RouteDetailsDialog } from "@/components/route-details-dialog";
import { SidePanelRow } from "@/components/side-panel-row";
import { SidePanelSection } from "@/components/side-panel-section";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  memberKeys,
  useCaptain,
  useCaptainPayouts,
  useTerritory,
  useUpdateCaptain,
  useUpdateVolunteer,
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

function EditableField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[4px] px-2 pb-2 pt-1">
      <label htmlFor={htmlFor} className="text-md text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

function SelectField({
  id,
  value,
  onChange,
  "aria-label": ariaLabel,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputFieldClassName, "appearance-none pr-8")}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-primary"
      />
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
  const queryClient = useQueryClient();
  const { data: volunteer, isPending, isError, error } = useVolunteer(id);
  const updateVolunteer = useUpdateVolunteer(id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

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
  const currentAddress = volunteer.address.formattedAddress ?? "";

  function openCreate() {
    setEditingRouteId(null);
    setDialogOpen(true);
  }

  function openEdit(routeId: string) {
    setEditingRouteId(routeId);
    setDialogOpen(true);
  }

  function startEditing() {
    setEmail(volunteer!.email);
    setPhone(volunteer!.phone);
    setAddress(currentAddress);
    setStartDate(volunteer!.startDate);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
  }

  async function saveInfo() {
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    if (!trimmedEmail || !trimmedPhone) {
      setSaveError("Email and phone are required.");
      return;
    }
    if (!trimmedAddress) {
      setSaveError("Address is required.");
      return;
    }
    if (!startDate) {
      setSaveError("Start date is required.");
      return;
    }

    const body: {
      email?: string;
      phone?: string;
      startDate?: string;
      address?: { addressLines: string[] };
    } = {};
    if (trimmedEmail !== volunteer!.email) body.email = trimmedEmail;
    if (trimmedPhone !== volunteer!.phone) body.phone = trimmedPhone;
    if (startDate !== volunteer!.startDate) body.startDate = startDate;
    if (trimmedAddress !== currentAddress) body.address = { addressLines: [trimmedAddress] };

    if (Object.keys(body).length === 0) {
      setEditing(false);
      setSaveError(null);
      return;
    }

    setSaveError(null);
    try {
      await updateVolunteer.mutateAsync(body);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save changes.");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1 px-1 pb-6 pt-1">
        {editing ? (
          <>
            <EditableField label="Email" htmlFor={`volunteer-email-${id}`}>
              <Input
                id={`volunteer-email-${id}`}
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </EditableField>
            <EditableField label="Phone" htmlFor={`volunteer-phone-${id}`}>
              <Input
                id={`volunteer-phone-${id}`}
                name="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </EditableField>
            <EditableField label="Address" htmlFor={`volunteer-address-${id}`}>
              <Input
                id={`volunteer-address-${id}`}
                name="address"
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </EditableField>
            <EditableField label="Start Date" htmlFor={`volunteer-start-${id}`}>
              <Input
                id={`volunteer-start-${id}`}
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </EditableField>
          </>
        ) : (
          <>
            <InfoField label="Email" value={volunteer.email} />
            <InfoField label="Phone" value={volunteer.phone} />
            <InfoField
              label="Address"
              value={volunteer.address.formattedAddress ?? "Not geocoded yet"}
            />
            <InfoField label="Start Date" value={formatDate(volunteer.startDate)} />
          </>
        )}
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
        {saveError ? (
          <p className="px-2 text-md text-destructive" role="alert" aria-live="polite">
            {saveError}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2 px-2 pt-1">
          {editing ? (
            <>
              <Button
                variant="text"
                size="sm"
                onClick={cancelEditing}
                disabled={updateVolunteer.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void saveInfo()}
                disabled={updateVolunteer.isPending}
                className="active:scale-[0.96]"
              >
                {updateVolunteer.isPending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={startEditing}
              className="active:scale-[0.96]"
            >
              Edit info
            </Button>
          )}
        </div>
      </div>

      <NotesSection role="volunteer" memberId={id} />

      <SidePanelSection title="Route Info" onAdd={openCreate}>
        {volunteer.routesCarried.length === 0 ? (
          <SidePanelRow className="text-secondary">No routes</SidePanelRow>
        ) : (
          <>
            {volunteer.routesCarried.map((route) => (
              <SidePanelRow
                key={route.id}
                meta={`${route.bundleCount}B / ${route.papers}P`}
                onClick={() => openEdit(route.id)}
                onEdit={() => openEdit(route.id)}
              >
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

      <RouteDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        volunteerId={id}
        routeId={editingRouteId}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: memberKeys.volunteer(id) });
        }}
      />
    </>
  );
}

function CaptainContent({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: captain, isPending, isError, error } = useCaptain(id);
  const updateCaptain = useUpdateCaptain(id);
  const { data: payouts, isPending: payoutsPending } = useCaptainPayouts(id);
  const territoryId = captain?.territory?.id ?? null;
  const { data: territory, refetch: refetchTerritory } = useTerritory(territoryId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialDrop, setInitialDrop] = useState<DropSelection | null>(null);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payRate, setPayRate] = useState("");
  const [payType, setPayType] = useState<"bundle" | "paper" | "drop">("bundle");
  const [payCadence, setPayCadence] = useState<"biweekly" | "monthly">("biweekly");
  const [startDate, setStartDate] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const captainName = `${captain.firstName} ${captain.lastName}`;
  const commercialDrops = territory?.commercialDrops ?? [];
  const territoryVolunteers = territory?.volunteers ?? [];
  const hasDrops = commercialDrops.length > 0 || territoryVolunteers.length > 0;

  function openAdd() {
    setInitialDrop(null);
    setDialogOpen(true);
  }

  function openEditCommercial(drop: {
    id: string;
    placeId: string;
    formattedAddress: string | null;
  }) {
    if (!territoryId) return;
    setInitialDrop({
      kind: "commercial",
      addressId: drop.id,
      placeId: drop.placeId,
      label: drop.formattedAddress ?? "Address not geocoded yet",
      territoryId,
    });
    setDialogOpen(true);
  }

  function openEditVolunteer(volunteer: { id: string; firstName: string; lastName: string }) {
    setInitialDrop({
      kind: "volunteer",
      volunteerId: volunteer.id,
      label: `${volunteer.firstName} ${volunteer.lastName}`,
    });
    setDialogOpen(true);
  }

  function startEditing() {
    setEmail(captain!.email);
    setPhone(captain!.phone);
    setPayRate(String(captain!.payRate));
    setPayType(captain!.payType);
    setPayCadence(captain!.payCadence);
    setStartDate(captain!.startDate);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
  }

  async function saveInfo() {
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const rate = Number(payRate);
    if (!trimmedEmail || !trimmedPhone) {
      setSaveError("Email and phone are required.");
      return;
    }
    if (payRate.trim() === "" || Number.isNaN(rate) || rate < 0) {
      setSaveError("Enter a valid pay rate (0 or greater).");
      return;
    }
    if (!startDate) {
      setSaveError("Start date is required.");
      return;
    }

    const body: {
      email?: string;
      phone?: string;
      payRate?: number;
      payType?: "bundle" | "paper" | "drop";
      payCadence?: "biweekly" | "monthly";
      startDate?: string;
    } = {};
    if (trimmedEmail !== captain!.email) body.email = trimmedEmail;
    if (trimmedPhone !== captain!.phone) body.phone = trimmedPhone;
    if (rate !== captain!.payRate) body.payRate = rate;
    if (payType !== captain!.payType) body.payType = payType;
    if (payCadence !== captain!.payCadence) body.payCadence = payCadence;
    if (startDate !== captain!.startDate) body.startDate = startDate;

    if (Object.keys(body).length === 0) {
      setEditing(false);
      setSaveError(null);
      return;
    }

    setSaveError(null);
    try {
      await updateCaptain.mutateAsync(body);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save changes.");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1 px-1 pb-6 pt-1">
        {editing ? (
          <>
            <EditableField label="Email" htmlFor={`captain-email-${id}`}>
              <Input
                id={`captain-email-${id}`}
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </EditableField>
            <EditableField label="Phone" htmlFor={`captain-phone-${id}`}>
              <Input
                id={`captain-phone-${id}`}
                name="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </EditableField>
            <EditableField label="Rate" htmlFor={`captain-rate-${id}`}>
              <div className="flex gap-2">
                <Input
                  id={`captain-rate-${id}`}
                  name="payRate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={payRate}
                  onChange={(e) => setPayRate(e.target.value)}
                  className="min-w-0 tabular-nums"
                />
                <SelectField
                  id={`captain-pay-type-${id}`}
                  aria-label="Pay type"
                  value={payType}
                  onChange={(v) => setPayType(v as "bundle" | "paper" | "drop")}
                >
                  <option value="bundle">by bundle</option>
                  <option value="paper">by paper</option>
                  <option value="drop">by drop</option>
                </SelectField>
              </div>
            </EditableField>
            <EditableField label="Cadence" htmlFor={`captain-cadence-${id}`}>
              <SelectField
                id={`captain-cadence-${id}`}
                value={payCadence}
                onChange={(v) => setPayCadence(v as "biweekly" | "monthly")}
              >
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
              </SelectField>
            </EditableField>
            <EditableField label="Start Date" htmlFor={`captain-start-${id}`}>
              <Input
                id={`captain-start-${id}`}
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </EditableField>
          </>
        ) : (
          <>
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
          </>
        )}
        <InfoField
          label="Status"
          value={
            captain.status === "retired" ? `Retired ${formatDate(captain.retiredAt)}` : "Active"
          }
        />
        {saveError ? (
          <p className="px-2 text-md text-destructive" role="alert" aria-live="polite">
            {saveError}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2 px-2 pt-1">
          {editing ? (
            <>
              <Button
                variant="text"
                size="sm"
                onClick={cancelEditing}
                disabled={updateCaptain.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void saveInfo()}
                disabled={updateCaptain.isPending}
                className="active:scale-[0.96]"
              >
                {updateCaptain.isPending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={startEditing}
              className="active:scale-[0.96]"
            >
              Edit info
            </Button>
          )}
        </div>
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

      <SidePanelSection title="Territory Drops" onAdd={openAdd}>
        {!captain.territory ? (
          <SidePanelRow className="text-secondary">No territory</SidePanelRow>
        ) : !hasDrops ? (
          <SidePanelRow className="text-secondary">No Drops</SidePanelRow>
        ) : (
          <>
            {territoryVolunteers.map((volunteer) => (
              <SidePanelRow
                key={volunteer.id}
                meta="Volunteer"
                onEdit={() => openEditVolunteer(volunteer)}
              >
                <span className="text-primary">
                  {volunteer.firstName} {volunteer.lastName}
                </span>
              </SidePanelRow>
            ))}
            {commercialDrops.map((drop) => (
              <SidePanelRow
                key={drop.id}
                meta={
                  drop.standingBundles === null
                    ? "Count unknown"
                    : `${drop.standingBundles} bundle${drop.standingBundles === 1 ? "" : "s"}`
                }
                onEdit={() => openEditCommercial(drop)}
              >
                <span className="text-primary">
                  {drop.formattedAddress ?? "Address not geocoded yet"}
                </span>
              </SidePanelRow>
            ))}
          </>
        )}
      </SidePanelSection>

      <NewTerritoryDropDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        captainName={captainName}
        territoryId={territoryId}
        initialDrop={initialDrop}
        onSuccess={() => {
          void refetchTerritory();
          void queryClient.invalidateQueries({ queryKey: memberKeys.all });
          void queryClient.invalidateQueries({ queryKey: ["territory-drops"] });
          if (territoryId) {
            void queryClient.invalidateQueries({ queryKey: memberKeys.territory(territoryId) });
          }
        }}
      />
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
