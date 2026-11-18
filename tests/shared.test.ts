import { describe, expect, it } from "vitest";

import { ServiceError } from "@/lib/api/errors";
import { selectByIds } from "@/lib/services/shared";

const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);

describe("selectByIds", () => {
  it("asks for at most 100 ids at a time and returns every row in order", async () => {
    const batches: string[][] = [];
    const rows = await selectByIds<{ id: string }>(ids, async (batch) => {
      batches.push(batch);
      return { data: batch.map((id) => ({ id })), error: null };
    });

    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(rows.map((r) => r.id)).toEqual(ids);
  });

  it("asks for nothing when there are no ids", async () => {
    let calls = 0;
    const rows = await selectByIds([], async () => {
      calls += 1;
      return { data: [], error: null };
    });

    expect(calls).toBe(0);
    expect(rows).toEqual([]);
  });

  it("stops at a failed batch with the service's error", async () => {
    const lookup = async (batch: string[]) =>
      batch[0] === "id-100"
        ? { data: null, error: { code: "23503", message: "missing" } }
        : { data: [], error: null };

    await expect(selectByIds(ids, lookup)).rejects.toBeInstanceOf(ServiceError);
  });
});
