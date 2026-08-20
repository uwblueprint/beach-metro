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

// Raw hex (Maps overlays can't use CSS variables). Matches the list badges.
const ROUTE_COLORS = {
  assigned: "#059669",
  vacant: "#dc2626",
  suspended: "#d97706",
  selected: "#2563eb",
} as const;

function routeColor(route: MapRoute, selected: boolean): string {
  if (selected) return ROUTE_COLORS.selected;
  if (route.suspended) return ROUTE_COLORS.suspended;
  return ROUTE_COLORS[route.lifecycle];
}

/**
 * One route: a polyline from start→end plus a small dot at each endpoint, so the
 * segment reads as a real stretch of street (not a line between random points).
 * Managed imperatively — vis.gl has no Polyline/Marker component.
 */
function RouteOverlay(props: { route: MapRoute; selected: boolean; onSelect: () => void }) {
  const map = useMap();
  const { route, selected, onSelect } = props;

  useEffect(() => {
    if (!map || !route.start || !route.end) return;
    const color = routeColor(route, selected);
    const from = { lat: route.start.latitude, lng: route.start.longitude };
    const to = { lat: route.end.latitude, lng: route.end.longitude };
    const dashed = route.suspended; // suspended reads as a dashed / "paused" line
    // Trace the real street path when we have it; otherwise a straight segment.
    const linePath = route.path && route.path.length >= 2 ? route.path : [from, to];

    const line = new google.maps.Polyline({
      map,
      path: linePath,
      strokeColor: color,
      strokeWeight: selected ? 6 : 4,
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
      zIndex: selected ? 20 : 2,
    });
    line.addListener("click", onSelect);

    const endpoint = (position: google.maps.LatLngLiteral) =>
      new google.maps.Marker({
        map,
        position,
        clickable: true,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: selected ? 5 : 3.5,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
        },
        zIndex: selected ? 21 : 3,
      });
    const markers = [endpoint(from), endpoint(to)];
    markers.forEach((m) => m.addListener("click", onSelect));

    return () => {
      google.maps.event.clearInstanceListeners(line);
      line.setMap(null);
      markers.forEach((m) => {
        google.maps.event.clearInstanceListeners(m);
        m.setMap(null);
      });
    };
  }, [map, route, selected, onSelect]);

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

/** Fits the viewport to whatever is currently plotted. */
function FitBounds({ routes, homes }: { routes: MapRoute[]; homes: MapHome[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    let any = false;
    const add = (p: { latitude: number; longitude: number } | null) => {
      if (p) {
        bounds.extend({ lat: p.latitude, lng: p.longitude });
        any = true;
      }
    };
    for (const r of routes) {
      add(r.start);
      add(r.end);
    }
    for (const h of homes) add(h.home);
    if (any) map.fitBounds(bounds, 56);
  }, [map, routes, homes]);
  return null;
}

const BEACHES_CENTER = { lat: 43.6725, lng: -79.2915 };

const ASSIGNED_OPTIONS = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "vacant", label: "Vacant" },
] as const;

const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "routes", label: "Routes" },
  { value: "drops", label: "Drops" },
] as const;

