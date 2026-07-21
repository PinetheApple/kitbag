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

### Added — 2026-07-21

- **`analyze_verify` (25 checks)** — `kb_analyze_song`'s pipeline
  (`Decoder → downmix → BeatTracker → sidecar`) had no test of any kind, which is
  how #18's decoder bug reached a shipped path nothing traversed. The tool asserts
  finite BPM and in-range beat times for a real click track, the three rejection
  paths below, and a sidecar write/read round-trip (magic, version, channels,
  frame count, `chunk_count`). Gated in CI.
- **`song_analysis` module** (`src/analysis/song_analysis.h`) — the pipeline lifted
  out of `api_analysis.cpp`'s anonymous namespace, where its guards were
  unreachable by any test, into a named module the tool drives directly.
  `api_analysis.cpp` is now a thin ABI shim over it; the downmix and beat output
  are unchanged for valid input.

### Fixed — 2026-07-21

- **`ComputeWaveformPeaks` cast a non-finite sample straight to `int16_t`** —
  undefined behaviour reachable from a malformed input file, not merely a wrong
  value. After #18, a 16-bit file could decode to `NaN`/`3e38`; `min_val * 32767`
  then overflowed the `int16_t` range or was `NaN`, and the C++ float→int
  conversion of that is UB. A `Quantize` helper now maps non-finite to 0 and
  clamps to `[-1, 1]` before the cast, and is a byte-exact no-op for in-range audio.
- **`kb_analyze_song` returned `KB_OK` with a `NaN` BPM for non-finite PCM, and
  divided by zero for a zero-channel decode.** The downmix summed samples with no
  finiteness check, and `sum / channels` was unguarded on the beat-track consumer
  though the sidecar writer already guarded it. Both now reject with
  `KB_ERROR_INVALID_ARGUMENT`; the ABI doc records the contract.
- **A frame count above `INT_MAX` silently skipped the sidecar write.** Three
  `uint64_t → int` narrowings wrapped to a negative that then tripped
  `ComputeWaveformPeaks`' `num_frames <= 0` guard, so the sidecar was never
  written and no error was returned. A single `NarrowFrames` rejects above
  `INT_MAX` at the boundary instead of wrapping.

### Added — 2026-07-20

- **`AudioSource`** (`src/media/audio_source.h`; `SPEC.md` §4.1, design-audit F2)
  — the streaming seam A1 (mixer tracks) and A5 (player) both need, written once
  so neither re-implements it. `Read(float* dst, uint32_t frames)` is the only
  callback-facing method: a masked memcpy out of a ring, a `std::fill` and one
  relaxed `fetch_add`, hiding a non-RT read-ahead thread. Lifecycle is
  `Open`/`Start`/`Stop`/`Seek`/`Close` — `Open` allocates, `Start`/`Stop` only
  spawn and join the producer, so the ring and position survive a pause and
  resume is lossless. Short read plus zero-fill while a stream is open, so a
  caller that ignores the return value mixes silence rather than stale audio.
- **`SpscBulkRing<T>`** (`src/rt/spsc_bulk_ring.h`) — the bulk half of
  `spsc_ring.h`'s discipline, not a second one: the same single-producer,
  single-consumer acquire/release pair on two monotonic indices, for spans whose
  capacity depends on a stream's channel count. Only `Init` allocates.
- **`audio_source_verify` (104 checks) and `file_audio_reader_verify` (14)** —
  the first drives an in-memory fake and links no miniaudio at all, which is what
  proves the adapter seam is real; the second drives the miniaudio adapter over a
  16-bit WAV fixture generated at runtime. Both guard their own check count, so a
  silently dropped test fails the tool.
- **`kb_mixer_pause(engine)`** (`SPEC.md` §4.4) — ends playback holding the read
  head, beside the existing `kb_mixer_stop` which rewinds it to frame 0. Scalar
  only, so the ABI stays free of buffers.
