// Typed errors thrown by lib/services and translated to HTTP by lib/api/handler.

export type ErrorCode =
  | "unauthenticated"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "internal";

export class ServiceError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const notFound = (what: string) => new ServiceError("not_found", `${what} not found.`, 404);

export const conflict = (message: string) => new ServiceError("conflict", message, 409);

export const invalid = (message: string, details?: unknown) =>
  new ServiceError("validation_failed", message, 422, details);
