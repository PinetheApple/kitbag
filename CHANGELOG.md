# Changelog

All notable changes to Kitbag are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Entries below are generated from Conventional Commits by git-cliff — an entry
cannot exist without a commit that did the work.

**GitHub Releases are authoritative.** Each `vX.Y.Z` tag is published as a
GitHub release with a signed APK and its notes. This file is a snapshot,
regenerated with `bash scripts/changelog.sh` after `git fetch --tags`, so its
newest sections can lag the releases.

---

This file once recorded 0.1.0 through 0.5.0 as shipped on
2026-07-14; an audit on 2026-07-17 found that substantially false, and those
entries were deleted rather than amended. `SPEC.md` §2 is the audited inventory
of what the codebase actually did. Version numbers here are the release tags and
have nothing to do with the deleted entries.

## Unreleased

### Added

- **metronome:** Sample-accurate start on an engine frame (SPEC.md §4.2)

kb_metronome_start_at(engine, start_frame) starts the click on a given
engine-clock frame rather than whenever the call lands. First piece of §4.2's
phase anchor; set_grid and anchor_external are not built yet.

Needed a transport-clock seam that did not exist: Engine::Render now reads
frames_rendered_ before the block and passes that absolute frame into
Metronome::Render, advancing the counter after. Nothing previously handed a
subsystem the engine frame of the block being rendered, which is what any
frame-anchored scheduling needs. Mixer::Process is deliberately left alone —
no Phase 1 consumer needs the frame there, and an unused parameter is
speculative surface (§4.5).

StartAt defers through the command ring and fires inside the render loop on
the exact sample, via a BeginRun() helper extracted from the old kStart body.
It is ignored while already running: re-anchoring a live click is set_grid's
and anchor_external's job.

Fixes a bug the deferred path exposed. BeginRun re-anchors beat_position_ from
the reset BPM, but the loop's latency_beats still reflected the pre-reset BPM,
so with an armed ramp and a latency offset `position` no longer cancelled to
zero on the first sample: beat 0 was swallowed and the block ran at the stale
tempo. Both per-block locals are now recomputed after the in-loop BeginRun.
Only reachable with a latency offset — without one the values cancel anyway,
which is why the first version of the regression test passed vacuously.
BeginRun also publishes running_flag_ itself, so is_running() no longer lags a
block behind a deferred start.

Seven regressions in metronome_verify: frame-exactness at an anchor off the
block boundary, anchor at frame 0, beat 0 under a latency offset, the armed
ramp recompute (verified to fail without the fix), ignored-while-running, and
Start/Stop cancelling a pending StartAt.

Also corrects five SPEC.md references that cited §4.6 (native dependencies)
for the latency clamp, which is §4.7.

docs/phase1-tracker.md tracks Phase 1 execution status. It is subordinate to
SPEC.md §15, which remains the sequencing authority.

Carries a little formatting churn in api.cpp and kitbag_api.h from the
preceding cleanup commit; those two files hold both concerns and git add -p
is unavailable here.

- **metronome:** Follow a measured beat grid; add RtPublisher seam

Implements SPEC.md §4.2 phase anchor. A song whose tempo drifts can now be
followed per-beat instead of via a single BPM, which one setTempo cannot
express.

New app->RT bulk-payload seam (rt_publisher.h): atomic pointer swap with
deferred retire. The generation counter lives inside the published node, so a
single acquire load carries both value and identity and ABA is impossible by
construction rather than by argument. Track loading (§4.1) should adopt this;
kb_mixer_set_track_data still publishes PCM the old, racy way until then.

Also lands, from two review rounds:

- Metronome::StartAt / kb_metronome_start_at, sample-accurate against the
  engine transport clock (Engine::frames_rendered) rather than call arrival.
- Grid mode survives Stop/Start and StartAt: the cursor re-seeds from the
  current position instead of resuming stranded at the pause point, which
  previously swallowed every paused-over beat into one off-grid click and
  desynced the bar counter.
- ClearGrid is genuinely phase-continuous. beat_position_ is now maintained
  during grid mode; previously it stayed frozen at a downbeat, so clearing
  mid-song fired an immediate off-beat click and shifted the bar.
- Subdivisions divide each measured interval instead of being dropped.
- current_bar_ is derived from grid_beat_index_ in grid mode, so a re-anchor
  cannot over-count downbeats and shift bar-mute phase.
- current_bpm_ mirror is clamped to [kMinBpm, kMaxBpm]; an outlier grid
  interval published 1200 BPM against a documented max of 400.
- Retired grids are reclaimed when no RT reader is active, so publishing
  before playback no longer leaks a node per call.

Beat-analysis fixes found during the same pass:

- BeatTracker capped beats at a 2048-entry stack buffer while backtracking
  from the last beat, so a track over ~17 minutes silently returned a grid
  starting partway into the song. Truncation now drops late beats, keeping
  times anchored to t=0, and the cap matches KB_MAX_GRID_BEATS.
- The .kwav sidecar path used arithmetic that only stripped a 3-letter
  extension: song.flac became song.fla.kwav and song.mp3 became
  song.mp3.kwav. Extracted to sidecar_path.h with basename-scoped handling.

