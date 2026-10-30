#!/usr/bin/env bash
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_REJECTED=1
readonly EXIT_CANNOT_CHECK=2
readonly EXIT_USAGE=3

readonly ASSET=kitbag.apk
SCRIPTS=$(cd "$(dirname "$0")" && pwd)
readonly SCRIPTS
readonly RELEASE_CERT=packages/app-shell/android/app/release-cert.sha256
readonly RELEASE_CERT_FILE="$SCRIPTS/../$RELEASE_CERT"

usage() {
  cat <<USAGE
usage: release-gate.sh [--out DIR] <apk> <version> [previous-tag]
       release-gate.sh --version-only <apk> <version>

Fails unless <apk> is signed by exactly the pinned release certificate
(${RELEASE_CERT}), its versionName is <version>, its versionCode is the one
\`version.sh code\` derives, and that code is above [previous-tag]'s. On success
stages ${ASSET} and ${ASSET}.sha256 in DIR (default dist/release).

--version-only checks versionName and versionCode only and stages nothing:
CI's pin of build.gradle's versionCode formula to version.sh's.

exit ${EXIT_OK}  passed
exit ${EXIT_REJECTED}  the APK failed a gate
exit ${EXIT_CANNOT_CHECK}  cannot check (missing aapt2)
exit ${EXIT_USAGE}  usage error
USAGE
}

fail() {
  echo "release-gate: FAIL — $1" >&2
  exit "$2"
}

out_dir=$(cd "$SCRIPTS/.." && pwd)/dist/release
version_only=0
args=()
while (($#)); do
  case $1 in
    --out)
      [[ -n ${2-} ]] || fail "--out needs a directory" "$EXIT_USAGE"
      out_dir=$2
      shift
      ;;
    --version-only) version_only=1 ;;
    -h | --help)
      usage
      exit "$EXIT_USAGE"
      ;;
    -*) fail "unknown option $1" "$EXIT_USAGE" ;;
    *) args+=("$1") ;;
  esac
  shift
done

if ((${#args[@]} < 2 || ${#args[@]} > 3 || (version_only && ${#args[@]} != 2))); then
  usage >&2
  exit "$EXIT_USAGE"
fi

readonly APK=${args[0]}
readonly VERSION=${args[1]}
readonly PREVIOUS_TAG=${args[2]-}

[[ -f $APK ]] || fail "no such APK: $APK" "$EXIT_USAGE"
expected_code=$("$SCRIPTS/version.sh" code "$VERSION") || fail "invalid release version '$VERSION'" "$EXIT_USAGE"
previous_code=""
if [[ -n $PREVIOUS_TAG ]]; then
  previous_code=$("$SCRIPTS/version.sh" code "$PREVIOUS_TAG") || fail "invalid previous tag '$PREVIOUS_TAG'" "$EXIT_USAGE"
fi

apk_path=$(realpath "$APK")
readonly APK_PATH=$apk_path

if ((!version_only)); then
  release_cert=$(<"$RELEASE_CERT_FILE") || fail "cannot read $RELEASE_CERT_FILE" "$EXIT_CANNOT_CHECK"
  "$SCRIPTS/verify-apk-signature.sh" --expect-sha256 "$release_cert" "$APK_PATH" ||
    fail "signature gate did not accept $APK (reason above)" "$EXIT_REJECTED"
fi

find_build_tool() {
  local name=$1 sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
  command -v "$name" && return
  [[ -n $sdk ]] || return 0
  find "$sdk/build-tools" -maxdepth 2 -name "$name" -type f 2>/dev/null | sort -V | tail -1
}

aapt2=$(find_build_tool aapt2)
[[ -n $aapt2 && -x $aapt2 ]] || fail "aapt2 not found; set ANDROID_HOME — the version gates cannot run" "$EXIT_CANNOT_CHECK"

badging=$("$aapt2" dump badging "$APK_PATH" 2>&1) || fail "aapt2 could not read $APK: $badging" "$EXIT_CANNOT_CHECK"
apk_name=$(sed -n "s/^package:.* versionName='\([^']*\)'.*/\1/p" <<<"$badging")
apk_code=$(sed -n "s/^package:.* versionCode='\([^']*\)'.*/\1/p" <<<"$badging")
[[ -n $apk_name && $apk_code =~ ^[0-9]+$ ]] || fail "could not read versionName/versionCode from aapt2" "$EXIT_CANNOT_CHECK"

[[ $apk_name == "$VERSION" ]] || fail "APK versionName ${apk_name}, release is ${VERSION}" "$EXIT_REJECTED"
((apk_code == expected_code)) ||
  fail "APK versionCode ${apk_code}, version.sh derives ${expected_code} for ${VERSION} — build.gradle and version.sh disagree" "$EXIT_REJECTED"

previous_note="first release"
if [[ -n $previous_code ]]; then
  ((apk_code > previous_code)) ||
    fail "APK versionCode ${apk_code} is not above ${PREVIOUS_TAG}'s ${previous_code}; it would not install over it" "$EXIT_REJECTED"
  previous_note="above ${PREVIOUS_TAG}'s ${previous_code}"
fi

if ((version_only)); then
  echo "release-gate: ok — versionName ${apk_name}, versionCode ${apk_code} matches version.sh"
  exit "$EXIT_OK"
fi

mkdir -p "$out_dir" || fail "cannot create $out_dir" "$EXIT_CANNOT_CHECK"
cp "$APK_PATH" "$out_dir/$ASSET" || fail "cannot write $out_dir/$ASSET" "$EXIT_CANNOT_CHECK"
(cd "$out_dir" && sha256sum "$ASSET" > "$ASSET.sha256") || fail "sha256sum failed" "$EXIT_CANNOT_CHECK"

echo "release-gate: ok — ${ASSET} versionName ${apk_name}, versionCode ${apk_code} (${previous_note})"
cat "$out_dir/$ASSET.sha256"
exit "$EXIT_OK"
