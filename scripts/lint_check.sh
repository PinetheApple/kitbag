#!/usr/bin/env bash
# PostToolUse lint check: run after every Write/Edit to catch regressions.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
exit_code=0

echo ":: Running dart analyze on custom_lint_kitbag..."
(cd "$repo_root/packages/custom_lint_kitbag" && dart analyze lib/) || exit_code=1

echo ":: Running dart run custom_lint on app_shell..."
(cd "$repo_root/packages/app_shell" && dart run custom_lint) || exit_code=1

if [ "$exit_code" -eq 0 ]; then
  echo ":: All checks passed."
else
  echo ":: Some checks failed — fix violations before continuing."
fi
exit "$exit_code"
