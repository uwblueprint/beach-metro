# RouteLabelsFileBMN.xlsx — what the office's spreadsheet actually contains

Read 2026-08-23 from `RouteLabelsFileBMN (2).xlsx`, the live workbook Melinda
runs distribution from. This is the system we are replacing, so where it and our
schema disagree, **it is the source of truth about how the office works** and we
are the thing that is wrong.

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

Needs a client answer on semantics before building: per issue, per month, or a
flat annual? Does it survive a substitute covering that issue?

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

### 2.7 Substitutes are real but almost never used

`AWAY BUNDLES` / `AWAY PAPERS` exist on every Payments sheet. Populated rows,
2020 → 2026: **0, 1, 0, 0, 0, 0, 0.** Once in seven years.

Not an argument to remove the feature — the client explicitly asked for it in the
July 2026 review and it is a locked decision. It is an argument against
investing further in substitute UX until someone asks.

### 2.8 Fields we dropped that they still use

- **`Lucky Volunteer`** — populated on 38 rows. We dropped
  `Volunteer.LuckyVolunteerDate` as post-MVP volunteer credit. Still in use.
- **Free-text handling instructions** — `LABELS.Bundles` carries `N of M` on
  carrier rows, but on bulk-drop rows it holds instructions instead:
  `Tie Loosely`, `Open and leave in lobby`, `Leave close to door`,
  `Give to Hope`. All five occurrences are on `BUILDING` or `BUSINESS` rows,
  never a carrier row. This is the `VolunteerInstruction` placeholder we
  deferred, and it is a per-drop field, not a per-volunteer one.

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

## 5. Suggested priority

1. **The name model (§2.1)** — blocks any data import, and the fix is invasive.
2. **Optional contact details (§2.2)** — same blocker, much smaller fix.
3. **Car allowance (§2.3)** — real money, currently wrong.
4. **Skip houses (§2.6)** — decide before automated house counts ship (#23).
5. **Label stock SKU (§4)** — cheap to confirm, and our cut guides may be wrong.
6. **Finer type taxonomy (§3)** — confirm whether SCHOOL/CHURCH/LIBRARY/HOSPITAL
   collapse into Commercial or need their own values.
