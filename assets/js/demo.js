// Memory explorer, the #explorer part of index.html: replays one exported MFM run (see scripts/export_demo.py).
(function () {
  'use strict';

  var Q = window.MFMQuery;
  var ROOT = document.getElementById('explorer');   // the explorer's part of the page
  var linked = false;      // the address carries the explorer's state: a link to it was opened, or it has been used
  var BASE = 'assets/demo/';
  var D = null;            // the run
  var S = {                // what the page shows
    run: null, step: 0, ep: null, left: 'map', right: 'episode',
    query: '', result: null, only: false, follow: true,
    file: 'index.jsonl', logFilter: '', playing: null, speed: 1
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
    linked = !!want.run;
    getJSON(BASE + 'runs.json').then(function (runs) {
      var sel = $('#dx-run');
      sel.innerHTML = runs.map(function (r) {
        return '<option value="' + esc(r.name) + '">' + esc(r.title) + ' · ' +
          num(r.episodes) + ' episodes</option>';
      }).join('');
      sel.addEventListener('change', function () { S.ep = null; S.only = false; load(sel.value, {}); });
      var first = runs.some(function (r) { return r.name === want.run; }) ? want.run : runs[0].name;
      sel.value = first;
      return load(first, want);
    }).then(function () {
      // a link to a moment in a run opens on the explorer, now that it has its full height
      if (linked) ROOT.scrollIntoView({ behavior: 'instant' });
    }).catch(function (e) {
      status('The run could not be loaded (' + e.message + '). The page reads its data with fetch, ' +
             'so it has to be served over http: run "python scripts/serve.py" in the site folder ' +
             'and open http://localhost:8000/.', true);
    });
  }

  function load(name, want) {
    stop();
    status('Loading the run…');
    $('#dx-app').hidden = true;
    var video = getJSON(BASE + name + '/video.json').catch(function () { return null; });
    return Promise.all([getJSON(BASE + name + '/data.json'), video]).then(function (got) {
      var data = got[0];
      data.video = got[1];
      S.run = name;
      D = prepare(data);
      S.step = want.step != null ? Math.min(Math.max(0, want.step), D.max) : D.max;
      S.query = noTool() ? '' : want.q || '';
      S.ep = want.ep && D.byId[want.ep] ? want.ep : null;
      if (/^(index|map|files|log)$/.test(want.left || '')) S.left = want.left;
      if (/^(episode|turn|asked)$/.test(want.right || '')) S.right = want.right;
      if (want.file) S.file = want.file;
      $('#dx-left-body').innerHTML = '';
      $('#dx-right-body').dataset.state = '';
      S.result = null;
      $('#dx-q').value = S.query;
      fillHelpers();
      $$('#dx-form input, #dx-form button, .dx-helpers button, .dx-helpers select').forEach(function (x) {
        x.disabled = noTool();
      });
      $('#dx-notool').hidden = !noTool();
      renderRunMeta();
      renderTrack();
      status('');
      $('#dx-app').hidden = false;
      fitTrack();
      setupVideo();
      update();
      if (noTool()) $('#dx-check').textContent = ' This run had no episodes.py, so it has no call to check.';
      else getJSON(BASE + name + '/check.json').then(function (c) {
        $('#dx-check').textContent = ' Of the ' + c.total + ' calls in this run, ' + c.exact +
          ' were reproduced line for line, ' + c.partial + ' for the lines a pipe kept, ' + c.errors +
          ' had arguments the tool refused in the run and refuses here, ' +
          (c.unchecked ? c.unchecked + ' could not be checked, ' : '') + 'and ' + c.bad + ' differed.';
      }).catch(function () { $('#dx-check').textContent = ''; });
      var v = D.video;
      $('#dx-vidnote').textContent = v
        ? 'For this run it is ' + v.source + ', ' + v.width + '×' + v.height + ', steps ' + num(v.first_step) +
          ' to ' + num(v.last_step) + '. That frame k is step k was checked: for ' + v.check.matched + ' of ' +
          v.check.sampled + ' episodes sampled across the run, the frame the episode opened on matches the ' +
          'video at the episode’s first step and not at the steps around it.'
        : 'This run has no recording, so Play steps from one write to the next instead.';
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
    data.previous = data.previous || [];
    data.ctx = {
      files: function (id) { return data.files[id].texts; },
      notes: function (id) { var o = data.files[id].outcome; return (o && o.notes) || []; },
      flags: data.run.tool_flags, previous: data.previous
    };
    data.max = data.run.last_step || 0;
    data.turns.forEach(function (t) { data.max = Math.max(data.max, t.step || 0); });
    // the last step at which anything was written; the recording can go on after it
    data.memEnd = data.max;
    data.log.sections.forEach(function (s) { data.memEnd = Math.max(data.memEnd, s.step); });
    data.grid.cells.forEach(function (c) { data.memEnd = Math.max(data.memEnd, c[4]); });
    data.max = data.memEnd;
    if (data.video) data.max = Math.max(data.max, data.video.last_step);

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
          res.rows.forEach(function (r) {
            if (own(r)) (data.usedBy[r.id] = data.usedBy[r.id] || []).push(item);
          });
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

    // Map extent: fixed per region, so the scale holds still while the step moves. A run
    // is one region unless the agent's position jumps (a portal, a respawn far away):
    // places more than FAR blocks from everything seen before begin a region of their own.
    var FAR = 160, pad = 3, regions = [];
    function regionOf(x, z) {
      for (var i = 0; i < regions.length; i++) {
        var g = regions[i];
        if (x >= g.x0 - FAR && x <= g.x1 + FAR && z >= g.z0 - FAR && z <= g.z1 + FAR) return g;
      }
      var made = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, n: regions.length };
      regions.push(made);
      return made;
    }
    function grow(x, z, w) {
      var g = regionOf(x, z);
      g.x0 = Math.min(g.x0, x); g.x1 = Math.max(g.x1, x + w);
      g.z0 = Math.min(g.z0, z); g.z1 = Math.max(g.z1, z + w);
      return g.n;
    }
    data.index.forEach(function (r) { r._region = r.x != null ? grow(Number(r.x), Number(r.z), 0) : null; });
    data.grid.cells.forEach(function (c) { c[5] = grow(c[0], c[2], 1); });
    if (!regions.length) regions.push({ x0: 0, x1: 1, z0: 0, z1: 1, n: 0 });
    data.regions = regions.map(function (g) {
      return { x0: Math.floor(g.x0) - pad, x1: Math.ceil(g.x1) + pad,
               z0: Math.floor(g.z0) - pad, z1: Math.ceil(g.z1) + pad };
    });
    return data;
  }

  // ------------------------------------------------------------------ the memory at a step
  // a row of this life (a query can also return rows of the lives carried into it,
  // whose ids repeat this life's)
  function own(r) { return r.life == null && r._life == null; }
  function hits() {
    var hit = {};
    if (S.result && !S.result.error) S.result.rows.forEach(function (r) { if (own(r)) hit[r.id] = 1; });
    return hit;
  }
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
  // how much of an agent file exists at this step: its lines when the patches rebuild the
  // file exactly, and otherwise only the number of turns that had patched it
  function mineMeta(path) {
    if (D.mine.replayable && D.mine.replayable[path]) {
      var n = mineAt(path, S.step).filter(function (l) { return l.step <= S.step && l.text.trim(); }).length;
      return n ? plural(n, 'line') : '';
    }
    var turns = {};
    (D.mine.history[path] || []).forEach(function (h) { if (h.step <= S.step) turns[h.turn] = 1; });
    n = Object.keys(turns).length;
    return n ? 'patched in ' + plural(n, 'turn') : '';
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
  // a run whose harness gave the agent no tools/episodes.py (the flat-retrieval ablation)
  function noTool() { return D.run.has_tool === false; }
  function setQuery(text, run) {
    S.query = noTool() ? '' : text.trim();
    $('#dx-q').value = S.query;
    if (run !== false) update();
  }
  // `live`: a render while the video plays, which leaves the address and the video alone
  function update(live) {
    S.result = S.query ? Q.run(S.query, closed(), D.ctx) : null;
    if (S.ep == null) {         // show something: the newest episode returned, or the newest recorded
      var mine = S.result ? S.result.rows.filter(own) : [];
      var pool = mine.length ? mine : closed();
      if (pool.length) S.ep = pool[pool.length - 1].id;
    }
    S.sig = signature();
    renderTime();
    renderResult();
    renderTabs();
    renderLeft();
    renderRight();
    if (!live) { writeHash(); seekVideo(); }
  }

  // what the memory holds at this step, as counts: while they stay the same, playing
  // only has to move the clock
  function signature() {
    var s = S.step, t = turnAt(s);
    function count(list, at) {
      var n = 0;
      for (var i = 0; i < list.length; i++) if (at(list[i]) <= s) n++;
      return n;
    }
    return [count(D.index, function (r) { return r.last_step; }),
            count(D.index, function (r) { return r.first_step; }),
            count(D.grid.cells, function (c) { return c[4]; }),
            count(D.log.sections, function (x) { return x.step; }),
            t ? t.turn : 0, goalAt(s).done].join();
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
  // The page's own anchors (#video) share the address, so it is left alone until the explorer is used.
  function writeHash() {
    if (!linked) return;
    var parts = ['run=' + encodeURIComponent(S.run), 'step=' + S.step];
    if (S.ep) parts.push('ep=' + S.ep);
    if (S.query) parts.push('q=' + encodeURIComponent(S.query));
    if (S.left !== 'map') parts.push('left=' + S.left);
    if (S.right !== 'episode') parts.push('right=' + S.right);
    if (S.left === 'files') parts.push('file=' + encodeURIComponent(S.file));
    try { history.replaceState(null, '', '#' + parts.join('&')); } catch (_) { /* file:// */ }
  }

  // ------------------------------------------------------------------ header and time
  function renderRunMeta() {
    var r = D.run, bits = [];
    if (r.task) bits.push('task <b>' + esc(r.task) + '</b>');
    if (r.model) bits.push('model <b>' + esc(r.model) + '</b>');
    if ((r.ablations || []).length) bits.push('ablation <b>' + esc(r.ablations.join(', ')) + '</b>');
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
    m.order.filter(function (k) { return m.achieved[k] != null; }).forEach(function (k) {
      html += '<i class="dx-mark m" title="' + esc(k) + ', step ' + num(m.achieved[k]) + '" style="left:' +
        (100 * m.achieved[k] / D.max) + '%"><i class="dx-lab">' + esc(k) + '</i></i>';
    });
    if (D.memEnd < D.max) {                // the recording goes on after the memory stops
      var from = 100 * D.memEnd / D.max, why = ' title="Nothing was written to the memory after step ' +
        num(D.memEnd) + '; the recording goes on to step ' + num(D.max) + '"';
      html += '<i class="dx-hold" style="left:' + from + '%"' + why + '></i>' +
        '<i class="dx-hold-note" style="left:' + from + '%"' + why + '><i class="dx-lab">nothing written after step ' +
        num(D.memEnd) + '</i></i>';
    }
    $('#dx-track').innerHTML = html;
    var slider = $('#dx-step');
    slider.max = D.max;
  }

  // Show the track's labels that fit: left to right, each one clear of the last one shown and inside the track.
  // Goal labels near an end are slid inward rather than dropped. Measured, so it holds at any width.
  function fitTrack() {
    var track = $('#dx-track'), bar = track.getBoundingClientRect(), right = -Infinity;
    var labs = Array.prototype.slice.call(track.querySelectorAll('.dx-lab'));
    labs.forEach(function (el) {
      var goal = el.parentNode.classList.contains('m');
      el.style.transform = '';
      el.hides = goal ? el : el.parentNode;      // the hold's note goes with its rule; a goal keeps its tick
      el.hides.style.visibility = '';
    });
    labs.map(function (el) {
      var r = el.getBoundingClientRect(), shift = 0;
      if (el.hides === el) {
        shift = Math.max(0, bar.left - r.left) - Math.max(0, r.right - bar.right);
        if (shift) el.style.transform = 'translateX(calc(-50% + ' + shift + 'px))';
      }
      return { el: el, left: r.left + shift, right: r.right + shift };
    }).sort(function (a, b) { return a.left - b.left; }).forEach(function (l) {
      var fits = l.left >= right + 8 && l.right <= bar.right;
      l.el.hides.style.visibility = fits ? '' : 'hidden';
      if (fits) right = l.right;
    });
  }

  function renderClock() {
    $('#dx-step').value = S.step;
    var t = turnAt(S.step), g = goalAt(S.step);
    $('#dx-readout').innerHTML =
      'step <b>' + num(S.step) + '</b> of ' + num(D.max) +
      (t ? ' · turn ' + t.turn + ' of ' + D.turns.length : '') + '<br>' +
      (g.next ? 'goal <code>' + esc(g.next) + '</code>, ' : 'all goals verified, ') +
      g.done + '/' + g.total + ' verified';
    var cap = $('#dx-vidcap'), v = D.video;
    if (v && !D.videoFailed) {
      var bits = ['step ' + num(S.step)];
      if (S.step < v.first_step) bits.push('the recording begins at step ' + num(v.first_step));
      if (S.step > v.last_step) bits.push('the recording ends at step ' + num(v.last_step));
      if (S.step > D.memEnd) bits.push('nothing written after step ' + num(D.memEnd));
      if (S.playing === 'video' && S.speed !== 1) bits.push(S.speed + '×');
      cap.textContent = bits.join(' · ');
    }
  }

  function renderTime() {
    renderClock();
    var rows = closed().length, open = opened().length;
    var cells = D.grid.cells.filter(function (c) { return c[4] <= S.step; }).length;
    var secs = D.log.sections.filter(function (s) { return s.step <= S.step; });
    var lines = secs.reduce(function (n, s) { return n + s.text.split('\n').length + 1; }, 0);
    var paths = Object.keys(D.mine.history), begun = paths.filter(mineMeta);
    var few = paths.length <= 3;         // a short list is shown whole, a long one as it fills
    var mine = (few ? paths : begun).map(function (p) {
      return '<span><code>' + esc(p) + '</code> <b>' + (mineMeta(p) || 'not written yet') + '</b></span>';
    }).join('') + (!few && begun.length < paths.length
      ? '<span><code>mine/</code> <b>' + plural(paths.length - begun.length, 'more file') + ' not written yet</b></span>' : '');
    $('#dx-stats').innerHTML =
      '<span><code>index.jsonl</code> <b>' + plural(rows, 'row') + '</b></span>' +
      '<span><code>episodes/</code> <b>' + num(rows + open) + '</b>' + (open ? ' (' + open + ' open)' : '') + '</span>' +
      (D.grid.cells.length ? '<span><code>grid.jsonl</code> <b>' + plural(cells, 'row') + '</b></span>' : '') +
      '<span><code>logs.txt</code> <b>' + plural(lines, 'line') + '</b></span>' + mine +
      '<span class="dx-legend"><span class="dx-key">turn</span><span class="dx-key q">turn that queried the index</span>' +
      '<span class="dx-key w">turn that wrote to mine/</span><span class="dx-key m">goal verified</span></span>';
  }

  // ------------------------------------------------------------------ playing
  // With a recording, the video is the clock: each frame is one step, and the page reads
  // the step from the frame on screen. Without one, Play steps from one write to the next.
  function videoOK() { return !!(D && D.video && !D.videoFailed); }
  function videoStep() {
    var v = $('#dx-video');
    return D.video.first_step + Math.floor(v.currentTime * D.video.fps + 1e-6);
  }
  // `force`: seek even though the video is playing (Play was pressed before it had loaded)
  function seekVideo(force) {
    var v = $('#dx-video');
    if (!videoOK() || v.readyState < 1 || (S.playing === 'video' && !force)) return;
    var k = Math.max(0, Math.min(S.step - D.video.first_step, D.video.frames - 1));
    var t = (k + 0.5) / D.video.fps;       // the middle of frame k, so rounding cannot show k - 1
    if (Math.abs(v.currentTime - t) > 0.25 / D.video.fps) v.currentTime = t;
  }
  function setupVideo() {
    var v = $('#dx-video'), has = !!D.video;
    D.videoFailed = false;
    $('#dx-video-box').hidden = !has;
    $('#dx-speed').hidden = !has;
    $('.dx-cols').classList.toggle('has-video', has);
    $('#dx-vidcap').classList.remove('bad');
    if (!has) { v.removeAttribute('src'); v.load(); return; }
    v.defaultPlaybackRate = v.playbackRate = S.speed;
    v.src = BASE + S.run + '/' + D.video.src;
  }

  function stop() {
    var was = S.playing;
    S.playing = null;
    if (was === 'video') {
      cancelAnimationFrame(S.raf);
      var v = $('#dx-video');
      if (!v.paused) v.pause();
      // stay on the frame the video stopped at
      if (D && D.video && v.readyState >= 1) S.step = Math.min(Math.max(0, videoStep()), D.max);
    } else if (was) clearInterval(was);
    var b = $('#dx-play');
    if (b) { b.setAttribute('aria-pressed', 'false'); b.textContent = 'Play'; }
    if (was === 'video' && D) update();     // the full render, and the step into the address
  }
  function play() {
    if (S.playing) { stop(); return; }
    if (S.step >= D.max) S.step = 0;
    $('#dx-play').setAttribute('aria-pressed', 'true');
    $('#dx-play').textContent = 'Pause';
    S.follow = true;
    S.ep = null;
    if (videoOK()) {
      var v = $('#dx-video');
      seekVideo();                         // to the step, before the video takes over the clock
      S.playing = 'video';
      update(true);
      v.playbackRate = S.speed;
      var started = v.play();
      if (started && started.catch) started.catch(function () { if (S.playing === 'video') stop(); });
      bringIntoView();
      S.raf = requestAnimationFrame(tick);
      return;
    }
    S.playing = setInterval(function () {
      var next = D.keys.filter(function (k) { return k > S.step; })[0];
      if (next == null) { stop(); return; }
      S.ep = null;
      setStep(next);
    }, 650);
  }
  function tick() {
    if (S.playing !== 'video') return;
    var v = $('#dx-video');
    if (!v.seeking && v.readyState >= 1) {
      var step = Math.min(videoStep(), D.max);
      if (step !== S.step) advance(step);
      if (v.ended || step >= D.max) { stop(); return; }
    }
    S.raf = requestAnimationFrame(tick);
  }
  // A new step moves the clock. The panels are drawn again only when something was written,
  // and never more often than their last drawing allows (a slow one waits longer).
  var lastDraw = 0, drawCost = 0;
  function advance(step) {
    S.step = step;
    var now = performance.now();
    if (signature() !== S.sig && now - lastDraw >= Math.max(80, 4 * drawCost)) {
      if (S.follow) S.ep = null;
      update(true);
      lastDraw = performance.now();
      drawCost = lastDraw - now;
    } else renderClock();
  }
  // Play from the top of the page should show the video and the memory, not the header
  function bringIntoView() {
    var box = $('#dx-video-box').getBoundingClientRect(), bar = $('.dx-time'), cs = getComputedStyle(bar);
    var under = cs.position === 'sticky' ? (parseFloat(cs.top) || 0) + bar.offsetHeight : $('.topbar').offsetHeight;
    if (box.top >= under && box.bottom <= window.innerHeight) return;
    window.scrollTo({ top: window.scrollY + $('.dx-main').getBoundingClientRect().top - under, behavior: 'smooth' });
  }

  // ------------------------------------------------------------------ query result
  function renderResult() {
    var el = $('#dx-result'), r = S.result;
    if (!r) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    var fold = $('#dx-qfold');          // a query set from the map or the address opens its box
    if (fold) fold.open = true;
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
    var ownRows = r.rows.filter(own), earlier = r.rows.length - ownRows.length;
    if (r.rows.length) {
      var shown = ownRows.slice(0, 120);
      sheet = '<div class="dx-sheet">' +
        '<p class="dx-sheet-note">' + (r.options.sheet
          ? 'The contact sheet <code>--sheet</code> would write: the frame each matching episode opened on.'
          : 'The frames of the matching episodes (the tool tiles them into one image with <code>--sheet</code>).') +
        (ownRows.length > shown.length ? ' First ' + shown.length + ' shown.' : '') +
        (earlier ? ' ' + plural(earlier, 'row') + ' from an earlier life: the export has the index of those lives and not their frames.' : '') +
        '</p>' +
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
    var t = turnAt(S.step), r = S.ep && D.byId[S.ep];
    var key = S.right + ':' + (S.right === 'episode' ? S.ep : S.right === 'turn' ? (t || {}).turn : '');
    // the step changes what these tabs show only when the episode opens or closes, or the turn changes
    var state = [S.run, key, r ? (r.first_step > S.step ? 'later' : r.last_step > S.step ? 'open' : 'closed') : '',
                 t ? t.turn + (t.step === S.step ? '=' : '') : ''].join('|');
    if (el.dataset.state === state) return;
    if (S.right === 'episode') renderEpisode(el);
    else if (S.right === 'turn') renderTurn(el);
    else renderAsked(el);
    el.dataset.key = key;
    el.dataset.state = state;
    if (S.right !== 'asked') el.scrollTop = was === key ? top : 0;
  }

  // ------------------------------------------------------------------ index
  // what was just written arrives with a short flash; at the higher speeds rows arrive
  // faster than a flash can be seen, and the animations cost more than they show
  function flash() { return S.speed <= 4 ? 'just' : ''; }

  function renderIndex(el) {
    var rows = closed(), open = opened(), hit = hits();
    var since = prevTurnStep(), t = turnAt(S.step);
    function row(r, extra) {
      var cls = extra ? [extra] : [];
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
    }
    function openRows() {
      return open.map(function (r) {
        return '<tr class="open' + (r.id === S.ep ? ' sel' : '') + '" data-ep="' + r.id + '">' +
          '<td class="id">' + r.id + '</td><td class="num">' + r.first_step + '–</td>' +
          '<td colspan="4">open: frame, state and action are on disk; the outcome and the index row ' +
          'are written when the entry ends, at step ' + r.last_step + '</td></tr>';
      }).join('');
    }
    function count() { return plural(rows.length, 'row') + ' of ' + D.index.length; }
    // While the run plays and the table keeps the newest in view, only the newest rows are
    // drawn: laying out a table of thousands of rows at every write slows the whole page.
    var WINDOW = 200, live = S.playing === 'video' && S.follow && !S.result;
    function more(n) {
      return '<tr class="dx-more"><td colspan="6">' + plural(n, 'earlier row') +
        ' not drawn while the run plays; pause to scroll through them</td></tr>';
    }
    // Moving forward with no query, the table only grows (the index is in step order), so
    // the rows written since the last drawing are added to it instead of drawing it again.
    var tbody = $('table.dx-index tbody', el), drawn = Number(el.dataset.rows);
    var mode = S.run + (live ? ':live' : '');
    if (tbody && !S.result && el.dataset.ikey === mode && rows.length >= drawn) {
      $$('tr.open, tr.dx-more', tbody).forEach(function (tr) { tbody.removeChild(tr); });
      $$('tr.sel, tr.fresh', tbody).forEach(function (tr) { tr.classList.remove('sel', 'fresh'); });
      tbody.insertAdjacentHTML('beforeend', rows.slice(drawn).map(function (r) { return row(r, flash()); }).join(''));
      if (live) {
        while (tbody.rows.length > WINDOW) tbody.deleteRow(0);
        if (rows.length > WINDOW) tbody.insertAdjacentHTML('afterbegin', more(rows.length - WINDOW));
      }
      tbody.insertAdjacentHTML('beforeend', openRows());
      // "new": the rows written since the turn before this one, the last few of the table
      for (var i = rows.length - 1; i >= 0 && t && since >= 0 && rows[i].last_step > since; i--) {
        var tr = tbody.querySelector('tr[data-ep="' + rows[i].id + '"]');
        if (tr) tr.classList.add('fresh');
      }
      var now = S.ep && tbody.querySelector('tr[data-ep="' + S.ep + '"]');
      if (now) now.classList.add('sel');
      $('#dx-icount', el).textContent = count();
    } else {
      var list = (S.only && S.result) ? rows.filter(function (r) { return hit[r.id]; }) : rows;
      var cut = live && list.length > WINDOW ? list.length - WINDOW : 0;
      renderIndexWhole(el, (cut ? more(cut) : '') + list.slice(cut).map(function (r) { return row(r); }).join('') +
                       (S.only ? '' : openRows()), list.length || open.length, count(), hit);
    }
    el.dataset.ikey = S.result ? '' : mode;
    el.dataset.rows = rows.length;
    var target = (S.ep && $('tr.sel', el)) || null;
    if (S.follow && !S.query) el.scrollTop = el.scrollHeight;
    else if (target) {
      var top = target.offsetTop, h = el.clientHeight;
      if (top < el.scrollTop + 70 || top > el.scrollTop + h - 40) el.scrollTop = Math.max(0, top - h / 2);
    }
  }
  function renderIndexWhole(el, body, any, count, hit) {
    el.innerHTML =
      '<div class="dx-bar"><span><code>index.jsonl</code>, <span id="dx-icount">' + count +
      '</span></span><span class="grow"></span>' +
      (S.result && !S.result.error
        ? '<label><input type="checkbox" id="dx-only"' + (S.only ? ' checked' : '') + '> only the ' +
          Object.keys(hit).length + ' returned from this life</label>' : '') +
      '<label><input type="checkbox" id="dx-follow"' + (S.follow ? ' checked' : '') + '> keep the newest in view</label></div>' +
      (any
        ? '<table class="dx-index"><thead><tr><th>id</th><th>steps</th><th>tags</th><th>x, z</th>' +
          '<th>action</th><th>summary</th></tr></thead><tbody>' + body + '</tbody></table>'
        : '<p class="dx-empty">No row matches.</p>');
    var only = $('#dx-only', el), follow = $('#dx-follow', el);
    if (only) only.addEventListener('change', function () { S.only = only.checked; el.dataset.ikey = ''; renderLeft(); });
    follow.addEventListener('change', function () { S.follow = follow.checked; renderLeft(); });
  }

  // ------------------------------------------------------------------ map
  // Colours come from the stylesheet (demo.css, the --map-* and cell-kind variables).
  function cssVar(name, fallback) {
    var v = getComputedStyle(ROOT).getPropertyValue(name).trim();
    return v || fallback;
  }
  var KIND_VAR = { walked: '--walked', water: '--water', blocked: '--blocked', hazard: '--hazard',
                   lava: '--lava', floor: '--floor', placed: '--placed', opened: '--placed' };
  function kindColor(kind) { return KIND_VAR[kind] ? cssVar(KIND_VAR[kind], '#999') : '#999'; }
  var mapGeom = null;
  // What part of the area the map shows: zoom 1 is the whole area, and the centre is in blocks.
  // Kept per run and area, so it holds still while the step moves.
  var mapView = null, MAP_MAX_PX = 24;      // zoom in no further than 24 px a block

  function renderMap(el) {
    if (!$('#dx-map', el)) {
      var kinds = D.grid.kinds.map(function (k) {
        return '<span><i class="dx-sw" style="background:' + kindColor(k) + '"></i>' + esc(k) + ' cell</span>';
      }).join('');
      el.innerHTML =
        '<div class="dx-bar"><span id="dx-mapinfo"></span><span class="grow"></span>' +
        '<span class="dx-zoom"><button type="button" data-zoom="in" title="Zoom in" aria-label="Zoom in">+</button>' +
        '<button type="button" data-zoom="out" title="Zoom out" aria-label="Zoom out">&minus;</button>' +
        '<button type="button" data-zoom="fit" title="Show the whole area">fit</button></span></div>' +
        '<div class="dx-mapwrap"><canvas id="dx-map"></canvas></div>' +
        '<details class="dx-maplegend"><summary>Legend and controls</summary><div class="dx-keys">' + kinds +
        '<span><i class="dx-sw dot" style="background:var(--map-dot)"></i>where a turn began</span>' +
        '<span><i class="dx-sw dot" style="background:var(--match)"></i>returned by the query</span>' +
        '<span><i class="dx-sw dot" style="background:var(--map-sel)"></i>selected</span></div>' +
        '<p>Click a dot to open the episode' + (noTool() ? '' : ', click the ground to query <code>--near</code> it') + '. ' +
        'Scroll or pinch to zoom, drag to move.</p></details>';
      var cv = $('#dx-map', el);
      $('.dx-maplegend', el).addEventListener('toggle', drawMap);    // the map takes the room the legend leaves
      cv.addEventListener('click', mapClick);
      cv.addEventListener('mousemove', mapHover);
      cv.addEventListener('mouseleave', function () { $('#dx-tip').hidden = true; });
      cv.addEventListener('wheel', mapWheel, { passive: false });
      cv.addEventListener('pointerdown', mapDown);
      cv.addEventListener('pointermove', mapMove);
      cv.addEventListener('pointerup', mapUp);
      cv.addEventListener('pointercancel', mapUp);
      $('.dx-zoom', el).addEventListener('click', function (ev) {
        var z = ev.target.closest('button');
        if (!z || !mapGeom) return;
        if (z.dataset.zoom === 'fit') zoomMap(1 / mapView.z);
        else zoomMap(z.dataset.zoom === 'in' ? 2 : 0.5);
      });
    }
    drawMap();
  }

  function drawMap() {
    var cv = $('#dx-map');
    if (!cv) return;
    // the region of the selected episode, or of where the agent was at this step
    var here = (S.ep && D.byId[S.ep] && D.byId[S.ep].first_step <= S.step) ? D.byId[S.ep] : null;
    if (!here || here._region == null) {
      closed().concat(opened()).forEach(function (r) { if (r._region != null) here = r; });
    }
    var region = here && here._region != null ? here._region : 0;
    var rows = closed().concat(opened()).filter(function (r) { return r.x != null && r._region === region; });
    var cells = D.grid.cells.filter(function (c) { return c[4] <= S.step && c[5] === region; });
    var info = $('#dx-mapinfo');
    if (info) info.innerHTML = (D.grid.cells.length
      ? '<code>grid.jsonl</code>, ' + plural(cells.length, 'row') + ' of ' + D.grid.cells.length + '; '
      : 'this run kept no grid; ') + plural(rows.length, 'episode position') +
      (D.regions.length > 1 ? '; area ' + (region + 1) + ' of ' + D.regions.length +
        ' (the agent moved between places far apart; the map shows the one it was in)' : '');

    // The map fills the panel under its bar (it zooms, so it need not take the area's shape)
    var b = D.regions[region], W = cv.parentNode.clientWidth, dpr = window.devicePixelRatio || 1;
    var body = cv.closest('.dx-body'), bar = $('.dx-bar', body), legend = $('.dx-maplegend', body);
    var H = Math.max(300, Math.floor(body.clientHeight - bar.getBoundingClientRect().height -
                                     legend.getBoundingClientRect().height));
    var spanX = b.x1 - b.x0, spanZ = b.z1 - b.z0;
    var k0 = Math.min(W / spanX, H / spanZ);
    var key = S.run + ':' + region;
    if (!mapView || mapView.key !== key) {
      mapView = { key: key, z: 1, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, ep: S.ep };
    }
    mapGeom = { k0: k0, zmax: Math.max(1, MAP_MAX_PX / k0), W: W, H: H, b: b, pts: [] };
    fitView();
    // a newly selected episode off the edge of a zoomed map: centre on it
    var sel = S.ep !== mapView.ep && D.byId[S.ep];
    mapView.ep = S.ep;
    if (sel && rows.indexOf(sel) >= 0 && mapView.z > 1) {
      var v = viewAt(), sx = v.ox + (sel.x - b.x0) * v.k, sy = v.oz + (sel.z - b.z0) * v.k;
      if (sx < 12 || sx > W - 12 || sy < 12 || sy > H - 12) {
        mapView.cx = Number(sel.x); mapView.cz = Number(sel.z); fitView();
      }
    }
    var at = viewAt(), k = at.k, ox = at.ox, oz = at.oz;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    cv.classList.toggle('zoomed', mapView.z > 1);
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    function px(x) { return ox + (x - b.x0) * k; }
    function pz(z) { return oz + (z - b.z0) * k; }
    mapGeom.k = k; mapGeom.ox = ox; mapGeom.oz = oz;

    // a light grid every 8 blocks, and every block once they are big enough to tell apart
    g.strokeStyle = cssVar('--map-grid', '#eceef2'); g.lineWidth = 1;
    [[1, 0.45, k >= 16], [8, 1, true]].forEach(function (grid) {
      if (!grid[2]) return;
      var step = grid[0];
      g.globalAlpha = grid[1]; g.beginPath();
      for (var x = Math.ceil(b.x0 / step) * step; x <= b.x1; x += step) { g.moveTo(px(x) + 0.5, 0); g.lineTo(px(x) + 0.5, H); }
      for (var z = Math.ceil(b.z0 / step) * step; z <= b.z1; z += step) { g.moveTo(0, pz(z) + 0.5); g.lineTo(W, pz(z) + 0.5); }
      g.stroke();
    });
    g.globalAlpha = 1;

    var order = ['walked', 'floor', 'water', 'blocked', 'placed', 'opened', 'lava', 'hazard'];
    order.forEach(function (kind) {
      var ki = D.grid.kinds.indexOf(kind);
      if (ki < 0) return;
      g.fillStyle = kindColor(kind);
      cells.forEach(function (c) {
        if (c[3] === ki) g.fillRect(px(c[0]), pz(c[2]), Math.max(1, k - 0.5), Math.max(1, k - 0.5));
      });
    });

    g.strokeStyle = cssVar('--map-path', 'rgba(21,24,29,0.28)'); g.lineWidth = 1; g.beginPath();
    rows.forEach(function (r, i) { if (i) g.lineTo(px(r.x), pz(r.z)); else g.moveTo(px(r.x), pz(r.z)); });
    g.stroke();

    var match = cssVar('--match', '#f2b01e'), dotFill = cssVar('--map-dot', '#15181d'),
        dotRing = cssVar('--map-dot-ring', '#fff');
    var o = S.result && !S.result.error ? S.result.options : null, hit = hits();
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
    // the corners of what is in view (the area's corners until zoomed in)
    g.textBaseline = 'top'; g.textAlign = 'left';
    g.fillText('x ' + Math.max(b.x0, Math.floor(b.x0 - ox / k)) + ', z ' + Math.max(b.z0, Math.floor(b.z0 - oz / k)), 6, 5);
    g.textBaseline = 'bottom'; g.textAlign = 'right';
    g.fillText('x ' + Math.min(b.x1, Math.ceil(b.x0 + (W - ox) / k)) + ', z ' +
               Math.min(b.z1, Math.ceil(b.z0 + (H - oz) / k)), W - 6, H - 5);
    var zb = $('.dx-zoom');
    if (zb) {
      $('[data-zoom="in"]', zb).disabled = mapView.z >= mapGeom.zmax;
      $('[data-zoom="out"]', zb).disabled = $('[data-zoom="fit"]', zb).disabled = mapView.z <= 1;
    }
  }

  // scale (px a block) and offsets of the view, from mapView and the last drawn size
  function viewAt() {
    var gm = mapGeom, k = gm.k0 * mapView.z;
    return { k: k, ox: gm.W / 2 - (mapView.cx - gm.b.x0) * k, oz: gm.H / 2 - (mapView.cz - gm.b.z0) * k };
  }
  // keep the zoom in range and the area filling the view
  function fitView() {
    var gm = mapGeom, b = gm.b, v = mapView;
    v.z = Math.min(Math.max(v.z, 1), gm.zmax);
    if (v.z < 1.001) v.z = 1;
    var hw = gm.W / 2 / (gm.k0 * v.z), hh = gm.H / 2 / (gm.k0 * v.z);
    v.cx = b.x1 - b.x0 <= 2 * hw ? (b.x0 + b.x1) / 2 : Math.min(Math.max(v.cx, b.x0 + hw), b.x1 - hw);
    v.cz = b.z1 - b.z0 <= 2 * hh ? (b.z0 + b.z1) / 2 : Math.min(Math.max(v.cz, b.z0 + hh), b.z1 - hh);
  }
  var mapFrame = 0;
  function redrawMap() {
    if (!mapFrame) mapFrame = requestAnimationFrame(function () { mapFrame = 0; drawMap(); });
  }
  // zoom by f about (mx, my) in the canvas (its centre if left out), keeping the block there in place
  function zoomMap(f, mx, my) {
    var gm = mapGeom, v = mapView, z = Math.min(Math.max(v.z * f, 1), gm.zmax);
    if (z === v.z) return false;
    if (mx == null) { mx = gm.W / 2; my = gm.H / 2; }
    var k = gm.k0 * v.z, wx = v.cx + (mx - gm.W / 2) / k, wz = v.cz + (my - gm.H / 2) / k;
    v.z = z; k = gm.k0 * z;
    v.cx = wx - (mx - gm.W / 2) / k; v.cz = wz - (my - gm.H / 2) / k;
    fitView();
    redrawMap();
    return true;
  }
  function panMap(dx, dy) {
    var k = mapGeom.k0 * mapView.z;
    mapView.cx -= dx / k; mapView.cz -= dy / k;
    fitView();
    redrawMap();
  }
  function mapWheel(ev) {
    if (!mapGeom) return;
    var rect = ev.currentTarget.getBoundingClientRect();
    var d = ev.deltaY * (ev.deltaMode === 1 ? 33 : ev.deltaMode === 2 ? 400 : 1);
    // a trackpad pinch comes as a wheel with ctrl held and small deltas
    var f = Math.min(2, Math.max(0.5, Math.exp(-d * (ev.ctrlKey ? 0.01 : 0.002))));
    // past the zoom's ends the wheel scrolls the page, except a pinch, which would zoom the page
    if (zoomMap(f, ev.clientX - rect.left, ev.clientY - rect.top) || ev.ctrlKey) ev.preventDefault();
  }

  // Dragging moves a zoomed map; two fingers pinch. A press that moved is not a click.
  var mapPress = {}, mapDrag = null, mapDragged = false;
  function mapDown(ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (!Object.keys(mapPress).length) { mapDrag = { x: ev.clientX, y: ev.clientY, moved: false }; mapDragged = false; }
    mapPress[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  }
  function mapMove(ev) {
    var p = mapPress[ev.pointerId];
    if (!p || !mapGeom) return;
    var ids = Object.keys(mapPress);
    if (!mapDrag.moved && Math.hypot(ev.clientX - mapDrag.x, ev.clientY - mapDrag.y) <= 4) return;
    mapDrag.moved = true;
    $('#dx-tip').hidden = true;
    if (ids.length === 2) {
      var o = mapPress[ids[0] === String(ev.pointerId) ? ids[1] : ids[0]];
      var rect = ev.currentTarget.getBoundingClientRect();
      var before = Math.hypot(p.x - o.x, p.y - o.y), after = Math.hypot(ev.clientX - o.x, ev.clientY - o.y);
      panMap((ev.clientX - p.x) / 2, (ev.clientY - p.y) / 2);
      if (before > 0) zoomMap(after / before, (ev.clientX + o.x) / 2 - rect.left, (ev.clientY + o.y) / 2 - rect.top);
    } else if (ids.length === 1 && mapView.z > 1) {
      ev.currentTarget.classList.add('dragging');
      panMap(ev.clientX - p.x, ev.clientY - p.y);
    }
    p.x = ev.clientX; p.y = ev.clientY;
  }
  function mapUp(ev) {
    delete mapPress[ev.pointerId];
    if (Object.keys(mapPress).length) return;
    ev.currentTarget.classList.remove('dragging');
    mapDragged = !!(mapDrag && mapDrag.moved && (mapView.z > 1 || ev.pointerType !== 'mouse'));
    mapDrag = null;
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
    if (mapDragged) { mapDragged = false; return; }
    var p = mapPoint(ev);
    if (p.ep) { select(p.ep.id); return; }
    addFlag('--near', [String(Math.round(p.x)), String(Math.round(p.z))]);
  }
  function mapHover(ev) {
    var tip = $('#dx-tip');
    if (mapDrag && mapDrag.moved) { tip.hidden = true; return; }
    var p = mapPoint(ev), text;
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
        var meta = mineMeta(p);
        file(p, meta || 'not written yet', meta ? '' : 'absent');
      } else {
        file(p, 'no patch in the record wrote it');
      }
    });
    (D.mine.images || []).forEach(function (f) { file(f.path, 'an image the agent made, ' + kib(f.bytes)); });
    if (D.previous.length) {
      dir('carried from earlier lives');
      file('previous/index.jsonl', plural(D.previous.length, 'row'));
    }
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
    // while the run plays, a long file shows its newest lines (all of them once paused)
    function tail(lines) {
      var cut = S.playing === 'video' && lines.length > 200 ? lines.length - 200 : 0;
      return (cut ? '<span class="dx-cut">' + plural(cut, 'earlier line') + ' not drawn while the run plays</span>\n' : '') +
        (lines.slice(cut).join('\n') || '(empty)');
    }
    if (p === 'index.jsonl') {
      var rows = closed();
      html = head('Appended by the harness, one row each time an episode ends. The agent cannot edit it.',
                  readNote(/tools\/episodes\.py/, 'queried it') ) +
        '<pre class="term-like">' + tail(rows.map(function (r) { return esc(r._raw); })) + '</pre>';
    } else if (p === 'previous/index.jsonl') {
      var lives = {};
      D.previous.forEach(function (r) { lives[r.life] = (lives[r.life] || 0) + 1; });
      html = head('The merged index of the lives carried into this one, in place from the first step. ' +
                  'The agent reads it with <code>--previous</code>.',
                  readNote(/--previous|previous\/life_/, 'read from the earlier lives')) +
        '<p class="who">' + Object.keys(lives).map(function (k) {
          return 'life ' + esc(k) + ': ' + plural(lives[k], 'row');
        }).join(', ') + '. The export has these rows and not the episode files or frames of those lives, ' +
        'so a query over them shows no harness note and <code>--grep</code> reads the row only.</p>' +
        '<p><button type="button" class="dx-link" data-query="--previous --last 20">Run --previous --last 20</button></p>';
    } else if ((D.mine.images || []).some(function (f) { return f.path === p; })) {
      html = head('An image the agent wrote into <code>mine/</code> (a contact sheet or a comparison it made).') +
        '<p class="who">Images the agent made are listed and not included.</p>';
    } else if (p === 'grid.jsonl') {
      var cells = D.grid.cells.filter(function (c) { return c[4] <= S.step; });
      html = head('Appended by the harness as the agent moves: one row per cell, with the step it was learned.',
                  'It is the source of the [MAP] block in each prompt; see the Map tab.') +
        '<pre class="term-like">' + tail(cells.map(function (c) {
          return '{"cell": [' + c[0] + ', ' + c[1] + ', ' + c[2] + '], "kind": "' + D.grid.kinds[c[3]] + '", "step": ' + c[4] + '}';
        })) + '</pre>';
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
        var by = {};
        D.mine.history[p].forEach(function (h) { by[h.turn] = h.step; });
        html += '<p class="who">' + (D.run.rollouts === false
          ? 'The record names the turns that changed this file, not the changes (the session rollouts that hold ' +
            'the patches were not released)'
          : 'The patches in the record do not rebuild this file exactly') +
          ', so its text is shown as it stood when the run ended. ' + (mineMeta(p) ? 'Up to this step it had been ' + mineMeta(p) + ' of the ' +
          Object.keys(by).length + ' that changed it.' : 'At this step the agent had not written it yet.') + '</p>' +
          '<pre>' + esc(D.mine.files[p] != null ? D.mine.files[p] : '(the file was gone when the run ended)') + '</pre>';
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
      html = head('As it stood when the run ended. No <code>apply_patch</code> call in the record wrote it: ' +
                  'it is a template placed at the start of the life, or a file written from the shell or by the harness.') +
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
    function sec(s, cls) { return '<div class="dx-log-sec' + (cls || '') + '">' + markup(s.text, S.logFilter) + '</div>'; }
    function count() { return plural(secs.length, 'section') + ' of ' + D.log.sections.length; }
    // as with the index: while the run plays, only the newest sections are drawn
    var WINDOW = 200, live = S.playing === 'video' && S.follow && !needle;
    function more(n) {
      return n > 0 ? plural(n, 'earlier section') + ' not drawn while the run plays; pause to scroll through them' : '';
    }
    var box = $('#dx-logsecs', el), drawn = Number(el.dataset.secs), mode = S.run + (live ? ':live' : '');
    if (box && !needle && el.dataset.lkey === mode && secs.length >= drawn) {
      // the log only grows, so what was written since is added
      box.insertAdjacentHTML('beforeend', secs.slice(drawn).map(function (s) { return sec(s, ' ' + flash()); }).join(''));
      if (live) {
        while (box.children.length > WINDOW) box.removeChild(box.firstChild);
        $('#dx-logmore', el).textContent = more(secs.length - WINDOW);
      }
      $('#dx-lcount', el).textContent = count();
      el.dataset.secs = secs.length;
      if (S.follow) el.scrollTop = el.scrollHeight;
      return;
    }
    if (live) list = list.slice(-WINDOW);
    el.innerHTML =
      '<div class="dx-bar"><span><code>logs.txt</code>, <span id="dx-lcount">' + count() +
      '</span></span><span class="grow"></span>' +
      '<label>grep -i <input type="text" id="dx-logq" spellcheck="false" value="' + esc(S.logFilter) + '" placeholder="water"></label>' +
      (needle ? '<span>' + plural(list.length, 'section') + ' match</span>' : '') + '</div>' +
      (list.length ? '<p class="dx-cut dx-logmore" id="dx-logmore">' + (live ? more(secs.length - WINDOW) : '') + '</p>' +
                     '<div id="dx-logsecs">' + list.map(function (s) { return sec(s); }).join('') + '</div>'
                   : '<p class="dx-empty">Nothing in the log matches.</p>');
    el.dataset.lkey = needle || !list.length ? '' : mode;
    el.dataset.secs = secs.length;
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
      html += '<p class="who" style="font-size:.84rem;color:var(--ink-soft)">' +
        (noTool() ? 'This run had no query tool, ' : 'No query of the agent returned this episode, ') +
        (D.run.rollouts === false
          ? 'and which frames the agent opened is not in the published record (the harness counted ' +
            num(D.run.view_image_calls || 0) + ' image views over the run).</p>'
          : 'and it never opened the frame.</p>');
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
    if (!reads.length) html += '<p class="who" style="font-size:.84rem;color:var(--ink-soft)">' + (D.run.rollouts === false
      ? 'The turn’s events record no shell command.' : 'It ran no command in this turn.') + '</p>';
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

    if (D.run.rollouts === false) {
      html += '<p class="dx-h">Images it opened</p><p class="who" style="font-size:.84rem;color:var(--ink-soft)">' +
        'Not in the published record: the session rollouts that list them were not released. The harness ' +
        'counted ' + num(D.run.view_image_calls || 0) + ' image views over the run.</p>';
    } else if (t.views && t.views.length) {
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
        return '<li><code>' + esc(c.path) + '</code><span>' + esc(c.kind) + (c.added == null ? '' : ', +' + c.added +
          (c.removed ? ' −' + c.removed : '') + ' lines') + '</span>' +
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
    if (!D.calls.length) {
      el.innerHTML = '<p class="dx-empty">' + (noTool()
        ? 'This run had no <code>episodes.py</code> to query with. The agent read <code>index.jsonl</code> and the ' +
          'log with its own shell commands, which are in the Turn tab.'
        : 'The agent never queried the index in this run.') + '</p>';
      return;
    }
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
    window.scrollTo({ top: window.scrollY + $('.dx-query').getBoundingClientRect().top - 140, behavior: 'smooth' });
  }

  // ------------------------------------------------------------------ events
  function wire() {
    $('#dx-step').addEventListener('input', function (e) {
      var to = Number(e.target.value);       // read first: stopping redraws the slider at the video's step
      stop();
      setStep(to);
    });
    $('#dx-play').addEventListener('click', play);
    var video = $('#dx-video');
    video.addEventListener('click', function () { if (D) play(); });
    video.addEventListener('loadedmetadata', function () { video.playbackRate = S.speed; seekVideo(true); });
    video.addEventListener('pause', function () { if (S.playing === 'video') stop(); });
    video.addEventListener('ended', function () { if (S.playing === 'video') stop(); });
    video.addEventListener('error', function () {
      if (!D || !D.video || !video.getAttribute('src')) return;
      if (S.playing === 'video') stop();
      D.videoFailed = true;
      $('#dx-speed').hidden = true;
      var cap = $('#dx-vidcap');
      cap.classList.add('bad');
      cap.textContent = 'The recording could not be loaded, so Play steps from one write to the next.';
    });
    $('#dx-speed').addEventListener('change', function (e) {
      S.speed = Number(e.target.value) || 1;
      video.defaultPlaybackRate = video.playbackRate = S.speed;
      if (D) renderClock();
    });
    ['pointerdown', 'keydown', 'change'].forEach(function (type) {
      ROOT.addEventListener(type, function () { linked = true; }, true);
    });
    // space plays and pauses, as on a video, unless a field has the keyboard or the panels are
    // not what the reader is looking at (elsewhere on the page, space scrolls as usual)
    document.addEventListener('keydown', function (e) {
      if (e.key !== ' ' || !D || $('#dx-app').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      var box = $('.dx-main').getBoundingClientRect();
      if (box.bottom < window.innerHeight * 0.25 || box.top > window.innerHeight * 0.75) return;
      linked = true;
      e.preventDefault();
      play();
    });
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
    var more = $('#dx-stats-toggle');
    if (more) more.addEventListener('click', function () {
      var stats = $('#dx-stats');
      stats.hidden = !stats.hidden;
      more.setAttribute('aria-expanded', String(!stats.hidden));
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
      var t = e.target.closest('[data-call],[data-ep],[data-step],[data-file],[data-goto],[data-query]');
      if (!t || !D || t.closest('.dx-tabs')) return;
      if (t.dataset.query) { S.ep = null; setQuery(t.dataset.query); return; }
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
      resize = setTimeout(function () {
        if (!D) return;
        fitTrack();
        if (S.left === 'map') drawMap();
      }, 120);
    });
  }

  wire();
  // The run is fetched when the reader gets near the explorer, or at once for a link into it.
  if (readHash().run || !('IntersectionObserver' in window)) boot();
  else {
    var near = new IntersectionObserver(function (entries) {
      if (!entries.some(function (x) { return x.isIntersecting; })) return;
      near.disconnect();
      boot();
    }, { rootMargin: '800px 0px' });
    near.observe(ROOT);
  }
})();
