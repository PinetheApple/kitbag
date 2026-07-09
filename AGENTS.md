# Kitbag — Agent Workflow Guide

## Monorepo layout

Pub workspace at root. Key packages:

| Package | Role |
|---------|------|
| `app_shell` | Flutter entrypoint, router, registry |
| `core_plugin_api` | Abstract plugin contract — no infra deps |
| `core_services` | Concrete Riverpod providers |
| `core_audio_ffi` | FFI bindings to C++ audio core |
| `core_design` | Theme, tokens, shared widgets |
| `tool_*` | Plugin tools (metronome, tuner, etc.) |
| `custom_lint_kitbag` | Architecture-enforcing custom lint rules |

## Architecture rules (custom_lint enforces these)

- `dart:ffi` only in `core_audio_ffi`
- Riverpod providers only in `core_services`
- `core_plugin_api` must not import `app_shell` or `tool_*`
- PascalCase for both filenames and class names

## PostToolUse: auto-verify after edits

After every `Write` or `Edit` tool call, run lint checks to catch regressions:

```bash
bash scripts/lint_check.sh
```

This runs `dart analyze` on `custom_lint_kitbag` and `dart run custom_lint` on `app_shell`.
If either fails, fix the specific violations before the next tool call.

Note: `dart run custom_lint` has `--fatal-infos` on by default — exit code 1 even for INFO-level violations.

## Ralph loop: feedback→refine

After implementing or changing anything non-trivial, run the Ralph loop before
presenting to the human:

1. Self-review your work first (run lint checks, verify correctness)
2. Invoke `@ralph` to review — describe what you built and why
3. Read Ralph's feedback, fix the issues
4. Iterate until Ralph passes you

Ralph is a peer reviewer with `edit: deny` permission — can inspect and critique
but cannot change files.

## Eval harness: scoring agent changes

Before/after any change to lint rules or agent configuration, run the eval to
check for regressions:

```bash
bash packages/app_shell/eval/run.sh
```

The harness runs `dart run custom_lint` against `eval/*.dart` scenario files
and scores each:
- `*_pass.dart` — must produce zero diagnostics
- `*_fail.dart` — must produce at least one diagnostic
- `PascalCaseFileFail.dart` — special case (filename-based diagnostic at offset 0)

All 7 scenarios must pass before submitting work.

## Git worktrees

Each agent session gets an isolated git worktree to avoid conflicts:

```bash
bash scripts/worktree.sh create <session-id> main
cd ../kitbag-agent-<session-id>
# git checkout -b my-feature
# ... make changes, commit, push ...
bash scripts/worktree.sh remove <session-id>
```

## Running checks

```bash
# Specific package:
cd packages/<pkg> && dart analyze lib/

# Custom lint rules:
cd packages/app_shell && dart run custom_lint

# Combined:
bash scripts/lint_check.sh

# Eval:
bash packages/app_shell/eval/run.sh
```

---

## Autonomous Completion Plan

**37 tasks across 6 phases.** Each task follows the Ralph loop:
1. Implement the change
2. Self-verify: `bash scripts/lint_check.sh` + run relevant tests
3. Invoke `@ralph` for review — describe what you built and why
4. Fix Ralph's findings
5. Iterate until Ralph passes
6. Commit, then proceed to the next task

Before starting a new task, read `todowrite` to find the next `pending` task whose
dependencies are all `completed`. Mark it `in_progress` before work begins.

### Phase 0: Infrastructure & Bug Fixes

| # | Task | Dependencies | Test hint |
|---|------|-------------|-----------|
| 0.1 | **CI verification** — ensure CI pipeline actually passes (melos analyze/test, Android NDK build, drift codegen) | — | `melos run analyze && melos run test` |
| 0.2 | **Android/Linux runner CMake wiring** — complete `bootstrap.sh` manual steps: wire `native/audio_core` into `app_shell`'s Linux and Android build files | — | `flutter build linux --debug` |
| 0.3 | **Add `custom_lint_kitbag` to workspace** — ✅ done (already in workspace pubspec.yaml) | — | — |
| 0.4 | **Fix metronome notification buttons** — `onDidReceiveNotificationResponse` doesn't reliably fire for background transport actions | — | Test play/pause/stop from notification |
| 0.5 | **Setlist/song list gapping** — add consistent spacing between list items | — | Visual check |

### Phase 1: M2 — Tuner (complete) + Settings polish

| # | Task | Dependencies | Test hint |
|---|------|-------------|-----------|
| 1.1 | **Research open-source tuners** — study gStrings, DaTuner, Soundcorset, GuitarTuna approaches for precision and UX; document findings | — | Document in `docs/` |
| 1.2 | **Tuner: fix mobile mic capture** — verify `VOICE_RECOGNITION` source, no AGC/NS/AEC, gain staging, permission flow on Android | 1.1 | Test on device |
| 1.3 | **Tuner: fine-tune MPM pitch** — improve settle time, octave-error kill, median filter tuning, test with guitar 82Hz–1kHz | 1.2 | `flutter test` on tuner tests |
| 1.4 | **Tuning editor: add/remove strings** — support variable-length string lists in custom profiles | — | `flutter test` on instruments/tuning tests |
| 1.5 | **Settings: volume boost** — implement metronome click amplification slider | — | Visual + audio check |
| 1.6 | **Settings: latency correction** — implement audio output offset slider | 1.5 | Visual check |
| 1.7 | **Settings: tool toggle** — per-tool enable/disable toggle; filtered tile display on home screen | — | Visual check |

