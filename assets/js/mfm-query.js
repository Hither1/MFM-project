// A port of the MFM query tool (mfm/memory/tools/episodes.py) to the browser.
// Same flags, same filter order, same output lines. Loaded by demo.html and by
// scripts/check_demo.js, which compares it with the output the run recorded.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFMQuery = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var USAGE = 'usage: episodes.py [--last N] [--steps A B] [--near X Z] [--radius R] ' +
              '[--tag TAG] [--action ACTION] [--grep TEXT] [--previous] [--sheet PNG] [--json]';

  // flag -> [number of values, type]
  var FLAGS = {
    '--root': [1, 'str'], '--last': [1, 'int'], '--steps': [2, 'int'], '--near': [2, 'float'],
    '--radius': [1, 'float'], '--tag': [1, 'str'], '--action': [1, 'str'], '--grep': [1, 'str'],
    '--previous': [0], '--same-screen': [1, 'str'], '--sheet': [1, 'str'], '--json': [0]
  };

  // Split a command line the way a shell would: quotes group, backslash escapes.
  function tokenize(line) {
    var out = [], cur = '', has = false, q = null;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        if (c === q) q = null;
        else if (c === '\\' && q === '"' && i + 1 < line.length) cur += line[++i];
        else cur += c;
      } else if (c === '"' || c === "'") { q = c; has = true; }
      else if (c === '\\' && i + 1 < line.length) { cur += line[++i]; has = true; }
      else if (/\s/.test(c)) { if (has || cur) { out.push(cur); cur = ''; has = false; } }
      else { cur += c; has = true; }
    }
    if (q) throw new Error('unterminated quote');
    if (has || cur) out.push(cur);
    return out;
  }

  function isNumber(s) { return /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s); }

  function parse(argv) {
    if (typeof argv === 'string') {
      try { argv = tokenize(argv); } catch (e) { return { error: e.message }; }
    }
    argv = argv.slice();
    if (argv.length && /(^|\/)episodes\.py$/.test(argv[0])) argv.shift();
    var o = { radius: 6.0 };
    for (var i = 0; i < argv.length; i++) {
      var tok = argv[i], inline = null;
      var eq = tok.indexOf('=');
      if (tok.slice(0, 2) === '--' && eq > 0) { inline = tok.slice(eq + 1); tok = tok.slice(0, eq); }
      var name = tok;
      if (!FLAGS[name] && tok.slice(0, 2) === '--') {       // argparse accepts unique prefixes
        var hits = Object.keys(FLAGS).filter(function (f) { return f.indexOf(tok) === 0; });
        if (hits.length === 1) name = hits[0];
        else if (hits.length > 1) return { error: 'ambiguous option: ' + tok + ' could match ' + hits.join(', ') };
      }
      var spec = FLAGS[name];
      if (!spec) return { error: 'unrecognized arguments: ' + argv.slice(i).join(' ') };
      var n = spec[0], vals = [];
      if (inline !== null) vals.push(inline);
      while (vals.length < n) {
        var v = argv[i + 1];
        if (v === undefined || (v[0] === '-' && !isNumber(v))) {
          return { error: 'argument ' + name + ': expected ' + (n === 1 ? 'one argument' : n + ' arguments') };
        }
        vals.push(v); i++;
      }
      for (var k = 0; k < vals.length; k++) {
        if (spec[1] === 'int') {
          if (!/^[-+]?\d+$/.test(vals[k])) return { error: 'argument ' + name + ": invalid int value: '" + vals[k] + "'" };
          vals[k] = parseInt(vals[k], 10);
        } else if (spec[1] === 'float') {
          if (!isNumber(vals[k].replace(/^\+/, ''))) return { error: 'argument ' + name + ": invalid float value: '" + vals[k] + "'" };
          vals[k] = parseFloat(vals[k]);
        }
      }
      var key = name.slice(2).replace(/-/g, '_');
      o[key] = n === 0 ? true : (n === 1 ? vals[0] : vals);
    }
    return { options: o };
  }

  // --- the filters, in the order main() applies them
  function steps(rows, a, b) {
    var lo = Math.min(a, b), hi = Math.max(a, b);
    return rows.filter(function (r) {
      return r.first_step != null && r.last_step != null && r.first_step <= hi && r.last_step >= lo;
    });
  }
  function near(rows, x, z, radius) {
    return rows.filter(function (r) {
      if (r.x == null || r.z == null) return false;
      return Math.hypot(Number(r.x) - x, Number(r.z) - z) <= radius;
    });
  }
  function tagged(rows, tag) {
    return rows.filter(function (r) { return (r.tags || []).indexOf(tag) >= 0; });
  }
  function sameAction(rows, kind) {
    return rows.filter(function (r) { return r.action_kind === kind; });
  }
  // `files(id)` returns the text of action.json, outcome.json and state/state.json
  function grep(rows, text, files) {
    var needle = text.toLowerCase();
    return rows.filter(function (r) {
      var hay = [r._raw || JSON.stringify(r)].concat(files ? files(r.id) : []);
      return hay.some(function (h) { return h && h.toLowerCase().indexOf(needle) >= 0; });
    });
  }
  function recent(rows, k) { return k > 0 ? rows.slice(-k) : []; }

  function firstNote(notes, limit) {
    limit = limit || 220;
    if (!notes || !notes.length) return null;
    var note = String(notes[0]).split(/\s+/).filter(Boolean).join(' ');
    return note.length <= limit ? note : note.slice(0, limit - 3).replace(/\s+$/, '') + '...';
  }

  function describe(r) {
    var span = (r.first_step != null && r.last_step != null)
      ? 'steps ' + r.first_step + '-' + r.last_step : 'steps ?';
    var pos = (r.x != null && r.z != null)
      ? ' pos=(' + Number(r.x).toFixed(1) + ',' + Number(r.z).toFixed(1) + ')' : '';
    var tags = (r.tags || []).join(',') || '-';
    var note = r.note ? '  note: ' + r.note : '';
    var seen = r.perception ? '  saw: ' + r.perception : '';
    var effect = r.effect ? '  effect: ' + r.effect : '';
    return r.id + '  ' + span + '  tags=' + tags + pos + '  action=' + (r.action_kind || '-') + '  ' +
           (r.summary || '') + seen + effect + note + '  -> ' + r.path + '/';
  }

  function pyString(s) {   // json.dumps of a str: ASCII only
    return JSON.stringify(s).replace(/[\u007f-￿]/g, function (c) {
      return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
  }

  function asJson(r) {
    var raw = r._raw || JSON.stringify(r);
    if (!r.note || /"note": /.test(raw)) return raw;
    return raw.replace(/\}\s*$/, ', "note": ' + pyString(r.note) + '}');
  }

  // rows: the index as it stands; ctx.files(id) -> [texts]; ctx.notes(id) -> [notes]
  function run(argv, rows, ctx) {
    ctx = ctx || {};
    var p = parse(argv);
    if (p.error) {
      return { error: p.error, rows: [], stdout: '', stderr: USAGE + '\nepisodes.py: error: ' + p.error, code: 2 };
    }
    var o = p.options, trace = [{ step: o.previous ? 'previous/index.jsonl' : 'index.jsonl', n: 0 }];
    rows = o.previous ? (ctx.previous || []) : rows.slice();
    trace[0].n = rows.length;
    function stage(label, out) { trace.push({ step: label, n: out.length }); return out; }
    if (o.same_screen) {
      return { error: 'no screenshot hashes in this run', rows: [], stdout: '', code: 2, options: o,
               stderr: 'cannot read ' + o.same_screen + ': observation hashes are recorded on KiCad runs only' };
    }
    if (o.steps) rows = stage('--steps ' + o.steps.join(' '), steps(rows, o.steps[0], o.steps[1]));
    if (o.near) rows = stage('--near ' + o.near.join(' ') + ' --radius ' + o.radius, near(rows, o.near[0], o.near[1], o.radius));
    if (o.tag != null) rows = stage('--tag ' + o.tag, tagged(rows, o.tag));
    if (o.action != null) rows = stage('--action ' + o.action, sameAction(rows, o.action));
    if (o.grep != null) rows = stage('--grep ' + JSON.stringify(o.grep), grep(rows, o.grep, ctx.files));
    if (o.last != null) rows = stage('--last ' + o.last, recent(rows, o.last));
    rows = rows.map(function (r) {
      var note = r.note || firstNote(ctx.notes ? ctx.notes(r.id) : null);
      if (!note) return r;
      var c = {}; for (var k in r) c[k] = r[k];
      c.note = note; return c;
    });
    var lines = rows.map(o.json ? asJson : describe);
    var err = [];
    if (!rows.length) err.push('(no matching episodes)');
    if (o.sheet && rows.length) err.push('sheet: ' + o.sheet);
    return { options: o, rows: rows, trace: trace, stdout: lines.join('\n'), stderr: err.join('\n'), code: 0 };
  }

  return { tokenize: tokenize, parse: parse, run: run, describe: describe, asJson: asJson,
           firstNote: firstNote, steps: steps, near: near, tagged: tagged, sameAction: sameAction,
           grep: grep, recent: recent, USAGE: USAGE };
});
