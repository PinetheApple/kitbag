# Kitbag — Agent Workflow Guide

> **One file, every harness.** Claude Code, pi and opencode read `AGENTS.md`
> directly. Do not add a `CLAUDE.md` or `CLAUDE.local.md`: Claude Code reads one of
> those instead of this file.

> **`SPEC.md` is the source of truth**, and the only planning document. Not
> `CHANGELOG.md`, not this file. If either disagrees with SPEC.md, SPEC.md wins and
> the other is a bug. Read SPEC.md §2 before believing any status claim anywhere in
> the repo.

## Working on a task

**Every task starts as a GitHub issue.** Before writing code, open one (or find
the existing one) and write down what "done" means. An issue with no acceptance
criteria produces work that cannot be reviewed, only argued about. The 2026-07-17
audit (SPEC.md §2) found a codebase whose own docs and changelog misdescribed it;
written-down criteria are what keep a status claim checkable.

1. **Issue first.** Title states the observed defect or the desired behaviour, not
   the diagnosis. Body carries `## Acceptance criteria` as a checklist. If a task
   is worth doing across more than one sitting, it is worth an issue.
2. **Read the spec, not the ticket alone.** The issue points at SPEC.md sections
   and, for anything with a screen, the binding file in `design/` (§12 precedence).
   The issue is the ticket; SPEC.md is the contract.
3. **Verify it, and say what you ran.** Gates green is a claim; the output is the
   evidence. A criterion that needs a device needs a device — the JNI/TurboModule
   chain was broken from M1 to M3 while every headless gate stayed green.
4. **Close the issue against its criteria**, ticking only what is actually true.

### Repeatable actions belong in a script

If an action will be performed more than once — building, installing to a device,
running the gate set, cutting a release — it goes in `scripts/`, not in a
paragraph of instructions. A remembered command sequence drifts silently: the step
someone forgets is the gate that stops running, and nobody notices until it
matters on a device.

Scripts here take `-h|--help`, use named exit codes rather than bare integers, and
print what failed rather than only that something did. `ls scripts/` is the
inventory; the open issues carry what is still missing.

Two carry the working loop:

```sh
bash scripts/preflight.sh            # every gate CI runs, plus auto-fixes
bash scripts/preflight.sh --no-fix   # check only — what CI does
bash scripts/install-on-device.sh    # build, install, launch, report signing + runtime state
```

`preflight.sh` must pass before committing. It collects failures rather than
stopping at the first, so one run shows every problem instead of revealing one
per CI round trip, and it reports which files it rewrote — commit those or CI
still fails. `--skip-android` and `--skip-native` drop the slow legs.

### Cutting a release

Merging to `main` publishes. `.github/workflows/release.yml` computes the next
version, builds a release APK signed with the release key (Actions secrets),
gates it with `scripts/release-gate.sh` (signature, `versionName`, `versionCode`)
and publishes GitHub release `vX.Y.Z` with `kitbag.apk` and its sha256. Nothing
is committed back: the tag is the version source, passed to Gradle as
`-PkitbagVersionName`.

- **Next version** — `scripts/version.sh next`, over the commits since the
  latest `vX.Y.Z` tag: breaking (`!` or `BREAKING CHANGE`) bumps major, or minor
  below 1.0.0; `feat` bumps minor; everything else bumps patch. Every merge
  publishes. With no tag yet the version is `app.json`'s.
- **Floor** — `packages/app-shell/app.json` `expo.version` is the minimum; the
  next version is never below it. To force a jump (say 1.0.0), raise it with
  `scripts/version.sh set 1.0.0` in a PR.
- **versionCode** — `major*10000 + minor*100 + patch`, with minor and patch
  ≤ 99 and the code ≤ 2100000000. Gradle and `version.sh next` refuse anything
  out of bounds; raise the floor to the next minor or major instead.
- **Concurrency** — releases run one at a time. A run still waiting when a newer
  push arrives is dropped; the newer run's range covers its commits.

Local builds stay debug-signed unless `ANDROID_KEYSTORE_*` is set (see
`.env.example`). `scripts/version.test.sh` and `scripts/release-gate.test.sh`
cover the rule and the gate.

### Commits and PRs

Conventional commit subjects (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) —
`cliff.toml` parses them into `CHANGELOG.md`, so a mislabelled subject lands in
the wrong section of a published changelog. The body explains *why* when the
change is not self-evident.

PRs state what changed, copy the issue's acceptance criteria with only the
satisfied ones ticked, and record verification plainly: what was run, what it
printed, and what still needs a device.

## What is in this repo right now

