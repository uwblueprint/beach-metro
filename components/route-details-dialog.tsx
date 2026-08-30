"use client";

import { useEffect, useMemo, useState } from "react";

import { AddressField } from "@/components/address-field";
import { BundlePapersTable, papersRowsDiffer } from "@/components/bundle-papers-table";
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
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { baselineLabelledForRoute, diffLabelMarks, labelledArraysEqual } from "@/lib/bundle-labels";
import { greedySplit } from "@/lib/services/derive";
import type { RouteDetail } from "@/lib/services/routes";
import { useLabels, type LabelSheet } from "@/features/labels/api";
import {
  useCreateRoute,
  useRouteDetail,
  useUpdateRoute,
  type RouteSide,
} from "@/features/routes/api";

export interface RouteDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volunteerId: string;
  /** When set, dialog loads and edits that route; otherwise create mode. */
  routeId?: string | null;
  onSuccess?: () => void;
}

/** "" is the "no direction recorded" choice; the rest mirror the RouteSide enum. */
const DIRECTION_OPTIONS: { value: RouteSide | ""; label: string }[] = [
  { value: "", label: "— none —" },
  { value: "NORTH", label: "North" },
  { value: "SOUTH", label: "South" },
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "BOTH", label: "Both" },
];

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
  side: RouteSide | "";
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
    side: "",
    startEditingLast: true,
  };
}

function toBundles(rows: number[]): Array<{ papers: number }> {
  return rows.filter((p) => p > 0).map((papers) => ({ papers }));
}

function findLabelRoute(sheet: LabelSheet | undefined, routeId: string) {
  if (!sheet) return null;
  for (const group of sheet.groups) {
    const route = group.routes.find((r) => r.routeId === routeId);
    if (route) return route;
  }
  return null;
}

function formHasChanges(
  initial: FormState,
  current: {
    streetName: string;
    startAddress: string;
    endAddress: string;
    startPlaceId: string | null;
    endPlaceId: string | null;
    papersRows: number[];
    note: string;
    side: RouteSide | "";
    labelled: boolean[];
    baselineLabelled: boolean[];
  },
): boolean {
  if (current.streetName.trim() !== initial.streetName) return true;
  if (current.note.trim() !== initial.note) return true;
  if (current.side !== initial.side) return true;
  if (
    current.startAddress.trim() !== initial.startAddress ||
    current.startPlaceId !== initial.startPlaceId
  ) {
    return true;
  }
  if (
    current.endAddress.trim() !== initial.endAddress ||
    current.endPlaceId !== initial.endPlaceId
  ) {
    return true;
  }
  if (!labelledArraysEqual(current.labelled, current.baselineLabelled)) return true;
  return papersRowsDiffer(current.papersRows, initial.papersRows);
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
    side: (detail.side ?? "") as RouteSide | "",
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
  const labels = useLabels();

  const [streetName, setStreetName] = useState(initial.streetName);
  const [startAddress, setStartAddress] = useState(initial.startAddress);
  const [endAddress, setEndAddress] = useState(initial.endAddress);
  const [startPlaceId, setStartPlaceId] = useState(initial.startPlaceId);
  const [endPlaceId, setEndPlaceId] = useState(initial.endPlaceId);
  const [papersRows, setPapersRows] = useState(initial.papersRows);
  const [note, setNote] = useState(initial.note);
  const [side, setSide] = useState(initial.side);
  const [error, setError] = useState<string | null>(null);
  const [papersValid, setPapersValid] = useState(true);
  const [labelledRows, setLabelledRows] = useState<boolean[] | null>(null);

  useEffect(() => {
    setLabelledRows(null);
  }, [routeId]);

  const labelRoute = routeId ? findLabelRoute(labels.data, routeId) : null;
  const baselineLabelled = useMemo(
    () => baselineLabelledForRoute(papersRows.length, labelRoute?.bundles),
    [papersRows.length, labelRoute?.bundles],
  );
  const currentLabelled = labelledRows ?? baselineLabelled;

  const busy = createRoute.isPending || updateRoute.isPending;
  const hasChanges = formHasChanges(initial, {
    streetName,
    startAddress,
    endAddress,
    startPlaceId,
    endPlaceId,
    papersRows,
    note,
    side,
    labelled: currentLabelled,
    baselineLabelled,
  });
  const canConfirm = papersValid && (!isEdit || hasChanges);

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
    if (bundles.length === 0) {
      // Without this the route saves with papers = 0: the API accepts an empty
      // bundle list, and the sum-equals-papers check passes trivially (0 = 0).
      setError("Add at least one bundle with a paper count.");
      return;
    }
    const resolveAddress = (line: string, placeId: string | null) =>
      placeId ? { placeId } : { addressLines: [line] };

    try {
      if (isEdit && routeId) {
        const body: Parameters<typeof updateRoute.mutateAsync>[0]["body"] = {
          streetName: name,
          bundles,
          note: note.trim() || null,
          side: side || null,
        };
        if (start !== initial.initialStartLabel || startPlaceId !== initial.startPlaceId) {
          body.startAddress = resolveAddress(start, startPlaceId);
        }
        if (end !== initial.initialEndLabel || endPlaceId !== initial.endPlaceId) {
          body.endAddress = resolveAddress(end, endPlaceId);
        }
        await updateRoute.mutateAsync({ id: routeId, body });
        if (labelRoute && labelledRows && !labelledArraysEqual(labelledRows, baselineLabelled)) {
          const { mark, unmark } = diffLabelMarks(
            labelRoute.deliveryId,
            baselineLabelled,
            labelledRows,
          );
          const markCalls = [];
          if (mark.length > 0) {
            markCalls.push(
              fetch("/api/labels/mark", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ bundles: mark, labelled: true }),
              }),
            );
          }
          if (unmark.length > 0) {
            markCalls.push(
              fetch("/api/labels/mark", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ bundles: unmark, labelled: false }),
              }),
            );
          }
          const results = await Promise.all(markCalls);
          for (const res of results) {
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as {
                error?: { message?: string };
              } | null;
              throw new ApiError(
                "internal",
                body?.error?.message ?? "Could not save label changes.",
                res.status,
              );
            }
          }
        }
      } else {
        await createRoute.mutateAsync({
          streetName: name,
          startAddress: resolveAddress(start, startPlaceId),
          endAddress: resolveAddress(end, endPlaceId),
          assignedVolunteerId: volunteerId,
          houseCount: 0,
          bundles,
          note: note.trim() || null,
          side: side || null,
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
          <Label htmlFor="route-direction" className="text-md font-normal text-primary">
            Direction
          </Label>
          <Select
            id="route-direction"
            value={side}
            // Select is string-typed; DIRECTION_OPTIONS is the only source of
            // values, so narrowing back to the union here is safe.
            onChange={(value) => setSide(value as RouteSide | "")}
            options={DIRECTION_OPTIONS}
          />
        </DialogField>
        <DialogField>
          <BundlePapersTable
            value={papersRows}
            onChange={setPapersRows}
            labelled={currentLabelled}
            onLabelledChange={setLabelledRows}
            startEditingLast={initial.startEditingLast}
            onValidityChange={setPapersValid}
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
        <Button
          variant="primary"
          disabled={busy || !canConfirm}
          onClick={() => void handleConfirm()}
        >
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
