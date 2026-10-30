#!/usr/bin/env bash
# Tests version.sh in throwaway git repos: the mirrors, the next-version rule and
# the versionCode formula the release workflow depends on.
set -uo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
readonly REPO
readonly SCRATCH_ROOT="$HOME/.cache/agent-scratch"
mkdir -p "$SCRATCH_ROOT"
SCRATCH=$(mktemp -d "$SCRATCH_ROOT/version-test.XXXXXX") || exit 1
readonly SCRATCH
trap 'rm -rf "$SCRATCH"' EXIT

readonly EXIT_OK=0
readonly EXIT_DRIFT=1
readonly EXIT_USAGE=2
readonly EXIT_OUT_OF_BOUNDS=3
readonly EXIT_NOTHING_TO_RELEASE=4

PASS=0
FAIL=0

# expect <name> <want_exit> <want_text> -- <command...>
expect() {
  local name=$1 want_exit=$2 want_text=$3
  shift 4
  local output status
  output=$("$@" 2>&1)
  status=$?
  if [[ $status -eq $want_exit ]] && [[ -z $want_text || $output == *"$want_text"* ]]; then
    printf '  ok    %s\n' "$name"
    PASS=$((PASS + 1))
  else
    printf '  FAIL  %s (exit %d, wanted %d, wanted text %q)\n%s\n' "$name" "$status" "$want_exit" "$want_text" "$output"
    FAIL=$((FAIL + 1))
  fi
}

# expect_next <name> <want_version> -- <command...>: the whole stdout must equal it.
expect_next() {
  local name=$1 want=$2
  shift 3
  local output status
  output=$("$@" 2>&1)
  status=$?
  if [[ $status -eq $EXIT_OK && $output == "$want" ]]; then
    printf '  ok    %s\n' "$name"
    PASS=$((PASS + 1))
  else
    printf '  FAIL  %s (exit %d, got %q, wanted %q)\n' "$name" "$status" "$output" "$want"
    FAIL=$((FAIL + 1))
  fi
}

# make_fixture <floor>: a repo with version.sh, app.json at <floor>, and one commit.
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

commit() {
  git -C "$1" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "$2" "${@:3}"
}

next_in() { (cd "$1" && ./scripts/version.sh next); }

# fixture_after <floor> <tag> <subject> [body]: tagged at <tag>, then one commit.
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

echo "mirrors"
fixture=$(make_fixture 0.1.0)
expect "current reads app.json" "$EXIT_OK" "0.1.0" -- bash -c "cd $fixture && ./scripts/version.sh current"
expect "set rejects a non-semver version" "$EXIT_USAGE" "expected major.minor.patch" -- \
  bash -c "cd $fixture && ./scripts/version.sh set 1.2"
expect "check passes when the mirrors agree" "$EXIT_OK" "no drift" -- \
  bash -c "cd $fixture && ./scripts/version.sh check"
expect "set writes every file" "$EXIT_OK" "0.2.0" -- \
  bash -c "cd $fixture && ./scripts/version.sh set 0.2.0 && ./scripts/version.sh current"
expect "set updated the mirrors too" "$EXIT_OK" "no drift" -- \
  bash -c "cd $fixture && ./scripts/version.sh check"
expect "check catches a hand-edited mirror" "$EXIT_DRIFT" "package.json" -- \
  bash -c "cd $fixture && echo '{\"name\":\"kitbag\",\"version\":\"9.9.9\"}' > package.json && ./scripts/version.sh check"

echo "next — bump rule"
expect_next "no tags: the app.json floor" 0.1.0 -- next_in "$(make_fixture 0.1.0)"
expect_next "fix: patch" 0.1.1 -- next_in "$(fixture_after 0.1.0 v0.1.0 'fix: a')"
expect_next "scoped fix: patch" 0.1.1 -- next_in "$(fixture_after 0.1.0 v0.1.0 'fix(tuner): a')"
expect_next "feat: minor" 0.2.0 -- next_in "$(fixture_after 0.1.0 v0.1.0 'feat: a')"
expect_next "scoped feat: minor" 0.2.0 -- next_in "$(fixture_after 0.1.0 v0.1.0 'feat(metronome): a')"
expect_next "feat on 1.x resets patch" 1.3.0 -- next_in "$(fixture_after 0.1.0 v1.2.3 'feat: a')"
expect_next "breaking ! on 0.x: minor" 0.2.0 -- next_in "$(fixture_after 0.1.0 v0.1.4 'fix!: a')"
expect_next "BREAKING CHANGE footer on 0.x: minor" 0.2.0 -- \
  next_in "$(fixture_after 0.1.0 v0.1.4 'fix: a' 'BREAKING CHANGE: the grid format changed')"
expect_next "breaking ! on 1.x: major" 2.0.0 -- next_in "$(fixture_after 0.1.0 v1.2.3 'feat(db)!: a')"
expect_next "BREAKING CHANGE footer on 1.x: major" 2.0.0 -- \
  next_in "$(fixture_after 0.1.0 v1.2.3 'chore: a' 'BREAKING CHANGE: dropped v6 import')"
expect_next "docs: patch" 0.1.1 -- next_in "$(fixture_after 0.1.0 v0.1.0 'docs: a')"
expect_next "chore: patch" 0.1.1 -- next_in "$(fixture_after 0.1.0 v0.1.0 'chore: a')"
expect_next "non-conventional: patch" 0.1.1 -- next_in "$(fixture_after 0.1.0 v0.1.0 'Update readme')"
expect_next "a featuring word is not feat" 0.1.1 -- next_in "$(fixture_after 0.1.0 v0.1.0 'feature flag cleanup')"

