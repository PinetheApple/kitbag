#!/usr/bin/env bash
# The retire race under ThreadSanitizer, and its negative control: the same
# race with a relaxed frame tick must be reported, or the gate has gone blind.
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_FAILED=1
readonly EXIT_USAGE=2
readonly EXIT_TSAN_REPORTED=66

BUILD_DIR=native/audio_core/build-tsan

usage() {
  cat <<'USAGE'
usage: tsan-check.sh [--build-dir DIR]

Builds retire_race_verify and retire_race_relaxed_tick under ThreadSanitizer,
then requires the first to pass and the second to report a race.

  --build-dir DIR  CMake build tree (default native/audio_core/build-tsan)

exit 0  the race passes and the control is reported
exit 1  a build failed, the race failed, or the control went unreported
exit 2  usage error
USAGE
}

while (($#)); do
  case $1 in
    --build-dir)
      [[ $# -ge 2 ]] || {
        usage
        exit "$EXIT_USAGE"
      }
      BUILD_DIR=$2
      shift
      ;;
    -h | --help)
      usage
      exit "$EXIT_USAGE"
      ;;
    *)
      echo "tsan-check: unknown option $1" >&2
      usage
      exit "$EXIT_USAGE"
      ;;
  esac
  shift
done

cd "$(dirname "$0")/.." || exit "$EXIT_FAILED"

cmake -S native/audio_core -B "$BUILD_DIR" -G Ninja -DKITBAG_BUILD_TOOLS=ON \
  -DKITBAG_TSAN=ON -DCMAKE_BUILD_TYPE=RelWithDebInfo >/dev/null || {
  echo "tsan-check: configure failed" >&2
  exit "$EXIT_FAILED"
}
cmake --build "$BUILD_DIR" --target retire_race_verify retire_race_relaxed_tick || {
  echo "tsan-check: build failed" >&2
  exit "$EXIT_FAILED"
}

"$BUILD_DIR/retire_race_verify"
race=$?
if ((race != EXIT_OK)); then
  echo "tsan-check: retire_race_verify exited $race under TSan" >&2
  exit "$EXIT_FAILED"
fi

"$BUILD_DIR/retire_race_relaxed_tick" >/dev/null 2>&1
control=$?
if ((control != EXIT_TSAN_REPORTED)); then
  echo "tsan-check: the relaxed-tick control exited $control, not $EXIT_TSAN_REPORTED; TSan no longer sees the race" >&2
  exit "$EXIT_FAILED"
fi
echo "tsan-check: race clean, relaxed-tick control reported ($EXIT_TSAN_REPORTED)"
exit "$EXIT_OK"
