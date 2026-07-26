# Beach Metro — agent skill contract

Shared skill roster and routing for Cursor, Claude Code, and other agents.
Product hard rules live in `CLAUDE.md`. Session discoveries live in `LEARNINGS.md`.

Install third-party skills once per machine (user-global). Verify each before trusting it.

## Skill roster

| Skill | Purpose | Install |
| --- | --- | --- |
| `make-interfaces-feel-better` | Micro-polish: radii, type, press, shadows, hit areas | `npx skills add https://github.com/jakubkrehel/make-interfaces-feel-better --skill make-interfaces-feel-better -y -g` |
| `web-design-guidelines` | Audit UI / a11y / UX against Vercel Web Interface Guidelines | `npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines -y -g` |
| `transitions-dev` | Drop-in CSS transitions (modal, dropdown, panel, icon swap, …) | `npx skills add jakubantalik/transitions-dev -y -g` |
| `emil-design-eng` | Emil Kowalski motion/taste framework | `npx skills add https://github.com/emilkowalski/skill --skill emil-design-eng -y -g` |
| `blueprint-*` | Commit, PR, self-review, wrapup | Bundled in `.claude/skills/` |

Open the matching skill’s `SKILL.md` before inventing polish, audit criteria, or motion recipes.

## Skill routing

| Skill | When to use |
| --- | --- |
| `make-interfaces-feel-better` | **Proactive default** on UI work — do not wait to be asked. Always make use **evident in the chat response** (short note that polish ran — not a prescribed reply template). |
| `web-design-guidelines` | **Default on UI work / UI reviews** — run unless it would clearly slow the turn a lot (huge diff, unrelated non-UI task, or user said to skip). Prefer a focused pass on touched files. |
| `transitions-dev` | **Only when the user explicitly wants animation/motion** (e.g. “animate this”, “add a transition”, “smooth open”). Do not invent motion recipes otherwise. |
| `emil-design-eng` | **Only when the user explicitly names/calls it.** Never auto-invoke. |

## Product overrides for design skills

- **No unscoped UI messaging.** Do not add notifications, alerts, badges, toasts, banners, or modal warnings unless a spec explicitly calls for one.
- Keep diffs small; don’t expand scope.
- If a requirement is ambiguous, ask before building on an assumption.
- Locked product decisions: `docs/design_decisions.md`.
