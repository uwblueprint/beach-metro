# docs

Source-of-truth design artifacts for Beach Metro: the PRD and the per-area flow
specs. Each flow spec follows the prose + Mermaid format established by the route
management flow (`route_management_flow_v2.md`). Reuse that format for new specs.

## Documents

| Doc | Area | Linear | Status | Where it lives |
|---|---|---|---|---|
| `beach_metro_PRD.md` | Product requirements | — | Drafted | `docs/` on branch `prd-md` |
| `route_management_flow_v2.md` | Route management | BM-12 | Under review | `docs/` on branch `route-management-md` |
| `people_management_flow_v1.md` | People management (volunteers + captains) | BM-24 | Draft | `docs/` on branch `people-management-md` |
| `finances_flow_v1.md` | Finances (issues, deliveries, payouts) | BM-25 | Skeleton | `docs/` on branch `finances-md` |
| `infrastructure_spec.md` | Infrastructure / tech stack | — | Draft | `docs/` on branch `infrastructure-spec-md` |

Until these branches merge into `main`, each doc lives in `docs/` on the branch
noted above. As more specs are written, add a row here.
