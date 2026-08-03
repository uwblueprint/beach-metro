# Finances wiring — decisions still with design

The finances and overview screens are wired to the real API. Six places encode an
assumption about how the office works that design has not confirmed yet.

**The rule applied everywhere below: where the design and the backend disagreed, the
design won.** The design engineers are closer to how the office actually works, so
the backend bent to match rather than the other way round. Each entry records what
was assumed, what it cost, and exactly what to change when the answer lands.

Every spot is also marked in code as `PENDING(Qn)`, so `grep -rn "PENDING(Q1)"`
finds every site for a given question.

| | Question | Assumed | Cost to reverse |
| --- | --- | --- | --- |
| Q1 | What does locking an issue mean? | One lock per issue, as a bulk freeze | Low |
| Q2 | Can you mark paid before the issue closes? | Yes, no gate | Low |
| Q3 | Can you untick paid? | UI does not offer it; endpoint exists | Low |
| Q4 | Is a cell comment separate from the override reason? | Separate, own column | Medium (migration) |
| Q6 | Can one person cover several captains? | Yes, not capped | None |
| Q7 | Is moving a payment still a thing? | Replaced by substitutes, not wired | None |

---

## Q1. What does locking an issue mean?

**Design:** one lock button per issue row, toggling the whole row.
**Backend before:** freezing was per payout cell (finance flow §3b).

**Assumed:** the design is right and the office settles a whole run at once on
bundling day. Implemented as a **bulk action over the existing per-cell freeze**
rather than a new `locked` column on the issue, so nothing is thrown away if the
answer turns out to be per captain after all.

Locking freezes every unpaid cell in the issue. Paid cells are skipped rather than
erroring, because paid already blocks every edit, so they are locked by definition.
The issue's `locked` flag on the grid is derived: every cell is paid or frozen, and
there is at least one.

- `lib/services/issues.ts` — `lockIssue`, `unlockIssue`
- `app/api/issues/[id]/lock/route.ts`, `.../unlock/route.ts`
- `lib/services/financial-years.ts` — the derived `locked` on `YearDetail`
- `features/finances/api.ts` — `useToggleIssueLock`
- `app/(dashboard)/finances/page.tsx` — `toggleIssueLock`

**If the answer is (b) "we have paid everyone":** locking should call mark-paid on
every cell instead of freezing, and the lock icon becomes a view of `paid`.
**If (d) per captain after all:** stop calling the bulk endpoints and point the UI
at `POST /api/payouts/{id}/freeze`, which still exists and is still tested.

---

## Q2. Can you mark paid before the issue is wrapped up?

**Design:** tick paid whenever.
**Backend before:** `markPayoutPaid` threw 409 unless the issue was Closed, from an
early locked decision ("Paid/unpaid cannot be toggled while an issue is Open").

**Assumed:** the design is right and the gate was invented. **Removed the check.**
Without this the UI would have offered a button that fails on click for every open
issue, which is the worst of both.

- `lib/services/payouts.ts` — `markPayoutPaid`, the removed check is in the doc
  comment ready to paste back
- `tests/integration/finances.integration.test.ts` — "is allowed while the issue is
  still open" flips to expecting a 409

Everything else about paid is unchanged: it still locks the cell against override,
freeze, substitute and transfer, and it still refuses to pay twice.

---

## Q3. Can you untick paid?

**Design:** the tick is one way. No untick anywhere.
**Backend:** `POST /api/payouts/{id}/unmark-paid` exists and works.

**Assumed:** the design reflects intent, so nothing renders an untick. The mutation
is wired up and exported (`useUnmarkPaid`) but unused, so surfacing it is a UI change
only, no backend work.

**Worth flagging regardless of the answer:** an accidental tick currently needs a
database edit to undo. Same shape as the retire-with-no-reactivate problem on the
members page.

- `features/finances/api.ts` — `useUnmarkPaid`, wired, not rendered

---

## Q4. Is a cell comment separate from the override reason?

**Design:** a cell has both a comment ("Captain switching to monthly") and, when you
change an amount, a separate note explaining the change.
**Backend before:** only `override_reason`, which is required whenever an override
is set and cleared when the override is cleared.

**Assumed:** they are two different things, so **added a `comment` column**. The
deciding argument: a comment has to survive on a cell that was never overridden, and
clearing an override must not silently delete a note the office left itself. An
integration test pins exactly that.

This is the only entry with a migration, so it is the most expensive to reverse.

- `supabase/migrations/20260803000000_payout_comment.sql`
- `lib/services/payouts.ts` — `setPayoutComment`
- `app/api/payouts/[id]/comment/route.ts`
- `lib/validation/finance.ts` — `setPayoutComment`
- `features/finances/api.ts` — `useSetCellComment`

**If the answer is (b) "same thing":** drop the column, point the comment field at
`override_reason`, and delete the endpoint. The UI change is one prop.

---

## Q6. Can one person cover several captains in the same stretch?

**Design:** one covered captain per line in the overview's substitute list.
**Backend:** already supports one person covering many, and the overview groups
`coveredFor` as an array.

**Assumed:** the design's single name is a layout simplification, not a rule, so
**nothing caps it**. The overview lists every covered captain joined by commas
rather than silently dropping any past the first.

- `lib/services/overview.ts` — `substitutePayments[].coveredFor`
- `app/(dashboard)/overview/page.tsx` — the joined list
- `features/finances/api.ts` — `useSetSubstitute`

**If the answer is (a) one only:** add a check in `setPayoutSubstitute` rejecting a
second distinct covered captain in the same period. No schema change either way.

---

## Q7. Is moving a payment to another captain still a thing?

**Design:** absent. Recording a substitute replaced it.
**Backend:** `POST /api/payouts/{id}/transfer` exists, is tested, and works.

**Assumed:** covering replaced it, so transfer is **deliberately not wired**. It is
left in place rather than deleted, because the finance flow still describes it as
the tool for genuine money reallocation, which is a different thing from someone
covering a shift.

- `features/finances/api.ts` — the commented hook point, with the exact call

**If the answer is (b) still needed:** the design needs a control for it first;
the endpoint needs no work.

---

## Not a question, but decided here

Two things the design has no field for, where the wiring had to pick something:

- **A new finance table's start date.** The dialog only asks for a name, but the
  start date fixes the reporting quarters. New tables start on the **first of the
  current month**, which is the least surprising reading of "I am starting a year
  now". If the office wants a specific month the dialog needs a date field.
- **A new issue's date.** The inline draft row only takes a name, so a new issue is
  **dated today**. That decides which quarter it lands in on the overview.

Both are in `app/(dashboard)/finances/page.tsx` (`handleCreateTable`,
`commitDraftIssue`) and worth confirming, since they are silently load-bearing for
the overview's quarter filters.
