---
name: blueprint-consolidate-learnings
description: Cleanup of LEARNINGS.md — prune outdated entries, merge duplicates, and promote recurring patterns into Consolidated Principles. Run when the file passes ~100 entries.
disable-model-invocation: true
allowed-tools: Read Edit Bash(wc *) Bash(date *)
---

# Consolidate LEARNINGS.md

Open `LEARNINGS.md` and tidy it:
1. Remove outdated or superseded entries.
2. Merge duplicates and near-duplicates.
3. Promote patterns that recur across entries into `## Consolidated Principles`
   as a single synthesized rule.
4. If a synthesized principle is broadly true for any project (not specific to
   this codebase), tag it `[PROMOTE -> CLAUDE.md]` so the human can move it.
5. Tag anything ambiguous with `[REVIEW NEEDED]`.

Show the human the full diff before writing. Do not delete entries you are
unsure about — flag them instead.
