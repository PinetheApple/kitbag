#!/usr/bin/env bash
set -uo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
readonly REPO
SCRATCH=$(mktemp -d) || exit 1
readonly SCRATCH
trap 'rm -rf "$SCRATCH"' EXIT
export LC_ALL=C.UTF-8

readonly EXIT_OK=0
readonly EXIT_NO_NOTE=1
readonly EXIT_USAGE=2
readonly EXIT_GH_FAILED=3

readonly CHANGELOG_LIMIT=500
readonly VERSION=0.26.2
readonly VERSION_CODE=2602
readonly BULLET='• '

REPO_URL=$(sed -n 's/^readonly REPO_URL=\(.*\)$/\1/p' "$REPO/scripts/changelog.sh")
readonly REPO_URL
if [[ -z $REPO_URL ]]; then
  echo "release-notes.test: cannot read REPO_URL from scripts/changelog.sh" >&2
  exit 1
fi
readonly RELEASE_URL="${REPO_URL}/releases/tag/v${VERSION}"
readonly MORE_LINE="More: ${RELEASE_URL}"

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

check() {
  local name=$1 got=$2 want=$3
  if [[ $got == "$want" ]]; then
    pass "$name"
  else
    fail "$name" "got:  '$got'"$'\n'"want: '$want'"
  fi
}

commit() {
  git -C "$1" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "$2"
}

make_fixture() {
  local dir floor
  dir=$(mktemp -d "$SCRATCH/repo.XXXXXX")
  mkdir -p "$dir/scripts" "$dir/stub-bin" "$dir/bodies"
  cp "$REPO/scripts/release-notes.sh" "$REPO/scripts/version.sh" "$dir/scripts/"
  git -C "$dir" init -q -b main
  commit "$dir" "chore: before the floor (#7)"
  commit "$dir" "chore: the floor"
  floor=$(git -C "$dir" rev-parse HEAD)
  sed "s/^readonly AUDIT_FLOOR=.*/readonly AUDIT_FLOOR=${floor}/" "$REPO/scripts/changelog.sh" > "$dir/scripts/changelog.sh"
  cat > "$dir/stub-bin/gh" <<STUB
#!/usr/bin/env bash
body=$(printf %q "$dir/bodies")/\$3
[[ "\$1 \$2" == "pr view" && -f \$body ]] || { echo "no pull requests found for \$3" >&2; exit 1; }
cat "\$body"
STUB
  chmod +x "$dir/stub-bin/gh"
  printf '/stub-bin/\n/bodies/\n/metadata/\n/scripts/\n' > "$dir/.git/info/exclude"
  echo "$dir"
}

body() { printf '%s' "$3" > "$1/bodies/$2"; }

note_body() { body "$1" "$2" "## What changed"$'\n\n```release-note\n'"$3"$'\n```\n'; }

merge_pr() {
  local dir=$1 number=$2
  git -C "$dir" checkout -q -b "topic-$number"
  commit "$dir" "feat: branch work (#99)"
  git -C "$dir" checkout -q main
  git -C "$dir" -c user.email=t@t -c user.name=t merge -q --no-ff -m "Merge pull request #${number} from owner/topic-${number}" "topic-$number"
}

squash_pr() { commit "$1" "fix: squashed change (#$2)"; }

run_in() {
  local dir=$1
  shift
  (cd "$dir" && PATH="$dir/stub-bin:$PATH" ./scripts/release-notes.sh "$@")
}

repeat() { printf "%${2}s" "" | sed "s/ /$1/g"; }

notes_of_lengths() {
  local dir=$1 char=$2 number=10 length
  shift 2
  for length in "$@"; do
    note_body "$dir" "$number" "$(repeat "$char" "$length")"
    squash_pr "$dir" "$number"
    number=$((number + 1))
  done
}

echo "collecting notes"
fixture=$(make_fixture)
note_body "$fixture" 1 "Tap tempo follows your taps."
merge_pr "$fixture" 1
note_body "$fixture" 2 "The tuner holds the last note."
squash_pr "$fixture" 2
note_body "$fixture" 3 "none"
merge_pr "$fixture" 3
note_body "$fixture" 4 ""
merge_pr "$fixture" 4
body "$fixture" 5 "## What changed"$'\n\nno block here\n'
merge_pr "$fixture" 5
note_body "$fixture" 6 $'  Stems keep\r\n   their    levels\r\n\r\nafter a restart.  '
merge_pr "$fixture" 6
stderr="$SCRATCH/stderr"
notes=$(run_in "$fixture" --print "" "$VERSION" 2>"$stderr")
status=$?
want="${BULLET}Tap tempo follows your taps."$'\n'"${BULLET}The tuner holds the last note."$'\n'"${BULLET}Stems keep their levels after a restart."
check "merge and squash subjects, in merge order; NONE, empty and missing skipped; multi-line collapsed" "$notes" "$want"
check "a full run exits ok" "$status" "$EXIT_OK"
if grep -q '#5' "$stderr" && ! grep -qE '#(3|4)\b' "$stderr"; then
  pass "a missing block warns on stderr naming the PR; NONE and empty do not"
else
  fail "a missing block warns on stderr naming the PR" "$(<"$stderr")"
fi
if [[ $notes != *"#7"* ]]; then
  pass "no previous tag starts at changelog.sh's audit floor"
else
  fail "no previous tag starts at changelog.sh's audit floor" "$notes"
fi

