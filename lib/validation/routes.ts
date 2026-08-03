// Request schemas for the routes domain.
import { z } from "zod";

import { addressInput, boolQuery, noteField, uuid } from "./common";

const routeBundle = z.object({ papers: z.number().int().min(1) });

export const routesQuery = z.object({
  vacancy: z.enum(["vacant", "assigned"]).optional(),
  territoryId: uuid.optional(),
  volunteerId: uuid.optional(),
  needsAttention: boolQuery,
  side: z.enum(["NORTH", "SOUTH", "EAST", "WEST", "BOTH"]).optional(),
  q: z.string().trim().min(1).optional(),
});

/**
 * Create a route. Prefer `bundles` (papers derived as sum). Legacy clients may
 * send `papers` alone — the service then seeds bundles via greedySplit.
 */
export const createRoute = z
  .object({
    startAddress: addressInput,
    endAddress: addressInput,
    streetName: z.string().trim().min(1),
    side: z.enum(["NORTH", "SOUTH", "EAST", "WEST", "BOTH"]).nullish(),
    assignedVolunteerId: uuid.nullish(), // optional shortcut: born Active-Assigned
    houseCount: z.number().int().min(0).default(0), // manual entry for MVP
    papers: z.number().int().min(0).optional(),
    bundles: z.array(routeBundle).optional(),
    note: noteField,
  })
  .refine((o) => o.papers !== undefined || o.bundles !== undefined, {
    message: "Provide papers and/or bundles.",
  })
  .refine(
    (o) =>
      o.papers === undefined ||
      o.bundles === undefined ||
      o.bundles.reduce((s, b) => s + b.papers, 0) === o.papers,
    { message: "bundles must sum to papers." },
  );

export const updateRoute = z
  .object({
    startAddress: addressInput,
    endAddress: addressInput,
    streetName: z.string().trim().min(1),
    side: z.enum(["NORTH", "SOUTH", "EAST", "WEST", "BOTH"]).nullable(),
    houseCount: z.number().int().min(0),
    houseCountOverride: z.number().int().min(0).nullable(),
    papers: z.number().int().min(0),
    bundles: z.array(routeBundle),
    note: noteField,
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." })
  .refine(
    (o) =>
      o.papers === undefined ||
      o.bundles === undefined ||
      o.bundles.reduce((s, b) => s + b.papers, 0) === o.papers,
    { message: "bundles must sum to papers." },
  );

export const assignRoute = z.object({ volunteerId: uuid });

export const nearestVacantQuery = z
  .object({
    volunteerId: uuid.optional(),
    placeId: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(25).default(5),
  })
  .refine((o) => o.volunteerId !== undefined || o.placeId !== undefined, {
    message: "Provide volunteerId or placeId.",
  });
