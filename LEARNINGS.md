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

### 2026-08-22 client-components
- Don't import `today()` from `lib/services/shared.ts` into a client component: it pulls the Supabase admin client into the browser bundle. Inline the `Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" })` form instead (see `notes-section.tsx`, `member-side-panel.tsx`). Dates are Toronto-local everywhere, so `new Date().toISOString()` is wrong after 8pm ET.
