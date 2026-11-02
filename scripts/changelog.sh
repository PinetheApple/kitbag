#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_USAGE=2

usage() {
  cat <<'USAGE'
usage: changelog.sh
         regenerate CHANGELOG.md (fetch tags first); each vX.Y.Z tag off main
         closes its release at its parent on main
       changelog.sh --notes <tag> <previous-tag-or-empty>
         print GitHub release notes for <tag>: commit subjects since
         <previous-tag> (or the audit floor), or a link when too long

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
readonly GITHUB_RELEASE_BODY_MAX=125000
readonly NOTES_HEADROOM_CHARS=25000
readonly NOTES_MAX_CHARS=$((GITHUB_RELEASE_BODY_MAX - NOTES_HEADROOM_CHARS))
readonly NOTES_BODY='
{% for group, commits in commits | group_by(attribute="group") %}
### {{ group | upper_first }}
{% for commit in commits %}
- {% if commit.scope %}**{{ commit.scope }}:** {% endif %}{{ commit.message | upper_first }}
{%- endfor %}
{% endfor %}
'

# git-cliff only sees tags in HEAD's history.
clone_with_main_side_tags() {
  local clone=$1 tags tag commit
  tags=$(scripts/version.sh tags)
  git clone -q --no-checkout --no-tags . "$clone"
  git -C "$clone" update-ref --no-deref HEAD "$(git rev-parse HEAD)"
  for tag in $tags; do
    commit=$(git rev-parse "${tag}^{commit}")
    if ! git merge-base --is-ancestor "$commit" HEAD; then
      commit=$(git rev-parse "${commit}^")
      if ! git merge-base --is-ancestor "$commit" HEAD; then
        echo "changelog: ${tag}'s parent is not in HEAD's history; skipped" >&2
        continue
      fi
    fi
    git -C "$clone" tag "$tag" "$commit"
  done
}

case ${1-} in
  "")
    clone=$(mktemp -d)
    trap 'rm -rf "$clone"' EXIT
    clone_with_main_side_tags "$clone"
    git-cliff --repository "$clone" --config "$PWD/cliff.toml" "${AUDIT_FLOOR}..HEAD" -o "$PWD/CHANGELOG.md"
    echo "changelog: regenerated from ${AUDIT_FLOOR}..HEAD" >&2
    ;;
  --notes)
    tag=${2-}
    [[ -n $tag && $# -eq 3 ]] || {
      usage >&2
      exit "$EXIT_USAGE"
    }
    previous=$3
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
      printf 'These notes are too long for a GitHub release. See the commits at %s.\n' "$commits_url"
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
