# Contributing to Kitbag

## Ground rules

- **One tool = one package.** New functionality lands as a `ToolPlugin`
  package under `packages/`, not as additions to the shell.
- **The audio callback is sacred.** No allocation, no locks, no logging on
  the realtime thread. Commands in via lock-free rings, data out via polled
  buffers.
- **Experience rules are acceptance criteria.** Section 06 of
  `design/kitbag-ui.html` (48dp targets, <400ms feedback, no dead ends,
  gesture twins, empty-state CTAs) applies to every screen.
- **No caps, no paywalls, no telemetry.** Ever.

## Workflow

1. `dart pub get` at the repo root (pub workspace).
2. `dart run melos analyze` and `dart run melos format` must pass.
3. Native changes: `cmake --build native/audio_core/build` and run
   `tone_test` locally.
4. PRs against `main`, conventional commit subjects (`feat:`, `fix:`,
   `chore:`), body explains *why* when non-obvious.

## Code style

- Dart: `flutter_lints` + repo `analysis_options.yaml`; files ≤ ~400 lines.
- C++: C++17, `-Wall -Wextra` clean, Google-ish naming (see existing files).
- Comments only where the code can't say it (constraints, invariants).
