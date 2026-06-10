# Beach Metro — CLAUDE.md

Internal volunteer & distribution management system for Beach Metro Community News, built by UW Blueprint. Replaces a fragile ~30-tab spreadsheet. Two internal admin users: a distribution manager (routes + volunteers) and an accounts manager (captain payments). Product and flow specs live in `docs/` (the PRD and route flow currently live on the `prd-md` and `route-management-md` branches until merged).

## Status
Early. Design and docs exist; application code is not scaffolded yet. The `backend/` and `frontend/` apps (and their own narrower CLAUDE.md files) get added when those apps take shape — don't assume they exist.

## Stack (working assumptions)
- TypeScript end-to-end.
- Frontend: React, responsive web.
- Backend: Node API; Postgres + PostGIS.
- ORM (Prisma vs Drizzle vs raw `pg`) and auth library: not chosen yet — don't assume one.
- Linear for tickets (prefix `BM-`).

## Repo map
- `docs/` — PRD, schema, and flow specs. Source of truth for product + data model.
- `.claude/skills/` — project skills. `blueprint-*` are general and reusable across Blueprint projects; `beach-metro-*` are specific to this product. See `.claude/skills/README.md`.
- `.claude/hooks/` — `block-secrets` (pre-write), `format-on-write`, `test-on-stop`.
- `.claude/settings.json` — hook wiring.
- `LEARNINGS.md` — cross-session, codebase-specific lessons (protocol below).

## Hard rules
- **Never commit to `main`.** All work goes through a branch + PR. (Also enforce with GitHub branch protection.)
- **No unscoped UI messaging.** Do not add notifications, alerts, badges, toasts, banners, or modal warnings unless a spec explicitly calls for one. Default is to not show one. (Locked product decision in the PRD.)
- **Don't over-engineer.** Build the simplest thing that satisfies the request. Don't expand scope or edit unrelated code. If a 50-line change is turning into 500, stop and check.
- **Don't guess silently.** If a requirement is ambiguous, ask before building on the assumption.
- **No secrets in the repo.** Use env vars and an untracked `.env`; commit `.env.example` placeholders only.
- **No time-based cadences.** Don't express agent or workflow steps in wall-clock or calendar terms ("every two weeks", "daily", "in N days"). An agent has no reliable sense of elapsed time between sessions, so time-based instructions don't execute meaningfully — use event- or size-based triggers instead ("at session end", "when the file passes ~100 entries", "before opening a PR"). This governs how we instruct the agent, not real product facts like the paper's publication schedule or cache lifetimes.

## LEARNINGS protocol
At session start, read `LEARNINGS.md`. At session end, run `/blueprint-wrapup` to triage what you learned (apply / capture / dismiss). Consolidate with `/blueprint-consolidate-learnings` once `LEARNINGS.md` passes ~100 entries. CLAUDE.md holds stable facts; LEARNINGS.md holds discoveries specific to this codebase.

## Conventions
- Commits & branches: follow `/blueprint-commit` (Conventional Commits; `<type>/<BM-ticket>-<kebab>` branches).
- Pull requests: follow `/blueprint-pull-request` and `.github/pull_request_template.md`.
- Before declaring any change done, run `/blueprint-self-review`.

## Recommended skills to install (not bundled in this repo)
Install separately when relevant, and verify each before trusting it:
- `frontend-design` (Anthropic) — intentional UI instead of generic patterns.
- `skill-creator` (Anthropic) — author new Blueprint/Beach-Metro skills.
- `obra/superpowers` (official marketplace) — plan + TDD methodology, if the team wants it.
Bundled `/code-review`, `/run`, and `/verify` are available out of the box.

Keep this file lean. Procedures belong in skills; discoveries belong in LEARNINGS.md.
