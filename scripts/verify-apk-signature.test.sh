#!/usr/bin/env bash
# Tests verify-apk-signature.sh against a stubbed apksigner.
#
# The script under test is a gate whose failure mode is silence: if it wrongly
# reports ok, a debug-signed APK ships and the published key is wrong forever.
# One such bug already shipped — a greedy sed left the last byte of keytool's
# colon-separated digest, so every debug-signed APK passed. These cases pin it.
#
# Needs only a JDK (keytool). No Android SDK, no device, no real APK.
set -uo pipefail

cd "$(dirname "$0")/.."

readonly SCRIPT=scripts/verify-apk-signature.sh
readonly TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

readonly DEBUG_DIGEST='AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99'
readonly DEBUG_FLAT='aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899'
readonly REAL_FLAT='1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

# A keystore whose SHA-256 the stub can echo back as the "debug" key.
readonly KEYSTORE="$TMP/debug.keystore"
keytool -genkeypair -v -storetype pkcs12 -keystore "$KEYSTORE" \
  -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 1 \
  -storepass android -keypass android -dname 'CN=Android Debug, O=Android, C=US' \
  >/dev/null 2>&1

# The real digest of that throwaway keystore — the stub pretends the APK carries
# it for the debug case, so the comparison exercises real keytool parsing.
REAL_DEBUG_FLAT=$(
  keytool -list -v -keystore "$KEYSTORE" -storepass android 2>/dev/null |
    grep -iE 'SHA-?256:' | head -1 | sed -E 's/^[^:]*: *//' | tr 'A-F' 'a-f' | tr -d ': '
)

readonly SDK="$TMP/sdk"
mkdir -p "$SDK/build-tools/36.0.0"
cat > "$SDK/build-tools/36.0.0/apksigner" <<'STUB'
#!/usr/bin/env bash
case "$FAKE_CASE" in
  unsigned)
    echo "DOES NOT VERIFY" >&2
    exit 1 ;;
  numbered)
    echo "Signer #1 certificate DN: CN=Whoever"
    echo "Signer #1 certificate SHA-256 digest: $FAKE_DIGEST" ;;
  sdk_range)
    echo "Signer (minSdkVersion=24, maxSdkVersion=2147483647) #1 certificate SHA-256 digest: $FAKE_DIGEST" ;;
  scheme_labelled)
    echo "V2 Signer: certificate SHA-256 digest: $FAKE_DIGEST"
    echo "V3 Signer: certificate SHA-256 digest: $FAKE_DIGEST" ;;
  two_signers)
    echo "Signer #1 certificate SHA-256 digest: $FAKE_DIGEST"
    echo "Signer #2 certificate SHA-256 digest: ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" ;;
  uppercase)
    echo "Signer #1 certificate SHA-256 digest: ${FAKE_DIGEST^^}" ;;
  no_digest)
    echo "Signer #1 certificate DN: CN=Whoever"
    echo "Signer #1 certificate SHA-1 digest: 5e8f16062ea3cd2c4a0d547876baa6f38cabf625" ;;
esac
exit 0
STUB
chmod +x "$SDK/build-tools/36.0.0/apksigner"

readonly APK="$TMP/app.apk"
: > "$APK"

FAILED=0

# expect <name> <case> <digest> <want_exit> <want_text>
expect() {
  local name=$1 fake_case=$2 digest=$3 want_exit=$4 want_text=$5
  local out status
  out=$(ANDROID_HOME="$SDK" FAKE_CASE="$fake_case" FAKE_DIGEST="$digest" \
    bash "$SCRIPT" "$APK" "$KEYSTORE" 2>&1)
  status=$?
  if ((status != want_exit)); then
    echo "FAIL $name: exit $status, wanted $want_exit"
    echo "$out" | sed 's/^/    /'
    FAILED=1
    return
  fi
  if [[ -n $want_text && $out != *"$want_text"* ]]; then
    echo "FAIL $name: output missing '$want_text'"
    echo "$out" | sed 's/^/    /'
    FAILED=1
    return
  fi
  echo "ok $name"
}

expect "unsigned apk rejected"          unsigned        "$REAL_FLAT"       1 "not signed"
expect "release key accepted"           numbered        "$REAL_FLAT"       0 "ok"
# Pins the greedy-sed regression: keytool's digest is colon-separated, so
# 's/.*: *//' leaves its last byte and this case wrongly passes.
expect "debug key rejected"             numbered        "$REAL_DEBUG_FLAT" 1 "DEBUG key"
expect "sdk-range signer label parsed"  sdk_range       "$REAL_FLAT"       0 "ok"
expect "scheme-labelled signer parsed"  scheme_labelled "$REAL_FLAT"       0 "ok"
expect "two distinct signers rejected"  two_signers     "$REAL_FLAT"       1 "expected one signer"
expect "uppercase digest normalised"    uppercase       "$REAL_DEBUG_FLAT" 1 "DEBUG key"
expect "missing digest cannot check"    no_digest       "$REAL_FLAT"       2 "could not read"

if ((FAILED)); then
  echo "verify-apk-signature.test: FAILED"
  exit 1
fi
echo "verify-apk-signature.test: all passed"
