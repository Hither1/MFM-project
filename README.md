# MFM project page

Static website for [MFM: Multimodal Filesystem Memory](https://github.com/Hither1/MFM).
Plain HTML, CSS and JavaScript; there is no build step.

## Preview

```bash
python -m http.server 8000      # then open http://localhost:8000
```

## Publish

On GitHub: Settings -> Pages -> Deploy from a branch -> `main`, folder `/ (root)`.
The site is then served at https://hither1.github.io/MFM-project/.

After changing a stylesheet or script, bump the `?v=` number on its `<link>`/`<script>`
in `index.html` and `demo.html`; GitHub Pages lets browsers cache these files for 10 minutes.

## Layout

| Path | Contents |
| --- | --- |
| `index.html` | the page; the author block is marked with an `AUTHORS` comment |
| `assets/css/style.css` | styles; the theme (colours, pixel font, bevels) is the `:root` block at the top |
| `assets/img/sift_*.png` | the pixel-art block strips, drawn by `scripts/make_sift_tiles.py` |
| `assets/js/main.js` | mobile navigation, section highlight, figure lightbox |
| `assets/img/` | figures, copied from `figures/` of the MFM repository |
| `assets/video/` | the run reconstruction, re-encoded to H.264 for browsers |

| `demo.html` | the memory explorer: a recorded run replayed step by step |
| `assets/js/demo.js`, `assets/css/demo.css` | the explorer |
| `assets/js/mfm-query.js` | a port of `mfm/memory/tools/episodes.py`, used by the query box |
| `assets/demo/<run>/` | one exported run: `data.json`, `frames/*.jpg`, `check.json` |
| `scripts/` | `export_demo.py` writes a run into `assets/demo/`; `check_demo.js` tests the port |

## Memory explorer

`demo.html` reads `assets/demo/runs.json` and the run it names. To add or refresh a run
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

Numbers on the page come from `figures/cost_per_run.md`,
`figures/skill_learning/`, `figures/memory_detail_26654/` and the README of the MFM
repository (branch `publication`). When a figure is redrawn there, copy the new PNG over
the file of the same name in `assets/img/`.
