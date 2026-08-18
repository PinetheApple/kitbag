#!/usr/bin/env bash
# Runs every gate CI runs, and fixes what can be fixed automatically.
#
# Typechecking alone does not catch a formatting failure, and no headless gate
# compiles Android — the Kotlin/JNI command chain was broken from M1 to M3 while
# every other gate stayed green. This runs the set, so one local pass shows every
# problem rather than revealing one per CI round trip.
set -uo pipefail

readonly EXIT_FAILED=1
readonly EXIT_USAGE=2

FIX=1
SKIP_ANDROID=0
SKIP_NATIVE=0

usage() {
  cat <<'USAGE'
usage: preflight.sh [--no-fix] [--skip-android] [--skip-native]

Runs the gates CI runs. By default it also applies formatting and lint fixes;
--no-fix checks only, which is what CI does.

  --no-fix         do not modify files
  --skip-android   skip the Gradle release build (slow, needs the SDK)
  --skip-native    skip the C++ build and verify tools

exit 0  every gate passed
exit 1  at least one gate failed
exit 2  usage error
USAGE
}

while (($#)); do
  case $1 in
    --no-fix) FIX=0 ;;
    --skip-android) SKIP_ANDROID=1 ;;
    --skip-native) SKIP_NATIVE=1 ;;
    -h | --help)
      usage
      exit "$EXIT_USAGE"
      ;;
    *)
      echo "preflight: unknown option $1" >&2
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

FAILED=()
FIXED=()

step() { printf '%s==> %s%s\n' "$BOLD" "$1" "$RESET"; }

# run_gate <name> <check-cmd> [fix-cmd]
# Collects failures rather than exiting, so one run reports everything.
run_gate() {
  local name=$1 check=$2 fix=${3:-}
  step "$name"
  if eval "$check"; then
    printf '%s    ok%s\n' "$GREEN" "$RESET"
    return 0
  fi
  if ((FIX)) && [[ -n $fix ]]; then
    printf '%s    failed — attempting fix%s\n' "$YELLOW" "$RESET"
    eval "$fix" >/dev/null 2>&1
    if eval "$check"; then
      printf '%s    fixed%s\n' "$GREEN" "$RESET"
      FIXED+=("$name")
      return 0
    fi
  fi
  printf '%s    FAILED%s\n' "$RED" "$RESET"
  FAILED+=("$name")
  return 1
}

run_gate "Typecheck — all packages" "pnpm -w typecheck"
run_gate "Lint — architecture rules, --max-warnings 0" "pnpm -w lint" "pnpm -w lint --fix"
run_gate "Format — prettier" "pnpm -w format" "pnpm exec prettier --write ."
run_gate "Generation drift guards (§13.7, §13.8.1)" "pnpm -w generate:check"
run_gate "Tests — unit suites + lint eval harness" "pnpm -w test"
run_gate "Version — app.json and its package.json mirrors agree" "./scripts/version.sh check"
run_gate "Release-script tests" "./scripts/verify-apk-signature.test.sh && ./scripts/release.test.sh"

if ((SKIP_NATIVE)); then
  step "Native core — skipped"
else
  run_gate "Native core — configure" \
    "cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON -DCMAKE_EXPORT_COMPILE_COMMANDS=ON >/dev/null"
  run_gate "Native core — build" "cmake --build native/audio_core/build >/dev/null"
  run_gate "Native lint — clang-format + clang-tidy" "bash scripts/lint.sh >/dev/null" "bash scripts/format.sh >/dev/null"

  # tuner_verify fails 37/37 by design (SPEC §10.1) and is informational in CI.
  # It is listed but never gates, so preflight is neither green by hiding it nor
  # red because of it.
  step "Native verify tools"
  for tool in metronome_verify abi_verify beat_tracker_verify mixer_verify \
    player_verify seek_race_verify stream_verify note_lock_verify \
    audio_source_verify decoder_verify analyze_verify file_audio_reader_verify; do
    binary="native/audio_core/build/$tool"
    [[ -x $binary ]] || continue
    if "$binary" >/dev/null 2>&1; then
      printf '%s    ok%s %s\n' "$GREEN" "$RESET" "$tool"
    else
      printf '%s    FAILED%s %s\n' "$RED" "$RESET" "$tool"
      FAILED+=("$tool")
    fi
  done
  if [[ -x native/audio_core/build/tuner_verify ]]; then
    native/audio_core/build/tuner_verify >/dev/null 2>&1 ||
      printf '%s    informational%s tuner_verify fails (SPEC §10.1)\n' "$YELLOW" "$RESET"
  fi
fi

if ((SKIP_ANDROID)); then
  step "Android build — skipped"
else
  run_gate "Android — assembleRelease (compiles the Kotlin/JNI chain)" \
    "(cd packages/app-shell/android && ./gradlew :app:assembleRelease -q)"
fi

echo
if ((${#FIXED[@]})); then
  printf '%sauto-fixed:%s %s\n' "$YELLOW" "$RESET" "${FIXED[*]}"
  echo "  those files are modified — commit them, or CI still fails"
fi

if ((${#FAILED[@]})); then
  printf '%sFAILED:%s %s\n' "$RED" "$RESET" "${FAILED[*]}"
  exit "$EXIT_FAILED"
fi

printf '%spreflight: all gates passed%s\n' "$GREEN" "$RESET"