fixture=$(fixture_after 0.1.0 v0.1.0 'fix: a')
commit "$fixture" "feat: b"
commit "$fixture" "docs: c"
expect_next "strongest commit in the range wins" 0.2.0 -- next_in "$fixture"

fixture=$(make_fixture 0.1.0)
git -C "$fixture" tag v0.1.0
git -C "$fixture" checkout -q -b topic
commit "$fixture" "feat: on a branch"
git -C "$fixture" checkout -q main
git -C "$fixture" -c user.email=t@t -c user.name=t merge -q --no-ff -m "Merge pull request #1 from topic" topic
expect_next "merge commit carries the merged feat" 0.2.0 -- next_in "$fixture"

fixture=$(make_fixture 0.1.0)
git -C "$fixture" tag v0.1.0
git -C "$fixture" checkout -q -b topic
commit "$fixture" "docs: on a branch"
git -C "$fixture" checkout -q main
git -C "$fixture" -c user.email=t@t -c user.name=t merge -q --no-ff -m "Merge pull request #2 from topic" topic
expect_next "merge of docs only: patch" 0.1.1 -- next_in "$fixture"

echo "next — base tag and floor"
fixture=$(make_fixture 0.1.0)
git -C "$fixture" tag v0.9.0
git -C "$fixture" tag v0.10.0
git -C "$fixture" tag changelog-base
git -C "$fixture" tag v2.0
commit "$fixture" "fix: a"
expect_next "highest semver v-tag is the base, others ignored" 0.10.1 -- next_in "$fixture"
expect "latest-tag prints the base" "$EXIT_OK" "v0.10.0" -- bash -c "cd $fixture && ./scripts/version.sh latest-tag"
expect "latest-tag prints nothing without tags" "$EXIT_OK" "" -- \
  bash -c "cd $(make_fixture 0.1.0) && test -z \"\$(./scripts/version.sh latest-tag)\""

expect_next "floor beats the bump" 1.0.0 -- next_in "$(fixture_after 1.0.0 v0.4.2 'fix: a')"
expect_next "bump beats a lower floor" 0.3.1 -- next_in "$(fixture_after 0.1.0 v0.3.0 'fix: a')"
expect_next "floor equal to the bump" 0.2.0 -- next_in "$(fixture_after 0.2.0 v0.1.0 'feat: a')"

fixture=$(make_fixture 0.1.0)
git -C "$fixture" tag v0.1.0
expect "no commits since the tag: nothing to release" "$EXIT_NOTHING_TO_RELEASE" "nothing to release" -- \
  next_in "$fixture"

echo "next — bounds"
expect "patch 99 overflow refuses" "$EXIT_OUT_OF_BOUNDS" "raise" -- next_in "$(fixture_after 0.1.0 v0.1.99 'fix: a')"
expect "minor 99 overflow refuses" "$EXIT_OUT_OF_BOUNDS" "raise" -- next_in "$(fixture_after 0.1.0 v0.99.3 'feat: a')"
expect_next "feat after patch 99 is in bounds" 0.2.0 -- next_in "$(fixture_after 0.1.0 v0.1.99 'feat: a')"
expect_next "breaking after 1.99.x is in bounds" 2.0.0 -- next_in "$(fixture_after 0.1.0 v1.99.99 'feat!: a')"
expect "out-of-bounds floor refuses" "$EXIT_OUT_OF_BOUNDS" "" -- next_in "$(make_fixture 0.100.0)"

echo "code — the versionCode formula"
expect "0.1.0 is 100" "$EXIT_OK" "" -- bash -c "cd $(make_fixture 0.1.0) && test \"\$(./scripts/version.sh code 0.1.0)\" = 100"
expect "1.2.3 is 10203" "$EXIT_OK" "" -- bash -c "cd $(make_fixture 0.1.0) && test \"\$(./scripts/version.sh code 1.2.3)\" = 10203"
expect "0.0.0 refuses" "$EXIT_OUT_OF_BOUNDS" "" -- bash -c "cd $(make_fixture 0.1.0) && ./scripts/version.sh code 0.0.0"
expect "patch 100 refuses" "$EXIT_OUT_OF_BOUNDS" "" -- bash -c "cd $(make_fixture 0.1.0) && ./scripts/version.sh code 0.1.100"
expect "minor 100 refuses" "$EXIT_OUT_OF_BOUNDS" "" -- bash -c "cd $(make_fixture 0.1.0) && ./scripts/version.sh code 0.100.0"
expect "above the Android cap refuses" "$EXIT_OUT_OF_BOUNDS" "" -- bash -c "cd $(make_fixture 0.1.0) && ./scripts/version.sh code 210000.0.1"
expect "code rejects non-semver" "$EXIT_USAGE" "" -- bash -c "cd $(make_fixture 0.1.0) && ./scripts/version.sh code 1.2"

code_fixture=$(make_fixture 0.1.0)
# Under the bounds, semver order must equal versionCode order or an update
# would refuse to install over its predecessor.
for pair in 0.0.1:0.0.2 0.0.99:0.1.0 0.1.99:0.2.0 0.98.99:0.99.0 0.99.99:1.0.0 1.0.99:1.1.0 1.99.99:2.0.0 9.99.99:10.0.0 209999.99.99:210000.0.0; do
  lower=${pair%%:*}
  higher=${pair##*:}
  expect "code ${lower} < code ${higher}" "$EXIT_OK" "" -- bash -c "
    cd $code_fixture
    lo=\$(./scripts/version.sh code $lower) && hi=\$(./scripts/version.sh code $higher) && ((lo < hi))"
done

echo
if ((FAIL)); then
  printf 'version tests: %d passed, %d FAILED\n' "$PASS" "$FAIL"
  exit 1
fi
printf 'version tests: %d passed\n' "$PASS"