New verify tools: abi_verify (exercises the exported C ABI, including the
set_grid validation guarding lower_bound's ordering precondition) and
beat_tracker_verify. Every test added here was sabotage-verified: the fix was
broken, the specific failure observed, then restored.

SPEC.md §4.2 records the past-the-last-grid-beat behaviour (click silent,
is_running() stays true, mirrors freeze) as the decision it is.

- **mixer:** Split Pause from Stop and expose both on the ABI

SPEC.md §4.4: Stop rewinds to frame 0, Pause holds the position so the
next Play resumes where it left off. Only Stop existed, so a UI pause had
to fake itself with seek-after-stop and lost the head on any race.

Pause is a single release store on playing_, no rewind. kb_mixer_pause
sits beside kb_mixer_stop; scalar-only, so the ABI stays buffer-free.

mixer_verify gains 8 checks (paused block silent, head held across a
paused block, resume audible at the held frame rather than the top) and
abi_verify 3 at the C boundary, where the pair is only meaningful
checked together. Sabotage-proven both directions: Pause rewinding fails
4 mixer + 1 abi check; Stop holding fails the pre-existing
"stop: the head rewinds to zero".

- **audio_core:** AudioSource — streaming read-ahead behind a pull interface

Closes the W0-2 structural gap (design-audit F2): A1 (mixer tracks) and A5
(player) both need ring-buffered read-ahead, so it is written once here rather
than twice later.

Read(float* dst, uint32_t frames) is the only callback-facing method — a masked
memcpy out of the ring, a std::fill and one relaxed fetch_add. The read-ahead
thread is the only thing that blocks, allocates or does I/O.

SpscBulkRing is the bulk half of spsc_ring.h's discipline, not a second one:
the same SPSC acquire/release pair on two monotonic indices, sized at runtime
because ring capacity depends on the stream's channel count.

The lifecycle splits Open/Start/Stop/Seek/Close. An earlier revision folded
Open into Start, which made pause/resume drop ~194 frames nondeterministically
and left the caller counting Read returns to recover its position — A5
reimplementing the bookkeeping this module exists to own. Start/Stop now only
spawn and join the producer, so the ring and position survive a pause.

Two adapters prove the seam: audio_source_verify (104 checks) drives an
in-memory fake and links no miniaudio at all, while file_audio_reader_verify
(14) drives the miniaudio adapter over a WAV fixture generated at runtime.

Review found the file adapter left miniaudio's output format at
ma_format_unknown, so every 16-bit file decoded s16 into the float* the module
is built around — denormal noise, destination under-filled by half. It had no
coverage at all because a CMake comment argued that testing it would leak the
seam; the premise was wrong, and the comment is rewritten. Decoder carries the
identical bug on the shipped kb_analyze_song path, filed as #18 rather than
fixed here.

Known gap, recorded rather than papered over: the EOF/underrun flag ordering is
reasoned, not measured. The interleaving is not deterministically reachable
through the public interface, so folding the two flags back into one leaves all
104 checks green. A test that could not fail was written and deleted; the note
lives at the store, where the next reader will be.

Verified on a clean from-scratch build: all verify tools exit 0, lint 0,
audio_source_verify stable over five consecutive runs, TSan and ASan/UBSan
clean. tuner_verify still exits 1 (37/37, pre-existing). 15 sabotage mutations
reproduce, each re-run by the reviewer rather than taken on report.

- **metronome:** Kb_metronome_anchor_external — lock the click to a transport we don't clock

C3 (SPEC.md §4.2). The caller declares "at engine frame at_frame the external
song was song_pos_sec in, running at bpm"; the metronome lays its grid to match.
This is the sync path for playing along to a Spotify or YouTube stream the engine
does not drive.

The three scalars cross the existing SPSC command ring as a kAnchorExternal
command -- no new concurrency discipline, nothing added to the render callback.
The command is stashed on drain and consumed in BeginBlock at block start, where
block_start_frame (the W0-1 transport clock) is finally in scope. beat_position_
is set from the anchor line song_seconds(now) = song_pos_sec + (now-at_frame)/sr,
which puts anchor-external in the same constant-tempo regime as start_at and
set_grid -- a phase write, then the normal per-sample advance, so latency and the
polled mirrors compose for free.

Re-anchoring is glitch-free by construction: phase is recomputed at block start
before the per-frame loop emits any click, so a click already sounding this block
cannot move, and re-anchoring the same timeline recomputes the identical
beat_position_ -- no double, no drop. The re-anchor test asserts continuity across
the swap (one-for-one onset count plus a decay check), not merely that clicks land
somewhere after.

A negative or fractional song_pos_sec is a mid-bar anchor: the click stays silent
until the song reaches beat 0. A measured set_grid takes precedence -- while a grid
is set the anchor is a no-op until clear_grid (user-ruled; documented in the ABI,
not enforced). The ramp does not apply while anchored, mirroring SetTempo's
authoritative-bpm cancel. at_frame is exact to 2^53 frames so it crosses JSI as a
double, no BigInt (SPEC.md §13.2).

Building the negative-song_pos path surfaced a pre-existing out-of-bounds read:
OnSubdivisionTick owned its subdivision by floor(beat_position_), which a positive
latency seed can pull negative -> accents_[-1]. Reachable from a plain
kb_metronome_start at bpm>300 with a latency offset, independent of C3; ASan misses
it because accents_[-1] aliases another field of the same object. Found by direct
instrumentation. A pre-beat-0 subdivision is now owned by beat 0. This bounds the
index; it does not correct the attribution base -- a per-beat mute still leaks into
its subdivisions under positive latency at bpm>300 -- so that residual bug is filed
as #20, blocked on a SPEC ruling on mute-cascade semantics, with a caveat comment
at the site because D5's proposed 300ms clamp would widen it.

Verified on a clean from-scratch build by a verifier that did not write the code:
all verify tools exit 0, lint 0, metronome_verify 206 checks stable over three
runs. tuner_verify still 1 (37/37, pre-existing). Six sabotage mutations across
the two review rounds reproduce, one per build, each revert md5-confirmed against
a cp backup (never git checkout -- the work is uncommitted; never bare diff --
rtk's proxy has falsely reported files identical). The song_pos==0 boundary test
does not pin >= vs > (below the +-4-frame tolerance and FP-fuzzy) and the banked
mutation was sharpened to the guard the tests actually discriminate, rather than
claiming a pin the suite can't see.

- **mixer:** Stream each track through a W0-2 AudioSource; callback drains only

A1 (#6), SPEC.md §4.1. Each mixer Track owns an AudioSource instead of a full
decoded buffer; Process/MixTrack only drain — no allocation, no lock, no I/O on
the audio thread (scratch_ pre-sized off-thread, a block wider than
kMaxBlockFrames is rejected not resized). Tracks are drained before gain/mute/solo
gating so a muted track stays in lockstep with the transport and resumes in sync
rather than replaying on unmute (§4.4). The non-RT Play/Seek path primes each
source's ring before playback so the synchronous transport is deterministic
against the async read-ahead thread. A PcmSourceReader in-memory adapter keeps the
legacy set_track_data path working as setup.

mixer_verify 61 -> 84 checks (5 new streaming tests; both sabotages — zeroed drain
and lying buffered_frames() — shown to fail). buffered_frames() added to
audio_source.h (additive, read-only) so the prime step can observe fill level.

- **mixer:** Resample each track to the engine rate on load (F4)

A2 (#7), SPEC.md §4.1, design-audit F4. A stem whose sample rate differs from the
engine's is now resampled instead of silently dropped — 44.1 kHz plays correctly.

A new ResamplingSourceReader decorator wraps the track's SourceReader and presents
engine-rate frames. It runs only on the AudioSource read-ahead thread, so the ring
behind the RT callback already holds engine-rate audio and AudioSource::Read /
Mixer::Process / MixTrack stay allocation/lock/syscall-free — no resampling on the
audio thread. Mixer::ConfigureTrack wraps the reader when sample_rate != engine
rate and drives num_frames/longest_frames_ from the resampled total_frames().

F4 shrinkage: Mixer::Process and MixTrack lose the sr parameter and the
rate-mismatch skip-branch; Track::sample_rate is gone; the mixer carries its rate
via explicit Mixer(uint32_t engine_rate), threaded from Engine::kSampleRate (no
hardcoded 48000). The one caller, engine.cpp, is updated. Public C ABI unchanged.

Resampling uses miniaudio's built-in linear converter (ma_data_converter) —
correct and aliasing-free for 44.1->48k upsampling. The vendored miniaudio no
longer bundles Speex, so Speex-grade quality (downsampling) is deferred to a
dependency decision (#22). mixer_verify 84 -> 93 (2 resample tests; both sabotages
— disabled wrap and passthrough ratio — shown to fail; 1000Hz-vs-1088.4Hz Goertzel
discrimination). Scope: A2 only; no A3/A4, B5 untouched.

- **loop:** Add stateless project-loop skill driving the whole build

Generalizes phase1-loop into a meta-orchestrator over SPEC §15: phase DAG,
conflict-map parallelism (file-disjoint tracks run concurrent in worktrees),
a wave integration gate, a docs/decisions.md log for decide-and-record on
unambiguous gaps, and four stop-points (SPEC ambiguity, on-device gate,
design sign-off, task fails twice).

Stateless per iteration: each invocation reconstructs state from disk (SPEC,
tracker, issues, decisions log, git log), does ONE increment, commits, and
exits for an external driver to re-invoke with a clean context. Context resets
every pass by construction, so the loop never exhausts it.

- **mixer:** RT-safe track load — atomic pointer-swap publish + command ring

A3 (#8), SPEC.md §4.1/§2.2, design-audit F3. Track load is now realtime-safe: the
AudioSource is built off-thread and published to the callback by an atomic release
swap, and scalar controls cross an SPSC command ring like the metronome's — so the
callback only drains, never races the app thread.

Publish path (fixes SetTrackData's assign racing Process): each track owns an
RtPublisher<TrackSource> (reused from C2). BuildTrackSource opens/resamples/sizes
off-thread; PublishTrack swaps it in with release, the callback does one acquire
load per track. Old sources are retired and reclaimed off-thread (on a later
publish or Engine::Stop) — the callback never frees.

Command ring (fixes the Stop/Seek and Pause counter races): SpscRing<Command,64>
carries gain/mute/solo/play/stop/pause/seek. read_frame_, playing_, any_solo_ and
the gain/mute/solo mirrors are now written only by the callback, so Stop-then-Seek
cannot lose the rewind and Pause stops within one block instead of overshooting.
Ring-full drops (not blocks) — the RT choice — and drops are counted. Heavy source
work (Start/Stop/Seek/Prime) stays on the app thread over a non-owning live_source.

- **mixer:** Path-based track ABI; fix longest-frames + field tears

Reshape the mixer ABI so no float* buffer crosses the boundary (SPEC.md
§4.1): every value is now a scalar or a path, which is what §13.2's JSI
HostObject relies on.

- Add kb_mixer_load_track / kb_mixer_unload_track / kb_mixer_track_ready.
  Load streams from disk via FileAudioReader, resamples off the callback,
  and publishes by atomic pointer swap through the per-track RtPublisher —
  the RT-safe load path A3 built. Unload retires the source for deferred,
  off-callback reclamation.
- Remove kb_mixer_set_track_data and its float*/num_frames/channels/
  sample_rate params, every caller, and the now-unused PcmSourceReader.

#16 (B5): longest_frames_ was only ever raised via std::max, so a
reload-to-shorter or unload left the transport running long.
RecomputeLongestFrames rescans loaded tracks on load and unload so
auto-stop follows the current longest.

- **loop:** Add run stats footer — context peak, tokens, elapsed

Track usage across the stream and print context peak (largest single
prompt window), total in/out tokens, and cache reads under the summary
rule. Elapsed now human-readable (m s).

- **loop:** Pin stats footer to bottom via rich Live

Boxed panel stays fixed at the terminal bottom while log lines scroll
above it, showing elapsed (ticks live), context peak, in/out tokens, and
cache reads. rich resolves through uv's PEP 723 inline deps — no manual
install. Falls back to plain scrolling output when stdout is not a TTY.

- **player:** Single-source player ABI over AudioSource + transport clock

SPEC.md §4.1 gives the core a single-file player alongside the stem mixer:
kb_player_load/unload/play/pause/seek/position/frames/is_playing. The new
Player class (src/player/) is the mixer's one-track sibling and reuses its two
app→RT disciplines and no third — the loaded source is built off-thread and
swapped in by RtPublisher<PlayerSource>; play/pause/seek cross an
SpscRing<Command,64> the callback drains. Render accumulates rather than
memsets, so it composes on top of the mixer in Engine::Render (Process clears,
player and metronome add).

pause holds the position; there is no stop-to-zero. §4.1 lists only pause for
the single-file player and a rewind is seek(0), so adding a stop would be an
orphan export (§16). Frames cross as int64_t, exact to 2^53 — JSI reads them
as a JS double, no BigInt.

Folds in #17: kb_engine_set_test_tone rendered silence and had no product
consumer (grep found only tools/tone_test.c, a dev diagnostic). Per the
2026-07-21 ruling and §16, the ABI symbol, RenderTestTone/SetTestTone, the
engine tone fields and tone_test.c are deleted, and the player is wired into
the render seam the tone left behind.

- **native:** Stream a real file through the C ABI (stream_verify) [#11]

- **analyze:** Emit downbeats from kb_analyze_song (#13)

Wire the vendored QM-DSP DownBeat into the offline analyze pipeline to
label which detected beats are bar-ones. kb_analyze_song gains two
caller-out buffers (downbeat_indices_out, downbeat_count_out), keeping
the existing scalar/pointer-out ABI shape — no structs across the seam.

DownBeat's beat grid comes from Kitbag's own tracker (the onset
detection function lives in the unvendored qm-vamp-plugins); the mono
signal is fed through DownBeat's anti-aliasing decimator and beats are
converted to df-increment units. Links qm_dsp into kitbag_core and
analyze_verify. Adds downbeat shape coverage (in-range, ascending,
strict-subset, one-bar spacing), sabotage-proven.

- **core-plugin-api:** Abstract plugin contract types (#28)

- **core-db:** Drizzle schema + v6 migration (#34)

Flesh out core-db with the Drizzle v7 schema (drizzle-orm over op-sqlite,
SPEC §11.1) migrated from the v6 Drift schema per §11.2 (D1/D3/D4, §11.3):
SongPresets/Songs name inversion, setlist decoupling via setlist_items,
dropped volume/latencyOffset, identity tuple + library FK, downbeat indices,
and the D2/§8.5/§12.5 tables. The v6->v7 migration is data-preserving and
tested against a fixture v6 database: an upgrading user keeps their setlists
(§14), proven by a sabotage check that removes the membership step.

- **eslint-plugin-kitbag:** Boundary + naming rules (#35)

- **core-design:** §12.2 tokens + generated tailwind theme (#37)

- **core-native:** TurboModule command spec (P2-A2)

- **core-native:** JSI HostObject + generated native constants (P2-A3)

JSI HostObject typed contract for polled realtime reads (bar_phase,
current_beat, current_bpm, frames_rendered, tuner_snapshot,
player_position) + C++ scaffolding; installs once, sole holder of the
single kb_engine* (SPEC §13.2, §13.3). Tuner-snapshot decode via
division (no int32 coercion). Constants generated from engine source
(kSounds preset comments cross-checked vs kSoundCount, throws if absent)
— never hand-mirrored (SPEC §13.7). Closes #30.

- **core-native:** Native build integration — Gradle + iOS podspec (#31)

Wire the RN app to build and link the JSI glue against the existing C++
core without moving it (§13.8): the Android CMake add_subdirectory()s
native/audio_core in place and app/build.gradle consumes it via
externalNativeBuild + prefab (jsi/reactnative/fbjni); an iOS podspec
compiles the same glue against native/audio_core/include. kitbag_api.h is
included, never retyped (§13.7).

KitbagEngine owns the single process-wide kb_engine* (§4.5); the
HostObject value-property reads (§13.3) and the TurboModule command path
(§13.2) both borrow that one engine, never create a second. Foreground
service (§5.6) and notification listener (§13.9) are compile-shaped Kotlin
SKELETON (#31) stubs — full port is Phase 3.

Verified off-device: all three glue TUs pass clang -fsyntax-only against
the real jsi.h + kitbag_api.h; kitbag_core builds under the NDK toolchain;
typecheck 12/12, lint --max-warnings 0 clean. On-device Gradle/pod link and
the live JSI install are #32/#33.

- **app-shell:** 60fps gate screen + JS-starvation harness (#32)

The §13.3 proving surface for the device gate (#33): one screen whose
beat sweep, LED row and engine-BPM readout are driven entirely by a
Reanimated worklet on the UI thread reading the JSI HostObject each
frame into SharedValues — never useState, never a JS-thread hop, never
runOnJS on the per-frame path. React state holds only human-speed values
(target BPM, beats/bar, running).

- useBeatSweep: useFrameCallback worklet reads global[KITBAG_HOST_OBJECT_KEY]
  props (bar_phase, current_beat, current_bpm) as allocation-free JSI
  doubles; defensively holds last value while the host is absent (nothing
  installs it until #33).
- BeatSweep / LedRow / EngineBpmReadout: read the SharedValues via
  useAnimatedStyle / useAnimatedProps on the UI thread.
- starvation: a synchronous JS-thread spin (STARVATION_MS) so #33 can
  confirm on-device that the sweep stays smooth while JS is starved
  (§5.8 / §13.3 corollary). Pass/fail is device-side, measured from
  recorded output (§14.1) — not claimed proven here.
- Constants sourced from their owners: host key from core-native, tokens
  from core-design (§13.7). No retyped literals.

Verified headless: typecheck 12/12, lint --max-warnings 0, eval 36/36.
Device-gated to #33 (not claimed here): live HostObject install and the
actual jitter-free 60fps measurement. CAVEAT recorded in useBeatSweep
header — the installer must publish on the Reanimated UI-runtime global
(separate from the JS runtime), and #33 must assert the values change,
not merely that nothing throws, since the defensive hold hides a
wrong-runtime install.

- **core-native:** #33 device-gate runtime wiring (staged, unverified)

Draft the on-device wiring that turns the #31/#32 skeleton live, so the
#33 gate screen can show real, changing values. This is compiles-shaped
only — none of the C++/JNI/Kotlin has built (no Gradle, no device) and no
runtime behaviour is observed. The device build is its first real test.

Runtime install (the trap): the worklet reads global.__KitbagHostObject on
the Reanimated UI runtime, a separate runtime from the RN JS runtime.
kitbagInstall runs natively on the JS runtime (via KitbagCommandsModule),
then bootstrapRuntime.ts re-publishes the SAME C++ HostObject onto the UI
runtime from JS via runOnUISync — worklets wraps a captured foreign
jsi::HostObject as a SerializableHostObject sharing the one C++ object, so
both runtimes borrow the single kb_engine* (§4.5). Whether v0.7.4 actually
shares it is the sole genuine on-device unknown; the gate asserts it by
requiring the values to CHANGE, not merely that nothing throws.

- **app-shell:** Live tempo on the gate screen while running (#33)

The ± steppers only updated React tempo state; setTempo reached the engine
only at Start. Wire the steppers to issue getKitbagCommands().setTempo(next)
live when running, via a guarded trySetEngineTempo helper mirroring the other
command helpers (no second call path, no retyped constants). This matches
SPEC §5.3 (values apply live over a running metronome) and lets the device
verify §5.8's glitch-free mid-bar tempo change (§14.1).

Handlers read tempo directly with [tempo, running] deps rather than a
functional updater with a side effect (which StrictMode double-invokes), so
the engine always gets the exact next bpm gated on current running state.
Frame path (useBeatSweep/worklet) untouched — human-speed React state only
(§13.4). typecheck + lint --max-warnings 0 green; live ramp is device-observed.

- **core-state:** Metronome config store — human-speed intent, 1:1 commands, no realtime shadow (#40)

First Phase 3 (F1 metronome, SPEC §5) task. A Zustand store in core-state
holding the human-speed metronome config and mapping every mutation 1:1 onto
the TurboModule commands. The store is intent; the engine is truth.

- §13.3: no realtime value (current_beat/bar_phase/current_bpm/frames_rendered)
  is held or shadowed. start() reads frames_rendered once via an injected
  nowFrame anchor and never stores it. A test fails if any realtime field leaks.
- §5.3 setTempo cancels a running ramp; pause re-arms nothing (pause != stop);
  §5.2 cycleAccent = accent -> normal -> mute -> accent.
- Clamps: BPM 20-400, subdivision 1-16, denominator in {2,4,8,16}.
- Sound id range-guarded against the generated engine count (§13.7); names/count
  come from the engine, not a local list.
- 14 vitest, every invariant sabotage-proven (removing a behaviour breaks its
  test); typecheck 12/12; lint --max-warnings 0.

Extends the #29 TurboModule Spec with metronomeStop/setRamp/setBarMute — real
kb_metronome_* ABI functions (kitbag_api.h) the Spec had omitted, verified by
ralph against the header. Not fabricated bindings.

Honest native gaps, stored as intent only (no silent no-op that looks wired):
- D1 denominator has no ABI parameter yet (§17 D1 unbuilt) — setBeats sends the
  numerator; denominator is validated intent. A native follow-up owns the C API.
- perAccentSounds (§5.3 per-accent-level sound) and countInBars have no engine
  command — store-only intent applied by a future start screen.

- **audio-core:** The time-signature denominator reaches the engine (#41)

kb_metronome_set_beats was numerator-only, so 7/8 and 7/4 produced an
identical click. It now takes the denominator too (SPEC §17 D1), and the
scheduler's beat interval is a function of both:

    interval = (60 / bpm) * (4 / denominator)

BPM stays quarter-note referenced, so 7/8 at 120 clicks twice as fast as
7/4 at 120 and 6/8 clicks six times per bar. A product survey of hardware
and app metronomes (docs/metronome-bpm-denominator-research.md) found the
well-regarded ones pair this with a separate click-unit control so compound
meters can click the dotted-note pulse; that was considered and declined, so
6/8 needs manual BPM arithmetic for a two-click feel. Recorded in
docs/decisions.md.

- **core-native,core-state:** Wire denominator through the TS/Kotlin TurboModule chain

The C half landed in #41 (df2c937): kb_metronome_set_beats takes
(beats_per_bar, denominator) and commandSetBeats carries both, with the beat
interval (60/bpm) x (4/denominator). The TS/Kotlin chain still sent only the
numerator, and the JNI passed a kDenominatorUnchanged = 0 stub, so a 7/8 time
signature clicked at 7/4 on device.

- NativeKitbagCommands.ts: setBeats gains a denominator: Int32.
- KitbagCommandsModule.kt: setBeats/nativeSetBeats take the second parameter.
- KitbagJni.cpp: stub removed, jint denominator forwarded to commandSetBeats.
  The signature has to grow with the Kotlin external fun or the JNI symbol no
  longer resolves.
- core-state store: dispatches the validated denominator, not the raw argument,
  so an out-of-set value sends the retained one rather than relying on the
  engine's own fallback.
- GateScreen: passes its default denominator; required to keep the call typed.

Comments in store.ts, the test title, docs/decisions.md and the #33 runbook all
claimed the denominator had no C API. That has been false since df2c937.

kDenominators stays a store-owned const: kitbag_api.h documents the valid set in
prose only, with no KB_DENOMINATOR_* macro for the generator to read, so there
is no engine constant to own it yet.

- **tool-metronome,app-shell:** Metronome performance surface (§5.2, #46)

Build the metronome's main screen: swipe-anywhere tempo, preset steppers,
the beat-LED row editor, the poly row, the bar sweep, the practice pill, the
tap-to-type numpad and the badge steppers (SPEC §5.2, design §02).

The two 60fps values — bar_phase and current_beat — are read by a Reanimated
worklet from the JSI HostObject and never touch React state (§13.3), following
the pattern #33 proved on device. Everything else on the screen is human-speed
state from the core-state store, and every mutation goes through the store's
1:1 engine commands.

Gesture and layout arithmetic lives in tool-metronome/src/logic as pure
modules so it is testable with no device and no renderer: the ±1 BPM per 8dp
drag with bound re-anchoring, tap-tempo averaging, D9 LED grouping and wrap,
the numpad state machine, subdivision glyphs, the tempo marking table, the
practice clock and the touch-target arithmetic. 54 vitest tests; 18 sabotage
mutations were run against them and all 18 were caught.

- **release:** Sign release builds with a real key, gated by a verifier

- **scripts:** Add preflight and device-install as one-command gates

- **release:** Scripted release path with one version source (#53, #54)

The repo could build an APK but had no defined way to release one: no version
bump path, no tag convention, no published artifact, and three files each
hand-holding a version that nothing checked against the others.

app.json is now the one owner. Gradle parses it at configure time for
versionName and derives versionCode (major*10000 + minor*100 + patch), so the
APK cannot disagree with it, and version.sh check keeps the package.json copies
from quietly becoming a second source.

release.sh runs every gate before anything leaves the machine: preflight, then
the signature gate (a debug-signed APK can never be upgraded and that key is
public), then the built APK's own versionName against the tag, then a published
sha256. Changelog generation stays on the existing git-cliff setup via
changelog.sh, which now forwards --tag.

CI gains the Android job that would have caught the Kotlin/JNI/codegen chain
being broken from M1 to M3 while every headless gate stayed green, plus the
version and release-script checks preflight runs, so the two stay mirrors.

The version moves 0.0.0 -> 0.0.1 because the derived versionCode must be at
least 1; this releases nothing.

- **app:** Launcher, adaptive and splash icons from one SVG source (#52)

design/kitbag-mark.svg is the single definition (§13.7); scripts/build-icons.sh
renders every raster from it — app assets for app.json/future prebuilds and the
committed android res tree that actually ships (SPEC §13.8 keeps prebuild out
of the build path). Colours are the §12.2 tokens (bg #0E0D10, accent #FFB347,
accentDeep #E89B2E); no new vocabulary.

splashscreen_background was #FFFFFF — the white flash before the first frame;
it is now the theme background, and the adaptive icon carries the mark inside
the safe zone plus an Android 13 monochrome layer.

Device verification (circular + squircle masks, launcher/recents/settings)
still pending — no device attached.

- **app:** Use supplied kitbag icon

Replace the generated placeholder mark with the supplied bag artwork across Expo and Android launcher assets.\n\nRefs #52

- Add setlist persistence repositories

- Add deterministic web metronome runtime

- **android:** Minify release builds, drop unused fonts and codecs (#49)

R8 + shrinkResources were left at the RN defaults, shipping 23 MB of
un-minified dex. Enabled via the template's gradle.properties flags, with
keep rules for the TurboModule/JNI chain in proguard-rules.pro — R8
renaming any of those classes makes native go silent with no error.

The seven ~1 MB ttf files came from expo-router's unused native-tabs
helper importing expo-symbols -> @expo-google-fonts/material-symbols;
both are blocked at Metro resolution (nothing else references them).
GIF/WebP/AVIF Fresco decoders are off or excluded — the app decodes no
images yet; each knob records what re-enables it.

APK 36.0 MB -> 24.54 MB. Device verification of the keep rules (metronome
clicks under a minified build) is still pending — no device attached.

- **core-design:** Shared visual primitives and themed token roles

core-design exported only tokens, so every screen that reuses the metronome's
LEDs, steppers, sheets or transport would have copied them (#68), and the app
bar, button, chip, card and badge every design file draws had no
implementation (#69).

Adds a theme layer (ThemeProvider, useTheme, createThemedStyles) resolving
dark and light from the §12.2 palette, with the design's color-mix tints
derived from tokens rather than stored as hex; named geometry, spacing and
text roles taken from the design files; one semantic icon map that forces
text presentation on emoji-capable glyphs; and hitSlopFor, moved from
tool-metronome with its tests.

- **core-native:** Generate the ramp and mute bar limits

The Ramp and Mute-bars steppers need the engine's upper bounds, and
retyping 64 and 16 in the tool would be a second owner (SPEC §13.7).
KB_MAX_RAMP_BARS and KB_MAX_MUTE_BARS are extracted from
Metronome::kMaxRampBars and kMaxMuteBars like KB_MAX_BEATS.

- **core-design:** Field-label and bar-preview roles, fixed icon line box

Adds the roles the trainer sheets draw with: the 13.5 field label and
the mute preview bar's height, radius, gap and opacity. Icon now sets
its line height to its size, so a chip with a fallback-font glyph such
as the ramp mountain is no taller than its neighbours.

- **tool-metronome:** Ramp and mute-bars chips with live sheets

Part A of #81. The chip row sits under the meter card and wraps; off
chips show their name, active chips their value (ramp as the design's
100→140). Both sheets write through the existing store actions, so a
stepper change reaches the engine while the metronome runs, and a
manual tempo change still clears the ramp chip.

Held back until their contracts exist: the ramp's sec/min segment and
loop-back (#77), the mute sheet's keep-counting chip, and the Sound and
Count-in chips (#75, #76). Appending those later does not move the two
chips already in the row.

Also pins 4/4 as one ungrouped row of four LEDs (#56 ruling).

- **app-shell:** Theme follows the system colour scheme

- **core-state:** Nudge and resync tempo from the engine's current_bpm

While a ramp runs the store's bpm is the ramp's start, not what plays, so
a +5 nudge jumped from the wrong base. The runtime gains an engineBpm
read (the HostObject's current_bpm); nudgeTempo steps from it, and
clearing a ramp, stopping and pausing adopt it. With no HostObject
installed the store keeps its own tempo. Tests drive a fake engine
through start ramp, nudge, clear and stop, and fail if the engine read
is removed.

The web presentation host now reports the store's bpm as current_bpm, so
the web build shows the tempo the store holds.

- **core-design:** List, search, edit, empty-state, picker and drag-row modules

The Tier 2 modules the setlist screens draw: ListRow (icon tile, two lines,
trailing chevron or badge), SearchField/TextField, FloatingActionButton,
EmptyState with one action, EditGroup/EditRow, PickerGrid, and
DragListRow/SongRow. Reorder starts only from the drag handle, which also
offers increment/decrement accessibility actions; the row body takes press
and long-press, so a long-press can never reorder. reorderTarget is a pure
worklet with tests.

- **core-state:** Library store over injected setlist and preset repositories

Screens reach core-db only through core-state: configureLibrary takes the
repositories at the composition root, as configureMetronomeRuntime does
for commands, and useLibrary exposes a snapshot (setlists active-first
with counts, ordered entries, standalone presets) plus CRUD, search,
reorder, move, remove, duplicate, delete, explicit save and save-current.
Loading a song applies every preset field to the metronome, ramp and
bar-mute included, pins its setlist and counts it as played.

The metronome store gains setAccents and stored poly accents. Tests run
the library store against core-db's real repositories on node:sqlite.

- **tool-metronome:** Setlists, setlist detail, all songs and preset editor

Part of #83. Setlists pins the on-stage set with its played count, searches
sets and songs, and leads to All songs, which reuses the detail list
grammar without reorder chrome. Setlist detail loads a song on tap (NOW
badge, no auto-scroll), reorders from the handle, and its long-press sheet
separates Remove from set from Delete song, which is confirmed. The editor
changes each field into a draft that only Save writes, and asks before
discarding unsaved edits. The transport's setlist key now opens Setlists,
and a loaded song's notes show above the tempo.

- **app-shell:** Setlist routes and the web in-memory library

Thin routes mount the four screens. The device runtime configures the
library with core-db's openDatabase(); the web runtime, which has no
op-sqlite, configures an in-memory repository persisted to localStorage so
the flows survive a reload in the browser. It is web-only and never on the
device path; tests cover reorder, cross-set move, literal %/_ search, one
active set and reload.

- **core-db:** Validated, selective v4 backup export and import

openDatabase().backup exports a v4 file keyed by UUID and imports one in
two steps: plan() validates the whole file (version, fields, blobs,
relationships) and counts new/unchanged/conflicting rows per category
without writing; apply() rechecks the plan against the current database
and writes it in one serialised transaction. Merge is the default and
needs a mine/theirs resolution per conflict; replace needs explicit
confirmation. Practice history and library songs are off by default,
as the Restore design specifies.

- **core-db:** Schema v9 gives practice sessions a uuid

Backups matched sessions on startTime, which two sessions can share, so
an export could fail its own import. v9 backfills a unique uuid like the
other exportable tables, and backups key sessions on it.

- **core-design:** Tool tiles, rows and grid for the Home hub

ToolTile, ToolRow and ToolGrid draw kitbag-ui.html §04's tiles and
cards from the §12.2 tokens. The upcoming state is muted and labelled,
never colour-only. packTileRows keeps registry order when a 2x1 tile
breaks a row. AppBar gains the wordmark title style Home uses.

- **core-state:** Remember the last-used tool

Home's Continue card needs the tool the user last opened (SPEC §12.4).
Storage is injected; with none configured it lasts for the session.

- **app-shell:** Home hub with Continue card and tool tiles

Replaces the #27 skeleton with kitbag-ui.html §04. Tiles come from a
list shaped like §9.1's ToolPlugin, so the §9.2 registry can swap in
data. Only the metronome has a store, so it alone shows live text;
unbuilt tools are muted with no invented figures (SPEC §2).

The web build persists the last-used tool in localStorage; native has
no key-value store yet. The 60fps gate leaves Home and is reached by
deep link.

- **tuner:** Shared contract for the tuner lanes (#118)

Types and config only, so the binding, data, design, state, tool and
shell lanes can work in disjoint files: tuner TurboModule methods and
HostObject properties in core-native, the TuningRepository contract in
core-db, tool-tuner's dependencies and test config, the worklet lint
block for tool-tuner, and expo-haptics in app-shell.

The web presentation host gains the tuner fields at the engine's rest
state so it still satisfies KitbagHostObject.

The Android build does not compile at this commit: the generated
NativeKitbagCommandsSpec now declares the seven tuner methods and
KitbagCommandsModule.kt does not implement them yet. The binding lane
supplies them.

- **core-db:** Schema v10 tunings.instrument and tuning repository (#118)

The tuner's in-tune window is chosen per instrument, so a saved custom
tuning has to record which instrument it is for. Schema v10 adds
tunings.instrument (NOT NULL DEFAULT 0, guitar) both in the baseline and as a
v9 -> v10 step. Built-in tunings stay code constants; only custom tunings are
rows.

createTuningRepository implements TuningRepository (list/create/update/delete)
on the serialised transactor and is exposed as openDatabase().tunings.
tuning-rules.ts validates 1..12 strings, notes 0..127 and the instrument enum.
These values are mirrored because core-db may not import core-native, and
engine-limits.test.ts pins them to kitbag_tuner_api.h and tuning_mode.h.

The backup TuningRecord always writes instrument. Older v4 files that lack the
field read it as guitar, and an out-of-range value is refused with its path.

- **core-design:** Tuner strip, peg selector, live text and shape icons (#118)

TunerStrip and PegSelector take engine-polled values as SharedValues and
move them only through useAnimatedStyle (SPEC §13.3). LiveText writes a
SharedValue<string> into a non-editable TextInput via useAnimatedProps.

Arrow, check and mic are drawn from Views rather than added to the glyph
map, since the vector icon set (#112) has not landed and glyph icons are
ruled out.

- **core-state:** Tuner store, serialised commands and mic lifecycle (#118)

Human-speed tuner state only (SPEC §13.3): mode (auto, manual string,
chromatic), current tuning, A4, strings tuned this visit, permission and
mic status, custom tunings. Needle, cents and detected string stay in the
HostObject for the worklet; it reports a lock through markTuned, which
returns true once per string.

Every tuner command runs through one promise queue so a later setter cannot
overtake an earlier one (set_tuning resets the mode). KB_ERROR_BUSY is
retried a bounded number of times, a tick apart. enter() resets to auto,
clears the tuned set, pushes tuning/A4/mode with the mic off, then
reset_note_presence(0) and tunerStart (SPEC §10.2 re-entry). leave() and
app backgrounding stop capture; foregrounding restarts it if the screen is
open, checking permission without prompting. A device init/start failure
leaves the mic "unavailable" with retryMic.

The runtime (commands, mic permission, app activity) and the
TuningRepository are injected through configureTunerRuntime and
configureTunings for app-shell to wire. There is no native fallback: an
unconfigured tuner throws rather than capture without lifecycle wiring.
Built-in tunings are not here; the store accepts any valid tuning.

- **core-native:** Bind tuner commands, state reads and A4 bounds (#118)

The Phase 0 contract declared seven tuner TurboModule methods and thirteen
tuner_* HostObject properties with no native side, so the Android build
failed. This wires each command Kotlin -> JNI -> kitbag::command* -> kb_tuner_*
and serves every tuner_* property from one kb_tuner_read_state copy.

KB_TUNER_A4_HZ {min, max, default} is now generated from TuningMode
(tuning_mode.h) instead of being retyped by the screen (SPEC §13.7).

- **tool-tuner:** Tuner screen with UI-thread needle and in-tune lock (#118)

TunerScreen composes the design's tuner (pegs, note readout, graduated
strip, Auto / A4 / Chromatic chips) from core-design and drives it from
the core-state tuner store.

useTunerFrame is the §13.3 path: a Reanimated frame callback reads the
tuner HostObject fields on the UI thread (re-reading once when a hop
lands mid-read) and writes the needle, note, caption, direction and
detected-peg SharedValues. Only two things reach JS, each when it
changes: the lock event, once per lock, and the hop's human-speed slice
(status, string, wrong-string hint, silence). The needle follows its
target exponentially per frame, jumps under reduced motion, snaps to
centre while the engine's in-tune ratio is at the tuned ratio, and holds
dimmed after the note decays until the next note or a reset.

A lock calls the store's markTuned; the first lock per string this visit
fires expo-haptics' Android confirm haptic. No sound.

Built-in tunings are code constants; custom tunings go through the
store's CRUD into the tunings table. The tuning list, tuning editor and
A4 sheets are built from existing primitives and await design sign-off.

The A4 range is a prop (a4Range) because KB_TUNER_A4_HZ is generated by
the core-native lane that has not landed; the shell passes the constant.

expo-haptics is a new peer/dev dependency of tool-tuner (already an
app-shell dependency), hence the pnpm-lock.yaml importer entry.

- **core-native:** Generate the tuner idle sleep and own the confirm haptic (#118)

KB_TUNER_IDLE_SLEEP_MICROS is parsed from Tuner::kIdleSleepMicros so the
BUSY retry can wait one analysis-loop sleep without retyping it.

confirmHaptic() wraps expo-haptics here: tools may not import native modules
(§13.1), so tool-tuner calls it through core-native and loses its own
expo-haptics dependency. pnpm-lock moves the importer accordingly.

The native-modules-thread reason now lives only in NativeKitbagCommands.ts,
and its per-method echoes of the ABI names are gone.

- **app-shell:** Wire the tuner route, runtime and mic permission (#118)

Mounts TunerScreen at /tuner. Focus enters the tuner store and blur leaves
it, so capture runs only while the screen is focused. The device runtime
passes the TurboModule tuner commands, maps PermissionsAndroid RECORD_AUDIO
(never_ask_again -> blocked) and forwards AppState active/background. Custom
tunings use core-db's openDatabase() behind one lazily-opened module until
#109's composition root absorbs it (docs/decisions.md 2026-10-14, item 6).
On web there is no capture path, so tunerStart reports device-init failure
and custom tunings sit in a localStorage-backed in-memory repository.

The Home tile and Continue card now open the tuner and show the current
tuning label. RECORD_AUDIO is added to the committed manifest and app.json,
along with VIBRATE and NSMicrophoneUsageDescription.

- **native:** Independent poly-row accents and poly beat sentinel

Adds kb_metronome_set_poly_accent, routed through the SPSC command ring into
a poly accent table kept separately from the main-row table. Poly clicks now
honour those accents: muted slots are silent and accented slots play at a
higher amplitude. Growing the poly count resets the newly included slots to
normal and leaves kept slots unchanged.

current_poly_beat publishes -1 when the metronome is stopped, when poly is
disabled, while a beat grid is active, and after a poly count change until
the next poly beat.

- **native:** Separate normal and accent click sounds at the C ABI

kb_metronome_set_sounds(engine, normal_sound, accent_sound) replaces
kb_metronome_set_sound. Accented beats play accent_sound; normal beats and
subdivisions play normal_sound; poly beats follow their own accent. An id
outside the engine sound table keeps that role's previous sound instead of
clamping to an edge sound. The sound-name table stays the one generated
from kSounds.

The metronome ABI checks move to tools/abi_test_metronome.cpp, keeping
abi_verify.cpp under the 400-line cap.

- **native:** Engine-scheduled count-in with pause that skips it

kb_metronome_set_count_in(engine, bars, distinct, sound) sets 0/1/2/4
count-in bars and either a distinct engine sound or the accent/normal pair.
The count is part of the metronome's own position: start places beat 0 of
bar one count_in_bars * beats_per_bar beats after the start frame, so the
count and bar one share one engine clock and the tempo, signature and
subdivision in force at start set its length. Subdivisions, poly and bar
mute do not sound during the count.

kb_metronome_pause stops like kb_metronome_stop but leaves the count spent,
so the next start goes straight to bar one; stop re-arms it. Grid mode and
anchor_external follow the song and skip the count. kb_metronome_counting_in
mirrors the count for the UI; bar_phase stays in [0, 1) during it.

- **native:** Preview a click sound at the current volume

kb_metronome_preview_sound(engine, sound, accented) queues one click of an
engine sound through the command ring. It fires at the start of the next
audio block, whether or not the metronome is running, on the same voices
and volume as the click. Ids outside the sound table are ignored.

Also shortens the count-in ABI doc comments to two lines.

- **native:** Tempo ramp over bars, seconds or minutes with loop-back

kb_metronome_set_ramp now takes a duration, a kb_ramp_unit (bars, seconds
or minutes) and a loop flag in place of a bar count. The tempo still steps
once per downbeat. Time units measure progress in rendered frames from bar
one, so the engine clock drives it and the current meter decides where the
steps land. At the end the ramp holds, or plays one bar at the end tempo and
restarts. An unknown unit or non-finite value keeps the previous ramp;
kb_metronome_set_tempo still cancels it, and start replays it.

The ramp moves into TempoRamp (tempo_ramp.h/.cpp) and the Accent/BeatGrid
types into metronome_types.h, which keeps metronome.h under the line cap.

- **core-native,core-state:** Bridge poly accents, sounds, count-in and ramp

Wires the new metronome ABI through KitbagCommands, JNI, the Kotlin
TurboModule and the TS spec: setPolyAccent, setSounds, previewSound,
setCountIn, metronomePause and the 6-argument setRamp. This removes the
calls to kb_metronome_set_sound and the old kb_metronome_set_ramp that
broke the Android native build. The HostObject exposes current_poly_beat
and counting_in.

Generated constants gain KB_RAMP_UNIT, KB_POLY_BEATS_BOUNDS,
KB_COUNT_IN_BARS, KB_DEFAULT_COUNT_IN_SOUND and the ramp duration bounds,
all parsed from the engine headers.

The metronome store adds a poly accent row, setSounds (invalid ids ignored
per role), previewSound, setCountIn, pause via metronomePause and a
unit/loop ramp that mirrors the engine's validation. countInArmed, the
store-only per-accent sounds and the single setSound are gone. The web
presentation runtime matches the new surface.

- **tool-metronome:** Sound and count-in sheets, ramp unit/loop, live poly row

Completes the four-chip row (Ramp, Mute bars, Sound, Count-in). The ramp
sheet gains a bars/sec/min segment and a loop-back toggle. The sound sheet
picks normal and accent sounds from the generated engine names and
previews each tap at the current volume. The count-in sheet sets Off/1/2/4
bars and distinct or same sound. The poly LED row reads store.polyAccents,
cycles with cyclePolyAccent and flashes from current_poly_beat through a
SharedValue.

PickerGrid joins core-design. Labels and option maps live in pure logic
modules with tests; the logic test config aliases core-native to its
generated constants so the barrel's react-native import stays out.

- **core-native:** Export tempo, mute-bar, ramp-bar and default-sound bounds

The generator now emits KB_BPM_BOUNDS, KB_MUTE_BARS_BOUNDS, KB_MIN_RAMP_BARS,
KB_SUBDIVISION_BOUNDS, KB_DEFAULT_SOUNDS and KB_COUNT_IN_OFF from the engine
headers, so the TS lane can drop its retyped copies (SPEC §13.7).

- **core-db:** Add a preferences table with synchronous reads (#121)

Schema v11 adds a key-value `preferences` table, exposed from openDatabase()
as `preferences.get/set`. Reads use executeSync so a value is available
before a screen's first render; writes queue behind the transactor so they
never join another caller's open transaction.

- **core-db:** Store a song's ramp unit and loop, schema v12 (#109)

SPEC §5.4/§5.8 require ramp to round-trip like any other field, but
presets stored only bar ramps, so a seconds or minutes ramp saved as off
and loop was always dropped. song_presets gains ramp_unit and ramp_loop;
ramp_bars holds the length in that unit and is bounded per unit against
tempo_ramp.h. Backups write both, and v4 files and web storage written
without them read as a bar ramp without loop.

- Stepped tempo ramps, +N BPM every N bars, seconds or minutes (#144)

A ramp is now a start, a step, an interval, a target and loop (SPEC §5.3,
D15). The tempo holds for one interval, then moves by exactly the step: on
the downbeat for bars, on the next beat for seconds and minutes. The last
step stops on the target, and loop holds it one interval before starting
over. The smooth From/To/Over ramp is gone.

- audio_core: TempoRamp steps per interval; kb_metronome_set_ramp takes
  target, step and interval. metronome_verify models the stepped ramp per
  beat, from the spec rather than the engine.
- core-native: setRamp carries the step; KB_MIN_RAMP_STEP_BPM generated.
- core-db: song_presets.ramp_step, schema v13; backups carry rampStep, and
  older v4 files read as a step of 1.
- core-state: RampConfig is targetBpm, stepBpm, interval.
- tool-metronome: the ramp sheet and the preset editor gain Step, Over
  becomes Every, and the sheet says when the target is reached.

- **core-design:** Vector icons from MaterialCommunityIcons, no emoji or glyph icons (#112)

Icons were emoji and unicode glyphs drawn in the platform font: some fell
back to colour emoji, sizes and baselines varied, and they ignored the
theme colour. Every icon now comes from one typed name map rendered by
MaterialCommunityIcons, at token size and theme colour. InlineIcon takes
size and colour from the text style it replaces, so call sites keep their
tokens. The hand-drawn tuner arrows, check and mic use the same glyphs.

The subdivision badge shows clicks per beat as x1-x16 instead of the
note glyphs, which were too small to read (SPEC 5.2). Row subtitles use
words. A lint stopgap rejects pictographs in source outside tests.

- **app-shell:** Notification transport model in Kotlin (#86)

What the notification shows and what each action does, with no Android
dependency so it runs as a JVM test. Kotlin owns it because the service
must keep handling play, pause, stop and tempo while JS is starved (#87).
Tempo steps from the rounded effective tempo like the screen keys; prev
and next are relative so JS stays the only owner of the setlist order.
CI and preflight now run the app's JVM tests with the release build.

- **core-native:** Foreground service and media session keep the click alive (#87)

MetronomeService runs as a mediaPlayback foreground service while the
metronome plays, with an ongoing MediaStyle notification and a media
session. Play, pause, stop and tempo ±1 from the notification, lock
screen or headset go straight to the engine through EngineTransport's
JNI, so they work while JS is starved; the app hears about each action
and updates its store. TransportModel moves to core-native with it.

Prev and next stay hidden: the app has no active-setlist navigation for
them to drive yet.

- **core-native:** Media card seek bar is the practice clock (#87)

Samsung's media card ignores metadata-only updates, so a clock in the subtitle
froze between play and pause. The seek bar is the one element the card animates
itself; it now carries practice time over 10-minute blocks.

- **native:** Click soak and click-vs-grid harness (#88)

click_soak judges a recorded or rendered metronome against its expected tempo
or beat grid: dropped, doubled and jittered clicks, interval error, tempo error
in ppm and windowed grid offset, with named exit codes. click_soak_verify pins
it on synthetic and engine-rendered fixtures; scripts/soak-analyze.sh runs it.
The 4h device recording is still to be made.

- Library with import and background beat analysis (#160)

One song list for single-file and stem songs, with search, filter chips,
badges and an import button. Imported files are copied into the app-owned
base directory and analyzed by a WorkManager task that survives the app
closing; results wait natively until the app stores them. kb_analyze_song
now streams the file in two passes, so memory no longer grows with the
decoded song (a 60-minute file peaks at 8 MB instead of 1.9 GB) and its
results are byte-identical to the whole-buffer version.

- Import StemDeck song bundles from a zip or folder (#136)

A bundle's stems are copied, streamed, into stems/<job>; its grid, bars,
sections, lyrics, key, loudness and mix go into schema v15; peaks become
.kwav sidecars through the one native writer. Wrong format or version is
refused with a readable notice; the same job imports again only after a
confirmed replace.

- **audio_core:** Expose mute-cycle, count-in and ramp-step reads (#171)

The status line must show which bar of a Play N / Mute N cycle is
playing, the count-in bar, and the ramp's next tempo and when it lands.
The engine kept none of that readable, so the UI could only guess.
Adds seven polled reads to the C ABI and the JSI HostObject, with
metronome_verify and abi_verify checks for each.

- **metronome:** Layout B performance screen (#175, #56, #171)

Rebuilds the screen below the tempo row to the approved mockup: app bar
with the setlist chip, meter and notation subdivision chips, beat dots
on their own row, one status line for count-in, the mute cycle and the
ramp, and a setlist / Play / Practice transport without the stopwatch.
Live indicators read the new HostObject values on the UI thread. The
glow behind the numeral is gone, and a first-use swipe hint shows once.
The meter, subdivision and Practice keys open interim sheets until the
new ones land.

- **metronome:** Subdivision, time-signature and Practice sheets (#173, #172, #81)

Replaces the interim sheets: all 16 subdivisions as notation tiles, a
time signature picked on wheels or from common meters, and one Practice
sheet holding the stepped ramp with typed From/To, mute bars, count-in,
sound and poly. Every value applies to a running metronome. The poly
row and the four-chip trainer row are gone.

- **core-design:** Mockup-sized control variants for the metronome (#175)

The metronome's sheets draw larger buttons, steppers, segments, chips,
preview keys and numpad keys than the shared defaults. Each gets an
optional size variant; every other screen keeps today's sizes.

- **native:** Mixer master gain, A-B loop with crossfade, metronome follows the mixer (#137)

Native half of the stem player. A looping reader on each track writes the
loop in playback order, crossfade included, so the callback reads a straight
stream; seek, stop and loop changes rebuild every track off the callback and
swap in together. The metronome can take its grid's song time from the
mixer's position each block, through seek, pause and loop wraps.

- Stem player screen, layout C (#137)

Bottom-dock layout the owner chose in docs/research/mockups/stems-layouts.html:
song facts as chips, per-stem level chip that opens a fader, explicit M and S
(mutually exclusive), A-B loop on the scrubber, icon-only transport with the
click. Stem songs store the bundle's title and artist (DB v16), library stem
rows show BPM, key, grid and stem badges, and faders are drag-only so a tap
cannot jump the gain.

- Rename songs, stem songs and stems (#176)

Library row actions gain Rename; a stem is renamed inline by long-pressing
its name in the stem player. Only stored display names change, so a
re-imported StemDeck bundle is still found. Schema v17 adds stem_sets.renamed
and per-stem names: replacing a bundle keeps a renamed song's title and the
user's stem names, matched by stem role. List row titles and subtitles are
single-line with an ellipsis, as the design files style them.

- Background playback and media notification for stem songs (#177)

A stem song now keeps playing with the app in the background or the screen
off, under the existing foreground service, renamed PlaybackService. Its
media card shows title and artist, -10 s, play/pause, +10 s and stop, and a
seekable progress bar. The service reads the mixer position natively, so
seeks and loop wraps reach the bar without going through React state. One
service owns one notification: a song card replaces the metronome's, which
covers the click joined to the stems. Single songs get no card yet because
no screen plays kb_player_*.

- Separate Songs and Stem songs screens, library layout B (#178)

The owner chose layout B in docs/research/mockups/library-layouts.html. The
Songs and Stem songs home tiles each open their own titled screen with no
type filter chips; setlists are reached from the Songs app bar. Rows are a
one-line title, a facts line (length, BPM, and key for stem songs) and
status badges, sorted by title. The shared screen app bar, FAB, empty state
and search field gain list variants instead of library-only copies, and
home tile titles stay on one line at large font scales.

- Keep the screen on while practising (#187)

The display timed out at the music stand while the metronome clicked, a stem
song played or the tuner listened. A core-native setKeepScreenOn command sets
FLAG_KEEP_SCREEN_ON, driven by one rule over the metronome, tuner and stem
player state. The stem player has no playing flag in a store, so the mixer is
read once a second while a song is open. A metronome still clicking after you
leave its screen keeps the screen on.

- **tool-metronome:** Stack live status rows below the beat dots (#175)

The owner chose stacked rows (metronome-status.html, variant A) over the
single-line priority order, so the mute cycle and a running ramp are both
visible every bar. Two rows of height are always reserved, so the dots and
transport do not move between states; the beat legend shows only while
stopped.

- **tool-metronome:** Pulse marks under the beat dots (#175, #173)

One mark per subdivision pulse; the sounding pulse turns accent. The pulse
comes from bar_phase in a UI-thread reaction and is written only when it
changes, so each beat re-styles one overlay per pulse, not every frame.
Muted beats and muted bars light nothing, since those pulses make no click.

- **tool-metronome:** Poly dots as a second row under the beat dots (#175, #56)

The owner kept polyrhythm on screen. Each poly dot sits at its time in the
bar, so a pulse that coincides with a beat sits under it. The sounding dot
reads current_poly_beat from the HostObject on the UI thread, as the
pre-redesign poly LED row did.

- **tool-metronome:** Type every Practice sheet number on the numpad (#175)

The sheet says "tap a number to type it", but only the ramp From and To
opened the numpad. Step, Every, Play and Mute bars and the poly count now
open the same sheet, with bounds from the engine constants (the interval in
its current unit) and clamping on confirm. The numpad sheet takes its bounds
and unit as props, and the mute steppers use KB_MUTE_BARS_BOUNDS instead of
a local minimum.

- **metronome:** Previous/next and a song list in the app bar while a setlist is on stage (#205)

The chip shows the loaded song over the setlist and position, previous and
next load the adjacent song through loadSong, and the chip's sheet lists the
set with Leave setlist. Loading a song from outside the set now clears the
active setlist instead of leaving it pinned.

- **metronome:** Clear the loaded song, and unlink it on Leave setlist (#205)

With no setlist active the song chip opens a sheet with Clear song and Open
setlists. Clearing or leaving drops the loaded song but keeps the metronome's
settings, so the sound does not change mid-play and the preset is untouched.

- **release:** Next version from tags, versionCode bounds, release gate (#211)

version.sh next derives the release version from the latest vX.Y.Z tag and
the conventional commits since it, never below app.json, which is now the
0.1.0 floor. Every merge bumps at least patch; breaking bumps minor below 1.0.
git-cliff --bumped-version was not used: it does not bump for docs/chore or
non-conventional commits and takes 0.x breaking to 1.0.0.

Gradle accepts -PkitbagVersionName so CI can build the tag's version without a
commit back to protected main, and both Gradle and version.sh refuse versions
outside minor/patch <= 99, where versionCode order would stop matching semver.
release-gate.sh is the single pre-publish gate and compares the APK's
versionCode against version.sh, pinning the two formulas to each other.

release.sh and its test are removed: they committed and pushed to main, which
the branch ruleset now refuses, and would race the release workflow.


### Fixed

- **metronome:** Phase-preserve latency offset; fix beat-0 swallow and ramp corruption

The D5 lookahead check found no scheduler window — the latency offset is a
per-sample phase bias — but exposed three bugs, all reproducing inside the
current ±100ms clamp:

- any positive offset swallowed beat 0 (gone at +0.5ms): position started past
  the grid point and nothing fires before frame 0
- a tempo ramp and an offset corrupted each other's grid and bar counter
- changing the offset mid-run dropped or doubled a click, double-incrementing
  current_bar_ on a downbeat

Route every offset and tempo change through phase preservation
(SetBpmPreservingPhase, and the same in kSetLatencyOffset) so `position` stays
continuous. Unify the sweep, LED and click onto one `position` clock (§13.3).
Name the D5 bound (kMaxLatencyOffsetMs), default BPM, and voice-silence
threshold. Add three regression tests.

metronome_verify green; tuner_verify unchanged at 37/37. See SPEC.md §4.6.

- **audio_core:** Pin the untested paths; restore the mixer defect note

Applies two review rounds on 7e01a36.

A test claimed coverage it did not have. TestGridStartAtKeepsSubdivisionCursor
was written to pin BeginPendingStart's observed_generation_ restore, but
deleting that line left the suite green. The re-fired subdivision lands ~160
frames later, inside kOnsetHoldFrames, so no onset-detector test at any anchor
can see it. Replaced with TestGridStartAtRestoresGeneration, which asserts on
block peak envelopes instead: a click only decays, so a rising peak with no
tick due is a second voice firing (0.2684 -> 0.5533).

The shared test rig passed vacuously on empty input — ExpectSpacing,
ExpectOnGrid and ExpectOnsetsAtSeconds all iterated over onsets.size() without
asserting it. The helpers now own their size assertions, so a run producing
three of eleven expected onsets fails. Each verifier's main asserts a total
check count; abi_verify's TestClearGrid turned out to contribute zero checks,
so deleting its call was invisible even with the tripwire. It has real
assertions now.

Splitting ApplyPendingCommands into four partial handlers silently disabled
-Wswitch: a new CommandType fell through all four and was dropped with no
diagnostic. One exhaustive dispatcher restores the compile-time check, and an
unclaimed command now asserts rather than being discarded.

PitchAnalyzer's 4-state lock machine had zero automated coverage — the detector
returns 0.000 Hz (SPEC.md §10.1) so PublishFrequency is never reached with a
live frequency, and its refactor rested on a throwaway harness that no longer
exists. Extracted NoteLock behind a real seam with note_lock_verify pinning
every transition.

The refactor had also moved four per-sample callback helpers across TU
boundaries where they could no longer inline. Release builds now enable LTO;
verified by symbol count on the linked .so, not on the object files, which
carry bitcode.

Reverts a comment this branch got wrong. mixer.cpp's read head advances by the
maximum across played tracks; SPEC.md §2 lists that as an audit defect and §4.4
says to make it the minimum. An earlier commit rewrote the comment to describe
the maximum as intended, which asserts a bug as behaviour — the exact failure
mode that pass was meant to catch. The comment now names it as a known defect
and points at the spec.

- **mixer:** Muting every track no longer ends playback

Process() auto-stopped whenever nothing was audible. MixTrack returns 0 for a
track that is muted, has zero gain, is un-soloed while another track is soloed,
or sits at a mismatched sample rate — so "every track ran out of data" and
"nothing sounded this block" were the same condition. Muting all tracks, or
zeroing all gains, stopped playback outright. SPEC.md §4.4 has said this must
not happen; it did.

The transport is now the longest loaded track, independent of mute/solo/gain
gating, and auto-stop fires when the read head passes it. A muted track holds
the transport open, which is the point.

The advance itself becomes min(frame_count, longest - start_frame) rather than
max over audible tracks. The two are equal whenever the longest loaded track is
audible, so this generalises the existing behaviour rather than replacing it —
but keeping the old form while moving only the stop condition would freeze the
read head with everything muted, quietly turning mute into pause and desyncing
the resume against the click.

Also withdraws a wrong entry from the §2 audit and the §4.4 bullet derived from
it. Both said the read head should advance by the minimum across played tracks,
because a stale comment claimed that while the code did the maximum. Measured
with ramp fixtures whose sample values encode their own frame index: stems share
one read_frame_ and have no per-track cursor, so they cannot desync, and the
minimum is what breaks — with 1000- and 5000-frame stems seeked to 900 it
advances 900 -> 1000 while having already output through 1412, replaying 412
frames at every block near the short stem's end. The maximum was correct.

New tools/mixer/mixer_verify.cpp, 36 checks, pins all of it including the
unequal-stem sequence so nobody "fixes" the advance back to a minimum. Six
sabotage runs, each producing distinct failures.

- **audio_core:** Request ma_format_f32 explicitly; gate the verify tools in CI

- **audio_core:** Guard the analyze path against non-finite PCM, zero channels, and INT_MAX frames

kb_analyze_song (Decoder -> downmix -> BeatTracker -> sidecar) had no test of any
kind. That is how #18 shipped: the decoder emitted NaN for every 16-bit file and
nothing traversed the path that consumes it. Three of the defects that hole hid
are live on the shipped ABI, not merely untested.

waveform_peaks.cpp cast a non-finite sample straight to int16_t. After #18 a file
could decode to NaN or 3e38; min_val * 32767 then left int16_t range or was NaN,
and the C++ float-to-int conversion of that is undefined behaviour -- reachable
from an input file, which makes it the serious one. Quantize maps non-finite to 0
and clamps to [-1,1] before the cast, byte-exact for in-range audio.

The downmix summed with no finiteness check, so one NaN sample poisoned every
aggregate and kb_analyze_song returned KB_OK with a NaN bpm_out. And sum/channels
was unguarded on the beat-track consumer though the sidecar writer already guarded
it, so a zero-channel decode divided by zero. Both now reject with
KB_ERROR_INVALID_ARGUMENT -- a documented code reused, not a new policy; SPEC.md
is silent here, so the contract is recorded in the kitbag_api.h doc rather than by
minting a code.

Three uint64_t->int narrowings wrapped a >INT_MAX frame count to a negative that
tripped ComputeWaveformPeaks' num_frames <= 0 guard, so the sidecar was silently
not written and no error returned. NarrowFrames rejects above INT_MAX at the
boundary.

To make the guards reachable by a test, the pipeline is lifted out of
api_analysis.cpp's anonymous namespace into a song_analysis module; the ABI file
is now a thin shim over it. ralph confirmed the downmix loop is byte-identical to
HEAD and the beat/sidecar output is unchanged for valid input -- only the three
guards are new. The test drives the same AnalyzeDecodedPcm symbol the ABI links,
not a parallel copy, so item 1's NaN path (unreachable through a real s16 WAV) is
covered through the internal entry while the end-to-end WAV path covers the finite
case.

analyze_verify (25 checks, kExpectedChecks-guarded) is gated in CI. Sabotage, one
mutation per build, each revert md5-confirmed (rtk's diff proxy has falsely
reported "identical" in this repo):

  Quantize -> raw casts     -> waveform: huge finite max clamps, not UB
  drop channels==0 reject   -> channels==0 rejected instead of NaN
  delete AllFinite          -> one NaN sample rejected, not KB_OK with NaN bpm
  delete >INT_MAX bound     -> NarrowFrames: INT_MAX+1 and UINT64_MAX rejected

Sibling grep: beat_tracker.cpp:243 (sum_onset/onset.size()) is unguarded but
unreachable today (only reached after onset.size() >= 10) -- recorded in the
tracker as a latent trap, not fixed here. All other divides and narrowings
(audio_source.cpp:92, beat_tracker.cpp:128/145/310) are guarded.

- **metronome:** Cascade per-beat mute to its subdivisions

OnSubdivisionTick derived a subdivision's owning beat from the
latency-unshifted beat_position_, while the tick fires on the
latency-shifted position. Above 0.5-beat latency (bpm > 300 under the
±100 ms clamp) the two disagree, so a muted beat's own subdivision kept
sounding. Measured at bpm 400, beat 1 muted, +100 ms: the pos-1.5
subdivision peak was 0.334 -> 0.300 (leaked) instead of 0.334 -> 0.003.

decisions.md 2026-07-21 ruled cascade = yes on the position / speaker-
time base: mute what is heard, not grid-time. So attribution now uses the
same sub_index the tick fires on (owning beat = sub_index / subdivision_
in constant tempo, grid_beat_index_ in grid mode), passed in as a
parameter. Callers fire only at a non-negative beat, so the old
accents_[-1] guard and its beat_position_ read are gone; the pre-beat-0
region is covered because position is what the fire guard already gates.

New metronome_verify check pins the hole issue #21 named: mute beat N
under +100 ms at bpm 400 and assert its subdivision is silent, with a
sounding control and a beat-0 subdivision that must stay audible.

- **loop:** Label agent messages with NOTE tag; exit cleanly on interrupt

Agent narration rendered as an unlabeled dim line — ambiguous and low-contrast.
Tag it NOTE (white-on-magenta) with readable text. Wrap main in KeyboardInterrupt
/ BrokenPipeError so Ctrl-C or a closed pipe exits 130 without a traceback.

- **native:** Gate kb_engine_render tools-only, refuse while device runs [#11]

Address A6 review. kb_engine_render returns PCM across the C boundary, which
§4.1 forbids on the shipped ABI (the app passes paths and receives scalars;
samples never cross). The prior header only asserted production would not call
it — intent as behaviour. Now the declaration (kitbag_api.h) and definition
(api.cpp) are both wrapped in KITBAG_BUILD_TOOLS, defined PUBLIC on kitbag_core
only when the verify tools build, so the symbol is absent from a production
library by construction (verified: nm shows 0 exports without the define, 1
with it). "Samples never cross" is now true by the build, not by discipline.

Add an is_running() no-op guard at the top of kb_engine_render: even tools-only,
pulling a block while the device callback is live puts two threads in Render and
races the non-atomic mixer/player/metronome state. Relaxed atomic load, no
alloc/lock/syscall. stream_verify gains a check that render is a no-op while the
device is running (start -> render into a sentinel buffer -> assert untouched),
sabotage-proven: dropping the guard zeroes the buffer and the check fails.

Collapse the duplicated "never call while running" comment: engine.h's
RenderOffline now points to the ABI doc instead of restating the rule.

- **loop:** One blocking wave per invocation, never background-and-poll

The driver stranded A6+D2 with fixes committed in worktrees but unmerged:
the orchestrator was spawning detached 'claude -p' workers and polling for
their commits across invocations, turning one wave into ~8 full-context
poll-invocations (512k ctx / 34M cache-read each) that halted when
re-invocation stopped.

Redefine an increment as one atomic, synchronous WAVE: dispatch all parallel
tracks in a single blocking multi-Agent message, then review/fix/gate/merge/
persist in the same invocation; never exit while dispatched work is unfinished;
never detach a worker or poll. Prompt, skill body, steps, and description
aligned. Add nohup detach guidance so a closed terminal can't kill an
unattended run mid-wave.

- **media:** Rebuild+republish source on live seek, never Clear a live ring (#25)

A live Seek (mixer track or player) called AudioSource::Seek -> SpscBulkRing::Clear,
whose contract requires both producer and consumer stopped. During playback the
device callback is still the consumer: Clear stored tail=0 while a concurrent Read
stored tail+n over it, leaving tail past head. read_available() then underflows and
the callback reads a stale/garbage block until head climbs back past the clobbered
tail. All atomic, so no crash — a bounded audible glitch. Byte-identical in the
mixer and the A5 player; pre-existing, not an A5 regression.

- **seek:** Gate in-place ring Clear on true quiescence, not source thread (#25)

Review fix-round on the #25 live-seek wave (ralph + code-reviewer).

Finding 1: the paused-seek in-place AudioSource::Seek->ring Clear was gated on
live_source->is_running(), which Pause()/Stop() drive false a block before the
device callback stops draining playing_==true — reintroducing the #25 filled =
0 - old_tail underflow for one block. Gate the in-place path on true quiescence
instead: rebuild-and-republish (ReseekLive) whenever the device is running OR
the source read-ahead thread is running (AudioSource::Seek refuses a running
thread anyway); Clear in place only when both are idle. Applied to Mixer::Seek,
Player::Seek and Mixer::Stop() (which shared the window via its in-place
Seek(0)); Stop() now takes now_frame/engine_running and rewinds by rebuild when
the device is live. kb_mixer_stop and the mixer tests pass the two new args.

Finding 2: when BuildReseekSource fails, ReseekLive resumes the old source at
its old position; Seek now suppresses the kSeek enqueue in that case so the
transport holds the audible position instead of jumping to the target. Both
engines; ReseekLive returns bool.

Finding 3: de-duplicated the verbatim ReseekLive ordering comment — stated once
at Mixer::ReseekLive, referenced from Player::ReseekLive.

Finding 4: factored BlockPeak() in metronome_test_support.h, shared by
RenderContinuousPeaks and WindowedPeak.

Tests (seek_race_verify): the pause->seek window is a us-scale TOCTOU whose
threaded reproduction is vacuous/flaky headlessly (a test callback Read is us,
shorter than the pause's Stop()-join, so the vulnerable Read closes before the
Clear — unlike a real ~10ms device block). Gated deterministically instead:
after Play; Pause; Seek(engine_running=true) the fix rebuilds+primes (buffered
> 0) while the sabotage Clears the stopped ring in place and never restarts it
(buffered == 0) — red 8/8 under the reverted predicate, green under the fix, on
both engines. Added a Finding 2 case (delete the file mid-play so the rebuild
fails; a held transport position is the proof). Direct threaded races retained.

- **loop:** Clean Ctrl-C + push each wave so remote stays current

Ctrl-C during uv's cold-start import of rich escaped the module-level try and dumped a traceback; guard the rich imports to exit 130 quietly. Add a SIGINT trap in the driver for a clean top-level message, and push HEAD after every completed wave (tolerating a failed push) so the remote no longer lags 50 commits behind local.

- **loop:** Stop unattended re-invoke on a narrated stop-point

claude -p exits 0 on normal completion, so a stop-point the model only narrated was invisible to the driver — the unattended loop re-launched on the same blocker (observed: 3 waves, tree untouched). The driver now breaks on either signal: a .loop-halt sentinel the skill writes at every stop-point / nothing-to-do (carries the reason), or a wave that added no commit (dispatched nothing). Skill updated to write .loop-halt before exiting any non-dispatching terminal state; .loop-halt gitignored.

- **wave1:** Close review findings — ignore generated theme, ban react in plugin-api, doc nits

- .prettierignore: exempt core-design generated theme.css/tailwind.config.js so generate:check and format --check stop conflicting
- eslint-plugin-kitbag: plugin-api-imports-nothing now flags react/react-native/native specifiers per §9.1; test case flipped valid→invalid
- core-design tokens.ts: stale .mjs→.ts generator reference
- decisions.md #38: VERIFIED→CORROBORATED to match hedged body

- **wave2:** Wire lint eval harness to run as a gate (#36)

Declare the harness's deps on @kitbag/app-shell (vitest, eslint,
eslint-plugin-boundaries, typescript-eslint, eslint-plugin-kitbag) and
add a 'test' script — the harness aborted on import before. Allow
esbuild's build (vitest dep) via onlyBuiltDependencies so pnpm install
exits 0; ignore the eval scenario fixtures in the root eslint run (they
are deliberately rule-violating trees the harness lints itself); narrow
two restrict-template-expressions gaps and drop a dead type assertion in
the harness source. Harness now scores 31/31 scenarios green.

- **core-native:** Value-property JSI reads + import-safe barrel (#30, #29)

Review findings from ralph + code-reviewer on wave 2:
- §13.3: HostObject reads are now number-valued properties, not
  callables — get() returns a jsi double directly instead of building a
  jsi::Function per property access, which a 60fps worklet would have
  allocated every frame. Contract, C++ scaffolding and worklet doc all
  aligned to the property model.
- Barrel is now import-safe: the TurboModule is reached through a lazy
  getKitbagCommands() rather than an eager default that resolved (and
  threw, pre-#31) at module load, so the generated constants and the
  snapshot decoder stay importable on their own.
- snapshot.test.ts gains a PackSnapshot-derived round-trip fixture
  pinning the decode to the producer's bit math (21 -> 22 tests).
- Nits: dropped a duplicated ownership sentence, named the tuner-row
  shape in the constant generator. Generated output byte-unchanged.

- **core-native:** Make it an autolinked Android library so codegen runs (#33)

First real device build of #33 (Expo prebuild, RN 0.83 New Arch, Android)
failed at :app:compileDebugKotlin — NativeKitbagCommandsSpec unresolved,
every override in KitbagCommandsModule "overrides nothing". Root cause:
core-native had a codegenConfig but no Android Gradle module, so RN's
New-Arch codegen never generated or compiled the TurboModule spec base
class; the hand-written Kotlin in app-shell had nothing to extend.

Make @kitbag/core-native a proper autolinked RN Android library (the way
RN 0.83 wires third-party TurboModules — mirrors react-native-worklets),
which also restores SPEC §13.1: the JSI/TurboModule surface, Kotlin and
all, is owned by core-native, not app-shell.

- core-native/android/build.gradle (new): com.android.library + the react
  plugin with codegen enabled, prefab, externalNativeBuild → the module's
  own CMakeLists (so kitbag_core/kitbag_jsi build exactly once, here, not
  also via the app), abiFilters arm64-v8a.
- codegenConfig.android.javaPackageName = com.kitbag.corenative.
- Moved KitbagCommandsModule.kt / KitbagCorePackage.kt into the library
  under com.kitbag.corenative; dropped the retyped NAME + getName override
  (the generated spec owns both — §13.7).
- app-shell: removed the externalNativeBuild that pointed at core-native's
  CMake (now the library's job), removed the manual add(KitbagCorePackage())
  from MainApplication (autolinking registers it — adding it too would
  register the TurboModule twice), narrowed reactNativeArchitectures to
  arm64-v8a (matches the gate device; also sidesteps a host ld.gold/LLVMgold
  LTO probe failure on armeabi-v7a).
- KitbagJni.cpp: renamed all 14 JNI entrypoints com_kitbag_app ->
  com_kitbag_corenative to match the class's new package (name-based
  binding, no RegisterNatives) — without this assembleDebug links and
  packages fine but UnsatisfiedLinkErrors on the first command at runtime.
- .gitignore: exclude .cxx/ (CMake intermediates); ignore packages/app-shell/ios
  (out of scope, Linux dev / Android-only gate, regenerated by prebuild).

No second engine, no second .so, no retyped constants (§4.5, §13.1, §13.7).

Verified with the real toolchain: :kitbag_core-native:compileDebugKotlin and
:app:compileDebugKotlin both BUILD SUCCESSFUL; nm -D on the built
libkitbag_jsi.so shows all 14 JNI symbols carry com_kitbag_corenative and
zero carry com_kitbag_app. NOT verified: full assembleDebug/APK packaging
and on-device runtime (the JSI install + command dispatch remain the #33
device gate). Reviews: ralph (caught the codegen gap, the JNI package
mismatch, and the ABI reconcile — all fixed), one-focused build-graph pass.

- **core-native:** 16 KB-align our native libs for Android 15+ devices (#33)

The device (16 KB page size) rejected the APK at install: our libkitbag_jsi.so
and libkitbag_core.so were linked by NDK 27.1 with 4 KB (0x1000) ELF LOAD
segment alignment. Add -Wl,-z,max-page-size=16384 via CMAKE_SHARED_LINKER_FLAGS
in the core-native Android module's externalNativeBuild args (Android-only seam,
not the shared native/audio_core CMakeLists which also builds headless host
tools). A global shared-linker flag reaches every SHARED target in the configure,
covering both libs in one shot; ANDROID_STL arg preserved.

- **app-shell:** Gate runs the metronome in constant-tempo mode, no grid (#33)

The gate fed the metronome a grid at Start (setGrid), which puts the engine in
song-follow mode: bar_phase is driven by the fixed grid beat-times, so live
kb_metronome_set_tempo can't move the sweep — only stop+restart (rebuilding the
grid) did. Confirmed by tracing metronome_render.cpp: with a grid present +
running, RenderGridBeat owns the beat clock and AdvanceConstantTempo is skipped
(dispatch at :332); bar_phase comes from GridSeconds against the frame clock
(metronome_grid.cpp), where bpm_ never appears.

Drop setGrid. Start is now start() -> setTempo -> setBeats ->
metronomeStart(frames_rendered). metronomeStart flips running_ and, with no
grid, PublishBlockMirrors advances bar_phase from the tempo — so live setTempo
(wired in 1f25d05) now moves the sweep, ramps work, and it starts phase-aligned
at beat 0. This is also the faithful metronome path: SPEC §5 is tempo-driven;
grids are the song-playback mode (§4.2, kitbag_api.h grid-precedence contract).

Removed dead code: GATE_GRID_BEATS, SECONDS_PER_MINUTE, the beatTimesSec build,
and the grid/shared-anchor comment block (rewritten for constant tempo).
typecheck + lint --max-warnings 0 green; on-device behavior is the user's to
observe (#33). Frame path untouched (§13.4).

- **core-native,core-state:** Generate the denominator set from the engine

Review fixes on 2e1b2d6 and 78a0102.

The constant generator now parses Metronome::kDenominators, kMaxBeats and
kBpmReferenceDenominator (§13.7), so the store derives VALID_DENOMINATORS and
the Denominator type from the engine instead of hand-retyping {2,4,8,16}.
setBeats gains the upper bound it lacked: it clamps to KB_MAX_BEATS rather than
holding 99 beats while the engine plays 16 (sabotage-proven vitest).

Docs corrected: D1's command chain is closed, D1 itself is not (the M3 stepper
is unbuilt), the chain is proven by vitest and typecheck only with no device
run, and grid/song-follow mode ignores the denominator by design.
The CHANGELOG entry replaces a file-by-file narration.

Prettier gate: format.sh calls `pnpm -w format:write` instead of a swallowed
npx invocation, READMEs join the ignored prose, and app.json is formatted
rather than exempted.

- **core,scripts:** Restore denominator doc values, scope staged formatting

kb_metronome_set_beats' header doc pointed C consumers at
Metronome::kDenominators, a C++ internal they cannot read; list {2, 4, 8, 16}
explicitly and keep the C++ owner as a pointer. Reflow the ragged wrap in the
same block.

scripts/format.sh ran the whole-tree prettier script in --staged mode and never
re-staged its writes, so a pre-commit could dirty untouched TS files. Format
only the staged, prettier-supported files and git add them, matching the
clang-format branch.

Note at both DEFAULT_DENOMINATOR sites that 4/4 only coincides with the engine's
BPM reference note.

- **tool-metronome:** Match §5.2 screen to design-file tokens (#46)

- **app-shell,tool-metronome:** Generate typed routes before typecheck; format

typedRoutes is on and .expo/types is gitignored, so app-shell's typecheck
failed on a fresh checkout once the /metronome route landed — turbo's cache
replayed a stale pass and hid it. Regenerate the route types as part of
typecheck (expo customize tsconfig.json, idempotent and git-clean).
StepBadge.tsx re-formatted per prettier.

- **core-native:** Wire metronomeStop/setRamp/setBarMute through the TurboModule chain

The codegen'd spec declared these three commands since M1 but the Kotlin
module, JNI bridge and C++ wrappers never implemented them, so every
Android build past that point failed at :kitbag_core-native:compileReleaseKotlin.
Headless gates never compile Android Kotlin, which is why it went unnoticed.
Mirrors the existing per-command pattern end to end; JNI symbols unexercised
until a device run.

- **app-shell:** Color the home skeleton's text against the dark scene

The router paints every scene bg.dark, so the #27 skeleton's unstyled Text
rendered black on near-black and the home screen read as a dead app.

- **core-db:** Awaited repository transactions and dense reorder

drizzle-orm 0.45's op-sqlite session.transaction() sends BEGIN, calls the
callback without awaiting it, then COMMITs, so its transactions are not
atomic on device. Repositories now go through a serialised transactor that
awaits BEGIN/work/COMMIT and rolls back on error; the node:sqlite harness
uses the same transactor.

- Every open runs the migration runner, which leaves foreign keys ON.
- Preset delete removes its setlist memberships explicitly in one transaction.
- add/move/moveTo renumber the whole list densely, so deletion gaps heal.
- The v6 upgrade runs v6->v7->v8 and the user_version bump as one transaction.
- index.ts exports only openDatabase, the two repository factories and row types.
- SPEC 11.2 records the v8 active flag and poly_accents column.

- **app-shell:** Lazy native runtime, query fallbacks, shared constants for web presentation

- **tool-metronome:** Declare swipe worklet helpers before their callers

The worklet plugin turns 'worklet' function declarations into closures
that capture their callees at definition, so dragTempo captured clampBpm
before it existed and the web build threw "Cannot access 'clampBpm'
before initialization". clampBpm now comes first. A new test fails if a
worklet in swipeTempo.ts calls one declared after it, and it does fail
against the old order.

- **core-design:** Sheet drag on Gesture Handler, onDanger role, fewer comments

Drag-to-dismiss moves from PanResponder to a react-native-gesture-handler
Pan (the locked choice), with its own root view inside the Modal. The 25%
threshold is SHEET_DISMISS_DRAG_FRACTION, a recorded assumption pending
design sign-off. gesture-handler is a peer and dev dependency; the
lockfile is regenerated at integration.

The destructive button fills with feedback.danger and labels with
theme.onDanger, which resolves to surface1: at least 4.5:1 on the danger
fill in both modes. onAccent (4.41 light) and the design's #fff (3.03
dark) are not. A test pins the ratio.

- **core-design:** Address review of the shared primitives

Card reuses theme's FEEDBACK_TOKEN, and active emphasis now requires an
activeLabel announced with a selected state rather than relying on
colour. SegmentedControl takes neighbourGapDp through hitSlopFor instead
of a lone-option special case, and its container is a radiogroup of
radio options. The sheet's dismiss decision is a pure
shouldDismissSheet, guarded against an unmeasured height and unit
tested, with a named drag-activation distance. iconSizes.key is gone.
Adds the tempo-zone, sweep and pill-value roles the metronome needs,
and style blocks move above their components for no-use-before-define.

- **tool-metronome:** Tempo zone gradient, role-driven sizes, lint order

The swipe zone draws the design's radial glow with RN's
experimental_backgroundImage; the old comment claiming RN had no radial
gradient was false. The pill, zone, sweep and screen take glyphs from
icons and geometry from core-design roles, so the pill matches the
chips, and the screen gap is the design's 12. workletOrder.test.ts is
replaced by no-use-before-define for tool-metronome and core-design,
which reports the old swipeTempo order.

- **app-shell:** Home follows the active theme

- **tool-metronome:** Show the engine tempo; ramp edits are a draft

The BPM readout is an animated TextInput fed by current_bpm through the
frame worklet, so a running ramp shows what plays without React state
(§13.3); swipes anchor on that value and the numpad opens from it.

Ramp steppers now edit a draft that only Start sends, so adjusting a
running ramp no longer restarts it, and a fresh sheet prefills From/To
with the current tempo. Sheet logic moves into useRampEditor and
useBarMuteEditor. Chip labels read "120 to 140 BPM", and the mute
steppers announce their value in bars.

- **core-state:** Trust the engine tempo only while running

Commands queue until the device opens on start, so before the first
Start current_bpm is still the engine default: typing 97 then +5 gave
125 and the numpad reopened at 120. The engine read now applies only
while running; otherwise the store's tempo stands. Stop and pause read
the engine before stopping it. New tests cover the pre-start case and
the pause resync, and each fails if its guard is removed.

The tempo readout announces its value again ("97 BPM").

- **tuner:** Replace the silent detector with a string-aware tuning mode

PitchAnalyzer reset its detector on every update while the note lock was
still acquiring, so a clean tone never produced the 20 consecutive readings
the lock needed and every reading stayed at 0 Hz.

The detector is now a McLeod pitch method on 4096-sample frames with a
2048-sample hop. A tuning mode on top of it implements
docs/tuner-functional-spec.md: auto string selection within 350 c, manual
string lock, chromatic mode, wrong-string hints, note presence with hold and
reset, and an in-tune ratio. It is exposed through kitbag_tuner_api.h, and the
new constants are generated for TypeScript. kb_tuner_snapshot is derived from
the same tuning mode. NoteLock and the cycfi/q include paths are removed.

tuner_verify was written first, from the spec, and failed against stubs
before the implementation.

- **core-db:** Backups settle, round-trip, and enforce engine bounds

- Merge compares the value that would be written: references into a
  category not being imported resolve through local ids, so a
  default-category import run twice plans all-unchanged.
- export(['setlists']) carries the presets it lists; a property test
  checks every category subset of several seeded states re-imports.
- Preset bounds (bpm, beats, denominator, sound ids, accent bytes,
  per-accent sounds as a normal/accent pair) are checked on repository
  writes and on import from one shared rule set. core-db cannot import
  core-native, so the bounds mirror the engine headers under a drift test.
- plan() takes a string only; UUIDs are lowercased; tunings need strings.
- apply() re-validates the planned file and returns every failure,
  including a rolled-back write, as a Result.

- **core-db:** Store blobs as Uint8Array, not Node Buffer

drizzle's blob buffer mode calls Buffer.isBuffer/Buffer.from when reading
rows, and Hermes has no Buffer, so every preset read would throw on
device. A bytes custom type maps op-sqlite's ArrayBuffer (or any view) to
a fresh Uint8Array and passes Uint8Array through on write; base64 uses
atob/btoa. core-db src no longer references Buffer, and a test runs the
repositories and a backup round-trip with the Buffer global removed.

- **core-db:** V9 repairs stored presets the engine would refuse

Rows carried from v6 (or written before the preset rules existed) could
break them, and backup import would then reject the app's own export.
v9 clamps bpm, beats per bar, sound and poly beats to engine bounds, pads
or trims accents to the bar reading unknown codes as normal (as Flutter
did), and clears mis-sized poly or per-accent blobs.

- **core-db:** Backup import accepts a tuning with no strings

Export wrote empty tunings that import then refused, breaking the rule
that every export imports. Tuning content rules belong to the tuner
lane; until then an empty tuning round-trips unchanged, and the
export-is-importable property test seeds one.

- **core-db:** V9 repairs every field the preset rules check

The repair missed poly accent codes, per-accent sound ids and the
denominator, so a migrated row could still fail its own export->import.
Poly accent codes outside kb_accent now read as normal, bad sound ids
clear per-accent sounds, and a bad denominator becomes 4. The rules
also bound ramp bpm/bars, mute bars and subdivision to the engine
limits (mirrored under the metronome.h drift test), and v9 repairs
those too. Triggers refuse a NULL practice_sessions.uuid, since SQLite
cannot add NOT NULL to an existing column.

- **core-db:** Validate restored tuning notes and prove every upgrade path (#118)

Backup import now runs tuningViolation over the whole tuning, not only its
instrument, so a restored row the tuner cannot load is refused like any
other invalid field. v10 drops legacy rows that would fail that rule (no
strings, more than 12, a note above MIDI 127); the empty-tuning round-trip
that d889ce5 allowed is replaced by refusals.

The fresh-vs-migrated parity test now starts from v6, v7, v8 and v9:
dropping MIGRATE_V9_TO_V10 from the v8 path passed before and fails now.
upgradeSteps is an ordered list filtered at the source version.

- **core-state:** Space BUSY retries, one tuning rule, keep progress on rename (#118)

BUSY retries wait one engine idle sleep (2 ms) instead of a 0 ms tick that
could spend all three before the analysis thread drained the queue.

isValidTuning is core-db's tuningViolation, so the store now refuses notes
outside 0-127 and the duplicate instrument set is gone. Renaming the selected
custom tuning updates its name without resetting the mode or the strings
tuned this visit. Custom-tuning actions and the state types move out of
store.ts; the tests split along their describe blocks over a shared harness
(*.test-helper files get the test-file lint relaxation). CustomTuning and
MAX_MIDI_NOTE are exported.

- **tool-tuner:** Manual-only wrong-string hint, dwelled status, no stale locks (#118)

- The wrong-string hint shows in manual mode only (tuner functional spec
  §3.1); in auto it flashed on every string change.
- The discrete slice crosses to React only after holding for 250 ms, so a
  status flickering at the in-tune edge no longer re-renders the screen and
  re-announces on every hop.
- A reset records the measurement id; locks arm only once a later hop is
  heard unlocked, and the JS side drops lock events from before the reset,
  so a hop from the old tuning cannot mark a string of the new one.

- **tool-tuner:** Renaming the selected tuning keeps the readout (#118)

The readout reset key carried the tuning name, so a rename cleared the
needle and re-armed the lock guard although the engine's tuning was
unchanged.

- **native:** Clamp raw int32 accents on drain for both accent setters

kb_metronome_set_accent and kb_metronome_set_poly_accent cast the caller's
int32 accent to the uint8 Accent enum before it reached the ring, so 256
wrapped to muted and negative values wrapped unpredictably. The raw int32 now
rides the command and is clamped in SetAccentSlot, so both contracts match.

- **native:** Reset main-row accents exposed by a growing beat count

Muting beat 4 in 4/4, switching to 3/4 and back left beat 4 muted in the
engine while the store, which resets grown slots to normal, showed it
normal. SetSignatureState now resets newly exposed slots to normal, the
same policy the poly row uses, so store and engine agree with no resend.

The pattern-state helpers move to metronome_pattern.cpp, which keeps
metronome.cpp under the 400-line cap.

- **native:** Exact bar one after long count-ins; review fixes for #75-#77/#93

Summing beats_per_sample over a long count-in (4 bars of 16/4 at 20 BPM)
drifted bar one a sample late. The count now snaps beat_position_ to bar
one at the nearest sample, so a counted run matches a plain start there
sample for sample, under any latency offset.

Also from review:
- Accent and poly-accent indexes past the current bar or poly count are
  ignored; set_beats documents that growing resets new beats to normal.
- Ramp BPMs are validated before clamping, so +-inf keeps the previous
  ramp instead of becoming 400; TempoRamp owns the BPM bounds and
  BpmAtDownbeat is renamed StepAtDownbeat.
- static_asserts tie kitbag::Accent to kb_accent.
- Header docs: volume comment reattached, loop cycle length, caller-chosen
  count-in sound, preview collapse per block; stale render comments cut.
- Tests: long count-ins at 20/400 BPM and +-100 ms, tempo change during a
  count, preview while running, accent past the bar, +-inf ramp BPMs, and
  pinned mid-bar seconds-ramp apply and pause restarting the ramp.

- **core-state,core-native:** Clamp volume and bar-mute to engine bounds

setVolume clamps to KB_VOLUME_BOUNDS, now generated from
Metronome::kMinVolume/kMaxVolume, and setBarMute clamps play and mute bars
to 1..KB_MAX_MUTE_BARS, before both the store state and the command, so the
displayed intent matches what the engine holds.

Removes narrating comments from the bridge glue, the metronome store and
useMetronomeFrame, keeping one line that points at the UI-runtime
HostObject trap.

- **core-design,tool-metronome:** One-row count-in picker, sound row, readable disabled buttons

PickerGrid sized cells by percentage plus a dp gap, which overflowed and
wrapped the four count-in choices onto two rows; it now lays out explicit
flex rows. Disabled Button dropped to 0.4 opacity, failing AA on both
themes; it now keeps an outlineless text2 label (tested >= 4.5:1).
Count-in sound sits in a new shared EditRow per design :561. The mute
hint says the preview is the first eight bars from start, because the
engine anchors the cycle at bar 0, not at the next bar.

- **core-db:** Read engine limits from the headers that now own them

b4426fc moved kMinBpm/kMaxBpm to metronome_types.h and the ramp bar cap to
TempoRamp::kMaxBars, so the lookup in metronome.h returned NaN. CI showed it;
the local run was a turbo cache replay.

- **tool-tuner:** Shorten the status dwell to 200 ms (#118)

- **app-shell:** Persist the last-used tool on native (#121)

On Android, Home's Continue card fell back to its default after every
restart because lastToolRuntime.ts installed no persistence and
core-state's in-memory default applied. It now stores the tool id under
the `last_tool` preference through the app's one database handle. The
root layout imports the runtime before Home renders, and load is
synchronous, so Continue does not flash the default. A database that fails
to open logs a warning and leaves Continue empty instead of breaking Home.

- **tool-tuner:** Wider needle scale, smoothed cents, return to centre on silence (#118)

Slightly-out strings read far off-centre at ±50 c full scale, and the needle
stayed held, dimmed, after the note stopped. Implements
docs/tuner-functional-spec.md §5:

- D1: linear mapping, ±220 c at 80 % of the half-width, no dead zone.
- D2: displayed cents averaged 0.5/0.5 with the previous displayed value
  once per new hop; cleared on silence, reset and target-note change.
- D4: on silence the needle decays ×0.8 per 1/60 s, time-based; note,
  caption and direction clear with it. Reduced motion jumps to centre.
- Removes the held "Last note" reading from the screen-reader label.

All of it runs in the UI-thread frame callback on SharedValues (§13.3).

- **tuner:** Release hold drains string confidence (#118)

The release hold was a fixed 1.2 s. Per the updated P27, the P10
string-confidence counter now drains by one per hop once the tone stops
and the reading clears at zero, so a full-confidence note is held about
0.77 s and a short pluck less. The counter now builds in every mode
(Track) so manual and chromatic modes drain the same way.

T8 checks both a full-confidence release in [0.6, 0.85] s and a 0.3 s
tone whose hold is shorter, which a fixed hold of any length fails.
P9's held-median window shrinks from 1.0 s to 0.6 s to stay inside it.

- **tool-metronome:** Tappable tempo arrows, swipe over readout, reset at 0:00 (#125)

- The BPM readout is an animated TextInput. Android's EditText calls
  requestDisallowInterceptTouchEvent on ACTION_DOWN regardless of its
  pointerEvents, and gesture-handler's root answers that by cancelling every
  handler, so a pan starting on the number died. The readout's Pressable is
  now box-only and intercepts the touch before the EditText sees it.
- The arrows step the engine tempo by one swipe step through the existing
  nudge path, which clamps to the generated BPM bounds in core-state. Their
  48dp targets come from hitSlop into the zone's free space so the design's
  layout does not move.
- Reset (pill label and the transport twin) is absent while the pill reads
  0:00.
- The transport key glyph uses a new iconSizes.transport token matching the
  play glyph; the design's 11px was unreadable on device.

- **core-design:** 48dp hit boxes for badge steppers and segments (#125)

The badge stepper keys are 24dp and their hitSlop was capped at half the 7dp
key gap, so each key took about 31dp. Raising the slop would not have helped:
Fabric's native hit test (TouchTargetHelper) drops a touch outside a
parent's frame plus its children's layout overflow, and hitSlop counts toward
neither, so slop past a 24dp row never registers.

hitExtension grows a target toward 48dp on each axis, taking at most half the
gap to the neighbouring control on each side so neighbours meet at the
midpoint and the nearer control wins. hitBoxStyle applies that as padding
with matching negative margin: the box is part of layout, so Fabric hit-tests
it, but nothing moves. The badge keys and segment options keep their visuals
in an inner View. An inert value badge is pointerEvents none so it cannot
swallow the keys' boxes.

The step key glyph grows from 14 to 18 via iconSizes.stepKey. Inline
steppers are unchanged.

- **tool-tuner:** Caption, arrow and speech follow the displayed cents (#118)

The caption and needle used D2's averaged cents while the status, arrow and
screen-reader words used the engine's raw-hop status, so the screen could read
"−2 CENTS · TUNE DOWN". Every channel now classifies the averaged cents,
rounded to whole cents, against the engine's per-string in-tune window. The
lock still snaps the needle and fires the haptic; the 200 ms dwell still gates
what reaches React. The D2 reset on a target-note change moves into a pure
nextReading so a test pins it.

- **core-db:** Close the connection when the migration fails (#121)

getDatabase() retries openDatabase() on every read after a failure, and each
attempt leaked an open op-sqlite connection.

- **app-shell:** Open the library database lazily and show a failed load (#109)

Importing libraryRuntime from the root layout opened the database at
import, so a failed migration took down app start (undoing #121). The
repositories are now getters over getDatabase(), and refresh records a
failure the library screens render with a retry.

- **core-state:** Load a song's tempo while the metronome runs (#109)

applyPreset set the tempo, then disabled the ramp, and disabling a ramp
re-syncs from the engine's current_bpm, which still held the previous
song's tempo. The ramp is now applied before the tempo when it is off.

- **tool-metronome:** Edit a song's ramp unit and loop in the preset editor (#109)

The editor could only set a ramp in bars and never its loop, so a song
saved from a timed or looping ramp lost both on its next edit. The draft
now carries RampConfig and BarMuteConfig (replacing the shared a/b/bars
TrainerDraft) and the rig group adds a bars/sec/min unit and a loop row.

Shared definitions replace local copies: accent cycling, resizing and
initial accents, per-accent sounds, trainer and poly defaults come from
core-state; subdivision, ramp and mute bounds and count-in options from
the generated constants; the sound picker is screen/SoundSheet's, made
reusable. Row subtitles use soundChoice/countIn labels and the VS15 icon
tokens instead of raw glyphs.

- **tool-metronome:** Guard library writes in one place and keep loads off stale ids (#109)

Eight copies of the same try/catch become guarded(setError, message,
work). Menu commands return early with no target instead of writing to
id -1, and subscribe to the actions and name they use rather than the
whole library store. loadSong no longer rejects when pinning the
setlist fails after the song is already applied, so row presses never
leave an unhandled rejection. activate is renamed switchActiveSetlist.

The unsaved-changes prompt was Alert.alert, a no-op on react-native-web;
it is now a ConfirmSheet. The count-in sheet's divider under Sound is
restored now that EditRow no longer draws one, and Save current lists
everything it overwrites.

- **core-state:** Mark the library failed only when its snapshot fails (#109)

refresh caught everything, so a search re-run after a good snapshot
flagged the whole library unusable. Only the snapshot read sets failed
now; both failures are logged instead of swallowed.

- **tool-metronome:** Take ramp length bounds from core-state (#109)

rampUnit.ts restated the engine bounds with a one-minute floor the store
does not have, so a 30 s ramp saved in minutes clamped to 1 on any unit
change. core-state now exports the one rule (rampDurationBounds,
clampRampDuration); the stepper keeps whole-unit steps within it.

- **core-state:** Show a ramp's start tempo once it is armed (#109)

The engine's ArmRamp jumps to start_bpm, but the store kept the tempo
set before it, so loading a ramped song while running showed the song's
bpm rather than the tempo actually clicking.

- **app-shell:** Read web-stored rampBars as the ramp length (#109)

- **core-design:** Real 48 dp touch targets on Android (#126)

Chip, PresetButton, Button, the AppBar keys, the beat LEDs and the inline
stepper keys move from hitSlop to the layout hit box from #125, and take
the gaps around them from the caller. Their slop had been capped at half
an assumed 8 dp gap (2 dp for inline keys), which held most of them well
short of 48 dp: chips 32.5, presets 41.5, AppBar keys 24-25, inline keys
14x18.5. Where the caller passes real gaps they now reach 48.

The sheet's ScrollView drops every touch outside its own frame, which ended
at the content's edge, so controls at the top, bottom and sides of a sheet
lost the outer part of any slop or hit box. The scroll frame now reaches
SHEET_TOUCH_ROOM into the header gap and sheet padding, with matching
content padding, so layout is unchanged.

unshared() marks room no other control reaches into, so a control may take
all of it instead of half.

The old hitBoxStyle comment said hitSlop counts toward neither a parent's
frame nor its overflow. RN 0.83.6's YogaLayoutableShadowNode::
getContentBounds unions each child's hitSlop into the parent's overflow
inset, so that claim does not hold in source; the comment now names the
limits that do: clipping ancestors and later sibling views.

- **tool-metronome:** Give hit boxes the real gaps around them (#126)

- **tool-tuner:** Give hit boxes the real gaps around them (#126)

- **core-design:** Wrapped chip rows, LED default and sheet indicator (#126)

ChipRow measures which wrapped line each chip lands on and gives only the
first and last lines the row's outer gaps; lines between share the row gap.
Before layout a chip takes the shared gap on both sides.

BeatLed falls back to an interior hit box when no row supplies one, so a
lone pressable LED no longer loses its target.

The sheet's scroll frame keeps its right edge, so the scroll indicator stays
where it was; only the top, bottom and left reach into the padding.

The minTouchTargetDp comment no longer says every control reaches 48 dp.

- **tool-metronome:** Share gaps where rows wrap; real trainer chip gaps (#126)

The trainer chips now get the section gaps around their row. Ramp From/To
and the mute-bars steppers detect when the second stepper wraps under the
first and switch both to the shared row gap, so their hit boxes no longer
overlap at large font scales.

- **build:** Track native headers as turbo inputs (#120)

core-db's engine-limits test and core-native's constant generator, its
tests and generate:check read native/audio_core sources, which turbo did
not hash, so a native-only change replayed a cached pass. Declared per
task rather than as globalDependencies so other packages keep caching.

- **core-db:** Adapt op-sqlite 17 to drizzle's op-sqlite session (#131)

op-sqlite 17's executeRawAsync resolves to { rawRows, ... } where drizzle
maps over a bare row array, and execute() now returns a Promise where
drizzle reads rows._array synchronously. Every insert/select with fields
threw "rows.map is not a function" and field-less all/get returned [].

drizzleClient() hands drizzle the shapes its session expects, built from
execute/executeRaw/executeSync. A node:sqlite-backed fake exposing
op-sqlite 17.1.2's runtime surface drives the repositories through the
same wiring openDatabase uses.

- **metronome:** Say "1 bar" in the ramp hint, not "1 bars" (#144)

- **app-shell:** Give Hermes a crypto.randomUUID so new rows can be saved (#141)

Every new setlist, song preset and tuning is stamped with crypto.randomUUID.
Hermes has no Web Crypto and Expo's runtime does not add it, so each create
threw on device and the store showed "Could not save this change". Tests
run under Node, which has crypto, so none caught it. expo-crypto's native
randomUUID is installed before any runtime module loads.

- **core-design:** Draw sheets in the app so they clear the keyboard (#142)

Sheets were RN Modals, each its own Android window. On device that window
was resized about 258 px short of the keyboard, so the confirm button sat
under Samsung Keyboard's suggestion strip, and focusing a field from it
never raised the keyboard (ImeTracker: PHASE_CLIENT_VIEW_SERVED).

Sheets now render through a SheetHost at the app root, over every screen.
The app draws edge to edge, so nothing resizes for the keyboard and RN's
Keyboard events only fire on a layout pass; the sheet pads by the inset
react-native-keyboard-controller follows, or the nav bar when it is closed.
Android Back closes the open sheet, as the Modal's onRequestClose did.

- **audio_core:** Restart the output stream when it dies mid-play (#143)

When AAudio reports an error (route change, Bluetooth, a device fault),
miniaudio closes the stream and retries reopening it at most four times.
If that fails it stops trying and says nothing: the device stays
"started" with no stream behind it, so the click goes silent for good.

A watchdog thread now restarts the device when frames_rendered has not
moved for 1.5 s, or when the device stops without the engine asking. The
engine clock carries on, so the metronome resumes on its schedule.
StallDetector is the pure decision, pinned in metronome_verify.

- **core-design:** Load Space Grotesk and Inter and pick the face per weight (#95)

Text named families that were never loaded, so Android and web fell back
to the system font. Each role now resolves to a bundled face, and the
root layout holds the splash until those faces load. fontWeight is
dropped because Android synthesizes bold on top of a custom face.

- **core-design:** Run each chip-row line edge to edge, wrapping whole chips (#152)

The trainer chips sized to their labels and packed left, so the row ended
short of the card above, and long labels wrapped inside their pills.
ChipRow fill lets each line's chips share the spare width and keeps labels
on one line, so a chip that does not fit moves down whole. A wrapper view
does the growing because Yoga drops a grown item's negative margin in a
wrapping row, which pushed the row down by its hit-box padding.

- **core-db:** Keep op-sqlite out of the web bundle (#70)

Since 6bd15d9 core-state imports tuning rules from core-db's index, which
also loaded client.ts and with it op-sqlite. op-sqlite reads its native
constants at import, so the web build threw before the first render and
showed a blank page. Opening a connection now goes through openConnection,
whose .web twin never imports op-sqlite.

scripts/web-check.sh exports the web build and fails if op-sqlite is in
the bundle; preflight and CI run it.

- **core-native:** One practice clock across app and notification (#87)

Pause and resume from the notification now carry the service's clock, which the
store adopts, so a starved JS thread cannot skew it. A reset while paused from the
notification re-sends the clock without resuming playback.

- Drop a stray build symlink from the tree (#160)

- Review findings for StemDeck import (#136)

Null instead of '' for no refusal and no waveform; one refusal for a missing
stem; a neutral version notice; startup clears staging and sweeps stem
folders no row references; comments trimmed; the module back under 400 lines.

- **tool-metronome:** Empty the bar sweep and beat LEDs when the metronome stops (#167)

- **native:** Turn off floating-point contraction so analysis rounds the same on any toolchain (#165)

CI's ubuntu-26.04 GCC targets FMA by default and fused a*b+c differently in
the streamed downbeat and QM's reference, failing the bit-identical checks.
Reproduced with -march=x86-64-v3; -ffp-contract=off passes there and locally.

- **core-native:** Drop the seek bar from the metronome notification (#163)

The owner doesn't want the 00:00-10:00 bar on the media card. The session
now publishes no duration and an unknown position; the practice clock still
syncs to the app.

- **core-native:** Plain notification with its own buttons, no media card (#163)

Android 13+ draws a seek bar on every media-style card, even with no
duration, so the owner chose a plain notification. The media session stays
for headset and lock-screen keys.

- **audio_core:** Count-in reads follow the running count-in (#171)

Changing the count-in setting mid-count made count_in_bar read -1 while
counting_in was 1, and the UI read the new setting as the bar total.
The engine now records the running count-in's length and exposes it as
count_in_bars_total. Also folds review cleanups into the ramp status
tests and the HostObject property lookup.

- **metronome:** Review findings for layout B (#175, #171)

The ramp now shows on sounding bars while mute bars run, instead of the
mute cycle hiding it on every bar. The count-in total comes from the
engine's running count-in, a current muted beat stays hollow, and the
metronome's sheets dim the screen behind them as the mockup draws. The
setlist chip reaches 48 dp through a hit box rather than hitSlop.
Duplicated styles, constants and storage helpers fold back onto the
ones that already existed.

- **native:** Review fixes for the stem mixer and follow mode (#137)

Follow mode ignores the latency offset (owner ruling, D16): stems and click
share the output. A beat past the loop end waits for the wrap; a loop change
racing an old wrap plays on instead of replaying; a stem loaded mid-play
joins at the head. Engine-rate frame units documented; comments trimmed.

- Play stems through wide device callbacks (#137)

Legacy AAudio delivers callbacks up to 12288 frames. The mixer dropped any
block over kMaxBlockFrames, and the 8192-frame read-ahead ring could not hold
one callback, so stems froze or went silent from the third callback. The
engine now renders in slices of at most kMaxBlockFrames and sizes each ring
from the device callback width; stream_verify plays a ramp through 12288- and
9216-frame callbacks and fails without the sizing.

- Keep the whole beat grid for long songs (#161)

KB_MAX_GRID_BEATS goes from 8192 to 65536: since #160 long files import with
bounded memory, and a 60-minute song (about 9100 beats) kept only its first
8192 beats while the Library showed GRID. 65536 covers 5.4 hours at the
analyser's 200 BPM ceiling. Nothing on the audio thread is sized by the cap:
the grid is copied on the app thread and found by binary search in the
callback.

- Back collapses an open stem fader before leaving the player (#191)

With a stem's or the master's fader open, the back key left the whole player
and stopped playback. It now collapses the fader first, the way sheets close
before their screen.

- Library rows show BPM and key and keep their spacing at large text (#192)

At 200% font scale the Stem songs facts line cut to "5:11 · 123 B.." and
rows had no room above and below their text. Above the default scale the
facts line may wrap to two lines and the row body gains vertical padding;
at the default scale nothing changes.

- **tool-metronome:** Show the beat legend inside the reserved status rows (#175)

Stopped, the legend sat below the two-row stack and pushed the transport
down. It now takes the second reserved row under the armed summary, so the
stopped and playing screens are the same height.

- **tool-metronome:** Fit the metronome on a 360 × 800 screen (#175)

The tempo zone now takes the slack: it grows to fill spare height, and below
metronome.compactBelowHeight it uses the display-role numeral, tighter zone
padding and body gaps. The numeral drops Android's font padding. If content
still exceeds the height, as at large text, the body scrolls and the
transport stays pinned below it.

- **core-state:** Accent group starts when the meter changes (#175)

setBeats carried the old accent map over, so 4/4 to 12/8 kept only beat 1
accented, or none if beat 1 had been tapped to normal. A new beat count now
resets to the mockup's default of an accent on every group start and sends
each beat to the engine; a denominator-only change keeps edited accents.
Beat grouping moves to core-state so the store and the dot layout share it.

- **tool-metronome:** Keep the poly ratio label clear of the poly dots (#175)

A fixed 28 dp column clipped "3:12" and the first poly dot overlapped it on
full-width bars. The label is now measured once and sits beside the row when
the margin holds it, otherwise on its own line above the dots.

- **tool-metronome:** Put the poly label after the last poly dot on full-width bars (#175)

Stacking the label above the poly row on 12/8 cost the height that pushed
the ramp row under the transport at 360 × 800. It now follows the last poly
dot when there is room, and stacks only when there is not or when large
text makes it taller than the dots.

- **tool-metronome:** Scroll the body instead of changing tempo when it overflows (#175)

At large text the screen-wide tempo pan took drags on the dots, so the
status rows could not be reached. While the body scrolls, the screen-wide
pan is off and a pan on the tempo zone blocks the scroll view; when nothing
scrolls, swipe-anywhere is unchanged.

- **tool-metronome:** Draw the swipe hint's ring and arrow in light ink on the scrim (#175)

They used onAccent, which is near-black in Stage and vanished on the dark
scrim. The scrim is dark in both themes, so a new core-design inkOnScrim
takes Daylight's on-accent, the colour the mockup's coach is drawn in.

- **core-design:** Move the wheel picker's highlight as the finger crosses each row (#175)

The selected style followed the selected prop, which changes only when the
scroll settles and onSelect commits, so the highlight lagged the finger by
the whole drag plus the snap. A UI-thread scroll handler now tracks the row
under the band and swaps each row between its plain and selected text by
opacity; the value is still committed on settle.

- **tool-metronome:** Compact a tall screen before it scrolls, so swipe-anywhere stays on (#175)

On a 1080 × 2340 phone (891 dp) the roomy layout of 12/8 with poly overflowed
by a few dp, so the body became scrollable and the screen-wide tempo pan was
switched off: drags on the dots stopped changing tempo. A roomy layout that
overflows now drops to the compact density, which stays until the window,
text size, meter, poly or song notes change. Only content that still does
not fit, as at large text, scrolls.

- **core-design:** Open a stepper's value on any tap inside its cell (#175)

The value press was the Text's own onPress, so only the glyphs were a
target and taps beside or under the digits did nothing: 54 of 140 test taps
opened the numpad. The whole cell between the keys is now a Pressable,
slopped out to 48 dp, with the keys kept on top so they never lose a tap.

- **core-design:** Size the stepper value's tap target with hitBoxStyle (#175)

3bdc1c1 used hitSlop, which the touch-target audit allows only where its
reach was checked against the parent frame. hitBoxStyle extends the value
cell by half the gap to each key and out to 48 dp vertically, so it never
overlaps the keys and the keys need no z-order.

- **tool-metronome:** Sign the ramp step with the ramp's direction (#175)

The Practice sheet always showed "+N", so a ramp from 118 to 103 read as
stepping up. The engine takes the step's magnitude and the direction from
From and To, so the step now shows −N going down, +N going up and N when
they are equal, and a screen reader hears "N BPM down" or "up".

- **library:** Serialise setlist writes and keep an outside song off stage when leaving fails (#205)

An outside load decided whether to leave from setlists a pin could still be
writing, so it could skip the leave. Pin and leave now run in order and decide
inside the queue. LoadedSong carries its setlistId, so a failed leave cannot
show the stage bar over an outside song, and leaveSetlist warns instead of
rejecting.

- **metronome:** Match the D2 song-list sheet and split the song-list logic (#205)

Filled NOW badge, 16 sheet title and 18 Leave setlist icon through additive
Badge, Sheet and Button options. The chip shows the setlist name when no song
from the set is loaded, and only while the loaded song came from that set.

- **metronome:** Pin the tempo zone so the BPM numeral stays put between songs (#208)

The tempo zone grew into whatever the dots and status rows left over, and
centred the numeral in it, so a song with 12/8 and poly drew the numeral
about 49 dp higher than a 4/4 one at 360 x 800. The zone now takes its
natural height at the top of the body, and the dots and status rows sit in
a region that reserves the tallest meter's height, so the body measures the
same whatever is loaded. The density key drops meter and poly too, so a
song change can no longer flip the screen between roomy and compact.

- **metronome:** Scale tempo swipe by drag speed and drop the release fling (#209)

Lifting the finger after a quick swipe added up to 40 BPM, and the fixed
8 dp per BPM was too fast for single steps and too slow for long moves.
A slow drag now moves 1 BPM per 14 dp and the rate rises with drag speed
to 8 times that; release changes nothing. A reversal drops the unspent
travel so the tempo answers the new direction within one step, the
diagonal cancel widens to 20 dp, and each BPM change plays a segment tick
through core-native. SPEC 5.2 carries the new rule.

- **metronome:** Keep a one-line notes slot so notes never move the numeral (#208)

Song notes sat above the tempo zone only when a song had them, so stepping
from a song with notes to one without moved the numeral by the notes'
height. While a song is loaded the strip now always takes one line, folding
multi-line notes and ending in an ellipsis; with no song loaded it is gone.
The density key follows the slot rather than the note text.

- **metronome:** Reserve the poly label above its dots and scale with text size (#208)

PolyDots moves the ratio label above the poly row when it is too tall or
too wide to sit beside it, which the reserve left out, and the beat and
label lines grow with the system font. Either let a poly song outgrow the
reserve and flip the density, moving the numeral. The reserve now takes the
label above at the current font scale, and the label gets an explicit line
height so that height is known. The tests compare the reserve with an
independent stack of what BeatDots, PolyDots and StatusStack draw.

- **metronome:** Ride out tremor in the tempo swipe and guard against a fling (#209)

Any backward movement dropped the travel already made toward the next BPM,
so a shaky finger lost steps. Unspent travel now survives until the finger
moves back more than 3 dp. A test fails if the swipe hook regains a release
handler, and another pins the 14 dp fine rate SPEC 5.2 states. The two
haptics share one Android helper, speedGain uses clampUnit, and SPEC says
the tick fires per tempo change rather than per BPM.

- **metronome:** Fit the busiest song at 360 x 800 without scrolling (#210)

The worst-case reserve, counted with a poly label above the dots, outgrew
an 800 dp body, so every song scrolled and swipe-anywhere went off. Even
without the reserve, 12/8 with poly, mute and ramp ran 17 dp past the
transport. Compact screens, picked by window height, now reserve nothing,
since only a roomy screen's density can flip, and compact draws two-line
meters at 38 dp dots with 6 dp line gaps and a 6 dp gap above the sweep.
The roomy reserve counts the 18 dp a 14 dp label line draws on Android.

- Rerun tests when the sources they read change (#204)

app-shell's touchTargets audit reads every package's src, and every
test imports workspace packages by source, but turbo keyed test on the
package's own files only, so preflight replayed a stale pass.

A transit task folds each dependency's files into the test hash, and
app-shell's test task takes packages/*/src/**/*.tsx as inputs so a
package outside its dependency graph still invalidates it. Preflight
runs tests at concurrency 2 to stay under a 6 GB memory cap.

- **release:** Pin the release cert, cap notes size, rerun-safe workflow (#211)

Review fixes: the gate now requires the pinned release certificate, release
notes are subject-only with a size guard under GitHub's body limit, a rerun with
nothing to release skips green, third-party actions are pinned to SHAs, and the
versionCode formula is checked against the built APK in PR CI.

- **release:** Signature test stub wins over PATH, trim release-script comments (#211)

The signature test pointed only ANDROID_HOME at its stub, but the script prefers
an apksigner on PATH, so a machine with one installed tested the real tool.
preflight now runs changelog.test.sh like CI does.


