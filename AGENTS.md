# Kitbag — Agent Workflow Guide

> **One file, every harness.** Claude Code and the other agent harnesses used here
> read `AGENTS.md` directly. A `CLAUDE.md` or `CLAUDE.local.md` would replace
> this file for Claude Code, so the repo has neither.

> **`SPEC.md` is the source of truth**, and the only planning document. If this
> file or `CHANGELOG.md` disagrees with it, SPEC.md wins and the other is a bug.
> Read SPEC.md §2 before believing any status claim in the repo: the 2026-07-17
> audit found docs and a changelog that described a product that did not exist.

## Working on a task

Every task starts as a GitHub issue with written-down acceptance criteria, because
criteria are what keep a status claim checkable and a review more than an argument.

1. **Issue first.** The title states the observed defect or the desired
   behaviour, not the diagnosis. The body carries `## Acceptance criteria` as a
   checklist.
2. **Read the spec, not the ticket alone.** The issue points at SPEC.md sections
   and, for anything with a screen, the binding file in `design/` (§12 gives the
   precedence).
3. **Verify it, and say what you ran.** A green gate is a claim; its output is the
   evidence. A criterion that needs a device needs a device: the JNI/TurboModule
   chain was broken from M1 to M3 while every headless gate stayed green.
4. **Close the issue against its criteria**, ticking only what is true.

### Repeatable actions belong in a script

An action done more than once (building, installing, running the gates, cutting a
release) goes in `scripts/`, since a remembered command sequence drifts and the
forgotten step is the gate that silently stops running. Scripts take
`-h|--help`, use named exit codes and print what failed. `ls scripts/` is the
inventory.

Two carry the working loop:

```sh
bash scripts/preflight.sh            # every gate CI runs but TSan, plus auto-fixes
bash scripts/preflight.sh --no-fix   # check only, as CI does
bash scripts/preflight.sh --tsan     # adds CI's TSan gate (a second native build)
bash scripts/install-on-device.sh    # build, install, launch, report signing + runtime state
```

`preflight.sh` passes before a commit. It collects every failure rather than
stopping at the first, and reports the files it rewrote, which need committing or
CI still fails. A fix that rewrites files re-runs the earlier gates that read
them, so exit 0 covers the rewritten tree. `--skip-android` and `--skip-native`
drop the slow legs.

### Cutting a release

Every merge to `main` publishes. `.github/workflows/release.yml` computes the
next version, builds a release APK signed with the release key (Actions secrets),
gates it with `scripts/release-gate.sh` (pinned certificate in
`packages/app-shell/android/app/release-cert.sha256`, `versionName`,
`versionCode`) and publishes GitHub release `vX.Y.Z` with the APK and its
sha256. The tag is the version source, passed to Gradle as `-PkitbagVersionName`.

Nothing is pushed to `main`. The job runs `scripts/release-notes.sh`, commits
`metadata/en-US/changelogs/<versionCode>.txt` as `github-actions[bot]` on a
commit whose parent is the merged `main` commit, and tags that commit. The APK,
the gate and the release are all built from it, because F-Droid builds the tagged
tree. Only the tag is pushed, after the gate passes; a failed or cancelled publish
deletes it again unless a published release holds it. `version.sh` needs nothing
special: the tag commit's history contains its `main` parent, so `<tag>..HEAD`
is exactly the later `main` commits. Only `changelog.sh`'s full regeneration
re-tags each release at its parent, because git-cliff only sees tags in HEAD's
history.

- **Next version**: `scripts/version.sh next`, over the commits since the latest
  `vX.Y.Z` tag. Breaking (`!` or `BREAKING CHANGE`) bumps major, or minor below
  1.0.0; `feat` bumps minor; everything else bumps patch. With no tag yet the
  version is `app.json`'s. A re-run with no new commits skips.
- **Floor**: `packages/app-shell/app.json` `expo.version` is the minimum. To
  force a jump (say 1.0.0), raise it with `scripts/version.sh set 1.0.0` in a PR.
- **versionCode**: formula and bounds in `scripts/version.sh code --help`. Gradle
  and `version.sh next` refuse anything out of bounds; raise the floor to the
  next minor or major instead.
- **Concurrency**: releases run one at a time. A run still waiting when a newer
  push arrives is dropped; the newer run's range covers its commits.

Local builds stay debug-signed unless `ANDROID_KEYSTORE_*` is set (see
`.env.example`). The `scripts/*.test.sh` files cover the version rule, the
gate and the notes.

### Commits and PRs

Commit subjects are conventional (CONTRIBUTING.md "Workflow" has the types and
why): `cliff.toml` turns them into `CHANGELOG.md`, and a mislabelled subject
lands in the wrong section. The body explains *why* when it is not self-evident.

A PR states what changed, copies the issue's acceptance criteria with only the
satisfied ones ticked, and records verification plainly: what was run, what it
printed, and what still needs a device.

