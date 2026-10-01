# RouteLabelsFileBMN.xlsx — what the office's spreadsheet actually contains

Read 2026-08-23 from `RouteLabelsFileBMN (2).xlsx`, the live workbook Melinda
runs distribution from. This is the system we are replacing, so where it and our
schema disagree, **it is the source of truth about how the office works** and we
are the thing that is wrong.

**Re-read 2026-08-24** against a newer, tidied copy (`RouteLabelsFile.xlsx`) the
office sent over. Same sixteen sheets, same structure; row counts drift by a few
(LABELS 468 → 462, QUITS 434 → 442) and the merge range moved `$E$221` → `$E$222`.
Every finding below was re-verified against it and still holds unless a
`2026-08-24` note says otherwise. Two changes worth knowing up front: **the newer
copy is not password-protected** (a plain OOXML zip — ignore the `msoffcrypto`
dance below), and `Payments2023 ` **has a trailing space in its sheet name**,
which will silently break any importer that looks the sheet up by name.

**The file is not in this repo and must not be.** It holds 322 volunteer names,
310 home addresses, 157 phone numbers, 384 email addresses and seven years of
captain payment history for real people, and `uwblueprint/beach-metro` is a
public repository. Everything below is structure, counts and patterns only — no
records.

**To open it again:** the workbook is Office-encrypted with the password `BMN`
(no trailing punctuation). It is not a plain zip, so `unzip` and most xlsx
readers fail on it. Decrypt first, then read:

```python
import msoffcrypto, openpyxl, io
buf = io.BytesIO()
with open("RouteLabelsFileBMN.xlsx", "rb") as f:
    o = msoffcrypto.OfficeFile(f); o.load_key(password="BMN"); o.decrypt(buf)
buf.seek(0)
wb = openpyxl.load_workbook(buf, data_only=True)
```

Ask whoever owns the file for a copy; don't commit one, and delete any decrypted
copy when you're done.

---

## 1. The sheets

| Sheet | Rows | What it is |
| --- | --- | --- |
| `LABELS` | 468 | The mail-merge source. One row per **bundle**, grouped by territory. |
| `Payments2020`…`Payments2026` | ~64 each | One row per **captain** per year, plus a per-issue payment calendar. |
| `STREETS` | 1,181 | Street segments with side, endpoints and paper counts. Their route table. |
| `QUITS` | 434 | Archive of people who stopped delivering. |
| `SKIP HOUSES` | 17 | Addresses to **not** deliver to, keyed by territory. |
| `Route24`, `Routes31-71`, `Route81`, `Route91` | 15–316 | Working sheets for the driven bulk-drop routes. |
| `Sheet1` | 51 | A single captain's printing worksheet. |

---

## 2. Where our model and their reality disagree

Ordered by how much trouble each will cause. None of these were changed in the
PR that added this document — they are decisions, not bugs.

### 2.1 A third of "people" are not people

`LABELS.Name`, 468 rows:

| Shape | Count |
| --- | --- |
| Parses as `First Last` | 312 (66%) |
| Organization or building | 80 |
| Several people at once | 41 |
| Single word, no surname | 35 |
| **Not `first_name` + `last_name`** | **156 (33%)** |

Real values include a bare `Building`, `St. Aidan's Church`, `Christie Family`,
`Henley Gardens IDA Pharmacy`, `Liz Nadeau/Rich Eaton`, and
`Ruth, Genevieve and Jamie Neal-Ellis`.

We store `volunteers.first_name` + `last_name`, both required. **A third of
their roster cannot be entered without mangling it.** A household that shares a
route is one delivery, not two volunteers; a church is not a person at all.

Options, none free: a single `display_name` column; a nullable `last_name` plus
an `organization` flag; or a separate non-person recipient entity. This is the
biggest schema question the spreadsheet raises and it wants a real decision
before any data import.

### 2.2 Contact details are mostly missing, but we require them

