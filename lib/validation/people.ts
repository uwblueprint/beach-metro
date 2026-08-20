// Request schemas for the people domain (volunteers, captains, territories).
import { z } from "zod";

import { addressInput, boolQuery, isoDate, noteField, uuid } from "./common";

// ---------------------------------------------------------------------------
// Volunteers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Members (the unified volunteer + captain list)
// ---------------------------------------------------------------------------

export const membersQuery = z.object({
  role: z.enum(["volunteer", "captain"]).optional(),
  // "on-vacation" only ever matches volunteers; captains have no vacation state.
  status: z.enum(["active", "on-vacation", "retired"]).optional(),
  needsAttention: boolQuery,
  q: z.string().trim().min(1).optional(),
});

export const volunteersQuery = z.object({
  status: z.enum(["active", "on-vacation", "retired"]).optional(),
  territoryId: uuid.optional(),
  hasRoute: boolQuery,
  needsAttention: boolQuery,
  q: z.string().trim().min(1).optional(),
});

export const createVolunteer = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.email(),
  phone: z.string().trim().min(1),
  address: addressInput,
  captainTerritoryId: uuid.nullish(),
  startDate: isoDate,
  endDate: isoDate.nullish(),
  note: noteField,
});

export const updateVolunteer = z
  .object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.email(),
    phone: z.string().trim().min(1),
    address: addressInput, // re-validates + swaps the home address
    captainTerritoryId: uuid.nullable(),
    startDate: isoDate,
    endDate: isoDate.nullable(),
    // No `note` here: notes are their own resource now (see lib/validation/notes.ts).
    // A single field on PATCH could not say WHICH note it meant.
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." });

/** Set or clear the vacation window. */
export const setVacation = z.union([
  z
    .object({ vacationStart: isoDate, vacationEnd: isoDate })
    .refine((o) => o.vacationStart <= o.vacationEnd, {
      message: "vacationStart must be on or before vacationEnd.",
    }),
  z.object({ clear: z.literal(true) }),
]);

// ---------------------------------------------------------------------------
// Captains
// ---------------------------------------------------------------------------

export const captainsQuery = z.object({
  status: z.enum(["active", "retired"]).optional(),
  q: z.string().trim().min(1).optional(),
});

export const createCaptain = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.email(),
  phone: z.string().trim().min(1),
  payType: z.enum(["bundle", "paper", "drop"]),
  payRate: z.number().min(0), // 0 is valid (donate-back)
  payCadence: z.enum(["biweekly", "monthly"]),
  startDate: isoDate,
  endDate: isoDate.nullish(),
  note: noteField,
});

export const updateCaptain = z
  .object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.email(),
    phone: z.string().trim().min(1),
    payType: z.enum(["bundle", "paper", "drop"]),
    payRate: z.number().min(0),
    payCadence: z.enum(["biweekly", "monthly"]),
    startDate: isoDate,
    endDate: isoDate.nullable(),
    // No `note` here either — see updateVolunteer above.
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." });

// ---------------------------------------------------------------------------
// Territories
// ---------------------------------------------------------------------------

export const territoriesQuery = z.object({
  hasCaptain: boolQuery,
  q: z.string().trim().min(1).optional(),
});

export const updateTerritory = z
  .object({
    color: z.string().trim().min(1).nullable(),
    assignedCaptainId: uuid.nullable(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." });

export const assignTerritoryVolunteer = z.object({ volunteerId: uuid });

export const addCommercialDrop = z.object({
  address: addressInput,
  /** Expected bundles per issue. Optional: unknown is a legitimate state. */
  standingBundles: z.number().int().min(0).nullish(),
});

/** Edit a drop's standing count without re-validating its address. */
export const updateCommercialDrop = z.object({
  standingBundles: z.number().int().min(0).nullable(),
});
