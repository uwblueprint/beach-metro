"use client";

import { useState } from "react";

import { AddressField } from "@/components/address-field";
import { BundlePapersTable } from "@/components/bundle-papers-table";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { greedySplit } from "@/lib/services/derive";
import type { RouteDetail } from "@/lib/services/routes";
import { useCreateRoute, useRouteDetail, useUpdateRoute } from "@/features/routes/api";

export interface RouteDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volunteerId: string;
  /** When set, dialog loads and edits that route; otherwise create mode. */
  routeId?: string | null;
  onSuccess?: () => void;
}

type FormState = {
  streetName: string;
  startAddress: string;
  endAddress: string;
  startPlaceId: string | null;
  endPlaceId: string | null;
  initialStartLabel: string;
  initialEndLabel: string;
  papersRows: number[];
  note: string;
  startEditingLast: boolean;
};

function blankForm(): FormState {
  return {
    streetName: "",
    startAddress: "",
    endAddress: "",
    startPlaceId: null,
    endPlaceId: null,
    initialStartLabel: "",
    initialEndLabel: "",
    papersRows: [0],
    note: "",
    startEditingLast: true,
  };
}

function formFromDetail(detail: RouteDetail): FormState {
  const startLabel = detail.startAddress.formattedAddress ?? "";
  const endLabel = detail.endAddress.formattedAddress ?? "";
  const rows =
    detail.bundles.length > 0
      ? detail.bundles.map((b) => b.papers)
      : greedySplit(detail.papers).map((b) => b.papers);
  return {
    streetName: detail.streetName,
    startAddress: startLabel,
    endAddress: endLabel,
    startPlaceId: detail.startAddress.placeId,
    endPlaceId: detail.endAddress.placeId,
    initialStartLabel: startLabel,
    initialEndLabel: endLabel,
    papersRows: rows.length > 0 ? rows : [0],
    note: detail.notes ?? "",
    startEditingLast: false,
  };
}

