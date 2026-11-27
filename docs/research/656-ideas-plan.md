# #656 improvement ideas: verified list and plans

Status: plan, 2026-11-27, updated the same day with the owner's answers (see "Owner
answers"). Each item becomes its own issue, with the acceptance criteria drafted below,
when the owner picks it up; items marked done already shipped. File references in "How the
list was checked" are against `origin/main` at `6825f58c` (2026-11-27), before the work
marked done landed.

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
  renders Home although SPEC §12.6 said first launch lands on a working metronome (the owner
  chose to change the SPEC, see P25); the
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

Owner answer (a): every new feature from #656 ships as a downloadable tool, metronome extras
included. #657's path (owner decision 2026-11-27: "lightweight" means a smaller download,
extensibility, and only installed tools on screen) has its steps 1 to 3 done and step 4,
signed downloadable first-party tools, approved with the experience mockup first (#658).

Two shapes remain:

- **Core:** ships in the APK for everyone. Only true core fixes qualify: audio focus (done,
  #699), import (done, #702 and #703), the small fixes (done), the manual tempo grid
  (approved, being built as core), undo and visible row menus, and safer backups (both fix
  gaps in existing core behaviour). Anything else that needs native code, a manifest entry or
  a permission still has a core part, see the next shape.
- **Downloadable tool:** a tool package exporting a `ToolPlugin`, installed and switched on in
  the Tools manager; a signed Hermes pack once step 4 lands, compiled in until then. A tool
  can extend another tool (the metronome, Songs, Stem songs) through contributions that the
  host registers, and its screens and controls show only while it is installed and on.
  Three things cannot be downloaded and so stay in the APK as an inert stub that the tool
  switches on: C++ in `native/audio_core` behind `kitbag_api.h` and the HostObject, Kotlin
  services in `core-native`, and manifest entries (intent filters, widget, tile, permissions).
  Android reads manifests only at install, so a stub is the only way. The tool owns the UI,
  the settings and the logic.
- **Data pack:** schema-validated data, no code (#657 Phase 4a). First-party packs can ship
  bundled in the APK under the same schema before the community registry exists.
- **Tool feature:** a feature of a tool that is already downloadable (Songs, Stem songs,
  Tuner, Play along). It ships inside that tool's pack.

The F-Droid build compiles every tool in and downloads nothing by default (#658, "F-Droid
findings"), so "downloadable" means the GitHub and Obtainium build.

Two constraints from #658 shape several plans:

1. Tables live in `core-db`, so a new tool that stores anything needs a core migration today.
   Recommendation for Phase 1: one generic, versioned per-tool document table, so tool
   plugins can store data without a core release (owner question Q3).
2. Permissions are fixed at install. Every item here uses permissions the app already
   declares (`RECORD_AUDIO`, `VIBRATE`, `CAMERA`, `POST_NOTIFICATIONS`), except the
   widget and tile, which are manifest components in the stub.

## Effort basis

An agent-day is one lane working one day: about 4 to 6 merged PRs of median size with their
review rounds (#658 §4, from 200 PRs merged 2026-11-07 to 2026-11-26). The coordination
board shows the same pace: #650 (#621's tempo-ladder state and logic) went from open to
ready to merge in about half an hour of wall time, and #620's engine and store halves took
about a day of preparation plus two stacked PRs. Mockup approvals and phone checks come on top.

## Ranked list

Value is to a musician practising alone or gigging. Effort is agent-days. Done items link to
their PRs.

| Rank | Item | Shape | Effort | State |
|---|---|---|---|---|
| 1 | Audio focus and headphone unplug | Core fix | 1–2 | Done, #699 (#691) |
| 2 | Manual tempo grid when analysis fails | Core, approved | 2–3 | Being built (#715) |
| 3 | Open with, Share to Kitbag, multi-file import | Core | 2–3 | Multi-file import done, #702 (#693); open and share in #703 (#694), open at the time of writing |
| 4 | Drone and reference tone | Downloadable tool (+ C++ tone voice in core) | 4–6 | Not started |
| 5 | Loop trainer in the song and stem players | Tool feature of Songs and Stem songs | 3–5 | Not started |
| 6 | Click trainers: random beat drop, gradual fade | Downloadable tool "Metronome extras" (+ C++ in core) | 2–3 | Not started |
| 7 | Practice recorder | Downloadable tool (+ C++ capture in core) | 5–8 | Not started |
| 8 | Intonation trainer | Downloadable tool | 3–4 | Not started |
| 9 | Drum groove machine | Downloadable tool (+ C++ engine in core) + data packs | 8–12 | Not started |
| 10 | Undo for deletes, visible row menus | Core fix (shell + existing tools) | 1.5–2.5 | Not started |
| 11 | Swing and shuffle | Downloadable tool "Metronome extras" (+ C++ in core) | 2–3 | Not started |
| 12 | Click in one ear, track in the other | Downloadable tool "Channel split" (+ C++ pan in core) | 2–3 | Not started |
| 13 | Home-screen widget and Quick Settings tile | Downloadable tool (+ manifest stub in core) | 3–4 | Not started |
| 14 | Share setlists and presets by QR code or link | Downloadable tool | 2–3 | Not started |
| 15 | Spoken count | Downloadable tool "Metronome extras" (+ C++ in core) + voice data pack | 2–3 | Not started |
| 16 | Practice time from the song and stem players | Tool feature of Songs and Stem songs | 2–3 | Not started |
| 17 | Per-song tempo progress | Tool feature of Songs | 1–2 | Not started |
| 18 | Beat and reject haptics | Beat haptic in "Metronome extras" (native firing in core); reject haptic in the Songs tool | 1.5–2.5 | Not started |
| 19 | Library usability | Tool feature of Songs | 3–4 | Not started |
| 20 | Safer backups | Core fix (core state + shell) | 2–3 | Not started |
| 21 | Rhythm trainer game | Downloadable tool | 4–6 | Not started |
| 22 | Functional ear trainer | Downloadable tool | 3–5 | Not started |
| 23 | Import tempo maps | Tool feature of Songs | 3–5 | Not started |
| 24 | Translations | Core string extraction, then language data packs | 5–8 | Not started |
| 25 | First launch opens the metronome | SPEC change: first launch opens Home | 0 | Done, SPEC §12.6 amended in the PR that carries this plan |
| 26 | Chord and scale reference, transposer, capo | Downloadable tool | 3–4 | Not started |
| 27 | Chord-progression backing player | Downloadable tool | 5–8 | Not started |
| 28 | Small fixes | Core | 1–1.5 | Four of five done: #709, #710, #711, #712; the visible way to add a stem to the solo remains |
| 29 | Bluetooth foot pedal | Downloadable tool (+ key-event stub in core) | 2–3 | Not started |
| 30 | Shared click across phones (Link) | Downloadable tool (+ C++ in core) | 4–6 | Not started |
| 31 | Full-screen visual flash | Downloadable tool "Metronome extras" | 1 | Not started |
| 32 | Watch remote with a haptic beat | Separate app | 6–10 | Not started |

"Metronome extras" is one proposed tool that adds click trainers, swing, spoken count, beat
haptics and the visual flash to the metronome screen through contributions, so users get one
switch instead of five. Whether it is one tool or several is a mockup question for step 4.

The tools (4, 6, 7, 8, 9, 11 to 15, 18, 21, 22, 26, 27, 29 to 31) need the host to accept tool
contributions, which is the rest of #657 step 2, and each is born as a `ToolPlugin` package.
Their C++ and manifest stubs ship in the core first and are inert until the tool is on.

## Plans

### P1 Audio focus and headphone unplug

- **State:** done in #699 (#691). Owner answer (d): the unplug behaviour stays as built.
  Songs and stem songs pause on output loss, a call or focus loss; the standalone metronome
  pauses on unplug or a call; the Play along click keeps running; nothing resumes by itself.
  The phone checks listed in #699 are still open.
- **Shape:** core (`core-native` Kotlin: `PlaybackService`).
- **Plan:** request audio focus when a song or stem song starts; register for
  `ACTION_AUDIO_BECOMING_NOISY`; on noisy or a call, pause the player and mixer through the
  same path the transport Pause uses. The metronome does not request focus, so it keeps
  clicking over other apps (Play along needs this; D10's "the click runs over them").
- **Depends on:** #237 (single-song background playback) for the single-song half; #653 for
  Play along's notification.
- **Acceptance criteria (from #691):**
  - [x] Routing of noisy, call and focus-loss events to each player is unit-tested and fails without the change.
  - [ ] Unplugging wired headphones or losing a Bluetooth sink pauses songs and stem songs, and a lone metronome; Play along keeps clicking (phone).
  - [ ] An incoming call pauses songs and stem songs; nothing resumes by itself (phone).

### P2 Manual tempo grid when analysis fails

- **State:** approved by the owner as core, being built (#715).
- **Shape:** core (Songs and Stem songs are in the first set of tools, but this closes a
  dead end that §12.6 forbids, so it ships with the core). No new C++: a constant grid is
  generated in TypeScript and stored in the existing beat-grid column, so the click, loops
  and lock work unchanged.
- **Plan:** on a song with no grid (failed or ungridded), offer "Set tempo": type a BPM or tap
  along, then mark bar 1 at the playhead. Store it with an analyser-version marker that says
  "manual", so re-analysis never overwrites it silently.
- **Depends on:** #384 (constant tempo or following the band, for stem songs).
- **Owner question (open):** Should a manual grid also be offered on analysed songs whose
  grid is wrong? Recommendation: yes, behind the song's actions sheet, with Undo.
- **Draft acceptance criteria:**
  - [ ] A song with no grid offers a visible way to set a tempo and bar 1 (§12.6 "No dead ends").
  - [ ] After saving, the song click chips enable and the click lands on the set bar 1.
  - [ ] Re-analysis does not replace a manual grid without asking.
  - [ ] Unit tests for grid generation; emulator check of the flow.

### P3 Open with, Share to Kitbag, multi-file import

- **State:** multi-file import done in #702 (#693). Open with and Share (#694) is in #703,
  which was still open when this was written; an unreadable shared file is #714.
- **Shape:** core (manifest intent filters and `DocumentPicker`) plus shell routing. A plugin
  cannot add an intent filter, so the core receives every importable type and hands it to
  the installed tool; when that tool is off or not installed, the shell says which tool
  opens it.
- **Plan:** `SEND`, `SEND_MULTIPLE` and `VIEW` filters for audio, `.stemdeck.zip` and backup
  JSON; `EXTRA_ALLOW_MULTIPLE` in `pickDocument`; import queue reuses the existing
  background analysis.
- **Depends on:** #657 Phase 1 for the "tool not installed" path (until then every tool is
  compiled in).
- **Owner question (open):** Should a shared backup file go straight to Restore?
  Recommendation: yes, into the existing review screen, never applied without it.
- **Draft acceptance criteria:**
  - [ ] Sharing one or several audio files from another app imports them into Songs with the usual `ANALYZING` rows.
  - [ ] Opening a `.stemdeck.zip` imports a stem song; opening a backup opens Restore's review.
  - [ ] The Songs picker accepts several files in one trip.
  - [ ] A file whose tool is switched off says which tool to turn on.

### P4 Drone and reference tone

- **Shape:** downloadable tool (UI) plus core C++ stub: a tone voice in the engine (sine plus a few
  harmonic timbres, root, fifth or chord), tuned from the same A4 as the tuner
  (`kb_tuner_set_a4`). Extra timbres can later come as data packs.
- **Plan:** `kb_tone_*` calls through the command ring, an offline `tone_verify` that
  asserts pitch within 0.1 cent and click-free start, stop and note change; then the tool
  screen.
- **Depends on:** #657 step 2 (tool package shape and contributions). Unblocks P8 and P22.
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

- **Shape:** downloadable tool "Metronome extras". Its controls attach to the metronome screen
  through a contribution. The C++ stays in the core as an inert stub: a seeded per-beat drop
  probability and a per-bar gain ramp in the sequencer, sample-accurate and allocation-free.
  Builds on mute bars. With the tool off, the metronome behaves as today.
- **Plan:** `kb_metronome_set_trainer` (mode, probability or fade length); `metronome_verify`
  cases for drop rate over many bars and the fade curve; preset and backup fields.
- **Depends on:** none.
- **Owner question (open):** Should the downbeat ever drop? Recommendation: off by default, a
  switch to allow it.
- **Draft acceptance criteria:**
  - [ ] Over 1,000 bars the measured drop rate is within 2% of the setting.
  - [ ] Fade reaches silence over the set number of bars, then restores at the next cycle.
  - [ ] Settings live in presets and backups.
  - [ ] `metronome_verify` cases fail when the feature is sabotaged.

### P7 Practice recorder

- **Shape:** downloadable tool plus core C++ stub: capture to a file on the engine clock, so a take lines
  up with the click. `RECORD_AUDIO` is already declared.
- **Plan:** stream capture to disk in blocks (bounded memory), store the start frame; play the
  take back through the player with optional click; list takes per song.
- **Depends on:** #657 step 2; the tuner's capture path (SPEC §10.1).
- **Owner questions:** Where do takes live, and in what format? Recommendation: the data
  folder, as Opus or FLAC, excluded from JSON backups.
- **Draft acceptance criteria:**
  - [ ] A take recorded with the click plays back aligned to within 10 ms of the click, measured.
  - [ ] Memory stays flat during a 30-minute recording.
  - [ ] Takes can be renamed, shared and deleted (with Undo).

### P8 Intonation trainer

- **Shape:** downloadable tool, JavaScript only, over P4's tone voice and the tuner's detector.
- **Plan:** play a drone, pick a target interval, hold it within ±15, then ±10, then ±5
  cents; score time in band.
- **Depends on:** P4; a check that capture and the tone can run together.
- **Owner questions:** Headphones required, since the speaker bleeds into the mic?
  Recommendation: yes, with a warning when the route is the speaker.
- **Draft acceptance criteria:**
  - [ ] The cents readout drives from a worklet, never React state (§13.3).
  - [ ] Bands tighten after a set hold time; the session shows time in band.

### P9 Drum groove machine

- **Shape:** owner answer (a) puts the whole feature in a downloadable tool "Groove machine":
  choosing a groove instead of the click, the grid editor and the preset and setlist fields.
  The core carries only the C++ step sequencer (several samples per step, on the metronome's
  clock) as an inert stub. Grooves and kits are data packs.
- **Plan:** engine first with `metronome_verify`-style checks; then groove choice in
  presets and setlists through the tool's contribution to the metronome; then the editor;
  then the pack schema.
- **Depends on:** #657 step 2 for contributions; Phase 4a for community packs (first-party
  packs can be bundled earlier). Preset and setlist fields written by the tool must survive
  its removal (a preset keeps its groove id and falls back to the click).
- **Draft acceptance criteria:**
  - [ ] A groove plays sample-accurately with tempo, ramps and count-in.
  - [ ] Grooves are stored in presets and setlists and round-trip through backup.
  - [ ] Ten or more first-party grooves ship as a data pack.

### P10 Undo for deletes, visible row menus

- **Shape:** core fix, in the shell and in the existing tools' own code; no new feature.
- **Plan:** Snackbar Undo (the pattern `PracticeHistoryScreen` uses) for song, setlist,
  preset and custom-sound deletes; a confirm on deleting a custom tuning; a visible ⋮ on
  setlist, song and setlist-entry rows that opens the same actions as long-press.
- **Draft acceptance criteria:**
  - [ ] Each of the four deletes offers Undo and restores the row exactly.
  - [ ] Deleting a custom tuning asks first.
  - [ ] Every row action reachable by long-press is also reachable by a visible control (§12.6).

### P11 Swing and shuffle

- **Shape:** downloadable tool "Metronome extras", with the C++ (offbeat delay as a ratio) as an
  inert stub in the sequencer.
- **Depends on:** none.
- **Owner question (open):** Continuous ratio or presets? Recommendation: 50–75% with 58% and
  67% marks.
- **Draft acceptance criteria:**
  - [ ] `metronome_verify` measures offbeat placement within one sample of the ratio, with no dropped beats at any tempo.
  - [ ] Swing is stored in presets and backups.

### P12 Click in one ear, track in the other

- **Shape:** downloadable tool "Channel split" with the Rig setting in its screen; core C++ stub
  (pan for the click and for the mixer bus).
- **Plan:** stereo split first. Multi-output USB interfaces later, only if asked.
- **Owner question (open):** Per output route, like latency? Recommendation: yes.
- **Draft acceptance criteria:**
  - [ ] With the split on, a recording shows the click only in the chosen channel and the song only in the other.
  - [ ] The setting follows the output route.

### P13 Home-screen widget and Quick Settings tile

- **Shape:** downloadable tool for the settings and the preset choice. The manifest components
  and Kotlin (widget provider, tile service) ship in the APK as an inert stub, since Android
  reads manifests only at install; they start the metronome through `PlaybackService` and
  do nothing while the tool is off or not installed.
- **Owner question (open):** Widget content? Recommendation: tempo, play or stop, and the last
  preset; the tile only starts or stops the click.
- **Draft acceptance criteria:**
  - [ ] The tile starts and stops the metronome with the app closed, with the notification shown.
  - [ ] The widget shows the live tempo and starts a chosen preset.

### P14 Share setlists and presets by QR code or link

- **Shape:** downloadable tool, on the existing export format, the `kitbag://` scheme and the QR
  scanner already in `core-native`.
- **Owner question (open):** A setlist of many presets will not fit a QR code. Recommendation: QR
  for one preset or a short setlist, the system share sheet with the file otherwise.
- **Draft acceptance criteria:**
  - [ ] A preset or short setlist shared as a QR code imports on another phone through the conflict review.
  - [ ] Oversized content falls back to a file share, with a message.

### P15 Spoken count

- **Shape:** downloadable tool "Metronome extras", with C++ in the core as an inert stub (a
  per-beat sample table, so beat 3 can say "three") and a voice data pack.
- **Owner question (open):** Whose voice and licence? Recommendation: record a first-party set
  under the app's licence.
- **Draft acceptance criteria:**
  - [ ] Counting follows beats per bar and subdivision ("1 e & a").
  - [ ] Voices are a pack; the metronome works when none is installed.

### P16 Practice time from the song and stem players

- **Shape:** tool feature of Songs and Stem songs: each tool reports its stretches to the
  practice log (`core-state/src/practice`) through the existing `LoggedStemSong` shape. The log
  format and history stay in the shell.
- **Depends on:** #286.
- **Draft acceptance criteria:**
  - [ ] Playing a song or stem song logs a stretch with its title and tempo.
  - [ ] Sessions that mix the metronome and players show each song once in history.

### P17 Per-song tempo progress

- **Shape:** tool feature of Songs, reading the existing log in the song's details.
- **Depends on:** P16 for player songs.
- **Draft acceptance criteria:**
  - [ ] A song shows its last practised tempo and its highest, from the log.
  - [ ] Songs with no history show nothing rather than zero.

### P18 Beat and reject haptics

- **Shape:** the beat haptic is part of the downloadable tool "Metronome extras"; the native
  firing path (on the engine's beat, never from JavaScript, §13.3, thinning above about 160
  BPM) ships in the core as an inert stub. The reject haptic on failed analysis is a feature of
  the Songs tool.
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

- **Shape:** core fix (`core-db` backup format and restore): it closes gaps in an existing core
  feature. Each tool's data stays in its own category, so a tool's removal never drops it
  from a backup.
- **Owner answer (e):** the GetSongBPM key (#689) may ride in Android's Google backup, as the
  other app preferences do. It stays out of the JSON export unless the owner says otherwise.
- **Plan:** a Rig category (volume, accents, per-route latency), theme and Home layout; an
  automatic copy of current data before Replace.
- **Draft acceptance criteria:**
  - [ ] A backup restores volume, accents, per-route latency, theme and Home layout.
  - [ ] Replace keeps a restorable copy of the data it replaced.
  - [ ] Older backups still restore.

### P21 Rhythm trainer game

- **Shape:** downloadable tool, JavaScript only. Taps are timed against the engine clock through
  the boottime-to-frame mapping #620 added. A good first downloadable pack.
- **Depends on:** #657 step 2; latency calibration for fair scoring.
- **Owner question (open):** How game-like? Recommendation: rounds, lives and combo stay inside the
  tool; no streaks, reminders or notifications (§12.6 "never gamified nagging").
- **Draft acceptance criteria:**
  - [ ] Tap timing error is measured against the click, corrected for the route's latency.
  - [ ] Difficulty rises each round and can be set by hand.

### P22 Functional ear trainer

- **Shape:** downloadable tool over P4's tone voice.
- **Depends on:** P4.
- **Draft acceptance criteria:**
  - [ ] In a chosen key, notes and chords play and the user names them by degree.
  - [ ] Results stay on the phone.

### P23 Import tempo maps

- **Shape:** tool feature of Songs, with an importer in JavaScript: MIDI tempo maps and MusicXML into a
  song's grid or a preset, and song files exported from setlist apps into presets.
- **Owner question (open):** Which formats first? Recommendation: standard MIDI files only, until
  someone asks for more.
- **Draft acceptance criteria:**
  - [ ] A MIDI file's tempo and meter changes become a grid that the click follows.

### P24 Translations

- **Shape:** core string extraction across packages first, then language data packs, so a
  tool pack carries its own strings.
- **Owner question (open):** When? Recommendation: after #657 step 2, so strings move once.
- **Draft acceptance criteria:**
  - [ ] No user-facing string is hardcoded outside a catalogue; one second language ships.

### P25 First launch opens the metronome

- **State:** decided and done. Owner answer (c): the app always opens on Home on launch, so
  SPEC.md §12.6 changes to match the code. The "Sound in 5 seconds" rule now says first
  launch opens Home, whose Continue card and Metronome tile reach a working metronome in one
  tap. No code change.

### P26 Chord and scale reference, transposer, capo calculator

- **Shape:** downloadable tool, JavaScript only, with P4 to audition chords.
- **Draft acceptance criteria:**
  - [ ] Chords and scales for any root; transposition with capo position.

### P27 Chord-progression backing player

- **Shape:** downloadable tool over P9's sequencer and P4's tone voice.
- **Depends on:** P4, P9.

### P28 Small fixes

- **Shape:** core and shell, one PR each.
- **State:** four of five done. Stem player stops per-frame work while paused: #711 (#706).
  Standalone metronome saves once per tempo swipe: #712 (#707). `SYSTEM_ALERT_WINDOW` out of
  release builds: #709 (#704). `/gate` out of release builds: #710 (#705). Remaining: a visible
  way to add a stem to the solo.
- **Draft acceptance criteria:**
  - [ ] Each fix has a test that fails without it, where testable.

### P29 Bluetooth foot pedal

- **Shape:** downloadable tool with the mappable actions in its own screen; the key-event
  handling in the activity ships in the core as an inert stub.
- **Owner question (open):** Wait for a pedal to test with? Recommendation: yes.

### P30 Shared click across phones (Link)

- **Shape:** downloadable tool "Shared click"; the C++ ships in the core as an inert stub. SPEC
  §3.3 lists it as out of scope.
- **Owner question (open):** Reopen §3.3? Recommendation: only after a licence check against
  GPLv3 and a measured phase error between two phones.

### P31 Full-screen visual flash

- **Shape:** downloadable tool "Metronome extras", a worklet like the LED row. The owner skipped
  it on 2026-07-07.
- **Owner question (open):** Reconsider for loud stages and hard-of-hearing players?
  Recommendation: yes, as an off-by-default option; it costs about a day.

### P32 Watch remote with a haptic beat

- **Shape:** a separate watch app, not a plugin.
- **Owner question (open):** Recommendation: not before a measured watch haptic latency.

## Owner answers (2026-11-27)

Recorded from the owner; these replace the questions Q1, Q4, Q5 and Q6 that were here.

- **(a) Where new features live (Q1, Q6).** Every new feature from #656 ships as a downloadable
  tool, metronome extras included. Only true core fixes stay in the core: audio focus (done,
  #699), import (done, #702 and #703), the small fixes (done) and the manual tempo grid
  (approved, being built as core). The groove machine is one tool.
- **(b) Downloadable first-party tools.** Approved as #657 step 4, with the experience mockup
  first (#658).
- **(c) First launch (Q5).** The app always opens on Home. SPEC.md §12.6 is amended in this PR.
- **(d) Headphone unplug (Q4).** Stays as built in #699: songs and stems pause, the standalone
  metronome pauses, the Play along click keeps running, nothing resumes by itself.
- **(e) GetSongBPM key.** May ride in Android's Google backup (P20).

## Open owner questions

1. **Q2 Build new tools before or after the rest of #657 step 2?** Steps 1 to 3 are done, but
   tool contributions (how a tool adds controls to the metronome or Songs) are not.
   Recommendation: build them first, so each new tool is born as a `ToolPlugin` package.
2. **Q3 Tool storage.** Recommendation: a generic per-tool document table in `core-db`, so
   tool plugins need no core migration.
3. The per-item owner questions above, each marked "(open)".
