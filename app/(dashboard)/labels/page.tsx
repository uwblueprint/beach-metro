"use client";

import { Check, ChevronDown, ChevronRight, Printer, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PillGroup } from "@/components/ui/pill-group";
import { SearchBar } from "@/components/ui/search-bar";
import { Select } from "@/components/ui/select";
import { useExportLabels, useLabels, useMarkLabels } from "@/features/labels/api";
import type { BundleRef, LabelSheet } from "@/features/labels/api";
import { cn } from "@/lib/utils";

/**
 * Confirmed by design (Kristen, Slack, 2026-08-23; see design_decisions.md):
 * Carrier = a normal volunteer route, Commercial = a bulk drop at a business,
 * Residential = a bulk drop at an apartment/condo. Every row this page can
 * show today is Carrier — commercial/residential drops have no per-issue
 * delivery record yet (label_printing_flow.md §7) — so Commercial and
 * Residential correctly filter to nothing until that's built, not because
 * the filter is broken.
 */
type TypeFilter = "Carrier" | "Commercial" | "Residential" | "all";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "Carrier", label: "Carrier" },
  { value: "Commercial", label: "Commercial" },
  { value: "Residential", label: "Residential" },
  { value: "all", label: "All" },
];

/**
 * A bundle has no id of its own — it is the Nth entry in a delivery's `bundles`
 * array — so selection is keyed on the pair. Same encoding the mark and export
 * endpoints take as `BundleRef`.
 */
function bundleKey(deliveryId: string, bundleIndex: number): string {
  return `${deliveryId}:${bundleIndex}`;
}

function parseBundleKey(key: string): BundleRef {
  const at = key.lastIndexOf(":");
  return { deliveryId: key.slice(0, at), bundleIndex: Number(key.slice(at + 1)) };
}

// View shapes. The server speaks LabelSheet/LabelGroup/LabelRoute/LabelBundle;
// the rows below want something flatter, so the adapter is the only place the
// two vocabularies meet.
interface Bundle {
  id: string;
  number: number;
  papers: number;
  labelled: boolean;
}

interface Route {
  id: string;
  name: string;
  papers: number;
  bundles: Bundle[];
  type: "Carrier" | "Commercial" | "Residential";
}

interface Captain {
  id: string;
  name: string;
  routes: Route[];
}

function toCaptains(sheet: LabelSheet | undefined): Captain[] {
  if (!sheet) return [];
  return sheet.groups.map((group) => ({
    // A route whose captain is unset still needs labels printed, so the group
    // is kept and given a stable key rather than dropped.
    id: group.captainId ?? "unassigned",
    name: group.captainName,
    routes: group.routes.map((route) => ({
      id: route.deliveryId,
      name: route.routeName,
      papers: route.papers,
      bundles: route.bundles.map((bundle) => ({
        id: bundleKey(bundle.deliveryId, bundle.bundleIndex),
        number: bundle.bundleIndex + 1,
        papers: bundle.papers,
        labelled: bundle.labelled,
      })),
      // The server type is a literal "carrier" today (see LabelRoute in
      // lib/services/labels.ts) — capitalized here to match the pill labels
      // and the Type column's display casing. Widen this mapping once
      // commercial/residential drops get their own delivery records.
      type: "Carrier",
    })),
  }));
}

const COUNT_COL = "w-[min(18.2rem,24%)] shrink-0 text-left";
const TYPE_COL = "w-[min(12.75rem,17%)] shrink-0";
const LABELLED_COL = "w-[6.2rem] shrink-0";

function bundleLabel(bundle: Bundle) {
  return `Bundle ${bundle.number}`;
}

function routeMatchesName(route: Route, query: string) {
  return route.name.toLowerCase().includes(query);
}

function routeHasMatchingBundle(route: Route, query: string) {
  return route.bundles.some((bundle) => bundleLabel(bundle).toLowerCase().includes(query));
}

function routeMatchesSearch(route: Route, query: string) {
  if (!query) return true;
  return routeMatchesName(route, query) || routeHasMatchingBundle(route, query);
}

function labelledBundleCount(bundles: Bundle[]) {
  return bundles.filter((bundle) => bundle.labelled).length;
}

function isRouteFullyLabelled(route: Route) {
  return route.bundles.length > 0 && route.bundles.every((bundle) => bundle.labelled);
}

