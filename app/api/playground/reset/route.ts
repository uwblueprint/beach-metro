// TEMPORARY — sandbox reset for the API playground. Wipes every table and
// replays supabase/seed.sql so designers can experiment fearlessly. Deleted
// together with app/(dashboard)/playground when the real screens exist.
import { readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";

import { ServiceError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";

// Order doesn't matter with CASCADE, but keep it explicit + reviewable.
const TABLES = [
  "route_deliveries",
  "captain_payouts",
  "issues",
  "financial_years",
  "volunteer_routes",
  "volunteers",
  "addresses",
  "captain_territories",
  "captains",
  "google_maps_locations",
];

export const POST = route(async () => {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    throw new ServiceError(
      "internal",
      "SUPABASE_DB_URL is not configured — the reset needs a direct database connection.",
      500,
    );
  }

  const seedSql = readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8");
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    await sql.unsafe(`truncate table ${TABLES.map((t) => `public.${t}`).join(", ")} cascade`);
    await sql.unsafe(seedSql);
  } finally {
    await sql.end();
  }

  return ok({ reset: true, tables: TABLES.length });
});
