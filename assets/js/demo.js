// Memory explorer: replays one exported MFM run (see scripts/export_demo.py).
(function () {
  'use strict';

  var Q = window.MFMQuery;
  var BASE = 'assets/demo/';
  var D = null;            // the run
  var S = {                // what the page shows
    run: null, step: 0, ep: null, left: 'index', right: 'episode',
    query: '', result: null, only: false, follow: true,
    file: 'index.jsonl', logFilter: '', playing: null
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) { return Number(n).toLocaleString('en-US'); }
  function plural(n, one, many) { return num(n) + ' ' + (n === 1 ? one : (many || one + 's')); }
  function frame(id) { return BASE + S.run + '/frames/' + id + '.jpg'; }
  function kib(b) { return b < 1024 ? b + ' B' : (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KiB'; }
  function quote(a) { return /^[\w.,:\/=+-]+$/.test(a) ? a : "'" + a.replace(/'/g, "'\\''") + "'"; }
  function tags(list, cls) {
    return (list || []).map(function (t) {
      return '<span class="dx-tagchip ' + (cls || '') + esc(t) + '">' + esc(t) + '</span>';
    }).join('');
  }

  // ------------------------------------------------------------------ load
  function status(msg, bad) {
    var el = $('#dx-status');
    el.hidden = !msg; el.textContent = msg || '';
    el.className = 'dx-status wrap wide' + (bad ? ' error' : '');
  }

  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }

  function boot() {
    var want = readHash();
    getJSON(BASE + 'runs.json').then(function (runs) {
      var sel = $('#dx-run');
      sel.innerHTML = runs.map(function (r) {
        return '<option value="' + esc(r.name) + '">' + esc(r.title) + '</option>';
      }).join('');
      sel.addEventListener('change', function () { load(sel.value, {}); });
      var first = runs.some(function (r) { return r.name === want.run; }) ? want.run : runs[0].name;
      sel.value = first;
      return load(first, want);
    }).catch(function (e) {
      status('The run could not be loaded (' + e.message + '). The page reads its data with fetch, ' +
             'so it has to be served over http: run "python -m http.server" in the site folder ' +
             'and open http://localhost:8000/demo.html.', true);
    });
  }

  function load(name, want) {
    stop();
    status('Loading the run…');
    $('#dx-app').hidden = true;
    return getJSON(BASE + name + '/data.json').then(function (data) {
      S.run = name;
      D = prepare(data);
      S.step = want.step != null ? Math.min(Math.max(0, want.step), D.max) : D.max;
      S.query = want.q || '';
      S.ep = want.ep && D.byId[want.ep] ? want.ep : null;
      if (/^(index|map|files|log)$/.test(want.left || '')) S.left = want.left;
      if (/^(episode|turn|asked)$/.test(want.right || '')) S.right = want.right;
      if (want.file) S.file = want.file;
      $('#dx-left-body').innerHTML = '';
      S.result = null;
      $('#dx-q').value = S.query;
      fillHelpers();
      renderRunMeta();
      renderTrack();
      status('');
      $('#dx-app').hidden = false;
      update();
      getJSON(BASE + name + '/check.json').then(function (c) {
        $('#dx-check').textContent = ' Of the ' + c.total + ' calls in this run, ' + c.exact +
          ' were reproduced line for line, ' + c.partial + ' for the lines a pipe kept, ' + c.errors +
          ' had arguments the tool refused in the run and refuses here, and ' + c.bad + ' differed.';
      }).catch(function () { $('#dx-check').textContent = ''; });
    });
  }

  function prepare(data) {
    data.byId = {};
    data.files = {};
    data.index.forEach(function (r, i) {
      r._i = i;
      data.byId[r.id] = r;
      var e = data.episodes[r.id] || {};
      var f = { texts: [e.action, e.outcome, e.state].filter(Boolean) };
      ['action', 'outcome', 'state'].forEach(function (k) {
        try { f[k] = e[k] ? JSON.parse(e[k]) : null; } catch (_) { f[k] = null; }
      });
      data.files[r.id] = f;
    });
    data.ctx = {
      files: function (id) { return data.files[id].texts; },
      notes: function (id) { var o = data.files[id].outcome; return (o && o.notes) || []; }
    };
    data.max = data.run.last_step || 0;
    data.turns.forEach(function (t) { data.max = Math.max(data.max, t.step || 0); });

    // every query the agent made, with what it returned at the time
    data.calls = [];
    data.usedBy = {};
    data.turns.forEach(function (t) {
      var rows = data.index.filter(function (r) { return r.last_step <= t.step; });
      t.commands.forEach(function (c) {
        c.calls.forEach(function (call) {
          var res = Q.run(call.argv, rows, data.ctx);
          var item = { turn: t.turn, step: t.step, argv: call.argv, piped: call.piped,
                       n: res.rows.length, error: res.error || null,
                       text: call.argv.map(quote).join(' ') };
          data.calls.push(item);
          res.rows.forEach(function (r) { (data.usedBy[r.id] = data.usedBy[r.id] || []).push(item); });
        });
      });
      t.viewed = [];
      (t.views || []).forEach(function (v) {
        var m = /episodes\/(ep_\d{6})\//.exec(v);
        if (m) t.viewed.push(m[1]);
      });
    });
    data.openedBy = {};
    data.turns.forEach(function (t) {
      t.viewed.forEach(function (id) { (data.openedBy[id] = data.openedBy[id] || []).push(t); });
    });

    // steps at which something is written or read, for play and for the turn buttons
    var keys = { 0: 1 };
    data.index.forEach(function (r) { keys[r.last_step] = 1; });
    data.turns.forEach(function (t) { keys[t.step] = 1; });
    data.keys = Object.keys(keys).map(Number).sort(function (a, b) { return a - b; });

    // map extent over the whole run, so the scale holds still while the step moves
    var b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    function grow(x, z) {
      b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x);
      b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z);
    }
    data.grid.cells.forEach(function (c) { grow(c[0], c[2]); grow(c[0] + 1, c[2] + 1); });
    data.index.forEach(function (r) { if (r.x != null) grow(r.x, r.z); });
    if (!isFinite(b.x0)) b = { x0: 0, x1: 1, z0: 0, z1: 1 };
    var pad = 3;
    data.bounds = { x0: Math.floor(b.x0) - pad, x1: Math.ceil(b.x1) + pad,
                    z0: Math.floor(b.z0) - pad, z1: Math.ceil(b.z1) + pad };
    return data;
  }

  // ------------------------------------------------------------------ the memory at a step
  function closed() { return D.index.filter(function (r) { return r.last_step <= S.step; }); }
  function opened() {
    return D.index.filter(function (r) { return r.first_step <= S.step && r.last_step > S.step; });
  }
  function turnAt(step) {
    var t = null;
    D.turns.forEach(function (x) { if (x.step <= step) t = x; });
    return t;
  }
  function goalAt(step) {
    var m = D.run.milestones, done = 0;
    m.order.forEach(function (k) { if (m.achieved[k] != null && m.achieved[k] <= step) done++; });
    return { done: done, total: m.total || m.order.length, next: m.order[done] || null };
  }
  function mineAt(path, step) {      // lines of an agent file, each with the turn that wrote it
    var hist = (D.mine.history[path] || []), lines = [];
    hist.forEach(function (h) {
      if (h.kind === 'add' && h.step <= step) lines = lines.filter(function (l) { return l.step > step; });
      h.removed.forEach(function (gone) {
        if (h.step > step) return;
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].text === gone && lines[i].step <= step) { lines.splice(i, 1); break; }
        }
      });
      h.added.forEach(function (text) { lines.push({ text: text, turn: h.turn, step: h.step }); });
    });
    return lines;
  }
  function prevTurnStep() {
    var t = turnAt(S.step);
    if (!t) return -1;
    var i = D.turns.indexOf(t);
    return i > 0 ? D.turns[i - 1].step : -1;
  }

  // ------------------------------------------------------------------ state changes
  function setStep(step, keep) {
    S.step = Math.min(Math.max(0, Math.round(step)), D.max);
    if (!keep) S.follow = true;
    update();
  }
  function select(id, opts) {
    S.ep = id;
    if (!opts || opts.show !== false) S.right = 'episode';
    update();
  }
  function setQuery(text, run) {
    S.query = text.trim();
    $('#dx-q').value = S.query;
    if (run !== false) update();
  }
  function update() {
    S.result = S.query ? Q.run(S.query, closed(), D.ctx) : null;
    if (S.ep == null) {         // show something: the newest episode returned, or the newest recorded
      var pool = (S.result && S.result.rows.length) ? S.result.rows : closed();
      if (pool.length) S.ep = pool[pool.length - 1].id;
    }
    renderTime();
    renderResult();
    renderTabs();
    renderLeft();
    renderRight();
    writeHash();
  }

  function readHash() {
    var out = {};
    location.hash.replace(/^#/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      var k = kv.slice(0, i), v = decodeURIComponent(kv.slice(i + 1));
      if (k === 'step') out.step = parseInt(v, 10) || 0;
      else out[k] = v;
    });
    return out;
  }
  function writeHash() {
    var parts = ['run=' + encodeURIComponent(S.run), 'step=' + S.step];
    if (S.ep) parts.push('ep=' + S.ep);
    if (S.query) parts.push('q=' + encodeURIComponent(S.query));
    if (S.left !== 'index') parts.push('left=' + S.left);
    if (S.right !== 'episode') parts.push('right=' + S.right);
    if (S.left === 'files') parts.push('file=' + encodeURIComponent(S.file));
    try { history.replaceState(null, '', '#' + parts.join('&')); } catch (_) { /* file:// */ }
  }

  // ------------------------------------------------------------------ header and time
  function renderRunMeta() {
    var r = D.run, bits = [];
    if (r.task) bits.push('task <b>' + esc(r.task) + '</b>');
    if (r.model) bits.push('model <b>' + esc(r.model) + '</b>');
    bits.push('<b>' + num(D.index.length) + '</b> episodes over <b>' + num(D.max) + '</b> steps');
    bits.push('<b>' + D.turns.length + '</b> model turns');
    bits.push('<b>' + Object.keys(r.milestones.achieved).length + '/' + (r.milestones.total || 0) + '</b> goals');
    $('#dx-runmeta').innerHTML = bits.join(' · ');
  }

  function renderTrack() {
    var html = '', wrote = {};
    Object.keys(D.mine.history).forEach(function (p) {
      D.mine.history[p].forEach(function (h) { wrote[h.turn] = 1; });
    });
    D.turns.forEach(function (t) {
      var asked = t.commands.some(function (c) { return c.calls.length; });
      var cls = wrote[t.turn] ? 'w' : (asked ? 'q' : '');
      html += '<i class="dx-mark ' + cls + '" style="left:' + (100 * t.step / D.max) + '%"></i>';
    });
    var m = D.run.milestones;
    m.order.forEach(function (k) {
      if (m.achieved[k] == null) return;
      html += '<i class="dx-mark m" style="left:' + (100 * m.achieved[k] / D.max) + '%">' + esc(k) + '</i>';
    });
    $('#dx-track').innerHTML = html;
    var slider = $('#dx-step');
    slider.max = D.max;
  }

  function renderTime() {
    $('#dx-step').value = S.step;
    var t = turnAt(S.step), g = goalAt(S.step);
    $('#dx-readout').innerHTML =
      'step <b>' + num(S.step) + '</b> of ' + num(D.max) +
      (t ? ' · turn ' + t.turn + ' of ' + D.turns.length : '') + '<br>' +
      (g.next ? 'goal <code>' + esc(g.next) + '</code>, ' : 'all goals verified, ') +
      g.done + '/' + g.total + ' verified';

    var rows = closed().length, open = opened().length;
    var cells = D.grid.cells.filter(function (c) { return c[4] <= S.step; }).length;
    var secs = D.log.sections.filter(function (s) { return s.step <= S.step; });
    var lines = secs.reduce(function (n, s) { return n + s.text.split('\n').length + 1; }, 0);
    var mine = Object.keys(D.mine.history).map(function (p) {
      var n = mineAt(p, S.step).filter(function (l) { return l.step <= S.step && l.text.trim(); }).length;
      return '<span><code>' + esc(p) + '</code> <b>' + (n ? plural(n, 'line') : 'not written yet') + '</b></span>';
    }).join('');
    $('#dx-stats').innerHTML =
      '<span><code>index.jsonl</code> <b>' + plural(rows, 'row') + '</b></span>' +
      '<span><code>episodes/</code> <b>' + num(rows + open) + '</b>' + (open ? ' (' + open + ' open)' : '') + '</span>' +
      (D.grid.cells.length ? '<span><code>grid.jsonl</code> <b>' + plural(cells, 'row') + '</b></span>' : '') +
      '<span><code>logs.txt</code> <b>' + plural(lines, 'line') + '</b></span>' + mine +
      '<span class="dx-legend"><span class="dx-key">turn</span><span class="dx-key q">turn that queried the index</span>' +
      '<span class="dx-key w">turn that wrote to mine/</span><span class="dx-key m">goal verified</span></span>';
  }

  function stop() {
    if (S.playing) { clearInterval(S.playing); S.playing = null; }
    var b = $('#dx-play');
    if (b) { b.setAttribute('aria-pressed', 'false'); b.textContent = 'Play'; }
  }
  function play() {
    if (S.playing) { stop(); return; }
    if (S.step >= D.max) S.step = 0;
    $('#dx-play').setAttribute('aria-pressed', 'true');
    $('#dx-play').textContent = 'Pause';
    S.follow = true;
    S.playing = setInterval(function () {
      var next = D.keys.filter(function (k) { return k > S.step; })[0];
      if (next == null) { stop(); return; }
      S.ep = null;
      setStep(next);
    }, 650);
  }

  // ------------------------------------------------------------------ query result
  function renderResult() {
    var el = $('#dx-result'), r = S.result;
    if (!r) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    if (r.error) {
      el.innerHTML = '<div class="dx-trace err"><span><b>The tool refuses these arguments.</b></span></div>' +
        '<pre class="dx-out"><span class="e">' + esc(r.stderr) + '</span></pre>';
      return;
    }
    var trace = r.trace.map(function (s, i) {
      return (i ? '<span class="arrow">→</span>' : '') +
        '<span class="st">' + esc(s.step) + ' <b>' + s.n + '</b></span>';
    }).join('');
    var sheet = '';
    if (r.rows.length) {
      var shown = r.rows.slice(0, 120);
      sheet = '<div class="dx-sheet">' +
        '<p class="dx-sheet-note">' + (r.options.sheet
          ? 'The contact sheet <code>--sheet</code> would write: the frame each matching episode opened on.'
          : 'The frames of the matching episodes (the tool tiles them into one image with <code>--sheet</code>).') +
        (r.rows.length > shown.length ? ' First ' + shown.length + ' shown.' : '') + '</p>' +
        shown.map(function (x) {
          return '<button type="button" class="dx-thumb' + (x.id === S.ep ? ' sel' : '') + '" data-ep="' + x.id + '">' +
            '<img loading="lazy" src="' + frame(x.id) + '" alt="Frame of ' + x.id + '">' +
            '<span>' + x.id + ' s' + x.first_step + '</span></button>';
        }).join('') + '</div>';
    }
    el.innerHTML =
      '<div class="dx-trace">' + trace + '<span class="arrow">=</span><span><b>' +
      plural(r.rows.length, 'episode') + '</b> returned</span>' +
      '<span class="asof">over the memory as it stood at step ' + num(S.step) + '</span></div>' +
      '<pre class="dx-out">' + esc(r.stdout) +
      (r.stderr ? (r.stdout ? '\n' : '') + '<span class="e">' + esc(r.stderr) + '</span>' : '') + '</pre>' + sheet;
  }

  function fillHelpers() {
    function counts(get) {
      var c = {};
      D.index.forEach(function (r) { get(r).forEach(function (k) { if (k) c[k] = (c[k] || 0) + 1; }); });
      return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (k) {
        return '<option value="' + esc(k) + '">' + esc(k) + ' (' + c[k] + ')</option>';
      }).join('');
    }
    $('#dx-add-tag').innerHTML = '<option value="">--tag …</option>' +
      counts(function (r) { return r.tags || []; });
    $('#dx-add-action').innerHTML = '<option value="">--action …</option>' +
      counts(function (r) { return [r.action_kind]; });
  }

  // put a flag into the command line, replacing an earlier use of the same flag
  function addFlag(flag, values) {
    var toks;
    try { toks = Q.tokenize($('#dx-q').value); } catch (_) { toks = []; }
    var arity = { '--last': 1, '--steps': 2, '--near': 2, '--radius': 1, '--tag': 1, '--action': 1, '--grep': 1 };
    var out = [];
    for (var i = 0; i < toks.length; i++) {
      if (toks[i] === flag) { i += arity[flag] || 0; continue; }
      out.push(toks[i]);
    }
    out = out.concat([flag], values);
    setQuery(out.map(quote).join(' '));
  }

  // ------------------------------------------------------------------ tabs
  function renderTabs() {
    $$('#dx-left .dx-tabs button').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === S.left));
    });
    $$('#dx-right .dx-tabs button').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === S.right));
      if (b.dataset.tab === 'asked') b.innerHTML = 'Queries it ran<span class="n">' + D.calls.length + '</span>';
    });
  }
  function renderLeft() {
    var el = $('#dx-left-body');
    if (S.left === 'index') renderIndex(el);
    else if (S.left === 'map') renderMap(el);
    else if (S.left === 'files') renderFiles(el);
    else renderLog(el);
  }
  function renderRight() {
    var el = $('#dx-right-body'), top = el.scrollTop, was = el.dataset.key;
    var key = S.right + ':' + (S.right === 'episode' ? S.ep : S.right === 'turn' ? (turnAt(S.step) || {}).turn : '');
    if (S.right === 'episode') renderEpisode(el);
    else if (S.right === 'turn') renderTurn(el);
    else renderAsked(el);
    el.dataset.key = key;
    if (S.right !== 'asked') el.scrollTop = was === key ? top : 0;
  }

  // ------------------------------------------------------------------ index
  function renderIndex(el) {
    var rows = closed(), open = opened(), hit = {};
    if (S.result && !S.result.error) S.result.rows.forEach(function (r) { hit[r.id] = 1; });
    var since = prevTurnStep(), t = turnAt(S.step);
    var list = (S.only && S.result) ? rows.filter(function (r) { return hit[r.id]; }) : rows;
    var body = list.map(function (r) {
      var cls = [];
      if (hit[r.id]) cls.push('match');
      if (r.id === S.ep) cls.push('sel');
      if (t && r.last_step > since && r.last_step <= S.step && since >= 0) cls.push('fresh');
      return '<tr class="' + cls.join(' ') + '" data-ep="' + r.id + '">' +
        '<td class="id">' + r.id + '</td>' +
        '<td class="num">' + r.first_step + '–' + r.last_step + '</td>' +
        '<td>' + tags(r.tags) + '</td>' +
        '<td class="num">' + (r.x != null ? Number(r.x).toFixed(1) + ', ' + Number(r.z).toFixed(1) : '') + '</td>' +
        '<td class="act">' + esc(r.action_kind || '-') + '</td>' +
        '<td class="sum">' + esc(r.summary || '') + '</td></tr>';
    }).join('');
    if (!S.only) {
      body += open.map(function (r) {
        return '<tr class="open' + (r.id === S.ep ? ' sel' : '') + '" data-ep="' + r.id + '">' +
          '<td class="id">' + r.id + '</td><td class="num">' + r.first_step + '–</td>' +
          '<td colspan="4">open: frame, state and action are on disk; the outcome and the index row ' +
          'are written when the entry ends, at step ' + r.last_step + '</td></tr>';
      }).join('');
    }
    el.innerHTML =
      '<div class="dx-bar"><span><code>index.jsonl</code>, ' + plural(rows.length, 'row') +
      ' of ' + D.index.length + '</span><span class="grow"></span>' +
      (S.result && !S.result.error
        ? '<label><input type="checkbox" id="dx-only"' + (S.only ? ' checked' : '') + '> only the ' +
          S.result.rows.length + ' returned</label>' : '') +
      '<label><input type="checkbox" id="dx-follow"' + (S.follow ? ' checked' : '') + '> keep the newest in view</label></div>' +
      (list.length || open.length
        ? '<table class="dx-index"><thead><tr><th>id</th><th>steps</th><th>tags</th><th>x, z</th>' +
          '<th>action</th><th>summary</th></tr></thead><tbody>' + body + '</tbody></table>'
        : '<p class="dx-empty">No row matches.</p>');
    var only = $('#dx-only', el), follow = $('#dx-follow', el);
    if (only) only.addEventListener('change', function () { S.only = only.checked; renderLeft(); });
    follow.addEventListener('change', function () { S.follow = follow.checked; renderLeft(); });
    var target = (S.ep && $('tr.sel', el)) || null;
    if (S.follow && !S.query) el.scrollTop = el.scrollHeight;
    else if (target) {
      var top = target.offsetTop, h = el.clientHeight;
      if (top < el.scrollTop + 70 || top > el.scrollTop + h - 40) el.scrollTop = Math.max(0, top - h / 2);
    }
  }

  // ------------------------------------------------------------------ map
  // Colours come from the stylesheet (demo.css, the --map-* and cell-kind variables).
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fallback;
  }
  var KIND_VAR = { walked: '--walked', water: '--water', blocked: '--blocked', hazard: '--hazard',
                   lava: '--lava', floor: '--floor', placed: '--placed', opened: '--placed' };
  function kindColor(kind) { return KIND_VAR[kind] ? cssVar(KIND_VAR[kind], '#999') : '#999'; }
  var mapGeom = null;

  function renderMap(el) {
    if (!$('#dx-map', el)) {
      var kinds = D.grid.kinds.map(function (k) {
        return '<span><i class="dx-sw" style="background:' + kindColor(k) + '"></i>' + esc(k) + ' cell</span>';
      }).join('');
      el.innerHTML =
        '<div class="dx-bar"><span id="dx-mapinfo"></span><span class="grow"></span>' +
        '<span>click a dot to open the episode, click the ground to query <code>--near</code> it</span></div>' +
        '<div class="dx-mapwrap"><canvas id="dx-map"></canvas></div>' +
        '<div class="dx-maplegend">' + kinds +
        '<span><i class="dx-sw dot" style="background:var(--map-dot)"></i>where an episode began</span>' +
        '<span><i class="dx-sw dot" style="background:var(--match)"></i>returned by the query</span>' +
        '<span><i class="dx-sw dot" style="background:var(--map-sel)"></i>selected</span></div>';
      var cv = $('#dx-map', el);
      cv.addEventListener('click', mapClick);
      cv.addEventListener('mousemove', mapHover);
      cv.addEventListener('mouseleave', function () { $('#dx-tip').hidden = true; });
    }
    drawMap();
  }

  function drawMap() {
    var cv = $('#dx-map');
    if (!cv) return;
    var b = D.bounds, W = cv.parentNode.clientWidth, dpr = window.devicePixelRatio || 1;
    var spanX = b.x1 - b.x0, spanZ = b.z1 - b.z0;
    var H = Math.max(260, Math.min(520, Math.round(W * spanZ / spanX)));
    var k = Math.min(W / spanX, H / spanZ);
    var ox = (W - spanX * k) / 2, oz = (H - spanZ * k) / 2;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    function px(x) { return ox + (x - b.x0) * k; }
    function pz(z) { return oz + (z - b.z0) * k; }
    mapGeom = { k: k, ox: ox, oz: oz, b: b, pts: [] };

    // a light grid every 8 blocks
    g.strokeStyle = cssVar('--map-grid', '#eceef2'); g.lineWidth = 1; g.beginPath();
    for (var x = Math.ceil(b.x0 / 8) * 8; x <= b.x1; x += 8) { g.moveTo(px(x) + 0.5, 0); g.lineTo(px(x) + 0.5, H); }
    for (var z = Math.ceil(b.z0 / 8) * 8; z <= b.z1; z += 8) { g.moveTo(0, pz(z) + 0.5); g.lineTo(W, pz(z) + 0.5); }
    g.stroke();

    var order = ['walked', 'floor', 'water', 'blocked', 'placed', 'opened', 'lava', 'hazard'];
    var cells = D.grid.cells.filter(function (c) { return c[4] <= S.step; });
    order.forEach(function (kind) {
      var ki = D.grid.kinds.indexOf(kind);
      if (ki < 0) return;
      g.fillStyle = kindColor(kind);
      cells.forEach(function (c) {
        if (c[3] === ki) g.fillRect(px(c[0]), pz(c[2]), Math.max(1, k - 0.5), Math.max(1, k - 0.5));
      });
    });

    var rows = closed().concat(opened()).filter(function (r) { return r.x != null; });
    g.strokeStyle = cssVar('--map-path', 'rgba(21,24,29,0.28)'); g.lineWidth = 1; g.beginPath();
    rows.forEach(function (r, i) { if (i) g.lineTo(px(r.x), pz(r.z)); else g.moveTo(px(r.x), pz(r.z)); });
    g.stroke();

    var match = cssVar('--match', '#f2b01e'), dotFill = cssVar('--map-dot', '#15181d'),
        dotRing = cssVar('--map-dot-ring', '#fff');
    var o = S.result && !S.result.error ? S.result.options : null, hit = {};
    if (o) S.result.rows.forEach(function (r) { hit[r.id] = 1; });
    if (o && o.near) {
      g.beginPath();
      g.arc(px(o.near[0]), pz(o.near[1]), o.radius * k, 0, 2 * Math.PI);
      g.fillStyle = 'rgba(255,212,71,0.16)'; g.fill();
      g.strokeStyle = match; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
    }
    function dot(r, radius, fill, ring) {
      g.beginPath(); g.arc(px(r.x), pz(r.z), radius, 0, 2 * Math.PI);
      g.fillStyle = fill; g.fill();
      g.strokeStyle = ring; g.lineWidth = 1.5; g.stroke();
    }
    rows.forEach(function (r) {
      mapGeom.pts.push({ id: r.id, x: px(r.x), y: pz(r.z) });
      if (!hit[r.id] && r.id !== S.ep) dot(r, 3, dotFill, dotRing);
    });
    rows.forEach(function (r) { if (hit[r.id] && r.id !== S.ep) dot(r, 4.5, match, dotRing); });
    rows.forEach(function (r) { if (r.id === S.ep) dot(r, 6, cssVar('--map-sel', '#1f6fd6'), '#fff'); });

    g.fillStyle = cssVar('--map-label', '#7a8291'); g.font = '11px ' + getComputedStyle(document.body).fontFamily;
    g.textBaseline = 'top'; g.textAlign = 'left';
    g.fillText('x ' + b.x0 + ', z ' + b.z0, 6, 5);
    g.textBaseline = 'bottom'; g.textAlign = 'right';
    g.fillText('x ' + b.x1 + ', z ' + b.z1, W - 6, H - 5);

    var info = $('#dx-mapinfo');
    if (info) info.innerHTML = (D.grid.cells.length
      ? '<code>grid.jsonl</code>, ' + plural(cells.length, 'row') + ' of ' + D.grid.cells.length + '; '
      : 'this run kept no grid; ') + plural(rows.length, 'episode position');
  }

  function mapPoint(ev) {
    var rect = ev.currentTarget.getBoundingClientRect();
    var mx = ev.clientX - rect.left, my = ev.clientY - rect.top, best = null, bd = 9;
    mapGeom.pts.forEach(function (p) {
      var d = Math.hypot(p.x - mx, p.y - my);
      if (d <= bd) { bd = d; best = p; }      // the latest episode wins a tie
    });
    return { mx: mx, my: my, ep: best,
             x: mapGeom.b.x0 + (mx - mapGeom.ox) / mapGeom.k, z: mapGeom.b.z0 + (my - mapGeom.oz) / mapGeom.k };
  }
  function mapClick(ev) {
    var p = mapPoint(ev);
    if (p.ep) { select(p.ep.id); return; }
    addFlag('--near', [String(Math.round(p.x)), String(Math.round(p.z))]);
  }
  function mapHover(ev) {
    var p = mapPoint(ev), tip = $('#dx-tip');
    var text;
    if (p.ep) {
      var r = D.byId[p.ep.id];
      var n = mapGeom.pts.filter(function (q) { return Math.hypot(q.x - p.ep.x, q.y - p.ep.y) < 1; }).length;
      text = r.id + ' · steps ' + r.first_step + '–' + r.last_step + ' · ' + (r.action_kind || 'initial') +
             (n > 1 ? ' (' + n + ' episodes began here)' : '');
    } else {
      text = 'x ' + Math.round(p.x) + ', z ' + Math.round(p.z);
    }
    tip.textContent = text; tip.hidden = false;
    tip.style.left = Math.min(window.innerWidth - 330, ev.clientX + 14) + 'px';
    tip.style.top = (ev.clientY + 14) + 'px';
  }

  // ------------------------------------------------------------------ files
  function readsOf(re) {
    var turns = 0;
    D.turns.forEach(function (t) {
      if (t.step <= S.step && t.commands.some(function (c) { return re.test(c.script); })) turns++;
    });
    return turns;
  }

  function renderFiles(el) {
    var rows = closed().length, open = opened().length;
    var cells = D.grid.cells.filter(function (c) { return c[4] <= S.step; }).length;
    var secs = D.log.sections.filter(function (s) { return s.step <= S.step; }).length;
    var items = [];
    function dir(name) { items.push('<div class="dir">' + esc(name) + '</div>'); }
    function file(path, meta, cls) {
      items.push('<button type="button" data-file="' + esc(path) + '" class="' + (S.file === path ? 'sel ' : '') +
        (cls || '') + '">' + esc(path) + '<span class="meta">' + meta + '</span></button>');
    }
    dir('written by the harness');
    file('index.jsonl', plural(rows, 'row'));
    file('episodes/', plural(rows + open, 'directory', 'directories') + (open ? ', ' + open + ' open' : ''));
    if (D.grid.cells.length) file('grid.jsonl', plural(cells, 'row'));
    file('logs.txt', plural(secs, 'section'));
    dir('written by the agent');
    var mine = Object.keys(D.mine.files);
    if (!mine.length) items.push('<div class="dir absent">nothing in mine/</div>');
    mine.forEach(function (p) {
      var hist = D.mine.history[p];
      if (hist) {
        var n = mineAt(p, S.step).filter(function (l) { return l.step <= S.step && l.text.trim(); }).length;
        file(p, n ? plural(n, 'line') : 'not written yet', n ? '' : 'absent');
      } else {
        file(p, 'a template the agent may edit; unchanged');
      }
    });
    dir('given, read on demand');
    D.listing.forEach(function (f) { file(f.path, kib(f.bytes)); });

    el.innerHTML = '<div class="dx-files"><div class="dx-tree">' + items.join('') + '</div>' +
      '<div class="dx-view dx-pad" id="dx-view"></div></div>';
    renderFileView($('#dx-view', el));
  }

  function renderFileView(el) {
    var p = S.file, html = '';
    function head(who, more) {
      return '<h4>' + esc(p) + '</h4><p class="who">' + who + (more ? ' ' + more : '') + '</p>';
    }
    function readNote(re, what) {
      var n = readsOf(re);
      return 'The agent ' + what + ' in ' + plural(n, 'turn') + ' up to this step.';
    }
    if (p === 'index.jsonl') {
      var rows = closed();
      html = head('Appended by the harness, one row each time an episode ends. The agent cannot edit it.',
                  readNote(/tools\/episodes\.py/, 'queried it') ) +
        '<pre class="term-like">' + (rows.map(function (r) { return esc(r._raw); }).join('\n') || '(empty)') + '</pre>';
    } else if (p === 'grid.jsonl') {
      var cells = D.grid.cells.filter(function (c) { return c[4] <= S.step; });
      html = head('Appended by the harness as the agent moves: one row per cell, with the step it was learned.',
                  'It is the source of the [MAP] block in each prompt; see the Map tab.') +
        '<pre class="term-like">' + (cells.map(function (c) {
          return '{"cell": [' + c[0] + ', ' + c[1] + ', ' + c[2] + '], "kind": "' + D.grid.kinds[c[3]] + '", "step": ' + c[4] + '}';
        }).join('\n') || '(empty)') + '</pre>';
    } else if (p === 'logs.txt') {
      html = head('Appended by the harness after every plan entry.', readNote(/logs\.txt/, 'read or searched it')) +
        '<p><button type="button" class="dx-link" data-goto="log">Open it in the Log tab</button></p>';
    } else if (p === 'episodes/') {
      html = head('One directory per plan entry, written by the harness: <code>observation/image.png</code>, ' +
                  '<code>state/state.json</code>, <code>action.json</code>, and <code>outcome.json</code> once the entry ends.',
                  'Choose a row in the Index tab to open one.');
    } else if (D.mine.history[p]) {
      var ok = D.mine.replayable && D.mine.replayable[p];
      var lines = mineAt(p, S.step).filter(function (l) { return l.text.trim(); });
      var since = prevTurnStep();
      html = head('Written by the agent with <code>apply_patch</code> inside its turns.',
                  readNote(new RegExp(p.replace(/[.\/]/g, '\\$&')), 'read it back'));
      if (!ok) {
        html += '<p class="who">The patches in the record do not rebuild this file exactly, so its final text is shown.</p>' +
          '<pre>' + esc(D.mine.files[p]) + '</pre>';
      } else if (!lines.length) {
        html += '<p class="dx-empty">The file does not exist.</p>';
      } else {
        html += lines.map(function (l) {
          var cls = l.step > S.step ? 'later' : (l.step > since ? 'fresh' : '');
          return '<div class="dx-note-line ' + cls + '"><span class="when">' +
            (l.step > S.step ? 'not written yet: ' : '') + 'turn ' + l.turn + ', step ' + num(l.step) +
            ' <button type="button" class="dx-link" data-step="' + l.step + '" data-right="turn">go to the turn</button></span>' +
            esc(l.text) + '</div>';
        }).join('');
      }
    } else if (D.mine.files[p] != null) {
      html = head('A template placed in <code>mine/</code> at the start of the life. The agent may rewrite it; in this run it did not.') +
        '<pre>' + esc(D.mine.files[p]) + '</pre>';
    } else {
      var re = new RegExp(p.replace(/[.\/]/g, '\\$&'));
      html = head('Given to the agent at the start and the same in every run.',
                  p === 'AGENTS.md' ? 'It is the brief, loaded at the start of each turn.' : readNote(re, 'opened it')) +
        '<p class="who">Its text is not part of this export.</p>';
    }
    el.innerHTML = html;
  }

  // ------------------------------------------------------------------ log
  function markup(text, needle) {
    var out = esc(text);
    if (needle) {
      var re = new RegExp(esc(needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, function (m) { return '<mark>' + m + '</mark>'; });
    }
    return out.split('\n').map(function (line, i) {
      if (i === 0) return '<span class="h">' + line + '</span>';
      var m = /^\[([A-Z]+)\]/.exec(line);
      return m ? '<span class="k-' + m[1] + '">' + line + '</span>' : line;
    }).join('\n');
  }

  function renderLog(el) {
    var had = $('#dx-logq', el), caret = had ? had.selectionStart : null, focus = had && document.activeElement === had;
    var secs = D.log.sections.filter(function (s) { return s.step <= S.step; });
    var needle = S.logFilter.toLowerCase();
    var list = needle ? secs.filter(function (s) { return s.text.toLowerCase().indexOf(needle) >= 0; }) : secs;
    el.innerHTML =
      '<div class="dx-bar"><span><code>logs.txt</code>, ' + plural(secs.length, 'section') + ' of ' +
      D.log.sections.length + '</span><span class="grow"></span>' +
      '<label>grep -i <input type="text" id="dx-logq" spellcheck="false" value="' + esc(S.logFilter) + '" placeholder="water"></label>' +
      (needle ? '<span>' + plural(list.length, 'section') + ' match</span>' : '') + '</div>' +
      (list.length ? list.map(function (s) {
        return '<div class="dx-log-sec">' + markup(s.text, S.logFilter) + '</div>';
      }).join('') : '<p class="dx-empty">Nothing in the log matches.</p>');
    var q = $('#dx-logq', el);
    q.addEventListener('input', function () { S.logFilter = q.value; renderLog(el); });
    if (focus) { q.focus(); q.setSelectionRange(caret, caret); }
    else if (S.follow && !needle) el.scrollTop = el.scrollHeight;
  }

  // ------------------------------------------------------------------ episode
  var SEARCHABLE = ['first_step', 'last_step', 'x', 'z', 'tags', 'action_kind'];

  function renderEpisode(el) {
    var r = S.ep && D.byId[S.ep];
    if (!r) {
      el.innerHTML = '<p class="dx-empty">Choose a row in the index, a dot on the map, or a frame in a query result.</p>';
      return;
    }
    var f = D.files[r.id], future = r.first_step > S.step, open = !future && r.last_step > S.step;
    var st = f.state || {}, html = '';
    html += '<img class="dx-frame" src="' + frame(r.id) + '" alt="The frame ' + r.id + ' opened on">';
    html += '<div class="dx-pad">';
    html += '<div class="dx-eph"><h3>' + r.id + '</h3><span class="sub">steps ' + r.first_step + '–' + r.last_step +
      (f.action && f.action.turn != null ? ', turn ' + f.action.turn : '') + '</span>' + tags(r.tags) + '</div>';
    if (future) html += '<p class="dx-msg">This episode has not happened yet at step ' + num(S.step) +
      '. <button type="button" class="dx-link" data-step="' + r.last_step + '">Go to step ' + r.last_step + '</button></p>';
    if (open) html += '<p class="dx-msg">This episode is open at step ' + num(S.step) +
      ': its outcome and its index row are written when it ends.</p>';

    html += '<dl class="dx-kv">' +
      '<dt>action</dt><dd><code>' + esc(r.action_kind || 'initial state') + '</code></dd>' +
      '<dt>summary</dt><dd>' + esc(r.summary || '') + '</dd>';
    var notes = (f.outcome && f.outcome.notes) || [];
    if (notes.length) html += '<dt>note</dt><dd>' + esc(notes[0]) + '</dd>';
    if (f.action && f.action.plan) html += '<dt>plan</dt><dd>' + esc(f.action.plan) + '</dd>';
    if (st.pos) html += '<dt>position</dt><dd>' + [st.pos.x, st.pos.y, st.pos.z].map(function (v) {
      return Number(v).toFixed(1); }).join(', ') + '</dd>';
    if (st.vitals) html += '<dt>vitals</dt><dd>health ' + st.vitals.health + ', food ' + st.vitals.food + '</dd>';
    if (st.inventory) html += '<dt>inventory</dt><dd>' + (Object.keys(st.inventory).map(function (k) {
      return esc(k) + ' ×' + st.inventory[k]; }).join(', ') || 'empty') + '</dd>';
    html += '</dl>';

    // the index row, with the keys a filter matches on marked
    var keys = Object.keys(r).filter(function (k) { return k[0] !== '_'; });
    var body = keys.map(function (k) {
      var line = '  ' + esc(JSON.stringify(k)) + ': ' + esc(JSON.stringify(r[k]));
      return SEARCHABLE.indexOf(k) >= 0 ? '<b>' + line + '</b>' : line;
    }).join(',\n');
    html += '<p class="dx-h">How it is indexed</p>' +
      '<details open><summary>its row in index.jsonl<span class="hint">marked keys have a filter of their own; ' +
      '<code>--grep</code> reads the whole row and the three files below</span></summary>' +
      '<pre class="dx-searchable">{\n' + body + '\n}</pre></details>';
    [['action', 'action.json', 'the plan entry, its turn and the plan text'],
     ['outcome', 'outcome.json', 'what changed, the events and the harness notes'],
     ['state', 'state/state.json', 'the state at the first tick']].forEach(function (x) {
      var text = (D.episodes[r.id] || {})[x[0]];
      if (!text) return;
      var hidden = x[0] === 'outcome' && (open || future);
      html += '<details><summary>' + x[1] + '<span class="hint">' + x[2] + '</span></summary>' +
        (hidden ? '<p class="who">Not written yet at this step.</p>' : '<pre>' + esc(text) + '</pre>') + '</details>';
    });

    var used = D.usedBy[r.id] || [], seen = D.openedBy[r.id] || [];
    html += '<p class="dx-h">How the agent used it</p>';
    if (!used.length && !seen.length) {
      html += '<p class="who" style="font-size:.84rem;color:var(--ink-soft)">No query of the agent returned this episode, ' +
        'and it never opened the frame.</p>';
    } else {
      html += '<ul class="dx-usedby">' + seen.map(function (t) {
        return '<li><span>turn ' + t.turn + '</span><code>opened the frame (view_image)</code>' +
          '<button type="button" class="dx-link" data-step="' + t.step + '" data-right="turn">go</button></li>';
      }).join('') + used.map(function (c) {
        return '<li><span>turn ' + c.turn + '</span><code>' + esc(c.text) + '</code>' +
          '<button type="button" class="dx-link" data-call="' + D.calls.indexOf(c) + '">replay</button></li>';
      }).join('') + '</ul>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  // ------------------------------------------------------------------ turn
  function highlightTool(script) {
    return esc(script).replace(/(?:\.\/)?tools\/episodes\.py[^\n|;&]*/g, function (m) { return '<b>' + m + '</b>'; });
  }

  function renderTurn(el) {
    var t = turnAt(S.step);
    if (!t) { el.innerHTML = '<p class="dx-empty">No turn has begun.</p>'; return; }
    var g = goalAt(t.step), html = '<div class="dx-pad">';
    html += '<div class="dx-eph"><h3>turn ' + t.turn + '</h3><span class="sub">began at step ' + num(t.step) +
      (g.next ? ', goal ' + esc(g.next) : '') + '</span></div>';
    if (t.step !== S.step) html += '<p class="dx-msg">The latest turn at step ' + num(S.step) + '. ' +
      '<button type="button" class="dx-link" data-step="' + t.step + '">Go to its first step</button></p>';

    html += '<p class="dx-h">What the harness put in front of it</p>' +
      '<details><summary>the prompt<span class="hint">' + num(t.prompt.length) + ' characters; ' +
      (D.run.retrieval_block ? 'includes a [RECALL] block' : 'this run had no [RECALL] block, so every retrieval below is the agent’s own act') +
      '</span></summary><pre>' + esc(t.prompt) + '</pre></details>';

    var reads = t.commands;
    html += '<p class="dx-h">What it read (' + reads.length + ' command' + (reads.length === 1 ? '' : 's') + ')</p>';
    if (!reads.length) html += '<p class="who" style="font-size:.84rem;color:var(--ink-soft)">It ran no command in this turn.</p>';
    reads.forEach(function (c) {
      var calls = c.calls.map(function (call) {
        var i = D.calls.findIndex(function (x) { return x.turn === t.turn && x.argv === call.argv; });
        var item = D.calls[i];
        return '<button type="button" class="dx-link" data-call="' + i + '">replay ' + esc(call.argv.slice(0, 3).join(' ')) +
          (item ? ' (' + (item.error ? 'refused' : item.n + ' returned') + ')' : '') + '</button>';
      }).join(' ');
      html += '<div class="dx-cmdcard"><div class="top">' + tags(c.kinds, 'kind-') +
        '<span class="grow"></span>' + calls + '</div>' +
        '<pre class="script">' + highlightTool(c.script) + '</pre>' +
        '<details><summary>recorded output<span class="hint">' + num(c.output_chars) + ' characters' +
        (c.output_chars > c.output.length ? ', the first ' + num(c.output.length) + ' kept' : '') +
        (c.exit ? ', exit ' + c.exit : '') + '</span></summary><pre class="term-like">' +
        (esc(c.output) || '(no output)') + '</pre></details></div>';
    });

    if (t.views && t.views.length) {
      html += '<p class="dx-h">Images it opened</p><ul class="dx-usedby">' + t.views.map(function (v) {
        var m = /episodes\/(ep_\d{6})\//.exec(v);
        return '<li><code>' + esc(v) + '</code>' + (m
          ? '<button type="button" class="dx-link" data-ep="' + m[1] + '">open the episode</button>'
          : '<span style="color:var(--ink-faint)">a sheet it made</span>') + '</li>';
      }).join('') + '</ul>';
    }

    var wrote = (t.changes || []).filter(function (c) { return c.path !== 'actions.json'; });
    html += '<p class="dx-h">What it wrote</p><ul class="dx-usedby">' +
      wrote.map(function (c) {
        return '<li><code>' + esc(c.path) + '</code><span>' + esc(c.kind) + ', +' + c.added +
          (c.removed ? ' −' + c.removed : '') + ' lines</span>' +
          (D.mine.history[c.path] ? '<button type="button" class="dx-link" data-file="' + esc(c.path) + '">open</button>' : '') + '</li>';
      }).join('') +
      '<li><code>actions.json</code><span>the plan for the next steps</span></li></ul>';

    if (t.messages.length) {
      html += '<p class="dx-h">What it said</p>' + t.messages.map(function (m) {
        return '<p class="dx-msg">' + esc(m) + '</p>';
      }).join('');
    }
    html += '</div>';
    el.innerHTML = html;
  }

  // ------------------------------------------------------------------ the agent's queries
  function renderAsked(el) {
    if (!D.calls.length) { el.innerHTML = '<p class="dx-empty">The agent never queried the index in this run.</p>'; return; }
    var t = turnAt(S.step);
    el.innerHTML =
      '<div class="dx-bar"><span>Every <code>episodes.py</code> call in the run. Choose one to go to its turn and ' +
      'run it over the memory of that moment.</span></div>' +
      '<table class="dx-asked"><tbody>' + D.calls.map(function (c, i) {
        var cls = c.step > S.step ? 'future' : (t && c.turn === t.turn ? 'now' : '');
        return '<tr class="' + cls + '" data-call="' + i + '"><td class="num">turn ' + c.turn + '<br>step ' + num(c.step) + '</td>' +
          '<td><code>' + esc(c.text) + '</code>' + (c.piped ? ' <span style="color:var(--ink-faint)">' + esc(c.piped) + '</span>' : '') + '</td>' +
          '<td class="num">' + (c.error ? 'refused' : c.n + ' returned') + '</td></tr>';
      }).join('') + '</tbody></table>';
    var now = $('tr.now', el);
    if (now) el.scrollTop = Math.max(0, now.offsetTop - 80);
  }

  function replay(i) {
    var c = D.calls[i];
    if (!c) return;
    stop();
    S.step = c.step; S.ep = null; S.only = false;
    setQuery(c.text);
    window.scrollTo({ top: $('.dx-query').offsetTop - 140, behavior: 'smooth' });
  }

  // ------------------------------------------------------------------ events
  function wire() {
    $('#dx-step').addEventListener('input', function (e) { stop(); setStep(Number(e.target.value)); });
    $('#dx-play').addEventListener('click', play);
    $('#dx-prev').addEventListener('click', function () {
      stop();
      var prev = D.turns.filter(function (t) { return t.step < S.step; }).pop();
      setStep(prev ? prev.step : 0);
    });
    $('#dx-next').addEventListener('click', function () {
      stop();
      var next = D.turns.filter(function (t) { return t.step > S.step; })[0];
      setStep(next ? next.step : D.max);
    });
    $('#dx-form').addEventListener('submit', function (e) {
      e.preventDefault(); S.ep = null; setQuery($('#dx-q').value);
    });
    $('#dx-clear').addEventListener('click', function () { S.only = false; setQuery(''); });
    $$('.dx-helpers button[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.dataset.add.split(' ');
        if (parts[0] === '--steps') addFlag('--steps', [String(Math.max(0, S.step - 200)), String(S.step)]);
        else if (parts[0] === '--grep') {
          var text = window.prompt('Text to look for in the index row, action.json, outcome.json and state.json', 'water');
          if (text) addFlag('--grep', [text]);
        } else addFlag(parts[0], parts.slice(1));
      });
    });
    [['#dx-add-tag', '--tag'], ['#dx-add-action', '--action']].forEach(function (x) {
      $(x[0]).addEventListener('change', function (e) {
        if (e.target.value) addFlag(x[1], [e.target.value]);
        e.target.value = '';
      });
    });
    $$('.dx-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.closest('#dx-left')) { S.left = b.dataset.tab; $('#dx-left-body').innerHTML = ''; }
        else S.right = b.dataset.tab;
        renderTabs(); renderLeft(); renderRight(); writeHash();
      });
    });
    // one listener for everything that points at an episode, a step, a file or a call
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-call],[data-ep],[data-step],[data-file],[data-goto]');
      if (!t || !D || t.closest('.dx-tabs')) return;
      if (t.dataset.call != null) { replay(Number(t.dataset.call)); return; }
      if (t.dataset.ep) { S.follow = false; select(t.dataset.ep); return; }
      if (t.dataset.step != null) {
        stop();
        if (t.dataset.right) S.right = t.dataset.right;
        setStep(Number(t.dataset.step));
        return;
      }
      if (t.dataset.file) {
        S.file = t.dataset.file; S.left = 'files';
        $('#dx-left-body').innerHTML = '';
        renderTabs(); renderLeft();
        return;
      }
      if (t.dataset.goto) {
        S.left = t.dataset.goto; $('#dx-left-body').innerHTML = '';
        renderTabs(); renderLeft();
      }
    });
    var resize = null;
    window.addEventListener('resize', function () {
      clearTimeout(resize);
      resize = setTimeout(function () { if (D && S.left === 'map') drawMap(); }, 120);
    });
  }

  wire();
  boot();
})();
