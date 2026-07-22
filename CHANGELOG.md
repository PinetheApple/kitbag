# Changelog

All notable changes to Kitbag are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Entries below are generated from Conventional Commits by git-cliff — an entry
cannot exist without a commit that did the work.

---

## Unreleased

**Nothing has been released.**

This file previously recorded 0.1.0 through 0.5.0 as all shipped on 2026-07-14.
An audit on 2026-07-17 found that claim substantially false, and those entries
were deleted rather than amended — they described work that does not exist.
`SPEC.md` §2 is the audited inventory of what the codebase actually did, and it
supersedes anything this file says. Version numbers restart when something
genuinely ships.


### Added

- Flutter runners with bundled native core, tone integration test

Linux runner wires libkitbag_core.so via PLUGIN_BUNDLED_LIBRARIES (appended
after generated_plugins.cmake, which resets the list). Integration test taps
the home-hub button and asserts the native sample clock advances — M0 proof
on Linux. Android runner generated, NDK wiring pending SDK install.

- **android:** Wire native audio core into gradle externalNativeBuild

NDK compiles kitbag_core for arm64-v8a, armeabi-v7a, x86_64; verified present
in the debug APK.

- **metronome:** Sample-accurate sequencer, swipe-anywhere tempo UI

- **design:** Reusable component library; metronome matches spec

core_design gains KitbagBadge, KitbagTileButton, KitbagSegmented (radio +
toggle segments in one row), KitbagCircleButton, KitbagPlayButton (glow),
plus themed cards/chips/buttons. Metronome screen rebuilt on them: dark
preset tiles, time-sig/poly badges with slim steppers, poly as fifth
segment, trainer/setlist placeholder chips and circle buttons.

Tempo gesture: raw pointer Listener (no gesture-arena conflicts — works
when the drag starts on controls), 14px arm distance protects taps, scroll
wheel ±1 on desktop, chevrons clickable, content capped at 480px width on
desktop, platform-aware hint text.

- **shell:** Home hub per design spec, nested tool routes for back nav

Home rebuilt on new core_design components: KitbagToolTile (grid tiles,
muted for unshipped tools), KitbagRowCard (Continue card, feature rows).
Plugin routes are now relative and nest under the home route so app-bar
back and system back both return to the hub.

- **native:** Mic capture + cycfi/q pitch analysis for tuner

Vendored the cycfi/q BACF pitch-core header closure (BSL-1.0, provenance
in third_party/cycfi_q/README.md). PitchAnalyzer wraps it with the PLAN §3
smoothing chain (median on Hz, EMA on cents, silence gate); Tuner owns a
separate raw/unprocessed capture device whose callback only feeds a
lock-free ring drained by a non-RT analysis thread publishing atomics.
tuner_verify proves ±1 cent over 82Hz-1kHz, <150ms settle, octave-error
kill via string bands, and B0 settle through the bass preset band.

- **ffi:** Tuner controller, bindings and shared provider

Mirrors the metronome pattern: fire-and-forget setters, atomics-backed
getters cheap enough for vsync polling, FakeTunerController in testing.dart
and tunerControllerProvider indirection for widget-test overrides.

- **design:** KitbagTunerStrip, KitbagChip, amber semantic token

Strip and pill chip come straight from the spec's component library;
the amber 'almost' color completes the flat/almost/in-tune channel.

- **tuner:** Tool_tuner plugin — pegs, auto string detect, A4 chip

Screen matches the design mock: headstock pegs (tap to lock, green when
tuned), giant note readout with cents + direction, graduated strip, and
Auto / A4 / Chromatic chips. One vsync ticker polls the native atomics;
detection bands (chromatic, whole-preset, per-string) are pure Dart and
unit-tested. Replaces the home hub's muted Tuner placeholder tile.

- **metronome:** Tempo ramp and bar-mute trainer modes end-to-end

- **metronome:** Trainer modes — tempo ramp and bar muting

- **tuner:** Chromatic tuner with mic capture and MPM pitch detection

- **tuner:** Hold last note after signal drops; fresh session on re-entry

User acceptance feedback:
- the readout no longer snaps to 'PLAY A NOTE' the instant confidence
  drops: the last note/cents freeze for ~1.75s (gently dimmed) before
  relaxing to idle — fast attack, slow release, GuitarTuna feel
