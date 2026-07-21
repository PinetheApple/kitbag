---
name: project-loop
description: Drives the whole Kitbag build to completion autonomously across all phases (SPEC.md §15). Stateless per iteration — each invocation reconstructs state from disk (SPEC, tracker, issues, decisions log), does ONE increment (a parallel set of non-conflicting tracks + wave gate) via the right domain agent through ralph + code-reviewer, commits, and exits for an external driver to re-invoke with a clean context, so it never exhausts context. Stops only at the four boundaries a loop cannot self-clear. Use when the user says "run the whole project", "build it to completion", "drive the project", "keep going across phases", or wants autonomous multi-phase progress rather than one issue at a time. For a single Phase-1 issue, use phase1-loop instead.
---

# Project loop

The meta-orchestrator over the whole build. `phase1-loop` takes **one** issue from
open to committed; this drives **the project** — sequencing phases, running
non-conflicting tracks in parallel, and knowing exactly when to hand back.

It does not replace `phase1-loop`; it **calls its discipline**. For any Phase 1
task, execute the per-task pass documented in `phase1-loop` verbatim (the gates,
the sabotage evidence, the fresh-verifier rule, the close-out). This file owns only
what is *above* a single task: phase order, parallelism, integration, stop-points.

## How it runs — one increment per fresh invocation (this is the Ralph part)

**The loop is stateless. State lives on disk, never in a running context.** Each
invocation does exactly **one increment** — one parallel set of tasks + the wave
gate — then **commits and exits**. An external driver re-invokes with a clean
context. This is the whole point: context resets every pass, so it cannot exhaust
and the user never manages it. A single main-thread `while` over many cycles is the
wrong shape — it accumulates issue bodies, verdicts and reports until it dies.

The durable state is the repo itself — SPEC.md, `docs/phase1-tracker.md`, the
GitHub issues (state + `--blocked-by` + review trail), `docs/decisions.md`, and
`git log`. **Every invocation reconstructs "where are we" from that alone.** A fresh
context knows nothing else and must not need to; if resuming requires memory of a
prior context, the state on disk was left incomplete — fix the state, not the loop.

Driver (external, resets context each pass — pick one):

```bash
# Ralph's original form: fresh `claude -p` process per increment.
while :; do
  claude -p "/project-loop one increment then stop" || break
  # exits non-zero at a stop-point or when the project is done
done
```

or the harness `/loop` skill pointed at `/project-loop`. Either way the contract is
identical: **fresh context in, one increment done, state on disk, exit.** Within a
single increment the main thread still stays thin — dispatch to subagents, ask for
verdicts not transcripts (exit codes, failing check names, mutation diffs), never
paste a verify run or a full review into the main thread. That keeps even one
increment's context bounded; the fresh-invocation contract keeps the *build* bounded.

## The one hard truth

A Ralph loop is only as bug-free as its verification is objective and un-gameable.
That is why this repo's SPEC.md §2 exists — a previous generation *claimed* results
it never measured. Verification confidence is **not uniform across phases**, so
autonomy is not uniform either. The loop must know which regime it is in:

| Phase | Ground truth | Autonomy |
|---|---|---|
| **1** core (§4) | headless `*_verify`, sabotage-proven, ~1s | **full** — runs unattended |
| **2** skeleton (§13.2/§13.3) | **60fps on a real device** — SPEC insists measured on hardware, not CI | **hands to user at the device gate** |
| **3** tools (§5–§10) | UI + interaction; `design/` files binding; softer truth | **semi** — `design-reviewer` renders + checks, judgment sign-off is the user's |

Never pretend a softer regime is the headless one. A Phase 2 pass that "passes"
without a device reading has proven nothing — say so and stop, do not green it.

## Inherit every boundary and honesty rule from phase1-loop

`.claude/skills/phase1-loop/SKILL.md` §"Boundaries" and §"Honesty rules" apply
unchanged and in full — never merge/push/PR, never amend a reported SHA, never
infer approval, never edit a SPEC decision, never loosen a test, prove a negative
before reporting one, "already correct + proof" is a complete outcome. They are
phase-agnostic. Re-read them; do not restate them here.

## Determine the phase and the frontier

1. Read **SPEC.md §15** (phase order) and the **current-state block** at the top of
   `docs/phase1-tracker.md`. The phase gate below must be green before the next
   phase starts:
   - **Phase 1 → 2:** §4 tracks A–D closed *and* the wave-3 integration gate green
     (full headless suite passing *together*, not per-slice).
   - **Phase 2 → 3:** the §13.3 60fps rule **measured on a device** (stop-point 2).
   - Within a phase, a task's frontier is its closed `--blocked-by` deps.
2. Phases are the *outer* DAG; within a phase the *inner* graph is the tracker's
   **conflict map** (which tasks touch the same file). Both must clear.

Phase 1 remainder (A3→A4→A6, B5-via-A4, Track D) and Phase 2's skeleton do **not**
share files with each other in the obvious way — but Phase 2 depends on Phase 1's
*gate*, so it does not start until §4 is closed. Track D is independent of Track A
and may run in parallel with it now.

## Parallelism — bounded by the conflict map, never free

Two agents drift only when they make conflicting decisions about a **shared
contract**. That is prevented structurally, so obey the structure:

- The C ABI (`kitbag_api.h`) is the one contract, **single-owner** (§13.7). Only one
  in-flight task may change a given symbol.
