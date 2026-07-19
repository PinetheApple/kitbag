#!/usr/bin/env bash
# Kitbag lint gate. The mechanical half of the review layer (CONTRIBUTING.md);
# the judgment half is the code-reviewer agent. Run it by hand or via the
# pre-commit hook (scripts/install-hooks.sh).
#
#   bash scripts/lint.sh            # lint the whole tree
#   bash scripts/lint.sh --staged   # lint only staged files (what the hook does)
#
# Exit non-zero on any violation. C++ is enforced today; the TS/React gate is
# staged and no-ops until the RN app (package.json) exists — SPEC.md §13.6.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

staged_only=false
[[ "${1:-}" == "--staged" ]] && staged_only=true

cpp_files() {
  if $staged_only; then
    git diff --cached --name-only --diff-filter=ACM -- \
      'native/audio_core/***.cpp' 'native/audio_core/***.h'
  else
    find native/audio_core/src native/audio_core/include native/audio_core/tools \
      -name '*.cpp' -o -name '*.h'
  fi
}

fail=0

# --- C++: format + static analysis ------------------------------------------
mapfile -t files < <(cpp_files)
if [[ ${#files[@]} -gt 0 ]]; then
  if ! command -v clang-format >/dev/null; then
    echo "lint: clang-format not found — install it or skip C++ (see CONTRIBUTING.md)" >&2
    exit 127
  fi
  echo "lint: clang-format ${#files[@]} file(s)"
  if ! clang-format --dry-run --Werror "${files[@]}"; then
    echo "lint: formatting violations — run 'bash scripts/format.sh'" >&2
    fail=1
  fi

  # clang-tidy needs the compile DB; skip with a note rather than fail if absent.
  # Which checks GATE is declared per-directory in .clang-tidy (WarningsAsErrors:
  # naming + magic numbers); the rest are advisory. Do not escalate here.
  db=native/audio_core/build/compile_commands.json
  if command -v clang-tidy >/dev/null && [[ -f $db ]]; then
    echo "lint: clang-tidy ${#files[@]} file(s)"
    # clang-tidy's exit code is non-zero for advisory warnings too, so gate on
    # the checks the config promotes to `error:` (naming, magic numbers) instead.
    tidy_out=$(clang-tidy -p native/audio_core/build "${files[@]}" 2>/dev/null || true)
    if grep -q 'error:' <<<"$tidy_out"; then
      grep 'error:' <<<"$tidy_out" >&2
      fail=1
    fi
  elif ! command -v clang-tidy >/dev/null; then
    echo "lint: clang-tidy not found — install it (see CONTRIBUTING.md)" >&2
    fail=1
  else
    # Failing open here once let 7 function-size violations through a green run.
    echo "lint: no compile DB at $db — configure the build first" >&2
    fail=1
  fi
fi

# --- File length ------------------------------------------------------------
# No linter ships this. Tests count too — metronome_verify.cpp reached 830 lines
# before this gate existed.
max_file_lines=400
if [[ ${#files[@]} -gt 0 ]]; then
  echo "lint: file length (<= $max_file_lines lines)"
  for f in "${files[@]}"; do
    [[ -f $f ]] || continue
    n=$(wc -l <"$f")
    if (( n > max_file_lines )); then
      echo "$f:1: error: $n lines exceeds the $max_file_lines-line limit" >&2
      fail=1
    fi
  done
fi

# --- TS/React: staged until the app exists ----------------------------------
if [[ -f package.json ]]; then
  echo "lint: eslint"
  npx eslint . --max-warnings 0 || fail=1
else
  echo "lint: TS/React gate staged — no package.json yet (SPEC.md §13.6)"
fi

exit $fail
