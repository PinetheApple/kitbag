#!/usr/bin/env bash
set -uo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
readonly REPO
SCRATCH=$(mktemp -d) || exit 1
readonly SCRATCH
trap 'rm -rf "$SCRATCH"' EXIT

GITHUB_RELEASE_BODY_MAX=$(sed -n 's/^readonly GITHUB_RELEASE_BODY_MAX=\([0-9]*\)$/\1/p' "$REPO/scripts/changelog.sh")
readonly GITHUB_RELEASE_BODY_MAX
if [[ -z $GITHUB_RELEASE_BODY_MAX ]]; then
  echo "changelog.test: cannot read GITHUB_RELEASE_BODY_MAX from scripts/changelog.sh" >&2
  exit 1
fi

PASS=0
FAIL=0

pass() {
  printf '  ok    %s\n' "$1"
  PASS=$((PASS + 1))
}

fail() {
  printf '  FAIL  %s\n%s\n' "$1" "${2:0:2000}"
  FAIL=$((FAIL + 1))
}

commit() {
  git -C "$1" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "$2" "${@:3}"
}

make_fixture() {
  local dir
  dir=$(mktemp -d "$SCRATCH/repo.XXXXXX")
  mkdir -p "$dir/scripts" "$dir/packages/app-shell"
  cp "$REPO/scripts/changelog.sh" "$REPO/scripts/version.sh" "$dir/scripts/"
  cp "$REPO/cliff.toml" "$dir/"
  echo '{"expo":{"version":"0.1.0"}}' > "$dir/packages/app-shell/app.json"
  git -C "$dir" init -q -b main
  git -C "$dir" add -A
  commit "$dir" "feat: first thing"
  echo "$dir"
}

stub_cliff() {
  mkdir -p "$1/stub-bin"
  printf '#!/usr/bin/env bash\ncat %q\n' "$1/stub-output" > "$1/stub-bin/git-cliff"
  chmod +x "$1/stub-bin/git-cliff"
  printf '%s' "$2" > "$1/stub-output"
}

notes_in() { (cd "$1" && PATH="$1/stub-bin:$PATH" ./scripts/changelog.sh --notes "$2" "$3" 2>/dev/null); }

