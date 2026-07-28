// Shared plumbing for the service layer: the service-role DB handle and
// PostgREST error translation into typed ServiceErrors.
import { ServiceError, conflict, invalid } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export const db = () => createAdminClient();

// PostgREST serializes `numeric` columns as JSON strings though types/db.ts types
// them `number`. Coerce at the single point rows enter the service layer so nothing
// downstream re-coerces. Generic over row shape, so partial selects work too.
export function coerceCaptainNumerics<T extends { pay_rate: number }>(row: T): T {
  return { ...row, pay_rate: Number(row.pay_rate) };
}

export function coercePayoutNumerics<
  T extends {
    calculated_amount: number;
    override_amount: number | null;
    frozen_amount: number | null;
  },
>(row: T): T {
  return {
    ...row,
    calculated_amount: Number(row.calculated_amount),
    override_amount: row.override_amount === null ? null : Number(row.override_amount),
    frozen_amount: row.frozen_amount === null ? null : Number(row.frozen_amount),
  };
}

interface PgError {
  code?: string;
  message: string;
}

/** Translate a PostgREST/Postgres error into the API's error vocabulary. */
export function throwDb(error: PgError): never {
  switch (error.code) {
    case "23505": // unique_violation
      throw conflict("A record with these unique values already exists.");
    case "23503": // foreign_key_violation
      throw invalid("A referenced record does not exist.");
    case "23502": // not_null_violation — a required field was absent
      throw invalid("A required field is missing.");
    case "23514": // check_violation
    case "P0001": // raise exception (our invariant triggers)
      throw invalid(error.message);
    case "22P02": // invalid_text_representation (e.g. a malformed uuid in the path)
      throw invalid("Malformed identifier.");
    default:
      // Don't leak raw Postgres/PostgREST detail to the client; log it server-side.
      console.error("[db] unexpected error:", error);
      throw new ServiceError("internal", "Unexpected database error.", 500);
  }
}

/**
 * Today's date as DateOnly in America/Toronto (Beach Metro's locale), independent
 * of the server's timezone. `en-CA` formats as YYYY-MM-DD and handles DST, so
 * date-boundary logic (vacation windows, paid_at/retired_at stamps) matches the
 * calendar day staff actually experience rather than UTC.
 */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
