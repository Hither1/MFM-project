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

## Layout

| Path | Contents |
| --- | --- |
| `index.html` | the page; the author block is marked with an `AUTHORS` comment |
| `assets/css/style.css` | styles |
| `assets/js/main.js` | mobile navigation, section highlight, figure lightbox |
| `assets/img/` | figures, copied from `figures/` of the MFM repository |
| `assets/video/` | the run reconstruction, re-encoded to H.264 for browsers |

Numbers on the page come from `figures/cost_per_run.md`,
`figures/skill_learning/`, `figures/memory_detail_26654/` and the README of the MFM
repository (branch `publication`). When a figure is redrawn there, copy the new PNG over
the file of the same name in `assets/img/`.
