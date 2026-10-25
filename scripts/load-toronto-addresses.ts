// Loads City of Toronto address points into `toronto_address_points`, the
// reference set behind the suggested house count. Run via `pnpm load-addresses`
// (which supplies .env.local through --env-file).
//
// Contains information licensed under the Open Government Licence – Toronto.
// Source: City of Toronto, "Address Points (Municipal) – Toronto One Address
// Repository", dataset abedd8bc-e3dd-4d45-8e69-79165a76e4fa.
//
// Idempotent: the staging table is dropped and recreated, and the destination is
// truncated before every load, so re-running fully replaces the data.
//
// Flags:
//   --file <path>   use a local CSV instead of downloading
//   --bbox a,b,c,d  minLat,minLng,maxLat,maxLng (default: Beach Metro's area)
//   --all           load the whole city instead of a bounding box
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import postgres from "postgres";

const SOURCE_URL =
  "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/abedd8bc-e3dd-4d45-8e69-79165a76e4fa/resource/64d4e54b-738f-4cd9-a9e7-8050fac8a52f/download/address-points-4326.csv";

// Beach Metro's coverage plus headroom (the Beaches through Birch Cliff).
const DEFAULT_BBOX = { minLat: 43.63, minLng: -79.36, maxLat: 43.73, maxLng: -79.24 };

// Source column positions (1-based), used to project staging -> destination.
// The staging table is all-text in file order so Postgres does the CSV parsing;
// several columns (e.g. LINEAR_NAME_DESC) contain quoted commas.
const COL = {
  ADDRESS_POINT_ID: 2,
  CENTRELINE_ID: 6,
  MAINT_STAGE: 7,
  ADDRESS_NUMBER: 8,
  LINEAR_NAME_FULL: 9,
  LO_NUM: 10,
  CENTRELINE_SIDE: 18,
  ADDRESS_CLASS: 25,
  ADDRESS_FULL: 37,
  GEOMETRY: 38,
} as const;
const STAGE_COLUMNS = 38;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function parseBbox(raw: string | undefined) {
  if (!raw) return DEFAULT_BBOX;
  const parts = raw.split(",").map((n) => Number(n.trim()));
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    console.error("--bbox expects minLat,minLng,maxLat,maxLng");
    process.exit(1);
  }
  const [minLat, minLng, maxLat, maxLng] = parts;
  return { minLat, minLng, maxLat, maxLng };
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL is not set (see .env.example).");
  process.exit(1);
}

const loadAll = process.argv.includes("--all");
const bbox = parseBbox(arg("--bbox"));
const dataDir = path.join(import.meta.dirname, "..", ".data");
const csvPath = arg("--file") ?? path.join(dataDir, "address-points-4326.csv");

if (!existsSync(csvPath)) {
  mkdirSync(dataDir, { recursive: true });
  console.log("downloading address points (~175 MB)…");
  const res = await fetch(SOURCE_URL);
  if (!res.ok || !res.body) {
    console.error(`download failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const { createWriteStream } = await import("node:fs");
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(csvPath));
  console.log("saved:", csvPath);
} else {
  console.log("using cached CSV:", csvPath);
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  const stageCols = Array.from({ length: STAGE_COLUMNS }, (_, i) => `c${i + 1} text`).join(", ");
  await sql.unsafe(`drop table if exists _toronto_ap_stage`);
  // unlogged: skips WAL for a table we drop moments later.
  await sql.unsafe(`create unlogged table _toronto_ap_stage (${stageCols})`);

  console.log("copying into staging…");
  const writable =
    await sql`copy _toronto_ap_stage from stdin with (format csv, header true)`.writable();
  await pipeline(createReadStream(csvPath), writable);

  const [{ count: staged }] = await sql<{ count: string }[]>`
    select count(*)::text as count from _toronto_ap_stage`;
  console.log(`staged rows: ${Number(staged).toLocaleString()}`);

  // Diagnostics before the staging table goes away — these are the load's
  // verification hooks (MAINT_STAGE 'RESERVED' rows are allocated but unbuilt).
  const maint = await sql.unsafe<{ v: string; n: string }[]>(
    `select c${COL.MAINT_STAGE} as v, count(*)::text as n from _toronto_ap_stage group by 1 order by 2 desc`,
  );
  console.log("MAINT_STAGE:", maint.map((r) => `${r.v}=${Number(r.n).toLocaleString()}`).join(" "));
  const cls = await sql.unsafe<{ v: string; n: string }[]>(
    `select c${COL.ADDRESS_CLASS} as v, count(*)::text as n from _toronto_ap_stage group by 1 order by 2 desc limit 6`,
  );
  console.log("ADDRESS_CLASS:", cls.map((r) => `${r.v}=${Number(r.n).toLocaleString()}`).join(" "));

  const lat = `(c${COL.GEOMETRY}::jsonb -> 'coordinates' -> 0 ->> 1)::double precision`;
  const lng = `(c${COL.GEOMETRY}::jsonb -> 'coordinates' -> 0 ->> 0)::double precision`;
  const bboxFilter = loadAll
    ? ""
    : `and ${lat} between ${bbox.minLat} and ${bbox.maxLat}
       and ${lng} between ${bbox.minLng} and ${bbox.maxLng}`;

  await sql.unsafe(`truncate toronto_address_points`);
  await sql.unsafe(`
    insert into toronto_address_points (
      address_point_id, centreline_id, centreline_side, address_number,
      street_number, linear_name_full, address_full, latitude, longitude
    )
    select distinct on (c${COL.ADDRESS_POINT_ID}::bigint)
      c${COL.ADDRESS_POINT_ID}::bigint,
      nullif(c${COL.CENTRELINE_ID}, '')::bigint,
      nullif(c${COL.CENTRELINE_SIDE}, ''),
      c${COL.ADDRESS_NUMBER},
      c${COL.LO_NUM}::integer,
      c${COL.LINEAR_NAME_FULL},
      c${COL.ADDRESS_FULL},
      ${lat},
      ${lng}
    from _toronto_ap_stage
    where c${COL.MAINT_STAGE} = 'REGULAR'
      and c${COL.LO_NUM} ~ '^[0-9]+$'
      and c${COL.LINEAR_NAME_FULL} <> ''
      and c${COL.ADDRESS_FULL} <> ''
      and c${COL.GEOMETRY} like '{%'
      ${bboxFilter}
  `);

  await sql.unsafe(`drop table _toronto_ap_stage`);

  const [{ count: loaded }] = await sql<{ count: string }[]>`
    select count(*)::text as count from toronto_address_points`;
  const [{ count: wineva }] = await sql<{ count: string }[]>`
    select count(*)::text as count from toronto_address_points
    where linear_name_norm = 'wineva ave'`;
  console.log(
    `loaded: ${Number(loaded).toLocaleString()} rows` +
      (loadAll
        ? " (whole city)"
        : ` (bbox ${bbox.minLat},${bbox.minLng} → ${bbox.maxLat},${bbox.maxLng})`),
  );
  console.log(`spot check — Wineva Ave: ${wineva} points`);
} finally {
  await sql.end();
}
