"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useMap } from "@vis.gl/react-google-maps";

import { cn } from "@/lib/utils";

import { RouteTag } from "./route-tag";

type LatLng = { lat: number; lng: number };

type HoverRoute = {
  id: string;
  label: string;
  lifecycle: "assigned" | "vacant";
  volunteerName: string | null;
  bundleCount: number;
  papers: number;
  start: { latitude: number; longitude: number } | null;
  end: { latitude: number; longitude: number } | null;
  path?: LatLng[] | null;
};

function routePath(route: HoverRoute): LatLng[] | null {
  if (route.path && route.path.length >= 2) return route.path;
  if (route.start && route.end) {
    return [
      { lat: route.start.latitude, lng: route.start.longitude },
      { lat: route.end.latitude, lng: route.end.longitude },
    ];
  }
  return null;
}

function dist2(a: LatLng, b: LatLng): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

/** Closest point on segment AB to P (planar lat/lng — fine at city scale). */
function closestOnSegment(p: LatLng, a: LatLng, b: LatLng): LatLng {
  const abx = b.lng - a.lng;
  const aby = b.lat - a.lat;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return a;
  const t = Math.max(0, Math.min(1, ((p.lng - a.lng) * abx + (p.lat - a.lat) * aby) / ab2));
  return { lat: a.lat + t * aby, lng: a.lng + t * abx };
}

/** Point on the plotted path nearest to the cursor — hover card slides along this. */
export function closestPointOnRoute(route: HoverRoute, cursor: LatLng): LatLng | null {
  const path = routePath(route);
  if (!path) return null;

  let best = path[0]!;
  let bestD = dist2(cursor, best);
  for (let i = 0; i < path.length - 1; i++) {
    const candidate = closestOnSegment(cursor, path[i]!, path[i + 1]!);
    const d = dist2(cursor, candidate);
    if (d < bestD) {
      bestD = d;
      best = candidate;
    }
  }
  return best;
}

function readCssDurationMs(variable: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw) || fallback;
}

/** Positions React content on the map via OverlayView (legacy 2D maps). */
function MapHtmlOverlay(props: { position: LatLng; children: React.ReactNode }) {
  const map = useMap();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const positionRef = useRef(props.position);
  positionRef.current = props.position;

  useEffect(() => {
    if (!map) return;

    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.zIndex = "40";
    // Preview only — must not steal pointer from the route underneath.
    div.style.pointerEvents = "none";

    class Overlay extends google.maps.OverlayView {
      onAdd() {
        this.getPanes()?.floatPane.appendChild(div);
        setContainer(div);
      }
      draw() {
        const projection = this.getProjection();
        const { lat, lng } = positionRef.current;
        const point = projection?.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
        if (point) {
          div.style.left = `${point.x}px`;
          div.style.top = `${point.y}px`;
        }
      }
      onRemove() {
        div.remove();
        setContainer(null);
      }
    }

    const overlay = new Overlay();
    overlayRef.current = overlay;
    overlay.setMap(map);
    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    overlayRef.current?.draw();
  }, [props.position.lat, props.position.lng]);

  if (!container) return null;
  return createPortal(props.children, container);
}

/**
 * Figma route-hover preview (node 1040:15003).
 * Anchors to a point on the route (slides with the cursor); open/close via `.t-dropdown`.
 */
export function RouteHoverCard(props: {
  open: boolean;
  route: HoverRoute | null;
  position: LatLng | null;
}) {
  const { open, route, position } = props;

  const [snapshot, setSnapshot] = useState<{
    route: HoverRoute;
    position: LatLng;
  } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOpenRef = useRef(false);

  const visible = snapshot != null;
  const openRouteId = open && route ? route.id : null;

  // Open/close keyed on route identity only — position updates must not re-run enter anim.
  useLayoutEffect(() => {
    if (openRouteId && route && position) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setSnapshot({ route, position });
      setClosing(false);

      if (!wasOpenRef.current) {
        wasOpenRef.current = true;
        setDropdownOpen(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setDropdownOpen(true));
        });
      } else {
        setDropdownOpen(true);
      }
      return;
    }

    if (!wasOpenRef.current && !snapshot) return;

    wasOpenRef.current = false;
    setDropdownOpen(false);
    setClosing(true);
    const closeMs = readCssDurationMs("--dropdown-close-dur", 150);
    closeTimerRef.current = setTimeout(() => {
      setClosing(false);
      setSnapshot(null);
      closeTimerRef.current = null;
    }, closeMs);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRouteId]);

  // Slide + content refresh while open.
  useEffect(() => {
    if (!open || !route || !position || closing) return;
    setSnapshot({ route, position });
  }, [open, route, position, closing]);

  if (!visible || !snapshot) return null;

  const volunteer = snapshot.route.volunteerName ?? "vacant";
  const counts = `${snapshot.route.bundleCount}B, ${snapshot.route.papers}P`;
  const isVacant = snapshot.route.lifecycle === "vacant";

  return (
    <MapHtmlOverlay position={snapshot.position}>
      {/* ~25% tighter than prior h-8 bridge: h-6 gap under the pointer tip. */}
      <div className="flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <div
          className={cn("t-dropdown", dropdownOpen && "is-open", closing && "is-closing")}
          data-origin="bottom-center"
        >
          <div
            className={cn(
              "flex w-max max-w-[14rem] flex-col gap-1 rounded-xl bg-bg p-1 pb-2 text-left shadow-md select-none",
              "text-md",
            )}
          >
            <RouteTag label={snapshot.route.label} vacant={isVacant} />
            <span className="flex w-full items-center justify-between gap-3 px-2 text-md text-secondary">
              <span className="min-w-0 truncate">{volunteer}</span>
              <span className="shrink-0 tabular-nums">{counts}</span>
            </span>
          </div>

          <div className="flex flex-col items-center" aria-hidden>
            <div className="size-2.5 -mt-1.5 rotate-45 bg-bg shadow-sm" />
            <div className="-mt-1 h-6 w-0" />
          </div>
        </div>
      </div>
    </MapHtmlOverlay>
  );
}
