// Label printing (PRD Flow 6): sheet geometry and PDF rendering.
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  COLS,
  LABELS_PER_PAGE,
  LABEL_H,
  LABEL_W,
  MARGIN_LEFT,
  MARGIN_TOP,
  PAGE_H,
  PAGE_W,
  ROWS,
} from "@/lib/pdf/label-geometry";
import { renderLabelSheet, type LabelContent } from "@/lib/pdf/label-sheet";
import { exportLabels, markLabels } from "@/lib/validation/labels";

function label(overrides: Partial<LabelContent> = {}): LabelContent {
  return {
    routeCode: "XX",
    papers: 50,
    name: "Rudy Peel",
    address: "1230 Kingston Rd, Toronto, ON",
    bundleLine: "Bundle 1 of 2",
    ...overrides,
  };
}

// The office cuts these by hand off a stack, so the geometry has to match the
// Word template exactly or every sheet is misaligned.
describe("label sheet geometry (from MasterLabelsMELINDA.docx)", () => {
  it("is US Letter", () => {
    expect([PAGE_W, PAGE_H]).toEqual([612, 792]);
  });

  it("is a 3 × 7 grid of 2.8125in × 1.5in labels", () => {
    expect([COLS, ROWS]).toEqual([3, 7]);
    expect(LABEL_W).toBeCloseTo(2.8125 * 72, 5);
    expect(LABEL_H).toBeCloseTo(1.5 * 72, 5);
    expect(LABELS_PER_PAGE).toBe(21);
  });

  it("fits the grid inside the page with the docx margins", () => {
    expect(MARGIN_LEFT * 2 + COLS * LABEL_W).toBeCloseTo(PAGE_W, 5);
    expect(MARGIN_TOP + ROWS * LABEL_H).toBeLessThanOrEqual(PAGE_H);
  });
});

describe("renderLabelSheet", () => {
  it("emits a valid PDF with Letter-sized pages", async () => {
    const bytes = await renderLabelSheet([label()]);
    const pdf = await PDFDocument.load(bytes);
    const { width, height } = pdf.getPage(0).getSize();
    expect([width, height]).toEqual([612, 792]);
  });

  it("packs 21 labels per page and spills onto the next", async () => {
    const one = await PDFDocument.load(await renderLabelSheet(Array(21).fill(label())));
    expect(one.getPageCount()).toBe(1);

    const two = await PDFDocument.load(await renderLabelSheet(Array(22).fill(label())));
    expect(two.getPageCount()).toBe(2);
  });

  it("never emits a zero-page PDF, which would be corrupt", async () => {
    const pdf = await PDFDocument.load(await renderLabelSheet([]));
    expect(pdf.getPageCount()).toBe(1);
  });

  it("survives overlong fields instead of overrunning the label", async () => {
    // A long business name is real data — commercial drops are named places.
    const bytes = await renderLabelSheet([
      label({
        name: "Councillor Kandavel Constituency Office, Scarborough Southwest",
        address: "1230 Kingston Road, Unit 4B, Toronto, Ontario M1N 1P3, Canada",
        papers: 1000,
      }),
    ]);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe("label request schemas", () => {
  const ref = { deliveryId: "0b4a1b1e-59c2-4a4f-9a4e-2b7c0f6d8e11", bundleIndex: 0 };

  it("defaults markLabelled on, so printing a label counts as labelling it", () => {
    expect(exportLabels.parse({ bundles: [ref] }).markLabelled).toBe(true);
  });

  it("rejects an empty selection rather than exporting the whole issue", () => {
    expect(exportLabels.safeParse({ bundles: [] }).success).toBe(false);
    expect(markLabels.safeParse({ bundles: [], labelled: true }).success).toBe(false);
  });

  it("rejects a negative bundle index", () => {
    expect(
      markLabels.safeParse({ bundles: [{ ...ref, bundleIndex: -1 }], labelled: true }).success,
    ).toBe(false);
  });
});
