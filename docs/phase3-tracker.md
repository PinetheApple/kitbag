# Phase 3 — Rebuild tools: Execution Tracker

**Not a planning document, not the ticket.** `SPEC.md` §15 is the sequencing
authority and §5–§10 are the contract. **GitHub issues in `PinetheApple/kitbag`
are the tickets** — they carry per-task state, the `--blocked-by` spine, and the
review trail. This file holds only what a flat issue list can't: the **wave map,
conflict map, and graveyard.** When a task's status here disagrees with its
issue, **believe the issue.** SPEC §2 is source of truth over both.

Scope: **SPEC §15 Phase 3** — rebuild the tools in dependency order on the
`core-native`/`core-state`/`core-db` foundation Phase 2 proved on device (§13.3,
#33 PASSED). Order: **Metronome (§5) → Song playback (§6) → Stem player (§7) →
Play along (§8) → Tuner (§10, deferred behind §10.1).** Plugin extensibility (§9)
is not a phase — it is how each tool is built (§9.4 boundaries).

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done (gates green + both reviews pass) · `[!]` blocked

## Autonomy — the Phase 3 regime

Phase 3 ground truth is **UI + the binding `design/` files**, so autonomy is
**not** full-headless like Phase 1. Two gate classes the loop cannot self-clear:

- **Design sign-off (stop-point 3).** Any task that builds a screen ends by
  presenting a `design-reviewer` render against the binding design file, then
  **stops** for user sign-off. `design/kitbag-metronome.html` supersedes the
  metronome section of `design/kitbag-ui.html` (§5, §12).
- **Device gate (stop-point 2).** §5.6 background operation and the §5.8/§14.1
  soak + click-vs-grid measurement are **measured on hardware** — recorded
  output, not by ear/eye. State what to run and what number confirms it.

Headless, non-design, non-device tasks (state stores, migration logic, export/
import logic, summary computation) run **full-autonomy** with the `tdd` skill,
sabotage-gated — a test counts only once a mutation is shown to break it.

Executor: **RN/TS → `rn-engineer`** (not the web `react-engineer` — §13.3 breaks
under web-React idioms). Native/Android glue for §5.6 → `audio-core-engineer` for
anything a realtime thread touches, `rn-engineer` for the JS/TurboModule side.
Reviews → `ralph` (correctness/§5) + `code-reviewer` (CONTRIBUTING.md judgment);
screens add `design-reviewer`.

Gates (every TS task): vitest suites green · typecheck 12/12 · `lint
--max-warnings 0` · generation drift guards fresh (§13.7). The native wave gate
(build 0 · all `*_verify` bar `tuner_verify` · `lint.sh` 0) still runs unchanged;
a §5.6 native change must keep it green.

## Current state — 2026-07-24, `feat/phase2-skeleton` (Phase 2 done, unmerged)

> **Branch note.** All of Phase 2 landed on `feat/phase2-skeleton` and is **not
> yet on `main`** (Phase 1 merged via PR #26; Phase 2 has no PR yet). Phase 3
> continues on this branch because it holds the whole foundation. **Recommend the
> user PR `feat/phase2-skeleton` → `main`** at a convenient boundary; the loop
> does not push or open PRs.

**Foundation already in place (Phase 2):** `core-native` JSI HostObject +
TurboModule (#29/#30, device-proven #33), `core-db` full v6→v7 Drizzle schema and
migration (#34) — **including the §5.4/§11.2 rename** (`Songs`→`SongPresets`,
`LibrarySongs`→`Songs`), the D1 denominator column, decoupled `setlistItems`,
ramp/bar-mute/count-in columns, `practiceSessions.setlistId`/`songsPlayed`, and
the D4 identity tuple. So the metronome's **DB layer needs no new task** — M2
below is marked satisfied.

**Done:** M1 (#40, `8b3c681`) — metronome config store; 14 vitest sabotage-proven,
both reviews pass, §13.3 held.
**In progress:** none.
**Next:** the metronome screens (M3→M4→M5) are design-gated — the next wave builds
M3 and ends at a **design sign-off stop-point** (present a `design-reviewer` render
against `design/kitbag-metronome.html`, then stop for user sign-off).
**Follow-up filed:** #41 (F1-M1a) — D1 denominator has no C ABI parameter yet
(`kb_metronome_set_beats` is numerator-only); the store holds it as intent until a
native task lands it. Not a blocker for M1; blocks the M3 denominator stepper being
functional rather than cosmetic.

## F1 Metronome (§5) — task decomposition

Only the tasks being dispatched carry a live GitHub issue; the rest are the
planned spine (issue created when the wave reaches it, so bodies don't rot).
Conflict map: M1 (core-state) and M2 (core-db) are foundation and file-disjoint;
M3/M4/M5 all write app screens under `app-shell`/`tool-metronome` → **screen
tasks serialize** (shared files) and each is design-gated anyway.

| Task | Issue | Scope | Gate class |
|---|---|---|---|
| **M1** store | [#40](https://github.com/PinetheApple/kitbag/issues/40) ✅ | core-state metronome config store; commands 1:1 to TurboModule; §13.3 no realtime shadow | headless (tdd) |
| **M1a** denom ABI | [#41](https://github.com/PinetheApple/kitbag/issues/41) | native: `kb_metronome_set_beats` gains the D1 denominator parameter; store's denominator stops being intent-only | headless (native verify) |
| **M2** schema | — **satisfied by #34** | §5.4/§11.2 rename, denominator, ramp/bar-mute round-trip, decoupled setlists — all shipped in Phase 2 | — |
| **M3** perf surface | TBD | §5.2 swipe-anywhere tempo, preset steppers, beat-LED row editor (group+wrap ≥4/row, D9), poly row, bar sweep, practice pill, tap-to-type numpad, badge steppers | **design sign-off** |
| **M4** chips + sheets | TBD | §5.3 Ramp/Mute-bars/Sound/Count-in sheets over the running metronome, live-apply; sound names from engine | **design sign-off** |
| **M5** preset screens | TBD | §5.4 setlists / setlist detail / preset editor; per-field edit; drag-handle reorder; LED component reused | **design sign-off** |
| **M6** export/import | TBD | §5.5 v4-UUID version+validate, selective, merge-vs-replace, share sheet (logic headless; UI design-gated) | mixed |
| **M7** background | TBD | §5.6 + §13.9 foreground service, notification transport, media session, lock-screen | **device gate** |
| **M8** practice | TBD | §5.7 write setlistId/songsPlayed; practice-end summary (peak-end) | mixed |
| **M9** soak harness | TBD | §5.8/§14.1 4h soak + click-vs-grid offset from **recorded output** | **device gate** |

## Wave map

| Wave | Tasks | Runs |
|---|---|---|
| **0** | M1 #40 | metronome config store — headless, foundation for the screens |
| **1+** | M3 → M4 → M5 | metronome screens — serial (shared app files), each ends at a design sign-off |
| … | M6 · M7 · M8 · M9 | export/import · background (device) · practice · soak (device) |

## Graveyard — do not re-attempt

_(Record disproved or deliberately-unfixed work here as it happens, so a future
reader does not re-attempt it. See Phase 1/2 trackers for the pattern.)_
