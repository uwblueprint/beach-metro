// Load the office's workbook into the database, and do it again later without
// redoing what has not changed.
//
//   pnpm import:convert <workbook.xlsx>     once, to produce the CSVs
//   pnpm import:legacy                      dry run, writes nothing
//   pnpm import:legacy --apply              the real thing
//
// Flags
//   --apply            write. Without it nothing is created or changed.
//   --only <names>     comma separated phases, such as --only captains
//   --limit <n>        stop each phase after n records, for a rehearsal
//   --check-addresses  resolve addresses during a dry run. Costs one lookup per
//                      person and is the only way to find an address that comes
//                      back as a street rather than a building.
//
// A dry run reads the same sheets, resolves the same addresses and makes the
// same decisions as the real run, so the only step it skips is the write. That
// includes the last phase, because a step a rehearsal skips is the one nobody
// rehearsed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { checkResolved, checkSource } from "./lib/address";
import { readCaptains } from "./lib/captains";
import { normalise, parseCsv } from "./lib/csv";
import { readLabels } from "./lib/labels";
import { hash, Ledger } from "./lib/ledger";

const ROOT = join(import.meta.dirname, "..");
const SHEETS = join(ROOT, ".data", "sheets");
const REPORTS = join(ROOT, ".data");

/** The payments year the captain roster is read from. */
const CAPTAIN_SHEET = "Payments2026";

/**
 * Cadence is not on the office's sheet at all, and the app requires one.
 * Biweekly matches their publication rhythm of roughly 22 issues a year. It is
 * informational in the app, so nothing calculates from it.
 */
const ASSUMED_CADENCE = "biweekly" as const;

const PHASES = ["captains", "people"] as const;
type Phase = (typeof PHASES)[number];

interface Options {
  apply: boolean;
  /** Resolve addresses during a dry run, which costs lookups but finds the bad ones. */
  checkAddresses: boolean;
  only: Phase[];
  limit: number | null;
}

interface Outcome {
  created: number;
  updated: number;
  unchanged: number;
  rejected: { row: number; name: string; reason: string }[];
  disappeared: string[];
  /** Address lookups actually made, which a plain dry run does not do. */
  lookups: number;
  /** Lookups a real run would make, whether or not this one did. */
  wouldLookUp: number;
  /** Sheet rows that were never anybody, so not counted as refusals. */
  skippedLines: number;
}

const emptyOutcome = (): Outcome => ({
  created: 0,
  updated: 0,
  unchanged: 0,
  rejected: [],
  disappeared: [],
  lookups: 0,
  wouldLookUp: 0,
  skippedLines: 0,
});

function parseArgs(argv: string[]): Options {
  const flag = (name: string) => argv.includes(`--${name}`);
  const value = (name: string) => {
    const at = argv.indexOf(`--${name}`);
    return at === -1 ? null : (argv[at + 1] ?? null);
  };

  const onlyRaw = value("only");
  const only = onlyRaw ? onlyRaw.split(",").map((s) => s.trim() as Phase) : [...PHASES];
  for (const phase of only) {
    if (!PHASES.includes(phase)) {
      console.error(`unknown phase "${phase}". Known phases are ${PHASES.join(", ")}`);
      process.exit(2);
    }
  }

  const limitRaw = value("limit");
  const limit = limitRaw === null ? null : Number(limitRaw);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    console.error("--limit takes a whole number of records");
    process.exit(2);
  }

  const apply = flag("apply");
  return { apply, checkAddresses: apply || flag("check-addresses"), only, limit };
}

function readSheet(name: string): string[][] {
  const path = join(SHEETS, `${name}.csv`);
  try {
    return parseCsv(readFileSync(path, "utf8"));
  } catch {
    console.error(`cannot read ${path}`);
    console.error("Run `pnpm import:convert <workbook.xlsx>` first.");
    process.exit(1);
  }
}

/** Territory id per captain source key, built as captains are created. */
type TerritoryMap = Map<string, string>;

