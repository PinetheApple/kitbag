#!/usr/bin/env bash
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_FLOW_FAILED=1
readonly EXIT_USAGE=2
readonly EXIT_MISSING_TOOL=3
readonly EXIT_NO_DEVICE=4
readonly EXIT_INSTALL_FAILED=5
readonly EXIT_RUNNER_FAILED=6

readonly DEFAULT_SERIAL=emulator-5554
readonly FIXTURE_SONG=e2eclick
readonly FIXTURE_SECONDS=240
readonly FIXTURE_SOUND=e2ehit
readonly FIXTURE_SOUND_SECONDS=1
readonly FIXTURE_BACKUP=e2estemsongs
readonly DEVICE_DOWNLOADS=/sdcard/Download
readonly DEFAULT_MAESTRO_HEAP=-Xmx1g
readonly ANR_WINDOW='Application Not Responding'
readonly ANR_WAIT_SECONDS=30
readonly ANR_POLL_SECONDS=2
declare -rA RUN_SETTINGS=(
  [window_animation_scale]=0
  [transition_animation_scale]=0
  [animator_duration_scale]=0
  [hide_error_dialogs]=1
)

usage() {
  cat <<'USAGE'
usage: e2e.sh [options] APK [FLOW...]

Installs APK on a running emulator and runs the Maestro flows under e2e/flows.
FLOW is a path under e2e/flows, with or without .yaml (a directory runs every
flow in it). With no FLOW, every flow runs.

  --device SERIAL   run on SERIAL; without it only emulator-5554 is used
  --out DIR         where the report, screenshots and logcat go
                    (default: $XDG_CACHE_HOME/kitbag-e2e/<timestamp>)
  --skip-install    run against the app already installed; APK is not given
  -h, --help        show this help

Maestro is ~/.maestro/bin/maestro unless MAESTRO is set. MAESTRO_OPTS
defaults to -Xmx1g.
Animation scales are 0 and error dialogs hidden during the run, and an ANR
dialog already open is closed, so another app's ANR cannot cover the app; a
hung app still fails its flow.
All four settings are restored on exit.

exit 0  every flow passed
exit 1  a flow failed; the flow and its failing step are printed
exit 2  usage error
exit 3  required tool missing
exit 4  the device is not attached and ready
exit 5  install or fixture push failed
exit 6  Maestro failed without writing a report
USAGE
}

SERIAL=$DEFAULT_SERIAL
OUT=""
SKIP_INSTALL=0
POSITIONAL=()

while (($#)); do
  case $1 in
    --device)
      (($# >= 2)) || {
        echo "e2e: --device needs a serial" >&2
        exit "$EXIT_USAGE"
      }
      SERIAL=$2
      shift
      ;;
    --out)
      (($# >= 2)) || {
        echo "e2e: --out needs a directory" >&2
        exit "$EXIT_USAGE"
      }
      OUT=$2
      shift
      ;;
    --skip-install) SKIP_INSTALL=1 ;;
    -h | --help)
      usage
      exit "$EXIT_USAGE"
      ;;
    -*)
      echo "e2e: unknown option $1" >&2
      usage >&2
      exit "$EXIT_USAGE"
      ;;
    *) POSITIONAL+=("$1") ;;
  esac
  shift
done

