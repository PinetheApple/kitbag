# Tuner Research: Open-Source Chromatic Tuners

> **⚠ Read this first — measured 2026-07-17.**
>
> This document surveys pitch-detection algorithms and recommends refinements to
> the current implementation (§3: median-filter length, EMA α, hysteresis). **Its
> premise is that the detector works and needs tuning. It does not work.**
>
> `tuner_verify` fails **37 of 37** checks. It bypasses the mic and the C API,
> driving `PitchAnalyzer` directly with synthesized tones, and reports
> `0.000 Hz` / `confidence 0.00` for every frequency from 82.41 Hz to 1 kHz.
> Silence and a pure 440 Hz sine are indistinguishable to it.
>
> **Do not implement §3's improvements yet.** Widening a median filter over a
> detector that emits nothing changes nothing. Make `tuner_verify` green first —
> it is a closed loop with no hardware in it and it runs in a second.
>
> Everything below stays useful as algorithm background (§2 and §4 especially,
> for choosing what to replace the current detector *with*). Only §3's
> "improve what's there" framing is invalidated. See `SPEC.md` §10.1.

## 1. Commercial Tuner Approaches

### gStrings

- **Algorithm:** Proprietary multi-core optimized engine (rewritten v2.0). No public
  source, but predates TarsosDSP; likely uses autocorrelation family.
- **Window:** Unknown (proprietary).
- **Octave errors:** Handled via instrument-specified detection ranges and
  custom temperaments.
- **String detection:** Built-in instrument profiles + custom tunings.
  Auto-detects via nearest-MIDI-note lookup in instrument's string list.
- **Visual feedback:** Analog needle + digital display simultaneously. OpenGL
  graphics (v2.0 rewrite).
- **Noise gate:** Unknown (proprietary). Includes room profiling and spectral
  subtraction per reviews.

### DaTuner (open-source Android)

- **Algorithm:** YIN (de Cheveigné & Kawahara). Pure Java, no external libs.
- **Window:** 8192 samples @ 44100 Hz (~186ms). Note: "may be too heavy for
  older devices."
- **Threshold:** 0.1 (YIN paper suggests 0.1-0.15 for less errors).
- **Octave errors:** Octave-based thresholding — splits range into sub-octaves
  and selects best estimate lag. Parabolic interpolation refines tau.
- **String detection:** Pre-added tunings + custom tunings. Auto string
  matching from instrument's string list.
- **Key finding:** Window of 8192 gives ~15 complete cycles at 82Hz (guitar
  low E), giving statistical confidence for bass response. Parabolic
  interpolation pushes resolution below 1 cent.

### Soundcorset

- **Algorithm:** Unknown (proprietary). Likely YIN or MPM based on precision.
- **Key features:** Chromatic + pitch fork modes. Gauge (dial) + chart (pitch
  history over time) + volume meter simultaneously. AI Tutor for recorded
  playback analysis.
- **Notable:** Chart display of pitch changes over time is a UX differentiator.
  Customizable A4 (415-466Hz). Supports all instruments.

### GuitarTuna

- **Algorithm v7.1+:** Multi-stage pipeline:
  1. Real-time FFT peak tracking
  2. Harmonic series validation
  3. Gradient-boosted decision tree (42,000 labeled recordings)
- **"Harmonic Lock":** Cross-references detected harmonics to infer missing
  fundamentals. If 3rd (247.2Hz) and 5th (412Hz) harmonics are present but
  fundamental (82.4Hz) is weak, infers E2 rather than misreading as B2.
- **Window:** ~40ms analysis window. **Weakness:** transient spikes from fast
  picking patterns cause flickering.
- **Latency:** 85-115ms (native), 90-120ms (mobile).
- **Median error:** ±5 cents (moderate distortion), ±7 cents (extreme fuzz).
- **Key finding:** ~40ms window is too short for sustained stability; longer
  windows (150ms+) with adaptive decay improve "behavioral trust."

---

## 2. Pitch Detection Algorithms — Deep Dive

### YIN (de Cheveigné & Kawahara, 2002)

| Parameter | TarsosDSP Default | aubio Default | DaTuner | Recommendation |
|---|---|---|---|---|
| Buffer/window | 2048 | 1024-4096 | 8192 | 2048 (low-end) to 8192 (bass) |
| Hop size | 1536 (75%) | 256 (25%) | ~4096 (50%) | 50% overlap (half buffer) |
| Threshold | 0.20 | 0.15 | 0.10 | 0.10-0.15 (lower = fewer false +ves) |
| Sample rate | 44100 | 44100 | 44100 | 44100 or 48000 |

