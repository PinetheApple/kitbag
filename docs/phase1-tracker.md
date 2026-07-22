# Phase 1 — Core: Execution Tracker

> **Not a planning document, and not the ticket.** `SPEC.md` §15 is the sequencing
> authority and §4 is the contract. **GitHub issues in `PinetheApple/kitbag` are the
> tickets** — they carry per-task state, the `--blocked-by` dependency spine, and the
> review trail. This file is only the **index + sequencing map + graveyard**: the
> cross-issue structure (waves, conflict map, worktrees) that a flat issue list can't
> hold, and the record of disproved / deliberately-unfixed work that closed issues
> bury. When a task's status here disagrees with its issue, **believe the issue.**

Scope: **§4 in full** — native playback (4.1), phase anchor (4.2), downbeats (4.3),
mixer fixes (4.4). Framework-independent; every task headlessly testable via
`native/audio_core/tools/`. No UI.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done (verify green + both reviews pass) · `[!]` blocked

## Current state — 2026-07-22, `work/post-phase0`

**Done:** W0-1 · W0-2 · W0-3 (hygiene) · C1–C5 · B2 · B3 · B4 · B5 (`#16`) · A1 · A2 · A3 · **A4 (`#9`)** · **A5 (`#10`)** · **A6 (`#11`)** · **D1 (`#12`)** · **D2 (`#13`)** · `#17` · `#18` · `#19` · `#21` · `#23` · **`#24`** · **`#25`**. **Track A complete; both A/C follow-ups closed.**
B1 **withdrawn as wrong** (graveyard below).
**In progress:** none.
**Next:** **Track D complete** — D4 (`#15`) landed 2026-07-22 (`df42531`); D1/D2 done, D3 (`#14`) closed as phantom. Next unblocked item is loop-selected. **D3 (`#14`) closed** — the block was a phantom (§4.3 detection shipped in D2/#13; the BLOB column is §11/Phase-2 TS, not a native task). Ruling in `#14`; decisions log 2026-07-22.
**Blocked (user rulings):** none. (`#14` D3 scope ruled 2026-07-22 — native complete/#13, BLOB → §11/Phase-2; `#21` mute-cascade ruled + fixed; `#22` Speex-grade resample closed keep-linear.)
**Follow-ups:** none open. `#24` grid-mode mute-cascade test **closed** (`beddd43`; test-only, sabotage-gated; production byte-untouched, ralph's correct-by-construction judgment held). `#25` live-seek reposition **closed** (`d75b3b5` + fix-round `e5add32`; rebuild+republish, in-place ring-Clear now only when device stopped AND source idle; threaded `seek_race_verify`, ASan/UBSan clean). `#17` test-tone resolved with A5 — symbol deleted.

**Latent, not fixed:** `beat_tracker.cpp:243` (`sum_onset / onset.size()`) is an
unguarded divide, unreachable today (only called after `onset.size() >= 10`); becomes
a live divide-by-zero if a future caller drops that precondition.

### Issue index

| Task | Issue | Task | Issue |
|---|---|---|---|
| W0-2 AudioSource | [#2](https://github.com/PinetheApple/kitbag/issues/2) | A4 mixer ABI | [#9](https://github.com/PinetheApple/kitbag/issues/9) |
| C3 anchor_external | [#3](https://github.com/PinetheApple/kitbag/issues/3) | A5 player ABI | [#10](https://github.com/PinetheApple/kitbag/issues/10) |
| C4 invariants | [#4](https://github.com/PinetheApple/kitbag/issues/4) | A6 verify tool | [#11](https://github.com/PinetheApple/kitbag/issues/11) |
| C5 regressions | [#5](https://github.com/PinetheApple/kitbag/issues/5) | D1 vendor decision | [#12](https://github.com/PinetheApple/kitbag/issues/12) |
| A1 track = AudioSource | [#6](https://github.com/PinetheApple/kitbag/issues/6) | D2 analyze outputs | [#13](https://github.com/PinetheApple/kitbag/issues/13) |
| A2 resample-on-load | [#7](https://github.com/PinetheApple/kitbag/issues/7) | D3 BLOB schema (→§11/P2) | [#14](https://github.com/PinetheApple/kitbag/issues/14) |
| A3 RT-safe load | [#8](https://github.com/PinetheApple/kitbag/issues/8) | D4 downbeat verify | [#15](https://github.com/PinetheApple/kitbag/issues/15) |
| B5 longest_frames_ | [#16](https://github.com/PinetheApple/kitbag/issues/16) | test tone (blocked) | [#17](https://github.com/PinetheApple/kitbag/issues/17) |

### Sequencing decision — 2026-07-20

**Tuner work comes last**, after all other Phase 1 functionality. User's call, and it
agrees with SPEC.md §15 (tuner last, Phase 3, behind §10.1 research). `tuner_verify`'s
37/37 failure stays red **on purpose**: not a regression, not a gate, not to be
"fixed" by loosening the test.

Work is driven by the **`phase1-loop`** skill: one issue at a time through implement →
gates → `ralph` + `code-reviewer` → fix → commit → close. It never merges, pushes, or
edits a SPEC decision, and stops rather than inferring approval.

Gates (every task): build 0 · `metronome_verify` `abi_verify` `beat_tracker_verify`
`note_lock_verify` `mixer_verify` all pass · `lint.sh` 0. `tuner_verify` fails 37/37
(pre-existing detector defect, SPEC.md §10.1) — informational in CI, not a regression.

> Keep the status lines current *as each item lands*, not in batches. This file went
> nine commits stale once, and B1 spent that window telling the next reader to
> implement a bug that had already been disproved.

---

## Overall structure (codebase-design framing)

**The native core is one deep module.** Its interface is the flat C ABI in
`native/audio_core/include/kitbag_api.h`: scalars + file paths, no structs, no buffers.
That small interface hides the sequencer, mixer, streaming decoder, player, tuner.
Depth is the point — the same seam is crossed by the JSI HostObject (§13.2, later) *and*
the verify tools now. **The interface is the test surface**: `tools/*_verify` cross the
exact seam the app will. If a test needs to reach past the C ABI, the module is the
wrong shape.

Phase 1 makes the module **deeper**, three ways:
- §4.1 **removes** `kb_mixer_set_track_data` and its `float*` buffer → after it, *every*
  boundary value is a scalar or a path. This is what lets §13.2 use a HostObject and
  skip an ArrayBuffer bridge — a direct payoff of the deletion.
- §4.2 collapses "start + separately fix up timing" into three anchor calls that own
  phase internally. Callers pass a frame or a grid; drift handling is hidden.
- §4.3 keeps the analyze interface the same shape (caller buffers out) while adding
  downbeats behind it; old grids stay valid (degraded, not broken).

**Internal seams** (private, for the core's own tests): the streaming reader behind the
mixer, the resampler behind load, the beat/downbeat tracker behind analyze. Two adapters
= a real seam — the reader has a real file adapter and an in-memory fake for `tools/`.
The resampler has one adapter → don't abstract it yet.

### Design audit (2026-07-17) — findings driving Wave 0

Auditing the core against the §4 work surfaced four structural issues. Wave 0 fixes
them so Phase 1 builds on the right seams, not around missing ones.

- **F1 — No transport-clock seam.** Three subsystems each carried their own position
  with no shared transport. §4.2 and §4.1 both need the absolute engine frame of the
  block. → thread `uint64_t block_start_frame` into every `Render`/`Process`. **W0-1**.
- **F2 — Streaming would be written twice.** A1 (mixer tracks) and A5 (player) both need
  ring-buffered read-ahead. → one deep `AudioSource` module, real-file adapter +
  in-memory fake. **W0-2**.
- **F3 — Two concurrency disciplines.** Metronome uses a clean SPSC command ring; Mixer
  used scattered `relaxed` atomics + a caller-thread `vector.assign` race. → scalar
  controls arrive through a command ring; bulk payload publishes by atomic pointer-swap.
  One concurrency contract per module. Shapes A3/A4/B.
- **F4 — Interface shrinks as depth grows.** `Mixer::Process(out, n, sr)` + the
  `sr != output_sr → skip` was the §4.1 resample bug. After A2 the `sr` param and
  skip-branch both vanish. Smaller interface, deeper module — the intended direction.

**RN package seams (§13.1) are Phase 2**, listed only so Phase 1 doesn't violate them:
`core-native` will be the *only* package touching JSI; the C ABI staying scalar-only is
what keeps that package thin. Nothing in Phase 1 should widen the ABI to force a buffer
across.

---

## Parallelization — wave + conflict map

Conflict map: **W0-1** (transport clock) touches `engine.*` + every `Render`/`Process`
signature → prerequisite, lands *first, alone*; everything rebases on it. **W0-2** is a
new file, no conflict. Track A rewrites `mixer.cpp` track loading; Track B does in-place
`mixer.cpp` fixes → **A and B share a file, sequence them** (B first). C is
`metronome.cpp` only; D is `beat_tracker.cpp`/analyze only.

| Wave | Runs in parallel | Worktree |
|---|---|---|
| **0a** | **W0-1** transport-clock seam (blocks C, A5) — first, alone | feature branch |
| **0b** | **W0-2** `AudioSource` (blocks A1, A5) · **D1** vendor decision | W0-2 on feature branch; D1 in `wt-downbeats` |
| **1** | **Track B** (mixer fixes) · **Track C** (phase anchor, needs W0-1) | B on feature branch; C in `wt-phase-anchor` |
| **2** | **Track A** (playback — needs W0-2 + B) · **D2–D4** (need D1) | A on feature branch; D continues `wt-downbeats` |
| **3** | **Integration verify** — all tracks merged, full suite green together | feature branch |

Spawn: `bash scripts/worktree.sh create phase-anchor main`, `... create downbeats main`.
Remove when merged.

Native work → **`audio-core-engineer`** agent (callback invariants, sanctioned
data-movement patterns, size limits, sabotage discipline). Reviews → `ralph`
(correctness/§4) + `code-reviewer` (CONTRIBUTING.md judgment layer); run both on
realtime C++. Mark `[x]` only when verify green + lint clean + both reviewers pass.

---

## Status by track

Terse. **The issue and `git log` carry the how** — measurements, sabotage runs, review
rounds. Anything below the task lines is graveyard: disproved or deliberately-unfixed
work that must not be re-attempted.

### W0 — structural prep (F1–F3)
- [x] **W0-1** Transport-clock seam. `block_start_frame` threaded into `Metronome::Render`; `frames_rendered_` is the one transport. Landed with first consumer C1.
- [x] **W0-2** `AudioSource` module — pull `Read(dst, frames)` over a non-RT read-ahead thread; `Open`/`Start`/`Stop`/`Seek`/`Close`. Real-file (miniaudio) + in-memory fake. `#2` · `603a2c2`. Review caught the `ma_format_f32` decode defect; its twin in `decoder.cpp` → `#18`. **Known gap:** EOF/underrun flag ordering is reasoned, not measured.

### W0-3 — codebase hygiene (unplanned, 2026-07-19/20)
Done and git-visible; kept here only as the "why". Comment audit deleted ~40 narrating
comments (four *false* — see honesty rules); size gates (fns ≤30, files ≤400, comments
≤2) now enforced; `lint.sh` no longer fails open; `src/` grouped by subsystem;
`audio-core-engineer` agent created; test-quality fixes (`NoteLock` extracted,
`-Wswitch` re-enabled). Commits `a0510a3` `4efa048` `dedf7f0` `620ad10` `4e80188`
`5a6d018` `a633536`.

### Track B — §4.4 mixer fixes
- [x] **B2** Split `Stop()` (position→0) from `Pause()` (holds). `kb_mixer_pause` added. `4d6c89a`.
- [x] **B3** Zero-pad short tracks instead of dropping. Already correct — no production change; pinned with 13 checks. `ab0e2a4`.
- [x] **B4** Auto-stop on end of longest *loaded* track, not "all tracks silent". `2f82d85`.
- [x] **B5** `longest_frames_` was monotonic (only ever `max`, never recomputed down). Now `RecomputeLongestFrames` rescans loaded tracks on every load/unload, so a reload-to-shorter or unload lowers it and the transport auto-stops at the new longest. `#16`. Folded into **A4**; `mixer_verify` reload-shrink + unload-shrink tests (sabotage-gated).

### Track C — §4.2 phase anchor
- [x] **C1** `kb_metronome_start_at(start_frame)` — sample-accurate deferred start.
- [x] **C2** `kb_metronome_set_grid(...)` + `clear_grid` — follow per-beat spacing. Introduced `RtPublisher<T>` (F3 bulk-payload seam; A3 reuses it). `a633536` `5a6d018`.
- [x] **C3** `kb_metronome_anchor_external(...)` — anchor to a transport we don't clock; glitch-free re-anchor. Fixed a pre-existing `accents_[-1]` OOB → `#21`, since **fixed** 2026-07-21 (`6a1038a`): per-beat mute now cascades to subdivisions on the speaker-time base. `#3`.
- [x] **C4** Invariants (anchoring touches future targets only; composes with latency; no double/dropped beat). Verification-only, no production change. `#4`.
- [x] **C5** Regression coverage (ramping grid, mid-run re-anchor, frame-exact start_at). Verification-only. `#5` · `38b29ac`. *JSI note: `uint64_t` frames cross as JS `double` — no BigInt.*

### Track A — §4.1 native owns playback
A1→A2→A3 sequential (streaming → resample → RT-safe publish), then A4/A5 ABI, A6 verify.
- [x] **A1** Mixer track = `AudioSource` per track; callback drains only; memory O(tracks). `#6` · `160dfae`. §4.1 only *partially* delivered here (resampler → A2; disk-streaming reader → A4).
- [x] **A2** Resample-on-load to engine rate inside `AudioSource`; kills the 44.1k silent-skip; `Mixer::Process` loses `sr` param + skip-branch (F4). miniaudio **linear** — Speex dropped upstream, Speex-grade quality → `#22`. `#7` · `4bc2592`. Flagged: Track member-dtor-order UAF → A3.
- [x] **A3** RT-safe track load — build `AudioSource` off-thread, publish by atomic pointer-swap. Scalar controls stay on the command ring (F3). Fixes the `SetTrackData` race + the #8 teardown-order UAF. `#8`. Each track owns `RtPublisher<TrackSource>` (reused from C2); callback does one acquire load/track, old sources retired + reclaimed off-thread (never freed on callback). `SpscRing<Command,64>` for gain/mute/solo/play/stop/pause/seek — counters written only by the callback, so Stop/Seek can't overwrite a rewind and Pause can't overshoot. `scratch_` sized once at construction, tracks >2ch rejected at load (closes a realloc-UAF ralph caught mid-review). `mixer_verify` 93→110; ASan clean; both reviewers pass after 2 fix rounds. **Residual (own issues):** `track_count_`/`longest_frames_` still non-atomic on the callback → `#23`; live-seek source reposition → `#25`.
- [x] **A4** Mixer ABI: `kb_mixer_load_track` / `unload_track` / `track_ready` added (stream from disk via `FileAudioReader`, publish by atomic swap); `kb_mixer_set_track_data` + its `float*` buffer **removed**, every caller updated, `PcmSourceReader` deleted (last user gone). `mixer_verify` loads via temp f32 WAVs through the real file path; `abi_verify` exercises load/ready/unload end-to-end. Folds in **B5** and **#23** (`track_count_`/`longest_frames_` now `atomic<relaxed>`; count-tolerant callback). `#9`. `mixer_verify` 110→125; ASan/UBSan clean.
- [x] **A5** Player ABI: `kb_player_load/unload/play/pause/seek/position/frames/is_playing` added. New `Player` class (`src/player/`) — the mixer's one-track sibling, same two app→RT disciplines (`RtPublisher<PlayerSource>` swap + `SpscRing<Command,64>` for play/pause/seek), no third. `pause` holds; no stop-to-zero (§4.1 lists only pause; rewind is `seek(0)`; §16 forbids the orphan). `Render` accumulates so it composes on top of the mixer in `Engine::Render`. Folds in **#17**: `kb_engine_set_test_tone`/`RenderTestTone` **deleted** (no product consumer — only `tools/tone_test.c`, also removed), so the engine-render seam is clean. New `player_verify` (45 checks, pumps `Render` directly over real temp WAVs: advance/pause-hold/seek/accumulate/end-stop/resample, all sabotage-proven); `abi_verify` 25→37 at the C boundary. `#10`.
- [x] **A6** New `tools/media/stream_verify`: streams a real temp WAV through the C ABI (tools-only `kb_engine_render`, added to make the ABI the test surface — `mixer_verify` no longer the only path that pumps a block; render refuses while a device stream runs), asserts exact frame count + non-silence + resample correctness. Wired into CMake + CI. `#11` · `41a45e2`.

### Track D — §4.3 downbeats
- [x] **D1** Vendored QM-DSP (`c4dm/qm-dsp` @ `e34a3cc`, GPL-2.0-or-later) into `third_party/qm-dsp/` — minimal compile closure (14 files: `TempoTrackV2`+`DownBeat`+FFT/Decimator/maths + bundled kissfft). **`BarBeatTrack` does not exist in qm-dsp** (it's a Vamp wrapper in `qm-vamp-plugins`); the equivalent primitives are `TempoTrackV2`+`DownBeat`, which is what SPEC's "preferred" choice actually means here. Own `qm_dsp` STATIC target, **linked nowhere yet** (D2's job); no `-Werror` inheritance; `kiss_fft_scalar=double` load-bearing (`FFT.cpp:121` casts double buffers into `kiss_fft_cpx`). LICENSE + GPL-propagation recorded in `third_party/qm-dsp/README.md`; lint already scopes out `third_party/`. All 10 verifies unchanged. `#12`. **D2 note:** the beat detection function feeding `TempoTrackV2` lives in `qm-vamp-plugins`, not vendored — D2 supplies one from Kitbag's analyze pipeline.
- [x] **D2** `kb_analyze_song` gains `downbeat_indices_out` + `downbeat_count_out`; caller-allocates-buffers shape kept. New `analysis/downbeat.{h,cpp}` estimates bar-ones behind the analyze pipeline; `analyze_verify` extended (downbeats land on bar-ones for a known tempo, sabotage-gated) via `analyze_test_downbeat`. `#13` · `047658c`. **D3 note:** supplies the per-song downbeat list D3's BLOB schema serializes.
- [x] **D3** — **closed as phantom-native, 2026-07-22** (`#14`). The native §4.3 obligation shipped in **D2/#13**: `downbeat.cpp` QM-DSP detector, `kb_analyze_song` int32 emit, and `analyze_test_downbeat` (already mirrors the 4/4 degraded fallback). A native BLOB serializer = §16 orphan (no consumer until the TS layer). The `+ downbeat indices` BLOB column is **§11.3 / Phase 2** (Drizzle/op-sqlite — SPEC §11.2 lines 1272/1280–82), folded with the *real* SPEC §11 D3 (drop `volume`/`latencyOffset`) & D4 (identity tuple). **Note the D-number collision**: tracker Track-D D3/D4 ≠ SPEC §11.3 D3/D4. Ruling in `#14`; decisions log 2026-07-22.
- [x] **D4** Verify: downbeats land on bar-ones for a known tempo; degraded fallback tested. `#15` · `df42531` (chain `17d3257`→`798248a`→`a04dd1a`→`df42531`). **Landed 2026-07-22.** The test was made a real downbeat proof, not a plumbing pin: a per-bar pitch-step accent (phase 1) drives the detected bar-one, and a featureless control (step==0, phase 3) detects a *different* phase — removing the accent flips detection and fails three checks, so the accent is provably load-bearing. Three ralph rounds corrected the recurring documented-lie class (comments inventing an unmeasured *cause* for the detector's phase pick: summing→2, featureless→1, bare-grid-edge→3 — all measured-false; bare click grid is phase 1). Detector's measured behavior recorded in project memory. Degraded 4/4-mirror path from D2 retained.

---

## Graveyard — do not re-attempt

Closed issues bury these; the reason they must not come back lives here.

### B1 — advance read head by min, not max — **WITHDRAWN 2026-07-20, was wrong**
A stale `mixer.cpp:139` comment claimed "minimum" while the code did maximum; the §2
audit assumed the comment was intent. **Measured:** stems share one `read_frame_` and
have no per-track cursor, so they cannot desync, and the *minimum* is what breaks — with
1000/5000-frame stems seeked to 900 it advances 900→1000 having already output through
1412, replaying 412 frames per block. `max_read` was correct. SPEC.md §2 + §4.4 amended.
**Do not reinstate.**

### `kb_engine_set_test_tone` — RESOLVED in A5 (deleted, `#17`)
Was silent: `Engine::Render` called `RenderTestTone` before `mixer_.Process`, and
`Process` memsets before its `if (!playing_) return`, erasing the tone in every state.
The 2026-07-21 ruling scheduled the fix behind A5 with a default lean to delete if
nothing consumes it. **Grep found no product consumer** — the only caller was
`tools/tone_test.c`, a dev diagnostic. Per §16 (no orphan exports) the symbol,
`RenderTestTone`/`SetTestTone`, the tone fields and `tone_test.c` were all removed. A5
wired the player into the render seam instead: `mixer_.Process` clears, then the player
and metronome accumulate (`Player::Render` is accumulate-not-assign, pinned by
`player_verify`'s accumulate check). **Do not reinstate the tone.**

### Mixer scalar controls race the callback (F3 → belongs to A3)
`Stop()`/`Pause()`/`Seek()` are raw stores from the app thread, not commands on a ring.
`Stop()`/`Seek()` are two stores and race the callback outright (the rewind can be
overwritten by the block's advance). `Pause()` is a single store — can't tear — but a
callback that already loaded `playing_ == true` advances the head one more block after
`Pause()` returns. B2's tests are single-threaded and pin none of this. Fix = the
mixer's scalar-command ring in **A3**.

---

## Cross-cutting gates (every task, per §4.5 / §16)

- Callback allocation-free, lock-free, no syscalls; master clock = sample-frame counter.
- One engine per process. Every exported symbol has a consumer — delete on removal, no speculative FFI.
- Cross-boundary constants: one definition, one owner (§13.7). No hand-mirroring.
- DoD (§16): acceptance **measured** not demoed; tests exist; true `CHANGELOG.md` entry.
- Honesty: don't claim `[x]` on a compile alone — verify at runtime through the C ABI.
