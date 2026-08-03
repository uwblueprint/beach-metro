// Data layer for the New Territory Drop dialog: captains, candidates, mutations.
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { CaptainSummary } from "@/lib/services/captains";
import type { TerritoryDetail, TerritorySummary } from "@/lib/services/territories";
import type { VolunteerSummary } from "@/lib/services/volunteers";

export const territoryDropKeys = {
  all: ["territory-drops"] as const,
  captains: ["territory-drops", "captains"] as const,
  volunteers: ["territory-drops", "volunteers"] as const,
  territories: ["territory-drops", "territories"] as const,
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
    // No status filter — dialog shows all non-retired “current” volunteers.
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

/** Flatten commercial drops across every territory for the Drop Details list. */
export function useCommercialDropCandidates() {
  const summaries = useTerritorySummaries();
  const details = useQueries({
    queries: (summaries.data ?? []).map((t) => ({
      queryKey: territoryDropKeys.territory(t.id),
      queryFn: () => api.get<TerritoryDetail>(`/api/territories/${t.id}`),
      enabled: !!summaries.data,
    })),
  });

  const isPending = summaries.isPending || details.some((q) => q.isPending);
  const isError = summaries.isError || details.some((q) => q.isError);

  const drops: Array<{
    addressId: string;
    placeId: string;
    label: string;
    territoryId: string;
    territoryBadge: string | null;
  }> = [];

  for (let i = 0; i < details.length; i++) {
    const summary = summaries.data?.[i];
    const detail = details[i]?.data;
    if (!summary || !detail) continue;
    const badge = detail.captain?.name ?? null;
    for (const drop of detail.commercialDrops) {
      drops.push({
        addressId: drop.id,
        placeId: drop.placeId,
        label: drop.formattedAddress ?? "Address not geocoded yet",
        territoryId: summary.id,
        territoryBadge: badge,
      });
    }
  }

  return { drops, isPending, isError };
}

function invalidateTerritoryCaches(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: territoryDropKeys.all });
  // Members data-layer (PR #26) uses this prefix when present.
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

export function useCreateVolunteerForTerritory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      addressLines: string[];
      startDate: string;
      captainTerritoryId: string;
    }) =>
      api.post("/api/volunteers", {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        address: { addressLines: input.addressLines },
        startDate: input.startDate,
        captainTerritoryId: input.captainTerritoryId,
        note: null,
      }),
    onSuccess: () => invalidateTerritoryCaches(queryClient),
  });
}

export type { CaptainSummary, TerritoryDetail, VolunteerSummary };
