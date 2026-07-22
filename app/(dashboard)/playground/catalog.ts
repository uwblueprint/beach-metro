// TEMPORARY PAGE — the declarative endpoint catalog the playground renders from.
// Each entry describes one endpoint: what it does in plain English, its
// TypeScript-ish request/response shape, and the form fields that build the
// request. Delete this folder (plus app/api/playground and the sidebar link)
// when the real screens exist.

/** How a form value is collected and where it lands in the request. */
export interface FieldSpec {
  /** Dot-path into the JSON body ("address.addressLines.0"), query ("?q") via in:"query", or path token via in:"path". */
  path: string;
  label: string;
  in?: "body" | "query" | "path"; // default body
  kind: "text" | "number" | "date" | "boolean" | "select" | "ref" | "bundles";
  required?: boolean;
  placeholder?: string;
  /** Prefilled example value. */
  example?: string | number | boolean;
  /** For kind "select". */
  options?: string[];
  /** For kind "ref": which list endpoint provides options. */
  ref?: "volunteers" | "captains" | "territories" | "routes" | "financial-years";
  help?: string;
}

export interface EndpointSpec {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path template with {tokens} matching path-fields. */
  path: string;
  title: string;
  description: string;
  /** Compact TS-ish request/response shapes shown on the card. */
  requestShape?: string;
  responseShape: string;
  fields: FieldSpec[];
  /** Rules a 409/422 will surface — shown as a hint. */
  rules?: string;
}

export interface ResourceSection {
  id: string;
  title: string;
  blurb: string;
  endpoints: EndpointSpec[];
}

// Stable seed ids (supabase/seed.sql) used as working examples.
export const SEED = {
  emily: "c0000000-0000-4000-8000-000000000001", // captain, per-bundle $1.25
  oliver: "c0000000-0000-4000-8000-000000000002", // captain, per-drop $2.00
  maya: "c0000000-0000-4000-8000-000000000003", // captain, zero-rate
  emilyTerritory: "a0000000-0000-4000-8000-000000000001",
  marcus: "d0000000-0000-4000-8000-000000000001", // volunteer, carries 2 routes
  aisha: "d0000000-0000-4000-8000-000000000003", // volunteer on vacation
  queenStRoute: "e0000000-0000-4000-8000-000000000001", // assigned to Marcus, 70 papers
  beechAveRoute: "e0000000-0000-4000-8000-000000000004", // vacant
  willowAveRoute: "e0000000-0000-4000-8000-000000000005", // vacant, 130 papers
  year: "f0000000-0000-4000-8000-000000000001", // "2026–2027"
};

const idField = (label: string, ref: FieldSpec["ref"], example?: string): FieldSpec => ({
  path: "id",
  in: "path",
  label,
  kind: ref ? "ref" : "text",
  ref,
  required: true,
  example,
});

const pastedIdField = (label: string, help: string): FieldSpec => ({
  path: "id",
  in: "path",
  label,
  kind: "text",
  required: true,
  placeholder: "paste a UUID",
  help,
});

