#!/usr/bin/env bash
set -uo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
readonly REPO
SCRATCH=$(mktemp -d) || exit 1
readonly SCRATCH
trap 'rm -rf "$SCRATCH"' EXIT

readonly EXIT_OK=0
readonly EXIT_DRIFT=1
readonly EXIT_USAGE=2
readonly EXIT_OUT_OF_BOUNDS=3
readonly EXIT_NOTHING_TO_RELEASE=4

PASS=0
FAIL=0

pass() {
  printf '  ok    %s\n' "$1"
  PASS=$((PASS + 1))
}

fail() {
  printf '  FAIL  %s\n' "$1"
  FAIL=$((FAIL + 1))
}

# expect <name> <want_exit> <want_text> <command...>
expect() {
  local name=$1 want_exit=$2 want_text=$3
  shift 3
  local output status
  output=$("$@" 2>&1)
  status=$?
  if [[ $status -eq $want_exit ]] && [[ -z $want_text || $output == *"$want_text"* ]]; then
    pass "$name"
  else
    fail "$name (exit $status, wanted $want_exit, wanted text '$want_text')"
    echo "$output"
  fi
}

# expect_stdout <name> <want_stdout> <command...>: exit 0 and stdout exactly <want_stdout>.
expect_stdout() {
  local name=$1 want=$2
  shift 2
  local output status
  output=$("$@" 2>&1)
  status=$?
  if [[ $status -eq $EXIT_OK && $output == "$want" ]]; then
    pass "$name"
  else
    fail "$name (exit $status, got '$output', wanted '$want')"
  fi
}

commit() {
  git -C "$1" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "$2" "${@:3}"
}

make_fixture() {
  local floor=$1 dir
  dir=$(mktemp -d "$SCRATCH/repo.XXXXXX")
  mkdir -p "$dir/scripts" "$dir/packages/app-shell"
  cp "$REPO/scripts/version.sh" "$dir/scripts/"
  echo "{\"expo\":{\"version\":\"$floor\"}}" > "$dir/packages/app-shell/app.json"
  echo "{\"name\":\"kitbag\",\"version\":\"$floor\"}" > "$dir/package.json"
  echo "{\"name\":\"@kitbag/app-shell\",\"version\":\"$floor\"}" > "$dir/packages/app-shell/package.json"
  git -C "$dir" init -q -b main
  git -C "$dir" add -A
  commit "$dir" "chore: init"
  echo "$dir"
}

version_in() { (cd "$1" && ./scripts/version.sh "${@:2}"); }

