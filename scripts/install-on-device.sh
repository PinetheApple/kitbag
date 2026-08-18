#!/usr/bin/env bash
# Builds the release APK and installs it on the attached device.
#
# Release, not debug: the JS bundle is embedded, so the app runs without a Metro
# server and can be handed to someone for design sign-off untethered.
set -uo pipefail

readonly EXIT_FAILED=1
readonly EXIT_USAGE=2
readonly EXIT_MISSING_TOOL=3

SKIP_BUILD=0

usage() {
  cat <<'USAGE'
usage: install-on-device.sh [--skip-build]

Builds the release APK, installs it on the single attached device, launches it,
and reports whether the build is debug-signed and whether the JSI runtime
install succeeded.

  --skip-build   install the existing artifact without rebuilding

exit 0  installed and launched
exit 1  build or install failed
exit 2  usage error, or no single authorized device
exit 3  required tool missing
USAGE
}

while (($#)); do
  case $1 in
    --skip-build) SKIP_BUILD=1 ;;
    -h | --help)
      usage
      exit "$EXIT_USAGE"
      ;;
    *)
      echo "install-on-device: unknown option $1" >&2
      usage
      exit "$EXIT_USAGE"
      ;;
  esac
  shift
done

cd "$(dirname "$0")/.."

readonly BOLD=$'\033[1m'
readonly RESET=$'\033[0m'
readonly RED=$'\033[31m'
readonly GREEN=$'\033[32m'
readonly YELLOW=$'\033[33m'

readonly APK=packages/app-shell/android/app/build/outputs/apk/release/app-release.apk
readonly PACKAGE=com.kitbag.app

step() { printf '%s==> %s%s\n' "$BOLD" "$1" "$RESET"; }
fail() { printf '%s%s%s\n' "$RED" "$1" "$RESET" >&2; }
warn() { printf '%s%s%s\n' "$YELLOW" "$1" "$RESET"; }

command -v adb >/dev/null 2>&1 || {
  fail "adb not found — install android-tools, or add platform-tools to PATH"
  exit "$EXIT_MISSING_TOOL"
}

step "Checking device"
# `adb devices` lists offline and unauthorized entries too, so read the state
# column rather than counting lines.
mapfile -t DEVICE_LINES < <(adb devices | awk 'NR > 1 && NF >= 2 { print $1, $2 }')

if ((${#DEVICE_LINES[@]} == 0)); then
  fail "no device attached"
  exit "$EXIT_USAGE"
fi

UNAUTHORIZED=()
READY=()
for line in "${DEVICE_LINES[@]}"; do
  serial=${line%% *}
  state=${line##* }
  case $state in
    device) READY+=("$serial") ;;
    unauthorized) UNAUTHORIZED+=("$serial") ;;
  esac
done

if ((${#READY[@]} == 0)) && ((${#UNAUTHORIZED[@]} > 0)); then
  fail "device ${UNAUTHORIZED[0]} is unauthorized"
  echo "  unlock the phone and accept the 'Allow USB debugging?' prompt," >&2
  echo "  or toggle USB debugging off and on in Developer Options" >&2
  exit "$EXIT_USAGE"
fi

if ((${#READY[@]} != 1)); then
  fail "expected exactly one ready device, found ${#READY[@]}: ${READY[*]}"
  exit "$EXIT_USAGE"
fi

readonly SERIAL=${READY[0]}
MODEL=$(adb -s "$SERIAL" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
echo "    $SERIAL ($MODEL)"

if ((SKIP_BUILD)); then
  step "Skipping build"
  [[ -f $APK ]] || {
    fail "no APK at $APK — run without --skip-build"
    exit "$EXIT_FAILED"
  }
else
  # A stale APK is otherwise reinstalled silently when the build fails.
  rm -f "$APK"
  step "Building release APK"
  (cd packages/app-shell/android && ./gradlew :app:assembleRelease -q) || {
    fail "build failed"
    exit "$EXIT_FAILED"
  }
  [[ -f $APK ]] || {
    fail "build reported success but produced no APK at $APK"
    exit "$EXIT_FAILED"
  }
fi

step "Checking signature"
if ./scripts/verify-apk-signature.sh "$APK" >/dev/null 2>&1; then
  echo "    signed with a release key"
else
  warn "    debug-signed — set ANDROID_KEYSTORE_* for a real build (see .env.example)"
fi

step "Installing ($(du -h "$APK" | cut -f1))"
INSTALL_OUTPUT=$(adb -s "$SERIAL" install -r "$APK" 2>&1)
if [[ $INSTALL_OUTPUT == *INSTALL_FAILED_UPDATE_INCOMPATIBLE* ]]; then
  fail "installed app was signed with a different key"
  echo "  Uninstalling wipes the app's data, including saved presets and setlists." >&2
  echo "  To proceed:  adb -s $SERIAL uninstall $PACKAGE" >&2
  exit "$EXIT_FAILED"
fi
if [[ $INSTALL_OUTPUT != *Success* ]]; then
  fail "install failed"
  echo "$INSTALL_OUTPUT" >&2
  exit "$EXIT_FAILED"
fi

VERSION=$(adb -s "$SERIAL" shell dumpsys package "$PACKAGE" 2>/dev/null |
  grep -m1 versionName | tr -d '\r ' | cut -d= -f2)
echo "    installed ${VERSION:-unknown}"

step "Launching"
adb -s "$SERIAL" logcat -c 2>/dev/null
adb -s "$SERIAL" shell am force-stop "$PACKAGE"
adb -s "$SERIAL" shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1

# The HostObject install is the one failure that looks like success: when it does
# not reach the UI runtime the beat sweep holds at 0, which is indistinguishable
# from "not wired yet" (see useBeatSweep.ts). useKitbagRuntime logs it.
sleep 4
if adb -s "$SERIAL" logcat -d 2>/dev/null | grep -q 'kitbag. runtime install failed'; then
  warn "    runtime install FAILED — realtime reads will hold at 0"
  exit "$EXIT_FAILED"
fi

if adb -s "$SERIAL" logcat -d 2>/dev/null | grep -qE 'FATAL EXCEPTION|AndroidRuntime.*FATAL'; then
  fail "    app crashed on launch — see adb logcat"
  exit "$EXIT_FAILED"
fi

printf '%s    launched, no runtime-install failure logged%s\n' "$GREEN" "$RESET"
