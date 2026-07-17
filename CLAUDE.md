# Kitbag — Agent Workflow Guide

> **Claude Code config.** For opencode, see `AGENTS.md`.
> Both files stay in sync — **prefer editing AGENTS.md**, then mirror here.

> **`SPEC.md` is the source of truth.** Not `PLAN.md`, not `CHANGELOG.md`, and not
> this file. If any disagree with SPEC.md, SPEC.md wins. Read SPEC.md §2 before
> believing any status claim in this repo.

## What is in this repo right now

The Flutter app was **deleted on 2026-07-17** (SPEC.md §13 — the stack is React
Native + TypeScript). The React Native app **does not exist yet**.

| Path | What it is |
|------|-----------|
| `native/audio_core/` | The C++ realtime core. **The only buildable thing here.** Flat C ABI (`include/kitbag_api.h`). Survives the stack change untouched — SPEC.md §4. |
| `SPEC.md` | Source of truth. §17 = 13 locked decisions; §17.1 = still open. |
| `design/` | Four binding HTML design specs. Precedence in SPEC.md §12. |
| `legacy/` | Flutter-era files kept only because SPEC.md can't reconstruct them: the Kotlin media-session plugin + manifest (§13.9), and the v6 schema + binary formats (§11). **Reference only.** |
| `docs/` | ADRs (historical) + tuner research (read its warning banner). |
| `scripts/worktree.sh` | Worktree helper. Current. |

Melos, `pubspec.yaml`, `dart analyze`, `custom_lint`, `scripts/lint_check.sh` and
`packages/**` are **gone**. Don't run them, don't restore them, don't write
instructions assuming them.

## Building and verifying

```bash
cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
cmake --build native/audio_core/build

./native/audio_core/build/metronome_verify   # passes
./native/audio_core/build/tuner_verify       # FAILS 37/37 — see below
```

Headless, no device, ~a second. This is why SPEC.md §15 Phase 1 is testable with
no app at all, and it's the cheapest signal in the project.

### Known: `tuner_verify` fails 37/37

`PitchAnalyzer` reports `0.000 Hz` / `confidence 0.00` for clean synthetic tones,
82 Hz–1 kHz, with no mic in the path. **Not** a stale harness. CI runs it
informationally (`|| true`); it becomes a gate when the tuner research lands.
SPEC.md §10.1. Do not "fix" it by loosening the test.

## No PostToolUse lint step

The old hook ran `scripts/lint_check.sh` (`dart analyze` + `custom_lint`). Both
deleted. **Nothing replaces them until the RN app exists** — SPEC.md §13.6
specifies the shape (ESLint flat config, `eslint-plugin-kitbag`,
`--max-warnings 0`, ported eval harness). Until then, verify C++ by building and
running the tools above.

## Architecture rules (SPEC.md §9.4)

Hold whatever the stack. **Currently no automated enforcement** — the lint layer
was Dart. Hold them by hand until §13.6 lands:

- Native bindings live in exactly one package (`core-native`).
- The abstract contract package imports neither the shell nor any tool.
- Concrete state/DI lives in one package (`core-state`).
- Nothing enters the core that a plugin can carry.

Plus (SPEC.md §4.5, §13.3): **never stream 60fps values through the reactive
graph.** The beat sweep and tuner needle never touch `useState` — Reanimated
worklets read the JSI HostObject on the UI thread. Not an optimisation; it's why
the architecture holds.

## Ralph loop: feedback→refine

After anything non-trivial, before presenting to the human:

1. Self-review — build, run the verify tools, check correctness.
2. Invoke `@ralph` — describe what you built and why.
3. Fix the findings.
4. Iterate until Ralph passes you.

Ralph (`.claude/agents/ralph.md`) is read-only, thorough but fair. Disagree with a
nit? Note it and move on.

## Worktrees

```bash
bash scripts/worktree.sh create <session-id> main
cd ../kitbag-agent-<session-id>
bash scripts/worktree.sh remove <session-id>
```

Main checkout stays on its feature branch; agent worktrees branch off `main`.

## What to work on

**SPEC.md §15 is the sequencing.** It replaces the 37-task "Autonomous Completion
Plan" that used to live in AGENTS.md — Flutter work, and its last task ("CHANGELOG
entries per milestone") is how this repo came to document five releases that never
shipped. Do not reinstate it.

- **Phase 0** — F-Droid × Expo policy; does the lookahead absorb 300 ms; land the
  §12.8 design-file edits.
- **Phase 1** — SPEC.md §4 in full. Highest-leverage work, framework-independent,
  headlessly testable. Nothing above it is real until this lands.
- **Phase 2** — RN skeleton, gated on proving the 60fps rule on a device.
- **Phase 3** — rebuild the tools in dependency order.

## Honesty rules

The audit behind SPEC.md §2 found a codebase whose docs, changelog and comments
actively misdescribed it. Some was agent-written.

- **Don't claim a milestone shipped.** True entries or none. "Fixed: nothing" is
  legitimate.
- **Don't write a comment that describes intent as behaviour.**
  `bpm_lookup_service.dart:68` claimed similarity matching over a loop returning
  the first result; it reached a design file.
- **Don't invent a constant that exists.** `sync_screen.dart:14` declared its own
  sound names, mislabelling every sound from index 2 up, and the error propagated
  into `design/kitbag-metronome.html`. One definition, one owner — SPEC.md §13.7.
- **Measure, don't demo.** Every §2 failure is something a demo wouldn't reveal.
