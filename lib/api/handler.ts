// The one wrapper every route handler goes through:
// auth check (401) → handler → error translation (422 zod, mapped ServiceError, 500 fallback).
import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

import { getClaims } from "@/lib/supabase/auth";

import { ServiceError } from "./errors";
import { fail } from "./respond";

type Params = Record<string, string>;
type Handler = (req: NextRequest, params: Params) => Promise<NextResponse>;

export function route(handler: Handler) {
  return async (req: NextRequest, ctx: { params: Promise<Params> }): Promise<NextResponse> => {
    try {
      const claims = await getClaims();
      if (!claims) return fail("unauthenticated", "Sign in required.", 401);
      const params = ctx?.params ? await ctx.params : {};
      return await handler(req, params);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail("validation_failed", "Invalid request.", 422, err.issues);
      }
      if (err instanceof ServiceError) {
        return fail(err.code, err.message, err.status, err.details);
      }
      console.error("[api] unhandled error:", err);
      return fail("internal", "Unexpected server error.", 500);
    }
  };
}

/** Parse the JSON body against a schema (422 on mismatch, via the route wrapper). */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  return schema.parse(raw);
}

/** Parse ?query params against a schema. */
export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}
