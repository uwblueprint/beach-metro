# Label Printing Flow

A walkthrough of how the distribution manager gets a stack of printed bundle
labels for a publication run: choosing which bundles need a sticker, marking them
off, and exporting a print-ready PDF sheet.

Scope: the per-bundle labelled state for an issue, the export to PDF, and the
physical sheet layout.

Out of scope here and owned by other flows:

- Issue creation and the open/closed lifecycle: delivery recording flow.
- The standing per-route paper and bundle counts, and the greedy split that seeds
  them: route management and finance flows. Read here, owned there.
- Captain pay. Labelling has no effect on payouts.

Values that are not yet confirmed are marked `[OPEN]`.

---

## 1. Why this flow exists

From the PRD (Flow 6, problem P4): "a sticker that is attached to some bundles,
which specifies the paper count, the volunteer name, volunteer address, and
territory… labels are used so that captains know which bundles to grab and which
bundles to drop off where. **Not all bundles need to be labelled.**"

Today the office does this with a Word mail merge. The template
(`MasterLabelsMELINDA.docx`) is a `mailingLabels` document bound to a spreadsheet
at `I:\DISTRIBUTION\Labels\RouteLabelsFile.xlsx`, table `RouteLabels`, with five
merge fields: **Route, Papers, Name, Address, Bundles**. This flow replaces the
spreadsheet and the merge, not the physical sheet — the printed output is
deliberately identical so nothing downstream (cutting, sorting, sticking) changes.

---

## 2. The unit is the bundle, not the route

**Settled.** A label belongs to one bundle. A route with three bundles can have
one labelled and two not, so selection, marking, and export are all per bundle.

This follows from the PRD ("select the subset of **bundles** that need labels")
and matches the design, where a route row expands into `Bundle 1`, `Bundle 2`, …
each with its own checkbox.

It also settles what the template's `Papers` field means: **that bundle's paper
count**, not the route total. The printed sample reading `10 COPIES` is a
single-bundle commercial drop, which is why it looked like a route total.

### Addressing a bundle

Bundles have no id. They are positions in the `route_deliveries.bundles` JSONB
array, so a bundle is `(deliveryId, bundleIndex)` everywhere — wire format,
database key, and UI selection key alike.

**Known limitation.** The key is positional: re-splitting a delivery's bundles
shifts the indices and the labelled flags shift with them. Accepted for MVP, on
the grounds that a re-split means the physical bundles changed and any labels
already printed are stale anyway. If this bites, bundles gain a stable id and
`bundle_labels` points at that instead.

---

## 3. Which issue

Labels belong to the **most recent open issue**, resolved server-side. There is
no issue picker: the flow is inherently "the run we are about to send out", and a
closed issue has already shipped.

Scoping falls out of the schema for free — `bundle_labels.delivery_id` points at
a `route_deliveries` row, which belongs to exactly one issue — so a new issue
starts with every bundle unlabelled without any reset step.

**Reprinting.** Built 2026-08-24, at the office's request. The screen defaults
to the open issue — the everyday case — and an issue picker appears once more
than one issue exists, offering the open one plus the twelve most recent. Picking
a closed issue puts the screen in **reprint mode**, where "Export" with nothing
selected takes *every* bundle rather than only the unlabelled ones, since a past
run is normally fully labelled and the usual default would find nothing.

---

## 4. Labelled state

`bundle_labels` is a join table: one row per labelled bundle, unique on
`(delivery_id, bundle_index)`.

**Presence of a row means labelled.** There is no `labelled boolean`, and
unlabelling deletes the row, so "never labelled" and "un-labelled again" are the
same state. The office only cares whether a label exists.

Marking is idempotent — re-marking an already-labelled bundle upserts and returns
success rather than 409, because boxes get ticked in whatever order.

---

## 5. The export

1. The manager picks bundles, or picks nothing.
2. **Export Labels** opens a confirm dialog stating the label count, the sheet
   count, and how many of the chosen bundles are already marked labelled (i.e.
   would be reprints).
3. On confirm, the server renders the PDF and the browser downloads it.
4. Exported bundles are marked labelled, because **printing a label is the act of
   labelling it** and the office should not have to remember a second click.

**With nothing selected, export means "every unlabelled bundle in this issue"** —
the normal case, and the reason the button is useful on a fresh page load. An
empty *result* is still rejected: `POST /api/labels/export` requires at least one
bundle, so an accidental click never burns a stack of label stock.

Marking happens **after** the bytes render, so a failed render leaves the flags
untouched and the manager can just hit export again.

---

## 6. The printed sheet

Every dimension is lifted from `MasterLabelsMELINDA.docx` and lives in
`lib/pdf/label-geometry.ts`, with the original twip values in comments so the two
can be diffed if the template ever changes. The template itself is documented in
[`../reference/label_template_docx.md`](../reference/label_template_docx.md) —
full geometry tables, the merge-field list, and how to re-extract it. Those
constants were re-derived from the docx and verified on 2026-08-24.

