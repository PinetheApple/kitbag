#!/usr/bin/env bash
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

readonly GATE=scripts/release-gate.sh
readonly DEBUG_KEYSTORE=packages/app-shell/android/app/debug.keystore
readonly RELEASE_CERT_FILE=packages/app-shell/android/app/release-cert.sha256
SCRATCH=$(mktemp -d) || exit 1
readonly SCRATCH
trap 'rm -rf "$SCRATCH"' EXIT

readonly EXIT_OK=0
readonly EXIT_REJECTED=1
readonly EXIT_CANNOT_CHECK=2
readonly EXIT_USAGE=3

RELEASE_DIGEST=$(<"$RELEASE_CERT_FILE")
readonly RELEASE_DIGEST
readonly OTHER_DIGEST='1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
DEBUG_DIGEST=$(
  keytool -list -v -keystore "$DEBUG_KEYSTORE" -storepass android 2>/dev/null |
    grep -iE 'SHA-?256:' | head -1 | sed -E 's/^[^:]*: *//' | tr 'A-F' 'a-f' | tr -d ': '
)
readonly DEBUG_DIGEST
if [[ -z $DEBUG_DIGEST || -z $RELEASE_DIGEST ]]; then
  echo "release-gate.test: cannot read the debug keystore (needs keytool) or the pinned release cert" >&2
  exit 1
fi

readonly SDK_FULL="$SCRATCH/sdk"
readonly SDK_NO_AAPT2="$SCRATCH/sdk-no-aapt2"
readonly TOOLS=build-tools/36.0.0
mkdir -p "$SDK_FULL/$TOOLS" "$SDK_NO_AAPT2/$TOOLS"
cat > "$SDK_FULL/$TOOLS/apksigner" <<'STUB'
#!/usr/bin/env bash
if [[ $FAKE_SIGNER == unsigned ]]; then
  echo "DOES NOT VERIFY" >&2
  exit 1
fi
echo "Signer #1 certificate SHA-256 digest: $FAKE_SIGNER"
STUB
cat > "$SDK_FULL/$TOOLS/aapt2" <<'STUB'
#!/usr/bin/env bash
echo "package: name='com.kitbag.app' versionCode='$FAKE_CODE' versionName='$FAKE_NAME' platformBuildVersionName='16'"
STUB
chmod +x "$SDK_FULL/$TOOLS/apksigner" "$SDK_FULL/$TOOLS/aapt2"
cp "$SDK_FULL/$TOOLS/apksigner" "$SDK_NO_AAPT2/$TOOLS/"

readonly APK="$SCRATCH/app-release.apk"
echo "not really an apk" > "$APK"

PASS=0
FAIL=0
SDK=$SDK_FULL
FAKE_SIGNER=$RELEASE_DIGEST
FAKE_NAME=0.1.0
FAKE_CODE=100

signed_with() { FAKE_SIGNER=$1; }
apk_reports() { FAKE_NAME=$1 FAKE_CODE=$2; }
sdk() { SDK=$1; }

# expect <name> <want_exit> <want_text> <gate args...>
expect() {
  local name=$1 want_exit=$2 want_text=$3
  shift 3
  local out_dir="$SCRATCH/out-$((PASS + FAIL))" output status problem=""
  output=$(PATH="$SDK/$TOOLS:$PATH" ANDROID_HOME="$SDK" ANDROID_SDK_ROOT='' \
    FAKE_SIGNER="$FAKE_SIGNER" FAKE_NAME="$FAKE_NAME" FAKE_CODE="$FAKE_CODE" \
    bash "$GATE" --out "$out_dir" "$@" 2>&1)
  status=$?
  ((status == want_exit)) || problem="exit $status, wanted $want_exit"
  [[ -z $want_text || $output == *"$want_text"* ]] || problem+=" output missing '$want_text'"
  local staged=("$out_dir"/*)
  if ((want_exit == EXIT_OK)) && [[ $* != *--version-only* ]]; then
    (cd "$out_dir" 2>/dev/null && sha256sum --quiet -c ./*.sha256) >/dev/null 2>&1 ||
      problem+=" the staged sha256 does not verify the staged APK"
  elif [[ -e ${staged[0]} ]]; then
    problem+=" staged ${staged[*]} without a full pass"
  fi
  if [[ -n $problem ]]; then
    printf '  FAIL  %s:%s\n%s\n' "$name" "$problem" "${output//$'\n'/$'\n'    }"
    FAIL=$((FAIL + 1))
  else
    printf '  ok    %s\n' "$name"
    PASS=$((PASS + 1))
  fi
}

expect "release-signed, first release" "$EXIT_OK" "versionCode 100" "$APK" 0.1.0

apk_reports 0.2.0 200
expect "release-signed, after a previous tag" "$EXIT_OK" "versionName 0.2.0" "$APK" 0.2.0 v0.1.7

apk_reports 0.1.0 100
signed_with "$DEBUG_DIGEST"
expect "debug-signed APK rejected" "$EXIT_REJECTED" "DEBUG key" "$APK" 0.1.0
signed_with "$OTHER_DIGEST"
expect "APK signed with an unexpected key rejected" "$EXIT_REJECTED" "release certificate" "$APK" 0.1.0
signed_with unsigned
expect "unsigned APK rejected" "$EXIT_REJECTED" "not signed" "$APK" 0.1.0

signed_with "$RELEASE_DIGEST"
expect "versionName mismatch rejected" "$EXIT_REJECTED" "versionName" "$APK" 0.1.1
apk_reports 0.2.0 100
expect "versionCode off the formula rejected" "$EXIT_REJECTED" "versionCode" "$APK" 0.2.0
apk_reports 0.1.0 100
expect "versionCode equal to the previous tag rejected" "$EXIT_REJECTED" "versionCode" "$APK" 0.1.0 v0.1.0
expect "versionCode below the previous tag rejected" "$EXIT_REJECTED" "versionCode" "$APK" 0.1.0 v0.3.0

sdk "$SDK_NO_AAPT2"
expect "missing aapt2 fails" "$EXIT_CANNOT_CHECK" "aapt2" "$APK" 0.1.0
sdk "$SDK_FULL"

expect "missing version is a usage error" "$EXIT_USAGE" "" "$APK"
expect "non-semver version is a usage error" "$EXIT_USAGE" "" "$APK" 0.1
expect "non-semver previous tag is a usage error" "$EXIT_USAGE" "" "$APK" 0.1.0 changelog-base

signed_with "$DEBUG_DIGEST"
expect "--version-only skips the signature" "$EXIT_OK" "versionCode 100" --version-only "$APK" 0.1.0
apk_reports 0.1.0 101
expect "--version-only still checks versionCode" "$EXIT_REJECTED" "versionCode" --version-only "$APK" 0.1.0

echo
if ((FAIL)); then
  printf 'release-gate tests: %d passed, %d FAILED\n' "$PASS" "$FAIL"
  exit 1
fi
printf 'release-gate tests: %d passed\n' "$PASS"
