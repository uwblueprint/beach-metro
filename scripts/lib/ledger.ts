// The importer's memory of what it did last time.
//
// Reading a sheet produces a key and a hash per row. Comparing those against
// the ledger is what decides whether a row is new, changed, unchanged, or gone.
import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export type EntityType = "volunteer" | "captain" | "route" | "drop";

export interface LedgerRow {
  source: string;
  sourceKey: string;
  entityType: EntityType;
  entityId: string;
  rowHash: string;
  addressHash: string | null;
}

/** What a run decided about one row of a sheet. */
export type Verdict =
  | { kind: "create" }
  | { kind: "update"; entityId: string; addressChanged: boolean }
  | { kind: "unchanged"; entityId: string };

/** Stable hash of whatever the caller reads from a row. */
export function hash(parts: ReadonlyArray<string | number | null>): string {
  // Joined with a separator no field can contain, so ["a","b"] and ["ab"] do
  // not collide into the same hash and hide a real change.
  return createHash("sha256")
    .update(parts.map((p) => p ?? "").join("\u0000"))
    .digest("hex");
}

export class Ledger {
  private readonly rows = new Map<string, LedgerRow>();
  private readonly seen = new Set<string>();

  private constructor(private readonly source: string) {}

  /** Every row this sheet recorded on a previous run. */
  static async load(source: string): Promise<Ledger> {
    const ledger = new Ledger(source);
    const { data, error } = await createAdminClient()
      .from("import_rows")
      .select("source, source_key, entity_type, entity_id, row_hash, address_hash")
      .eq("source", source);
    if (error) throw new Error(`cannot read the import ledger: ${error.message}`);

    for (const r of data ?? []) {
      ledger.rows.set(r.source_key, {
        source: r.source,
        sourceKey: r.source_key,
        entityType: r.entity_type as EntityType,
        entityId: r.entity_id,
        rowHash: r.row_hash,
        addressHash: r.address_hash,
      });
    }
    return ledger;
  }

  /**
   * What to do with one row, and a note that this run has seen it.
   *
   * Marking it seen here rather than at write time means a row that is skipped
   * still counts as present, so it is not reported as having vanished.
   */
  decide(sourceKey: string, rowHash: string, addressHash: string | null): Verdict {
    this.seen.add(sourceKey);
    const known = this.rows.get(sourceKey);
    if (!known) return { kind: "create" };
    if (known.rowHash === rowHash) return { kind: "unchanged", entityId: known.entityId };
    return {
      kind: "update",
      entityId: known.entityId,
      addressChanged: known.addressHash !== addressHash,
    };
  }

  /** Keys the ledger holds that this run never saw. Reported, never acted on. */
  disappeared(): LedgerRow[] {
    return [...this.rows.values()].filter((r) => !this.seen.has(r.sourceKey));
  }

  /** Record a row and the record it produced. Safe to call again for the same key. */
  async record(
    sourceKey: string,
    entityType: EntityType,
    entityId: string,
    rowHash: string,
    addressHash: string | null,
  ): Promise<void> {
    const { error } = await createAdminClient().from("import_rows").upsert(
      {
        source: this.source,
        source_key: sourceKey,
        entity_type: entityType,
        entity_id: entityId,
        row_hash: rowHash,
        address_hash: addressHash,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "source,source_key" },
    );
    if (error) throw new Error(`cannot write the import ledger: ${error.message}`);
    this.rows.set(sourceKey, {
      source: this.source,
      sourceKey,
      entityType,
      entityId,
      rowHash,
      addressHash,
    });
  }

  /** Mark an unchanged row as still present, without touching what it points at. */
  async touch(sourceKey: string): Promise<void> {
    const { error } = await createAdminClient()
      .from("import_rows")
      .update({ last_seen: new Date().toISOString() })
      .eq("source", this.source)
      .eq("source_key", sourceKey);
    if (error) throw new Error(`cannot touch the import ledger: ${error.message}`);
  }
}
