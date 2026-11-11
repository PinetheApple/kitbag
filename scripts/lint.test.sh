#!/usr/bin/env bash
set -uo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
readonly REPO
SCRATCH=$(mktemp -d) || exit 1
readonly SCRATCH
trap 'rm -rf "$SCRATCH"' EXIT

readonly EXIT_OK=0
readonly EXIT_LINT_FAILED=1
readonly EXIT_USAGE=2
readonly EXIT_GIT_FAILED=3

readonly FAKE_BIN="$SCRATCH/bin"
export ESLINT_ARGS="$SCRATCH/eslint-args"
export CLANG_FORMAT_ARGS="$SCRATCH/clang-format-args"
REAL_GIT=$(command -v git)
export REAL_GIT
mkdir -p "$FAKE_BIN"

cat > "$FAKE_BIN/npx" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$ESLINT_ARGS"
[[ -z ${ESLINT_FAILS:-} ]]
STUB
cat > "$FAKE_BIN/clang-format" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$CLANG_FORMAT_ARGS"
STUB
printf '#!/usr/bin/env bash\nexit 0\n' > "$FAKE_BIN/clang-tidy"
cat > "$FAKE_BIN/git" <<'STUB'
#!/usr/bin/env bash
[[ -n ${GIT_DIFF_FAILS:-} && $1 == diff ]] && exit 128
exec "$REAL_GIT" "$@"
STUB
chmod +x "$FAKE_BIN"/*

PASS=0
FAIL=0

pass() {
  printf '  ok    %s\n' "$1"
  PASS=$((PASS + 1))
}

fail() {
  printf '  FAIL  %s\n%s\n' "$1" "${2:-}"
  FAIL=$((FAIL + 1))
}

commit() {
  git -C "$1" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "$2"
}

make_fixture() {
  local dir
  dir=$(mktemp -d "$SCRATCH/repo.XXXXXX")
  mkdir -p "$dir/scripts" "$dir/native/audio_core/src" "$dir/native/audio_core/include" \
    "$dir/native/audio_core/tools" "$dir/native/audio_core/build"
  cp "$REPO/scripts/lint.sh" "$dir/scripts/"
  echo '{}' > "$dir/package.json"
  echo '[]' > "$dir/native/audio_core/build/compile_commands.json"
  printf 'native/audio_core/build/\n' > "$dir/.gitignore"
  git -C "$dir" init -q -b main
  git -C "$dir" add -A
  commit "$dir" init
  echo "$dir"
}

stage() {
  local dir=$1 path
  shift
  for path in "$@"; do
    mkdir -p "$dir/$(dirname "$path")"
    echo 'x' > "$dir/$path"
  done
  git -C "$dir" add -- "$@"
}

LINT_OUTPUT=""
LINT_STATUS=0

run_lint() {
  local dir=$1
  shift
  rm -f "$ESLINT_ARGS" "$CLANG_FORMAT_ARGS"
  LINT_OUTPUT=$(cd "$dir" && PATH="$FAKE_BIN:$PATH" bash scripts/lint.sh "$@" 2>&1)
  LINT_STATUS=$?
}

expect_status() {
  local name=$1 want=$2 want_text=${3:-}
  if ((LINT_STATUS == want)) && [[ -z $want_text || $LINT_OUTPUT == *"$want_text"* ]]; then
    pass "$name"
  else
    fail "$name (exit $LINT_STATUS, wanted $want, wanted text '$want_text')" "$LINT_OUTPUT"
  fi
}

expect_eslint_args() {
  local name=$1 want got
  shift
  want=$(printf '%s\n' "$@")
  if [[ ! -f $ESLINT_ARGS ]]; then
    fail "$name (eslint not called)" "$LINT_OUTPUT"
    return
  fi
  got=$(<"$ESLINT_ARGS")
  if [[ $got == "$want" ]]; then
    pass "$name"
  else
    fail "$name" "got:"$'\n'"$got"$'\n'"wanted:"$'\n'"$want"
  fi
}

expect_eslint_not_called() {
  if [[ -f $ESLINT_ARGS ]]; then
    fail "$1" "eslint called with: $(<"$ESLINT_ARGS")"
  else
    pass "$1"
  fi
}

readonly STAGED_ESLINT=(eslint --max-warnings 0 --no-warn-ignored --)

echo "--staged"
dir=$(make_fixture)
stage "$dir" README.md docs/notes.md
run_lint "$dir" --staged
expect_status "docs-only commit passes" "$EXIT_OK"
expect_eslint_not_called "  and eslint is not called"

dir=$(make_fixture)
stage "$dir" packages/a/src/one.ts "packages/a/src/with space.tsx" packages/a/-x.ts packages/a/tool.js \
  packages/a/run.mjs packages/a/old.cjs packages/a/view.jsx packages/a/data.json \
  native/audio_core/src/engine.cpp docs/notes.md
run_lint "$dir" --staged
expect_status "mixed commit passes" "$EXIT_OK"
expect_eslint_args "  eslint gets only the linted extensions, after --, spaces intact" "${STAGED_ESLINT[@]}" \
  packages/a/-x.ts packages/a/old.cjs packages/a/run.mjs packages/a/src/one.ts "packages/a/src/with space.tsx" \
  packages/a/tool.js
if [[ $(<"$CLANG_FORMAT_ARGS") == *native/audio_core/src/engine.cpp* ]]; then
  pass "  clang-format still gets the staged C++"
else
  fail "  clang-format still gets the staged C++" "$LINT_OUTPUT"
fi

dir=$(make_fixture)
stage "$dir" packages/a/gone.ts packages/a/before.ts packages/a/kept.ts
commit "$dir" files
git -C "$dir" rm -q packages/a/gone.ts
git -C "$dir" mv packages/a/before.ts packages/a/after.ts
run_lint "$dir" --staged
expect_status "delete + rename commit passes" "$EXIT_OK"
expect_eslint_args "  eslint gets the renamed file, not the deleted one" "${STAGED_ESLINT[@]}" \
  packages/a/after.ts

dir=$(make_fixture)
stage "$dir" packages/a/gone.ts
commit "$dir" files
git -C "$dir" rm -q packages/a/gone.ts
run_lint "$dir" --staged
expect_eslint_not_called "deleting the only TS file calls no eslint"

dir=$(make_fixture)
stage "$dir" packages/a/bad.ts
ESLINT_FAILS=1 run_lint "$dir" --staged
expect_status "an eslint violation fails the hook" "$EXIT_LINT_FAILED" "eslint"

dir=$(make_fixture)
stage "$dir" packages/a/one.ts
GIT_DIFF_FAILS=1 run_lint "$dir" --staged
expect_status "a failing git diff fails the hook" "$EXIT_GIT_FAILED" "git could not list"
expect_eslint_not_called "  and lints nothing"

echo "whole tree"
dir=$(make_fixture)
stage "$dir" docs/notes.md
run_lint "$dir"
expect_status "no flag passes" "$EXIT_OK"
expect_eslint_args "  eslint lints the whole tree" eslint . --max-warnings 0

ESLINT_FAILS=1 run_lint "$dir"
expect_status "an eslint violation fails the whole-tree run" "$EXIT_LINT_FAILED" "eslint"

echo "usage"
run_lint "$dir" --help
expect_status "--help documents --staged" "$EXIT_USAGE" "--staged"
run_lint "$dir" --bogus
expect_status "an unknown option is a usage error" "$EXIT_USAGE" "--bogus"
expect_eslint_not_called "  and lints nothing"

echo
if ((FAIL)); then
  printf 'lint tests: %d passed, %d FAILED\n' "$PASS" "$FAIL"
  exit 1
fi
printf 'lint tests: %d passed\n' "$PASS"
