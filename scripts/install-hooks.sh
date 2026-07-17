#!/usr/bin/env bash
# Point git at the tracked hooks in .githooks/. Run once after cloning.
# Tracked hooks (unlike .git/hooks) are version-controlled and shared.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
echo "hooks: core.hooksPath -> .githooks (pre-commit will run scripts/lint.sh --staged)"