APK=""
if ((!SKIP_INSTALL)); then
  ((${#POSITIONAL[@]} > 0)) || {
    echo "e2e: no APK given" >&2
    usage >&2
    exit "$EXIT_USAGE"
  }
  APK=${POSITIONAL[0]}
  POSITIONAL=("${POSITIONAL[@]:1}")
  [[ -f $APK ]] || {
    echo "e2e: no APK at $APK" >&2
    exit "$EXIT_USAGE"
  }
  APK=$(realpath "$APK")
fi
OUT=$(realpath -m "${OUT:-${XDG_CACHE_HOME:-$HOME/.cache}/kitbag-e2e/$(date +%Y%m%d-%H%M%S)}")

cd "$(dirname "$0")/.." || exit "$EXIT_USAGE"
readonly FLOW_ROOT=e2e/flows

((${#POSITIONAL[@]} > 0)) || POSITIONAL=(.)
FLOWS=()
for name in "${POSITIONAL[@]}"; do
  name=${name#"$FLOW_ROOT"/}
  if [[ -d $FLOW_ROOT/$name ]]; then
    mapfile -t -O "${#FLOWS[@]}" FLOWS < <(find "$FLOW_ROOT/$name" -name '*.yaml' | sort)
  elif [[ -f $FLOW_ROOT/${name%.yaml}.yaml ]]; then
    FLOWS+=("$FLOW_ROOT/${name%.yaml}.yaml")
  else
    echo "e2e: no flow $name under $FLOW_ROOT" >&2
    exit "$EXIT_USAGE"
  fi
done
((${#FLOWS[@]} > 0)) || {
  echo "e2e: no flows under ${POSITIONAL[*]}" >&2
  exit "$EXIT_USAGE"
}

readonly BOLD=$'\033[1m'
readonly RESET=$'\033[0m'
readonly RED=$'\033[31m'
readonly GREEN=$'\033[32m'

step() { printf '%s==> %s%s\n' "$BOLD" "$1" "$RESET"; }
fail() { printf '%s%s%s\n' "$RED" "$1" "$RESET" >&2; }

MAESTRO=${MAESTRO:-$HOME/.maestro/bin/maestro}
for tool in adb python3 "$MAESTRO"; do
  command -v "$tool" >/dev/null 2>&1 || {
    fail "$tool not found (Maestro: bash scripts/install-maestro.sh)"
    exit "$EXIT_MISSING_TOOL"
  }
done

state=$(adb -s "$SERIAL" get-state 2>/dev/null)
[[ $state == device ]] || {
  fail "device $SERIAL is not ready (state: ${state:-absent})"
  exit "$EXIT_NO_DEVICE"
}

mkdir -p "$OUT" || exit "$EXIT_USAGE"
readonly REPORT="$OUT/report.xml"
readonly ARTIFACTS="$OUT/maestro"

adb_s() { adb -s "$SERIAL" "$@"; }

if ((!SKIP_INSTALL)); then
  step "Installing $(basename "$APK") on $SERIAL"
  install_output=$(adb_s install -r "$APK" 2>&1)
  [[ $install_output == *Success* ]] || {
    fail "install failed"
    echo "$install_output" >&2
    exit "$EXIT_INSTALL_FAILED"
  }
fi

step "Turning animations and error dialogs off"
declare -A previous_setting
restore_settings() {
  for setting in "${!previous_setting[@]}"; do
    if [[ ${previous_setting[$setting]} == null ]]; then
      adb_s shell settings delete global "$setting" >/dev/null
    else
      adb_s shell settings put global "$setting" "${previous_setting[$setting]}"
    fi
  done
}
trap restore_settings EXIT
for setting in "${!RUN_SETTINGS[@]}"; do
  previous_setting[$setting]=$(adb_s shell settings get global "$setting" | tr -d '\r')
  adb_s shell settings put global "$setting" "${RUN_SETTINGS[$setting]}"
done

anr_window_open() { adb_s shell dumpsys window windows | grep -q "$ANR_WINDOW"; }
if anr_window_open; then
  step "Closing another app's ANR dialog"
  adb_s shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null
  for ((waited = 0; waited < ANR_WAIT_SECONDS; waited += ANR_POLL_SECONDS)); do
    anr_window_open || break
    sleep "$ANR_POLL_SECONDS"
  done
  if anr_window_open; then
    echo "  still open after ${ANR_WAIT_SECONDS} s; launch-fresh dismisses it"
  else
    echo "  closed after ${waited} s"
  fi
fi

push_fixture() {
  local fixture="$OUT/$1.wav"
  python3 -I e2e/make_click_song.py "$fixture" "$2" &&
    adb_s push "$fixture" "$DEVICE_DOWNLOADS/" >/dev/null || {
    fail "could not make or push $fixture"
    exit "$EXIT_INSTALL_FAILED"
  }
}

step "Pushing the fixture song, click sound and backup"
push_fixture "$FIXTURE_SONG" "$FIXTURE_SECONDS"
push_fixture "$FIXTURE_SOUND" "$FIXTURE_SOUND_SECONDS"
adb_s push "e2e/fixtures/$FIXTURE_BACKUP.json" "$DEVICE_DOWNLOADS/" >/dev/null || {
  fail "could not push e2e/fixtures/$FIXTURE_BACKUP.json"
  exit "$EXIT_INSTALL_FAILED"
}

step "Running ${#FLOWS[@]} flow(s)"
adb_s logcat -c 2>/dev/null
rm -rf "$REPORT" "$ARTIFACTS"
MAESTRO_CLI_NO_ANALYTICS=1 \
  MAESTRO_DISABLE_UPDATE_CHECK=true \
  MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true \
  MAESTRO_OPTS=${MAESTRO_OPTS:-$DEFAULT_MAESTRO_HEAP} \
  "$MAESTRO" test \
  --device "$SERIAL" \
  --format junit \
  --output "$REPORT" \
  --test-output-dir "$ARTIFACTS" \
  -e FIXTURE_SONG="$FIXTURE_SONG" \
  -e FIXTURE_SOUND="$FIXTURE_SOUND" \
  -e FIXTURE_BACKUP="$FIXTURE_BACKUP" \
  "${FLOWS[@]}"
maestro_status=$?

if ((maestro_status == 0)); then
  printf '%sall flows passed%s  (%s)\n' "$GREEN" "$RESET" "$OUT"
  exit "$EXIT_OK"
fi

adb_s logcat -d >"$OUT/logcat.txt" 2>/dev/null

if [[ ! -s $REPORT ]]; then
  fail "Maestro exited $maestro_status without a report"
  echo "  logcat: $OUT/logcat.txt" >&2
  exit "$EXIT_RUNNER_FAILED"
fi

fail "flows failed:"
python3 -I - "$REPORT" "$ARTIFACTS" "$OUT" <<'PY' >&2
import shutil
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

report, artifacts, out = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
failed = 0
for case in ET.parse(report).iter('testcase'):
    problem = case.find('failure')
    if problem is None:
        problem = case.find('error')
    if problem is None:
        continue
    failed += 1
    name = case.get('name') or ''
    step = (problem.get('message') or problem.text or 'no step reported').strip()
    print(f'  {name}\n    failed at: {step}')
    flow_dir = name.replace('/', '_')
    shots = sorted(
        (
            shot
            for folder in artifacts.rglob('screenshots')
            if folder.parent.name == flow_dir
            for shot in folder.glob('*.png')
        ),
        key=lambda shot: shot.stat().st_mtime,
    )
    if shots:
        saved = out / f'failure-{failed}.png'
        shutil.copyfile(shots[-1], saved)
        print(f'    screenshot: {saved}')
    else:
        print('    screenshot: none captured')
PY
echo "  logcat:  $OUT/logcat.txt" >&2
echo "  Maestro: $ARTIFACTS" >&2
exit "$EXIT_FLOW_FAILED"