| Field | Filled in `LABELS` | Our rule |
| --- | --- | --- |
| Phone | 91 / 468 (19%) | `phone` required, min length 1 |
| Email | 202 / 468 (43%) | `email` required, must be a valid address |
| Start date | 203 / 468 (43%) | `startDate` required |

`createVolunteer` rejects a record missing any of these. **Four in five of their
real rows have no phone.** Either the import path relaxes these, or someone
invents contact details for 377 people. Requiring them for *new* records is
defensible; requiring them for *existing* ones is not.

### 2.3 Captain pay has a car allowance we do not model

`Payments2026` carries `Car` per captain: 23 at `0`, two at `50`, one at `15`.
`Route91`'s summary row shows the arithmetic outright:

```
Bundles 13 · Papers 610 · Drops 36 · per drop 1.50 · Total 54 · Gas 15 · PAY 69
```

36 × $1.50 = $54, **plus $15 gas = $69**. Our `calculatedAmount` is purely
quantity × rate and has nowhere to put the $15. Any captain with a car allowance
is currently underpaid by our figure.

**`2026-08-24` Decided: we are not modelling it.** The allowance is unchanged
across all seven Payments sheets — two at `50`, one at `15` — and in 2026 it sits
on the three *driven* routes only (31-71 `$50`, 81 `$50`, 91 `$15`), never on a
carrier territory. The arithmetic is additive and checks out on both: 204 drops ×
`$1.25` + `$50` = `$305`, and 36 × `$1.50` + `$15` = `$69`.

The office says they now run without it, so `calculatedAmount` stays quantity ×
rate. **This is a deliberate decision against what the file shows**, recorded
here so it stays one: if those three routes look `$115` an issue light, this is
why. There is precedent for folding it into the rate instead — `Payments2023`
carries the note *"Bob H. cut his gas to .50cents per bundle 7.23.2023 as per
email"* — so a rate adjustment is the escape hatch if it turns out to still be
owed.

### 2.4 Pay basis has a fourth value

`Payments2026.PER`: `Bundle` (20), `Dropoff` (3), `Paper` (1), **`N/A` (1)**.

Our `pay_type` enum is `bundle | paper | drop` — the first three line up exactly.
`N/A` does not. It may be a captain who takes no payment at all, which we would
model as rate `0`, but "no pay basis" and "a rate of zero" are different
statements and only they can say which they mean.

Observed rates: `1`, `1.25`, `1.5`, `1.55`, `0.5`, `0.18`, `0`. All fit
`numeric(10,2)`.

### 2.5 Route endpoints are usually intersections, not addresses

`STREETS`, 1,181 segments:

- **869 (74%)** have cross-street endpoints — `GLEN MANOR` → `MACLEAN`.
- **312 (26%)** carry a house number — `QUEEN 2440`.
- **311 have `start == end`** — a single building, not a segment at all.

We store both endpoints as geocoded `addresses` rows. An intersection is
geocodable if written as `"Bonfield Ave & Glen Manor Dr, Toronto"` (our seed
already does exactly this), so the model bends — but the *entry* experience
assumes a street address and their data is mostly not one.

The 311 degenerate same-endpoint rows are the `BUILDING` category from `LABELS`:
apartment bulk drops recorded as zero-length routes. That is the residential
bulk drop Kristen described, and it is 26% of their route table.

