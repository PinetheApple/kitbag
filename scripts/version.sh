#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_DRIFT=1
readonly EXIT_USAGE=2
readonly EXIT_OUT_OF_BOUNDS=3
readonly EXIT_NOTHING_TO_RELEASE=4

readonly SEMVER_RE='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
readonly TAG_PREFIX=v
readonly MAX_MINOR=99
readonly MAX_PATCH=99
readonly CODE_PER_MAJOR=10000
readonly CODE_PER_MINOR=100
readonly MIN_VERSION_CODE=1
readonly MAX_VERSION_CODE=2100000000

readonly BREAKING_SUBJECT_RE='^[a-zA-Z]+(\([^)]*\))?!:'
readonly BREAKING_FOOTER_RE='^BREAKING[ -]CHANGE:'
readonly FEAT_SUBJECT_RE='^feat(\([^)]*\))?!?:'

cd "$(git rev-parse --show-toplevel)"

readonly APP_JSON=packages/app-shell/app.json
readonly MIRRORS=(package.json packages/app-shell/package.json)

usage() {
  cat <<'USAGE'
usage: version.sh current | set <major.minor.patch> | check
       version.sh next | latest-tag | code <major.minor.patch | vX.Y.Z>

  current     print the version app.json holds (the release floor)
  set         write <version> to app.json and the package.json mirrors
  check       fail if a mirror disagrees with app.json
  next        print the next release version: bump the latest vX.Y.Z tag by the
              commits since it, never below app.json; app.json itself if untagged
  latest-tag  print the highest vX.Y.Z tag, or nothing
  code        print the Android versionCode for <version>:
              major*10000 + minor*100 + patch, with minor and patch <= 99 and
              the code in 1..2100000000 (the Play Store cap); semver order
              then equals versionCode order

Bump: breaking (! or BREAKING CHANGE) -> major, or minor below 1.0.0;
feat -> minor; anything else -> patch.

exit 0  ok
exit 1  versions have drifted
exit 2  usage error
exit 3  version out of versionCode bounds (minor, patch <= 99)
exit 4  no commits since the latest tag
USAGE
}

die() {
  echo "version: $1" >&2
  exit "$2"
}

require_semver() {
  [[ $1 =~ $SEMVER_RE ]] || die "expected major.minor.patch, got '$1'" "$EXIT_USAGE"
}

read_json_version() {
  node -e 'const v=require(`./${process.argv[1]}`);console.log(process.argv[1].endsWith("app.json")?v.expo.version:v.version)' "$1"
}

write_json_version() {
  node -e '
    const fs = require("fs");
    const [file, version] = process.argv.slice(1);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    if (file.endsWith("app.json")) json.expo.version = version;
    else json.version = version;
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  ' "$1" "$2"
}

# Mirrored in android/app/build.gradle; CI and the release gate compare the built APK against this.
version_code() {
  local major minor patch code
  IFS=. read -r major minor patch <<<"$1"
  code=$((major * CODE_PER_MAJOR + minor * CODE_PER_MINOR + patch))
  if ((minor > MAX_MINOR || patch > MAX_PATCH || code < MIN_VERSION_CODE || code > MAX_VERSION_CODE)); then
    return "$EXIT_OUT_OF_BOUNDS"
  fi
  echo "$code"
}

latest_tag() {
  git tag -l "${TAG_PREFIX}*" |
    { grep -E "^${TAG_PREFIX}${SEMVER_RE:1}" || true; } |
    sort -V |
    tail -1
}

version_at_least() {
  local a b i
  IFS=. read -ra a <<<"$1"
  IFS=. read -ra b <<<"$2"
  for i in 0 1 2; do
    if ((a[i] != b[i])); then
      ((a[i] > b[i]))
      return
    fi
  done
}

bumped_version() {
  local tag=$1 range major minor patch subjects bodies
  range="${tag}..HEAD"
  (($(git rev-list --count "$range") > 0)) ||
    die "nothing to release: no commits since ${tag}" "$EXIT_NOTHING_TO_RELEASE"
  IFS=. read -r major minor patch <<<"${tag#"$TAG_PREFIX"}"
  subjects=$(git log --format=%s "$range")
  bodies=$(git log --format=%b "$range")
  if grep -qE "$BREAKING_SUBJECT_RE" <<<"$subjects" || grep -qE "$BREAKING_FOOTER_RE" <<<"$bodies"; then
    if ((major > 0)); then
      echo "$((major + 1)).0.0"
    else
      echo "0.$((minor + 1)).0"
    fi
  elif grep -qE "$FEAT_SUBJECT_RE" <<<"$subjects"; then
    echo "${major}.$((minor + 1)).0"
  else
    echo "${major}.${minor}.$((patch + 1))"
  fi
}

next_version() {
  local floor tag candidate
  floor=$(read_json_version "$APP_JSON")
  require_semver "$floor"
  tag=$(latest_tag)
  candidate=$floor
  if [[ -n $tag ]]; then
    candidate=$(bumped_version "$tag")
    version_at_least "$candidate" "$floor" || candidate=$floor
  fi
  version_code "$candidate" >/dev/null ||
    die "next version ${candidate} is out of bounds (minor and patch <= ${MAX_MINOR}); raise the floor in ${APP_JSON} with 'scripts/version.sh set' in a PR" "$EXIT_OUT_OF_BOUNDS"
  echo "$candidate"
}

for arg in "$@"; do
  if [[ $arg == -h || $arg == --help ]]; then
    usage
    exit "$EXIT_USAGE"
  fi
done

case ${1-} in
  current)
    read_json_version "$APP_JSON"
    ;;
  set)
    version=${2-}
    require_semver "$version"
    write_json_version "$APP_JSON" "$version"
    for mirror in "${MIRRORS[@]}"; do
      write_json_version "$mirror" "$version"
    done
    echo "version: set to ${version} in ${APP_JSON} ${MIRRORS[*]}"
    ;;
  check)
    source_version=$(read_json_version "$APP_JSON")
    drifted=()
    for mirror in "${MIRRORS[@]}"; do
      mirror_version=$(read_json_version "$mirror")
      [[ $mirror_version == "$source_version" ]] || drifted+=("${mirror} (${mirror_version})")
    done
    if ((${#drifted[@]})); then
      echo "version: ${APP_JSON} says ${source_version}, but ${drifted[*]}" >&2
      echo "  run: scripts/version.sh set ${source_version}" >&2
      exit "$EXIT_DRIFT"
    fi
    echo "version: ${source_version}, no drift"
    ;;
  next)
    next_version
    ;;
  latest-tag)
    latest_tag
    ;;
  code)
    version=${2-}
    [[ $version != "$TAG_PREFIX"* ]] || version=${version#"$TAG_PREFIX"}
    require_semver "$version"
    version_code "$version" ||
      die "${version} is out of bounds (minor and patch <= ${MAX_MINOR}, versionCode ${MIN_VERSION_CODE}..${MAX_VERSION_CODE})" "$EXIT_OUT_OF_BOUNDS"
    ;;
  *)
    usage >&2
    exit "$EXIT_USAGE"
    ;;
esac
