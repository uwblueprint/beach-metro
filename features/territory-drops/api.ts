// Data layer for the New Territory Drop dialog: candidates + mutations.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { CaptainSummary } from "@/lib/services/captains";
import type {
  CommercialDropCandidate,
  TerritoryDetail,
  TerritorySummary,
} from "@/lib/services/territories";
import type { VolunteerSummary } from "@/lib/services/volunteers";

export const territoryDropKeys = {
  all: ["territory-drops"] as const,
  captains: ["territory-drops", "captains"] as const,
  volunteers: ["territory-drops", "volunteers"] as const,
  territories: ["territory-drops", "territories"] as const,
  commercialDrops: ["territory-drops", "commercial-drops"] as const,
  territory: (id: string) => ["territory-drops", "territory", id] as const,
};

export function useCaptainsList() {
  return useQuery({
    queryKey: territoryDropKeys.captains,
    queryFn: () => api.get<CaptainSummary[]>("/api/captains", { status: "active" }),
  });
}

export function useVolunteersList() {
  return useQuery({
    queryKey: territoryDropKeys.volunteers,
    // No status filter — Drop Details lists every volunteer.
    queryFn: () => api.get<VolunteerSummary[]>("/api/volunteers"),
  });
}

export function useTerritorySummaries() {
  return useQuery({
    queryKey: territoryDropKeys.territories,
    queryFn: () => api.get<TerritorySummary[]>("/api/territories"),
  });
}

export function useTerritory(id: string | null | undefined) {
  return useQuery({
    queryKey: territoryDropKeys.territory(id ?? ""),
    queryFn: () => api.get<TerritoryDetail>(`/api/territories/${id}`),
    enabled: !!id,
  });
}

/** Every commercial drop in the system (single request). */
export function useCommercialDropCandidates() {
  return useQuery({
    queryKey: territoryDropKeys.commercialDrops,
    queryFn: () => api.get<CommercialDropCandidate[]>("/api/commercial-drops"),
  });
}

function invalidateTerritoryCaches(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: territoryDropKeys.all });
  queryClient.invalidateQueries({ queryKey: ["members"] });
}

export function useAssignVolunteerToTerritory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ territoryId, volunteerId }: { territoryId: string; volunteerId: string }) =>
      api.post<TerritoryDetail>(`/api/territories/${territoryId}/volunteers`, { volunteerId }),
    onSuccess: () => invalidateTerritoryCaches(queryClient),
  });
}

export function useAddCommercialDrop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      territoryId,
      address,
      previousTerritoryId,
      previousAddressId,
    }: {
      territoryId: string;
      address: { placeId: string } | { addressLines: string[] };
      /** When reallocating an existing drop, remove it from the prior territory first. */
      previousTerritoryId?: string | null;
      previousAddressId?: string | null;
    }) => {
      if (previousTerritoryId && previousAddressId && previousTerritoryId !== territoryId) {
        await api.del(
          `/api/territories/${previousTerritoryId}/commercial-drops/${previousAddressId}`,
        );
      }
      return api.post<TerritoryDetail>(`/api/territories/${territoryId}/commercial-drops`, {
        address,
      });
    },
    onSuccess: () => invalidateTerritoryCaches(queryClient),
  });
}

export type { CaptainSummary, CommercialDropCandidate, TerritoryDetail, VolunteerSummary };
