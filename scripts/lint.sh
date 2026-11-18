#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_OK=0
readonly EXIT_LINT_FAILED=1
readonly EXIT_USAGE=2
readonly EXIT_GIT_FAILED=3
readonly EXIT_MISSING_TOOL=127

# eslint 9's default *.js/*.mjs/*.cjs plus eslint.config.mjs's **/*.{ts,tsx}.
readonly ESLINT_PATHSPECS=('*.js' '*.mjs' '*.cjs' '*.ts' '*.tsx')

usage() {
  cat <<USAGE
usage: lint.sh [--staged]

The mechanical lint gate (CONTRIBUTING.md): clang-format, clang-tidy and file
length over the C++ core, then eslint over the TS/JS workspace.

  (no flag)   lint the whole tree, as preflight and CI do
  --staged    lint only staged files; the pre-commit hook runs this

exit ${EXIT_OK}    no violations
exit ${EXIT_LINT_FAILED}    at least one violation
exit ${EXIT_USAGE}    usage error
exit ${EXIT_GIT_FAILED}    git could not list the staged files
exit ${EXIT_MISSING_TOOL}  clang-format not installed
USAGE
}

staged_only=false
case ${1:-} in
  '') ;;
  --staged) staged_only=true ;;
  -h | --help)
    usage
    exit "$EXIT_USAGE"
    ;;
  *)
    echo "lint: unknown option $1" >&2
    usage >&2
    exit "$EXIT_USAGE"
    ;;
esac

cd "$(git rev-parse --show-toplevel)"

cpp_files() {
  if $staged_only; then
    git diff --cached --name-only --diff-filter=ACM -- \
      'native/audio_core/***.cpp' 'native/audio_core/***.h' \
      ':(exclude)native/audio_core/third_party/*'
  else
    find native/audio_core/src native/audio_core/include native/audio_core/tools \
      -name '*.cpp' -o -name '*.h'
  fi
}

fail=$EXIT_OK

# --- C++: format + static analysis ------------------------------------------
mapfile -t files < <(cpp_files)
if [[ ${#files[@]} -gt 0 ]]; then
  if ! command -v clang-format >/dev/null; then
    echo "lint: clang-format not found — install it or skip C++ (see CONTRIBUTING.md)" >&2
    exit "$EXIT_MISSING_TOOL"
  fi
  echo "lint: clang-format ${#files[@]} file(s)"
  if ! clang-format --dry-run --Werror "${files[@]}"; then
    echo "lint: formatting violations — run 'bash scripts/format.sh'" >&2
    fail=$EXIT_LINT_FAILED
  fi

  db=native/audio_core/build/compile_commands.json
  if command -v clang-tidy >/dev/null && [[ -f $db ]]; then
    echo "lint: clang-tidy ${#files[@]} file(s)"
    # clang-tidy exits non-zero on advisory warnings too; gate only on what
    # .clang-tidy promotes to `error:` (naming, magic numbers).
    tidy_out=$(clang-tidy -p native/audio_core/build "${files[@]}" 2>/dev/null || true)
    if grep -q 'error:' <<<"$tidy_out"; then
      grep 'error:' <<<"$tidy_out" >&2
      fail=$EXIT_LINT_FAILED
    fi
  elif ! command -v clang-tidy >/dev/null; then
    echo "lint: clang-tidy not found — install it (see CONTRIBUTING.md)" >&2
    fail=$EXIT_LINT_FAILED
  else
    # Failing open here once let 7 function-size violations through a green run.
    echo "lint: no compile DB at $db — configure the build first" >&2
    fail=$EXIT_LINT_FAILED
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
      fail=$EXIT_LINT_FAILED
    fi
  done
fi

# --- TS/JS: eslint ------------------------------------------------------------
if [[ ! -f package.json ]]; then
  echo "lint: no package.json — skipping eslint"
elif $staged_only; then
  mapfile -d '' -t ts_files < <(git diff --cached --name-only -z --diff-filter=ACMR -- "${ESLINT_PATHSPECS[@]}")
  if ! wait "$!"; then
    echo "lint: git could not list the staged files — not linting blind" >&2
    exit "$EXIT_GIT_FAILED"
  fi
  if [[ ${#ts_files[@]} -gt 0 ]]; then
    echo "lint: eslint ${#ts_files[@]} staged file(s)"
    if ! npx eslint --max-warnings 0 --no-warn-ignored -- "${ts_files[@]}"; then
      echo "lint: eslint violations in the staged files above" >&2
      fail=$EXIT_LINT_FAILED
    fi
  fi
else
  echo "lint: eslint"
  if ! npx eslint . --max-warnings 0; then
    echo "lint: eslint violations above" >&2
    fail=$EXIT_LINT_FAILED
  fi
fi

exit "$fail"
