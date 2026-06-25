# Beach Metro

Internal volunteer and distribution management system for Beach Metro Community News,
built by UW Blueprint. Product and engineering specs live in [`docs/`](docs/) (start
with [`docs/README.md`](docs/README.md)).

## Stack

Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · TanStack Query · Zustand ·
Supabase (Postgres + Auth) · Vitest · Playwright · Vercel. See
[`docs/infra/infrastructure_spec.md`](docs/infra/infrastructure_spec.md).

## Getting started

Prerequisites: Node 24 LTS, pnpm, (Docker + Supabase CLI once a Supabase project exists).

```bash
pnpm install
cp .env.example .env.local   # fill in when keys are available
pnpm dev                     # http://localhost:3000
```

## Scripts

| Command                             | What it does                |
| ----------------------------------- | --------------------------- |
| `pnpm dev`                          | Run the app in development  |
| `pnpm build`                        | Production build            |
| `pnpm typecheck`                    | `tsc --noEmit`              |
| `pnpm lint`                         | ESLint                      |
| `pnpm format` / `pnpm format:check` | Prettier write / check      |
| `pnpm test`                         | Vitest unit/component tests |
| `pnpm test:e2e`                     | Playwright end-to-end tests |

## Project layout

See [`docs/infra/infrastructure_spec.md`](docs/infra/infrastructure_spec.md) for the
full structure. The build sequence is in
[`docs/plan/backend_build_plan.md`](docs/plan/backend_build_plan.md); this commit is
Phase 0 (scaffold).
