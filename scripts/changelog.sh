#!/usr/bin/env bash
# Regenerate CHANGELOG.md, or print one release's notes, from Conventional Commits.
# Never run a bare `git-cliff -o`: unbounded, it re-imports the pre-audit releases SPEC.md §2 deleted.
set -euo pipefail

readonly EXIT_USAGE=2

usage() {
  cat <<'USAGE'
usage: changelog.sh                regenerate CHANGELOG.md
       changelog.sh --notes <tag>  print the notes for <tag>: the commits since
                                   the latest vX.Y.Z tag (or the audit floor)

exit 0  ok
exit 2  usage error
USAGE
}

cd "$(git rev-parse --show-toplevel)"

# The commit that deleted the Flutter app and purged the false releases.
readonly AUDIT_FLOOR=9a63543
readonly NO_USER_FACING_CHANGES="No user-facing changes: every commit in this release is docs, chore, ci, build, refactor, style or test."

case ${1-} in
  "")
    git-cliff "${AUDIT_FLOOR}..HEAD" -o CHANGELOG.md
    echo "changelog: regenerated from ${AUDIT_FLOOR}..HEAD" >&2
    ;;
  --notes)
    tag=${2-}
    [[ -n $tag ]] || {
      usage >&2
      exit "$EXIT_USAGE"
    }
    previous=$(scripts/version.sh latest-tag)
    notes=$(git-cliff "${previous:-$AUDIT_FLOOR}..HEAD" --tag "$tag" --strip header)
    echo "$notes"
    [[ $notes == *"### "* ]] || printf '\n%s\n' "$NO_USER_FACING_CHANGES"
    ;;
  -h | --help)
    usage
    exit "$EXIT_USAGE"
    ;;
  *)
    usage >&2
    exit "$EXIT_USAGE"
    ;;
esac