- re-entering the tuner resets transient session state (string lock,
  green peg marks, live readout); preset and A4 persist as durable
  preferences. FakeTunerController.stop() now clears its reading like
  the native tuner, so the reset path is honestly testable

- **shell:** Continue card resumes the last tool used

- **setlists:** Core_db drift schema + DAOs, setlist screens, app-bar song pager

Songs store the full metronome preset (bpm, beats/bar, subdivision,
accent codes blob, sound) inside a setlist ordered by a position column.
SetlistsDao/SongsDao cover CRUD plus transactional reorder. Shared
kitbagDatabaseProvider joins the other services in core_plugin_api so
widget tests override it with an in-memory executor. Metronome gains
nested setlist routes, a queue_music hookup, and the on-stage chip pager;
KitbagEmptyState lands in core_design. Bar/LED tickers now stop while
idle instead of burning frames.

- **db:** Tunings table + DAO for saveable custom note lists (drop D etc.)

One MIDI note byte per string, low string first — matches the tuner's
InstrumentPreset midiNote model so the M2 branch can wire its custom
tuning editor straight to TuningsDao.

- **metronome:** Setlists and song presets backed by drift

- **tuner:** Custom saveable tunings and design-mock conformance

Add a custom-tuning flow to the tuner: create/edit/pick/delete named
tunings (drop D, DADGAD, …) from the preset menu, backed by the core_db
Tunings table. A saved tuning drives pegs, auto string detection and
detection bands exactly like a built-in preset. Per-string note selection
via the shared stepper row; picking applies immediately.

Bring the tuner screen in line with design §04: one text-only mode-chip
row (space-between, only engaged states lit), 64px giant note bottom-
anchored directly above the strip, and text-only chips (KitbagChip.icon
optional). Move the name/confirm dialogs into core_design so both the
tuner and metronome share them.

- core_db: TuningsDao gains getAll() (Future read) alongside watchAll(),
  so tests read without opening a transient stream that collides with the
  provider subscription at teardown.
- tuning editor actions use OverflowBar so they wrap instead of
  overflowing on narrow sheets / 200% text scale / entrance animation.

- **metronome:** Song-name chip label, live BPM save to active song, short-window layout

User feedback batch:
- Setlist chip pager shows the CURRENT SONG name ('Everlong · 3/12')
  instead of the setlist name, with breathing room between the chevrons
  and the chip.
- Dialing a new tempo while a song is active persists to that song
  (debounced 400ms); paging songs never dirty-writes stored tempos.
- Short windows no longer overflow: compact spacing/controls below
  ~620dp body height, scroll fallback below ~420dp (swipe-anywhere
  yields to scrolling there; presets/TAP stay as the visible twins).
  Covered by metronome_responsive_test at 600/500/430/340dp.
- core_design: KitbagChip icon is optional (text-only chips per spec),
  KitbagTileButton gains dense mode.

- **metronome:** Song-aware chip pager, live BPM persistence, responsive layout

- **metronome:** Priority-based responsive layout, single-row chip rules

Replace the fixed height-tier layout with a budget-driven MetronomeLayoutSpec
that degrades in priority order: compress whitespace, shrink readout/card
chrome (drop chevrons), regroup wide-short windows into two panes, and only
scroll as a last resort with the transport pinned so play stays reachable.

Keep the trainer/sound chips in one row: short labels engage below 380dp inner
width so "Mute bars" no longer overflows a phone's ~320dp run, and the two-pane
editing side gets extra width so chips stay to two rows even at 200% text —
never one chip per line. Chips hug their pill (Center width/heightFactor) so
each no longer claims a whole Wrap run.

Extract PatternCard and ModifierChipRow; readout/preset/segment labels
scale-down instead of clipping under large text.

Cover the acceptance matrix (480x800, 360x640, 300x567, 640x360, 360x420 at
1x and 2x) asserting no overflow, reachable transport, and chips never
one-per-line.

- **metronome:** Priority-based responsive layout, one-row chips, 48dp targets

- **tuner:** Custom saveable tunings + design-mock conformance

- **agent-harness:** Add 5 safeguarded agent workflow patterns

- Custom linters: 4 DartLintRules enforcing architecture boundaries
  (kitbag_provider_location, kitbag_ffi_boundary, kitbag_layer_boundary,
  kitbag_naming_convention) in packages/custom_lint_kitbag/
