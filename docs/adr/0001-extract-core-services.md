# Extract concrete service providers into `core_services`

Moved 4 Riverpod provider definitions (`audioEngineProvider`, `metronomeControllerProvider`, `tunerControllerProvider`, `kitbagDatabaseProvider`) from `core_plugin_api` into a new `core_services` package so `core_plugin_api` is a purely abstract plugin contract with no transitive infra dependencies on `core_audio_ffi` or `core_db`.

## - Status

Accepted.

## - Considered Options

- **New `core_services` package** (chosen). Both tools and `app_shell` can depend on it. No circular deps. Clean seam.
- **Split into tool packages**. Each tool owns its controller provider. Creates a reverse dependency (tests must dev-depend on `app_shell` for `audioEngineProvider` and `kitbagDatabaseProvider`).
- **Keep in `core_plugin_api`** (rejected). Future tools pay an audio+SQLite transitive tax for no benefit. Violates the abstract-contract seam.

## - Consequences

- `core_plugin_api` pubspec drops `core_audio_ffi` and `core_db` deps — it now depends only on `flutter/widgets.dart` and `go_router`
- `tool_metronome`, `tool_tuner`, and `app_shell` add `core_services` as a dep (for provider references in test overrides)
- `core_services` depends on `core_audio_ffi`, `core_db`, and `flutter_riverpod`
- ~12 files across 3 packages need import path updates
- `BeatAccent` stays in `core_audio_ffi` — not moved, despite being cross-package, because it's metronome-specific per design review
