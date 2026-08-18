#!/usr/bin/env bash
# Fails if an APK is unsigned or signed with the template debug key.
#
# The first key an app is published under is locked in forever: an APK signed
# with the repo's debug.keystore can never be upgraded by a properly-signed
# build, and that key is public. Release signing falls back to the debug key when
# ANDROID_KEYSTORE_* is unset (see android/app/build.gradle), so this is the gate
# that stops a fallback build from being published.
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_DEBUG_KEY=1
readonly EXIT_CANNOT_CHECK=2
readonly EXIT_USAGE=3

usage() {
  cat <<'USAGE'
usage: verify-apk-signature.sh <apk> [debug-keystore]

Verifies that <apk> carries exactly one signer and that the signer is not the
debug key. debug-keystore defaults to the app's checked-in debug.keystore.

exit 0  signed with a non-debug key
exit 1  unsigned, multiple signers, or signed with the debug key
exit 2  cannot determine (missing tool, unreadable keystore)
exit 3  usage error
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit "$EXIT_USAGE"
fi

cd "$(dirname "$0")/.."

readonly APK=${1:-}
readonly DEBUG_KEYSTORE=${2:-packages/app-shell/android/app/debug.keystore}

if [[ -z $APK ]]; then
  usage
  exit "$EXIT_USAGE"
fi

if [[ ! -f $APK ]]; then
  echo "verify-apk-signature: no such APK: $APK" >&2
  exit "$EXIT_USAGE"
fi

# apksigner is not on PATH in a default SDK install; it lives per-build-tools
# version, so take the highest available.
find_apksigner() {
  if command -v apksigner >/dev/null 2>&1; then
    command -v apksigner
    return
  fi
  local sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
  [[ -n $sdk ]] || return 1
  find "$sdk/build-tools" -maxdepth 2 -name apksigner -type f 2>/dev/null | sort -V | tail -1
}

APKSIGNER=$(find_apksigner)
if [[ -z ${APKSIGNER:-} || ! -x $APKSIGNER ]]; then
  echo "verify-apk-signature: apksigner not found; set ANDROID_HOME" >&2
  exit "$EXIT_CANNOT_CHECK"
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo "verify-apk-signature: keytool not found (needs a JDK)" >&2
  exit "$EXIT_CANNOT_CHECK"
fi

CERTS=$("$APKSIGNER" verify --print-certs "$APK" 2>&1)
VERIFY_STATUS=$?

if ((VERIFY_STATUS != 0)); then
  echo "verify-apk-signature: APK is not signed, or apksigner rejected it:" >&2
  echo "$CERTS" | head -40 >&2
  exit "$EXIT_DEBUG_KEY"
fi

# The signer label differs across build-tools versions: "Signer #1", "Signer
# (minSdkVersion=...) #1", and "V2 Signer:" have all shipped. Match the digest
# lines instead, which are stable, then normalise case and separators.
mapfile -t DIGESTS < <(
  echo "$CERTS" |
    grep -iE 'certificate SHA-?256 digest' |
    sed -E 's/^[^:]*: *//' |
    tr 'A-F' 'a-f' |
    tr -d ': ' |
    sort -u
)

if ((${#DIGESTS[@]} == 0)); then
  echo "verify-apk-signature: could not read any SHA-256 digest from apksigner output:" >&2
  echo "$CERTS" | head -40 >&2
  exit "$EXIT_CANNOT_CHECK"
fi

if ((${#DIGESTS[@]} > 1)); then
  echo "verify-apk-signature: expected one signer, found ${#DIGESTS[@]}:" >&2
  printf '  %s\n' "${DIGESTS[@]}" >&2
  exit "$EXIT_DEBUG_KEY"
fi

readonly APK_DIGEST=${DIGESTS[0]}

if [[ ! -f $DEBUG_KEYSTORE ]]; then
  echo "verify-apk-signature: debug keystore not found at $DEBUG_KEYSTORE" >&2
  exit "$EXIT_CANNOT_CHECK"
fi

DEBUG_DIGEST=$(
  keytool -list -v -keystore "$DEBUG_KEYSTORE" -storepass android 2>/dev/null |
    grep -iE 'SHA-?256:' |
    head -1 |
    sed -E 's/^[^:]*: *//' |
    tr 'A-F' 'a-f' |
    tr -d ': '
)

if [[ -z $DEBUG_DIGEST ]]; then
  echo "verify-apk-signature: could not read SHA-256 from $DEBUG_KEYSTORE" >&2
  exit "$EXIT_CANNOT_CHECK"
fi

if [[ $APK_DIGEST == "$DEBUG_DIGEST" ]]; then
  echo "verify-apk-signature: APK is signed with the DEBUG key — never publish this" >&2
  echo "  set ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS" >&2
  exit "$EXIT_DEBUG_KEY"
fi

echo "verify-apk-signature: ok — one signer, not the debug key (sha256 ${APK_DIGEST:0:16}...)"
exit "$EXIT_OK"