A UI PR adds or updates a flow under `e2e/flows/` for each device item a script
can check, and names the flows it ran. Items that need real audio, hearing or a
physical phone go in the body's "Still needs the device" list.

Every PR body carries a ` ```release-note ` block: one user-facing line, what a
musician notices in plain words, or `NONE` for an internal change.
`scripts/release-notes.sh` turns the blocks into the F-Droid changelog, so
F-Droid users read these lines verbatim and they have to be true. The
`Release note` check (`.github/workflows/release-note.yml`) fails a PR without
one and is required on `main`. A bot's PR passes as `NONE`.

## What is in this repo

The stack is React Native + TypeScript over a C++ core (SPEC.md §13); the Flutter
app was deleted on 2026-07-17.

| Path | What it is |
|------|-----------|
| `native/audio_core/` | The C++ realtime core: flat C ABI in `include/kitbag_api.h` and the `kitbag_*_api.h` headers beside it, miniaudio backend (SPEC.md §4). `tools/` holds the headless `*_verify` harnesses. |
| `packages/` | The app: pnpm workspaces + Turborepo. `app-shell` (Expo Router shell, Home, Settings), `core-native` (JSI HostObject + TurboModule, the only native-binding package), `core-state` (Zustand stores), `core-db` (Drizzle on op-sqlite; `SCHEMA_VERSION` in `src/migrate.ts`, upgrade floor in SPEC.md §11.1), `core-plugin-api` (the abstract contract), `core-design` (tokens and shared components), `eslint-plugin-kitbag`, and the tools `tool-metronome`, `tool-library` (songs, stem songs, the single-song player), `tool-stems` (stem player), `tool-tuner` and `tool-sync` (play along, a skeleton). |
| `SPEC.md` | Product and technical spec. §17 records the locked decisions; §17.1 what is still open. |
| `design/` | The binding HTML design specs. SPEC.md §12 gives precedence and which variant of a multi-variant file binds. |
| `legacy/` | `android/MediaSessionPlugin.kt` + `AndroidManifest.xml`, the Flutter-era media-session detection that play along (§8.2, §13.9) still has to port into the skeleton `MediaNotificationListenerService.kt`. Reference only, never a build input; delete it once that port lands. |
| `docs/` | `decisions.md` (rulings on what SPEC.md leaves open), `tuner-functional-spec.md`, `tuner-research.md` (read its warning banner before touching the tuner), research notes, and `archive/` (historical only). |
| `e2e/` | Maestro device flows: `flows/` one per checked behaviour, `subflows/` shared steps, and the fixture generators `make_click_song.py` and `make_stem_bundle.py` that `scripts/e2e.sh` pushes. Dev-only; nothing here enters the APK. |
| `scripts/` | `preflight.sh` (the CI gate set locally), `version.sh`, `release-gate.sh`, `verify-apk-signature.sh`, `release-notes.sh` and `changelog.sh` (the release path), `install-on-device.sh`, `e2e.sh` + `install-maestro.sh` (device flows), `lint.sh`, `format.sh` and `install-hooks.sh` (lint gate), `tsan-check.sh` (the TSan retire-race gate), `web-check.sh` (web bundle free of native-only modules), `soak-analyze.sh` (judges a recorded metronome against its grid), `build-icons.sh` (launcher and splash rasters from `design/kitbag-mark.svg`), and a `*.test.sh` beside each script that has tests. |

## Building and verifying

```bash
# Native core
cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
cmake --build native/audio_core/build
./native/audio_core/build/metronome_verify   # and every other *_verify target