`Side` values are `NORTH` 312 / `WEST` 299 / `EAST` 292 / `SOUTH` 273 — matching
our enum, except **`BOTH` is never used once**, though our schema added it. Five
rows are typos (`WET`, `EAST\``, `` ` ``, `SOUTH AVE`, `GOOD TIMES CAFÉ`).

### 2.6 A skip list with nowhere to live

`SKIP HOUSES` keys addresses by territory number: houses the office has decided
not to deliver to. Nothing in our schema represents this.

It directly undermines automated house counts: Toronto Open Data (#23) counts
every address on a segment and cannot know that three of them are opted out, so
it will overcount wherever a skip exists.

**`2026-08-24` Decided: no skip-list entity.** Skipped addresses go in the notes
field alongside everything else, and the overcount is accepted — 17 skips spread
across the whole city is roughly one house per territory, which is not material
to how the office plans a route. Revisit only if the count starts being used for
something that needs to be exact, like paper ordering.

### 2.7 Substitutes are real but almost never used

`AWAY BUNDLES` / `AWAY PAPERS` exist on every Payments sheet. Populated rows,
2020 → 2026: **0, 1, 0, 0, 0, 0, 0.** Once in seven years.

Not an argument to remove the feature — the client explicitly asked for it in the
July 2026 review and it is a locked decision. It is an argument against
investing further in substitute UX until someone asks.

**`2026-08-24` Correction — those two columns are not the whole story.** The
literal string `away` is written *into the per-issue payment cells* of the
captain ledger, and it appears **6 times in `Payments2026` alone** across three
captains. It means "this captain earned nothing this issue"; the `PAY` batch
total simply skips it. So being away is ordinary, not once-in-seven-years — it
is just recorded in the calendar rather than in `AWAY BUNDLES` / `AWAY PAPERS`.
Semantically this is our payout **freeze** (detached from the live calculation,
not marked paid), which is already built — see `lib/services/payouts.ts`.

### 2.8 Fields we dropped that they still use

- **`Lucky Volunteer`** — populated on 38 rows. We dropped
  `Volunteer.LuckyVolunteerDate` as post-MVP volunteer credit. Still in use.
- **Free-text handling instructions** — `LABELS.Bundles` carries `N of M` on
  carrier rows, but on bulk-drop rows it holds instructions instead:
  `Tie Loosely`, `Open and leave in lobby`, `Leave close to door`,
  `Give to Hope`. All five occurrences are on `BUILDING` or `BUSINESS` rows,
  never a carrier row. This is the `VolunteerInstruction` placeholder we
  deferred, and it is a per-drop field, not a per-volunteer one.

### 2.9 Their history archive is not cleanly structured

`QUITS` holds 431 rows going back years, but the columns drifted: column 8
mixes `Y` flags with phone numbers, column 9 holds phones, dates, emails and
street descriptions, column 11 holds street descriptions and dates. Only 117
rows carry a parseable date, spanning 2016–2019.

Column 12 records a reason, and one of the values is **`Deceased`** — which is
not the same event as quitting and probably should not be reported the same
way. Our model has a bare `retired_at` date and no reason at all.

Importing this is real manual work rather than a mapping exercise. Whether it
is worth doing is a decision, not a technical question (§6, item 13).

---

## 3. Things the spreadsheet settles

- **The `Type` column.** `LABELS` column I holds either a street description
  (214 rows) or a category keyword: `BUSINESS` 89, `BUILDING` 31, `SCHOOL` 10,
  `CHURCH` 10, `LIBRARY` 7, `HOSPITAL` 3. Confirms Kristen's Slack answer, and
  shows the real taxonomy is **finer than three values** — schools, churches,
  libraries and hospitals are all their own keyword, not lumped into
  "Commercial".
- **The RT number is per territory, not per route.** Route `02` alone spans 21
  rows covering a dozen different people and addresses. `Payments2026` keys one
  captain per RT (`01`, `02`, …). `SKIP HOUSES` keys by RT. Three independent
  sheets agree it identifies a captain's area, not a street segment. See
  `label_printing_flow.md` §7.

  **`2026-08-24` We are modelling RT on the captain anyway** (§7). The numbering
  has gaps — 05, 11, 13, 16, 19, 21, 27–29 are all absent — because captains
  absorb each other's territories and the absorbed number retires. Note the
  file does *not* fully agree: Payments keeps a separate row per RT with its own
  bundle/drop counts and rate, and twelve captains cover 22 carrier RTs between
  them (Wally Hucker alone holds eight). That exception is a known, accepted
  divergence, not an oversight.
- **`Bundle N of M` is correct.** Over 150 values follow the pattern exactly on
  carrier rows, confirming what we already print.
- **Bundle composition is counted in 50s and 25s.** The drop sheets have literal
  `50's` and `25's` columns, matching `greedySplit`'s denominations.
- **Territory drops do have a date** — `Route91`'s `New/Stop` column holds dates
  from 2018–2019. It is a drop's **added/removed** date, not a per-issue
  delivery date. That likely answers the "Territory Drops has no date" open item:
  the design's date is a lifecycle date, and needs no per-issue drop record.
- **The publication calendar is real data.** `Payments2026` row 2 lists issue
  days per month: Jan 6/20, Feb 3/17, Mar 3/17/31, Apr 14/28, May 12/26,
  Jun 9/23, Jul 21, Aug 25, Sep 8/22, Oct 6/20, Nov 3/17, Dec 1/15. Roughly
  biweekly Tuesdays, 22 issues a year, with single issues in July and August.
- **They batch payouts.** Per-issue amounts accumulate into `PAY` columns (two
  or three issues at a time). We treat `pay_cadence` as informational and never
  aggregate — a deliberate decision, but they really do disburse in batches.
- **Scale.** ~358 commercial drop locations across the driven routes
  (`Routes31-71` ~109, `Route81` ~209, `Route91` ~40). Our seed has two.
- **Our per-bundle model is exactly right.** `Sheet1` is one captain's pickup
  worksheet and it has a literal **`Labeled` / `Unlabeled` column per bundle**
  (17 labelled, 7 not, across two territories). That is `bundle_labels` in
  spreadsheet form, and it independently confirms the "the unit is the bundle,
  not the route" decision in `label_printing_flow.md` §2.
- **`2026-08-24` Which bundles get labelled, and why the merge range stops
  halfway.** LABELS is *two passes* through the territories — rows 2–222
  (RT 01…66) and again rows 223–463 (RT 01…66, less 02 and 18). They are not
  duplicates: only 43 of 333 unique name+address pairs appear in both. The
  merge range covers the first pass only, and that is **deliberate**:

  | | rows 2–222 (print) | rows 223–463 (never print) |
  | --- | --- | --- |
  | Papers per row | median 32, max 63 | median 50, **max 50** |
  | Exactly 50 or 25 | 8% | 90% (rest are one `0` spacer per RT) |
  | Phone / email / start date | 60 / 148 / 141 | 31 / 45 / 54 |

  `Sheet1` gives the rule outright. Its header reads *"In addition to the
  labeled bundles take 4 x 50s and 3 25s unlabeled"*, and every `Unlabeled` row
  on it is **exactly 25 or 50 papers**, while every `Labeled` row is a
  non-standard quantity (15, 27, 30, 35, 36, 39, 40, 41, 42, 44, 45, 52, 66) —
  no exceptions. Cross-checked: LABELS rows 223+ for RT 03 hold 4×50 and 4×25,
  against Sheet1's "4 x 50s and 3 25s".

  > A bundle earns a printed label when it is a **remainder** quantity. Whole
  > 50s and 25s are interchangeable, so they travel unlabelled and are handed
  > over as a count.

  This answers §6 item 8 — the bottom 241 rows are not being quietly missed.
  It does **not** change what we build: our Labels page already selects
  bundles manually per `(deliveryId, bundleIndex)`, and the office sometimes
  *does* want whole 50s labelled. Recorded as nice-to-have filters in
  `label_printing_flow.md` §7.
- **The Word merge only reads five columns and about half the rows.** The
  workbook's one defined name is `RouteLabels → LABELS!$A$1:$E$221`. So:
  - Only **A–E** (Route, Papers, Name, Address, Bundles) reach the label. Phone,
    email, start date, the category keyword and Lucky Volunteer are working
    columns that sit alongside and never print — including the category, which
    means **Type has never appeared on a printed label**.
  - Only rows **2–221** are in range, out of 468 populated rows (2–222 of 462 in
    the 2026-08-24 copy). **Answered:** the out-of-range rows are the whole
    50s and 25s that go out unlabelled — see the labelling rule above.
- **Annual captain cost, for the reporting dashboard.** `Payments2026` has 24
  captain rows summing to **$915.80 per issue**. At ~22 issues a year that is
  roughly **$20,000/year** in captain payments — a useful sanity check for
  whatever the overview's cost figures end up showing.
- **Per-paper pay confirmed.** `Route24` does the arithmetic in the open:
  1,200 papers × $0.18 = $216. It also carries
  `DISCONTINUED 8.22.2023 AS PER SUSAN`, showing they retire a whole route with
  a reason and a date — we soft-delete with neither.

---

## 4. How they print labels today

Melinda's own steps, for context on what the Labels page replaces:

1. Open the RouteLabels file, note the last row number to be printed.
2. Open `MasterLabelsMELINDA.docx`; say yes to the prompt.
3. Left menu → Distribution → Labels → `RouteLabelsFile.xlsx`.
4. Mailings → Update Labels → Preview.
5. Only page one previews; the rest are assumed correct.
6. Print, `from 1 to <the number from step 1>` — usually around 220.
7. Swap plain paper for label stock, two sheets at a time, ~10 sheets total.
8. **Close without saving.**

Worth noting against our implementation:

- **~220 labels, ~10 sheets** ⇒ about 22 labels per sheet, consistent with our
  21-per-sheet geometry from the same template.
- **They print onto label stock, two sheets at a time.** This settles the
  `[OPEN]` "label stock" question in `label_printing_flow.md` §7 — it is real
  peel-and-stick stock, not plain paper cut by hand. The cut guides we added are
  therefore wrong for their actual workflow and should be revisited, and we
  still need the SKU to guarantee alignment.
- **The row count is a manual step** they have to look up and type. Our Export
  button removes that entirely.
- **"have faith the rest of the pages are correct"** and **"DO NOT SAVE"** are
  both fear-of-the-tool workarounds, not requirements to preserve.

---

---

## 5. Things the office does today that our software cannot

The gap list. Everything here is something they demonstrably do in the
spreadsheet and we have no way to represent. Ordered roughly by how much it
hurts.

| # | They can | We cannot | Where it shows |
| --- | --- | --- | --- |
| 1 | Record a recipient who is not one person — a church, a building, a household, two people sharing | `first_name` + `last_name`, both required | §2.1 — 156 of 468 rows |
| 2 | Keep someone on the roster with no phone or email | Both required to create anyone | §2.2 — 81% have no phone |
| 3 | Pay a captain a car/gas allowance on top of their rate | Payout is quantity × rate, full stop | §2.3 — `Route91`: +$15 |
| 4 | Mark a captain as having no pay basis at all (`N/A`) | `pay_type` must be bundle, paper or drop | §2.4 |
| 5 | List specific houses to skip inside a territory | Nowhere to put it | §2.6 — `SKIP HOUSES` |
| 6 | Distinguish a school, church, library and hospital | Only "commercial" | §3 — 30 such rows |
| 7 | Attach a handling instruction to a drop ("Tie Loosely", "Open and leave in lobby") | No such field | §2.8 |
| 8 | Deliver to a commercial or residential **bulk drop** as a tracked per-issue thing | Only volunteer routes get deliveries | `label_printing_flow.md` §7 |
| 9 | Tell a captain "and take 4 loose 50s and 3 loose 25s" alongside the labelled bundles | We list every bundle individually, with no loose summary | §3 — `Sheet1` |
| 10 | Refer to a territory by number (RT 01, RT 02…) | Territories have no name or number | §3 |
| 11 | Record why someone left — quit, or **deceased** | `retired_at` is a bare date | `QUITS` col 12 |
| 12 | Retire a whole route with a reason and date ("DISCONTINUED 8.22.2023 AS PER SUSAN") | Routes soft-delete with no reason | `Route24` |
| 13 | Record when a drop was added or stopped | Drops are addresses, undated | §3 — `New/Stop` |
| 14 | Track a "Lucky Volunteer" award | Field dropped as post-MVP | §2.8 — 38 rows |
| 15 | Know the whole year's issue dates in advance | Issues are created one at a time | §3 — the calendar |
| 16 | Reprint labels for a past issue | Current open issue only | `label_printing_flow.md` §3 |
| 17 | Pay captains in batches covering several issues | Cadence is informational; no disbursement concept | §3 |

Not everything here should be built. Items 14 and 17 were deliberately scoped
out, and 16 was a conscious deferral. The list exists so those stay *decisions*
rather than things nobody noticed.

---

## 6. Action items

Plain-language list of what to ask and what to decide. Nothing here is a coding
task yet — each one needs an answer from the office or a call from the team
first.

### Ask Melinda / the office

1. **"When someone isn't a single person — a church, an apartment building, a
   couple who share a route — how do you want their name to appear?"**
   A third of their list is like this. Right now our system would force
   "Councillor Kandavel" into a first name and a last name. We need to know
   whether they think of these as people at all, or as places.

2. **"Is it OK if we don't have a phone number or email for someone?"**
   Four out of five people on their list have no phone on file. Our system
   currently refuses to add anyone without one. We should confirm they want to
   keep it that way rather than us blocking them.

3. **"Some captains get $50 or $15 for gas — how does that work?"**
   Is it every issue, every month, or once a year? Does someone covering for
   them get it instead? Our payment calculation has no place for it today, so
   those captains are being shown less than they're actually owed.

4. **"One captain's pay type is marked N/A — what does that mean?"**
   Do they take no payment at all, or is it just unrecorded? We can already
   handle "paid at a rate of zero", but "no arrangement" is a different thing.

5. **"You have a list of houses to skip. How should those work?"**
   Are they permanent, or do they come and go? This matters because we're
   about to start counting houses on a street automatically, and the automatic
   count has no way of knowing three houses on that street are opted out.

6. **"What kind of label sheets do you buy?"**
   The brand and product number. We need it to guarantee our printout lines up
   with the holes in their stock — and to decide whether to remove the cut
   lines we added, which are only useful if they're cutting plain paper.

7. **"Are schools, churches, libraries and hospitals just 'commercial' to you,
   or are they different?"**
   They're separate labels in the spreadsheet. If the distinction matters
   operationally we should keep it; if it's just descriptive, one category is
   simpler.

8. **"Roughly half your label list is below the print cut-off. Is that on
   purpose?"**
   The printout only covers the first ~220 rows and there are 468. Either the
   rest genuinely don't need labels, or some are quietly being missed every
   issue. Worth checking before we copy the behaviour.

9. **"Do you ever need to reprint labels for a past issue?"**
   We only support the current one. Cheap to add if they say yes, wasted effort
   if not.

10. **"When you hand a captain their bundles, how do you tell them about the
    unlabelled ones?"**
    Their sheet says "take 4 x 50s and 3 x 25s unlabelled" as a single line.
    Our screen lists every bundle separately, which may be more detail than is
    useful at the counter.

### Decide as a team

11. **How to store a recipient who isn't a person.** Depends on answer 1, and
    it's the single biggest change on this list — it touches how everyone is
    stored, searched and displayed. Worth agreeing before anyone starts.

12. **Whether contact details are required for new people but optional for
    imported ones.** That's a reasonable compromise and it's a small change,
    but it should be a deliberate choice rather than a side effect.

13. **Whether to import their history at all.** There are 434 people in their
    "quit" archive going back years, with reasons recorded inconsistently
    across half a dozen columns. Bringing that in is real work; leaving it
    behind loses their institutional memory. Someone should decide which.

14. **Whether the year's publication calendar should be entered up front.**
    They already know all ~22 issue dates for 2026. Our system makes them
    create issues one at a time. Entering the year in one go would save
    repeated work, but it's a new feature.

15. **What to do about the two captains and one route that are marked
    discontinued or away.** Their spreadsheet keeps them visible with a note.
    Ours would either hide them or leave them looking active.

### Already answered, no action needed

- What Carrier / Commercial / Residential mean — Kristen, 2026-08-23.
- Whether `Bundle N of M` is the right thing to print — confirmed by 150+ rows.
- Whether territory drops have a date — they do, but it's an added/removed
  date, not a delivery date.

---

## 7. Decisions taken 2026-08-24

Answers from the office plus team calls, against the numbered items above.
Everything here is settled; re-open it only with a reason.

| # | Question | Decision |
| --- | --- | --- |
| 1, 11 | Recipients who aren't one person | **`display_name` required; `first_name` / `last_name` become nullable** and are filled only for individuals, so surname sort and structured search survive. One Name box or two fields in the UI depending on what's being added. Handles all 462 rows without mangling any. |
| 2, 12 | Phone / email required | **Optional for everyone.** Blocking on a phone would block four in five of their roster. Not "optional on import only" — optional, full stop. |
| 3 | Car / gas allowance | **Not modelled.** See §2.3 — taken against what the file shows, deliberately. |
| 4 | `N/A` pay basis | **Rate `0`.** No fourth enum value; `pay_type` stays `bundle \| paper \| drop`. RT 18 is "No Captain" at rate 0, which this covers. |
| 6, 7 | Schools / churches / libraries / hospitals | **Stay "Commercial".** The finer keywords are descriptive, not operational. |
| 7 (gap) | Handling instructions | **The notes field**, not a new column. Only 5 rows carry one. |
| 9 (gap) | "Take 4 loose 50s and 3 loose 25s" | **Notes for now**, with a filter as a nice-to-have — see §3 and `label_printing_flow.md` §7. |
| 10 (gap) | Territory RT number | **Build it. RT hangs off the captain**, not the territory. Wally Hucker holding eight RTs is a known oddity we are choosing to ignore. |
| 11 (gap) | Reason someone left | **Not needed.** The bare `retired_at` date is enough; `Deceased` will not be modelled separately. |
| 12 (gap) | Retiring a route with reason + date | **Soft delete as-is** is fine. |
| 13 (gap) | When a drop was added / stopped | **Do not record.** |
| 16 (gap) | Reprint a past issue's labels | **Add it.** Currently the open issue only. |
| 5 | `SKIP HOUSES` | **Not modelled.** Skipped addresses go in the notes field like anything else. The knock-on — automated house counts overcounting a segment by the number of opted-out houses — is accepted: being one or two out on a route is not material to how the office works. |
| — | Label stock | **Confirmed real die-cut stock.** The cut guides are kept anyway (cheap on scored stock, useful on plain paper); only their dimensions were reconciled against the template. See `label_template_docx.md` §4. |
| — | Payout freeze | **Already complete** — `frozen_amount` + `frozen_at`, independent of `paid`, with issue lock as a bulk freeze. Nothing left on the backend. |

### Still genuinely open

1. **The label stock SKU.** The one thing needed to guarantee our grid lines up
   with the die cuts — the cell is a *pitch*, not the label face.
2. **Lucky Volunteer** (gap 14) — 39 rows still populated in the newer copy.
   Dropped as post-MVP; nobody has confirmed they're fine losing it.
3. **The publication calendar** (gap 15) — 23 issue dates for 2026 are already
   known; we still make them create issues one at a time.
4. **Importing `QUITS`** — 442 rows, no header row at all, columns drifting.
   Real manual work; nobody has decided whether it's worth it.
5. **Captains and routes marked discontinued or away** (`No Captain`,
   `NO PAY`, `DISCONTINUED 8.22.2023 AS PER SUSAN`). Their sheet keeps these
   visible with a note; ours would hide them or show them as active.
