#!/usr/bin/env bash
# Git worktree helper for agent sessions.
# Usage:
#   bash scripts/worktree.sh create <session-id> [branch]
#   bash scripts/worktree.sh remove <session-id>
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
worktree_dir="$repo_root/.claude/worktrees"

action="${1:-}"
session_id="${2:-}"
branch="${3:-feat/agent-harness}"

case "$action" in
  create)
    if [ -z "$session_id" ]; then
      echo "Usage: $0 create <session-id> [branch]" >&2
      exit 1
    fi
    target="$repo_root/../kitbag-agent-$session_id"
    if [ -d "$target" ]; then
      echo "Worktree already exists at $target" >&2
      exit 1
    fi
    git -C "$repo_root" worktree add "$target" "$branch"
    mkdir -p "$worktree_dir"
    echo "$session_id" > "$worktree_dir/$session_id"
    echo "Created worktree at $target (branch: $branch)"
    echo "cd $target"
    ;;
  remove)
    if [ -z "$session_id" ]; then
      echo "Usage: $0 remove <session-id>" >&2
      exit 1
    fi
    target="$repo_root/../kitbag-agent-$session_id"
    if [ -d "$target" ]; then
      git -C "$repo_root" worktree remove "$target"
      echo "Removed worktree at $target"
    else
      echo "Worktree not found at $target" >&2
    fi
    rm -f "$worktree_dir/$session_id"
    ;;
  list)
    echo "Active worktrees:"
    git -C "$repo_root" worktree list
    if [ -d "$worktree_dir" ] && [ "$(ls -A "$worktree_dir")" ]; then
      echo ""
      echo "Tracked sessions:"
      ls -1 "$worktree_dir"
    fi
    ;;
  *)
    echo "Usage: $0 {create|remove|list} [session-id] [branch]" >&2
    exit 1
    ;;
esac
