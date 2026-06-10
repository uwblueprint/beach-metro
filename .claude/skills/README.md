# .claude/skills

Project skills for this repo, in two tiers distinguished by name prefix.

Claude Code discovers skills as `.claude/skills/<name>/SKILL.md` and derives the
`/command` from the directory name. Category subfolders inside `.claude/skills/`
are **not** discovered, so we separate tiers with a name prefix rather than a
folder.

- **`blueprint-*` — general, reusable precedent.** Project-agnostic. Copy these
  into any future UW Blueprint repo as-is:
  - `blueprint-commit` — commit & branch conventions
  - `blueprint-pull-request` — PR conventions
  - `blueprint-self-review` — pre-"done" quality gate
  - `blueprint-wrapup` — end-of-session LEARNINGS reflection
  - `blueprint-consolidate-learnings` — periodic LEARNINGS cleanup
- **`beach-metro-*` — specific to this product** (route rules, PostGIS house
  counts, etc.). None yet; add as the codebase grows.

## Reusing across projects
- **Today:** `cp -r .claude/skills/blueprint-* <new-repo>/.claude/skills/`
- **Long-term:** extract the `blueprint-*` set into a `uwblueprint` plugin
  (`<plugin>/skills/<name>/SKILL.md` + a `.claude-plugin/plugin.json`). Future
  repos then install one plugin and get namespaced commands like
  `/uwblueprint:commit`, and the plugin can also bundle the hooks and PR
  template. See the Claude Code plugins docs.

## Recommended third-party skills (install separately, verify first)
- `frontend-design` (Anthropic) — intentional UI instead of generic patterns.
- `skill-creator` (Anthropic) — author new skills.
- `obra/superpowers` (official marketplace) — plan + TDD methodology, if wanted.
