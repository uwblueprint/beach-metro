"use client";

import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { AddressField } from "@/components/address-field";
import { Button } from "@/components/ui/button";
import { NewTerritoryDropDialog, type DropSelection } from "@/components/new-territory-drop-dialog";
import { NotesSection } from "@/components/notes-section";
import { RouteDetailsDialog } from "@/components/route-details-dialog";
import { SidePanelRow } from "@/components/side-panel-row";
import { SidePanelSection } from "@/components/side-panel-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import {
  memberKeys,
  useCaptain,
  useCaptainPayouts,
  useCreateCaptain,
  useCreateVolunteer,
  useTerritory,
  useUpdateCaptain,
  useUpdateVolunteer,
  useVolunteer,
  type MemberRole,
} from "@/features/members/api";
import { territoryDropKeys, useCaptainsList } from "@/features/territory-drops/api";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** The row the user clicked. Name comes along so the header renders immediately. */
export interface MemberSelection {
  id: string;
  role: MemberRole;
  name: string;
}

interface MemberSidePanelProps {
  member: MemberSelection | null;
  creating: boolean;
  onClose: () => void;
  onCreated: (member: MemberSelection) => void;
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
  const [addressPlaceId, setAddressPlaceId] = useState<string | null>(null);
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
    setEmail(volunteer!.email ?? "");
    setPhone(volunteer!.phone ?? "");
    setAddress(currentAddress);
    setAddressPlaceId(volunteer!.address.placeId);
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
      address?: { addressLines: string[] } | { placeId: string };
    } = {};
    if (trimmedEmail !== (volunteer!.email ?? "")) body.email = trimmedEmail;
    if (trimmedPhone !== (volunteer!.phone ?? "")) body.phone = trimmedPhone;
    if (startDate !== volunteer!.startDate) body.startDate = startDate;
    if (trimmedAddress !== currentAddress) {
      body.address = addressPlaceId
        ? { placeId: addressPlaceId }
        : { addressLines: [trimmedAddress] };
    } else if (addressPlaceId && addressPlaceId !== volunteer!.address.placeId) {
      body.address = { placeId: addressPlaceId };
    }

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
              <AddressField
                id={`volunteer-address-${id}`}
                label=""
                placeholder="1900 Queen St E"
                value={address}
                onChange={(text) => {
                  setAddress(text);
                  setAddressPlaceId(null);
                }}
                onPick={(placeId, text) => {
                  setAddressPlaceId(placeId);
                  setAddress(text);
                }}
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
            <InfoField label="Email" value={volunteer.email ?? "Not on file"} />
            <InfoField label="Phone" value={volunteer.phone ?? "Not on file"} />
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
    setEmail(captain!.email ?? "");
    setPhone(captain!.phone ?? "");
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
    if (trimmedEmail !== (captain!.email ?? "")) body.email = trimmedEmail;
    if (trimmedPhone !== (captain!.phone ?? "")) body.phone = trimmedPhone;
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
                <Select
                  id={`captain-pay-type-${id}`}
                  aria-label="Pay type"
                  value={payType}
                  onChange={(v) => setPayType(v as "bundle" | "paper" | "drop")}
                  options={[
                    { value: "bundle", label: "by bundle" },
                    { value: "paper", label: "by paper" },
                    { value: "drop", label: "by drop" },
                  ]}
                />
              </div>
            </EditableField>
            <EditableField label="Cadence" htmlFor={`captain-cadence-${id}`}>
              <Select
                id={`captain-cadence-${id}`}
                value={payCadence}
                onChange={(v) => setPayCadence(v as "biweekly" | "monthly")}
                options={[
                  { value: "biweekly", label: "Bi-Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
              />
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
            <InfoField label="Email" value={captain.email ?? "Not on file"} />
            <InfoField label="Phone" value={captain.phone ?? "Not on file"} />
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
              {entry.role === "covered_by" ? (
                // Someone else covered and was paid, so no amount is shown here:
                // under a "Reimbursements" heading a figure would read as income.
                <span className="text-secondary">
                  {entry.issueName} · covered by {entry.substitutedBy}
                </span>
              ) : (
                <span className="text-primary">
                  ${entry.amount.toFixed(2)} ·{" "}
                  {entry.role === "covered_for"
                    ? `Covered for ${entry.coveredFor}`
                    : entry.issueName}
                  {entry.paid ? " · paid" : ""}
                </span>
              )}
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
          void queryClient.invalidateQueries({ queryKey: territoryDropKeys.all });
          if (territoryId) {
            void queryClient.invalidateQueries({ queryKey: memberKeys.territory(territoryId) });
          }
        }}
      />
    </>
  );
}

