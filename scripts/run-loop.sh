#!/usr/bin/env bash
# Driver for the stateless `project-loop` skill.
#
# Each `claude -p` invocation is a fresh, zero-context process: it reconstructs
# state from disk (SPEC.md, docs/phase1-tracker.md, GitHub issues, docs/decisions.md,
# git log), runs ONE FULL WAVE to completion, commits, and exits. Context never
# accumulates. A wave is atomic — dispatch → review → fix → wave-gate → merge →
# persist — run synchronously via blocking Agent subagents, never backgrounded.
#
#   ./scripts/run-loop.sh            # one wave, foreground, watched (default)
#   ./scripts/run-loop.sh --unattended   # wave after wave until a stop-point exits non-zero
#
# For an unattended run, detach it so a closed terminal / ssh drop / sleep can't
# kill the loop mid-wave:
#   nohup bash scripts/run-loop.sh --unattended > loop.log 2>&1 &
#
# Live visibility: streams every event (tool call + reasoning) as it happens via
# --output-format stream-json, formatted readably here. Raw NDJSON is tee'd to
# stream-<ts>.jsonl so nothing is lost. The heavy work runs in subagents, so you see
# the orchestration live and each subagent's returned result — not every keystroke
# inside a subagent.
#
# Stop-points (non-zero exit -> the --unattended loop breaks and hands back):
#   SPEC ambiguity/contradiction · on-device gate (§13.3) · design sign-off ·
#   a task failing gates twice · nothing left to do. See the skill for the full list.

set -euo pipefail
cd "$(dirname "$0")/.."

PROMPT="/project-loop — run ONE full wave to completion, then stop. Dispatch all \
parallel tracks in a single multi-Agent message (blocking — the Agent tool runs them \
concurrently); when they return, review (ralph + code-reviewer), fix, run the wave gate \
on the integrated tree, merge to the feature branch, persist (issues, tracker, \
changelog), remove spent worktrees. Do NOT exit while any dispatched work is unfinished. \
NEVER spawn background 'claude -p' workers or poll for their commits across invocations. \
Exit only when the wave is fully integrated, or at a real stop-point."

# The loop edits files, builds (cmake), runs verify binaries, commits, and drives
# gh + subagents. Bash cannot be finely scoped here — it runs cmake, git, gh, cp,
# md5sum, the *_verify binaries, and compound for-loops — so it is allowed wholesale.
# acceptEdits auto-accepts Edit/Write. Task dispatches the domain agents + reviewers.
ALLOWED=(Bash Edit Write Read Grep Glob Task Skill)

# Colored, tagged live feed with a pinned stats footer — see scripts/loop_fmt.py.
# `uv run` reads the script's PEP 723 header and resolves rich (cached after first run).
FMT="$(dirname "$0")/loop_fmt.py"

run_one() {
  local ts raw
  ts=$(date +%Y%m%d-%H%M%S)
  raw="stream-$ts.jsonl"
  claude -p "$PROMPT" \
    --permission-mode acceptEdits \
    --allowedTools "${ALLOWED[@]}" \
    --output-format stream-json --verbose \
    | tee "$raw" \
    | uv run "$FMT"
  return "${PIPESTATUS[0]}"   # claude's exit, not uv's — drives the loop
}

# Keep the remote current: push after each completed wave. A wave that committed
# but couldn't push (transient network) must not kill the loop.
push_head() {
  if git push -u -q origin HEAD 2>/dev/null; then
    echo "Pushed $(git rev-parse --abbrev-ref HEAD) -> origin." >&2
  else
    echo "Push failed (remote not updated); continuing." >&2
  fi
}

# Ctrl-C exits the whole run cleanly — no Python traceback from the formatter.
trap 'echo "Interrupted." >&2; exit 130' INT

if [[ "${1:-}" == "--unattended" ]]; then
  echo "Unattended run. Raw streams -> stream-*.jsonl. Ctrl-C to stop." >&2
  while :; do
    run_one || { echo "Stop-point or done (exit $?). Handing back." >&2; break; }
    push_head
  done
else
  run_one && push_head
fi
