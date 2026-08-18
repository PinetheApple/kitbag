#!/usr/bin/env bash
# The app version: read it, set it, or check nothing has drifted from it.
#
# packages/app-shell/app.json is the one owner (SPEC §13.7). Gradle derives
# versionName and versionCode from it at configure time, so the APK cannot
# disagree with it. The two package.json versions are copies for tooling that
# reads them, and `check` is what keeps them copies rather than a second source.
set -euo pipefail

readonly EXIT_DRIFT=1
readonly EXIT_USAGE=2

cd "$(git rev-parse --show-toplevel)"

readonly APP_JSON=packages/app-shell/app.json
readonly MIRRORS=(package.json packages/app-shell/package.json)

usage() {
  cat <<'USAGE'
usage: version.sh current
       version.sh set <major.minor.patch>
       version.sh check

  current   print the version app.json holds
  set       write <version> to app.json and the package.json mirrors
  check     fail if a mirror disagrees with app.json

exit 0  ok
exit 1  versions have drifted
exit 2  usage error
USAGE
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

case ${1-} in
  current)
    read_json_version "$APP_JSON"
    ;;
  set)
    version=${2-}
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "version: expected major.minor.patch, got '${version}'" >&2
      exit "$EXIT_USAGE"
    fi
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
  -h | --help)
    usage
    exit "$EXIT_USAGE"
    ;;
  *)
    usage >&2
    exit "$EXIT_USAGE"
    ;;
esac
