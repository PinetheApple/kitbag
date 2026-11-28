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
| The design specs in `design/` | All still binding (§12). |
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

## 2. 2026-07-17 audit (historical)

Ground truth as of 2026-07-17, audited against the Flutter build. Cite this
when deciding what to port and what to leave. Status now is in §15; "Fixed by"
notes mark the rows later work closed.

### 2.1 Genuinely works — port the behaviour, not the code

| Area | Notes |
|---|---|
| **Metronome engine** | Lookahead scheduler, sample-accurate click. C++. **Keeps running untouched.** |
| **Metronome UI** | Swipe tempo, ±5/±10, TAP, 3-state accent LEDs, polyrhythm second row, subdivisions 1–16, tempo ramp, bar muting. The healthiest part of the codebase and the reference for the React port. |
| **Setlist/song CRUD** | Create/rename/delete/reorder, on-stage pager, live-BPM autosave. |
| **Export/import** | `kitbag_export.json` v3. Works; §5.4 and §12.4 change it to v4. **Fixed by #107** (v4 backup). |
| **Beat analysis pipeline** | Import → background isolate → `kb_analyze_song` → BPM + beat grid (Float32 BLOB) + `.kwav` waveform sidecar. Real. The isolate becomes a worker (§13.5). |
| **Waveform render** | `.kwav` parser + painter, tap-to-seek. Painter is Flutter; the parser and format are portable. |
| **Media session detection (Android)** | `MediaSessionManager` via `NotificationListenerService`. Correct approach, keeps its Kotlin. |
| **Native mixer core** | 16-track, per-track gain/mute/solo atomics, solo-aware, shared read head. Correct design — never receives data. |

### 2.2 Shell over a hole

| Area | Reality |
|---|---|
| **Stem player** | ~90% by LOC, **0% functional**. `_decodeFile` returns `null`; `setTrackData` is never called; `track_count_` stays 0, so gain/mute/solo all early-return and `play()` auto-stops instantly. UI reports ready. **Fixed by #182.** |
| **Library phase lock** | Dart `Timer`-driven, ±16ms and GC-jittered. Restarts the native sequencer every beat. Latency offset exists, never set. Not sample-accurate. **Fixed by #315 and #342** (native song player, click on the song's grid). |
| **Media sync phase lock** | Does not exist. `sync_screen.dart:222-232` is `setTempo(); start();` — right tempo, arbitrary phase. |
| **Metronome notifications** | Service + listener fully written, **referenced by nothing**. No foreground service — metronome dies when backgrounded. **Fixed by #158.** |

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
  skipped**. A 44.1kHz stem set plays as silence with no error. **Fixed by
  #26** (resampling source).
- `mixer.cpp:14` — `SetTrackData` does `t.pcm.assign()` while the audio thread
  may be reading `tr.pcm` in `Process`. Data race / use-after-realloc.
  **Fixed by #26** (atomic pointer swap, #8).
- ~~`mixer.cpp:140-141` — read head advances by `max_read`; the comment on :139
  says minimum. Unequal-length stems desync.~~ **Withdrawn 2026-07-20.**
  Measured: every track is indexed by one shared `read_frame_`, so stems have
  no per-track cursor and cannot desync. The minimum rule is what breaks —
  with a 1000-frame and a 5000-frame stem it advances 900→1000 while having
  already output through 1412, replaying 412 frames at every block near the
  short stem's end. `max_read` is correct; the :139 comment was the defect.
  The live bug beside it is the auto-stop condition — see §4.4.
