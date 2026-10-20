#!/usr/bin/env python3
"""Hide the built-in atom set from an exported run of the memory explorer.

    python scripts/redact_atoms.py assets/demo/<run>/data.json

A life of the `--atoms` arm is given 28 built-in procedures (`procedures.ATOMS` in the MFM
repo). This removes them from what the page shows of the run, in place:

  - the `atoms` field of each plan entry's action.json (the built-in steps an own
    procedure ran);
  - each line of the procedure reference that documents one of them, and the sentences of
    the reference that name the set, where the agent printed them; the line is kept as
    `[…]`, after its grep prefix;
  - every other mention of the word, as `[…]`.

The agent's calls (the plan entries, the index rows) are left as recorded. Running it again
changes nothing.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ATOMS = ("look", "look_at", "look_abs", "equip_hotbar", "open_inventory", "close_inventory",
         "cursor_to_slot", "cursor_to_cell", "gui_click", "gui_right_click", "craft",
         "place_and_open", "furnace_load", "furnace_take", "place_at", "use_at", "use_held",
         "go_to", "watch", "mine_ahead", "collect_drops", "fill_bucket", "pillar_up", "eat",
         "throw", "drop_and_pickup", "stow_items", "discard_stack")
CUT = "[…]"
RULES = [
    # the reference's line for one atom: `- `name(args)` -- what it does`, after a grep prefix
    (re.compile(r"^(.{0,60}?)- `(?:%s)\(.*$" % "|".join(ATOMS), re.M), r"\1" + CUT),
    (re.compile(r"The built-in set is the ATOMS \([^)]*\)\."), CUT),
    (re.compile(r"This run's procedure set is the ATOMS above:.*?keep it as your own procedure\.", re.S), CUT),
    (re.compile(r"\b(?:raw|use)?atoms?\b", re.I), CUT),
]


def redact(value):
    if isinstance(value, str):
        for pat, sub in RULES:
            value = pat.sub(sub, value)
        return value
    if isinstance(value, list):
        return [redact(v) for v in value]
    if isinstance(value, dict):
        return {k: redact(v) for k, v in value.items()}
    return value


def drop_atoms(text):
    """action.json without entry.atoms, written as the harness writes it."""
    try:
        a = json.loads(text)
    except ValueError:
        return text
    if json.dumps(a, indent=1, sort_keys=True) + "\n" != text:
        sys.exit("an action.json is not in the harness's layout; not rewriting it")
    if (a.get("entry") or {}).pop("atoms", None) is None:
        return text
    return json.dumps(a, indent=1, sort_keys=True) + "\n"


def main():
    path = Path(sys.argv[1])
    data = json.loads(path.read_text(encoding="utf-8"))
    for e in data["episodes"].values():
        if e.get("action"):
            e["action"] = drop_atoms(e["action"])
    data = redact(data)
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text(blob, encoding="utf-8")
    left = len(re.findall(r"atom(?!ic)", blob, re.I))
    print(f"{path}: {left} mentions left")
    return 1 if left else 0


if __name__ == "__main__":
    sys.exit(main())
