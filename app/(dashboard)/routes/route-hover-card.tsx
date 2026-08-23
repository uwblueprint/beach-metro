"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useMap } from "@vis.gl/react-google-maps";

import { cn } from "@/lib/utils";

import { RouteTag } from "./route-tag";

type HoverRoute = {
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

/** Figma route-hover preview (node 1040:15003) with pointer + bridge hit area. */
export function RouteHoverCard(props: {
  route: HoverRoute;
  position: google.maps.LatLngLiteral;
  onSelect: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const { route, position, onSelect, onPointerEnter, onPointerLeave } = props;
  const volunteer = route.volunteerName ?? "vacant";
  const counts = `${route.bundleCount}B, ${route.papers}P`;
  const isVacant = route.lifecycle === "vacant";

  return (
    <MapHtmlOverlay position={position}>
      <div
        className="pointer-events-auto flex -translate-x-1/2 -translate-y-full flex-col items-center"
        onMouseEnter={onPointerEnter}
        onMouseLeave={onPointerLeave}
      >
        <button
          type="button"
          className={cn(
            "group/button pointer-events-auto flex w-max max-w-[14rem] cursor-pointer flex-col gap-1 rounded-xl bg-bg p-1 pb-2 text-left shadow-md outline-none select-none",
            "text-md transition-all focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
          onClick={onSelect}
        >
          <RouteTag label={route.label} vacant={isVacant} />
          <span className="flex w-full items-center justify-between gap-3 px-2 text-md text-secondary">
            <span className="min-w-0 truncate">{volunteer}</span>
            <span className="shrink-0 tabular-nums">{counts}</span>
          </span>
        </button>

        {/* Pointer + invisible bridge so the cursor can reach the card from the line. */}
        <div className="pointer-events-auto flex flex-col items-center" aria-hidden>
          <div className="size-2.5 -mt-1.5 rotate-45 bg-bg shadow-sm" />
          <div className="pointer-events-auto -mt-1 h-8 w-16" />
        </div>
      </div>
    </MapHtmlOverlay>
  );
}
