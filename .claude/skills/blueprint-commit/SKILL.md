---
name: blueprint-commit
description: Commit and branch conventions for any UW Blueprint repo. Use whenever you are about to commit, are asked to commit, or need the commit-message and branch-naming rules. General precedent, reusable across projects.
allowed-tools: Bash(git add *) Bash(git status *) Bash(git diff *) Bash(git commit *) Bash(git branch *) Bash(git rev-parse *) Bash(git switch *)
---

# Commit conventions (UW Blueprint)

**Never commit directly to `main`.** If on `main`, create a branch first.

## Branch names
`<type>/<TICKET>-<short-kebab-description>` — e.g. `feat/BM-42-vacant-route-filter`.
- Types: `feat`, `fix`, `hotfix`, `chore`, `refactor`, `docs`, `test`.
- Include the Linear ticket ID (e.g. `BM-42`) so PRs auto-link. Omit only for
  repo bootstrap, where `chore/<description>` is fine.
- kebab-case, short. No developer name (git author metadata covers that).

## Commit messages — plain description
Write a plain, imperative summary with NO Conventional Commits type prefix
(no `feat:` / `fix:` / `docs:` / `chore:`). Capitalize the first word; keep the
summary ≤ 72 chars. Example: `Redefine territory model` — not
`docs: redefine territory model`.
- Add a body listing key changes when the diff is large.
- Prefer small, focused commits over one giant commit.
- Do not add a `Co-Authored-By` trailer; attribution is turned off for this repo
  via `attribution` in `.claude/settings.json`.

## Procedure
1. Run `git status` and `git diff` to see exactly what changed.
2. If on `main`, branch first (naming above).
3. Stage only the files for this change — never blind `git add -A`.
4. Write the message in the format above.
5. Never commit secrets, large binaries, or generated artifacts.
6. Commit only when the user asked you to.
