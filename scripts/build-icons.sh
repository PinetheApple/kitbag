#!/usr/bin/env bash
# Render every Kitbag launcher/splash raster from the single SVG mark (#52).
#
# Source of truth: design/kitbag-mark.svg (§13.7 — one definition, one owner).
# Rasters are generated, never hand-exported per density. Outputs land in two
# places: packages/app-shell/assets/ (what app.json points at, so a future
# `expo prebuild` regenerates the same icons) and the committed android res/
# tree (what actually ships today — SPEC §13.8 keeps android/ committed and
# prebuild out of the build path).
#
# Idempotent: re-running overwrites every output from scratch.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/build-icons.sh

Regenerates all launcher/splash rasters from design/kitbag-mark.svg.
Requires rsvg-convert on PATH (pacman -S librsvg).
EOF
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "") ;;
  *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
esac

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "error: rsvg-convert not found (pacman -S librsvg)" >&2
  exit 3
fi

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
source_svg="$repo_root/design/kitbag-mark.svg"
app_shell="$repo_root/packages/app-shell"
res="$app_shell/android/app/src/main/res"
assets="$app_shell/assets"

if [ ! -f "$source_svg" ]; then
  echo "error: $source_svg missing — nothing to render from" >&2
  exit 4
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# --- Derived SVG variants ----------------------------------------------------
# Mark alone (transparent background): drop the background rect line.
grep -v 'id="background"' "$source_svg" > "$tmp/mark.svg"
# Adaptive foreground: mark inside the safe zone (scaled about the centre).
sed 's|<g id="mark">|<g id="mark" transform="translate(256 256) scale(0.85) translate(-256 -256)">|' \
  "$tmp/mark.svg" > "$tmp/foreground.svg"
# Monochrome (Android 13 themed icons): alpha channel carries the shape.
sed -e 's/#FFB347/#FFFFFF/g' -e 's/#E89B2E/#FFFFFF/g' \
  "$tmp/foreground.svg" > "$tmp/monochrome.svg"
# Round legacy launcher: circular mask instead of the full-bleed square.
sed 's|<rect id="background"[^/]*/>|<circle cx="256" cy="256" r="256" fill="#0E0D10"/>|' \
  "$source_svg" > "$tmp/round.svg"

# --- Density tables ----------------------------------------------------------
# legacy launcher + round: 48/72/96/144/192
legacy_dirs=(mdpi hdpi xhdpi xxhdpi xxxhdpi)
legacy_px=(48 72 96 144 192)
# adaptive foreground/monochrome: 108/162/216/324/432
adaptive_px=(108 162 216 324 432)
# splash logo drawables: 96/144/192/288/384
splash_px=(96 144 192 288 384)

mkdir -p "$assets/adaptive-icon"

render() { rsvg-convert -w "$2" -h "$2" "$1"; }

# --- app assets (app.json points here) ---------------------------------------
render "$source_svg" 1024 > "$assets/icon.png"
render "$tmp/mark.svg" 512 > "$assets/splash-icon.png"
render "$tmp/foreground.svg" 1024 > "$assets/adaptive-icon/foreground.png"
printf '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#0E0D10"/></svg>' \
  > "$tmp/bg.svg"
render "$tmp/bg.svg" 1024 > "$assets/adaptive-icon/background.png"
render "$tmp/monochrome.svg" 1024 > "$assets/adaptive-icon/monochrome.png"

# --- Committed android res tree ----------------------------------------------
for i in "${!legacy_dirs[@]}"; do
  d="$res/mipmap-${legacy_dirs[$i]}"
  n="${legacy_px[$i]}"
  mkdir -p "$d"
  # Same resource name in two formats duplicates the resource — remove the
  # template's .webp placeholders before writing ours.
  rm -f "$d/ic_launcher.webp" "$d/ic_launcher_round.webp"
  render "$source_svg" "$n" > "$d/ic_launcher.png"
  render "$tmp/round.svg" "$n" > "$d/ic_launcher_round.png"
  a="${adaptive_px[$i]}"
  render "$tmp/foreground.svg" "$a" > "$d/ic_launcher_foreground.png"
  render "$tmp/monochrome.svg" "$a" > "$d/ic_launcher_monochrome.png"
done
for i in "${!legacy_dirs[@]}"; do
  d="$res/drawable-${legacy_dirs[$i]}"
  n="${splash_px[$i]}"
  mkdir -p "$d"
  render "$tmp/mark.svg" "$n" > "$d/splashscreen_logo.png"
done

echo "icons: rendered from design/kitbag-mark.svg into"
echo "  $assets{,/adaptive-icon} and $res/{mipmap,drawable}-*"
