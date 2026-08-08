# Finances wiring — the six questions, answered

The finances and overview screens were wired with six places encoding an assumption
about how the office works. Design has now answered all six. This file records what
was asked, what came back, and what changed in response.

**Five of six confirmed the assumption**, so most of this was deleting `PENDING(Qn)`
markers rather than rewriting logic. Two things did change: transfer is gone, and
closing an issue now settles its payments.

| | Question | Answer | Result |
| --- | --- | --- | --- |
| Q1 | What does locking an issue mean? | The numbers are settled, not "everyone was paid" | As built |
| Q2 | Can you mark paid before the issue closes? | Yes, no rules — **but closed means no more edits** | Gate added |
| Q3 | Can you untick paid? | No, paid is final and that is deliberate | Dead hook removed |
| Q4 | Is a cell comment separate from the override reason? | Two different things, keep both | As built |
| Q6 | Can one person cover several captains? | Yes. How to show it is still with design | As built |
| Q7 | Is moving a payment still a thing? | Covering replaced it, drop it | **Deleted** |

---

## Q1 — Locking settles the numbers

> "these numbers are settled, stop them changing if someone edits a route later"

Confirmed as built, including the issue-level lock being the better model. Locking
is not a claim that anyone has been paid.

Still implemented as a bulk freeze over the per-cell `freeze`/`unfreeze`, so the
per-captain endpoints stay available underneath if that is ever wanted.

---

## Q2 — Tick paid whenever, but closing settles everything

Two halves, and the second one was new information:

> "tick it whenever, no rules"
> "the typical flow would be mark everyone as paid, then close the issue. But once
> an issue is closed/archived, we don't allow edits to payments."

The first half confirmed removing the old "must be closed first" gate. The second
half is the same ordering rule enforced from the opposite end, and **it was not
implemented** — nothing checked issue status on any payout mutation.

Added `assertIssueEditable` in `lib/services/issues.ts`, called by every payout
mutation and by lock/unlock. A closed issue, or an issue in an archived year,
refuses:

`override`, `clear-override`, `mark-paid`, `unmark-paid`, `freeze`, `unfreeze`,
`substitute`, `clear-substitute`, `comment`, and issue `lock`/`unlock`.

**This reverses an older locked decision.** The rule used to be "an unpaid cell is
editable whether the issue is Open or Closed". It is now "a closed issue is
settled". `POST /api/issues/{id}/reopen` is the supported correction, so a run
closed too early is not a dead end.

Worth knowing: the comment field is covered by the guard too. A comment does not
move any money, so it could reasonably stay editable after close — "closed means
frozen" was chosen because it is easier to explain than a partial rule. One line to
change if the office wants to annotate settled issues.

---

## Q3 — Paid is final

> "that's on purpose, paid is final"

Confirmed. Removed `useUnmarkPaid` from `features/finances/api.ts`, which was
exported but rendered nowhere.

`POST /api/payouts/{id}/unmark-paid` is **kept** as an admin correction for a
mis-tick, because the alternative to a wrong click is editing the database by hand.
It is documented as not-for-UI: wiring it up would make "final" untrue. It is now
also subject to the Q2 guard, so it cannot resurrect a closed issue's payment.

---

## Q4 — A comment and an override reason are different things

> "Both appear in the popover, but are separate things. It's correct that the
> comment is just a general heads up related to a specific payment, not tied to
> changing a number"

Confirmed as built, including the reasoning that a comment must survive on a cell
that was never overridden. The `comment` column stays. An integration test pins
that clearing an override leaves the comment alone.

`20260805000000_payout_comment_settled.sql` corrects the column's own comment,
which had been written as PROVISIONAL.

---

## Q6 — One person can cover several captains

> "they can cover for a few different people, nothing made for it yet"
> "I'm going to explore what this looks like in figma and get back to you"

The backend behaviour is confirmed: nothing caps it, and the overview lists every
covered captain rather than dropping any past the first.

**Still open, and the only open item left:** how the grid should *show* one person
covering several captains. A row has space for one covered name today. No backend
work is expected either way — this is a layout question.

---

## Q7 — Transfer is gone

> "covering replaced it, drop the other one"

Deleted, not left dormant:

- `app/api/payouts/[id]/transfer/route.ts`
- `transferPayoutAmount` in `lib/services/payouts.ts`
- `transferPayout` in `lib/validation/finance.ts`
- its integration test in `tests/integration/backend.integration.test.ts`

Recording a substitute is the one way to say someone covered an issue. It keeps the
cell on its own captain and re-attributes the payment, which is what makes
substitute pay totallable — transfer moved money between cells and left free text,
so it could not be aggregated.

**The product specs still describe transfer as a live feature** and were left alone,
since rewriting them is a product-owner call rather than a wiring change. Stale
references: `docs/flows/finances_flow.md` (§4g and the state-model notes),
`docs/product/beach_metro_PRD.md`, `docs/flows/people_management_flow.md` (captain
vacation is described as being handled by transfer).

---

## Not questions, but decided here

Two things the design has no field for, unchanged and still worth confirming:

- **A new finance table's start date** — first of the current month.
- **A new issue's date** — today.

Both silently decide which quarter things land in on the overview. Both are in
`app/(dashboard)/finances/page.tsx` (`handleCreateTable`, `commitDraftIssue`).
