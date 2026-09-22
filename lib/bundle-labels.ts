import type { BundleRef } from "@/lib/validation/labels";

/** Compare per-row label checkbox state (same length arrays). */
export function labelledArraysEqual(a: boolean[], b: boolean[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((flag, i) => flag === b[i]);
}

/** Baseline labelled flags for `rowCount` bundles on a route in the label sheet. */
export function baselineLabelledForRoute(
  rowCount: number,
  bundles: ReadonlyArray<{ labelled: boolean }> | undefined,
): boolean[] {
  return Array.from({ length: rowCount }, (_, i) => bundles?.[i]?.labelled ?? false);
}

/** Bundles whose labelled flag changed between baseline and the current edit. */
export function diffLabelMarks(
  deliveryId: string,
  baseline: boolean[],
  current: boolean[],
): { mark: BundleRef[]; unmark: BundleRef[] } {
  const mark: BundleRef[] = [];
  const unmark: BundleRef[] = [];
  const len = Math.max(baseline.length, current.length);
  for (let i = 0; i < len; i++) {
    const was = baseline[i] ?? false;
    const now = current[i] ?? false;
    if (now && !was) mark.push({ deliveryId, bundleIndex: i });
    if (!now && was) unmark.push({ deliveryId, bundleIndex: i });
  }
  return { mark, unmark };
}