One thing is **not** from the docx: a hairline cut guide around each label.
Labels stay flush rather than gaining a gutter, so neighbours stroke the same
coordinate and one scissor pass down a shared line separates both. A part-full
final sheet only draws guides around the labels that exist.

**`2026-08-24` The guides stay.** They were added on the assumption the office
cuts plain paper by hand, and that assumption turned out to be wrong — Melinda
loads real die-cut label stock, two sheets at a time. The guides were reviewed on
that basis and **kept anyway**: they cost nothing on stock that is already
scored, and they keep the export usable on plain paper. Only the *dimensions*
were reconciled against the docx. Not an oversight — a decision.

| | |
| --- | --- |
| Page | US Letter, 8.5 × 11" (612 × 792 pt) |
| Margins | top 0.25", left/right 0.031" (the outer table is centre-justified), bottom 0 |
| Grid | **3 across × 7 down = 21 labels per sheet** |
| Label | **2.8125" × 1.5"** (202.5 × 108 pt), fixed height, **no gutters** |
| Borders | none — the docx sets every table border to `none`; sheets are cut on a guillotine |

One label:

```
┌──────────┬──────────────┐
│ ██ RTxx  │  N COPIES    │  28pt bold; RT box reversed out of #0D0D0D
├──────────┴──────────────┤
│         Name            │  14pt
│        Address          │  16pt bold, underlined
│      Bundle n of m      │  11pt
└─────────────────────────┘
```

Labels fill **left to right, then top to bottom** — the order Word's `{ NEXT }`
chaining produces, so a stack cut from our PDF collates the way theirs does now.
A short final page is left partly blank rather than padded; the office reuses the
leftover stock.

Text auto-shrinks to fit its cell (floor 5pt). Word reflows overset text for
free; PDF does not, and these are user-entered names and addresses of
unpredictable length — a long business name would otherwise run off the label.

### The `Bundles` field

Printed as `Bundle n of m`, and omitted for a single-bundle route.

