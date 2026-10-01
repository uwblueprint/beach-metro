// Renders bundle labels onto a printable sheet (PRD Flow 6).
//
// The sheet reproduces the office's existing Word mail-merge template,
// MasterLabelsMELINDA.docx — a `mailingLabels` merge over RouteLabelsFile.xlsx
// with the fields Route / Papers / Name / Address / Bundles. Dimensions live in
// ./label-geometry.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  ADDRESS_H,
  BUNDLE_H,
  CHIP_H,
  CHIP_INSET,
  CHIP_W,
  COLS,
  COPIES_W,
  CUT_RULE_WIDTH,
  HEADLINE_GAP,
  INNER_W,
  LABELS_PER_PAGE,
  LABEL_H,
  LABEL_W,
  MARGIN_LEFT,
  MARGIN_TOP,
  NAME_H,
  PAD,
  PAGE_H,
  PAGE_W,
  SIZE_ADDRESS,
  SIZE_BUNDLE,
  SIZE_COPIES,
  SIZE_HEADLINE,
  SIZE_NAME,
} from "./label-geometry";

const INK = rgb(0, 0, 0);
const CHIP_FILL = rgb(0.051, 0.051, 0.051); // #0D0D0D, the docx shd fill
const CHIP_INK = rgb(1, 1, 1);

/** One label's worth of text. All strings are pre-formatted by the service. */
export interface LabelContent {
  /** Printed as `RT{routeCode}`. Currently the stub "XX" — see the service. */
  routeCode: string;
  papers: number;
  name: string;
  address: string;
  /** e.g. "Bundle 2 of 3"; empty for a single-bundle route. */
  bundleLine: string;
}

/**
 * Shrink `size` until `text` fits `maxWidth`.
 *
 * Word reflows overset text automatically; PDF does not, and these fields are
 * user data of unpredictable length — a long street address would otherwise run
 * off the label and off the page. Floors at 5pt so something always prints.
 */
function fitSize(font: PDFFont, text: string, maxWidth: number, size: number): number {
  let s = size;
  while (s > 5 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
  return s;
}

/** Draw `text` horizontally centred in [x, x+width], shrinking it if it overruns. */
function drawCentered(
  page: PDFPage,
  text: string,
  opts: {
    font: PDFFont;
    size: number;
    x: number;
    width: number;
    /** Baseline y. */
    y: number;
    /** Horizontal inset on each side; defaults to the docx cell margin. */
    inset?: number;
    color?: ReturnType<typeof rgb>;
    underline?: boolean;
  },
): void {
  if (!text) return;
  const inset = opts.inset ?? PAD;
  const size = fitSize(opts.font, text, opts.width - 2 * inset, opts.size);
  const w = opts.font.widthOfTextAtSize(text, size);
  const x = opts.x + (opts.width - w) / 2;
  page.drawText(text, { x, y: opts.y, size, font: opts.font, color: opts.color ?? INK });
  if (opts.underline) {
    page.drawLine({
      start: { x, y: opts.y - size * 0.14 },
      end: { x: x + w, y: opts.y - size * 0.14 },
      thickness: Math.max(0.6, size * 0.05),
      color: opts.color ?? INK,
    });
  }
}

/**
 * Draw one label with its top-left corner at (left, top).
 *
 *   ┌──────────┬──────────────┐
 *   │ ██ RTxx  │  N COPIES    │   28pt / 24pt bold, RT box reversed on #0D0D0D
 *   ├──────────┴──────────────┤
 *   │         Name            │   14pt
 *   │        Address          │   16pt bold, underlined
 *   │      Bundle n of m      │   11pt
 *   └─────────────────────────┘
 *
 * No borders are drawn: the docx sets every table border to `none`, so the sheet
 * prints clean and is cut on a guillotine.
 */
function drawLabel(
  page: PDFPage,
  label: LabelContent,
  left: number,
  top: number,
  fonts: { bold: PDFFont; regular: PDFFont },
): void {
  const innerLeft = left + (LABEL_W - INNER_W) / 2;

  // Cut guide first, so any fill drawn below sits over the rule rather than
  // leaving it half-covered where the chip meets the label edge.
  page.drawRectangle({
    x: left,
    y: top - LABEL_H,
    width: LABEL_W,
    height: LABEL_H,
    borderColor: INK,
    borderWidth: CUT_RULE_WIDTH,
  });

  // Headline row: reversed RT chip + copy count.
  const chipTop = top - PAD;
  page.drawRectangle({
    x: innerLeft,
    y: chipTop - CHIP_H,
    width: CHIP_W,
    height: CHIP_H,
    color: CHIP_FILL,
  });
  // Optically centre the cap-height inside the chip rather than sitting the
  // baseline on its floor. The copy count is a smaller size, so it gets its own
  // baseline from the same formula — both cells are `vAlign` centre in the docx,
  // which centres each independently rather than sharing one baseline.
  const centreCapHeight = (size: number) => chipTop - CHIP_H + (CHIP_H - size * 0.72) / 2;
  drawCentered(page, `RT${label.routeCode}`, {
    font: fonts.bold,
    size: SIZE_HEADLINE,
    x: innerLeft,
    width: CHIP_W,
    y: centreCapHeight(SIZE_HEADLINE),
    color: CHIP_INK,
    inset: CHIP_INSET,
  });
  drawCentered(page, `${label.papers} COPIES`, {
    font: fonts.bold,
    size: SIZE_COPIES,
    x: innerLeft + CHIP_W,
    width: COPIES_W,
    y: centreCapHeight(SIZE_COPIES),
    inset: HEADLINE_GAP,
  });

  let y = top - PAD - CHIP_H;

  y -= NAME_H;
  drawCentered(page, label.name, {
    font: fonts.regular,
    size: SIZE_NAME,
    x: innerLeft,
    width: INNER_W,
    y: y + (NAME_H - SIZE_NAME) / 2,
  });

  y -= ADDRESS_H;
  drawCentered(page, label.address, {
    font: fonts.bold,
    size: SIZE_ADDRESS,
    x: innerLeft,
    width: INNER_W,
    y: y + (ADDRESS_H - SIZE_ADDRESS) / 2,
    underline: true,
  });

  y -= BUNDLE_H;
  drawCentered(page, label.bundleLine, {
    font: fonts.regular,
    size: SIZE_BUNDLE,
    x: innerLeft,
    width: INNER_W,
    y: y + (BUNDLE_H - SIZE_BUNDLE) / 2,
  });
}

/**
 * Render labels onto as many sheets as it takes, filling each page left-to-right
 * then top-to-bottom — the order Word's `{ NEXT }` chaining produces, so a stack
 * cut from our PDF collates the same way theirs does today.
 *
 * A short final page is left partly blank rather than padded: the office reuses
 * the leftover stock.
 */
export async function renderLabelSheet(labels: readonly LabelContent[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Beach Metro bundle labels");
  const fonts = {
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    regular: await pdf.embedFont(StandardFonts.Helvetica),
  };

  let page: PDFPage | null = null;
  labels.forEach((label, i) => {
    const slot = i % LABELS_PER_PAGE;
    if (slot === 0) page = pdf.addPage([PAGE_W, PAGE_H]);
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    drawLabel(
      page!,
      label,
      MARGIN_LEFT + col * LABEL_W,
      PAGE_H - MARGIN_TOP - row * LABEL_H,
      fonts,
    );
  });

  // An empty selection is rejected upstream, but a PDF with zero pages is
  // corrupt, so never emit one.
  if (pdf.getPageCount() === 0) pdf.addPage([PAGE_W, PAGE_H]);

  return pdf.save();
}
