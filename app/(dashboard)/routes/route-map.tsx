"use client";

// The map half of the routes page: Google Map via @vis.gl/react-google-maps,
// routes as start→end polylines colored by state, optional volunteer-home dots.
// Functional layer only — visual polish belongs to the design engineers. The
// grayscale style is a neutral placeholder that matches the mockups' tone.

import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { Filter, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { Button } from "@/components/ui/button";
import { PillGroup } from "@/components/ui/pill-group";
import { SearchBar } from "@/components/ui/search-bar";
import { cn } from "@/lib/utils";

import { FilterPillSlot, readCssDurationMsFrom } from "./filter-pills";
import { closestPointOnRoute, RouteHoverCard } from "./route-hover-card";

export interface MapRoute {
  id: string;
  streetName: string;
  lifecycle: "assigned" | "vacant";
  suspended: boolean;
  needsAttention: boolean;
  start: { latitude: number; longitude: number } | null;
  end: { latitude: number; longitude: number } | null;
  /** Road-following vertices from the Routes API; falls back to start→end. */
  path?: { lat: number; lng: number }[] | null;
  label: string;
  volunteerName: string | null;
  bundleCount: number;
  papers: number;
}

export interface MapHome {
  id: string;
  name: string;
  home: { latitude: number; longitude: number } | null;
}

export type VacancyFilter = "all" | "vacant" | "assigned";
export type DeliveryTypeFilter = "all" | "routes" | "drops";

// Desaturated / monochrome base map: light-gray land, white roads, gray water,
// no POI or transit clutter — so the colored route lines are the only signal.
// (Legacy JSON styling; works because we don't set a cloud `mapId`.)
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  // Near-white land with visibly darker gray roads (contrast is what was missing),
  // muted labels kept ON, POI/transit clutter off.
  { elementType: "geometry", stylers: [{ color: "#fafafa" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8f98" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#edf0ec" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#e6e9ee" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#dbdfe6" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ced3db" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d5dbe1" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#aab1ba" }] },
];

/**
 * Raw hex for Maps overlays (can't use CSS variables).
 *
 * TODO: Duplicates design tokens as hand-maintained hex and will drift from
 * globals.css. Prefer a shared token→hex pipeline or reading computed styles once.
 */
const ROUTE_COLORS = {
  vacant: {
    base: "#ff4828", // --destructive (tag-destructive pair)
    hover: "#ce0000",
    selected: "#b60000",
  },
  assigned: {
    base: "#0cb1f2", // --active
    hover: "#0084c2",
    selected: "#006eab",
  },
} as const;

function routeColor(route: MapRoute, selected: boolean, hovered: boolean): string {
  const palette = ROUTE_COLORS[route.lifecycle];
  if (selected) return palette.selected;
  if (hovered) return palette.hover;
  return palette.base;
}

/**
 * One route: a polyline from start→end plus a small dot at each endpoint, so the
 * segment reads as a real stretch of street (not a line between random points).
 * Managed imperatively — vis.gl has no Polyline/Marker component.
 */
function RouteOverlay(props: {
  route: MapRoute;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onRouteHover: (id: string, position: google.maps.LatLngLiteral) => void;
  onRouteLeave: () => void;
}) {
  const map = useMap();
  const { route, selected, hovered, onSelect, onRouteHover, onRouteLeave } = props;
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const routeRef = useRef(route);
  const onSelectRef = useRef(onSelect);
  const onRouteHoverRef = useRef(onRouteHover);
  const onRouteLeaveRef = useRef(onRouteLeave);
  useLayoutEffect(() => {
    routeRef.current = route;
    onSelectRef.current = onSelect;
    onRouteHoverRef.current = onRouteHover;
    onRouteLeaveRef.current = onRouteLeave;
  });

  const pathKey =
    route.path && route.path.length >= 2
      ? route.path.map((p) => `${p.lat},${p.lng}`).join(";")
      : "";

  // Create / tear down geometry when the plotted path changes — not on hover restyles
  // or parent re-renders (new route object / callback identities).
  useEffect(() => {
    if (!map || !route.start || !route.end) return;
    const from = { lat: route.start.latitude, lng: route.start.longitude };
    const to = { lat: route.end.latitude, lng: route.end.longitude };
    const dashed = route.suspended;
    const linePath = route.path && route.path.length >= 2 ? route.path : [from, to];
    const color = routeColor(routeRef.current, false, false);

    const emitHoverAt = (cursor: google.maps.LatLngLiteral) => {
      const r = routeRef.current;
      onRouteHoverRef.current(r.id, closestPointOnRoute(r, cursor) ?? cursor);
    };

    const line = new google.maps.Polyline({
      map,
      path: linePath,
      strokeColor: color,
      strokeWeight: 4,
      strokeOpacity: dashed ? 0 : 0.95,
      ...(dashed && {
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeColor: color,
              strokeOpacity: 1,
              scale: 3,
            },
            offset: "0",
            repeat: "12px",
          },
        ],
      }),
      zIndex: 2,
    });
    line.addListener("click", () => onSelectRef.current());
    const onLineMove = (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      emitHoverAt({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    };
    line.addListener("mouseover", onLineMove);
    line.addListener("mousemove", onLineMove);
    line.addListener("mouseout", () => onRouteLeaveRef.current());
    lineRef.current = line;

    const endpoint = (position: google.maps.LatLngLiteral) =>
      new google.maps.Marker({
        map,
        position,
        clickable: true,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 3.5,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
        },
        zIndex: 3,
      });
    const markers = [endpoint(from), endpoint(to)];
    markers.forEach((m, i) => {
      const at = i === 0 ? from : to;
      m.addListener("click", () => onSelectRef.current());
      m.addListener("mouseover", () => emitHoverAt(at));
      m.addListener("mouseout", () => onRouteLeaveRef.current());
    });
    markersRef.current = markers;

    return () => {
      google.maps.event.clearInstanceListeners(line);
      line.setMap(null);
      lineRef.current = null;
      markers.forEach((m) => {
        google.maps.event.clearInstanceListeners(m);
        m.setMap(null);
      });
      markersRef.current = [];
    };
    // Intentionally keyed on geometry, not the route object / hover callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    map,
    route.id,
    route.start?.latitude,
    route.start?.longitude,
    route.end?.latitude,
    route.end?.longitude,
    route.suspended,
    pathKey,
  ]);

  // Restyle in place so hover/selection doesn't remount and flicker mouseout.
  useEffect(() => {
    const color = routeColor(route, selected, hovered);
    const weight = selected ? 6 : 4;
    const zLine = selected ? 20 : 2;
    const zMark = selected ? 21 : 3;
    const scale = selected ? 5 : 3.5;
    const line = lineRef.current;
    if (line) {
      line.setOptions({ strokeColor: color, strokeWeight: weight, zIndex: zLine });
      const icons = line.get("icons") as google.maps.IconSequence[] | undefined;
      if (icons?.[0]?.icon) {
        line.set("icons", [
          {
            ...icons[0],
            icon: { ...icons[0].icon, strokeColor: color },
          },
        ]);
      }
    }
    for (const m of markersRef.current) {
      m.setOptions({
        zIndex: zMark,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
        },
      });
    }
  }, [route, selected, hovered]);

  return null;
}

