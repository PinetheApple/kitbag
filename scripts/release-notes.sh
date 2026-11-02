#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C.UTF-8

readonly EXIT_OK=0
readonly EXIT_NO_NOTE=1
readonly EXIT_USAGE=2
readonly EXIT_GH_FAILED=3

readonly CHANGELOG_LIMIT=500
readonly CHANGELOG_DIR=metadata/en-US/changelogs
readonly BULLET='• '
readonly NONE_NOTE=NONE
readonly MERGE_SUBJECT_RE='^Merge pull request #([0-9]+) '
readonly SQUASH_SUBJECT_RE='\(#([0-9]+)\)$'

usage() {
  cat <<USAGE
usage: release-notes.sh [--print] <previous-tag-or-empty> <version>
       release-notes.sh --check-body < pr-body

Collects the \`\`\`release-note block of every PR merged since <previous-tag>
(first-parent history; changelog.sh's audit floor when empty) and writes
${CHANGELOG_DIR}/<versionCode>.txt for F-Droid: one "${BULLET}note" line each,
at most ${CHANGELOG_LIMIT} characters. Blocks reading ${NONE_NOTE} or empty are skipped; a
missing block is skipped with a warning.

  --print       write the notes to stdout instead of the file
  --check-body  fail unless the PR body on stdin has a non-empty release-note block

exit ${EXIT_OK}  ok
exit ${EXIT_NO_NOTE}  --check-body: no release-note block, or an empty one
exit ${EXIT_USAGE}  usage error, or a version out of versionCode bounds
exit ${EXIT_GH_FAILED}  gh could not read a PR body
USAGE
}

die() {
  echo "release-notes: $1" >&2
  exit "$2"
}

# Prints the first closed block, whitespace collapsed; fails when there is none.
extract_note() {
  awk '
    { sub(/\r$/, "") }
    !open && /^[[:space:]]*```release-note[[:space:]]*$/ { open = 1; note = ""; next }
    open && /^[[:space:]]*```[[:space:]]*$/ { closed = 1; exit }
    open { note = note " " $0 }
    END {
      if (!closed) exit 1
      gsub(/[[:space:]]+/, " ", note)
      sub(/^ /, "", note)
      sub(/ $/, "", note)
      print note
    }
  '
}

changelog_constant() {
  local value
  value=$(sed -n "s/^readonly $1=\(.*\)\$/\1/p" scripts/changelog.sh)
  [[ -n $value ]] || die "cannot read $1 from scripts/changelog.sh" "$EXIT_USAGE"
  echo "$value"
}

pr_numbers() {
  git log --first-parent --reverse --format=%s "$1..HEAD" |
    while IFS= read -r subject; do
      if [[ $subject =~ $MERGE_SUBJECT_RE || $subject =~ $SQUASH_SUBJECT_RE ]]; then
        echo "${BASH_REMATCH[1]}"
      fi
    done |
    awk '!seen[$0]++'
}

collect_notes() {
  local range_start=$1 number pr_body note
  for number in $(pr_numbers "$range_start"); do
    pr_body=$(gh pr view "$number" --json body -q .body) ||
      die "gh could not read the body of PR #${number}" "$EXIT_GH_FAILED"
    if ! note=$(extract_note <<<"$pr_body"); then
      echo "release-notes: warning: PR #${number} has no release-note block; skipped" >&2
      continue
    fi
    [[ -z $note || ${note^^} == "$NONE_NOTE" ]] && continue
    echo "${BULLET}${note}"
  done
}

# F-Droid strips the text before applying the limit, so the trailing newline is free.
fit_to_limit() {
  local more=$1 text="" candidate line
  local -a lines
  mapfile -t lines
  printf -v text '%s\n' "${lines[@]}"
  text=${text%$'\n'}
  if ((${#text} <= CHANGELOG_LIMIT)); then
    echo "$text"
    return
  fi
  text=""
  for line in "${lines[@]}"; do
    candidate="${text}${line}"$'\n'
    ((${#candidate} + ${#more} <= CHANGELOG_LIMIT)) || break
    text=$candidate
  done
  echo "${text}${more}"
}

check_body() {
  local note
  if note=$(extract_note) && [[ -n $note ]]; then
    exit "$EXIT_OK"
  fi
  die 'the PR body needs a ```release-note block holding one user-facing line, or NONE' "$EXIT_NO_NOTE"
}

print=0
args=()
while (($#)); do
  case $1 in
    --print) print=1 ;;
    --check-body) check_body ;;
    -h | --help)
      usage
      exit "$EXIT_USAGE"
      ;;
    -*) die "unknown option $1" "$EXIT_USAGE" ;;
    *) args+=("$1") ;;
  esac
  shift
done
if ((${#args[@]} != 2)); then
  usage >&2
  exit "$EXIT_USAGE"
fi
previous=${args[0]}
version=${args[1]}

cd "$(git rev-parse --show-toplevel)"

code=$(scripts/version.sh code "$version") || die "no versionCode for '${version}'" "$EXIT_USAGE"
release_url="$(changelog_constant REPO_URL)/releases/tag/v${version}"
notes=$(collect_notes "${previous:-$(changelog_constant AUDIT_FLOOR)}")
if [[ -z $notes ]]; then
  text="Maintenance release. Details: ${release_url}"
else
  text=$(fit_to_limit "More: ${release_url}" <<<"$notes")
fi

if ((print)); then
  echo "$text"
else
  mkdir -p "$CHANGELOG_DIR"
  echo "$text" > "${CHANGELOG_DIR}/${code}.txt"
  echo "release-notes: wrote ${CHANGELOG_DIR}/${code}.txt (${#text} characters)" >&2
fi