The Flutter app was **deleted on 2026-07-17** (SPEC.md §13 — the stack is React
Native + TypeScript). Since then Phase 0–2 landed (PRs #26, #39) and Phase 3 is
rebuilding the tools on top. What is here now:

| Path | What it is |
|------|-----------|
| `native/audio_core/` | The C++ realtime core. Flat C ABI (`include/kitbag_api.h`), miniaudio backend — SPEC.md §4. Built in Phase 1 (PR #26); still the cheapest verification signal in the project. |
| `packages/` | The React Native app: pnpm workspaces + Turborepo. `app-shell` (Expo router shell), `core-native` (JSI HostObject + TurboModule — the ONLY native-binding package), `core-state`, `core-db` (Drizzle schema v17, migrating the Flutter v6 database in place), `core-plugin-api` (the abstract contract), `core-design`, `eslint-plugin-kitbag`, and the tools: `tool-metronome`, `tool-library` (Songs and Stem songs lists), `tool-stems` (stem player) and `tool-tuner` are built; `tool-sync` (play along) is a skeleton. |
| `SPEC.md` | Product + technical spec. Source of truth. §17 records the locked decisions; §17.1 is what is still open. |
| `design/` | The binding HTML design specs. Precedence, and which variant of a multi-variant file binds, is in SPEC.md §12. |
| `legacy/` | `android/MediaSessionPlugin.kt` + `AndroidManifest.xml`, the Flutter-era media-session detection that play-along (§8.2, §13.9) still has to port. **Reference only — do not build against them.** Delete them once `MediaNotificationListenerService.kt` stops being a skeleton. |
| `docs/` | `decisions.md` (why things were decided), `tuner-functional-spec.md`, research notes, and `archive/` (retired trackers and runbooks, historical only). GitHub issues are the tickets. **Read `docs/tuner-research.md`'s warning banner before touching the tuner.** |
| `scripts/` | `preflight.sh` (every CI gate locally), `version.sh` + `release-gate.sh` + `verify-apk-signature.sh` (the release path, run by `release.yml`), `install-on-device.sh`, `worktree.sh` (agent worktrees), `lint.sh`/`format.sh`/`install-hooks.sh` (native gate), `changelog.sh`, `run-loop.sh`. |

The old Flutter guide's references — Melos, `pubspec.yaml`, `dart analyze`,
`custom_lint`, `scripts/lint_check.sh` — are gone. Do not restore them.

## Building and verifying

```bash
# Native core:
cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
cmake --build native/audio_core/build

# Headless verification — no UI, no device, runs in ~a second:
./native/audio_core/build/metronome_verify   # passes
./native/audio_core/build/tuner_verify       # passes; a CI gate since #117

# TS workspace (pnpm + Turborepo) — the gates every TS task must pass:
pnpm -w typecheck       # turbo run typecheck — 12/12 packages
pnpm -w lint            # eslint . --max-warnings 0
pnpm -w test            # vitest via turbo
pnpm -w format          # prettier --check .
pnpm -w generate:check  # generation drift guards (SPEC §13.7)
```

`native/audio_core/tools/` renders audio offline and asserts against it. This is
why SPEC.md §15 Phase 1 is testable with no app at all, and it is the cheapest
signal in the project. **Use it.**

### `tuner_verify` is a gate

It failed 37/37 until #117: the old cycfi/q wrapper reset its detector every
update while the note lock acquired, so nothing ever locked. The tuner is now a
McLeod detector under a string-aware tuning mode, checked against
`docs/tuner-functional-spec.md` §6 on synthetic tones. CI and `preflight.sh` gate
on it. The headless checks say nothing about a real mic (SPEC.md §10.1 capture
path, §10.3 pickup); those still need a device. Never loosen a check to pass.

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

The **TS/React gate is live**: root `eslint.config.mjs` runs the generic-rule
layer plus the §13.1 import zones, and prettier + per-package tsconfigs round
it out. `eslint-plugin-kitbag` (`packages/eslint-plugin-kitbag`) and its eval
harness (`packages/app-shell/eval/`) carry the §13.6 rules against scenario
fixtures; parts of the root config are explicitly documented as stopgaps for
rules that plugin must eventually own — read its comments before touching
them. Full rules and the judgment layer are in `CONTRIBUTING.md`. The
judgment-level smells no linter catches — verbose comments, unclear code,
misnamed constants — are the `code-reviewer` agent's job; see the Ralph loop.

## Architecture rules (SPEC.md §9.4)

These hold whatever the stack and are now **enforced**: the root
`eslint.config.mjs` encodes them as `no-restricted-imports` zones and
`pnpm -w lint` runs them. Still worth keeping in mind:

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

- **Phase 0** ✅ — F-Droid × Expo policy, 300 ms latency offset, §12.8 design
  edits. See `docs/fdroid-expo-research.md`.
- **Phase 1** ✅ (PR #26) — SPEC.md §4 in full: native playback, phase anchor,
  downbeats, mixer fixes. Headlessly verified.
- **Phase 2** ✅ (PR #39, merged 2026-07-24) — the RN skeleton; the 60fps rule
  is proven on device (#33 device gate PASSED).
- **Phase 3** — rebuild the tools in dependency order, one issue per PR against
  `main`. Built: the metronome with setlists and presets, the Home hub, the tuner
  (#117, #127), song import with background beat analysis (#160), the Songs and
  Stem songs screens (#178) and the stem player (#137, #177; device
  verification pending, issues open). Not built: stem speed and key (#138), a
  single-song player (§6), play along (§8), Settings (#170). Open issues are the
  backlog.

## Honesty rules

The audit that produced SPEC.md §2 found a codebase whose docs, changelog and code
comments actively misdescribed it. Some of that was written by agents. So:

- **Do not claim a milestone shipped.** Write CHANGELOG entries that are true, or
  write none. "Fixed: nothing" is a legitimate entry.
- **Comments: zero by default, in every file type (source, tests, Gradle, ProGuard, Metro/Babel/ESLint configs, CMake, YAML, shell).** Write one only when the code cannot show a non-obvious *why* (an invariant, an external gotcha), max 2 lines. No narration, no restating names or signatures, no docstrings that repeat the signature, no SPEC recaps, no change history. Shorten or delete narrating comments in code you touch. Reviewers treat a removable comment as blocking.
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
