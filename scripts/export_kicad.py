#!/usr/bin/env python
"""Export one recorded CUABench-KiCad run for the task viewer on the project page.

    python scripts/export_kicad.py RUN_DIR [--name NAME] [--out assets/kicad] [--no-frames]

RUN_DIR is the output directory of one arm (see CUA-KiCad/docs/KICAD_RUNS.md): summary.json,
results.jsonl and one directory per task with instruction.txt, trajectory.json, step_NN.png,
codex/turn_NNNN.events.jsonl and the agent's workspace.

Written to <out>/<name>/:
    run.json            the run and one row per task (what the table shows)
    <task>.json         the steps of one task: what the agent said, its plan, its actions,
                        the memory files it touched, and the notes it wrote during the task
    <task>/NN.webp      the screenshot the agent saw at step NN, 1280 px wide
    <task>/thumb.webp   the last screenshot, small

Everything comes from the record. Nothing is re-run or re-scored.
"""
import argparse
import glob
import json
import os
import re
import sys
from multiprocessing import Pool

FRAME_W, THUMB_W = 1280, 320
NOTE_CAP = 6000

# The benchmark names tasks by id only; these titles are ours, from the instructions.
TITLES = {
    "154d0750": "Adjustable LDO, 1.8 V output",
    "1625e97a": "7805 supply, power-on LED",
    "2c11fe94": "TL072 cascaded active filter",
    "34877be3": "Infrared LED driver",
    "458f5f5c": "Microphone preamplifier",
    "4bd3e530": "LED flasher with a 2N3904",
    "4c913e30": "Butterworth low-pass, 45 Hz",
    "55f2eefb": "555 timer, 9 V to 5 V supply",
    "589da233": "Current divider",
    "5dbc9e02": "555 LED flasher, astable",
    "6cb23037": "Push-to-on LED timer",
    "733d278a": "H-bridge motor driver",
    "83490c3a": "Power tree",
    "84ec333e": "Active low-pass, 4 kHz pole",
    "854b8a80": "Transistor astable multivibrator",
    "9ca3ef44": "Microphone amplifier bias",
    "a6414tw4": "Empty netlist",
    "a6dd38a9": "Passive RC band-pass",
    "b7148878": "Bipolar signal to ADC",
    "b7e51b92": "LM358 dual-rail amplifier",
    "ba34f1c3": "AD586 voltage reference",
    "c4baee36": "LM2576, 48 V to 3.3 V",
    "d1c655da": "Instrumentation amplifier gain",
    "d5947ae7": "LM2596 buck converter",
    "ff6dfdde": "ISO1211 field input",
}

HINT = "\n\nDeliverable location:"
MEM_RE = re.compile(r"(?<![\w/.-])((?:notes|previous)(?:/[^\s'\";|)<>\\]*)?)")
HOME_RE = re.compile(r"/n/[\w/.-]*?/cua_bench_codex/[\w.-]+")


def scrub(text):
    return HOME_RE.sub("<run>", text)


def split_reply(reply):
    """The agent's message is an observation followed by a [PLAN] block."""
    reply = scrub(reply or "").strip()
    if "[PLAN]" in reply:
        say, plan = reply.split("[PLAN]", 1)
        return say.strip(), plan.strip()
    return reply, ""


def step_actions(calls):
    out = []
    for call in calls or []:
        fn = call.get("function", {})
        args = fn.get("arguments") or {}
        if fn.get("name") == "terminate":
            out.append({"action": "terminate", "status": args.get("status")})
            continue
        for a in args.get("actions", []):
            out.append(a)
    return out


STEP_RE = re.compile(r"Step (\d+) of at most")
RECALL_RE = re.compile(r"^\[RECALL\][^\n]*\n(?:[ \t]+\S[^\n]*\n?)+", re.M)


def turns_by_step(task_dir, n_steps):
    """Per step, what the record says about memory in the model turn taken at that step:
    the notes/ and previous/ paths its shell commands name, and the [RECALL] block the harness
    put in its prompt. A turn can plan several steps, so some steps have no turn."""
    mem = [[] for _ in range(n_steps)]
    recall = [""] * n_steps
    for prompt in sorted(glob.glob(os.path.join(task_dir, "codex", "turn_*.prompt.txt"))):
        with open(prompt, errors="replace") as fh:
            text = fh.read()
        m = STEP_RE.search(text)
        if not m or not 1 <= int(m.group(1)) <= n_steps:
            continue
        i = int(m.group(1)) - 1
        r = RECALL_RE.search(text)
        if r:
            recall[i] = scrub(r.group(0).strip())
        events = prompt[: -len(".prompt.txt")] + ".events.jsonl"
        if not os.path.exists(events):
            continue
        with open(events, errors="replace") as fh:
            for line in fh:
                try:
                    ev = json.loads(line)
                except ValueError:
                    continue
                item = ev.get("item") or {}
                if ev.get("type") != "item.completed" or item.get("type") != "command_execution":
                    continue
                for path in MEM_RE.findall(item.get("command", "")):
                    path = path.rstrip("/.,:")
                    if path and path not in mem[i]:
                        mem[i].append(path)
    return mem, recall


def read_notes(task_dir):
    notes = {}
    root = os.path.join(task_dir, "workspace", "notes")
    if os.path.isdir(root):
        for name in sorted(os.listdir(root)):
            p = os.path.join(root, name)
            if os.path.isfile(p):
                with open(p, errors="replace") as fh:
                    notes[name] = fh.read()
    return notes


