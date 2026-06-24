# docs

Source-of-truth design artifacts for Beach Metro, organized by document kind. Flow
specs follow the prose + Mermaid format established by the route management flow
([`flows/route_management_flow.md`](flows/route_management_flow.md)); reuse that
format for new specs.

## Layout

```
docs/
  product/       — the PRD
  flows/         — per-area flow specs (state machines + walkthroughs)
  schema/        — the consolidated data model (source-of-truth backend shapes)
  api/           — the REST endpoint / CRUD spec
  integrations/  — external-service research and integration plans (Google Maps)
  infra/         — infrastructure / tech-stack spec
```

## Documents

| Doc | Area | Linear | Status |
|---|---|---|---|
| [`product/beach_metro_PRD.md`](product/beach_metro_PRD.md) | Product requirements | — | Drafted |
| [`flows/route_management_flow.md`](flows/route_management_flow.md) | Route management | BM-12 | Merged |
| [`flows/people_management_flow.md`](flows/people_management_flow.md) | People management (volunteers + captains) | BM-24 | Merged |
| [`flows/finances_flow.md`](flows/finances_flow.md) | Finances (issues, payouts) | BM-25 | Draft |
| [`flows/delivery_recording_flow.md`](flows/delivery_recording_flow.md) | Delivery recording (issue actuals) | PRD Flow 5 | Draft |
| [`schema/data_model.md`](schema/data_model.md) | Consolidated data model | — | Draft |
| [`api/api_spec.md`](api/api_spec.md) | REST endpoints / CRUD | — | Draft |
| [`integrations/google_maps_research.md`](integrations/google_maps_research.md) | Google Maps Platform research + integration | — | Draft |
| [`infra/infrastructure_spec.md`](infra/infrastructure_spec.md) | Infrastructure / tech stack | — | Draft |

As more specs are written, add a row here.
