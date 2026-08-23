"use client";

// Functional routes page: map + filterable list + detail/edit panel, all driven
// by the real API. This is the wiring layer (data, selection, filters, save,
// assign) — the design engineers restyle it. Structural Tailwind only.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Filter, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { SidePanelRow } from "@/components/side-panel-row";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressField } from "@/components/address-field";
import { Pill } from "@/components/ui/pill";
import { PillGroup } from "@/components/ui/pill-group";
import { SearchBar } from "@/components/ui/search-bar";
import { greedySplit } from "@/lib/services/derive";
import { cn } from "@/lib/utils";

import {
  RouteMap,
  type DeliveryTypeFilter,
  type FilterPlacement,
  type MapHome,
  type MapRoute,
  type VacancyFilter,
} from "./route-map";
import { RouteTag } from "./route-tag";

const SIDE_OPTIONS = [
  { value: "", label: "— none —" },
  { value: "NORTH", label: "North" },
  { value: "SOUTH", label: "South" },
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "BOTH", label: "Both" },
] as const;

/** Input-shell trigger — same class as testing InputsSection dropdowns. */
const inputTriggerClassName =
  "flex h-auto w-full cursor-pointer items-center justify-between gap-2 rounded-[8px] border border-hairline bg-bg px-3 py-2 text-left text-md text-primary outline-none transition-colors focus-visible:border-active focus-visible:ring-3 focus-visible:ring-active/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:text-disabled disabled:opacity-50";

function routeLabel(r: RouteSummary): string {
  const start = r.startLabel ?? "";
  const end = r.endLabel ?? "";
  if (start && end) return `${r.streetName} · ${start} → ${end}`;
  return r.streetName;
}

/* ---------- API shapes (subset the page uses) ---------- */

interface RouteSummary {
  id: string;
  streetName: string;
  side: string | null;
  lifecycle: "assigned" | "vacant";
  suspended: boolean;
  needsAttention: boolean;
  effectiveHouseCount: number;
  papers: number;
  assignedVolunteer: { id: string; firstName: string; lastName: string; status: string } | null;
  captain: { id: string; name: string } | null;
  start: { latitude: number; longitude: number } | null;
  end: { latitude: number; longitude: number } | null;
  startLabel?: string | null;
  endLabel?: string | null;
}
interface RouteDetail extends RouteSummary {
  notes: string | null;
  startAddress: { formattedAddress: string | null };
  endAddress: { formattedAddress: string | null };
}
interface VolunteerSummary {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  home: { latitude: number; longitude: number } | null;
}

/* ---------- fetch helpers ---------- */

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  return json.data as T;
}
async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  return json.data as T;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

type Vacancy = VacancyFilter;

const ASSIGNED_OPTIONS = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "vacant", label: "Vacant" },
] as const;

const DELIVERY_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "routes", label: "Routes" },
  { value: "drops", label: "Drops" },
] as const;

