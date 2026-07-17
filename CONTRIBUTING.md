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

Today the C++ core is the only buildable target — the React Native app doesn't
exist yet (SPEC.md §13).

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

The RN toolchain (pnpm + Turborepo, `eslint-plugin-kitbag`, `--max-warnings 0`,
ported eval harness) lands with the app — SPEC.md §13.1 and §13.6. The ESLint
flat config, `tsconfig` and prettier config are already written and staged under
`config/` (see `config/README.md`); they wire in when the app scaffolds.

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
- **Name a number when it carries non-obvious intent** — a latency bound, a BPM
  range, a DSP threshold. **Leave shared idiom alone**: in a test,
  `60.0 / 120.0 * kSampleRate` reads better than a named constant, and naming only
  your line would be its own inconsistency.
- **C++ method naming is Google's accessor exception** — `PascalCase` for actions
  (`Start`, `SetTempo`), `snake_case` for accessors mirroring state (`is_running`,
  `bar_phase`). The linter can't express this without false-positiving accessors.
- **Files ≤ ~400 lines.** C++20 core, strict TypeScript.
