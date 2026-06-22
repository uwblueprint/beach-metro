---
name: blueprint-wrapup
description: End-of-session reflection that records durable, codebase-specific lessons into LEARNINGS.md using apply/capture/dismiss triage. Run manually at the end of a work session.
disable-model-invocation: true
allowed-tools: Read Edit Bash(git diff *) Bash(git log *) Bash(date *)
---

# Session wrap-up → LEARNINGS.md

Review what happened this session. For each candidate lesson, decide exactly one:
- **apply** — it's a general rule or a real fix; put it in CLAUDE.md or the code
  now, not in LEARNINGS.
- **capture** — it's a recurring, codebase-specific discovery; append one entry
  to `LEARNINGS.md`.
- **dismiss** — one-off, or already documented; record nothing.

Only capture things that are (a) specific to THIS codebase and (b) likely to
recur. Skip general best practices — those belong in CLAUDE.md or nowhere.

## How to append
Read `LEARNINGS.md`. Under `## Active Learnings`, add newest-first entries:

```
### YYYY-MM-DD <area-tag>
- What happened, what failed, what to do instead next time. One or two lines.
```

Use today's date from `date +%F`. Keep each entry to one or two lines.

## Before writing
Show the human the apply/capture/dismiss decisions and the exact diff to
`LEARNINGS.md`. Write only after they confirm.
