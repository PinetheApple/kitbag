# Play along: can Kitbag find the beat and downbeat by itself? (#766)

Status: research, 2026-11-28. No code. SPEC.md is the source of truth; this note only
reports what the sources say.

The question: while another app plays a track on Android, could Kitbag listen to it and
lock the click's tempo, beat phase and downbeat with no tap?

## Verdict: drop audio capture, park microphone auto-lock

- **SPEC forbids it today.** SPEC.md §8.1 says Play along uses "Metadata, position, and
  transport — never audio capture", calls that the Play-policy justification, and marks
  it non-negotiable. Building any listening mode first means the owner changing §8.1.
- **Whether playback capture works is unknown per app, and each app can opt out.** Nobody
  has published a per-app test. The one claim found
  says Spotify and DRM apps opt out, and that claim is unverified (table below). It also
  costs RECORD_AUDIO, a screen-capture consent prompt every session, and a
  mediaProjection foreground service that has to be declared to Play.
- **Microphone capture works with any app, but fails in the case this tool exists for.**
  With headphones the mic hears nothing. Through a speaker it also hears the user's own
  instrument.
- **Even with clean audio, the downbeat is the weak part.** The best published *online*
  downbeat F1 on GTZAN is 74.1 (Beat This! Live, ISMIR 2026), and the established systems sit at
  46 to 57. SPEC §8 states the principle "tempo is known; phase is the feature. The
  downbeat is the thing only you know." The research supports that: tapping the downbeat (#765)
  is cheaper and more reliable than any detector.
- **What to do instead:** keep the §8.5 ladder (library grid, then GetSongBPM, then tap)
  and build #765's tap-along lock: several taps give a robust phase, then one step picks
  the "1". When a track matches an analysed library song, the stored grid already gives
  beats and downbeats with no listening at all.
- **Park, don't drop, mic auto-lock.** Revisit it only if the owner relaxes §8.1 *and* a
  device spike gets past the bar under "What would change this".

## AudioPlaybackCapture (API 29+): the rules

All rules below are **verified** from https://developer.android.com/media/platform/av-capture
and https://developer.android.com/media/grow/media-projection.

- The capturing app needs `RECORD_AUDIO` and a user-approved
  `MediaProjectionManager.createScreenCaptureIntent()` prompt. Both apps must be in the
  same user profile.
- Android only captures players whose usage is `USAGE_MEDIA`, `USAGE_GAME` or
  `USAGE_UNKNOWN`, and whose capture policy is `ALLOW_CAPTURE_BY_ALL`.
- Default: apps that target API 29 or higher can be captured. Apps that target API 28 or
  lower cannot unless they opt in. An app opts out with
  `android:allowAudioPlaybackCapture="false"`, with `AudioManager.setAllowedCapturePolicy`,
  or per player. The most restrictive setting wins.
- Consent: "Your app must request user consent before each media projection session."
  The consent intent cannot be reused, and the token is shown in Quick Settings, where
  the user can revoke it.
