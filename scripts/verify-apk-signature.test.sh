#!/usr/bin/env bash
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

readonly SCRIPT=scripts/verify-apk-signature.sh
TMP=$(mktemp -d) || exit 1
readonly TMP
trap 'rm -rf "$TMP"' EXIT

readonly REAL_FLAT='1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
readonly OTHER_FLAT='fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321'

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
readonly TOOLS="$SDK/build-tools/36.0.0"
mkdir -p "$TOOLS"
cat > "$TOOLS/apksigner" <<'STUB'
#!/usr/bin/env bash
if [[ ${1:-} == --version ]]; then
  echo "0.9-stub"
  exit 0
fi
colon_pairs() { sed -E 's/(..)/\1:/g; s/:$//' <<<"${1^^}"; }
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
  prefixed)
    echo "WARNING: Signer #1 certificate SHA-256 digest: $FAKE_DIGEST" ;;
  no_colon)
    echo "Signer #1 certificate SHA-256 digest $FAKE_DIGEST" ;;
  colon_separated)
    echo "Signer #1 certificate SHA-256 digest: $(colon_pairs "$FAKE_DIGEST")" ;;
  glued_hex)
    echo "Signer #1 certificate SHA-256 digest:$FAKE_DIGEST" ;;
  glued_colon_separated)
    echo "Signer #1 certificate SHA-256 digest:$(colon_pairs "$FAKE_DIGEST")" ;;
  hex_run_too_long)
    echo "Signer #1 certificate SHA-256 digest: a$FAKE_DIGEST" ;;
  trailing_byte)
    echo "Signer #1 certificate SHA-256 digest: $FAKE_DIGEST 1f" ;;
  with_public_key)
    echo "Signer #1 certificate SHA-256 digest: $FAKE_DIGEST"
    echo "Signer #1 public key SHA-256 digest: ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" ;;
  crlf)
    printf 'Signer #1 certificate SHA-256 digest: %s \r\n' "$FAKE_DIGEST" ;;
  garbled_digest)
    echo "Signer #1 certificate SHA-256 digest: $FAKE_DIGEST"
    echo "Signer #2 certificate SHA-256 digest: not-a-digest" ;;
  no_digest)
    echo "Signer #1 certificate DN: CN=Whoever"
    echo "Signer #1 certificate SHA-1 digest: 5e8f16062ea3cd2c4a0d547876baa6f38cabf625" ;;
esac
exit 0
STUB
chmod +x "$TOOLS/apksigner"

readonly APK="$TMP/app.apk"
: > "$APK"

FAILED=0

expect() {
  local name=$1 fake_case=$2 digest=$3 want_exit=$4 want_text=$5
  shift 5
  local out status
  out=$(PATH="$TOOLS:$PATH" ANDROID_HOME="$SDK" FAKE_CASE="$fake_case" FAKE_DIGEST="$digest" \
    bash "$SCRIPT" "$@" "$APK" "$KEYSTORE" 2>&1)
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
expect "expected key accepted"          numbered        "$REAL_FLAT"       0 "the expected certificate" \
  --expect-sha256 "${REAL_FLAT^^}"
expect "prefixed label, expected key"   prefixed        "$REAL_FLAT"       0 "the expected certificate" \
  --expect-sha256 "$REAL_FLAT"
expect "no-colon label, expected key"   no_colon        "$REAL_FLAT"       0 "the expected certificate" \
  --expect-sha256 "$REAL_FLAT"
expect "colon-separated, expected key"  colon_separated "$REAL_FLAT"       0 "the expected certificate" \
  --expect-sha256 "$REAL_FLAT"
expect "scheme-labelled, expected key"  scheme_labelled "$REAL_FLAT"       0 "the expected certificate" \
  --expect-sha256 "$REAL_FLAT"
expect "trailing CR, expected key"      crlf            "$REAL_FLAT"       0 "the expected certificate" \
  --expect-sha256 "$REAL_FLAT"
expect "glued hex, expected key"        glued_hex       "$REAL_FLAT"       0 "the expected certificate" \
  --expect-sha256 "$REAL_FLAT"
expect "glued colon-separated, expected key" glued_colon_separated "$REAL_FLAT" 0 "the expected certificate" \
  --expect-sha256 "$REAL_FLAT"
expect "65-hex run cannot check"        hex_run_too_long "$REAL_FLAT"      2 "could not read"
expect "trailing byte cannot check"     trailing_byte   "$REAL_FLAT"       2 "could not read"
expect "public key digest ignored"      with_public_key "$REAL_FLAT"       0 "the expected certificate" \
  --expect-sha256 "$REAL_FLAT"
expect "apksigner path and version logged" numbered     "$REAL_FLAT"       0 "using $TOOLS/apksigner (0.9-stub)"
expect "colon-separated debug rejected" colon_separated "$REAL_DEBUG_FLAT" 1 "DEBUG key"
expect "unreadable digest line cannot check" garbled_digest "$REAL_FLAT"   2 "could not read"
expect "unexpected non-debug key rejected" numbered     "$OTHER_FLAT"      1 "expected release certificate" \
  --expect-sha256 "$REAL_FLAT"

if ((FAILED)); then
  echo "verify-apk-signature.test: FAILED"
  exit 1
fi
echo "verify-apk-signature.test: all passed"
