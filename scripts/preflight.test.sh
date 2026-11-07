#!/usr/bin/env bash
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_FAILED=1

cd "$(dirname "$0")/.." || exit "$EXIT_FAILED"

readonly PREFLIGHT=scripts/preflight.sh
readonly TYPECHECK='pnpm -w typecheck'
readonly LINT='pnpm -w lint'
readonly BUILD='cmake --build'
readonly NATIVE_FIX='native fix'
readonly VERIFY_RAN='verify fresh'
export VERIFY_TOOL=native/audio_core/build/metronome_verify

SCRATCH=$(mktemp -d) || exit "$EXIT_FAILED"
readonly SCRATCH
trap 'rm -rf "$SCRATCH"' EXIT

readonly FAKE_BIN="$SCRATCH/bin"
export CALLS="$SCRATCH/calls"
mkdir -p "$FAKE_BIN"

# Marker words in src.ts and native.cpp decide each fake gate's result, so a
# gate only sees a rewrite if it really runs again after the fix.
cat > "$FAKE_BIN/pnpm" <<'STUB'
#!/usr/bin/env bash
echo "pnpm $*" >> "$CALLS"
case "$*" in
  '-w typecheck') ! grep -q TYPE_ERROR src.ts ;;
  '-w lint') ! grep -qE 'LINT_FIXABLE|LINT_STUCK' src.ts ;;
  '-w lint --fix') sed -i -E "s/LINT_FIXABLE\S*/$LINT_FIX_WRITES/" src.ts ;;
  '-w format') ! grep -q UNFORMATTED src.ts ;;
  'exec prettier --write .') sed -i "s/UNFORMATTED/$FORMAT_FIX_WRITES/" src.ts ;;
  '-w generate:check') ! grep -q NATIVE_DRIFT native.cpp ;;
  '-w test --concurrency=2') ! grep -q NATIVE_TEST_BREAK native.cpp ;;
esac
STUB
cat > "$FAKE_BIN/cmake" <<'STUB'
#!/usr/bin/env bash
echo "cmake $*" >> "$CALLS"
[[ $1 == --build ]] || exit 0
grep -q NATIVE_BROKEN native.cpp && exit 1
printf '#!/usr/bin/env bash\necho "verify fresh" >> "$CALLS"\n' > "$VERIFY_TOOL"
chmod +x "$VERIFY_TOOL"
STUB
chmod +x "$FAKE_BIN/pnpm" "$FAKE_BIN/cmake"

commit_all() {
  git -C "$1" add .
  git -C "$1" -c user.name=test -c user.email=test@example.invalid commit -qm "$2"
}

