// Browser-side fetchers for our own API.
//
// Every handler answers with the same envelope: `{ data }` on success and
// `{ error: { code, message, details? } }` on failure (see lib/api/respond.ts).
// These helpers unwrap that in one place so no component has to know the shape,
// and so a 409 from the service layer reaches the UI as a real message rather
// than a generic "something went wrong".
import type { ErrorCode } from "./errors";

/** A failed API call, carrying the server's own message so the UI can show it. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | "network",
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init?.body
        ? { "content-type": "application/json", ...init?.headers }
        : init?.headers,
    });
  } catch (err) {
    // Offline, DNS, aborted connection: never surfaces as an HTTP status.
    throw new ApiError(
      "network",
      err instanceof Error ? err.message : "Network request failed.",
      0,
    );
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const error = (body as { error?: { code?: ErrorCode; message?: string; details?: unknown } })
      ?.error;
    throw new ApiError(
      error?.code ?? "internal",
      error?.message ?? `Request failed (${res.status}).`,
      res.status,
      error?.details,
    );
  }

  return (body as { data: T }).data;
}

/** Drops undefined/null params so `?q=` never goes out empty. */
function withQuery(path: string, params?: Record<string, string | boolean | undefined>): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | boolean | undefined>) =>
    request<T>(withQuery(path, params)),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};
