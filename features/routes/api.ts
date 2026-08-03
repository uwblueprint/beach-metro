// Client helpers for route create / edit from the members side panel.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { RouteDetail, RouteSummary } from "@/lib/services/routes";

export const routeKeys = {
  all: ["routes"] as const,
  byVolunteer: (volunteerId: string) => ["routes", "volunteer", volunteerId] as const,
  detail: (id: string) => ["routes", "detail", id] as const,
};

export function useVolunteerRoutes(volunteerId: string | null | undefined) {
  return useQuery({
    queryKey: routeKeys.byVolunteer(volunteerId ?? ""),
    queryFn: () => api.get<RouteSummary[]>("/api/routes", { volunteerId: volunteerId! }),
    enabled: !!volunteerId,
  });
}

export function useRouteDetail(routeId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: routeKeys.detail(routeId ?? ""),
    queryFn: () => api.get<RouteDetail>(`/api/routes/${routeId}`),
    enabled: enabled && !!routeId,
  });
}

export type CreateRouteBody = {
  startAddress: { addressLines: string[] } | { placeId: string };
  endAddress: { addressLines: string[] } | { placeId: string };
  streetName: string;
  assignedVolunteerId?: string | null;
  houseCount?: number;
  bundles: Array<{ papers: number }>;
  note?: string | null;
};

export type UpdateRouteBody = {
  startAddress?: { addressLines: string[] } | { placeId: string };
  endAddress?: { addressLines: string[] } | { placeId: string };
  streetName?: string;
  bundles?: Array<{ papers: number }>;
  note?: string | null;
};

export function useCreateRoute(volunteerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRouteBody) => api.post<RouteDetail>("/api/routes", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: routeKeys.byVolunteer(volunteerId) });
    },
  });
}

export function useUpdateRoute(volunteerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRouteBody }) =>
      api.patch<RouteDetail>(`/api/routes/${id}`, body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: routeKeys.byVolunteer(volunteerId) });
      void qc.invalidateQueries({ queryKey: routeKeys.detail(vars.id) });
    },
  });
}
