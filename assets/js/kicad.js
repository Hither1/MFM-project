// The KiCad task viewer: a table of the tasks of one recorded run and a replay of each task,
// from the files scripts/export_kicad.py writes under assets/kicad/<run>/.
(function () {
  'use strict';

  var root = document.getElementById('kicad-viewer');
  if (!root) return;
  var base = 'assets/kicad/' + root.dataset.run + '/';
  var dlg = document.getElementById('kicad-replay');
  var run = null, rows = [], sortKey = 'pos', sortDir = 1;
  var cur = null, step = 0, timer = null;

  function $(sel, el) { return (el || document).querySelector(sel); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function pad(n) { return ('00' + n).slice(-3); }
  function checks(t) { return Math.round(t.reward * 3); }
  function statusOf(t) {
    return t.reward >= 0.999 ? ['full', 'Solved'] : t.reward > 0 ? ['part', 'Partial'] : ['none', 'Not solved'];
  }

  // ---------- table ----------
  function renderHead() {
    var full = rows.filter(function (t) { return t.reward >= 0.999; }).length;
    var part = rows.filter(function (t) { return t.reward > 0 && t.reward < 0.999; }).length;
    var steps = rows.reduce(function (s, t) { return s + t.steps; }, 0);
    $('[data-k=mean]', root).textContent = run.mean_reward.toFixed(3);
    $('[data-k=full]', root).innerHTML = full + ' <small>/ ' + rows.length + '</small>';
    $('[data-k=part]', root).innerHTML = part + ' <small>/ ' + rows.length + '</small>';
    $('[data-k=steps]', root).textContent = fmt(steps);
  }

  function renderRows() {
    var body = $('tbody', root);
    body.textContent = '';
    rows.slice().sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      return (x < y ? -1 : x > y ? 1 : a.pos - b.pos) * sortDir;
    }).forEach(function (t) {
      var tr = el('tr');
      tr.appendChild(el('td', 'pos', t.pos));

      var td = el('td'), task = el('div', 'kv-task'), img = el('img'), name = el('div');
      img.src = base + t.id + '/thumb.webp';
      img.alt = '';
      img.loading = 'lazy';
      img.width = 96; img.height = 54;
      name.appendChild(el('b', null, t.title));
      name.appendChild(el('span', null, t.id + ' · ' + (t.kind === 'edit' ? 'edit a circuit' : 'design from scratch')));
      task.appendChild(img); task.appendChild(name); td.appendChild(task); tr.appendChild(td);

      td = el('td', 'n', t.reward.toFixed(2));
      var pips = el('span', 'kv-pips');
      pips.title = checks(t) + ' of 3 checks passed';
      for (var i = 0; i < 3; i++) pips.appendChild(el('i', i < checks(t) ? 'on' : ''));
      td.appendChild(pips); tr.appendChild(td);

      td = el('td', 'n', t.steps); tr.appendChild(td);
      td = el('td', 'n'); td.innerHTML = t.recall_steps + ' <small>/ ' + t.steps + '</small>'; tr.appendChild(td);

      var st = statusOf(t);
      td = el('td'); td.appendChild(el('span', 'kv-status ' + st[0], st[1])); tr.appendChild(td);

      td = el('td');
      var b = el('button', 'kv-open', 'View replay');
      b.type = 'button';
      b.setAttribute('aria-label', 'View replay of ' + t.title);
      td.appendChild(b); tr.appendChild(td);

      tr.addEventListener('click', function () { openTask(t); });
      body.appendChild(tr);
    });
    Array.prototype.forEach.call(root.querySelectorAll('thead th[data-sort]'), function (th) {
      if (th.dataset.sort === sortKey) th.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  Array.prototype.forEach.call(root.querySelectorAll('thead th[data-sort]'), function (th) {
    $('button', th).addEventListener('click', function () {
      var k = th.dataset.sort;
      if (k === sortKey) sortDir = -sortDir;
      else { sortKey = k; sortDir = k === 'pos' || k === 'title' ? 1 : -1; }
      renderRows();
    });
  });

  // ---------- replay ----------
  function actionText(a) {
    var c = a.coordinate ? ' (' + a.coordinate.join(', ') + ')' : '';
    switch (a.action) {
      case 'click':
        return (a.clicks === 2 ? 'double-click' : a.clicks === 3 ? 'triple-click' : a.button === 'right' ? 'right-click' : 'click') + c;
      case 'mouse_move': return 'move' + c;
      case 'key': return 'key ' + (a.keys || []).join('+');
      case 'type': return 'type ' + JSON.stringify(a.text == null ? '' : a.text);
      case 'scroll': return 'scroll ' + a.direction + ' ' + (a.amount || '') + c;
      case 'drag': return 'drag (' + (a.start_coordinate || []).join(', ') + ') to' + c;
      case 'wait': return 'wait' + (a.duration ? ' ' + a.duration + ' s' : '');
      case 'terminate': return 'finish: ' + a.status;
      default: return a.action || 'action';
    }
  }

  function stopPlay() {
    if (timer) { clearInterval(timer); timer = null; }
    $('[data-a=play]', dlg).textContent = 'Play';
  }

  function show(i) {
    var n = cur.data.steps.length;
    step = Math.max(0, Math.min(n - 1, i));
    var s = cur.data.steps[step], frame = $('.kr-frame', dlg), img = $('img', frame);
    img.src = base + cur.task.id + '/' + pad(step) + '.webp';
    img.alt = 'KiCad screen at step ' + (step + 1) + ' of ' + cur.task.title;
    if (step + 1 < n) new Image().src = base + cur.task.id + '/' + pad(step + 1) + '.webp';

    Array.prototype.forEach.call(frame.querySelectorAll('.kr-mark'), function (m) { m.remove(); });
    var acts = $('.kr-acts', dlg);
    acts.textContent = '';
    s.actions.forEach(function (a, k) {
      var li = el('li', a.coordinate ? 'pt' : '');
      li.appendChild(el('b', null, k + 1));
      li.appendChild(el('span', null, actionText(a)));
      acts.appendChild(li);
      if (a.coordinate) {
        var m = el('span', 'kr-mark' + (a.action === 'click' || a.action === 'drag' ? '' : ' move'), k + 1);
        m.style.left = a.coordinate[0] / 10 + '%';
        m.style.top = a.coordinate[1] / 10 + '%';
        frame.appendChild(m);
      }
    });
    if (!s.actions.length) acts.appendChild(el('li', 'kr-none', 'No action this step.'));

    $('[data-k=say]', dlg).textContent = (s.say || '').replace(/\*\*/g, '');
    $('[data-k=plan]', dlg).textContent = (s.plan || '').replace(/\*\*/g, '');
    $('[data-k=plan-h]', dlg).hidden = !s.plan;

    var mem = $('[data-k=mem]', dlg);
    mem.textContent = '';
    if (s.recall) {
      var r = el('div', 'kr-mem');
      r.appendChild(el('p', null, s.recall));
      mem.appendChild(r);
    }
    if (s.mem) {
      var f = el('div', 'kr-mem files');
      f.appendChild(document.createTextNode('Files the agent opened or wrote: '));
      s.mem.forEach(function (p, k) {
        if (k) f.appendChild(document.createTextNode(', '));
        f.appendChild(el('code', null, p));
      });
      mem.appendChild(f);
    }
    if (!s.recall && !s.mem) mem.appendChild(el('p', 'kr-none', 'Nothing from memory at this step.'));

    $('.kr-range', dlg).value = step;
    $('.kr-count', dlg).textContent = 'Step ' + (step + 1) + ' / ' + n;
    $('[data-a=prev]', dlg).disabled = step === 0;
    $('[data-a=next]', dlg).disabled = step === n - 1;
    if (step === n - 1) stopPlay();
  }

  function openTask(t) {
    stopPlay();
    cur = null;
    var st = statusOf(t);
    $('.kr-top h3', dlg).textContent = t.title;
    $('.kr-id', dlg).textContent = t.id + ' · task ' + t.pos + ' of ' + rows.length + ' · reward ' + t.reward.toFixed(2);
    var badge = $('.kr-top .kv-status', dlg);
    badge.className = 'kv-status ' + st[0];
    badge.textContent = st[1];
    $('[data-k=task]', dlg).textContent = t.instruction;
    $('[data-k=carried]', dlg).textContent = t.carried_tasks
      ? 'It started with the records of ' + t.carried_tasks + ' earlier task' + (t.carried_tasks > 1 ? 's' : '') +
        ' (' + fmt(t.carried_episodes) + ' episodes) and the notes written so far.'
      : 'The first task of the run: nothing carried in.';
    $('[data-k=say]', dlg).textContent = 'Loading…';
    $('[data-k=plan]', dlg).textContent = '';
    $('.kr-acts', dlg).textContent = '';
    $('[data-k=mem]', dlg).textContent = '';
    $('.kr-notes', dlg).textContent = '';
    $('.kr-frame img', dlg).removeAttribute('src');
    if (!dlg.open) dlg.showModal();

    fetch(base + t.id + '.json').then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (data) {
      cur = { task: t, data: data };
      var range = $('.kr-range', dlg);
      range.max = data.steps.length - 1;
      var notes = $('.kr-notes', dlg);
      data.notes.forEach(function (n) {
        var d = el('details');
        d.appendChild(el('summary', null, 'notes/' + n.name + (n.new ? ' (new)' : ' (updated)')));
        d.appendChild(el('pre', null, n.text + (n.cut ? '\n[cut here]' : '')));
        notes.appendChild(d);
      });
      if (!data.notes.length) notes.appendChild(el('p', 'kr-none', 'No notes written in this task.'));
      show(0);
    }).catch(function () {
      $('[data-k=say]', dlg).textContent = 'This replay could not be loaded.';
    });
  }

  $('[data-a=prev]', dlg).addEventListener('click', function () { stopPlay(); show(step - 1); });
  $('[data-a=next]', dlg).addEventListener('click', function () { stopPlay(); show(step + 1); });
  $('[data-a=close]', dlg).addEventListener('click', function () { dlg.close(); });
  $('[data-a=play]', dlg).addEventListener('click', function () {
    if (!cur) return;
    if (timer) return stopPlay();
    if (step === cur.data.steps.length - 1) show(0);
    this.textContent = 'Pause';
    timer = setInterval(function () { show(step + 1); }, 1400);
  });
  $('.kr-range', dlg).addEventListener('input', function () { stopPlay(); if (cur) show(+this.value); });
  dlg.addEventListener('close', stopPlay);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', function (e) {
    if (!cur || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') { stopPlay(); show(step - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { stopPlay(); show(step + 1); e.preventDefault(); }
  });

  // ---------- load ----------
  function load() {
    fetch(base + 'run.json').then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (data) {
      run = data;
      rows = data.tasks;
      renderHead();
      renderRows();
    }).catch(function () {
      $('tbody', root).innerHTML = '<tr><td colspan="7" class="kv-msg">The run could not be loaded.</td></tr>';
    });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); }
    }, { rootMargin: '800px 0px' });
    io.observe(root);
  } else load();
})();
