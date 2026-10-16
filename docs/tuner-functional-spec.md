# Tuner — functional specification

Status: design input for issue #117. Describes what Kitbag's tuner does — states,
timings, thresholds, presets and interface — as the design parameters Kitbag adopts.
The numbers are design choices, not measurements of Kitbag; the headless checks in §6
pin them on synthetic tones, and the device checks (T27–T29) are still to be run.
SPEC.md §10 remains the contract; where this document and SPEC.md disagree, SPEC.md wins.

## 1. Scope

The tuner reports against a list of open strings rather than only the nearest chromatic
note: which string is being tuned, how far off it is, whether a different string seems to
be playing, and how long the pitch has stayed in tune. Chromatic mode remains available.
The C ABI is `include/kitbag_tuner_api.h`, included by `kitbag_api.h`.

## 2. API surface

### 2.1 Operations

| Operation | Behaviour |
|-----------|-----------|
| `kb_tuner_start` / `kb_tuner_stop` | Begin / end consuming mic audio. |
| `kb_tuner_set_tuning` | Install the open-string note list (MIDI, low string first) and the instrument; selects auto mode. |
| `kb_tuner_set_target_string` | Manual mode on one string, or auto mode for `KB_TUNER_AUTO_STRING`. Changing mode clears smoothing history; the analysis range follows the tuning's lowest and highest string. |
| `kb_tuner_set_chromatic` | Chromatic mode (§3.1). |
| `kb_tuner_set_a4` | Reference pitch, default 440 Hz, clamped to 415–466 Hz. All string targets follow it (equal temperament). |
| `kb_tuner_reset_note_presence` | Clears note history; with a duration, listening is paused that long (rounded to whole analysis hops). |
| `kb_tuner_read_state` | Poll the latest state snapshot. |

### 2.2 State snapshot (`kb_tuner_state`)

| Field | Semantics |
|-------|-----------|
| `measurement_id` | Increments per analysis hop, so a poller can tell fresh readings from repeats. |
| `can_hear_note` | 1 while a pitched note is considered present, including the release hold. |
| `current_string` | Index of the string being tuned; `KB_TUNER_NO_STRING` when none is established. |
| `possible_wrong_string`, `wrong_string_direction` | The string that seems to be playing when it differs from the target, and which side of the target it lies (`KB_WRONG_STRING_BELOW` / `_ABOVE`). |
| `measured_hz`, `measured_midi` | Smoothed fundamental, in Hz and as fractional MIDI. |
| `target_midi` | The note the error is measured against; `KB_TUNER_NO_NOTE` with no note. |
| `tuning_error_cents` | Signed error against the target, 1200·log2(f/f_target). |
| `tuning_status` | `kb_tuning_status`: too low / in tune / too high / not measured (§4.2 P18). |
| `in_tune_threshold_cents` | The in-tune half-window in force (§4.2). |
| `in_tune_ratio` | 0…1 progress toward fully in tune (§4.3). |
| `mic_rms` | Recent maximum input RMS (3 s window). |
| `listening_paused` | 1 during a reset's pause. |
| `no_sound_issue` | 1 once nothing has been heard for 20 s (P19). |

Which strings have been tuned in a session, and "all strings tuned", are app-layer
state built on `in_tune_ratio`; the native core does not keep them.

## 3. Modes and presets

### 3.1 Modes

| Mode | Behaviour |
|------|-----------|
| Auto (default) | The string nearest the played pitch, within P11, is the target. |
| Manual | The user picks a string; the target is fixed; the wrong-string hint is active (§4.5). |
| Chromatic | The target is the nearest equal-tempered semitone of the measured pitch; no string is reported. Same display rules (§5). |

A display option may show true cents instead of the coarse step number (§5).

### 3.2 Instruments and tunings

