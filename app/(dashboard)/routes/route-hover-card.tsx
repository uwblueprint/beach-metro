"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useMap } from "@vis.gl/react-google-maps";

import { cn } from "@/lib/utils";

import { RouteTag } from "./route-tag";

type HoverRoute = {
  id: string;
  label: string;
  lifecycle: "assigned" | "vacant";
  volunteerName: string | null;
  bundleCount: number;
  papers: number;
  start: { latitude: number; longitude: number } | null;
  end: { latitude: number; longitude: number } | null;
  path?: { lat: number; lng: number }[] | null;
};

/** Midpoint of the plotted path — anchor for the hover card. */
export function routeMidpoint(route: HoverRoute): google.maps.LatLngLiteral | null {
  if (route.path && route.path.length >= 2) {
    return route.path[Math.floor(route.path.length / 2)]!;
  }
  if (route.start && route.end) {
    return {
      lat: (route.start.latitude + route.end.latitude) / 2,
      lng: (route.start.longitude + route.end.longitude) / 2,
    };
  }
  return null;
}

function readCssDurationMs(variable: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw) || fallback;
}

/** Positions React content on the map via OverlayView (legacy 2D maps). */
function MapHtmlOverlay(props: { position: google.maps.LatLngLiteral; children: React.ReactNode }) {
  const map = useMap();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map) return;

    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.zIndex = "40";

    class Overlay extends google.maps.OverlayView {
      onAdd() {
        this.getPanes()?.floatPane.appendChild(div);
        setContainer(div);
      }
      draw() {
        const projection = this.getProjection();
        const point = projection?.fromLatLngToDivPixel(
          new google.maps.LatLng(props.position.lat, props.position.lng),
        );
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
    overlay.setMap(map);
    return () => overlay.setMap(null);
  }, [map, props.position.lat, props.position.lng]);

  if (!container) return null;
  return createPortal(props.children, container);
}

/**
 * Figma route-hover preview (node 1040:15003) with pointer + bridge hit area.
 * Open/close uses transitions-dev menu dropdown (`.t-dropdown`).
 */
export function RouteHoverCard(props: {
  open: boolean;
  route: HoverRoute | null;
  position: google.maps.LatLngLiteral | null;
  onSelect: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const { open, route, position, onSelect, onPointerEnter, onPointerLeave } = props;

  const [snapshot, setSnapshot] = useState<{
    route: HoverRoute;
    position: google.maps.LatLngLiteral;
  } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOpenRef = useRef(false);

  const visible = snapshot != null;
  const openRouteId = open && route ? route.id : null;
  const openLat = open && position ? position.lat : null;
  const openLng = open && position ? position.lng : null;

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
        // Rest at pre-scale, then open (transitions-dev dropdown orchestration).
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
    // Intentionally keyed on open identity, not route object reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRouteId, openLat, openLng]);

  // Keep snapshot content fresh while open (route ↔ route switch without remount flash).
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
      <div className="flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <div
          className={cn("t-dropdown", dropdownOpen && "is-open", closing && "is-closing")}
          data-origin="bottom-center"
          onMouseEnter={onPointerEnter}
          onMouseLeave={onPointerLeave}
        >
          <button
            type="button"
            className={cn(
              "group/button flex w-max max-w-[14rem] cursor-pointer flex-col gap-1 rounded-xl bg-bg p-1 pb-2 text-left shadow-md outline-none select-none",
              "text-md focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
            onClick={onSelect}
          >
            <RouteTag label={snapshot.route.label} vacant={isVacant} />
            <span className="flex w-full items-center justify-between gap-3 px-2 text-md text-secondary">
              <span className="min-w-0 truncate">{volunteer}</span>
              <span className="shrink-0 tabular-nums">{counts}</span>
            </span>
          </button>

          {/* Pointer + invisible bridge so the cursor can reach the card from the line. */}
          <div className="flex flex-col items-center" aria-hidden>
            <div className="size-2.5 -mt-1.5 rotate-45 bg-bg shadow-sm" />
            <div className="-mt-1 h-8 w-16" />
          </div>
        </div>
      </div>
    </MapHtmlOverlay>
  );
}
