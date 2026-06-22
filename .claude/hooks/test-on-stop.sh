#!/usr/bin/env bash
# Stop hook: when Claude finishes, run the test suite if one exists and surface
# failures. Non-blocking by default (warns rather than forcing a retry loop).
# No-op when there is no test script yet, so it never breaks a session.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if command -v jq >/dev/null 2>&1 && [ -f package.json ] \
   && jq -e '.scripts.test // empty' package.json >/dev/null 2>&1; then
  if ! npm test --silent >/tmp/bm-test-on-stop.log 2>&1; then
    echo "test-on-stop: npm test failed. See /tmp/bm-test-on-stop.log; fix before the next session." >&2
    # To make this a HARD gate that forces Claude to keep working until tests
    # pass, replace the line below with:
    #   jq -n '{decision:"block", reason:"Tests are failing; fix them before stopping."}'
    exit 0
  fi
fi

exit 0
