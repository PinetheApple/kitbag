#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_USAGE=2
readonly EXIT_DOWNLOAD=3
readonly EXIT_NO_LOGCAT=4
readonly EXIT_NO_READS=5

readonly REPO=PinetheApple/kitbag
readonly SHARDS=4
readonly CACHE_ROOT="${A11Y_READS_CACHE:-$HOME/.cache/agent-scratch/a11y-reads}"

usage() {
  cat <<USAGE
Usage: scripts/a11y-read-times.sh <run-id | dir>

Prints n, median, p90 and max (ms) of every Maestro "View hierarchy received in N ms"
line in e2e logcats, by the media session state at read time:
  stem       a PLAYING session whose custom actions are Back/Forward 10 seconds
  metronome  a PLAYING session whose custom actions include Tempo down
  none       no PLAYING session (paused, stopped, destroyed, or never created)

  run-id  CI run id; downloads e2e-results-shard-1..$SHARDS into
          $CACHE_ROOT/<run>/ (kept for re-runs)
  dir     a directory holding logcat.txt / device-logcat.txt files, at any depth,
          or maestro.tar.gz archives (extracted next to them)

Exit codes: 0 ok, $EXIT_USAGE usage, $EXIT_DOWNLOAD download or extract failed,
$EXIT_NO_LOGCAT no logcat found, $EXIT_NO_READS logcat has no hierarchy reads.
USAGE
}

die() {
  local code=$1
  shift
  echo "a11y-read-times: $*" >&2
  exit "$code"
}

download() {
  local run=$1 dir=$2 n shard
  for ((n = 1; n <= SHARDS; n++)); do
    shard="$dir/shard-$n"
    [[ -d $shard ]] && continue
    mkdir -p "$shard"
    gh run download "$run" --repo "$REPO" -n "e2e-results-shard-$n" -D "$shard" ||
      die "$EXIT_DOWNLOAD" "gh run download failed: run $run, shard $n"
  done
}

extract() {
  local dir=$1 tarball out
  while IFS= read -r -d '' tarball; do
    out="${tarball%.tar.gz}.d"
    [[ -d $out ]] && continue
    mkdir -p "$out"
    tar xzf "$tarball" -C "$out" || die "$EXIT_DOWNLOAD" "cannot extract $tarball"
  done < <(find "$dir" -name maestro.tar.gz -print0)
}

readonly CLASSIFY='
FNR == 1 { cls = "none" }
/MediaSessionService.*onSessionPlaybackStateChanged/ {
  if ($0 !~ /state=PLAYING\(3\)/) cls = "none"
  else if ($0 ~ /Tempo down/) cls = "metronome"
  else cls = "stem"
}
/destroySessionLocked|MediaSessionStack.*removeSession/ { cls = "none" }
/D\/Maestro.*View hierarchy received in [0-9]+ ms/ {
  match($0, /received in [0-9]+/)
  print cls, substr($0, RSTART + 12, RLENGTH - 12)
}'

readonly SUMMARISE='
{ v[$1, ++n[$1]] = $2 + 0 }
function pick(c, p,   i, k, a) {
  for (i = 1; i <= n[c]; i++) a[i] = v[c, i]
  asort(a)
  k = int(p * n[c]); if (k < p * n[c]) k++
  return a[k < 1 ? 1 : k]
}
END {
  split("stem metronome none", order, " ")
  for (i = 1; i <= 3; i++) {
    c = order[i]
    if (n[c] == 0) { printf "%-10s n=0 median=- p90=- max=-\n", c; continue }
    printf "%-10s n=%d median=%d p90=%d max=%d\n", c, n[c], pick(c, 0.5), pick(c, 0.9), pick(c, 1)
  }
}'

main() {
  if [[ $# -ne 1 || $1 == -h || $1 == --help ]]; then
    usage
    [[ $# -eq 1 ]] && exit 0
    exit "$EXIT_USAGE"
  fi
  local src=$1 dir
  if [[ $src =~ ^[0-9]+$ ]]; then
    dir="$CACHE_ROOT/$src"
    mkdir -p "$dir"
    download "$src" "$dir"
  elif [[ -d $src ]]; then
    dir=$src
  else
    die "$EXIT_USAGE" "not a run id or directory: $src"
  fi
  extract "$dir"

  local logs=()
  while IFS= read -r -d '' f; do logs+=("$f"); done < <(find "$dir" \( -name logcat.txt -o -name device-logcat.txt \) -print0)
  ((${#logs[@]} > 0)) || die "$EXIT_NO_LOGCAT" "no logcat.txt or device-logcat.txt under $dir"

  local reads
  reads=$(awk "$CLASSIFY" "${logs[@]}")
  [[ -n $reads ]] || die "$EXIT_NO_READS" "no 'View hierarchy received' lines in ${#logs[@]} logcat file(s)"
  echo "$src: ${#logs[@]} logcat file(s)"
  awk "$SUMMARISE" <<<"$reads"
}

main "$@"
