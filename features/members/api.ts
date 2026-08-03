// Data layer for the members screen: query keys, fetchers, and mutations.
//
// Response types are imported from the services that produce them rather than
// re-declared here. That is deliberate: a hand-copied interface is a third copy of
// the contract waiting to drift (see the structural follow-up in
// docs/open_items.md). These are type-only imports, so no server code is bundled.
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { MemberRow } from "@/lib/services/members";
import type { MemberNote } from "@/lib/services/notes";
import type { CaptainPayoutHistoryEntry } from "@/lib/services/payouts";
import type { CaptainSummary } from "@/lib/services/captains";
import type { TerritoryDetail } from "@/lib/services/territories";
import type { VolunteerDetail } from "@/lib/services/volunteers";

export type { MemberRow, MemberNote, CaptainPayoutHistoryEntry };

export type MemberRole = "volunteer" | "captain";

export interface MembersFilters {
  role?: MemberRole;
  status?: "active" | "on-vacation" | "retired";
  q?: string;
}

/**
 * One factory for every key this screen uses, so an invalidation can never miss a
 * cache by mistyping its key. `members.list` deliberately includes the filters:
 * each filter combination is its own server query.
 */
export const memberKeys = {
  all: ["members"] as const,
  list: (filters: MembersFilters) => ["members", "list", filters] as const,
  volunteer: (id: string) => ["members", "volunteer", id] as const,
  captain: (id: string) => ["members", "captain", id] as const,
  notes: (role: MemberRole, id: string) => ["members", "notes", role, id] as const,
  payouts: (id: string) => ["members", "payouts", id] as const,
  territory: (id: string) => ["members", "territory", id] as const,
};

export function useMembers(filters: MembersFilters) {
  return useQuery({
    queryKey: memberKeys.list(filters),
    queryFn: () =>
      api.get<MemberRow[]>("/api/members", {
        role: filters.role,
        status: filters.status,
        q: filters.q,
      }),
    // Keep the previous rows on screen while a new filter loads, so the table does
    // not blank out on every keystroke of the search box.
    placeholderData: (previous) => previous,
  });
}

export function useVolunteer(id: string | null) {
  return useQuery({
    queryKey: memberKeys.volunteer(id ?? ""),
    queryFn: () => api.get<VolunteerDetail>(`/api/volunteers/${id}`),
    enabled: !!id,
  });
}

export function useCaptain(id: string | null) {
  return useQuery({
    queryKey: memberKeys.captain(id ?? ""),
    queryFn: () => api.get<CaptainSummary>(`/api/captains/${id}`),
    enabled: !!id,
  });
}

export function useMemberNotes(role: MemberRole | null, id: string | null) {
  return useQuery({
    queryKey: memberKeys.notes(role ?? "volunteer", id ?? ""),
    queryFn: () => api.get<MemberNote[]>(`/api/${role}s/${id}/notes`),
    enabled: !!role && !!id,
  });
}

export function useCaptainPayouts(id: string | null) {
  return useQuery({
    queryKey: memberKeys.payouts(id ?? ""),
    queryFn: () => api.get<CaptainPayoutHistoryEntry[]>(`/api/captains/${id}/payouts`),
    enabled: !!id,
  });
}

export function useTerritory(id: string | null | undefined) {
  return useQuery({
    queryKey: memberKeys.territory(id ?? ""),
    queryFn: () => api.get<TerritoryDetail>(`/api/territories/${id}`),
    enabled: !!id,
  } satisfies UseQueryOptions<TerritoryDetail>);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Retiring a volunteer vacates their routes, so the routes cache goes stale too. */
export function useRetireMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: MemberRole }) =>
      api.post<unknown>(`/api/${role}s/${id}/retire`),
    onSuccess: (_data, { id, role }) => {
      queryClient.invalidateQueries({ queryKey: memberKeys.all });
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      queryClient.invalidateQueries({
        queryKey: role === "volunteer" ? memberKeys.volunteer(id) : memberKeys.captain(id),
      });
    },
  });
}

export function useCreateNote(role: MemberRole, memberId: string) {
  const queryClient = useQueryClient();
  const key = memberKeys.notes(role, memberId);
  return useMutation({
    mutationFn: (text: string) => api.post<MemberNote>(`/api/${role}s/${memberId}/notes`, { text }),
    // Optimistic so adding a note feels instant, which is how it behaved on stub
    // data. Rolls back to the exact previous list if the request fails.
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MemberNote[]>(key) ?? [];
      const optimistic: MemberNote = {
        id: `optimistic-${crypto.randomUUID()}`,
        text,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      queryClient.setQueryData<MemberNote[]>(key, [optimistic, ...previous]);
      return { previous };
    },
    onError: (_err, _text, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateNote(role: MemberRole, memberId: string) {
  const queryClient = useQueryClient();
  const key = memberKeys.notes(role, memberId);
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.patch<MemberNote>(`/api/notes/${id}`, { text }),
    onMutate: async ({ id, text }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MemberNote[]>(key) ?? [];
      queryClient.setQueryData<MemberNote[]>(
        key,
        previous.map((n) => (n.id === id ? { ...n, text } : n)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteNote(role: MemberRole, memberId: string) {
  const queryClient = useQueryClient();
  const key = memberKeys.notes(role, memberId);
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/notes/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MemberNote[]>(key) ?? [];
      queryClient.setQueryData<MemberNote[]>(
        key,
        previous.filter((n) => n.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Set or clear a volunteer's vacation window (people flow §4e). */
export function useSetVacation(volunteerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { vacationStart: string; vacationEnd: string } | { clear: true }) =>
      api.post<VolunteerDetail>(`/api/volunteers/${volunteerId}/vacation`, input),
    onSuccess: () => {
      // Status is derived from the window, so both the row and the detail change.
      queryClient.invalidateQueries({ queryKey: memberKeys.all });
      queryClient.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}
