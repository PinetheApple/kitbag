# UI survey: metronome and stem player screens

Researched 2026-10-29. Tags: **verified** (vendor doc/guide describes it), **vendor-claim** (store listing or marketing), **unverified** (could not confirm; do not rely on it). Play Store and several vendor pages were truncated or 404 to the fetch tool, so most per-app cells come from store listings and third-party summaries. Nothing here is from screenshots or hands-on use. A device pass of the top two or three apps is the missing step (see Open questions).

## 1. Metronome screen

| App | Tempo / tap | Meter, subdivision, accents | Poly / trainer / mute / count-in | Primary vs tucked | Source |
|---|---|---|---|---|---|
| Metronome Beats (Stonekick) | Wheel, slider, long-press numeric entry; tap-tempo area. **verified** | "Beats per bar" and "clicks per beat" numbers under the tempo; tap a beat light to cycle accented, normal, muted. After play, a swipe swaps these for %-of-tempo buttons. **verified** | Mode icons at the top switch Standard / Advanced / Drums / Polyrhythm. Trainer and timer icons flank Play, and count-in is addable from either screen. **verified** | Sound presets live in Preferences, not on the main screen. Presets, setlists and songs sit in bottom tabs on small devices. Volume or visual-only is one icon. **verified** | [guide](https://stonekick.com/metronome_guide.html) |
| Soundbrenner (app) | BPM display; changing the time signature does not change BPM. **verified** | Tap an accent marker to cycle Off / 1st / 2nd / 3rd, each with its own sound and visual. Subdivisions include triplets. **verified** | Practice sessions, history, streaks and calendar are documented. The manual does not mention polyrhythm, ramp or count-in. Listings claim count-in and a gradual-tempo feature under Plus. **vendor-claim** | Screen placement is not documented. **unverified** | [manual](https://www.soundbrenner.com/pages/manual-the-metronome-app), [compat](https://www.soundbrenner.com/compatibility) |
| Pro Metronome (EUM Lab) | Not established. | Dynamic accent levels f / mf / p / mute. **vendor-claim** | Rhythm Trainer mutes a selected bar; Practice Mode programs automatic tempo changes; playlists. Subdivisions, polyrhythm and trainer are separate in-app purchases on iOS. **vendor-claim** (iOS listings, Android page 404'd) | Placement **unverified** | [App Store](https://apps.apple.com/tr/app/id477960671), [Cafe Bazaar](https://cafebazaar.ir/app/com.eumlab.android.prometronome?l=en) |
| Tempo (Frozen Ape) | Not established. | Customizable accents, beats can be turned off. **vendor-claim** | Five iPhone modes: Basic, Preset, Setlist, Practice, Gig. Setlists can be driven from foot pedals. **vendor-claim** | The mode split is the clutter strategy. Layout otherwise **unverified** | [AirTurn](https://www.airturn.com/blogs/apps/tempo-metronome-with-setlists), [App Store](https://apps.apple.com/app/id304731501) |
| TonalEnergy | Not established. | Meters, subdivision patterns, restores last accents on launch. **vendor-claim** | Count-in implied by a release note; random beat silencing praised by a user; preset groups. It is primarily a tuner. **vendor-claim** | Layout **unverified** | [App Store](https://apps.apple.com/us/app/tonalenergy-tuner-metronome/id497716362), [review](https://www.notreble.com/?p=22991) |
| Google metronome | Sources conflict on slider vs +/- and on tap tempo; low-quality SEO pages only. | Conflicting on time signature. | None confirmed. | **unverified** | [AndroidAyuda](https://en.androidayuda.com/google-integrates-metronome-search-do-not-have-to-download-any-app/) |

Not covered: the Soundbrenner Pulse/Core companion layout (no doc found). Its Play listing truncated.

### Patterns that recur
- Beat dots double as the accent editor: tap to cycle states (Metronome Beats: 3 states; Soundbrenner: 4). **verified**
- Meter and subdivision are shown as plain numbers or markers next to the beats, not as a separate card with steppers. **verified** for Metronome Beats.
- Polyrhythm is a mode (a switch of the whole lower area), not a toggle beside the stepper. **verified** for Metronome Beats; Tempo's Basic/Gig split is the same idea. **vendor-claim**
- Trainer, timer and count-in are small icons flanking Play, each opening a sheet. **verified** for Metronome Beats.
- Sound choice is in settings, not on the main screen. **verified** for Metronome Beats.
- Presets and setlists are a tab or panel, not part of the transport. **verified** for Metronome Beats.

### What transfers to us (ranked)
1. Make the beat dots the meter and accent surface. Meter becomes a small tap target (opens a picker) beside the dots. Cut the card's meter stepper. (Metronome Beats, Soundbrenner)
2. Move subdivision to a single compact control that swaps with the dots or sits beside them. Do not give it a stepper and a separate card. (Metronome Beats)
3. Make poly a mode, not a big toggle. It replaces the dot area when active. (Metronome Beats)
4. Flank Play with Trainer and Timer icons. Ramp, Mute bars and Count-in become one "Practice" sheet. (Metronome Beats; Pro Metronome groups them as practice features)
5. Move sound (Beep) to a settings sheet. (Metronome Beats)
6. Setlist moves out of the transport into a tab or sheet, and the stopwatch is deleted. We already have a practice timer on top. (Metronome Beats)
7. Keep the top section as is. No surveyed app contradicts a big numeral plus tap row.

### What to avoid
- A chip row of equal-weight toggles. None of the verified apps does this; they use icons that open sheets.
- Duplicate timers.
- Putting rarely changed settings (sound) on the main screen.
- Gating or hiding the tempo trainer deep in menus. Metronome Beats puts it next to Play.

### Layout proposals (top to bottom)
**A. Metronome Beats style**
1. Practice timer (reset) | BPM numeral (swipe) | tempo bar | −10/−5/TAP/+5/+10 (unchanged)
2. Meter chip and subdivision chip on one line (each opens a picker)
3. Beat dots, large, tap to cycle accent/normal/mute; poly replaces this area when on
4. Transport: Trainer icon, Play, Timer/Count-in icon
5. Bottom tabs or a handle: Setlist, Presets. Sound in a gear sheet.

**B. Single Practice sheet**
1. Unchanged top section
2. Beat dots with meter chip at the left, subdivision chip at the right
3. Transport: Setlist, Play, Practice button
4. Practice sheet (bottom): Ramp, Mute bars, Count-in, Poly, Sound as rows

**C. Mode switch (Tempo-style)**
1. Unchanged top section
2. Segmented control: Standard | Poly | Practice
3. Mode body: dots and meter (Standard), poly editor (Poly), ramp/mute/count-in (Practice)
4. Transport: Play centred, Setlist on the left

## 2. Stem player screen

| App | Stem rows | Metadata (BPM / key / chords) | Scrubber, loop, speed/pitch | Source |
|---|---|---|---|---|
| Moises | Mute is a single tap on the instrument icon at left; volume per stem. Solo not confirmed. **verified** (mute), **unverified** (solo, row anatomy) | Chord Grid shows chords, lyrics and sections synced to bars and beats. Library sorts by BPM and key. No persistent BPM/key readout described. **verified** | Waveform player view; section looping; speed and pitch changers; Smart Metronome click stays synced when speed changes; count-in up to 16 clicks (4 free). **verified** (vendor page) | [blog](https://www.moises.ai/blog/latest/moises-features/), [changelog](https://moises.ai/blog/latest/improvements-latest-releases) |
| LALAL.AI | Per-stem fader, M and S (several solos allowed), one whole-mix waveform. Reset button at top. Player docks at the bottom. **verified** | Not covered. | Drag across the waveform to seek, with the time under the finger. Loop and speed not mentioned. **verified** | [LALAL blog](https://www.lalal.ai/blog/stem-mixer/amp/) |
| Soundboost Studio (reference, not on our list) | Rows with name, fader, S, M, pan. Master volume at the bottom right. **verified** | Header carries detected tempo (tap opens BPM adjust) and detected key (opens pitch shift). **verified** | Bars along the top; drag on the waveform to select a loop that snaps to beats; Start Loop and Reset in the transport. **verified** | [wiki](https://soundboost.ai/wiki/stem-splitter/the-studio) |
| Anytune | n/a | n/a | Tap A, then B; the markers jump to the playhead. Loop shift, half/double, loop once, and a step-up trainer (steps pitch or tempo across repeats). **vendor-claim** (App Store, older notes) | [App Store](https://apps.apple.com/us/app/-/id415365180) |
| OnSong mixer widget | A fader per stem, main fader at left, swipe to scroll. Per-track mute/solo not described. Phone layout not described. **verified** | n/a | Play and scrubber across the top. | [docs](https://apps.onsongapp.com/docs/features/widgets/mixer) |

Not verified: Fadr, StemRoller, Logic Remote and GarageBand mobile, Spotify now-playing, iReal, Transcribe. Searches returned nothing usable, and I won't characterise them.

### Patterns that recur
- Header or title area carries tempo and key as tappable controls that open adjustment (BPM to speed, key to pitch). **verified** (Soundboost)
- One master volume, at the end of the stem list. **verified** (Soundboost, OnSong)
- Per-stem row: name or icon, fader, M, S. LALAL and Soundboost expose a fader per row; our hidden fader is the exception. **verified**
- Loop is selected on the waveform or timeline, and a Reset restores everything. **verified** (Soundboost, LALAL reset)
- Seek is by dragging the waveform. **verified** (LALAL)

### What transfers to us (ranked)
1. Make the facts line tappable controls: BPM opens speed, key opens pitch. This puts the facts where they act, and speed/pitch get a home without new buttons. (Soundboost)
2. Fill the empty gap by letting the 6 stem rows grow to use the height. Keep the master volume as the last row, not a separate card. (Soundboost, OnSong)
3. Replace the Loop button with waveform-based loop selection, plus A/B markers on the scrubber. (Soundboost, Anytune)
4. One mix waveform on the scrubber, as LALAL does, instead of or in addition to small per-stem waveforms. (LALAL)
5. Single-tap mute on the stem icon. (Moises)
6. Add a Reset that restores mutes, levels, loop, speed and pitch. (LALAL, Soundboost)
7. Put Click and count-in into a settings sheet if the transport crowds. (Moises)

### What to avoid
- A fixed-height card stack that leaves a gap. Let the stem list flex.
- Another always-on control row for speed and pitch. Use the tappable facts line.
- Dense per-stem rows with pan. LALAL's pan is desktop only. **verified**

### Layout proposals (top to bottom)
**A. Soundboost-like**
1. Title; facts line as tappable chips (BPM, key, LUFS, steady)
2. Mix waveform with loop region and elapsed/total
3. Stem rows, 6, filling the remaining height: icon (tap = mute), name, level chip (tap expands fader), S
4. Master row
5. Transport: Loop, −10, play, +10, Click

**B. Waveform up front**
1. Title with facts chips
2. Large mix waveform (seek by drag, A/B handles)
3. Transport directly under it
4. Stem rows with a master row; no separate card

**C. Bottom dock**
1. Title with facts chips
2. Stem rows filling the height
3. Docked bottom: scrubber with times, then transport (the LALAL-style dock)
4. Reset and Click in an overflow sheet

## Open questions
- Layout of Soundbrenner, Pro Metronome, Tempo, TonalEnergy and Google's metronome is unconfirmed. Settle it with screenshots from each Play listing or hands-on use.
- Moises row anatomy and solo are unconfirmed. Settle it with a device pass.
- Fadr, StemRoller, Logic Remote, GarageBand, Spotify, iReal and Transcribe were not researched successfully. Anytune's A-B detail rests on older notes.
- Adjacent: Moises count-in limits (16 premium / 4 free) are plan-dependent and volatile.
