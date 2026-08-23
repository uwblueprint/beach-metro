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

`[OPEN]` Reprinting a past issue's labels would need an explicit picker.
Deliberately not built.

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
can be diffed if the template ever changes.

One thing is **not** from the docx: a hairline cut guide around each label. Word
prints them borderless because the office runs pre-scored stock; on plain paper
there is nothing to cut against. Labels stay flush rather than gaining a gutter,
so neighbours stroke the same coordinate and one scissor pass down a shared line
separates both. A part-full final sheet only draws guides around the labels that
exist, leaving the rest of the stock clean for reuse.

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

Printed as `Bundle n of m`, and omitted for a single-bundle route. This is an
interpretation: the field is blank on the printed sample we have, and its purpose
was never documented. It is the reading most consistent with the per-bundle
decision in §2.

`[OPEN]` Confirm with the client. The alternative readings are the split itself
("50 + 25") or a free-text per-volunteer instruction — the latter would revive
the `VolunteerInstruction` placeholder deferred in `docs/schema/data_model.md` §8.

---

## 7. Open items

- **`[OPEN]` The RT number — blocking, asked.** The black chip prints the literal
  stub `RTXX`. The number comes from a `Route` column in the office's
  `RouteLabelsFile.xlsx` and **nothing in our schema corresponds to it**: routes
  are identified by street name plus start/end address, and have no code.
  Emailed the client asking what it is, whether it is stable across issues, how
  it is assigned, and who uses it. A stub prints rather than a generated sequence
  on purpose — invented numbers would look authoritative and stable when they are
  neither, and the gap is obvious on paper.
- **`[OPEN]` The Type column (Carrier / Commercial / Residential).** In the design
  but absent from this PR: nothing in the schema backs it. `Address.type` is only
  `residential | commercial`, and route endpoints are always stored `residential`
  by a locked decision (`docs/design_decisions.md`), so it cannot be reused.
  Every row in the design is a street-segment route, which suggests Type is a
  property *of the route* rather than a route-vs-drop distinction — but that is a
  guess. Deferred to its own small PR once confirmed.
- **`[OPEN]` Commercial drops are not labelled yet.** This flow covers bundles on
  volunteer routes. Commercial drops are `addresses` rows with `type =
  'commercial'` and a `standing_bundles` count, and have no per-issue delivery
  record to hang a label on — yet the printed sample we have (`Councillor
  Kandavel, 1230 Kingston Rd.`) **is** a commercial drop. They also have no name
  field, so there is nowhere for "Councillor Kandavel" to live. Needs both a
  per-issue drop record and a name before it can be built.
- **`[OPEN]` Territory on the label.** The PRD says a label shows the territory.
  The Word template has no territory field, so ours does not either. Dropped
  intentionally, or an omission?
- **`[OPEN]` Label stock.** The sample looks like plain paper cut by hand, and
  2.8125 × 1.5" with zero gutters is not a standard Avery SKU. If it is really
  peel-and-stick stock we need the SKU, and probably cut guides.

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
