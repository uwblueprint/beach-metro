// Data layer for the labels screen: query keys, fetchers, and the PDF download.
//
// Response types come from the service that produces them (type-only imports, so
// no server code is bundled), matching features/members/api.ts.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/lib/api/client";
import type { LabelBundle, LabelGroup, LabelRoute, LabelSheet } from "@/lib/services/labels";
import type { BundleRef } from "@/lib/validation/labels";

export type { LabelBundle, LabelGroup, LabelRoute, LabelSheet, BundleRef };

export const labelKeys = {
  all: ["labels"] as const,
  sheet: () => ["labels", "sheet"] as const,
};

export function useLabels() {
  return useQuery({
    queryKey: labelKeys.sheet(),
    queryFn: () => api.get<LabelSheet>("/api/labels"),
  });
}

export function useMarkLabels() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bundles: BundleRef[]; labelled: boolean }) =>
      api.post<{ labelled: number }>("/api/labels/mark", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: labelKeys.all }),
  });
}

/**
 * Export bundles to a PDF and save it.
 *
 * Hand-rolled rather than going through `api.post`, because this endpoint answers
 * with PDF bytes instead of the `{ data }` envelope. Failures still come back as
 * that envelope, so the content type decides how to read the body.
 */
async function downloadLabelPdf(input: { bundles: BundleRef[] }): Promise<number> {
  let res: Response;
  try {
    res = await fetch("/api/labels/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    throw new ApiError("network", err instanceof Error ? err.message : "Export failed.", 0);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: never; message?: string };
    } | null;
    throw new ApiError("internal", body?.error?.message ?? "Export failed.", res.status);
  }

  const blob = await res.blob();
  const filename =
    res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "labels.pdf";

  // Anchor-click is the only way to name a downloaded blob from the browser.
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return Number(res.headers.get("x-label-count") ?? 0);
}

export function useExportLabels() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: downloadLabelPdf,
    // Exporting marks the bundles labelled server-side, so the table is stale.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: labelKeys.all }),
  });
}