- Android 14+ requires a foreground service with
  `foregroundServiceType="mediaProjection"`, started after the consent intent
  (https://developer.android.com/about/versions/14/changes/fgs-types-required).
- Play: apps targeting Android 14+ must declare the foreground service types they use in
  Play Console, and the mediaProjection declaration should show the user starting a
  capture (https://support.google.com/googleplay/android-developer/answer/13392821)
  (**verified** that the declaration exists; how review treats a metronome is
  **unmeasured**).
- Latency: the docs say capture does not add latency to the app being captured. They give
  no figure for how long the captured audio takes to reach Kitbag (**unmeasured**).
  §8.4 already maps media position onto the engine clock, so a constant capture delay
  would be calibratable (**inferred**).
- Protected content: a third-party write-up says DRM audio decoded through tunneled
  playback never reaches AudioFlinger, so it cannot be captured
  (https://chauyan.dev/en/blog/amlogic-s905x4-audio-loopback-investigation-en)
  (**inferred** that this applies to phones; that write-up covers a TV SoC).

### Per app

No source tests these apps one by one. Every cell is the evidence found, not a guess.

| App | Capture works? | Evidence | Permission cost |
|---|---|---|---|
| Spotify | Probably blocked | A VisioForge guide says Spotify and DRM apps produce silence (https://www.visioforge.com/help/docs/dotnet/general/guides/android-audio-playback-capture/), a vendor tutorial with no test shown (**vendor-claim**, unconfirmed) | Mic + projection prompt per session + FGS |
| YouTube Music | **unmeasured** | none found | same |
| YouTube | **unmeasured** | secondary sources disagree on whether YouTube allows capture (search recaps, not citable) | same |
| Apple Music | **unmeasured** | none found | same |
| Amazon Music | **unmeasured** | none found | same |
| Tidal | **unmeasured** | none found | same |
| Deezer | **unmeasured** | none found | same |
| SoundCloud | **unmeasured** | none found | same |

The pattern that holds whatever the per-app answer: each app decides for itself whether
it can be captured, licensed music apps have a reason to opt out, and any app can change
its answer in an update without notice.

Accuracy: capture delivers the clean mix, the best input a tracker can get. The tracker
numbers below are the ceiling.

## Microphone capture

- Cost: the `RECORD_AUDIO` runtime permission
  (https://developer.android.com/reference/android/Manifest.permission#RECORD_AUDIO). The
  app already declares it for the tuner (`packages/app-shell/app.json:20`). A foreground service of type `microphone` is
  needed to keep listening in the background (Android 14 FGS types page above). Using the
  mic also contradicts the §8.1 "never audio capture" principle and its Play rationale.
- Acoustic latency: sound travels about 343 m/s, so speaker to mic takes roughly 3 ms per
  metre (**inferred**, physics). The real cost is the capture path, whose latency varies
  by device (**unmeasured** on SM-M156B). SPEC D5 clamps the user's latency-offset
  calibration to ±300 ms in the engine (SPEC.md:627, 636).
- Headphones or BT: the mic hears only the room. With wired or Bluetooth playback there
  is nothing to track (**inferred**, structural). For a practice tool this is the common
  case.
- In a room with the user playing along: the mic hears the track plus the instrument, and
  the published trackers were trained on mastered mixes. BeatNet's README says streaming
  mode "works best with loud input" (https://github.com/mjhydri/BeatNet). No published
  number covers a track mixed with a live instrument (**unmeasured**). Expect it to be
  worse than the GTZAN figures (**inferred**).
- Kitbag's own click is in the mic signal too, so it would need cancelling or gating
  (**inferred**).

## On-device tracking cost

Licence context: Kitbag is GPL-3.0 (repo `LICENSE`), and it already vendors GPL-2.0 QM-DSP
(`native/audio_core/third_party/qm-dsp/LICENSE`). GPL dependencies are therefore not a
blocker.

| Candidate | Beat / downbeat | Online? | Licence | Mobile fit |
|---|---|---|---|---|
| BTrack (https://github.com/adamstark/BTrack) | beat only | yes, causal | GPL-3.0 (**verified**) | C++, light (**inferred**) |
| aubio (https://aubio.org/) | beat/tempo; no downbeat mentioned | causal, "low delay" | GPL (**verified**) | C, light (**inferred**) |
| BeatNet (ISMIR 2021, https://arxiv.org/abs/2108.03576) | both + meter | yes (CRNN + particle filter) | CC-BY-4.0 repo (**verified**) | Python + PyTorch + madmom; would need porting (**inferred**) |
| BeatNet+ (TISMIR 2024, https://transactions.ismir.net/articles/10.5334/tismir.198) | both | yes | not checked | not checked |
| Beat This! Live (arXiv 2611.34277, 25 Nov 2026) | both | yes, predicts ahead | paper CC BY 4.0; code licence not stated | model size not stated |
| Essentia, madmom, All-In-One | both (offline DBN) | mostly offline | not re-checked here | heavy; listed only for completeness |

Accuracy, all GTZAN F-measure at ±70 ms, online:
- BeatNet 75.4 beat / 46.5 downbeat (arXiv 2108.03576) (**verified**). The same table's
  BeatNet + DBN row (80.6 / 54.1) is offline and does not belong in this list.
- BeatNet+ 80.6 / 56.5; Beat This! Live 86.7 / 74.1 (https://arxiv.org/abs/2611.34277)
  (**vendor-claim**: the authors' own results, accepted at ISMIR 2026, not reproduced).
- Read together: an F1 of 74.1 means roughly a quarter of downbeats missed or misplaced,
  even on clean mixes (**inferred**).

CPU and memory: BeatNet reports CPU timing on a desktop only (Ryzen 9 3900X). No source
gives mobile figures for any of these models (**unmeasured**). Time to lock: no source reports it. Particle-filter and DP trackers need
several bars of audio before tempo and meter settle (**inferred**), and the user can tap
a downbeat faster than that.

### What Kitbag already has

- `native/audio_core/src/analysis/beat_tracker.{h,cpp}`: spectral-flux onsets, an
  autocorrelation tempo, DP beat placement over the *whole* onset envelope. It is
  offline: `AnalyzeFlux` takes the full flux vector. Reusing it on a stream means a
  sliding window and re-running the DP on each new window (**inferred**).
- `native/audio_core/src/analysis/downbeat.{h,cpp}`: `DownbeatTracker`, a streaming port
  of QM-DSP `DownBeat` that is pushed audio incrementally. Its constructor takes known
  beat times and `total_frames`, and `Finish()` returns results only at the end. Live use
  would need an incremental result API and beats arriving as they happen (**inferred**).
  The repo has no measured downbeat accuracy on real music. Its tests use synthetic
  fixtures (`tools/analysis/analyze_test_downbeat.cpp`).
- The engine side is ready: `kb_metronome_anchor_external` and `kb_metronome_anchor_grid`
  (§8.4) would accept a detected phase exactly as they accept a tap.

## Alternatives

- **Library grid match**, which already exists in §8.5/§8.6: per-beat spacing plus
  downbeats from import analysis, offered as a lock card. It needs no phase input, but
  only works for songs the user has imported.
- **Metadata BPM plus tap for phase.** GetSongBPM is opt-in with a personal key (D7) and
  Deezer was dropped (§8.5). #765's tap-along then settles the phase and the "1".
- **Tap tempo plus tap phase:** the always-available floor.
- **Assisted tap:** snap the user's downbeat tap to the nearest onset in a short mic
  window. This needs the mic and still conflicts with §8.1 (**inferred**, not proposed).

## Risks if built anyway

- A SPEC §8.1 reversal and losing the Play-policy story. On Play, a mediaProjection
  declaration for a metronome is a review risk (**unmeasured**).
- Per-app capture can break silently when the other app updates (structural).
- A consent prompt every session goes against the "one tap, not zero" trust stance in §8.6.
- A wrong auto-detected downbeat clicks confidently on beat 3. §8.6 already rejects a
  tool that "starts clicking at you unasked".
- No CPU or battery numbers exist; the only way to get them is to measure on SM-M156B.

## Open questions

- Whether each app can be captured: settled by a device capture test per app.
- Capture-path latency and jitter on SM-M156B: settled by a loopback measurement.
- Downbeat accuracy of Kitbag's own `DownbeatTracker` on real music: settled by an
  annotated set run through `analyze_song`.
- Beat This! Live code licence, model size and phone CPU cost: not yet published or
  checked.
- Adjacent: whether F-Droid flags MediaProjection use was not checked (no anti-feature
  for it is known).

## What would change this

Revisit mic or capture auto-lock only if the owner rewrites §8.1, and a device spike
clears a bar the owner sets. A proposed bar: correct downbeat in at least 90% of 4/4 pop
tracks within 8 bars on SM-M156B, at a CPU cost acceptable while the engine runs.
