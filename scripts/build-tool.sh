#!/usr/bin/env bash
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_BUILD_FAILED=1
readonly EXIT_CANNOT_BUILD=2
readonly EXIT_USAGE=3

SCRIPTS=$(cd "$(dirname "$0")" && pwd)
readonly SCRIPTS
readonly CLI="$SCRIPTS/../packages/app-shell/src/toolBuild/cli.ts"

usage() {
  cat <<USAGE
usage: build-tool.sh [--out DIR] [--host-version X.Y.Z] <tool-package>

Builds <tool-package> into DIR/tool-<id>-<version>.kbt: manifest.json,
bundle.hbc from the host's own hermesc, and the package's assets/. The bundle
is unsigned; sign-tools.sh signs it. Fails if the tool imports anything off the
downloadable allowlist, or if its bundle writes a host global. The JavaScript
it compiled stays in DIR/build/<id>/.

--out           output directory (default dist/tools)
--host-version  the host release the tool is built for (default: version.sh current)

exit ${EXIT_OK}  built
exit ${EXIT_BUILD_FAILED}  the build failed (reason above)
exit ${EXIT_CANNOT_BUILD}  cannot build (no node, or version.sh failed)
exit ${EXIT_USAGE}  usage error
USAGE
}

fail() {
  echo "build-tool: FAIL — $1" >&2
  exit "$2"
}

out_dir=$(cd "$SCRIPTS/.." && pwd)/dist/tools
host_version=""
args=()
while (($#)); do
  case $1 in
    --out)
      [[ -n ${2-} ]] || fail "--out needs a directory" "$EXIT_USAGE"
      out_dir=$2
      shift
      ;;
    --host-version)
      [[ -n ${2-} ]] || fail "--host-version needs a version" "$EXIT_USAGE"
      host_version=$2
      shift
      ;;
    -h | --help)
      usage
      exit "$EXIT_USAGE"
      ;;
    -*) fail "unknown option $1" "$EXIT_USAGE" ;;
    *) args+=("$1") ;;
  esac
  shift
done

if ((${#args[@]} != 1)); then
  usage >&2
  exit "$EXIT_USAGE"
fi
readonly TOOL_DIR=${args[0]}
[[ -f $TOOL_DIR/package.json ]] || fail "no package.json in $TOOL_DIR" "$EXIT_USAGE"
command -v node >/dev/null || fail "node not found" "$EXIT_CANNOT_BUILD"

if [[ -z $host_version ]]; then
  host_version=$("$SCRIPTS/version.sh" current) || fail "version.sh current failed" "$EXIT_CANNOT_BUILD"
fi
host_code=$("$SCRIPTS/version.sh" code "$host_version") || fail "invalid host version '$host_version'" "$EXIT_USAGE"
mkdir -p "$out_dir" || fail "cannot create $out_dir" "$EXIT_CANNOT_BUILD"

kbt=$(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$CLI" build \
  --out "$out_dir" --host-version "$host_version" --host-version-code "$host_code" "$TOOL_DIR") ||
  fail "could not build $TOOL_DIR (reason above)" "$EXIT_BUILD_FAILED"

echo "build-tool: ok — $kbt (host $host_version)"
exit "$EXIT_OK"