echo "size guard (stubbed git-cliff)"
fixture=$(make_fixture)
git -C "$fixture" tag v0.1.0
commit "$fixture" "fix: second thing"
oversized="## 0.1.1"$'\n\n'"### Fixed"$'\n\n'$(head -c "$((GITHUB_RELEASE_BODY_MAX + 1))" /dev/zero | tr '\0' x)
stub_cliff "$fixture" "$oversized"
notes=$(notes_in "$fixture" v0.1.1 v0.1.0)
if ((${#notes} <= GITHUB_RELEASE_BODY_MAX)) && [[ $notes == *"compare/v0.1.0...v0.1.1"* && $notes != *CHANGELOG.md* ]]; then
  pass "oversized notes fall back to the compare range only"
else
  fail "oversized notes fall back (got ${#notes} chars)" "$notes"
fi

stub_cliff "$fixture" "## 0.1.1"$'\n\n'"### Fixed"$'\n\n'"- Second thing"
notes=$(notes_in "$fixture" v0.1.1 v0.1.0)
if [[ $notes == *"- Second thing"* && $notes != *"too long"* ]]; then
  pass "notes under the limit pass through"
else
  fail "notes under the limit pass through" "$notes"
fi

stub_cliff "$fixture" "## 0.1.1"$'\n'
notes=$(notes_in "$fixture" v0.1.1 v0.1.0)
if [[ $notes == *"No user-facing changes in this release."* ]]; then
  pass "no grouped commits: says so"
else
  fail "no grouped commits: says so" "$notes"
fi

fixture=$(make_fixture)
stub_cliff "$fixture" "$oversized"
notes=$(notes_in "$fixture" v0.1.0 "")
if [[ $notes == *"commits/v0.1.0"* ]]; then
  pass "first release falls back to the tag's commit list"
else
  fail "first release falls back to the tag's commit list" "$notes"
fi

echo "subject-only notes (real git-cliff)"
if command -v git-cliff >/dev/null 2>&1; then
  fixture=$(make_fixture)
  git -C "$fixture" tag v0.1.0
  commit "$fixture" "fix: second thing" -m "A commit body that belongs in CHANGELOG.md only."
  notes=$(notes_in "$fixture" v0.1.1 v0.1.0)
  if [[ $notes == *"Second thing"* && $notes != *"commit body"* ]]; then
    pass "notes carry subjects, not bodies"
  else
    fail "notes carry subjects, not bodies" "$notes"
  fi
else
  echo "  SKIP  notes carry subjects, not bodies — git-cliff not installed"
fi

echo "release tags off main (real git-cliff)"
tag_off_main() {
  local dir=$1 tag=$2
  git -C "$dir" checkout -q -b "release-$tag"
  commit "$dir" "chore(release): F-Droid changelog for $tag"
  git -C "$dir" tag "$tag"
  git -C "$dir" checkout -q main
}

section() { awk -v start="$2" 'index($0, start) == 1 { on = 1; next } on && /^## / { exit } on' "$1/CHANGELOG.md"; }

if command -v git-cliff >/dev/null 2>&1; then
  fixture=$(make_fixture)
  sed -i "s/^readonly AUDIT_FLOOR=.*/readonly AUDIT_FLOOR=$(git -C "$fixture" rev-parse HEAD)/" "$fixture/scripts/changelog.sh"
  commit "$fixture" "fix: before the first release"
  tag_off_main "$fixture" v0.1.0
  commit "$fixture" "feat: in the second release"
  tag_off_main "$fixture" v0.2.0
  git -C "$fixture" checkout -q release-v0.2.0
  commit "$fixture" "fix: only on the release branch"
  git -C "$fixture" tag v0.9.0
  git -C "$fixture" checkout -q main
  commit "$fixture" "fix: not released yet"
  (cd "$fixture" && ./scripts/changelog.sh 2>"$fixture/stderr")
  name="each off-main tag closes its release at the tag's main-side parent"
  first=$(section "$fixture" "## 0.1.0")
  second=$(section "$fixture" "## 0.2.0")
  unreleased=$(section "$fixture" "## Unreleased")
  if [[ $first == *"Before the first release"* && $second == *"In the second release"* &&
    $second != *"Before the first release"* && $unreleased == *"Not released yet"* &&
    $unreleased != *"In the second release"* ]]; then
    pass "$name"
  else
    fail "$name" "$(<"$fixture/CHANGELOG.md")"
  fi
  if [[ $(<"$fixture/stderr") == *"v0.9.0's parent is not in HEAD's history; skipped"* ]]; then
    pass "a tag whose parent is not in HEAD's history is skipped with a warning"
  else
    fail "a tag whose parent is not in HEAD's history is skipped with a warning" "$(<"$fixture/stderr")"
  fi

  name="--notes with the new tag already on HEAD gives the commits since the previous tag"
  git -C "$fixture" tag -d v0.9.0 >/dev/null
  commit "$fixture" "chore(release): F-Droid changelog for v0.3.0"
  git -C "$fixture" tag v0.3.0
  notes=$(notes_in "$fixture" v0.3.0 v0.2.0)
  if [[ $notes == *"Not released yet"* && $notes != *"In the second release"* && $notes != *"Before the first"* ]]; then
    pass "$name"
  else
    fail "$name" "$notes"
  fi
else
  echo "  SKIP  release tags off main — git-cliff not installed"
fi

echo
if ((FAIL)); then
  printf 'changelog tests: %d passed, %d FAILED\n' "$PASS" "$FAIL"
  exit 1
fi
printf 'changelog tests: %d passed\n' "$PASS"