- PostToolUse hooks: scripts/lint_check.sh auto-runs dart analyze +
  dart run custom_lint after every Write/Edit (instructions in AGENTS.md)
- Ralph loop: .opencode/agents/ralph.md + .claude/agents/ralph.md —
  a peer-reviewer subagent for feedback→refine cycles
- Evaluator: scored eval harness at packages/app_shell/eval/ with 7
  scenario files (pass/fail per rule), run via eval/run.sh
- Git worktrees: scripts/worktree.sh for isolated agent worktree
  sessions, tracked via worktree create/remove/list commands
- Opencode config: opencode.json with ralph subagent, instructions
  pointing to AGENTS.md
- Claude Code config: CLAUDE.md with same workflow instructions
- Pub workspace: added core_services to workspace members in pubspec.yaml

- **plan:** Add 37-task autonomous completion plan across 6 phases

- Add full task breakdown to AGENTS.md with dependencies and test hints
- Add custom_lint_kitbag to workspace with resolution: workspace
- Each task gated by Ralph review loop (implement -> lint/test -> review -> fix)
- Phases: 0=Infra, 1=Tuner+Settings, 2=Metronome+Practice, 3=Library, 4=Stems, 5=Sync

- **tuner:** Adaptive noise gate, note-lock state machine, and improved smoothing

Priority 1 changes from tuner-research.md:

- Increase median filter from 3 to 5 tap (better outlier rejection)
- Reduce EMA alpha from 0.4 to 0.25 (more damping, ~90% settle in 166ms)
- Adaptive noise gate: asymmetric RMS envelope + noise floor tracker;
  signal must exceed max(hard floor -50dBFS, 12dB above ambient) to open
- Note-lock state machine (None→Locking→Locked→Riding→None):
  - Lock acquire: 20 consecutive same-note readings within 18¢ (~333ms)
  - Ride: hold last locked reading through silence up to 360ms
  - Instant re-lock: same note returning within 1500ms skips re-acquisition
- Fix kDetectorHysteresisDb suffix: -40.0f → -40.0

- **tuner:** Add/remove strings in tuning editor

- Add/remove string controls in the custom tuning editor bottom sheet
- Min 1, max 12 strings; new strings default to MIDI 40 (E2)
- Delete icon per string row, disabled when only 1 string remains
- 'Add string' button at bottom of string list, hidden at max

- **settings:** Volume boost, latency correction, and tool toggle

Phase 1.5-1.7:

- Native C++: kb_metronome_set_volume [0-2] and kb_metronome_set_latency_offset
  [-100, 100] ms with command-ring plumbing and +RT-thread application
- Volume applied as gain multiplier on accumulated voices in Render()
- Latency applied as phase advance on grid detection: triggers clicks earlier
  by latency_ms * bpm / 60000 beats; recomputed on ramp BPM changes
- Dart bindings, MetronomeController, MetronomeSettings/Notifier fully wired
- Settings screen: volume boost slider (0-200%) and latency correction slider
  (-100 to +100 ms) replacing placeholder cards
- Settings screen: per-tool enable/disable toggles stored in SharedPreferences
- Home screen: tool grid filtered by enabled state; settings gear now wired

- **setlist:** Persist volume and latency offset per song schema

- Add volume and latencyOffset columns to Songs drift table
- Bump schema version to 2 with migration
- Save/recapture volume and latencyOffset in setlist detail screen
- Load volume and latencyOffset in applyPreset and ActiveSetlistNotifier
- Export/import includes both fields (backward-compatible with null checks)

- **metronome:** Ramp duration in seconds or minutes

- Add RampUnit enum (bars/seconds/minutes) to TempoRamp
- Replace bars-only stepper with SegmentedButton + conditional duration input
- Convert time-based duration to bar count at push time (native stays bar-only)
- Chip shows duration unit when ramp is active
- Tests for stepDescription, effectiveBars, and default unit

- **metronome:** Custom subdivision (1-16) via stepper

- Replace fixed 4-option segmented control with stepper for any value 1-16
- Add subdivisionSymbol helper in format.dart (note symbols for 1-4, numeric fallback)
- Bump native kMaxSubdivision from 6 to 16
- Add maxSubdivision constant to MetronomeController
- Clamp subdivision in setSubdivision and applyPreset

- **metronome:** Add 3 new click sounds (6 total)

- Bump kSoundCount from 3 to 6
- Add Tom (low thud), Hi-hat (crisp high), Cowbell (ringy mid) presets
- Update soundNames list in Dart
- Guard songSummary against out-of-range indices

