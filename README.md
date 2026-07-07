# Kitbag 🎒

**The open-source everything-app for musicians.** Metronome, tuner, song
library, stem player, play-along sync — one app, plugin-shaped, GPLv3,
no caps, no paywalls, ever.

> Status: **M0 (foundation)**. Native audio core plays a test tone over
> Flutter FFI. See [PLAN.md](PLAN.md) for the full roadmap and
> [design/kitbag-ui.html](design/kitbag-ui.html) for the interface spec.

## Architecture

- **Flutter** UI (Android first, Linux desktop as dev vehicle, web/iOS later)
- **C++ realtime audio core** (`native/audio_core`) on miniaudio, accessed via
  `dart:ffi` — sample-accurate scheduling, lock-free realtime thread
- **Internal plugin system**: every tool is a package implementing
  `ToolPlugin` (`packages/core_plugin_api`), registered in the app shell

```
packages/
  core_plugin_api   # ToolPlugin interface
  core_audio_ffi    # Dart bindings + AudioEngine facade
  core_design       # themes, tokens (see design spec)
  app_shell         # entrypoint, router, plugin registry, home hub
native/
  audio_core        # C++ engine (miniaudio), CMake
```

## Building

Requirements: Flutter (stable), CMake ≥ 3.22, Ninja, clang.

```sh
# Native core + tone smoke test
cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
cmake --build native/audio_core/build
./native/audio_core/build/tone_test   # should beep for 2 s

# Dart workspace
dart pub get                          # resolves the whole workspace
dart run melos analyze
```

Platform runners (`packages/app_shell/{linux,android}`) are generated with
`scripts/bootstrap.sh` after installing Flutter — see that script for the
native-library wiring steps.

## License

GPLv3 — see [LICENSE](LICENSE). Dependencies: miniaudio (public domain),
Space Grotesk & Inter (OFL).
