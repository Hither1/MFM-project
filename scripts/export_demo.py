#!/usr/bin/env python3
"""Export one recorded MFM run as static data for the memory explorer (demo.html).

    python scripts/export_demo.py /path/to/MFM/MCU/output/<run> [--name <run>] [--title "..."]

Reads the run as the harness left it and writes

    assets/demo/<run>/data.json        everything the page needs except the frames
    assets/demo/<run>/frames/*.jpg     each episode's observation/image.png, downscaled
    assets/demo/runs.json              the list of exported runs

Nothing is invented: index rows, episode files, grid rows and log sections are copied;
the agent's commands and their output come from codex_turns/*.events.jsonl; the history
of mine/ files comes from the apply_patch calls in the session rollouts. Absolute paths
of the machine the run was made on are rewritten to workspace-relative ones.

Needs PIL for the frames.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import shlex
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
OUTPUT_LIMIT = 6000      # characters of recorded command output kept per command
THUMB = (320, 180)


def read_text(path):
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def jload(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def jsonl(path):
    rows = []
    try:
        text = Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return rows
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except ValueError:
            continue
    return rows


class Scrub:
    """Rewrite the run's absolute paths to workspace-relative ones."""

    def __init__(self, workspace: Path, run_dir: Path, recorded: str | None = None):
        ws = str(workspace)
        self.pairs = [(ws + "/", "./"), (ws, "."), (str(run_dir) + "/", "<run>/"), (str(run_dir), "<run>")]
        if recorded:     # a staged run: its paths were already rewritten to a placeholder root
            rws = recorded + "/episode_001/memory"
            self.pairs = [(rws + "/", "./"), (rws, "."), (recorded + "/", "<run>/"), (recorded, "<run>")] + self.pairs
        self.home = re.compile(r"/(?:n|home|Users)/[^\s\"'`:]*")
        # `ls -l` output names the account and its groups
        names = {}
        try:
            import grp
            import pwd
            names[pwd.getpwuid(os.getuid()).pw_name] = "user"
            for g in os.getgroups():
                try:
                    names[grp.getgrgid(g).gr_name] = "group"
                except KeyError:
                    pass
        except ImportError:
            pass
        self.names = [(re.compile(r"\b" + re.escape(k) + r"\b"), v)
                      for k, v in names.items() if len(k) > 3]

    def __call__(self, value):
        if isinstance(value, str):
            for a, b in self.pairs:
                value = value.replace(a, b)
            value = self.home.sub("<path>", value)
            for pat, b in self.names:
                value = pat.sub(b, value)
            return value
        if isinstance(value, list):
            return [self(v) for v in value]
        if isinstance(value, dict):
            return {k: self(v) for k, v in value.items()}
        return value


# ---------------------------------------------------------------- log sections
HEADER = re.compile(r"^Action (\d+) \| Step (\d+)")


