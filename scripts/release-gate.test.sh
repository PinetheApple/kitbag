#!/usr/bin/env bash
# Tests release-gate.sh against stubbed apksigner and aapt2. Needs a JDK only.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

readonly GATE=scripts/release-gate.sh
readonly DEBUG_KEYSTORE=packages/app-shell/android/app/debug.keystore
readonly SCRATCH_ROOT="$HOME/.cache/agent-scratch"
mkdir -p "$SCRATCH_ROOT"
SCRATCH=$(mktemp -d "$SCRATCH_ROOT/release-gate-test.XXXXXX") || exit 1
readonly SCRATCH
trap 'rm -rf "$SCRATCH"' EXIT

readonly EXIT_OK=0
readonly EXIT_REJECTED=1
readonly EXIT_CANNOT_CHECK=2
readonly EXIT_USAGE=3

readonly RELEASE_DIGEST='1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
DEBUG_DIGEST=$(
  keytool -list -v -keystore "$DEBUG_KEYSTORE" -storepass android 2>/dev/null |
    grep -iE 'SHA-?256:' | head -1 | sed -E 's/^[^:]*: *//' | tr 'A-F' 'a-f' | tr -d ': '
)
readonly DEBUG_DIGEST
if [[ -z $DEBUG_DIGEST ]]; then
  echo "release-gate.test: cannot read the debug keystore digest (needs keytool)" >&2
  exit 1
fi

readonly SDK="$SCRATCH/sdk"
readonly SDK_NO_AAPT2="$SCRATCH/sdk-no-aapt2"
mkdir -p "$SDK/build-tools/36.0.0" "$SDK_NO_AAPT2/build-tools/36.0.0"
cat > "$SDK/build-tools/36.0.0/apksigner" <<'STUB'
#!/usr/bin/env bash
if [[ $FAKE_SIGNER == unsigned ]]; then
  echo "DOES NOT VERIFY" >&2
  exit 1
fi
echo "Signer #1 certificate SHA-256 digest: $FAKE_SIGNER"
STUB
cat > "$SDK/build-tools/36.0.0/aapt2" <<'STUB'
#!/usr/bin/env bash
echo "package: name='com.kitbag.app' versionCode='$FAKE_CODE' versionName='$FAKE_NAME' platformBuildVersionName='16'"
STUB
chmod +x "$SDK/build-tools/36.0.0/apksigner" "$SDK/build-tools/36.0.0/aapt2"
cp "$SDK/build-tools/36.0.0/apksigner" "$SDK_NO_AAPT2/build-tools/36.0.0/"

readonly APK="$SCRATCH/app-release.apk"
echo "not really an apk" > "$APK"

PASS=0
FAIL=0

# expect <name> <want_exit> <want_text> <sdk> <signer> <apk name> <apk code> -- <gate args...>
expect() {
  local name=$1 want_exit=$2 want_text=$3 sdk=$4 signer=$5 apk_name=$6 apk_code=$7
  shift 8
  local out_dir="$SCRATCH/out-$((PASS + FAIL))" output status
  output=$(ANDROID_HOME="$sdk" ANDROID_SDK_ROOT='' FAKE_SIGNER="$signer" FAKE_NAME="$apk_name" FAKE_CODE="$apk_code" \
    bash "$GATE" --out "$out_dir" "$APK" "$@" 2>&1)
  status=$?
  local problem=""
  ((status == want_exit)) || problem="exit $status, wanted $want_exit"
  [[ -z $want_text || $output == *"$want_text"* ]] || problem+=" output missing '$want_text'"
  if ((want_exit == EXIT_OK)); then
    (cd "$out_dir" 2>/dev/null && sha256sum --quiet -c kitbag.apk.sha256) >/dev/null 2>&1 ||
      problem+=" kitbag.apk.sha256 does not verify kitbag.apk"
  elif [[ -e $out_dir/kitbag.apk ]]; then
    problem+=" wrote kitbag.apk despite failing"
  fi
  if [[ -n $problem ]]; then
    printf '  FAIL  %s:%s\n%s\n' "$name" "$problem" "$(sed 's/^/    /' <<<"$output")"
    FAIL=$((FAIL + 1))
  else
    printf '  ok    %s\n' "$name"
    PASS=$((PASS + 1))
  fi
}

expect "release-signed, first release" "$EXIT_OK" "versionCode 100" \
  "$SDK" "$RELEASE_DIGEST" 0.1.0 100 -- 0.1.0
expect "release-signed, after a previous tag" "$EXIT_OK" "versionName 0.2.0" \
  "$SDK" "$RELEASE_DIGEST" 0.2.0 200 -- 0.2.0 v0.1.7
expect "debug-signed APK rejected" "$EXIT_REJECTED" "DEBUG key" \
  "$SDK" "$DEBUG_DIGEST" 0.1.0 100 -- 0.1.0
expect "unsigned APK rejected" "$EXIT_REJECTED" "not signed" \
  "$SDK" unsigned 0.1.0 100 -- 0.1.0
expect "versionName mismatch rejected" "$EXIT_REJECTED" "versionName" \
  "$SDK" "$RELEASE_DIGEST" 0.1.0 100 -- 0.1.1
expect "versionCode off the formula rejected" "$EXIT_REJECTED" "versionCode" \
  "$SDK" "$RELEASE_DIGEST" 0.2.0 100 -- 0.2.0
expect "versionCode equal to the previous tag rejected" "$EXIT_REJECTED" "versionCode" \
  "$SDK" "$RELEASE_DIGEST" 0.1.0 100 -- 0.1.0 v0.1.0
expect "versionCode below the previous tag rejected" "$EXIT_REJECTED" "versionCode" \
  "$SDK" "$RELEASE_DIGEST" 0.1.0 100 -- 0.1.0 v0.3.0
expect "missing aapt2 fails" "$EXIT_CANNOT_CHECK" "aapt2" \
  "$SDK_NO_AAPT2" "$RELEASE_DIGEST" 0.1.0 100 -- 0.1.0
expect "missing version is a usage error" "$EXIT_USAGE" "" \
  "$SDK" "$RELEASE_DIGEST" 0.1.0 100 --
expect "non-semver version is a usage error" "$EXIT_USAGE" "" \
  "$SDK" "$RELEASE_DIGEST" 0.1.0 100 -- 0.1
expect "non-semver previous tag is a usage error" "$EXIT_USAGE" "" \
  "$SDK" "$RELEASE_DIGEST" 0.1.0 100 -- 0.1.0 changelog-base

echo
if ((FAIL)); then
  printf 'release-gate tests: %d passed, %d FAILED\n' "$PASS" "$FAIL"
  exit 1
fi
printf 'release-gate tests: %d passed\n' "$PASS"
