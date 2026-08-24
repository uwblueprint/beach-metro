// Request schemas for the people domain (volunteers, captains, territories).
import { z } from "zod";

import { addressInput, boolQuery, isoDate, noteField, uuid } from "./common";

/**
 * Contact details are optional for everyone — volunteers and captains, on create
 * and on update. Only 19% of the office's real roster has a phone on file and
 * 42% an email (docs/reference/route_labels_spreadsheet.md §2.2), so requiring
 * either would block most of their people from being entered at all.
 *
 * A cleared form field arrives as `""`, which `z.email()` would reject, so both
 * accept the empty string and normalise every absent form — `undefined`, `null`,
 * `""`, whitespace — to `null`. That keeps one representation of "not on file"
 * in the database instead of three.
 */
const optionalEmail = z
  .union([z.email(), z.literal("")])
  .nullish()
  .transform((v) => v || null);

const optionalPhone = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null);

/**
 * A third of the office's roster is not one person — churches, apartment
 * buildings, households, two people sharing a route. `displayName` is the
 * authoritative name for all of them; `firstName` / `lastName` are optional and
 * carried only for individuals, where surname sort and structured search still
 * earn their keep. See docs/reference/route_labels_spreadsheet.md §2.1.
 */
const nameFields = {
  displayName: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).nullish(),
  lastName: z.string().trim().min(1).nullish(),
};

/**
 * Fill `displayName` from first + last when the caller gave a person's name but
 * no display form, so the common case stays a two-field write. Callers naming a
 * church send `displayName` alone.
 */
function composeDisplayName<
  T extends { displayName?: string; firstName?: string | null; lastName?: string | null },
>(o: T, ctx: z.RefinementCtx) {
  const displayName = o.displayName || [o.firstName, o.lastName].filter(Boolean).join(" ");
  if (!displayName) {
    ctx.addIssue({
      code: "custom",
      message: "Provide displayName, or firstName and lastName.",
      path: ["displayName"],
    });
    return z.NEVER;
  }
  return { ...o, displayName };
}

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

export const createVolunteer = z
  .object({
    ...nameFields,
    email: optionalEmail,
    phone: optionalPhone,
    address: addressInput,
    captainTerritoryId: uuid.nullish(),
    startDate: isoDate,
    endDate: isoDate.nullish(),
    note: noteField,
  })
  .transform(composeDisplayName);

export const updateVolunteer = z
  .object({
    displayName: z.string().trim().min(1),
    firstName: z.string().trim().min(1).nullable(),
    lastName: z.string().trim().min(1).nullable(),
    email: optionalEmail,
    phone: optionalPhone,
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

export const createCaptain = z
  .object({
    ...nameFields,
    email: optionalEmail,
    phone: optionalPhone,
    payType: z.enum(["bundle", "paper", "drop"]),
    payRate: z.number().min(0), // 0 is valid (donate-back)
    payCadence: z.enum(["biweekly", "monthly"]),
    startDate: isoDate,
    endDate: isoDate.nullish(),
    note: noteField,
  })
  .transform(composeDisplayName);

export const updateCaptain = z
  .object({
    displayName: z.string().trim().min(1),
    firstName: z.string().trim().min(1).nullable(),
    lastName: z.string().trim().min(1).nullable(),
    email: optionalEmail,
    phone: optionalPhone,
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