function RouteDetailsFields({
  volunteerId,
  routeId,
  initial,
  onOpenChange,
  onSuccess,
}: {
  volunteerId: string;
  routeId: string | null;
  initial: FormState;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const isEdit = !!routeId;
  const createRoute = useCreateRoute(volunteerId);
  const updateRoute = useUpdateRoute(volunteerId);

  const [streetName, setStreetName] = useState(initial.streetName);
  const [startAddress, setStartAddress] = useState(initial.startAddress);
  const [endAddress, setEndAddress] = useState(initial.endAddress);
  const [startPlaceId, setStartPlaceId] = useState(initial.startPlaceId);
  const [endPlaceId, setEndPlaceId] = useState(initial.endPlaceId);
  const [papersRows, setPapersRows] = useState(initial.papersRows);
  const [note, setNote] = useState(initial.note);
  const [error, setError] = useState<string | null>(null);

  const busy = createRoute.isPending || updateRoute.isPending;

  async function handleConfirm() {
    setError(null);
    const name = streetName.trim();
    const start = startAddress.trim();
    const end = endAddress.trim();
    if (!name) {
      setError("Semantic name is required.");
      return;
    }
    if (!start || !end) {
      setError("Start and end addresses are required.");
      return;
    }

    const bundles = papersRows.filter((p) => p > 0).map((papers) => ({ papers }));
    const resolveAddress = (line: string, placeId: string | null) =>
      placeId ? { placeId } : { addressLines: [line] };

    try {
      if (isEdit && routeId) {
        const body: Parameters<typeof updateRoute.mutateAsync>[0]["body"] = {
          streetName: name,
          bundles,
          note: note.trim() || null,
        };
        if (start !== initial.initialStartLabel || startPlaceId !== initial.startPlaceId) {
          body.startAddress = resolveAddress(start, startPlaceId);
        }
        if (end !== initial.initialEndLabel || endPlaceId !== initial.endPlaceId) {
          body.endAddress = resolveAddress(end, endPlaceId);
        }
        await updateRoute.mutateAsync({ id: routeId, body });
      } else {
        await createRoute.mutateAsync({
          streetName: name,
          startAddress: resolveAddress(start, startPlaceId),
          endAddress: resolveAddress(end, endPlaceId),
          assignedVolunteerId: volunteerId,
          houseCount: 0,
          bundles,
          note: note.trim() || null,
        });
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Route Details</DialogTitle>
        <DialogDescription className="sr-only">
          {isEdit ? "Edit route details" : "Create a new route for this volunteer"}
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <DialogField>
          <Label htmlFor="route-semantic-name" className="text-md font-normal text-primary">
            Semantic Name
          </Label>
          <Input
            id="route-semantic-name"
            value={streetName}
            onChange={(e) => setStreetName(e.target.value)}
            placeholder="Queen St E · Woodbine → Coxwell"
          />
        </DialogField>
        <DialogField>
          <AddressField
            id="route-start"
            label="Start Address"
            placeholder="123 Queen St"
            value={startAddress}
            onChange={(text) => {
              setStartAddress(text);
              setStartPlaceId(null);
            }}
            onPick={(placeId, text) => {
              setStartPlaceId(placeId);
              setStartAddress(text);
            }}
          />
        </DialogField>
        <DialogField>
          <AddressField
            id="route-end"
            label="End Address"
            placeholder="187 Queen St"
            value={endAddress}
            onChange={(text) => {
              setEndAddress(text);
              setEndPlaceId(null);
            }}
            onPick={(placeId, text) => {
              setEndPlaceId(placeId);
              setEndAddress(text);
            }}
          />
        </DialogField>
        <DialogField>
          <BundlePapersTable
            value={papersRows}
            onChange={setPapersRows}
            startEditingLast={initial.startEditingLast}
          />
        </DialogField>
        <DialogField>
          <Label htmlFor="route-notes" className="text-md font-normal text-primary">
            Route Notes <span className="text-secondary">(optional)</span>
          </Label>
          <Input
            id="route-notes"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional notes"
          />
        </DialogField>
        {error ? <p className="text-md text-destructive">{error}</p> : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose render={<Button variant="default" disabled={busy} />}>Cancel</DialogClose>
        <Button variant="primary" disabled={busy} onClick={() => void handleConfirm()}>
          Confirm
        </Button>
      </DialogFooter>
    </>
  );
}

function EditRouteLoader({
  volunteerId,
  routeId,
  onOpenChange,
  onSuccess,
}: {
  volunteerId: string;
  routeId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { data: detail, isPending, isError } = useRouteDetail(routeId, true);

  if (isPending) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Route Details</DialogTitle>
        </DialogHeader>
        <DialogBody />
        <DialogFooter>
          <DialogClose render={<Button variant="default" />}>Cancel</DialogClose>
        </DialogFooter>
      </>
    );
  }

  if (isError || !detail) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Route Details</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-md text-destructive">Could not load this route.</p>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="default" />}>Cancel</DialogClose>
        </DialogFooter>
      </>
    );
  }

  return (
    <RouteDetailsFields
      key={detail.id}
      volunteerId={volunteerId}
      routeId={routeId}
      initial={formFromDetail(detail)}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  );
}

function RouteDetailsDialog({
  open,
  onOpenChange,
  volunteerId,
  routeId = null,
  onSuccess,
}: RouteDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          routeId ? (
            <EditRouteLoader
              volunteerId={volunteerId}
              routeId={routeId}
              onOpenChange={onOpenChange}
              onSuccess={onSuccess}
            />
          ) : (
            <RouteDetailsFields
              key="new"
              volunteerId={volunteerId}
              routeId={null}
              initial={blankForm()}
              onOpenChange={onOpenChange}
              onSuccess={onSuccess}
            />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export { RouteDetailsDialog };
