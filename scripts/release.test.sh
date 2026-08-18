#!/usr/bin/env bash
# Tests version.sh and release.sh's preconditions in a throwaway git repo.
#
# The preconditions are the whole safety story of a release: they all run before
# anything is built, pushed or published, so they are exactly the part worth
# testing without a device or an SDK.
set -uo pipefail

readonly REPO=$(cd "$(dirname "$0")/.." && pwd)

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
    printf '  FAIL  %s (exit %d, wanted %d)\n%s\n' "$name" "$status" "$want_exit" "$output"
    FAIL=$((FAIL + 1))
  fi
}

# A repo carrying only the files the release path reads, so a test can dirty it
# or tag it without touching the real one.
make_fixture() {
  local dir
  dir=$(mktemp -d)
  mkdir -p "$dir/scripts" "$dir/packages/app-shell"
  cp "$REPO/scripts/version.sh" "$REPO/scripts/release.sh" "$dir/scripts/"
  echo '{"expo":{"version":"0.1.0"}}' > "$dir/packages/app-shell/app.json"
  echo '{"name":"kitbag","version":"0.1.0"}' > "$dir/package.json"
  echo '{"name":"@kitbag/app-shell","version":"0.1.0"}' > "$dir/packages/app-shell/package.json"
  git -C "$dir" init -q
  git -C "$dir" add -A
  git -C "$dir" -c user.email=t@t -c user.name=t commit -qm init
  echo "$dir"
}

# release.sh refuses before it builds, so the tests need no keystore beyond the
# variables being set — except where the point is that they are not.
release_env=(ANDROID_KEYSTORE_PATH=/dev/null ANDROID_KEYSTORE_PASSWORD=x ANDROID_KEY_ALIAS=x)

echo "version.sh"
fixture=$(make_fixture)
expect "current reads app.json" 0 "0.1.0" -- bash -c "cd $fixture && ./scripts/version.sh current"
expect "set rejects a non-semver version" 2 "expected major.minor.patch" -- \
  bash -c "cd $fixture && ./scripts/version.sh set 1.2"
expect "check passes when the mirrors agree" 0 "no drift" -- \
  bash -c "cd $fixture && ./scripts/version.sh check"
expect "set writes every file" 0 "0.2.0" -- \
  bash -c "cd $fixture && ./scripts/version.sh set 0.2.0 && ./scripts/version.sh current"
expect "set updated the mirrors too" 0 "no drift" -- \
  bash -c "cd $fixture && ./scripts/version.sh check"
# Without this, app.json and the package.json copies become two sources of truth
# and the artifact's version stops being the one anything else reports.
expect "check catches a hand-edited mirror" 1 "package.json" -- \
  bash -c "cd $fixture && echo '{\"name\":\"kitbag\",\"version\":\"9.9.9\"}' > package.json && ./scripts/version.sh check"
rm -rf "$fixture"

echo "release.sh preconditions"
expect "no version argument" 3 "usage" -- bash -c "cd $(make_fixture) && ./scripts/release.sh"
expect "non-semver version" 3 "usage" -- bash -c "cd $(make_fixture) && ./scripts/release.sh 1.2"
expect "unknown option" 3 "unknown option" -- bash -c "cd $(make_fixture) && ./scripts/release.sh --nope 1.2.3"

fixture=$(make_fixture)
echo dirt > "$fixture/dirt"
expect "dirty working tree" 2 "working tree is dirty" -- \
  bash -c "cd $fixture && env ${release_env[*]} ./scripts/release.sh 0.2.0"
rm -rf "$fixture"

fixture=$(make_fixture)
git -C "$fixture" tag v0.2.0
expect "tag already exists" 2 "already exists" -- \
  bash -c "cd $fixture && env ${release_env[*]} ./scripts/release.sh 0.2.0"
rm -rf "$fixture"

fixture=$(make_fixture)
expect "releasing the version already in app.json" 2 "already 0.1.0" -- \
  bash -c "cd $fixture && env ${release_env[*]} ./scripts/release.sh 0.1.0"
# The debug key is public and unrecoverable once published — an unset keystore
# variable must stop the release, not fall back.
expect "keystore variables unset" 2 "ANDROID_KEYSTORE_PATH is unset" -- \
  bash -c "cd $fixture && env -u ANDROID_KEYSTORE_PATH -u ANDROID_KEYSTORE_PASSWORD -u ANDROID_KEY_ALIAS ./scripts/release.sh 0.2.0"
rm -rf "$fixture"

echo
if ((FAIL)); then
  printf 'release tests: %d passed, %d FAILED\n' "$PASS" "$FAIL"
  exit 1
fi
printf 'release tests: %d passed\n' "$PASS"