- **File-disjoint tasks run in parallel; file-sharing tasks serialize.** Read the
  tracker conflict map every cycle — A and B share `mixer.cpp` → serial; C
  (`metronome.cpp`) and D (`beat_tracker.cpp`) → concurrent.
- Each parallel track gets **its own worktree**: `bash scripts/worktree.sh create
  <track> main`. Dispatch each track's task to its own subagent. Remove the
  worktree when the track merges.
- Route by domain: native/C++ → **`audio-core-engineer`**; RN/TS → **`rn-engineer`**
  (never the web `react-engineer` — SPEC.md §13.3 breaks under web-React idioms).
  Reviews stay `ralph` (correctness/SPEC) + `code-reviewer` (CONTRIBUTING.md).

Pick a **set** each cycle: the largest group of unblocked, file-disjoint,
single-owner tasks. Run their per-task passes concurrently (each per phase1-loop's
discipline). Do not exceed what the conflict map allows to be safe.

## The wave integration gate

Per-task gates prove a slice. Cross-track bugs hide in the seams between slices
(tracker Wave 3). So after a parallel set merges to the feature branch, **before
advancing**, run the *full* suite on the integrated tree in a fresh verifier:

```bash
rm -rf native/audio_core/build
cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
cmake --build native/audio_core/build; echo "BUILD=$?"
for t in native/audio_core/build/*_verify; do
  n=$(basename "$t"); [ "$n" = tuner_verify ] && continue
  "$t" >/dev/null 2>&1; echo "$n=$?"
done
bash scripts/lint.sh; echo "LINT=$?"
```

Gate on the exit codes together. A green per-task pass that goes red when merged is
an integration finding — file it, fix it, re-gate. Do not advance a phase on
per-slice green alone.

## The decisions log — how this stays non-waterfall without drift

The spec is general on purpose; you will hit points it does not state. Split them:

- **Genuine ambiguity or a SPEC contradiction** → **stop** (stop-point 1). Put the
  question in the issue. Do not guess.
- **Underspecified but unambiguous** (one reasonable reading, no contradiction) →
  **decide, proceed, and record it** in `docs/decisions.md`: the choice, the SPEC
  section it fills, the date, and one line of rationale. Never edit SPEC.md to
  encode the choice — SPEC stays user-owned; the log is the reviewable audit trail
  that keeps autonomy from becoming silent drift.

If `docs/decisions.md` does not exist, create it with a one-line header the first
time you record. Every autonomous choice goes there or it did not happen.

## Stop-points — the four boundaries, and only these

Run unattended across everything else. Hand back **only** when:

1. **A decision SPEC.md doesn't state, or two SPEC sections contradict.** Ask in the
   issue; do not infer. (An unambiguous gap is *not* this — decide-and-record.)
2. **A measured-on-hardware gate.** The §13.3 60fps device reading is the canonical
   one; any "prove on a real device" acceptance qualifies. State exactly what to
   run and what number confirms it, then stop — the loop cannot self-clear this.
3. **A design-judgment sign-off.** When a Phase 3 screen is built to a binding
   `design/` file, `design-reviewer` renders and flags AI-slop/defects, but the
   "does this feel right" call is the user's. Present the render, stop.
4. **A task fails its gates twice, or the same finding survives two fix rounds.** No
   infinite thrash — hand back with the gate output and what you tried.

A closed issue or a passed wave gate is **not** a stop-point in the project sense —
it is the increment finishing. The invocation exits normally (zero); the external
driver starts the next one fresh. The four boundaries above exit **non-zero** so the
driver breaks and hands to the user.

## Each invocation, in order — one increment, then exit

1. **Reconstruct state from disk.** Read SPEC.md §15, the tracker current-state
   block, `docs/decisions.md`, and the open issues. Confirm `gh` is on
   **PinetheApple** (`gh auth switch --user PinetheApple` if a write 404s — the dir
   hook does not fire in the non-interactive Bash tool; see phase1-loop). Determine
   the current phase and its gate state. Assume nothing from any prior context.
2. **Decide the increment.** If advancing the phase requires a stop-point gate
   (device, design), **exit non-zero** and hand back. Otherwise pick the largest
   file-disjoint, single-owner, unblocked set. If no unblocked task remains, the
   project is done — report and exit.
3. **Do the set.** Run each task's pass concurrently, per `phase1-loop` discipline,
   in its worktree via its domain agent. Record any decide-and-record choices to
   `docs/decisions.md`. Stay thin on the main thread — verdicts, not transcripts.
4. **Integrate.** Merge the set to the feature branch; run the **wave integration
   gate**. A red gate on green slices is an integration finding — file, fix, re-gate.
5. **Persist state.** Close the issues (SHA + evidence in the issue), set the tracker
   line to `[x]`, regenerate `CHANGELOG.md` (`git cliff changelog-base..HEAD`),
   remove spent worktrees. **This is what lets the next fresh invocation resume** —
   if it is not on disk, it did not happen.
6. **Report and exit (zero).** One increment per invocation. Do **not** internally
   loop to the next set — exit and let the driver re-invoke with a clean context.
   Exit non-zero only at the four boundaries.

## Deferred by the user

Tuner (§10, `tuner_verify` 37/37, `docs/tuner-research.md`) comes **last**, after all
other functionality (SPEC.md §15 orders it last in Phase 3). Do not pick it up early
and do not "fix" the failing suite in passing.
