#!/usr/bin/env bash
# Release builds fall back to the public debug key when ANDROID_KEYSTORE_* is unset,
# and the first published key is permanent: this stops that fallback shipping.
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_REJECTED=1
readonly EXIT_CANNOT_CHECK=2
readonly EXIT_USAGE=3

readonly HEX_BYTE='[0-9A-Fa-f]{2}'
readonly SHA256_BYTES_AFTER_FIRST=31
readonly SHA256_PATTERN="${HEX_BYTE}(:?${HEX_BYTE}){${SHA256_BYTES_AFTER_FIRST}}"

normalise_digest() {
  tr 'A-F' 'a-f' | tr -d ': '
}

# Labels vary across build-tools and may hold colons, so take the trailing digest, never a cut.
extract_digest() {
  sed -nE "s/^(.*[^0-9A-Fa-f:]:?[[:space:]]*)?(${SHA256_PATTERN})[[:space:]]*\$/\2/p" | normalise_digest
}

usage() {
  cat <<'USAGE'
usage: verify-apk-signature.sh [--expect-sha256 HEX] <apk> [debug-keystore]

Verifies that <apk> carries exactly one signer and that the signer is not the
debug key. debug-keystore defaults to the app's checked-in debug.keystore.
With --expect-sha256, the signer's certificate SHA-256 must also equal HEX.

exit 0  signed with a non-debug key (and the expected one, if given)
exit 1  unsigned, multiple signers, the debug key, or not the expected key
exit 2  cannot determine (missing tool, unreadable keystore)
exit 3  usage error
USAGE
}

EXPECTED_DIGEST=""
while [[ ${1:-} == -* ]]; do
  case $1 in
    -h | --help)
      usage
      exit "$EXIT_USAGE"
      ;;
    --expect-sha256)
      EXPECTED_DIGEST=$(normalise_digest <<<"${2:-}")
      [[ -n $EXPECTED_DIGEST ]] || {
        usage
        exit "$EXIT_USAGE"
      }
      shift 2
      ;;
    *)
      usage
      exit "$EXIT_USAGE"
      ;;
  esac
done
readonly EXPECTED_DIGEST

cd "$(dirname "$0")/.." || exit "$EXIT_CANNOT_CHECK"

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

find_build_tool() {
  local name=$1 sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
  command -v "$name" && return
  [[ -n $sdk ]] || return 0
  find "$sdk/build-tools" -maxdepth 2 -name "$name" -type f 2>/dev/null | sort -V | tail -1
}

APKSIGNER=$(find_build_tool apksigner)
if [[ -z ${APKSIGNER:-} || ! -x $APKSIGNER ]]; then
  echo "verify-apk-signature: apksigner not found; set ANDROID_HOME" >&2
  exit "$EXIT_CANNOT_CHECK"
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo "verify-apk-signature: keytool not found (needs a JDK)" >&2
  exit "$EXIT_CANNOT_CHECK"
fi

APKSIGNER_VERSION=$("$APKSIGNER" --version 2>/dev/null | head -1)
echo "verify-apk-signature: using $APKSIGNER (${APKSIGNER_VERSION:-unknown version})" >&2

CERTS=$("$APKSIGNER" verify --print-certs "$APK" 2>&1)
VERIFY_STATUS=$?

if ((VERIFY_STATUS != 0)); then
  echo "verify-apk-signature: APK is not signed, or apksigner rejected it:" >&2
  echo "$CERTS" | head -40 >&2
  exit "$EXIT_REJECTED"
fi

mapfile -t DIGEST_LINES < <(echo "$CERTS" | grep -iE 'certificate SHA-?256 digest')

DIGESTS=()
for line in "${DIGEST_LINES[@]}"; do
  digest=$(extract_digest <<<"$line")
  if [[ -z $digest ]]; then
    DIGESTS=()
    break
  fi
  DIGESTS+=("$digest")
done
if ((${#DIGESTS[@]} > 0)); then
  mapfile -t DIGESTS < <(printf '%s\n' "${DIGESTS[@]}" | sort -u)
fi

if ((${#DIGESTS[@]} == 0)); then
  echo "verify-apk-signature: could not read any SHA-256 digest from apksigner output:" >&2
  echo "$CERTS" | head -40 >&2
  exit "$EXIT_CANNOT_CHECK"
fi

if ((${#DIGESTS[@]} > 1)); then
  echo "verify-apk-signature: expected one signer, found ${#DIGESTS[@]}:" >&2
  printf '  %s\n' "${DIGESTS[@]}" >&2
  exit "$EXIT_REJECTED"
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
    extract_digest
)

if [[ -z $DEBUG_DIGEST ]]; then
  echo "verify-apk-signature: could not read SHA-256 from $DEBUG_KEYSTORE" >&2
  exit "$EXIT_CANNOT_CHECK"
fi

if [[ $APK_DIGEST == "$DEBUG_DIGEST" ]]; then
  echo "verify-apk-signature: APK is signed with the DEBUG key — never publish this" >&2
  echo "  set ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS" >&2
  exit "$EXIT_REJECTED"
fi

if [[ -n $EXPECTED_DIGEST && $APK_DIGEST != "$EXPECTED_DIGEST" ]]; then
  echo "verify-apk-signature: APK is not signed with the expected release certificate" >&2
  echo "  signer   ${APK_DIGEST}" >&2
  echo "  expected ${EXPECTED_DIGEST}" >&2
  exit "$EXIT_REJECTED"
fi

echo "verify-apk-signature: ok — one signer, not the debug key${EXPECTED_DIGEST:+, the expected certificate} (sha256 ${APK_DIGEST:0:16}...)"
exit "$EXIT_OK"