def encode(job):
    src, dst, width = job
    from PIL import Image
    im = Image.open(src).convert("RGB")
    im = im.resize((width, round(width * im.height / im.width)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=55 if width > 400 else 60, method=6)
    return os.path.getsize(dst)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("run_dir")
    ap.add_argument("--name")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "assets", "kicad"))
    ap.add_argument("--no-frames", action="store_true", help="write the json only")
    ap.add_argument("--jobs", type=int, default=8)
    args = ap.parse_args()

    run_dir = os.path.abspath(args.run_dir)
    name = args.name or os.path.basename(run_dir)
    out = os.path.join(os.path.abspath(args.out), name)
    os.makedirs(out, exist_ok=True)

    with open(os.path.join(run_dir, "summary.json")) as fh:
        summary = json.load(fh)
    with open(os.path.join(run_dir, "results.jsonl")) as fh:
        results = [json.loads(line) for line in fh if line.strip()]
    # a task that was run again (after a step error, say) has several rows: the last one counts
    results = list({r["task_id"]: r for r in results}.values())
    order_file = os.path.join(run_dir, "task_order.json")
    if os.path.exists(order_file):
        with open(order_file) as fh:
            order = json.load(fh)
        order = order.get("task_ids") or order.get("order") if isinstance(order, dict) else order
        results.sort(key=lambda r: order.index(r["task_id"]))
    else:
        results.sort(key=lambda r: r["task_id"])

    rows, jobs, prev_notes = [], [], {}
    for pos, r in enumerate(results):
        tid = r["task_id"]
        tdir = os.path.join(run_dir, tid)
        with open(os.path.join(tdir, "instruction.txt")) as fh:
            instruction = fh.read().split(HINT)[0].strip()
        with open(os.path.join(tdir, "trajectory.json")) as fh:
            traj = json.load(fh)
        mem, recall = turns_by_step(tdir, len(traj))
        steps = []
        for i, s in enumerate(traj):
            say, plan = split_reply(s.get("reply"))
            step = {"say": say, "plan": plan, "actions": step_actions(s.get("calls"))}
            if mem[i]:
                step["mem"] = mem[i]
            if recall[i]:
                step["recall"] = recall[i]
            steps.append(step)

        notes = read_notes(tdir)
        written = [
            {"name": n, "new": n not in prev_notes, "text": scrub(t[:NOTE_CAP]), "cut": len(t) > NOTE_CAP}
            for n, t in notes.items() if prev_notes.get(n) != t
        ]
        prev_notes = notes

        # by number: past step 99 the names grow a digit and no longer sort as text
        frames = sorted(glob.glob(os.path.join(tdir, "step_*.png")),
                        key=lambda f: int(re.search(r"step_(\d+)\.png$", f).group(1)))
        if [int(re.search(r"step_(\d+)\.png$", f).group(1)) for f in frames] != list(range(len(frames))):
            sys.exit(f"{tid}: screenshots are not numbered 0..{len(frames) - 1}")
        if len(frames) != len(traj):
            sys.exit(f"{tid}: {len(frames)} screenshots for {len(traj)} steps")
        os.makedirs(os.path.join(out, tid), exist_ok=True)
        for i, src in enumerate(frames):
            jobs.append((src, os.path.join(out, tid, f"{i:03d}.webp"), FRAME_W))
        jobs.append((frames[-1], os.path.join(out, tid, "thumb.webp"), THUMB_W))

        audit = r.get("audit") or {}
        carry = audit.get("carry") or {}
        with open(os.path.join(out, tid + ".json"), "w") as fh:
            json.dump({"id": tid, "steps": steps, "notes": written}, fh, ensure_ascii=False, separators=(",", ":"))
        rows.append({
            "id": tid,
            "pos": pos + 1,
            "title": TITLES.get(tid, tid),
            "kind": "edit" if (audit.get("design") or {}).get("existing") else "design",
            "instruction": instruction,
            "reward": r.get("reward"),
            "steps": len(traj),
            "status": (step_actions(traj[-1].get("calls"))[-1:] or [{}])[0].get("status"),
            "error": r.get("error"),
            "carried_tasks": carry.get("previous_tasks", 0),
            "carried_episodes": carry.get("previous_episodes", 0),
            "mem_steps": sum(1 for s in steps if s.get("mem")),
            "recall_steps": sum(1 for s in steps if s.get("recall")),
            "notes_written": [w["name"] for w in written],
            "input_tokens": audit.get("input_tokens"),
            "output_tokens": audit.get("output_tokens"),
        })

    run = {
        "name": name,
        "model": summary.get("model"),
        "agent": summary.get("agent"),
        "effort": summary.get("effort"),
        "design_effort": (summary.get("design") or {}).get("design_effort"),
        "max_steps": summary.get("max_steps"),
        "task_order_seed": summary.get("task_order_seed"),
        "mean_reward": summary.get("mean_reward"),
        "n_tasks": len(rows),
        "n_errors": summary.get("n_errors"),
        "frame_w": FRAME_W,
        "tasks": rows,
    }
    with open(os.path.join(out, "run.json"), "w") as fh:
        json.dump(run, fh, ensure_ascii=False, indent=1)

    if not args.no_frames:
        with Pool(args.jobs) as pool:
            total = sum(pool.imap_unordered(encode, jobs, chunksize=4))
        print(f"{len(jobs)} images, {total / 1e6:.1f} MB")
    print(f"{len(rows)} tasks, mean reward {run['mean_reward']:.3f} -> {out}")


if __name__ == "__main__":
    main()