The in-tune window depends on the instrument (§4.2 P12–P15): guitar, bass, ukulele, or
other. Guitar 6 standard is MIDI 40 45 50 55 59 64 (E2 A2 D3 G3 B3 E4). Common
alternatives — Drop D, DADGAD, open tunings, half- and whole-step down, 7-string guitar,
4- and 5-string bass, ukulele — and user-defined custom tunings are lists of MIDI notes.
Which presets ship is SPEC.md's call (§10.2).

## 4. Behaviour, state machine, parameters

### 4.1 State machine (auto mode)

```
Silent ──note onset──▶ Detecting ──string confidence > 0──▶ NotePresent(string s)
  ▲                                                             │ |err| ≤ thr(s) each hop
  │                                                             ▼
  │                                                     InTuneAccumulating (in_tune_ratio rises)
  │                                                             │ ratio ≥ 0.95
  │                                                             ▼
  │                                                     InTune → string s marked tuned (sticky)
  │                                                             │ note ends
  └──────── Release (hold while string confidence drains, ≤ 0.75 s) ◀─────────────────┘
```

* Leaving the in-tune window does not un-mark a tuned string; only starting over clears it.
* All strings tuned → an "all strings tuned" event for the app layer.

### 4.2 Parameter table

| # | Parameter | Value | Confidence |
|---|-----------|-------|------------|
| P1 | Analysis frame length | power of two nearest 90 ms → 4096 samples @ 48 kHz (85.3 ms) | H |
| P2 | Analysis hop | half a frame → 2048 @ 48 kHz (42.7 ms) | H |
| P3 | Mic-level window | 3 s | H |
| P5 | Default A4 | 440 Hz | H |
| P7 | Analysis note range (string modes) | 14 semitones below the lowest open string up to 7 semitones above the highest (guitar standard ≈ MIDI 26 … 71 / B4) | M |
| P8 | Pitch smoothing | a new estimate within 70 cents of the smoothed value is blended in (new weight 0.25, old 0.75); a larger jump replaces it | H |
| P9 | Hold value on release | median of the last 7 estimates | H |
| P10 | String-confidence counter | integer 0…17; +1 per hop the same string is heard, −2 per hop another string is, −1 per hop for any other pitch; the string is cleared at 0 | M |
| P11 | Auto string distance | a pitch more than 350 cents from its nearest string is "not one of the strings" | M |
| P12 | In-tune window, guitar | ±7 cents for MIDI > 42; ±12 cents for MIDI ≤ 42 (E2, F2, F♯2) | H |
| P13 | In-tune window, ukulele | ±14 cents for MIDI < 63, else ±10 | H |
| P14 | In-tune window, bass | ±12 for MIDI ≤ 30; ±10 for 31–40; ±7 for > 40 | H |
| P15 | In-tune window, other instruments | ±10 cents | M |
| P16 | Time to fully in tune | 0.74 s of consecutive in-window hops | H |
| P17 | In-tune ratio to declare tuned | ≥ 0.95 | H |
| P18 | Status classification | error rounded to whole cents; in tune within ±7, below → too low, above → too high | M |
| P19 | Silence issue | "no sound" raised after 20 s with no note | H |
| P20 | Manual wrong-string level gate | input RMS ≥ 0.0004 | H |
| P21 | Manual wrong-string stability | pitch stays within a 2-semitone band | M |
| P22 | Manual wrong-string distance | > 3.5 semitones from the selected string | M |
| P23 | Manual wrong-string dwell | > 1 s before the hint fires | M |
| P24 | Paired/duplicate strings | strings at the same pitch (12-string / mandolin courses) are one note, so a pair is never flagged wrong | M |
| P25 | Onset → first reading | target ≤ 0.5 s (one frame at the earliest) | M |
| P26 | Onset → string marked tuned (in-tune tone) | target 0.74–1.1 s | M |
| P27 | Release hold | after the tone stops, the string-confidence counter (P10) drains by 1 per hop; the reading stays until it reaches 0, so at most 17 hops (≈ 0.73 s at P2) and less after a short pluck, then clears | H |
| P28 | In-window check, mid strings | ±4 c → in tune; ±8 c → not | H |

