# #656 improvement ideas: verified list and plans

Status: plan, 2026-11-27. Nothing here is scheduled. Each item becomes its own issue, with
the acceptance criteria drafted below, when the owner picks it up. File references are
against `origin/main` at `6825f58c` (2026-11-27).

Inputs: #656 (the parked list), #657 and its owner decision of 2026-11-27, the research in
`docs/research/plugin-distribution-feasibility.md` (PR #658), SPEC.md §3, §9, §12 and §17,
and `docs/decisions.md`.

## How the list was checked

Every claim and file reference in #656 was read against `origin/main`, and every item was
searched for in open and closed issues. What changed:

- **Fixed, wrong as written.**
  - Folder import exists (`DocumentPicker.pickFolder`, `ACTION_OPEN_DOCUMENT_TREE`, used by
    `core-state/src/songLibrary/store.ts`). What is missing is picking several files in one
    trip (no `EXTRA_ALLOW_MULTIPLE`) and receiving files from other apps (the main
    manifest's only `VIEW` filter is the `kitbag://` scheme).
  - Android backup rules exist: `core-native`'s manifest sets `fullBackupContent` and
    `dataExtractionRules` (`res/xml/kitbag_backup_rules.xml`,
    `kitbag_data_extraction_rules.xml`). That part of "Safer backups" is dropped.
  - "Per-song tempo progress needs an analytics decision" is out of date. #286 already
    reversed the §3.3 deferral: sessions log stretches with song, end BPM and average BPM
    (`core-db/src/practice-log.ts`), and practice history has a graph
    (`app-shell/src/practice/HistoryGraph.tsx`). Per-song progress is now a view over data
    that exists.
  - Practice logging: the log format already has a stem-song shape (`LoggedStemSong`), but
    only the metronome produces sessions (`core-state/src/practice/store.ts` reads the
    metronome and setlist state). The item stands, and is cheaper than it looked.
- **Confirmed as written.** No audio focus or `ACTION_AUDIO_BECOMING_NOISY` handling
  anywhere in `packages/`; the song click chips are disabled without a grid
  (`SongClickChips.tsx`, `enabled={hasGrid}`); a custom tuning is deleted with no confirm
  (`TuningEditorSheet.tsx` `handleDelete`); setlist and song rows open their actions only
  on long-press (`SetlistsScreen.tsx`, `AllSongsScreen.tsx`, `SetlistDetailScreen.tsx`);
  only confirm and tick haptics exist (`core-native/src/haptics.ts`); `app/index.tsx`
  renders Home although SPEC §12.6 says first launch lands on a working metronome; the
  stem player's frame callback keeps running while paused (`useMixerFrame.ts`); the
  standalone metronome saves on every store change, so each swipe step writes a
  preference (`standalonePersistence.ts`, no debounce); adding a stem to the solo is
  long-press only (`StemRowView.tsx`); `SYSTEM_ALERT_WINDOW` is in the main (release)
  manifest; `app/gate.tsx` has no release guard; the Songs list renders every row in a
  `ScrollView` (`LibraryScreen.tsx`); backups carry no Rig settings, theme or Home layout
  (`CATEGORIES` and `PREFERENCE_KEYS` in `core-db/src/backup-format.ts`), and Replace takes
  no snapshot first (`core-state/src/backup/restore.ts`).
- **Folded in, decided but unbuilt.** `docs/decisions.md` records the Songs filter menu
  (2026-10-30, #178) as not built, and its 2026-11-20 entry (#549) says Add to setlist is
  built for stem songs only. Both gaps join "Library usability".
- **Duplicates.** None of the items is already an issue. Related open issues are listed as
  dependencies: #237, #328, #384, #653, #170, #286.
- **Removed from the issue:** every competitor or reference app name. The features are
  described instead.

No new items were added: the code and SPEC gaps found are already covered by the items
above or by open issues.

## Plugin shapes

From #657's recommended path and its owner decision ("lightweight" means a smaller
download, extensibility, and only installed tools on screen):

- **Core:** ships in the APK for everyone. Anything native (C++ in `native/audio_core`,
  Kotlin in `core-native`), any manifest entry (intent filter, widget, tile, service) and any
  permission. A downloaded bundle can add none of these.
- **Metronome feature:** the metronome stays in the core (#658 §3.1), so its features are
  core too.
- **Tool plugin:** a new tool package exporting a `ToolPlugin`. Compiled in and switchable
  in the Tools manager once #657 Phase 1 (registry-driven shell) lands; a signed Hermes pack
  that users download once Phase 3 lands. When it needs new engine code, that C++ ships in
  the core behind `kitbag_api.h` and the HostObject, and the plugin is the UI.
- **Tool feature:** a feature of a tool that becomes a plugin (Songs, Stem songs, Tuner, Play
  along). It ships inside that tool's pack.
- **Data pack:** schema-validated data, no code (#657 Phase 4a). First-party packs can ship
  bundled in the APK under the same schema before the community registry exists.
- **Shell:** Home, Settings, practice history, backups, routing.

Two constraints from #658 shape several plans:

1. Tables live in `core-db`, so a new tool that stores anything needs a core migration today.
   Recommendation for Phase 1: one generic, versioned per-tool document table, so tool
   plugins can store data without a core release (owner question Q3).
2. Permissions are fixed at install. Every item here uses permissions the app already
   declares (`RECORD_AUDIO`, `VIBRATE`, `CAMERA`, `POST_NOTIFICATIONS`), except the
   widget and tile, which are manifest components and so core.

## Effort basis

An agent-day is one lane working one day: about 4 to 6 merged PRs of median size with their
review rounds (#658 §4, from 200 PRs merged 2026-11-07 to 2026-11-26). The coordination
board shows the same pace: #650 (#621's tempo-ladder state and logic) went from open to
ready to merge in about half an hour of wall time, and #620's engine and store halves took
about a day of preparation plus two stacked PRs. Mockup approvals and phone checks come on top.

## Ranked list

Value is to a musician practising alone or gigging. Effort is agent-days.

| Rank | Item | Shape | Effort |
|---|---|---|---|
| 1 | Audio focus and headphone unplug | Core | 1–2 |
| 2 | Manual tempo grid when analysis fails | Tool feature (Songs, Stem songs) | 2–3 |
| 3 | Open with, Share to Kitbag, multi-file import | Core + shell | 2–3 |
| 4 | Drone and reference tone | Tool plugin + core C++ | 4–6 |
| 5 | Loop trainer in the song and stem players | Tool feature | 3–5 |
| 6 | Click trainers: random beat drop, gradual fade | Metronome feature, C++ | 2–3 |
| 7 | Practice recorder | Tool plugin + core C++ | 5–8 |
| 8 | Intonation trainer | Tool plugin | 3–4 |
| 9 | Drum groove machine | Core C++ + metronome feature + data packs | 8–12 |
| 10 | Undo for deletes, visible row menus | Shell + tool features | 1.5–2.5 |
| 11 | Swing and shuffle | Metronome feature, C++ | 2–3 |
| 12 | Click in one ear, track in the other | Core C++ + shell | 2–3 |
| 13 | Home-screen widget and Quick Settings tile | Core | 3–4 |
| 14 | Share setlists and presets by QR code or link | Shell | 2–3 |
| 15 | Spoken count | Metronome feature, C++ + data pack | 2–3 |
| 16 | Practice time from the song and stem players | Core state | 2–3 |
| 17 | Per-song tempo progress | Shell | 1–2 |
| 18 | Beat and reject haptics | Core | 1.5–2.5 |
| 19 | Library usability | Tool feature (Songs) | 3–4 |
| 20 | Safer backups | Core state + shell | 2–3 |
| 21 | Rhythm trainer game | Tool plugin | 4–6 |
| 22 | Functional ear trainer | Tool plugin | 3–5 |
| 23 | Import tempo maps | Tool feature + importer | 3–5 |
| 24 | Translations | Shell, then language data packs | 5–8 |
| 25 | First launch opens the metronome | Shell | 0.5 |
| 26 | Chord and scale reference, transposer, capo | Tool plugin | 3–4 |
| 27 | Chord-progression backing player | Tool plugin | 5–8 |
| 28 | Small fixes | Core + shell | 1–1.5 |
| 29 | Bluetooth foot pedal | Core | 2–3 |
| 30 | Shared click across phones (Link) | Core C++ | 4–6 |
| 31 | Full-screen visual flash | Metronome feature | 1 |
| 32 | Watch remote with a haptic beat | Separate app | 6–10 |

Items 1 to 3, 10, 18, 20, 25 and 28 need no plugin work and can start now. Every new tool
(4, 7, 8, 21, 22, 26, 27) should wait for #657 Phase 1 so it is born as a `ToolPlugin`
package (Q2).

## Plans

### P1 Audio focus and headphone unplug

- **Shape:** core (`core-native` Kotlin: `PlaybackService`, `OutputRouteWatcher`).
- **Plan:** request audio focus when a song or stem song starts; register for
  `ACTION_AUDIO_BECOMING_NOISY`; on noisy or a call, pause the player and mixer through the
  same path the transport Pause uses. The metronome does not request focus, so it keeps
  clicking over other apps (Play along needs this; D10's "the click runs over them").
- **Depends on:** #237 (single-song background playback) for the single-song half; #653 for
  Play along's notification.
- **Owner questions:**
  - Should the metronome pause on unplug? Recommendation: yes when standalone (a click
    jumping to the speaker on stage is the worst case), no while following Play along,
    where the other app decides.
  - Resume after a call? Recommendation: no auto-resume; the transport shows paused.
- **Draft acceptance criteria:**
  - [ ] Unplugging wired headphones or losing a Bluetooth sink pauses songs and stem songs before any audio reaches the speaker.
  - [ ] An incoming call pauses songs and stem songs; nothing resumes by itself.
  - [ ] The standalone metronome follows the owner's answer on unplug; it keeps clicking while another app plays media.
  - [ ] Kotlin unit tests cover the noisy and focus-loss routing; phone check with wired, Bluetooth and a call.

### P2 Manual tempo grid when analysis fails

- **Shape:** tool feature of Songs and Stem songs. No new C++: a constant grid is generated
  in TypeScript and stored in the existing beat-grid column, so the click, loops and lock
  work unchanged.
- **Plan:** on a song with no grid (failed or ungridded), offer "Set tempo": type a BPM or tap
  along, then mark bar 1 at the playhead. Store it with an analyser-version marker that says
  "manual", so re-analysis never overwrites it silently.
- **Depends on:** #384 (constant tempo or following the band, for stem songs).
- **Owner questions:** Should a manual grid also be offered on analysed songs whose grid is
  wrong? Recommendation: yes, behind the song's actions sheet, with Undo.
- **Draft acceptance criteria:**
  - [ ] A song with no grid offers a visible way to set a tempo and bar 1 (§12.6 "No dead ends").
  - [ ] After saving, the song click chips enable and the click lands on the set bar 1.
  - [ ] Re-analysis does not replace a manual grid without asking.
  - [ ] Unit tests for grid generation; emulator check of the flow.

### P3 Open with, Share to Kitbag, multi-file import

- **Shape:** core (manifest intent filters and `DocumentPicker`) plus shell routing. A plugin
  cannot add an intent filter, so the core receives every importable type and hands it to
  the installed tool; when that tool is off or not installed, the shell says which tool
  opens it.
- **Plan:** `SEND`, `SEND_MULTIPLE` and `VIEW` filters for audio, `.stemdeck.zip` and backup
  JSON; `EXTRA_ALLOW_MULTIPLE` in `pickDocument`; import queue reuses the existing
  background analysis.
- **Depends on:** #657 Phase 1 for the "tool not installed" path (until then every tool is
  compiled in).
- **Owner questions:** Should a shared backup file go straight to Restore? Recommendation:
  yes, into the existing review screen, never applied without it.
- **Draft acceptance criteria:**
  - [ ] Sharing one or several audio files from another app imports them into Songs with the usual `ANALYZING` rows.
  - [ ] Opening a `.stemdeck.zip` imports a stem song; opening a backup opens Restore's review.
  - [ ] The Songs picker accepts several files in one trip.
  - [ ] A file whose tool is switched off says which tool to turn on.

### P4 Drone and reference tone

- **Shape:** tool plugin (UI) plus core C++: a tone voice in the engine (sine plus a few
  harmonic timbres, root, fifth or chord), tuned from the same A4 as the tuner
  (`kb_tuner_set_a4`). Extra timbres can later come as data packs.
- **Plan:** `kb_tone_*` calls through the command ring, an offline `tone_verify` that
  asserts pitch within 0.1 cent and click-free start, stop and note change; then the tool
  screen.
- **Depends on:** #657 Phase 1 (tool package shape). Unblocks P8 and P22.
- **Owner questions:** Can the drone and the metronome sound together? Recommendation: yes,
  separate slots mixed in the one engine.
- **Draft acceptance criteria:**
  - [ ] `tone_verify` passes and fails when the frequency maths is sabotaged.
  - [ ] Root, fifth and major or minor chord over a chosen note, A4 shared with the tuner, fine-tune in cents.
  - [ ] Note changes and stops are click-free on a recording.
  - [ ] The tool appears on Home only when installed or switched on.

### P5 Loop trainer in the song and stem players

- **Shape:** tool feature of Songs and Stem songs; no new C++ (`kb_mixer_set_loop` and the
  #138 speed binding exist). Named loops need a table or the generic tool store (Q3).
- **Plan:** save named loops snapped to the analysed bars; "speed up every N repeats by X%
  until Y%"; optional count-in before each repeat.
- **Depends on:** #328 (speed and key controls), #138; P2 for gridless songs.
- **Owner questions:** Start slow and climb, or also step down on demand? Recommendation:
  climb only, with a manual step-back control.
- **Draft acceptance criteria:**
  - [ ] A loop can be named, saved per song, and reopened; its edges stay on bar lines.
  - [ ] Speed rises by the set step after every N repeats and stops at the target.
  - [ ] Count-in before a repeat, when on, uses the song's click settings.
  - [ ] Loops round-trip through backup.

### P6 Click trainers: random beat drop and gradual fade

- **Shape:** metronome feature with C++ in the sequencer: a seeded per-beat drop
  probability and a per-bar gain ramp, sample-accurate and allocation-free. Builds on mute
  bars.
- **Plan:** `kb_metronome_set_trainer` (mode, probability or fade length); `metronome_verify`
  cases for drop rate over many bars and the fade curve; preset and backup fields.
- **Depends on:** none.
- **Owner questions:** Should the downbeat ever drop? Recommendation: off by default, a
  switch to allow it.
- **Draft acceptance criteria:**
  - [ ] Over 1,000 bars the measured drop rate is within 2% of the setting.
  - [ ] Fade reaches silence over the set number of bars, then restores at the next cycle.
  - [ ] Settings live in presets and backups.
  - [ ] `metronome_verify` cases fail when the feature is sabotaged.

### P7 Practice recorder

- **Shape:** tool plugin plus core C++: capture to a file on the engine clock, so a take lines
  up with the click. `RECORD_AUDIO` is already declared.
- **Plan:** stream capture to disk in blocks (bounded memory), store the start frame; play the
  take back through the player with optional click; list takes per song.
- **Depends on:** #657 Phase 1; the tuner's capture path (SPEC §10.1).
- **Owner questions:** Where do takes live, and in what format? Recommendation: the data
  folder, as Opus or FLAC, excluded from JSON backups.
- **Draft acceptance criteria:**
  - [ ] A take recorded with the click plays back aligned to within 10 ms of the click, measured.
  - [ ] Memory stays flat during a 30-minute recording.
  - [ ] Takes can be renamed, shared and deleted (with Undo).

### P8 Intonation trainer

- **Shape:** tool plugin, JavaScript only, over P4's tone voice and the tuner's detector.
- **Plan:** play a drone, pick a target interval, hold it within ±15, then ±10, then ±5
  cents; score time in band.
- **Depends on:** P4; a check that capture and the tone can run together.
- **Owner questions:** Headphones required, since the speaker bleeds into the mic?
  Recommendation: yes, with a warning when the route is the speaker.
- **Draft acceptance criteria:**
  - [ ] The cents readout drives from a worklet, never React state (§13.3).
  - [ ] Bands tighten after a set hold time; the session shows time in band.

### P9 Drum groove machine

- **Shape:** core C++ (a step sequencer with several samples per step, on the metronome's
  clock), a metronome feature to pick a groove instead of the click, a grid editor as a
  tool plugin, and grooves and kits as data packs.
- **Plan:** engine first with `metronome_verify`-style checks; then groove choice in
  presets and setlists; then the editor; then the pack schema.
- **Depends on:** #657 Phase 4a for community packs (first-party packs can be bundled
  earlier).
- **Owner questions:** Groove inside the metronome, or a separate tool? Recommendation: the
  sound engine and choosing a groove belong to the metronome; the editor is a downloadable
  tool.
- **Draft acceptance criteria:**
  - [ ] A groove plays sample-accurately with tempo, ramps and count-in.
  - [ ] Grooves are stored in presets and setlists and round-trip through backup.
  - [ ] Ten or more first-party grooves ship as a data pack.

### P10 Undo for deletes, visible row menus

- **Shape:** shell and tool features; no plugin work.
- **Plan:** Snackbar Undo (the pattern `PracticeHistoryScreen` uses) for song, setlist,
  preset and custom-sound deletes; a confirm on deleting a custom tuning; a visible ⋮ on
  setlist, song and setlist-entry rows that opens the same actions as long-press.
- **Draft acceptance criteria:**
  - [ ] Each of the four deletes offers Undo and restores the row exactly.
  - [ ] Deleting a custom tuning asks first.
  - [ ] Every row action reachable by long-press is also reachable by a visible control (§12.6).

### P11 Swing and shuffle

- **Shape:** metronome feature with C++ in the sequencer (offbeat delay as a ratio).
- **Depends on:** none.
- **Owner questions:** Continuous ratio or presets? Recommendation: 50–75% with 58% and 67%
  marks.
- **Draft acceptance criteria:**
  - [ ] `metronome_verify` measures offbeat placement within one sample of the ratio, with no dropped beats at any tempo.
  - [ ] Swing is stored in presets and backups.

### P12 Click in one ear, track in the other

- **Shape:** core C++ (pan for the click and for the mixer bus) plus a Rig setting.
- **Plan:** stereo split first. Multi-output USB interfaces later, only if asked.
- **Owner questions:** Per output route, like latency? Recommendation: yes.
- **Draft acceptance criteria:**
  - [ ] With the split on, a recording shows the click only in the chosen channel and the song only in the other.
  - [ ] The setting follows the output route.

### P13 Home-screen widget and Quick Settings tile

- **Shape:** core (manifest components, Kotlin), starting the metronome through
  `PlaybackService`.
- **Owner questions:** Widget content? Recommendation: tempo, play or stop, and the last
  preset; the tile only starts or stops the click.
- **Draft acceptance criteria:**
  - [ ] The tile starts and stops the metronome with the app closed, with the notification shown.
  - [ ] The widget shows the live tempo and starts a chosen preset.

### P14 Share setlists and presets by QR code or link

- **Shape:** shell, on the existing export format, the `kitbag://` scheme and the QR
  scanner already in `core-native`.
- **Owner questions:** A setlist of many presets will not fit a QR code. Recommendation: QR
  for one preset or a short setlist, the system share sheet with the file otherwise.
- **Draft acceptance criteria:**
  - [ ] A preset or short setlist shared as a QR code imports on another phone through the conflict review.
  - [ ] Oversized content falls back to a file share, with a message.

### P15 Spoken count

- **Shape:** metronome feature with C++ (a per-beat sample table, so beat 3 can say "three")
  and a voice data pack.
- **Owner questions:** Whose voice and licence? Recommendation: record a first-party set
  under the app's licence.
- **Draft acceptance criteria:**
  - [ ] Counting follows beats per bar and subdivision ("1 e & a").
  - [ ] Voices are a pack; the metronome works when none is installed.

### P16 Practice time from the song and stem players

- **Shape:** core state (`core-state/src/practice`), using the existing `LoggedStemSong` shape.
- **Depends on:** #286.
- **Draft acceptance criteria:**
  - [ ] Playing a song or stem song logs a stretch with its title and tempo.
  - [ ] Sessions that mix the metronome and players show each song once in history.

### P17 Per-song tempo progress

- **Shape:** shell (practice history and the song's details), reading the existing log.
- **Depends on:** P16 for player songs.
- **Draft acceptance criteria:**
  - [ ] A song shows its last practised tempo and its highest, from the log.
  - [ ] Songs with no history show nothing rather than zero.

### P18 Beat and reject haptics

- **Shape:** core. The beat haptic must fire from native on the engine's beat, not from
  JavaScript (§13.3), thinning above about 160 BPM.
- **Depends on:** #170's haptics switch.
- **Draft acceptance criteria:**
  - [ ] A beat haptic option ticks on the beat with the JS thread starved.
  - [ ] A failed analysis plays the reject haptic; the system haptics setting is respected.

### P19 Library usability

- **Shape:** tool feature of Songs.
- **Plan:** the filter and sort menu decided on 2026-10-30; Add to setlist for single songs;
  duplicate detection on import (stem import has it); a virtualised list.
- **Draft acceptance criteria:**
  - [ ] Filter by analysis status, sort by title, date added or BPM.
  - [ ] A single song can be added to a setlist from its row.
  - [ ] Importing a file already in the library offers to skip or keep both.
  - [ ] 2,000 songs scroll without dropped frames on the phone.

### P20 Safer backups

- **Shape:** core state and shell (`core-db` backup format and restore).
- **Plan:** a Rig category (volume, accents, per-route latency), theme and Home layout; an
  automatic copy of current data before Replace.
- **Draft acceptance criteria:**
  - [ ] A backup restores volume, accents, per-route latency, theme and Home layout.
  - [ ] Replace keeps a restorable copy of the data it replaced.
  - [ ] Older backups still restore.

### P21 Rhythm trainer game

- **Shape:** tool plugin, JavaScript only. Taps are timed against the engine clock through
  the boottime-to-frame mapping #620 added. A good first downloadable pack.
- **Depends on:** #657 Phase 1; latency calibration for fair scoring.
- **Owner questions:** How game-like? Recommendation: rounds, lives and combo stay inside the
  tool; no streaks, reminders or notifications (§12.6 "never gamified nagging").
- **Draft acceptance criteria:**
  - [ ] Tap timing error is measured against the click, corrected for the route's latency.
  - [ ] Difficulty rises each round and can be set by hand.

### P22 Functional ear trainer

- **Shape:** tool plugin over P4's tone voice.
- **Depends on:** P4.
- **Draft acceptance criteria:**
  - [ ] In a chosen key, notes and chords play and the user names them by degree.
  - [ ] Results stay on the phone.

### P23 Import tempo maps

- **Shape:** tool feature with an importer in JavaScript: MIDI tempo maps and MusicXML into a
  song's grid or a preset, and song files exported from setlist apps into presets.
- **Owner questions:** Which formats first? Recommendation: standard MIDI files only, until
  someone asks for more.
- **Draft acceptance criteria:**
  - [ ] A MIDI file's tempo and meter changes become a grid that the click follows.

### P24 Translations

- **Shape:** shell first (string extraction across packages), then language data packs, so a
  tool pack carries its own strings.
- **Owner questions:** When? Recommendation: after #657 Phase 1, so strings move once.
- **Draft acceptance criteria:**
  - [ ] No user-facing string is hardcoded outside a catalogue; one second language ships.

### P25 First launch opens the metronome

- **Shape:** shell, one route change, or a SPEC edit.
- **Owner questions:** SPEC §12.6 or the code? Recommendation: first launch ever opens the
  metronome; later launches open Home with its Continue card.
- **Draft acceptance criteria:**
  - [ ] A fresh install opens on a playable metronome; later launches open Home.

### P26 Chord and scale reference, transposer, capo calculator

- **Shape:** tool plugin, JavaScript only, with P4 to audition chords.
- **Draft acceptance criteria:**
  - [ ] Chords and scales for any root; transposition with capo position.

### P27 Chord-progression backing player

- **Shape:** tool plugin over P9's sequencer and P4's tone voice.
- **Depends on:** P4, P9.

### P28 Small fixes

- **Shape:** core and shell, one PR each.
- **Plan:** stop `useMixerFrame`'s work while paused; debounce the standalone metronome save;
  a visible way to add a stem to the solo; remove `SYSTEM_ALERT_WINDOW` from the release
  manifest; keep `/gate` out of release builds.
- **Draft acceptance criteria:**
  - [ ] Each fix has a test that fails without it, where testable.

### P29 Bluetooth foot pedal

- **Shape:** core (key events in the activity) with mappable actions in Settings.
- **Owner questions:** Wait for a pedal to test with? Recommendation: yes.

### P30 Shared click across phones (Link)

- **Shape:** core C++ only; SPEC §3.3 lists it as out of scope.
- **Owner questions:** Reopen §3.3? Recommendation: only after a licence check against
  GPLv3 and a measured phase error between two phones.

### P31 Full-screen visual flash

- **Shape:** metronome feature, a worklet like the LED row. The owner skipped it on
  2026-07-07.
- **Owner questions:** Reconsider for loud stages and hard-of-hearing players?
  Recommendation: yes, as an off-by-default option; it costs about a day.

### P32 Watch remote with a haptic beat

- **Shape:** a separate watch app, not a plugin.
- **Owner questions:** Recommendation: not before a measured watch haptic latency.

## Top owner questions

1. **Q1 Where new practice features live.** Recommendation: drone, recorder, intonation,
   rhythm and ear trainers, chord reference and the groove editor are downloadable tools;
   click trainers, swing, spoken count and choosing a groove stay in the metronome.
2. **Q2 Build new tools before or after #657 Phase 1?** Recommendation: after, so each is
   born as a `ToolPlugin` package; core fixes (P1–P3, P10, P18, P20, P25, P28) start now.
3. **Q3 Tool storage.** Recommendation: a generic per-tool document table in `core-db`
   during Phase 1, so tool plugins need no core migration.
4. **Q4 Metronome on headphone unplug.** Recommendation: pause when standalone, keep
   following while in Play along; songs and stems always pause.
5. **Q5 First launch.** Recommendation: the first launch ever opens the metronome, later
   launches open Home; amend SPEC §12.6 to say so.
6. **Q6 Groove machine placement.** Recommendation: engine and groove choice in the
   metronome, the editor as a tool, grooves as data packs.
