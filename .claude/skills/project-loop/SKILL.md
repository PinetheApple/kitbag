---
name: project-loop
description: Drives the whole Kitbag build across all phases (SPEC.md §15) autonomously. Stateless per iteration — each invocation reconstructs state from disk (SPEC, tracker, issues, decisions log), does ONE increment (parallel non-conflicting tracks + wave gate), commits, and exits for an external driver to re-invoke fresh, so context never grows. Stops only at four boundaries it cannot self-clear. Use when the user says "run/drive/build the whole project", "build to completion", or "keep going across phases". For a single Phase-1 issue, use phase1-loop.
---

# Project loop

The all-phase orchestrator. `phase1-loop` lands **one** issue; this decides *which*
issues, in what order, in parallel, across phases — and hands back at the right time.

**Stateless: one increment per fresh invocation.** State lives on disk (SPEC.md,
`docs/phase1-tracker.md`, GitHub issues, `docs/decisions.md`, `git log`) — never in a
running context. Each invocation reconstructs where things stand from that alone, does
one increment, commits, exits. An external driver re-invokes with a clean context, so
the build's context never grows. If a resume needs memory of a prior run, the on-disk
state was left incomplete — fix the state.

```bash
while :; do claude -p "/project-loop one increment then stop" || break; done
```

## The increment — do once, then exit

1. **Reconstruct from disk.** Read SPEC.md §15, the tracker current-state block,
   `docs/decisions.md`, open issues. Confirm `gh` is on **PinetheApple** (`gh auth
   switch --user PinetheApple` if a write 404s — the dir hook does not fire in the
   non-interactive Bash tool). Assume nothing from a prior context.
2. **Pick the set.** If advancing the phase hits a stop-point (device, design),
   exit non-zero. Else take the largest **file-disjoint, single-owner, unblocked**
   set (see Parallelism). No unblocked task left → project done, report, exit.
3. **Run it.** Each task's pass concurrently via the per-phase executor, in its own
   worktree (`bash scripts/worktree.sh create <track> main`). Stay thin on the main
   thread — verdicts, not transcripts. Log any decide-and-record to `docs/decisions.md`.
4. **Wave gate.** Merge the set to the feature branch; run the full suite on the
   integrated tree (see Wave gate). Red on green slices = an integration finding:
   file, fix, re-gate. Never advance a phase on per-slice green.
5. **Persist.** Close issues (SHA + evidence in the issue), tracker line → `[x]`,
   regenerate `CHANGELOG.md` (`git cliff changelog-base..HEAD`), remove spent
   worktrees. Every result on disk before exit — or the next invocation can't resume.
6. **Exit.** Report and exit zero. One increment only — the driver re-invokes fresh.
   Exit non-zero only at a stop-point.

## Autonomy by phase

Verification confidence is not uniform, so autonomy is not. Never green a softer
regime as if it were headless — a Phase 2 pass without a device reading proved nothing.

| Phase | Ground truth | Autonomy |
|---|---|---|
| **1** core (§4) | headless `*_verify`, sabotage-proven | full — unattended |
| **2** skeleton (§13.2/§13.3) | 60fps **measured on a device** | stop at the device gate |
| **3** tools (§5–§10) | UI + binding `design/` files | `design-reviewer` + user sign-off |

Phase gate to advance: **1→2** all §4 issues closed + wave gate green; **2→3** the
§13.3 60fps device reading. Within a phase, a task's frontier is its closed
`--blocked-by` deps.

## Parallelism — bounded by the conflict map

- **File-disjoint tasks run parallel; file-sharing tasks serialize.** Read the tracker
  conflict map each cycle (A/B share `mixer.cpp` → serial; C/D disjoint → parallel).
- The C ABI (`kitbag_api.h`) is **single-owner** (§13.7): one in-flight task per symbol.
- Route by domain: native/C++ → `audio-core-engineer`; RN/TS → `rn-engineer` (not the
  web `react-engineer` — §13.3 breaks under web-React idioms). Review: `ralph` +
  `code-reviewer`.

## Per-phase executor

Orchestrator is all-phase; the per-task pass is per-phase.

- **Phase 1 (native)** → `phase1-loop`'s pass verbatim.
- **Phase 2/3 (RN)** → an `rn-engineer` pass with RN gates (device 60fps, `tdd` skill
  for logic/state, `design-reviewer` for screens, eslint/tsc). **Not written yet** —
  its gate commands don't exist until the RN app does. Author it at the Phase-2
  boundary, mirroring `phase1-loop`.

## Stop-points — exit non-zero only here

1. A decision SPEC.md doesn't state, or two sections contradict → ask in the issue.
   (An *unambiguous* gap is not this — decide-and-record.)
2. A measured-on-hardware gate (the §13.3 60fps reading). State what to run and what
   number confirms it.
3. A Phase 3 design sign-off — present the `design-reviewer` render, stop.
4. A task fails its gates twice, or a finding survives two fix rounds.

A closed issue or passed wave gate is not a stop-point — it's the increment finishing
(exit zero, driver continues).

## Decisions log

- **Ambiguous / contradictory** → stop-point 1.
- **Unambiguous gap** → decide, proceed, and record in `docs/decisions.md` (choice,
  SPEC §, date, one-line rationale). Never encode the choice in SPEC.md — it stays
  user-owned; the log is the audit trail that keeps autonomy from drifting silently.

## Wave gate

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

## Inherit from phase1-loop

`.claude/skills/phase1-loop/SKILL.md` §Boundaries and §Honesty apply unchanged:
never merge/push/PR, never amend a reported SHA, never infer approval, never edit a
SPEC decision, never loosen a test, prove a negative before reporting it. Its
sabotage gate is the test discipline in every phase — a test counts only once a
mutation is shown to break it; Phase 3 UI adds the `tdd` skill on top, not instead.

## Deferred

Tuner (§10) comes last (SPEC.md §15). Don't pick it up early; don't "fix"
`tuner_verify`'s 37/37 in passing.
