# Finances Flow (v1)

> Status: SKELETON. Structure only; full draft to follow. Format mirrors `route_management_flow_v2.md` (BM-12).

Ticket: BM-25. Scope: issues (publication runs), per-issue delivery recording, captain payout calculation and adjustment, marking payouts paid/unpaid, closing an issue (locks payouts as snapshots), and historic financial data. Out of scope here: people profiles (people management flow, BM-24) and route definition (route management flow, BM-12).

---

## 1. Object overview
- [ ] Issue: a publication run with an open/closed lifecycle.
- [ ] RouteDelivery: per-route, per-issue actuals (assigned vs completed bundles, papers, drops, missed drops, substitute deliverer).
- [ ] CaptainPayout: per-captain, per-issue; snapshots pay type, rate, quantities, and amount; locks on issue close.

## 2. Diagram legend
- [ ] Reuse the route flow legend.

## 3. State machines
- [ ] Issue lifecycle: Open -> Closed (closing locks all child payouts). `stateDiagram-v2` to be added.
- [ ] Payout status: Unpaid <-> Paid; editable vs Locked, driven by issue state.

## 4. Flows
- [ ] 4a Open an issue
- [ ] 4b Record deliveries for an issue (bundles, papers, drops, missed, substitute)
- [ ] 4c Review and adjust captain payouts (auto-calc from territory + delivery data, manual override)
- [ ] 4d Mark a payout paid / unpaid
- [ ] 4e Close an issue (freezes payout snapshots; replaces the spreadsheet's annual reset)
- [ ] 4f View historic / annual financial data

## 5. Side feature (post-MVP)
- [ ] Aggregating multiple issues into one disbursement (pay-period rollups).

## 6. State transition quick reference
- [ ] Issue: (none) -> Open -> Closed. Payout: Unpaid <-> Paid; editable -> Locked on issue close.

## 7. Edge cases and open questions
- [ ] Captains who invoice externally: store the payout, do not compute the amount.
- [ ] Missed drops deducted from pay; substitution still pays the territory's captain.
- [ ] OPEN: legacy payment formulas are partly unknown; validate against the accounts manager's actual process before locking the math.