- **`kb_metronome_set_grid(beat_times_sec[], count, anchor_frame)` and
  `kb_metronome_clear_grid`** (`SPEC.md` §4.2; commits `a633536`, `5a6d018`) — the
  metronome can follow a measured per-beat grid rather than one global BPM. The
  array is copied, not retained. It reaches the audio thread through a new
  `RtPublisher<T>` (`src/rt/rt_publisher.h`), the app→RT bulk-payload seam: an
  atomic pointer swap with deferred retire. Ten grid regressions in
  `metronome_verify` and five grid groups in `abi_verify` cover it — four of them
  validation, the fifth exercising `clear_grid`; the
  latter guard `std::lower_bound`'s ordering precondition at the boundary, so a
  descending, repeated, NaN, infinite or oversize grid is rejected with
  `KB_ERROR_INVALID_ARGUMENT` instead of reaching the callback.
- **`KB_MAX_GRID_BEATS`** — defined once, in `kitbag_api.h`. `beat_tracker.cpp`
  derives its own cap from it rather than retyping the number (`SPEC.md` §13.7).
- **`mixer_verify` (61 checks) and `abi_verify` (15)** — both are new on this
  branch; neither tool exists on `main`, so this is 61 and 15 from zero.
  They cover the Stop/Pause split, the zero-padding of stems shorter than the
  longest, and the right channel of a stereo stem — which nothing in the suite
  previously read, so a right-channel-only fault passed the whole file.

### Fixed — 2026-07-20

- **`Decoder` and `FileAudioReader` decoded every non-float file to garbage** —
  both left miniaudio's output format at `ma_format_unknown`, so a 16-bit file
  wrote `s16` into the `float*` buffer the caller supplied, under-filling it by
  half. `Decoder`'s instance was live on the shipped `kb_analyze_song` path via
  `api_analysis.cpp`, so beat tracking and waveform peaks read garbage for every
  16-bit input; `FileAudioReader`'s was found in review before it had a consumer.

  The config now lives once, in `OpenDecoderF32` (`src/media/miniaudio_decoder.h`),
  which both call sites go through — a third `ma_decoder_init_file` cannot
  reintroduce it, and reverting the fix now fails two suites rather than one.

  *Correction:* an earlier entry described this corruption as "denormal noise".
  That was wrong and unmeasured. Instrumented over a 997-frame fixture it is
  **zero subnormals** — 5 NaN, 627 values above 1e38, and the back half of the
  buffer never written. The distinction matters: NaN propagates through
  `DownmixToMono`'s sum and poisons every downstream aggregate, and reaches an
  undefined float→`int16_t` conversion in `waveform_peaks.cpp`. Tracked as #19.
- **`decoder_verify` (13 checks)** — `Decoder` had no verify tool at all, which is
  why the above shipped. The tool that would have caught it must assert *values*:
  miniaudio reports `total_frames` from the container header regardless of output
  format, so frame count and buffer size are **identical** between a correct and a
  corrupt decode. A test asserting only "the frame count is right" passes on a
  decoder emitting NaN.
- **CI now gates eight verify tools instead of one.** `ci.yml` ran only
  `metronome_verify`; `abi_verify`, `beat_tracker_verify`, `mixer_verify`,
  `note_lock_verify`, `audio_source_verify`, `file_audio_reader_verify` and
  `decoder_verify` all passed and none of them gated anything. Added with a
  job-level `timeout-minutes: 15`, since `TestDestroyWhileRunning` hangs rather
  than fails on a join deadlock. `tuner_verify` stays informational (SPEC.md §10.1).
- **Muting every track ended playback** (`SPEC.md` §4.4; commit `2f82d85`) —
  `Process()` auto-stopped whenever nothing was audible this block, and
  `MixTrack` contributes nothing for a track that is muted, at zero gain,
  un-soloed while another track is soloed, or at a mismatched sample rate. So
  "every track ran out of data" and "nothing sounded" were one condition, and
  muting everything stopped playback outright. The transport now follows the
  longest *loaded* track, independent of that gating.
