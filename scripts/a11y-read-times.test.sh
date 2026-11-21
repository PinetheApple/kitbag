#!/usr/bin/env bash
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

readonly SCRIPT=scripts/a11y-read-times.sh
readonly SCRATCH_ROOT="$HOME/.cache/kitbag"
mkdir -p "$SCRATCH_ROOT"
SCRATCH=$(mktemp -d -p "$SCRATCH_ROOT" a11y-read-times.test.XXXXXX) || exit 1
readonly SCRATCH
trap 'rm -rf "$SCRATCH"' EXIT

readonly EXIT_USAGE=2
readonly EXIT_NO_LOGCAT=4
readonly EXIT_NO_READS=5

PASS=0
FAIL=0

check() {
  local name=$1 want=$2 got=$3
  if [[ $got == *"$want"* ]]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL $name: wanted '$want' in:" >&2
    echo "$got" >&2
  fi
}

check_exit() {
  local name=$1 want=$2 got=$3
  if [[ $got == "$want" ]]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL $name: wanted exit $want, got $got" >&2
  fi
}

session_line() {
  local at=$1 state=$2 action=$3 record=${4:-com.kitbag.app/KitbagMetronome/7}
  echo "11-21 00:00:$at.000 D/MediaSessionService(  551): onSessionPlaybackStateChanged: record=$record (userId=0) playbackState=PlaybackState {state=$state, custom actions=[Action:mName='$action, mIcon=1, mExtras=null]}"
}

destroy_lines() {
  echo "11-21 00:00:$1.000 I/MediaSessionStack(  551): removeSession | record: $2 (userId=0)"
  echo "11-21 00:00:$1.100 D/MediaSessionService(  551): destroySessionLocked: record=$2 (userId=0)"
}

read_line() {
  echo "11-21 00:00:$1.500 D/Maestro ( 3672): View hierarchy received in $2 ms"
}

readonly DIR="$SCRATCH/logs"
mkdir -p "$DIR"
{
  read_line 01 10
  session_line 02 'PLAYING(3)' 'Back 10 seconds'
  read_line 03 1000
  read_line 04 2000
  session_line 05 'PAUSED(2)' 'Back 10 seconds'
  read_line 06 20
  session_line 07 'PLAYING(3)' 'Tempo down'
  read_line 08 80
  destroy_lines 09 com.kitbag.app/KitbagMetronome/7
  read_line 10 30
} >"$DIR/device-logcat.txt"

out=$(bash "$SCRIPT" "$DIR" 2>&1)
check stem 'stem       n=2 median=1000 p90=2000 max=2000' "$out"
check metronome 'metronome  n=1 median=80 p90=80 max=80' "$out"
check none 'none       n=3 median=20 p90=30 max=30' "$out"
check no-other 'other      n=0' "$out"

readonly OVERLAP="$SCRATCH/overlap"
readonly STEM_RECORD=com.kitbag.app/KitbagMetronome/8
readonly CLICK_RECORD=com.kitbag.app/KitbagMetronome/9
readonly OTHER_RECORD='com.example.player/Player: auto-session/6'
mkdir -p "$OVERLAP"
{
  session_line 01 'PLAYING(3)' 'Back 10 seconds' "$STEM_RECORD"
  session_line 02 'PLAYING(3)' 'Tempo down' "$CLICK_RECORD"
  read_line 03 900
  destroy_lines 04 "$CLICK_RECORD"
  read_line 05 800
  session_line 06 'PLAYING(3)' 'Play' "$OTHER_RECORD"
  destroy_lines 07 "$OTHER_RECORD"
  read_line 08 700
  session_line 09 'PLAYING(3)' 'Tempo down' "$CLICK_RECORD"
  session_line 10 'PAUSED(2)' 'Back 10 seconds' "$STEM_RECORD"
  read_line 11 60
  destroy_lines 12 "$CLICK_RECORD"
  session_line 13 'PLAYING(3)' 'Play' "$OTHER_RECORD"
  read_line 14 40
  destroy_lines 15 "$OTHER_RECORD"
  read_line 16 5
} >"$OVERLAP/device-logcat.txt"

out=$(bash "$SCRIPT" "$OVERLAP" 2>&1)
check overlap-stem 'stem       n=3 median=800 p90=900 max=900' "$out"
check overlap-metronome 'metronome  n=1 median=60 p90=60 max=60' "$out"
check overlap-other 'other      n=1 median=40 p90=40 max=40' "$out"
check overlap-none 'none       n=1 median=5 p90=5 max=5' "$out"

sed 's/state=PLAYING(3)/state=NONE(0)/' "$DIR/device-logcat.txt" >"$SCRATCH/unmarked.txt"
mkdir "$SCRATCH/unmarked"
mv "$SCRATCH/unmarked.txt" "$SCRATCH/unmarked/device-logcat.txt"
out=$(bash "$SCRIPT" "$SCRATCH/unmarked" 2>&1)
check negative-control 'stem       n=0' "$out"

mkdir "$SCRATCH/empty"
bash "$SCRIPT" "$SCRATCH/empty" >/dev/null 2>&1
check_exit no-logcat "$EXIT_NO_LOGCAT" "$?"

mkdir "$SCRATCH/quiet"
echo 'nothing' >"$SCRATCH/quiet/logcat.txt"
bash "$SCRIPT" "$SCRATCH/quiet" >/dev/null 2>&1
check_exit no-reads "$EXIT_NO_READS" "$?"

bash "$SCRIPT" >/dev/null 2>&1
check_exit usage "$EXIT_USAGE" "$?"

echo "a11y-read-times.test: $PASS passed, $FAIL failed"
((FAIL == 0))