- ~~`mixer.cpp:68-71` — `Stop()` resets position to 0, and the pause button calls
  it. **There is no pause.**~~ **Native half fixed 2026-07-20** (`4d6c89a`).
  `Mixer::Pause()` is a single release store that holds `read_frame_`, and a
  following `Play()` resumes from it; `Stop()` still rewinds, which is now its
  own distinct job. Exposed on the ABI as `kb_mixer_pause` beside
  `kb_mixer_stop`. **UI half done 2026-10-29** (#137): the stem player's pause
  calls `kb_mixer_pause`. See §7.3.
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
  consumed by nothing. §9.2 keeps one registry; its only generator is
  `compiledTools.ts`.
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
  **Fixed by #26 and #315.**
- **No downbeat detection.** `beat_tracker.cpp` is hand-rolled, not QM-DSP
  BarBeatTrack, which the original research chose and nobody built. It yields
  beats but not bar-ones.
  **Unaffected by the migration; §4.3 fixes it.** **Fixed by #26** (QM-DSP, #13).
- **Single shared metronome controller.** `PlayAlongScreen` mutates the
  standalone metronome's tempo with no save/restore. §6.4 and §8.9 fix this;
  the migration is a good moment to, since the state layer is being rewritten.
  **Fixed for songs by #536 and #537:** a song's click sound and accents stay
  with the song and the standalone ones return when it stops, and standalone
  edits stay off a running song click. Play along (§8.9) has its own engine
  metronome slot and state store (#620); its screen is not built. Background
  following has no foreground service of its own: hiding the metronome card
  also drops the metronome's service. A song started from its notification
  (Kotlin) does not end the follow.
- **No tests** in `tool_sync`, `tool_stems`, `tool_library`. No native mixer
  test. No metronome soak/jitter harness. **The migration does not fix this and
  makes it more urgent** — see §14. **Fixed by #26 and #159** (`mixer_verify`,
  the click soak harness) and the `tool-stems` and `tool-library` suites;
  `tool-sync` has no code yet.

---

## 3. Product scope

### 3.1 Core features

1. **Metronome** — the anchor tool. Songs, setlists, export/import, background
   operation with notification transport controls.
2. **Song playback** — import, analyse, play, with the click locked to the beat
   grid.
3. **Stem player** — StemDeck-class per-track control, including speed and
   key, and opening songs StemDeck separated (§7.6–7.8, **D14**).
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

Stem separation · Ableton Link · MIDI clock · mic beat tracking
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
FFI, JSI, or anything else. Values crossing the boundary are scalars, paths, or
flat arrays of scalars read or filled during the call — no structs, and no buffer
the core keeps past the call. Keeping it this
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

**A single song plays through the mixer as one track** (`kb_mixer_load_track(0,
path)`): the mixer already has the loop and its crossfade and the click's
follow-mixer mode, and #138 adds its stretch stage to the mixer, so extending
`kb_player_*` would duplicate them. `kb_player_*` stays in the ABI, and no
transport or store code uses it. Recorded in `docs/decisions.md`; the owner may
overturn it.

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
   beat_times_sec and downbeat_indices are copied; neither needs to outlive
   the call. */
KB_EXPORT kb_result kb_metronome_set_grid(kb_engine* engine,
                                          const double* beat_times_sec,
                                          int32_t count,
                                          const int32_t* downbeat_indices,
                                          int32_t downbeat_count,
                                          uint64_t anchor_frame);
KB_EXPORT void kb_metronome_clear_grid(kb_engine* engine);

/* Anchor to an external transport we do not clock (Spotify et al.).
   Declares: at engine frame at_frame, the song was song_pos_sec in,
   running at bpm. Re-callable to re-anchor; must not glitch the click. */
KB_EXPORT void kb_metronome_anchor_external(kb_engine* engine,
                                            double song_pos_sec,
                                            uint64_t at_frame,
                                            double bpm);

/* Anchor the set grid to an external transport without moving it.
   Declares: at engine frame at_frame, the song was song_pos_sec in, advancing
   rate song seconds per engine second. Re-callable; must not glitch the click. */
KB_EXPORT void kb_metronome_anchor_grid(kb_engine* engine,
                                        double song_pos_sec,
                                        uint64_t at_frame,
                                        double rate);

/* Replace the set grid's downbeats, keeping its beats, anchor and mapping.
   Refused with no grid set or a table set_grid would refuse. */
KB_EXPORT kb_result kb_metronome_set_grid_downbeats(kb_engine* engine,
                                                    const int32_t* downbeat_indices,
                                                    int32_t downbeat_count);
```

Requirements:

- Scheduling stays in the existing lookahead sequencer. Anchoring recomputes
  *future* click targets only — never mutates already-scheduled events.
- `set_grid` mode follows per-beat spacing, not a global BPM. This is what makes
  non-constant-tempo songs work, which a single `setTempo` cannot.
- Re-anchoring mid-playback must be glitch-free (no double-click, no dropped
  beat).
- A grid that follows an external transport is set once, in song seconds, and
  re-anchored with `anchor_grid`, which changes only the song→engine mapping
  (§4.2.2: beat `t` lands on `F + (t − P) × sr / rate`). Re-sending a moved grid
  through `set_grid` is not a re-anchor: the cursor re-seeks against grid times
  that moved, so a small correction double-clicks or drops a beat. Under
  `anchor_grid` the onset floor stays in song seconds. A correction under half a
  click interval keeps the timeline, as `anchor_external` does: no beat sounds
  twice and a beat it skips over sounds at once, late. A larger move forward is
  a seek and drops the beats it skips; a move back of at least one grid interval
  replays from the new position (§4.7's rule). `set_grid` resets the mapping to
  song second 0 at its `anchor_frame`, rate 1; an anchor made before the latest
  `set_grid` is dropped. Pinned by `RunGridAnchorTests` (metronome_verify) and
  `RunGridAnchorAbiTests` (abi_verify).
- Moving the bar-ones of a set grid is `set_grid_downbeats`, not a re-send:
  `set_grid` would reset the mapping until the next `anchor_grid`, dropping
  beats or sounding stray ones. The swap keeps the beats, the click epoch (so the
  mapping, grouping and rate), the cursor and the onset floor; the current beat
  is re-read in the new bars and the next downbeat of the new table is accented.
  An empty table leaves the grid without downbeats, so nothing is accented
  (#300: never invent a downbeat). Pinned by `RunGridDownbeatTests`
  (metronome_verify) and `RunGridDownbeatAbiTests` (abi_verify).
- `set_grid` and `anchor_external` compose with the existing latency offset so
  the click lands on the beat *at the speaker*, not at the buffer.
- `kb_metronome_start_at`'s `start_frame` is buffer (mixer) time. The song and
  the click share one output stream and so share its output latency; the
  offset compensates only the click's perception relative to the listener, so
  on a free run `start_at` fires beat 0 on the requested frame whatever the
  offset. With a grid set, `start_at` gates rather than places: grid beat `t`
  sounds at `t − offset`, and only beats landing at or after `start_frame` sound
  (`BeginPendingStart` seeds the cursor through `GridSeconds`).

**Counted start (#298).** `kb_metronome_count_in_at` and `kb_mixer_play_at`
(`kitbag_song_start_api.h`) each carry one absolute engine frame through their
own command ring, as `start_at` does. Song and click start on the same frame
because both compare it against the same block start, not because one signals
the other. The caller snaps the head back to the whole frame at or before the
bar's downbeat, spaces the count at the grid interval before that downbeat
divided by the rate, and passes one end frame to both. A seek or a speed change
during the count is the caller's cancel plus a new counted start: a pending
`play_at` survives a seek. With the song's click off the count still sounds
(`start_click` 0): the metronome stops on the end frame, drops the play intent
the count took, and a later start locks to the song's grid. Toggling the click
during the count re-issues it with the same end frame and the new `start_click`,
dropping beats already past; the metronome tool's Play during the count ends it
and starts the song at once, and so does a refused re-issue. A grid with no bar
marks (common in StemDeck bundles) counts from the beat at or before the head,
in bars of the song's meter: four beats until a meter is detected or chosen.

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
recycled by the next allocation, a generation cannot. `grid_state_.observed_generation` is
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
phase. In grid mode it is instead *derived* from the song's bar for the grid
beat that last sounded (`BeatGrid::bars`, built from the downbeats on the app
thread, §4.3). Incrementing there would drift: a re-anchor
that moves the cursor backwards re-crosses downbeats, and an incrementing counter
would over-count, making the bar-mute cycle's phase depend on how many times the
user re-anchored. The grid's own numbering — not a count of downbeats observed —
is what a re-anchor must land on.

**`beat_position_` is kept live through grid mode.** Each grid beat re-anchors it
onto that beat, and it advances per sample between beats. That is the whole of
what makes `clear_grid`'s "keeps its phase" true: without it the value stays
frozen at its `Start` value all through grid mode, and the first sample after the
clear reads as a downbeat, firing immediately and shifting the bar.

#### 4.2.2 Playback rate

With the stretch stage (§7.6) the song no longer advances one second per
second. **Song time stays the unit of every grid, anchor, loop point and
position that crosses the ABI;** engine frames stay the unit of the clock.

- The anchor's *P* is song seconds. Between anchor and now, song time advances
  `rate × elapsed engine frames`, so a beat at song time *t* lands on engine
  frame `F + (t − P) × sr / rate`.
- A rate change takes effect at one engine frame and re-anchors there: *P* is
  the song time reached at that frame. The click never jumps a beat or doubles
  one across the change.
- `kb_mixer_position`, `kb_mixer_seek` and the loop points are engine-rate song
  frames (song time × engine rate), whatever the stems' own rate. The UI never
  converts by rate itself.
- The stretch stage adds latency. It is compensated inside the song-frame
  mapping, so click and stems still land together; none of it crosses the ABI.

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
valid — no destructive migration.

`kb_analyze_song_with_tempo` also returns `kb_fit_constant_tempo`'s fit (bpm,
anchor, beats per bar) over the beats and downbeats it found. There is none under
`KB_CONSTANT_TEMPO_MIN_BEATS` beats or for a bpm outside
`KB_CONSTANT_TEMPO_MIN_BPM`..`KB_CONSTANT_TEMPO_MAX_BPM` (`kitbag_constant_tempo_api.h`).

**Under a grid, the click's bars are the song's.** `kb_metronome_set_grid`
takes the downbeat indices (analysed downbeats, or StemDeck bar marks expanded
to indices); each bar runs to the next downbeat, and the last bar's length
repeats. The downbeat of each bar is accented and every other beat is normal.
The standalone meter (`kb_metronome_set_beats`) and accent row, mutes included,
do not apply under a grid: they describe a different piece of music. Bar mute,
the subdivision mute that follows it, `current_beat` and `bar_phase` count the
song's bars. Beats before the first downbeat are a pickup: normal, outside any
bar, and never bar-muted; the mirrors count them back from the first bar.

**Grouping and click rate (#383).** `kb_metronome_set_grid_grouping` splits a
bar into groups (3+2+2): the first beat of each later group plays the accented
subdivision click, and a bar whose length differs from the grouping's sum keeps
only its downbeat accent. `kb_metronome_set_grid_rate` adds a normal click
halfway through each measured interval (x2), or sounds every other beat (x1/2),
counted from each group's first beat under a grouping and from each downbeat
otherwise; at x1/2 subdivisions divide the span from one click to the next.
`set_grid` and `clear_grid` reset both, so the caller sends them again after
each `set_grid`. A count-in stays plain under any grouping or rate. Owner may
overturn these (`docs/decisions.md`, 2026-11-19).

**Downbeats absent → no bar accent.** Every grid beat sounds normal,
`current_beat` reads 0, `bar_phase` sweeps each beat, and bar mute does not
apply. An accent the core cannot place on a real bar actively misleads (#300);
a uniform click does not.
Analysis scores 3 beats per bar against 4 and picks 3 only on a clear lead;
short or tied songs stay 4. The per-song meter override (§6.2) takes precedence.

**Bar one departs from QM's pick in one case (#435).** QM takes the bar position
with the greatest mean spectral change into it. One stand-out beat per bar
raises the change into it and out of it alike, so QM lands on it or on the beat
after. When QM's pick and the position before it are the two highest, sit
closer to each other than to the third, and clear the third by more than the
one-sided 97.5% Student's t bound on the per-bar means, bar one moves to the
earlier position. A beat-4 pickup that changes more than half as much as the
downbeat looks the same and moves bar one onto beat 4. The benefit is shown on
synthetic tones only: no bar one moved on the 42 local real stems.

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

What `native/audio_core` actually vendors and links, verified 2026-07-17 and
updated 2026-10-30. GPLv3 compatibility is the constraint: QM-DSP is
GPL-2.0-or-later, the rest are permissive.

| Dependency | Licence | Role |
|---|---|---|
| **miniaudio** (`third_party/miniaudio.h`) | MIT-0 / public domain | Device I/O — AAudio on Android, PipeWire on Linux, CoreAudio on iOS. One API. Also supplies the Speex-derived resampler §4.1 needs. |
| **Signalsmith Stretch** 1.4.0 + **signalsmith-linear** 0.6.4 (`third_party/signalsmith/`) | MIT | Time-stretch and pitch shift for §7.6. Header-only; the linear library supplies its STFT. The same code StemDeck runs in the browser as WASM. Vendored 2026-11-01; pins in each directory's `README.md`. |
| **QM-DSP** `DownBeat` + `TempoTrackV2` (`third_party/qm-dsp/`, with bundled kissfft) | **GPL-2.0-or-later** (kissfft BSD-3-Clause) | Downbeat estimation for §4.3 (`downbeat.cpp`). Vendored 2026-07-22; the subset and the GPL note are in its `README.md`. |
| ~~**cycfi/q** (`third_party/cycfi_q/`)~~ | Boost Software License 1.0 | **Removed 2026-10-30** (#201). Unused since #117: the tuner's McLeod detector (`pitch_detector.cpp`) is ours. |

Everything else is ours: the lookahead scheduler, the mixer, the radix-2 FFT
(`fft.cpp`), and the beat tracker.

**Planned but never vendored** — the original research chose all of these and none
were built. Do not assume they are present:

- **SoLoud** (mixer/playback). Not used; the mixer is ours.
- **QM-DSP `BarBeatTrack`** (beat + downbeat). Not used; `beat_tracker.cpp` is
  hand-rolled spectral-flux → autocorrelation → DP placement. QM-DSP's
  `DownBeat` was vendored later for §4.3's downbeats; see the table.
- **dr_libs / stb_vorbis** (decoders). Not used; decoding goes through miniaudio.
- **BTrack** — later-ring, out of scope (§3.3).

> The earlier research recorded cycfi/q as GPLv3. It is BSL-1.0 — permissive, so
> the error was harmless, but it is the kind of thing that should be read off the
> vendored `LICENSE` rather than a table. Attribution obligations still apply.

### 4.7 The latency clamp

The engine clamps `kb_metronome_set_latency_offset` to **±300 ms**
(`Metronome::kMaxLatencyOffsetMs`), applied when the command is drained. The
generated `KB_LATENCY_OFFSET_MS_BOUNDS` is read from that constant, and
`kitbag_api.h` documents the same range.

The bound is sized for Bluetooth, which routinely lands 150–250 ms late — the most
common problem the control exists to solve, and one ±100 ms cannot reach. The
bounds are a decision, not an engine constraint.

**Decided (D5):** latency offset **±300 ms**; phase nudge **±½ beat**
(tempo-dependent); downbeat shift in beats. Three quantities, three constants, no
shared value.

**Checked 2026-07-17 — there is no window, and the check found two live bugs,
now fixed.** `Metronome::Render` applies the offset as a per-sample phase bias,
`position = beat_position_ + latency_beats`, and evaluates the grid from the
biased position. Nothing is queued, so no queue depth bounds the offset, and the
±300 ms rejection is the clamp at `metronome.cpp` (`kSetLatencyOffset`) rather
than any structural limit.

The first measurement — click spacing exact to 0.000 frames at 60/120/240 BPM,
±300 ms, and 600 ms — was **true at constant tempo and scoped too narrowly to
support the conclusion it was used for** ("widen the clamp, the scheduler is
untouched"). It measured spacing between clicks that fired, at a fixed tempo.
Both bugs lived exactly in that blind spot, and both reproduced inside a ±100 ms
clamp. Both are now fixed and pinned by
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
- **Under a grid a mid-run change jumps the click with the song** (owner,
  2026-10-31, #245). Grid mode reads the offset through `GridSeconds`, so a change
  moves the song position the click is on. Every change re-seeks the cursor, and
  on the engine clock no re-seek (a republished grid, `anchor_external` and
  `anchor_grid` included) lands on a beat or subdivision tick at or before the last one heard
  this run on the same grid anchor. The follow-mixer clock has no such floor: its
  loop wraps and song seeks replay beats by design. Forward, the crossed beats are
  dropped: the next click is the first beat at or after the new position, on its
  new-offset frame (−300 → +300 ms on a 400 BPM grid drops 4). Back by at least
  one grid interval — the spacing of the beats the cursor sits between — that
  floor is lifted and the beats from the new position replay at their new-offset
  frames, as the stems do; within one run on one anchor, only this replay sounds a
  beat twice. Back by less, the floor holds: the next click is the next unsounded
  beat, and `bar_phase` holds at the last sounded beat until the position passes
  it again. Changes drained in one block act as their sum. A new run, a grid with
  another anchor, or a switch to or from the follow-mixer clock starts a fresh
  floor. A re-seek also places the subdivision cursor, so the ticks it skipped
  never fire as a burst. Pinned by `RunGridOffsetChangeTests` in
  `metronome_verify`. The follow-mixer click ignores the offset (D16), so a change
  there moves nothing.

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
so the clamp is the only limiter. `metronome_verify` runs the regressions above at
the ±300 ms bound and pins the bound itself by value.

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

Global subdivision accents (**D2**), one pattern per subdivision count, were added
to the engine afterwards (#170).

### 5.2 Performance surface

Ported from the Flutter build, which got this right:

- **Swipe anywhere** — the whole screen is the tempo control. Vertical drag
  ±1 BPM per ~14dp when slow, accelerating with drag speed to a capped rate;
  a light haptic tick each time a drag changes the tempo. Lifting the finger
  never changes the tempo (no fling, #209). Chevrons plus a first-use hint
  animation teach it; the presets are the visible fallback (§12.6).
- **Preset steppers −10 / −5 / TAP / +5 / +10** in one thumb-height row.
- **Beat LEDs are the editor** — tap a beat to cycle accent → normal → mute.
  Ring = accent, filled = sounding now, dim = muted. No separate edit mode.
- **The LEDs are a row, and they group** (**D9**). The Flutter `BeatLedRow` draws
  a circle (evenly spaced at `i·2π/beatCount`) and has since v0.1, to save
  horizontal space — but grouping is a linear idea a circle cannot express, so 7/8
  grouping visually as 2+2+3 was never possible. The row wins.
  **Up to eight LEDs per line; a longer bar wraps at a group boundary**, so 12/8 is
  two lines of 3+3 and a 16-beat bar two lines of eight. That rule is what makes
  the row survive the space problem the circle was solving.
- **Polyrhythm as a second dot row** under the beat dots, shown only while poly
  is on. The ratio is N poly beats against M main beats (`3:2`, `5:3`); M
  defaults to the bar, and while it equals the beats per bar it follows later
  meter changes. Smaller dots, each placed at its time in the bar, so a poly
  pulse that lands on a beat sits under that beat; a `3:2` ratio label right of
  the row, else left of it, else above it (`design/kitbag-metronome.html` §02;
  order per `docs/decisions.md` 2026-11-01).
  Each cycle's first pulse is ringed and a bracket marks each cycle's span; when
  the cycle does not divide the bar the row redraws on the downbeat
  (`design/kitbag-metronome-poly.html`). The sounding poly dot fills.
- **Bar sweep** under the BPM: a thin progress ring per bar (anticipation), and
  the active LED flashes on the click (confirmation). Both — see §12.3.
- **Practice timer pill** under the app bar, with a visible reset.

New:

- **Tap the number to type it.** Opens the numpad sheet. 20–400 BPM,
  out-of-range clamps on confirm rather than blocking the keypress. Taught by
  the same one-time hint mechanism as swipe-anywhere; no affordance chrome.
- **Every badge is a stepper** — `− 7/4 +`, `− 3:7 +`, `− ♪ +`. The Flutter
  build already wraps all three in `KitbagStepperRow.inline`; the original mock
  drew them as inert labels, which is why "how do I change the time signature?"
  had no answer on the page.
- **Subdivision reaches 1–16** through that same stepper, showing clicks per
  beat as `×1`…`×16`. (The note glyphs `♩ ♪ ³ ♬` were dropped in #112: they fell
  back to small or emoji renderings and were hard to read.) Poly is switched on
  and both numbers set in the Practice sheet and song editor, as Poly and
  Against steppers.

### 5.3 Four chips, four sheets

One row, no scroll — they wrap on narrow screens rather than scrolling, so
nothing hides. Each shows its current value when active (`⛰ 100→140`, `⏱ 1 bar`)
and its name when off. Each opens a sheet **over the running metronome**; every
value applies live, which is the entire reason they are sheets and not screens.

| Chip | Sheet |
|---|---|
| **⛰ Ramp** | Start, step (±BPM), every N with a bars·sec·min segment, target, loop-back-at-end; the sheet shows the total time it adds up to. Stepped, not smooth (**D15**): the tempo holds for one interval, then moves by exactly the step — on the downbeat for bars, on the next beat for seconds and minutes — and lands exactly on the target. Changing tempo by hand cancels a running ramp and the chip clears with it. |
| **▨ Mute bars** | Play N / mute N steppers, an eight-bar preview. Silent bars still light the LEDs — you keep the visual, lose the click. |
| **♩ Sound** | Normal/Accent segment, then a 6-way picker. **Not a cycler** — the Flutter chip cycles, so reaching sound 6 takes 5 taps and you cannot see what you are choosing between. Per-accent-level sound assignment is in scope: a tom on one, a block on the rest. |
| **⏱ Count-in** | Off / 1 / 2 / 4 bars, distinct-or-same sound, per-song or always. Per song (the default) loads each song's own count-in, and none for a song without one. With the "Count in on every song" chip on, loading a song, a setlist step, Revert and saving an existing song leave the song's own count-in untouched and the live one playing; a new song from current takes the live count-in as its own. The choice and the last count-in survive a restart and a backup. Counts in on start only, never after a pause mid-bar. |

**Sound names come from the engine.** `soundNames` is indexed by native sound
id. Do not declare a local list — that is exactly how `sync_screen.dart:14` came
to mislabel every sound from index 2 up, and how the error propagated into a
design file. One list, one owner.

**Custom click sounds** (owner, 2026-11-07; #174): the user imports their own
sound; the six built-ins stay. Drawn in
`docs/research/mockups/kitbag-metronome-custom-sound.html`.
**[REC TAKEN, owner may overturn]** for every point below:

- **Two slots**, engine sound ids `kSoundCount` and `kSoundCount + 1`. The engine
  owns the slot count, the id range and the length limit; the TS is generated.
  A slot's name is user data, not an engine constant.
- **Same formats as song import**, from the same list (`supportedAudioFamilies`),
  **up to 2 s** counted from the first audible sample. The core prepares the file
  in one streamed pass with bounded memory: mono downmix, 48 kHz, leading silence
  trimmed, peak matched to the built-ins. Refused files (too long, unsupported,
  undecodable, silent) add nothing.
- A custom sound takes Normal and/or Accent like a built-in, at the built-ins'
  gains, with no pitch change. Count-in and the song player keep the built-ins.
- **Name** starts as the file name without its extension and can be renamed.
  **Replace** keeps the slot, so everything that used it uses the new sound.
  **Remove** puts Tick (the engine default) back wherever it was used, saved
  songs included.
- **Storage:** the prepared WAV in app-private storage next to the database, not
  the Data folder (D11 covers song media; a click must not depend on a removable
  card), with a `click_sounds` table row. The audio never crosses into JS.
- **Backup:** its own Restore category, Click sounds, carrying the prepared WAV
  as base64, keyed by slot; Merge reviews a different sound in the same slot as a
  conflict, and an older backup leaves local sounds untouched. After a restore, a
  reference to a slot that does not hold the same sound (by UUID) becomes Tick,
  and the restore report says how many songs changed.

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
- **On-stage navigation lives in the metronome's app bar**
  (`design/kitbag-metronome-setlist.html`, D2). With a setlist active the bar is
  Back, previous, a song chip, next; the "Metronome" title gives way. The chip
  shows the loaded song over the setlist and position ("Test gig · 2/4").
  Previous and next load the adjacent song in one tap, through the same load
  path as tapping it in setlist detail. They are filled 48 dp keys
  (`design/kitbag-queue.html` §i), and Previous always loads the entry before
  (no 3 s restart; §7.9). They are disabled on the first and last song unless
  Repeat is Repeat all (§7.9); then Next on the last song loads song 1 and
  Previous on the first loads the last. After the on-stage entry is removed,
  Next loads the entry now at its position, Previous the one before it; with no
  song from the set on stage (cleared, or freshly activated) Next loads song 1
  and the chip shows the setlist name. Deleting the on-stage metronome song itself counts as cleared;
  deleting an on-stage stem song keeps the position. The chip opens the
  setlist's song list, the loaded song marked NOW; tapping a row loads it, and
  "Leave setlist" ends the setlist as §7.9 defines. A song loaded from outside
  the setlist (All songs, search) clears it. A setlist pinned here in an earlier
  app run stays pinned but is not started (§7.9) until one of its entries is
  loaded. With no setlist active the bar keeps its title, and a song loaded on
  its own shows in the chip as "Not in a setlist"; the chip then opens a sheet
  with "Clear song" and "Open setlists".
  Clear song and Leave setlist unlink the loaded song but keep the metronome's
  current settings, so the bar returns to the plain "Setlists" chip without the
  sound changing.
- **Live edits are unsaved until Save** (owner, 2026-10-31; #212). Changing a
  loaded song's settings on the metronome (tempo, meter, subdivision, accents,
  poly, sound, ramp, mute, count-in) never writes the song; a visible mark shows
  it has unsaved changes until the user saves. Nothing autosaves. The mark and
  where Save lives await the owner's pick of a design.
- **"The last metronome state survives a restart"** (owner, 2026-11-07;
  #333): tempo, meter, subdivision, accents, poly, sound, ramp and mute bars
  come back after the app is killed, and nothing starts playing.
  Count-in, volume, latency and subdivision accents keep their own storage
  (§5.3, §12.5). How that meets songs:
  - Loading a song or setlist step, or editing a loaded song, never writes the
    standalone state; a kill with a song loaded relaunches into the settings
    from before the song. **[recorded — coordinator ruling, owner may overturn]**
  - Clear song and Leave setlist keep the current settings, and those become
    the saved standalone state. **[recorded — lane call, owner may overturn]**
  - A ramp that was on restores at its start tempo, as a loaded song's does.
    **[recorded — lane call, owner may overturn]**
  - The saved standalone state is backed up as its own Restore category,
    Metronome. Merge reviews a differing value as a conflict; an older backup
    without it leaves the local state untouched; after a restore the restored
    state replaces an unloaded song's. **[recorded — owner approved, #378;
    reverses the earlier lane call]**
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
- **Notification transport** — tempo −/+, play/pause, stop, current BPM and
  signature, then the set and song. Not "Kitbag is running". No Prev/Next, setlist
  or not: songs step in the app only (owner, #284).
- **Shown, silent**: a DEFAULT-importance channel with no sound or vibration; the
  notification permission is asked on the first playback start (#277).
- **Ongoing and non-dismissible while running**, which is what a foreground
  service requires and what a musician wants: it is the off switch when the
  phone is in a pocket.
- **Lock-screen controls** via the platform media session; responds to headset
  buttons. The card is media-style, tied to that session, so it shows on a lock
  screen set to icons only (#284).
- **Practice timer continues** while backgrounded. A session interrupted by a
  phone call is still a session.
- **A recents swipe stops all playback** and removes its notifications; Home,
  an app switch, lock and Back keep playing (#338).
- **Interruptions** (owner, 2026-11-27, #691). Songs and stem songs (§6, §7)
  take media audio focus while playing and pause on output loss (unplug,
  Bluetooth drop), a call or a focus loss, never resuming by themselves. The
  metronome and the Play along click never take focus. The metronome pauses on
  output loss or a call; the Play along click keeps running (D10, §8.9).

### 5.7 Practice

- Write `setlistId` and `songsPlayed` — the Flutter producer never does despite
  having an active session.
- **Practice-end summary** when the session ends, not on every pause: time,
  set, songs, average tempo, longest stretch. Save or discard — the peak-end
  rule (§12.6). Longest stretch is shown in the summary only and not stored.
- **What ends a session.** Transport Stop only pauses it. The practice pill's
  **End** (in place of reset) ends it and opens the summary; leaving the
  metronome screen while stopped, with played time, also ends it. Leaving while
  playing keeps it running. A phone call or going to the background never does.

### 5.8 Acceptance

- 4h soak: zero dropped or jittered clicks. Measured by recording output and
  computing inter-click intervals with `scripts/soak-analyze.sh` (#88). The
  harness exists; **the 4h device recording has not been run.**
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

**`just_audio` is removed and nothing replaces it.** The native mixer (§4.1) is
the replacement, with the song as its one track. This is the central change:
song and click stop being two clocks and become one.

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
  to the data folder, always.
- **Downbeats** into the grid (§4.3).
- The file picker takes several files; they import one at a time, a batch waits
  on each replace prompt, and failures are named together.
- **Re-analyse** action for a song.
- Each song records the analyser version (`KB_BEAT_ANALYSIS_VERSION`) that made
  its grid. At launch, songs whose analysis succeeded on an older version
  re-analyse in the background, one at a time, through the Re-analyse path, each
  at most once per session; the song open in the player waits until it closes. A
  failure keeps the old grid and is not retried automatically; Re-analyse retries it. The meter
  override (meter, bar one) and a manual tempo (§6.3) are the user's and survive re-analysis.
- **Meter override → downbeats.** Songs and stem sets alike: the detected
  downbeats (analysis, or a stem set's bar marks) pass through the override.
  The detected meter is the most common bar length, larger on a tie. Detected
  bar one is the first downbeat, unless the first bar is shorter than that
  meter (a pickup), in which case it is the second. A meter alone makes the
  whole song that meter, counted from detected bar one. A bar one alone moves to
  the beat nearest its stored time (the earlier on a tie, clamped to the grid)
  and shifts the detected pattern after it by that many beats, each bar keeping
  its own length, so a meter map stays a map. Both together count the chosen
  meter from the chosen bar one. Bars repeat backwards to the first beat in the
  meter (detected or chosen). No override leaves the detected downbeats as they are.
- Analysis stays ambient — background, badge-driven, no "analyze" button. The
  row appears instantly with `ANALYZING` and lands on `GRID ✓` in ~10–30s. The
  user never waits on a spinner screen.
- The Dart isolate becomes a native background task, **not** a JS worker —
  see §13.5.

### 6.3 Player

- Plays through the mixer as a one-track song (§4.1), on the same transport,
  loop and follow-click as the stem player. A song and a stem song never hold
  the mixer together: opening one closes the other.
- Waveform with beat-grid ticks; tall ticks on downbeats — the analysis made
  visible. Ticks never sit closer than the lane allows: when every beat fits,
  every beat is drawn; otherwise only downbeats, at a stride of 1, 2, 4, 8… bars,
  so each tick stays individually readable.
- **No grid yet, or analysis failed:** the metronome card stays and says why,
  the click chips are muted, and the waveform is flat with no ticks. A failed
  analysis offers Re-analyse (§6.2) unless the file's format is unsupported or
  the file is missing. The song still plays; seek and loop work unsnapped.
- **Set tempo** (owner, 2026-11-27; #715;
  `docs/research/mockups/715-manual-tempo-grid.html`): with no grid, a Set tempo
  button takes the muted chips' place and the Player sheet has a Set tempo row.
  Step 1 types a whole BPM or taps along (one decimal, shown from the fourth tap,
  intervals averaged as in §8.5), 30–300 BPM (`TEMPO_MIN_BPM`..`TEMPO_MAX_BPM`),
  clamped on confirm. Step 2 marks bar 1 at the playhead, with a ±0.1 BPM stepper
  and 3/4 or 4/4. Save stores a **manual tempo** beside the analysed grid; the
  click runs on the constant grid built from it, the card reads "manual tempo",
  and Undo restores what was there. An analysed song is corrected the same way
  from "Set tempo manually" in the Player sheet only, prefilled from the analysis;
  "Use analysed tempo" switches back while an analysed grid is stored. Re-analyse
  asks first and keeps the manual tempo in use: a grid found is offered ("Use
  132"), a failure changes nothing.
- **Fix tap-to-seek.** Flutter measures the Scaffold's width, not the
  waveform's, so seek is off by the horizontal padding. Measure the waveform.
- **`.kwav` load off the UI thread.** Flutter does synchronous file I/O in
  `waveform_painter.dart:53`.
- Optional beat-snapped scrub.
- **A-B loop**, beat-snapped, equal-power crossfade 5–20ms. The loop key, drawn
  with the loop icon (owner decision 2026-11-21), marks A then B at the
  playhead, a third tap clears; the A and B handles on the
  scrub bar drag, beat-snapped.
- Speed control in the transport, driven by the same stretch stage as the stem
  player (§7.6): the stem player's range, steps and presets, saved per song and
  restored on open. Reset speed sits in the overflow menu (#528).
- **Up next row** — the stem player's Previous · Up next · Repeat · Next row
  (§7.9), built from the same parts; `design/kitbag-queue.html` §e binds it
  here too, with no separate mockup. The app bar carries the same Queue icon as
  the stem player, before ⋮ (#613).
- Tapping the Songs or Stem songs row of the open song opens its player as it
  is, still playing if it was. While another song holds the session (the
  mini-player shows it, playing or paused), any other row tap opens that
  song's player in a **view state** (owner, 2026-11-26; #616;
  `docs/research/mockups/616-view-states.html`): nothing loads into the engine
  and the playing song plays on, its mini-player docked under the transport.
  Speed, key, mix and click settings save per song at once; seek and A-B set a
  held start and loop. Up next and Stop are hidden; Export mix, master level,
  meter, tempo, retime and the click toggle wait for Play, unless the row has
  its own reason (no beat grid), which shows instead. With no song holding the
  session a row tap opens the song live, as before. Play stops the other
  song and starts this one there, and the screen becomes its player; its spoken
  label names both songs. The song player's ⋮ menu carries Play next and Add to
  queue.
- **Stop** lives in the player's overflow menu, with Re-analyse under the same
  rule. Stop ends the listening session (§7.9) and removes the mini-player. Stop
  in the song's media notification does the same.
- **Mini-player** — leaving the player, or the stem player, keeps the session,
  so the click keeps running while you open the tuner or edit a setlist. A
  docked bar shows on Home, Songs and Stem songs: a music-note or stem tile,
  title, a detail line (artist · "Next: <title>", artist · setlist · position
  for a setlist song, the artist alone with nothing up next), click state,
  Queue, play/pause, close, and a thin progress line. A tap opens the player;
  Queue opens the queue sheet (§7.9); close stops the song as Stop does.

### 6.4 Metronome lock

- Lock via `kb_metronome_set_grid` (§4.2) — follows per-beat spacing, so
  non-constant tempo works.
- Latency-compensated: click and track land together at the speaker.
- Count-in before the lock engages, under a grid (#298): the song starts on the
  frame the count ends. The count plays whether the song's click is on or off;
  with it off the click stays silent once the song starts.
- **Click settings belong to the song.** The Count-in, Click and Accent chips
  open one shared sheet at the tapped group; changes apply live and stay with
  this song, unsaved until "Save for this song". The standalone metronome's
  settings never change. The click sound is one of the engine's sounds (§13.7).
- "Save for this song" stores a preset that belongs to the song. A song with a
  saved preset opens with its click on; a song without one opens with it off.
  The preset is a `SongPreset` linked to the library song through its existing
  `librarySongId`. Linked presets stay out of every Metronome song list: All
  songs and its count, search results and a setlist's Add song sheet.
- **Play on the standalone Metronome while a song's click runs** turns the
  song's click off; the song keeps playing and its card shows click off. The
  standalone metronome starts on its own settings, untouched. Tapping CLICK OFF
  on the card turns the song's click back on, which stops the standalone
  metronome.
- **One engine metronome, settled for this player.** The song's click and
  standalone Play preempt each other, and the standalone settings never change.
  Play along has its own metronome slot in the same engine (§8.9); the song's
  click and its count-in stay on the standalone slot.

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
- **Master gain.** ~~The mixer has none.~~ **Native half done 2026-10-29**
  (#137): `kb_mixer_set_master_gain` scales the summed stems; the metronome and
  the player are outside it. **UI half done 2026-10-29** (#137): the stem
  player's Master row.
- Gain range: reconsider linear 0.0–2.0 (`mixer.h:18-19`). dB with a taper is
  the mixer convention.
- **Debounce DB writes.** Flutter's `updateGain` fires per pointer event — a
  database write per slider frame.
- **Fix the gain slider default.** ~~It renders 0.0 because `getGain` returns 0.0
  for unloaded tracks; loaded tracks must report 1.0.~~ **Native half done
  2026-10-29** (#137): `kb_mixer_gain` reports 1.0 for any in-range track until
  set, loaded or not. The stem player's per-stem fader reads it (#137).
- Rows stay ≥48dp; nothing modal mid-song; no hidden swipe-mixer.

### 7.3 Transport

- **Real pause.** ~~`Stop()` resets position to 0 and the pause button calls it —
  pause currently rewinds. Split via §4.4.~~ **Native half done 2026-07-20**
  (`4d6c89a`): the §4.4 split landed — `Mixer::Pause()` holds the position,
  `kb_mixer_stop` still rewinds, both are on the ABI. **UI half done 2026-10-29**
  (#137): the stem player's pause button calls `kb_mixer_pause`.
- **Seek UI.** ~~`Mixer::Seek` and `MixerController.seek` exist; no screen ever
  calls them. There is no scrubber.~~ **Done 2026-10-29** (#137): the stem
  player's scrubber and ±10 s keys seek through `kb_mixer_seek`.
- Fix the position display — Flutter formats frames as ms against a hardcoded
  48000. **Done** (#137): the clock converts frames at the engine rate.
- **A-B loop**, beat-snapped, equal-power crossfade. **Built** (#137): the
  loop points snap to the grid and the native loop reader crossfades on a
  sine/cosine curve.
- **Per-stem waveforms.** ~~Absent.~~ **Built** (#137): each stem row draws its
  waveform. The waveform renderer is shared UI (§13.1) — it does not live in the
  library tool.
- Metronome joins the stem mix on the same grid. **Built** (#137): the
  transport's click key follows the stem grid (D16).
- Speed and key controls; see §7.6.
- Previous, Up next, Repeat and Next; see §7.9.

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

### 7.6 Speed and key

StemDeck's two core practice controls; without them a stem player is a mixer.
**D14.**

- **Speed** 0.5×–1.0× in the transport, pitch held. Every stem is fed and
  stretched from one clock at one rate, so the stems stay sample-locked to each
  other at any speed.
- **Key** in semitones, −6 to +6 (StemDeck's range): one control for the whole
  song, plus a per-stem override. A per-stem value is absolute, not an offset
  from the song control — the number on a row is what that row plays.
- Native: one stretch instance per semitone in use (a key bus), doing both
  speed and key for the stems at that semitone; bus outputs are summed, master
  gain after. A song that has not left 1.0× and 0 has no instance and its mix is
  sample-exact; a song returned there mid-play keeps its instances until the
  next seek or stop, then the same holds. Instances are built and primed on the
  app thread and published to the callback, which starts them at one predicted
  sample; nothing allocates on the audio thread. More than four semitones in use
  put every bus on Signalsmith's `presetDefault`.
- Positions, loop points, the grid and the click stay in song time (§4.2.2).
- Mixdown export (§7.7) renders speed and key as heard.

Acceptance:

- A headless `stretch_verify` tool asserts: duration scales by 1/rate; pitch
  holds within a few cents at rate ≠ 1; a ±n semitone shift lands within a
  few cents.
- Click-vs-grid offset at 0.5×, 0.75× and 1.0× is no worse than at 1.0×
  across a full song, measured as in §6.5.
- Six stems with per-stem key play on a mid-range Android device without an
  underrun.

### 7.7 Song details

- **Sections** as cards on the Mix | Lyrics switch's second tab, with notches and a
  current-section tint on the scrub lane: tap a card to jump, hold it or use its loop
  button to loop the section.
- **Synced lyrics** follow playback, shifted by the stored offset. Tap-along
  retiming is saved per song in Kitbag.
- **Song facts:** key, BPM, tempo stability. Loudness is stored but not shown (owner, 2026-11-01).
- **Set tempo** (§6.3, #715): a stem song with no grid gets the same Set tempo
  flow, in the BPM chip's place and the Player sheet. Until #384 lands it is not
  offered on a stem song that has a grid.
- **Mixdown export:** offline render of the current mix, speed and key, out
  through the share sheet (§5.5) — never a hardcoded path. The whole song as a
  stereo 16-bit PCM WAV at the engine rate, no dither; gain, mute, solo and
  master apply, the loop and the click do not (owner, #379).

Sections and lyrics line up with playback at every speed.

### 7.8 StemDeck songs

StemDeck separates on the desktop; Kitbag plays the result. A song arrives as a
**StemDeck song bundle**, [format version 1](https://github.com/PinetheApple/stemdeck/blob/feat/song-bundle/docs/song-bundle.md): a
`.stemdeck.zip`, or the same files extracted to a folder, already on the
phone. That page defines the format; this spec does not copy it.

- **One way.** Nothing Kitbag changes goes back into a bundle or to StemDeck.
- **Version gate.** Refuse anything whose manifest is not
  `stemdeck-song-bundle` version 1, with a message that says so. Optional
  members may be missing; that is not an error.
- **Stems** are FLAC at the song's own rate: resampled on ingest (§7.1),
  loaded with `kb_mixer_load_track`. More than 16 is surfaced, not truncated
  (§7.4).
- **Peaks** convert to the `.kwav` sidecar on import (§11.2). The beat grid,
  bar marks, sections, lyrics, key and the StemDeck mix (gain, mute, solo,
  per-stem key) are stored with the stem set; the mix is applied on first
  open.
- **Re-import** of the same StemDeck job replaces the stem set after a
  confirm: Replace or Keep current. StemDeck gives a song separated again a
  new job id, so when the job id misses, a StemDeck stem set whose title (or
  song title) and artist match, trimmed and case-insensitive, and whose
  longest stem is within 2 s, is offered as the same song: Cancel, Keep both
  or Replace. The artist compared is the one the import stores: the
  manifest's, else the metadata heading's. Two different songs sharing title,
  artist and length within 2 s are offered too; Keep both is the way out. A
  song the user renamed no longer matches by title. The StemDeck song list
  applies the same rule to `/api/jobs` (title, `display_artist`, duration)
  and asks before the download: IN LIBRARY songs (same job) first, then
  matched ones with Skip, Keep both or Replace; Skip leaves out only the
  matched songs. Replace hands the matched library song to the import as its
  target; IN LIBRARY stays job-id based. Two songs in one download that match
  the same library song both offer it: the first replaces it, the second
  finds it gone and is added as a new song, so nothing is lost. The choice
  and its target are stored with each item in the import journal, so Retry
  after a restart replaces as chosen; a journal written before this loads
  its items as plain adds (#413).
- **Unfinished imports** show on Stem songs as a card that opens the import
  screen. While an import runs, the card shows its progress. Once it stops or
  ends with failed songs, the card names how many songs are left, unless the
  user stopped it. A relaunch reads an import that was running as
  interrupted. On the import screen Retry runs the songs left again and Clear
  dismisses the import; Clear is not offered, and native refuses it, while a
  song is still being added (#451).
- **A replace keeps** the user's song and stem names, speed and meter. Bar
  one and the lyric retiming are times in the old audio, so only a re-import
  of the same job keeps them (the retiming only while the lyrics are
  unchanged). The mix and per-stem key come from the new bundle's
  `mix.json`; without one, each stem keeps its saved mix and key by name and
  a new stem starts at unity. The song key, sections and grid come from the
  bundle. On failure nothing changes: the swap is one transaction.
- **Backup:** its own Restore category, Stem songs, carrying each stem song's
  settings and never its audio: rename, meter and bar one, retiming, speed,
  click grouping and rate, chosen tempo mode, manual tempo, and per stem name,
  mix and key.
  A StemDeck song matches the one on the phone with the same job id; a folder
  song matches by UUID, so only on the phone that imported it. One with no
  match is skipped, and the restore screen and report count it apart as not on
  this phone. A song with no rename in the backup keeps the phone's name. Merge
  takes the backup without asking when every setting that differs is still at
  its import value on the phone; a StemDeck song's mix and key never count as
  that, since the bundle may have shipped them. Otherwise the song is a
  conflict, and Keep mine keeps the whole song, dropping its other backup
  changes too. Retiming restores only if it fits the phone's lyrics, and a
  tempo mode only if the phone's bundle can build it; otherwise the phone keeps
  its own. Replace overwrites the matched songs
  and deletes none. An older backup leaves local stem songs untouched (#407).
- Out of scope: separation, lead/backing vocal split, lyric transcription,
  search and download — StemDeck's job, on hardware built for it.

### 7.9 Queue and Up next

`design/kitbag-queue.html` (owner, 2026-11-20; #574; D17).

- **One queue** for single songs and stem songs. Up next is Next in queue
  (songs the user added, each once, played once unless Repeat all is on, in
  the user's order), then Next from: <setlist>. `play_queue` holds a
  `stem_set_id` or a `song_id`, never both (§11.2, schema v29).
- **Entry points:** a Queue key on the mini-player (§6.3), a Queue icon on the
  stem player and the single-song player, and a Queue icon in the Stem songs app
  bar, badged with the count up next (no badge at 0). Each opens the same queue
  sheet, as does the Up next row of either player.
- **Play next** puts a song first in Next in queue; **Add to queue** puts it
  last; a song already queued offers Move to end of queue instead. Both are in
  the row menus of the Songs and Stem songs lists and in both players' ⋮
  menus. Queued rows reorder by drag and go by ✕ or a swipe; "Clear queue" asks
  first and removes queued songs only.
- **Setlist context.** A setlist is started in this listening session when the
  user loads one of its entries, metronome or stem song, during this app run;
  a setlist pinned in an earlier run is not started until then. "Next from:
  <setlist>" shows only for a started setlist. Play on a viewed song that is
  not in the setlist ends it; a list tap, viewing a song or a queued song
  playing does not (owner, 2026-11-26; #616). Starting another setlist
  replaces it;
  queued songs stay either way. Its rows keep setlist order, and ✕ skips an
  entry this time without editing the setlist. A listening session ends with
  Stop (the mini-player's close or the notification) or when the app closes.
- **Leave setlist** means one thing in the queue sheet and on the Metronome
  (§5.4): it ends the setlist context and unpins the setlist. The queue sheet
  offers Undo.
- **A metronome song** in the setlist carries a METRONOME badge. Playback stops
  before it; Open, or the notification's Next, loads it on the Metronome
  stopped.
- **At the end** playback stops. No autoplay.
- **Repeat** is a labelled chip on the Up next row and in the queue sheet's
  header, cycling Repeat off → Repeat all → Repeat one. The mode survives Stop
  and resets when the app restarts. Repeat all plays in rounds: the queue, then
  the rest of the setlist, then the songs that played from the queue (in the
  order they played), then the setlist from song 1 (owner, 2026-11-20). Those
  songs go back into the queue only when the round wraps; until then Up next,
  the queue sheet and the card show them as pending. A queued song counts as
  played only once it plays. Repeat all also wraps the Metronome's Next (§5.4).
  A setlist whose last entry (ignoring entries skipped this time) is a
  metronome song does not wrap: playback stops before it. With nothing to play
  next and no song to bring back, Repeat all plays the current song again, as a
  queue of one, even when the queued songs were deleted (#615). The Repeat all
  hint shows in the queue sheet once per install (owner, 2026-11-20). An active
  A-B loop wins over Repeat one, which acts only once the loop is cleared.
- **Previous and Next** sit beside the Up next row, on the stem player and the
  single-song player (§6.3). With nothing up next (no queued song, no next entry
  of a started setlist, no song Repeat all brings back) the row keeps only
  Previous and the Repeat chip, with no label or text; this holds under Repeat
  one too (owner, #613). Past 3 s Previous restarts the song; otherwise it goes
  to the song played before it in this session, or the setlist entry before it.
  Next plays the next entry. On the Metronome Previous always goes back an entry
  (§5.4).

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
- **Multiple sessions** — the source chip names the app and carries a live dot; it
  opens the source sheet when more than one session is live. The chip sits in
  the app bar at font scale 1.0 and on its own line under the bar above it,
  where the bar cannot hold the title, the chip and ⋮. The sheet lists music
  that is playing first, then paused music, then podcast and audiobook apps,
  which can be picked but are never picked for you; their rows use the
  `spokenAudio` icon key (MDI podcast). The order reads each session's
  `packageName`, and the chip always names the app being followed.
- **Kitbag is never a source.** No session whose `packageName` is Kitbag's own —
  the song player, the stem player or the metronome — is listed or followed.
  With only those live, Play along shows Nothing playing (§8.10).
- **Transport controls.** `MediaController.transportControls` is imported and
  never touched. Previous, Play/Pause and Next in the player dock drive the
  *song*; there is no click transport, because lock is the click's switch. There
  is no loop key: the A-B loop is Kitbag's, and the other app owns its own repeat.
  With no song to follow (permission denied, nothing playing, iOS not connected)
  the dock holds the click's own play/stop key alone.
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
- Re-anchor every 1–2s (§4.2). A constant-tempo lock (tap, a single BPM)
  re-anchors with `kb_metronome_anchor_external`. A library grid lock sends the
  stored grid once per lock through `kb_metronome_set_grid`, in song seconds,
  and re-anchors with `kb_metronome_anchor_grid` (position, frame, playback
  speed as `rate`), never by re-sending a shifted grid. A downbeat shift on
  that lock moves the bars with `kb_metronome_set_grid_downbeats`; the grid is
  still sent once per lock. The report's
  `elapsedRealtime` instant becomes `at_frame` through
  `kb_engine_frame_at_boottime` (`kitbag_engine_clock_api.h`).

### 8.5 BPM ladder

**The ladder is library beat grid → GetSongBPM → tap**, with GetSongBPM only if
the user supplied their own key (**D7**). Source always shown, always overridable,
never authoritative. The card says "via GetSongBPM · tap to change"; when the
ladder fails it names **every rung that was tried** ("Not found · Library,
GetSongBPM"), because saying which rungs were climbed is what stops the user
retrying the same thing.

- **Deezer is dropped** (owner decision, 2026-11-26). Its developer terms forbid
  a local copy of its data, and its track search returns nothing in the owner's
  region. Network rungs sit behind one source interface, so a source can be
  added without touching the ladder.
- **Match scoring.** The old lookup returned the first result with nonzero BPM
  despite a comment claiming similarity matching. Score title+artist; reject
  below threshold rather than returning a wrong-song BPM.
- **GetSongBPM is opt-in** (**D7**). A Settings row takes a personal key. No
  proxy — that is a server, a cost, a privacy surface and a single point of
  failure an offline-first GPL app should not acquire. **Never ship a shared key
  in a public repo.** Attribution obligations apply in-app and in the store
  listing whenever the tier is used: a visible link to getsongbpm.com wherever
  its BPM is shown. Recorded honestly: almost nobody will supply a key, so in
  practice the ladder is library grid → tap.
- **The offline dump is dropped** (**D8**). Delete the AcousticBrainz stub that
  returns `null` and the source it advertises at `bpm_lookup_service.dart:21`. The
  bundled 2022 dump the original research specced is not shipped and not
  downloaded.
- **The library beat grid is a real rung, and the best one.** A matched analysed
  song gives per-beat spacing, not a single number — the only rung that handles
  non-constant tempo (§8.6).
- **Cache.** GetSongBPM hits are cached as title + artist → BPM only, with a
  short TTL, so changing back to a song does not look it up again. Misses are
  not cached; a library match is always read live.
- **Tap tempo** runs on the pad when every rung failed, and from a Tap key in the
  tempo sheet, beside ÷2 and ×2, once a BPM is known; the pad then stays for
  aligning taps. Fixed: taps are counted on screen (four LEDs, filling), because
  `tap()` returns nothing until the fourth and gives no sign the first three
  landed — the button looks broken for three taps and then works. And it
  **averages intervals, not BPM values**: BPM is reciprocal to interval, and the
  mean of reciprocals is not the reciprocal of the mean, so averaging BPMs biases
  the result high.
- **Manual entry** via the metronome's numpad sheet, reached the same way (tap
  the BPM card), plus **÷2 and ×2** — half- and double-time is the specific way
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
  `kb_metronome_set_grid` once and re-anchors it with `kb_metronome_anchor_grid`
  (§8.4), so non-constant tempo works — which no BPM number can
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
- **Drift meter** replaces the tap pad once locked: it takes the pad's place, as
  the last item of the scrolling body, with the same weight. The question
  changes from "where's the downbeat" to "is it still right". It is the tuner
  strip's geometry on a ±50 ms full scale with its own colour stops
  (`DRIFT_STRIP_STOPS`): green within ±10 ms, amber by ±30 ms, red at the edges.
  Under the strip sit the phase stepper, whose value opens the Phase sheet, and
  Re-tap. Quiet inside ±10 ms; outside, the card ambers, the needle ambers, the
  meter moves to the top of the scrolling body and the tap pad grows back into
  its pinned slot. Colour is never the only signal: the needle moves, the number
  changes, the badge text changes. "Locked · 1:12 ago" is the trust signal that
  matters.
- **Nudge writes the anchor, not a label.** `phaseOffsetMsProvider` is read today
  only by the text next to it.
- **Phase has a step size**, `1 · 10 · 50` ms — 1 ms is nulling the click against
  a snare, 50 ms is catching up with Bluetooth. One granularity cannot do both:
  ±10 ms alone is forty taps to cross a Bluetooth delay, or too coarse to sit on
  the beat. The step size is set in the Phase sheet only; the screen's stepper
  uses it.
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
  mistake. On a library grid lock it moves the bars with
  `kb_metronome_set_grid_downbeats` (§4.2), never by re-sending the grid.

### 8.7 The pattern card is the metronome's

Same meter and subdivision picker chips opening the metronome's sheets, same
beat dots with the same tap-cycle. The click sound is an item in the overflow
menu that opens the metronome's sound sheet, as the metronome keeps sound off
its screen. **Play along is a metronome that follows a song; it should not be a
second dialect for saying so.** The Flutter build's time signature, subdivision
and volume controls are hardcoded (`value: 4`, `value: 1`, `value: 1.0`) with no
backing state — they call the metronome and then snap back on release. They get
real state by becoming the metronome's own components.

### 8.8 Save for this song

Writes a `SongPreset` — the same object the metronome's editor edits — matched to
the track on next play: meter, subdivision, accents, sound, and the phase nudge.
It is an item in the overflow menu, opening a sheet that lists those fields.
Tempo is deliberately **not** saved: it comes from the grid or the lookup, and a
stale number is worse than none. Play along stops being a thing you re-dial every
time.

### 8.9 Its own metronome

Play along holds a metronome slot of its own. Opening it never moves your
standalone tempo; closing it never leaves a mess to restore.

**"Its own" is a metronome slot inside the one native engine**, not a second
engine and not an app-side save and restore (`docs/decisions.md` 2026-09-26,
ruling 3; #620). One click sounds at a time: switching slots suspends the other,
and the standalone metronome resumes untouched. `kb_metronome_select_slot`
(`kitbag_metronome_slot_api.h`) routes every `kb_metronome_*` call and read to
the selected slot. Every setting is per slot, the latency offset and custom
sounds included, so Play along applies route calibration to its own slot. The
lock-screen card and the song player drive the standalone slot whatever is
selected. **The acceptance criterion:** opening Play along and closing it must
leave the standalone metronome exactly as it was, including mid-run
(`abi_verify`, slots).

**Leaving Play along while locked keeps the click following.** Following runs
under its own foreground service of the media-playback type, so switching to the
other app to skip a song does not drop the lock. Home and the lists show the
docked mini-player: the Play along tile, the track's title, a line naming the
app it is locked to, a key that pauses and resumes the other app, and a close
key. A tap reopens Play along. The service's notification, "Play along · ‹app›"
on the Metronome channel, offers the other app's play/pause and Stop, with no
tempo − or +. It has no media session, so headset buttons stay with the
followed app.

Only one mini-player shows. Starting a Kitbag song, the stem player or the
standalone metronome ends Play along's following, since one click sounds at a
time. Following also ends on the mini-player's close, as the song mini-player's
close ends the song, and when the followed session has been gone through the 10
s hold (§8.10). Pausing the other app only silences the click; the lock stays.

The single-song player (§6.4) has a narrower rule on purpose: closing a song
restores the standalone metronome's settings intact but not its run state. A
standalone metronome the song's click preempted stays stopped; it never restarts
on its own.

### 8.10 States

The mock drew a happy path. On this feature the rest are not edge cases — a phone
playing Spotify is a phone that rings, skips, buffers and serves ads.

| State | Behaviour |
|---|---|
| **Drifting** | Lock held, anchor stale. Does not silently unlock — a slightly-off click you can fix beats a click that vanished. One tap restores it. |
| **Track changed** | Unlocks. New BPM looks up. Saved preset recalls if there is one. Never carries the old lock into a new song — that is a wrong click delivered with confidence. |
| **Paused / seeked** | Click stops, lock badge stays, resumes on the beat. **Seeking backwards is the test that proves the implementation is real.** |
| **Several apps playing** | Source chip shows a count, opens the source sheet. |
| **Source went away** | Card greys, keeps last title, lock holds 10s, counted down, then drops to Nothing playing. A short grace covers app switches and buffering. |
| **Nothing playing** | Access granted and no session but Kitbag's own (§8.3). The empty state names the reason and the next action; tap tempo, the pattern controls and the click's own play key still work. |
| **Away** | Left Play along while locked. The click keeps following in the background and the mini-player docks on Home and the lists, until its close, another Kitbag click, or the source's 10 s hold ends it (§8.9). |
| **iOS** | Spotify connect card; other apps named as unsupported. Until Spotify is connected the screen is the tap-tempo metronome, with the click's own play key. |
| **Still off** | Back from the system screen without the grant. Checked on resume, so the explainer says the toggle did not take instead of opening a screen that silently does nothing. Same two buttons; after "Not now" it never nags. |
| **Permission denied** | No session card; tap pad, full pattern controls and the click's own play key. Degrades to a metronome with tap tempo. Everything not needing the grant still works, and the explainer stays one tap away rather than nagging. |

**There is no ad state** (**D10**). Spotify does not flag ads, and every
available heuristic (duration <35 s, empty artist, title changing without a
skip) would occasionally mute a real short track — interludes and intros are
music. The click keeps its lock through the ad, is wrong for 30 s, and is right
again after. Free-tier users are most users, and a temporarily-wrong click you
can see is wrong beats a tool that silently mutes your practice on a guess.

### 8.11 Acceptance

- Click stays on-beat with Spotify over a 3-minute song after one tap.
- Auto-lock works after one tap for a track matching an analysed song.
- Permission denial degrades to tap-tempo — never a dead end.
- Survives Bluetooth latency and pause/resume/skip.
- Leaving Play along while locked keeps the click on the beat in the background;
  ending it from outside the app leaves the standalone metronome untouched.

---

## 9. F5 — Plugin extensibility

### 9.1 Contract

A tool declares: `id` · `name` · `icon` · `routes` · home tile · settings schema
· the tools it requires · and optional contributions the core renders: a
mini-player, a Home subtext, a Settings section, and an entry under More in
Metronome. A **metronome extra** is a tool that adds to the Metronome: it has that
entry and no home tile. The shell aggregates and mounts them.

The Flutter `ToolPlugin` (`core_plugin_api`) is a sound shape and it survives the
framework change **as an interface** — which is the point of having had it. The
target contract (#724, #734), not today's code; the contribution type names are
placeholders until that work fixes their shapes:

```ts
export interface ToolPlugin {
  readonly id: string;
  readonly name: string;
  readonly icon: IconName;
  readonly routes: readonly RouteDescriptor[];
  readonly homeTile?: HomeTileDescriptor;
  readonly settingsSchema?: SettingsSchema;
  readonly requires?: readonly string[];
  readonly miniPlayer?: MiniPlayerContribution;
  readonly homeSubtext?: HomeSubtextContribution;
  readonly settingsSection?: SettingsSectionContribution;
  readonly metronomeEntry?: MetronomeEntryDescriptor;
}
```

`core-plugin-api` today still has `assets?: LazyAssetSpec` and a required
`homeTile`; the `ToolHost` work removes the one and relaxes the other.

A tool package's entry exports `register(host: ToolHost): ToolPlugin`. The
compiled-in path imports the package and calls it; the downloaded path calls it
after evaluating the bundle (§9.5). Both pass the same `ToolHost`, the tool's
only door to the rest of the app: named engine commands and worklet reads,
`createToolStore` (§13.4), the listening slice (the library lists, the song and
stem mini-player, the queue sheet, the up-next row and the mixer frame hook, which
the core renders and tools reuse), its own data rows, navigation scoped to its routes,
its bundle's assets, and the permissions and domain services its manifest names.

`core-plugin-api` depends on nothing but types, `ToolHost`'s included. No runtime
React, no store import, no native import; type-only React imports (`ComponentType`,
`ReactNode`) may type the listening slice. If it needs more, the contract is wrong.

### 9.2 One registry

The Flutter build has two: a hardcoded list of five plugins, and a generated
manifest that knows two and is consumed by nothing. Do not port that generator.
**Kitbag keeps one registry**, `HOME_TOOLS`: the compiled-in tools plus, on the
`github` build, the downloaded tools, listed from their verified manifests
without evaluating their code (§9.5). Home, Settings and the router read only it.
Tools are not a fixed set, so one generator is allowed: `compiledTools.ts` in
`src/app`, the static imports of every tool package that the `fdroid` and debug
builds compile in. `HOME_TOOLS` is built from it in `src/app`, never kept as a
second list. It is hand-written until #732 generates it; from then
`generate:check` drift-checks it like every generated file, and no guard is
loosened meanwhile.

### 9.3 Tools manager

Settings → Tools is the one screen that owns tool switches, reached from Settings
by a single row (settings design §03; §12.5 draws it). It lists **Built in** (the
Metronome), **Downloaded**, each with version and size, and **To download**, each
with its download size and summary; tools not yet built are not listed. Every
tool but the Metronome has an on/off switch once it is on the phone; tapping the
rest of a row opens the tool's page (§12.4). Tools does not choose Home tiles:
that is Edit on Home (§12.4; owner, 2026-11-26, #617).

**Off and Remove are different.** Off removes a tool everywhere; nothing is
deleted. Remove deletes the tool's code and keeps its data unless "Also delete
its data" is ticked, and a removed tool's page can still delete its kept data
(owner, 2026-11-27).

Each switch is stored as `tool_enabled_<id>` in preferences (`"true"` or
`"false"`; a missing key is on). Whether a tool is installed is read from disk,
never from a table (§9.5). On the `fdroid` build every tool is compiled in and
turning one on is how it is added: on first launch it writes `"false"` for every
tool but the Metronome, and on an update it does the same for each tool new to
the build, so a user's existing tools stay as they were.

### 9.4 Boundaries — enforce

These hold whatever the stack, and the lint layer enforces them (§13.6):

- Native bindings live in exactly one package.
- The abstract contract package imports neither the shell nor any tool.
- Concrete state/DI lives in one package.
- Nothing enters the core that a plugin can carry.

### 9.5 Delivery

Tools ship compiled in or as signed downloads from one source (**D18**).
`docs/research/plugin-delivery-design.md` is the design: formats, keys, the
upgrade path and the build plan. This section holds the rules.

- **What stays core.** The Metronome, with setlists, presets, practice-session
  logging and the playback card, and the listening core more than one tool
  shows: the song and stem player stores, the song and stem mini-player, the
  queue and `LibraryScreen`. Every other tool is downloadable: Tuner, Songs,
  Stem songs, Play along, Practice history and every #656 feature. The song
  player screen moves into the Songs bundle and the stem player screen into Stem
  songs. The app opens on Home.
- **Only JavaScript moves.** A bundle holds Hermes bytecode and the tool's static
  assets; nothing else is fetched for a tool. Native code, services, manifest
  entries and permissions stay in the APK. **Converting a tool** moves one of
  today's built-in tools into a bundle: its native parts stay as inert stubs only
  that tool reaches, and it alone requests their permission. A metronome extra
  ships its native half in an app release and its UI as a tool.
- **Two builds.** The `github` build, published on GitHub releases, downloads
  tools. The `fdroid` build compiles every tool in and has no download,
  verification or loading code, no downloads switch and no opt-in screen; it is
  not published on GitHub. Debug builds compile tools in.
- **Signed, from this repo only.** CI rebuilds every tool for every Kitbag
  release, signs it (ECDSA P-256) and attaches it to that release; the APK embeds
  the release's signed index, so browsing tools needs no network. Kitbag checks
  the signature and every file's hash natively, and evaluates only the bytes it
  checked. There is no unsigned load path. Private keys never enter the repo.
- **Compatibility.** A tool runs only on a Kitbag release with its `hostApi`
  major (and minor at least its minimum), a versionCode in its range, and the
  same Hermes bytecode, React Native, React, Reanimated and worklets versions.
  An incompatible tool after an app update shows "Needs an update", keeps its
  data, and updates on one tap.
- **Required tools.** A tool may require others. Install offers to install them
  together, a tool loads only when every tool it requires is installed or
  compiled in, and removing a required tool asks about the tools that need it.
  Converted tools require none.
- **Network.** Tool downloads are off on a new install and turn on only through
  the full-screen opt-in reached from Install; Settings → Tools turns them off
  after a confirm. While they are off Kitbag makes no tool request. While they
  are on, the update check runs only when Settings → Tools opens: no background,
  scheduled or start-up check.
- **Data outlives code.** Removing a tool keeps its data (§9.3), restore writes
  it with the tool absent, and converting a tool moves code, never rows, ids or
  preference keys. New tools keep key-value rows in `tool_data` through
  `ToolHost`; converted tools keep their tables.
- **Upgrade.** The release that converts a tool carries its signed bundle in the
  APK and installs it on first launch, with no network and no tap, for every
  upgrading user who has it on; one notice says so. If that install fails, one
  card installs them all on tap, opening the opt-in first while downloads are
  off. Bundled copies stay in every release until all five conversions have
  shipped and 180 days have passed since the last.
- **Routes.** A downloaded tool owns only routes under its id, and one route,
  `/t/[tool]/[...path]`, mounts them all; its errors show "<Tool> stopped
  working" with Disable and Back.
- No Play Asset Delivery (breaks F-Droid reproducible builds) and no community
  tools yet: those come later, as data packs before code.

---

## 10. F6 — Tuner

Built in Flutter (1,953 LOC) and deferred by decision. **Do not port it as-is.**
**Rebuilt 2026-10 (#117, #127)** on a new detector rather than ported; §10.1's
capture-path and pickup items still need a device.
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
> it has likely been failing unnoticed for a long time.
>
> **Resolved 2026-10-13 (#117).** Cause: `PitchAnalyzer` reset the cycfi/q
> detector on every update the note lock answered "silence", which it does for
> every frame while acquiring, so a clean tone's runs of readings (9–10 updates)
> never reached the 20 the lock needed. The detector is now a McLeod pitch method
> on 4096-sample frames under a string-aware tuning mode
> (`docs/tuner-functional-spec.md`). `tuner_verify` passes and is a CI and
> `preflight.sh` gate. That proves the closed loop only; the capture path and
> pickup items below are still open and need a device.

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

Treat the current implementation as a prototype that identified the problem, not
as a base to build on.

### 10.2 Behaviour (when built)

- Chromatic + instrument presets; auto string detection; A4 415–466Hz.
- **Hold detected notes longer.**
- **Reset on re-entry.** The in-tune green state currently persists after leaving
  and returning.
- **Custom tunings** — user-defined note lists (Drop D, DADGAD), saved.
  `TuningsDao` exists (one MIDI note per string, low first); the editor and preset
  picker do not.
- Match the design mock exactly: string pegs row (tap to lock a string, green
  ring = in tune, amber glow = detected), giant note readout, graduated red→green
  strip with a fixed centre line, Auto/A4/Chromatic chips. The built tuner does
  not.
- **Needle position carries the signal; colour reinforces.** The graduated strip
  with a centre line stays. Position + "TUNE UP ↑" text + colour = three
  redundant channels, colourblind-safe (§12.6).
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

The schema is the durable part and survives the stack change. The Flutter
build's tables were `Setlists`, `Songs`, `PracticeSessions`, `Tunings`,
`LibrarySongs`, `StemSets`, `Stems` (schema v6). The React Native schema is at v28
(`packages/core-db/src/migrate.ts`); §11.1 sets which versions it upgrades.

### 11.1 Persistence layer

| Flutter | React Native |
|---|---|
| Drift | **Drizzle ORM** over **op-sqlite** |

`op-sqlite` is JSI-backed, so queries do not cross the legacy bridge. Drizzle
gives compile-time-checked SQL and generated migrations, which is the property
Drift was providing. **Migrations are additive and non-destructive; existing user
data survives** for every database at v7 or later. The Flutter build had a different
applicationId, so its v6 database can never reach this app; the runner refuses
versions 1–6 (`DatabaseOpenError` kind `legacy-version`), and any version newer
than its own (`newer-version`), before writing anything.

### 11.2 Changes required

| Change | Reason |
|---|---|
| `SongPresets` holds presets, `Songs` holds library tracks (Flutter's `Songs` and `LibrarySongs`); both from v7 | §5.4 — the Flutter names inverted their meaning |
| `SongPresets`: + ramp config, bar-mute config, count-in, notes, per-accent sounds | §5.3, §5.4 |
| `SongPresets`: + time signature **denominator** | **D1** — new column; 2/4/8/16 |
| `SongPresets`: **no `volume` or `latencyOffset`** | **D3** — both are global rig setup; absent from v7 |
| `SongPresets`: standalone; `setlist_items` links them to `Setlists` | §5.4 — songs must exist standalone; setlists reference; from v7 |
| `SongPresets`: + phase nudge, + track identity tuple | §8.8, **D4** — `(title, artist, source, length)`, nullable library-song FK when known |
| `Setlists`: + `active` flag; a partial unique index (`WHERE active = 1`) allows at most one active row | §5.4 — one active setlist; schema v8 |
| `SongPresets`: + `polyAccents` BLOB, one `kb_accent` byte per poly slot | §5.2, §5.4 — the poly row has its own accent states and they round-trip; schema v8 |
| `PracticeSessions`: + `uuid`, backfilled, unique index, triggers refuse NULL on insert/update | §12.4 — sessions are exportable rows; `startTime` is not an identity (two sessions can share a second); schema v9 |
| `SongPresets`: v9 repairs rows the engine would refuse — clamps bpm, beats per bar, subdivision, sound, poly beats, ramp start/end bpm, ramp bars and mute play/mute bars to engine bounds (integers rounded); resets a denominator outside 2/4/8/16 to 4; pads or trims accents to the bar and poly accents to the poly beats, reading unknown codes as normal (Flutter's own reading); clears mis-sized poly accents and per-accent sounds that are not 0 or 2 valid sound ids | §5.4 — every stored preset loads and round-trips through backup; schema v9 |
| `Tunings`: + `instrument` (`KB_TUNER_INSTRUMENT_*`, default guitar) | §10.2 — selects the in-tune window; schema v10 |
| `Tunings`: v10 drops rows the tuner can never load — no strings, more than `KB_TUNER_MAX_STRINGS`, or a note above MIDI 127 | §10.2 — every stored tuning loads and round-trips through backup; schema v10 |
| `preferences`: key-value table (`key` TEXT primary key, `value` TEXT NOT NULL); first key `last_tool` | §12.4 — Continue tracks the last-used tool across restarts; schema v11 |
| `SongPresets`: `ramp_bars` INTEGER becomes `ramp_length` REAL (a table rebuild), + `ramp_unit` (`kb_ramp_unit`, default bars) and `ramp_loop` (default off) | §5.4, §5.8 — a seconds or minutes ramp and its loop round-trip like any other field; existing rows and older v4 backups (`rampBars`, no unit) read as a bar ramp without loop; schema v12 |
| `SongPresets`: + `ramp_step` REAL (BPM per interval, signed, default 1); `ramp_length` now means the interval, not the whole ramp | §5.3, **D15** — stepped ramps; a v4 backup without `rampStep` reads as a step of 1; schema v13 |
| `Songs`(library): + downbeat indices | §4.3 |
| `StemSets`: + `source` (`folder` \| `stemdeck`), + `stemdeck_job_id` (unique when set), + key, scale, BPM, loudness, tempo stability | §7.8 — a re-import of the same StemDeck song replaces it instead of duplicating |
| `StemSets`: + beat grid (Float32 BLOB, as `Songs`) + bar marks (`beat`, `beats_per_bar`) | §7.8, §4.2 — the grid StemDeck's click used, edits applied |
| `StemSets`: + sections, + lyrics (synced LRC, plain, offset, user retiming) | §7.7 |
| `StemSets`: + speed; `Stems`: + pitch (semitones) | §7.6 — mix state is per song, like gain/mute/solo |
| `StemSets`: + `renamed` (default 0); `Stems`: + `name` (display name, NULL shows the role) | §7.1, §7.8 — a rename is display-only and survives a re-import of the same StemDeck song; schema v17 |
| `SongPresets`: + `poly_against` INTEGER (0 = the bar, 1..16), default 0 | §5.2 — poly N against M; a v4 backup without `polyAgainst` reads as the bar; schema v18 |
| `route_latency`: + `name` TEXT, + `kind` TEXT (the route's display name and `OutputRoute` kind when calibrated) | §12.5 — the Output & latency sheet lists calibrated routes that are not connected; schema v19 |
| `Songs`: + `analysis_version` INTEGER (NULL = no version reported, counted as outdated), + `meter_beats_per_bar` INTEGER (3 or 4; NULL = the detected meter), + `bar_one_seconds` REAL (NULL = the detected bar one); `StemSets`: + `meter_beats_per_bar`, + `bar_one_seconds`, same meanings | §6.2 — older grids re-analyse in the background; the meter override survives re-analysis and a stem re-import, bar one only a re-import of the same StemDeck job; schema v20 |
| `StemSets`: + `click_grouping` TEXT (JSON int array; NULL = no grouping), + `click_rate` TEXT (`single` \| `double` \| `half`, default `single`); kept on a re-import of the same StemDeck song | #383 — click grouping and rate per stem song; schema v21 |
| `StemSets`: + `tempo_mode` TEXT (`constant` \| `follow`), + `tempo_bpm` REAL, + `tempo_anchor` REAL (seconds), + `tempo_beats_per_bar` INTEGER, + `tempo_source` TEXT (`detected` \| `user`) — the StemDeck bundle's `tempo`, all NULL when the bundle has none, bpm and anchor NULL for a follow tempo StemDeck detected none for; + `chosen_tempo_mode` TEXT (NULL = the bundle's mode), kept on a re-import when the new bundle can build it | #384 — constant tempo or follow the band per stem song; schema v22 |
| `click_sounds`: slot INTEGER primary key, `uuid`, `name`, `file_name` (the prepared WAV in app-private storage, fresh on every write) | §5.3 — custom click sounds; the UUID is the sound's identity for backup Merge and the restore's Tick rule; schema v23 |
| `setlist_items`: + `stem_set_id` (FK to `stem_sets`, cascade), `song_preset_id` nullable, a CHECK that exactly one is set (a table rebuild); `play_queue`: `stem_set_id` (unique, FK cascade), `position` | #382 — a setlist holds stem songs beside metronome songs, and stem songs queue to play next, each once; a re-import moves both to the new stem set; schema v25 |
| `play_queue`: + `song_id` (unique, FK to `songs`, cascade), `stem_set_id` nullable, a CHECK that exactly one is set (a table rebuild) | §7.9, #572 — one queue holds single songs beside stem songs, each once; schema v29 |
| `Songs`: + `tempo_mode`, `tempo_bpm`, `tempo_anchor`, `tempo_beats_per_bar`, `tempo_source`, `chosen_tempo_mode`, the `StemSets` columns of v22 with the same meanings; `tempo_source` gains `analysed`, Kitbag's own constant-tempo fit, stored as a `follow` tempo (bpm and anchor NULL when the fit found no steady tempo). A stem song whose bundle has beats but no tempo gets an `analysed` fit once, on import or at the next start. Backups carry a song's fit and chosen mode; a Merge difference in the fit alone is not a conflict | #474 — constant tempo or follow for songs Kitbag analyses; schema v30 |
| `SongPresets`: `bpm` nullable (a table rebuild): a song preset saved by Play along carries no tempo (§8.8) | #671; schema v31 |
| `Songs`, `StemSets`: + `manual_tempo_bpm` REAL, `manual_tempo_anchor` REAL (bar 1, seconds), `manual_tempo_beats_per_bar` INTEGER (3 or 4); all NULL = no manual tempo. Never written by analysis, so the analysed grid stays beside it; a stem re-import keeps it only for the same StemDeck job. Backups carry it as optional fields, with no format version change | §6.3, #715; schema v32 |
| **All paths relative** to the data folder | §2.3 (iOS) and **D11** (the folder can move between internal storage and an SD card) |
| `PracticeSessions`: write `setlistId`, `songsPlayed` | §5.7 — columns exist, producer never fills them |
| BPM cache table | §8.5 |
| Per-output-route latency calibration | §12.5 |
| Global subdivision-accent patterns, keyed by subdivision count | **D2** |
| UUIDs on exportable rows | §12.4 — merge needs stable identity. NOT NULL from v7; `practice_sessions` backfilled at v9; **D12** accepts the first-merge duplicate. |

Beat grids stay Float32 BLOBs of per-beat timestamps (handles tempo drift).
Waveform peaks stay `.kwav` binary sidecars. Neither crosses into JS as a buffer
during playback — the grid goes to `kb_metronome_set_grid` and the peaks go to
the renderer, once, off the UI thread.

### 11.3 Unblocked

All three decisions this schema was waiting on landed 2026-07-17: **D1**
(denominator column), **D2** (global subdivision accents, so no per-song table),
**D3** (drop `volume`/`latencyOffset`), **D4** (track identity tuple). §11.2 is
buildable as written.

One migration note that is not obvious from the table:

- **`SongPresets` gains a nullable FK to the library song** alongside the D4
  identity tuple. When a track later joins the library, the preset migrates from
  tuple-matching to id-matching. That transition is a migration, not a lookup.

---

## 12. Design

`design/` holds the binding design files, and their precedence is explicit:

| File | Scope |
|---|---|
| `kitbag-ui.html` | **The foundation.** Tokens, components, the 9-screen survey, key flows, and §06 experience rules. Everything below inherits from it. |
| `kitbag-metronome.html` | Supersedes the metronome section of `kitbag-ui.html`. Adds setlists, setlist detail, preset editor, four sheets, the numpad, practice summary, notification/lock screen. |
| `kitbag-playalong.html` | Supersedes the Play-along section (owner-approved 2026-11-26; #618). Draws the states and sheets of §8.10, the source sheet and the away mini-player. Recorded in `docs/decisions.md`, 2026-11-26. |
| `kitbag-settings.html` | Designs Settings, latency calibration, restore. **Supersedes exactly one §06 card** — "Settings stay contextual" — and nothing else. |
| `kitbag-data-folder.html` | **The Data folder** (D11; #170). Supersedes, in `kitbag-settings.html`, the Data folder row's value in Settings → Data and the Storage sheet's Location line; the rest of that file stands. Adds the Data folder chooser, and draws the move (confirmation, progress, cancel, the paused banner on Home), its failures, the Songs list during a move, and songs on a missing SD card. Recorded in `docs/decisions.md`, 2026-11-19. |
| `kitbag-metronome-b.html` ("Chosen") and `kitbag-metronome-status.html` (variant A, Q6 pulse marks, poly row) | Owner-approved layout B (#175). **Supersede the metronome screen in `kitbag-metronome.html` §02, and §03's sheets and numpad, where they differ**, except sizes and vertical layout, which the #243 frame in `kitbag-metronome.html` §02 sets. §02's setlists, setlist detail and preset editor, and §04 onward, stay binding. Recorded in `docs/decisions.md`, 2026-10-30; `docs/research/metronome-b-parity.md` is the value table. |
| `kitbag-metronome-setlist.html` | **D2 only** ("Chosen (owner, 2026-10-30)"; #205). Supersedes the app bar in `kitbag-metronome-b.html` while a setlist is active, and adds the setlist song-list sheet. Options A–D are rejected alternatives. Recorded in `docs/decisions.md`, 2026-10-30. |
| `kitbag-metronome-poly.html` | **A and the main-screen poly row only** ("Chosen (owner, 2026-10-31)"; #203). Supersedes the Polyrhythm section of the Practice sheet in `kitbag-metronome-b.html` and the poly row in `kitbag-metronome-status.html`, and adds the song editor's Poly and Against rows. Options B and C are rejected alternatives. Recorded in `docs/decisions.md`, 2026-10-31. |
| `kitbag-metronome.html` §02, "Metronome — vertical layout and control sizes" | **#243 only** (owner-approved 2026-10-31). Supersedes the main screen's control sizes and vertical layout in `kitbag-metronome-b.html`, `kitbag-metronome-status.html` and `kitbag-metronome-poly.html`; their colours, glyphs and content stand. Recorded in `docs/decisions.md`, 2026-10-31. |
| `kitbag-metronome-unsaved.html` | **Option A** ("Chosen (owner, 2026-10-31)"; #212). Extends the song chip in `kitbag-metronome-setlist.html` D2 with the unsaved-changes dot, adds Save and Revert to that file's song-list NOW row and to the loaded-song sheet, and adds the "not saved" snackbar with Undo. Options B and C are rejected; `docs/research/mockups/212/` keeps them for reference. Recorded in `docs/decisions.md`, 2026-10-31. |
| `kitbag-library.html` | **Variant B only** ("Two tiles, two screens"; #178). Supersedes `kitbag-ui.html` §04's Home tiles and Library: Songs and Stem songs are separate screens. Variant C is a rejected alternative. From variant A only the filter menu binds: the Songs filter icon opens it (filter by analysis status; sort by title, date added, BPM). `docs/decisions.md` (2026-10-30, #178) lists what is deliberately not built. |
| `kitbag-stems.html` | **Variant C only** ("Bottom dock"; #137). Supersedes `kitbag-ui.html` §04's Stem player. Variants A and B are rejected alternatives; `docs/decisions.md` (2026-10-30, #137) lists what is deliberately not built. |
| `kitbag-stems-sections.html` | **Option C only** ("Chosen (owner, 2026-11-01)"; #139). Extends `kitbag-stems.html` variant C with the Mix \| Lyrics switch, section cards, lane notches and tint, stage lyrics and retime mode. Options A and B are rejected alternatives, kept in `docs/research/mockups/stems-sections-lyrics.html`. Retime's 0.75× subtitle is built (#299); its speed stepper is not (#328). Recorded in `docs/decisions.md`, 2026-11-01. |
| `kitbag-song-player.html` | **The single-song player** (owner-approved 2026-11-07; #297). Supersedes `kitbag-ui.html` §04's Player. Draws the base player, the mini-player on Home and Songs (Stem songs and the Queue key: `kitbag-queue.html`), the Metronome's click-off snackbar, the click sheet, speed (owner-approved 2026-11-20, #528: speed only, in percent, Reset speed in the overflow menu, the speed on the mini-player off 100%), the no-grid states and the A-B loop. Recorded in `docs/decisions.md`, 2026-11-07. |
| `kitbag-queue.html` | **The play queue** (owner-approved 2026-11-20; #574). Draws the queue sheet (queued songs, a setlist started this session, swipe to remove, nothing playing, empty), Play next and Add to queue, the mini-player's Queue key and its place on Stem songs, the Stem songs app-bar Queue icon, the stem player's app-bar Queue icon and its Previous · Up next · Repeat · Next row (the single-song player takes the same Queue icon, #613), a mixed setlist, Repeat, and filled Previous and Next keys on the Metronome. Adds the Up next row and the Queue icon to `kitbag-stems.html` variant C (the row was built without a binding design); the single-song player takes the same Up next row with no separate mockup (§6.3). Supersedes the mini-player's keys and placement in `kitbag-song-player.html` §1 and the flat skip keys in `kitbag-metronome-setlist.html` D2. Frames draw stem songs; single songs share the queue (§7.9). §f's Before and §i's Superseded frames are not to build. §g's Up next row with a metronome entry next is superseded: the Repeat chip and Open go on a second line, and the source keeps the setlist position (#632, `docs/research/mockups/632-up-next-metronome-entry.html`). Recorded in `docs/decisions.md`, 2026-11-20 and 2026-11-26. |
| `kitbag-practice-history.html` | **Practice history** (owner-approved 2026-11-07; #286). Draws the session list with Day, Week and Month grouping and its graph, swipe and menu delete with Undo, the Settings doorway and swipe-direction row, the optional Home tile, and the session timeline with Repeat. The ⋮ menu is built as the app's bottom sheet, not the pop-up drawn. Recorded in `docs/decisions.md`: picks 2026-11-02, mockup approved 2026-11-07. |
| `kitbag-home-arrange.html` | **Option B only** ("Chosen (owner, 2026-10-31)"; #113). Supersedes the "long-press any tile for edit mode" bullet in `kitbag-ui.html` §04 Home and §12.4's customizable-layout bullet as to *how* editing works: Edit, or a long-press on a tile, opens the Arrange sheet. Options A and C are rejected alternatives, kept as reference in `docs/research/mockups/113/`. Recorded in `docs/decisions.md`, 2026-10-31. Its B1 and B5 frames, which drew the More tools row and sheet (#617), are superseded by `kitbag-tools.html`. |
| `kitbag-tools.html` | **Downloadable tools** (owner-approved 2026-11-27; #657). Draws Home and the More tools row and sheet with tools to download, Settings → Tools, a tool's page before and after install, installing and its failures, the downloads opt-in and its off confirm, removal with data kept, offline and downloads-off states, the `fdroid` build's Tools screen, tools that need an update after an app update, and the upgrade that moves today's tools out of the app (the one-time notice and the fallback card). Supersedes the More tools row and sheet in `kitbag-home-arrange.html` B1 and B5 and in `kitbag-ui.html` §04, and the Tools manager in `kitbag-settings.html` and `kitbag-ui.html` §04. Versions, sizes and counts in it are illustrative. Recorded in `docs/decisions.md`, 2026-11-27. |

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
| `text2` | `#BDBBC6` | `#433F4B` |
| `text3` | `#9793A2` | `#6C6573` |
| `decor` | `#6C6878` | `#98929F` |
| `accent` | `#FFB347` | `#B26F0E` |
| `accentDeep` | `#E89B2E` | `#80510B` |
| `accentDim` | `#8A6A35` | `#D8B27C` |
| `onAccent` | `#221600` | `#FFF7EA` |
| `red` (flat) | `#FF5C5C` | `#CC4444` |
| `amber` | `#FFC24B` | `#9A6E06` |
| `green` (in-tune) | `#4ADE80` | `#1E8A4F` |
| `redInk` | `#FF5C5C` | `#A82E2E` |
| `amberInk` | `#FFC24B` | `#785505` |
| `greenInk` | `#4ADE80` | `#17683C` |
| `wave` | `#4E4A5E` | `#C9C3B4` |
| `waveHot` | `#FFB347` | `#B26F0E` |

Rules that come with them:

- **One brass-amber accent** — a musician's material (cymbals, horns, tube glow)
  — reserved for *active/on-beat* states. Semantic red/amber/green is a separate
  channel and **never doubles as accent.**
- Dark text is off-white; **pure white halates on OLED.**
- **Elevation = lighter surface, not shadow.**
- Text under 18sp holds 4.5:1 against every ground it sits on, in both themes.
- `text`, `text2` and `text3` stay at least 1.5:1 apart from each other. That floor is
  set by dark, where `text2` sits at 1.58:1 over `text3` and 1.59:1 under `text`. Light
  reaches the 1.8:1 `text2` step over `text3`, with `text` 1.59:1 above `text2`.
- `decor` is for non-text marks only: icons that read as quiet or disabled, dot and
  swatch borders, switch knobs, slider ticks. Text never uses it. It is an accepted
  exception to the 3:1 non-text bar in both themes, down to about 2.3:1 (light, on
  `surface3`), kept so these marks look as they did before #189.
- `text3` sits only on `bg`, `surface1`, `surface2`, `activeCardFill` and the setlist
  NOW row fill; never on `surface3`, `activeControlFill`, or the set chip, selected tile
  or stem tile fills.
- `accent` is for fills and icons. Accent-coloured text uses `accentInk`: `accent` in
  dark, `accentDeep` in light. An `accent` fill that carries text uses `accentTextFill`
  (the same split), so `onAccent` holds 4.5:1 on it; fills with only icons keep `accent`.
- Red, amber and green used as text take `redInk`, `amberInk` and `greenInk`, darker in
  light and equal to the base token in dark. Fills, icons and borders keep the base token.
  Dark red text stays off `activeControlFill` and the set chip, selected tile and stem tile
  fills, where it is under 4.5:1.
- Accent icons hold 3:1 on every ground; on an accent-tinted fill that needs `accentInk`.

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
  **Built** (#111, #127): Continue tracks the last-used tool across restarts.
- **2×2 tool tiles with live subtext** (current BPM, tuning, library count).
  **Built** (#111, #127).
- **No bottom-nav**: it caps at ~5 destinations and Kitbag will outgrow it; a hub
  scales with the plugin roster.
- **Customizable layout**: sensible fixed order by default. Edit, or a long-press
  on any tile, opens the Arrange sheet (`kitbag-home-arrange.html`): reorder by
  drag handle only, resize (1×1 ↔ 2×1), hide/show. The grid itself never moves
  under a finger.
- **More tools** (#617; `kitbag-tools.html` 0–1, 7e): one row after the row tools.
  It opens a sheet of the tools that are on but hidden in Arrange, then **To
  download**; a hidden tool's row opens the tool, a To download row opens its page.
  The subtitle counts both ("1 tool · 4 to download"; on a fresh install "N tools
  to download · Tuner, Songs and more"), and the row is gone when it has nothing to
  list. With downloads off the sheet shows one quiet row in place of the list and
  Home shows no download count. An installed Practice history starts hidden. A tool
  that is off is in neither the grid nor More tools, and Home never lists a tool
  twice. Discovery stays in this row: Home gets no section or banner for tools to
  download, and downloaded and built-in tiles look the same.
- **A downloaded tool's subtext** is its manifest summary until the tool has been
  loaded.
- **A tool that cannot open yet keeps its tile, muted**: "Needs update to run"
  after an app update, under one "Update all" card (§9.5); "Install to open", with
  its data count, after an upgrade whose bundled install failed, under one "Install
  all" card; progress in the tile while it installs or updates.

**A tool's page** (`kitbag-tools.html` 3–6) is the only place a tool installs
from. Before install it states what the tool does, its download size and size on
the phone, the Kitbag release it was built for, its source and signer, its
permissions and when each is asked, the tools it requires (§9.5), and what it adds (a Home tile after the
others, or an entry under More in Metronome), with Install in a bar at the
bottom. The first Install on the `github` build opens the downloads opt-in
(§9.5). A new tile goes after the last Home tile with no "New" badge. A file
that fails the check is deleted, never kept; "Not enough space" quotes the size
on the phone. Installed, the page shows the space used by the tool and by its
data, and Remove (§9.3), whose confirm starts with "Also delete its data"
unticked. When a tool's update needs a newer Kitbag, the page says to update
Kitbag where it was installed: the app cannot update itself.

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
- **Replace keeps one copy first.** In the same transaction, before it changes
  anything, Replace stores a full backup of the current data in the database; a
  copy that cannot be made, or would not restore, refuses the replace and
  nothing changes. One slot: the next Replace overwrites it. The copy opens in
  the Restore review as a Replace of the categories it replaced. Its entry
  point is not built yet (#718).
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
  100 BPM click and becomes `■ Stop · 100 BPM`. **Volume and subdivision accents
  are meaningless as numbers** — they are things you hear. Without this, Rig is a
  form you fill in blind, which is exactly what it is today. It stops on leaving
  and does not touch the metronome's own state. **Latency is the exception**: a
  constant offset is unobservable on a free-running click (§4.7), so the Rig click
  sounds the same at any value. It is set by calibration (§12.5.1) or by ear
  against a track.
- **Volume has a detent at unity.** Range 0–200% (`maxVolume = 2`), so 100% is
  dead centre — the one value you want to return to. The tick is visible and the
  thumb catches. Past ~150% the fill turns red rather than the app policing it;
  the readout still says `150%` and the tick is positional (colour is not the only
  signal).
- **Latency is a stepper, not a slider.** 1 ms per tap, long-press to repeat.
  **Range ±300 ms** (D5) — the Flutter build's slider was `divisions: 20` across
  ±100 ms, which is **10 ms a step, a third of a semiquaver at 120 BPM**: audible, not fine
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
  pattern you set for `♬` applies to every song using `♬`. The engine plays
  these patterns (D2, #170). The patterns are stored as preferences and replayed
  to the engine at launch and on every edit (#170).
- **Volume and latency are the only rig settings, and they are global** (**D3**).
  No per-song override; `SongPresets` carries neither column. Volume per song is
  genuinely lost — the quiet acoustic number in a loud set needs this slider.
  Accepted, and it is the reason the Rig section has to be good.
- **Tools** (`kitbag-tools.html`; §9.3 has the rules). The Settings row reads "N on",
  plus "· M to download" on the `github` build. The intro reads "Turn a tool off to
  hide it everywhere. Nothing is deleted." and the note "Choose Home tiles with Edit
  on Home. Other tools are under More tools." (#617). Then, in order: **Updates**,
  the check's one line ("Checking for updates…", "Up to date. Checked just now.",
  or that the phone is offline), shown with downloads on; tools that need an
  update, with Update per tool and Update all; **Built in** (Metronome, "Core");
  **Downloaded**; **To download**, which with downloads off says so and stays
  listed; and **Downloads**, the "Tool downloads" switch. Check results show only
  here and nothing downloads until a tap. After a failed bundled install, "You used
  these before" heads the list. The `fdroid` build has neither Updates nor
  Downloads. Off is separate from Home's Hide; `docs/decisions.md` has the ruling.
- **Practice opens the history** (#286). The row shows sessions, total time and
  average tempo, with a chevron to the practice history
  (`kitbag-practice-history.html`). Appearance adds the swipe-to-delete
  direction, which applies to that list only.
- **Data folder** (**D11**). The row names the volume in use and its free space
  ("Internal storage · 41.2 GB free"). Song audio, stems and waveforms resolve
  against it, and every stored path is relative to it (§11.2). The database and
  analysis scratch stay private to the app. The choices are Kitbag's own folder
  on internal storage or on a portable SD card, listed as volumes; there is no
  system folder picker. Changing it moves the files.
- **Storage is its companion, not its replacement.** It reports what is on disk
  and where, and offers "Remove missing files". Storage reports; Data folder
  relocates.
- **Theme and haptics are new**, and they are the cheapest rows here.
- **Backup:** Rig is its own Restore category, on by default: volume,
  subdivision accents and every route's latency. Replace keeps this phone's own
  latency for a built-in route it has measured (speaker, earpiece, wired: no
  device identity) and takes the backup's for Bluetooth and the rest. Merge
  reviews a route measured differently as a conflict (#718).
- **Backup:** Appearance and Home is its own Restore category, on by default:
  theme, haptics, keep awake and the Home layout. The GetSongBPM key is never in
  a backup. Both categories apply on restore without a restart (#718).
- **Data moves through the system.** Backup goes out through the share sheet
  or the system save dialog, restore comes in through the picker. **Kitbag writes to no path of its own
  choosing.**
- **Attributions is not optional**: `kitbag-ui.html`'s footer promises "BPM data:
  GetSongBPM (attribution in-app)". Licence and source are table stakes for
  GPLv3 and, per §12.1, part of the brand.
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
  than producing a bad one — "no dead ends" means explaining, not guessing. A tap
  is usable within ±250 ms of the run's median deviation, taken after unwrapping
  the taps around their circular mean, and then within 2.5 SD (decisions.md,
  2026-10-31, calibration window); a mean past ±300 ms is refused as at the
  limit, and so is a steady run (SD ≤ 30 ms) within one SD of it, while an
  unsteady one inside it gets "Use anyway". At 100 BPM a steady route past
  ±300 ms cannot be told from one a beat away, so with a tight spread it is
  stored as the nearer offset: +320 ms reads as −280 ms (accepted by the owner).
- The stepper stays for people who know their number: every gesture has a visible
  twin, and calibration is the gesture here.

**Unblocked (D5).** ±100 ms could not express a Bluetooth offset, so the
calibration screen would have measured offsets it was unable to apply. The range
is now ±300 ms. The lookahead check ran 2026-07-17: there is no window, the
offset is a phase bias, and the two latency bugs the check exposed are fixed and
pinned in `metronome_verify` (§4.7). The engine clamps at ±300 ms.

### 12.6 Experience rules — acceptance criteria, not aspirations

From `kitbag-ui.html` §06. Distilled from NN/g, Android haptics/a11y guidelines,
Laws of UX, and Mobbin pattern research. Each is testable and gets checked per
milestone.

- **Sound in 5 seconds, no tour.** The app always opens on Home, and the Continue card
  or the Metronome tile reaches a working metronome in one tap. No
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
  → row appears instantly with `ANALYZING` → `GRID ✓` lands in background
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
| `kitbag-settings.html` §03 | **Data folder is not cut.** It returns as an authoritative setting; Storage becomes its companion, not its replacement. | D11 |
| `kitbag-metronome.html` §02 | `7/4` **went back to `7/8`** — the denominator is being built, so the mock's original claim is buildable. | D1 |
| `kitbag-metronome.html` §02 | LEDs are a **row with grouping, up to 8 per line, wrapping at a group boundary**. Resolves the file's own "knowingly untrue" flag — and the build's circle is what changes, not the mock. | D9 |
| `kitbag-playalong.html` §01–§16 | **Delete the ad state.** | D10 |
| `kitbag-playalong.html` §20 | Phase sheet shows the **total** (`+190 ms total · 180 route + 10 song`). | D6 |
| `kitbag-metronome.html` §05 | Close both open questions: volume/latency are global (**no** preset-editor override, so the editor is already right); subdivision accents are global. | D2, D3 |
| `kitbag-settings.html` §06 | Latency open question closed (2026-10-31): **±300 ms, clamped by the engine.** | D5 |
| `kitbag-playalong.html` §20 | "±100 ms appears three times" closed (2026-10-31): latency ±300 ms engine-clamped, phase ±½ beat, downbeat in beats. | D5 |

**Designed, needs states:**

- **Stem player**: loading · resampling · unsupported file · >16 tracks.
- **Library**: analysis failed · unsupported format · missing file.
- Empty states as CTAs throughout.

(Play along's states are done: `kitbag-playalong.html` §01–§16.)

**Not designed:**

- **Standalone song library** — the metronome spec draws the entry point (the
  "All songs" row) but not the screen behind it.
- **GetSongBPM key row** (D7) — built in #689 from the existing Settings row and
  text-entry sheet patterns, last row of Data, with no mockup. Its placement and
  copy have not had a design review.

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
| `app-shell` | Expo entrypoint, router, plugin registry, home hub, the `ToolHost` object, the listening UI | everything; only `src/app` (and `runtime/transportRuntime.ts`, for the Metronome) imports tool packages |
| `core-plugin-api` | Abstract plugin contract and `ToolHost` — types only | nothing |
| `core-native` | **The only** package that touches JSI/TurboModules | `core-plugin-api` |
| `core-state` | Zustand stores, tool-owned ones through `createToolStore` (§13.4); the concrete DI layer | `core-native`, `core-db`, `core-plugin-api` |
| `core-db` | Drizzle schema, migrations, DAOs | `core-plugin-api` |
| `core-design` | Tokens, theme, shared components (incl. the waveform renderer, LEDs, steppers, sheets, numpad) | `core-plugin-api` |
| `tool-metronome`, `tool-library`, `tool-stems`, `tool-sync`, `tool-tuner` | Plugins | `core-*` (except downloadable ones), never each other, never `app-shell`. A downloadable tool is marked by a field in its `package.json`, added when the tool converts or present from the start in a new tool; it reaches the app only through `ToolHost` and imports only the allowlist (`docs/research/plugin-delivery-design.md` §2.3): the app's copies of React, Reanimated, worklets, Gesture Handler and SVG, a curated `react-native`, `core-design`, and `core-plugin-api` types |
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
  `frames_rendered`, `tuner_snapshot`, `mixer_position`) go through a **JSI
  HostObject** that calls straight into the C ABI, synchronously, with no
  serialisation. This is the direct analogue of the Dart FFI call it replaces.
  `mixer_position` is the read the transport polls; `player_position` is bound
  but nothing polls it.
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

**Zustand**, created only in `core-state` — the direct analogue of §9.4's
"concrete DI/providers live in one package" and enforced the same way. Chosen over
Redux for the same reason Riverpod was chosen: stores are small, colocated, and
have no ceremony.

Rules:
- Realtime values are **not** in the store (§13.3).
- The store owns command dispatch and persisted state, not audio truth. The
  engine is the source of truth for what the engine is doing; the store must not
  keep a shadow copy it believes over a poll.
- Play along holds its own metronome state (§8.9).
- **Tool-owned stores** are created through `host.store.createToolStore(initial)`,
  which core-state implements, so a tool package never calls `create()` (§9.1).
  The stores a converted tool takes with it (`tuner`, `stemDeck`, `playAlong`,
  `tempoLadder`, `mediaSessions`) keep the preference keys they persist under.
  Realtime values stay out of these too: a tool reads the engine in its own frame
  callback through `ToolHost`'s worklet reads (§13.3).

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
| Riverpod providers only in `core_services` | Zustand `create()` only in `core-state`; tool packages use `createToolStore` |
| `core_plugin_api` must not import `app_shell` or `tool_*` | same, by package name |
| PascalCase filenames and class names | PascalCase for component files; camelCase for hooks/utils |

Plus `eslint-plugin-boundaries` for the import graph in §13.1, which is cheaper
than hand-rolling it. A zone restricts the packages marked downloadable (§13.1),
and only those, to §13.1's allowlist; the tool build and the runtime shims refuse any other import again.
The eval harness gets a fail scenario for a tool that writes an engine read into
its store or `useState` from a frame callback.

**The eval harness ports with the rules.** `packages/app-shell/eval/` scores lint
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
| Router | Expo Router (file-based), wrapping React Navigation. Tool routes register through §9.1's `RouteDescriptor`; downloaded tools mount under one route (§9.5). |
| Native build | The existing CMake for `native/audio_core` is consumed by the Android Gradle `externalNativeBuild` and an iOS podspec. **The C++ does not move.** |
| Styling | **NativeWind 5 (preview) + Tailwind v4**, consuming §12.2's tokens. NativeWind 5 has not shipped GA — the reference pin is `nativewind@5.0.0-preview.3` with `tailwindcss@^4`, `@tailwindcss/postcss`, and `lightningcss` held at `1.30.1`. A pre-release dependency is a material fact on the F-Droid path, where the whole argument rests on one precedent's recipe. The tokens stay the single source of truth — §13.8.1. |
| Waveform rendering | `react-native-svg` elements with Reanimated animated props (UI thread). Skia was measured and not taken: see the 2026-11-21 entry in `docs/decisions.md`. |
| Animation | Reanimated 4 (§13.3) + Gesture Handler for swipe-anywhere. |
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
- **SVG ignores all of this.** The waveform renderer (§13.8, above) reads tokens
  from the TS export directly. Tailwind has no reach into an SVG element's animated props.

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
  *shipped app* phoning home at runtime undisclosed. §9.5's Play Asset Delivery
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
   likely to be underestimated.** Built: `PlaybackService` (#87, #177, #237) carries the
   metronome, stem songs and single songs; its Stop ends the listening session
   (§7.9).
2. **Notification listener** (§8.2) — the existing `MediaSessionPlugin.kt` and
   `NotificationListenerService`, ported from a Flutter plugin to a TurboModule.
   The Android logic is correct and survives; §2.3's `requestPermission` lie and
   §8.4's missing `lastPositionUpdateTime`/`playbackSpeed` are fixed in the port.
   Ported in core-native (#619): `media/MediaListenerService` and the
   `KitbagMediaSessions` TurboModule. Not yet verified on a device, so
   `legacy/android/` stays as the reference until it is.
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
| **Native, new** | Mixer test (`mixer_verify`); **metronome soak/jitter harness** (§5.8) — `click_soak` + `click_soak_verify`, run via `scripts/soak-analyze.sh` (#88) | The 4h soak and the click-vs-grid offset, measured from a recording. The harness exists and is gated on synthetic and engine-rendered fixtures; the 4h device recording and the speaker-path offset have not been run. |
| **DB** | Drizzle migrations against fixture v7–v19 databases | An upgrading user keeps their setlists; the §11.1 version floor holds. |
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
  and pinned** in `metronome_verify` (§4.7). The clamp is widened to ±300 ms and
  the regressions run at that bound.
- **The §12.8 design-file edits** — all six landed, so no screen gets built from
  a superseded mock.
- **The record corrected** — `CHANGELOG.md` rewritten to claim nothing, and the
  Flutter app deleted: everything §2.4 named, including the AcousticBrainz stub
  (D8) and the advertised source at `bpm_lookup_service.dart:21`.

### Phase 1 — Core

**Closed** (PR #26), headlessly verified.

§4 in full: native playback (4.1), phase anchor (4.2), downbeats (4.3), mixer
fixes (4.4).

**This is still the highest-leverage work in the project and it is still
framework-independent.** `native/audio_core/tools/` runs the core headlessly, so
this phase is testable with **no UI at all** — in either language. Nothing here is
wasted by the stack decision, which is precisely why the previous revision of this
spec said to do it before deciding.

### Phase 2 — Skeleton

**Closed 2026-07-24** (PR #39). The 60fps gate passed on a device (#33).

`core-native` + the JSI HostObject + the TurboModule + the eval-harnessed lint
rules + the Drizzle migration off the existing v6 database. Proves §13.2 and
§13.3 on a device with one screen and no product. (The v6 upgrade was later
removed by #419; §11.1.)

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

**Status 2026-11-20.** Each claim cites a merged PR. Some merged features still
need a phone check, tracked in #516 and the open feature issues.

- **1 is built:** setlists and the preset editor (#130), layout B (#193),
  on-stage previous and next (#207), poly N against M (#238), practice
  summaries (#276, #278), custom click sounds (#473) and practice history
  (#524, #533). The history list, session detail, Repeat and delete with Undo are built
  (#533); the device check with several saved sessions is still open (#286).
- **2 is built:** import with background beat analysis (#162) and meter
  detection (#408); the single-song player on the native engine (#315) with
  its click on the song's bars (#342), its own click sound and accents (#536,
  #543), an A-B loop (#418), count-in (#546), a mini-player (#370) and the
  media notification shared with the metronome, whose Stop ends the song
  (#515). Background playback with lock-screen and headset control is in place
  (#515) but not yet checked on a device (#237).
  Speed from 50% to 100%, saved per song and restored on open (#555); the click
  on the beat and the notification bar at a slower speed still need a device
  check.
- **3 is built:** the stem player (#182) with background playback and a media
  notification (#186), StemDeck import from a zip or folder (#169) and from a
  server (#404), sections and synced lyrics (#305), speed and key (#331,
  #530), WAV mixdown (#439), setlists and a play-next queue (#499, #525, #549)
  and playing the next song when one ends (#544), with Next and Previous on
  the notification and lock screen for a song played from a setlist or Up next
  (#563; its device check is owed in #382).
- **4 has started:** the engine's play-along metronome slot and boottime clock,
  and Play along's state store in `core-state` (#620). `tool-sync` is still a
  skeleton with no screen.
- **5 is built** (#119, #127).
- **Around the tools:** the Home hub (#111) with Arrange (#244); Settings
  (#224, #231) with Rig (#255, #268, #269), Tools (#272), backup and restore
  (#107, #282, #394, #479, #494) and the data folder on internal storage or an
  SD card (#462, #470, #500, #506, #519; the card move is emulator-checked in
  the #532 and #548 re-checks, phone check pending); a database that fails to open blocks
  on a screen naming the failure (#514), and a copy is kept before a schema
  upgrade (#518). Every Settings section is built; #170 stays open for its
  device check, including latency calibration on wired and Bluetooth output.
- **Releases:** every merge to `main` publishes a signed APK as a GitHub
  release (#216). The F-Droid submission is drafted in `metadata/` (#61) and
  not yet sent (§17.1).

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

**Off-beat ticks only, played with the accent sound** (owner, 2026-10-31). A pattern
accents subdivision ticks after the first. Slot 0, the on-beat tick, never overrides
the per-beat accents (accent / normal / muted), and a muted beat silences its
subdivision ticks, accented or not. An accented tick plays the accent sound's
accented click, not a louder normal sound, at a lower level than an accented beat
so the two stay distinct (owner, 2026-10-31); unaccented off-beat ticks are
unchanged.

**As built (#170):** `kb_metronome_set_subdivision_accents(engine, subdivision,
slot_mask)` sets one row: bit *s* accents slot *s*, bit 0 is ignored, one command
per row. Rows start empty when the engine is created and survive stop/start; they
are not stored, so whatever persists the patterns must replay them on launch.
Grid mode applies them to the measured beats' subdivisions. The Settings row and
sheet edit them; the patterns persist as preferences (one mask per count, no
schema change) and are replayed at launch and on every edit (#170).

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

**Built.** The engine clamps the latency offset at ±300 ms
(`Metronome::kMaxLatencyOffsetMs`), and the generated TS bound is read from that
constant. The lookahead check is resolved: there is no window, the offset is a
phase bias (§4.7).

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
the ladder is library grid → tap. The tier exists for the user who wants it and
costs nothing to leave available. Attribution still applies when the tier is
used: a visible link to getsongbpm.com. Since 2026-11-26 it is the only network
source (Deezer dropped, §8.5); results are cached as title + artist → BPM with a
short TTL.

### D8 — Drop the offline dump tier.

The AcousticBrainz 2022 dump is not bundled and not downloaded. Delete the stub
that returns `null` and the source it advertises at `bpm_lookup_service.dart:21`.

**The ladder is now: library beat grid → GetSongBPM (if the user supplied a key)
→ tap** (Deezer dropped 2026-11-26, §8.5). All rungs honest. The tap pad was
always the real fallback and always works.

### D9 — Beat LEDs are a **row**. Grouping is gained.

The design wins; the build's circle goes. `BeatLedRow` has drawn a circle since
v0.1 to save horizontal space, and grouping is a linear idea a circle cannot
express — which is why `kitbag-metronome.html` flagged the row as the one thing in
it that was knowingly untrue. It is now true.

- **Grouping renders as the design draws it** — 7/8 groups visually 2+2+3.
- **Up to eight LEDs per line.** A longer bar wraps at a group boundary, so 12/8 is
  two lines of 3+3 and a 16-beat bar two lines of eight. There is no minimum per
  line: 9/8 wraps 6+3. Seven
  per line pushed the transport off a 360 × 800 screen at 56 dp dots (#175). This is
  the rule that makes the row survive the horizontal-space problem the circle was
  solving.

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

### D11 — Data folder: **wire it**. It is a feature.

The Settings row is **Data folder**, and it is **authoritative**: song audio,
stems and waveforms resolve against it. `design/kitbag-data-folder.html` draws
every state.

- **Media follows the folder.** The database and analysis scratch stay private to
  the app, whatever the folder.
- **Two locations:** Kitbag's own folder on internal storage, or Kitbag's own
  folder on a portable SD card. The chooser lists volumes; there is no system
  folder picker and no persisted-URI permission.
- **A move is copy → verify → switch → delete.** Every file is copied and
  verified before the folder switches; then all the old copies are deleted at
  once, after no player or export is still reading them. Until the switch,
  songs play from the old copy.
- **Cancel** is offered only before the switch, and removes the new copies.
- **A move interrupted by the app being killed** before the switch waits on
  Home for Resume or Undo and does not restart on its own; after the switch,
  clean-up finishes by itself.
- **Import stays allowed** during a move. A new song goes to the current folder
  and the move picks it up.
- **A missing SD card** leaves its songs listed as unavailable, never deleted;
  "Remove missing files" skips them. The user can switch to internal storage for
  new songs. When the card returns, its songs play from it, and a move to
  internal storage is offered.
- **Uninstalling** removes the card copy too: it lives in Kitbag's own folder.
- Every path stored **relative to it** (§6.2, §11.2).

`Storage` (§12.5) stays as the reporting sheet — what is on disk, where, and
"remove missing files". It reports; Data folder relocates.

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

### D14 — Time-stretch and pitch shift: **in scope**, for the stem player.

§3.3 listed time-stretch as out of scope. That ruled out slowing a song down
and changing its key — the two controls StemDeck users practise with — so the
"StemDeck-class" stem player of §3.1 could not exist. Decided 2026-10-22
with StemDeck bundles as a stem source (§7.8).

Signalsmith Stretch (MIT, header-only, §4.6): the library StemDeck already
runs in the browser, so the phone sounds the way the desktop does. Stem
separation stays out of scope; the phone plays what the desktop separated.

### D15 — Ramps are **stepped**. The smooth ramp goes.

Practice routines are written as steps — "add 5 every 4 bars", "+1 every 20
seconds up to 200" — and the From/To/Over ramp could not say either: it moved
the tempo a little every bar, so neither the size of a jump nor how often it
came was settable. Decided 2026-10-23 (#144). No "smooth" option is kept and
saved ramps are not converted; none exist on a shipped build.

### D16 — The follow-mixer click **ignores the latency offset**.

Stems and click leave through the same output buffer, so the offset could only
push the click off the stems. It exists to align with sources outside the phone
(§4.7, §12.5.1). Decided 2026-10-29 (#137).

### D17 — One queue; a setlist is context **only when started this session**.

The owner's review of the stem queue found it hard to find, addable only at
the front, stopping when the user left the player, and showing a setlist
nobody had started. So one queue serves single songs and stem songs, both
players carry the same Up next row, and a setlist is context only once started
in this listening session. Decided 2026-11-20 (#574); §7.9 and
`design/kitbag-queue.html` carry the rules.

### D18 — Tools are **downloadable**. The Metronome stays core.

#657 asked for a lightweight core with tools added on demand: built in, every
tool cost every user its download size. So today's tools and every #656 feature
become downloadable, while the Metronome, which setlists, presets and the
playback card are built on, stays core. The F-Droid build compiles every tool in
and carries no download code. Decided by the owner 2026-11-27 (#657); §9.3 and
§9.5 carry the rules.

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
- **Swipe axis & sensitivity.** Vertical, speed-scaled from ±1 BPM/14dp (#209);
  confirm the feel on device.

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
| BPM APIs disappear | Library grid + tap always work; network sources sit behind one interface |
| F-Droid rejects the Expo-shaped project (§13.8) | Verify policy in Phase 0, before the toolchain is locked |
| **Rewriting twice** | Phase 1 before Phase 3 — the un-wastable work first. The stack decision does not change which work that is. |
| **The rewrite silently loses working behaviour** | §2.1 is the port checklist; §14's tests are the proof. A rewrite with no tests cannot show it kept anything. |
| Scope creep | Nothing enters core that a plugin can carry |
