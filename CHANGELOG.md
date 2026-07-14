# Changelog

All notable changes to Kitbag are documented here.

The format is based on [Keep a Changelog][keepachangelog],
and this project adheres to [Semantic Versioning][semver].

[keepachangelog]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/spec/v2.0.0.html

---

## [0.5.0] — Media Sync — 2026-07-14

### Added

- **tool_sync** — new plugin package for external media detection and phase locking.
- **Kotlin MediaSession channel** — platform channel detecting active media sessions
  (title, artist, play/pause state) via `MediaSessionManager` +
  `NotificationListenerService`.
- **Now-playing screen** — displays current track, BPM, transport state, with
  permission explainer flow for notification listener access.
- **BPM lookup chain** — Deezer API (keyless) → tap-tempo fallback (4‑tap
  running average, resetable).
- **Phase lock** — lock metronome to detected BPM with one tap.
- **Nudge controls** — phase offset slider (−100 to +100 ms, 5 ms steps).
- **Auto phase‑lock** — fuzzy title/artist match against library → retrieves
  stored beat grid for automatic sync.
- **Android permissions** — `POST_NOTIFICATIONS` and `NOTIFICATION_LISTENER_SERVICE`
  declared in manifest.

## [0.4.0] — Stem Player — 2026-07-14

### Added

- **tool_stems** — new plugin package for multi‑track stem playback.
- **Stem import** — folder picker → name‑based matcher
  (vocals/drums/bass/guitar/piano/keys/other) → Drift storage.
- **Stem metadata decode** — duration, sample rate, channels extracted on
  import in background isolate.
- **Database schema v6** — `StemSets` + `Stems` tables with CRUD DAO.
- **C++ Mixer** — lock‑free N‑track mixer with per‑track gain/mute/solo
  atomics; solo‑aware (any solo → unsoloed tracks silent); position tracking
  with auto‑stop; 14 C API functions.
- **Mixer FFI bindings** — full Dart FFI bindings in `core_audio_ffi`.
- **MixerController** — Dart controller wrapping mixer C API.
- **Mixer provider** — `mixerControllerProvider` in `core_services`.
- **Stems UI** — per‑set stem list, realtime gain sliders, mute/solo
  toggle buttons, play/stop transport using native mixer.
- **Engine integration** — mixer processes before metronome in the audio
  render callback.

## [0.3.0] — Song Library & Play‑Along — 2026-07-14

### Added

- **tool_library** — new plugin package for song import, analysis, and playback.
- **Song import** — file picker → copy to app music directory → Drift index
  (title, artist, duration, format).
- **Database schema v4** — `LibrarySongs` table.
- **Native decoder (miniaudio)** — C API (`kb_decoder_open/close/duration/
  sample_rate/channels`) for offline metadata extraction.
- **FFI decoder bindings** — `DecoderController` in `core_audio_ffi` with
  background isolate support.
- **Beat analysis** — radix‑2 FFT + spectral flux onset detection +
  autocorrelation tempo + dynamic programming beat placement;
  `kb_analyze_song` C API.
- **Waveform sidecars** — `.kwav` binary peaks file format, written during
  analysis.
- **Database schema v5** — `beat_grid` (Float32 BLOB), `bpm` (REAL),
  `waveform_path` (TEXT) on `LibrarySongs`.
- **Player** — `just_audio`‑based play/pause/seek with waveform display
  (CustomPainter reading `.kwav`).
- **BeatSyncService** — sample‑accurate phase lock between `just_audio`
  playback and native metronome via beat grid + scheduled first‑beat +
  periodic drift correction.
- **Play‑Along screen** — unified UI with waveform, beat LED circle,
  bar sweep indicator, transport controls, BPM adjustment.
- **Library song list** — popup menu with "Play" and "Play along" actions.

## [0.2.0] — Tuner — 2026-07-14

### Added

- **tool_tuner** — full plugin with chromatic tuning, instrument presets.
- **Adaptive noise gate** — squelches silence before pitch detection.
- **Note‑lock state machine** — settles on a note with hysteresis,
  preventing mid‑transition flicker.
- **Median filter** — window size 5 with EMA α=0.25 for smooth pitch display.
- **Tuning editor** — add/remove strings in custom tuning profiles.
- **Settings panel** — volume boost slider, latency correction slider,
  per‑tool enable/disable toggle; filtered home screen.

## [0.1.0] — Metronome — 2026-07-14

### Added

- **Lookahead click scheduler** — sample‑accurate click timing via
  non‑RT scheduler thread + SPSC ring → audio callback.
- **Per‑song metronome presets** — BPM, time signature, subdivision,
  accent pattern, polyrhythm, click sound, volume, latency offset stored
  in Drift per setlist entry.
- **Database schema v1–v2** — `Setlists`, `Songs`, `Tunings` tables with
  Drift DAOs.
- **Tempo dial + tap tempo** — full‑screen swipe gesture, ±5/±10 steppers.
- **Accent pattern editor** — per‑beat accent state (strong/medium/weak/none).
- **Polyrhythm mode** — second LED row with independent beat count.
- **Custom subdivisions** — free‑form input (1–16).
- **Click sounds** — 6 samples: default, wood block, rim shot, tom,
  hi‑hat, cowbell.
- **Circle LED layout** — space‑efficient beat indicator.
- **Tempo ramp trainer** — ramp over bars, seconds, or minutes.
- **Practice timer** — auto‑starts on play, pauses on pause, resettable,
  displayed at top of metronome screen.
- **Practice logs** — per‑session records (duration, avg BPM, setlist,
  songs) stored in Drift `PracticeSessions` table (schema v3).
- **Setlist management** — create/rename/delete setlists; add/reorder/
  remove songs.
- **Export/import** — JSON archive of setlists, songs, practice sessions,
  tunings, library songs, stem sets (format v3).
- **Notification transport controls** — play/pause/stop from notification
  (fixed background action handling).
- **Metronome notification** — persistent notification with transport actions.
- **List item spacing** — consistent gapping throughout setlist/song lists.
