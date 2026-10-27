#!/usr/bin/env bash
set -uo pipefail

readonly EXIT_USAGE=2
readonly EXIT_BUILD_FAILED=6
readonly EXIT_MISSING_TOOL=7

usage() {
  cat <<'USAGE'
usage: soak-analyze.sh <recording> --bpm <bpm> [--first-beat-ms <ms>]
       soak-analyze.sh <recording> --grid <beats.txt>
       soak-analyze.sh --render <out.wav> <bpm> <seconds>

Judges a recorded metronome against its expected grid with click_soak: clicks
analysed, interval error mean/p50/p95/p99/max, max deviation from the local
grid, dropped, doubled and jittered clicks, and click-vs-grid offset. The tool
is (re)built first, so its output never comes from a stale binary.

  --render   write the engine's own offline click track (4/4, one click per
             beat) as a reference; analysing it must PASS

Recording on a device (SPEC.md 5.8 soak, 6.5 click-vs-grid):
  - Metronome with no subdivision, polyrhythm, muted beats or ramp: every grid
    beat must carry exactly one click, or extras read as doubles, gaps as drops.
    A double-trigger less than ~50 ms after its click (default sound) merges
    into one onset and is not seen.
  - Use the default click sound. A low preset (tom) through a resonant
    speaker can time accents and beats ~1.4 ms apart and fail as jitter.
  - Record the output as 48 kHz WAV or FLAC. MP3 decodes too, but one without
    a LAME gapless tag starts ~23 ms late, which reads as grid offset.
    A cable from the headphone/USB output into a recorder keeps room noise
    out; a mic in front of the speaker adds the speaker path, which is what
    6.5 measures.
  - Trim the recording to start before the first click and end right after
    the last: a beat whose slot runs past the end is not judged, but silence
    after the metronome stops still reads as dropped clicks.
  - Soak: --bpm alone takes the first click as beat 1; offset is reported, not
    gated. Click-vs-grid: --grid (or --first-beat-ms) with beat times in the
    recording's own timeline, i.e. the song's grid shifted by where the song
    starts in the recording.

exit 0-5  click_soak's own exit codes (listed by click_soak --help)
exit 2    usage error
exit 6    the native build failed
exit 7    cmake or ninja is not installed
exit 8    --render could not write its output file
USAGE
}

if (($# == 0)); then
  usage >&2
  exit "$EXIT_USAGE"
fi
case $1 in
  -h | --help)
    usage
    exit "$EXIT_USAGE"
    ;;
  --render)
    if (($# != 4)); then
      usage >&2
      exit "$EXIT_USAGE"
    fi
    ;;
esac

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly BUILD=$ROOT/native/audio_core/build

for tool in cmake ninja; do
  if ! command -v "$tool" >/dev/null; then
    echo "soak-analyze: $tool is not installed" >&2
    exit "$EXIT_MISSING_TOOL"
  fi
done

if [[ ! -f $BUILD/build.ninja ]] &&
  ! cmake -S "$ROOT/native/audio_core" -B "$BUILD" -G Ninja -DKITBAG_BUILD_TOOLS=ON >/dev/null; then
  echo "soak-analyze: configuring $BUILD failed" >&2
  exit "$EXIT_BUILD_FAILED"
fi
if ! build_log=$(cmake --build "$BUILD" --target click_soak metronome_render 2>&1); then
  printf '%s\n' "$build_log" >&2
  echo "soak-analyze: build failed; not running a stale click_soak" >&2
  exit "$EXIT_BUILD_FAILED"
fi

if [[ $1 == --render ]]; then
  exec "$BUILD/metronome_render" "$2" "$3" "$4"
fi

exec "$BUILD/click_soak" "$@"
