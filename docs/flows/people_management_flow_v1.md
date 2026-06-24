# People Management Flow (v1)

A prose-and-diagram walkthrough of how the distribution manager manages the people in the system: volunteer carriers and captains. Diagrams are Mermaid so they render in Notion, GitHub, and most markdown viewers, and stay editable as text. This reuses the conventions established by `route_management_flow.md` (BM-12); read that first for the diagram legend rationale.

Ticket: BM-24. Scope: volunteer and captain profiles, their lifecycle (add, edit, vacation, retire), and the territory model (a captain's territory = its assigned volunteers + its commercial drop addresses).

Out of scope here and owned by other flows:
- Route assignment and route definition: route flow (BM-12). A route's captain is reached through its assigned volunteer.
- Payout calculation, the issue lifecycle, and reimbursement amounts: finances flow (BM-25). Reimbursements appear here read-only.
- Admin/staff accounts (the distribution and accounts managers): authentication flow.

---

## 1. Object overview

**Volunteer.** One of roughly 200 carriers who walk routes to deliver papers, often high-school students, so there is a steady churn of people joining and leaving. A volunteer record holds first and last name, a validated address, email, phone, free-form notes, an optional assigned captain, an optional vacation window, an optional end date, and the routes they currently carry (assigned in the route flow, shown read-only here). Created by the distribution manager only; volunteers do not log in. Status: Active, On vacation, or Retired.

**Captain.** One of the drivers who deliver bundles to volunteer houses and commercial drops. A captain record holds first and last name, contact info (phone and email), a pay structure (a pay type of per bundle / per paper / per drop, a rate, and a pay cadence), the one territory they own, free-form notes, and a read-only reimbursement history sourced from the finances flow. Status: Active or Retired.

**Territory.** A captain's coverage area, one-to-one with that captain. A territory holds two lists: its **assigned volunteers** and its **commercial drop addresses**. It does not contain routes. People Management manages a territory's contents here (the volunteer list, via captain assignment, and the commercial drops directly).

**Commercial drop.** A non-residential address that collects bundles from a captain (for example a building, school, church, or food-and-beverage spot), as opposed to a volunteer's home. Each commercial drop is a validated address belonging to one territory.

**Key relationships.**
- A captain is one-to-one with a territory. The territory has at most one captain; both can be temporarily unset during a handoff (see 4k).
- A territory holds a list of assigned volunteers and a list of commercial drop addresses. No routes.
- A volunteer is manually assigned to a captain. That assignment places the volunteer in the captain's territory: volunteer -> captain -> territory. A volunteer can be unassigned (no captain, and so in no territory) until the manager assigns one; reassigning them to a different captain moves them to that captain's territory.
- A volunteer carries zero or more routes (assigned in the route flow). A route's captain and territory are reached through its assigned volunteer: route -> volunteer -> captain -> territory.
- Retiring a person is a manual, soft action; the record and history are preserved for past issues and payouts. There is no automatic retirement. Retiring a volunteer detaches them from their routes, which become Vacant.

Status: volunteers run Active / On vacation / Retired; captains run Active / Retired. Vacation is the only date-driven automation that remains (a window that auto-applies and auto-resumes). Retirement is always a manual action; an end date passing never retires anyone on its own.

---

## 2. Diagram legend

Same conventions as the route management flow:
- Round / stadium shape = start or end of a flow
- Rectangle = an action or system step
- Diamond = a decision or branch
- Bracketed rectangle = a resulting state of the entity, e.g. `(Volunteer - Active)`

State diagrams use Mermaid stateDiagram-v2; flow diagrams use flowchart TD.

---

## 3. State machines

### 3a. Volunteer status

```mermaid
stateDiagram-v2
    [*] --> Active: Created
    Active --> OnVacation: Vacation window begins
    OnVacation --> Active: Vacation window ends
    Active --> Retired: Manual retire
    OnVacation --> Retired: Manual retire
    Retired --> Active: Reactivate (clear retirement)
```

**Active.** Current and carrying routes normally.

**On vacation.** Today falls within the volunteer's vacation window. Their route(s) are Suspended (see the route flow): not delivered for the affected issues, and not reassigned. The volunteer returns to Active automatically when the window ends. Vacation is the one piece of date-driven automation kept in this flow.

**Retired.** Set by a manual Retire action (soft; the record and history are preserved). There is no automatic retirement: an end date passing never moves a volunteer here. Retiring detaches the volunteer from their routes, which become Vacant (see 4f).

**End date is a planning flag, not a trigger.** A volunteer may carry an optional end date set ahead of time. If it passes while the volunteer is still active, the system raises a "needs attention" flag prompting the manager to retire them; it does not change status or touch routes on its own. This mirrors the route flow's attention flag.

### 3b. Captain status

```mermaid
stateDiagram-v2
    [*] --> Active: Created
    Active --> Retired: Manual retire
    Retired --> Active: Reactivate (clear retirement)
```

Captains have no vacation state today (see the note in 8 on planned captain vacation and substitution). Retirement is manual; an end date passing only raises a "needs attention" flag, never an auto-retire. Retiring a captain leaves their territory captain-less and prompts a reassignment (see 4k).

---

## 4. Flows

### 4a. Add a volunteer

```mermaid
flowchart TD
    Start([Add volunteer button]) --> Name[Enter first name and last name]
    Name --> Addr[Enter address]
    Addr --> Valid{Address validates?}
    Valid -->|No| Addr
    Valid -->|Yes| Contact[Enter email and phone]
    Contact --> Cap[Optional - assign a captain]
    Cap --> Notes[Optional - notes]
    Notes --> Dates[Set start date, optional end date]
    Dates --> Save[Save]
    Save --> Active[(Volunteer - Active)]
```

Entry: Add volunteer button on the volunteers list. First name and last name are separate fields. The address runs through Address Validation, the same as routes; the form holds the manager on the field until it validates. Assigning a captain is optional and places the volunteer in that captain's territory; leaving it empty creates an unassigned volunteer who can be assigned later.

Routes are not assigned here. A new volunteer usually starts with none; they are later matched to nearby vacant routes and assigned **manually** in the route flow. There is no automatic assignment, the manager picks the route there. The volunteer is Active on save.

### 4b. View the volunteers list

Data view, not a state change. Entry: People nav, Volunteers tab.

Columns: name, route(s) carried, assigned captain (and that captain's territory), and status (Active / On vacation / Retired). Controls: search, filter (by captain, territory, status, has-route, needs-attention), CSV export (see 5), and Add volunteer. Surface a "needs attention" flag when a volunteer's end date has passed but they are not yet retired. Default content: active volunteers. Selecting a row opens the detail panel (4c). A multi-select column slot is reserved for future bulk operations (see 6).

### 4c. View volunteer detail

Data view, shown in a right-hand panel. Shows first and last name, contact info (address, email, phone), start date and optional end date, the assigned captain and that captain's territory, the routes carried (read-only, linking into route detail), the vacation window if any, notes, status, and a "needs attention" flag if the end date has passed. Actions: Edit, Put on vacation, Retire.

### 4d. Edit a volunteer

```mermaid
flowchart TD
    Start([Edit on volunteer detail]) --> Field{What changed?}
    Field -->|Name, captain, notes, dates| Save[Save]
    Field -->|Address| Revalidate{Address validates?}
    Revalidate -->|No| Start
    Revalidate -->|Yes| Save
    Save --> Done[(Volunteer updated)]
```

Editable: first name, last name, address (re-validates on change), email, phone, notes, assigned captain, start and end dates. Changing the assigned captain moves the volunteer into the new captain's territory immediately (and out of the old one). Clearing the captain leaves the volunteer unassigned. Route assignments are not edited here; they live in the route flow.

### 4e. Put a volunteer on vacation

```mermaid
flowchart TD
    Start([Put on vacation, from detail]) --> Range[Set vacation start and end]
    Range --> Save[Save]
    Save --> Check{Window active now?}
    Check -->|Yes| OnVac[(Volunteer - On vacation)]
    Check -->|No| Scheduled[(Vacation scheduled)]
    OnVac --> Suspend[Carried routes show Suspended]
    OnVac --> Resume[Auto-return to Active when window ends]
    Scheduled --> Later[Routes suspend when the window begins]
```

The manager sets a start and end date for the vacation. While today is within the window, the volunteer is On vacation and their route(s) are Suspended: not delivered for the affected issues, and not reassigned. When the window ends, the volunteer returns to Active and the route resumes. Vacation is intentionally the one date-driven automation kept here. The skipped delivery and any pay effect are recorded in the delivery and finances flow, not here. Editing or clearing the window is done the same way.

### 4f. Retire a volunteer (manual)

```mermaid
flowchart TD
    Start([Retire on volunteer detail]) --> Confirm[Confirm]
    Confirm --> Process[Process retirement, soft]
    Process --> Retired[(Volunteer - Retired)]
    Process --> Detach[Detach volunteer from each carried route]
    Detach --> Vacant[(Each carried route becomes Vacant)]
```

Retirement is a manual action only; there is no automatic retirement when an end date passes. Retiring is soft: the record and all past delivery history are preserved. On retirement the volunteer is detached from every route they carried, and each of those routes becomes Vacant in the route flow.

Separately, if a volunteer has a future end date and it passes while they are still active, the system raises a "needs attention" flag on the volunteer, prompting a manual retire. It does not retire them or touch their routes automatically.

### 4g. Add a captain

```mermaid
flowchart TD
    Start([Add captain button]) --> Name[Enter first name and last name]
    Name --> Contact[Enter phone and email]
    Contact --> Pay[Set pay type, rate, cadence]
    Pay --> Notes[Optional - notes]
    Notes --> Dates[Set start date, optional end date]
    Dates --> Save[Save]
    Save --> Active[(Captain - Active)]
```

Entry: Add captain button on the captains list. First and last name are separate fields; contact is a phone number and an email. Every captain gets a pay structure set: pay type (per bundle / per paper / per drop), a rate, and a pay cadence. There is no captain address. There is no separate "establish a territory" step: a captain is one-to-one with a territory, which is reached in operation via volunteer -> captain -> territory, and a territory's contents are filled in afterward (assigned volunteers via captain assignment in 4a and 4d, and commercial drops in 4l).

### 4h. View the captains list

Data view. Entry: People nav, Captains tab.

Columns: name, territory, pay type, rate, and cadence, plus status. Controls: search, filter, CSV export, and Add captain. Surface a "needs attention" flag when a captain's end date has passed but they are not yet retired. Selecting a row opens the detail panel (4i).

### 4i. View captain detail

Data view, right-hand panel. Shows first and last name, contact info (phone and email), start date and optional end date, the owned territory with its assigned-volunteer list and its commercial drop addresses, the editable pay structure (pay type, rate, cadence), the reimbursement history (read-only, sourced from the finances flow), notes, status, and a "needs attention" flag if the end date has passed. Actions: Edit, Retire, and Manage commercial drops (4l).

Routes are not shown here as territory contents (routes are not part of a territory); a captain's delivery scope is the volunteers and commercial drops in their territory.

### 4j. Edit a captain

```mermaid
flowchart TD
    Start([Edit on captain detail]) --> Field{What changed?}
    Field -->|Name, contact, notes, dates| Save[Save]
    Field -->|Pay type, rate, cadence| SavePay[Save]
    Save --> Done[(Captain updated)]
    SavePay --> NoRetro[(Closed payouts unchanged)]
```

Editable: first name, last name, contact (phone and email), pay type, rate, cadence, and start and end dates. There is no captain address. Changing the pay structure does not change any already-closed payout: closed payouts are frozen snapshots, owned by the finances flow. The territory's contents are managed elsewhere: its volunteer list through volunteer-to-captain assignment (4a, 4d), and its commercial drops through 4l.

### 4k. Retire a captain (manual)

```mermaid
flowchart TD
    Start([Retire on captain detail]) --> Confirm[Confirm]
    Confirm --> Process[Process retirement, soft]
    Process --> Retired[(Captain - Retired)]
    Process --> Orphan[Owned territory becomes captain-less]
    Orphan --> Prompt[Prompt to reassign the territory]
    Prompt --> Reassign{Reassign now?}
    Reassign -->|Yes| NewCap[Territory, its volunteers and commercial drops move to a new captain]
    Reassign -->|Later| Pending[(Territory - captain-less)]
```

Manual only; there is no automatic retirement when an end date passes. Retiring is soft; history is preserved. The captain's territory, with its volunteers and commercial drops, becomes captain-less, and the manager is prompted to assign a replacement now or later. Until a new captain is set, that territory has no owner and its payouts have no captain. When reassigned, the whole territory moves to the new captain, so every volunteer in it is now under the new captain. A future end date that passes only raises a "needs attention" flag; pay-structure changes never touch closed payouts.

### 4l. Manage a territory's commercial drops

```mermaid
flowchart TD
    Start([Captain detail - commercial drops]) --> Action{Pick action}
    Action -->|Add| Add[Enter commercial drop address]
    Add --> Valid{Address validates?}
    Valid -->|No| Add
    Valid -->|Yes| SaveAdd[Add to the territory]
    Action -->|Edit| EditDrop[Edit an existing drop]
    Action -->|Remove| RemoveDrop[Remove a drop]
    SaveAdd --> Done([Territory updated])
    EditDrop --> Done
    RemoveDrop --> Done
```

Commercial drops are the non-residential addresses where a captain drops bundles. They are added, edited, validated, and removed within a captain's territory here. Each drop is one validated address belonging to one territory. The territory's volunteer list, by contrast, is managed through volunteer-to-captain assignment (4a, 4d), not here.

---

## 5. CSV export

Both lists export to CSV for offline use and parity with the spreadsheet. The export reflects the current filters and the visible columns: for volunteers, first name, last name, address, email, phone, assigned captain, territory, status; for captains, first name, last name, phone, email, territory, pay type, rate, cadence, status. Export is read-only and changes nothing.

---

## 6. Side feature: bulk operations (post-MVP)

```mermaid
flowchart TD
    Start([People list view]) --> Multi[Multi-select via checkboxes]
    Multi --> Action{Pick bulk action}
    Action -->|Retire| Retire[Bulk retire]
    Action -->|Reassign captain| Reassign[Bulk reassign volunteers to a captain]
    Retire --> ConfirmR[Confirm with summary]
    Reassign --> PickC[Pick destination captain]
    PickC --> ConfirmR
    ConfirmR --> Apply[Apply to all selected]
    Apply --> Done([Done])
```

Highest-value bulk actions for later: bulk retire at a season changeover, and bulk-reassigning a set of volunteers to a different captain, which moves them into that captain's territory (for example when a captain leaves or a territory is rebalanced). The initial spreadsheet migration is a one-time developer-side data load, not a UI feature for MVP. As in the route list, reserve the checkbox column slot in the people lists now so these can be added later without a layout rework.

---

## 7. State transition quick reference

**Volunteer.**
- (none) -> Active: created
- Active -> On vacation: vacation window begins (auto); carried routes show Suspended
- On vacation -> Active: vacation window ends (auto); routes resume
- Active or On vacation -> Retired: manual retire only; the volunteer is detached from their carried routes, which become Vacant
- Retired -> Active: clear the retirement

**Captain.**
- (none) -> Active: created
- Active -> Retired: manual retire only; owned territory becomes captain-less and prompts reassignment
- Retired -> Active: clear the retirement

Flags (not state changes): a person whose end date has passed while still active is flagged "needs attention," prompting a manual retire. No end date ever retires a person automatically. A volunteer's territory is determined by their assigned captain; changing the captain moves the volunteer between territories.

---

## 8. Edge cases and open questions

- **Address validation fails.** Save is blocked and the manager is held on the address field; no partial record is persisted. Applies to volunteer and commercial drop addresses (captains have no address).
- **End date passes.** Never auto-retires and never touches routes. It raises a "needs attention" flag on the person; the manager retires manually.
- **Retiring a volunteer.** Detaches the volunteer from every route they carried; each of those routes becomes Vacant in the route flow.
- **Captain-less territory.** Allowed as a transient state after a captain retires. The territory keeps its volunteers and commercial drops until a new captain is assigned.
- **Unassigned volunteer.** A volunteer can have no captain, and therefore be in no territory, until the manager assigns one.
- **Vacation.** The one retained date automation: a vacation window auto-suspends the route and auto-resumes after.
- **Captain vacation and substitution (decided).** Captains have no vacation state — status stays Active / Retired. A captain being away is handled by substitution, which is finance-only: per issue, the payout is reassigned to a substitute (an existing captain or a temporary one created here with a zero rate and empty territory) and the original is zeroed for that issue. Routes and territory are not changed by a substitution. See the finance flow (captain substitution).
- **A person who is both volunteer and captain.** Modeled as two separate records; there is no shared person entity in MVP.
- **No unscoped messaging.** The confirmations, the reassignment prompt, and the "needs attention" flag in these flows are explicit, scoped indicators requested here. Per the product rule, do not add other notifications, badges, or banners unless a spec calls for one.
- **Substitution and volunteer credit.** Volunteer-level substitution (someone other than the assigned carrier delivers a route) is captured on the delivery record (finances and delivery flow), not on the volunteer. The per-volunteer advertising credit is post-MVP and not part of this flow.
