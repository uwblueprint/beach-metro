// Loads supabase/seed.sql into the database pointed at by SUPABASE_DB_URL.
// Run via `pnpm db:seed` (which supplies .env.local through --env-file).
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL is not set (see .env.example).");
  process.exit(1);
}

const seedPath = path.join(import.meta.dirname, "..", "supabase", "seed.sql");
const seedSql = readFileSync(seedPath, "utf8");

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  // simple-query protocol: runs the whole multi-statement file.
  await sql.unsafe(seedSql);
  console.log("seed applied:", seedPath);
} finally {
  await sql.end();
}