# fixture_after <floor> <tag> <subject> [body]
fixture_after() {
  local dir
  dir=$(make_fixture "$1")
  git -C "$dir" tag "$2"
  if (($# > 3)); then
    commit "$dir" "$3" -m "$4"
  else
    commit "$dir" "$3"
  fi
  echo "$dir"
}

merge_topic() {
  local dir=$1 subject=$2
  git -C "$dir" checkout -q -b topic
  commit "$dir" "$subject"
  git -C "$dir" checkout -q main
  git -C "$dir" -c user.email=t@t -c user.name=t merge -q --no-ff -m "Merge pull request #1 from topic" topic
}

echo "mirrors"
fixture=$(make_fixture 0.1.0)
expect_stdout "current reads app.json" 0.1.0 version_in "$fixture" current
expect "set rejects a non-semver version" "$EXIT_USAGE" "expected major.minor.patch" version_in "$fixture" set 1.2
expect "check passes when the mirrors agree" "$EXIT_OK" "no drift" version_in "$fixture" check
expect "set writes app.json" "$EXIT_OK" "" version_in "$fixture" set 0.2.0
expect_stdout "set is read back" 0.2.0 version_in "$fixture" current
expect "set updated the mirrors too" "$EXIT_OK" "no drift" version_in "$fixture" check
echo '{"name":"kitbag","version":"9.9.9"}' > "$fixture/package.json"
expect "check catches a hand-edited mirror" "$EXIT_DRIFT" "package.json" version_in "$fixture" check

echo "next — bump rule"
expect_stdout "no tags: the app.json floor" 0.1.0 version_in "$(make_fixture 0.1.0)" next
expect_stdout "fix: patch" 0.1.1 version_in "$(fixture_after 0.1.0 v0.1.0 'fix: a')" next
expect_stdout "scoped fix: patch" 0.1.1 version_in "$(fixture_after 0.1.0 v0.1.0 'fix(tuner): a')" next
expect_stdout "feat: minor" 0.2.0 version_in "$(fixture_after 0.1.0 v0.1.0 'feat: a')" next
expect_stdout "scoped feat: minor" 0.2.0 version_in "$(fixture_after 0.1.0 v0.1.0 'feat(metronome): a')" next
expect_stdout "feat on 1.x resets patch" 1.3.0 version_in "$(fixture_after 0.1.0 v1.2.3 'feat: a')" next
expect_stdout "breaking ! on 0.x: minor" 0.2.0 version_in "$(fixture_after 0.1.0 v0.1.4 'fix!: a')" next
expect_stdout "BREAKING CHANGE footer on 0.x: minor" 0.2.0 \
  version_in "$(fixture_after 0.1.0 v0.1.4 'fix: a' 'BREAKING CHANGE: the grid format changed')" next
expect_stdout "breaking ! on 1.x: major" 2.0.0 version_in "$(fixture_after 0.1.0 v1.2.3 'feat(db)!: a')" next
expect_stdout "BREAKING CHANGE footer on 1.x: major" 2.0.0 \
  version_in "$(fixture_after 0.1.0 v1.2.3 'chore: a' 'BREAKING CHANGE: dropped v6 import')" next
expect_stdout "docs: patch" 0.1.1 version_in "$(fixture_after 0.1.0 v0.1.0 'docs: a')" next
expect_stdout "chore: patch" 0.1.1 version_in "$(fixture_after 0.1.0 v0.1.0 'chore: a')" next
expect_stdout "non-conventional: patch" 0.1.1 version_in "$(fixture_after 0.1.0 v0.1.0 'Update readme')" next
expect_stdout "a featuring word is not feat" 0.1.1 version_in "$(fixture_after 0.1.0 v0.1.0 'feature flag cleanup')" next

fixture=$(fixture_after 0.1.0 v0.1.0 'fix: a')
commit "$fixture" "feat: b"
commit "$fixture" "docs: c"
expect_stdout "strongest commit in the range wins" 0.2.0 version_in "$fixture" next

fixture=$(make_fixture 0.1.0)
git -C "$fixture" tag v0.1.0
merge_topic "$fixture" "feat: on a branch"
expect_stdout "merge commit carries the merged feat" 0.2.0 version_in "$fixture" next

fixture=$(make_fixture 0.1.0)
git -C "$fixture" tag v0.1.0
merge_topic "$fixture" "docs: on a branch"
expect_stdout "merge of docs only: patch" 0.1.1 version_in "$fixture" next

echo "next — base tag and floor"
fixture=$(make_fixture 0.1.0)
git -C "$fixture" tag v0.9.0
git -C "$fixture" tag v0.10.0
git -C "$fixture" tag changelog-base
git -C "$fixture" tag v2.0
commit "$fixture" "fix: a"
expect_stdout "highest semver v-tag is the base, others ignored" 0.10.1 version_in "$fixture" next
expect_stdout "latest-tag prints the base" v0.10.0 version_in "$fixture" latest-tag
expect_stdout "latest-tag prints nothing without tags" "" version_in "$(make_fixture 0.1.0)" latest-tag

expect_stdout "floor beats the bump" 1.0.0 version_in "$(fixture_after 1.0.0 v0.4.2 'fix: a')" next
expect_stdout "bump beats a lower floor" 0.3.1 version_in "$(fixture_after 0.1.0 v0.3.0 'fix: a')" next
expect_stdout "floor equal to the bump" 0.2.0 version_in "$(fixture_after 0.2.0 v0.1.0 'feat: a')" next

fixture=$(make_fixture 0.1.0)
git -C "$fixture" tag v0.1.0
expect "no commits since the tag: nothing to release" "$EXIT_NOTHING_TO_RELEASE" "nothing to release" \
  version_in "$fixture" next

echo "next — bounds"
expect "patch 99 overflow refuses" "$EXIT_OUT_OF_BOUNDS" "raise" version_in "$(fixture_after 0.1.0 v0.1.99 'fix: a')" next
expect "minor 99 overflow refuses" "$EXIT_OUT_OF_BOUNDS" "raise" version_in "$(fixture_after 0.1.0 v0.99.3 'feat: a')" next
expect_stdout "feat after patch 99 is in bounds" 0.2.0 version_in "$(fixture_after 0.1.0 v0.1.99 'feat: a')" next
expect_stdout "breaking after 1.99.x is in bounds" 2.0.0 version_in "$(fixture_after 0.1.0 v1.99.99 'feat!: a')" next
expect "out-of-bounds floor refuses" "$EXIT_OUT_OF_BOUNDS" "" version_in "$(make_fixture 0.100.0)" next

echo "code — the versionCode formula"
code_fixture=$(make_fixture 0.1.0)
expect_stdout "0.1.0 is 100" 100 version_in "$code_fixture" code 0.1.0
expect_stdout "1.2.3 is 10203" 10203 version_in "$code_fixture" code 1.2.3
expect_stdout "a v-tag is accepted" 10203 version_in "$code_fixture" code v1.2.3
expect "--help documents the formula" "$EXIT_USAGE" "major*10000" version_in "$code_fixture" code --help
expect "0.0.0 refuses" "$EXIT_OUT_OF_BOUNDS" "" version_in "$code_fixture" code 0.0.0
expect "patch 100 refuses" "$EXIT_OUT_OF_BOUNDS" "" version_in "$code_fixture" code 0.1.100
expect "minor 100 refuses" "$EXIT_OUT_OF_BOUNDS" "" version_in "$code_fixture" code 0.100.0
expect "above the Android cap refuses" "$EXIT_OUT_OF_BOUNDS" "" version_in "$code_fixture" code 210000.0.1
expect "code rejects non-semver" "$EXIT_USAGE" "" version_in "$code_fixture" code 1.2
expect "code rejects a non-v tag" "$EXIT_USAGE" "" version_in "$code_fixture" code changelog-base

# Under the bounds, semver order must equal versionCode order or an update
# would refuse to install over its predecessor.
for pair in 0.0.1:0.0.2 0.0.99:0.1.0 0.1.99:0.2.0 0.98.99:0.99.0 0.99.99:1.0.0 1.0.99:1.1.0 1.99.99:2.0.0 \
  9.99.99:10.0.0 209999.99.99:210000.0.0; do
  lower=${pair%%:*}
  higher=${pair##*:}
  lo=$(version_in "$code_fixture" code "$lower")
  hi=$(version_in "$code_fixture" code "$higher")
  if [[ -n $lo && -n $hi ]] && ((lo < hi)); then
    pass "code ${lower} < code ${higher}"
  else
    fail "code ${lower} (${lo}) < code ${higher} (${hi})"
  fi
done

echo
if ((FAIL)); then
  printf 'version tests: %d passed, %d FAILED\n' "$PASS" "$FAIL"
  exit 1
fi
printf 'version tests: %d passed\n' "$PASS"