**YIN pipeline (5 steps):**
1. **Difference function** — sum of squared differences between signal and
   delayed copy at each lag tau. O(N²) in naive form; O(N log N) via FFT
   (FastYin).
2. **Cumulative mean normalized difference** — divides difference function by
   its running average, fixing the zero-lag dip problem. Makes thresholding
   amplitude-independent.
3. **Absolute threshold** — find first minimum below threshold. The threshold
   represents "proportion of aperiodic power tolerated within a periodic
   signal." Paper suggests 0.1-0.15.
4. **Parabolic interpolation** — fits parabola around the minimum for
   sub-sample lag precision. Pushes resolution from ~3 cents to <0.1 cent.
5. **Best local estimate** (optional) — re-estimates with interval
   (T_max/2) around previously found tau. Improves tracking on non-stationary
   signals.

**Key octave error problem with YIN:** The difference function has minima at
both the true period tau and at 2\*tau (one octave below). The cumulative mean
normalization + threshold reduces but doesn't eliminate this. The fix is either
band-limiting (restrict search range to <1 octave) or MPM's "first key
maximum" rule.

**aubio's `yinfft` variant** uses a tapered square difference function via FFT,
which allows spectral weighting and simplifies period selection. More robust
than plain YIN on non-stationary signals.

### MPM — McLeod Pitch Method (McLeod & Wyvill, 2005)

**Core innovation:** Normalized Square Difference Function (NSDF), bounded
[-1, 1]. NSDF = 1 means perfect periodicity; NSDF = 0 means no correlation;
NSDF = -1 means anti-correlation.

**Key difference from YIN/autocorrelation:** MPM uses a specific selection
rule — it picks the **first key maximum** that clears **90% of the global
peak** in the NSDF. This is the critical octave-error fix:

- Fundamental period always produces the first sufficiently large peak in NSDF
- Double-period (one octave lower) is the second or third peak
- By choosing the first qualified peak rather than the tallest, the algorithm
  locks onto the fundamental before reaching longer-period overtones
- Threshold: 0.9 (90%). Below 0.5, detection is too uncertain to show

**Metro Gnome's MPM settings (proven in production):**
- Window: 8192 samples @ 44100 Hz (~186ms)
- Zero-padded to 16384 before FFT (prevents circular aliasing)
- Parabolic interpolation for sub-sample resolution
- 50% overlap (4096-sample hop) → ~11 readings/second

### Bitstream Autocorrelation (BACF) — cycfi/q (current Kitbag implementation)

**What it does:** Operates on single-bit binary data streams instead of
floating-point. Extremely fast — suited for embedded/Bela hardware.

**Strengths:**
- Very low CPU: threshold-crossing detection instead of multiply-accumulate
- Works well on guitar signals (guitar-centric development)
- Dual-predictor approach (inverted + non-inverted signal) with median-of-3
  reduces errors

**Weaknesses:**
- Can produce outliers on complex signals (hammer-ons, pull-offs)
- Misdetects when band spans >4.5 octaves (per kChromaticHighHz comment)
- Less accurate than YIN/MPM on non-guitar instruments and chord tones
- No "first key maximum" rule → octave errors possible without band limits

**Recommendation:** BACF is adequate for the tuner's per-string band-limited
mode, but adding an ensemble voter (YIN or MPM as supplementary detector)
would improve chromatic mode robustness.

### Ensemble Approaches

**Tuneo / react-native-tuner-engine approach:**
Three detectors in parallel — YIN, PYIN (probabilistic YIN), and cepstrum.
They vote by agreement within 1 semitone. This eliminates octave errors by
requiring cross-detector consensus. Cost: 3× compute.

**Startup profile (900ms):**
- Measure background amplitude → set noise gate floor
- Capture any steady tone (mains hum 50/60Hz, fan pitch)
- Freeze noise profile for the session

**Environment analyser decision rules:**
- Pitch must stay within 18 cents of itself for 320ms → acquire lock
- Ride out gaps up to 360ms (plucked string decaying to silence)
- If speech overlaps note, hold lock up to 800ms
- Same note returning within 1500ms of lock drop → re-lock immediately

---

## 3. Smoothing and Post-Processing

### Current Kitbag Implementation (pitch_analyzer.cpp)

| Component | Current Value | Notes |
|---|---|---|
| Median filter | 3-tap (Hz domain) | Small window, limited outlier rejection |
| EMA on cents | alpha = 0.4 | ~90% settled in 4 updates (~66ms) |
| Noise gate | Peak follower, -50dBFS | Single threshold, no room profiling |
| Envelope decay | 20Hz release | |
| Detector hysteresis | -40dB (passed to cycfi/q) | |
| Update rate | 60 Hz | ~16.7ms between publishes |
| Reseed on note change | Yes | EMA resets instantly |
| Hold duration (Dart) | 1750ms | Freeze last reading when confidence drops |

