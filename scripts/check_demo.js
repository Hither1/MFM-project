#!/usr/bin/env node
// Check the browser port of the query tool against what the run recorded.
//
//     node scripts/check_demo.js assets/demo/<run>/data.json [/path/to/MCU/output/<run>]
//
// For every `./tools/episodes.py` call the agent made, the query is re-run over the index
// as it stood at that turn (rows closed by the turn's step) and its output is looked for,
// line for line and in order, in the output the run recorded for that command. With the
// run directory given the full recorded output is read; without it, the exported output,
// which is cut at 6000 characters. A call whose output was piped through head or tail is
// checked for the lines that survived. A `--previous` call reads the index of earlier
// lives; when their episode files are not in the export the harness notes cannot be
// known, so those lines are compared with the note left out of both.
'use strict';
const fs = require('fs');
const path = require('path');
const Q = require(path.join(__dirname, '..', 'assets', 'js', 'mfm-query.js'));

const file = process.argv[2], runDir = process.argv[3];
if (!file) { console.error('usage: check_demo.js data.json [run_dir]'); process.exit(2); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const parsed = {};
for (const [id, e] of Object.entries(data.episodes)) {
  parsed[id] = { texts: [e.action, e.outcome, e.state].filter(Boolean),
                 outcome: e.outcome ? JSON.parse(e.outcome) : {} };
}
const ctx = { files: id => parsed[id].texts, notes: id => parsed[id].outcome.notes || [],
              flags: data.run.tool_flags, previous: data.previous || [] };
const noPreviousFiles = !data.run.previous_files;
const noNote = line => line.replace(/  note: .*(?=  -> )/, '');

function fullOutputs(turn) {
  if (!runDir) return null;
  const f = path.join(runDir, 'episode_001', 'codex_turns',
                      'turn_' + String(turn).padStart(4, '0') + '.events.jsonl');
  if (!fs.existsSync(f)) return null;
  const out = [];
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch (_) { continue; }
    if (e.type === 'item.completed' && e.item && e.item.type === 'command_execution') {
      out.push(e.item.aggregated_output || '');
    }
  }
  return out;
}

let exact = 0, partial = 0, unchecked = 0, errors = 0, bad = 0, total = 0;
for (const t of data.turns) {
  const rows = data.index.filter(r => r.last_step <= t.step);
  const full = fullOutputs(t.turn);
  t.commands.forEach((c, ci) => {
    const whole = full && full[ci] !== undefined;
    let recorded = whole ? full[ci] : c.output;
    // the tool prints `Q: ...` on stderr, which the record interleaves with its stdout,
    // sometimes in the middle of a line: take those out before comparing
    for (const call of c.calls) {
      const q = Q.parse(call.argv, data.run.tool_flags);
      if (q.options && q.options.q != null) {
        recorded = recorded.split((q.options.sheet ? 'sheet: ' + q.options.sheet + '  ' : '') +
                                  'Q: ' + q.options.q + '\n').join('');
      }
    }
    const cut = !whole && c.output_chars > c.output.length;
    const asRecorded = recorded.split('\n');
    for (const call of c.calls) {
      const loose = noPreviousFiles && call.argv.some((a, i) => /^--p/.test(a) || /^previous\/life_\d+/.test(a));
      const recLines = loose ? asRecorded.map(noNote) : asRecorded;
      total++;
      const label = `turn ${t.turn} step ${t.step}: ${call.argv.join(' ')} ${call.piped}`;
      const res = Q.run(call.argv, rows, ctx);
      if (res.error) {
        if (/usage: episodes\.py|error:|no frame for/.test(recorded)) errors++;
        else { bad++; console.log('MISMATCH (refused here, not in the run)', label, res.error); }
        continue;
      }
      if (loose && res.options.grep != null) { unchecked++; continue; }   // it read files that are not here
      const ours = res.stdout ? res.stdout.split('\n') : [];
      if (!ours.length) {
        if (/\(no matching episodes\)/.test(recorded) || cut || call.piped) exact++;
        else { bad++; console.log('MISMATCH (empty here)', label); }
        continue;
      }
      // the longest run of our lines found in order, contiguously, in the record
      // (the first line can also occur in the output of an earlier call: try each place)
      let lastAt = recLines.lastIndexOf(ours[ours.length - 1]);
      let matched = 0;
      for (let at = recLines.indexOf(ours[0]); at >= 0; at = recLines.indexOf(ours[0], at + 1)) {
        let m = 0;
        while (m < ours.length && recLines[at + m] === ours[m]) m++;
        matched = Math.max(matched, m);
      }
      if (matched === ours.length) { exact++; continue; }
      if (call.piped || cut) {
        // head keeps the start, tail keeps the end
        let tail = 0;
        if (lastAt >= 0) {
          while (tail < ours.length && recLines[lastAt - tail] === ours[ours.length - 1 - tail]) tail++;
        }
        if (matched > 0 || tail > 0) partial++;
        else if (cut) unchecked++;
        else { bad++; console.log('MISMATCH', label, '\n  ours[0]', ours[0].slice(0, 160)); }
        continue;
      }
      bad++;
      console.log('MISMATCH', label, `\n  ${matched}/${ours.length} lines found`,
                  '\n  ours    ', ours[matched].slice(0, 200));
    }
  });
}
console.log(`${total} calls: ${exact} reproduced line for line, ${partial} reproduced for the lines ` +
            `a pipe or cut kept, ${errors} refused by the tool in both, ${unchecked} not checkable, ` +
            `${bad} mismatched`);
if (runDir) {
  // the page quotes this summary
  fs.writeFileSync(path.join(path.dirname(file), 'check.json'),
                   JSON.stringify({ total, exact, partial, errors, unchecked, bad }) + '\n');
}
process.exit(bad ? 1 : 0);
