# Kitbag — Product & Technical Spec

> The open-source everything-app for musicians. GPLv3, no caps, no paywalls.
>
> **Status**: authoritative and sole. There is no companion planning document —
> `PLAN.md` was deleted on 2026-07-17 once its Flutter architecture, its stale
> milestones and its superseded design notes left nothing this file does not say
> better. What was still true in it lives here: the dependency table is §4.6, the
> tuner capture research is §10.1, the BPM ladder is §8.5.
>
> **Stack: React Native + TypeScript.** Decided 2026-07-17. This document is
> the first revision of the spec that fixes the UI framework; the previous
> revision was deliberately stack-neutral, and its audit of the Flutter build
> is carried forward into §2 here rather than kept as a separate file.
> §2 remains the ground truth about what that build does and does not do.
>
> **What did not change:** §4, the native audio core contract. It is a flat C
> ABI and it was written to outlive this decision. It is reproduced here
> unchanged in substance. Every requirement it states is still the highest-
> leverage work in the project, and it is still framework-independent.

---

## 1. Why this spec exists

`CHANGELOG.md` claims milestones 0.1 through 0.5 all shipped on 2026-07-14.
An audit on 2026-07-17 found that claim substantially false. The app has a
broad, largely well-built Flutter UI shell over an audio core that is missing
two primitives the product depends on. Every headline feature failure traces
to those two gaps, not to the UI.

**The one-sentence finding:** the C++ core can neither *play a file* nor
*start the click at a known instant*, and those two absences account for the
stem player being silent, the library needing `just_audio`, and phase lock
not existing.

The purpose of this document is to state what Kitbag *is*, so it can be built
against a correct foundation rather than carrying the gaps forward through a
framework migration.

### 1.1 What the stack decision does and does not change

| Survives the migration | Reason |
|---|---|
| §4 native audio core contract | Flat C ABI. Reachable from JSI as it was from Dart FFI. |
| The whole of `native/audio_core/` | C++. Untouched by the UI language. |
| The Kotlin platform code | `MediaSessionPlugin.kt`, `NotificationListenerService`. Ports from a Flutter plugin to a TurboModule; the Android logic is the same. |
| The database schema (§11) | SQLite either way. |
| The design system (§12) | Tokens, components and §12.6 experience rules are framework-agnostic by construction. |
| The design specs in `design/` | Four HTML files, all still binding. |
| The plugin model (§9) | It was always an interface, not a Flutter idiom. |

| Does not survive | Replacement |
|---|---|
| Flutter widgets, ~10 packages of Dart UI | React/TSX (§13) |
| Riverpod providers | Zustand stores in one package (§13.4) |
| Drift | Drizzle over op-sqlite (§11.1) |
| Dart FFI bindings (`core_audio_ffi`) | JSI TurboModule + HostObject (§13.2) |
| `custom_lint_kitbag` | ESLint flat config with custom rules (§13.6) |
| `just_audio` | Deleted outright — §4.1 replaces it. This was already true before the stack decision. |
| Melos | pnpm workspaces + Turborepo (§13.1) |

**The migration does not license a redesign.** Where a Flutter-era behaviour
is specified below and is not marked as a change, it is a requirement, not a
description.

---

## 2. Current state

Ground truth as of 2026-07-17, audited against the Flutter build. Cite this
when deciding what to port and what to leave.

### 2.1 Genuinely works — port the behaviour, not the code

| Area | Notes |
|---|---|
| **Metronome engine** | Lookahead scheduler, sample-accurate click. C++. **Keeps running untouched.** |
| **Metronome UI** | Swipe tempo, ±5/±10, TAP, 3-state accent LEDs, polyrhythm second row, subdivisions 1–16, tempo ramp, bar muting. The healthiest part of the codebase and the reference for the React port. |
| **Setlist/song CRUD** | Create/rename/delete/reorder, on-stage pager, live-BPM autosave. |
| **Export/import** | `kitbag_export.json` v3. Works; §5.4 and §12.4 change it to v4. |
| **Beat analysis pipeline** | Import → background isolate → `kb_analyze_song` → BPM + beat grid (Float32 BLOB) + `.kwav` waveform sidecar. Real. The isolate becomes a worker (§13.5). |
| **Waveform render** | `.kwav` parser + painter, tap-to-seek. Painter is Flutter; the parser and format are portable. |
| **Media session detection (Android)** | `MediaSessionManager` via `NotificationListenerService`. Correct approach, keeps its Kotlin. |
| **Native mixer core** | 16-track, per-track gain/mute/solo atomics, solo-aware, shared read head. Correct design — never receives data. |

### 2.2 Shell over a hole

| Area | Reality |
|---|---|
| **Stem player** | ~90% by LOC, **0% functional**. `_decodeFile` returns `null`; `setTrackData` is never called; `track_count_` stays 0, so gain/mute/solo all early-return and `play()` auto-stops instantly. UI reports ready. |
| **Library phase lock** | Dart `Timer`-driven, ±16ms and GC-jittered. Restarts the native sequencer every beat. Latency offset exists, never set. Not sample-accurate. |
| **Media sync phase lock** | Does not exist. `sync_screen.dart:222-232` is `setTempo(); start();` — right tempo, arbitrary phase. |
| **Metronome notifications** | Service + listener fully written, **referenced by nothing**. No foreground service — metronome dies when backgrounded. |

Note what this table means for the migration: the stem player and both phase
locks are **not ports**. There is nothing working to port. They are first
implementations, and §4 is their precondition.

### 2.3 Broken / incorrect — do not reproduce

These are the Flutter build's defects. They are listed because several are
*design-relevant* — the design files cite them — and because a port that
faithfully reproduces them has failed.

- `media_session_service.dart:44` — `cast<Map<String,dynamic>>` on a channel
  result that decodes to `Map<Object?,Object?>`. Throws, swallowed by
  `catch (_) => []`. **Sync screen shows "No media detected" unconditionally
  on device.** In RN this is the JSON boundary from the TurboModule; the class
  of bug is the same and the lesson is that it was invisible because the catch
  swallowed it.
- `MediaSessionPlugin.kt:47` — `requestPermission` returns `success(true)`
  unconditionally without opening Android settings. Reports a grant that never
  happened. **This Kotlin is being ported; fix it in the port.**
- `mixer.cpp:107-109` — any stem whose sample rate ≠ 48kHz is **silently
  skipped**. A 44.1kHz stem set plays as silence with no error.
- `mixer.cpp:14` — `SetTrackData` does `t.pcm.assign()` while the audio thread
  may be reading `tr.pcm` in `Process`. Data race / use-after-realloc.
- ~~`mixer.cpp:140-141` — read head advances by `max_read`; the comment on :139
  says minimum. Unequal-length stems desync.~~ **Withdrawn 2026-07-20.**
  Measured: every track is indexed by one shared `read_frame_`, so stems have
  no per-track cursor and cannot desync. The minimum rule is what breaks —
  with a 1000-frame and a 5000-frame stem it advances 900→1000 while having
  already output through 1412, replaying 412 frames at every block near the
  short stem's end. `max_read` is correct; the :139 comment was the defect.
  The live bug beside it is the auto-stop condition — see §4.4.
- `mixer.cpp:68-71` — `Stop()` resets position to 0, and the pause button calls
  it. **There is no pause.**
- `bpm_lookup_service.dart:68` — comment claims title/artist similarity
  matching; the loop returns the first result with nonzero BPM. Wrong-song BPM
  likely.
- `bpm_lookup_service.dart:46-47` — tap tempo needs ≥4 taps and gives no
  feedback for the first three, and averages BPM values rather than intervals,
  which biases the result high.
- `library_songs_dao.dart:43-49` — "fuzzy match" is unescaped
  `LIKE '%$title%'`. `%`/`_` in a title are wildcards.
- `database.dart:88-89` — doc says paths are relative to the music dir;
  `library_screen.dart:226` stores absolute. Breaks on iOS.
- `sync_screen.dart:14` — invents sound names (`'Default', 'Rim shot'…`) that
  do not match the engine's `soundNames` (`'Beep', 'Woodblock', 'Click'…`).
  Picking "Rim shot" plays Click. **The error propagated into a design file.**
  There is one sound list and it belongs to the engine.
- `settings_screen.dart` — `pickBaseDirectory` writes a pref **nothing reads**;
  export hardcodes `/storage/emulated/0/Download`; `importData` calls
  `create` unconditionally so restoring a backup twice duplicates everything;
  version is a hardcoded string.
- `app.dart:20` hardcodes `ThemeMode.system` — **the light palette this design
  system defines has never been reachable.**

The C++ items (`mixer.cpp`) are live bugs in code that is being kept. They are
fixed in §4.4, not by the migration.

### 2.4 Dead code

The Flutter packages are being replaced wholesale, so most of the old §2.4 is
moot. Two entries survive as instructions rather than deletions:

- **Do not port a second plugin registry.** The Flutter build has two —
  a hardcoded list and a generated manifest that knows 2 of 5 tools and is
  consumed by nothing. §9.2 keeps the explicit list. Do not write a generator.
- **Do not port speculative exports.** `PracticeDao.deleteSession`/`deleteAll`,
  `getSetById`/`getSetCount`/`deleteStemsForSet`, `activeTrackCount`/
  `trackFrames`, the AcousticBrainz stub, `mediaSessionPollerProvider`,
  `phaseOffsetMsProvider` — all had zero consumers. §4.5's rule ("every
  exported symbol has a consumer") applies to the TypeScript too.

### 2.5 Architectural debt — and which of it the migration fixes

- **Two playback engines.** `just_audio` plays library songs; `core_audio_ffi`
  plays the click. Separate clocks, separate graphs, no shared sample
  reference. **§4.1 fixes this, not React.** Do not reach for
  `react-native-track-player` — it is the same mistake with a different name.
- **No downbeat detection.** `beat_tracker.cpp` is hand-rolled, not QM-DSP
  BarBeatTrack, which the original research chose and nobody built. It yields
  beats but not bar-ones.
  **Unaffected by the migration; §4.3 fixes it.**
- **Single shared metronome controller.** `PlayAlongScreen` mutates the
  standalone metronome's tempo with no save/restore. §6.4 and §8.9 fix this;
  the migration is a good moment to, since the state layer is being rewritten.
- **No tests** in `tool_sync`, `tool_stems`, `tool_library`. No native mixer
  test. No metronome soak/jitter harness. **The migration does not fix this and
  makes it more urgent** — see §14.

---

## 3. Product scope

### 3.1 Core features

1. **Metronome** — the anchor tool. Songs, setlists, export/import, background
   operation with notification transport controls.
2. **Song playback** — import, analyse, play, with the click locked to the beat
   grid.
3. **Stem player** — StemDeck-class per-track control.
4. **Play along** (engineering name: media sync) — lock the click to what
   Spotify et al. is playing.
5. **Plugin extensibility** — the tools above are plugins; the shell is a
   registry.

### 3.2 Deferred

6. **Tuner** — §10. Currently built in Flutter but the mic pickup is unreliable
   in practice; **requires research before reimplementation**, not a port. The
   migration does not change this: the problem is in the capture path and the
   DSP, both of which are native.

### 3.3 Out of scope

Stem separation · Ableton Link · MIDI clock · time-stretch · mic beat tracking
· practice analytics beyond session logging. Architecture must not preclude
them; nothing here blocks them.

### 3.4 Platforms

**Android is the primary target and the only one with the full feature set.**

