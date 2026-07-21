# Phase 1 — Core: Execution Tracker

> **Not a planning document.** `SPEC.md` §15 is the sequencing authority and §4 is
> the contract. This file only tracks *execution status* of Phase 1 work already
> specified there. If this disagrees with SPEC.md, SPEC.md wins. Do not add scope
> here that isn't in §4 — this is a checklist, not the old Autonomous Completion Plan.

Scope: **§4 in full** — native playback (4.1), phase anchor (4.2), downbeats (4.3),
mixer fixes (4.4). Framework-independent; every task headlessly testable via
`native/audio_core/tools/`. No UI.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done (verify green + both reviews pass) · `[!]` blocked

## Current state — 2026-07-21, `work/post-phase0`

**Done:** W0-1 · W0-2 `603a2c2` · W0-3 (hygiene, unplanned) · C1 · C2 · B2 `4d6c89a`
· B3 `ab0e2a4` (already-correct) · B4 `2f82d85` · B1 *withdrawn as wrong* ·
#18 `a717330` (decoder `ma_format_f32`) · #19 (analyze-path defects + coverage)
**Next:** A3 (RT-safe load, atomic publish — also fixes the #8 teardown-order UAF) or Track D (#12 D1, independent). A1+A2 landed streaming+resample; A5 also has
their streaming seam. **Track B is not complete** — B5 opened below out of B2/B3
review. **Latent, not fixed:** `beat_tracker.cpp:243` (`sum_onset / onset.size()`)
is unguarded but unreachable today (only called after `onset.size() >= 10`);
becomes a live divide-by-zero if a future caller drops that precondition.

### Tickets live on GitHub

Every remaining task has an issue in `PinetheApple/kitbag`, labelled `phase-1`
plus its track, with `--blocked-by` wired so the dependency spine is machine-
readable. **The issue is the ticket; this file is the index.** When they
disagree, believe the issue — it carries the review trail.

| Task | Issue | Task | Issue |
|---|---|---|---|
| W0-2 AudioSource | [#2](https://github.com/PinetheApple/kitbag/issues/2) | A4 mixer ABI | [#9](https://github.com/PinetheApple/kitbag/issues/9) |
| C3 anchor_external | [#3](https://github.com/PinetheApple/kitbag/issues/3) | A5 player ABI | [#10](https://github.com/PinetheApple/kitbag/issues/10) |
| C4 invariants | [#4](https://github.com/PinetheApple/kitbag/issues/4) | A6 verify tool | [#11](https://github.com/PinetheApple/kitbag/issues/11) |
| C5 regressions | [#5](https://github.com/PinetheApple/kitbag/issues/5) | D1 vendor decision | [#12](https://github.com/PinetheApple/kitbag/issues/12) |
| A1 track = AudioSource | [#6](https://github.com/PinetheApple/kitbag/issues/6) | D2 analyze outputs | [#13](https://github.com/PinetheApple/kitbag/issues/13) |
| A2 resample-on-load | [#7](https://github.com/PinetheApple/kitbag/issues/7) | D3 BLOB schema | [#14](https://github.com/PinetheApple/kitbag/issues/14) |
| A3 RT-safe load | [#8](https://github.com/PinetheApple/kitbag/issues/8) | D4 downbeat verify | [#15](https://github.com/PinetheApple/kitbag/issues/15) |
| B5 longest_frames_ | [#16](https://github.com/PinetheApple/kitbag/issues/16) | test tone (blocked) | [#17](https://github.com/PinetheApple/kitbag/issues/17) |

### Sequencing decision — 2026-07-20

**Tuner work comes last**, after all other Phase 1 functionality. User's call, and
it agrees with SPEC.md §15, which already orders the tuner last in Phase 3 behind
§10.1's research. So `tuner_verify`'s 37/37 failure stays red on purpose: it is
not a regression, not a gate, and not to be "fixed" by loosening the test.

Work is driven by the **`phase1-loop`** skill (`.claude/skills/phase1-loop/`),
which takes one issue at a time through implement → gates → `ralph` +
`code-reviewer` → fix → commit → close. It never merges, pushes, or edits a SPEC
decision, and it stops rather than inferring approval.

Gates: build 0 · `metronome_verify` `abi_verify` `beat_tracker_verify`
`note_lock_verify` `mixer_verify` all pass · `lint.sh` 0.
`tuner_verify` fails 37/37 — pre-existing detector defect (SPEC.md §10.1),
informational in CI, not a regression.

> Keep this current *as each item lands*, not in batches. It went nine commits
> stale once, and B1 spent that window telling the next reader to implement a
> bug that had already been disproved.

---

## Overall structure (codebase-design framing)

**The native core is one deep module.** Its interface is the flat C ABI in
`native/audio_core/include/kitbag_api.h`: scalars + file paths, no structs, no
buffers. That small interface hides the sequencer, mixer, streaming decoder,
player, tuner. Depth is the whole point — the same seam is crossed by Dart FFI
(gone), the JSI HostObject (§13.2, later), *and* the verify tools now. **The
interface is the test surface**: `tools/*_verify` cross the exact seam the app
will. If a test needs to reach past the C ABI, the module is the wrong shape.

Phase 1 makes the module **deeper**, three ways:
- §4.1 **removes** `kb_mixer_set_track_data` and its `float*` buffer → after it,
  *every* boundary value is a scalar or a path. Smaller interface, more behind it
  (streaming, resample, RT-safe publish). This is what lets §13.2 use a HostObject
  and skip an ArrayBuffer bridge — a direct payoff of the deletion.
- §4.2 collapses "start + separately fix up timing" into three anchor calls that
  own phase internally. Callers pass a frame or a grid; drift handling is hidden.
- §4.3 keeps the analyze interface the same shape (caller buffers out) while adding
  downbeats behind it; old grids stay valid (degraded, not broken).

**Internal seams** (private, for the core's own tests): the streaming reader behind
the mixer, the resampler behind load, the beat/downbeat tracker behind analyze.
Two adapters = a real seam — the reader has a real file adapter and will want an
in-memory fake for `tools/`, so that seam earns its keep. The resampler has one
adapter (miniaudio/Speex) → hypothetical seam, don't abstract it yet.

### Design audit (2026-07-17) — findings + decisions

Auditing the current core against the §4 work surfaced four structural issues.
Wave 0 fixes them so Phase 1 builds on the right seams, not around missing ones.

- **F1 — No transport-clock seam.** `engine.cpp:85` bumps `frames_rendered_`
  *after* Render and never hands the block's absolute frame to `Mixer::Process`
  or `Metronome::Render`. Three subsystems each carry their own position
  (`frames_rendered_`, `beat_position_`, `read_frame_`) with no shared transport.
  §4.2 (`start_at`/`set_grid`/`anchor_external`) and §4.1 (player "on the same
  clock as the click") all need the absolute engine frame of the block.
  **Decision:** thread `uint64_t block_start_frame` into every `Render`/`Process`;
  `frames_rendered_` becomes the one transport, read before the block, not after.
  → **W0-1**, prerequisite for C and A5.
- **F2 — Streaming would be written twice.** A1 (mixer tracks) and A5 (player)
  both need ring-buffered read-ahead. **Decision:** one deep module `AudioSource`
  — pull interface `Read(dst, frames)` hiding a non-RT read-ahead thread — with a
  real-file adapter and an in-memory fake for `tools/`. Mixer track and Player
  both consume it. → **W0-2**, prerequisite for A1/A5.
- **F3 — Two concurrency disciplines.** Metronome uses a clean SPSC command ring;
  Mixer uses scattered `relaxed` atomics + a caller-thread `vector.assign` that
  races `track_count_`/`has_data` (the §4.1 race). A3's pointer-swap must not add
  a third. **Decision:** scalar controls (gain/mute/solo/play/seek) arrive through
  a command ring like the metronome; bulk track payload publishes by atomic
  pointer-swap. One documented concurrency contract per module. → shapes A3/A4/B.
- **F4 — Interface shrinks as depth grows.** `Mixer::Process(out, n, sr)` + the
  `sr != output_sr → skip` at `mixer.cpp:108-109` is the §4.1 resample bug. After
  A2, the `sr` param and skip-branch both vanish. Smaller interface, deeper module
  — the intended direction, not a regression. → verified in A2/A6.

**RN package seams (§13.1) are later (Phase 2), listed only so Phase 1 doesn't
violate them:** `core-native` will be the *only* package touching JSI; the C ABI
staying scalar-only is precisely what keeps that package thin over a deep core.
Nothing in Phase 1 should widen the ABI in a way that forces a buffer across.

---

## Work → review → verify loop (every task)

1. **Work** — implement in the listed worktree, using the listed skill/agent.
2. **Self-verify** — build (`cmake --build native/audio_core/build`), run the named
   verify tool, run `bash scripts/lint.sh`. Green before review.
3. **Review** — `@ralph` (correctness + §4 conformance) **and** `@code-reviewer`
   (CONTRIBUTING.md judgment layer). Non-overlapping; run both on realtime C++.
4. **Fix findings; iterate until both pass.**
5. **Mark `[x]` only when** verify green + lint clean + both reviewers pass.

Native work goes to the **`audio-core-engineer`** agent, whose rubric is the
callback invariants, the sanctioned data-movement patterns, the size limits and
the sabotage discipline. It replaces the earlier advice to use `general-purpose`
with the `native-audio` skill — general-purpose carries no realtime rubric and
will allocate on the callback or write a test that cannot fail. Reviews stay
`ralph` (correctness/§4) and `code-reviewer` (CONTRIBUTING.md judgment layer).

---

## Parallelization

Conflict map: **W0-1** (transport clock) touches `engine.*` + every `Render`/
`Process` signature → it is a prerequisite that lands *first, alone*, on the
feature branch (everything rebases on it). **W0-2** (`AudioSource` module) is a new
file, no conflict. Track A rewrites `mixer.cpp` track loading; Track B does in-place
`mixer.cpp` fixes → **A and B share a file, sequence them** (B first, small). C is
`metronome.cpp` only; D is `beat_tracker.cpp`/analyze only.

| Wave | Runs in parallel | Worktree |
|---|---|---|
| **0a** | **W0-1** transport-clock seam (blocks C, A5) — lands first, alone | feature branch |
| **0b** | **W0-2** `AudioSource` module (blocks A1, A5) · **D1** QM-DSP vendor decision | W0-2 on feature branch; D1 in `wt-downbeats` |
| **1** | **Track B** (mixer fixes) · **Track C** (phase anchor, needs W0-1) | B on feature branch; C in `wt-phase-anchor` |
| **2** | **Track A** (native playback — needs W0-2 + B) · **D2–D4** (need D1) | A on feature branch; D continues `wt-downbeats` |
| **3** | **Integration verify** — all tracks merged, full `metronome_verify` + new player/mixer tool green together | feature branch |

Spawn parallel worktrees: `bash scripts/worktree.sh create phase-anchor main`,
`... create downbeats main`. Remove when merged.

---

## Track W0 — Structural prep (design audit F1–F3)  ·  Wave 0  ·  skill: `native-audio`

Must land before the tracks that depend on them. Review: `@ralph` (RT invariants,
clock correctness) + `@code-reviewer`. Verify: `metronome_verify` stays green
across W0-1 (pure refactor — behaviour unchanged); W0-2 gets a `tools/` check
driving the in-memory fake.

- [x] **W0-1** Transport-clock seam (F1). Threaded `uint64_t block_start_frame` into `Metronome::Render`; `Engine::Render` reads `frames_rendered_` before the block, advances after. Mixer left unchanged (no Phase 1 consumer). Landed with its first consumer C1 to avoid a dead param. `metronome_verify` green; ralph + code-reviewer passed after fixes.
- [x] **W0-2** `AudioSource` module (F2). Pull interface `Read(float* dst, frames)` hiding a non-RT ring-buffered read-ahead thread; lifecycle split `Open`/`Start`/`Stop`/`Seek`/`Close` so pause/resume preserves the ring and the position. Real-file adapter (miniaudio) + in-memory fake; `audio_source_verify` (104) links no miniaudio, `file_audio_reader_verify` (14) drives a runtime WAV fixture. Review caught a critical defect: the file adapter never requested `ma_format_f32`, so every 16-bit file decoded to denormal noise — it had zero coverage because a CMake comment argued that testing it would leak the seam. Its twin in `decoder.cpp` is live on the `kb_analyze_song` path → issue #18. TSan + ASan/UBSan clean; 15 sabotage mutations reproduce. **Known gap:** the EOF/underrun flag ordering is reasoned, not measured — folding the two flags back into one leaves all 104 checks green, and the code says so at the store. **Unblocks A1, A5.**

### W0-3 — Codebase hygiene (unplanned; ran 2026-07-19/20)

Not in the original plan. Grew out of "improve codebase design first" and became a
prerequisite for everything after it, since the standards are now gated.

- [x] **Comment audit** — ~40 narrating comments deleted tree-wide. Four were false: `mixer.cpp` claimed minimum where the code took maximum (see B1), `mixer.h` promised unconditional RT-safety that `SetTrackData` violates, `tuner.cpp`/`tuner_verify.cpp` cited a `PLAN.md` deleted in `73b0ea9`, and two `§13.3` citations belonged to `§4.5`. Commit `a0510a3`.
- [x] **Formatting standard** — one-per-line parameter wrap with the closing paren on its own line (`AlignAfterOpenBracket: BlockIndent`); one-line bodies unbraced, longer bodies braced. Costs vertical space: `metronome_verify.cpp` 830→982 before the split. Commit `4efa048`.
- [x] **Size gates** — functions ≤30 lines, files ≤400 including tests, comments ≤2 lines. 22 functions and 3 files were over; all split on subsystem seams. `readability-function-size` + `readability-braces-around-statements` now gate; `scripts/lint.sh` grew a file-length check (no linter ships one). Commit `dedf7f0`.
- [x] **`lint.sh` failed open** — it skipped *all* of clang-tidy when the compile DB was absent and still exited 0, hiding 7 function-size violations behind a green run. `CMakeLists` now sets `CMAKE_EXPORT_COMPILE_COMMANDS`; the script fails instead of skipping.
- [x] **Folder structure** — `src/` was 32 flat files across six subsystems. Grouped `rt/ dsp/ metronome/ tuner/ mixer/ analysis/ media/ api/` following the include graph, `engine.*` at the root as composition root; `tools/` mirrors it. Pure move — 40 renames, diff contains only `#include` paths and guards, `nm -D` identical down to load addresses. Commit `620ad10`.
- [x] **`audio-core-engineer` agent** — there was no designated C++ agent, so this work was falling to `general-purpose`, which carries no realtime rubric. Encodes the callback invariants, the three sanctioned data-movement patterns, the size limits, and the sabotage discipline. Commit `4e80188`.
- [x] **Test-quality fixes** — `NoteLock` extracted so the tuner's 4-state lock machine has real coverage (it had none: the detector returns 0.000 Hz so `PublishFrequency` is unreachable). Splitting the command switch had silently disabled `-Wswitch`. Shared test helpers passed vacuously on empty input. Commit `5a6d018`.
- [x] **Two analysis bugs** found during the comment audit: `BeatTracker` capped beats while backtracking from the *last* beat, so a track over ~17 min returned a grid starting partway into the song; and the `.kwav` sidecar path used `-4` arithmetic that stripped *nothing* from a three-letter extension (`song.wav` → `song.wav.kwav`, `song.mp3` → `song.mp3.kwav`) and one character from a four-letter one (`song.flac` → `song.fla.kwav`) — the common cases were the unstripped ones. Commit `a633536`.

## Track B — §4.4 Mixer fixes in place  ·  Wave 1  ·  skill: `native-audio`

Verify: `metronome_verify` unaffected; add mixer assertions to a `tools/` check.
Review: `@ralph` + `@code-reviewer`.

- [x] ~~**B1** advance read head by **min** across played tracks, not `max_read`.~~ **WITHDRAWN 2026-07-20 — this task was wrong.** A stale `:139` comment claimed "minimum" while the code did maximum; the §2 audit recorded the mismatch and assumed the comment was intent. Measured with ramp fixtures encoding their own frame index: stems share one `read_frame_` and have no per-track cursor, so they cannot desync, and the minimum is what breaks — with 1000/5000-frame stems seeked to 900 it advances 900→1000 having already output through 1412, replaying 412 frames per block. `max_read` was correct. SPEC.md §2 + §4.4 amended. **Do not reinstate.**
- [x] **B2** Split `Stop()` (position→0) from `Pause()` (holds). `Mixer::Pause()` is a single release store, no rewind; `kb_mixer_pause` added beside `kb_mixer_stop`, scalar-only so the ABI stays free of buffers. Pinned both directions: `mixer_verify` gains 8 checks (paused block silent, head held, resume audible *from the held frame* — 101746, not 100000) and `abi_verify` 3 at the C boundary. Sabotaged both ways: making Pause rewind fails 4+1 checks; making Stop hold fails the pre-existing `stop: the head rewinds to zero`. Commit `4d6c89a`.
- [x] **B3** Zero-pad tracks shorter than the longest instead of dropping them from the mix. **Already correct — no production change.** B4 had already decoupled the transport from what is audible, and `MixTrack` never dropped a short stem: `frames_avail` clamps to the stem's end and `Process` memsets first, so the tail of the block stays zero. Measured, not assumed — with a 1000-frame stem under a 5000-frame one, seeked to 900 so one block straddles the boundary: frame 900 = 101800 (both stems *summed*, not 100900 = long alone), 999 = 101998 (last contributing frame), 1000 = 101000 and 1300 = 101300 (long alone, padded exactly). 13 new checks in `mixer_verify`, mono and stereo separately, since `MixStereo` reaches the frame through a channels-strided index. **Sabotage: one verified mutation**, not the three first claimed — dropping stems that don't cover the whole block (`start_frame + frame_count > num_frames → return`) fails 5 checks, the zero-pad sum reading 100900 where both stems summed give 101800. Two further claims were **withdrawn after ralph failed to reproduce them and I re-measured**: wrapping `MixMono`'s index modulo `num_frames` leaves the suite green, and loosening `MixStereo`'s bound leaves it green. Root cause of the bad evidence: `MixTrack`'s `frames_avail` is the *sole* padding mechanism and **both inner bounds checks in `MixMono`/`MixStereo` are unreachable** — deleting both keeps 57/57 green. The first run conflated widening `frames_avail` with the wrap it accompanied. The stereo check still discriminates: no-op'ing `MixStereo`'s body fails `zero-pad stereo: last frame` alone. Commit `ab0e2a4`. **Follow-up:** the suite was asserting only the left channel, so a right-channel-only fault (`output[2f+1]` reading `pcm[src_idx]`) passed 57/57. Right-channel checks added and sabotage-proven — that mutation now fails one check and only that one. A channel *swap* was already caught, since the ramp makes L and R differ by one. Needed the file split `mixer_verify.cpp` had reached 367/400, done on the seam its own docstring named: `mixer_test_support.h` + `mixer_test_transport.cpp` + `mixer_test_mix.cpp`, one executable, per the `metronome_verify` pattern.
- [x] **B4** Auto-stop on **end of longest track**, never "all tracks silent". Was live: `MixTrack` returns 0 for muted/zero-gain/un-soloed/rate-mismatched tracks, so "nothing audible" and "out of data" were one condition — muting everything stopped playback. Transport now follows the longest *loaded* track, independent of gating. Advance became `min(frame_count, longest − start)`; equal to `max_read` whenever the longest track is audible, but keeping the old form would freeze the head under mute-all, turning mute into pause. New `tools/mixer/mixer_verify.cpp`, 36 checks, 6 sabotage runs. Commit `2f82d85`.

- [ ] **B5** `longest_frames_` is monotonic — `mixer.cpp:26` only ever takes a `max` and is never recomputed downward. **Measured:** load track 0 with 5000 frames, reload the same track with 1000, and `track_frames(0)` correctly reports 1000 while the transport still runs to 5000 — seeked to 1500 it renders a silent block, advances to 2012 and still reports `is_playing()`. Pairs with the rescan-on-unload need already implied by A4 (`kb_mixer_unload_track` has the same shape), so fix both there rather than bolting a rescan onto `SetTrackData`, which A1/A3 delete anyway.

### Known and deliberately unfixed in Track B — `kb_engine_set_test_tone` is silent

`Engine::Render` calls `RenderTestTone` before `mixer_.Process`, and `Process`
memsets (`mixer/mixer.cpp:165`) *before* its `if (!playing_) return`, so the clear
is unconditional and the tone is erased in every transport state. **Measured:** a
buffer pre-filled to 0.2 returns peak 0.000 with the mixer stopped and peak 0.500
with it playing — the stem alone, not 0.700, so the tone is absent either way.
`tools/tone_test.c` exists solely to exercise this ABI function and produces
silence.

**Not fixed, and not a reorder.** `RenderTestTone` *assigns* rather than
accumulates and writes 0.0f when disabled, so moving it after `Process` would
zero the mix on every normal block. A real fix needs accumulate semantics plus a
policy SPEC.md does not state — it contains **zero** mentions of the test tone,
so "tone while playback is live" has no defined behaviour to implement against.
`Engine::Render` is private and only driven by a live miniaudio callback, so no
deterministic headless test can pin a fix today; a test seam would have to come
first. Belongs with **A5** (player transport) or a dedicated engine-render seam.

### Known and deliberately unfixed in Track B (F3 — belongs to A3)

`Stop()`, `Pause()` and `Seek()` are raw stores from the app thread, not commands
on a ring. `Stop()`/`Seek()` are two stores and race the callback outright: the
rewind can be overwritten by the block's advance. `Pause()` is a single store and
so cannot be torn, but its contract still isn't literally exact under a live
device — a callback that already loaded `playing_ == true` will advance the head
one more block after `Pause()` returns. B2's tests are single-threaded and pin
none of this; the fix is the mixer's scalar-command ring in **A3**.

## Track C — §4.2 Phase anchor  ·  Wave 1 (needs W0-1)  ·  worktree `wt-phase-anchor`  ·  skill: `native-audio`

Builds on the §4.7 latency fixes already pinned. Verify: extend `metronome_verify`.
Review: `@ralph` (RT invariants, no scheduled-event mutation) + `@code-reviewer`.

- [x] **C1** `kb_metronome_start_at(engine, uint64_t start_frame)` — sample-accurate deferred start. New `kStartAt` command + `BeginRun()` helper; fires on the exact sample inside the render loop. 7 regression tests in `metronome_verify` (frame-exactness off a block boundary, anchor-at-0, beat-0 under a latency offset, armed-ramp+offset locals recompute [validated: fails without the fix], ignored-while-running, Start-cancels-pending, Stop-cancels-pending). Two review rounds: ralph Pass, code-reviewer Pass after fixing a test whose name claimed a cancel path it never exercised.
- [x] **C2** `kb_metronome_set_grid(beat_times_sec[], count, anchor_frame)` + `kb_metronome_clear_grid` — follow per-beat spacing, not global BPM. Array copied, not retained. Introduced `RtPublisher<T>` (F3) as the app→RT bulk-payload seam: atomic pointer swap + deferred retire, generation stored *inside* the node so one acquire load carries value and identity and ABA is impossible by construction. A3 reuses this. Two review rounds; ralph's blocker (grid cursor stranded across Stop/Start → off-grid click, reproduced at 2.602s) and a second instance found via `StartAt` both fixed. `ClearGrid` made genuinely phase-continuous. Subdivisions divide each measured interval. Grid BPM mirror clamped. New `abi_verify` covers the validation guarding `lower_bound`'s ordering precondition. Commits `a633536`, `5a6d018`.
- [x] **C3** `kb_metronome_anchor_external(song_pos_sec, at_frame, bpm)` — anchor to a transport we don't clock; re-callable; glitch-free re-anchor. Command crosses the SPSC ring as three scalars; phase recomputed at block start so a re-anchor moves only future clicks. Grid wins (documented, user-ruled A). Uncovered and fixed a pre-existing `accents_[-1]` OOB in `OnSubdivisionTick` (reachable via plain `Start` + positive latency at bpm>300); the fix bounds the index but not the attribution base → #21 (blocked on SPEC mute-cascade ruling). Both reviewers pass; `metronome_verify` 206.
- [x] **C4** Invariants: anchoring recomputes **future** targets only, never mutates scheduled events; all three compose with latency offset (click at speaker); no double/dropped beat on re-anchor. Verification-only — all three invariants already held (C3 built the machinery), **no production source changed**. 3×3 matrix pinned: 4 cells already covered, 4 new tests (7 checks, 206→213). Real gap closed: `set_grid × latency` was never tested at non-zero offset. Both reviewers pass; ralph ran a 4th sabotage of its own to confirm no cell is green-by-accident.
- [x] **C5** Regressions in `metronome_verify`: grid-follow tracks a ramping grid; re-anchor mid-run glitch-free; `start_at` frame-exact. JSI note: `uint64_t` frames cross as JS `double` — no BigInt. `38b29ac` — 3 tests added (213→218 checks), verification-only, no production change; drifting re-anchor isolated to `SeekGridCursor` (only new test fails), start_at frame-exact via `FirstNonzeroFrame` bypassing the ±2 detector window. Both reviewers pass.

## Track A — §4.1 Native owns playback  ·  Wave 2 (needs W0-2 + B)  ·  skill: `native-audio`

Largest track. A1→A2→A3 sequential (streaming → resample → RT-safe publish), then
A4/A5 ABI, A6 verify. Verify: new `tools/` player+mixer check loads a real file,
asserts non-silence + exact frame count, headless.
Review: `@ralph` (allocation-free/lock-free callback, pointer-swap release
semantics) + `@code-reviewer`.

- [x] **A1** Mixer track = **`AudioSource` (W0-2) per track**; callback drains only; memory O(tracks) not O(duration). Do not re-implement streaming here — consume the W0-2 module. `160dfae` — each `Track` owns an `AudioSource`; `Process`/`MixTrack` drain only (alloc/lock/syscall-free, `scratch_` pre-sized off-thread, `frame_count>kMaxBlockFrames` guarded). Drain-before-gating so muted tracks stay in lockstep (fixes replay-on-unmute, §4.4). Non-RT `Play`/`Seek` prime the ring before playback. `PcmSourceReader` in-memory adapter bridges the legacy `SetTrackData` path. `mixer_verify` 61→84 (5 streaming tests, both sabotages bite). **§4.1 only PARTIALLY delivered**: resampler (44.1k rate-drop still silent) → A2; true O(tracks) needs the disk-streaming reader → A4 (legacy path still copies whole song). Both reviewers pass.
- [x] **A2** Resample-on-load to engine rate (miniaudio/Speex), inside `AudioSource`. Kills `mixer.cpp:108-109` silent-skip of 44.1k; 44.1k must work. After this, `Mixer::Process` loses its `sr` param + skip-branch (F4). `4bc2592` — `ResamplingSourceReader` decorator resamples on the read-ahead thread (RT drain unchanged); `ConfigureTrack` wraps when `sample_rate != engine_rate_`; `Process`/`MixTrack` lost `sr` + skip-branch, `Mixer(uint32_t engine_rate)` threads `Engine::kSampleRate` (no hardcoded 48000). Uses miniaudio `ma_data_converter` **linear** — vendored miniaudio dropped Speex; Speex-grade quality deferred to **#22** (needs a dep ruling). `mixer_verify` 84→93 (2 tests, both sabotages bite; 1000Hz-vs-1088.4Hz Goertzel discrimination). Public C ABI unchanged. Both reviewers pass. Ralph flagged: SPEC §4.6 wrongly claims miniaudio bundles Speex→#22; pre-existing Track member-dtor-order UAF on whole-object destruction→A3 (#8).
- [ ] **A3** RT-safe track load — build `AudioSource` off-thread, publish by atomic pointer-swap (release semantics). Scalar controls stay on the command ring (F3). Fixes `SetTrackData` race; load-during-playback safe.
- [ ] **A4** Mixer ABI: add `kb_mixer_load_track` / `kb_mixer_unload_track` / `kb_mixer_track_ready`. **Remove** `kb_mixer_set_track_data` + its buffer param. Update every caller/consumer (no orphan symbol).
- [ ] **A5** Player ABI: `kb_player_load/unload/play/pause/seek/position/frames/is_playing`. Player = thin over **`AudioSource` (W0-2) + transport clock (W0-1)** — a 1-source transport, not a parallel streaming stack. `pause` holds position.
- [ ] **A6** New `tools/` verify: stream real file, assert frame count + non-silence + resample correctness. Wire into CMake + CI.

## Track D — §4.3 Downbeats  ·  D1 Wave 1, D2–D4 Wave 2  ·  worktree `wt-downbeats`  ·  skill: `native-audio`

Verify: new analyze fixture asserts downbeats land on bar-ones for known tempo.
Review: `@ralph` (non-destructive schema migration) + `@code-reviewer`.

- [ ] **D1** Decision + vendor: adopt QM-DSP `BarBeatTrack` (GPL-compatible, the researched choice — **preferred**, §4.3/§4.6) vs. extend hand-rolled `beat_tracker.cpp`. Vendor the choice; record licence from its `LICENSE`.
- [ ] **D2** Extend `kb_analyze_song` with `int32_t* downbeat_indices_out` + `int32_t* downbeat_count_out`.
- [ ] **D3** Beat-grid BLOB schema gains a downbeat index list. **Non-destructive**: absent → treat every `beats_per_bar`-th beat as downbeat (degraded, usable). Old grids stay valid.
- [ ] **D4** Verify: downbeats land on bar-ones for a known-tempo fixture; degraded fallback path tested.

---

## Cross-cutting gates (apply to every task, per §4.5 / §16)

- Callback allocation-free, lock-free, no syscalls; master clock = sample-frame counter.
- One engine per process. Every exported symbol has a consumer — delete on removal, no speculative FFI.
- Cross-boundary constants: one definition, one owner (§13.7). No hand-mirroring.
- DoD (§16): acceptance **measured** not demoed; tests exist; true `CHANGELOG.md` entry.
- Honesty: don't claim a task `[x]` on a compile alone — verify at runtime through the C ABI.
