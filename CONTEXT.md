# Kitbag

## Language

Ubiquitous language for the domain. Terms mean exactly this — in code, specs and
conversation. `SPEC.md` is the authority; this file is the glossary.

**Song preset** (`SongPresets`):
Everything the metronome knows about a song — tempo, time signature, subdivision,
accents, polyrhythm, sound, count-in, ramp, bar-mute, notes. Exists standalone; a
setlist *references* presets and stem songs rather than owning them. A preset tied
to a song (`library_song_id`) is that song's saved click and is hidden from All
songs. Round-trips losslessly through the preset editor.
_Avoid_: "song" unqualified (ambiguous — see below); `Songs` (that name now means
the library table).

**Song** (`Songs`, formerly `LibrarySongs`):
An imported audio file plus its analysis — BPM, beat grid, downbeats, waveform
sidecar. The thing you play.
_Avoid_: `LibrarySongs` (old name); "library song" (now redundant). Still spelled
`librarySongs` in the backup format and `library_song_id` in `song_presets`.

> The rename inverts the old meaning: `Songs` used to be presets and
> `LibrarySongs` used to be audio files. SPEC.md §5.4.

**Beat grid**:
Per-beat timestamps as a Float32 BLOB — *not* a BPM. Handles tempo drift, which a
single BPM cannot. The reason a non-constant-tempo song can be locked to.
_Avoid_: "tempo map", "click track".

**Phase lock** vs **tempo lock**:
Tempo lock knows the BPM. **Phase lock knows where the downbeat is.** Tempo is a
number anyone can look up; phase is the feature. `setTempo(); start();` is not a
phase lock — SPEC.md §8.6.

**Anchor**:
A declaration that at engine frame *F*, the song was *P* seconds in, running at
*B* BPM. A position, not a stopwatch — which is why a lock survives pause and
seek. `kb_metronome_anchor_external`.

**Engine clock**:
The sample-frame counter incremented only in the audio callback
(`kb_engine_frames_rendered`). The one source of time. Two clocks is the defect
SPEC.md §4.1 exists to remove.

**Tool** / **plugin**:
A feature in its own `tool-*` package, listed in the shell's registry
(`app-shell/src/home/registry.ts`) and shaped after the `ToolPlugin` contract
(id, name, icon, routes, home tile, optional settings). First-party only; no
public SDK yet. SPEC.md §9.
_Avoid_: "module", "feature package".

**Rig**:
Click volume and the latency offset of each output route — hardware setup, not
performance. Lives in Settings → Rig, never per song. SPEC.md §17 D3.
_Avoid_: "audio settings" (too broad).

**Play along**:
The user-facing name for locking the click to what Spotify et al. is playing.
_Avoid_: "Media Sync" in UI copy — that is the *engineering* name (SPEC.md §8) and
the package is `tool-sync`; no screen title or app bar may say it. Not built yet.

**Stem song** (`stem_sets` + `stems`):
A song as separate stems, usually a StemDeck bundle, played in the stem player.
SPEC.md §7.

**Play-next queue** (`play_queue`):
The stem songs queued to play after the current one, each at most once. SPEC.md
§11.2.

**Data folder**:
Where imported songs and stems live, on internal storage or an SD card. SPEC.md
§17 D11.

**Mini-player**:
The bar that keeps a single song playing on Home and Songs after its player
closes. SPEC.md §6.3.

**Custom click sound** (`click_sounds`):
A user-imported click in a numbered slot, identified by UUID. SPEC.md §5.3.

**Practice session** (`practice_sessions`):
A period of practice, recorded with its context and summarised when it ends.
SPEC.md §5.7.
<!-- WAIT #286: add the practice history term once #286 closes -->