- **metronome:** Circle layout for beat LEDs

- Replace horizontal Wrap layout with trig-positioned circle
- Compute optimal radius from beat count and available space
- LEDs are placed at equal angles starting from 12 o'clock
- Default LED size reduced to 24 for better circle packing

- **metronome:** Practice timer auto-starts on play

- Add practiceTimerSeconds to MetronomeSettings
- Timer auto-starts when metronome plays, pauses when stopped
- Timer display above BPM readout (mm:ss, hidden at 0)
- Transport timer button resets the timer
- Cancels timer on notifier dispose

- **metronome:** Practice logs with stats (Phase 2.7)

- Add PracticeSessions drift table (schema v3) with PracticeDao
- Metronome auto-saves session when stopped with non-zero timer
- Practice session includes duration, avg BPM, optional setlist/songs
- Practice stats tile in settings (total sessions, total minutes)
- Bottom sheet lists recent sessions with BPM, duration, date
- Export/import includes practice sessions (version 2)

- **library:** Scaffold tool_library package (Phase 3.1)

- Create tool_library package with ToolPlugin contract
- Register in workspace, app_shell dependency, plugin registry
- Placeholder LibraryScreen with empty state
- Basic LibrarySettings/LibraryNotifier state scaffold

- **library:** Song import with file picker (Phase 3.2)

- Add LibrarySongs drift table (schema v4) with DAO
- Import audio files (wav/mp3/flac/ogg/aac/m4a) via file picker
- Copy files to app documents/music directory
- Index title, artist, file path, format in drift
- Library screen shows imported songs in a list
- Import button in app bar and empty-state CTA

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


### Fixed

- **metronome:** Address M1a review findings

- Big BPM readout tracks the live ramped tempo (and ramp start while
  armed); nudges are relative to the tempo being heard
- KitbagChip: button semantics + >=48dp hit target per spec section 06
- Monotonic bar counter incremented at downbeats: time-signature changes
  can no longer jump ramp progress or mute phase
- FakeMetronomeController honors the native contract (setTempo cancels
  ramp, currentBpm steps per simulated bar, bar-mute cycle) with tests
- Deleted the unused rampActive chain across all five layers
- One shared MetronomePoll vsync helper (gated on activity) replaces
  four hand-rolled ticker scaffolds
- trainer.dart trimmed to production-used surface with bars>=1 asserts
- KitbagChip/KitbagStepperRow split out of components.dart (<=400 lines)

- **tuner:** Address M2 review findings

- race: analysis thread captures the params version before reading band/A4,
  so a Set* landing during startup is re-applied instead of dropped
- torn reads: the four reading atomics collapse into one packed 64-bit
  snapshot (note|cents x100|confidence x10000) behind a single FFI call
- dead surface: unused pitchHz and tuner isRunning chains deleted end-to-end
- android: runtime RECORD_AUDIO request via permission_handler with
  provider indirection; denied and permanently-denied states explain
  themselves and offer retry / open-settings (no dead ends)
- lifecycle: WidgetsBindingObserver stops the mic when the app leaves the
  foreground and restarts it on resume
- a11y/spec: pegs get 48dp hit targets + Semantics; needle shadow derives
  from the theme
- fake fidelity: FakeTunerController clamps A4 and gains failStart; new
  tests cover mic failure/denial/lifecycle paths
- dedup: single A4 clamp point (controller), cross-referenced constants,
  shared brightness-aware semantic color extension, in-tune haptic gated
  to instrument mode, headstock no longer rebuilds on the 60fps cents
  stream

- **tuner:** Hold last note after signal drops; reset session on re-entry

- **setlists:** Review findings — CI codegen, live session sync, poly roundtrip, a11y targets

- CI runs 'melos gen' before format/analyze/test (*.g.dart is gitignored);
  gen script gets --delete-conflicting-outputs. Verified by deleting the
  generated files and replaying the CI sequence.
- Active setlist session subscribes to the songs + setlist streams:
  rename/recapture/reorder/delete reflect live, the chip count stays
  truthful, paging applies stored presets as they are now, and the
  session ends only when ITS setlist is deleted (was: any deletion).
- Songs schema gains polyEnabled/polyBeats (unreleased schema, no
  migration); capture/apply/recapture roundtrip the polyrhythm.
