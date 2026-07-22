#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = ["rich>=13"]
# ///
"""Format `claude -p --output-format stream-json` into a colored, tagged live feed.

Reads NDJSON on stdin (one event per line) and prints one scannable line per
event above a pinned stats footer (context peak, tokens, elapsed). Run via
`uv run` so rich resolves without a manual install. Used by scripts/run-loop.sh.
When stdout is not a TTY (e.g. redirected to a file) the footer is skipped.
"""

import json
import sys
import time

from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.text import Text

RESET = "\033[0m"

TOOL_TAGS = {
    "Bash": ("BASH", "30;43"),
    "Read": ("READ", "30;44"),
    "Grep": ("GREP", "30;44"),
    "Glob": ("GLOB", "30;44"),
    "Edit": ("EDIT", "30;42"),
    "Write": ("WRITE", "30;42"),
}
SUBAGENT_TOOLS = {"Task", "Agent"}

TOOL_INDENT = "  "       # tool calls nest under their NOTE
RESULT_INDENT = "      "  # results nest under their tool call

# Running totals across the stream, printed in the bottom summary.
STATS = {"context": 0, "in": 0, "out": 0, "cache_read": 0}


def sgr(code, text):
    return f"\033[{code}m{text}{RESET}"


def human_num(n):
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}k"
    return str(n)


def human_time(secs):
    if secs < 60:
        return f"{secs}s"
    return f"{secs // 60}m {secs % 60:02d}s"


def track_usage(usage):
    STATS["in"] += usage.get("input_tokens", 0)
    STATS["out"] += usage.get("output_tokens", 0)
    STATS["cache_read"] += usage.get("cache_read_input_tokens", 0)
    # Context = the largest prompt the model held at once, not the running sum.
    window = (
        usage.get("input_tokens", 0)
        + usage.get("cache_read_input_tokens", 0)
        + usage.get("cache_creation_input_tokens", 0)
    )
    STATS["context"] = max(STATS["context"], window)


def tag(label, code):
    return sgr(code, f" {label} ")


def clip(text, limit):
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit] + "…"


def stamp():
    return sgr("90", f"[{time.strftime('%H:%M:%S')}]") + " "


def tool_line(block):
    name = block.get("name", "?")
    args = block.get("input", {})
    if name in SUBAGENT_TOOLS:
        agent = args.get("subagent_type", "?")
        detail = args.get("description") or args.get("prompt") or ""
        return stamp() + tag(f"TASK → {agent}", "1;30;46") + " " + clip(detail, 90)
    label, code = TOOL_TAGS.get(name, (name.upper(), "30;47"))
    detail = (
        args.get("command")
        or args.get("description")
        or args.get("file_path")
        or json.dumps(args)
    )
    return stamp() + tag(label, code) + " " + clip(detail, 140)


def result_body(content):
    if isinstance(content, list):
        return " ".join(part.get("text", "") for part in content)
    return str(content)


def render(event):
    etype = event.get("type")
    if etype == "system" and event.get("subtype") == "init":
        yield stamp() + tag("START", "1;35") + " session"
    elif etype == "assistant":
        track_usage(event["message"].get("usage", {}))
        for block in event["message"]["content"]:
            if block["type"] == "text" and block["text"].strip():
                # NOTE starts a group: blank line above, flush left.
                yield "\n" + stamp() + tag("NOTE", "97;45") + " " + clip(block["text"], 200)
            elif block["type"] == "tool_use":
                yield TOOL_INDENT + tool_line(block)
    elif etype == "user":
        for block in event["message"]["content"]:
            if block.get("type") == "tool_result":
                body = clip(result_body(block.get("content", "")), 130)
                errored = block.get("is_error")
                yield RESULT_INDENT + sgr("91" if errored else "90", f"{'✗' if errored else '└'} {body}")
    elif etype == "result":
        track_usage(event.get("usage", {}))
        secs = int(event.get("duration_ms", 0) / 1000)
        cost = round(event.get("total_cost_usd", 0), 2)
        summary = f"✓ {event.get('subtype', 'end')}  ·  {human_time(secs)}  ·  {event.get('num_turns', 0)} turns  ·  ${cost}"
        stats = (
            f"context {human_num(STATS['context'])}"
            f"  ·  in {human_num(STATS['in'])}"
            f"  ·  out {human_num(STATS['out'])}"
            f"  ·  cache {human_num(STATS['cache_read'])} read"
        )
        rule = "═" * max(len(summary), len(stats))
        body = sgr("1;32", rule) + "\n" + sgr("1;32", summary) + "\n" + sgr("32", stats) + "\n" + sgr("1;32", rule)
        yield "\n" + body + "\n" + event.get("result", "")


class Footer:
    """Pinned bottom panel — reads STATS live, so the clock ticks between events."""

    def __init__(self, start):
        self.start = start

    def __rich__(self):
        secs = int(time.monotonic() - self.start)
        line = Text()
        line.append("⏱ ", style="bold")
        line.append(human_time(secs), style="bold cyan")
        line.append("   context ", style="dim")
        line.append(human_num(STATS["context"]), style="bold")
        line.append("   in ", style="dim")
        line.append(human_num(STATS["in"]), style="bold")
        line.append("   out ", style="dim")
        line.append(human_num(STATS["out"]), style="bold")
        line.append("   cache ", style="dim")
        line.append(human_num(STATS["cache_read"]) + " read", style="bold")
        return Panel(line, style="green", expand=True)


def events(stream):
    for raw in stream:
        if not raw.strip():
            continue
        try:
            yield json.loads(raw)
        except json.JSONDecodeError:
            continue


def main():
    console = Console()
    for_lines = lambda event: (Text.from_ansi(line) for line in render(event))

    if not sys.stdout.isatty():
        for event in events(sys.stdin):
            for text in for_lines(event):
                console.print(text)
        return

    footer = Footer(time.monotonic())
    with Live(footer, console=console, refresh_per_second=4, transient=True) as live:
        for event in events(sys.stdin):
            for text in for_lines(event):
                console.print(text)  # scrolls above the pinned footer
            live.refresh()


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, BrokenPipeError):
        sys.exit(130)
