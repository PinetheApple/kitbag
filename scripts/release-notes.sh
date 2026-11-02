#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C.UTF-8

readonly EXIT_OK=0
readonly EXIT_NO_NOTE=1
readonly EXIT_USAGE=2
readonly EXIT_OUT_OF_BOUNDS=3
readonly EXIT_GH_FAILED=4
readonly EXIT_GIT_FAILED=5
readonly EXIT_NO_CONSTANT=6

readonly CHANGELOG_LIMIT=500
readonly CHANGELOG_DIR=metadata/en-US/changelogs
readonly BULLET='• '
readonly NONE_NOTE=NONE
readonly MERGE_SUBJECT_RE='^Merge pull request #([0-9]+) '

usage() {
  cat <<USAGE
usage: release-notes.sh <previous-tag-or-empty> <version>
       release-notes.sh --check-body < pr-body

Collects the \`\`\`release-note block of every PR merged since <previous-tag>
(first-parent history; changelog.sh's audit floor when empty), writes
${CHANGELOG_DIR}/<versionCode>.txt for F-Droid and prints its path: one
"${BULLET}note" line each, at most ${CHANGELOG_LIMIT} characters. Blocks reading ${NONE_NOTE} or
empty are skipped; a missing block is skipped with a warning.

  --check-body  fail unless the PR body on stdin has a non-empty release-note block

exit ${EXIT_OK}  ok
exit ${EXIT_NO_NOTE}  --check-body: no release-note block, or an empty one
exit ${EXIT_USAGE}  usage error
exit ${EXIT_OUT_OF_BOUNDS}  version out of versionCode bounds
exit ${EXIT_GH_FAILED}  gh could not read a PR body
exit ${EXIT_GIT_FAILED}  git could not list the commits since <previous-tag>
exit ${EXIT_NO_CONSTANT}  cannot read a constant from scripts/changelog.sh
USAGE
}

die() {
  echo "release-notes: $1" >&2
  exit "$2"
}

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
  [[ -n $value ]] || die "cannot read $1 from scripts/changelog.sh" "$EXIT_NO_CONSTANT"
  echo "$value"
}

pr_numbers() {
  local subject
  while IFS= read -r subject; do
    if [[ $subject =~ $MERGE_SUBJECT_RE ]]; then
      echo "${BASH_REMATCH[1]}"
    fi
  done <<<"$1"
}

collect_notes() {
  local number pr_body note
  for number in $1; do
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
  local more_line=$1 text="" candidate line
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
    ((${#candidate} + ${#more_line} <= CHANGELOG_LIMIT)) || break
    text=$candidate
  done
  echo "${text}${more_line}"
}

check_body() {
  local note
  if note=$(extract_note) && [[ -n $note ]]; then
    exit "$EXIT_OK"
  fi
  die 'the PR body needs a ```release-note block holding one user-facing line, or NONE' "$EXIT_NO_NOTE"
}

args=()
while (($#)); do
  case $1 in
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

code=$(scripts/version.sh code "$version") || exit
release_url="$(changelog_constant REPO_URL)/releases/tag/v${version}"
range_start=$previous
[[ -n $range_start ]] || range_start=$(changelog_constant AUDIT_FLOOR)
subjects=$(git log --first-parent --reverse --format=%s "${range_start}..HEAD") ||
  die "git could not list the commits in ${range_start}..HEAD" "$EXIT_GIT_FAILED"
notes=$(collect_notes "$(pr_numbers "$subjects")")
if [[ -z $notes ]]; then
  text="Maintenance release. Details: ${release_url}"
else
  text=$(fit_to_limit "More: ${release_url}" <<<"$notes")
fi

mkdir -p "$CHANGELOG_DIR"
echo "$text" > "${CHANGELOG_DIR}/${code}.txt"
echo "${CHANGELOG_DIR}/${code}.txt"