Confidence: **H** — a fixed design value; **M** — a judgement that may move after device
testing.

### 4.3 In-tune ratio

Counts consecutive in-window hops, capped at the number of hops in 0.74 s (≈17 @ 42.7 ms);
ratio = count / cap. An out-of-window hop resets the count to zero.

### 4.4 String selection (auto)

The nearest string within P11 is the candidate, gated by the confidence counter (P10) so
a single stray frame does not switch strings. Octave input: a pitch above the analysis
range that is an exact octave multiple of an in-range period folds onto the nearest
string by pitch class (E5 659 Hz → E4 string, in tune). Chromatic and manual modes do not
fold; a pitch above their range is rejected.

### 4.5 Wrong-string detection

* **Auto:** a pitch more than 350 cents from every string selects no string (P11). A
  pitch within 350 c of a different string than the one held is hinted as
  `possible_wrong_string` while the held string's confidence drains.
* **Manual:** the hint ("are you tuning the correct string?") fires when P20–P23 hold, and
  reports whether the heard note lies below or above the target.

## 5. Display behaviour (UI layer)

Kitbag's UI follows `design/` (SPEC.md §12). The readout is true cents (docs/decisions.md,
2026-10-14). These parameters bind the needle and readout:

| # | Parameter | Value |
|---|-----------|-------|
| D1 | Needle mapping | linear in cents, no dead zone and no snap band: position = clamp(cents, ±220) / 220 × 0.8 of the half-width, so ±220 c sits at 80 % of the travel and 7 c moves it ≈ 2.5 % |
| D2 | Displayed cents | the engine's error, averaged 0.5/0.5 with the previous displayed value on each new hop |
| D3 | In-tune lock | the needle sits on the centre line while `in_tune_ratio` ≥ P17 |
| D4 | Return to centre | once `can_hear_note` = 0, the needle decays toward centre by × 0.8 per 1/60 s (time-based, so frame-rate independent: ≈ 225 ms to 95 %); note text clears with it |
| D5 | Status dwell | a status change reaches React state and the screen reader only after it is stable for 200 ms |

Colour reinforces position and text and never replaces them (SPEC.md §12.6).

## 6. Testable requirements

Harness assumptions: 48 kHz mono float input fed in hop-sized blocks; "tone(f, c)" =
fundamental f·2^(c/1200) with harmonics 2–5, each −6 dB from the previous, peak −6 dBFS;
time measured from the tone's first sample. Guitar 6 standard, A4 = 440 unless stated.
`[DEVICE]` = only checkable on a device with a real instrument and mic.

**Detection accuracy**
- **T1** tone(82.41, 0) → `current_string` = string 6 (E2), |`tuning_error_cents`| ≤ 1 within 600 ms.
- **T2** For each string s in {E2, A2, D3, G3, B3, E4}: tone(f_s, 0) → `current_string` = s, |error| ≤ 1 c within 600 ms.
- **T3** tone(329.63, +30) → error in [+29, +31] c, `tuning_status` too high within 600 ms; tone(329.63, −30) → [−31, −29], too low.
- **T4** `measured_hz` for tone(f, 0), f ∈ {82.41, 110, 146.83, 196, 246.94, 329.63} within ±0.1 % of f by 600 ms.
- **T5** `kb_tuner_set_a4(432)` then tone(329.63·432/440, 0) → E4 string, |error| ≤ 1 c.

**Timing**
- **T6** First non-empty state (`can_hear_note` = 1, string set) appears no earlier than one frame (85 ms) and no later than 500 ms after onset.
- **T7** Steady tone(329.63, 0): string marked tuned (`in_tune_ratio` ≥ 0.95) between 0.74 s and 1.1 s after onset.
- **T8** After a tuned tone that has reached full string confidence stops (digital silence), the held pitch stays reported for 0.6–0.85 s, then `can_hear_note` = 0. After a short tone (confidence below full), the hold is shorter than after a full-confidence tone.
- **T9** tone(329.63, +4) switching to tone(329.63, +12) mid-way resets `in_tune_ratio` to 0 within one hop.

