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
import { inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  useAddCommercialDrop,
  useAssignVolunteerToTerritory,
  useCommercialDropCandidates,
  useVolunteersList,
} from "@/features/territory-drops/api";

export type DropSelection =
  | { kind: "volunteer"; volunteerId: string; label: string }
  | {
      kind: "commercial";
      addressId: string;
      placeId: string;
      label: string;
      territoryId: string | null;
    };

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

function volunteerLabel(
  firstName: string,
  lastName: string,
  assigned: boolean,
  retired: boolean,
): string {
  const name = `${firstName} ${lastName}`;
  if (retired) return `${name} (retired)`;
  return assigned ? `${name} (assigned)` : name;
}

function commercialLabel(address: string, assigned: boolean): string {
  return assigned ? `${address} (assigned)` : address;
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
  const { data: commercialDrops = [] } = useCommercialDropCandidates();

  const assignVolunteer = useAssignVolunteerToTerritory();
  const addCommercialDrop = useAddCommercialDrop();

  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<DropSelection | null>(initialDrop);
  const [error, setError] = useState<string | null>(null);

  const candidateOptions: ComboboxOption[] = useMemo(() => {
    const volunteerOptions: Array<ComboboxOption & { assigned: boolean }> = volunteers.map((v) => {
      const assigned = v.territory !== null;
      const retired = v.status === "retired";
      return {
        value: `volunteer:${v.id}`,
        label: volunteerLabel(v.firstName, v.lastName, assigned, retired),
        assigned: assigned || retired,
      };
    });

    const addressOptions: Array<ComboboxOption & { assigned: boolean }> = commercialDrops.map(
      (d) => {
        const assigned = d.territoryId !== null;
        return {
          value: `commercial:${d.addressId}`,
          label: commercialLabel(d.label, assigned),
          badge: d.territoryBadge,
          assigned,
        };
      },
    );

    const all = [...volunteerOptions, ...addressOptions].sort((a, b) => {
      if (a.assigned !== b.assigned) return a.assigned ? 1 : -1;
      return a.label.localeCompare(b.label);
    });

    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.badge?.toLowerCase().includes(q) ?? false),
    );
  }, [volunteers, commercialDrops, query]);

  const hasSelection = !!selection;
  const mutationsPending = assignVolunteer.isPending || addCommercialDrop.isPending;
  const canConfirm = hasSelection && !!territoryId && !mutationsPending;

  const confirmBlockedReason = !hasSelection
    ? null
    : !territoryId
      ? "This captain’s territory isn’t available yet, so Confirm stays disabled."
      : null;

  const displayValue = selection?.label ?? null;

  function selectOption(option: ComboboxOption) {
    if (option.value.startsWith("volunteer:")) {
      const volunteerId = option.value.slice("volunteer:".length);
      setSelection({ kind: "volunteer", volunteerId, label: option.label });
      setQuery("");
      return;
    }
    if (option.value.startsWith("commercial:")) {
      const addressId = option.value.slice("commercial:".length);
      const drop = commercialDrops.find((d) => d.addressId === addressId);
      if (!drop) return;
      setSelection({
        kind: "commercial",
        addressId: drop.addressId,
        placeId: drop.placeId,
        label: option.label,
        territoryId: drop.territoryId,
      });
      setQuery("");
    }
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
      ((selection.kind === "volunteer" &&
        initialDrop.kind === "volunteer" &&
        selection.volunteerId === initialDrop.volunteerId) ||
        (selection.kind === "commercial" &&
          initialDrop.kind === "commercial" &&
          selection.addressId === initialDrop.addressId &&
          selection.territoryId === territoryId))
    ) {
      onOpenChange(false);
      return;
    }

    try {
      if (selection.kind === "volunteer") {
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
                : selection?.kind === "commercial"
                  ? `commercial:${selection.addressId}`
                  : null
            }
            displayValue={displayValue}
            query={query}
            onQueryChange={(next) => {
              setQuery(next);
              if (selection) setSelection(null);
            }}
            onSelect={selectOption}
            options={candidateOptions}
            placeholder="Input text"
          />
        </DialogField>

        <DialogDescription>
          Selecting a drop with an existing territory will re-allocate it.
        </DialogDescription>

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
