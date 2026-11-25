#!/usr/bin/env bash
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

readonly SCRIPT=scripts/e2e.sh
SCRATCH=$(mktemp -d) || exit 1
readonly SCRATCH
trap 'rm -rf "$SCRATCH"' EXIT

readonly EXIT_OK=0
readonly EXIT_FLOW_FAILED=1
readonly EXIT_USAGE=2
readonly EXIT_MISSING_TOOL=3
readonly EXIT_NO_DEVICE=4
readonly EXIT_INSTALL_FAILED=5
readonly EXIT_RUNNER_FAILED=6
readonly EXIT_NOT_INDEXED=7

readonly FAKE_BIN="$SCRATCH/bin"
readonly FAKE_MAESTRO="$FAKE_BIN/maestro"
export ADB_LOG="$SCRATCH/adb.log"
export MAESTRO_LOG="$SCRATCH/maestro.log"
export INDEX_POLLS="$SCRATCH/index-polls"
export SLEEP_LOG="$SCRATCH/sleep.log"
mkdir -p "$FAKE_BIN"

cat > "$FAKE_BIN/adb" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$ADB_LOG"
[[ $1 == -s ]] && shift 2
case $1 in
  get-state)
    [[ ${FAKE_STATE:-device} == device ]] || exit 1
    echo device ;;
  install) echo "${FAKE_INSTALL:-Success}" ;;
  shell)
    [[ $2 == settings && $3 == get ]] && echo "${FAKE_ANIMATION:-1.0}"
    [[ $2 == dumpsys && -n ${FAKE_ANR:-} && -e $FAKE_ANR ]] && echo "Window{1 u0 Application Not Responding: launcher}"
    [[ $2 == am && $3 == broadcast && -n ${FAKE_ANR:-} ]] && rm -f "$FAKE_ANR"
    if [[ $2 == "content query"* ]]; then
      polls=$(($(cat "$INDEX_POLLS" 2>/dev/null || echo 0) + 1))
      echo "$polls" > "$INDEX_POLLS"
      name=${2##*_display_name=\'}
      name=${name%%\'*}
      if [[ ${FAKE_INDEXED_AFTER:-0} != never ]] && ((polls > ${FAKE_INDEXED_AFTER:-0})); then
        echo "Row: 0 _display_name=$name"
      else
        echo "No result found."
      fi
    fi
    ;;
  exec-out) printf 'PNG' ;;
  logcat) [[ ${2:-} == -d ]] && echo "11-19 E/kitbag: logged" ;;
esac
exit 0
STUB
cat > "$FAKE_MAESTRO" <<'STUB'
#!/usr/bin/env bash
{
  echo "analytics=${MAESTRO_CLI_NO_ANALYTICS:-unset} update=${MAESTRO_DISABLE_UPDATE_CHECK:-unset} opts=${MAESTRO_OPTS:-unset}"
  printf '%s\n' "$@"
} > "$MAESTRO_LOG"
report=""
artifacts=""
while (($#)); do
  [[ $1 == --output ]] && report=$2
  [[ $1 == --test-output-dir ]] && artifacts=$2
  shift
done
case ${FAKE_RESULT:-pass} in
  pass) exit 0 ;;
  crash) exit 1 ;;
  fail)
    cat > "$report" <<'XML'
<?xml version='1.0' encoding='UTF-8'?>
<testsuites><testsuite name="Test Suite" tests="2" failures="1">
<testcase id="ok" name="a flow that passed" classname="ok"/>
<testcase id="bad" name="#369 1: standalone settings come back" classname="bad"><failure message="Assertion is false: &quot;Tempo, 125 BPM&quot; is visible"/></testcase>
</testsuite></testsuites>
XML
    shots="$artifacts/2026-11-19_024914/#369 1: standalone settings come back/screenshots"
    mkdir -p "$shots"
    echo EARLIER > "$shots/002-runFlow.png"
    touch -d '1 minute ago' "$shots/002-runFlow.png"
    echo AT-FAILURE > "$shots/007-assertVisible.png"
    logs="${shots%/screenshots}/logs"
    mkdir -p "$logs"
    case ${FAKE_CRASH:-none} in
      header) printf '%s\n' "--------- beginning of crash" "E/AndroidRuntime( 41): FATAL EXCEPTION: main" > "$logs/crash-report.txt" ;;
      maestro) : > "$logs/crash-report.txt" ;;
    esac
    [[ ${FAKE_CRASH:-none} == none ]] || cat >> "$logs/crash-report.txt" <<'CRASH'
