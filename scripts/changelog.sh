#!/usr/bin/env bash
# Regenerate CHANGELOG.md from Conventional Commits.
#
# Always use this, never a bare `git-cliff -o CHANGELOG.md`. git-cliff has no
# config key for a start commit, so an unbounded run walks the whole history and
# re-imports the pre-audit entries deleted on 2026-07-17 — the five releases
# SPEC.md §2 found substantially false (904 lines -> 1339).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# The commit that deleted the Flutter app and purged the false releases.
# Everything from here on is the audited era.
AUDIT_FLOOR=9a63543

git-cliff "${AUDIT_FLOOR}..HEAD" -o CHANGELOG.md
echo "changelog: regenerated from ${AUDIT_FLOOR}..HEAD"