/** Small hollow dot for a volunteer's home (distinct from route endpoints). */
function HomeMarker({ home }: { home: MapHome }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !home.home) return;
    const marker = new google.maps.Marker({
      map,
      position: { lat: home.home.latitude, lng: home.home.longitude },
      title: home.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: "#ffffff",
        fillOpacity: 1,
        strokeColor: "#7c3aed",
        strokeWeight: 2,
      },
      zIndex: 1,
    });
    return () => marker.setMap(null);
  }, [map, home]);
  return null;
}

/**
 * Fits the viewport when `fitKey` changes (initial load + filter changes).
 * Waits until `ready` so we fit post-fetch data, not a loading empty set.
 * Does not re-fit on unrelated parent re-renders (e.g. selecting a route).
 */
function FitBounds(props: {
  routes: MapRoute[];
  homes: MapHome[];
  fitKey: string;
  ready: boolean;
}) {
  const map = useMap();
  const pendingKeyRef = useRef<string | null>(props.fitKey);

  useEffect(() => {
    pendingKeyRef.current = props.fitKey;
  }, [props.fitKey]);

  useEffect(() => {
    if (!map || !props.ready) return;
    if (pendingKeyRef.current !== props.fitKey) return;

    const bounds = new google.maps.LatLngBounds();
    let any = false;
    const add = (p: { latitude: number; longitude: number } | null) => {
      if (p) {
        bounds.extend({ lat: p.latitude, lng: p.longitude });
        any = true;
      }
    };
    for (const r of props.routes) {
      add(r.start);
      add(r.end);
    }
    for (const h of props.homes) add(h.home);

    // Settled empty (e.g. Type=Drops): leave camera; clear pending.
    if (!any) {
      pendingKeyRef.current = null;
      return;
    }

    map.fitBounds(bounds, 56);
    pendingKeyRef.current = null;
  }, [map, props.fitKey, props.ready, props.routes, props.homes]);

  return null;
}

