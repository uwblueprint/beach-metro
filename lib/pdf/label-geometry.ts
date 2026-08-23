// Sheet geometry for the printed label sheet (PRD Flow 6).
//
// Split out from label-sheet.ts on purpose: the Labels page needs LABELS_PER_PAGE
// to tell the user how many sheets an export will use, and importing the renderer
// would drag pdf-lib into the browser bundle for one integer.
//
// Every dimension is lifted from the office's existing Word mail-merge template,
// MasterLabelsMELINDA.docx, so our output drops into their current process
// unchanged — same sheet, same cut positions, same at-a-glance layout. Word
// measures in twips (1/1440"); PDF measures in points (1/72"). 1 twip = 0.05pt,
// which is the SCALE below. The raw twip values are kept in the comments so this
// can be diffed against the docx if the template ever changes.

export const TWIP = 0.05; // points per twip

// --- Sheet geometry (docx sectPr + outer table) -----------------------------
export const PAGE_W = 12240 * TWIP; // 612pt — US Letter
export const PAGE_H = 15840 * TWIP; // 792pt
export const MARGIN_TOP = 360 * TWIP; // 18pt
export const LABEL_W = 4050 * TWIP; // 202.5pt — 2.8125"
export const LABEL_H = 2160 * TWIP; // 108pt — 1.5", fixed row height in the docx
export const COLS = 3;
export const ROWS = 7; // 3 × 7 = 21 labels per sheet
/** The outer table is centre-justified (`w:jc center`), not left-aligned. */
export const MARGIN_LEFT = (PAGE_W - COLS * LABEL_W) / 2; // 2.25pt

// --- Label interior (inner 2-column table) ----------------------------------
export const INNER_W = 4026 * TWIP; // 201.3pt
export const CHIP_W = 1555 * TWIP; // 77.75pt — the black RT box
export const COPIES_W = 2471 * TWIP; // 123.55pt
export const PAD = 57 * TWIP; // 2.85pt — docx tblCellMar

/**
 * Extra breathing room inside the headline row, which the docx gets for free
 * from Word's own cell padding plus the trailing spaces baked into the RT run.
 * Without it "RT01" fills the black box edge to edge and butts straight into
 * "10 COPIES", which the printed sample clearly separates.
 */
export const CHIP_INSET = 6;
export const HEADLINE_GAP = 8;

// Row bands inside a label, top-down. The docx lets these auto-size; fixing them
// here keeps every label on the sheet identical, which matters when they are cut
// as a stack. Font sizes are the docx half-point values halved.
export const CHIP_H = 44;
export const NAME_H = 20;
export const ADDRESS_H = 24;
export const BUNDLE_H = 14; // 44+20+24+14 = 102 of 108pt, leaving a hair of bottom slack

export const SIZE_HEADLINE = 28; // w:sz 56
export const SIZE_NAME = 14; // w:sz 28
export const SIZE_ADDRESS = 16; // w:sz 32
export const SIZE_BUNDLE = 11; // document default

export const LABELS_PER_PAGE = COLS * ROWS;

// --- Cut guides --------------------------------------------------------------
/**
 * NOT from the docx. Word prints the labels borderless and the office cuts by
 * eye, which is fine on their pre-scored stock but not on plain paper.
 *
 * Every label draws its own full-perimeter rule, so neighbours stroke the same
 * coordinate twice. That is deliberate: labels stay flush (no gutter to widen
 * the sheet or shift the grid off the docx dimensions), and one scissor pass
 * down a shared line separates both sides at once. Drawing per label rather
 * than as a page-wide grid means a part-full final page only gets guides around
 * the labels that exist, leaving the rest of the stock clean for reuse.
 */
export const CUT_RULE_WIDTH = 0.5; // hairline
