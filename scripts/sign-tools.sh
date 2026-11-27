#!/usr/bin/env bash
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_SIGN_FAILED=1
readonly EXIT_NO_KEY=2
readonly EXIT_USAGE=3

SCRIPTS=$(cd "$(dirname "$0")" && pwd)
readonly SCRIPTS
readonly CLI="$SCRIPTS/../packages/app-shell/src/toolBuild/cli.ts"
readonly INDEX=tools-index.json
readonly P256_OID='ASN1 OID: prime256v1'

usage() {
  cat <<USAGE
usage: sign-tools.sh [--key PATH --key-id ID] [--host-version X.Y.Z] <dir>

Signs every *.kbt in <dir> with an ECDSA P-256 key: stamps the key id into each
manifest.json, adds manifest.sig over its exact bytes, then writes ${INDEX}
for the host release and signs it as ${INDEX}.sig. Signatures are DER from
openssl dgst -sha256 -sign.

Without --key, the key is TOOLS_SIGNING_KEY (base64 of the PEM) and the id
TOOLS_SIGNING_KEY_ID; the key is decoded into a pipe, never onto disk. Real
keys are the owner's (docs/research/plugin-delivery-design.md 4.5).

--key           PEM private key file; needs --key-id
--key-id        the id the pin file knows the key by
--host-version  the host release (default: version.sh current)

exit ${EXIT_OK}  signed
exit ${EXIT_SIGN_FAILED}  signing failed (reason above)
exit ${EXIT_NO_KEY}  no usable key
exit ${EXIT_USAGE}  usage error
USAGE
}

fail() {
  echo "sign-tools: FAIL — $1" >&2
  exit "$2"
}

key_file=""
key_id=""
host_version=""
args=()
while (($#)); do
  case $1 in
    --key | --key-id | --host-version)
      [[ -n ${2-} ]] || fail "$1 needs a value" "$EXIT_USAGE"
      case $1 in
        --key) key_file=$2 ;;
        --key-id) key_id=$2 ;;
        --host-version) host_version=$2 ;;
      esac
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
readonly DIR=${args[0]}
[[ -d $DIR ]] || fail "no such directory: $DIR" "$EXIT_USAGE"

if [[ -n $key_file ]]; then
  [[ -n $key_id ]] || fail "--key needs --key-id" "$EXIT_USAGE"
  [[ -r $key_file ]] || fail "cannot read $key_file" "$EXIT_NO_KEY"
else
  key_id=${TOOLS_SIGNING_KEY_ID-}
  [[ -n ${TOOLS_SIGNING_KEY-} && -n $key_id ]] ||
    fail "no key: pass --key and --key-id, or set TOOLS_SIGNING_KEY and TOOLS_SIGNING_KEY_ID" "$EXIT_NO_KEY"
fi
readonly KEY_ID=$key_id
[[ $KEY_ID =~ ^[a-z][a-z0-9-]*$ ]] || fail "key id '$KEY_ID' is not a key id" "$EXIT_USAGE"

key_pem() {
  if [[ -n $key_file ]]; then
    cat "$key_file"
  else
    base64 -d <<<"$TOOLS_SIGNING_KEY"
  fi
}

openssl pkey -noout -text -in <(key_pem) 2>/dev/null | grep -qF "$P256_OID" ||
  fail "the key is not an ECDSA P-256 private key" "$EXIT_NO_KEY"

sign() {
  openssl dgst -sha256 -sign <(key_pem) -out "$2" "$1" || fail "openssl could not sign $1" "$EXIT_SIGN_FAILED"
}

if [[ -z $host_version ]]; then
  host_version=$("$SCRIPTS/version.sh" current) || fail "version.sh current failed" "$EXIT_SIGN_FAILED"
fi
host_code=$("$SCRIPTS/version.sh" code "$host_version") || fail "invalid host version '$host_version'" "$EXIT_USAGE"

umask 077
WORK=$(mktemp -d) || fail "cannot create a work directory" "$EXIT_SIGN_FAILED"
readonly WORK
trap 'rm -rf "$WORK"' EXIT

cli() {
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$CLI" "$@"
}

cli stamp --key-id "$KEY_ID" --work "$WORK" "$DIR" || fail "could not read the bundles in $DIR (reason above)" "$EXIT_SIGN_FAILED"
signed=0
for manifest in "$WORK"/*.manifest.json; do
  sign "$manifest" "${manifest%.json}.sig"
  signed=$((signed + 1))
done
cli seal --key-id "$KEY_ID" --work "$WORK" --host-version "$host_version" --host-version-code "$host_code" "$DIR" ||
  fail "could not write the signed bundles and $INDEX (reason above)" "$EXIT_SIGN_FAILED"
sign "$DIR/$INDEX" "$DIR/$INDEX.sig"

echo "sign-tools: ok — signed $signed bundle(s) and $INDEX with $KEY_ID (host $host_version)"
exit "$EXIT_OK"
