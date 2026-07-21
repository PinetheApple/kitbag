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

## Current state — 2026-07-21, `work/post-phase0`

**Done:** W0-1 · W0-2 · W0-3 (hygiene) · C1–C5 · B2 · B3 · B4 · A1 · A2 · #18 · #19.
B1 **withdrawn as wrong** (graveyard below).
**In progress:** A3 (RT-safe load; also fixes the #8 teardown-order UAF).
**Next:** A4/A5/A6, or Track D (D1 `#12`, independent — parallelizable now).
**Blocked (user rulings):** `#21` grid mute-cascade · `#22` Speex-grade resample.
**Track B not complete:** B5 (`#16`) still open, folded into A4.

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
| A2 resample-on-load | [#7](https://github.com/PinetheApple/kitbag/issues/7) | D3 BLOB schema | [#14](https://github.com/PinetheApple/kitbag/issues/14) |
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
- [ ] **B5** `longest_frames_` is monotonic (`mixer.cpp:26` only ever `max`, never recomputed down). `#16`. Folded into **A4** — same rescan-on-unload shape; A1/A3 delete the `SetTrackData` path anyway.

### Track C — §4.2 phase anchor
- [x] **C1** `kb_metronome_start_at(start_frame)` — sample-accurate deferred start.
- [x] **C2** `kb_metronome_set_grid(...)` + `clear_grid` — follow per-beat spacing. Introduced `RtPublisher<T>` (F3 bulk-payload seam; A3 reuses it). `a633536` `5a6d018`.
- [x] **C3** `kb_metronome_anchor_external(...)` — anchor to a transport we don't clock; glitch-free re-anchor. Fixed a pre-existing `accents_[-1]` OOB → `#21` (blocked on SPEC mute-cascade ruling). `#3`.
- [x] **C4** Invariants (anchoring touches future targets only; composes with latency; no double/dropped beat). Verification-only, no production change. `#4`.
- [x] **C5** Regression coverage (ramping grid, mid-run re-anchor, frame-exact start_at). Verification-only. `#5` · `38b29ac`. *JSI note: `uint64_t` frames cross as JS `double` — no BigInt.*

### Track A — §4.1 native owns playback
A1→A2→A3 sequential (streaming → resample → RT-safe publish), then A4/A5 ABI, A6 verify.
- [x] **A1** Mixer track = `AudioSource` per track; callback drains only; memory O(tracks). `#6` · `160dfae`. §4.1 only *partially* delivered here (resampler → A2; disk-streaming reader → A4).
- [x] **A2** Resample-on-load to engine rate inside `AudioSource`; kills the 44.1k silent-skip; `Mixer::Process` loses `sr` param + skip-branch (F4). miniaudio **linear** — Speex dropped upstream, Speex-grade quality → `#22`. `#7` · `4bc2592`. Flagged: Track member-dtor-order UAF → A3.
- [~] **A3** RT-safe track load — build `AudioSource` off-thread, publish by atomic pointer-swap. Scalar controls stay on the command ring (F3). Fixes the `SetTrackData` race + the #8 teardown-order UAF. `#8`.
- [ ] **A4** Mixer ABI: `kb_mixer_load_track` / `unload_track` / `track_ready`; **remove** `kb_mixer_set_track_data` + buffer param; update every caller. Also fixes B5. `#9`.
- [ ] **A5** Player ABI: `load/unload/play/pause/seek/position/frames/is_playing`. Thin over `AudioSource` (W0-2) + transport clock (W0-1). `pause` holds. `#10`.
- [ ] **A6** New `tools/` verify: stream real file, assert frame count + non-silence + resample correctness; wire into CMake + CI. `#11`.

### Track D — §4.3 downbeats
- [ ] **D1** Vendor decision: adopt QM-DSP `BarBeatTrack` (**preferred**, §4.3/§4.6) vs. extend `beat_tracker.cpp`. Record licence. Independent — parallelizable now. `#12`.
- [ ] **D2** Extend `kb_analyze_song` with `downbeat_indices_out` + `downbeat_count_out`. `#13`.
- [ ] **D3** Beat-grid BLOB schema gains a downbeat list. **Non-destructive**: absent → every `beats_per_bar`-th beat is a downbeat. Old grids stay valid. `#14`.
- [ ] **D4** Verify: downbeats land on bar-ones for a known tempo; degraded fallback tested. `#15`.

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

### `kb_engine_set_test_tone` is silent — deliberately unfixed (`#17`)
`Engine::Render` calls `RenderTestTone` before `mixer_.Process`, and `Process` memsets
(`mixer/mixer.cpp:165`) *before* its `if (!playing_) return`, so the tone is erased in
every transport state. **Measured:** a buffer pre-filled to 0.2 returns peak 0.000
stopped, 0.500 playing (the stem alone, not 0.700). Not a reorder — `RenderTestTone`
assigns rather than accumulates and writes 0.0f when disabled, so moving it after
`Process` zeros the mix on every normal block. A real fix needs accumulate semantics +
a policy SPEC.md does not state (**zero** mentions of the test tone). `Engine::Render` is
private and only driven by a live callback → no deterministic headless test today.
Belongs with **A5** or a dedicated engine-render seam.

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
