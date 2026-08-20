"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import type { LabelGroup, LabelRoute } from "@/features/labels/api";
import { cn } from "@/lib/utils";

/** Stable key for one bundle. Bundles have no id — see the bundle_labels migration. */
export function bundleKey(deliveryId: string, bundleIndex: number): string {
  return `${deliveryId}:${bundleIndex}`;
}

export function parseBundleKey(key: string): { deliveryId: string; bundleIndex: number } {
  const at = key.lastIndexOf(":");
  return { deliveryId: key.slice(0, at), bundleIndex: Number(key.slice(at + 1)) };
}

interface Props {
  groups: LabelGroup[];
  selected: Set<string>;
  expanded: Set<string>;
  onToggleBundle: (key: string) => void;
  onToggleRoute: (route: LabelRoute) => void;
  onToggleExpand: (deliveryId: string) => void;
}

function routeKeys(route: LabelRoute): string[] {
  return route.bundles.map((b) => bundleKey(b.deliveryId, b.bundleIndex));
}

export function LabelsTable({
  groups,
  selected,
  expanded,
  onToggleBundle,
  onToggleRoute,
  onToggleExpand,
}: Props) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-secondary border-hairline border-b text-left">
            <th className="w-10 py-2" />
            <th className="py-2 font-normal">Bundle</th>
            <th className="py-2 font-normal">Count</th>
            <th className="w-28 py-2 text-right font-normal">Labelled</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows
              key={group.captainId ?? "unassigned"}
              group={group}
              selected={selected}
              expanded={expanded}
              onToggleBundle={onToggleBundle}
              onToggleRoute={onToggleRoute}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  group,
  selected,
  expanded,
  onToggleBundle,
  onToggleRoute,
  onToggleExpand,
}: { group: LabelGroup } & Omit<Props, "groups">) {
  return (
    <>
      <tr className="bg-bg-secondary">
        <td />
        <td colSpan={3} className="py-2">
          <span className="text-primary">{group.captainName}</span>{" "}
          <span className="text-secondary">
            {group.labelledCount}/{group.bundleCount} labelled
          </span>
        </td>
      </tr>

      {group.routes.map((route) => {
        const keys = routeKeys(route);
        const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
        const isOpen = expanded.has(route.deliveryId);

        return (
          <RouteRows
            key={route.deliveryId}
            route={route}
            allSelected={allSelected}
            isOpen={isOpen}
            selected={selected}
            onToggleBundle={onToggleBundle}
            onToggleRoute={onToggleRoute}
            onToggleExpand={onToggleExpand}
          />
        );
      })}
    </>
  );
}

function RouteRows({
  route,
  allSelected,
  isOpen,
  selected,
  onToggleBundle,
  onToggleRoute,
  onToggleExpand,
}: {
  route: LabelRoute;
  allSelected: boolean;
  isOpen: boolean;
  selected: Set<string>;
  onToggleBundle: (key: string) => void;
  onToggleRoute: (route: LabelRoute) => void;
  onToggleExpand: (deliveryId: string) => void;
}) {
  return (
    <>
      <tr className="border-hairline border-b">
        <td className="py-2 pl-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleExpand(route.deliveryId)}
              aria-label={isOpen ? `Collapse ${route.routeName}` : `Expand ${route.routeName}`}
              aria-expanded={isOpen}
              className="text-secondary hover:text-primary flex size-5 items-center justify-center"
            >
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => onToggleRoute(route)}
              aria-label={`Select all bundles on ${route.routeName}`}
            />
          </div>
        </td>
        <td className="text-primary py-2">
          {route.routeName}
          {route.volunteerName ? (
            <span className="text-secondary"> · {route.volunteerName}</span>
          ) : (
            <span className="text-secondary"> · Vacant</span>
          )}
        </td>
        <td className="text-secondary py-2">
          {route.bundleCount} {route.bundleCount === 1 ? "bundle" : "bundles"}, {route.papers}{" "}
          papers
        </td>
        <td className="text-secondary py-2 text-right">
          {route.labelledCount}/{route.bundleCount}
        </td>
      </tr>

      {isOpen &&
        route.bundles.map((bundle) => {
          const key = bundleKey(bundle.deliveryId, bundle.bundleIndex);
          return (
            <tr key={key} className="border-hairline border-b">
              <td className="py-2 pl-8">
                <Checkbox
                  checked={selected.has(key)}
                  onCheckedChange={() => onToggleBundle(key)}
                  aria-label={`Select bundle ${bundle.bundleIndex + 1} on ${route.routeName}`}
                />
              </td>
              <td className={cn("text-secondary py-2 pl-4")}>Bundle {bundle.bundleIndex + 1}</td>
              <td className="text-secondary py-2">{bundle.papers} papers</td>
              <td className="text-secondary py-2 text-right">
                {bundle.labelled ? "Labelled" : "—"}
              </td>
            </tr>
          );
        })}
    </>
  );
}