### Recommended Improvements (Metro Gnome approach)

**1. Increase median filter to 5-tap**
- 3-tap can be fooled by 2 consecutive bad frames
- 5-tap votes out single octave-jumps reliably
- Cost: 2 extra floats, O(n log n) sort of 5 elements — negligible
- **Specific change:** `kMedianLength` from 3 to 5 in `pitch_analyzer.h:56`

**2. Add two-layer smoothing**
Current: single EMA on cents.
Recommended:
- Layer 1: 5-tap median on raw frequency (kills outliers)
- Layer 2: Per-note EMA on cents with alpha 0.25 (Metro Gnome) instead of 0.4
  - Reseed instantly on note change (already done ✓)
  - Alpha 0.25 provides more damping without perceptible lag
- **Specific change:** `kCentsEmaAlpha` from 0.4 to 0.25 in
  `pitch_analyzer.h:58`

**3. Add startup room profiler**
- At Start(), collect 900ms of ambient audio
- Measure background RMS amplitude
- Detect steady tones (mains hum)
- Use as adaptive noise floor reference
- **Implementation:** ~40kB buffer for 900ms @ 48kHz mono f32
- Store as `noise_floor_profile_` in PitchAnalyzer

**4. Replace simple gate with adaptive noise gate**
Current: fixed threshold at -50dBFS.
Recommended: asymmetric adaptive gate.
- Noise floor tracker: slow-attack / fast-release envelope on RMS
  - Fast when signal_env < noise_env (track quiet → pull floor down)
  - Slow when signal_env >= noise_env (transients don't inflate floor)
  - Ratio: fast = learn_coeff, slow = learn_coeff / 64
- Margin: signal must exceed noise floor by 12dB to open gate
- Learn time: 2000ms (Metro Gnome profiler)
- Attack: 5ms, Release: 100ms
- **Specific change:** Replace `envelope_` (peak follower) with
  `rms_envelope_` + `noise_floor_` + `gate_open_` state machine

**5. Add note-lock state machine**
Current: only `kHoldDuration` in Dart (1750ms freeze).
Recommended: native-side lock acquisition.
- **Lock thresholds:**
  - Acquire: pitch within 18 cents for 320ms (Metro Gnome)
  - Ride: hold through gaps up to 360ms
  - Re-lock: same note within 1500ms → instant re-lock
- **Benefit:** Prevents needle flicker on transient noise without freezing the
  needle on genuine note changes

**6. Adaptive parameter switching (Expo blog approach)**
- **Attack mode** (first 100ms of a note): wide frequency search, strict
  confidence threshold (0.85+)
- **Sustain mode** (after lock acquired): narrow search (±20% around last
  pitch), relaxed threshold (0.6)
- **Benefit:** Stops harmonic jumps during note decay while maintaining fast
  initial lock
- **Implementation:** Use cycfi/q's `SetBand` dynamically — keep wide band
  during acquisition, narrow to ±20% of detected pitch after lock

---

## 4. Open-Source Pitch Detection Libraries

### TarsosDSP (Java/Android)

| Attribute | Value |
|---|---|
| License | GPL v3+ or commercial (LGPL for Android) |
| Algorithms | YIN, FastYin (FFT), MPM, Dynamic Wavelet, AMDF, FFTPitch |
| Default buffer | 2048 |
| Default hop | 1536 (75% overlap) |
| Threshold (YIN) | 0.20 |
| Critical API | `PitchProcessor(PitchEstimationAlgorithm, sampleRate, bufferSize, handler)` |
| Used by | Chroma Tuner, GitaristErik/GuitarTuner, stringSync |

**Key insight:** TarsosDSP's `FastYin` uses FFT-based difference function
computation — 3× faster than naive YIN. The audio data is not modified in
place (copy semantics), so the buffer can be reused for visualization.
`Periodicity` is returned as `probability` = `1 - yinBuffer[tau]`.

### aubio (C)

| Attribute | Value |
|---|---|
| License | GPL v3 |
| Algorithms | yin, yinfast, yinfft, fcomb, mcomb, specacf |
| Default | yinfft (tapered spectral YIN) |
| Buffer | 1024-4096 (1024 minimum for high frequencies) |
| Hop | buffer/4 (25%) |
| Threshold | 0.15 (yin), 0.85 (yinfft) |
| Silence threshold | configurable, default -70dB |

**aubio methods overview:**
- `yin`: Plain YIN — good accuracy, O(N²) difference function
- `yinfast`: FFT-accelerated YIN — spectral computation, same logic
- `yinfft`: Tapered spectral YIN — spectral weighting, simplified period
  selection, most robust in aubio
- `mcomb`: Multiple comb filterbank — harmonic summation, slowest

**Portability:** C library, easily JNI-wrapped. Header-only JNI bindings
available in aubio's contrib. Recommended for Android NDK tuners.

### cycfi/q (C++) — Already Used by Kitbag

| Attribute | Value |
|---|---|
| License | MIT |
| Algorithm | Bitstream Autocorrelation (BACF) |
| API | `pitch_detector(frequency low, frequency high, float sample_rate, dB hysteresis)` |
| Window | Auto-scaled: 2 periods of lowest band frequency |
| Dual predictor | Inverted + non-inverted signal, median-of-3 combination |
| Update mode | Batch-based (collects >= 2 periods before analysis) |

**Strengths for Kitbag:**
- Already integrated, MIT license (GPL-compatible)
- Extremely fast (1-bit stream → no FP multiply-accumulate)
- Dual-predictor mode reduces outliers significantly
- Header-only, zero dependencies

**Weaknesses relative to YIN/MPM:**
- No cumulative mean normalization step (prone to amplitude sensitivity)
- No "first key maximum" rule (octave errors possible without band limits)
- Less tested on non-guitar instruments (wind, brass, violin)
- Chromatic mode limited to 4.5 octaves (kChromaticHighHz constraint)

### libpd / Pure Data

Not recommended for standalone pitch detection. libpd's `fiddle~` and `pitch~`
objects exist but:
- Large runtime overhead (Pd interpreter)
- No longer actively maintained for tuner use cases
- GPL licensed (GPL v2, stricter than LGPL for mobile)
- Designed for interactive music systems, not instrument tuners

---

## 5. Android Audio Capture Best Practices

### Audio Source Selection

| Source | Processing | Recommendation for Tuners |
|---|---|---|
| `UNPROCESSED` | None (by spec). AGC/NS/AEC disabled. | **Preferred**. Check support via `AudioManager.getProperty(PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED)` |
| `VOICE_RECOGNITION` | May enable echo cancellation + noise suppression. Google docs warn against NS for ASR. | **Avoid**. Undesired filtering of instrument harmonics. |
| `MIC` (DEFAULT) | Vendor-specific processing, AGC likely enabled. | **Avoid**. AGC messes with envelope-based noise gating. |

**Kitbag status:** Already uses `ma_aaudio_input_preset_unprocessed` via
miniaudio — correct choice. ✓

**Fallback strategy:** If `UNPROCESSED` not supported:
1. Use `MIC` source
2. Manually detect AGC artifacts (sudden gain ramps)
3. Warn user in UI ("Mic is applying automatic gain — results may vary")

### Sample Rate and Buffer Sizes

| Parameter | Recommendation | Rationale |
|---|---|---|
| Sample rate | 48000 Hz | Kitbag current. Native AAudio/Oboe rate. |
| Min buffer size | `AudioRecord.getMinBufferSize(48000, CHANNEL_IN_MONO, ENCODING_PCM_16BIT)` | Guarantees no underrun. |
| Read buffer | `minBufferSize * 2` | Slightly larger to avoid frame drops. |
| Internal ring | 16384 samples (~340ms) | Kitbag current. ✓ Good for latency tolerance. |
| Analysis block | 2048-8192 | Depends on lowest frequency in band. |

**Kitbag status:** `kSampleRate = 48000`, `kRingCapacity = 16384` — both
sensible defaults. ✓

### Disabling Signal Processing

**Android path (Kitbag already uses AAudio preset):**
```c
config.aaudio.inputPreset = ma_aaudio_input_preset_unprocessed;
```

**If using AudioRecord (Java):**
```java
AudioRecord recorder = new AudioRecord.Builder()
    .setAudioSource(MediaRecorder.AudioSource.UNPROCESSED)
    .setAudioFormat(new AudioFormat.Builder()
        .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
        .setSampleRate(48000)
        .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
        .build())
    .setBufferSizeInBytes(bufferSize)
    .build();
```

**Verification:** Check `UNPROCESSED` support:
```java
AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
boolean supportsUnprocessed = am.getProperty(
    AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED).equals("true");
```

### Permission Flow

Current Kitbag flow is correct:
1. `RECORD_AUDIO` runtime permission
2. Permission gate in `mic_permission.dart`
3. Handle `permanentlyDenied` → Open Settings button
4. Lifecycle-aware: stop mic on background, restart on resume

**Additional considerations (Android 14+):**
- Foreground service: declare `foregroundServiceType="microphone"` in manifest
  if capture runs in a foreground service
- `targetSdk 34+`: system may add mic indicator dot — expect
  `SecurityException` if permission revoked while recording
- 100ms delay between `startRecording()` and first `read()` — hardware may
  not be ready immediately

---

## 6. Specific Recommendations for Kitbag Tuner

### Priority 1: Post-Processing Chain (high impact, low risk)

| Change | File | Current | Target |
|---|---|---|---|
| Increase median window | `pitch_analyzer.h:56` | `kMedianLength = 3` | `kMedianLength = 5` |
| Reduce EMA alpha | `pitch_analyzer.h:58` | `kCentsEmaAlpha = 0.4` | `kCentsEmaAlpha = 0.25` |
| Add note-lock hysteresis | `pitch_analyzer.h` (new constants) | None | Lock: 320ms / 18¢; Ride: 360ms; Re-lock: 1500ms |
| Adaptive noise gate | `pitch_analyzer.h` (replaces envelope) | Peak follower | Asymmetric RMS tracker |

### Priority 2: Room Profiler (medium impact, medium effort)

- Add 900ms startup noise profiling phase to PitchAnalyzer
- Measure ambient RMS + detect steady tones (50/60Hz mains hum)
- Set adaptive gate floor from profile
- Implement spectral subtraction for persistent background tones
- See Metro Gnome approach: frozen noise profile, spectral floor at 10%

### Priority 3: Adaptive Parameter Switching (medium impact, medium effort)

- Detect attack transient (rapid amplitude increase > 6dB in <50ms)
- On attack: strict confidence threshold (0.85+), full frequency band
- After lock: narrow band to ±20% of detected pitch, relaxed threshold (0.6)
- On silence: return to full-band acquisition mode
- Prevents harmonic jumps during sustain without slowing initial lock

### Priority 4: MPM as Supplementary Detector (lower priority, higher effort)

- Add MPM via TarsosDSP (Java) or aubio (C via JNI) as second detector
- Ensemble vote: if BACF and MPM agree within 1 semitone, trust BACF
  (faster, lower latency); if they disagree, fall through to tiebreaker
- Chromatic mode only (per-string band = BACF is sufficient for locked strings)
- Cost: ~2× compute on the analysis thread during chromatic mode

### Priority 5: Audio Capture (already good, minor tweaks)

- ✅ Already uses `UNPROCESSED` / `ma_aaudio_input_preset_unprocessed`
- ✅ Sample rate 48000 Hz, ring buffer 16384
- ✅ Permission flow, lifecycle-aware
- Minor: add `UNPROCESSED` support verification on Android
- Minor: add 100ms settle delay after `startRecording()` (Dart-side)

### Summary of Parameter Changes

```
pitch_analyzer.h:
- kMedianLength:       3  → 5
- kCentsEmaAlpha:      0.4 → 0.25
- kGateLevel:          0.003 → adaptive (learned from room profile)
- kGateReleasePerSecond: 20 → dynamic (adaptive gate)

- ADD kLockCents:      18
- ADD kLockMillis:     320
- ADD kRideMillis:     360
- ADD kRelockMillis:   1500
- ADD kProfileMillis:  900
- ADD kAdaptiveMarginDb: 12
```

---

## References

1. de Cheveigné, A., Kawahara, H. (2002). "YIN, a fundamental frequency
   estimator for speech and music." J. Acoust. Soc. Am. 111, 1917-1930.
2. McLeod, P., Wyvill, G. (2005). "A Smarter Way to Find Pitch."
   Proceedings of the International Computer Music Conference.
3. McLeod, P. (2008). "Fast, Accurate Pitch Detection Tools for Music
   Analysis." PhD Thesis, University of Otago.
4. Brossier, P. (2006). "Automatic Annotation of Musical Audio for
   Interactive Applications." PhD Thesis, Queen Mary University of London.
5. Von dem Knesebeck, A., Zölzer, U. (2010). "Comparison of Pitch Trackers
   for Real-Time Guitar Effects." DAFx-10.
6. TarsosDSP — Joren Six. https://0110.be/tags/TarsosDSP
7. aubio — Paul Brossier. https://aubio.org
8. cycfi/q — Joel de Guzman. https://github.com/cycfi/q
9. Android CDD §5.11 — Unprocessed Audio Source requirements.
10. Metro Gnome tuner engineering analysis. https://metrognome.co.za/blog/how-accurate-is-your-tuner-app.html
