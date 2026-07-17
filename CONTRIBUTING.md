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
3. PRs against `main`. Conventional commit subjects (`feat:`, `fix:`, `chore:`);
   the body explains *why* when non-obvious.

The RN toolchain (pnpm + Turborepo, ESLint flat config with
`eslint-plugin-kitbag`, `--max-warnings 0`, ported eval harness) lands with the
app — SPEC.md §13.1 and §13.6.

## Code style

- **C++**: C++17, `-Wall -Wextra` clean, Google-ish naming (see existing files).
- **TypeScript**: strict. Files ≤ ~400 lines.
- **Comments only where the code can't say it** — constraints, invariants, and
  *why*. Never restate what the next line does, and **never describe intent as
  behaviour**: a comment claiming title/artist similarity matching sat above a loop
  returning the first result, and it outlived the bug long enough to mislead a
  design file.
