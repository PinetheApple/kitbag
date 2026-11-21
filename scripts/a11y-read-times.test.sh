#!/usr/bin/env bash
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

readonly SCRIPT=scripts/a11y-read-times.sh
readonly SCRATCH_ROOT="$HOME/.cache/agent-scratch"
mkdir -p "$SCRATCH_ROOT"
SCRATCH=$(mktemp -d -p "$SCRATCH_ROOT") || exit 1
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

session_line() {
  echo "11-21 00:00:$1.000 D/MediaSessionService(  551): onSessionPlaybackStateChanged: record=com.kitbag.app/KitbagMetronome/7 (userId=0) playbackState=PlaybackState {state=$2, custom actions=[Action:mName='$3"
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
  echo "11-21 00:00:09.000 D/MediaSessionService(  551): destroySessionLocked: record=x"
  read_line 10 30
} >"$DIR/device-logcat.txt"

out=$(bash "$SCRIPT" "$DIR" 2>&1)
check stem 'stem       n=2 median=1000 p90=2000 max=2000' "$out"
check metronome 'metronome  n=1 median=80 p90=80 max=80' "$out"
check none 'none       n=3 median=20 p90=30 max=30' "$out"

sed 's/state=PLAYING(3)/state=NONE(0)/' "$DIR/device-logcat.txt" >"$SCRATCH/unmarked.txt"
mkdir "$SCRATCH/unmarked"
mv "$SCRATCH/unmarked.txt" "$SCRATCH/unmarked/device-logcat.txt"
out=$(bash "$SCRIPT" "$SCRATCH/unmarked" 2>&1)
check negative-control 'stem       n=0' "$out"

mkdir "$SCRATCH/empty"
bash "$SCRIPT" "$SCRATCH/empty" >/dev/null 2>&1
check no-logcat "$EXIT_NO_LOGCAT" "$?"

mkdir "$SCRATCH/quiet"
echo 'nothing' >"$SCRATCH/quiet/logcat.txt"
bash "$SCRIPT" "$SCRATCH/quiet" >/dev/null 2>&1
check no-reads "$EXIT_NO_READS" "$?"

bash "$SCRIPT" >/dev/null 2>&1
check usage "$EXIT_USAGE" "$?"

echo "a11y-read-times.test: $PASS passed, $FAIL failed"
((FAIL == 0))
