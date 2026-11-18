#!/usr/bin/env bash
set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_FAILED=1
readonly EXIT_USAGE=2
readonly EXIT_MISSING_TOOL=3

readonly VERSION=2.12.1
readonly ZIP_SHA256=54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7
readonly URL="https://github.com/mobile-dev-inc/maestro/releases/download/cli-$VERSION/maestro.zip"
readonly MIN_JAVA=17

usage() {
  cat <<USAGE
usage: install-maestro.sh

Installs Maestro CLI $VERSION into \${MAESTRO_DIR:-~/.maestro} (bin/ and lib/),
after checking the release zip's sha256. Does nothing when $VERSION is
already there. Edits no shell profile; scripts/e2e.sh finds it there.

exit 0  installed, or already installed
exit 1  download, checksum or unpack failed
exit 2  usage error
exit 3  required tool missing, or Java older than $MIN_JAVA
USAGE
}

case ${1:-} in
  '') ;;
  -h | --help)
    usage
    exit "$EXIT_USAGE"
    ;;
  *)
    echo "install-maestro: unknown argument $1" >&2
    usage >&2
    exit "$EXIT_USAGE"
    ;;
esac

readonly DEST=${MAESTRO_DIR:-$HOME/.maestro}

if [[ -f $DEST/lib/maestro-cli-$VERSION.jar && -x $DEST/bin/maestro ]]; then
  echo "Maestro $VERSION already in $DEST"
  exit "$EXIT_OK"
fi

for tool in curl unzip sha256sum java; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "install-maestro: $tool not found" >&2
    exit "$EXIT_MISSING_TOOL"
  }
done

java_major=$(java -version 2>&1 | sed -nE '1s/.*version "([0-9]+).*/\1/p')
((${java_major:-0} >= MIN_JAVA)) || {
  echo "install-maestro: Java $MIN_JAVA or newer needed, found ${java_major:-unknown}" >&2
  exit "$EXIT_MISSING_TOOL"
}

mkdir -p "$DEST" || exit "$EXIT_FAILED"
WORK=$(mktemp -d "$DEST/.install.XXXXXX") || exit "$EXIT_FAILED"
readonly WORK
trap 'rm -rf "$WORK"' EXIT

echo "Downloading Maestro $VERSION"
curl -fsSL -o "$WORK/maestro.zip" "$URL" || {
  echo "install-maestro: download failed: $URL" >&2
  exit "$EXIT_FAILED"
}
actual=$(sha256sum "$WORK/maestro.zip" | cut -d' ' -f1)
[[ $actual == "$ZIP_SHA256" ]] || {
  echo "install-maestro: sha256 mismatch: got $actual, want $ZIP_SHA256" >&2
  exit "$EXIT_FAILED"
}
mkdir "$WORK/unpacked" && unzip -q "$WORK/maestro.zip" -d "$WORK/unpacked" || {
  echo "install-maestro: unzip failed" >&2
  exit "$EXIT_FAILED"
}
rm -rf "$DEST/bin" "$DEST/lib"
mv "$WORK/unpacked/maestro/bin" "$WORK/unpacked/maestro/lib" "$DEST/" || {
  echo "install-maestro: could not move bin/ and lib/ into $DEST" >&2
  exit "$EXIT_FAILED"
}
echo "Maestro $VERSION installed in $DEST"