const PAY_TYPES = [
  { value: "bundle", label: "Per bundle" },
  { value: "paper", label: "Per paper" },
  { value: "drop", label: "Per drop" },
] as const;

const CADENCES = [
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
] as const;

function CreateMemberContent({
  onCreated,
  onBusyChange,
}: {
  onCreated: (member: MemberSelection) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const createVolunteer = useCreateVolunteer();
  const createCaptain = useCreateCaptain();
  const { data: captains } = useCaptainsList();

  const [role, setRole] = useState<MemberRole>("volunteer");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [startDate, setStartDate] = useState(todayIso);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressPlaceId, setAddressPlaceId] = useState<string | null>(null);
  const [captainTerritoryId, setCaptainTerritoryId] = useState("");
  const [payType, setPayType] = useState<"bundle" | "paper" | "drop" | "">("");
  const [payRate, setPayRate] = useState("");
  const [payCadence, setPayCadence] = useState<"biweekly" | "monthly" | "">("");
  const [createError, setCreateError] = useState<string | null>(null);

  const busy = createVolunteer.isPending || createCaptain.isPending;

  useLayoutEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  function handleRoleChange(next: MemberRole) {
    setRole(next);
    setCreateError(null);
  }

  async function handleCreate() {
    if (!firstName.trim() || !lastName.trim()) {
      setCreateError("First and last name are required.");
      return;
    }
    if (!startDate) {
      setCreateError("Start date is required.");
      return;
    }
    if (role === "volunteer" && !address.trim()) {
      setCreateError("Street address is required.");
      return;
    }
    if (role === "captain") {
      if (!payType) {
        setCreateError("Pay type is required.");
        return;
      }
      if (payRate.trim() === "" || Number.isNaN(Number(payRate)) || Number(payRate) < 0) {
        setCreateError("Enter a valid pay rate (0 or greater).");
        return;
      }
      if (!payCadence) {
        setCreateError("Cadence is required.");
        return;
      }
    }

    setCreateError(null);
    try {
      if (role === "volunteer") {
        const created = await createVolunteer.mutateAsync({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: addressPlaceId
            ? { placeId: addressPlaceId }
            : { addressLines: [address.trim()] },
          startDate,
          captainTerritoryId: captainTerritoryId || null,
        });
        onCreated({
          id: created.id,
          role: "volunteer",
          name: `${created.firstName} ${created.lastName}`,
        });
      } else {
        const created = await createCaptain.mutateAsync({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          payType: payType as "bundle" | "paper" | "drop",
          payRate: Number(payRate),
          payCadence: payCadence as "biweekly" | "monthly",
          startDate,
        });
        onCreated({
          id: created.id,
          role: "captain",
          name: `${created.firstName} ${created.lastName}`,
        });
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create member.");
    }
  }

  return (
    <form
      id="cm-form"
      onSubmit={(e) => {
        e.preventDefault();
        void handleCreate();
      }}
      className="flex flex-col gap-1 px-1 pb-2 pt-1"
    >
      <EditableField label="Role" htmlFor="cm-role">
        <Select
          id="cm-role"
          value={role}
          onChange={(v) => handleRoleChange(v as MemberRole)}
          options={[
            { value: "volunteer", label: "Volunteer" },
            { value: "captain", label: "Captain" },
          ]}
        />
      </EditableField>
      <EditableField label="First Name" htmlFor="cm-first">
        <Input
          id="cm-first"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          autoComplete="given-name"
        />
      </EditableField>
      <EditableField label="Last Name" htmlFor="cm-last">
        <Input
          id="cm-last"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          autoComplete="family-name"
        />
      </EditableField>
      <EditableField label="Start Date" htmlFor="cm-start">
        <Input
          id="cm-start"
          type="date"
          name="startDate"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </EditableField>
      <EditableField label="Email" htmlFor="cm-email">
        <Input
          id="cm-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          spellCheck={false}
        />
      </EditableField>
      <EditableField label="Phone" htmlFor="cm-phone">
        <Input
          id="cm-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          autoComplete="tel"
        />
      </EditableField>

      {role === "volunteer" ? (
        <>
          <EditableField label="Address" htmlFor="cm-address">
            <AddressField
              id="cm-address"
              label=""
              placeholder="1900 Queen St E"
              value={address}
              onChange={(text) => {
                setAddress(text);
                setAddressPlaceId(null);
              }}
              onPick={(placeId, text) => {
                setAddressPlaceId(placeId);
                setAddress(text);
              }}
            />
          </EditableField>
          <EditableField label="Captain (optional)" htmlFor="cm-captain">
            <Select
              id="cm-captain"
              value={captainTerritoryId}
              onChange={setCaptainTerritoryId}
              options={[
                { value: "", label: "No captain" },
                ...(captains ?? [])
                  .filter((c) => c.territory)
                  .map((c) => ({
                    value: c.territory!.id,
                    label: `${c.firstName} ${c.lastName}`,
                  })),
              ]}
            />
          </EditableField>
        </>
      ) : (
        <>
          <EditableField label="Pay Type" htmlFor="cm-pay-type">
            <Select
              id="cm-pay-type"
              value={payType}
              onChange={(v) => setPayType(v as typeof payType)}
              options={PAY_TYPES.map((opt) => ({ value: opt.value, label: opt.label }))}
              placeholder="Select pay type"
            />
          </EditableField>
          <EditableField label="Pay Rate" htmlFor="cm-pay-rate">
            <Input
              id="cm-pay-rate"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={payRate}
              onChange={(e) => setPayRate(e.target.value)}
              placeholder="0.00"
              className="tabular-nums"
            />
          </EditableField>
          <EditableField label="Cadence" htmlFor="cm-cadence">
            <Select
              id="cm-cadence"
              value={payCadence}
              onChange={(v) => setPayCadence(v as typeof payCadence)}
              options={CADENCES.map((opt) => ({ value: opt.value, label: opt.label }))}
              placeholder="Select cadence"
            />
          </EditableField>
        </>
      )}

      {createError ? (
        <p className="px-2 text-md text-destructive" role="alert" aria-live="polite">
          {createError}
        </p>
      ) : null}
    </form>
  );
}

function MemberSidePanel({ member, creating, onClose, onCreated }: MemberSidePanelProps) {
  const [displayed, setDisplayed] = useState<MemberSelection | null>(member);
  const [displayedCreating, setDisplayedCreating] = useState(creating);
  const [open, setOpen] = useState(false);
  const [createBusyState, setCreateBusy] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasActiveRef = useRef(false);

  // Busy only means anything while the create form is up, so derive it rather
  // than resetting through an effect on dismissal.
  const createBusy = creating && createBusyState;

  const isActive = creating || member !== null;

  // Sync content immediately during render so there's no stale frame.
  // Clearing on close is deferred to the effect so the animation can finish first.
  if (creating !== displayedCreating) {
    setDisplayedCreating(creating);
  }
  if (member && member.id !== displayed?.id) {
    setDisplayed(member);
  }

  useEffect(() => {
    if (isActive) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      const isOpening = !wasActiveRef.current;
      wasActiveRef.current = true;

      if (isOpening) {
        setOpen(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setOpen(true));
        });
      }
      return;
    }

    if (!wasActiveRef.current) return;

    setOpen(false);
    const closeMs = readCssDurationMs("--panel-close-dur", 350);
    closeTimerRef.current = setTimeout(() => {
      setDisplayed(null);
      setDisplayedCreating(false);
      wasActiveRef.current = false;
      closeTimerRef.current = null;
    }, closeMs);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isActive]);

  if (!displayed && !displayedCreating) return null;

  return (
    <div
      className="t-side-panel shrink-0 border-l border-border bg-bg"
      data-open={open ? "true" : "false"}
    >
      <div className="t-side-panel-content flex h-full w-[400px] flex-col">
        <div className="page-header-container">
          {displayedCreating ? (
            <span className="truncate text-md font-semibold text-primary">New Member</span>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-md font-semibold text-primary">{displayed?.name}</span>
              {displayed && <RoleTag role={displayed.role} />}
            </div>
          )}
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
          {displayedCreating ? (
            <CreateMemberContent onCreated={onCreated} onBusyChange={setCreateBusy} />
          ) : displayed?.role === "volunteer" ? (
            <VolunteerContent key={displayed.id} id={displayed.id} />
          ) : displayed ? (
            <CaptainContent key={displayed.id} id={displayed.id} />
          ) : null}
        </div>

        {displayedCreating && (
          <div className="panel-header shrink-0 justify-end gap-2 border-t border-border">
            <Button variant="text" onClick={onClose} disabled={createBusy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              form="cm-form"
              type="submit"
              disabled={createBusy}
              className="active:scale-[0.96]"
            >
              {createBusy ? "Creating…" : "Create Member"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export { MemberSidePanel };