### Phase 2: M1.5 — Metronome completion + Practice

| # | Task | Dependencies | Test hint |
|---|------|-------------|-----------|
| 2.1 | **Per-song preset persistence** — save full metronome state (BPM, click sound, poly, subdivision, accents) per song in setlists | — | `flutter test` on setlist tests |
| 2.2 | **Ramp in seconds/minutes** — extend `TempoRamp` to accept time-based duration, not just bars | 2.1 | `flutter test` on trainer tests |
| 2.3 | **Custom subdivisions** — free-form subdivision input (not limited to presets 1/2/3/4) | — | `flutter test` |
| 2.4 | **More click sounds** — add 3+ additional sample options beyond current 3 | — | Audio check |
| 2.5 | **Circle layout optimization** — space-efficient LED placement algorithm for beat indicator | — | Visual check |
| 2.6 | **Timer: auto with play/pause** — practice timer auto-starts on play, pauses on pause, resettable; shown at top of metronome screen | — | `flutter test` |
| 2.7 | **Practice logs with stats** — per-session records (duration, avg BPM, setlist used, songs played); stored in drift; import/export with other data | 2.6 | `flutter test` |

### Phase 3: M3 — Library & Play-along (v0.3)

| # | Task | Dependencies | Test hint |
|---|------|-------------|-----------|
| 3.1 | **Scaffold `tool_library`** — create package skeleton, implement `ToolPlugin`, register routes, add to workspace | — | `dart analyze` |
| 3.2 | **Song import** — file picker → copy to base directory, index in drift (title, artist, duration, format) | 3.1 | `flutter test` |
| 3.3 | **Audio decode pipeline** — decode via dr_libs/AMediaCodec in background isolate; support wav/mp3/flac/ogg/aac | 3.2 | Integration test |
| 3.4 | **Beat analysis** — QM-DSP beat grid, store as Float32 BLOB in drift, waveform peaks sidecar file | 3.3 | Integration test |
| 3.5 | **Player** — play/pause/seek with waveform display, position tracking | 3.1 | `flutter test` |
| 3.6 | **Metronome phase-lock** — sample-accurate sync to beat grid, latency-compensated | 3.4, 3.5 | `flutter test` |
| 3.7 | **Play-along mode** — unified UI: library player + synced metronome display with transport coordination | 3.6 | Integration test |

### Phase 4: M4 — Stem player (v0.4)

| # | Task | Dependencies | Test hint |
|---|------|-------------|-----------|
| 4.1 | **Scaffold `tool_stems`** — create package skeleton, implement `ToolPlugin`, register routes, add to workspace | — | `dart analyze` |
| 4.2 | **Folder import → stem set** — name-based matcher (vocals/drums/bass/guitar/piano/keys/other/other2/...); support wav/mp3/flac/ogg | 4.1 | `flutter test` |
| 4.3 | **Resample + length-pad** — resample all stems to canonical sample rate, zero-pad to longest stem | 4.2 | Integration test |
| 4.4 | **N-track lock-free mixer** — per-track gain/mute/solo in C++ core | 4.3 | `cmake --build` + integration test |
| 4.5 | **Per-stem waveforms + A-B loop** — UI with equal-power crossfade (5-20ms) | 4.4 | Visual+audio check |

### Phase 5: M5 — Media sync (v0.5)

| # | Task | Dependencies | Test hint |
|---|------|-------------|-----------|
| 5.1 | **Scaffold `tool_sync`** — create package skeleton, implement `ToolPlugin`, register routes, add to workspace | — | `dart analyze` |
| 5.2 | **Kotlin MediaSession channel** — platform channel for active media detection (~200 lines) | 5.1 | Integration test |
| 5.3 | **Now-playing UI** — transport controls, permission explainer flow for notification listener | 5.2 | Visual check |
| 5.4 | **BPM lookup chain** — Deezer → GetSongBPM → AcousticBrainz → tap-tempo fallback; cache results | 5.3 | `flutter test` |
| 5.5 | **Tap-to-align + nudge** — manual phase alignment (±ms) with visual feedback | 5.4 | `flutter test` |
| 5.6 | **Auto phase-lock** — library match (title/artist fuzzy) → stored beat grid → auto sync | 5.5, 3.4 | Integration test |

### Phase 6: Data portability

| # | Task | Dependencies | Test hint |
|---|------|-------------|-----------|
| 6.1 | **Unified import/export** — export all user data (setlists, songs, practice logs, settings, tool preferences) as a single archive; user picks location; defaults to base directory | 0.1–2.7 | `flutter test` |
| 6.2 | **CHANGELOG entries per milestone** — document all completed work per the PLAN.md convention | all | — |
