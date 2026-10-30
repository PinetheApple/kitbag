#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_USAGE=2

usage() {
  cat <<'USAGE'
usage: changelog.sh                regenerate CHANGELOG.md (fetch tags first)
       changelog.sh --notes <tag>  print GitHub release notes for <tag>: commit
                                   subjects since the latest vX.Y.Z tag (or the
                                   audit floor), or a link when too long

exit 0  ok
exit 2  usage error
USAGE
}

cd "$(git rev-parse --show-toplevel)"

# Never run git-cliff unbounded: it re-imports the pre-audit releases SPEC.md §2
# deleted. This is the commit that purged them.
readonly AUDIT_FLOOR=9a63543
readonly REPO_URL=https://github.com/PinetheApple/kitbag
readonly NO_USER_FACING_CHANGES="No user-facing changes in this release."
# GitHub rejects a release body over 125000 characters.
readonly NOTES_MAX_CHARS=100000
readonly NOTES_BODY='
{% for group, commits in commits | group_by(attribute="group") %}
### {{ group | upper_first }}
{% for commit in commits %}
- {% if commit.scope %}**{{ commit.scope }}:** {% endif %}{{ commit.message | upper_first }}
{%- endfor %}
{% endfor %}
'

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
    notes=$(git-cliff "${previous:-$AUDIT_FLOOR}..HEAD" --tag "$tag" --body "$NOTES_BODY" --strip all)
    notes=${notes#"${notes%%[![:space:]]*}"}
    if [[ $notes != *"### "* ]]; then
      echo "$NO_USER_FACING_CHANGES"
    elif ((${#notes} > NOTES_MAX_CHARS)); then
      if [[ -n $previous ]]; then
        commits_url="${REPO_URL}/compare/${previous}...${tag}"
      else
        commits_url="${REPO_URL}/commits/${tag}"
      fi
      printf 'These notes are too long for a GitHub release. See %s and the commits at %s.\n' \
        "${REPO_URL}/blob/main/CHANGELOG.md" "$commits_url"
    else
      echo "$notes"
    fi
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
