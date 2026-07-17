# Kitbag

## Language

Ubiquitous language for the domain. Terms mean exactly this — in code, specs and
conversation. `SPEC.md` is the authority; this file is the glossary.

**Song preset** (`SongPresets`):
Everything the metronome knows about a song — tempo, time signature, subdivision,
accents, polyrhythm, sound, count-in, ramp, bar-mute, notes. Exists standalone; a
setlist *references* presets rather than owning them. Round-trips losslessly
through the preset editor.
_Avoid_: "song" unqualified (ambiguous — see below); `Songs` (that name now means
the library table).

**Song** (`Songs`, formerly `LibrarySongs`):
An imported audio file plus its analysis — BPM, beat grid, downbeats, waveform
sidecar. The thing you play.
_Avoid_: `LibrarySongs` (old name); "library song" (now redundant).

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
A feature that declares itself to the shell (id, name, icon, routes, home tile,
optional settings schema). The shell is a registry. First-party only; no public
SDK yet. SPEC.md §9.
_Avoid_: "module", "feature package".

**Rig**:
Volume and latency offset — hardware setup, not performance. Lives in Settings,
global, never per song. SPEC.md §17 D3.
_Avoid_: "audio settings" (too broad).

**Play along**:
The user-facing name for locking the click to what Spotify et al. is playing.
_Avoid_: "Media Sync" in UI copy — that is the *engineering* name (SPEC.md §8) and
the package is `tool_sync`; the AppBar must not say it.

---

> **Removed 2026-07-17:** `core_services` (a Riverpod provider package) was the
> only entry in this file. Riverpod and the Dart packages are gone — SPEC.md §13.
> Its successor is `core-state` (Zustand), and the *rule* survives unchanged:
> concrete state lives in exactly one package so the abstract contract stays
> abstract (SPEC.md §9.4).
