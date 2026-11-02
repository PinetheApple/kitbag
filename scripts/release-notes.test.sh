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
readonly EXIT_OUT_OF_BOUNDS=3
readonly EXIT_GH_FAILED=4
readonly EXIT_GIT_FAILED=5

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
  commit "$dir" "Merge pull request #7 from owner/before-the-floor"
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

run_in() {
  local dir=$1
  shift
  (cd "$dir" && PATH="$dir/stub-bin:$PATH" ./scripts/release-notes.sh "$@")
}

readonly STDERR="$SCRATCH/stderr"

notes_in() {
  local dir=$1
  rm -rf "$dir/metadata"
  run_in "$dir" "$2" "$VERSION" >/dev/null 2>"$STDERR" &&
    cat "$dir/metadata/en-US/changelogs/${VERSION_CODE}.txt"
}

repeat() { printf "%${2}s" "" | sed "s/ /$1/g"; }

notes_of_lengths() {
  local dir=$1 char=$2 number=10 length
  shift 2
  for length in "$@"; do
    note_body "$dir" "$number" "$(repeat "$char" "$length")"
    merge_pr "$dir" "$number"
    number=$((number + 1))
  done
}

echo "collecting notes"
fixture=$(make_fixture)
note_body "$fixture" 1 "Tap tempo follows your taps."
merge_pr "$fixture" 1
git -C "$fixture" tag v0.26.1
note_body "$fixture" 2 "The tuner holds the last note."
merge_pr "$fixture" 2
note_body "$fixture" 3 "none"
merge_pr "$fixture" 3
note_body "$fixture" 4 ""
merge_pr "$fixture" 4
body "$fixture" 5 "## What changed"$'\n\nno block here\n'
merge_pr "$fixture" 5
note_body "$fixture" 6 $'  Stems keep\r\n   their    levels\r\n\r\nafter a restart.  '
merge_pr "$fixture" 6
since_first="${BULLET}The tuner holds the last note."$'\n'"${BULLET}Stems keep their levels after a restart."
check "from the audit floor, in merge order; NONE, empty and missing skipped; multi-line collapsed" \
  "$(notes_in "$fixture" "")" "${BULLET}Tap tempo follows your taps."$'\n'"${since_first}"
name="a missing block warns on stderr naming the PR; NONE and empty do not"
if grep -q '#5' "$STDERR" && ! grep -qE '#(3|4)\b' "$STDERR"; then
  pass "$name"
else
  fail "$name" "$(<"$STDERR")"
fi
check "a previous tag bounds the range" "$(notes_in "$fixture" v0.26.1)" "$since_first"

name="a gh failure aborts, naming the PR"
fixture=$(make_fixture)
merge_pr "$fixture" 8
notes_in "$fixture" "" >/dev/null
status=$?
if [[ $status -eq $EXIT_GH_FAILED && $(<"$STDERR") == *"#8"* ]]; then
  pass "$name"
else
  fail "$name" "exit $status, wanted $EXIT_GH_FAILED: $(<"$STDERR")"
fi

notes_in "$fixture" v9.9.9 >/dev/null
check "an unknown previous tag aborts" "$?" "$EXIT_GIT_FAILED"

echo "fallbacks"
fixture=$(make_fixture)
note_body "$fixture" 1 "NONE"
merge_pr "$fixture" 1
check "no notes: the maintenance line" "$(notes_in "$fixture" "")" "Maintenance release. Details: ${RELEASE_URL}"

echo "the 500-character limit"
name="exactly 500 characters is kept whole (bullets count once, not as bytes)"
fixture=$(make_fixture)
notes_of_lengths "$fixture" a 97 97 97 97 98
notes=$(notes_in "$fixture" "")
if ((${#notes} == CHANGELOG_LIMIT)) && [[ $notes != *"More:"* ]]; then
  pass "$name"
else
  fail "$name" "${#notes} characters: $notes"
fi

fixture=$(make_fixture)
notes_of_lengths "$fixture" a 97 97 97 97 99
line="${BULLET}$(repeat a 97)"
check "501 characters drops whole lines from the end and links the release, within 500" \
  "$(notes_in "$fixture" "")" "${line}"$'\n'"${line}"$'\n'"${line}"$'\n'"${line}"$'\n'"${MORE_LINE}"

fixture=$(make_fixture)
notes_of_lengths "$fixture" a 470 30
check "a single note over the limit leaves only the link" "$(notes_in "$fixture" "")" "$MORE_LINE"

name="multibyte notes are counted in characters"
fixture=$(make_fixture)
notes_of_lengths "$fixture" é 97 97 97 97 98
notes=$(notes_in "$fixture" "")
if ((${#notes} == CHANGELOG_LIMIT)) && [[ $notes != *"More:"* ]] && (($(printf '%s' "$notes" | wc -c) > CHANGELOG_LIMIT)); then
  pass "$name"
else
  fail "$name" "${#notes} characters: $notes"
fi

echo "the changelog file"
fixture=$(make_fixture)
note_body "$fixture" 1 "Tap tempo follows your taps."
merge_pr "$fixture" 1
check "prints the path it wrote: <versionCode>.txt (0.26.2 -> 2602.txt)" \
  "$(run_in "$fixture" "" "$VERSION" 2>/dev/null)" "metadata/en-US/changelogs/${VERSION_CODE}.txt"
run_in "$fixture" "" 0.100.0 >/dev/null 2>&1
check "an out-of-bounds version is refused" "$?" "$EXIT_OUT_OF_BOUNDS"

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