const BEACHES_CENTER = { lat: 43.6725, lng: -79.2915 };

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

function vacancyLabel(value: VacancyFilter): string {
  return ASSIGNED_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export type CaptainFilterOption = { value: string; label: string };

export type FilterPlacement = "map" | "sidepanel";

/** Custom map controls overlay: filter, search, zoom ±, fullscreen. */
function MapControls(props: {
  search: string;
  onSearchChange: (value: string) => void;
  filterOpen: boolean;
  onFilterToggle: () => void;
  vacancy: VacancyFilter;
  onVacancyChange: (value: VacancyFilter) => void;
  deliveryType: DeliveryTypeFilter;
  onDeliveryTypeChange: (value: DeliveryTypeFilter) => void;
  captainId: string;
  onCaptainChange: (value: string) => void;
  captainOptions: CaptainFilterOption[];
}) {
  const map = useMap("routes-map");
  const containerRef = useRef<HTMLDivElement>(null);
  const filterInnerRef = useRef<HTMLDivElement>(null);
  const pillsInnerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterClosing, setFilterClosing] = useState(false);
  const [filterHeight, setFilterHeight] = useState(0);
  const [pillsHeight, setPillsHeight] = useState(0);
  const [trackedFilterOpen, setTrackedFilterOpen] = useState(props.filterOpen);

  // Adjust open/close flags during render (React-approved) — avoid sync setState in effects.
  if (props.filterOpen !== trackedFilterOpen) {
    setTrackedFilterOpen(props.filterOpen);
    if (props.filterOpen) {
      setFilterClosing(false);
    } else if (filterHeight > 0 || filterClosing) {
      setFilterClosing(true);
    }
  }

  const filterVisible = props.filterOpen || filterClosing;
  const captainLabel =
    props.captainOptions.find((o) => o.value === props.captainId)?.label ?? props.captainId;
  const hasActivePills =
    props.deliveryType !== "all" || props.vacancy !== "all" || props.captainId !== "all";
  // Applied pills only when the menu is collapsed — appear as the panel closes (shared morph).
  const showPillsRow = hasActivePills && !props.filterOpen;

  if (!showPillsRow && pillsHeight !== 0) {
    setPillsHeight(0);
  }

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useLayoutEffect(() => {
    if (props.filterOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      let nested = 0;
      const outer = requestAnimationFrame(() => {
        nested = requestAnimationFrame(() => {
          setFilterHeight(filterInnerRef.current?.scrollHeight ?? 0);
        });
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(nested);
      };
    }

    if (!filterClosing) return;

    let nested = 0;
    const outer = requestAnimationFrame(() => {
      nested = requestAnimationFrame(() => {
        setFilterHeight(0);
      });
    });
    const el = containerRef.current;
    const closeMs = el
      ? Math.max(
          readCssDurationMsFrom(el, "--panel-close-dur", 350),
          readCssDurationMsFrom(el, "--resize-dur", 150),
        )
      : 150;
    closeTimerRef.current = setTimeout(() => {
      setFilterClosing(false);
      closeTimerRef.current = null;
    }, closeMs);

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(nested);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [props.filterOpen, filterClosing]);

  useLayoutEffect(() => {
    if (!filterVisible || !filterInnerRef.current) return;
    let nested = 0;
    const outer = requestAnimationFrame(() => {
      nested = requestAnimationFrame(() => {
        setFilterHeight(filterInnerRef.current?.scrollHeight ?? 0);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(nested);
    };
  }, [filterVisible, props.vacancy, props.deliveryType, props.captainId, props.captainOptions]);

  // Height-tween the applied-pills row only while the filter menu is collapsed.
  useLayoutEffect(() => {
    if (!showPillsRow) return;
    let nested = 0;
    const outer = requestAnimationFrame(() => {
      nested = requestAnimationFrame(() => {
        setPillsHeight(pillsInnerRef.current?.scrollHeight ?? 0);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(nested);
    };
  }, [showPillsRow, props.vacancy, props.deliveryType, props.captainId]);

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    map.setZoom((map.getZoom() ?? 14) + 1);
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    map.setZoom((map.getZoom() ?? 14) - 1);
  }, [map]);

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current?.closest("[data-map-container]") as HTMLElement | null;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col pt-4 pb-6"
      style={
        {
          "--resize-dur": "220ms",
          "--panel-translate-y": "12px",
        } as CSSProperties
      }
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-transparent" />
        <div className="map-ui-blur-fill absolute inset-0" />
      </div>

      <div className="pointer-events-auto relative z-10 flex flex-col px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="toolbar"
            size="toolbar"
            shape="rounded"
            aria-label="Toggle filters"
            aria-expanded={props.filterOpen}
            selected={props.filterOpen || filterClosing}
            onClick={props.onFilterToggle}
          >
            <Filter />
          </Button>

          <SearchBar
            value={props.search}
            onChange={props.onSearchChange}
            placeholder="Search Address, Route, or Volunteer"
            className="min-w-0 flex-1 bg-bg"
          />

          <Button
            variant="toolbar"
            size="toolbar"
            shape="rounded"
            aria-label="Zoom out"
            onClick={handleZoomOut}
          >
            <Minus />
          </Button>
          <Button
            variant="toolbar"
            size="toolbar"
            shape="rounded"
            aria-label="Zoom in"
            onClick={handleZoomIn}
          >
            <Plus />
          </Button>
          <Button
            variant="toolbar"
            size="toolbar"
            shape="rounded"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={handleFullscreen}
          >
            <span className="t-icon-swap size-4" data-state={isFullscreen ? "b" : "a"}>
              <span className="t-icon" data-icon="a">
                <Maximize2 />
              </span>
              <span className="t-icon" data-icon="b">
                <Minimize2 />
              </span>
            </span>
          </Button>
        </div>

        <div className="t-resize overflow-hidden" style={{ height: pillsHeight }}>
          <div
            ref={pillsInnerRef}
            className={cn(
              // Cancel FilterPillSlot's leading pl-2.5 so the first pill aligns with the filter button.
              "-ml-2.5 flex items-center pt-2.5 will-change-[transform,opacity] transition-[transform,opacity] duration-[var(--resize-dur)] ease-[var(--resize-ease)]",
              // Rise into the applied line as the panel collapses (same selection, new home).
              showPillsRow
                ? "translate-y-0 opacity-100"
                : "translate-y-[var(--panel-translate-y)] opacity-0",
            )}
          >
            <FilterPillSlot
              open={showPillsRow && props.deliveryType !== "all"}
              label={deliveryTypeLabel(props.deliveryType)}
              onClear={() => props.onDeliveryTypeChange("all")}
            />
            <FilterPillSlot
              open={showPillsRow && props.vacancy !== "all"}
              label={vacancyLabel(props.vacancy)}
              onClear={() => props.onVacancyChange("all")}
            />
            <FilterPillSlot
              open={showPillsRow && props.captainId !== "all"}
              label={captainLabel}
              onClear={() => props.onCaptainChange("all")}
            />
          </div>
        </div>

        <div className="t-resize overflow-hidden" style={{ height: filterHeight }}>
          {filterVisible && (
            <div
              ref={filterInnerRef}
              className="t-panel-slide flex flex-col gap-4 pt-4"
              data-open={props.filterOpen ? "true" : "false"}
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
                    if (value != null) props.onVacancyChange(value as VacancyFilter);
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-secondary">Captain</p>
                <PillGroup
                  exclusive
                  options={props.captainOptions}
                  value={props.captainId}
                  onChange={(value) => {
                    if (value != null) props.onCaptainChange(value);
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

/** Map controls pinned top-right: zoom ± and fullscreen. */
function MapZoomControls() {
  const map = useMap("routes-map");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    map.setZoom((map.getZoom() ?? 14) + 1);
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    map.setZoom((map.getZoom() ?? 14) - 1);
  }, [map]);

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current?.closest("[data-map-container]") as HTMLElement | null;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end p-4"
    >
      <div className="pointer-events-auto flex items-center gap-2">
        <Button
          variant="toolbar"
          size="toolbar"
          shape="rounded"
          aria-label="Zoom out"
          onClick={handleZoomOut}
        >
          <Minus />
        </Button>
        <Button
          variant="toolbar"
          size="toolbar"
          shape="rounded"
          aria-label="Zoom in"
          onClick={handleZoomIn}
        >
          <Plus />
        </Button>
        <Button
          variant="toolbar"
          size="toolbar"
          shape="rounded"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={handleFullscreen}
        >
          <span className="t-icon-swap size-4" data-state={isFullscreen ? "b" : "a"}>
            <span className="t-icon" data-icon="a">
              <Maximize2 />
            </span>
            <span className="t-icon" data-icon="b">
              <Minimize2 />
            </span>
          </span>
        </Button>
      </div>
    </div>
  );
}

export function RouteMap(props: {
  routes: MapRoute[];
  homes: MapHome[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Changes when filters that should re-fit the map change (vacancy, search, type, homes). */
  boundsFitKey: string;
  /** False while filter-driven fetches are in flight — FitBounds waits for this. */
  boundsFitReady: boolean;
  filterPlacement: FilterPlacement;
  search: string;
  onSearchChange: (value: string) => void;
  filterOpen: boolean;
  onFilterToggle: () => void;
  vacancy: VacancyFilter;
  onVacancyChange: (value: VacancyFilter) => void;
  deliveryType: DeliveryTypeFilter;
  onDeliveryTypeChange: (value: DeliveryTypeFilter) => void;
  captainId: string;
  onCaptainChange: (value: string) => void;
  captainOptions: CaptainFilterOption[];
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<google.maps.LatLngLiteral | null>(null);

  const handleRouteHover = useCallback((id: string, position: google.maps.LatLngLiteral) => {
    setHoveredId(id);
    setHoverPosition(position);
  }, []);

  const handleRouteLeave = useCallback(() => {
    setHoveredId(null);
    setHoverPosition(null);
  }, []);

  const hoveredRoute = hoveredId ? (props.routes.find((r) => r.id === hoveredId) ?? null) : null;

  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!browserKey) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-secondary">
        NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is not set — the map cannot load.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" data-map-container>
      <APIProvider apiKey={browserKey}>
        <Map
          id="routes-map"
          defaultCenter={BEACHES_CENTER}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI={true}
          zoomControl={false}
          fullscreenControl={false}
          styles={MAP_STYLE}
          className="h-full w-full"
        >
          {props.routes.map((r) => (
            <RouteOverlay
              key={r.id}
              route={r}
              selected={r.id === props.selectedId}
              hovered={r.id === hoveredId}
              onSelect={() => props.onSelect(r.id)}
              onRouteHover={handleRouteHover}
              onRouteLeave={handleRouteLeave}
            />
          ))}
          <RouteHoverCard
            open={!!hoveredRoute && !!hoverPosition}
            route={hoveredRoute}
            position={hoverPosition}
          />
          {props.homes.map((h) => (
            <HomeMarker key={h.id} home={h} />
          ))}
          <FitBounds
            routes={props.routes}
            homes={props.homes}
            fitKey={props.boundsFitKey}
            ready={props.boundsFitReady}
          />
        </Map>
        {props.filterPlacement === "map" ? (
          <MapControls
            search={props.search}
            onSearchChange={props.onSearchChange}
            filterOpen={props.filterOpen}
            onFilterToggle={props.onFilterToggle}
            vacancy={props.vacancy}
            onVacancyChange={props.onVacancyChange}
            deliveryType={props.deliveryType}
            onDeliveryTypeChange={props.onDeliveryTypeChange}
            captainId={props.captainId}
            onCaptainChange={props.onCaptainChange}
            captainOptions={props.captainOptions}
          />
        ) : (
          <MapZoomControls />
        )}
      </APIProvider>
    </div>
  );
}
