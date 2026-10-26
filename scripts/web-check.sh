#!/usr/bin/env bash
# A native-only module throws at import on web, leaving a blank page that every
# headless gate passes (#70).
set -uo pipefail

readonly EXIT_FAILED=1
readonly EXIT_USAGE=2

readonly NATIVE_ONLY_MARKERS=('OPSQLite.getConstants')

usage() {
  cat <<'USAGE'
usage: web-check.sh

Exports packages/app-shell for web into a temporary directory and checks the
bundle for modules that only exist on a device.

exit 0  web bundle built and free of native-only modules
exit 1  export failed, or a native-only module is in the bundle
exit 2  usage error
USAGE
}

case ${1:-} in
  '') ;;
  -h | --help)
    usage
    exit "$EXIT_USAGE"
    ;;
  *)
    echo "web-check: unknown option $1" >&2
    usage
    exit "$EXIT_USAGE"
    ;;
esac

cd "$(dirname "$0")/../packages/app-shell" || exit "$EXIT_FAILED"
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

if ! npx expo export --platform web --output-dir "$out" >"$out.log" 2>&1; then
  echo "web-check: expo export failed:" >&2
  grep -E 'Error|Unable' "$out.log" | head -5 >&2
  rm -f "$out.log"
  exit "$EXIT_FAILED"
fi
rm -f "$out.log"

status=0
for marker in "${NATIVE_ONLY_MARKERS[@]}"; do
  if grep -rqF "$marker" "$out/_expo/static/js/web"; then
    echo "web-check: native-only code in the web bundle: $marker" >&2
    status=$EXIT_FAILED
  fi
done
exit "$status"
