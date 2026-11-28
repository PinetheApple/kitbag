#!/usr/bin/env bash
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_REJECTED=1
readonly EXIT_CANNOT_CHECK=2
readonly EXIT_USAGE=3

SCRIPTS=$(cd "$(dirname "$0")" && pwd)
readonly SCRIPTS
readonly CLI="$SCRIPTS/../packages/app-shell/src/toolBuild/cli.ts"

usage() {
  cat <<USAGE
usage: tools-gate.sh --keys <tool-keys.json> [--host-version X.Y.Z] [--release] <dir>

Fails unless the signed tool set in <dir> is fit to ship: tools-index.json and
every manifest.sig verify with a current or next tool key pinned in
<tool-keys.json>; every .kbt matches the index's size and hashes and holds only
the files its manifest lists, each matching its hash and size; the bytecode is
this checkout's hermesc version and the runtime pins are its installed versions;
the index is for --host-version (default: version.sh current).

--release also refuses any test- key, in the pin file or as a signer.

exit ${EXIT_OK}  passed
exit ${EXIT_REJECTED}  the set failed a check (each listed above)
exit ${EXIT_CANNOT_CHECK}  cannot check (no node, or version.sh failed)
exit ${EXIT_USAGE}  usage error
USAGE
}

fail() {
  echo "tools-gate: FAIL — $1" >&2
  exit "$2"
}

keys=""
host_version=""
release=()
args=()
while (($#)); do
  case $1 in
    --keys | --host-version)
      [[ -n ${2-} ]] || fail "$1 needs a value" "$EXIT_USAGE"
      if [[ $1 == --keys ]]; then keys=$2; else host_version=$2; fi
      shift
      ;;
    --release) release=(--release) ;;
    -h | --help)
      usage
      exit "$EXIT_USAGE"
      ;;
    -*) fail "unknown option $1" "$EXIT_USAGE" ;;
    *) args+=("$1") ;;
  esac
  shift
done

if ((${#args[@]} != 1)) || [[ -z $keys ]]; then
  usage >&2
  exit "$EXIT_USAGE"
fi
readonly DIR=${args[0]}
[[ -d $DIR ]] || fail "no such directory: $DIR" "$EXIT_USAGE"
[[ -r $keys ]] || fail "cannot read the pin file $keys" "$EXIT_USAGE"
command -v node >/dev/null || fail "node not found" "$EXIT_CANNOT_CHECK"

if [[ -z $host_version ]]; then
  host_version=$("$SCRIPTS/version.sh" current) || fail "version.sh current failed" "$EXIT_CANNOT_CHECK"
fi
host_code=$("$SCRIPTS/version.sh" code "$host_version") || fail "invalid host version '$host_version'" "$EXIT_USAGE"

node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$CLI" gate --keys "$keys" \
  --host-version "$host_version" --host-version-code "$host_code" ${release[@]+"${release[@]}"} "$DIR" ||
  fail "$DIR is not fit to ship (each problem above)" "$EXIT_REJECTED"

echo "tools-gate: ok — $DIR verified against $keys for host $host_version${release[*]:+, release keys only}"
exit "$EXIT_OK"