async function importCaptains(
  rows: string[][],
  options: Options,
  territories: TerritoryMap,
): Promise<Outcome> {
  const out = emptyOutcome();
  const { captains, rejected } = readCaptains(rows);
  for (const r of rejected)
    out.rejected.push({ row: r.firstRow, name: r.displayName, reason: r.reason });

  const chosen = options.limit === null ? captains : captains.slice(0, options.limit);
  const ledger = options.apply ? await Ledger.load(CAPTAIN_SHEET) : null;
  const services = options.apply ? await import("@/lib/services/captains") : null;

  for (const captain of chosen) {
    const rowHash = hash([
      captain.displayName,
      captain.payType,
      captain.payRate,
      captain.rtCodes.join(","),
      captain.notes.join(" "),
    ]);
    const verdict = ledger?.decide(captain.sourceKey, rowHash, null) ?? { kind: "create" as const };

    if (verdict.kind === "unchanged") {
      // The territory is still needed even though nothing about the captain
      // changed, because the people phase reads this map to place a volunteer.
      // Skipping it would send a later run's volunteer patch through with no
      // captain and clear the link an earlier run made.
      const existing = await services!.getCaptain(verdict.entityId);
      if (existing.territory) territories.set(captain.sourceKey, existing.territory.id);
      out.unchanged += 1;
      await ledger!.touch(captain.sourceKey);
      continue;
    }

    if (!options.apply) {
      out.created += 1;
      continue;
    }

    if (verdict.kind === "create") {
      const created = await services!.createCaptainRecord({
        displayName: captain.displayName,
        payType: captain.payType,
        payRate: captain.payRate,
        payCadence: ASSUMED_CADENCE,
        email: null,
        phone: null,
        // The RT number stays unset until the office settles whether a code
        // belongs to a person or an area. Labels print RTXX meanwhile.
        rtNumber: null,
        startDate: null,
        endDate: null,
        note: captain.notes.length > 0 ? captain.notes.join(" ") : null,
      });
      if (created.territory) territories.set(captain.sourceKey, created.territory.id);
      await ledger!.record(captain.sourceKey, "captain", created.id, rowHash, null);
      out.created += 1;
    } else {
      const updated = await services!.updateCaptainRecord(verdict.entityId, {
        displayName: captain.displayName,
        payType: captain.payType,
        payRate: captain.payRate,
      });
      if (updated.territory) territories.set(captain.sourceKey, updated.territory.id);
      await ledger!.record(captain.sourceKey, "captain", verdict.entityId, rowHash, null);
      out.updated += 1;
    }
  }

  // Only a run that read every row can tell a row that is gone from one this
  // run never looked at.
  if (options.limit === null)
    out.disappeared = (ledger?.disappeared() ?? []).map((r) => r.sourceKey);
  return out;
}

