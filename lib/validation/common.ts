// Shared Zod primitives. Schemas here are the single source of request shapes —
// handlers parse with them (422 on failure) and services trust the parsed types.
import { z } from "zod";

export const uuid = z.uuid();

/** ISO calendar date, e.g. "2026-07-06" (DateOnly in the data model). */
export const isoDate = z.iso.date();

/** Free-form notes; empty string normalizes to null. */
export const noteField = z
  .string()
  .trim()
  .transform((s) => (s.length === 0 ? null : s))
  .nullish();

/** "true"/"false" query-string flags. */
export const boolQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

/**
 * AddressInput per the API spec: raw address lines (validated via the Maps
 * provider) OR a known { placeId } from autocomplete / an existing record.
 */
export const addressInput = z.union([
  z.object({ placeId: z.string().min(1) }),
  z.object({
    addressLines: z.array(z.string().trim().min(1)).min(1),
    locality: z.string().trim().min(1).optional(),
    administrativeArea: z.string().trim().min(1).optional(),
    postalCode: z.string().trim().min(1).optional(),
    regionCode: z.literal("CA").optional(),
  }),
]);
export type AddressInput = z.infer<typeof addressInput>;