- **Two beat-analysis bugs** (commit `a633536`) — `BeatTracker` applied its beat
  cap while backtracking from the *last* beat, so a track over roughly 17 minutes
  returned a grid starting partway into the song; and the `.kwav` sidecar path
  used `-4` arithmetic that stripped *nothing* from a three-letter extension and
  one character from a four-letter one — `song.wav` became `song.wav.kwav` and
  `song.flac` became `song.fla.kwav`. The common cases were the unstripped ones.
  Now `src/analysis/sidecar_path.h`.
- **Pause rewound the transport** (`SPEC.md` §2.2, §7.3) — the mixer exposed only
  `Stop()`, which zeroes `read_frame_`, so pausing meant rewinding. `Pause()` now
  holds the position and a following `Play()` resumes from it. This is the native
  cause only; there is no UI to have a pause button.

### Changed — 2026-07-20

- **Zero-padding of short stems was already correct** and is now pinned rather
  than assumed. `MixTrack` clamps to each stem's end and `Process` clears the
  block first, so a short stem has always contributed silence past its end.
  Nothing changed in the mixer; the measurement is the deliverable. `MixTrack`'s
  clamp is in fact the *only* padding mechanism — the bounds checks inside
  `MixMono`/`MixStereo` are unreachable, and deleting both leaves the suite green.

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

- **`kb_engine_set_test_tone` renders silence.** The exported function sets its
  flag and `RenderTestTone` writes a correct sine, but `Engine::Render` calls it
  *before* `Mixer::Process`, whose `std::memset` (`mixer/mixer.cpp:165`) runs
  unconditionally — ahead of its own `if (!playing_) return`. So the tone is
  erased in every transport state. Measured: a buffer pre-filled to 0.2 comes
  back peak 0.000 with the mixer stopped, and peak 0.500 (the stem alone, not
  0.700) with it playing. `tools/tone_test.c` exists only to exercise this and
  produces silence. **Not fixed here, deliberately:** a bare reorder is wrong
  because `RenderTestTone` *assigns* rather than accumulates and writes 0.0f when
  disabled, so running it after the mixer would zero the mix on every normal
  block. A correct fix needs accumulate semantics plus a policy decision `SPEC.md`
  does not make — it never mentions the test tone at all, so whether the tone
  should sum with live playback or suppress it is unspecified. `Engine::Render` is
  also private and only reachable through a live miniaudio callback, so there is
  no deterministic headless test to pin a fix with today. Recorded rather than
  guessed at.
- **`tuner_verify` fails 37 of 37 checks.** `PitchAnalyzer` reports `0.000 Hz` at
  `confidence 0.00` for clean synthetic tones from 82 Hz to 1 kHz — silence and a
  pure 440 Hz sine are indistinguishable to it, with no microphone anywhere in the
  path. Found on 2026-07-17 by running a harness CI had been building and never
  executing. See `SPEC.md` §10.1: this **demotes the capture-path hypothesis** and
  makes the DSP the prime suspect. Informational in CI until the tuner research
  (§10) lands, then it becomes a gate.
- Everything `SPEC.md` §2.2 and §2.3 name **except the pause rewind**, fixed above
  — including silently dropped non-48kHz stems and a permission flow that reports
  a grant that never happened. **Two distinct mixer races are live**, and §4.4's
  pause split addressed neither:
  - **`SetTrackData` vs `Process`** (`mixer/mixer.cpp:19`, `SPEC.md` §2.2) —
    `t.pcm.assign()` reallocates on the app thread while the callback may be
    reading `tr.pcm`. Use-after-realloc on the audio thread; the more dangerous
    of the two. The RT-safe pointer-swap load in §4.1 (A3) is what fixes it.
  - **`Stop()` vs `Seek()` vs the callback** — each is a raw unsynchronised store
    from the app thread, so the callback can overwrite a rewind with the block's
    advance. The scalar command ring in §4.1 is what fixes it.
