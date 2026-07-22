// The route() wrapper: auth gate + error translation into the response envelope.
// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/supabase/auth", () => ({ getClaims: vi.fn() }));

import { conflict } from "@/lib/api/errors";
import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { getClaims } from "@/lib/supabase/auth";

const mockedClaims = vi.mocked(getClaims);
const req = (body?: unknown) =>
  new NextRequest("http://localhost/api/test", {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const ctx = { params: Promise.resolve({ id: "abc" }) };

beforeEach(() => {
  mockedClaims.mockReset();
  mockedClaims.mockResolvedValue({ sub: "admin", email: "a@b.c" } as never);
});

describe("route()", () => {
  it("rejects unauthenticated requests with the 401 envelope", async () => {
    mockedClaims.mockResolvedValue(null as never);
    const handler = route(async () => ok("never"));
    const res = await handler(req(), ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "unauthenticated", message: "Sign in required." },
    });
  });

  it("passes params through and wraps success as { data }", async () => {
    const handler = route(async (_r, params) => ok({ got: params.id }));
    const res = await handler(req(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { got: "abc" } });
  });

  it("maps zod failures to 422 with issues in details", async () => {
    const schema = z.object({ amount: z.number() });
    const handler = route(async (r) => ok(await parseBody(r, schema)));
    const res = await handler(req({ amount: "not-a-number" }), ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("validation_failed");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("maps ServiceError to its status and code", async () => {
    const handler = route(async () => {
      throw conflict("Issue is already closed.");
    });
    const res = await handler(req(), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toEqual({
      code: "conflict",
      message: "Issue is already closed.",
    });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = route(async () => {
      throw new Error("secret internals");
    });
    const res = await handler(req(), ctx);
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toBe("Unexpected server error.");
    consoleError.mockRestore();
  });

  it("treats a missing/invalid JSON body as an empty object for parsing", async () => {
    const schema = z.object({ name: z.string().optional() });
    const handler = route(async (r) => ok(await parseBody(r, schema)));
    const res = await handler(req(), ctx);
    expect(res.status).toBe(200);
  });
});
