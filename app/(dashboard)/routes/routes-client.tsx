"use client";

// Functional routes page: map + filterable list + detail/edit panel, all driven
// by the real API. This is the wiring layer (data, selection, filters, save,
// assign) — the design engineers restyle it. Structural Tailwind only.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

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
        <span className="text-muted-foreground text-sm">
          {routes.data ? `Showing ${routes.data.length}` : "Loading…"}
        </span>
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

        {/* Right rail: list OR detail */}
        <div className="min-h-0 overflow-auto rounded-lg border">
          {selectedId ? (
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
          className="border-input bg-background min-h-16 w-full rounded-md border p-2 text-sm"
          value={notes ?? r.notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Assignment controls — the functional heart of the routes page. */}
      <div className="rounded-md border p-2">
        <Label className="text-xs">Assignment</Label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <select
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
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