**Resolved 2026-08-23** by reading `RouteLabelsFileBMN.xlsx` directly. The
office's own `Bundles` column confirms this reading for Carrier rows: over 150
values follow the exact `N of M` pattern, on ordinary volunteer-route rows.
It carries something different on bulk-drop rows — the 5 free-text values
found ("Tie Loosely", "Open and leave in lobby", "Leave close to door", "Give
to Hope") appear **only** on rows categorized Building or Business, never on a
Carrier row. So `N of M` for Carrier deliveries is confirmed as-built; a
free-text handling instruction for Commercial/Residential bulk drops is a
real, separate field the office already uses — worth reviving the
`VolunteerInstruction` placeholder (`docs/schema/data_model.md` §8) once
those drop types get a per-issue delivery record of their own (see the
Commercial/Residential item below).

---

## 7. Open items

- ~~**`[OPEN]` The RT number.**~~ **Resolved 2026-08-24.** It is a designation
  carried by the **captain** — confirmed by the team after reading the office's
  own sheet, where `Payments2026` keys one row per captain by the same code that
  groups the `LABELS` rows, and `SKIP HOUSES` keys by it too. Numbering has gaps
  (05, 11, 13, 16, 19, 21, 27-29 are all absent) because absorbing another
  captain's area retires the absorbed number.

  Now `captains.rt_number` — text, not an integer, since the office prints the
  leading zero of `01` and one captain's designation is the span `31-71`. Unique
  where set, so a chip is never ambiguous, and nullable, so a captain can exist
  before being given one. The label prints `RTXX` when it is unset or the route
  has no captain, which is the same visible gap as before rather than an invented
  number.

  One divergence worth remembering: the file keeps a *separate* payment row per
  RT, and twelve captains cover 22 carrier RTs between them (one holds eight).
  We are deliberately modelling one RT per captain and ignoring that case — see
  `docs/reference/route_labels_spreadsheet.md` §7.
- ~~**The Type column (Carrier / Commercial / Residential).**~~ **Resolved
  2026-08-23** (Kristen, Slack). It confirms the guess this item used to make:
  Type is a property of the *delivery*, not a route-vs-drop split of one thing.
  **Carrier** = a normal volunteer route (a person walking a street segment).
  **Commercial** = a bulk drop at a business (the `Councillor Kandavel, 1230
  Kingston Rd.` sample). **Residential** = a bulk drop at an apartment or condo
  — a bulk drop-off, same mechanically as Commercial, just categorized by what
  kind of building receives it. This is **not** the same thing as
  `Address.type = 'residential'`, which today just means "an ordinary
  volunteer's home or a route endpoint" — a residential *bulk drop* location is
  a third kind of address our schema has never modeled. Locked in
  `design_decisions.md`.

  Practically: every row `listLabels()` can produce today is `Carrier`, because
  `route_deliveries` only ever sources from `volunteer_routes` — nothing else
  feeds it yet. So the Labels page can show `Carrier` as a real, confirmed
  value right now instead of a placeholder; Commercial and Residential rows
  can't appear until the item below is built.
- **`[OPEN]` Commercial and Residential drops are not labelled yet.** This flow
  covers bundles on volunteer routes only. A bulk drop — Commercial (business)
  or Residential (apartment/condo) — is today either an `addresses` row with
  `type = 'commercial'` and a `standing_bundles` count (business drops), or not
  modeled in the schema at all (apartment/condo drops have no address-type
  distinction from an ordinary residential address, per the Type-column
  resolution above). Neither has a per-issue delivery record to hang a label
  on — yet the printed sample we have (`Councillor Kandavel, 1230 Kingston
  Rd.`) **is** a commercial drop. Commercial drops also have no name field, so
  there is nowhere for "Councillor Kandavel" to live. Needs a per-issue drop
  record for both kinds, a name field for commercial drops, and a way to tell
  a residential bulk-drop address apart from a volunteer's home, before either
  can be built.
- **~~`[OPEN]`~~ Territory on the label — RESOLVED 2026-08-24.** The earlier
  reading that "the Word template has no territory field" was wrong. Its *first*
  merge field is `Route` — column A, the RT number — printed as `RT«Route»` in
  the reversed black chip, the most prominent element on the label. The PRD and
  the template agree; the chip is the territory. We already render it, currently
  with the stub `"XX"` ([`lib/pdf/label-sheet.ts:41`](../../lib/pdf/label-sheet.ts:41)),
  so this is now just a matter of feeding it the real RT.
- **`[OPEN]` Label stock — SKU still needed.** Melinda's written printing steps
  (2026-08-23, see `docs/reference/route_labels_spreadsheet.md` §4) say to
  "remove regular paper from printer and place 2 sheets of labels in printer",
  about 10 sheets for a ~220-label run. The office confirmed on 2026-08-24:
  **real die-cut label stock, never plain paper.** The cut guides stay regardless
  (§6).

  The SKU is still outstanding, and it matters more than it looks: 2.8125 × 1.5"
  is the *cell pitch*, not the label face. Cells butt with no gutter, so the
  physical label is smaller and sits inside its cell — by how much, only the
  product number can tell us. See `docs/reference/label_template_docx.md` §4.
- **Nice-to-have: bundle-size filters on the selection list.** The office's own
  practice is to label only remainder bundles and hand over whole 50s and 25s
  unlabelled as a count (`route_labels_spreadsheet.md` §3), but they *sometimes*
  want the whole ones labelled too — so selection stays manual. Two things would
  make it quicker, neither urgent:
  1. A filter to show/hide whole 50s and 25s.
  2. A one-click "select every non-50/25 bundle", which reproduces their default
     in a single action. Derivable from `greedySplit`; no schema change.

---

## 8. Data model

```sql
create table bundle_labels (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references route_deliveries (id) on delete cascade,
  bundle_index integer not null check (bundle_index >= 0),
  labelled_at timestamptz not null default now(),
  unique (delivery_id, bundle_index)
);
```

## 9. API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/labels` | Every bundle in the current open issue, grouped by captain, with its labelled flag and per-group counts. |
| POST | `/api/labels/mark` | Bulk set/clear labelled. `{ bundles: [{ deliveryId, bundleIndex }], labelled }`. |
| POST | `/api/labels/export` | Render bundles to a PDF sheet. `{ bundles, markLabelled? }`, default `markLabelled: true`. |

Export answers with **PDF bytes**, not the `{ data }` envelope every other
endpoint uses — the response *is* the file. Failures still use the normal JSON
envelope, so the client checks the content type before treating the body as a
file.

Route names come from the shared `routeLabel` helper in `lib/services/derive.ts`
("Queen St E · 2038 → 2190"), the same one the members and routes screens use, so
a route reads identically everywhere. It degrades to the bare street name when an
endpoint has not been geocoded yet.

Rows are grouped by captain because that is the physical workflow: labels come
off the printer and get sorted into one pile per captain. A route whose volunteer
has no territory still needs labelling, so it lands in a single "Unassigned"
group rather than being dropped.

## 10. Code map

| Path | Role |
| --- | --- |
| `supabase/migrations/20260806000000_bundle_labels.sql` | The join table. |
| `lib/validation/labels.ts` | Request schemas (`bundleRef`, `markLabels`, `exportLabels`). |
| `lib/services/labels.ts` | Listing, marking, and the export orchestration. |
| `lib/pdf/label-geometry.ts` | Sheet dimensions. No pdf-lib import, so the page can read `LABELS_PER_PAGE` without bundling the renderer. |
| `lib/pdf/label-sheet.ts` | The renderer. |
| `app/api/labels/**` | Route handlers. |
| `features/labels/api.ts` | Query keys, fetchers, blob download. |
| `app/(dashboard)/labels/page.tsx`, `components/labels-table.tsx` | The screen. Deliberately rough — this PR is about the export and the backend; visual polish is a follow-up. |