function formatPaperCount(papers: number) {
  return `${papers} ${papers === 1 ? "paper" : "papers"}`;
}

function formatBundleCount(route: Route) {
  const n = route.bundles.length;
  return `${n} ${n === 1 ? "bundle" : "bundles"}, ${formatPaperCount(route.papers)}`;
}

function toggleId(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function unlabelledBundles(route: Route) {
  return route.bundles.filter((bundle) => !bundle.labelled);
}

function routeBundleSelection(route: Route, selected: Set<string>) {
  const ids = unlabelledBundles(route).map((bundle) => bundle.id);
  const selectedCount = ids.filter((id) => selected.has(id)).length;
  return {
    checked: ids.length > 0 && selectedCount === ids.length,
    indeterminate: selectedCount > 0 && selectedCount < ids.length,
  };
}

function toggleRouteBundleSelection(route: Route, selected: Set<string>) {
  const ids = unlabelledBundles(route).map((bundle) => bundle.id);
  const next = new Set(selected);
  const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
  if (allSelected) {
    for (const id of ids) next.delete(id);
  } else {
    for (const id of ids) next.add(id);
  }
  return next;
}

function HoverCheckbox({
  checked,
  indeterminate = false,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center",
        !checked &&
          !indeterminate &&
          "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100",
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-label={label}
      />
    </span>
  );
}

export default function LabelsPage() {
  // undefined = the open issue, which is the everyday case. Setting this points
  // the screen at a past issue so a jammed or torn run can be reprinted.
  const [issueId, setIssueId] = useState<string | undefined>(undefined);
  const { data: sheet, isPending, isError, error } = useLabels(issueId);
  const markLabels = useMarkLabels();
  const exportLabels = useExportLabels();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [collapsedCaptains, setCollapsedCaptains] = useState<Set<string>>(new Set());
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [selectedBundleIds, setSelectedBundleIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const captains = useMemo(() => toCaptains(sheet), [sheet]);
  const totalBundles = sheet?.bundleCount ?? 0;

  // Reprint mode: the chosen issue has already shipped. Everything is normally
  // labelled already, so "export what is unlabelled" would find nothing.
  const isReprint = sheet != null && sheet.issue.status !== "open";
  const issueOptions = useMemo(
    () =>
      (sheet?.issues ?? []).map((i) => ({
        value: i.id,
        label: i.status === "open" ? `${i.name} (current)` : `${i.name} — ${i.date}`,
      })),
    [sheet],
  );

  const searchQuery = search.trim().toLowerCase();
  const revealResults = searchQuery.length > 0 || typeFilter !== "all";

  const visibleCaptains = useMemo(() => {
    return captains
      .map((captain) => ({
        ...captain,
        routes: captain.routes.filter(
          (route) =>
            (typeFilter === "all" || route.type === typeFilter) &&
            routeMatchesSearch(route, searchQuery),
        ),
      }))
      .filter((captain) => captain.routes.length > 0);
  }, [captains, searchQuery, typeFilter]);

  const selectedCount = selectedBundleIds.size;
  // Sheet still loading/failed counts as busy too, so Export can't run
  // against stale-empty data and claim "everything's already labelled."
  const busy = isPending || isError || markLabels.isPending || exportLabels.isPending;

  function clearSelection() {
    setSelectedBundleIds(new Set());
  }

  async function markSelectedLabelled() {
    setActionError(null);
    try {
      // The row state comes back from the refetch the mutation triggers, so
      // nothing is flipped locally: a failed write must not leave the table
      // claiming bundles are labelled when the server disagrees.
      await markLabels.mutateAsync({
        bundles: [...selectedBundleIds].map(parseBundleKey),
        labelled: true,
      });
      clearSelection();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not mark these labelled.");
    }
  }

  /**
   * Exports the ticked bundles, or every unlabelled one when nothing is ticked
   * — "print what still needs a label" is the common case. Exporting also marks
   * them labelled server-side, so this changes state rather than previewing.
   */
  async function handleExport() {
    setActionError(null);
    if (isPending || isError) return; // guarded by the disabled button; defensive here too
    const bundles: BundleRef[] =
      selectedBundleIds.size > 0
        ? [...selectedBundleIds].map(parseBundleKey)
        : captains.flatMap((captain) =>
            captain.routes.flatMap((route) =>
              // Reprinting takes every bundle; a live run takes only what has
              // not been labelled yet.
              route.bundles
                .filter((b) => isReprint || !b.labelled)
                .map((b) => parseBundleKey(b.id)),
            ),
          );

    if (bundles.length === 0) {
      setActionError(
        isReprint
          ? "Nothing to export: this issue has no bundles."
          : "Nothing to export: every bundle is already labelled.",
      );
      return;
    }

    try {
      await exportLabels.mutateAsync({ bundles, issueId: sheet?.issue.id });
      clearSelection();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not export labels.");
    }
  }

  return (
    <div className="page-container">
      <div className="page relative">
        <div className="flex h-full flex-col">
          <div className="page-header-container">
            <div className="flex items-center gap-2">
              <h1 className="text-md text-primary">Labels</h1>
              <p className="text-md text-secondary">
                {totalBundles} {totalBundles === 1 ? "bundle" : "bundles"}
              </p>
            </div>
            <Button
              variant="primary"
              type="button"
              onClick={() => void handleExport()}
              disabled={busy}
            >
              <Printer data-icon="inline-start" />
              Export Labels
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto p-4">
            <div className="flex items-center gap-2.5">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search by name"
                className="min-w-0 flex-1"
              />
              <PillGroup
                exclusive
                options={TYPE_FILTERS}
                value={typeFilter}
                onChange={(value) => {
                  if (value != null) setTypeFilter(value as TypeFilter);
                }}
                className="shrink-0"
              />
              {issueOptions.length > 1 ? (
                <Select
                  aria-label="Issue"
                  value={sheet?.issue.id ?? ""}
                  onChange={(value) => {
                    // Selecting the open issue clears the override, so the screen
                    // goes back to following whichever issue is current.
                    const picked = sheet?.issues.find((i) => i.id === value);
                    setIssueId(picked && picked.status === "open" ? undefined : value);
                    clearSelection();
                  }}
                  options={issueOptions}
                  className="shrink-0"
                />
              ) : null}
            </div>

            {actionError ? (
              <Banner variant="danger" onDismiss={() => setActionError(null)}>
                {actionError}
              </Banner>
            ) : null}

            <div className="flex w-full flex-col gap-1">
              <div className="flex h-10 w-full items-center px-2 py-1 text-md text-secondary">
                <span className="min-w-0 flex-1">Bundle</span>
                <span className={COUNT_COL}>Count</span>
                <span className={TYPE_COL}>Type</span>
                <span className={LABELLED_COL}>Labelled</span>
              </div>

              {isPending ? (
                <p className="text-md text-secondary p-2">Loading…</p>
              ) : isError ? (
                <p className="text-md text-secondary p-2">
                  {error instanceof Error ? error.message : "Could not load labels."}
                </p>
              ) : visibleCaptains.length === 0 ? (
                <p className="text-md text-secondary p-2">
                  {search.trim()
                    ? `No routes match “${search.trim()}”.`
                    : "No bundles to label for this issue."}
                </p>
              ) : (
                visibleCaptains.map((captain) => {
                  const captainExpanded = revealResults || !collapsedCaptains.has(captain.id);
                  const labelledRoutes = captain.routes.filter(isRouteFullyLabelled).length;

                  return (
                    <div key={captain.id} className="flex flex-col gap-1">
                      <button
                        type="button"
                        aria-expanded={captainExpanded}
                        onClick={() =>
                          setCollapsedCaptains((current) => toggleId(current, captain.id))
                        }
                        className="flex h-10 w-full items-center gap-0 rounded-md bg-tag p-2 text-left transition-colors hover:bg-tag-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center">
                          {captainExpanded ? (
                            <ChevronDown className="size-4 text-primary" />
                          ) : (
                            <ChevronRight className="size-4 text-primary" />
                          )}
                        </span>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-md text-primary">{captain.name}</span>
                          <span className="text-md text-secondary">
                            {labelledRoutes}/{captain.routes.length} labelled
                          </span>
                        </span>
                      </button>

                      {captainExpanded
                        ? captain.routes.map((route) => {
                            const routeExpanded = revealResults || expandedRoutes.has(route.id);
                            const labelled = labelledBundleCount(route.bundles);
                            const selection = routeBundleSelection(route, selectedBundleIds);

                            return (
                              <div key={route.id} className="flex flex-col gap-1">
                                <div className="group/row flex h-10 w-full cursor-pointer items-center rounded-md p-2 transition-colors hover:bg-tag-hover">
                                  <div className="flex min-w-0 flex-1 items-center">
                                    <HoverCheckbox
                                      checked={selection.checked}
                                      indeterminate={selection.indeterminate}
                                      onCheckedChange={() => {
                                        setSelectedBundleIds((current) =>
                                          toggleRouteBundleSelection(route, current),
                                        );
                                      }}
                                      label={`Select ${route.name}`}
                                    />
                                    <button
                                      type="button"
                                      aria-expanded={routeExpanded}
                                      onClick={() =>
                                        setExpandedRoutes((current) => toggleId(current, route.id))
                                      }
                                      className="flex min-w-0 flex-1 items-center text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                                    >
                                      <span className="flex size-6 shrink-0 items-center justify-center">
                                        {routeExpanded ? (
                                          <ChevronDown className="size-4 text-primary" />
                                        ) : (
                                          <ChevronRight className="size-4 text-primary" />
                                        )}
                                      </span>
                                      <span className="min-w-0 flex-1 truncate text-md text-primary">
                                        {route.name}
                                      </span>
                                    </button>
                                  </div>
                                  <span className={cn("truncate text-md text-primary", COUNT_COL)}>
                                    {formatBundleCount(route)}
                                  </span>
                                  <span className={cn("truncate text-md text-secondary", TYPE_COL)}>
                                    {route.type}
                                  </span>
                                  <span
                                    className={cn("truncate text-md text-secondary", LABELLED_COL)}
                                  >
                                    {labelled}/{route.bundles.length}
                                  </span>
                                </div>

                                {routeExpanded
                                  ? route.bundles.map((bundle) => (
                                      <div
                                        key={bundle.id}
                                        className="group/row flex h-10 w-full items-center rounded-md p-2 transition-colors hover:bg-tag-hover"
                                      >
                                        <div className="flex min-w-0 flex-1 items-center">
                                          <span className="size-6 shrink-0" aria-hidden />
                                          {bundle.labelled ? (
                                            <span className="size-6 shrink-0" aria-hidden />
                                          ) : (
                                            <HoverCheckbox
                                              checked={selectedBundleIds.has(bundle.id)}
                                              onCheckedChange={(checked) => {
                                                setSelectedBundleIds((current) => {
                                                  const next = new Set(current);
                                                  if (checked) next.add(bundle.id);
                                                  else next.delete(bundle.id);
                                                  return next;
                                                });
                                              }}
                                              label={`Select Bundle ${bundle.number} on ${route.name}`}
                                            />
                                          )}
                                          <span className="flex min-w-0 flex-1 items-center gap-2">
                                            <span className="truncate text-md text-primary">
                                              {bundleLabel(bundle)}
                                            </span>
                                            <span
                                              className={cn(
                                                "flex w-[99px] shrink-0 items-center",
                                                bundle.labelled
                                                  ? "text-green-500"
                                                  : "text-muted-foreground",
                                              )}
                                              aria-label={
                                                bundle.labelled ? "Labelled" : "Not labelled"
                                              }
                                            >
                                              {bundle.labelled ? (
                                                <Check
                                                  aria-hidden
                                                  className="size-[14px]"
                                                  strokeWidth={2.5}
                                                />
                                              ) : (
                                                "—"
                                              )}
                                            </span>
                                          </span>
                                        </div>
                                        <span
                                          className={cn(
                                            "truncate text-md text-muted-foreground",
                                            COUNT_COL,
                                          )}
                                        >
                                          {formatPaperCount(bundle.papers)}
                                        </span>
                                        <span className={TYPE_COL} />
                                        <span className={LABELLED_COL} />
                                      </div>
                                    ))
                                  : null}
                              </div>
                            );
                          })
                        : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {selectedCount > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-4 rounded-xl bg-bg px-5 py-2.5 shadow-[0_2px_3px_rgba(0,0,0,0.1)]">
              <p className="text-md text-primary">{selectedCount} selected</p>
              <Button
                type="button"
                variant="text"
                className="bg-active-grey hover:bg-secondary-fill-hover"
                onClick={() => void markSelectedLabelled()}
                disabled={busy}
              >
                {markLabels.isPending ? "Marking…" : "Mark labelled"}
              </Button>
              <Button
                type="button"
                variant="text"
                size="icon-sm"
                aria-label="Clear selection"
                onClick={clearSelection}
              >
                <X className="size-4" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