new_tree() {
  local tree=$1 script
  mkdir -p "$tree/scripts"
  for script in scripts/*.sh; do
    printf '#!/usr/bin/env bash\nexit 0\n' > "$tree/$script"
    chmod +x "$tree/$script"
  done
  cp "$PREFLIGHT" "$tree/$PREFLIGHT"
  cat > "$tree/scripts/lint.sh" <<'STUB'
#!/usr/bin/env bash
! grep -q NATIVE_UNFORMATTED native.cpp
STUB
  cat > "$tree/scripts/format.sh" <<'STUB'
#!/usr/bin/env bash
echo "native fix" >> "$CALLS"
sed -i "s/NATIVE_UNFORMATTED/$NATIVE_FIX_WRITES/" native.cpp
STUB
  printf 'clean\n' > "$tree/native.cpp"
  printf 'native/audio_core/build/\n' > "$tree/.gitignore"
  mkdir -p "$tree/native/audio_core/build"
  printf '#!/usr/bin/env bash\nexit 1\n' > "$tree/$VERIFY_TOOL"
  chmod +x "$tree/$VERIFY_TOOL"
  git -C "$tree" init -q
  commit_all "$tree" base
}

place_src() {
  local tree=$1 src=$2 git_state=$3
  case $git_state in
    untracked) ;;
    modified)
      printf 'base\n' > "$tree/src.ts"
      commit_all "$tree" src
      ;;
    clean)
      printf '%s\n' "$src" > "$tree/src.ts"
      commit_all "$tree" src
      ;;
  esac
  printf '%s\n' "$src" > "$tree/src.ts"
}

PASS=0
FAIL=0
LINT_FIX_WRITES=clean
FORMAT_FIX_WRITES=clean
NATIVE_FIX_WRITES=clean
NATIVE_SRC=clean
CASE_TREE=""
CASE_OUTPUT=""

report() {
  local name=$1 problem=$2
  if [[ -n $problem ]]; then
    printf '  FAIL  %s: %s\n%s\n' "$name" "$problem" "${CASE_OUTPUT//$'\n'/$'\n'    }"
    FAIL=$((FAIL + 1))
  else
    printf '  ok    %s\n' "$name"
    PASS=$((PASS + 1))
  fi
}

expect() {
  local name=$1 src=$2 git_state=$3 want_exit=$4 want_text=$5 status problem=""
  shift 5
  CASE_TREE="$SCRATCH/tree-$((PASS + FAIL))"
  new_tree "$CASE_TREE"
  place_src "$CASE_TREE" "$src" "$git_state"
  printf '%s\n' "$NATIVE_SRC" > "$CASE_TREE/native.cpp"
  : > "$CALLS"
  CASE_OUTPUT=$(cd "$CASE_TREE" && PATH="$FAKE_BIN:$PATH" \
    LINT_FIX_WRITES="$LINT_FIX_WRITES" FORMAT_FIX_WRITES="$FORMAT_FIX_WRITES" \
    NATIVE_FIX_WRITES="$NATIVE_FIX_WRITES" \
    bash "$PREFLIGHT" --skip-android "$@" 2>&1)
  status=$?
  CASE_OUTPUT=$(sed 's/\x1b\[[0-9;]*m//g' <<<"$CASE_OUTPUT")
  ((status == want_exit)) || problem="exit $status, wanted $want_exit"
  [[ -z $want_text || $CASE_OUTPUT == *"$want_text"* ]] ||
    problem+=" output missing '$want_text'"
  report "$name" "$problem"
}

ran_times() {
  local name=$1 command=$2 want=$3 count
  count=$(grep -cE "^$command( |\$)" "$CALLS")
  if ((count == want)); then
    report "$name" ""
  else
    report "$name" "'$command' ran $count times, wanted $want"
  fi
}

ran_before() {
  local name=$1 first=$2 then=$3 first_line then_line
  first_line=$(grep -n "^$first" "$CALLS" | tail -1 | cut -d: -f1)
  then_line=$(grep -n "^$then" "$CALLS" | head -1 | cut -d: -f1)
  if [[ -n $first_line && -n $then_line ]] && ((first_line < then_line)); then
    report "$name" ""
  else
    report "$name" "'$first' at line '$first_line', '$then' at line '$then_line'"
  fi
}

not_ran() {
  local name=$1 command=$2
  if grep -q "^$command" "$CALLS"; then
    report "$name" "'$command' ran"
  else
    report "$name" ""
  fi
}

src_is() {
  local name=$1 want=$2
  if [[ $(<"$CASE_TREE/src.ts") == "$want" ]]; then
    report "$name" ""
  else
    report "$name" "src.ts is '$(<"$CASE_TREE/src.ts")', wanted '$want'"
  fi
}

LINT_FIX_WRITES=TYPE_ERROR
for git_state in untracked clean modified; do
  expect "lint fix that breaks types fails ($git_state file)" LINT_FIXABLE "$git_state" \
    "$EXIT_FAILED" "FAILED: Typecheck — all packages — after auto-fix"
  ran_times "  and typecheck read the rewrite ($git_state file)" "$TYPECHECK" 2
done
LINT_FIX_WRITES=clean

expect "harmless lint fix passes" LINT_FIXABLE clean "$EXIT_OK" "auto-fixed:"
ran_times "  and typecheck read the rewrite" "$TYPECHECK" 2
ran_times "  and lint only ran check, fix and its own recheck" "$LINT" 3

FORMAT_FIX_WRITES=LINT_STUCK
expect "format fix that breaks lint fails" UNFORMATTED clean \
  "$EXIT_FAILED" "FAILED: Lint — architecture rules, --max-warnings 0 — after auto-fix"
FORMAT_FIX_WRITES=TYPE_ERROR
expect "format fix that breaks types fails" UNFORMATTED clean \
  "$EXIT_FAILED" "FAILED: Typecheck — all packages — after auto-fix"
FORMAT_FIX_WRITES=clean

expect "a type error the fix cures leaves no stale failure" LINT_FIXABLE_TYPE_ERROR clean \
  "$EXIT_OK" "all gates passed"
ran_times "  and typecheck read the rewrite" "$TYPECHECK" 2

expect "lint failure with nothing to fix adds no rerun" LINT_STUCK clean \
  "$EXIT_FAILED" "FAILED: Lint"
ran_times "  and typecheck ran once" "$TYPECHECK" 1

expect "a clean tree reruns nothing" clean clean "$EXIT_OK" "all gates passed"
ran_times "  typecheck once" "$TYPECHECK" 1
ran_times "  lint once" "$LINT" 1
ran_times "  native build once" "$BUILD" 1

expect "--no-fix fails a fixable lint" LINT_FIXABLE clean "$EXIT_FAILED" "FAILED: Lint" --no-fix
ran_times "  and typecheck ran once" "$TYPECHECK" 1
ran_times "  and lint ran once" "$LINT" 1
src_is "  and the file is untouched" LINT_FIXABLE

expect "--no-fix passes a clean tree" clean clean "$EXIT_OK" "all gates passed" --no-fix
ran_times "  and typecheck ran once" "$TYPECHECK" 1

expect "--no-fix fails unformatted code" UNFORMATTED clean "$EXIT_FAILED" "FAILED: Format" --no-fix
src_is "  and the file is untouched" UNFORMATTED

NATIVE_SRC=NATIVE_UNFORMATTED
NATIVE_FIX_WRITES=NATIVE_BROKEN
expect "native format fix that breaks the build fails" clean clean \
  "$EXIT_FAILED" "FAILED: Native core — build"
NATIVE_FIX_WRITES=NATIVE_DRIFT
expect "native format fix that drifts generated constants fails" clean clean \
  "$EXIT_FAILED" "FAILED: Generation drift guards"
NATIVE_FIX_WRITES=NATIVE_TEST_BREAK
expect "native format fix that breaks the tests fails" clean clean \
  "$EXIT_FAILED" "FAILED: Tests — unit suites"
NATIVE_FIX_WRITES=clean
expect "harmless native format fix passes" clean clean "$EXIT_OK" "auto-fixed:"
ran_before "  and every gate read the rewrite" "$NATIVE_FIX" "$TYPECHECK"
ran_before "  and the build read the rewrite" "$NATIVE_FIX" "$BUILD"
ran_times "  and the build ran once" "$BUILD" 1
NATIVE_SRC=clean

expect "verify tools run after the build" clean clean "$EXIT_OK" "all gates passed"
ran_before "  in that order" "$BUILD" "$VERIFY_RAN"

NATIVE_SRC=NATIVE_BROKEN
expect "--skip-native builds nothing and verifies nothing" clean clean \
  "$EXIT_OK" "Native core — skipped" --skip-native
not_ran "  no cmake" cmake
not_ran "  no verify tool" "$VERIFY_RAN"
NATIVE_SRC=NATIVE_UNFORMATTED
expect "--skip-native leaves native format alone" clean clean "$EXIT_OK" "" --skip-native
not_ran "  no native fix" "$NATIVE_FIX"
NATIVE_SRC=clean

echo
printf 'preflight.test: %d passed, %d failed\n' "$PASS" "$FAIL"
((FAIL == 0))
