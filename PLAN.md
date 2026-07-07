# Kitbag — Project Plan

> The open-source everything-app for musicians. Metronome, tuner, song library,
> stem player, play-along sync — one app, plugin-shaped, GPLv3.

**Status**: planning complete, pre-scaffold. This document is the single source of
truth for scope, architecture, and sequencing. Update it when decisions change.

---

## 1. Product summary

| | |
|---|---|
| Name | **Kitbag** |
| License | GPLv3 |
| Platforms | Android first → Web (WASM) → iOS |
| Distribution | GitHub releases + F-Droid; Play Store later |
| Quality bar | High-polish UI/UX; no artificial caps or paywalls (Soundbrenner's #1 user gripe is paywalled basics — free-everything is our differentiator) |

### Core features (committed)
1. **Metronome** — Soundbrenner-class: subdivisions, per-beat accent editor, polyrhythms, trainer modes (tempo ramp, bar muting), setlists/song presets.
2. **Tuner** — chromatic + instrument presets (guitar/bass/ukulele, alt tunings), auto string detection, adjustable A4.
3. **Song library & player** — import local files, offline beat analysis, metronome auto-syncs (tempo + phase) to any analyzed song.
4. **Stem player** — folder import = stem song (Moises/StemDeck output shape), per-track volume/mute/solo, waveforms, A-B loop.
5. **Media sync** — detect what's playing (Spotify etc.) via Android MediaSession, transport control, BPM lookup, tap-to-align phase lock; auto phase-lock when the playing track matches an analyzed local song.

### Later (architecture must not preclude)
Mic-based live beat tracking · Ableton Link · practice tracking · MIDI clock out · stem separation (on-device or cloud) · time-stretch practice speed (Signalsmith Stretch) · visual flash/haptics.

---

## 2. Architecture

### 2.1 Shape

```
┌────────────────────────── Flutter (Dart) ──────────────────────────┐
│  app_shell ── go_router ── ToolPlugin registry (Riverpod provider) │
│  tool_metronome │ tool_tuner │ tool_library │ tool_stems │ tool_sync│
│         core_plugin_api · core_design · core_db (drift)            │
└───────────────┬────────────────────────────────────────────────────┘
                │ dart:ffi (ffigen bindings) — commands via FFI calls,
                │ realtime data back via polled lock-free ring buffers
┌───────────────┴──────────── C++ audio core ────────────────────────┐
│  device I/O: miniaudio (Android AAudio · Linux PipeWire · iOS later)│
│  mixer/playback: SoLoud fork (stems, click samples)                 │
│  clock: uint64 sample-frame counter (master), host-time mapping     │
│  scheduler: lookahead click sequencer → SPSC ring → audio callback  │
│  analysis: QM-DSP (offline beat grid) · cycfi/q MPM (tuner)         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Plugin model (internal)

Each tool is a Dart package implementing `ToolPlugin`:
`id · icon · routes (List<RouteBase>) · home tile widget · audio-node factory ·
settings schema · optional lazy asset spec`. The shell aggregates
`toolPluginsProvider` (Riverpod as registry — no get_it, no second DI system).
Heavy assets (future ML models) download from CDN to app storage with checksum
verification — **no Play Asset Delivery** (breaks F-Droid reproducible builds).

### 2.3 Realtime rules (C++ core)

- Audio callback: allocation-free, lock-free; drains SPSC command/event rings.
- Master clock = sample-frame counter incremented only in callback.
- Metronome: "Tale of Two Clocks" lookahead pattern — non-RT scheduler thread
  (poll ~25ms, lookahead ~100ms) emits sample-frame-stamped click events; tempo
  changes recompute future targets, never mutate scheduled ones.
- Dart↔native: FFI calls for commands; UI reads position/levels/pitch by polling
  ring buffers on vsync ticker. `NativeCallable.isolateLocal` only for
  low-frequency events (beat hit, note lock). Never stream 60fps values through
  the Riverpod graph.
- Click scheduled early by measured output latency so speaker output lands on beat.

### 2.4 Data

Drift (SQLite) — songs, stem sets, setlists, tool settings, practice data.
Beat grids = per-beat timestamps (handles tempo drift), stored as Float32 BLOBs.
Waveform peak caches = binary sidecar files (audiowaveform min/max bucket format).

### 2.5 Platform strategy

- **Dev vehicle**: Flutter Linux desktop + same C++ core (miniaudio→PipeWire) —
  daily iteration on Arch without emulator; Android device for latency/mic truth.
- **Web (later)**: `dart:ffi` does NOT compile to WASM. Same C++ source builds
  via Emscripten into an AudioWorklet WASM module, driven by `dart:js_interop`.
  Separate toolchain, shared DSP source. Keep core free of Android-isms.
- **iOS (last)**: miniaudio CoreAudio backend; media sync must be per-service
  (Spotify App Remote SDK, MusicKit) — no cross-app session API on iOS.

---

## 3. Technology decisions (researched)

| Concern | Choice | License | Why |
|---|---|---|---|
| UI | Flutter, Material 3 + ThemeExtension tokens, dark-first | BSD | Polish without bespoke widget lib; stage-friendly |
| State | Riverpod v3 (+codegen) | MIT | Registry + DI + testable overrides in one |
| Nav | go_router; each plugin exports routes | BSD | Simple; matches registry |
| Monorepo | melos | MIT | Package-per-tool = the product thesis |
| DB | drift | MIT | Isar unmaintained; relational fits setlists |
| Device audio | miniaudio | MIT-0/PD | AAudio+PipeWire+CoreAudio+one API; Oboe adds little (port QuirksManager fixes if needed) |
| Mixer/playback | SoLoud fork | zlib | Proven Flutter FFI pattern (flutter_soloud); saves months |
| Click scheduler | Custom C++ | ours | SoLoud sequencing not sample-accurate enough |
| Decoders | dr_wav/dr_mp3/dr_flac + stb_vorbis | PD | Tiny, battle-tested |
| AAC/M4A | NDK AMediaCodec now; minimal LGPL FFmpeg (aac only, ~2MB) for web/desktop parity later. Never FDK/nonfree | Platform/LGPL | The one format dr_libs can't do |
| Resampling | miniaudio built-in (Speex, BSD) | BSD | Good enough; one less dep |
| Offline beat grid | QM-DSP BarBeatTrack (+aubio cross-check in tests) | GPL | Beat + downbeat detection |
| Realtime beat tracking (later) | BTrack | GPL | Designed for realtime |
| Tuner pitch | MPM via cycfi/q pitch core | GPLv3 | Guitar-purpose-built; ~2-period windows beat YIN at low freqs |
| Time-stretch (later) | Signalsmith Stretch | MIT | Near-RubberBand quality, mobile CPU-viable |
| Ableton Link (later) | Ableton Link SDK | GPLv2-dual | Verify "or later" combinability before merge |
| FFI bindings | ffigen from C header | — | flutter_soloud-proven |
| Lazy assets | dio + checksum to app storage | — | F-Droid-safe |

### Tuner specifics
UNPROCESSED audio source (fallback VOICE_RECOGNITION), never attach AGC/NS/AEC.
~30ms analysis window (→ ~90ms for bass B0), 50% overlap → 50-60Hz updates.
Median filter (3-5 frames) + EMA on cents; settle <150ms. Octave-error kill:
constrain search to active preset's per-string frequency band. A4 415–466Hz.

### Media sync specifics
Custom Kotlin platform channel (~200 lines) over `MediaSessionManager.getActiveSessions`
+ `MediaController` — existing Flutter plugins unsuitable. Requires notification-listener
access: manual Settings toggle → needs in-app explainer screen + Play policy declaration.
Position = snapshot + extrapolation (`pos + (now-lastUpdate)*speed`); re-anchor by
polling every 1-2s. Spotify Web API is a non-starter (2025-26 quota rules); App Remote
SDK (Apache-2.0) optional later.
**BPM lookup chain**: Deezer API (keyless) → GetSongBPM (free, mandatory attribution
credit in app + listing) → bundled AcousticBrainz 2022 dump → user tap-tempo override.
Never ship a shared API key in a public repo. All sources advisory; user override wins.

---

## 4. Repo layout

```
kitbag/
  melos.yaml
  PLAN.md                    # this file
  packages/
    core_plugin_api/         # ToolPlugin, AudioNode, SettingsSchema interfaces
    core_audio_ffi/          # ffigen bindings, ring-buffer readers, engine facade
    core_db/                 # drift schema + DAOs
    core_design/             # theme, tokens, shared widgets
    app_shell/               # entrypoint, router, registry, home grid, settings
    tool_metronome/
    tool_tuner/
    tool_library/            # import, analysis orchestration, player
    tool_stems/
    tool_sync/               # media session, BPM lookup, phase lock UI
  native/
    audio_core/              # C++: miniaudio, SoLoud fork, scheduler, analysis
      CMakeLists.txt         # targets: android (NDK), linux, later emscripten
  android/ ios/ linux/ web/  # runners (flutter create scaffolding)
  .github/workflows/         # CI: analyze+test per package (melos), NDK+linux builds
```

---

## 5. Milestones

Each milestone = shippable tag. Definition of done: works on Android device +
Linux desktop, tested, CHANGELOG entry.

### M0 — Foundation (scaffold)
Melos workspace, package skeletons, C++ core with miniaudio init playing a test
tone on Linux + Android via ffigen FFI, CI green (Dart analyze/test + NDK/Linux
C++ build), GPLv3 + README + CONTRIBUTING.
**Proof**: button in shell plays tone on both platforms.

### M1 — Metronome (v0.1)
Lookahead scheduler + sample clock in core; click sample playback; Dart API
(tempo, time sig, subdivisions, per-beat accent states, polyrhythm voice,
start/stop). UI: tempo dial + tap tempo, accent pattern editor, subdivision
picker, sound choice, trainer modes (ramp, bar-mute), setlists in drift.
**Proof**: 4h soak, zero dropped/jittered clicks (record + measure inter-click
intervals); tempo change mid-bar glitch-free.

### M2 — Tuner (v0.2)
Mic capture path in core (UNPROCESSED), MPM pitch via cycfi/q, ring-buffer
pitch stream, needle UI (60fps), chromatic + presets + auto-string, A4 setting.
**Proof**: ±1 cent vs reference tones 82Hz–1kHz; bass B0 acceptable settle.

### M3 — Library + sync-to-file (v0.3)
Import (file picker → copy/index), decode via dr_libs/AMediaCodec, background
analysis isolate → QM-DSP beat grid → drift BLOB, waveform peaks sidecar,
player (play/pause/seek/waveform), **metronome phase-locks to beat grid**
(sample-accurate, latency-compensated).
**Proof**: click audibly on-beat across 20 diverse songs incl. non-constant tempo.

### M4 — Stem player (v0.4)
Folder import → stem set (name matcher: vocals/drums/bass/guitar/piano/keys/other),
resample-on-ingest to canonical rate, zero-pad length mismatches, N-track
lock-free mixer with per-track gain/mute/solo, per-stem waveforms, A-B loop with
equal-power crossfade (5-20ms).
**Proof**: 6-stem song stays sample-locked through seek/loop/solo for full track.

### M5 — Media sync (v0.5)
Kotlin MediaSession channel + permission explainer flow, now-playing UI with
transport controls, BPM lookup chain + cache, tap-to-align + nudge (±ms), library
match (title/artist fuzzy) → auto phase lock from stored beat grid, extrapolated
position + periodic re-anchor.
**Proof**: metronome stays on-beat with Spotify over 3-min song after one tap;
auto-lock works for analyzed tracks without any tap.

### M6+ — Later ring
Practice tracking · Ableton Link (license Q first) · mic beat tracking (BTrack) ·
MIDI clock · time-stretch · web build (Emscripten worklet) · stem separation ·
F-Droid + Play submission.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Android audio latency variance across devices | Measure at runtime; expose latency offset; port Oboe quirks as needed |
| Notification-listener grant friction + Play review | Feature-gate: app fully usable without it; clear explainer; policy form ready |
| Position jitter from media apps (esp. Bluetooth) | Periodic re-anchor + user nudge always available; set expectations in UI |
| BPM lookup APIs disappear/limit | Multi-source chain + offline dump + tap-tempo always works |
| SoLoud fork drift from upstream | Isolate our changes; consider raw miniaudio if fork cost exceeds value |
| Web WASM path decays | Core kept platform-clean; web is a later, separate build target — no early tax |
| Ableton Link GPLv2 vs GPLv3 | Confirm "v2 or later" / email Ableton before integrating |
| Scope creep (everything-app) | Milestone gates; nothing enters core that a plugin can carry |

---

## 7. Design

Interface spec: `design/kitbag-ui.html` (dual-theme, all v0.1–v0.5 screens + component
library + experience rules). Decisions from design review 2026-07-07:
- Metronome tempo = **full-screen swipe-anywhere** gesture + visible ±5/±10 preset
  steppers + TAP (every gesture must have a visible twin).
- Polyrhythm = **second LED row** (clarity over decoration).
- Home = hub with fixed default tile order; **long-press edit mode** to
  reorder/resize/pin/hide tiles.
- **Mini-player** bar docks above other screens while a song plays (Spotify pattern).
- Experience rules (section 06 of spec) are milestone acceptance criteria:
  sound in <5s no tour, empty-states-as-CTAs, semantic haptics via
  HapticFeedbackConstants (beat tick thins >160 BPM), <400ms feedback, no dead-end
  permission/offline states, contextual settings, TalkBack live regions, ≥48dp
  targets, 200% text-scale safe, practice-end summary (peak-end).

## 8. Immediate next steps

1. `flutter create` shell + melos workspace + package skeletons (M0).
2. C++ core: CMake, miniaudio device open, tone test, ffigen pipeline.
3. CI: GitHub Actions — melos analyze/test, Linux build, Android NDK build.
4. Then M1 metronome engine.
