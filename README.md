# MFM project page

Static website for [MFM: Multimodal Filesystem Memory](https://github.com/Hither1/MFM).
Plain HTML, CSS and JavaScript; there is no build step.

## Preview

```bash
python scripts/serve.py 8000    # then open http://localhost:8000
```

`python -m http.server` works too, except that the explorer's videos cannot be seeked:
it ignores the Range requests a browser seeks with. `scripts/serve.py` answers them.

## Publish

On GitHub: Settings -> Pages -> Deploy from a branch -> `main`, folder `/ (root)`.
The site is then served at https://hither1.github.io/MFM-project/.

After changing a stylesheet or script, bump the `?v=` number on its `<link>`/`<script>`
in `index.html`; GitHub Pages lets browsers cache these files for 10 minutes.

## Layout

| Path | Contents |
| --- | --- |
| `index.html` | the page; the author block is marked with an `AUTHORS` comment, and `TODO(authors)` comments mark statements to check against the paper. On screens 1,200 px wide or more, the contents rail (`nav.toc`) stands left of the text; on narrower ones the top bar's menu button lists the same sections. The headings, the rail and the menu use the same section titles, so a renamed section is renamed in all three places. The sections of the earlier page that the new one does not use are kept, hidden, at the end (`ARCHIVE`, and `#archived-v2` for what the second redesign took out) |
| `assets/css/style.css` | styles; the theme (colours, fonts, column widths) is the `:root` block at the top. Text, cards, figures and charts share one column width (`--col`, 1,120 px), so the paragraphs are as wide as the figures; lower `--col` for shorter lines. The block also holds the colours of the five kinds of memory (as in Figure 2 of the paper) and of the chart series |
| `assets/img/sift_*.png` | pixel-art block strips from the earlier Minecraft theme, drawn by `scripts/make_sift_tiles.py`; not used by the page now |
| `assets/js/main.js` | mobile navigation, the highlight of the section in view (top bar and contents rail), figure lightbox, the milestone strip under the opening video; it also still wires the buttons of the static memory figure (`#mfig`), which is now in the archive |
| `assets/js/overview.js` | the method figure (`#mf`, section III): about 600 steps of life 3 of the explorer's Ender Dragon run, replayed in five stages (record, retrieve, consolidate, act, carry over): stages 1 to 4 make one turn and repeat, and stage 5 comes when a life ends. The environment panel shows the turn's `actions.json` as a queue, ticked off as each action runs (`QUEUE` lists the episodes of each turn), and each turn in the agent's log starts with the frame the agent saw at that moment. It shows the explorer's frames (`assets/demo/of3m_mfm/frames/`), and every index row, message, command and file excerpt in it is quoted from that run's `data.json`, with `…` where lines or words are left out. It plays while on screen; choosing a scene stops it there, and visitors who ask for reduced motion see each scene's end state |
| `assets/js/charts.js` | draws the result charts from the table inside each chart's figure; the table stays on the page as the chart's table view, so a number is changed by editing the table |
| `assets/img/` | figures, copied from `figures/` of the MFM repository or from the paper (`fig2_memory_filesystem.png`, `memory_comparison.png`, `retrieval_lag.png`, `steps_per_turn.png`, the portal frames); `strip.jpg` is twelve frames of the explorer's Ender Dragon run, eight of which make the pictures of section II; `milestones.png` is the 24 milestone icons of `figs/task_milestones.pdf` in the paper, 36 px each, in task order |
| `assets/video/` | `dragon_chain_21of24_16x.mp4`, the opening video: the 64-minute Ender Dragon recording sped up 16 times, no sound, with the milestone strip under it; `og9_mfm_reconstruction_h264.mp4`, the earlier opening video, not used by the page now; both H.264 for browsers |
| `demo.html` | a redirect to `index.html#explorer`, where the memory explorer now is; it keeps old links working |
| `assets/js/demo.js`, `assets/css/demo.css` | the memory explorer, the `#explorer` part of `index.html`: a recorded run replayed step by step. The memory panel shows the map by default; clicking a memory box or a file opens it below, and clicking it again goes back to the map. The timeline's labels are refitted whenever the track changes width (`fitTrack`) |
| `assets/js/mfm-query.js` | a port of `mfm/memory/tools/episodes.py`, used by the query box |
| `assets/demo/<run>/` | one exported run: `data.json`, `frames/*.jpg`, `check.json`, and `run.mp4` + `video.json` when it has a recording |
| `scripts/` | `export_demo.py` writes a run into `assets/demo/`; `export_kicad.py` writes a KiCad run (task table and replays of section VIII) into `assets/kicad/`; `check_demo.js` tests the port; `make_demo_video.py` adds a run's recording; `serve.py` previews the site |

## Memory explorer

The explorer reads `assets/demo/runs.json` and the run it names. To add or refresh a run
(PIL is needed for the frames):

```bash
python scripts/export_demo.py /path/to/MFM/MCU/output/<run> --title "Shown in the run menu"
node scripts/check_demo.js assets/demo/<run>/data.json /path/to/MFM/MCU/output/<run>
```

The exporter copies the index, the episode files, the grid and the log, takes the agent's
commands from `codex_turns/` and the history of `mine/` from the `apply_patch` calls in
`codex_sessions/`, and rewrites the machine's paths, account and group names. The check
re-runs every `episodes.py` call of the run through the port and compares the output with
the record, line for line; it exits non-zero on a difference and writes the `check.json`
that the page quotes. The page needs http (`fetch`), so preview it with the server above.

To give a run its video (played on the right, with the memory on the left following it):

```bash
# the evaluator's recording, copied as it is
python scripts/make_demo_video.py <run> MCU/output/<stamp>/<task>/episode_1.mp4 \
    --workspace MCU/output/<run>/episode_001/memory
# or a per-step frame record (hires/0000001.jpg ...), encoded to H.264; --bgr swaps red and blue
python scripts/make_demo_video.py <run> <dir>/hires --bgr --workspace <run_dir>/episode_001/memory
```

Frame k of `run.mp4` is step `first_step + k`. The script checks that against the episodes
(each one's first frame against the video at its first step and the steps around it) and
writes `video.json` only if they line up. Needs ffmpeg with libx264 (the `imageio-ffmpeg`
package has one), numpy and PIL. The videos are H.264, which Chrome, Edge, Firefox and
Safari play; some Linux builds of Chromium do not.

Numbers on the page come from `figures/cost_per_run.md`,
`figures/skill_learning/`, `figures/memory_detail_26654/` and the README of the MFM
repository (branch `publication`), and from the tables of the paper (Results). When a
figure is redrawn there, copy the new PNG over the file of the same name in `assets/img/`.

In the opening video, each lit milestone jumps to `data-t` seconds: the step at which it was
credited divided by 320, since a second of the video is 320 steps (the game's 20 steps a
second, 16 times faster). The chart of the three lives in *Getting better* reads its steps
from its table. The chart of milestones against the episodes carried in, computed from the
same table at the step in `data-at`, is in the archive: at step 30,000, where life 1 ended, it
showed 10, 14 and 14, which did not match the 10, 15 and 16 counted within the task's 36,000
steps. The KiCad chart in *Results* leaves out the paper's "MFM, no memory across tasks" row;
its numbers are in a comment beside the chart.
