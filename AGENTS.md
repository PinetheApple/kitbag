# Kitbag — Agent Workflow Guide

> **One file, every harness.** `CLAUDE.md` is a symlink to this file, so Claude
> Code, pi and opencode all read exactly these instructions. Edit this file.

> **`SPEC.md` is the source of truth**, and the only planning document. Not
> `CHANGELOG.md`, not this file. If either disagrees with SPEC.md, SPEC.md wins and
> the other is a bug. Read SPEC.md §2 before believing any status claim anywhere in
> the repo.

## What is in this repo right now

The Flutter app was **deleted on 2026-07-17** (SPEC.md §13 — the stack is React
Native + TypeScript). The React Native app **does not exist yet**. What remains:

| Path | What it is |
|------|-----------|
| `native/audio_core/` | The C++ realtime core. **The only buildable thing here.** Flat C ABI (`include/kitbag_api.h`), miniaudio backend. Survives the stack change untouched — SPEC.md §4. |
| `SPEC.md` | Product + technical spec. Source of truth. §17 records 13 locked decisions; §17.1 is what is still open. |
| `design/` | Four HTML design specs, all binding. Precedence is in SPEC.md §12. |
| `legacy/` | The only Flutter-era files kept, because SPEC.md cannot reconstruct them: `MediaSessionPlugin.kt` + `AndroidManifest.xml` (ported near line-for-line, §13.9) and `database.dart` + `converters.dart` (the v6 schema and the beat-grid / `.kwav` binary formats, §11). **Reference only — do not build against them.** |
| `docs/` | `tuner-research.md` — an algorithm survey. **Read its warning banner first**: its §3 recommends refining a detector that currently emits nothing. |
| `scripts/worktree.sh` | Agent worktree helper. Still current. |

Everything else the old guide referenced — Melos, `pubspec.yaml`, `dart analyze`,
`custom_lint`, `scripts/lint_check.sh`, `packages/**` — **is gone.** Do not run it,
do not restore it, do not write instructions that assume it.

## Building and verifying

```bash
# Configure + build the native core (the only build in the repo):
cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
cmake --build native/audio_core/build

# Headless verification — no UI, no device, runs in ~a second:
./native/audio_core/build/metronome_verify   # passes
./native/audio_core/build/tuner_verify       # FAILS 37/37 — see below
```

`native/audio_core/tools/` renders audio offline and asserts against it. This is
why SPEC.md §15 Phase 1 is testable with no app at all, and it is the cheapest
signal in the project. **Use it.**

### Known: `tuner_verify` fails 37/37

`PitchAnalyzer` reports `0.000 Hz` / `confidence 0.00` for clean synthetic tones
from 82 Hz to 1 kHz — with no microphone in the path. It is **not** a stale
harness. CI runs it informationally (`|| true`) and it becomes a gate when the
tuner research lands. See SPEC.md §10.1; do not "fix" it by loosening the test.

## Lint and format

The old `PostToolUse` hook (`scripts/lint_check.sh` = `dart analyze` +
`custom_lint`) is deleted. A **C++ gate replaces it**:

```sh
bash scripts/install-hooks.sh   # once per clone — pre-commit runs the gate
bash scripts/lint.sh            # whole tree; --staged for the commit's files
bash scripts/format.sh          # fix formatting in place
```

`lint.sh` runs clang-format + clang-tidy against `native/audio_core/.clang-format`
and `.clang-tidy`; naming and magic numbers gate, the rest is advisory. The
clang-tidy step needs the compile DB (`-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`).
`install-hooks.sh` points `core.hooksPath` at `.githooks/`, whose `pre-commit`
runs the gate over the staged files.

The **TS/React gate is written and staged** under `config/` (ESLint flat config,
`tsconfig`, prettier) and no-ops until `package.json` exists; SPEC.md §13.6's
`eslint-plugin-kitbag` and eval harness still land with the app. Full rules and
the judgment layer are in `CONTRIBUTING.md`. The judgment-level smells no linter
catches — verbose comments, unclear code, misnamed constants — are the
`code-reviewer` agent's job; see the Ralph loop.

