"use client";

// The map half of the routes page: Google Map via @vis.gl/react-google-maps,
// routes as start→end polylines colored by state, optional volunteer-home dots.
// Functional layer only — visual polish belongs to the design engineers. The
// grayscale style is a neutral placeholder that matches the mockups' tone.

import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

export interface MapRoute {
  id: string;
  streetName: string;
  lifecycle: "assigned" | "vacant";
  suspended: boolean;
  needsAttention: boolean;
  start: { latitude: number; longitude: number } | null;
  end: { latitude: number; longitude: number } | null;
}

export interface MapHome {
  id: string;
  name: string;
  home: { latitude: number; longitude: number } | null;
}

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

    const line = new google.maps.Polyline({
      map,
      path: [from, to],
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

export function RouteMap(props: {
  routes: MapRoute[];
  homes: MapHome[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!browserKey) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center rounded-lg border text-sm">
        NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is not set — the map cannot load.
      </div>
    );
  }

  return (
    <APIProvider apiKey={browserKey}>
      <Map
        defaultCenter={BEACHES_CENTER}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI={true}
        zoomControl={true}
        fullscreenControl={true}
        styles={MAP_STYLE}
        className="h-full w-full overflow-hidden rounded-lg border"
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
    </APIProvider>
  );
}
