#!/usr/bin/env bash
# Apply Kitbag's formatting in place. clang-format for C++ today; prettier for
# TS/React once the app exists. Safe to run repeatedly.
#
#   bash scripts/format.sh            # format the whole tree
#   bash scripts/format.sh --staged   # format only staged files, then re-stage
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

staged_only=false
[[ "${1:-}" == "--staged" ]] && staged_only=true

if $staged_only; then
  mapfile -t files < <(git diff --cached --name-only --diff-filter=ACM -- \
    'native/audio_core/***.cpp' 'native/audio_core/***.h')
else
  mapfile -t files < <(find \
    native/audio_core/src native/audio_core/include native/audio_core/tools \
    -name '*.cpp' -o -name '*.h')
fi

if [[ ${#files[@]} -gt 0 ]]; then
  echo "format: clang-format ${#files[@]} file(s)"
  clang-format -i "${files[@]}"
  $staged_only && git add "${files[@]}"
fi

if [[ -f package.json ]]; then
  if $staged_only; then
    # Whole-tree prettier in a pre-commit would write files the commit never
    # touched; stay inside the staged set and re-stage what we rewrite.
    mapfile -t ts_files < <(git diff --cached --name-only --diff-filter=ACMR \
      | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|json|md|css)$' || true)
    if [[ ${#ts_files[@]} -gt 0 ]]; then
      echo "format: prettier ${#ts_files[@]} file(s)"
      ./node_modules/.bin/prettier --write --ignore-unknown "${ts_files[@]}"
      git add "${ts_files[@]}"
    fi
  else
    echo "format: prettier"
    pnpm -w format:write
  fi
fi
