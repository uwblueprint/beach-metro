"use client";

import { useMemo, useState } from "react";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogField,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  useAddCommercialDrop,
  useAssignVolunteerToTerritory,
  useCreateVolunteerForTerritory,
  useVolunteersList,
} from "@/features/territory-drops/api";

export type DropSelection =
  | { kind: "volunteer"; volunteerId: string; label: string }
  | {
      kind: "commercial";
      addressId: string;
      placeId: string;
      label: string;
      territoryId: string;
    }
  | { kind: "create-address"; label: string }
  | { kind: "create-volunteer"; label: string };

export interface NewTerritoryDropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name of the captain whose panel is open — shown immediately, no fetch. */
  captainName: string;
  /** Territory owned by that captain; required for Confirm. */
  territoryId?: string | null;
  /** Prefill Drop Details when editing an existing row. */
  initialDrop?: DropSelection | null;
  onSuccess?: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function splitName(raw: string): { firstName: string; lastName: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Digit → create address; letter (or other) → create volunteer. */
function createKindForQuery(query: string): "create-address" | "create-volunteer" | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const first = trimmed[0];
  return /\d/.test(first) ? "create-address" : "create-volunteer";
}

function volunteerLabel(firstName: string, lastName: string, assigned: boolean): string {
  const name = `${firstName} ${lastName}`;
  return assigned ? `${name} (assigned)` : name;
}