function deliveryTypeLabel(value: DeliveryTypeFilter): string {
  return DELIVERY_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function vacancyLabel(value: Vacancy): string {
  return ASSIGNED_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function readCssDurationMsFrom(el: Element, variable: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(variable).trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw) || fallback;
}

/** Collapsible filter block in the Deliveries side panel (Figma filter subsection). */
function DeliveriesFilterSection(props: {
  search: string;
  onSearchChange: (value: string) => void;
  filterOpen: boolean;
  onFilterToggle: () => void;
  vacancy: Vacancy;
  onVacancyChange: (value: Vacancy) => void;
  deliveryType: DeliveryTypeFilter;
  onDeliveryTypeChange: (value: DeliveryTypeFilter) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filterInnerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filterClosing, setFilterClosing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterHeight, setFilterHeight] = useState(0);

  const filterVisible = props.filterOpen || filterClosing;
  const showActivePills =
    props.filterOpen && (props.deliveryType !== "all" || props.vacancy !== "all");

  useLayoutEffect(() => {
    if (props.filterOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setFilterClosing(false);
      setDropdownOpen(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDropdownOpen(true);
          setFilterHeight(filterInnerRef.current?.scrollHeight ?? 0);
        });
      });
      return;
    }

    if (!filterClosing && filterHeight === 0) return;

    setDropdownOpen(false);
    setFilterHeight(0);
    setFilterClosing(true);
    const el = containerRef.current;
    const closeMs = el
      ? Math.max(
          readCssDurationMsFrom(el, "--dropdown-close-dur", 100),
          readCssDurationMsFrom(el, "--resize-dur", 150),
        )
      : 150;
    closeTimerRef.current = setTimeout(() => {
      setFilterClosing(false);
      closeTimerRef.current = null;
    }, closeMs);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.filterOpen]);

  useLayoutEffect(() => {
    if (!dropdownOpen || !filterInnerRef.current) return;
    setFilterHeight(filterInnerRef.current.scrollHeight);
  }, [dropdownOpen, props.vacancy, props.deliveryType]);

  return (
    <div
      ref={containerRef}
      className="shrink-0 border-b border-border py-4 pr-4 pl-3"
      style={
        {
          "--resize-dur": "150ms",
          "--dropdown-open-dur": "150ms",
          "--dropdown-close-dur": "100ms",
        } as CSSProperties
      }
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2.5">
          <SearchBar
            value={props.search}
            onChange={props.onSearchChange}
            placeholder="Search Delivery"
            className="min-w-0 flex-1"
          />

          {showActivePills && (
            <div className="flex shrink-0 items-center gap-2">
              {props.deliveryType !== "all" && (
                <Pill selected>{deliveryTypeLabel(props.deliveryType)}</Pill>
              )}
              {props.vacancy !== "all" && <Pill selected>{vacancyLabel(props.vacancy)}</Pill>}
            </div>
          )}

          <Button
            variant="outline"
            size="icon"
            shape="rounded"
            aria-label="Toggle filters"
            aria-expanded={props.filterOpen}
            className={cn(
              "size-8 shrink-0 hover:bg-tag-hover",
              props.filterOpen || filterClosing
                ? "border-active-border bg-tag-active text-active hover:bg-tag-active-hover"
                : "border-border bg-bg",
            )}
            onClick={props.onFilterToggle}
          >
            <Filter className="size-4" />
          </Button>
        </div>

        <div className="t-resize overflow-hidden" style={{ height: filterHeight }}>
          {filterVisible && (
            <div
              ref={filterInnerRef}
              className={cn(
                "t-dropdown flex flex-col gap-5 pt-5",
                dropdownOpen && "is-open",
                filterClosing && "is-closing",
              )}
              data-origin="top-left"
            >
              <div className="flex flex-col gap-2">
                <p className="text-sm text-secondary">Delivery Type</p>
                <PillGroup
                  exclusive
                  options={[...DELIVERY_TYPE_OPTIONS]}
                  value={props.deliveryType}
                  onChange={(value) => {
                    if (value != null) props.onDeliveryTypeChange(value as DeliveryTypeFilter);
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-secondary">Assigned</p>
                <PillGroup
                  exclusive
                  options={[...ASSIGNED_OPTIONS]}
                  value={props.vacancy}
                  onChange={(value) => {
                    if (value != null) props.onVacancyChange(value as Vacancy);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RoutesClient() {
  const qc = useQueryClient();
  const [vacancy, setVacancy] = useState<Vacancy>("all");
  const [q, setQ] = useState("");
  const [showHomes, setShowHomes] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [deliveryType, setDeliveryType] = useState<DeliveryTypeFilter>("routes");
  // TEMP: Shift+F toggles filter UI between map overlay and side panel.
  const [filterPlacement, setFilterPlacement] = useState<FilterPlacement>("sidepanel");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "F" || !e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setFilterPlacement((p) => (p === "map" ? "sidepanel" : "map"));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (vacancy !== "all") params.set("vacancy", vacancy);
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    return `/api/routes${qs ? `?${qs}` : ""}`;
  }, [vacancy, q]);

  const routes = useQuery({
    queryKey: ["routes", vacancy, q],
    queryFn: () => getJson<RouteSummary[]>(listUrl),
  });
  const volunteers = useQuery({
    queryKey: ["volunteers", "for-map"],
    queryFn: () => getJson<VolunteerSummary[]>("/api/volunteers"),
  });
  const paths = useQuery({
    queryKey: ["route-paths"],
    queryFn: () =>
      getJson<{ id: string; path: { lat: number; lng: number }[] }[]>("/api/routes/paths"),
    staleTime: 5 * 60_000,
  });
  const pathById = useMemo(
    () => new Map((paths.data ?? []).map((p) => [p.id, p.path])),
    [paths.data],
  );

  const mapRoutes: MapRoute[] = (routes.data ?? [])
    // Drops aren't on this map yet — Type=Drops shows an empty set for now.
    .filter(() => deliveryType !== "drops")
    .map((r) => ({
      id: r.id,
      streetName: r.streetName,
      lifecycle: r.lifecycle,
      suspended: r.suspended,
      needsAttention: r.needsAttention,
      start: r.start,
      end: r.end,
      path: pathById.get(r.id) ?? null,
      label: routeLabel(r),
      volunteerName: r.assignedVolunteer
        ? `${r.assignedVolunteer.firstName} ${r.assignedVolunteer.lastName}`
        : null,
      bundleCount: greedySplit(Math.max(0, Math.floor(r.papers))).length,
      papers: r.papers,
    }));
  const listRoutes = deliveryType === "drops" ? [] : (routes.data ?? []);
  const mapHomes: MapHome[] = showHomes
    ? (volunteers.data ?? []).map((v) => ({
        id: v.id,
        name: `${v.firstName} ${v.lastName}`,
        home: v.home,
      }))
    : [];

  return (
    <div className="page-container">
      <div className="page flex flex-col overflow-hidden">
        <div className="page-header-container">
          <div className="flex items-center gap-2">
            <h1 className="text-md text-primary">Routes</h1>
            <p className="text-md text-secondary">
              {routes.data ? `Showing ${routes.data.length}` : "Loading…"}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              setSelectedId(null);
              setCreating(true);
            }}
          >
            <Plus data-icon="inline-start" />
            Add Route
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Map — fills available space, no rounding/padding */}
          <div className="min-h-0 min-w-0 flex-1">
            <RouteMap
              routes={mapRoutes}
              homes={mapHomes}
              selectedId={selectedId}
              onSelect={(id) => {
                setCreating(false);
                setSelectedId(id);
              }}
              filterPlacement={filterPlacement}
              search={q}
              onSearchChange={setQ}
              filterOpen={filterOpen}
              onFilterToggle={() => setFilterOpen((o) => !o)}
              vacancy={vacancy}
              onVacancyChange={setVacancy}
              deliveryType={deliveryType}
              onDeliveryTypeChange={setDeliveryType}
            />
          </div>

          {/* Right panel — border-left, no rounding, matches member side panel structure */}
          <div className="flex h-full w-[400px] shrink-0 flex-col border-l border-border bg-bg">
            {creating ? (
              <CreateRoutePanel
                onClose={() => setCreating(false)}
                onCreated={(id) => {
                  setCreating(false);
                  setSelectedId(id);
                  qc.invalidateQueries({ queryKey: ["routes"] });
                  qc.invalidateQueries({ queryKey: ["route-paths"] });
                }}
              />
            ) : selectedId ? (
              <RouteDetailPanel
                routeId={selectedId}
                onClose={() => setSelectedId(null)}
                onChanged={() => {
                  qc.invalidateQueries({ queryKey: ["routes"] });
                  qc.invalidateQueries({ queryKey: ["route", selectedId] });
                }}
              />
            ) : (
              <>
                <div className="page-header-container !pl-5">
                  <span className="text-md font-semibold text-primary">Deliveries</span>
                </div>
                {filterPlacement === "sidepanel" && (
                  <DeliveriesFilterSection
                    search={q}
                    onSearchChange={setQ}
                    filterOpen={filterOpen}
                    onFilterToggle={() => setFilterOpen((o) => !o)}
                    vacancy={vacancy}
                    onVacancyChange={setVacancy}
                    deliveryType={deliveryType}
                    onDeliveryTypeChange={setDeliveryType}
                  />
                )}
                <div className="flex-1 overflow-y-auto py-4 pr-4 pl-3">
                  <RouteList
                    routes={listRoutes}
                    loading={routes.isLoading}
                    error={routes.error?.message}
                    onSelect={(id) => {
                      setCreating(false);
                      setSelectedId(id);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RouteList(props: {
  routes: RouteSummary[];
  loading: boolean;
  error?: string;
  onSelect: (id: string) => void;
}) {
  if (props.loading) return <p className="px-2 text-md text-secondary">Loading routes…</p>;
  if (props.error) return <p className="px-2 text-md text-destructive">{props.error}</p>;
  if (props.routes.length === 0)
    return <p className="px-2 text-md text-secondary">No routes match.</p>;

  return (
    <div className="flex flex-col gap-2">
      {props.routes.map((r) => {
        const isVacant = r.lifecycle === "vacant";
        const meta = r.assignedVolunteer
          ? `${r.assignedVolunteer.firstName} ${r.assignedVolunteer.lastName}`
          : "vacant";

        return (
          <SidePanelRow
            key={r.id}
            className="h-10 py-2"
            meta={meta}
            onClick={() => props.onSelect(r.id)}
          >
            <RouteTag label={routeLabel(r)} vacant={isVacant} />
          </SidePanelRow>
        );
      })}
    </div>
  );
}

/** Labeled DropdownMenu — Figma Input Group + list-group radio items. */
function DropdownField(props: {
  label: string;
  value: string;
  display: string;
  options: { value: string; label: string }[];
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-md font-normal text-primary">{props.label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={props.disabled || !props.onChange}
          render={<button type="button" className={inputTriggerClassName} />}
        >
          <span className="min-w-0 truncate">{props.display}</span>
          <ChevronDown className="size-3 shrink-0 text-primary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[var(--anchor-width)]">
          <DropdownMenuRadioGroup value={props.value} onValueChange={props.onChange}>
            {props.options.map((opt) => (
              <DropdownMenuRadioItem key={opt.value || "__empty"} value={opt.value}>
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Labeled text input matching Figma Input Group. */
function InputField(props: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  labelSuffix?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-md font-normal text-primary">
        {props.label}
        {props.labelSuffix ? <span className="text-secondary"> {props.labelSuffix}</span> : null}
      </Label>
      <Input
        value={props.value}
        onChange={props.onChange ? (e) => props.onChange!(e.target.value) : undefined}
        readOnly={!props.onChange}
        placeholder={props.placeholder}
        type={props.type}
      />
    </div>
  );
}

/**
 * Compact 2-column counts editor — reuses members-table `table-row` / `table-cell`
 * utilities (the closest existing “mini table” pattern in the design system).
 *
 * TODO: replace with `BundlePapersTable` from the `members-page-functionality`
 * branch (`components/bundle-papers-table.tsx`) — per-bundle papers rows with
 * add/remove, instead of derived bundle count + total papers inputs.
 */
function CountsMiniTable(props: { papers: string; onPapersChange?: (value: string) => void }) {
  const papersNum = Number(props.papers) || 0;
  const bundles = String(greedySplit(Math.max(0, Math.floor(papersNum))).length);

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex h-10 w-full items-center gap-10 px-2 py-1 text-md text-secondary">
        <div className="table-cell"># of Bundles</div>
        <div className="table-cell">Total # of Papers</div>
      </div>
      <div className="flex h-10 w-full items-center gap-10 rounded-md px-2">
        <div className="table-cell">
          <Input
            type="number"
            min={0}
            value={bundles}
            readOnly
            tabIndex={-1}
            className="tabular-nums"
            aria-label="# of Bundles (derived from papers)"
          />
        </div>
        <div className="table-cell">
          <Input
            type="number"
            min={0}
            value={props.papers}
            onChange={
              props.onPapersChange ? (e) => props.onPapersChange!(e.target.value) : undefined
            }
            readOnly={!props.onPapersChange}
            className="tabular-nums"
            aria-label="Total # of Papers"
          />
        </div>
      </div>
    </div>
  );
}

/** Point delivery (drop): start and end resolve to the same place. */
function isDropRoute(r: RouteDetail): boolean {
  const start = r.startAddress.formattedAddress?.trim();
  const end = r.endAddress.formattedAddress?.trim();
  if (start && end && start === end) return true;
  if (
    r.start &&
    r.end &&
    r.start.latitude === r.end.latitude &&
    r.start.longitude === r.end.longitude
  ) {
    return true;
  }
  return false;
}

function dropLabel(r: RouteDetail): string {
  const addr =
    r.startAddress.formattedAddress?.split(",")[0]?.trim() || r.startLabel || r.streetName;
  return `${r.streetName} · ${addr}`;
}

function DetailBreadcrumb(props: { title: string; onBack: () => void }) {
  return (
    <div className="flex h-[64px] items-center border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-2.5 text-md font-semibold">
        <button
          type="button"
          className="shrink-0 text-secondary hover:text-primary"
          onClick={props.onBack}
        >
          Deliveries
        </button>
        <span className="text-secondary">&gt;</span>
        <span className="truncate text-primary">{props.title}</span>
      </div>
    </div>
  );
}

function RouteDetailPanel(props: { routeId: string; onClose: () => void; onChanged: () => void }) {
  const detail = useQuery({
    queryKey: ["route", props.routeId],
    queryFn: () => getJson<RouteDetail>(`/api/routes/${props.routeId}`),
  });
  const volunteers = useQuery({
    queryKey: ["volunteers", "assignable"],
    queryFn: () => getJson<VolunteerSummary[]>("/api/volunteers?status=active"),
  });

  const [streetName, setStreetName] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const [side, setSide] = useState<string | null>(null);
  const [papers, setPapers] = useState<string | null>(null);

  const r = detail.data;
  const dirtyStreet = streetName !== null && r && streetName !== r.streetName;
  const dirtyNotes = notes !== null && r && (notes || null) !== (r.notes || null);
  const dirtyVolunteer =
    volunteerId !== null && r && volunteerId !== (r.assignedVolunteer?.id ?? "");
  const dirtySide = side !== null && r && (side || null) !== (r.side || null);
  const dirtyPapers = papers !== null && r && Number(papers) !== r.papers;
  const dirty = dirtyStreet || dirtyNotes || dirtyVolunteer || dirtySide || dirtyPapers;

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (dirtyStreet) body.streetName = streetName;
      if (dirtyNotes) body.note = notes ?? "";
      if (dirtySide) body.side = side || null;
      if (dirtyPapers) body.papers = Number(papers) || 0;
      if (Object.keys(body).length > 0) {
        await sendJson(`/api/routes/${props.routeId}`, "PATCH", body);
      }
      if (dirtyVolunteer && volunteerId !== null) {
        const currentId = r?.assignedVolunteer?.id;
        if (volunteerId && volunteerId !== currentId) {
          const action = currentId ? "reassign" : "assign";
          await sendJson(`/api/routes/${props.routeId}/${action}`, "POST", { volunteerId });
        } else if (!volunteerId && currentId) {
          await sendJson(`/api/routes/${props.routeId}/unassign`, "POST");
        }
      }
    },
    onSuccess: () => {
      setStreetName(null);
      setNotes(null);
      setVolunteerId(null);
      setSide(null);
      setPapers(null);
      detail.refetch();
      props.onChanged();
    },
  });

  function discard() {
    setStreetName(null);
    setNotes(null);
    setVolunteerId(null);
    setSide(null);
    setPapers(null);
  }

  if (detail.isLoading) return <p className="p-4 text-md text-secondary">Loading…</p>;
  if (detail.error) return <p className="p-4 text-md text-destructive">{detail.error.message}</p>;
  if (!r) return null;

  const currentVolunteerId = volunteerId ?? r.assignedVolunteer?.id ?? "";
  const currentSide = side ?? r.side ?? "";
  const currentPapers = papers ?? String(r.papers);
  const asDrop = isDropRoute(r);

  const volunteerOptions = [
    { value: "", label: "— vacant —" },
    ...(volunteers.data ?? []).map((v) => ({
      value: v.id,
      label: `${v.firstName} ${v.lastName}`,
    })),
  ];

  const volunteerDisplay =
    volunteerOptions.find((o) => o.value === currentVolunteerId)?.label ?? "— vacant —";
  const sideDisplay = SIDE_OPTIONS.find((o) => o.value === currentSide)?.label ?? "— none —";
  const captainDisplay = r.captain?.name ?? "— no captain —";

  return (
    <div className="flex h-full flex-col">
      <DetailBreadcrumb title={asDrop ? dropLabel(r) : routeLabel(r)} onBack={props.onClose} />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        {/* Captain is derived via the volunteer — display only (route flow §4). */}
        <DropdownField
          label="Captain"
          value={r.captain?.id ?? ""}
          display={captainDisplay}
          options={
            r.captain
              ? [{ value: r.captain.id, label: r.captain.name }]
              : [{ value: "", label: "— no captain —" }]
          }
          disabled
        />

        {!asDrop && (
          <DropdownField
            label="Volunteer"
            value={currentVolunteerId}
            display={volunteerDisplay}
            options={volunteerOptions}
            onChange={setVolunteerId}
          />
        )}

        <InputField label="Name" value={streetName ?? r.streetName} onChange={setStreetName} />

        {asDrop ? (
          // TODO(abeer): wire address editing — drop Address should use Places
          // Autocomplete like create, then PATCH start/end together.
          <InputField
            label="Address"
            value={r.startAddress.formattedAddress ?? ""}
            placeholder="Address"
          />
        ) : (
          <>
            {/* TODO(abeer): Start/End Address editing needs Places Autocomplete
                + PATCH startAddress/endAddress — currently read-only formatted strings. */}
            <InputField
              label="Start Address"
              value={r.startAddress.formattedAddress ?? ""}
              placeholder="Start address"
            />
            <InputField
              label="End Address"
              value={r.endAddress.formattedAddress ?? ""}
              placeholder="End address"
            />
            <DropdownField
              label="Side"
              value={currentSide}
              display={sideDisplay}
              options={[...SIDE_OPTIONS]}
              onChange={setSide}
            />
          </>
        )}

        <CountsMiniTable papers={currentPapers} onPapersChange={setPapers} />

        <div className="flex flex-col gap-2">
          <Label className="text-md font-normal text-primary">
            {asDrop ? "Drop Notes" : "Route Notes"}{" "}
            <span className="text-secondary">(optional)</span>
          </Label>
          <textarea
            className="w-full rounded-[8px] border border-hairline bg-bg px-3 py-2 text-md text-primary outline-none transition-colors focus-visible:border-active focus-visible:ring-3 focus-visible:ring-active/40"
            rows={4}
            value={notes ?? r.notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {dirty && (
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" onClick={discard}>
            Discard Changes
          </Button>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save Changes"}
          </Button>
          {save.error && <span className="text-md text-destructive">{save.error.message}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Create a route. Endpoint addresses resolve server-side — by placeId when a
 * suggestion was picked (exact), otherwise by Address Validation on the typed
 * text. Either way the route gets the coordinates the map needs, so it appears
 * on the map as soon as it's saved.
 */
function CreateRoutePanel(props: { onClose: () => void; onCreated: (id: string) => void }) {
  const volunteers = useQuery({
    queryKey: ["volunteers", "assignable"],
    queryFn: () => getJson<VolunteerSummary[]>("/api/volunteers?status=active"),
  });

  const [streetName, setStreetName] = useState("");
  const [startLine, setStartLine] = useState("");
  const [endLine, setEndLine] = useState("");
  const [startPlaceId, setStartPlaceId] = useState<string | null>(null);
  const [endPlaceId, setEndPlaceId] = useState<string | null>(null);
  const [papers, setPapers] = useState("0");
  const [side, setSide] = useState("");
  const [volunteerId, setVolunteerId] = useState("");
  const [note, setNote] = useState("");

  const address = (line: string, placeId: string | null) =>
    placeId
      ? { placeId }
      : {
          addressLines: [line.trim()],
          locality: "Toronto",
          administrativeArea: "ON",
          regionCode: "CA" as const,
        };

  const papersNum = Number(papers) || 0;
  const derivedBundles = greedySplit(Math.max(0, Math.floor(papersNum))).length;

  const create = useMutation({
    mutationFn: () =>
      sendJson<RouteDetail>("/api/routes", "POST", {
        streetName: streetName.trim(),
        startAddress: address(startLine, startPlaceId),
        endAddress: address(endLine, endPlaceId),
        // houseCount is still required by the API; seed from derived bundles for now.
        houseCount: derivedBundles,
        papers: papersNum,
        ...(side ? { side } : {}),
        ...(volunteerId ? { assignedVolunteerId: volunteerId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (route) => props.onCreated(route.id),
  });

  const ready = streetName.trim() && startLine.trim() && endLine.trim();

  const volunteerOptions = [
    { value: "", label: "— leave vacant —" },
    ...(volunteers.data ?? []).map((v) => ({
      value: v.id,
      label: `${v.firstName} ${v.lastName}`,
    })),
  ];
  const volunteerDisplay =
    volunteerOptions.find((o) => o.value === volunteerId)?.label ?? "— leave vacant —";
  const sideDisplay = SIDE_OPTIONS.find((o) => o.value === side)?.label ?? "— none —";

  return (
    <div className="flex h-full flex-col">
      <DetailBreadcrumb title="New route" onBack={props.onClose} />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <DropdownField
          label="Volunteer"
          value={volunteerId}
          display={volunteerDisplay}
          options={volunteerOptions}
          onChange={setVolunteerId}
        />

        <InputField
          label="Name"
          value={streetName}
          onChange={setStreetName}
          placeholder="Queen St E"
        />

        <AddressField
          label="Start Address"
          placeholder="1900 Queen St E"
          value={startLine}
          onChange={(text) => {
            setStartLine(text);
            setStartPlaceId(null);
          }}
          onPick={(placeId, text) => {
            setStartPlaceId(placeId);
            setStartLine(text);
          }}
        />

        <AddressField
          label="End Address"
          placeholder="2100 Queen St E"
          value={endLine}
          onChange={(text) => {
            setEndLine(text);
            setEndPlaceId(null);
          }}
          onPick={(placeId, text) => {
            setEndPlaceId(placeId);
            setEndLine(text);
          }}
        />

        <DropdownField
          label="Side"
          value={side}
          display={sideDisplay}
          options={[...SIDE_OPTIONS]}
          onChange={setSide}
        />

        <CountsMiniTable papers={papers} onPapersChange={setPapers} />

        <div className="flex flex-col gap-2">
          <Label className="text-md font-normal text-primary">
            Route Notes <span className="text-secondary">(optional)</span>
          </Label>
          <textarea
            className="w-full rounded-[8px] border border-hairline bg-bg px-3 py-2 text-md text-primary outline-none transition-colors focus-visible:border-active focus-visible:ring-3 focus-visible:ring-active/40"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {create.error && <p className="text-md text-destructive">{create.error.message}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border p-4">
        <Button variant="outline" onClick={props.onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!ready || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Creating…" : "Create Route"}
        </Button>
      </div>
    </div>
  );
}
