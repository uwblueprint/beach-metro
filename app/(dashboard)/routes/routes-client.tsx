"use client";

// Functional routes page: map + filterable list + detail/edit panel, all driven
// by the real API. This is the wiring layer (data, selection, filters, save,
// assign) — the design engineers restyle it. Structural Tailwind only.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { RouteMap, type MapHome, type MapRoute } from "./route-map";

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

type Vacancy = "all" | "vacant" | "assigned";

function stateBadge(r: RouteSummary): { label: string; tone: string } {
  if (r.suspended) return { label: "Suspended", tone: "text-amber-700 dark:text-amber-400" };
  if (r.needsAttention)
    return { label: "Needs attention", tone: "text-amber-700 dark:text-amber-400" };
  if (r.lifecycle === "vacant") return { label: "Vacant", tone: "text-red-700 dark:text-red-400" };
  return { label: "Assigned", tone: "text-emerald-700 dark:text-emerald-400" };
}

export function RoutesClient() {
  const qc = useQueryClient();
  const [vacancy, setVacancy] = useState<Vacancy>("all");
  const [q, setQ] = useState("");
  const [showHomes, setShowHomes] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
  // Road-following paths, keyed by route id. Independent of filters/search so it
  // loads once; the map draws straight lines until it resolves.
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

  const mapRoutes: MapRoute[] = (routes.data ?? []).map((r) => ({
    id: r.id,
    streetName: r.streetName,
    lifecycle: r.lifecycle,
    suspended: r.suspended,
    needsAttention: r.needsAttention,
    start: r.start,
    end: r.end,
    path: pathById.get(r.id) ?? null,
  }));
  const mapHomes: MapHome[] = showHomes
    ? (volunteers.data ?? []).map((v) => ({
        id: v.id,
        name: `${v.firstName} ${v.lastName}`,
        home: v.home,
      }))
    : [];
  const missingCoords = (routes.data ?? []).filter((r) => !r.start || !r.end).length;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Routes</h1>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {routes.data ? `Showing ${routes.data.length}` : "Loading…"}
          </span>
          <Button
            size="sm"
            onClick={() => {
              setSelectedId(null);
              setCreating(true);
            }}
          >
            Add route
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
        {/* Map + a thin filter bar */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "vacant", "assigned"] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={vacancy === v ? "default" : "outline"}
                onClick={() => setVacancy(v)}
              >
                {v === "all" ? "All" : v[0].toUpperCase() + v.slice(1)}
              </Button>
            ))}
            <Input
              className="h-8 w-48 text-sm"
              placeholder="Search street…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <label className="text-muted-foreground flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={showHomes}
                onChange={(e) => setShowHomes(e.target.checked)}
              />
              Volunteer homes
            </label>
            {missingCoords > 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                {missingCoords} route(s) missing coordinates (not geocoded yet)
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <RouteMap
              routes={mapRoutes}
              homes={mapHomes}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        {/* Right rail: create form, detail, OR list */}
        <div className="min-h-0 overflow-auto rounded-lg border">
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
            <RouteList
              routes={routes.data ?? []}
              loading={routes.isLoading}
              error={routes.error?.message}
              onSelect={setSelectedId}
            />
          )}
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
  if (props.loading) return <p className="text-muted-foreground p-4 text-sm">Loading routes…</p>;
  if (props.error) return <p className="p-4 text-sm text-red-600">{props.error}</p>;
  if (props.routes.length === 0)
    return <p className="text-muted-foreground p-4 text-sm">No routes match.</p>;

  return (
    <ul className="divide-y">
      {props.routes.map((r) => {
        const badge = stateBadge(r);
        return (
          <li key={r.id}>
            <button
              className="hover:bg-muted/50 flex w-full flex-col gap-0.5 px-4 py-2 text-left"
              onClick={() => props.onSelect(r.id)}
            >
              <span className="text-sm font-medium">{r.streetName}</span>
              <span className="text-muted-foreground text-xs">
                {r.assignedVolunteer
                  ? `${r.assignedVolunteer.firstName} ${r.assignedVolunteer.lastName}`
                  : "—"}
                {r.captain ? ` · ${r.captain.name}` : ""}
              </span>
              <span className={cn("text-xs", badge.tone)}>{badge.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
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
  const [assignVolunteerId, setAssignVolunteerId] = useState("");

  const r = detail.data;
  const dirtyStreet = streetName !== null && r && streetName !== r.streetName;
  const dirtyNotes = notes !== null && r && (notes || null) !== (r.notes || null);
  const dirty = dirtyStreet || dirtyNotes;

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (dirtyStreet) body.streetName = streetName;
      if (dirtyNotes) body.note = notes ?? "";
      return sendJson(`/api/routes/${props.routeId}`, "PATCH", body);
    },
    onSuccess: () => {
      setStreetName(null);
      setNotes(null);
      detail.refetch();
      props.onChanged();
    },
  });

  const assign = useMutation({
    mutationFn: (volunteerId: string) => {
      const action = r?.lifecycle === "assigned" ? "reassign" : "assign";
      return sendJson(`/api/routes/${props.routeId}/${action}`, "POST", { volunteerId });
    },
    onSuccess: () => {
      setAssignVolunteerId("");
      detail.refetch();
      props.onChanged();
    },
  });
  const unassign = useMutation({
    mutationFn: () => sendJson(`/api/routes/${props.routeId}/unassign`, "POST"),
    onSuccess: () => {
      detail.refetch();
      props.onChanged();
    },
  });

  if (detail.isLoading) return <p className="text-muted-foreground p-4 text-sm">Loading…</p>;
  if (detail.error) return <p className="p-4 text-sm text-red-600">{detail.error.message}</p>;
  if (!r) return null;

  const badge = stateBadge(r);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button className="text-muted-foreground text-xs underline" onClick={props.onClose}>
          ← Back to list
        </button>
        <span className={cn("text-xs font-medium", badge.tone)}>{badge.label}</span>
      </div>

      <div>
        <Label className="text-xs">Street name</Label>
        <Input
          className="h-8 text-sm"
          value={streetName ?? r.streetName}
          onChange={(e) => setStreetName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <Label className="text-xs">Captain</Label>
          <p className="text-muted-foreground">{r.captain?.name ?? "—"}</p>
        </div>
        <div>
          <Label className="text-xs">Volunteer</Label>
          <p className="text-muted-foreground">
            {r.assignedVolunteer
              ? `${r.assignedVolunteer.firstName} ${r.assignedVolunteer.lastName}`
              : "—"}
          </p>
        </div>
        <div>
          <Label className="text-xs">Start address</Label>
          <p className="text-muted-foreground">{r.startAddress.formattedAddress ?? "—"}</p>
        </div>
        <div>
          <Label className="text-xs">End address</Label>
          <p className="text-muted-foreground">{r.endAddress.formattedAddress ?? "—"}</p>
        </div>
        <div>
          <Label className="text-xs">House count</Label>
          <p className="text-muted-foreground">{r.effectiveHouseCount}</p>
        </div>
        <div>
          <Label className="text-xs">Papers</Label>
          <p className="text-muted-foreground">{r.papers}</p>
        </div>
      </div>

      <div>
        <Label className="text-xs">Route notes</Label>
        <textarea
          className="border-input bg-bg min-h-16 w-full rounded-md border p-2 text-sm"
          value={notes ?? r.notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Assignment controls — the functional heart of the routes page. */}
      <div className="rounded-md border p-2">
        <Label className="text-xs">Assignment</Label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <select
            className="border-input bg-bg h-8 rounded-md border px-2 text-sm"
            value={assignVolunteerId}
            onChange={(e) => setAssignVolunteerId(e.target.value)}
          >
            <option value="">— pick a volunteer —</option>
            {(volunteers.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.firstName} {v.lastName}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!assignVolunteerId || assign.isPending}
            onClick={() => assign.mutate(assignVolunteerId)}
          >
            {r.lifecycle === "assigned" ? "Reassign" : "Assign"}
          </Button>
          {r.lifecycle === "assigned" && (
            <Button
              size="sm"
              variant="outline"
              disabled={unassign.isPending}
              onClick={() => unassign.mutate()}
            >
              Unassign
            </Button>
          )}
        </div>
        {(assign.error || unassign.error) && (
          <p className="mt-1 text-xs text-red-600">{(assign.error ?? unassign.error)?.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
        {dirty && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setStreetName(null);
              setNotes(null);
            }}
          >
            Discard
          </Button>
        )}
        {save.error && <span className="text-xs text-red-600">{save.error.message}</span>}
      </div>
    </div>
  );
}

interface AddressSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

/**
 * Address field with Places Autocomplete suggestions. Picking a suggestion
 * captures its placeId, which the API resolves exactly — no re-guessing from
 * free text. Typing again clears the placeId and falls back to text resolution,
 * so the field still works if Places is unavailable (endpoint returns []).
 *
 * One session token is reused for every keystroke and discarded after a pick,
 * so an address entry bills as a single autocomplete session (research doc §4).
 */
function AddressField(props: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  onPick: (placeId: string, text: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const sessionRef = useRef<string>("");
  // Set by a pick so the resulting value change doesn't refetch suggestions.
  const justPickedRef = useRef(false);

  const { value } = props;

  // Too-short input hides suggestions by derivation rather than by clearing
  // state in the effect (which would cost an extra render per keystroke).
  const visible = value.trim().length >= 3 ? suggestions : [];

  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    if (value.trim().length < 3) return;
    if (!sessionRef.current) sessionRef.current = crypto.randomUUID();

    // Debounce: one request per pause, not per keystroke.
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: value, session: sessionRef.current });
        const results = await getJson<AddressSuggestion[]>(`/api/addresses/autocomplete?${params}`);
        setSuggestions(results);
        setHighlight(0);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]); // stay silent; the field still accepts free text
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

  function pick(s: AddressSuggestion) {
    justPickedRef.current = true;
    const text = [s.primaryText, s.secondaryText].filter(Boolean).join(", ");
    props.onPick(s.placeId, text);
    sessionRef.current = ""; // session ends at selection
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Label className="text-xs">{props.label}</Label>
      <Input
        className="h-8 text-sm"
        placeholder={props.placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => props.onChange(e.target.value)}
        onFocus={() => setOpen(visible.length > 0)}
        // Delay so a click on a suggestion lands before the list unmounts.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || visible.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % visible.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + visible.length) % visible.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(visible[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && visible.length > 0 && (
        <ul className="bg-bg absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border shadow-md">
          {visible.map((s, i) => (
            <li key={s.placeId}>
              <button
                type="button"
                className={cn(
                  "block w-full px-2 py-1.5 text-left text-sm",
                  i === highlight ? "bg-muted" : "hover:bg-muted/50",
                )}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(s)}
              >
                <span className="block">{s.primaryText}</span>
                <span className="text-muted-foreground block text-xs">{s.secondaryText}</span>
              </button>
            </li>
          ))}
        </ul>
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
  // Set when a suggestion is picked; cleared when the text is edited again.
  const [startPlaceId, setStartPlaceId] = useState<string | null>(null);
  const [endPlaceId, setEndPlaceId] = useState<string | null>(null);
  const [houseCount, setHouseCount] = useState("0");
  const [papers, setPapers] = useState("0");
  const [side, setSide] = useState("");
  const [volunteerId, setVolunteerId] = useState("");
  const [note, setNote] = useState("");

  // A picked suggestion resolves exactly by placeId. Otherwise fall back to the
  // typed text — Toronto is implied for every route Beach Metro covers.
  const address = (line: string, placeId: string | null) =>
    placeId
      ? { placeId }
      : {
          addressLines: [line.trim()],
          locality: "Toronto",
          administrativeArea: "ON",
          regionCode: "CA" as const,
        };

  const create = useMutation({
    mutationFn: () =>
      sendJson<RouteDetail>("/api/routes", "POST", {
        streetName: streetName.trim(),
        startAddress: address(startLine, startPlaceId),
        endAddress: address(endLine, endPlaceId),
        houseCount: Number(houseCount) || 0,
        papers: Number(papers) || 0,
        ...(side ? { side } : {}),
        ...(volunteerId ? { assignedVolunteerId: volunteerId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (route) => props.onCreated(route.id),
  });

  const ready = streetName.trim() && startLine.trim() && endLine.trim();

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button className="text-muted-foreground text-xs underline" onClick={props.onClose}>
          ← Back to list
        </button>
        <span className="text-xs font-medium">New route</span>
      </div>
      <div>
        <Label className="text-xs">Street name</Label>
        <Input
          className="h-8 text-sm"
          placeholder="Queen St E"
          value={streetName}
          onChange={(e) => setStreetName(e.target.value)}
        />
      </div>
      <AddressField
        label="Start address"
        placeholder="1900 Queen St E"
        value={startLine}
        onChange={(text) => {
          setStartLine(text);
          setStartPlaceId(null); // edited by hand — no longer an exact match
        }}
        onPick={(placeId, text) => {
          setStartPlaceId(placeId);
          setStartLine(text);
        }}
      />
      <AddressField
        label="End address"
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

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">House count</Label>
          <Input
            className="h-8 text-sm"
            type="number"
            min={0}
            value={houseCount}
            onChange={(e) => setHouseCount(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Papers</Label>
          <Input
            className="h-8 text-sm"
            type="number"
            min={0}
            value={papers}
            onChange={(e) => setPapers(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Side (optional)</Label>
        <select
          className="border-input bg-bg h-8 w-full rounded-md border px-2 text-sm"
          value={side}
          onChange={(e) => setSide(e.target.value)}
        >
          <option value="">— none —</option>
          {["NORTH", "SOUTH", "EAST", "WEST", "BOTH"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-xs">Assign volunteer (optional)</Label>
        <select
          className="border-input bg-bg h-8 w-full rounded-md border px-2 text-sm"
          value={volunteerId}
          onChange={(e) => setVolunteerId(e.target.value)}
        >
          <option value="">— leave vacant —</option>
          {(volunteers.data ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.firstName} {v.lastName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-xs">Route notes (optional)</Label>
        <textarea
          className="border-input bg-bg min-h-16 w-full rounded-md border p-2 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!ready || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Creating…" : "Create route"}
        </Button>
        <Button size="sm" variant="outline" onClick={props.onClose}>
          Cancel
        </Button>
      </div>
      {create.error && <p className="text-xs text-red-600">{create.error.message}</p>}
    </div>
  );
}
