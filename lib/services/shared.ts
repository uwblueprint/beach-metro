// Shared plumbing for the service layer: the service-role DB handle and
// PostgREST error translation into typed ServiceErrors.
import { ServiceError, conflict, invalid } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export const db = () => createAdminClient();

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
    case "23514": // check_violation
    case "P0001": // raise exception (our invariant triggers)
      throw invalid(error.message);
    default:
      throw new ServiceError("internal", `Database error: ${error.message}`, 500);
  }
}

/** Today's date as DateOnly (server clock). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