def log_sections(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
    out, line_no = [], 0
    for block in re.split(r"^={80}\n", text, flags=re.M):
        if not block.strip():
            line_no += block.count("\n")
            continue
        line_no += 1  # the separator
        m = HEADER.match(block)
        out.append({"action": int(m.group(1)) if m else None,
                    "step": int(m.group(2)) if m else 0,
                    "line": line_no + 1,
                    "text": block.rstrip("\n")})
        line_no += block.count("\n")
    return out, text.count("\n")


# ---------------------------------------------------------------- agent commands
TOOL = re.compile(r"(?:\./)?tools/episodes\.py")
OPS = {"|", "||", "&&", ";", "&", ">", ">>", "<", "2>", "2>&1", "|&"}
STARTS = {"|", "||", "&&", ";", "&", "|&", "(", "{", "!"}
PYTHON = re.compile(r"(?:\S*/)?python[\d.]*$")


def inner_script(command: str) -> str:
    """`/usr/bin/bash -lc "<script>"` -> <script>."""
    try:
        parts = shlex.split(command)
    except ValueError:
        return command
    if len(parts) >= 3 and parts[1] in ("-lc", "-c"):
        return parts[2]
    return command


def tool_calls(script: str):
    """Every `./tools/episodes.py ...` invocation in a shell script: its argument list,
    and whatever it was piped into (the recorded output reflects the pipe). The tool
    has to be the command of its pipeline stage (or the script python is given): a
    script that prints the tool's source, or a note that mentions it, is not a call."""
    calls = []
    for line in script.splitlines():
        if not TOOL.search(line):
            continue
        try:
            lex = shlex.shlex(line, posix=True, punctuation_chars=True)
            lex.whitespace_split = True
            tokens = list(lex)
        except ValueError:
            continue
        i = 0
        while i < len(tokens):
            before = tokens[i - 1] if i else None
            if before is not None and PYTHON.match(before):
                before = tokens[i - 2] if i > 1 else None
            if TOOL.fullmatch(tokens[i]) and (before is None or before in STARTS):
                j = i + 1
                while j < len(tokens) and tokens[j] not in OPS:
                    j += 1
                k = j
                while k < len(tokens) and tokens[k] not in (";", "&&", "||"):
                    k += 1
                calls.append({"argv": tokens[i + 1:j], "piped": " ".join(tokens[j:k])})
                i = k
            else:
                i += 1
    return calls


def classify(script: str) -> list[str]:
    kinds = []
    if TOOL.search(script):
        kinds.append("episodes")
    if "logs.txt" in script:
        kinds.append("log")
    if "mine/" in script:
        kinds.append("mine")
    if re.search(r"\b(references|skills)/", script):
        kinds.append("reference")
    if "grid.jsonl" in script:
        kinds.append("grid")
    return kinds or ["other"]


# ---------------------------------------------------------------- patches (mine/ history)
def patch_changes(text: str):
    """(path, kind, added_lines, removed_lines) for each file in an apply_patch body."""
    out, cur = [], None
    for line in text.splitlines():
        m = re.match(r"\*\*\* (Add|Update|Delete) File: (.+)$", line)
        if m:
            cur = {"kind": m.group(1).lower(), "path": m.group(2).strip(), "added": [], "removed": []}
            out.append(cur)
        elif line.startswith("*** "):
            if line.startswith("*** End Patch"):
                cur = None
        elif cur is not None:
            if line.startswith("+"):
                cur["added"].append(line[1:])
            elif line.startswith("-"):
                cur["removed"].append(line[1:])
    return out


def patch_body(tool_input: str):
    """The patch string inside a code-mode `exec` call (a JS string literal)."""
    m = re.search(r'"(\*\*\* Begin Patch.*?\*\*\* End Patch[^"\\]*(?:\\.[^"\\]*)*)"', tool_input, flags=re.S)
    if m:
        try:
            return json.loads('"' + m.group(1) + '"')
        except ValueError:
            pass
    if "*** Begin Patch" in tool_input:
        return tool_input[tool_input.index("*** Begin Patch"):]
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("run", help="run directory holding episode_001/ (and codex_sessions/)")
    ap.add_argument("--name")
    ap.add_argument("--title")
    ap.add_argument("--quality", type=int, default=72)
    ap.add_argument("--recorded-root", help="the run directory as the record names it, when the run was "
                    "staged elsewhere with its paths rewritten (e.g. '<MCU>/output/of3m_mfm')")
    args = ap.parse_args()

    run_dir = Path(args.run).resolve()
    ep_dir = run_dir / "episode_001"
    ws = ep_dir / "memory"
    name = args.name or run_dir.name
    out_dir = SITE / "assets" / "demo" / name
    (out_dir / "frames").mkdir(parents=True, exist_ok=True)
    scrub = Scrub(ws, run_dir, args.recorded_root)
    recorded_ws = (args.recorded_root + "/episode_001/memory/") if args.recorded_root else None

    report = jload(ep_dir / "worldmodel_report.json", {}) or {}
    index = jsonl(ws / "index.jsonl")

    # --- episodes and frames
    from PIL import Image
    episodes = {}
    for row in index:
        d = ws / row["path"]
        # the files as written: `--grep` matches on their text, so the text is kept
        episodes[row["id"]] = {
            "state": read_text(d / "state" / "state.json"),
            "action": read_text(d / "action.json"),
            "outcome": read_text(d / "outcome.json"),
        }
        row["_raw"] = json.dumps(row)     # the line as the query tool prints it
        src = ws / (row.get("image") or "")
        dst = out_dir / "frames" / f"{row['id']}.jpg"
        if src.is_file() and not dst.exists():
            im = Image.open(src).convert("RGB")
            im.thumbnail(THUMB, Image.LANCZOS)
            im.save(dst, "JPEG", quality=args.quality, optimize=True)
        row["_frame"] = dst.exists()

    # --- grid
    kinds = []
    grid = []
    for g in jsonl(ws / "grid.jsonl"):
        cell = g.get("cell")
        if not cell or len(cell) != 3:
            continue
        if g["kind"] not in kinds:
            kinds.append(g["kind"])
        grid.append([cell[0], cell[1], cell[2], kinds.index(g["kind"]), g.get("step", 0)])

    # --- log
    sections, log_lines = log_sections(ws / "logs.txt")

    # --- turns: prompt, messages, commands
    turns = {}
    for f in sorted(glob.glob(str(ep_dir / "codex_turns" / "turn_*.events.jsonl"))):
        n = int(re.search(r"turn_(\d+)", f).group(1))
        prompt = ""
        p = Path(f.replace(".events.jsonl", ".prompt.txt"))
        if p.exists():
            prompt = p.read_text(encoding="utf-8", errors="replace")
        m = re.match(r"Step (\d+)/(\d+)", prompt)
        t = {"turn": n, "step": int(m.group(1)) if m else None, "prompt": prompt,
             "thread": None, "messages": [], "commands": [], "changes": [], "views": []}
        for e in jsonl(f):
            it = e.get("item") or {}
            if e.get("type") == "thread.started":
                t["thread"] = e.get("thread_id")
            if e.get("type") == "turn.completed":
                t["usage"] = e.get("usage")
            if e.get("type") != "item.completed":
                continue
            if it.get("type") == "agent_message":
                t["messages"].append(it.get("text") or "")
            elif it.get("type") == "command_execution":
                script = inner_script(it.get("command") or "")
                output = it.get("aggregated_output") or ""
                t["commands"].append({
                    "script": script, "full_script": script,
                    "kinds": classify(script), "calls": tool_calls(script),
                    "exit": it.get("exit_code"),
                    "output": output[:OUTPUT_LIMIT], "output_chars": len(output),
                })
        turns[n] = t

    # patches applied from the shell (`apply_patch <<'EOF' ...`) are in the commands
    shell_patches = []
    for n in sorted(turns):
        for c in turns[n]["commands"]:
            if "*** Begin Patch" in c["full_script"] and not c["exit"]:
                shell_patches.append((turns[n], c["full_script"][c["full_script"].index("*** Begin Patch"):]))
            del c["full_script"]

    # steps for turns whose prompt did not state one: the first episode of the turn
    first_of_turn = {}
    for row in index:
        a = jload(ws / row["path"] / "action.json", {}) or {}
        if a.get("turn") is not None:
            first_of_turn.setdefault(a["turn"], row["first_step"])
    for n, t in turns.items():
        if t["step"] is None:
            t["step"] = first_of_turn.get(n, 0)

    # --- rollouts: patches to mine/ and frames opened with view_image
    # (a thread can hold one turn or, when the run kept one compacted thread, all of
    # them: the n-th task started in a thread is the n-th turn that names the thread)
    by_thread = {}
    for n in sorted(turns):
        if turns[n]["thread"]:
            by_thread.setdefault(turns[n]["thread"], []).append(turns[n])
    mine_history = {}
    model = None

    def record(t, body):
        for ch in patch_changes(body):
            rel = ch["path"].replace(str(ws) + "/", "")
            if recorded_ws:
                rel = rel.replace(recorded_ws, "")
            if rel.startswith("/"):
                continue
            t["changes"].append({"path": rel, "kind": ch["kind"],
                                 "added": len(ch["added"]), "removed": len(ch["removed"])})
            if rel.startswith("mine/"):
                mine_history.setdefault(rel, []).append({
                    "turn": t["turn"], "step": t["step"], "kind": ch["kind"],
                    "added": ch["added"], "removed": ch["removed"]})

    for t, body in shell_patches:
        record(t, body)
    for f in sorted(glob.glob(str(run_dir / "codex_sessions" / "**" / "*.jsonl"), recursive=True)):
        rows = jsonl(f)
        sid = next((r["payload"].get("id") for r in rows if r.get("type") == "session_meta"), None)
        of_thread = by_thread.get(sid)
        if not of_thread:
            continue
        started = sum(1 for r in rows if (r.get("payload") or {}).get("type") == "task_started")
        if started not in (0, len(of_thread)):
            print(f"WARNING thread {sid}: {started} tasks started, {len(of_thread)} turns recorded",
                  file=sys.stderr)
        t, k = of_thread[0], 0
        for r in rows:
            p = r.get("payload") or {}
            if p.get("type") == "task_started":
                t = of_thread[min(k, len(of_thread) - 1)]
                k += 1
            if r.get("type") == "turn_context" and p.get("model"):
                model = p["model"]
            if p.get("type") != "custom_tool_call":
                continue
            src = p.get("input") or ""
            for m in re.finditer(r"view_image\(\s*\{[^}]*?path:\s*\"([^\"]+)\"", src):
                t["views"].append(m.group(1))
            for m in re.finditer(r"view_image\(\s*\"([^\"]+)\"", src):
                t["views"].append(m.group(1))
            body = patch_body(src)
            if body:
                record(t, body)

    # --- mine/ files as they ended
    mine_files, mine_images = {}, []
    for p in sorted((ws / "mine").rglob("*")) if (ws / "mine").is_dir() else []:
        if p.is_file() and p.stat().st_size < 200_000:
            rel = str(p.relative_to(ws))
            try:
                mine_files[rel] = p.read_bytes().decode("utf-8")
            except UnicodeDecodeError:      # an image the agent made: listed, not shown
                mine_images.append({"path": rel, "bytes": p.stat().st_size})
    # can the final file be rebuilt by replaying the patches in order? (the page shows
    # a file growing only when it can; otherwise it shows the final text and says so)
    replayable = {}
    for rel, hist in mine_history.items():
        hist.sort(key=lambda h: h["turn"])
        lines = []
        for h in hist:
            if h["kind"] == "add":
                lines = []
            for gone in h["removed"]:
                if gone in lines:
                    lines.remove(gone)
            lines.extend(h["added"])
        replayable[rel] = "\n".join(lines).strip() == (mine_files.get(rel) or "").strip()

    # --- static workspace files worth listing (not their content)
    listing = []
    for sub in ("AGENTS.md", "tools", "references", "skills"):
        p = ws / sub
        if p.is_file():
            listing.append({"path": sub, "bytes": p.stat().st_size})
        elif p.is_dir():
            for q in sorted(p.rglob("*")):
                if q.is_file():
                    listing.append({"path": str(q.relative_to(ws)), "bytes": q.stat().st_size})

    # the flags of the run's own copy of the tool: the page's port accepts these and no others
    tool_src = read_text(ws / "tools" / "episodes.py") or ""
    tool_flags = re.findall(r'add_argument\("(--[a-z-]+)"', tool_src)
    # the merged index of the lives carried into this one (`--previous`); their episode
    # files are not part of a staged run, so only the rows are exported
    previous = jsonl(ws / "previous" / "index.jsonl")
    for row in previous:
        row["_raw"] = json.dumps(row)
        row["_files"] = (ws / row.get("path", "") / "outcome.json").is_file()

    ms = report.get("milestones") or {}
    data = {
        "run": {
            "name": name,
            "title": args.title or name,
            "task": ms.get("task"),
            "steps": report.get("steps"),
            "memory_mode": report.get("memory_mode"),
            "milestones": {"order": ms.get("order") or [], "achieved": ms.get("achieved") or {},
                           "total": ms.get("total_milestones")},
            "retrieval_block": bool((report.get("mfm") or {}).get("retrieval")),
            "own": report.get("own"),
            "model": model,
            "tool_flags": tool_flags,
            "previous_files": bool(previous) and all(r["_files"] for r in previous),
            "last_step": max((r.get("last_step") or 0) for r in index) if index else 0,
        },
        "index": index,
        "previous": previous,
        "episodes": episodes,
        "grid": {"kinds": kinds, "cells": grid},
        "log": {"sections": sections, "lines": log_lines},
        "turns": [turns[k] for k in sorted(turns)],
        "mine": {"files": mine_files, "images": mine_images, "history": mine_history,
                 "replayable": replayable},
        "listing": listing,
    }
    data = scrub(data)
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    (out_dir / "data.json").write_text(blob, encoding="utf-8")

    runs_path = SITE / "assets" / "demo" / "runs.json"
    runs = jload(runs_path, []) or []
    entry = {"name": name, "title": data["run"]["title"], "task": data["run"]["task"],
             "model": model, "episodes": len(index), "steps": data["run"]["steps"]}
    at = [i for i, r in enumerate(runs) if r.get("name") == name]
    if at:                      # a run exported again keeps its place in the list
        runs[at[0]] = entry
    else:
        runs.append(entry)
    runs_path.write_text(json.dumps(runs, indent=1) + "\n", encoding="utf-8")

    n_calls = sum(len(c["calls"]) for t in data["turns"] for c in t["commands"])
    print(f"{name}: {len(index)} episodes, {len(grid)} grid rows, {len(sections)} log sections, "
          f"{len(turns)} turns, {n_calls} episodes.py calls, "
          f"{sum(len(h) for h in mine_history.values())} mine/ patches")
    print(f"data.json {len(blob) / 1024:.0f} KiB -> {out_dir}")
    leaks = sorted(set(re.findall(r"/(?:n|home)/[\w./-]+", blob)))
    if leaks:
        print("WARNING absolute paths left:", leaks[:10], file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
