// Members: the unified people list behind the members table.
//
// Volunteers and captains are separate resources with genuinely different shapes,
// and they stay that way for detail views. But the members screen shows one table
// with a role column, so the merge has to happen somewhere. It happens HERE rather
// than in the component, so the row shape is typed and testable in one place, and
// so "Showing X of Y" counts an honest server-side filter rather than whatever the
// browser happened to have fetched.
import type { z } from "zod";

import type { membersQuery } from "@/lib/validation/people";

import { listCaptains } from "./captains";
import { listTerritories } from "./territories";
import { listVolunteers } from "./volunteers";

export type MemberRole = "volunteer" | "captain";

/** Volunteers carry all three; captains are only ever active or retired. */
export type MemberStatus = "active" | "on-vacation" | "retired";

export interface MemberRow {
  id: string;
  role: MemberRole;
  /** Formatted once, here, so every consumer shows the same thing. */
  name: string;
  /**
   * Volunteers: their route label, or "N routes" past one, or "No route".
   * Captains: their territory as "N volunteers, M drops".
   */
  routeInfo: string;
  /** Volunteers: the captain above them. Captains: themselves. */
  captainName: string;
  /** ISO. The UI decides how to display it. */
  startDate: string;
  status: MemberStatus;
  needsAttention: boolean;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export async function listMembers(filters: z.infer<typeof membersQuery>): Promise<MemberRow[]> {
  // Skip the half we were not asked for. Both underlying lists read whole tables,
  // so not calling one is a real saving on the role-filtered views.
  const wantVolunteers = filters.role !== "captain";
  const wantCaptains = filters.role !== "volunteer";

  const [volunteers, captains, territories] = await Promise.all([
    wantVolunteers ? listVolunteers({}) : Promise.resolve([]),
    wantCaptains ? listCaptains({}) : Promise.resolve([]),
    wantCaptains ? listTerritories({}) : Promise.resolve([]),
  ]);

  const volunteerRows: MemberRow[] = volunteers.map((v) => ({
    id: v.id,
    role: "volunteer",
    name: `${v.firstName} ${v.lastName}`,
    routeInfo:
      v.routesCarried.length === 0
        ? "No route"
        : v.routesCarried.length === 1
          ? v.routesCarried[0].label
          : plural(v.routesCarried.length, "route"),
    captainName: v.territory?.captainName ?? "No captain",
    startDate: v.startDate,
    status: v.status,
    needsAttention: v.needsAttention,
  }));

  const territoryById = new Map(territories.map((t) => [t.id, t]));

  const captainRows: MemberRow[] = captains.map((c) => {
    const territory = c.territory ? territoryById.get(c.territory.id) : undefined;
    return {
      id: c.id,
      role: "captain",
      name: `${c.firstName} ${c.lastName}`,
      // Territories have no name or number in the schema, so describe the
      // territory by what it contains. See docs/open_items.md if the office
      // turns out to refer to territories by number.
      routeInfo: territory
        ? `${plural(territory.volunteerCount, "volunteer")}, ${plural(territory.commercialDropCount, "drop")}`
        : "No territory",
      captainName: `${c.firstName} ${c.lastName}`,
      startDate: c.startDate,
      status: c.status,
      // Captains have no end-date attention flag; only volunteers do (people §3a).
      needsAttention: false,
    };
  });

  let all = [...volunteerRows, ...captainRows];

  if (filters.status) all = all.filter((m) => m.status === filters.status);
  if (filters.needsAttention !== undefined) {
    all = all.filter((m) => m.needsAttention === filters.needsAttention);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    all = all.filter((m) => m.name.toLowerCase().includes(q));
  }

  // Surname order, matching how both underlying lists already sort, so the merged
  // table does not reshuffle when a role filter is toggled.
  return all.sort((a, b) => {
    const aLast = a.name.split(" ").slice(-1)[0] ?? a.name;
    const bLast = b.name.split(" ").slice(-1)[0] ?? b.name;
    return aLast.localeCompare(bLast) || a.name.localeCompare(b.name);
  });
}