**Thresholds**
- **T10** tone(329.63, ±6.5) reaches in tune; tone(329.63, ±7.5) never does within 3 s.
- **T11** tone(82.41, ±11.5) reaches in tune; tone(82.41, ±12.5) does not (low-string window ±12, MIDI ≤ 42).
- **T12** Ukulele: tone(261.63 (C4, MIDI 60), ±13.5) reaches in tune; tone(440 (A4, MIDI 69), ±10.5) does not.
- **T13** Bass 4 standard: tone(41.20 (E1), ±11.5) reaches in tune; tone(55 (A1, MIDI 33), ±10.5) does not; tone(98 (G2, MIDI 43), ±7.5) does not.

**Smoothing stability**
- **T14** Steady tone with ±3 c vibrato at 5 Hz: reported error std-dev ≤ 1 c after settling.
- **T15** Step tone(329.63, 0) → tone(329.63, +50) (≤ 70 c, blend path): reported error moves monotonically and reaches ≥ +45 c within 10 hops, but not within the first hop. Step tone(329.63, +100) (> 70 c, replacement path): reported error reaches +100 ± 2 c within 2 hops.
- **T16** A single 1-hop burst of tone(246.94, 0) inside a steady E4 tone does not change `current_string`.

**Silence, noise, range**
- **T17** Digital silence for 10 s → `can_hear_note` = 0 throughout, `current_string` none.
- **T18** White noise at −30 dBFS for 10 s → no string selected for longer than 1 hop at any time.
- **T19** tone(20, 0) and tone(12 000, 0) → no string selected (outside the analysis range).
- **T20** 20 s of silence raises `no_sound_issue`; 19 s does not.

**Octave and wrong string**
- **T21** tone(659.26, 0) (E5) → E4 string, |error| ≤ 1 c (octave fold, §4.4).
- **T22** tone(164.81, 0) (E3) — nearest string D3 (+200 c, inside P11's 350 c): `current_string` D3, error +200 c, status too high. tone(440, 0) (A4, 500 c above E4, its nearest string): no string reported within 3 s.
- **T23** Manual mode, target E4, tone(196, 0) (G3, 9 st below) at RMS ≥ 0.0004 for 1.2 s → `possible_wrong_string` = G3 and direction `KB_WRONG_STRING_BELOW`; the same tone for 0.8 s → no hint.
- **T24** Manual mode, target E4, tone(293.66, 0) (D4, 2 st below) for 3 s → no wrong-string hint (within 3.5 st).
- **T25** Manual mode, input RMS < 0.0004 → no wrong-string hint regardless of pitch.

**Reset**
- **T26** `kb_tuner_reset_note_presence(500)` during a steady tone → `listening_paused` = 1 and no new measurement for 500 ± 43 ms, then detection resumes.

**Device-only**
- **T27** [DEVICE] Real guitar, plucked low E2 within ±5 c of target → string marked tuned within 1.5 s of the pluck.
- **T28** [DEVICE] Plucked string decaying to silence: reading held then cleared per T8, without a spurious string switch during the decay.
- **T29** [DEVICE] Normal room noise (speech at 1 m) for 30 s with no instrument: no string marked tuned.

## 7. Open questions

| # | Question | Resolves via |
|---|----------|--------------|
| Q1 | Whether a real guitar's low strings (E2, and bass B0/E1) are picked up reliably through a phone mic at 4096-sample frames | T27 on a device (SPEC.md §10.3) |
| Q2 | Whether the level and clarity gates (`kMinRms`, `kMinClarity` in `tuning_rules.h`), set on synthetic tones, suit real rooms | T28, T29 on a device |
| Q3 | Whether P25–P27's timing targets feel right in use | Device testing (SPEC.md §10.2, hold time) |
