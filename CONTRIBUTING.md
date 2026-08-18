# Contributing to Kitbag

**[SPEC.md](SPEC.md) is the source of truth.** Read §2 before believing any status
claim in this repo, and §15 for what to work on.

## Ground rules

- **One tool = one package.** New functionality lands as a plugin implementing the
  `ToolPlugin` contract, not as additions to the shell (SPEC.md §9).
- **The audio callback is sacred.** No allocation, no locks, no logging, no
  syscalls on the realtime thread. Commands in via lock-free rings, data out via
  polled reads (SPEC.md §4.5).
- **Never stream 60fps values through the reactive graph.** The beat sweep and
  tuner needle don't touch `useState` — they're Reanimated worklets reading the
  JSI HostObject on the UI thread. Not an optimisation; it's why the architecture
  holds (SPEC.md §13.3).
- **One definition per cross-boundary constant.** Sound names, `kMaxTracks`, the
  accent enum, result codes, latency bounds. Generate from the header or expose
  through the TurboModule — never retype. An invented sound list mislabelled every
  sound from index 2 up and reached a design file (SPEC.md §13.7).
- **Experience rules are acceptance criteria.** SPEC.md §12.6 — ≥48dp targets,
  <400ms feedback, no dead ends, every gesture has a visible twin, empty states as
  CTAs, no colour-only feedback. Every screen, every milestone.
- **No caps, no paywalls, no telemetry.** Ever.
- **Measure, don't demo.** Every failure the audit found is something a demo would
  not have revealed. If an acceptance criterion says *measured*, a video isn't it.

## Workflow

Two buildable targets: the C++ core (CMake) and the React Native app (pnpm +
Turborepo + Gradle). Both have gates, and they are separate.

**Open an issue before you start**, with `## Acceptance criteria` in the body, and
put anything you will run twice into `scripts/`. [AGENTS.md](AGENTS.md) holds the
full working contract and the reasons behind it.

1. Native changes: build and run the verify tools.
   ```sh
   cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
   cmake --build native/audio_core/build
   ./native/audio_core/build/metronome_verify   # must stay green
   ```
2. `tuner_verify` fails 37/37 today (SPEC.md §10.1) and is informational in CI.
   **Don't make it pass by loosening it.**
3. Before committing, run the lint gate (or install the hook so it runs itself):
   ```sh
   bash scripts/install-hooks.sh   # once per clone — pre-commit runs the gate
   bash scripts/lint.sh --staged   # what the hook runs; --staged = touched files
   bash scripts/format.sh          # fix formatting in place
   ```
   The hook lints staged files only, so drift in a file you didn't touch never
   blocks you — but touching a file means bringing it into conformance. The
   clang-tidy step needs the compile DB (configure once with
   `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`).
4. PRs against `main`. Conventional commit subjects (`feat:`, `fix:`, `chore:`);
   the body explains *why* when non-obvious.

TS/React changes run their own gate set, all of which CI also runs:

```sh
pnpm -w typecheck        # turbo run typecheck — 12/12 packages
pnpm -w lint             # eslint . --max-warnings 0
pnpm -w test             # vitest via turbo
pnpm -w format           # prettier
pnpm -w generate:check   # generation drift guards (SPEC.md §13.7)
```

Anything that reaches a screen or the native boundary needs a device before it can
be called done. A green build does not prove the JNI/TurboModule chain is intact —
it was broken from M1 to M3 while every headless gate stayed green.

## Code style

Style is **enforced by config, not honour** — where this section and a config
could disagree, the config wins, because it is the one that runs.

| Area | Config | Gates |
|---|---|---|
| C++ format | `native/audio_core/.clang-format` | Google style, **C++20**, 2-space, 80-col, pointer-left |
| C++ static | `native/audio_core/.clang-tidy` | Naming (members `_`, `kConstant`, `CamelCase` types), **magic numbers**, lean bugprone/perf. Naming + magic numbers gate; rest advisory |
| C++ tests | `native/audio_core/tools/.clang-tidy` | Same, minus magic numbers — fixtures use literal scenario values by design |
| TS/React | `config/` | Staged until the app exists (SPEC §13.6) |

What a linter **can't** check — enforced by the `code-reviewer` agent, which reads
these as its rubric (distinct from `ralph`, which reviews correctness/spec; run
both, see the Ralph loop in `CLAUDE.md`):

- **Comment only the constraint the code can't show** — an ordering reason, an
  epsilon's purpose, why a counter is monotonic. **Never restate the next line,
  never describe intent as behaviour**: a comment claiming title/artist similarity
  matching sat above a loop returning the first result, and it outlived the bug
  long enough to mislead a design file.
- **Three checks before you write a comment.** (1) *Is this why already written at
  the definition?* Rationale belongs there, once — `audio_source_drain.h` restated
  `RampSamples`' own docstring, and two copies of a why are free to drift apart.
  (2) *Am I patching a signature?* `Drain(source, block, start_sample)` took frames
  and samples in adjacent parameters, so prose had to carry the units and three call
  sites did the multiply by hand — put the units in the name instead. (3) *Would a
  rename absorb it?* Then rename. A name carries **what**; only prose carries
  **why** — never try to name a rationale, and never comment what a name would say.
- **An unnameable function is a merged one.** When no verb fits, it is usually two
  functions: `VerifyBlock` checked ramp order over one span and silence over
  another, unrelated properties, which is why the name went vague. Split it before
  reaching for a clarifying comment.
- **Name a number when it carries non-obvious intent** — a latency bound, a BPM
  range, a DSP threshold. **Leave shared idiom alone**: in a test,
  `60.0 / 120.0 * kSampleRate` reads better than a named constant, and naming only
  your line would be its own inconsistency.
- **C++ method naming is Google's accessor exception** — `PascalCase` for actions
  (`Start`, `SetTempo`), `snake_case` for accessors mirroring state (`is_running`,
  `bar_phase`). The linter can't express this without false-positiving accessors.
- **Files ≤ ~400 lines.** C++20 core, strict TypeScript.
