#!/usr/bin/env python3
"""Add a run's recording to the memory explorer (index.html#explorer).

    python scripts/make_demo_video.py <run> <source> --workspace <run_dir>/episode_001/memory [--bgr]

<run> is an exported run (assets/demo/<run>/data.json). <source> is either

  - the evaluator's video (MCU/output/<stamp>/<task>/episode_1.mp4), copied without
    re-encoding and with its index moved to the front so the browser can seek it, or
  - a directory of per-step frames named by their step (hires/0000001.jpg ...),
    encoded to H.264 with one frame per step. --bgr swaps red and blue back, for a
    record written with its channels in OpenCV order.

Writes assets/demo/<run>/run.mp4 and assets/demo/<run>/video.json. Frame k of run.mp4
shows step first_step + k, and the page moves its step with the picture.

The alignment is checked, not assumed: the frame each sampled episode opened on
(observation/image.png, taken at its first_step) is compared with the video frames at
that step and the three on either side. Unless the closest frame is the one at the
episode's own step for every sample (or ties with it, in a scene that did not move),
nothing is written. An existing run.mp4 is kept (and checked again) unless --force.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
FRAME = re.compile(r"^(\d+)\.(jpg|jpeg|png)$", re.I)
ENCODE = ["-c:v", "libx264", "-preset", "slow", "-crf", "32", "-maxrate", "800k", "-bufsize", "1600k",
          "-g", "100", "-pix_fmt", "yuv420p"]
SWAP = "colorchannelmixer=rr=0:rb=1:bb=0:br=1"
CMP = (160, 90)        # size the frames are compared at


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        exe = shutil.which("ffmpeg")
        if not exe:
            sys.exit("needs ffmpeg (on PATH, or the imageio-ffmpeg package)")
        return exe


def run(args, **kw):
    return subprocess.run([ffmpeg(), "-hide_banner", *args], capture_output=True, **kw)


def probe(path: Path):
    """codec, width, height, fps and frame count of the first video stream."""
    err = run(["-i", str(path)], text=True).stderr
    m = re.search(r"Video: (\w+).*?, (\d+)x(\d+).*?, ([\d.]+) fps", err)
    if not m:
        sys.exit(f"{path}: no video stream found")
    crc = run(["-v", "error", "-i", str(path), "-map", "0:v:0", "-c", "copy", "-f", "framecrc", "-"], text=True).stdout
    frames = sum(1 for line in crc.splitlines() if line and not line.startswith("#"))
    return {"codec": m.group(1), "width": int(m.group(2)), "height": int(m.group(3)),
            "fps": float(m.group(4)), "frames": frames}


def frames_at(video: Path, first: int, n: int, fps: float):
    """n decoded frames from frame index `first`, as arrays at CMP size."""
    import numpy as np
    w, h = CMP
    # -ss starts at the first frame whose time is at or after it (a browser shows the last
    # frame at or before its currentTime, so the page seeks to the middle of a frame instead)
    raw = run(["-v", "error", "-ss", f"{max(0, first - 0.25) / fps:.4f}", "-i", str(video),
               "-frames:v", str(n), "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(float)


def check(video: Path, meta: dict, workspace: Path, samples: int):
    """Compare episode frames with the video around their first_step."""
    import numpy as np
    from PIL import Image
    rows = [json.loads(l) for l in (workspace / "index.jsonl").read_text().splitlines() if l.strip()]
    lo, hi = meta["first_step"] + 3, meta["first_step"] + meta["frames"] - 4
    rows = [r for r in rows if lo <= r["first_step"] <= hi and r.get("image")
            and (workspace / r["image"]).is_file()]
    if not rows:
        sys.exit("no episode frame falls inside the video")
    pick = rows[::max(1, len(rows) // samples)][:samples]
    ok, errs, bad = 0, [], []
    for r in pick:
        img = np.asarray(Image.open(workspace / r["image"]).convert("RGB").resize(CMP), float)
        near = frames_at(video, r["first_step"] - meta["first_step"] - 3, 7, meta["fps"])
        d = [float(((f - img) ** 2).mean()) for f in near]
        # a still scene gives several near-equal frames; a moving one differs by hundreds
        if len(d) == 7 and d[3] <= min(d) * 1.05 + 1:
            ok += 1
            errs.append(d[3])
        else:
            bad.append((r["id"], r["first_step"], (int(np.argmin(d)) - 3) if d else None))
    return {"sampled": len(pick), "matched": ok, "mean_error": round(sum(errs) / max(1, len(errs)), 1),
            "mismatched": bad}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("run", help="the exported run's name (assets/demo/<run>)")
    ap.add_argument("source", help="episode_1.mp4, or a directory of per-step frames")
    ap.add_argument("--workspace", required=True, help="the run's memory directory, for the alignment check")
    ap.add_argument("--first-step", type=int, help="the step of the first frame (an mp4 starts at 0; "
                    "a frame directory at its lowest number)")
    ap.add_argument("--fps", type=float, default=20.0, help="frame rate of a frame directory (default 20)")
    ap.add_argument("--bgr", action="store_true", help="swap red and blue (a frame record in OpenCV order)")
    ap.add_argument("--samples", type=int, default=40)
    ap.add_argument("--force", action="store_true", help="make run.mp4 again even if it exists")
    args = ap.parse_args()

    out = SITE / "assets" / "demo" / args.run
    if not (out / "data.json").is_file():
        sys.exit(f"{out}/data.json not found: export the run first (scripts/export_demo.py)")
    src, dst = Path(args.source), out / "run.mp4"
    tmp = dst.with_suffix(".tmp.mp4")

    if src.is_dir():
        nums = sorted(int(m.group(1)) for m in (FRAME.match(p.name) for p in src.iterdir()) if m)
        if not nums:
            sys.exit(f"{src}: no frames named by step")
        missing = nums[-1] - nums[0] + 1 - len(nums)
        if missing:
            sys.exit(f"{src}: {missing} steps between {nums[0]} and {nums[-1]} have no frame")
        name = next(p.name for p in src.iterdir() if FRAME.match(p.name))
        width, ext = len(FRAME.match(name).group(1)), FRAME.match(name).group(2)
        first = nums[0] if args.first_step is None else args.first_step
        source = ("the harness's per-step frame record, encoded to H.264" +
                  (" with red and blue swapped back (the record stores them in the other order)" if args.bgr else ""))
        if args.force or not dst.exists():
            vf = ["-vf", SWAP] if args.bgr else []
            p = run(["-v", "error", "-y", "-framerate", str(args.fps), "-start_number", str(nums[0]),
                     "-i", str(src / f"%0{width}d.{ext}"), *vf, *ENCODE, "-movflags", "+faststart", str(tmp)])
            if p.returncode:
                sys.exit(p.stderr.decode(errors="replace"))
            tmp.replace(dst)
    else:
        first = args.first_step or 0
        info = probe(src)
        source = "the evaluator's recording (episode_1.mp4)"
        if args.force or not dst.exists():
            codec = ["-c", "copy"] if info["codec"] == "h264" else ENCODE
            source += ", copied without re-encoding" if info["codec"] == "h264" else ", encoded to H.264"
            p = run(["-v", "error", "-y", "-i", str(src), "-map", "0:v:0", *codec, "-movflags", "+faststart", str(tmp)])
            if p.returncode:
                sys.exit(p.stderr.decode(errors="replace"))
            tmp.replace(dst)
        elif info["codec"] == "h264":
            source += ", copied without re-encoding"

    info = probe(dst)
    meta = {"src": "run.mp4", "fps": info["fps"], "first_step": first,
            "last_step": first + info["frames"] - 1, "frames": info["frames"],
            "width": info["width"], "height": info["height"], "bytes": dst.stat().st_size,
            "source": source}
    meta["check"] = check(dst, meta, Path(args.workspace), args.samples)
    c = meta["check"]
    print(f"{args.run}: {info['frames']} frames, steps {first}-{meta['last_step']}, "
          f"{info['width']}x{info['height']} at {info['fps']:g} fps, {meta['bytes'] / 1e6:.1f} MB")
    print(f"check: {c['matched']}/{c['sampled']} episode frames match the video at their own step "
          f"(mean squared error {c['mean_error']})")
    if c["mismatched"]:
        print("mismatched (id, first_step, best offset):", c["mismatched"][:10], file=sys.stderr)
        sys.exit("video.json not written: the video does not line up with the steps")
    (out / "video.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {out / 'video.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