git -C "$fixture" tag v0.26.1 HEAD~5
check "a previous tag bounds the range" \
  "$(run_in "$fixture" --print v0.26.1 "$VERSION" 2>/dev/null)" \
  "${BULLET}The tuner holds the last note."$'\n'"${BULLET}Stems keep their levels after a restart."

fixture=$(make_fixture)
merge_pr "$fixture" 8
output=$(run_in "$fixture" --print "" "$VERSION" 2>&1)
status=$?
if [[ $status -eq $EXIT_GH_FAILED && $output == *"#8"* ]]; then
  pass "a gh failure aborts, naming the PR"
else
  fail "a gh failure aborts (exit $status, wanted $EXIT_GH_FAILED)" "$output"
fi

echo "fallbacks"
fixture=$(make_fixture)
note_body "$fixture" 1 "NONE"
merge_pr "$fixture" 1
check "no notes: the maintenance line" "$(run_in "$fixture" --print "" "$VERSION" 2>/dev/null)" \
  "Maintenance release. Details: ${RELEASE_URL}"

echo "the 500-character limit"
fixture=$(make_fixture)
notes_of_lengths "$fixture" a 97 97 97 97 98
notes=$(run_in "$fixture" --print "" "$VERSION" 2>/dev/null)
if ((${#notes} == CHANGELOG_LIMIT)) && [[ $notes != *"More:"* ]]; then
  pass "exactly 500 characters is kept whole (bullets count once, not as bytes)"
else
  fail "exactly 500 characters is kept whole (${#notes} chars)" "$notes"
fi

fixture=$(make_fixture)
notes_of_lengths "$fixture" a 97 97 97 97 99
notes=$(run_in "$fixture" --print "" "$VERSION" 2>/dev/null)
line="${BULLET}$(repeat a 97)"
want="${line}"$'\n'"${line}"$'\n'"${line}"$'\n'"${line}"$'\n'"${MORE_LINE}"
check "501 characters drops whole lines from the end and links the release" "$notes" "$want"
if ((${#notes} <= CHANGELOG_LIMIT)); then
  pass "the trimmed text, More link included, fits in 500"
else
  fail "the trimmed text fits in 500 (${#notes} chars)" "$notes"
fi

fixture=$(make_fixture)
notes_of_lengths "$fixture" a 470 30
check "a single note over the limit leaves only the link" \
  "$(run_in "$fixture" --print "" "$VERSION" 2>/dev/null)" "$MORE_LINE"

fixture=$(make_fixture)
notes_of_lengths "$fixture" é 97 97 97 97 98
notes=$(run_in "$fixture" --print "" "$VERSION" 2>/dev/null)
if ((${#notes} == CHANGELOG_LIMIT)) && [[ $notes != *"More:"* ]] && (($(printf '%s' "$notes" | wc -c) > CHANGELOG_LIMIT)); then
  pass "multibyte notes are counted in characters"
else
  fail "multibyte notes are counted in characters (${#notes} chars)" "$notes"
fi

echo "the changelog file"
fixture=$(make_fixture)
note_body "$fixture" 1 "Tap tempo follows your taps."
merge_pr "$fixture" 1
stdout=$(run_in "$fixture" "" "$VERSION" 2>/dev/null)
file="$fixture/metadata/en-US/changelogs/${VERSION_CODE}.txt"
if [[ -f $file && $(<"$file") == "${BULLET}Tap tempo follows your taps." && -z $stdout ]]; then
  pass "writes metadata/en-US/changelogs/<versionCode>.txt (0.26.2 -> 2602.txt), nothing on stdout"
else
  fail "writes ${VERSION_CODE}.txt" "$(ls -R "$fixture/metadata" 2>&1) stdout: $stdout"
fi
run_in "$fixture" "" 0.100.0 >/dev/null 2>&1
check "an out-of-bounds version is refused" "$?" "$EXIT_USAGE"

echo "--check-body"
check_body() { printf '%s' "$1" | "$REPO/scripts/release-notes.sh" --check-body >/dev/null 2>&1; echo $?; }
check "a note passes" "$(check_body $'```release-note\nTap tempo follows your taps.\n```')" "$EXIT_OK"
check "NONE passes" "$(check_body $'intro\n```release-note\nNONE\n```\n')" "$EXIT_OK"
check "a CRLF body passes" "$(check_body $'intro\r\n```release-note\r\nNONE\r\n```\r\n')" "$EXIT_OK"
check "a missing block fails" "$(check_body $'## What changed\n\nstuff\n')" "$EXIT_NO_NOTE"
check "an empty block fails" "$(check_body $'```release-note\n\n```\n')" "$EXIT_NO_NOTE"
check "an unclosed block fails" "$(check_body $'```release-note\nTap tempo\n')" "$EXIT_NO_NOTE"
check "an empty body fails" "$(check_body '')" "$EXIT_NO_NOTE"

echo "usage"
"$REPO/scripts/release-notes.sh" --help >/dev/null 2>&1
check "--help exits with the usage code" "$?" "$EXIT_USAGE"
"$REPO/scripts/release-notes.sh" "$VERSION" >/dev/null 2>&1
check "a missing argument is a usage error" "$?" "$EXIT_USAGE"

echo
if ((FAIL)); then
  printf 'release-notes tests: %d passed, %d FAILED\n' "$PASS" "$FAIL"
  exit 1
fi
printf 'release-notes tests: %d passed\n' "$PASS"