# TS workspace
pnpm -w typecheck       # turbo run typecheck
pnpm -w lint            # eslint . --max-warnings 0
pnpm -w test            # vitest via turbo
pnpm -w format          # prettier --check .
pnpm -w generate:check  # generation drift guards (SPEC.md §13.7)
```

The `*_verify` tools render audio offline and assert against it in about a
second each, with no app and no device, which makes them the cheapest signal in
the project. CMakeLists.txt defines them; `preflight.sh`'s "Native verify tools"
loop and CI's `native` job run the full set. Every one is a gate, `tuner_verify`
included (it failed 37/37 until #117 replaced the detector), and a failing check
is fixed in the code, never loosened. Gate on the build's exit code before
reading their output, since a failed build leaves the old binary to report a
stale pass. They say nothing about a real mic or
speaker (SPEC.md §10.1, §10.3); those need a device.

### Device flows

`e2e/flows/` holds one Maestro flow per device-checked behaviour, driven through
accessibility labels. Maestro installs its own driver APKs at test time, so
nothing enters the app's APK or manifest.

```sh
bash scripts/install-maestro.sh            # pinned Maestro CLI into ~/.maestro, sha256-checked
bash scripts/e2e.sh <apk> [flow|dir ...]   # emulator-5554 unless --device; --help
```

`e2e.sh` turns off Maestro's analytics and update check. Notification permission
belongs to the flows' `launchApp`, since clearing state resets it.

CI runs the flows on API 35 x86_64 emulators when app code, a subflow or a flow
changes: all of them, or only the changed flows, split over four shards that
`e2e/shards` balances by CI time. A new flow goes on the shard with the shortest
total, or the job fails. Each shard uploads `e2e-results-shard-N` with the JUnit
report and Maestro's output, plus the failure screenshot and logcat. New screens,
and anything a flow cannot assert, still get checked on the local emulator.

## Lint and format

```sh
bash scripts/install-hooks.sh   # once per clone; pre-commit runs lint.sh --staged
bash scripts/lint.sh --staged   # the staged files; no flag lints the whole tree, as preflight does
bash scripts/format.sh          # clang-format and prettier, in place
```

`lint.sh` runs clang-format, clang-tidy and the 400-line file limit over the C++
core, then eslint over the TS/JS workspace. clang-tidy needs the compile DB
(configure once with `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`). Lint what you touched
while working: the whole-tree run belongs to preflight, and CI runs only its
eslint half (`pnpm -w lint`).

The root `eslint.config.mjs` carries the generic rules and the §13.1 import
zones. `packages/eslint-plugin-kitbag` and its eval harness
(`packages/app-shell/eval/`) carry the §13.6 rules against scenario fixtures.
Parts of the root config are documented stopgaps for rules that plugin will own,
so read its comments before changing them. CONTRIBUTING.md "Code style" maps each
config to what it gates and lists the judgment layer no linter checks.

## Architecture rules

SPEC.md §9.4 and §13.1 define the boundaries, and `eslint.config.mjs` enforces
the import zones. One rule is not a boundary but holds the architecture up
(SPEC.md §4.5, §13.3): 60fps values (the beat sweep, the tuner needle) never pass
through React state; Reanimated worklets read the JSI HostObject on the UI thread.

## Agents and the Ralph loop

The agents live in `.claude/agents/`. Implementation goes to the specialist for
its layer, because each carries a rubric a general agent lacks:
`audio-core-engineer` for C++ in `native/audio_core`, `rn-engineer` for
React Native and TS in `packages/`.

After a non-trivial change, before the owner sees it:

1. Self-review: build, run the gates the change can affect (above), run
   `bash scripts/lint.sh --staged`, and check the issue's criteria.
2. Run `ralph` (correctness and SPEC.md conformance) and, for a code change,
   `code-reviewer` (CONTRIBUTING.md's judgment layer: comments, magic values,
   readability, smells). Tell each what you built and why.
3. Fix what holds up, and iterate until both pass.

Where you disagree with a nit, note it and move on.

## Git worktrees

```bash
git fetch origin
git worktree add .claude/worktrees/<name> -b <branch> origin/main
# ... work, commit, push, open a PR against main ...
git worktree remove .claude/worktrees/<name>
```

Work happens in worktrees branched from a fresh `origin/main`, so the main
checkout's branch and uncommitted files stay untouched.

## What to work on

SPEC.md §15 is the sequencing, and the open issues are the backlog. Phases 0–2
are closed (PRs #26, #39; the 60fps device gate passed in #33). Phase 3 rebuilds
the tools, one issue per PR against `main`. As of 2026-11-20:

- **Built:** the metronome with setlists, presets and custom click sounds, the
  Home hub, the tuner, song import with background beat analysis, the single-song
  player, the stem player with speed and key in the core, and a Settings screen
  whose issue (#170) is still open for the settings it lacks.
- **Not started:** play along (§8); `tool-sync` is a skeleton.
- **Open work:** `gh issue list --state open` is the current list; among it are
  single-song background playback (#237), stem speed and key controls (#328) and
  stem songs on the phone (#134).
- **Owed:** the phone checks for merged features (#516).

## Honesty rules

The audit behind SPEC.md §2 found docs, changelog and comments that misdescribed
the code, some written by agents. So:

- **Claim only what shipped.** Write CHANGELOG entries that are true, or none;
  "Fixed: nothing" is a legitimate entry.
- **Comments: zero by default, in every file type (source, tests, Gradle, ProGuard, Metro/Babel/ESLint configs, CMake, YAML, shell).** Write one only when the code cannot show a non-obvious *why* (an invariant, an external gotcha), max 2 lines. No narration, no restating names or signatures, no docstrings that repeat the signature, no SPEC recaps, no change history. Shorten or delete narrating comments in code you touch. Reviewers treat a removable comment as blocking.
- **A comment claims only behaviour the code has.** A comment once promised
  similarity matching over a loop that returned the first result, and it
  survived long enough to reach a design file.
- **One definition per constant** (SPEC.md §13.7). A screen once declared its own
  sound names, mislabelled every sound from index 2 up, and the error reached
  `design/kitbag-metronome.html`.
- **Measure, don't demo.** Every failure in §2 is one a demo would not have
  revealed.
