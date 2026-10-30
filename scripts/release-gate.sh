#!/usr/bin/env bash
# Proves a release APK before it is published, then stages it under the stable
# asset name with its sha256. Nothing is written unless every check passes.
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_REJECTED=1
readonly EXIT_CANNOT_CHECK=2
readonly EXIT_USAGE=3

readonly ASSET=kitbag.apk
readonly SEMVER_RE='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
readonly TAG_PREFIX=v
SCRIPTS=$(cd "$(dirname "$0")" && pwd)
readonly SCRIPTS

usage() {
  cat <<'USAGE'
usage: release-gate.sh [--out DIR] <apk> <version> [previous-tag]

Fails unless <apk> is signed with one non-debug key, its versionName is
<version>, its versionCode is the one version.sh derives for <version>, and
that code is above [previous-tag]'s. On success writes kitbag.apk and
kitbag.apk.sha256 to DIR (default dist/release).

exit 0  passed, artifacts written
exit 1  the APK failed a gate
exit 2  cannot check (missing aapt2/apksigner/keytool)
exit 3  usage error
USAGE
}

fail() {
  echo "release-gate: FAIL — $1" >&2
  exit "$2"
}

out_dir=$(cd "$SCRIPTS/.." && pwd)/dist/release
args=()
while (($#)); do
  case $1 in
    --out)
      [[ -n ${2-} ]] || fail "--out needs a directory" "$EXIT_USAGE"
      out_dir=$2
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

if ((${#args[@]} < 2 || ${#args[@]} > 3)); then
  usage >&2
  exit "$EXIT_USAGE"
fi

readonly APK=${args[0]}
readonly VERSION=${args[1]}
readonly PREVIOUS_TAG=${args[2]-}

[[ -f $APK ]] || fail "no such APK: $APK" "$EXIT_USAGE"
[[ $VERSION =~ $SEMVER_RE ]] || fail "version must be major.minor.patch, got '$VERSION'" "$EXIT_USAGE"
if [[ -n $PREVIOUS_TAG ]] && ! [[ $PREVIOUS_TAG == "$TAG_PREFIX"* && ${PREVIOUS_TAG#"$TAG_PREFIX"} =~ $SEMVER_RE ]]; then
  fail "previous tag must be ${TAG_PREFIX}major.minor.patch, got '$PREVIOUS_TAG'" "$EXIT_USAGE"
fi

apk_path=$(realpath "$APK")
readonly APK_PATH=$apk_path

"$SCRIPTS/verify-apk-signature.sh" "$APK_PATH"
signature_status=$?
if ((signature_status == EXIT_REJECTED)); then
  fail "signature gate rejected $APK" "$EXIT_REJECTED"
elif ((signature_status != EXIT_OK)); then
  fail "signature gate could not check $APK" "$EXIT_CANNOT_CHECK"
fi

find_aapt2() {
  local sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
  if [[ -z $sdk ]]; then
    command -v aapt2 || true
    return
  fi
  find "$sdk/build-tools" -maxdepth 2 -name aapt2 -type f 2>/dev/null | sort -V | tail -1
}

aapt2=$(find_aapt2)
[[ -n $aapt2 && -x $aapt2 ]] || fail "aapt2 not found; set ANDROID_HOME — the version gates cannot run" "$EXIT_CANNOT_CHECK"

badging=$("$aapt2" dump badging "$APK_PATH" 2>&1) || fail "aapt2 could not read $APK: $badging" "$EXIT_CANNOT_CHECK"
apk_name=$(sed -n "s/^package:.* versionName='\([^']*\)'.*/\1/p" <<<"$badging")
apk_code=$(sed -n "s/^package:.* versionCode='\([^']*\)'.*/\1/p" <<<"$badging")
[[ -n $apk_name && $apk_code =~ ^[0-9]+$ ]] || fail "could not read versionName/versionCode from aapt2" "$EXIT_CANNOT_CHECK"

[[ $apk_name == "$VERSION" ]] || fail "APK versionName ${apk_name}, release is ${VERSION}" "$EXIT_REJECTED"

expected_code=$("$SCRIPTS/version.sh" code "$VERSION") || fail "version.sh cannot derive a versionCode for ${VERSION}" "$EXIT_REJECTED"
((apk_code == expected_code)) ||
  fail "APK versionCode ${apk_code}, version.sh derives ${expected_code} for ${VERSION} — build.gradle and version.sh disagree" "$EXIT_REJECTED"

previous_note="first release"
if [[ -n $PREVIOUS_TAG ]]; then
  previous_code=$("$SCRIPTS/version.sh" code "${PREVIOUS_TAG#"$TAG_PREFIX"}") ||
    fail "version.sh cannot derive a versionCode for ${PREVIOUS_TAG}" "$EXIT_REJECTED"
  ((apk_code > previous_code)) ||
    fail "APK versionCode ${apk_code} is not above ${PREVIOUS_TAG}'s ${previous_code}; it would not install over it" "$EXIT_REJECTED"
  previous_note="above ${PREVIOUS_TAG}'s ${previous_code}"
fi

mkdir -p "$out_dir" || fail "cannot create $out_dir" "$EXIT_CANNOT_CHECK"
cp "$APK_PATH" "$out_dir/$ASSET" || fail "cannot write $out_dir/$ASSET" "$EXIT_CANNOT_CHECK"
(cd "$out_dir" && sha256sum "$ASSET" > "$ASSET.sha256") || fail "sha256sum failed" "$EXIT_CANNOT_CHECK"

echo "release-gate: ok — versionName ${apk_name}, versionCode ${apk_code} (${previous_note})"
cat "$out_dir/$ASSET.sha256"
exit "$EXIT_OK"