E/AndroidRuntime( 41): Process: com.kitbag.app, PID: 41
E/AndroidRuntime( 41): java.lang.NullPointerException: Attempt to read from field 'int android.view.View.mViewFlags'
E/AndroidRuntime( 41): 	at android.view.ViewGroup.dispatchGetDisplayList(ViewGroup.java:4493)
E/AndroidRuntime( 41): 	at android.view.View.updateDisplayListIfDirty(View.java:23646)
E/AndroidRuntime( 41): 	at android.view.ThreadedRenderer.draw(ThreadedRenderer.java:798)
E/AndroidRuntime( 41): 	at android.os.Looper.loop(Looper.java:317)
CRASH
    exit 1 ;;
esac
STUB
cat > "$FAKE_BIN/sleep" <<'STUB'
#!/usr/bin/env bash
echo "$1" >> "$SLEEP_LOG"
STUB
chmod +x "$FAKE_BIN"/*

readonly APK="$SCRATCH/app.apk"
echo "not really an apk" > "$APK"

PASS=0
FAIL=0

expect() {
  local name=$1 want_exit=$2 want_text=$3
  shift 3
  local out_dir="$SCRATCH/out-$((PASS + FAIL))" script="$PWD/$SCRIPT" output status
  rm -f "$ADB_LOG" "$MAESTRO_LOG" "$INDEX_POLLS" "$SLEEP_LOG"
  output=$(cd "${RUN_FROM:-.}" && PATH="$FAKE_BIN:$PATH" MAESTRO="${MAESTRO_UNDER_TEST:-$FAKE_MAESTRO}" \
    XDG_CACHE_HOME="$out_dir" "$script" "$@" 2>&1)
  status=$?
  if [[ $status != "$want_exit" ]]; then
    printf '  FAIL  %s: exit %s, want %s\n%s\n' "$name" "$status" "$want_exit" "$output"
    FAIL=$((FAIL + 1))
  elif [[ -n $want_text && $output != *"$want_text"* ]]; then
    printf '  FAIL  %s: output lacks "%s"\n%s\n' "$name" "$want_text" "$output"
    FAIL=$((FAIL + 1))
  else
    printf '  ok    %s\n' "$name"
    PASS=$((PASS + 1))
  fi
  LAST_OUT_DIR=$out_dir
  LAST_OUTPUT=$output
}

check() {
  local name=$1
  shift
  if "$@"; then
    printf '  ok    %s\n' "$name"
    PASS=$((PASS + 1))
  else
    printf '  FAIL  %s\n' "$name"
    FAIL=$((FAIL + 1))
  fi
}

flow_count() { find e2e/flows -name '*.yaml' | wc -l; }
maestro_flows() { grep -c '^e2e/flows/.*\.yaml$' "$MAESTRO_LOG"; }
adb_called() { grep -q -- "$1" "$ADB_LOG"; }
maestro_got() { grep -qx -- "$1" "$MAESTRO_LOG"; }
maestro_ran() { [[ -e $MAESTRO_LOG ]]; }
maestro_skipped() { [[ ! -e $MAESTRO_LOG ]]; }
sleeps_were() { [[ $(cat "$SLEEP_LOG" 2>/dev/null | wc -l) == "$1" ]]; }

echo "e2e.sh"

expect "--help is a usage exit" "$EXIT_USAGE" "usage: e2e.sh" --help
expect "unknown option" "$EXIT_USAGE" "unknown option --bogus" --bogus "$APK"
expect "no APK" "$EXIT_USAGE" "no APK given"
expect "APK path that does not exist" "$EXIT_USAGE" "no APK at" "$SCRATCH/missing.apk"
expect "unknown flow" "$EXIT_USAGE" "no flow nope" "$APK" nope
expect "--device without a serial" "$EXIT_USAGE" "needs a serial" "$APK" --device

MAESTRO_UNDER_TEST="$SCRATCH/no-maestro" expect "Maestro missing" "$EXIT_MISSING_TOOL" "not found" "$APK"

FAKE_STATE=offline expect "device not ready" "$EXIT_NO_DEVICE" "emulator-5554 is not ready" "$APK"
check "the default device is emulator-5554 only" adb_called "-s emulator-5554 get-state"
expect "another serial is used only when given" "$EXIT_OK" "" --device R5CX "$APK"
check "  ... and the install goes to it" adb_called "-s R5CX install -r $APK"

FAKE_INSTALL="Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]" \
  expect "install failure" "$EXIT_INSTALL_FAILED" "INSTALL_FAILED_UPDATE_INCOMPATIBLE" "$APK"

expect "every flow passes" "$EXIT_OK" "all flows passed" "$APK"
check "  ... leaves permissions to the flows' launchApp" bash -c '! grep -q "pm grant" "$ADB_LOG"'
check "  ... pushes the fixture song" adb_called "push .*e2eclick.wav /sdcard/Download/"
check "  ... and the fixture click sound" adb_called "push .*e2ehit.wav /sdcard/Download/"
check "  ... and the stem song with a beat grid" adb_called "push .*e2estems.zip /sdcard/Download/"
check "  ... and the one without" adb_called "push .*e2enogrid.zip /sdcard/Download/"
check "  ... whose bundles differ only in beats.json" python3 -I -c '
import sys, zipfile
grid, bare = (set(zipfile.ZipFile(p).namelist()) for p in sys.argv[1:])
sys.exit(grid - bare != {"beats.json"} or bare - grid != set())
' "$(find "$LAST_OUT_DIR" -name e2estems.zip)" "$(find "$LAST_OUT_DIR" -name e2enogrid.zip)"
check "  ... and a long gridless one" adb_called "push .*e2elongnogrid.zip /sdcard/Download/"
check "  ... as long as the fixture song, with no beat grid" python3 -I -c '
import json, sys, wave, zipfile
manifest = json.loads(zipfile.ZipFile(sys.argv[1]).read("manifest.json"))
with wave.open(sys.argv[2]) as song:
    song_seconds = song.getnframes() / song.getframerate()
sys.exit(manifest["duration_sec"] != song_seconds or "beats.json" in zipfile.ZipFile(sys.argv[1]).namelist())
' "$(find "$LAST_OUT_DIR" -name e2elongnogrid.zip)" "$(find "$LAST_OUT_DIR" -name e2eclick.wav)"
check "  ... runs every flow, no subflows" test "$(maestro_flows)" -eq "$(flow_count)"
check "  ... on the emulator" maestro_got "emulator-5554"
check "  ... with a JUnit report" maestro_got "junit"
check "  ... with analytics and update checks off and a capped heap" \
  maestro_got "analytics=1 update=true opts=-Xmx1g"
check "  ... and the fixture title passed in" maestro_got "FIXTURE_SONG=e2eclick"
check "  ... and the fixture sound's name" maestro_got "FIXTURE_SOUND=e2ehit"
check "  ... and the gridded stem song's title" maestro_got "FIXTURE_STEMS=e2estems"
check "  ... and the gridless one's" maestro_got "FIXTURE_STEMS_NO_GRID=e2enogrid"
check "  ... and the long gridless one's" maestro_got "FIXTURE_STEMS_LONG_NO_GRID=e2elongnogrid"
check "  ... pushes the fixture backup" adb_called "push e2e/fixtures/e2estemsongs.json /sdcard/Download/"
check "  ... and its name passed in" maestro_got "FIXTURE_BACKUP=e2estemsongs"

check "  ... with every animation scale at 0 during the run" \
  bash -c 'for s in window_animation_scale transition_animation_scale animator_duration_scale; do grep -q "settings put global $s 0" "$ADB_LOG" || exit 1; done'
check "  ... and each one back at its old value afterwards" \
  bash -c 'for s in window_animation_scale transition_animation_scale animator_duration_scale; do [[ $(grep "settings put global $s" "$ADB_LOG" | tail -1) == *"$s 1.0" ]] || exit 1; done'
check "  ... and error dialogs hidden during the run" \
  bash -c 'grep -q "settings put global hide_error_dialogs 1" "$ADB_LOG"'
check "  ... and closes no dialog when none is open" bash -c '! grep -q CLOSE_SYSTEM_DIALOGS "$ADB_LOG"'
check "  ... and their setting back afterwards" \
  bash -c '[[ $(grep "settings put global hide_error_dialogs" "$ADB_LOG" | tail -1) == *"dialogs 1.0" ]]'
touch "$SCRATCH/anr"
FAKE_ANR="$SCRATCH/anr" expect "another app's ANR dialog is open" "$EXIT_OK" "closed after 0 s" "$APK" metronome
check "  ... and is closed before the flows" adb_called "am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS"

FAKE_ANIMATION=null expect "an animation setting that was unset" "$EXIT_OK" "" "$APK" metronome
check "  ... is deleted again, not set" \
  bash -c 'for s in window_animation_scale transition_animation_scale animator_duration_scale; do grep -q "settings delete global $s" "$ADB_LOG" || exit 1; done'

expect "a directory selects its flows" "$EXIT_OK" "" "$APK" metronome
check "  ... only that directory's" test "$(maestro_flows)" -eq "$(find e2e/flows/metronome -name '*.yaml' | wc -l)"
expect "a single flow, .yaml optional" "$EXIT_OK" "" "$APK" mini-player/rename-updates-bar
check "  ... just that one" maestro_got "e2e/flows/mini-player/rename-updates-bar.yaml"

expect "--skip-install takes no APK" "$EXIT_OK" "" --skip-install metronome
check "  ... and installs nothing" bash -c '! grep -q " install " "$ADB_LOG"'

FAKE_RESULT=fail expect "a failing flow names the flow" "$EXIT_FLOW_FAILED" \
  "#369 1: standalone settings come back" "$APK"
FAKE_RESULT=fail expect "  ... and the failing step" "$EXIT_FLOW_FAILED" \
  'failed at: Assertion is false: "Tempo, 125 BPM" is visible' "$APK"
check "  ... and copies that flow's own capture at the failure" \
  bash -c "[[ \$(cat \$(find '$LAST_OUT_DIR' -name failure-1.png)) == AT-FAILURE ]]"
check "  ... and names it" test "${LAST_OUTPUT/screenshot: *failure-1.png/}" != "$LAST_OUTPUT"
check "  ... and restores the animation scales" \
  bash -c '[[ $(grep "settings put global animator_duration_scale" "$ADB_LOG" | tail -1) == *"scale 1.0" ]]'
check "  ... and saves logcat" bash -c "[[ -s \$(find '$LAST_OUT_DIR' -name logcat.txt) ]]"
check "  ... and does not list the flow that passed" test "${LAST_OUTPUT/a flow that passed/}" == "$LAST_OUTPUT"
check "  ... and prints no crash when the app did not crash" test "${LAST_OUTPUT/crash/}" == "$LAST_OUTPUT"

FAKE_RESULT=fail FAKE_CRASH=header expect "a flow failing on an app crash prints the FATAL EXCEPTION" \
  "$EXIT_FLOW_FAILED" "FATAL EXCEPTION: main" "$APK"
check "  ... and the exception" test "${LAST_OUTPUT/java.lang.NullPointerException/}" != "$LAST_OUTPUT"
check "  ... and names the crash report" test "${LAST_OUTPUT/crash: *crash-report.txt/}" != "$LAST_OUTPUT"
check "  ... but not the whole stack" test "${LAST_OUTPUT/Looper.loop/}" == "$LAST_OUTPUT"
check "  ... nor the lines before the marker" test "${LAST_OUTPUT/beginning of crash/}" == "$LAST_OUTPUT"
FAKE_RESULT=fail FAKE_CRASH=maestro expect "a crash report without the FATAL EXCEPTION header still prints the exception" \
  "$EXIT_FLOW_FAILED" "java.lang.NullPointerException" "$APK"
check "  ... from its first line" test "${LAST_OUTPUT/Process: com.kitbag.app/}" != "$LAST_OUTPUT"

FAKE_INDEXED_AFTER=0 expect "fixtures indexed at once" "$EXIT_OK" "all flows passed" "$APK" metronome
check "  ... are each scanned" adb_called "MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/e2estems.zip"
check "  ... and looked up" adb_called "content query .*_display_name='e2enogrid.zip'"
check "  ... the fixture backup too" adb_called "content query .*_display_name='e2estemsongs.json'"
check "  ... with no wait" sleeps_were 0
FAKE_INDEXED_AFTER=3 expect "fixtures indexed after 3 polls" "$EXIT_OK" "all flows passed" "$APK" metronome
check "  ... wait 3 polls, then run the flows" sleeps_were 3
check "  ... and Maestro runs" maestro_ran
FAKE_INDEXED_AFTER=never expect "a fixture never indexed" "$EXIT_NOT_INDEXED" \
  "e2eclick.wav was pushed but MediaProvider did not index it within 60 s" "$APK" metronome
check "  ... runs no flow" maestro_skipped

FAKE_RESULT=crash expect "Maestro dies without a report" "$EXIT_RUNNER_FAILED" "without a report" "$APK"
readonly STALE_OUT="$SCRATCH/stale"
mkdir -p "$STALE_OUT"
echo '<testsuites><testsuite><testcase name="old run"><failure message="old"/></testcase></testsuite></testsuites>' \
  > "$STALE_OUT/report.xml"
FAKE_RESULT=crash expect "  ... even when an earlier run left a report in --out" "$EXIT_RUNNER_FAILED" \
  "without a report" --out "$STALE_OUT" "$APK"

RUN_FROM=$SCRATCH expect "relative APK and --out paths" "$EXIT_OK" "" --out rel-out app.apk
check "  ... install the APK from the caller's directory" adb_called "install -r $SCRATCH/app.apk"
check "  ... and write under the caller's directory" test -s "$SCRATCH/rel-out/e2eclick.wav"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
((FAIL == 0)) && exit "$EXIT_OK"
exit "$EXIT_FLOW_FAILED"
