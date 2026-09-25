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
Requires rsvg-convert and ffmpeg on PATH (pacman -S librsvg ffmpeg).
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
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "error: ffmpeg not found (required to key the adaptive foreground)" >&2
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
source_asset="$repo_root/assets/kitbag_icon.png"
if [ ! -f "$source_asset" ]; then
  echo "error: $source_asset missing — icon source is required" >&2
  exit 4
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Derived SVG variants are rendered from a temporary copy so the supplied PNG
# reference remains valid after this script moves the SVG into $tmp.
render_source="$tmp/source.svg"
{
  while IFS= read -r line; do
    case "$line" in
      *'xlink:href="../assets/kitbag_icon.png"'*)
        printf '%s' "${line%%xlink:href=\"../assets/kitbag_icon.png\"*}"
        printf 'xlink:href="data:image/png;base64,'
        base64 < "$source_asset" | tr -d '\n'
        printf '"%s\n' "${line#*xlink:href=\"../assets/kitbag_icon.png\"}"
        ;;
      *) printf '%s\n' "$line" ;;
    esac
  done < "$source_svg"
} > "$render_source"

# --- Derived SVG variants ----------------------------------------------------
# Mark alone (transparent background): drop the background rect line.
grep -v 'id="background"' "$render_source" > "$tmp/mark.svg"
# Adaptive foreground uses the source art inside the adaptive safe zone. The
# source's near-black background is keyed out so the configured Android
# background fills the area outside the artwork.
# Monochrome keeps the same alpha mask and paints the artwork white.

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

render_transparent() {
  local size="$1"
  ffmpeg -v error -i "$source_asset" \
    -vf "format=rgba,colorkey=0x08070A:0.18:0.0,scale=${size}:${size}:flags=lanczos" \
    -frames:v 1 -f image2pipe -vcodec png -
}

render_round() {
  local size="$1"
  ffmpeg -v error -i "$source_asset" \
    -vf "scale=${size}:${size}:flags=lanczos,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),(W/2)*(W/2)),255,0)'" \
    -frames:v 1 -f image2pipe -vcodec png -
}

render_foreground() {
  local size="$1"
  local inner=$((size * 85 / 100))
  local offset=$(((size - inner) / 2))
  ffmpeg -v error -i "$source_asset" \
    -vf "format=rgba,colorkey=0x08070A:0.18:0.0,scale=${inner}:${inner}:flags=lanczos,pad=${size}:${size}:${offset}:${offset}:color=0x00000000" \
    -frames:v 1 -f image2pipe -vcodec png -
}

render_monochrome() {
  local size="$1"
  local inner=$((size * 85 / 100))
  local offset=$(((size - inner) / 2))
  ffmpeg -v error -i "$source_asset" \
    -vf "format=rgba,colorkey=0x08070A:0.18:0.0,scale=${inner}:${inner}:flags=lanczos,pad=${size}:${size}:${offset}:${offset}:color=0x00000000,lutrgb=r=255:g=255:b=255" \
    -frames:v 1 -f image2pipe -vcodec png -
}

# --- app assets (app.json points here) ---------------------------------------
render "$render_source" 1024 > "$assets/icon.png"
render_transparent 512 > "$assets/splash-icon.png"
render_foreground 1024 > "$assets/adaptive-icon/foreground.png"
printf '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#0E0D10"/></svg>' \
  > "$tmp/bg.svg"
render "$tmp/bg.svg" 1024 > "$assets/adaptive-icon/background.png"
render_monochrome 1024 > "$assets/adaptive-icon/monochrome.png"

# --- Committed android res tree ----------------------------------------------
for i in "${!legacy_dirs[@]}"; do
  d="$res/mipmap-${legacy_dirs[$i]}"
  n="${legacy_px[$i]}"
  mkdir -p "$d"
  # Same resource name in two formats duplicates the resource — remove the
  # template's .webp placeholders before writing ours.
  rm -f "$d/ic_launcher.webp" "$d/ic_launcher_round.webp"
  render "$render_source" "$n" > "$d/ic_launcher.png"
  render_round "$n" > "$d/ic_launcher_round.png"
  a="${adaptive_px[$i]}"
  render_foreground "$a" > "$d/ic_launcher_foreground.png"
  render_monochrome "$a" > "$d/ic_launcher_monochrome.png"
done
for i in "${!legacy_dirs[@]}"; do
  d="$res/drawable-${legacy_dirs[$i]}"
  n="${splash_px[$i]}"
  mkdir -p "$d"
  render_transparent "$n" > "$d/splashscreen_logo.png"
done

echo "icons: rendered from design/kitbag-mark.svg into"
echo "  $assets{,/adaptive-icon} and $res/{mipmap,drawable}-*"