## Architecture rules (SPEC.md §9.4)

These hold whatever the stack. They have **no *running* enforcement yet** — the
staged `config/eslint.config.mjs` encodes them as `no-restricted-imports` zones,
but it can't run until the app exists. Hold them by hand until then:

- Native bindings live in exactly one package (`core-native`).
- The abstract contract package imports neither the shell nor any tool.
- Concrete state/DI lives in one package (`core-state`).
- Nothing enters the core that a plugin can carry.

Plus the one that is not a boundary but is load-bearing (SPEC.md §4.5, §13.3):

- **Never stream 60fps values through the reactive graph.** Under React that means
  the beat sweep and tuner needle never touch `useState` — they are Reanimated
  worklets reading the JSI HostObject on the UI thread. This is not an
  optimisation; it is why the architecture holds.

## Ralph loop: feedback→refine

After implementing or changing anything non-trivial, before presenting to the
human:

1. Self-review — build, run the verify tools, run `bash scripts/lint.sh`, check
   correctness.
2. Invoke `@ralph` (correctness + SPEC) and, for a code change, `@code-reviewer`
   (style, comments, magic values, smells) — describe what you built and why.
3. Read the feedback, fix the issues.
4. Iterate until both pass you.

Both are read-only peer reviewers, thorough but fair, and non-overlapping:
**ralph** (`.claude/agents/ralph.md`) reviews correctness and SPEC conformance;
**code-reviewer** (`.claude/agents/code-reviewer.md`) reviews against
`CONTRIBUTING.md`'s judgment layer. If you disagree with a nit, note it and move
on — don't over-rotate.

## Git worktrees

```bash
bash scripts/worktree.sh create <session-id> main
cd ../kitbag-agent-<session-id>
# ... work, commit, push ...
bash scripts/worktree.sh remove <session-id>
```

The main checkout stays on its feature branch; agent worktrees branch off `main`.

## What to work on

**SPEC.md §15 is the sequencing.** It replaces the 37-task "Autonomous Completion
Plan" that used to live in this file — that plan was Flutter work, and its final
task ("CHANGELOG entries per milestone") is how this repo came to document five
releases that never shipped. Do not reinstate it.

Short version:

- **Phase 0** — two verifications that block real work: F-Droid × Expo prebuild
  policy, and whether the scheduler's lookahead absorbs a 300 ms latency offset.
  Plus landing the design-file edits in §12.8.
- **Phase 1** — SPEC.md §4 in full: native playback (4.1), phase anchor (4.2),
  downbeats (4.3), mixer fixes (4.4). **Highest-leverage work in the project,
  framework-independent, and testable headlessly.** Nothing above it is real until
  this lands.
- **Phase 2** — the RN skeleton, gated on proving the 60fps rule on a device.
- **Phase 3** — rebuild the tools in dependency order.

## Honesty rules

The audit that produced SPEC.md §2 found a codebase whose docs, changelog and code
comments actively misdescribed it. Some of that was written by agents. So:

- **Do not claim a milestone shipped.** Write CHANGELOG entries that are true, or
  write none. "Fixed: nothing" is a legitimate entry.
- **Do not write a comment that describes intent as behaviour.**
  `bpm_lookup_service.dart:68` claimed similarity matching over a loop that
  returned the first result; that comment survived long enough to reach a design
  file.
- **Do not invent a constant that already exists.** `sync_screen.dart:14` declared
  its own sound names, mislabelling every sound from index 2 up, and the error
  propagated into `design/kitbag-metronome.html`. One definition, one owner —
  SPEC.md §13.7.
- **Measure, don't demo.** Every failure in §2 is something a demo would not have
  revealed.
