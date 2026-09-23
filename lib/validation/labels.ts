// Request schemas for the label printing domain (PRD Flow 6).
import { z } from "zod";

/**
 * A bundle's address on the wire. Bundles have no id — they are positions in
 * `route_deliveries.bundles` — so every label request names them this way.
 */
export const bundleRef = z.object({
  deliveryId: z.uuid(),
  bundleIndex: z.number().int().min(0),
});
export type BundleRef = z.infer<typeof bundleRef>;

/**
 * POST /api/labels/mark — bulk set/clear the labelled flag.
 * One shape for both directions so the table's "Mark labelled" bulk action and
 * a single row's checkbox hit the same endpoint.
 */
export const markLabels = z.object({
  bundles: z.array(bundleRef).min(1),
  labelled: z.boolean(),
});

/**
 * POST /api/labels/export — render the chosen bundles to a PDF sheet.
 *
 * An empty `bundles` array is rejected rather than treated as "everything":
 * exporting the whole issue by accident wastes a stack of label stock.
 */
export const exportLabels = z.object({
  bundles: z.array(bundleRef).min(1),
  /**
   * Which issue the bundles belong to. Omitted means the open issue, which is
   * the everyday case; supplied means a reprint of a past run.
   */
  issueId: z.uuid().optional(),
  /**
   * Mark every exported bundle as labelled once the PDF renders. Defaults on:
   * printing a label IS the act of labelling it, and the office should not have
   * to remember a second click.
   */
  markLabelled: z.boolean().default(true),
});

/** GET /api/labels — optionally point the screen at a past issue to reprint. */
export const labelsQuery = z.object({
  issueId: z.uuid().optional(),
});
