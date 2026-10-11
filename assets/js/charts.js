// Charts drawn from the tables inside them (index.html, figure.chart[data-chart]). The table stays in
// the page as the chart's table view, so the numbers are edited in one place, the HTML.
//   bars    rows are groups, columns are series; a cell "m ± s" is a bar and its whisker. A column's
//           class (s-direct, s-prolong, s-vista, s-ours, s-ours-alt) gives its colour; with a single
//           column, a row with class "ours" is drawn in MFM's colour and the others in gray.
//   lives   rows are milestones, columns are lives, a cell the step at which that life earned it;
//           the tfoot rows "carried" and "end" give each life's carried episodes and last step.
//   memory  the lives of the table in data-from: milestones by step data-at against episodes carried in.
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var root = getComputedStyle(document.documentElement);
  function token(name) { return root.getPropertyValue(name).trim(); }
  function fmt(v) { return Math.abs(v) >= 1000 ? Number(v).toLocaleString('en-US') : String(Number(v.toFixed(3))); }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function label(parent, x, y, str, attrs) {
    var t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  function cells(tr) { return Array.prototype.slice.call(tr.cells); }
  function parse(cell) {
    var s = (cell.textContent || '').trim();
    var m = s.replace(/,/g, '').match(/^(-?\d*\.?\d+)(?:\s*±\s*(\d*\.?\d+))?/);
    return m ? { v: Number(m[1]), sd: m[2] != null ? Number(m[2]) : null, text: s, raw: m[1] } : null;
  }
  // round axis values from 0 to at least max
  function ticks(max, want) {
    var raw = max / want, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / mag;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag, out = [];
    for (var i = 0; i * step < max + step * 1e-6; i++) out.push(Number((i * step).toFixed(10)));
    if (out[out.length - 1] < max - step * 1e-6) out.push(Number((out.length * step).toFixed(10)));
    return out;
  }
  function tickList(fig, max, want) {
    return fig.dataset.ticks ? fig.dataset.ticks.split(/\s+/).map(Number) : ticks(max, want);
  }
  // a bar from the baseline xa to the data end xb, square at the baseline and rounded at the end
  function barPath(xa, xb, y, h, r) {
    r = Math.max(0, Math.min(r, h / 2, xb - xa));
    return 'M' + xa + ',' + y + 'H' + (xb - r) + 'Q' + xb + ',' + y + ' ' + xb + ',' + (y + r) +
      'V' + (y + h - r) + 'Q' + xb + ',' + (y + h) + ' ' + (xb - r) + ',' + (y + h) + 'H' + xa + 'Z';
  }
  // split a label into lines that fit a width, at about 6.6 pixels a character of 12-pixel text
  function wrap(str, width) {
    var words = str.split(' '), lines = [''], per = Math.max(6, Math.floor(width / 6.6));
    words.forEach(function (w) {
      var cur = lines[lines.length - 1];
      if (cur && (cur + ' ' + w).length > per) lines.push(w);
      else lines[lines.length - 1] = cur ? cur + ' ' + w : w;
    });
    return lines;
  }

  // ------------------------------------------------------------------ the tooltip, shared
  var tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  function showTip(title, lines, x, y) {
    tip.textContent = '';
    var b = document.createElement('b');
    b.textContent = title;
    tip.appendChild(b);
    lines.forEach(function (l) { tip.appendChild(document.createElement('br')); tip.appendChild(document.createTextNode(l)); });
    tip.hidden = false;
    // right of the pointer, or left of it near the edge (clientWidth leaves out the scrollbar)
    var w = tip.offsetWidth, h = tip.offsetHeight, vw = document.documentElement.clientWidth;
    tip.style.left = Math.max(8, x + 14 + w > vw - 8 ? x - 14 - w : x + 14) + 'px';
    tip.style.top = (y - h - 12 < 8 ? y + 18 : y - h - 12) + 'px';
  }
  function hideTip() { tip.hidden = true; }
  // marks that show a tooltip on hover and on focus; one tab stop per chart, arrow keys between marks
  function hover(svg, marks) {
    marks.forEach(function (m, i) {
      m.el.setAttribute('tabindex', i ? '-1' : '0');
      m.el.setAttribute('role', 'img');
      m.el.setAttribute('aria-label', m.title + ': ' + m.lines.join('; '));
      m.el.addEventListener('mousemove', function (e) { showTip(m.title, m.lines, e.clientX, e.clientY); });
      m.el.addEventListener('mouseleave', hideTip);
      m.el.addEventListener('focus', function () {
        var r = m.el.getBoundingClientRect();
        showTip(m.title, m.lines, r.left + r.width / 2, r.top);
      });
      m.el.addEventListener('blur', hideTip);
      m.el.addEventListener('keydown', function (e) {
        var to = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!to) return;
        e.preventDefault();
        var next = marks[Math.max(0, Math.min(marks.length - 1, i + to))];
        marks.forEach(function (o) { o.el.setAttribute('tabindex', '-1'); });
        next.el.setAttribute('tabindex', '0');
        next.el.focus();
      });
    });
  }
  function legend(fig, items, line) {
    var old = fig.querySelector('.chart-legend');
    if (old) old.remove();
    var box = document.createElement('div');
    box.className = 'chart-legend';
    items.forEach(function (it) {
      var span = document.createElement('span'), sw = document.createElement('i');
      sw.style.background = it.color;
      if (line) sw.className = 'line';
      span.appendChild(sw);
      span.appendChild(document.createTextNode(it.name));
      box.appendChild(span);
    });
    fig.insertBefore(box, fig.querySelector('.chart-plot'));
  }

  // ------------------------------------------------------------------ bars
  var SERIES = { 's-direct': '--series-base-1', 's-prolong': '--series-base-2', 's-vista': '--series-base-3',
                 's-ours': '--series-ours', 's-ours-alt': '--series-ours-alt' };
  function seriesColor(th) {
    var k = Object.keys(SERIES).filter(function (c) { return th.classList.contains(c); })[0];
    return token(k ? SERIES[k] : '--series-base-2');
  }
  function bars(fig, plot) {
    var table = fig.querySelector('table'), unit = fig.dataset.unit || '';
    var heads = cells(table.tHead.rows[0]).slice(1);
    var single = heads.length === 1;
    var series = heads.map(function (th) {
      return { name: th.textContent.trim(), color: seriesColor(th), ours: th.classList.contains('s-ours') };
    });
    var groups = Array.prototype.map.call(table.tBodies[0].rows, function (tr) {
      return { name: tr.cells[0].textContent.trim(), ours: tr.classList.contains('ours'),
               vals: cells(tr).slice(1).map(parse) };
    });
    var hi = 0;
    groups.forEach(function (g) { g.vals.forEach(function (d) { if (d) hi = Math.max(hi, d.v + (d.sd || 0)); }); });
    var tk = tickList(fig, Number(fig.dataset.max) || hi, 5), max = tk[tk.length - 1];
    var W = plot.clientWidth || 600;
    var labelW = single ? Math.min(220, Math.round(W * 0.4)) : Math.min(130, Math.max(84, Math.round(W * 0.22)));
    var x0 = labelW, x1 = W - 40, barH = single ? 16 : 12, gap = single ? 8 : 3, groupGap = 16;
    var sx = function (v) { return x0 + (x1 - x0) * v / max; };
    var svg = el('svg', { width: W, 'aria-hidden': null });
    var grid = el('g', {}, svg), body = el('g', {}, svg), y = 2, marks = [];
    groups.forEach(function (g) {
      var lines = wrap(g.name, labelW - 10), rowH = single ? Math.max(barH + gap, lines.length * 14 + 6) : 0;
      var top = y, blockH = single ? rowH : g.vals.length * (barH + gap) - gap;
      var t = label(body, 0, 0, '', { class: 'grp' });
      lines.forEach(function (l, i) {
        var s = el('tspan', { x: 0, y: top + blockH / 2 + 4 + (i - (lines.length - 1) / 2) * 14 }, t);
        s.textContent = l;
      });
      g.vals.forEach(function (d, si) {
        var by = single ? top + (rowH - barH) / 2 : y;
        if (d) {
          var s = series[si], ours = single ? g.ours : s.ours;
          var color = single ? token(g.ours ? '--series-ours' : '--series-base-2') : s.color;
          el('path', { d: barPath(x0, sx(d.v), by, barH, 4), fill: color }, body);
          if (d.sd) {
            var cy = by + barH / 2, a = sx(Math.max(0, d.v - d.sd)), b = sx(d.v + d.sd);
            el('path', { class: 'err', d: 'M' + a + ',' + cy + 'H' + b + 'M' + a + ',' + (cy - 4) + 'V' + (cy + 4) +
                         'M' + b + ',' + (cy - 4) + 'V' + (cy + 4), fill: 'none' }, body);
          }
          // the value as the table writes it, so 10.0 and 0.440 keep their digits
          if (ours || single) label(body, sx(d.v + (d.sd || 0)) + 6, by + barH / 2 + 4, d.raw, { class: 'val' });
          var hit = el('rect', { class: 'hit', x: x0 - 4, y: by - gap / 2, width: W - x0 + 4, height: barH + gap }, body);
          marks.push({ el: hit, title: single ? g.name : s.name + ', ' + g.name,
                       lines: [d.text + (unit ? ' ' + unit : '')] });
        }
        if (!single) y += barH + gap;
      });
      y = single ? y + rowH : y - gap + groupGap;
    });
    var bottom = y - (single ? 0 : groupGap) + 4;
    tk.forEach(function (v) {
      el('line', { class: v ? 'grid' : 'axis', x1: sx(v), x2: sx(v), y1: 0, y2: bottom }, grid);
      label(grid, sx(v), bottom + 15, fmt(v), { class: 'tick', 'text-anchor': 'middle' });
    });
    svg.setAttribute('height', bottom + 20);
    plot.textContent = '';
    plot.appendChild(svg);
    hover(svg, marks);
    if (!single) legend(fig, series);
  }

  // ------------------------------------------------------------------ lives
  function livesOf(table) {
    var names = cells(table.tHead.rows[0]).slice(1).map(function (th) { return th.textContent.trim(); });
    var foot = {};
    Array.prototype.forEach.call(table.tFoot.rows, function (tr) { foot[tr.dataset.row] = cells(tr).slice(1).map(parse); });
    return names.map(function (name, i) {
      var pts = [];
      Array.prototype.forEach.call(table.tBodies[0].rows, function (tr) {
        var d = parse(tr.cells[i + 1]);
        if (d) pts.push({ step: d.v, name: tr.cells[0].textContent.trim() });
      });
      pts.sort(function (a, b) { return a.step - b.step; });
      return { name: name, pts: pts, end: foot.end[i].v, carried: foot.carried[i].v, color: token('--life-' + (i + 1)) };
    });
  }
  function at(life, step) {
    var n = 0, last = null;
    life.pts.forEach(function (p) { if (p.step <= step) { n++; last = p; } });
    return { n: n, last: last };
  }
  function lives(fig, plot) {
    var all = livesOf(fig.querySelector('table')), budget = Number(fig.dataset.budget) || 0;
    var ymax = Number(fig.dataset.ymax) || 24;
    var xt = ticks(Math.max.apply(null, all.map(function (l) { return l.end; })), 5), xmax = xt[xt.length - 1];
    var yt = [0, 1, 2, 3, 4, 5, 6].map(function (k) { return ymax * k / 6; });
    var W = plot.clientWidth || 600, H = Math.max(220, Math.min(340, Math.round(W * 0.5)));
    var x0 = 30, x1 = W - 10, y0 = H - 24, y1 = 14;
    var sx = function (v) { return x0 + (x1 - x0) * v / xmax; };
    var sy = function (v) { return y0 - (y0 - y1) * v / yt[yt.length - 1]; };
    var svg = el('svg', { width: W, height: H });
    var g = el('g', {}, svg);
    yt.forEach(function (v) {
      el('line', { class: v ? 'grid' : 'axis', x1: x0, x2: x1, y1: sy(v), y2: sy(v) }, g);
      label(g, x0 - 6, sy(v) + 4, fmt(v), { class: 'tick', 'text-anchor': 'end' });
    });
    xt.forEach(function (v) {
      label(g, sx(v), y0 + 16, v ? fmt(v / 1000) + 'k' : '0', { class: 'tick', 'text-anchor': 'middle' });
    });
    if (budget) {
      el('line', { class: 'budget', x1: sx(budget), x2: sx(budget), y1: y1 - 6, y2: y0 }, g);
      label(g, sx(budget) - 5, y1 + 2, 'benchmark budget', { class: 'tick', 'text-anchor': 'end' });
    }
    // the end dots go on top of every line, so a life that ends on another's level still shows its end
    var ends = all.map(function (life) {
      var d = 'M' + sx(0) + ',' + sy(0), n = 0;
      life.pts.forEach(function (p) { n++; d += 'H' + sx(p.step) + 'V' + sy(n); });
      d += 'H' + sx(life.end);
      el('path', { d: d, fill: 'none', stroke: '#fff', 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
      el('path', { d: d, fill: 'none', stroke: life.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      return { cx: sx(life.end), cy: sy(n), r: 4.5, fill: life.color, stroke: '#fff', 'stroke-width': 2 };
    });
    ends.forEach(function (a) { el('circle', a, g); });
    // a crosshair that reads every life at the step under the pointer; arrow keys move it
    var cross = el('line', { class: 'cross', y1: y1 - 6, y2: y0, visibility: 'hidden' }, g);
    var area = el('rect', { class: 'hit', x: x0, y: y1 - 6, width: x1 - x0, height: y0 - y1 + 6, tabindex: 0, role: 'img',
                            'aria-label': 'Milestones of each life against steps; use the arrow keys to move along the steps' }, svg);
    var cur = budget || xmax / 2;
    function read(step, cx, cy) {
      cross.setAttribute('x1', sx(step)); cross.setAttribute('x2', sx(step));
      cross.setAttribute('visibility', 'visible');
      showTip('Step ' + fmt(Math.round(step)), all.map(function (life) {
        var a = at(life, Math.min(step, life.end));
        return life.name + ': ' + a.n + (step > life.end ? ' (ended at step ' + fmt(life.end) + ')' :
          a.last ? ', latest ' + a.last.name.toLowerCase() : '');
      }), cx, cy);
    }
    function off() { cross.setAttribute('visibility', 'hidden'); hideTip(); }
    area.addEventListener('mousemove', function (e) {
      var r = svg.getBoundingClientRect(), step = Math.max(0, Math.min(xmax, (e.clientX - r.left - x0) / (x1 - x0) * xmax));
      cur = step;
      read(step, e.clientX, e.clientY);
    });
    area.addEventListener('mouseleave', off);
    area.addEventListener('blur', off);
    function keyRead() { var r = svg.getBoundingClientRect(); read(cur, r.left + sx(cur), r.top + y1); }
    area.addEventListener('focus', keyRead);
    area.addEventListener('keydown', function (e) {
      var by = { ArrowRight: 1000, ArrowLeft: -1000, ArrowUp: 5000, ArrowDown: -5000 }[e.key];
      if (e.key === 'Home') cur = 0; else if (e.key === 'End') cur = xmax; else if (by) cur = Math.max(0, Math.min(xmax, cur + by));
      else return;
      e.preventDefault();
      keyRead();
    });
    plot.textContent = '';
    plot.appendChild(svg);
    legend(fig, all.map(function (life) {
      return { name: life.name + ', ' + fmt(life.carried) + ' episodes carried in', color: life.color };
    }), true);
  }

  // ------------------------------------------------------------------ memory against milestones
  function memory(fig, plot) {
    var src = document.getElementById(fig.dataset.from);
    if (!src) return;
    var all = livesOf(src.querySelector('table')), step = Number(fig.dataset.at) || 30000;
    var ymax = Number(fig.dataset.ymax) || 24;
    var xt = ticks(Math.max.apply(null, all.map(function (l) { return l.carried; })) || 1, 4), xmax = xt[xt.length - 1];
    var yt = [0, 1, 2, 3].map(function (k) { return ymax * k / 3; });
    var W = plot.clientWidth || 360, H = Math.max(220, Math.min(300, Math.round(W * 0.72)));
    var x0 = 30, x1 = W - 16, y0 = H - 38, y1 = 14;
    var sx = function (v) { return x0 + (x1 - x0) * v / xmax; };
    var sy = function (v) { return y0 - (y0 - y1) * v / yt[yt.length - 1]; };
    var svg = el('svg', { width: W, height: H }), g = el('g', {}, svg), marks = [];
    yt.forEach(function (v) {
      el('line', { class: v ? 'grid' : 'axis', x1: x0, x2: x1, y1: sy(v), y2: sy(v) }, g);
      label(g, x0 - 6, sy(v) + 4, fmt(v), { class: 'tick', 'text-anchor': 'end' });
    });
    xt.forEach(function (v) { label(g, sx(v), y0 + 16, fmt(v), { class: 'tick', 'text-anchor': 'middle' }); });
    label(g, (x0 + x1) / 2, y0 + 32, 'episodes carried in from earlier lives', { class: 'tick', 'text-anchor': 'middle' });
    var pts = all.map(function (life) { return { life: life, x: sx(life.carried), y: sy(at(life, step).n), n: at(life, step).n }; });
    el('path', { d: pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x + ',' + p.y; }).join(''),
                 fill: 'none', stroke: token('--line'), 'stroke-width': 2 }, g);
    pts.forEach(function (p, i) {
      el('circle', { cx: p.x, cy: p.y, r: 6, fill: p.life.color, stroke: '#fff', 'stroke-width': 2 }, g);
      var right = i < pts.length - 1;
      label(g, p.x + (right ? 10 : -10), p.y - 10, p.life.name + ': ' + p.n, { class: 'val', 'text-anchor': right ? 'start' : 'end' });
      var hit = el('circle', { class: 'hit', cx: p.x, cy: p.y, r: 14 }, svg);
      marks.push({ el: hit, title: p.life.name, lines: [
        fmt(p.life.carried) + ' episodes carried in',
        p.n + ' milestones by step ' + fmt(step) + ', ' + at(p.life, p.life.end).n + ' by its last step (' + fmt(p.life.end) + ')'] });
    });
    plot.textContent = '';
    plot.appendChild(svg);
    hover(svg, marks);
  }

  // ------------------------------------------------------------------ drawing
  var DRAW = { bars: bars, lives: lives, memory: memory };
  var figs = Array.prototype.slice.call(document.querySelectorAll('figure.chart[data-chart]'));
  function draw(fig) {
    var plot = fig.querySelector('.chart-plot'), fn = DRAW[fig.dataset.chart];
    if (!plot || !fn) return;
    var w = plot.clientWidth;
    if (!w || w === Number(plot.dataset.w)) return;
    plot.dataset.w = w;
    fn(fig, plot);
    if (!fig.classList.contains('drawn')) {
      fig.classList.add('drawn');
      var details = fig.querySelector('.chart-table');
      if (details) details.open = false;     // open in the HTML, so that without this script it is the table
    }
  }
  figs.forEach(draw);
  if ('ResizeObserver' in window) {
    var pending = null;
    new ResizeObserver(function () {
      clearTimeout(pending);
      pending = setTimeout(function () { hideTip(); figs.forEach(draw); }, 100);
    }).observe(document.body);
  }
})();