function NewTerritoryDropForm({
  captainName,
  territoryId,
  initialDrop,
  onOpenChange,
  onSuccess,
}: {
  captainName: string;
  territoryId: string | null;
  initialDrop: DropSelection | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { data: volunteers = [] } = useVolunteersList();

  const assignVolunteer = useAssignVolunteerToTerritory();
  const addCommercialDrop = useAddCommercialDrop();
  const createVolunteer = useCreateVolunteerForTerritory();

  const [query, setQuery] = useState(() =>
    initialDrop?.kind === "create-address" || initialDrop?.kind === "create-volunteer"
      ? initialDrop.label
      : "",
  );
  const [selection, setSelection] = useState<DropSelection | null>(initialDrop);
  const [error, setError] = useState<string | null>(null);

  const [volEmail, setVolEmail] = useState("");
  const [volPhone, setVolPhone] = useState("");
  const [volAddress, setVolAddress] = useState("");
  const [volStartDate, setVolStartDate] = useState(todayIso);

  const currentVolunteers = useMemo(() => {
    return volunteers
      .filter((v) => v.status !== "retired")
      .map((v) => ({
        id: v.id,
        firstName: v.firstName,
        lastName: v.lastName,
        assigned: v.territory !== null,
      }))
      .sort((a, b) => {
        if (a.assigned !== b.assigned) return a.assigned ? 1 : -1;
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });
  }, [volunteers]);

  const candidateOptions: ComboboxOption[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const options: ComboboxOption[] = currentVolunteers.map((v) => ({
      value: `volunteer:${v.id}`,
      label: volunteerLabel(v.firstName, v.lastName, v.assigned),
    }));
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [currentVolunteers, query]);

  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return candidateOptions.some((o) => {
      const bare = o.label.replace(/\s*\(assigned\)$/i, "").toLowerCase();
      return o.label.toLowerCase() === q || bare === q;
    });
  }, [candidateOptions, query]);

  const createKind = createKindForQuery(query);
  const showCreate = createKind !== null && !hasExactMatch && query.trim().length > 0;

  const displayValue = selection?.label ?? null;
  const creatingVolunteer = selection?.kind === "create-volunteer";
  const volunteerFieldsReady =
    !creatingVolunteer ||
    (volEmail.trim().length > 0 &&
      volPhone.trim().length > 0 &&
      volAddress.trim().length > 0 &&
      volStartDate.trim().length > 0);

  const hasSelection = !!selection;
  const mutationsPending =
    assignVolunteer.isPending || addCommercialDrop.isPending || createVolunteer.isPending;
  const canConfirm = hasSelection && !!territoryId && volunteerFieldsReady && !mutationsPending;

  const confirmBlockedReason = !hasSelection
    ? null
    : !territoryId
      ? "This captain’s territory isn’t available yet, so Confirm stays disabled."
      : !volunteerFieldsReady
        ? "Fill in the new volunteer fields to continue."
        : null;

  function selectOption(option: ComboboxOption) {
    if (!option.value.startsWith("volunteer:")) return;
    const volunteerId = option.value.slice("volunteer:".length);
    setSelection({ kind: "volunteer", volunteerId, label: option.label });
    setQuery("");
  }

  function selectCreate() {
    const kind = createKindForQuery(query);
    if (!kind) return;
    setSelection({ kind, label: query.trim() });
  }

  async function handleConfirm() {
    if (!selection) return;
    setError(null);

    if (!territoryId) {
      setError("This captain has no territory to assign to.");
      return;
    }

    if (
      initialDrop &&
      selection.kind === initialDrop.kind &&
      selection.kind === "volunteer" &&
      initialDrop.kind === "volunteer" &&
      selection.volunteerId === initialDrop.volunteerId
    ) {
      onOpenChange(false);
      return;
    }

    try {
      if (selection.kind === "volunteer") {
        // Overwrites captain_territory_id — removes the volunteer from any prior captain.
        await assignVolunteer.mutateAsync({
          territoryId,
          volunteerId: selection.volunteerId,
        });
      } else if (selection.kind === "commercial") {
        if (selection.territoryId === territoryId) {
          onOpenChange(false);
          return;
        }
        await addCommercialDrop.mutateAsync({
          territoryId,
          address: { placeId: selection.placeId },
          previousTerritoryId: selection.territoryId,
          previousAddressId: selection.addressId,
        });
      } else if (selection.kind === "create-address") {
        await addCommercialDrop.mutateAsync({
          territoryId,
          address: { addressLines: [selection.label] },
        });
      } else if (selection.kind === "create-volunteer") {
        const { firstName, lastName } = splitName(selection.label);
        await createVolunteer.mutateAsync({
          firstName,
          lastName,
          email: volEmail.trim(),
          phone: volPhone.trim(),
          addressLines: [volAddress.trim()],
          startDate: volStartDate.trim(),
          captainTerritoryId: territoryId,
        });
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this territory drop.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New Territory Drop</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <DialogField>
          <Label id="ntd-captain-label" className="text-md font-normal text-primary">
            Captain
          </Label>
          <div
            className={cn(inputFieldClassName, "text-primary")}
            aria-labelledby="ntd-captain-label"
          >
            {captainName}
          </div>
        </DialogField>

        <DialogField>
          <Label id="ntd-drop-label" className="text-md font-normal text-primary">
            Drop Details
          </Label>
          <Combobox
            aria-labelledby="ntd-drop-label"
            value={
              selection?.kind === "volunteer"
                ? `volunteer:${selection.volunteerId}`
                : (selection?.kind ?? null)
            }
            displayValue={displayValue}
            query={query}
            onQueryChange={(next) => {
              setQuery(next);
              if (
                selection &&
                selection.kind !== "create-address" &&
                selection.kind !== "create-volunteer"
              ) {
                setSelection(null);
              }
              if (selection?.kind === "create-address" || selection?.kind === "create-volunteer") {
                setSelection({ kind: selection.kind, label: next.trim() });
              }
            }}
            onSelect={selectOption}
            options={candidateOptions}
            placeholder="Input text"
            footer={
              showCreate ? (
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center rounded-[4px] p-2 text-left text-sm text-primary outline-none transition-colors hover:bg-tag-hover"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={selectCreate}
                >
                  {createKind === "create-address"
                    ? "Create new address…"
                    : "Create new volunteer…"}
                </button>
              ) : null
            }
          />
        </DialogField>

        {creatingVolunteer ? (
          <div className="flex flex-col gap-4">
            <DialogField>
              <Label htmlFor="ntd-vol-email" className="text-md font-normal text-primary">
                Email
              </Label>
              <Input
                id="ntd-vol-email"
                type="email"
                value={volEmail}
                onChange={(e) => setVolEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </DialogField>
            <DialogField>
              <Label htmlFor="ntd-vol-phone" className="text-md font-normal text-primary">
                Phone
              </Label>
              <Input
                id="ntd-vol-phone"
                type="tel"
                value={volPhone}
                onChange={(e) => setVolPhone(e.target.value)}
                placeholder="416-555-0100"
              />
            </DialogField>
            <DialogField>
              <Label htmlFor="ntd-vol-address" className="text-md font-normal text-primary">
                Address
              </Label>
              <Input
                id="ntd-vol-address"
                value={volAddress}
                onChange={(e) => setVolAddress(e.target.value)}
                placeholder="Street address"
              />
            </DialogField>
            <DialogField>
              <Label htmlFor="ntd-vol-start" className="text-md font-normal text-primary">
                Start date
              </Label>
              <Input
                id="ntd-vol-start"
                type="date"
                value={volStartDate}
                onChange={(e) => setVolStartDate(e.target.value)}
              />
            </DialogField>
          </div>
        ) : null}

        <DialogDescription>Selecting an assigned drop will re-allocate it.</DialogDescription>

        {error ? <p className="text-md text-destructive">{error}</p> : null}
        {!error && confirmBlockedReason ? (
          <p className="text-md text-secondary">{confirmBlockedReason}</p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose render={<Button variant="default" />}>Cancel</DialogClose>
        <Button type="button" variant="primary" disabled={!canConfirm} onClick={handleConfirm}>
          Confirm
        </Button>
      </DialogFooter>
    </>
  );
}

function NewTerritoryDropDialog({
  open,
  onOpenChange,
  captainName,
  territoryId = null,
  initialDrop = null,
  onSuccess,
}: NewTerritoryDropDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <NewTerritoryDropForm
            key={[
              captainName,
              territoryId ?? "",
              initialDrop?.kind ?? "",
              initialDrop && "label" in initialDrop ? initialDrop.label : "",
              initialDrop && "volunteerId" in initialDrop ? initialDrop.volunteerId : "",
              initialDrop && "addressId" in initialDrop ? initialDrop.addressId : "",
            ].join("|")}
            captainName={captainName}
            territoryId={territoryId}
            initialDrop={initialDrop}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export { NewTerritoryDropDialog };
