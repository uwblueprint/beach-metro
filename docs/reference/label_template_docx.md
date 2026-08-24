# MasterLabelsMELINDA.docx — the label sheet we are reproducing

Read 2026-08-24 from `MasterLabelsMELINDA (1).docx`, the live Word mail-merge
template Melinda prints labels from. Together with
[`route_labels_spreadsheet.md`](route_labels_spreadsheet.md) — its data source —
this is the whole of the current label process.

Our PDF exporter is a reimplementation of this file. Every dimension in
[`lib/pdf/label-geometry.ts`](../../lib/pdf/label-geometry.ts) was lifted from
it, and this document is the independent re-derivation: **every constant in that
file was checked against the docx on 2026-08-24 and matches.** If the office ever
sends a new template, diff it against the tables below.

**The file is not in this repo and should not be.** It carries staff names in
its document properties (`dc:creator`, `cp:lastModifiedBy`) and an internal
network path, and `uwblueprint/beach-metro` is public. There is no delivery data
in it — the body is merge-field placeholders only — but the metadata is enough
to keep it out.

**To open it again:** unlike the workbook, this one is *not* encrypted. It is a
plain OOXML zip, so no password and no `msoffcrypto`:

```bash
unzip -o "MasterLabelsMELINDA.docx" -d docx_extract
# geometry lives in word/document.xml (sectPr, tblGrid, trHeight)
# the data source lives in word/settings.xml (w:mailMerge)
```

Word measures in twips (1/1440"). PDF measures in points (1/72"). 1 twip =
0.05pt, the `TWIP` constant in `label-geometry.ts`.

---

## 1. Sheet geometry

From `w:sectPr` and the outer table's `w:tblGrid` / `w:trHeight`.

| Property | Twips | Points | Inches |
| --- | --- | --- | --- |
| Page width | 12240 | 612 | 8.5" (US Letter) |
| Page height | 15840 | 792 | 11" |
| Top margin | 360 | 18 | 0.25" |
| Left / right margin | 45 | 2.25 | 0.03125" |
| Bottom margin | 0 | 0 | 0" |
| Label width (column pitch) | 4050 | 202.5 | 2.8125" |
| Label height (row pitch) | 2160 | 108 | 1.5" |

- **Grid: 3 across × 7 down = 21 labels per sheet.** Confirmed three
  independent ways: the `tblGrid` has three `gridCol`s; the outer table has
  7 `<w:tr>` and 21 `<w:tc>`; and the document contains exactly **20 `NEXT`
  field codes** — one fewer than the number of labels, because the first label
  consumes the current record.
- Row height is `w:hRule="exact"`, so labels never grow to fit content. Rows
  also carry `w:cantSplit`. Overflowing text is **clipped, not wrapped onto a
  second line** — worth remembering for long organization names (see
  `route_labels_spreadsheet.md` §2.1).
- The outer table is **centre-justified** (`w:jc val="center"`), not
  left-aligned. 3 × 2.8125" = 8.4375" on an 8.5" page leaves 0.03125" a side.
- 7 × 1.5" = 10.5", plus the 0.25" top margin, leaves 0.25" at the foot.
- **All borders are explicitly `none`.** The template prints no rules of any
  kind — see §4.

## 2. Inside one label

Each outer cell contains a nested 2-column table (`tblW` 4026 twips = 201.3pt,
cols 1555 + 2471), with cell margins of 57 twips (2.85pt) all round.

```
┌──────────────┬───────────────────┐
│ ███ RT«Route»│   «Papers» COPIES │  row 1: two cells
├──────────────┴───────────────────┤
│            «Name»                │  row 2: gridSpan 2
├──────────────────────────────────┤
│           «Address»              │  row 3: gridSpan 2, bold + underlined
├──────────────────────────────────┤
│           «Bundles»              │  row 4: gridSpan 2
└──────────────────────────────────┘
```

