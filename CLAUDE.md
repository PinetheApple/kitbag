# Kitbag — Agent Workflow Guide

> **Claude Code config.** For opencode, see `AGENTS.md` instead.
> Both files stay in sync — prefer editing AGENTS.md.

## PostToolUse: auto-verify after edits

After every `Write` or `Edit` tool call, run lint checks to catch regressions:

```bash
bash scripts/lint_check.sh
```

This runs `dart analyze` on all Melos packages and `dart run custom_lint` on `app_shell`.
If either fails, fix the specific violations before the next tool call.

Note: `dart run custom_lint` has `--fatal-infos` on by default — exit code 1 even for INFO-level violations.

## Monorepo layout

Melos workspace at root. Key packages:

| Package | Role |
|---------|------|
| `app_shell` | Flutter entrypoint, router, registry |
| `core_plugin_api` | Abstract plugin contract — no infra deps |
| `core_services` | Concrete Riverpod providers |
| `core_audio_ffi` | FFI bindings to C++ audio core |
| `core_design` | Theme, tokens, shared widgets |
| `tool_*` | Plugin tools (metronome, tuner, etc.) |
| `custom_lint_kitbag` | Architecture-enforcing custom lint rules |

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

Add new scenario files as needed when adding rules or edge cases.
All 7 scenarios must pass before submitting work.

## Ralph loop: feedback→refine

After implementing or changing anything non-trivial, run the Ralph loop before
presenting to the human:

1. Self-review your work first (run lint checks, verify correctness)
2. Invoke `@ralph` to review — describe what you built and why
3. Read Ralph's feedback, fix the issues
4. Iterate until Ralph passes you

Ralph is a peer reviewer (`.claude/agents/ralph.md`). He's thorough but fair.
If you disagree with a nit, note it and move on — don't over-rotate.

## Rules

- `dart:ffi` only in `core_audio_ffi`
- Riverpod providers only in `core_services`
- `core_plugin_api` must not import `app_shell` or `tool_*`
- PascalCase for both filenames and class names

## Running checks

```bash
# All Dart analysis:
dart analyze lib/  # per package, from package dir
melos run analyze  # all packages

# Custom lint rules:
cd packages/app_shell && dart run custom_lint

# Combined:
bash scripts/lint_check.sh
```

## Worktree pattern

Each agent session gets an isolated git worktree to avoid conflicts.
Use the helper script rather than raw `git worktree` commands:

```bash
# Create a worktree on a new branch (derived from main):
bash scripts/worktree.sh create <session-id> main

# Example:
bash scripts/worktree.sh create a4f2593c main
# → creates ../kitbag-agent-a4f2593c/ from main

# Work in the worktree:
cd ../kitbag-agent-a4f2593c
# git checkout -b my-feature
# ... make changes, commit, push ...

# Remove worktree when done:
bash scripts/worktree.sh remove a4f2593c

# List active worktrees:
bash scripts/worktree.sh list
```

The script is a thin wrapper around `git worktree add/remove` with:
- Error handling (won't clobber existing worktrees)
- Session tracking in `.claude/worktrees/`
- Consistent naming convention: `../kitbag-agent-<session-id>/`

The main checkout stays on the feature branch. Agent worktrees branch off
main so they don't collide with the main checkout.
