#!/usr/bin/env bash
# Driver for the stateless `project-loop` skill.
#
# Each `claude -p` invocation is a fresh, zero-context process: it reconstructs
# state from disk (SPEC.md, docs/phase1-tracker.md, GitHub issues, docs/decisions.md,
# git log), does ONE increment, commits, and exits. Context never accumulates.
#
#   ./scripts/run-loop.sh            # one increment, foreground, watched (default)
#   ./scripts/run-loop.sh --unattended   # loop until a stop-point exits non-zero
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

PROMPT="/project-loop one increment then stop"

# The loop edits files, builds (cmake), runs verify binaries, commits, and drives
# gh + subagents. Bash cannot be finely scoped here — it runs cmake, git, gh, cp,
# md5sum, the *_verify binaries, and compound for-loops — so it is allowed wholesale.
# acceptEdits auto-accepts Edit/Write. Task dispatches the domain agents + reviewers.
ALLOWED=(Bash Edit Write Read Grep Glob Task Skill)

# Turn one stream-json event into one readable line. Unknown/quiet events -> nothing.
FMT='
  if .type=="assistant" then
    (.message.content[]? |
      if .type=="text" then (.text | select(length>0))
      elif .type=="tool_use" then
        "  → " + .name + "(" + ((.input.command // .input.description // .input.prompt // (.input|tostring)) | gsub("\n";" ") | .[0:140]) + ")"
      else empty end)
  elif .type=="user" then
    (.message.content[]? | select(.type=="tool_result") |
      "    ⤷ " + ((.content // "" | if type=="array" then (map(.text // "")|join(" ")) else tostring end) | gsub("\n";" ") | .[0:140]))
  elif .type=="result" then
    "\n=== " + (.subtype // "end") + "  ($" + ((.total_cost_usd // 0)|tostring) + ", " + ((.num_turns // 0)|tostring) + " turns) ===\n" + (.result // "")
  else empty end
'

run_one() {
  local ts raw
  ts=$(date +%Y%m%d-%H%M%S)
  raw="stream-$ts.jsonl"
  claude -p "$PROMPT" \
    --permission-mode acceptEdits \
    --allowedTools "${ALLOWED[@]}" \
    --output-format stream-json --verbose \
    | tee "$raw" \
    | jq -rj --unbuffered "$FMT + \"\n\""
  return "${PIPESTATUS[0]}"   # claude's exit, not jq's — drives the loop
}

if [[ "${1:-}" == "--unattended" ]]; then
  echo "Unattended run. Raw streams -> stream-*.jsonl. Ctrl-C to stop." >&2
  while :; do
    run_one || { echo "Stop-point or done (exit $?). Handing back." >&2; break; }
  done
else
  run_one
fi
