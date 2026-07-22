"use client";

// The map half of the routes page: Google Map via @vis.gl/react-google-maps,
// routes as start→end polylines colored by state, optional volunteer-home dots.
// Functional layer only — visual polish belongs to the design engineers.

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

// Raw hex (polylines can't use CSS variables). Matches the badge tones in the list.
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

/** One route polyline, managed imperatively (vis.gl has no Polyline component). */
function RoutePolyline(props: { route: MapRoute; selected: boolean; onSelect: () => void }) {
  const map = useMap();
  const { route, selected, onSelect } = props;

  useEffect(() => {
    if (!map || !route.start || !route.end) return;
    const dashed = route.suspended; // suspended = dashed, mirroring "paused"
    const line = new google.maps.Polyline({
      map,
      path: [
        { lat: route.start.latitude, lng: route.start.longitude },
        { lat: route.end.latitude, lng: route.end.longitude },
      ],
      strokeColor: routeColor(route, selected),
      strokeWeight: selected ? 6 : 4,
      strokeOpacity: dashed ? 0 : 0.9,
      ...(dashed
        ? {
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                offset: "0",
                repeat: "12px",
              },
            ],
          }
        : {}),
      zIndex: selected ? 10 : 1,
    });
    line.addListener("click", onSelect);
    return () => {
      google.maps.event.clearInstanceListeners(line);
      line.setMap(null);
    };
  }, [map, route, selected, onSelect]);

  return null;
}

/** Small dot for a volunteer's home. */
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
        fillColor: "#7c3aed",
        fillOpacity: 0.9,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
      },
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
    for (const r of routes) {
      if (r.start) {
        bounds.extend({ lat: r.start.latitude, lng: r.start.longitude });
        any = true;
      }
      if (r.end) {
        bounds.extend({ lat: r.end.latitude, lng: r.end.longitude });
        any = true;
      }
    }
    for (const h of homes) {
      if (h.home) {
        bounds.extend({ lat: h.home.latitude, lng: h.home.longitude });
        any = true;
      }
    }
    if (any) map.fitBounds(bounds, 48);
  }, [map, routes, homes]);
  return null;
}

const BEACHES_CENTER = { lat: 43.671, lng: -79.308 };

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
        disableDefaultUI={false}
        streetViewControl={false}
        mapTypeControl={false}
        className="h-full w-full rounded-lg border"
      >
        {props.routes.map((r) => (
          <RoutePolyline
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
