// Request schemas for the routes domain.
import { z } from "zod";

import { addressInput, boolQuery, noteField, uuid } from "./common";

export const routesQuery = z.object({
  vacancy: z.enum(["vacant", "assigned"]).optional(),
  territoryId: uuid.optional(),
  needsAttention: boolQuery,
  side: z.enum(["NORTH", "SOUTH", "EAST", "WEST", "BOTH"]).optional(),
  q: z.string().trim().min(1).optional(),
});

export const createRoute = z.object({
  startAddress: addressInput,
  endAddress: addressInput,
  streetName: z.string().trim().min(1),
  side: z.enum(["NORTH", "SOUTH", "EAST", "WEST", "BOTH"]).nullish(),
  assignedVolunteerId: uuid.nullish(), // optional shortcut: born Active-Assigned
  houseCount: z.number().int().min(0), // manual entry for MVP
  papers: z.number().int().min(0),
  note: noteField,
});

export const updateRoute = z
  .object({
    startAddress: addressInput,
    endAddress: addressInput,
    streetName: z.string().trim().min(1),
    side: z.enum(["NORTH", "SOUTH", "EAST", "WEST", "BOTH"]).nullable(),
    houseCount: z.number().int().min(0),
    houseCountOverride: z.number().int().min(0).nullable(),
    papers: z.number().int().min(0),
    note: noteField,
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." });

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
