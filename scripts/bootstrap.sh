#!/usr/bin/env bash
# Generates Flutter platform runners for app_shell and wires the native core.
# Run once after installing Flutter; safe to re-run.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
shell_dir="$repo_root/packages/app_shell"

command -v flutter >/dev/null || { echo "flutter not on PATH" >&2; exit 1; }

cd "$shell_dir"
flutter create --project-name app_shell --org org.kitbag \
  --platforms=linux,android .

cd "$repo_root"
dart pub get

cat <<'EOF'

Runners generated. Remaining manual wiring (M0):
 1. Linux: in packages/app_shell/linux/CMakeLists.txt add
      add_subdirectory(${CMAKE_SOURCE_DIR}/../../../native/audio_core kitbag_core)
    and add $<TARGET_FILE:kitbag_core> to PLUGIN_BUNDLED_LIBRARIES so the .so
    ships in the bundle's lib/ directory.
 2. Android: in packages/app_shell/android/app/build.gradle add
      externalNativeBuild { cmake { path "../../../../native/audio_core/CMakeLists.txt" } }
    inside the android block.
Then: flutter run -d linux  (from packages/app_shell)
EOF
