---
name: blueprint-pull-request
description: Pull request conventions for any UW Blueprint repo — PR title, description template, base branch, reviewers, required checks. Use when opening or updating a PR. General precedent, reusable across projects.
allowed-tools: Bash(git push *) Bash(git log *) Bash(git rev-parse *) Bash(gh pr *) Bash(gh repo *)
---

# Pull request conventions (UW Blueprint)

All work merges through a PR; never push to `main`.

## Title
Conventional-commit style: `<type>(<scope>): <summary>`. Mirror the lead commit.

## Description — fill every section of `.github/pull_request_template.md`
- One-sentence summary.
- Linked Linear ticket (auto-links from the branch name).
- What changed / Why.
- Test plan: what you tested and what a reviewer should test.
- Screenshots for any UI change.
- Checklist: tests pass, typecheck/lint clean, coverage holds.

## Procedure
1. Push the branch: `git push -u origin <branch>`.
2. Open the PR against `main` with `gh pr create`, using the template.
3. Request at least one reviewer.
4. Prefer opening as a **draft** until checks are green.

## Never
- Enable auto-merge.
- Bypass review on AI-generated changes.
- Merge a migration or schema change without explicit human approval.
