# People Management Flow (v1)

> Status: SKELETON. Structure only; full draft to follow next. Format mirrors `route_management_flow_v2.md` (BM-12).

Ticket: BM-24. Scope: volunteer and captain profiles and lifecycle (add, edit, retire), and their relationships (volunteer to route, volunteer to territory, captain to territory, captain pay structure). Out of scope here: route assignment mechanics (route management flow), payout calculation and issue close (finances flow, BM-25), and admin/staff account management.

---

## 1. Object overview
- [ ] Volunteer: fields, who creates them, active/inactive derived from start/end dates, relationships (routes, territory).
- [ ] Captain: fields, pay structure (type + rate), invoices-externally flag, owned territory, payout history.
- [ ] Key relationships: volunteer to territory, volunteer to routes, captain to territory.

## 2. Diagram legend
- [ ] Reuse the route flow legend (stadium = start/end, rectangle = step, diamond = decision, bracketed = state).

## 3. Status state machine
- [ ] Active / Inactive, derived from dates (one machine, shared by volunteers and captains). `stateDiagram-v2` to be added.

## 4. Flows
- [ ] 4a Add a volunteer
- [ ] 4b View the volunteers list
- [ ] 4c View volunteer detail
- [ ] 4d Edit and retire a volunteer (retire releases routes to Vacant)
- [ ] 4e Add a captain
- [ ] 4f Edit and retire a captain (retire prompts territory reassignment)

## 5. Side feature: bulk operations (post-MVP)
- [ ] Bulk volunteer import (spreadsheet migration), bulk retire, reassign a departing captain's territory.

## 6. State transition quick reference
- [ ] Volunteer and captain status transitions plus side effects.

## 7. Edge cases and open questions
- [ ] Address validation failure, retroactive end date, retire mid-issue, duplicate people, where substitution lives.
- [ ] OPEN: one captain owns one territory vs many. PRD says one; source material mentions covering a departed captain. Confirm with client.