async function importPeople(
  rows: string[][],
  options: Options,
  byRt: Map<string, string>,
  territories: TerritoryMap,
): Promise<Outcome> {
  const out = emptyOutcome();
  const { recipients, rejected, tallyLines } = readLabels(rows);
  out.skippedLines = tallyLines;
  for (const r of rejected)
    out.rejected.push({ row: r.firstRow, name: r.displayName, reason: r.reason });

  const chosen = options.limit === null ? recipients : recipients.slice(0, options.limit);
  const ledger = options.apply ? await Ledger.load("LABELS") : null;
  const volunteers = options.apply ? await import("@/lib/services/volunteers") : null;
  const addresses = options.checkAddresses ? await import("@/lib/services/addresses") : null;

  for (const person of chosen) {
    const source = person.address ?? "";
    const cheap = checkSource(source);
    if (!cheap.ok) {
      out.rejected.push({ row: person.firstRow, name: person.displayName, reason: cheap.reason });
      continue;
    }

    const addressHash = hash([source]);
    const rowHash = hash([
      person.displayName,
      source,
      person.phone,
      person.email,
      person.startDate,
      person.rt,
      person.papers,
      person.notes.join(" "),
    ]);
    const verdict = ledger?.decide(person.sourceKey, rowHash, addressHash) ?? {
      kind: "create" as const,
    };

    if (verdict.kind === "unchanged") {
      out.unchanged += 1;
      await ledger!.touch(person.sourceKey);
      continue;
    }

    // Resolving is what reveals an address that answers with a street instead of
    // a building, so it happens in a dry run too. It is the billed step.
    out.wouldLookUp += 1;
    const resolved = options.checkAddresses
      ? await addresses!.resolveAddress(addressInput(source))
      : null;
    if (resolved) out.lookups += 1;
    if (resolved) {
      const checked = checkResolved(source, {
        streetNumber: resolved.components.streetNumber,
        doubts: resolved.doubts,
      });
      if (!checked.ok) {
        out.rejected.push({
          row: person.firstRow,
          name: person.displayName,
          reason: checked.reason,
        });
        continue;
      }
    }

    if (!options.apply) {
      out.created += 1;
      continue;
    }
    // A record needs the place id the lookup returned, which is why --apply
    // turns address checking on. Stated here so a future change to that cannot
    // quietly write volunteers with no address.
    if (!resolved) throw new Error("a run that writes needs resolved addresses");

    const territoryId = person.rt
      ? (territories.get(byRt.get(normalise(person.rt)) ?? "") ?? null)
      : null;

    if (verdict.kind === "create") {
      const created = await volunteers!.createVolunteerRecord({
        displayName: person.displayName,
        // The place id is reused so the lookup above is not paid for twice.
        address: { placeId: resolved.placeId },
        email: person.email,
        phone: person.phone,
        startDate: person.startDate,
        endDate: null,
        captainTerritoryId: territoryId,
        // Notes are written once and never rewritten, so a second run cannot
        // duplicate them. A changed note is reported instead.
        note: person.notes.length > 0 ? person.notes.join(" ") : null,
      });
      // The record exists before the ledger knows about it, and only for these
      // few lines. If the ledger write fails the run stops, so say which record
      // it was, since a re-run would otherwise create a second copy of them.
      try {
        await ledger!.record(person.sourceKey, "volunteer", created.id, rowHash, addressHash);
      } catch (err) {
        console.error(`${person.displayName} was created as ${created.id} but not recorded.`);
        console.error("Delete that volunteer before re-running, or they will come in twice.");
        throw err;
      }
      out.created += 1;
    } else {
      await volunteers!.updateVolunteerRecord(verdict.entityId, {
        displayName: person.displayName,
        email: person.email,
        phone: person.phone,
        startDate: person.startDate,
        // Sent only when a territory was worked out. Sending null instead would
        // clear a placement somebody made in the app by hand.
        ...(territoryId ? { captainTerritoryId: territoryId } : {}),
        ...(verdict.addressChanged ? { address: { placeId: resolved.placeId } } : {}),
      });
      await ledger!.record(person.sourceKey, "volunteer", verdict.entityId, rowHash, addressHash);
      out.updated += 1;
    }
  }

  // Only a run that read every row can tell a row that is gone from one this
  // run never looked at.
  if (options.limit === null)
    out.disappeared = (ledger?.disappeared() ?? []).map((r) => r.sourceKey);
  return out;
}

/** The office writes a plain line; the rest is what the geocoder needs. */
function addressInput(line: string) {
  return {
    addressLines: [line],
    locality: "Toronto",
    administrativeArea: "ON",
    regionCode: "CA" as const,
  };
}

/** The one line a person running this actually reads. */
function tally(out: Outcome, options: Options): string {
  const verb = options.apply ? "created" : "to create";
  const parts = [`${out.created} ${verb}`];
  if (out.updated) parts.push(`${out.updated} ${options.apply ? "updated" : "to update"}`);
  if (out.unchanged) parts.push(`${out.unchanged} already current`);
  parts.push(`${out.rejected.length} rejected`);
  return parts.join(", ");
}