- Setlist app-bar chip uses KitbagChip (>=48dp targets, spec 06), capped
  width + ellipsis so long names can't overflow the app bar.
- name_dialog owns its TextEditingController in a StatefulWidget so it is
  disposed with the route (was leaked per call).
- Dedupe: soundNames + timeSignatureLabel + songSummary in format.dart
  (single /4 renderer); KitbagEmptyState takes an actionIcon; drop unused
  SetlistsDao.getById in favor of watchSetlistOrNull for the session.

- **metronome:** Scroll-safe layout, 48dp targets, gesture gating

Address code-review findings on the responsive metronome layout.

- **metronome:** Density-proof 48dp targets, top-weight readout

Second verification pass.

Desktop 48dp leak: the ≥48dp IconButton targets (KitbagCircleButton,
KitbagStepperRow) were shrunk to ~40dp by the default adaptivePlatformDensity
(COMPACT) on desktop — exactly the platforms this tool targets. Pin standard
density and explicit 48dp constraints on those buttons so the hit target holds
regardless of theme density. New test drives TargetPlatform.linux and asserts
48dp.

Tall-screen gap: the readout+editing cluster was group-centered in the scroll
viewport, so on a tall window the BPM floated below the top with a dead gap
above the pinned transport. Restore the §04 layout — the readout takes the top
region and flexes to fill the slack, while the editing stack is bottom-anchored
just above the transport, still scrolling only when it outgrows the space left
after a small readout floor. New test asserts the readout sits in the upper
region and the stack hugs the transport.

- **tuner:** Review fixes — delete crash, Auto chip, 48dp, file split, theme role, atomic edit

- **ci:** Resolve analysis, eval, and test pipeline failures

- Add missing deps: core_audio_ffi in core_db, multiple deps in app_shell
- Export MetronomeSettings/metronomeProvider from tool_metronome
- Add stop() method to MetronomeNotifier for notification actions
- Fix eval script: use readlink -f instead of macOS realpath
- Fix eval_dir path after cd in eval script (relative path bug)
- Add ignore_for_file to eval files to suppress expected diagnostics
- Fix settings_service.dart type mismatch (Uint8List vs List<BeatAccent>)
- Fix export/import accent serialization
- C++ native core builds successfully with CMake+Ninja
- 104 tests pass, 7/7 eval scenarios pass, 9/9 packages analyze clean

- **notifications:** Set showsUserInterface=true for reliable action callbacks

Notification transport buttons (play/pause, stop) didn't fire because
showsUserInterface=false prevents the Dart callback from being reached
on Android 12+. Setting it to true with cancelNotification ensures the
action is delivered reliably.

- **ui:** Add 8px gap between setlist/song list items

Items in setlist list and song preset list were flush against each
other. Added bottom padding to each item.

- Add stems_dao export to core_db, fix test missing params

- Add missing export of stems_dao.dart in core_db (caused flutter build
  linux to fail with 'StemsDao isn't a type')
- Add volume and latencyOffset params to test helper methods in
  setlist_flow_test.dart and setlist_state_test.dart

- Android build — upgrade file_picker to ^10.0.0

- file_picker 8.x had hardcoded compileSdk 34, incompatible with
  flutter_plugin_android_lifecycle 2.0.35 (requires 36)
- Upgrade to 10.x which uses flutter.compileSdkVersion (default 36)
- Enable core library desugaring for flutter_local_notifications
- Add kotlin annotation in build.gradle.kts

- Remove 'Coming soon' placeholders, robust migration

- Remove hardcoded disabled 'Songs', 'Stems', and 'Play along' placeholder
  tiles from home_screen.dart — these were left from pre-plugin scaffolding
  and duplicated the real plugin tiles
- Wrap migration addColumn steps in try-catch to prevent SQLiteException
  on stale databases where columns may already exist

- Route paths, delete UI, full metronome controls in sync screen

- Fix GoException: library routes had doubled path segments
  (/library/library/player → /library/player, /stems/stems/set → /stems/set)
- Add delete song (library screen popup menu)
- Add delete stem set (stems screen trailing icon)
- Add delete individual stem (stems set screen trailing icon)
- Add full metronome controls to media sync screen: beats-per-bar slider,
  subdivision slider, volume slider, click sound dropdown, BPM slider
- Tweak permission explainer text for Notification Listener access path

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

Applies two review rounds on dedf7f0.

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


