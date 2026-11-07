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

Runs the gates CI runs. By default it also applies formatting and lint fixes,
and a fix that rewrites files re-runs the earlier gates that read them;
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

cd "$(dirname "$0")/.." || exit "$EXIT_FAILED"

readonly BOLD=$'\033[1m'
readonly RESET=$'\033[0m'
readonly RED=$'\033[31m'
readonly GREEN=$'\033[32m'
readonly YELLOW=$'\033[33m'

FAILED=()
FIXED=()
GATE_REWROTE=0

step() { printf '%s==> %s%s\n' "$BOLD" "$1" "$RESET"; }

# Hashes content, since a fix can rewrite a file git already lists as modified.
tree_fingerprint() {
  git ls-files -m -o --exclude-standard -z | xargs -0 -r sha1sum 2>/dev/null | sha1sum
}

# run_gate <name> <check-cmd> [fix-cmd]
# Collects failures rather than exiting, so one run reports everything.
run_gate() {
  local name=$1 check=$2 fix=${3:-} before
  GATE_REWROTE=0
  step "$name"
  if eval "$check"; then
    printf '%s    ok%s\n' "$GREEN" "$RESET"
    return 0
  fi
  if ((FIX)) && [[ -n $fix ]]; then
    printf '%s    failed — attempting fix%s\n' "$YELLOW" "$RESET"
    before=$(tree_fingerprint)
    eval "$fix" >/dev/null 2>&1
    [[ $(tree_fingerprint) == "$before" ]] || GATE_REWROTE=1
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

# rerun_after_fix <name> <check-cmd>
# Replaces the gate's result, which predates a fix's rewrite of the files it read.
rerun_after_fix() {
  local name=$1 check=$2 kept=() gate
  for gate in ${FAILED[@]+"${FAILED[@]}"}; do
    [[ $gate == "$name" ]] || kept+=("$gate")
  done
  FAILED=(${kept[@]+"${kept[@]}"})
  run_gate "$name — after auto-fix" "$check"
}

readonly TYPECHECK_GATE="Typecheck — all packages"
readonly TYPECHECK_CHECK="pnpm -w typecheck"
readonly LINT_GATE="Lint — architecture rules, --max-warnings 0"
readonly LINT_CHECK="pnpm -w lint"

run_gate "$TYPECHECK_GATE" "$TYPECHECK_CHECK"
run_gate "$LINT_GATE" "$LINT_CHECK" "pnpm -w lint --fix"
lint_rewrote=$GATE_REWROTE
run_gate "Format — prettier" "pnpm -w format" "pnpm exec prettier --write ."
format_rewrote=$GATE_REWROTE
if ((format_rewrote)); then
  rerun_after_fix "$LINT_GATE" "$LINT_CHECK"
fi
if ((lint_rewrote || format_rewrote)); then
  rerun_after_fix "$TYPECHECK_GATE" "$TYPECHECK_CHECK"
fi
run_gate "Generation drift guards (§13.7, §13.8.1)" "pnpm -w generate:check"
# Ten parallel vitest runs exceed a 6 GB memory cap and get OOM-killed mid-run.
run_gate "Tests — unit suites + lint eval harness" "pnpm -w test --concurrency=2"
run_gate "Web bundle — exports, no native-only modules (#70)" "./scripts/web-check.sh"
run_gate "Version — app.json and its package.json mirrors agree" "./scripts/version.sh check"
run_gate "Release-script tests" "./scripts/version.test.sh && ./scripts/verify-apk-signature.test.sh && ./scripts/release-gate.test.sh && ./scripts/changelog.test.sh && ./scripts/release-notes.test.sh && ./scripts/preflight.test.sh"

if ((SKIP_NATIVE)); then
  step "Native core — skipped"
else
  run_gate "Native core — configure" \
    "cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON -DCMAKE_EXPORT_COMPILE_COMMANDS=ON >/dev/null"
  readonly NATIVE_BUILD_GATE="Native core — build"
  readonly NATIVE_BUILD_CHECK="cmake --build native/audio_core/build >/dev/null"
  run_gate "$NATIVE_BUILD_GATE" "$NATIVE_BUILD_CHECK"
  run_gate "Native lint — clang-format + clang-tidy" "bash scripts/lint.sh >/dev/null" "bash scripts/format.sh >/dev/null"
  if ((GATE_REWROTE)); then
    rerun_after_fix "$NATIVE_BUILD_GATE" "$NATIVE_BUILD_CHECK"
  fi

  step "Native verify tools"
  for tool in metronome_verify abi_verify beat_tracker_verify mixer_verify \
    player_verify seek_race_verify stream_verify stem_sync_verify \
    audio_source_verify decoder_verify analyze_verify file_audio_reader_verify \
    tuner_verify click_soak_verify analyze_memory_verify; do
    binary="native/audio_core/build/$tool"
    [[ -x $binary ]] || continue
    if "$binary" >/dev/null 2>&1; then
      printf '%s    ok%s %s\n' "$GREEN" "$RESET" "$tool"
    else
      printf '%s    FAILED%s %s\n' "$RED" "$RESET" "$tool"
      FAILED+=("$tool")
    fi
  done
fi

if ((SKIP_ANDROID)); then
  step "Android build — skipped"
else
  run_gate "Android — assembleRelease (compiles the Kotlin/JNI chain)" \
    "(cd packages/app-shell/android && ./gradlew :app:assembleRelease :kitbag_core-native:testReleaseUnitTest -q)"
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
