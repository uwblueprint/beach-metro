#!/usr/bin/env bash
# PostToolUse hook (Write|Edit): format the file Claude just wrote, if a
# formatter is installed locally. No-op when tooling is absent (e.g. before the
# apps are scaffolded) so it never breaks a session. Only uses locally-installed
# binaries — never triggers a network install.
set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)
file=$(jq -r '.tool_input.file_path // empty' <<<"$input")
[ -n "$file" ] && [ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.scss|*.md|*.mdx|*.yaml|*.yml|*.html) ;;
  *) exit 0 ;;
esac

if [ -x node_modules/.bin/biome ]; then
  node_modules/.bin/biome format --write "$file" >/dev/null 2>&1 || true
elif [ -x node_modules/.bin/prettier ]; then
  node_modules/.bin/prettier --write "$file" >/dev/null 2>&1 || true
fi

exit 0
