# Kitbag — Agent Workflow Guide

## Monorepo layout

Pub workspace at root. Key packages:

| Package | Role |
|---------|------|
| `app_shell` | Flutter entrypoint, router, registry |
| `core_plugin_api` | Abstract plugin contract — no infra deps |
| `core_services` | Concrete Riverpod providers |
| `core_audio_ffi` | FFI bindings to C++ audio core |
| `core_design` | Theme, tokens, shared widgets |
| `tool_*` | Plugin tools (metronome, tuner, etc.) |
| `custom_lint_kitbag` | Architecture-enforcing custom lint rules |

## Architecture rules (custom_lint enforces these)

- `dart:ffi` only in `core_audio_ffi`
- Riverpod providers only in `core_services`
- `core_plugin_api` must not import `app_shell` or `tool_*`
- PascalCase for both filenames and class names

## PostToolUse: auto-verify after edits

After every `Write` or `Edit` tool call, run lint checks to catch regressions:

```bash
bash scripts/lint_check.sh
```

This runs `dart analyze` on `custom_lint_kitbag` and `dart run custom_lint` on `app_shell`.
If either fails, fix the specific violations before the next tool call.

Note: `dart run custom_lint` has `--fatal-infos` on by default — exit code 1 even for INFO-level violations.

## Ralph loop: feedback→refine

After implementing or changing anything non-trivial, run the Ralph loop before
presenting to the human:

1. Self-review your work first (run lint checks, verify correctness)
2. Invoke `@ralph` to review — describe what you built and why
3. Read Ralph's feedback, fix the issues
4. Iterate until Ralph passes you

Ralph is a peer reviewer with `edit: deny` permission — can inspect and critique
but cannot change files.

## Eval harness: scoring agent changes

Before/after any change to lint rules or agent configuration, run the eval to
check for regressions:

```bash
bash packages/app_shell/eval/run.sh
```

The harness runs `dart run custom_lint` against `eval/*.dart` scenario files
and scores each:
- `*_pass.dart` — must produce zero diagnostics
- `*_fail.dart` — must produce at least one diagnostic
- `PascalCaseFileFail.dart` — special case (filename-based diagnostic at offset 0)

All 7 scenarios must pass before submitting work.

## Git worktrees

Each agent session gets an isolated git worktree to avoid conflicts:

```bash
bash scripts/worktree.sh create <session-id> main
cd ../kitbag-agent-<session-id>
# git checkout -b my-feature
# ... make changes, commit, push ...
bash scripts/worktree.sh remove <session-id>
```

## Running checks

```bash
# Specific package:
cd packages/<pkg> && dart analyze lib/

# Custom lint rules:
cd packages/app_shell && dart run custom_lint

# Combined:
bash scripts/lint_check.sh

# Eval:
bash packages/app_shell/eval/run.sh
```
