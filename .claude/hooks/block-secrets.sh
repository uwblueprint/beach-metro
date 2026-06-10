#!/usr/bin/env bash
# PreToolUse hook (Write|Edit): refuse to write content that looks like a secret.
# Exit 2 blocks the tool call and feeds stderr back to Claude.
# Fails open (exit 0) when its dependency is missing, so it never wedges a session.
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "block-secrets: jq not installed; skipping secret scan." >&2
  exit 0
fi

input=$(cat)
tool=$(jq -r '.tool_name // empty' <<<"$input")

case "$tool" in
  Write) content=$(jq -r '.tool_input.content // empty' <<<"$input") ;;
  Edit)  content=$(jq -r '.tool_input.new_string // empty' <<<"$input") ;;
  *)     exit 0 ;;
esac

file=$(jq -r '.tool_input.file_path // empty' <<<"$input")

# Allow obvious placeholder/example files.
case "$file" in
  *.env.example|*.sample|*example*|*sample*) exit 0 ;;
esac

# Conservative secret signatures (kept tight to avoid false positives).
patterns=(
  'AKIA[0-9A-Z]{16}'                                              # AWS access key id
  'aws_secret_access_key'                                         # AWS secret marker
  '-----BEGIN[ A-Z]*PRIVATE KEY-----'                            # private key block
  'sk-ant-[A-Za-z0-9_-]{20,}'                                     # Anthropic API key
  'sk-[A-Za-z0-9]{20,}'                                          # OpenAI-style secret key
  'gh[pousr]_[A-Za-z0-9]{20,}'                                    # GitHub token
  'xox[baprs]-[A-Za-z0-9-]{10,}'                                  # Slack token
  '(api[_-]?key|secret|password|token)["'"'"' :=]+[A-Za-z0-9/+_-]{16,}'  # generic assignment
)

for p in "${patterns[@]}"; do
  if printf '%s' "$content" | grep -E -q -e "$p"; then
    echo "block-secrets: refused to write ${file:-this file} — it matches a secret pattern (/$p/). Move the secret to an env var or an untracked .env, and commit a .env.example placeholder instead." >&2
    exit 2
  fi
done

exit 0
