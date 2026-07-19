# Changelog

All notable changes to Kitbag are documented here.

The format is based on [Keep a Changelog][keepachangelog],
and this project adheres to [Semantic Versioning][semver].

[keepachangelog]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/spec/v2.0.0.html

---

## Unreleased

**Nothing has been released.**

This file previously recorded 0.1.0 through 0.5.0 as all shipped on 2026-07-14.
An audit on 2026-07-17 found that claim substantially false, and those entries
have been deleted rather than amended — they described work that does not exist.
A representative sample of what they asserted:

- *"Phase lock — lock metronome to detected BPM with one tap"* (0.5.0). There is
  no phase lock. The code is `setTempo(); start();` — correct tempo, arbitrary
  phase.
- *"Stems UI — play/stop transport using native mixer"* (0.4.0). The mixer never
  receives audio; `_decodeFile` returns `null`, so playback auto-stops instantly.
- *"BeatSyncService — sample-accurate phase lock"* (0.3.0). It was a Dart `Timer`,
  ±16ms and GC-jittered, restarting the native sequencer every beat.
- *"Click sounds — 6 samples: default, wood block, rim shot…"* (0.1.0). Those are
  not the engine's sound names. The real list is `Beep, Woodblock, Click, Tom,
  Hi-hat, Cowbell`. This invented list is the same one that mislabels every sound
  from index 2 up at `sync_screen.dart:14`, and it had already propagated into a
  design file.

`SPEC.md` §2 is the audited inventory of what the codebase actually did, and it
supersedes anything this file said. Version numbers restart when something
genuinely ships.

### Added — 2026-07-19

- **`kb_metronome_start_at(engine, start_frame)`** (`SPEC.md` §4.2) — sample-accurate
  metronome start on a given engine-clock frame, rather than whenever the call
  lands. Deferred inside the render loop, so an anchor mid-block starts on that
  exact sample; ignored while already running. This is the first piece of §4.2's
  phase anchor; `set_grid` and `anchor_external` are not built yet.
- **A transport-clock seam** — `Engine::Render` now reads `frames_rendered_` before
  the block and passes that absolute frame into `Metronome::Render`. Nothing
  previously handed subsystems the engine frame of the block being rendered, which
  is what any frame-anchored scheduling needs.
- **Six `metronome_verify` regressions** covering the above: frame-exactness at a
  non-block-aligned anchor, anchor at frame 0, beat 0 surviving a latency offset on
  the deferred path, an armed ramp forcing the per-block tempo/latency locals to be
  recomputed, `StartAt` ignored while running, and `Start`/`Stop` cancelling a
  pending `StartAt`.

### Fixed — 2026-07-19

- **A deferred start with an armed ramp and a latency offset swallowed beat 0.**
  `BeginRun` re-anchors `beat_position_` from the reset BPM while the render loop's
  `latency_beats` still reflected the pre-reset BPM, so `position` no longer
  cancelled to zero on the first sample: the downbeat never fired and the block ran
  at the stale tempo. Both locals are now recomputed after the in-loop `BeginRun`.
  Pinned by `TestStartAtWithArmedRampRecomputesLocals`, which fails without the fix.
- **`kb_metronome_is_running` lagged one block after a deferred start** — `BeginRun`
  now publishes `running_flag_` itself rather than relying on the command drain.

### Changed — 2026-07-19

- **The C++ lint gate passes on its own tree.** `scripts/lint.sh` was failing with
  ~100 errors on committed code. Formatting applied tree-wide; eight magic numbers
  named in `beat_tracker.cpp`, `engine.h` and `api.cpp`; `PitchAnalyzer::LockState`
  enumerators given the house `k` prefix. No behaviour change — `tuner_verify`
  output is byte-identical to before.
- **The C ABI header is exempt from C++ naming rules** (`include/.clang-tidy`). The
  root config's prose already declared `kb_snake_case`/`KB_UPPER` out of scope; its
  `HeaderFilterRegex` contradicted that and flagged the published enums. Renaming
  them was never an option — they are the ABI.
- **`ReflowComments: false`** — the tree-wide format run had reflowed
  `kb_analyze_song`'s parameter documentation into unreadable prose. The C ABI's
  doc comments are what binding authors read.

### Changed — 2026-07-17

- **Stack decided: React Native + TypeScript** (`SPEC.md` §13). The previous spec
  revision was deliberately stack-neutral and deferred this to a Phase 2 decision
  to be made on evidence once the native core was correct. It is now fixed.
- **`SPEC.md` rewritten** against that decision. The native audio core contract
  (§4) is unchanged in substance — it is a flat C ABI written to outlive the
  choice of UI framework, and it did.
- **14 open questions resolved** as §17 D1–D13. Notably: the time-signature
  denominator is real and gets built (D1); volume and latency are global and
  their per-song columns are dropped (D3); beat LEDs become a row with grouping,
  minimum four per row (D9); the base directory is wired and authoritative rather
  than cut (D11).

### Removed — 2026-07-17

- **The Flutter app.** All Dart packages (`app_shell`, `core_*`, `tool_*`,
  `custom_lint_kitbag`), the Melos workspace, `pubspec.*`, `analysis_options.yaml`
  and the Dart tooling scripts. Recoverable from git history.
  - `legacy/` preserves the four things `SPEC.md` cannot reconstruct on its own:
    `MediaSessionPlugin.kt` and `AndroidManifest.xml` (ported near line-for-line
    per §13.9), and `database.dart` + `converters.dart` (the v6 schema and the
    beat-grid / `.kwav` binary formats, per §11).
- **The CI jobs that built the Flutter app.** The native job remains and now also
  *runs* the headless verification tools, which CI previously built and never
  executed.

### Fixed — 2026-07-17

Nothing. This section exists to be honest about that.

### Known broken

- **`tuner_verify` fails 37 of 37 checks.** `PitchAnalyzer` reports `0.000 Hz` at
  `confidence 0.00` for clean synthetic tones from 82 Hz to 1 kHz — silence and a
  pure 440 Hz sine are indistinguishable to it, with no microphone anywhere in the
  path. Found on 2026-07-17 by running a harness CI had been building and never
  executing. See `SPEC.md` §10.1: this **demotes the capture-path hypothesis** and
  makes the DSP the prime suspect. Informational in CI until the tuner research
  (§10) lands, then it becomes a gate.
- Everything `SPEC.md` §2.2 and §2.3 name — including a mixer data race, silently
  dropped non-48kHz stems, a pause button that rewinds, and a permission flow that
  reports a grant that never happened.