function section(title: string, out: Outcome): string[] {
  const lines = [`## ${title}`, ""];
  lines.push(`- ${out.created} to create`);
  if (out.updated) lines.push(`- ${out.updated} to update`);
  if (out.unchanged) lines.push(`- ${out.unchanged} unchanged, skipped without a lookup`);
  lines.push(`- ${out.rejected.length} cannot become a record`);
  if (out.skippedLines)
    lines.push(`- ${out.skippedLines} rows are the office's own bundle tallies, not people`);
  lines.push(`- ${out.wouldLookUp} address lookups a real run makes`);
  if (out.lookups > 0)
    lines.push(`- ${out.lookups} of them made now, so the results below are real`);
  else if (out.wouldLookUp > 0) {
    lines.push(
      "- none made, so an address that resolves to the wrong street is not caught here. " +
        "Re-run with `--check-addresses` to find those before committing to a run.",
    );
  }
  if (out.disappeared.length > 0) {
    lines.push(
      `- ${out.disappeared.length} previously imported rows are no longer in the workbook, left untouched`,
    );
  }
  lines.push("");
  if (out.rejected.length > 0) {
    lines.push("### Not imported", "", "| Sheet row | Name | Why |", "| --- | --- | --- |");
    for (const r of out.rejected) lines.push(`| ${r.row} | ${r.name} | ${r.reason} |`);
    lines.push("");
  }
  return lines;
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));

  // Without a key, lib/maps quietly answers with its deterministic fake, which
  // returns plausible Toronto coordinates for any string. A run that resolved
  // addresses that way would fill the database with invented locations and
  // report success, so it stops here instead.
  if (options.checkAddresses && !process.env.GOOGLE_MAPS_SERVER_KEY) {
    console.error("GOOGLE_MAPS_SERVER_KEY is not set, so addresses would resolve to fakes.");
    console.error("Set it in .env.local, or drop --check-addresses to skip resolving.");
    return 1;
  }
  if (options.apply && !process.env.SUPABASE_SECRET_KEY) {
    console.error("SUPABASE_SECRET_KEY is not set, so there is nothing to write to.");
    return 1;
  }
  // A person is placed in their captain's territory, and the captains phase is
  // what works out which territory that is. Writing people without it would
  // create every volunteer with no captain, which is a day of work to redo.
  if (options.apply && options.only.includes("people") && !options.only.includes("captains")) {
    console.error("Writing people needs the captains phase, which finds their territories.");
    console.error("Drop --only, or name both phases.");
    return 1;
  }

  // One known address before the run starts. A key can be present, correctly
  // spelled and still refused, for an unbilled project or a disabled API, and
  // finding that out at person 200 leaves the import half done.
  if (options.checkAddresses) {
    const { resolveAddress } = await import("@/lib/services/addresses");
    try {
      await resolveAddress(addressInput("1230 Kingston Rd"));
    } catch (err) {
      console.error("The address lookup is not usable, so no addresses can be imported.");
      console.error(err instanceof Error ? err.message : String(err));
      console.error("Check that billing is enabled on the Google Cloud project and that");
      console.error("the Address Validation API is turned on for this key.");
      return 1;
    }
  }

  console.log(options.apply ? "Applying changes." : "Dry run. Nothing will be written.");
  console.log(`Phases ${options.only.join(", ")}`);
  if (options.limit !== null) console.log(`Limited to ${options.limit} records per phase.`);
  console.log("");

  const territories: TerritoryMap = new Map();
  const { byRt } = readCaptains(readSheet(CAPTAIN_SHEET));
  const lines = [`# Legacy import ${options.apply ? "run" : "dry run"}`, ""];

  if (options.only.includes("captains")) {
    const out = await importCaptains(readSheet(CAPTAIN_SHEET), options, territories);
    console.log(`Captains  ${tally(out, options)}`);
    lines.push(...section("Captains", out));
  }

  if (options.only.includes("people")) {
    const out = await importPeople(readSheet("LABELS"), options, byRt, territories);
    console.log(`People    ${tally(out, options)}`);
    lines.push(...section("People", out));
  }

  mkdirSync(REPORTS, { recursive: true });
  const path = join(REPORTS, `import-report-${new Date().toISOString().slice(0, 19)}.md`);
  writeFileSync(path, lines.join("\n"), { mode: 0o600 });
  console.log("");
  console.log(`Report written to ${path}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