| Element | Width | Font | Styling |
| --- | --- | --- | --- |
| RT chip | 1555 tw (77.75pt) | `w:sz` 56 → **28pt** | bold, centred, `vAlign` centre, fill `#0D0D0D` |
| Copies | 2471 tw (123.55pt) | `w:sz` 48 → **24pt** | centred |
| Name | full | `w:sz` 28 → **14pt** | centred |
| Address | full | `w:sz` 32 → **16pt** | **bold + underlined**, centred |
| Bundles | full | document default 22 → **11pt** | centred |

Two details that are easy to miss:

- **The RT chip is reversed out of a near-black block.** The fill is
  `#0D0D0D` ("Black, Text 1, Lighter 5%"). No run in the document sets a text
  colour, so every run is `auto` — and Word's automatic colour renders **white
  on a dark fill**. The chip is white-on-black by inheritance, not by an
  explicit white. It is the one high-contrast element on the label, which is
  how a captain finds their territory in a stack.
- **The literal text is `RT` + the field + four trailing spaces**, and
  `«Papers»` is followed by the literal ` COPIES`. The trailing spaces are what
  keep the number off the right edge of the chip; `label-geometry.ts` replaces
  them with the explicit `CHIP_INSET` / `HEADLINE_GAP` constants.

**One known divergence:** the docx sets the copies count at 24pt while the RT
chip is 28pt. Our renderer draws both at `SIZE_HEADLINE` (28pt) —
[`label-sheet.ts:151`](../../lib/pdf/label-sheet.ts:151). Cosmetic, and only
visible side by side, but it is a real difference from the template.

## 3. The data source

From `w:mailMerge` in `word/settings.xml`:

- `mainDocumentType` = `mailingLabels`
- Connect string points at `I:\DISTRIBUTION\Labels\RouteLabelsFile.xlsx` — an
  office network share, `HDR=YES;IMEX=1` (everything read as text)
- Query: ``SELECT * FROM `RouteLabels` `` — the workbook's defined name, which
  in the 2026-08-24 copy resolves to `LABELS!$A$1:$E$222`

**Five merge fields, in this order:** `Route`, `Papers`, `Name`, `Address`,
`Bundles` — columns A–E. Word's `odso` field map records `Name` → column 2 and
`Address` → column 3 (0-indexed), confirming the alignment.

Everything else on the LABELS sheet — phone, email, start date, the route
description / category keyword, notes, Lucky Volunteer — sits outside column E
and **has never appeared on a printed label**.

## 4. What this settles

- **21 labels per sheet is exact**, not inferred from Melinda's "~220 labels,
  ~10 sheets". The 20 `NEXT` fields nail it.
- **They print on real die-cut label stock.** Melinda loads label sheets two at
  a time, and the template draws no borders whatsoever. Our hairline cut guides
  (`CUT_RULE_WIDTH`, added in #30) have no counterpart here — they were added
  assuming scissors and plain paper. They are **kept deliberately** (they cost
  nothing on pre-scored stock and keep the export usable on plain paper); only
  the dimensions were reconciled. See `label_printing_flow.md` §6. **We still do
  not have the stock's SKU**, which is the one thing needed to guarantee our grid
  lines up with the die cuts.
- **The 2.8125" × 1.5" cell is a *pitch*, not the label's face.** Cells butt
  against each other with no gutter, so the physical label is somewhat smaller
  than the cell and sits inside it. Without the SKU we cannot know by how much —
  another reason to ask.
- **`Route` is the RT/territory code**, printed as the most prominent thing on
  the label. Our renderer still emits the stub `"XX"`
  ([`label-sheet.ts:41`](../../lib/pdf/label-sheet.ts:41)).

---

Related: [`route_labels_spreadsheet.md`](route_labels_spreadsheet.md) for the
data side, [`../flows/label_printing_flow.md`](../flows/label_printing_flow.md)
for the flow spec.
