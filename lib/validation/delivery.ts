// Request schemas for the delivery domain.
import { z } from "zod";

const bundle = z.object({ papers: z.number().int().min(1) });

/**
 * PATCH /api/deliveries/{id}. bundleCount is derived (bundles.length) and not
 * settable. If bundles are provided they must sum to the (new or existing)
 * paperCount — the cross-field check against the existing row happens in the
 * service; this schema checks the same-request case.
 */
export const updateDelivery = z
  .object({
    paperCount: z.number().int().min(0),
    bundles: z.array(bundle),
    dropCount: z.number().int().min(0),
    missedCount: z.number().int().min(0),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." })
  .refine(
    (o) =>
      o.paperCount === undefined ||
      o.bundles === undefined ||
      o.bundles.reduce((s, b) => s + b.papers, 0) === o.paperCount,
    { message: "bundles must sum to paperCount." },
  );