| Platform | Status |
|---|---|
| Android | Primary. All features. Distribution: Play + F-Droid (§13.8). |
| iOS | Secondary. Everything except cross-app media sync, which is Spotify-only via App Remote (§8.2) — a platform limit, not a bug. |
| Desktop dev vehicle | The native core builds and runs headless (`native/audio_core/tools/`). Not a product target. |
| Web | **Out of scope, and not merely unbuilt.** A browser has no cross-app media session (F4 impossible), no foreground service (F1's background click impossible), and no path to the C++ core short of a WASM rebuild that would rewrite §4 entirely. Do not treat React Native as a step toward a web build. |

---

## 4. Native audio core contract

**This is the portable foundation, and it did not change with the stack.** It
is a flat C ABI (`native/audio_core/include/kitbag_api.h`) reachable from Dart
FFI, JSI, or anything else. Values crossing the boundary are scalars — no
structs, no buffers, with the two documented exceptions below. Keeping it this
way is what made the UI framework a swappable detail, and this section is the
proof that it worked.

### 4.1 New: native owns playback

**Problem.** The core can open a file and report its duration, sample rate, and
channel count — and cannot read a single frame from it. There is no PCM export
in `kitbag_api.h`. That is why the stem mixer is silent and why the library
reaches for `just_audio`.

**Rejected fix:** export PCM to the app layer. Six 5-minute stems as float32 is
~690MB across the boundary. Wrong shape at any size, and no less wrong across
JSI than across FFI.

**Contract.** The core loads and streams files itself. The app layer passes
paths and receives scalars; samples never cross.

```c
/* Mixer: one track per stem, streamed from disk. */
KB_EXPORT kb_result kb_mixer_load_track(kb_engine* engine, int32_t track,
                                        const char* path);
KB_EXPORT void      kb_mixer_unload_track(kb_engine* engine, int32_t track);
KB_EXPORT int32_t   kb_mixer_track_ready(const kb_engine* engine, int32_t track);

/* Player: single-file playback on the same clock as the click. */
KB_EXPORT kb_result kb_player_load(kb_engine* engine, const char* path);
KB_EXPORT void      kb_player_unload(kb_engine* engine);
KB_EXPORT void      kb_player_play(kb_engine* engine);
KB_EXPORT void      kb_player_pause(kb_engine* engine);   /* holds position */
KB_EXPORT void      kb_player_seek(kb_engine* engine, int64_t frame);
KB_EXPORT int64_t   kb_player_position(const kb_engine* engine);
KB_EXPORT int64_t   kb_player_frames(const kb_engine* engine);
KB_EXPORT int32_t   kb_player_is_playing(const kb_engine* engine);
```

Requirements:

- **Streaming, not preload.** Ring-buffered read-ahead on a non-RT thread; the
  audio callback only drains. Memory is O(tracks), not O(duration).
- **Resample on load** to the engine rate. This replaces `mixer.cpp:109`'s
  silent skip. 44.1kHz content is the common case and must work.
- **Loading is realtime-safe.** Fixes the `SetTrackData` race: build the track
  off-thread, publish by atomic pointer swap with release semantics. Loading a
  track during playback must be safe.
- `kb_mixer_load_track` supersedes `kb_mixer_set_track_data`, which is removed
  along with the buffer it took — after which **every remaining boundary value
  is a scalar.** This matters more under JSI than it did under FFI: see §13.2.

### 4.2 New: phase anchor

**Problem.** `kb_metronome_start(engine)` takes no time argument. The click
begins whenever the call lands. There is no way to say *start on this frame*,
so there is no phase lock — only tempo lock. `kb_metronome_bar_phase` is a
read-only UI getter and does not help.

**Contract.**

```c
/* Sample-accurate start. frame is on the engine clock
   (cf. kb_engine_frames_rendered). */
KB_EXPORT void kb_metronome_start_at(kb_engine* engine, uint64_t start_frame);

/* Follow a beat grid rather than a single BPM — handles tempo drift.
   beat_times_sec is copied; it does not need to outlive the call.
   This and kb_analyze_song's float* out are the only non-scalar params. */
KB_EXPORT kb_result kb_metronome_set_grid(kb_engine* engine,
                                          const double* beat_times_sec,
                                          int32_t count,
                                          uint64_t anchor_frame);
KB_EXPORT void kb_metronome_clear_grid(kb_engine* engine);

/* Anchor to an external transport we do not clock (Spotify et al.).
   Declares: at engine frame at_frame, the song was song_pos_sec in,
   running at bpm. Re-callable to re-anchor; must not glitch the click. */
KB_EXPORT void kb_metronome_anchor_external(kb_engine* engine,
                                            double song_pos_sec,
                                            uint64_t at_frame,
                                            double bpm);
```

Requirements:

- Scheduling stays in the existing lookahead sequencer. Anchoring recomputes
  *future* click targets only — never mutates already-scheduled events.
- `set_grid` mode follows per-beat spacing, not a global BPM. This is what makes
  non-constant-tempo songs work, which a single `setTempo` cannot.
- Re-anchoring mid-playback must be glitch-free (no double-click, no dropped
  beat).
- All three compose with the existing latency offset so the click lands on the
  beat *at the speaker*, not at the buffer.

**Past the last grid beat, the click goes silent and stays silent.** Every song
reaches this. `is_running()` keeps reporting true, and `bar_phase` and
`current_bpm` freeze at their last in-grid values rather than snapping to zero.

This is the decision, not an oversight. A grid is a statement about a specific
song; past its end there is no measured tempo left to follow, and the two
alternatives are both worse — extrapolating the last interval invents a tempo
the song does not have and drifts audibly, while falling back to `bpm_` makes
the click jump to an unrelated tempo at a moment the user did not ask for. The
mirrors hold rather than zero so the UI does not flash a dead sweep and a 0 BPM
readout at the end of every song.

The consequence the UI owns: silence past the end is indistinguishable from a
stalled engine by listening alone. Whatever surfaces "the grid has run out" is a
UI affordance, not an engine behaviour change. `clear_grid` is how a caller
returns to a constant tempo, and it keeps the click's phase.

**JSI note.** `kb_engine_frames_rendered` and `start_at` take `uint64_t` frame
counts. At 48kHz a JS double's 53-bit mantissa is exact for ~5,900 years of
continuous rendering, so frames may cross as `double`. Do not introduce BigInt
for this. `kb_player_position`/`kb_player_frames` (`int64_t` frames) are exact
to the same bound. This is checked, not assumed — see §13.2.

#### 4.2.1 Grid mode: cursor, generation and bar numbering

Implementation rationale for `Metronome`'s grid state, recorded here because it
is the reasoning the code cannot restate in two lines.

**The grid crosses the app→RT seam by generation, not by address.** `RtPublisher`
swaps an atomic pointer to a node that carries its own generation counter, so one
acquire load in the callback yields both the value and its identity. Comparing
addresses would be wrong rather than merely fragile: a freed grid's address can be
recycled by the next allocation, a generation cannot. `observed_generation_` is
the generation the RT-owned cursor was last seeded against; when the published
generation differs, the cursor is re-seeded **from the click's current position**,
so a re-anchor moves only future beats and never revisits a beat that already
fired.

Generation zero means "seeded against nothing". `Start` and `Stop` both write it,
which is what forces the next block to re-seed rather than resume from a cursor
stranded where the pause began. Without that, a resume swallows every beat spanned
by the pause into a single off-grid click and skips the bar counter past the
downbeats it swallowed.

**The bar counter has two regimes, and the difference is deliberate.** At constant
tempo `current_bar_` is incremented at each downbeat and never derived by
division, so a mid-run time-signature change cannot jump ramp progress or bar-mute
phase. In grid mode it is instead *derived* from the grid's own beat index
(`grid_beat_index_ / beats_per_bar_`). Incrementing there would drift: a re-anchor
that moves the cursor backwards re-crosses downbeats, and an incrementing counter
would over-count, making the bar-mute cycle's phase depend on how many times the
user re-anchored. The grid's own numbering — not a count of downbeats observed —
is what a re-anchor must land on.

**`beat_position_` is kept live through grid mode.** Each grid beat re-anchors it
onto that beat, and it advances per sample between beats. That is the whole of
what makes `clear_grid`'s "keeps its phase" true: without it the value stays
frozen at its `Start` value all through grid mode, and the first sample after the
clear reads as a downbeat, firing immediately and shifting the bar.

### 4.3 New: downbeats

`beat_tracker.cpp` produces beats but not bar-ones. Bar alignment, count-in, and
"lock to bar 1" all need downbeats.

Either adopt QM-DSP `BarBeatTrack` (GPL — compatible, and the original researched
choice) or extend the existing tracker with downbeat estimation. Adopting QM-DSP
is preferred: it is the researched choice, and the hand-rolled substitute was
never a deliberate decision — see §4.6, it was planned and simply never vendored.

```c
/* Extends the existing analyse call. */
KB_EXPORT kb_result kb_analyze_song(const char* path,
                                    float* bpm_out,
                                    /* ... existing beat grid out ... */
                                    int32_t* downbeat_indices_out,
                                    int32_t* downbeat_count_out);
```

The beat grid BLOB schema gains a downbeat index list. Existing grids remain
valid (downbeats absent → treat every `beats_per_bar`-th beat as a downbeat,
degraded but usable) — no destructive migration.

#### 4.3.1 Why the tracker caps at `KB_MAX_GRID_BEATS`

`beat_tracker.cpp`'s `kMaxTrackedBeats` is deliberately *equal to*
`KB_MAX_GRID_BEATS`, not an independent number. A grid longer than that is one
`kb_metronome_set_grid` rejects outright (§13.7 — one definition, one owner), so
any surplus beat the tracker returned would be unusable by the only consumer.

Truncation must drop the **late** beats and keep the early ones. The DP
backtrack walks backward from the last beat, so a cap applied during the walk
keeps the *tail*: the returned grid's first entry then sits minutes into the
song and the whole beat map silently shifts off t=0. Beat times are absolute
seconds anchored to the start of the file; that anchor is the invariant.
`beat_tracker_verify` pins both halves of this.

### 4.4 Fix in place

- `mixer.cpp:68-71` — split `Stop()` (position → 0) from `Pause()` (holds).
  Expose both.
- Zero-pad tracks shorter than the longest rather than dropping them from the
  mix.
- Auto-stop must trigger on *end of longest track*, never on "all tracks
  currently silent" — muting everything must not end playback.

### 4.5 Invariants

- Audio callback: allocation-free, lock-free, no syscalls. Drains SPSC rings.
- Master clock = sample-frame counter, incremented only in the callback.
- Commands in via C calls; realtime data out via polled lock-free reads.
  **Never stream 60fps values through the app's reactive graph.** Under Flutter
  this meant "not through Riverpod". Under React it means "not through
  `useState`" — and the mechanism is §13.3, which is not optional.
- One engine per process. Tools attach to it; none opens its own. (The Flutter
  `stems_set_screen.dart:71` constructs a second `AudioEngine`; that pattern
  does not survive.)
- Cross-boundary constants have exactly one definition. No hand-mirroring
  between C++ and the app layer. §13.7 says how this is enforced in TS.
- Every exported symbol has a consumer. No speculative FFI, and no speculative
  TurboModule methods.

### 4.6 Native dependencies

What `native/audio_core` actually vendors and links, verified 2026-07-17. GPLv3
compatibility is the constraint; both current dependencies are permissive.

| Dependency | Licence | Role |
|---|---|---|
| **miniaudio** (`third_party/miniaudio.h`) | MIT-0 / public domain | Device I/O — AAudio on Android, PipeWire on Linux, CoreAudio on iOS. One API. Also supplies the Speex-derived resampler §4.1 needs. |
| **cycfi/q** (`third_party/cycfi_q/`) | **Boost Software License 1.0** | Pitch detection (`pitch_analyzer.cpp` uses `q::frequency`, `q::dB`). Header-only. |

Everything else is ours: the lookahead scheduler, the mixer, the radix-2 FFT
(`fft.cpp`), and the beat tracker.

**Planned but never vendored** — the original research chose all of these and none
were built. Do not assume they are present:

- **SoLoud** (mixer/playback). Not used; the mixer is ours.
- **QM-DSP `BarBeatTrack`** (beat + downbeat). Not used; `beat_tracker.cpp` is
  hand-rolled spectral-flux → autocorrelation → DP placement, which is why there
  are no downbeats (§2.5, §4.3).
- **dr_libs / stb_vorbis** (decoders). Not used; decoding goes through miniaudio.
- **BTrack**, **Signalsmith Stretch** — later-ring, out of scope (§3.3).

> The earlier research recorded cycfi/q as GPLv3. It is BSL-1.0 — permissive, so
> the error was harmless, but it is the kind of thing that should be read off the
> vendored `LICENSE` rather than a table. Attribution obligations still apply.

### 4.7 The latency clamp is a doc comment

`kitbag_api.h:63` documents `kb_metronome_set_latency_offset` as `[-100, 100]`
ms. **Nothing enforces it.** `kb_metronome_set_latency_offset` passes straight
through to `Metronome::SetLatencyOffset` (`metronome.cpp:90`), which pushes the
raw value onto the command queue. The clamp lives in two Dart constants and a
stale comment.

This matters because ±100 ms **cannot reach Bluetooth**, which routinely lands
150–250 ms late — the most common problem the control exists to solve. The bounds
are a decision, not an engine constraint, and they cost a line each.

**Decided (D5):** latency offset **±300 ms**; phase nudge **±½ beat**
(tempo-dependent); downbeat shift in beats. Three quantities, three constants, no
shared value. Update the doc comment to match — a stale comment that reads like a
constraint is how this became three bugs.

**Checked 2026-07-17 — there is no window, and the check found two live bugs,
now fixed.** `Metronome::Render` applies the offset as a per-sample phase bias,
`position = beat_position_ + latency_beats`, and evaluates the grid from the
biased position. Nothing is queued, so no queue depth bounds the offset, and the
±100 ms rejection is the clamp at `metronome.cpp` (`kSetLatencyOffset`) rather
than any structural limit.

The first measurement — click spacing exact to 0.000 frames at 60/120/240 BPM,
±300 ms, and 600 ms — was **true at constant tempo and scoped too narrowly to
support the conclusion it was used for** ("widen the clamp, the scheduler is
untouched"). It measured spacing between clicks that fired, at a fixed tempo.
Both bugs lived exactly in that blind spot, and both reproduced *inside* the
existing ±100 ms clamp. Both are now fixed and pinned by
`TestLatencyOffsetKeepsBeatZero` and `TestLatencyOffsetSurvivesRamp` in
`metronome_verify`:

- **Any positive offset swallowed beat 0 and its bar increment** — not just large
  ones. At frame 0 the biased position started already past the grid point, and
  nothing can fire before the transport's first sample, so at +0.5 ms the
  downbeat already vanished. **Fixed** by anchoring `position` (not
  `beat_position_`) at zero on Start: `beat_position_ = -LatencyBeats()`. This
  also fixes the semantics — a constant output-latency compensation is
  unobservable on a free-running metronome (the whole grid shifts, no beat moves
  relative to another), so the offset now correctly does nothing to a free run
  and earns its keep only against an external reference, which §4.2's phase anchor
  sets by writing `beat_position_` explicitly.
- **A tempo ramp and a latency offset corrupted each other.** `latency_beats`
  rescales with BPM, so a per-bar tempo step moved `position` sideways: ramping
  down re-crossed the grid point that just fired (double click, double
  `current_bar_` increment, corrupting `RampBpmForBar` and `BarIsMuted` with it),
  ramping up jumped the next. **Fixed** by routing every BPM change through
  `SetBpmPreservingPhase`, which shifts `beat_position_` by the change in
  `LatencyBeats()` so `position` stays continuous and only the rate changes.
- **Changing the offset mid-run had the same defect** — dragging the calibration
  slider during playback shifted `latency_beats` without moving `beat_position_`,
  so `position` stepped sideways and dropped or doubled a click (a downbeat also
  double-incrementing `current_bar_`). Found by the first fix's own reviewer:
  the machinery to prevent it existed and was not applied here. **Fixed** by the
  same phase-preservation in `kSetLatencyOffset` while running.
- **Under a grid the mid-run change has a bounded residue.** Grid mode reads the
  offset through `GridSeconds` rather than through `beat_position_`, so changing
  it shifts the song-time mapping without moving `grid_cursor_`. The one beat
  straddling the change can therefore land early or late by up to the clamp. It
  is bounded to that single beat: the next crossing re-seeds `grid_cursor_`
  against the new offset. Accepted, not fixed — the alternative is re-seeking the
  cursor from the callback on every offset change.

**The rule these three fixes share, and the decision that comes with it:** a
change to the offset *or* the tempo preserves `position` phase — it never steps
the grid sideways. A corollary is that **on a free-running metronome the latency
offset is audibly inert**: with no external reference, shifting the whole grid by
a constant moves no beat relative to another. The offset earns its keep only
against a reference, which §4.2's phase anchor supplies by writing
`beat_position_` explicitly. The sweep, the LED and the click all read the same
`position`, so they agree with each other; **how that shared time base maps to
real output latency is §4.2's call**, not settled here.

**What this means for D5.** The offset is a phase bias with no structural bound,
so the clamp is the only limiter and ±300 ms is a one-line change to it — plus
moving `kitbag_api.h:63`'s doc comment, which documents `[-100, 100]` as an engine
constraint when it is D5's decision. **The widening itself is deliberately not
done here:** it is a decision to land with the calibration screen that motivates
it (§12.8), and the regressions that now guard the interaction should be green
before and after it.

---

## 5. F1 — Metronome

The anchor tool. Design locked 2026-07-17 in `design/kitbag-metronome.html`,
which supersedes the metronome section of `design/kitbag-ui.html` and inherits
its tokens, components and experience rules unchanged.

**Principle (design §01):** the screen plays, the chips configure, the editor
remembers. Everything on the metronome screen is something you touch *while
playing*. Nothing else earns the space.

### 5.1 Engine — keep as-is

Tempo, time signature, subdivisions (1–16), per-beat 3-state accents
(accent/normal/muted), polyrhythm, 6 click sounds, volume, latency offset, tempo
ramp, bar muting. All implemented in C++ and correct. **The migration does not
touch any of it.**

### 5.2 Performance surface

Ported from the Flutter build, which got this right:

- **Swipe anywhere** — the whole screen is the tempo control. Vertical drag
  ±1 BPM per ~8dp, fling for coarse jumps. Chevrons plus a first-use hint
  animation teach it; the presets are the visible fallback (§12.6).
- **Preset steppers −10 / −5 / TAP / +5 / +10** in one thumb-height row.
- **Beat LEDs are the editor** — tap a beat to cycle accent → normal → mute.
  Ring = accent, filled = sounding now, dim = muted. No separate edit mode.
- **The LEDs are a row, and they group** (**D9**). The Flutter `BeatLedRow` draws
  a circle (evenly spaced at `i·2π/beatCount`) and has since v0.1, to save
  horizontal space — but grouping is a linear idea a circle cannot express, so 7/8
  grouping visually as 2+2+3 was never possible. The row wins.
  **Minimum 4 LEDs per row; rows wrap rather than shrinking below that**, so a
  16-beat bar is four rows of four rather than sixteen unreadable dots. That rule
  is what makes the row survive the space problem the circle was solving.
- **Polyrhythm as a second LED row**, smaller LEDs, own accent states.
- **Bar sweep** under the BPM: a thin progress ring per bar (anticipation), and
  the active LED flashes on the click (confirmation). Both — see §12.3.
- **Practice timer pill** under the app bar. Tap to reset; the `◴` transport
  button is its visible twin.

New:

- **Tap the number to type it.** Opens the numpad sheet. 20–400 BPM,
  out-of-range clamps on confirm rather than blocking the keypress. Taught by
  the same one-time hint mechanism as swipe-anywhere; no affordance chrome.
- **Every badge is a stepper** — `− 7/4 +`, `− 3:7 +`, `− ♪ +`. The Flutter
  build already wraps all three in `KitbagStepperRow.inline`; the original mock
  drew them as inert labels, which is why "how do I change the time signature?"
  had no answer on the page.
- **Subdivision reaches 1–16** through that same stepper, showing the engine's
  own glyph (`♩ ♪ ³ ♬`, then `×5`…`×16`). Poly stays a toggle segment beside it;
  its ratio is edited on the poly row's own stepper.

### 5.3 Four chips, four sheets

One row, no scroll — they wrap on narrow screens rather than scrolling, so
nothing hides. Each shows its current value when active (`⛰ 100→140`, `⏱ 1 bar`)
and its name when off. Each opens a sheet **over the running metronome**; every
value applies live, which is the entire reason they are sheets and not screens.

| Chip | Sheet |
|---|---|
| **⛰ Ramp** | From/To/Over steppers, bars·sec·min segment, loop-back-at-end. Changing tempo by hand cancels a running ramp and the chip clears with it. |
| **▨ Mute bars** | Play N / mute N steppers, an eight-bar preview. Silent bars still light the LEDs — you keep the visual, lose the click. |
| **♩ Sound** | Normal/Accent segment, then a 6-way picker. **Not a cycler** — the Flutter chip cycles, so reaching sound 6 takes 5 taps and you cannot see what you are choosing between. Per-accent-level sound assignment is in scope: a tom on one, a block on the rest. |
| **⏱ Count-in** | Off / 1 / 2 / 4 bars, distinct-or-same sound, per-song or always. Counts in on start only, never after a pause mid-bar. |

**Sound names come from the engine.** `soundNames` is indexed by native sound
id. Do not declare a local list — that is exactly how `sync_screen.dart:14` came
to mislabel every sound from index 2 up, and how the error propagated into a
design file. One list, one owner.

**Volume, latency offset and subdivision accents are not here.** They are rig
setup, not performance, and they live in Settings (§12.5). This is a locked
decision and it supersedes `kitbag-ui.html` §06's "Settings stay contextual".

### 5.4 Song presets

`design/kitbag-metronome.html` §02 draws the three screens the original spec
referenced but never drew: **setlists**, **setlist detail**, **preset editor**.

- **Songs exist outside setlists.** Today a song preset cannot exist without a
  parent setlist — the schema makes `Setlists` own `Songs`. That is backwards:
  you learn a song, then you put it in a set. Setlists reference songs; an
  "All songs" row is the standalone library.
- **The on-stage setlist is pinned and marked**, with a live count of what you
  have played. One setlist is active at a time.
- **Ramp and bar-mute are song data.** The Flutter `applyPreset` force-disables
  the ramp when loading a preset, so a song's trainer config is silently lost.
  They round-trip like any other field.
- **Per-field editing.** Today a preset can only be overwritten wholesale from
  live state. The editor makes every field individually editable, in three
  groups: identity (name, notes) · the music (tempo, signature, subdivision,
  accents, poly) · the rig for this song (sound, count-in, ramp, mute bars) —
  the last group being exactly the four chips, same concepts, same order.
- **Song notes** — free text ("Fingerstyle — count 3"), surfaced on the setlist
  row and on the metronome note strip when the song loads. Not on the
  performance surface; it earns no space there.
- **Duplicate** song and setlist. **Move song between setlists.** "Remove from
  set" and "delete preset" are different verbs now that songs outlive setlists,
  and the sheet must say which is which.
- **Accents render as the same LEDs** as the performance surface and tap-cycle
  identically. A component used twice, not two components.
- Reorder is drag-only on the handle, never long-press-drag: on stage a
  long-press must not become an accidental reorder.

> **Naming.** `Songs` (metronome presets) and `LibrarySongs` (audio files) are
> different tables with confusingly similar names. Rename to `SongPresets` and
> `Songs` respectively, and reflect it in `CONTEXT.md`.

### 5.5 Export / import

Works today (JSON v3). Required changes — and §12.4 raises the format to **v4
with UUIDs**, because merge is unimplementable without stable identity:

- **Version and validate on import.** Validate the whole file, then apply, then
  report. Today anything outside v1–3 throws a `FormatException` into a
  snackbar *after partial writes*. Unknown version refuses cleanly: "Made with a
  newer Kitbag (v5). Update to restore this."
- **Selective import**, per category.
- **Merge vs replace** — explicit choice, never a silent overwrite. Merge is the
  default because it is the reversible one; replace takes a typed confirm.
- **Round-trip `setlistId`/`songsPlayed`** once §5.7 writes them.
- **Stop writing to `/storage/emulated/0/Download`.** Use the system share sheet
  / document picker. The hardcoded path is Android-specific and fails under
  scoped storage.
- **Export split** (confirmed): single-setlist export lives in the setlists
  overflow — the thing you export is a setlist. Whole-library backup lives in
  Settings — the thing you back up is everything.

### 5.6 Background operation

Built but dead in Flutter, and the harder half was never attempted. **This is
the single most RN-specific piece of §5** — see §13.9.

- **Foreground service.** The metronome must survive backgrounding and screen
  lock. This is the actual requirement; the notification is its face. A
  notification without a service just gets killed alongside the click.
- **Notification transport** — play/pause, stop, current BPM and signature, then
  the set and song. Not "Kitbag is running". Prev/Next **only** with an active
  setlist — no dead controls.
- **Ongoing and non-dismissible while running**, which is what a foreground
  service requires and what a musician wants: it is the off switch when the
  phone is in a pocket.
- **Lock-screen controls** via the platform media session; responds to headset
  buttons.
- **Practice timer continues** while backgrounded. A session interrupted by a
  phone call is still a session.

### 5.7 Practice

- Write `setlistId` and `songsPlayed` — the Flutter producer never does despite
  having an active session.
- **Practice-end summary** on stop (not on every pause): time, set, songs,
  average tempo, longest stretch. Save or discard. Sessions are currently
  written silently and never shown — the peak-end rule (§12.6).

### 5.8 Acceptance

- 4h soak: zero dropped or jittered clicks. Measured by recording output and
  computing inter-click intervals — **no such harness exists today and one is
  required.**
- Tempo change mid-bar is glitch-free.
- Metronome runs ≥30 min backgrounded with the screen off, click unbroken,
  notification controls functional. **Verify with the JS thread deliberately
  starved** (§13.9) — under RN this is the failure mode that a foreground
  service alone does not prove absent.
- A song preset round-trips every field including ramp and bar-mute.
- Export → wipe → import restores all state. Import twice does not duplicate.

---

## 6. F2 — Song playback

### 6.1 Move playback onto the native engine

**`just_audio` is removed and nothing replaces it.** `kb_player_*` (§4.1) is the
replacement. This is the central change: song and click stop being two clocks
and become one.

**Do not substitute `react-native-track-player` or `expo-av`.** They are the
same architecture as `just_audio` — a second engine with its own clock — and
they would recreate the exact defect §4.1 exists to remove. The click and the
song must share `kb_engine_frames_rendered` or phase lock is a `Timer` hack
again, in a new language.

Consequences that fall out for free:
- Phase lock becomes real.
- Latency compensation becomes possible — currently the offset defaults to 0,
  `setLatencyOffset` has no callers, and there is no way to measure
  `just_audio`'s output latency across the boundary anyway.
- `beat_sync_service.dart` is not ported. Its drift-correction (which misfires
  on nearly every callback under 600 BPM) and its per-beat `_metronome.start()`
  both stop existing rather than getting fixed.

### 6.2 Import + analysis

Import → copy → index → background analysis → BPM + grid + `.kwav`. Real and
working. Changes:

- **Store relative paths.** Flutter stores absolute, contradicting its own doc.
  Breaks on iOS, where the container UUID changes per launch. Paths are relative
  to their base directory, always.
- **Downbeats** into the grid (§4.3).
- **Re-analyse** action for a song.
- Analysis stays ambient — background, badge-driven, no "analyze" button. The
  row appears instantly with `ANALYZING…` and lands on `GRID ✓` in ~10–30s. The
  user never waits on a spinner screen.
- The Dart isolate becomes a native background task, **not** a JS worker —
  see §13.5.

### 6.3 Player

- Waveform with beat-grid ticks; tall ticks on downbeats — the analysis made
  visible.
- **Fix tap-to-seek.** Flutter measures the Scaffold's width, not the
  waveform's, so seek is off by the horizontal padding. Measure the waveform.
- **`.kwav` load off the UI thread.** Flutter does synchronous file I/O in
  `waveform_painter.dart:53`.
- Optional beat-snapped scrub.
- **A-B loop**, beat-snapped, equal-power crossfade 5–20ms.
- Speed control positioned in the transport but inert until the time-stretch
  plugin. Position it now, wire it later.
- **Mini-player** — collapses to a docked bar (title, play/pause) above the home
  hub when leaving the screen, so the click keeps running while you open the
  tuner or edit a setlist.

### 6.4 Metronome lock

- Lock via `kb_metronome_set_grid` (§4.2) — follows per-beat spacing, so
  non-constant tempo works.
- Latency-compensated: click and track land together at the speaker.
- Count-in before the lock engages.
- **The metronome is not a singleton to borrow.** Play-along and the player get
  their own metronome state, or the shell saves and restores. See §8.9 — this is
  one open question, not two.

### 6.5 Acceptance

- Click audibly on-beat across 20 diverse songs including non-constant tempo,
  for full track duration.
- Verified by measurement (recorded output, click-vs-grid offset), not by ear.
- Seek/pause/resume preserves lock.

---

## 7. F3 — Stem player

StemDeck-class. Currently a shell with no audio path (§2.2). **Not a port — a
first implementation**, gated on §4.1.

### 7.1 Load

- **Folder import.** Flutter uses a multi-*file* picker with the folder name
  reverse-engineered from the first file's parent and `/` hardcoded as
  separator. Use a real directory picker.
- Name matcher (vocals/drums/bass/guitar/piano/keys/other) works — but collapses
  piano and keys into one role. Split them — they are different instruments and the
  original research specced them separately.
- **Resample on ingest** to the engine rate (§4.1). Today non-48kHz stems are
  silently skipped and the set plays as silence.
- Inline rename; generic icon fallback.
- Tracks load via `kb_mixer_load_track` — no PCM in the app layer.

### 7.2 Mix

- One row per stem: name, inline waveform, M/S. Tap the waveform area to expand
  the row into a volume slider.
- Per-track volume, mute, solo — wired to native and *audible*.
- **Exclusive solo by default**, long-press for additive. Flutter's `toggleSolo`
  is per-row with no exclusivity.
- **Master gain.** The mixer has none.
- Gain range: reconsider linear 0.0–2.0 (`mixer.h:18-19`). dB with a taper is
  the mixer convention.
- **Debounce DB writes.** Flutter's `updateGain` fires per pointer event — a
  database write per slider frame.
- **Fix the gain slider default.** It renders 0.0 because `getGain` returns 0.0
  for unloaded tracks; loaded tracks must report 1.0.
- Rows stay ≥48dp; nothing modal mid-song; no hidden swipe-mixer.

### 7.3 Transport

- **Real pause.** `Stop()` resets position to 0 and the pause button calls it —
  pause currently rewinds. Split via §4.4.
- **Seek UI.** `Mixer::Seek` and `MixerController.seek` exist; no screen ever
  calls them. There is no scrubber.
- Fix the position display — Flutter formats frames as ms against a hardcoded
  48000.
- **A-B loop**, beat-snapped, equal-power crossfade.
- **Per-stem waveforms.** Absent. The waveform renderer is shared UI (§13.1) —
  it does not live in the library tool.
- Metronome joins the stem mix on the same grid.

### 7.4 Track count

16 (`kMaxTracks`) is adequate and is a stated product limit, surfaced in the UI
when exceeded rather than silently truncating.

### 7.5 Acceptance

- A 6-stem 44.1kHz set plays, sample-locked, through seek/loop/solo/mute for the
  full track.
- Muting every track does not stop playback.
- Unequal-length stems stay aligned to the end of the longest.
- Loading a track during playback does not glitch or crash (the current race is
  invisible only because no audio reaches it).

---

## 8. F4 — Play along

User-facing name: **Play along**. Engineering name: media sync. The package is
`tool_sync`. The Flutter AppBar says "Media Sync"; the tile and the design spec
say Play along.

The feature with the largest gap. Of the eleven things the original milestone
claimed it would do, **three were done, two partial, six missing — and neither of
its two acceptance proofs was achievable.** Design locked in
`design/kitbag-playalong.html`.

**Principle:** tempo is known; phase is the feature. A BPM is a number anyone
can look up. The downbeat is the thing only you know.

### 8.1 Metadata, never audio

Metadata, position, and transport — **never audio capture**. True by
architecture, and the Play-policy justification. Non-negotiable.

### 8.2 Sources

- **Android: `MediaSessionManager`** via `NotificationListenerService`. Primary.
  Works with Spotify, YT Music, anything with a session.
- **iOS: Spotify App Remote SDK** (Apache-2.0). iOS has no cross-app session
  API, so sync is Spotify-only there. **Stated plainly in the UI** rather than
  papered over — the user's Apple Music will never appear and should be told
  why, not left as an apparent bug.
- The source is an abstraction with two implementations; feature logic depends on
  the abstraction, not on either.

### 8.3 Detection

- **Fix the cast first.** `media_session_service.dart:44` throws on every poll
  and the screen shows "No media detected" unconditionally on device. **Nothing
  downstream is hand-testable until this lands** — including whether the
  metadata Spotify actually emits matches what the mocks assume. In the RN port
  this is the TurboModule's return shape; get a real device reading before
  building anything on top of it.
- **Push, don't poll.** The Kotlin builds an `eventChannel` and never calls
  `setStreamHandler`, forcing a 2s poll. A 2s poll cannot see a skip in time to
  react to it. The TurboModule emits events.
- **Multiple sessions** — the source chip names the app and carries a live dot;
  it opens a picker when more than one session is live. Playing sessions sort
  first. Podcast and audiobook apps are listed but not picked by default —
  `packageName` already comes across the channel and is read by nothing. Today
  Dart takes `sessions.first` and never says which app won.
- **Transport controls.** `MediaController.transportControls` is imported and
  never touched. ⏮ ⏸ ⏭ drive the *song*; there is no click transport, because
  lock is the click's switch.
- **Real permission flow.** Must open `ACTION_NOTIFICATION_LISTENER_SETTINGS`
  and verify on resume via `NotificationManagerCompat.getEnabledListenerPackages`.
  Today `requestPermission` returns `success(true)` unconditionally. **The Kotlin
  comment names the wrong permission** (`POST_NOTIFICATIONS`); this is
  notification *listener* access, a different toggle on a different screen that
  Android deliberately buries. Delete the comment in the port — whoever builds
  this will read it.

### 8.4 Position

None of this exists; the source data never leaves Kotlin.

- Kotlin must send `PlaybackState.getLastPositionUpdateTime()` and
  `getPlaybackSpeed()` — it currently reads raw `position` only, and the
  extrapolation needs both.
- Extrapolate `pos + (now - lastUpdate) * speed`.
- Re-anchor every 1–2s via `kb_metronome_anchor_external` (§4.2).

### 8.5 BPM ladder

**The ladder is Deezer → library beat grid → tap**, plus GetSongBPM if the user
supplied their own key (**D7**). Source always shown, always overridable, never
authoritative. The card says "via Deezer · tap to change"; when the ladder fails
it names **every rung that was tried** ("Not found · Deezer"), because saying
which rungs were climbed is what stops the user retrying the same thing.

- **Match scoring.** Deezer's lookup returns the first result with nonzero BPM
  despite a comment claiming similarity matching. Score title+artist; reject
  below threshold rather than returning a wrong-song BPM.
- **GetSongBPM is opt-in** (**D7**). A Settings row takes a personal key. No
  proxy — that is a server, a cost, a privacy surface and a single point of
  failure an offline-first GPL app should not acquire. **Never ship a shared key
  in a public repo.** Attribution obligations apply in-app and in the store
  listing whenever the tier is used. Recorded honestly: almost nobody will supply
  a key, so in practice the ladder is the three rungs above.
- **The offline dump is dropped** (**D8**). Delete the AcousticBrainz stub that
  returns `null` and the source it advertises at `bpm_lookup_service.dart:21`. The
  bundled 2022 dump the original research specced is not shipped and not
  downloaded.
- **The library beat grid is a real rung, and the best one.** A matched analysed
  song gives per-beat spacing, not a single number — the only rung that handles
  non-constant tempo (§8.6).
- **Cache.** None exists; every track change re-hits Deezer. Cache by
  (title, artist) with a TTL.
- **Tap tempo**, fixed: taps are counted on screen (four LEDs, filling), because
  `tap()` returns nothing until the fourth and gives no sign the first three
  landed — the button looks broken for three taps and then works. And it
  **averages intervals, not BPM values**: BPM is reciprocal to interval, and the
  mean of reciprocals is not the reciprocal of the mean, so averaging BPMs biases
  the result high.
- **Manual entry** via the metronome's numpad sheet, reached the same way (tap
  the readout), plus **÷2 and ×2** — half- and double-time is the specific way
  BPM databases are wrong, and a wrong 85.5 for a 171 track is a lookup that
  "worked". **The 380-division slider is deleted**; dragging to a known integer
  is a fight the numpad wins.

### 8.6 Phase lock — the actual feature

- **Tap-to-align.** One tap on a downbeat locks the click. Today's "Tap" is
  tap-*tempo*, a different thing. Implemented via `kb_metronome_anchor_external`.
  The tap pad is the biggest thing on the screen.
- **Auto-lock is offered, not taken.** When the playing track matches an analysed
  library song, a card appears with a `Lock` button — **one tap, not zero.** The
  original flow promised zero taps; a tool that starts clicking at you unasked is
  a tool you stop trusting. It feeds the stored per-beat grid to
  `kb_metronome_set_grid`, so non-constant tempo works — which no BPM number can
  do. This is ~90% built and unused: `sync_screen.dart:63` confirms
  `match.beatGrid != null`, then `:64` uses only `match.bpm` and discards the
  grid one line later.
- **Fix the match.** `library_songs_dao.dart:43-49` is unescaped
  `LIKE '%title%'`. Normalise, escape, handle feat.-tags and punctuation.
- **Meter comes from your preset, else 4/4.** A matched library song carries a
  time signature; use it, and name it on the card ("4/4 from your preset") so the
  number is never a mystery. No match → 4/4 and a stepper.
- **Lock is the click's power switch.** There are two transports here — the
  song's and the click's — and merging them is the point. Locked means the click
  follows the song: it plays when the song plays, stops when it stops. Pause
  Spotify and the click stops mid-bar; resume and it comes back on the beat,
  because the anchor is a position, not a stopwatch. **This is the whole
  difference between a lock and `setTempo(); start();`.**
- **Drift meter** replaces the tap pad once locked — same slot, same weight. The
  question changes from "where's the downbeat" to "is it still right". Quiet
  inside ±10 ms; outside, the card ambers, the needle ambers, and `↺ Re-tap`
  grows back into a pad. Colour is never the only signal: the needle moves, the
  number changes, the badge text changes. "Locked · 1:12 ago" is the trust
  signal that matters.
- **Nudge writes the anchor, not a label.** `phaseOffsetMsProvider` is read today
  only by the text next to it.
- **Phase has a step size**, `1 · 10 · 50` ms — 1 ms is nulling the click against
  a snare, 50 ms is catching up with Bluetooth. One granularity cannot do both:
  ±10 ms alone is forty taps to cross a Bluetooth delay, or too coarse to sit on
  the beat.
- **Phase range is ±half a beat** (**D5**), not ±100 ms. Phase is modular — a
  whole beat of offset is no offset. Half a beat is ±175 ms at 171 BPM and ±500 ms
  at 60, so `sync_screen.dart:365`'s `clamp(-100, 100)` is the wrong *shape* of
  limit, not just the wrong number. It does not share a constant with the latency
  offset: different quantities that happen to be measured in ms.
- **The sheet shows the total** (**D6**): `+190 ms total · 180 route + 10 song`.
  Route calibration (§12.5) and the per-song nudge add up, and nothing displayed
  the sum. At ±300 ms latency the total stops being intuitive, so one trustworthy
  number with both parts named is worth the line.
- **Downbeat shift** — `‹ beat 1 ›`. Tap on three instead of one and you are out
  by beats, not milliseconds; no ms control fixes that, and it is the more common
  mistake.

### 8.7 The pattern card is the metronome's

Same `− 4/4 +` stepper, same LEDs with the same tap-cycle, same subdivision
stepper, same sound chip opening the same picker. **Play along is a metronome
that follows a song; it should not be a second dialect for saying so.** The
Flutter build's time signature, subdivision and volume controls are hardcoded
(`value: 4`, `value: 1`, `value: 1.0`) with no backing state — they call the
metronome and then snap back on release. They get real state by becoming the
metronome's own components.

### 8.8 Save for this song

Writes a `SongPreset` — the same object the metronome's editor edits — matched to
the track on next play: meter, subdivision, accents, sound, and the phase nudge.
Tempo is deliberately **not** saved: it comes from the grid or the lookup, and a
stale number is worse than none. Play along stops being a thing you re-dial every
time.

### 8.9 Its own metronome

Play along holds a metronome instance of its own. Opening it never moves your
standalone tempo; closing it never leaves a mess to restore.

**What "its own" means natively is open** (§15). The C core's metronome is a
singleton (`kb_metronome_*`, no handle parameter), so an instance is either a
second engine object — a real API change with a real cost — or a state stack in
the app layer that saves and restores around the borrow. The design cannot tell
these apart; **the acceptance criterion can:** opening Play along and closing it
must leave the standalone metronome exactly as it was, including mid-run.

### 8.10 States

The mock drew a happy path. On this feature the rest are not edge cases — a phone
playing Spotify is a phone that rings, skips, buffers and serves ads.

| State | Behaviour |
|---|---|
| **Drifting** | Lock held, anchor stale. Does not silently unlock — a slightly-off click you can fix beats a click that vanished. One tap restores it. |
| **Track changed** | Unlocks. New BPM looks up. Saved preset recalls if there is one. Never carries the old lock into a new song — that is a wrong click delivered with confidence. |
| **Paused / seeked** | Click stops, lock badge stays, resumes on the beat. **Seeking backwards is the test that proves the implementation is real.** |
| **Several apps playing** | Source chip shows a count, opens the picker. |
| **Source went away** | Card greys, keeps last title, lock holds 10s, then drops. A short grace covers app switches and buffering. |
| **iOS** | Spotify connect card; other apps named as unsupported. |
| **Permission denied** | No session card; tap pad and full pattern controls. Degrades to a metronome with tap tempo. Everything not needing the grant still works, and the explainer stays one tap away rather than nagging. |

**There is no ad state** (**D10**). `kitbag-playalong.html` §04 draws one; it is
cut. Spotify does not flag ads, and every available heuristic (duration <35 s,
empty artist, title changing without a skip) would occasionally mute a real short
track — interludes and intros are music. The click keeps its lock through the ad,
is wrong for 30 s, and is right again after. Free-tier users are most users, and a
temporarily-wrong click you can see is wrong beats a tool that silently mutes your
practice on a guess.

### 8.11 Acceptance

- Click stays on-beat with Spotify over a 3-minute song after one tap.
- Auto-lock works after one tap for a track matching an analysed song.
- Permission denial degrades to tap-tempo — never a dead end.
- Survives Bluetooth latency and pause/resume/skip.

---

## 9. F5 — Plugin extensibility

### 9.1 Contract

A tool declares: `id` · `name` · `icon` · `routes` · home tile · optional
audio-node factory · settings schema · optional lazy asset spec. The shell
aggregates and mounts them.

The Flutter `ToolPlugin` (`core_plugin_api`) is a sound shape and it survives the
framework change **as an interface** — which is the point of having had it. In TS:

```ts
export interface ToolPlugin {
  readonly id: string;
  readonly name: string;
  readonly icon: IconName;
  readonly routes: readonly RouteDescriptor[];
  readonly homeTile: HomeTileDescriptor;
  readonly settingsSchema?: SettingsSchema;
  readonly assets?: LazyAssetSpec;
}
```

`core-plugin-api` depends on nothing but types. No React import, no store import,
no native import. If it needs one, the contract is wrong.

### 9.2 One registry

The Flutter build has two: a hardcoded list of five plugins, and a generated
manifest that knows two and is consumed by nothing. Tools are a fixed
compile-time set, so **the explicit list wins.** Do not port the generator, and
do not write a new one.

### 9.3 Tools manager

Every tool lists its true size; heavy plugins download on demand from CDN with
checksum verification; upcoming tools visible as `SOON` linking to the GitHub
issue. **"Get", never "Buy"** — everything is free forever, and the verb is the
brand.

Resolved (settings design §03): the Tools manager is the one screen that owns
tool toggles, reached from Settings by a single row. The Flutter
`settings_screen.dart` grew its own per-tool toggle list that nobody had
reconciled with the designed screen; that list leaves Settings. **ON/OFF badges
become switches** — the original drew `ON` as a static badge beside `Get`
buttons, which is two visual languages for one column and a badge that looks like
a label but was meant to be tapped. Off tools leave the home screen; nothing is
deleted.

The toggle is `tool_enabled_<id>` in preferences and already drives the filtered
plugin list. **Moving the UI does not move the state** — that row costs a screen,
not a refactor.

No Play Asset Delivery (breaks F-Droid reproducible builds). No public plugin SDK
yet — first-party plugins against an internal interface.

### 9.4 Boundaries — enforce

These hold whatever the stack, and the lint layer enforces them (§13.6):

- Native bindings live in exactly one package.
- The abstract contract package imports neither the shell nor any tool.
- Concrete state/DI lives in one package.
- Nothing enters the core that a plugin can carry.

---

## 10. F6 — Tuner (deferred)

Built in Flutter (1,953 LOC) and deferred by decision. **Do not port it as-is.**
The migration changes nothing here: the problem is in the capture path and the
DSP, both native.

### 10.1 Research required first

Mic pickup is unreliable when tuning a guitar in practice. This is the blocking
problem and it is not a UI issue.

> **Measured 2026-07-17, and it reorders this list.** `tuner_verify` fails
> **37 of 37 checks**. It bypasses the C API and the mic entirely — it includes
> `pitch_analyzer.h` and drives `PitchAnalyzer` directly with synthesized tones —
> and on a clean sine at every frequency from 82.41 Hz to 1 kHz it reports
> `0.000 Hz`, `confidence 0.00`. Silence and a pure 440 Hz tone are
> indistinguishable to it.
>
> **The harness is not stale**: its constructor call, `Process(float) → bool`
> loop and `reading()` access all match `pitch_analyzer.h` as it stands, and it
> compiles and links clean.
>
> **This means the capture path is probably not the cause.** The DSP does not
> detect a pitch that was handed to it directly, with no microphone, no AGC and
> no noise gate anywhere in the path. A mic problem cannot explain a synthetic
> sine reading as silence.
>
> Nothing ran this: the old CI built the verify tools and never executed them, so
> it has likely been failing unnoticed for a long time. It is now an
> informational CI step (`|| true`) and **becomes a gate when this research
> lands.**

Investigate, in this order:

- **`pitch_analyzer.cpp` and `fft.cpp` first.** Make `tuner_verify` pass on
  synthetic tones before touching anything device-side. It is a closed loop with
  no hardware in it, it runs in a second, and it is currently the cheapest signal
  in the project. **Everything below is unfalsifiable until it is green.**
- **Capture path.** The capture research specifies `UNPROCESSED` (fallback
  `VOICE_RECOGNITION`) with AGC/NS/AEC never attached, a ~30ms analysis window
  (~90ms for bass B0) at 50% overlap, and a median filter of 3–5 frames plus EMA
  on cents settling under 150ms. Verify what the app actually requests and what
  the device grants. **Previously this section's leading hypothesis; demoted by
  the measurement above** — it may still be *a* problem, but it cannot be *the*
  problem.
- **Noise gate.** An adaptive gate squelches before detection; if its floor is
  misjudged it eats quiet strings.
- **Window size** vs low-frequency response — ~30ms specced, ~90ms needed for
  bass B0.
- **Detection band.** Constraining to the preset's per-string band is the
  octave-error fix; confirm it is applied. (`kb_tuner_set_band` exists.)
- **Benchmark against GuitarTuna** on the same device and instrument. It is the
  UX bar.

Treat the current implementation as a prototype that identified the problem, not
as a base to build on.

### 10.2 Behaviour (when built)

- Chromatic + instrument presets; auto string detection; A4 415–466Hz.
- **Hold detected notes longer** — calibrate to GuitarTuna's feel.
- **Reset on re-entry.** The in-tune green state currently persists after leaving
  and returning.
- **Custom tunings** — user-defined note lists (Drop D, DADGAD), saved.
  `TuningsDao` exists (one MIDI note per string, low first); the editor and preset
  picker do not.
- Match the design mock exactly: string pegs row (tap to lock a string, green
  ring = in tune, amber glow = detected), giant note readout, graduated red→green
  strip with a fixed centre line, Auto/A4/Chromatic chips. The built tuner does
  not.
- **Needle position carries the signal; colour reinforces.** GuitarTuna users
  revolted when a redesign removed the graduated strip with a centre line; we keep
  it. Position + "TUNE UP ↑" text + colour = three redundant channels,
  colourblind-safe (§12.6).
- In-tune lock: needle snaps to centre, peg ring turns green, one confirmation
  haptic tick. **No sound** — you are listening to the string.
- Median filter (3–5 frames) + EMA on cents; settle <150ms.

### 10.3 Acceptance

- ±1 cent vs reference tones 82Hz–1kHz.
- Reliably picks up a normally-plucked guitar string at conversational distance —
  the bar the current build misses.
- Bass B0 settles acceptably.

---

## 11. Data model

The schema is the durable part and survives the stack change. Current tables:
`Setlists`, `Songs`, `PracticeSessions`, `Tunings`, `LibrarySongs`, `StemSets`,
`Stems` (schema v6).

### 11.1 Persistence layer

| Flutter | React Native |
|---|---|
| Drift | **Drizzle ORM** over **op-sqlite** |

`op-sqlite` is JSI-backed, so queries do not cross the legacy bridge. Drizzle
gives compile-time-checked SQL and generated migrations, which is the property
Drift was providing. **Migrations are additive and non-destructive; existing user
data survives** — a user upgrading from the Flutter build must not lose their
setlists, so the migration runner must pick up an existing v6 database in place
rather than starting from zero.

### 11.2 Changes required

| Change | Reason |
|---|---|
| `Songs` → `SongPresets`; `LibrarySongs` → `Songs` | §5.4 — the names invert their meaning today |
| `SongPresets`: + ramp config, bar-mute config, count-in, notes, per-accent sounds | §5.3, §5.4 |
| `SongPresets`: + time signature **denominator** | **D1** — new column; 2/4/8/16 |
| `SongPresets`: **drop `volume` and `latencyOffset`** | **D3** — both are global rig setup; the columns are unreadable-vs-default today |
| `SongPresets`: decouple from `Setlists` | §5.4 — songs must exist standalone; setlists reference |
| `SongPresets`: + phase nudge, + track identity tuple | §8.8, **D4** — `(title, artist, source, length)`, nullable library-song FK when known |
| `Songs`(library): + downbeat indices | §4.3 |
| **All paths relative** to the base directory | §2.3 (iOS) and **D11** (the directory is now user-movable) |
| `PracticeSessions`: write `setlistId`, `songsPlayed` | §5.7 — columns exist, producer never fills them |
| BPM cache table | §8.5 |
| Per-output-route latency calibration | §12.5 |
| Global subdivision-accent patterns, keyed by subdivision count | **D2** |
| UUIDs on exportable rows | §12.4 — merge needs stable identity. Backfilled on migration; **D12** accepts the first-merge duplicate. |

Beat grids stay Float32 BLOBs of per-beat timestamps (handles tempo drift).
Waveform peaks stay `.kwav` binary sidecars. Neither crosses into JS as a buffer
during playback — the grid goes to `kb_metronome_set_grid` and the peaks go to
the renderer, once, off the UI thread.

### 11.3 Unblocked

All three decisions this schema was waiting on landed 2026-07-17: **D1**
(denominator column), **D2** (global subdivision accents, so no per-song table),
**D3** (drop `volume`/`latencyOffset`), **D4** (track identity tuple). §11.2 is
buildable as written.

Two migration notes that are not obvious from the table:

- **The v6 Drift database must be picked up in place** (§11.1). An upgrading user
  keeps their setlists; the Drizzle migration runner starts from v6, not from zero.
- **`SongPresets` gains a nullable FK to the library song** alongside the D4
  identity tuple. When a track later joins the library, the preset migrates from
  tuple-matching to id-matching. That transition is a migration, not a lookup.

---

## 12. Design

`design/` holds four files. All are binding, and their precedence is explicit:

| File | Scope |
|---|---|
| `kitbag-ui.html` | **The foundation.** Tokens, components, the 9-screen survey, key flows, and §06 experience rules. Everything below inherits from it. |
| `kitbag-metronome.html` | Supersedes the metronome section of `kitbag-ui.html`. Adds setlists, setlist detail, preset editor, four sheets, the numpad, practice summary, notification/lock screen. |
| `kitbag-playalong.html` | Supersedes the Play-along section. Adds the locked state, seven more states, five sheets, and a code audit. |
| `kitbag-settings.html` | Designs Settings, latency calibration, restore. **Supersedes exactly one §06 card** — "Settings stay contextual" — and nothing else. |

### 12.1 Principles (kitbag-ui §01)

- **Stage-first, both themes.** Dark is primary (near-black, not pure black —
  three elevation tiers so panels don't vanish). Light is a full first-class theme
  for daylight practice, warm paper-toned so it doesn't glare.
- **Glanceable at arm's-length ×3.** Primary readouts (BPM, note, cents) target
  7:1 contrast and display sizes readable from a music stand 1–2m away.
- **Playable with one thumb.** Transport and tap targets in the bottom half.
  Anything you touch mid-practice is ≥48dp. Precision edits (accents, loop points)
  allowed higher up.
- **Colour is never load-bearing.** ~8% of men are red-green colourblind; the
  needle alone must suffice.
- **Tools, not menus.** Each tool opens straight into its working screen. No
  dashboards to cross, no locked features, no upsells — ever.

### 12.2 Tokens

Dark is primary. Both palettes are complete and both must ship — `app.dart:20`
hardcodes `ThemeMode.system`, so **the light palette has never been reachable in
the Flutter build.** The React theme layer must expose System/Dark/Light from day
one (§12.5).

| Token | Dark ("Stage") | Light ("Daylight") |
|---|---|---|
| `bg` | `#0E0D10` | `#F5F3EE` |
| `surface1` | `#1A1820` | `#FFFFFF` |
| `surface2` | `#242230` | `#ECE9E1` |
| `surface3` | `#2E2C3A` | `#E3DFD4` |
| `line` | `#33303F` | `#DCD7CA` |
| `text` | `#ECEAF0` | `#221F26` |
| `text2` | `#9B97A8` | `#6E687A` |
| `text3` | `#6C6878` | `#98929F` |
| `accent` | `#FFB347` | `#B26F0E` |
| `accentDeep` | `#E89B2E` | `#8F5A0C` |
| `accentDim` | `#8A6A35` | `#D8B27C` |
| `onAccent` | `#221600` | `#FFF7EA` |
| `red` (flat) | `#FF5C5C` | `#CC4444` |
| `amber` | `#FFC24B` | `#9A6E06` |
| `green` (in-tune) | `#4ADE80` | `#1E8A4F` |
| `wave` | `#4E4A5E` | `#C9C3B4` |
| `waveHot` | `#FFB347` | `#B26F0E` |

Rules that come with them:

- **One brass-amber accent** — a musician's material (cymbals, horns, tube glow)
  — reserved for *active/on-beat* states. Semantic red/amber/green is a separate
  channel and **never doubles as accent.**
- Dark text is off-white; **pure white halates on OLED.**
- **Elevation = lighter surface, not shadow.**
- Light's accent darkens to keep 4.5:1+ on white surfaces.

**Type.** Two faces, both OFL. **Space Grotesk** for display, numerics and labels
— geometric, instrument-panel character, and **true tabular figures so a BPM
readout never wobbles as digits change.** **Inter** for body/UI text.

| Role | Spec |
|---|---|
| Display / BPM | Space Grotesk 700 · 64 · tabular |
| Headline | Space Grotesk 500 · 22 |
| Body | Inter 400 · 15 |
| Label | Space Grotesk 500 · 12 · +18% tracking · uppercase |

Tabular figures are not decorative — they are the reason the swipe gesture is
readable while it runs. In RN: bundle the fonts and set
`fontVariant: ['tabular-nums']` on every numeric readout.

**Radii**: cards 16, tiles 16, chips 99 (pill), buttons 12, sheets 20/20/14/14,
LEDs 50%. **Shadow**: `0 8px 32px rgba(0,0,0,.45)` dark / `0 8px 28px
rgba(60,50,20,.14)` light — used on sheets and the play button only.

### 12.3 Motion

- **Anticipate, then confirm.** Beat visuals combine a continuous cue you can
  predict (radial sweep / breathing scale) with a sharp flash exactly on the
  beat. Flash only = no lead-in; sweep only = mushy. **Both.**
- **The beat signal survives reduced-motion.** With `disableAnimations`,
  decorative motion goes; the on-beat cue degrades to a static colour swap — it
  is functional, not decorative. Honour `AccessibilityInfo.isReduceMotionEnabled`.
- **Springs on touch, nothing on a timer.** M3 Expressive spring physics on
  presses and sheets. **No ambient animation competing with the beat** — the
  metronome owns rhythm on screen.

### 12.4 Screens

`kitbag-ui.html` §04 draws nine: Home, Metronome, Tuner, Library, Player, Stem
player, Play-along, Permission explainer, Tools manager. The three later files add
Setlists, Setlist detail, Preset editor, Settings, Latency calibration, Restore.

**Home** is a hub, not a dashboard.

- **Continue card** resumes the last tool **with its exact state** — the fastest
  path to what you were doing dominates the top. The Flutter build has a hardcoded
  "Pick up where you left off" subtitle and a card that navigates to `basePath`
  without resuming anything. It must track the last-used tool for real.
- **2×2 tool tiles with live subtext** (current BPM, tuning, library count). The
  built version has none.
- **No bottom-nav**: it caps at ~5 destinations and Kitbag will outgrow it; a hub
  scales with the plugin roster.
- **Customizable layout**: sensible fixed order by default; long-press any tile
  for edit mode — reorder, resize (1×1 ↔ 2×1), pin/hide. Same mechanic as
  launcher home screens, so zero learning cost. Not built.
- Muted upcoming tools visibly present — the extensibility story is part of the UI.

**Restore** (settings design §03) is the screen with a precondition:

- **Merge needs identity, and v3 has none.** The export stores names, not ids, and
  `importData` calls `create` unconditionally — restore your own backup twice and
  you own everything twice. Without stable ids, merge can only duplicate or match
  on a string the user is free to rename. **The format goes to v4 with UUIDs**,
  and existing installs need an id-backfill migration. **This screen cannot ship
  before that.**
- Counts are computed before you commit: "24 · 6 new" is the diff, not the file's
  contents, and it re-counts live when you switch Merge/Replace — you are choosing
  between two described outcomes, not two words.
- **Replace is destructive and is treated that way**: red button, "Deletes your 3
  setlists and 24 songs", typed confirm.
- **Selective is per category, not per item.** Practice history and library songs
  default off — history is rarely what you're restoring, and library rows point at
  audio files a JSON backup does not contain. A row that would import 17 broken
  paths says so.
- **Conflicts get reviewed, never silently won.** Silent overwrite is the one
  thing §5.5 explicitly forbids.

### 12.5 Settings owns the rig

The screen nobody designed. It was built ad-hoc, has never had a pass, and just
became load-bearing: volume, latency offset and subdivision accents live here now.

**Five sections**: Rig · Tools · Data · Appearance · About. (Hick's law survives
the supersession: ≤7 primary choices.)

- **The click runs while you're in Rig.** A chip in the section header starts a
  100 BPM click and becomes `■ Stop · 100 BPM`. **Volume and latency are
  meaningless as numbers** — they are things you hear. Without this, Rig is a form
  you fill in blind, which is exactly what it is today. It stops on leaving and
  does not touch the metronome's own state.
- **Volume has a detent at unity.** Range 0–200% (`maxVolume = 2`), so 100% is
  dead centre — the one value you want to return to. The tick is visible and the
  thumb catches. Past ~150% the fill turns red rather than the app policing it;
  the readout still says `150%` and the tick is positional (colour is not the only
  signal).
- **Latency is a stepper, not a slider.** 1 ms per tap, long-press to repeat.
  **Range ±300 ms** (D5) — the build's slider is `divisions: 20` across ±100 ms,
  which is **10 ms a step, a third of a semiquaver at 120 BPM**: audible, not fine
  enough to null a click against a track, and unable to reach Bluetooth at either
  end. A stepper also makes the value legible, which a 120dp slider never was.
- **Latency belongs to the output, not the app.** Your offset for wired
  headphones and for Bluetooth differ by ~200 ms. **One global number is wrong the
  moment you unplug.** Kitbag stores a calibration per route and switches
  automatically; the `Output` row names the live route so the number above it is
  never a mystery.
- **Latency is measured, not guessed** — the calibration screen (§12.5.1).
- **Subdivision accents are global and live here** (**D2**). They preview in the
  row as the same LEDs used everywhere, then open a sheet: one pattern **per
  subdivision count**, not one pattern, since the count is per-song (1–16) — the
  pattern you set for `♬` applies to every song using `♬`. **This needs engine
  work** — §5.1's implemented list is per-*beat* accents only. It is the only
  control on the screen that is not a re-skin of something that already runs.
- **Volume and latency are the only rig settings, and they are global** (**D3**).
  No per-song override; `SongPresets` carries neither column. Volume per song is
  genuinely lost — the quiet acoustic number in a loud set needs this slider.
  Accepted, and it is the reason the Rig section has to be good.
- **Practice is a readout, not a doorway.** Sessions, total time, average tempo,
  no chevron — the viewer is later work, so the row promises nothing behind it.
  The numbers are already computed; average tempo is the one addition, and it is
  the stat a musician reads.
- **Base directory stays, and becomes authoritative** (**D11**). This reverses
  `kitbag-settings.html` §03, which draws it cut. It is write-only today — a
  picker storing a path no code has ever read, while library and stems hardcode
  the documents dir and export hardcodes Downloads — and the fix is to make it
  real, not to delete it. **Library, stems, export and the database all resolve
  against it**, and every stored path is relative to it (§11.2).
  **Scoped in, not discovered later**: a file migration when the directory
  changes, plus SAF / persisted-URI handling on Android — which is the same gap
  that makes the hardcoded `/storage/emulated/0/Download` fail today.
- **Storage is its companion, not its replacement.** It reports what is on disk
  and where, and offers "Remove missing files". The picker relocates; Storage
  reports.
- **Theme and haptics are new**, and they are the cheapest rows here.
- **Data moves through the system.** Backup goes out through the share sheet,
  restore comes in through the picker. **Kitbag writes to no path of its own
  choosing.**
- **Attributions is not optional**: `kitbag-ui.html`'s footer promises "BPM data:
  Deezer / GetSongBPM (attribution in-app)". Licence and source are table stakes
  for GPLv3 and, per §12.1, part of the brand.
- **Version reads the manifest.** Today it is a hardcoded `'0.1.0'` with an empty
  `onTap`, while the CHANGELOG claims v0.5. Neither is true.

#### 12.5.1 Latency calibration

**Tap along, don't dial.** A click plays at 100 BPM; you tap 16 times anywhere on
screen. The mean deviation is your offset. **This is the only honest way to get
the number** — nobody knows their latency in milliseconds, and the current screen
asks them to.

- **The scatter is the confidence.** Each dot is one tap against the beat. Tight
  cluster → trustworthy; spray → `±3 ms` becomes `±40 ms` and the button says so.
  Showing the spread rather than a lone average is what stops this being a magic
  number the user cannot argue with. It also self-teaches: the drift is visible.
- **Your own tap latency is in there and that is correct.** This measures the
  whole loop — audio out, your ear, your hand, touch in. That is the loop that
  matters for playing along. It is not an audio-driver measurement and does not
  claim to be.
- **It calibrates the live route and says so**, top and bottom. Result is stored
  against the route, not globally.
- **16 taps, ~10 seconds.** Enough to average out a bad one, short enough that
  nobody abandons. **Fewer than 8 usable taps refuses to produce a number** rather
  than producing a bad one — "no dead ends" means explaining, not guessing.
- The stepper stays for people who know their number: every gesture has a visible
  twin, and calibration is the gesture here.

**Unblocked (D5).** ±100 ms could not express a Bluetooth offset, so the
calibration screen would have measured offsets it was unable to apply. The range
is now ±300 ms. The lookahead check ran 2026-07-17: there is no window, the
offset is a phase bias, and the two latency bugs the check exposed are fixed and
pinned in `metronome_verify` (§4.7). Widening the clamp to ±300 ms is a one-liner
left to land with the calibration screen that needs it (§12.8).

### 12.6 Experience rules — acceptance criteria, not aspirations

From `kitbag-ui.html` §06. Distilled from NN/g, Android haptics/a11y guidelines,
Laws of UX, and Mobbin pattern research. Each is testable and gets checked per
milestone.

- **Sound in 5 seconds, no tour.** First launch lands on a working metronome. No
  slideshow, no signup. Hidden gestures teach themselves via a one-time hint
  animation on first encounter, dismissed forever after first successful use.
- **Every gesture has a visible twin.** Swipe-anywhere tempo is backed by the
  always-visible ±5/±10 presets and TAP; row swipe-actions are duplicated in
  long-press menus. **Gesture-only features are banned.**
- **Empty states are starting lines.** Empty library says "Add your first song"
  with the import button inline — never "No data". Every empty screen names the
  reason and the next action.
- **Haptics: semantic, sparse.** Platform haptic constants only — clock-tick on
  beat (auto-thins above ~160 BPM), confirm on tuner lock, reject on failed
  analysis. System haptics toggle always respected.
- **<400ms or it's broken.** Doherty threshold: every tap answers visibly within
  400ms; beat/tuner feedback is realtime by architecture. Long work (analysis,
  downloads) runs in background with progress badges, never blocking screens.
- **No dead ends.** Permission denied → explain + "Open settings" + degraded-but-
  working mode. Offline → library and metronome fully work; network features
  labelled, never erroring cold.
- ~~Settings stay contextual~~ — **superseded** by `kitbag-settings.html`. Volume,
  latency and subdivision accents live in Settings. Every other rule still binds.
- **Accessible by structure.** BPM and cents readouts are live regions (polite);
  all touch targets ≥48dp; text scales, verified at 200%; **no colour-only
  feedback anywhere** (position/shape/haptic always paired).
- **End on a peak.** Stopping a long practice run shows a small summary — the
  peak-end rule says the closing moment defines how the session is remembered.
  Quiet, dismissible, never gamified nagging.

### 12.7 Key flows

- **Import → analysed.** FAB → system picker (file or folder) → copy into library
  → row appears instantly with `ANALYZING…` → `GRID ✓` lands in background
  (~10–30s). **User never waits on a spinner screen.**
- **Spotify → locked click.** Open Play-along → (first time: permission
  explainer) → now-playing appears → BPM auto-fills → one tap on a downbeat →
  locked. Library match short-circuits to one tap.
- **Gig night.** Home → Continue card → setlist chip pages songs with swipe →
  each song recalls tempo/signature/accents/sound. Screen stays awake, controls
  oversized, theme dark.

### 12.8 Design work still required

**Design-file edits forced by §17's decisions — landed 2026-07-17.** These were
corrections to shipped design files, not new work. Recorded here because the
decisions they carry are the reason the files read as they now do:

| File | Edit | Decision |
|---|---|---|
| `kitbag-settings.html` §03 | **Base directory is not cut.** It returns as an authoritative picker; Storage becomes its companion, not its replacement. | D11 |
| `kitbag-metronome.html` §02 | `7/4` **went back to `7/8`** — the denominator is being built, so the mock's original claim is buildable. | D1 |
| `kitbag-metronome.html` §02 | LEDs are a **row with grouping, min 4 per row, wrapping**. Resolves the file's own "knowingly untrue" flag — and the build's circle is what changes, not the mock. | D9 |
| `kitbag-playalong.html` §04 | **Delete the ad state.** | D10 |
| `kitbag-playalong.html` §05 | Phase sheet shows the **total** (`+190 ms total · 180 route + 10 song`). | D6 |
| `kitbag-metronome.html` §05 | Close both open questions: volume/latency are global (**no** preset-editor override, so the editor is already right); subdivision accents are global. | D2, D3 |

**Designed, needs states:**

- **Stem player**: loading · resampling · unsupported file · >16 tracks.
- **Library**: analysis failed · unsupported format · missing file.
- Empty states as CTAs throughout.

(Play-along's states are done — `kitbag-playalong.html` §04, minus the ad row.)

**Not designed:**

- **Standalone song library** — the metronome spec draws the entry point (the
  "All songs" row) but not the screen behind it.
- **Base directory picker + file migration** (D11) — newly in scope, and it has no
  design. Needs the picker, the "moving your files" progress state, and the
  failure path when the target is unwritable.
- **GetSongBPM key row** (D7) — a Settings row that takes a personal key. Small,
  but undesigned, and it needs the attribution copy.
- **Practice log viewer** — deferred by decision 2026-07-17. The summary sheet is
  designed; the history is not. Settings shows the stats and stops. The build's
  existing modal stays as-is until the viewer gets its own pass.

**Open:** wordmark/logo pass · swipe sensitivity confirmation on device.
(Landscape is **deferred past v1** — D13.)

---

## 13. React Native architecture

This section is the part of the spec the stack decision created. Everything it
says exists to serve §4.5's invariants and §12.6's rules — where an RN idiom
conflicts with those, the idiom loses.

### 13.1 Monorepo layout

pnpm workspaces + Turborepo, replacing Melos. The package boundaries are the
Flutter ones, because §9.4 was never about Dart.

| Package | Role | May import |
|---|---|---|
| `app-shell` | Expo entrypoint, router, plugin registry, home hub | everything |
| `core-plugin-api` | Abstract plugin contract — types only | nothing |
| `core-native` | **The only** package that touches JSI/TurboModules | `core-plugin-api` |
| `core-state` | Zustand stores, the concrete DI layer | `core-native`, `core-db`, `core-plugin-api` |
| `core-db` | Drizzle schema, migrations, DAOs | `core-plugin-api` |
| `core-design` | Tokens, theme, shared components (incl. the waveform renderer, LEDs, steppers, sheets, numpad) | `core-plugin-api` |
| `tool-metronome`, `tool-library`, `tool-stems`, `tool-sync`, `tool-tuner` | Plugins | `core-*`, never each other, never `app-shell` |
| `eslint-plugin-kitbag` | Architecture rules | — |

Two notes where the Flutter layout was wrong and the port fixes it:

- **The waveform renderer moves to `core-design`.** It lives in `tool_library`
  today and §7.3 needs it in the stem player. A component two tools need is a
  shared component.
- **`core-native` replaces `core_audio_ffi`** and keeps its single-package rule.
  §9.4's "native bindings live in exactly one package" is enforced (§13.6).

### 13.2 The native boundary — JSI, not the bridge

**The legacy bridge is disqualified**, not merely slower: it is async and
serialising, so a polled read of `kb_metronome_bar_phase` would arrive late, out
of order, and allocation-heavy. §4.5 requires polled lock-free reads. That means
the New Architecture, and it means JSI.

- **Commands** (`setTempo`, `start`, `loadTrack`, `setGrid`) go through a
  **TurboModule**. They are infrequent, they can be typed with codegen, and they
  may be async.
- **Polled realtime reads** (`bar_phase`, `current_beat`, `current_bpm`,
  `frames_rendered`, `tuner_snapshot`, `player_position`) go through a **JSI
  HostObject** that calls straight into the C ABI, synchronously, with no
  serialisation. This is the direct analogue of the Dart FFI call it replaces.
- The HostObject is installed once, holds the single `kb_engine*` (§4.5: one
  engine per process), and is **the only thing in the codebase that holds it.**

**Numeric width is checked, not assumed:**

| Value | Type | JS-safe? |
|---|---|---|
| `kb_tuner_snapshot` | `uint64_t`, **48 bits used** (note 16 + cents 16 + confidence 16) | Yes — 48 < 53 mantissa bits. Exact. Unpack with shifts on a double via division, or read as three fields. **No BigInt.** |
| `kb_engine_frames_rendered` | `uint64_t` frames | Yes — 2^53 frames at 48kHz is ~5,900 years. |
| `kb_player_position` / `_frames` | `int64_t` frames | Yes, same bound. |
| `kb_mixer_position` | `int64_t` frames | Yes, same bound. |

`kb_tuner_snapshot` packs the whole reading into one atomic so a single load can
never pair note A with note B's cents. Layout, LSB first:

| Bits | Type | Field |
|---|---|---|
| 0–15 | `int16` | nearest-note MIDI index (`-1` = no pitch) |
| 16–31 | `int16` | cents offset from that note, **×100** |
| 32–47 | `uint16` | confidence in [0,1], **×10000** |

`Tuner::PackSnapshot` is the only producer; unpackers must apply the scale
factors above.

Everything else is `int32_t`, `double`, `float`, or `const char*`. **After §4.1
removes `kb_mixer_set_track_data`, no buffer crosses the boundary at all** — which
is what makes a HostObject sufficient and an ArrayBuffer bridge unnecessary.

### 13.3 The 60fps rule, in React terms

§4.5: *never stream 60fps values through the app's reactive graph.* Under Flutter
that meant "not through Riverpod". Under React:

**The beat sweep, the LED flash, the tuner needle and the drift needle never touch
`useState`.** A `setState` per frame re-renders a subtree 60 times a second and
will drop beats under GC — the exact class of failure that made the Flutter
`Timer`-based phase lock ±16ms and jittery.

The mechanism:

- A **Reanimated worklet on the UI thread** calls the JSI HostObject directly each
  frame and writes to a `SharedValue`.
- Animated components read the `SharedValue`. **No JS thread involvement, no
  React render.**
- React state holds only what changes at human speed: the BPM number, the
  time signature, which sheet is open, whether we are locked.

This is not an optimisation. It is the reason the architecture holds, and it is
the first thing to verify on device (§14).

**Corollary:** the JS thread being busy or paused must never stop or jitter the
click. The click is scheduled in the C++ audio callback and is already
independent — the requirement is that nothing in the React layer becomes
load-bearing for it. §5.8's acceptance test starves the JS thread on purpose.

### 13.4 State

**Zustand**, in `core-state`, one package — the direct analogue of §9.4's
"concrete DI/providers live in one package" and enforced the same way. Chosen over
Redux for the same reason Riverpod was chosen: stores are small, colocated, and
have no ceremony.

Rules:
- Realtime values are **not** in the store (§13.3).
- The store owns command dispatch and persisted state, not audio truth. The
  engine is the source of truth for what the engine is doing; the store must not
  keep a shadow copy it believes over a poll.
- Play along holds its own metronome state (§8.9).

### 13.5 Background work

The beat-analysis isolate does **not** become a JS worker. `kb_analyze_song` is a
native call that takes tens of seconds; running it from a JS thread blocks the JS
thread, and running it from a `react-native-worklets` context still runs it on a
thread RN owns. It becomes a **native background task** (Kotlin `WorkManager` /
iOS `BGTaskScheduler`) that calls into the core and reports completion through the
TurboModule's event emitter. The UI shows a badge (§12.7) and never blocks.

### 13.6 Enforcing the boundaries

`custom_lint_kitbag` becomes **`eslint-plugin-kitbag`**, an ESLint flat config
with custom rules. The four rules from §9.4, translated:

| Flutter rule | ESLint rule |
|---|---|
| `dart:ffi` only in `core_audio_ffi` | JSI/TurboModule imports only in `core-native` |
| Riverpod providers only in `core_services` | Zustand `create()` only in `core-state` |
| `core_plugin_api` must not import `app_shell` or `tool_*` | same, by package name |
| PascalCase filenames and class names | PascalCase for component files; camelCase for hooks/utils |

Plus `eslint-plugin-boundaries` for the import graph in §13.1, which is cheaper
than hand-rolling it.

**The eval harness ports with the rules.** `packages/app_shell/eval/` scores lint
rules against `*_pass` / `*_fail` scenario files, and it is the reason a rule
change can be verified rather than hoped at. Port it — same shape, TS scenarios,
same "all scenarios must pass before submitting work" gate. `dart run custom_lint`
had `--fatal-infos`; the ESLint analogue is `--max-warnings 0`.

### 13.7 One definition per constant

§4.5: cross-boundary constants have exactly one definition. Concretely, these are
currently at risk of being hand-mirrored and must not be:

- **`soundNames`** — owned by the engine, indexed by native sound id. §2.3 and
  §5.3: `sync_screen.dart` invented its own and mislabelled every sound from index
  2 up, and the error reached a design file.
- **`kMaxTracks`** (16) — §7.4.
- **Accent enum** (`KB_ACCENT_MUTED/NORMAL/ACCENTED`).
- **`kb_result` codes.**
- **Latency and phase bounds** — §4.7, and note they are three separate decisions
  (§15), not one shared constant.

Generate the TS from the header, or expose them through the TurboModule. Do not
retype them.

### 13.8 Toolchain and distribution

| Concern | Choice |
|---|---|
| RN flavour | **Expo with prebuild** (config plugins, `expo-dev-client`), not Expo Go — the native core, the foreground service and the notification listener all require custom native code. |
| Router | Expo Router (file-based), wrapping React Navigation. Plugin routes register through §9.1's `RouteDescriptor`. |
| Native build | The existing CMake for `native/audio_core` is consumed by the Android Gradle `externalNativeBuild` and an iOS podspec. **The C++ does not move.** |
| Styling | **NativeWind 5 (preview) + Tailwind v4**, consuming §12.2's tokens. NativeWind 5 has not shipped GA — the reference pin is `nativewind@5.0.0-preview.3` with `tailwindcss@^4`, `@tailwindcss/postcss`, and `lightningcss` held at `1.30.1`. A pre-release dependency is a material fact on the F-Droid path, where the whole argument rests on one precedent's recipe. The tokens stay the single source of truth — §13.8.1. |
| Waveform rendering | React Native Skia. This is the `CustomPainter` replacement and the only reasonable one. |
| Animation | Reanimated 3 (§13.3) + Gesture Handler for swipe-anywhere. |
| DB | Drizzle + op-sqlite (§11.1). |

#### 13.8.1 Styling — NativeWind, on §12.2's terms

NativeWind is permitted **only** as a consumer of §12.2. The reason the earlier
revision of this table banned it stands unchanged: a Tailwind config with its own
palette is a second source of truth, and §13.7 is what happens next.

**Be honest about what is enforced.** Only the first rule below holds itself up;
the rest are conventions until §13.6's lint layer exists. The ban's original
reason is **deferred onto §13.6, not neutralized** — that is the cost the
decision to adopt NativeWind accepts, and §13.6 is where the bill comes due.

**Enforced by construction:**

- **The tokens own the palette.** `core-design` exports §12.2's table as TS, and
  the Tailwind theme is **generated from that export** as a build step, never
  hand-authored. A hex literal in `tailwind.config` cannot survive a regenerate.

**Owed to §13.6 — add each to its rule list; nothing catches them today:**

- **No arbitrary values for tokenised properties.** Tailwind v4 permits
  `bg-[#0E0D10]` by default and nothing rejects it at build time. This is the
  `sync_screen.dart:14` defect with new syntax.
- **No token may be Tailwind-only.** If a value isn't in §12.2, it doesn't exist.
  Adding a colour means editing §12.2 first.
- **§13.3 holds.** `className` is a render-time concern. The beat sweep, the LED
  row and the tuner needle are animated **only** by Reanimated worklets writing
  SharedValues (§4.5, §13.3) — never by swapping classes per frame.

**Neither, but true:**

- **Three themes, not two.** §12.5 requires System/Dark/Light. Tailwind's `dark:`
  variant plus OS preference gives two-and-a-half; the explicit override is
  driven through NativeWind's `colorScheme` API and CSS variables (`vars()`),
  with the theme layer — not the variant — as the authority.
- **Skia ignores all of this.** The waveform renderer (§13.8, above) reads tokens
  from the TS export directly. Tailwind has no reach into a Skia canvas.

`react-native-css` and lightningcss come along as NativeWind's transitive deps.
They are build-time only — lightningcss ships a prebuilt native binary, which is
the part F-Droid cares about. See the F-Droid note below: **very likely fine,
unconfirmed.**

**F-Droid is a hard constraint on this table**, and it was checked on 2026-07-17
rather than assumed — `docs/fdroid-expo-research.md` carries the evidence, the
citations and an honest confidence level. Read it before relying on any sentence
here. What it establishes:

- **Expo prebuild is not categorically barred.** There is one real precedent in
  the main repo — WAFRN (`dev.djara.wafrn_rn`), an Expo-prebuild app with a
  custom native module (Skia), GPLv3, live today. Structurally identical to
  Kitbag. **One precedent is not a population**, and none of this is a general
  ruling.
- **The spec's old reasoning was wrong in a useful direction.** "Reproducible
  builds are unhappy with anything that phones home at build time" was too broad.
  F-Droid's build server *does* have network access during `init`/`build` —
  `yarn install` is the documented, canonical RN recipe. What is forbidden is the
  *shipped app* phoning home at runtime undisclosed. §9.3's Play Asset Delivery
  rejection is untouched and still correct; that is a runtime CDN mechanism, not
  build-time dependency resolution.
- **Reproducibility was not a gate for WAFRN.** It was merged despite its
  submitter reporting the build does not reproduce byte-identically (`.dex`
  differences), and the docs frame reproducibility as a per-app trust signal
  displayed on the listing. No policy sentence found says either way, so read
  this as one precedent's outcome, not a general rule.
- **Prebuilt binaries in the JS tree are handled, not banned.** The standard
  recipe strips the JS tree with `scandelete: node_modules` before the scanner
  runs, and WAFRN's accepted recipe installs **lightningcss** during `init` and
  relies on exactly that. The Inclusion Policy also appears to exempt Hermes *by
  name* alongside the Android and Flutter SDKs — **that clause is load-bearing
  here and is the one quote the research could not independently verify**
  (reproduced by two fetches through a summarizing model, never read as raw HTML,
  not surfaceable by search; and a maintainer forum post predating it says the
  opposite). **Re-fetch and diff it against a raw view before betting the
  toolchain on it.** For lightningcss specifically no maintainer has ruled at
  all, so its survival is inference from a structural analogy — very likely fine,
  unconfirmed, not cleared.

**Two things follow for the build, and they are decisions, not findings:**

- **Commit the generated `android/` tree.** Do not run `expo prebuild` inside
  F-Droid's build steps. WAFRN commits its tree, which is the only proven path;
  whether the build server tolerates a live prebuild is unknown and untested by
  anything in the sources.
- **Strip the Expo modules with proprietary-service entanglements** before build,
  as WAFRN does (`expo-notifications`, `expo-dev-client`). The 2020 "some Expo
  modules depend on non-free components" caveat is about *those*, not about
  prebuild or config plugins.

The cheapest way to convert the remaining inference into a ruling is to submit
the metadata in draft/RFP form and read what the reviewer flags — before the
toolchain is built on it, not after.

### 13.9 The Android native surface

RN does not remove the need for Kotlin; it changes what wraps it. Three pieces are
native and stay native:

1. **Foreground service** (§5.6) — no RN API exists. A Kotlin service, started and
   stopped through a TurboModule, holding the media session for lock-screen and
   headset controls. **This is the piece with no JS analogue and the one most
   likely to be underestimated.**
2. **Notification listener** (§8.2) — the existing `MediaSessionPlugin.kt` and
   `NotificationListenerService`, ported from a Flutter plugin to a TurboModule.
   The Android logic is correct and survives; §2.3's `requestPermission` lie and
   §8.4's missing `lastPositionUpdateTime`/`playbackSpeed` are fixed in the port.
3. **Audio engine lifecycle** — `kb_engine_create`/`start`/`stop` tied to the
   Android lifecycle, not to a React component's mount.

`react-native-track-player` is not a substitute for (1). It brings its own
playback engine, which §6.1 exists to prevent.

---

## 14. Testing

The Flutter build has **no tests** in `tool_sync`, `tool_stems`, `tool_library`,
no native mixer test, and no metronome soak harness. The migration does not fix
that and makes it more urgent: a rewrite with no tests is a rewrite that cannot
prove it kept anything.

| Layer | Tool | What it proves |
|---|---|---|
| **Native, headless** | `native/audio_core/tools/` — already exists (`metronome_verify.cpp`, `tuner_verify.cpp` render offline and assert onsets against the beat grid) | §4 in full, with **no UI at all**. This is why Phase 1 is testable before any React exists. |
| **Native, new** | Mixer test; **metronome soak/jitter harness** (§5.8) | The 4h soak and the click-vs-grid offset. Neither exists. |
| **DB** | Drizzle migrations against a fixture v6 database | An upgrading user keeps their setlists (§11.1). |
| **Logic** | Jest | Tap-tempo interval averaging (§8.5), BPM match scoring, the phase-modular arithmetic (§8.6), preset round-trip (§5.8). |
| **Component** | React Native Testing Library | Steppers, LED tap-cycle, sheet behaviour. |
| **Lint rules** | The ported eval harness (§13.6) | Architecture rules actually fire. |
| **On device** | Manual, per §14.1 | Everything that matters. |

### 14.1 What only a device proves

These are the acceptance criteria that no CI job can stand in for, and they are
the ones the Flutter build's demos hid:

- The 4h soak (§5.8) and the click-vs-grid measurement (§6.5) — **recorded output,
  not by ear.**
- The metronome surviving 30 min backgrounded with the screen off **and the JS
  thread starved** (§13.3).
- The media session emitting what §8.3 assumes — **unverifiable until the cast bug
  class is gone.**
- Bluetooth latency actually being reachable (§4.7).
- Swipe sensitivity (§12.8).

---

## 15. Sequencing

Ordered by dependency, not by visibility.

### Phase 0 — Verify, and correct the record

The six questions that blocked schema and toolchain work were answered
2026-07-17 (§17). **The schema (§11.2) is unblocked and buildable.**

**Phase 0 closed 2026-07-17. Phase 1 is the work.** What it produced:

- **F-Droid × Expo prebuild** — checked against the real inclusion policy rather
  than assumed. Not barred; one live precedent; §13.8's toolchain stands, with
  two decisions attached (commit the generated `android/`; strip the
  proprietary-service Expo modules). Evidence and an honest confidence level in
  `docs/fdroid-expo-research.md`. The residual risk — nobody has ruled on
  lightningcss by name — is tracked in §17.1 and gates nothing.
- **The lookahead question** — answered: there is no window, the offset is a
  phase bias. The check also exposed two live latency bugs (any positive offset
  swallowed beat 0; a ramp and an offset corrupted each other), both now **fixed
  and pinned** in `metronome_verify` (§4.7). Widening the clamp to ±300 ms is a
  one-liner deferred to the calibration screen that needs it; the regressions
  guard the interaction across it.
- **The §12.8 design-file edits** — all six landed, so no screen gets built from
  a superseded mock.
- **The record corrected** — `CHANGELOG.md` rewritten to claim nothing, and the
  Flutter app deleted: everything §2.4 named, including the AcousticBrainz stub
  (D8) and the advertised source at `bpm_lookup_service.dart:21`.

### Phase 1 — Core

§4 in full: native playback (4.1), phase anchor (4.2), downbeats (4.3), mixer
fixes (4.4).

**This is still the highest-leverage work in the project and it is still
framework-independent.** `native/audio_core/tools/` runs the core headlessly, so
this phase is testable with **no UI at all** — in either language. Nothing here is
wasted by the stack decision, which is precisely why the previous revision of this
spec said to do it before deciding.

### Phase 2 — Skeleton

`core-native` + the JSI HostObject + the TurboModule + the eval-harnessed lint
rules + the Drizzle migration off the existing v6 database. Proves §13.2 and
§13.3 on a device with one screen and no product.

**Gate: the 60fps rule (§13.3) is verified on a real device before any tool is
built on top of it.** If a worklet-driven `SharedValue` cannot hold a beat sweep
steady, that is a foundation problem and everything above it is rework.

### Phase 3 — Rebuild, in dependency order

1. **Metronome** (§5) — least new work, highest confidence, and the setlist model
   everything else references.
2. **Song playback** (§6) — proves §4.1 and §4.2 together.
3. **Stem player** (§7) — proves the mixer under real load.
4. **Play along** (§8) — depends on §4.2 and §6's grids. **Fix the cast-class bug
   and get a real device reading first** (§8.3).
5. **Tuner** (§10) — after §10.1's research.

Plugin extensibility (§9) is not a phase; it is how each of the above is built.

### Phase 4 — Design

§12.8 runs alongside Phase 3, one feature ahead of implementation.

---

## 16. Definition of done

Per feature, all of:

- Acceptance criteria in its section, **measured** — the Flutter build's failures
  are all things a demo would not reveal.
- §12.6 experience rules hold: sound in <5s no tour · every gesture has a visible
  twin · <400ms feedback · empty states as CTAs · no dead-end permission/offline
  states · a11y live regions · ≥48dp targets · 200% text-scale safe.
- Tests exist (§14).
- Works on an Android device and the desktop dev vehicle.
- No dead code: every exported native symbol, DAO method, TurboModule method and
  store selector has a consumer.
- `CHANGELOG.md` entry that is true.

---

## 17. Decisions

Resolved 2026-07-17. Each names what it unblocked and what it costs. Where a
decision contradicts a design file, the decision wins and the file is listed as
needing an edit (§12.8).

### D1 — The denominator is real. **Build it.**

`format.dart:15` hardcodes `'$beatsPerBar/4'`; there is no column, no C API
parameter, and no UI. 6/8 and 7/8 are common enough that quarter-note-only was
not acceptable.

Cost, in three places:
- **C API** — `kb_metronome_set_beats` gains a denominator parameter, or a
  sibling call takes one. The scheduler's beat interval becomes a function of
  both numerator and denominator.
- **Schema** — `SongPresets` gains a denominator column (§11.2).
- **UI** — the `− 7/4 +` stepper edits both halves. Denominators 2/4/8/16.

`kitbag-metronome.html` drew `7/4` pending this and **may now be corrected back
to `7/8`** — the mock's original claim becomes buildable rather than aspirational.
`kitbag-ui.html`'s `7/8` was right all along; it was early, not wrong.

### D2 — Subdivision accents are **global**. Settings keeps them.

One pattern **per subdivision count** (1–16), as `kitbag-settings.html` draws it:
the pattern set for `♬` applies to every song using `♬`. No per-song schema.

**Still engine work.** §5.1's implemented list is per-*beat* accents only, so this
remains the one control on the Settings screen that is not a re-skin of something
already running. C API, scheduler, and schema for the global patterns.

### D3 — Volume and latency are **global only**. Both columns go.

Neither overrides per song. `Songs.volume` and `Songs.latencyOffset` are
**dropped** — they default to `1.0`/`0.0` today, indistinguishable from a
deliberate override at unity, and nothing reads them meaningfully.

This is the cheapest of the three options and it removes work rather than adding
it:
- **No** nullable columns, no `inherit / overridden / cleared` three-state.
- **No** edit to `kitbag-metronome.html`'s preset editor — it draws neither, and
  now it is right to.
- Latency was always hardware, not song, and the per-route model (§12.5) settles
  it. Volume per song is genuinely lost: the quiet acoustic number in a loud set
  now needs the Settings slider. Accepted.

### D4 — Track identity is **library id when known, else (title, artist, source, length)**.

Two identities, as the more-correct option, plus two disambiguators the media
session already carries:

- **`source`** — the app's `packageName`, which already crosses the channel and is
  read by nothing today (§8.3). **Consequence: the same song on Spotify and on
  YouTube gets two presets.** This is deliberate — different streams have different
  latency, so a per-source phase nudge is a feature, not a duplicate.
- **`length`** — the session's duration. Disambiguates radio edit vs album cut vs
  live, which title+artist alone cannot.

Normalisation is still the whole game: escape `LIKE` wildcards, strip feat.-tags
and punctuation (§8.6). And a migration is still needed when a track later joins
the library and its identity changes from the tuple to an id.

### D5 — Widen latency; phase is **±half a beat**.

Three bounds, three separate constants, no shared value:

| Quantity | Bound | Why |
|---|---|---|
| Latency offset | **±300 ms** | Covers Bluetooth's 150–250 ms. The control could not previously express the most common problem it exists to solve. |
| Phase nudge | **±½ beat, tempo-dependent** | Phase is modular; a whole beat of offset is none. ±175 ms at 171 BPM, ±500 ms at 60 — so a constant was the wrong *shape* of limit. |
| Downbeat shift | beats, not ms | A different quantity entirely (§8.6). |

Cheap, per §4.7: the native side does not clamp, so this is two constants and a
stale doc comment in `kitbag_api.h:63`.

**One check before it lands:** confirm the scheduler's lookahead window absorbs a
300 ms offset. That is where a large value actually bites, and it is the only part
of this that is not a one-line change.

### D6 — Show the total, name both parts.

Play along's phase sheet reads **"+190 ms total · 180 route + 10 song"**. One
number to trust; both sources legible. Resolves the "two controls, one delay"
gap — the route calibration and the per-song nudge add up, and until now nothing
displayed the sum.

Costs a line in the sheet. Worth it at ±300 ms, where the total stops being
intuitive.

### D7 — GetSongBPM: **user brings their own key**.

A Settings row for a personal key. No proxy — a server, a running cost, a privacy
surface and a single point of failure an offline-first GPL app should not acquire.
No shared key in a public repo, ever.

**Recorded honestly: realistically almost nobody will do this**, so in practice
the ladder is D8's. The tier exists for the user who wants it and costs nothing to
leave available. Attribution obligations still apply when the tier is used.

### D8 — Drop the offline dump tier.

The AcousticBrainz 2022 dump is not bundled and not downloaded. Delete the stub
that returns `null` and the source it advertises at `bpm_lookup_service.dart:21`.

**The ladder is now: Deezer → library beat grid → tap** (→ GetSongBPM if the user
supplied a key). Three rungs, all honest. The tap pad was always the real fallback
and always works.

### D9 — Beat LEDs are a **row**. Grouping is gained.

The design wins; the build's circle goes. `BeatLedRow` has drawn a circle since
v0.1 to save horizontal space, and grouping is a linear idea a circle cannot
express — which is why `kitbag-metronome.html` flagged the row as the one thing in
it that was knowingly untrue. It is now true.

- **Grouping renders as the design draws it** — 7/8 groups visually 2+2+3.
- **Minimum 4 LEDs per row.** Rows wrap rather than shrinking below that, so a
  16-beat bar is four rows of four, not sixteen unreadable dots. This is the rule
  that makes the row survive the horizontal-space problem the circle was solving.

The React rebuild is the cheapest this will ever be, which is why it is being done
now rather than carried.

### D10 — Ads: **drop the state**. The click runs over them.

No detection, no heuristic, no `AD` badge. Spotify does not flag ads, and every
available signal (duration <35s, empty artist, title change without a skip) would
occasionally mute a real short track — interludes and intros are real music.

The click keeps its lock through the ad, is wrong for 30 s, and is right again
after. **Free-tier users are most users and this is the honest failure**: a
temporarily-wrong click you can see is wrong beats a tool that silently mutes your
practice on a guess. Removes a row from §8.10.

### D11 — Base directory: **wire it**. It is a feature.

The opposite of what `kitbag-settings.html` §03 draws. The picker returns and
becomes **authoritative**: library, stems, export and the database all resolve
against it.

**This is real work and it is now scoped in**, not discovered later:
- A **file migration** — moving existing content when the directory changes.
- **Scoped-storage handling** on Android (SAF / persisted URI permissions), which
  is the reason the hardcoded `/storage/emulated/0/Download` fails today.
- Every path stored **relative to it** (§6.2, §11.2), which was already required
  for iOS and is now required twice over.

`Storage` (§12.5) stays as the reporting sheet — what is on disk, where, and
"remove missing files". It reports; the picker relocates.

**`kitbag-settings.html` needs an edit**: it draws Base directory as cut and
Storage as its replacement. Storage is now its companion, not its substitute.

### D12 — Merge migration: **accept the duplicate**.

Backfill UUIDs on migration. Two devices that backfill independently derive
different ids for the same setlist, so **the first merge between two existing
installs duplicates.** Documented, not worked around.

No name-matching special case (a renamed setlist defeats it anyway), no
content-hash ids (any edit before the merge defeats *that*). Users hit this exactly
once, and the alternative is machinery that fails in subtler ways.

### D13 — Landscape: **defer past v1**.

Portrait only for first release. Nothing in the architecture blocks adding it
later, and the Flutter build's unspecced two-pane regroup is not a commitment.
Revisit once the metronome and tuner are real.

---

## 17.1 Still open

Genuinely unresolved. None block work; four are confirmations.

- **F-Droid × Expo prebuild — checked 2026-07-17, residual risk only.** No longer
  blocks §13.8: Expo prebuild is not categorically barred and there is one live
  precedent (§13.8, `docs/fdroid-expo-research.md`). What remains is narrower and
  does not gate the toolchain — **no maintainer has ruled on lightningcss or
  NativeWind by name**, and the precedent is one app rather than a pattern. The
  mitigation is to submit metadata in draft/RFP form early and read the review.
  Kept here because "very likely fine, unconfirmed" is not the same as decided.
- **Setlist chip vs NOW badge.** Both mark the active song ("3/12" vs `NOW`).
  Confirm on device that they never disagree after a manual reorder mid-gig.
- **Wordmark/branding.** "KITBAG" set in Space Grotesk; a logo pass can come before
  first release.
- **Swipe axis & sensitivity.** Vertical ±1 BPM/8dp proposed; confirm on device once
  the metronome exists.

---

## 18. Known risks

| Risk | Mitigation |
|---|---|
| Streaming decode (§4.1) is the biggest native change; underruns are subtle | Headless harness in `native/audio_core/tools/` before any UI; assert on buffer starvation |
| **The 60fps rule (§13.3) fails on device** — a worklet-driven sweep cannot hold steady | Phase 2 gate: prove it with one screen and no product, before anything is built on it. This is the migration's foundational bet. |
| **RN New Architecture churn** — JSI/TurboModule APIs have moved before | Keep the JSI surface tiny: one HostObject, one TurboModule, one package (§13.1). The C ABI beneath it does not move. |
| **The foreground service is underestimated** (§13.9) | It has no JS analogue and no library substitute. Budget it as native work, not integration. |
| QM-DSP adoption (§4.3) may not drop in cleanly | Fall back to extending the existing tracker with downbeat estimation; grid schema is the same either way |
| Notification-listener grant friction + Play review | App fully usable without it; clear explainer; policy form ready |
| iOS sync is Spotify-only, forever | State it plainly in-UI; it is a platform limit, not a bug |
| Tuner mic problem may be a device/OS issue, not ours | §10.1 research gate before committing to implementation |
| BPM APIs disappear | Multi-source ladder + offline dump + tap always works |
| F-Droid rejects the Expo-shaped project (§13.8) | Verify policy in Phase 0, before the toolchain is locked |
| **Rewriting twice** | Phase 1 before Phase 3 — the un-wastable work first. The stack decision does not change which work that is. |
| **The rewrite silently loses working behaviour** | §2.1 is the port checklist; §14's tests are the proof. A rewrite with no tests cannot show it kept anything. |
| Scope creep | Nothing enters core that a plugin can carry |
