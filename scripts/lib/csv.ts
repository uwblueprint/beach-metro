// Reader for the CSVs that scripts/decrypt-workbook.py writes.
//
// Hand-rolled rather than a dependency, matching load-toronto-addresses.ts,
// which streams its CSV into Postgres instead of parsing it in JS. These files
// are small enough to hold in memory and well-formed, since Python's csv module
// wrote them, but addresses contain commas and business names contain quotes,
// so the quoting rules still have to be honoured.

/** One sheet as rows of raw strings. Blank trailing fields are kept. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      endField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      endRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  // A file not ending in a newline still has a final row to flush, but a file
  // that does must not gain an empty one.
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Trimmed, collapsed whitespace, lowercased. For comparing, never for storing. */
export function normalise(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Trimmed with inner whitespace collapsed, preserving case. For storing. */
export function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** `clean`, but an empty result reads as absent. */
export function cleanOrNull(value: string | undefined): string | null {
  return clean(value) || null;
}

/** A whole number, or null when the cell is blank or not one. */
export function intOrNull(value: string | undefined): number | null {
  const text = clean(value);
  if (!text) return null;
  const n = Number(text);
  return Number.isInteger(n) ? n : null;
}
