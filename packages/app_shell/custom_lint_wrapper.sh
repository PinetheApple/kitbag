#!/usr/bin/env bash
# Wrapper to make custom_lint work with Melos workspace
# The issue: dart pub get deletes package_config.json in workspace member dirs,
# but custom_lint's _findRoots requires it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 1. Run dart pub get at workspace root (this deletes stray package_config.json in members)
"$WORKSPACE_ROOT/pubspec.lock" 2>/dev/null || dart pub get --offline 2>&1 || dart pub get 2>&1

# 2. Re-create the package_config.json in app_shell (THIS IS NEEDED BY custom_lint's _findRoots)
mkdir -p "$SCRIPT_DIR/.dart_tool"
cp "$WORKSPACE_ROOT/.dart_tool/package_config.json" "$SCRIPT_DIR/.dart_tool/package_config.json"

# 3. Run custom_lint
exec dart run custom_lint "$@"
