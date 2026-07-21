#!/usr/bin/env python3
"""Format `claude -p --output-format stream-json` into a colored, tagged live feed.

Reads NDJSON on stdin (one event per line) and prints one scannable line per
event, so the loop's output reads as blocks instead of a wall of text.
Used by scripts/run-loop.sh.
"""

import json
import sys
import time

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


def sgr(code, text):
    return f"\033[{code}m{text}{RESET}"


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
        for block in event["message"]["content"]:
            if block["type"] == "text" and block["text"].strip():
                yield stamp() + sgr("90", "· " + clip(block["text"], 200))
            elif block["type"] == "tool_use":
                yield tool_line(block)
    elif etype == "user":
        for block in event["message"]["content"]:
            if block.get("type") == "tool_result":
                body = clip(result_body(block.get("content", "")), 130)
                errored = block.get("is_error")
                yield sgr("91" if errored else "90", f"     {'✗' if errored else '└'} {body}")
    elif etype == "result":
        secs = int(event.get("duration_ms", 0) / 1000)
        cost = round(event.get("total_cost_usd", 0), 2)
        summary = f"✓ {event.get('subtype', 'end')}  ·  ${cost}  ·  {event.get('num_turns', 0)} turns  ·  {secs}s"
        rule = "═" * len(summary)
        yield "\n" + sgr("1;32", f"{rule}\n{summary}\n{rule}") + "\n" + event.get("result", "")


def main():
    for raw in sys.stdin:
        if not raw.strip():
            continue
        try:
            event = json.loads(raw)
        except json.JSONDecodeError:
            continue
        for line in render(event):
            print(line, flush=True)


if __name__ == "__main__":
    main()