export const CATALOG: ResourceSection[] = [
  {
    id: "volunteers",
    title: "Volunteers",
    blurb:
      "The ~200 carriers who walk routes. Status (Active / On vacation / Retired) is derived from dates, never stored.",
    endpoints: [
      {
        id: "volunteers.list",
        method: "GET",
        path: "/api/volunteers",
        title: "List volunteers",
        description:
          "Everyone, with derived status, needs-attention flag, territory and the routes they carry. Filters are optional.",
        responseShape:
          "{ data: Array<{ id, firstName, lastName, email, phone, status, needsAttention, territory: { id, captainName } | null, routesCarried: Array<{ id, streetName }> }> }",
        fields: [
          {
            path: "status",
            in: "query",
            label: "Status",
            kind: "select",
            options: ["", "active", "on-vacation", "retired"],
          },
          { path: "needsAttention", in: "query", label: "Needs attention only", kind: "boolean" },
          { path: "hasRoute", in: "query", label: "Has a route", kind: "boolean" },
          { path: "q", in: "query", label: "Search", kind: "text", placeholder: "name or email" },
        ],
      },
      {
        id: "volunteers.get",
        method: "GET",
        path: "/api/volunteers/{id}",
        title: "Volunteer detail",
        description: "One volunteer, including their validated home address.",
        responseShape: "{ data: Volunteer & { address: { formattedAddress, placeId } } }",
        fields: [idField("Volunteer", "volunteers", SEED.marcus)],
      },
      {
        id: "volunteers.create",
        method: "POST",
        path: "/api/volunteers",
        title: "Create volunteer",
        description:
          "Adds a carrier. The address is validated through the Maps provider (a deterministic fake until Google keys exist) and stored as place_id + cached coordinates.",
        requestShape:
          "{ firstName, lastName, email, phone, address: { addressLines: string[] }, captainTerritoryId?, startDate, endDate?, note? }",
        responseShape: "{ data: Volunteer } (201)",
        fields: [
          { path: "firstName", label: "First name", kind: "text", required: true, example: "Test" },
          {
            path: "lastName",
            label: "Last name",
            kind: "text",
            required: true,
            example: "Volunteer",
          },
          {
            path: "email",
            label: "Email",
            kind: "text",
            required: true,
            example: "test.volunteer@example.com",
          },
          { path: "phone", label: "Phone", kind: "text", required: true, example: "416-555-0199" },
          {
            path: "address.addressLines.0",
            label: "Street address",
            kind: "text",
            required: true,
            example: "77 Playground Ave",
          },
          {
            path: "captainTerritoryId",
            label: "Territory (optional)",
            kind: "ref",
            ref: "territories",
          },
          {
            path: "startDate",
            label: "Start date",
            kind: "date",
            required: true,
            example: "2026-07-14",
          },
          { path: "note", label: "Note (optional)", kind: "text" },
        ],
      },
      {
        id: "volunteers.vacation",
        method: "POST",
        path: "/api/volunteers/{id}/vacation",
        title: "Set vacation window",
        description:
          "The one date-driven automation: while today is inside the window the volunteer reads On-vacation and their routes derive as Suspended. Auto-resumes when it ends.",
        requestShape: "{ vacationStart, vacationEnd }  |  { clear: true }",
        responseShape: "{ data: Volunteer }",
        rules: "vacationStart must be on or before vacationEnd (422).",
        fields: [
          idField("Volunteer", "volunteers", SEED.marcus),
          {
            path: "vacationStart",
            label: "Vacation start",
            kind: "date",
            required: true,
            example: "2026-07-10",
          },
          {
            path: "vacationEnd",
            label: "Vacation end",
            kind: "date",
            required: true,
            example: "2026-07-21",
          },
        ],
      },
      {
        id: "volunteers.retire",
        method: "POST",
        path: "/api/volunteers/{id}/retire",
        title: "Retire volunteer",
        description:
          "Soft retire (record kept for history). Their routes are detached and become Vacant immediately.",
        responseShape: "{ data: Volunteer }",
        rules: "Retiring an already-retired volunteer is a 409.",
        fields: [idField("Volunteer", "volunteers")],
      },
    ],
  },
  {
    id: "captains",
    title: "Captains",
    blurb:
      "The drivers who deliver bundles. Pay config lives here (per bundle / paper / drop × rate). Creating a captain also creates their empty 1:1 territory.",
    endpoints: [
      {
        id: "captains.list",
        method: "GET",
        path: "/api/captains",
        title: "List captains",
        description: "All captains with pay config, derived status, and their territory.",
        responseShape:
          "{ data: Array<{ id, firstName, lastName, status, payType, payRate, payCadence, territory: { id, color } | null }> }",
        fields: [
          {
            path: "status",
            in: "query",
            label: "Status",
            kind: "select",
            options: ["", "active", "retired"],
          },
          { path: "q", in: "query", label: "Search", kind: "text" },
        ],
      },
      {
        id: "captains.create",
        method: "POST",
        path: "/api/captains",
        title: "Create captain",
        description:
          "No address (locked decision — only volunteers have one). A rate of 0 is valid: donate-back captains are tracked for counts but pay out zero.",
        requestShape:
          "{ firstName, lastName, email, phone, payType: 'bundle'|'paper'|'drop', payRate, payCadence: 'weekly'|'biweekly', startDate, note? }",
        responseShape: "{ data: Captain & { territory } } (201)",
        fields: [
          { path: "firstName", label: "First name", kind: "text", required: true, example: "Test" },
          {
            path: "lastName",
            label: "Last name",
            kind: "text",
            required: true,
            example: "Captain",
          },
          {
            path: "email",
            label: "Email",
            kind: "text",
            required: true,
            example: "test.captain@example.com",
          },
          { path: "phone", label: "Phone", kind: "text", required: true, example: "416-555-0198" },
          {
            path: "payType",
            label: "Pay type",
            kind: "select",
            options: ["bundle", "paper", "drop"],
            required: true,
            example: "bundle",
          },
          { path: "payRate", label: "Pay rate ($)", kind: "number", required: true, example: 1.25 },
          {
            path: "payCadence",
            label: "Pay cadence",
            kind: "select",
            options: ["weekly", "biweekly"],
            required: true,
            example: "weekly",
            help: "Informational only — payouts are per-issue, never aggregated.",
          },
          {
            path: "startDate",
            label: "Start date",
            kind: "date",
            required: true,
            example: "2026-07-14",
          },
        ],
      },
      {
        id: "captains.update",
        method: "PATCH",
        path: "/api/captains/{id}",
        title: "Edit captain / pay config",
        description:
          "Changing the pay rate or type immediately recalculates every open issue's unpaid payout cells — watch a payout before and after.",
        requestShape:
          "Partial<{ firstName, lastName, email, phone, payType, payRate, payCadence, startDate, endDate, note }>",
        responseShape: "{ data: Captain }",
        fields: [
          idField("Captain", "captains", SEED.emily),
          { path: "payRate", label: "New pay rate ($)", kind: "number", example: 1.5 },
        ],
      },
      {
        id: "captains.retire",
        method: "POST",
        path: "/api/captains/{id}/retire",
        title: "Retire captain",
        description: "Soft retire; their territory becomes captain-less and awaits reassignment.",
        responseShape: "{ data: Captain }",
        rules: "Already retired → 409.",
        fields: [idField("Captain", "captains")],
      },
    ],
  },
  {
    id: "territories",
    title: "Territories",
    blurb:
      "A captain's coverage area (1:1). Holds two member lists — assigned volunteers and commercial drop addresses. Routes are NOT in territories; they connect through volunteers.",
    endpoints: [
      {
        id: "territories.list",
        method: "GET",
        path: "/api/territories",
        title: "List territories",
        description: "Each with its captain, volunteer count and commercial-drop count.",
        responseShape:
          "{ data: Array<{ id, color, captain: { id, name, retired } | null, volunteerCount, commercialDropCount }> }",
        fields: [{ path: "hasCaptain", in: "query", label: "Has captain", kind: "boolean" }],
      },
      {
        id: "territories.get",
        method: "GET",
        path: "/api/territories/{id}",
        title: "Territory detail",
        description:
          "Members expanded: volunteers (with status) and commercial drops (with addresses).",
        responseShape:
          "{ data: { id, color, captain, volunteers: [...], commercialDrops: [...] } }",
        fields: [idField("Territory", "territories", SEED.emilyTerritory)],
      },
      {
        id: "territories.assignVolunteer",
        method: "POST",
        path: "/api/territories/{id}/volunteers",
        title: "Assign volunteer to territory",
        description:
          "Places a volunteer under this territory's captain (volunteer → captain → territory).",
        requestShape: "{ volunteerId }",
        responseShape: "{ data: TerritoryDetail }",
        rules: "Retired volunteers can't be assigned (409).",
        fields: [
          idField("Territory", "territories", SEED.emilyTerritory),
          {
            path: "volunteerId",
            label: "Volunteer",
            kind: "ref",
            ref: "volunteers",
            required: true,
          },
        ],
      },
      {
        id: "territories.addDrop",
        method: "POST",
        path: "/api/territories/{id}/commercial-drops",
        title: "Add commercial drop",
        description:
          "A non-residential address (store, school, church) that receives bundles. Address is validated + geocoded like all addresses.",
        requestShape: "{ address: { addressLines: string[] } }",
        responseShape: "{ data: TerritoryDetail } (201)",
        fields: [
          idField("Territory", "territories", SEED.emilyTerritory),
          {
            path: "address.addressLines.0",
            label: "Street address",
            kind: "text",
            required: true,
            example: "2200 Queen St E",
          },
        ],
      },
    ],
  },
  {
    id: "routes",
    title: "Routes",
    blurb:
      "Street segments a volunteer walks. Lifecycle (Assigned/Vacant), Suspended, and needs-attention are all derived. Deleting is SOFT — the row is kept so history resolves.",
    endpoints: [
      {
        id: "routes.list",
        method: "GET",
        path: "/api/routes",
        title: "List routes",
        description: "Soft-deleted routes never appear. The vacancy filter is the most-used view.",
        responseShape:
          "{ data: Array<{ id, streetName, side, lifecycle: 'assigned'|'vacant', suspended, needsAttention, houseCount, papers, assignedVolunteer, captain }> }",
        fields: [
          {
            path: "vacancy",
            in: "query",
            label: "Vacancy",
            kind: "select",
            options: ["", "vacant", "assigned"],
          },
          { path: "q", in: "query", label: "Search street", kind: "text" },
        ],
      },
      {
        id: "routes.create",
        method: "POST",
        path: "/api/routes",
        title: "Create route",
        description:
          "Start/end addresses are validated + geocoded. House count is manual for MVP (auto-calc from Toronto Open Data is post-MVP). Papers drive the bundle auto-split.",
        requestShape:
          "{ startAddress: { addressLines }, endAddress: { addressLines }, streetName, side?, assignedVolunteerId?, houseCount, papers, note? }",
        responseShape: "{ data: RouteDetail } (201)",
        fields: [
          {
            path: "startAddress.addressLines.0",
            label: "Start address",
            kind: "text",
            required: true,
            example: "Queen St E & Elmer Ave",
          },
          {
            path: "endAddress.addressLines.0",
            label: "End address",
            kind: "text",
            required: true,
            example: "Queen St E & Waverley Rd",
          },
          {
            path: "streetName",
            label: "Street name",
            kind: "text",
            required: true,
            example: "Elmer Ave",
          },
          {
            path: "side",
            label: "Side",
            kind: "select",
            options: ["", "NORTH", "SOUTH", "EAST", "WEST", "BOTH"],
          },
          {
            path: "assignedVolunteerId",
            label: "Assign volunteer (optional)",
            kind: "ref",
            ref: "volunteers",
          },
          { path: "houseCount", label: "House count", kind: "number", required: true, example: 42 },
          { path: "papers", label: "Standing papers", kind: "number", required: true, example: 45 },
        ],
      },
      {
        id: "routes.assign",
        method: "POST",
        path: "/api/routes/{id}/assign",
        title: "Assign a volunteer",
        description: "Vacant → Assigned.",
        requestShape: "{ volunteerId }",
        responseShape: "{ data: RouteDetail }",
        rules: "Route already assigned → 409 (use reassign). Retired volunteer → 409.",
        fields: [
          idField("Route", "routes", SEED.beechAveRoute),
          {
            path: "volunteerId",
            label: "Volunteer",
            kind: "ref",
            ref: "volunteers",
            required: true,
          },
        ],
      },
      {
        id: "routes.unassign",
        method: "POST",
        path: "/api/routes/{id}/unassign",
        title: "Unassign (make vacant)",
        description: "Assigned → Vacant. The volunteer keeps their other routes.",
        responseShape: "{ data: RouteDetail }",
        rules: "Already vacant → 409.",
        fields: [idField("Route", "routes", SEED.queenStRoute)],
      },
      {
        id: "routes.nearestVacant",
        method: "GET",
        path: "/api/routes/nearest-vacant",
        title: "Nearest vacant routes",
        description:
          "Ranks vacant routes by travel time from a volunteer's home — the 'recommend a route to a new volunteer' feature. Distances come from the deterministic fake Maps provider for now.",
        responseShape: "{ data: Array<{ route, distanceMeters, durationSeconds }> }",
        fields: [
          {
            path: "volunteerId",
            in: "query",
            label: "Volunteer",
            kind: "ref",
            ref: "volunteers",
            required: true,
          },
          { path: "limit", in: "query", label: "Max results", kind: "number", example: 5 },
        ],
      },
      {
        id: "routes.delete",
        method: "DELETE",
        path: "/api/routes/{id}",
        title: "Delete route (soft)",
        description:
          "Hides the route from every view but keeps the row so past issues' deliveries still resolve. There is no undo endpoint (by design, for now).",
        responseShape: "204 No Content",
        fields: [idField("Route", "routes")],
      },
    ],
  },
  {
    id: "finance",
    title: "Finance — years, issues, payouts",
    blurb:
      "The yearly table: issues are rows, captains are columns, each cell a payout. Issues are born OPEN (no draft) with payout cells + delivery rows auto-created and the live calculation running.",
    endpoints: [
      {
        id: "years.list",
        method: "GET",
        path: "/api/financial-years",
        title: "List financial years",
        description: "The tables. Years run ~March–February and are archivable (stay readable).",
        responseShape: "{ data: Array<{ id, name, archived, issueCount }> }",
        fields: [],
      },
      {
        id: "years.create",
        method: "POST",
        path: "/api/financial-years",
        title: "Create financial year",
        description: "Just a name — e.g. “2027–2028”.",
        requestShape: "{ name }",
        responseShape: "{ data: Year } (201)",
        rules: "Duplicate name → 409.",
        fields: [
          {
            path: "name",
            label: "Year name",
            kind: "text",
            required: true,
            example: "Playground test year",
          },
        ],
      },
      {
        id: "years.detail",
        method: "GET",
        path: "/api/financial-years/{id}",
        title: "Year table (issues × captains)",
        description:
          "The whole grid: every issue row with its payout cells, plus the captain columns.",
        responseShape:
          "{ data: { id, name, captains: [...], issues: Array<{ id, name, date, status, cells: Array<{ payoutId, captainId, effectiveAmount, calculationStatus, paid }> }> } }",
        fields: [idField("Financial year", "financial-years", SEED.year)],
      },
      {
        id: "issues.create",
        method: "POST",
        path: "/api/financial-years/{id}/issues",
        title: "Create issue (born Open)",
        description:
          "THE key action: creates the issue Open, auto-creates a payout cell per active captain and a delivery row per carried route (seeded with the greedy 50/25 bundle split), then runs the live calculation. Nothing else auto-closes.",
        requestShape: "{ issues: [{ name, date }] }",
        responseShape: "{ data: [Issue] } (201)",
        rules: "Archived year → 409.",
        fields: [
          idField("Financial year", "financial-years", SEED.year),
          {
            path: "issues.0.name",
            label: "Issue name",
            kind: "text",
            required: true,
            example: "July 14",
          },
          {
            path: "issues.0.date",
            label: "Issue date",
            kind: "date",
            required: true,
            example: "2026-07-14",
          },
        ],
      },
      {
        id: "issues.close",
        method: "POST",
        path: "/api/issues/{id}/close",
        title: "Close issue",
        description:
          "One shared close: freezes every payout value AND locks every delivery row together. Paid/unpaid becomes toggleable.",
        responseShape: "{ data: Issue }",
        rules: "Already closed → 409.",
        fields: [
          pastedIdField(
            "Issue id",
            "Create an issue above, or run the Finance walkthrough — its steps carry ids forward automatically.",
          ),
        ],
      },
      {
        id: "issues.reopen",
        method: "POST",
        path: "/api/issues/{id}/reopen",
        title: "Reopen issue (guarded correction)",
        description: "Unpaid cells resume live calculation; paid cells stay frozen until unmarked.",
        responseShape: "{ data: Issue }",
        fields: [pastedIdField("Issue id", "Paste the id of a closed issue.")],
      },
      {
        id: "issues.payouts",
        method: "GET",
        path: "/api/issues/{id}/payouts",
        title: "List an issue's payouts",
        description:
          "One cell per captain with calculated vs override vs effective amount and the paid marker.",
        responseShape:
          "{ data: Array<{ id, captainName, calculatedAmount, overrideAmount, effectiveAmount, calculationStatus, paid }> }",
        fields: [pastedIdField("Issue id", "From create-issue's response.")],
      },
      {
        id: "payouts.detail",
        method: "GET",
        path: "/api/payouts/{id}",
        title: "Payout + calculation breakdown",
        description:
          "Shows exactly how the amount was computed: per-route billable quantities × the captain's rate.",
        responseShape:
          "{ data: Payout & { breakdown: { payType, payRate, perRoute: [{ streetName, unitCount, missedCount, billable }], totalQuantity } } }",
        fields: [pastedIdField("Payout id", "From the issue's payout list.")],
      },
      {
        id: "payouts.override",
        method: "POST",
        path: "/api/payouts/{id}/override",
        title: "Override payout",
        description:
          "Manual amount with a required reason (no prior-value audit — locked decision). How irregular cases (donate-back, self-calculated) are handled.",
        requestShape: "{ amount, reason }",
        responseShape: "{ data: Payout }",
        rules: "Paid cells are locked — unmark first (409).",
        fields: [
          pastedIdField("Payout id", "From the issue's payout list."),
          { path: "amount", label: "New amount ($)", kind: "number", required: true, example: 25 },
          {
            path: "reason",
            label: "Reason (required)",
            kind: "text",
            required: true,
            example: "Agreed flat rate for this issue",
          },
        ],
      },
      {
        id: "payouts.transfer",
        method: "POST",
        path: "/api/payouts/{id}/transfer",
        title: "Transfer payout to another captain",
        description:
          "The reallocate-money feature: recipient's cell is overridden UP by this cell's amount, this cell is overridden to 0, both with auto reasons. Undo by clearing the overrides.",
        requestShape: "{ toCaptainId }",
        responseShape: "{ data: Payout } (the zeroed source)",
        rules: "Recipient must have a cell in the issue; paid/self/zero-amount → 409.",
        fields: [
          pastedIdField("Source payout id", "From the issue's payout list."),
          {
            path: "toCaptainId",
            label: "Receiving captain",
            kind: "ref",
            ref: "captains",
            required: true,
          },
        ],
      },
      {
        id: "payouts.markPaid",
        method: "POST",
        path: "/api/payouts/{id}/mark-paid",
        title: "Mark paid",
        description:
          "Pure status marker — never changes the amount. Marking paid LOCKS the cell from all edits.",
        responseShape: "{ data: Payout }",
        rules: "Only when the issue is closed (409 otherwise).",
        fields: [pastedIdField("Payout id", "Close the issue first.")],
      },
    ],
  },
  {
    id: "delivery",
    title: "Delivery recording",
    blurb:
      "Per-route actuals for an issue: papers, the per-bundle breakdown (stored individually — sums must match), drops, missed. Editable only while the issue is Open; every edit re-runs the payout calc.",
    endpoints: [
      {
        id: "deliveries.list",
        method: "GET",
        path: "/api/issues/{id}/deliveries",
        title: "List an issue's deliveries",
        description: "The delivery grid: one row per carried route, seeded from standing counts.",
        responseShape:
          "{ data: Array<{ id, routeId, streetName, paperCount, bundles: [{ papers }], bundleCount, dropCount, missedCount }> }",
        fields: [pastedIdField("Issue id", "From create-issue's response.")],
      },
      {
        id: "deliveries.update",
        method: "PATCH",
        path: "/api/deliveries/{id}",
        title: "Edit delivery actuals",
        description:
          "Change the paper count and the bundle split reseeds automatically (50s → 25s → remainder) — or supply your own split, which must sum to the paper count. The captain's payout recalculates instantly.",
        requestShape: "Partial<{ paperCount, bundles: [{ papers }], dropCount, missedCount }>",
        responseShape: "{ data: Delivery }",
        rules: "Closed issue → 409. Bundles that don't sum to paperCount → 422.",
        fields: [
          pastedIdField("Delivery id", "From the issue's delivery list."),
          { path: "paperCount", label: "Paper count", kind: "number", example: 130 },
          {
            path: "bundles",
            label: "Bundle split (papers per bundle, comma-separated — optional)",
            kind: "bundles",
            placeholder: "50, 50, 25, 5",
            help: "Leave empty to auto-split greedily.",
          },
          {
            path: "missedCount",
            label: "Missed count",
            kind: "number",
            help: "Deducted in the captain's pay unit.",
          },
        ],
      },
      {
        id: "issues.papersToOrder",
        method: "GET",
        path: "/api/issues/{id}/papers-to-order",
        title: "Papers to order",
        description:
          "Derived total for the print order: the sum of every route's paper count for this issue.",
        responseShape: "{ data: { issueId, total } }",
        fields: [pastedIdField("Issue id", "From create-issue's response.")],
      },
    ],
  },
  {
    id: "addresses",
    title: "Addresses & Maps",
    blurb:
      "Server-side wrappers over the Maps provider (deterministic fake until Google keys exist). place_id is stored forever; coordinates are a 30-day cache per Google's terms.",
    endpoints: [
      {
        id: "addresses.validate",
        method: "POST",
        path: "/api/addresses/validate",
        title: "Validate an address",
        description:
          "What volunteer signup runs before saving: standardize + geocode, flag anything needing confirmation.",
        requestShape: "{ address: { addressLines: string[] } }",
        responseShape:
          "{ data: { addressComplete, needsConfirmation, formattedAddress, placeId, type } }",
        fields: [
          {
            path: "address.addressLines.0",
            label: "Street address",
            kind: "text",
            required: true,
            example: "12 Willow Ave",
          },
        ],
      },
    ],
  },
];