function readCssDurationMsFrom(el: Element, variable: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(variable).trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw) || fallback;
}

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
}) {
  const map = useMap("routes-map");
  const containerRef = useRef<HTMLDivElement>(null);
  const filterInnerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterClosing, setFilterClosing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterHeight, setFilterHeight] = useState(0);

  const filterVisible = props.filterOpen || filterClosing;

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keep panel mounted through the close animation; measure for card-resize height tween.
  useLayoutEffect(() => {
    if (props.filterOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setFilterClosing(false);
      setDropdownOpen(false);
      // Double rAF so the dropdown mounts at pre-scale before .is-open tweens in.
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
    // Local overlay overrides are 150ms / 100ms — read from the element, not :root.
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
    // Close orchestration is keyed on open only; height/closing are driven inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.filterOpen]);

  useLayoutEffect(() => {
    if (!dropdownOpen || !filterInnerRef.current) return;
    setFilterHeight(filterInnerRef.current.scrollHeight);
  }, [dropdownOpen, props.vacancy, props.deliveryType]);

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
          // Quick open/close for this overlay (overrides root durations locally).
          "--resize-dur": "150ms",
          "--dropdown-open-dur": "150ms",
          "--dropdown-close-dur": "100ms",
        } as CSSProperties
      }
    >
      {/* Fill + blur grow/shrink with the overlay as filters open/close */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-transparent" />
        <div className="map-ui-blur-fill absolute inset-0" />
      </div>

      <div className="pointer-events-auto relative z-10 flex items-center gap-2 px-4">
        <Button
          variant="outline"
          size="icon"
          shape="rounded"
          aria-label="Toggle filters"
          aria-expanded={props.filterOpen}
          className={cn(
            "size-[34px] hover:bg-tag-hover",
            props.filterOpen || filterClosing
              ? "border-active-border bg-tag-active text-active hover:bg-tag-active-hover"
              : "border-border bg-bg",
          )}
          onClick={props.onFilterToggle}
        >
          <Filter className="size-4" />
        </Button>

        <SearchBar
          value={props.search}
          onChange={props.onSearchChange}
          placeholder="Search Address, Route, or Volunteer"
          className="min-w-0 flex-1 bg-bg"
        />

        <Button
          variant="outline"
          size="icon"
          shape="rounded"
          aria-label="Zoom out"
          className="size-[34px] border-border bg-bg hover:bg-tag-hover"
          onClick={handleZoomOut}
        >
          <Minus className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          shape="rounded"
          aria-label="Zoom in"
          className="size-[34px] border-border bg-bg hover:bg-tag-hover"
          onClick={handleZoomIn}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          shape="rounded"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="size-[34px] border-border bg-bg hover:bg-tag-hover"
          onClick={handleFullscreen}
        >
          <span className="t-icon-swap size-4" data-state={isFullscreen ? "b" : "a"}>
            <span className="t-icon" data-icon="a">
              <Maximize2 className="size-4" />
            </span>
            <span className="t-icon" data-icon="b">
              <Minimize2 className="size-4" />
            </span>
          </span>
        </Button>
      </div>

      {/* Height tween (card resize) expands the gradient fill; dropdown scales/fades content */}
      <div className="t-resize relative z-10 overflow-hidden px-4" style={{ height: filterHeight }}>
        {filterVisible && (
          <div
            ref={filterInnerRef}
            className={cn(
              "t-dropdown pointer-events-auto flex flex-col gap-5 pt-5",
              dropdownOpen && "is-open",
              filterClosing && "is-closing",
            )}
            data-origin="top-left"
          >
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
              <p className="text-sm text-secondary">Type</p>
              <PillGroup
                exclusive
                options={[...TYPE_OPTIONS]}
                value={props.deliveryType}
                onChange={(value) => {
                  if (value != null) props.onDeliveryTypeChange(value as DeliveryTypeFilter);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RouteMap(props: {
  routes: MapRoute[];
  homes: MapHome[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  filterOpen: boolean;
  onFilterToggle: () => void;
  vacancy: VacancyFilter;
  onVacancyChange: (value: VacancyFilter) => void;
  deliveryType: DeliveryTypeFilter;
  onDeliveryTypeChange: (value: DeliveryTypeFilter) => void;
}) {
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
              onSelect={() => props.onSelect(r.id)}
            />
          ))}
          {props.homes.map((h) => (
            <HomeMarker key={h.id} home={h} />
          ))}
          <FitBounds routes={props.routes} homes={props.homes} />
        </Map>
        <MapControls
          search={props.search}
          onSearchChange={props.onSearchChange}
          filterOpen={props.filterOpen}
          onFilterToggle={props.onFilterToggle}
          vacancy={props.vacancy}
          onVacancyChange={props.onVacancyChange}
          deliveryType={props.deliveryType}
          onDeliveryTypeChange={props.onDeliveryTypeChange}
        />
      </APIProvider>
    </div>
  );
}
