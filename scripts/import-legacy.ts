// Load the office's workbook into the database, and do it again later without
// redoing what has not changed.
//
//   pnpm import:convert <workbook.xlsx>     once, to produce the CSVs
//   pnpm import:legacy                      dry run, writes nothing
//   pnpm import:legacy --apply              the real thing
//
// Flags
//   --apply         write. Without it nothing is created or changed.
//   --only <names>  comma separated phases, such as --only people
//   --limit <n>     stop each phase after n records, for a rehearsal
//
// A dry run reads the same sheets, makes the same decisions and writes the same
// report as the real run, so the only step it skips is the write itself.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { parseCsv } from "./lib/csv";
import { readLabels, type Recipient, type Rejection } from "./lib/labels";

const ROOT = join(import.meta.dirname, "..");
const SHEETS = join(ROOT, ".data", "sheets");
const REPORTS = join(ROOT, ".data");

const PHASES = ["people"] as const;
type Phase = (typeof PHASES)[number];

interface Options {
  apply: boolean;
  only: Phase[];
  limit: number | null;
}

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
      console.error(`unknown phase "${phase}". Known phases: ${PHASES.join(", ")}`);
      process.exit(2);
    }
  }

  const limitRaw = value("limit");
  const limit = limitRaw === null ? null : Number(limitRaw);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    console.error("--limit takes a whole number of records");
    process.exit(2);
  }

  return { apply: flag("apply"), only, limit };
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

function report(recipients: Recipient[], rejected: Rejection[], options: Options): string {
  const lines: string[] = [];
  const multi = recipients.filter((r) => r.rowCount > 1);
  const papers = recipients.reduce((sum, r) => sum + r.papers, 0);
  const bundles = recipients.reduce((sum, r) => sum + r.bundles.length, 0);

  lines.push(`# Legacy import ${options.apply ? "run" : "dry run"}`);
  lines.push("");
  lines.push("## People");
  lines.push("");
  lines.push(`- ${recipients.length} recipients ready`);
  lines.push(`- ${multi.length} of them come from more than one row on the sheet`);
  lines.push(`- ${papers} papers across ${bundles} bundles once the split is rebuilt`);
  lines.push(`- ${rejected.length} rows cannot become a record`);
  lines.push("");

  if (rejected.length > 0) {
    lines.push("### Not imported");
    lines.push("");
    lines.push("| Sheet row | Name | Why |");
    lines.push("| --- | --- | --- |");
    for (const r of rejected) {
      lines.push(`| ${r.firstRow} | ${r.displayName} | ${r.reason} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));

  console.log(options.apply ? "Applying changes." : "Dry run. Nothing will be written.");
  console.log(`Phases: ${options.only.join(", ")}`);
  if (options.limit !== null) console.log(`Limited to ${options.limit} records per phase.`);
  console.log("");

  const { recipients, rejected } = readLabels(readSheet("LABELS"));
  const limited = options.limit === null ? recipients : recipients.slice(0, options.limit);

  console.log(`People   ${limited.length} ready, ${rejected.length} rejected`);

  if (options.apply) {
    console.error("");
    console.error("Writing is not built yet. Re-run without --apply.");
    return 1;
  }

  mkdirSync(REPORTS, { recursive: true });
  const path = join(REPORTS, `import-report-${new Date().toISOString().slice(0, 19)}.md`);
  writeFileSync(path, report(limited, rejected, options), { mode: 0o600 });
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
