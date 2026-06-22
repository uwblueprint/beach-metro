---
name: blueprint-self-review
description: Self-review quality gate to run before declaring any change done — checks correctness, scope, quality, tests, and security. Use right before finishing a task, opening a PR, or saying a change is complete. General precedent, reusable across projects.
---

# Self-review checklist (run before "done")

Work through this and fix anything that fails before reporting completion.

## Correctness & scope
- Does the change actually do what was asked? Re-read the request.
- No silent assumptions — anything ambiguous was confirmed, not guessed.
- Only the intended files changed; no unrelated/orthogonal edits crept in.
- No over-engineering: the simplest thing that works, not a 50→500 line bloat.

## Quality
- No dead code, debug prints, commented-out blocks, or stray TODOs.
- Names, file layout, and style match the surrounding code.
- Errors are handled; no swallowed exceptions; inputs validated at the edge.
- No secrets, keys, or hardcoded credentials.

## Tests & docs
- Tests added or updated for the change, and the suite passes.
- Behavior changes are reflected in the docs / CLAUDE.md where relevant.

End by listing anything you could not verify, so the human reviewer knows where
to look.
