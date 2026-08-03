# LEARNINGS.md

Discoveries specific to THIS codebase, left by past sessions for future ones.
Read this at the start of every session. Append to it at the end via `/blueprint-wrapup`.

Not for general best practices — those go in CLAUDE.md (or nowhere).
Consolidate once the file passes ~100 entries, via `/blueprint-consolidate-learnings`.

## Consolidated Principles
<!-- Synthesized rules, updated during consolidation. Empty for now. -->

## Active Learnings
<!-- Newest first. Format:
### YYYY-MM-DD area-tag
- What happened, what failed, what to do instead next time. One or two lines.
-->

### 2026-08-03 territory-drops-auth
- New Territory Drop Confirm hits real APIs (`/api/territories/...`, `/api/volunteers`). You must be signed in (valid session) for changes to persist; unauthenticated requests fail even when the modal UI works on stub members data.

### 2026-08-03 routes-auth
- Sign-in required to edit route details; API mutations for routes need a valid session or changes won’t persist.
