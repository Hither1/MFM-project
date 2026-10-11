// The method figure (#mf in index.html): one stretch of a recorded run, replayed in five scenes.
// Life 3 of the GPT-6-Astra Ender Dragon chain (assets/demo/of3m_mfm, the explorer's Ender Dragon
// run) walks back to the shallow iron vein that its first life found and its second revisited, and
// mines it at step 4,231. The frames are the run's own. The rows, cells, commands, messages and file
// lines below are copied from its export (data.json: index, previous, grid, turns 1 and 19 to 23,
// mine/), cut where "…" stands; the agent's messages are shown without their "OBSERVED vs EXPECTED:"
// and "[PLAN]" prefixes. Life 2's frames are not in the export, so its episodes appear as index rows.
(function () {
  'use strict';

  var fig = document.getElementById('mf');
  if (!fig) return;
  var FRAMES = 'assets/demo/of3m_mfm/frames/';
  var HOLD = 2600;            // ms a finished scene stays before the next, while the figure plays itself
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function $(sel) { return fig.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(fig.querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function num(n) { return Number(n).toLocaleString('en-US'); }
  function coord(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(v % 1 ? 1 : 0); }

  // ------------------------------------------------------------------ the record
  // Life 3's episodes (index.jsonl): first step, last step, x, y, z, summary without "[ACTION] ".
  var EP = {
    '000182': [3644, 3655, -3014.8, 68.3, -5560.8, 'watch(n=12) -> 12 ticks: moved 0.5, descended 1.0'],
    '000183': [3655, 3656, -3015.3, 67.2, -5561.0, 'look_abs(yaw=155,pitch=15,ticks=15) -> 15 ticks: moved 0.0'],
    '000184': [3656, 3657, -3015.3, 67, -5561.0, 'look_abs(yaw=151,pitch=0,ticks=15) -> 15 ticks: moved 0.0'],
    '000185': [3657, 3701, -3015.3, 67, -5561.0, '{"forward":1,"jump":1,"attack":1} x44: moved 5.8, descended -1.0'],
    '000186': [3701, 3712, -3018.7, 68, -5565.7, 'watch(n=12) -> 12 ticks: moved 0.7, descended 1.0'],
    '000187': [3712, 3713, -3018.7, 67, -5566.4, 'look_abs(yaw=145,pitch=0,ticks=15) -> 15 ticks: moved 0.0'],
    '000188': [3713, 3758, -3018.7, 67, -5566.4, '{"forward":1,"jump":1,"attack":1} x45: moved 5.2, descended 1.0, inv {\'spruce_sapling\': 1}'],
    '000189': [3758, 3769, -3021.7, 66, -5570.7, 'watch(n=12) -> 12 ticks: moved 0.2'],
    '000190': [3769, 3770, -3021.7, 66, -5570.9, 'look_abs(yaw=135,pitch=25,ticks=15) -> 15 ticks: moved 0.0'],
    '000191': [3770, 3771, -3021.7, 66, -5570.9, 'look_abs(yaw=145,pitch=0,ticks=15) -> 15 ticks: moved 0.0'],
    '000192': [3771, 3811, -3021.7, 66, -5570.9, '{"forward":1,"jump":1,"attack":1} x40: moved 7.1, descended -1.0'],
    '000193': [3811, 3822, -3025.5, 67, -5576.8, 'watch(n=12) -> 12 ticks: moved 0.9, descended 1.0'],
    '000194': [3822, 3829, -3026.0, 66, -5577.5, 'go_to(x=-3025.7,z=-5579.3,within=0.3,n=50) -> 50 ticks: moved 1.4, descended -1.3'],
    '000195': [3829, 3840, -3025.9, 67.3, -5578.9, 'watch(n=12) -> 12 ticks: moved 1.2, descended 1.3'],
    '000196': [3840, 3844, -3025.7, 66, -5580.2, 'look_abs(yaw=90,pitch=55,ticks=15) -> 15 ticks: moved 0.0'],
    '000221': [4094, 4097, -3028.7, 63, -5580.6, 'look_abs(yaw=0,pitch=35,ticks=10) -> 10 ticks: moved 0.0'],
    '000222': [4097, 4099, -3028.7, 63, -5580.6, 'look_abs(yaw=0,pitch=0,ticks=10) -> 10 ticks: moved 0.0'],
    '000223': [4099, 4119, -3028.7, 63, -5580.6, '{"attack":1} x35: moved 0.0'],
    '000224': [4119, 4121, -3028.7, 63, -5580.6, 'look_abs(yaw=0,pitch=60,ticks=10) -> 10 ticks: moved 0.0'],
    '000225': [4121, 4141, -3028.7, 63, -5580.6, '{"attack":1} x35: moved 0.0, inv {\'dirt\': 1}'],
    '000226': [4141, 4146, -3028.7, 63, -5580.6, '{"forward":1} x5: moved 0.8'],
    '000227': [4146, 4157, -3028.7, 63, -5579.8, 'watch(n=12) -> 12 ticks: moved 0.2, inv {\'dirt\': 1}'],
    '000228': [4157, 4160, -3028.7, 63, -5579.5, 'look_abs(yaw=90,pitch=0,ticks=10) -> 10 ticks: moved 0.0'],
    '000229': [4160, 4180, -3028.7, 63, -5579.5, '{"attack":1} x35: moved 0.0'],
    '000230': [4180, 4182, -3028.7, 63, -5579.5, 'look_abs(yaw=90,pitch=45,ticks=10) -> 10 ticks: moved 0.0'],
    '000231': [4182, 4202, -3028.7, 63, -5579.5, '{"attack":1} x35: moved 0.0, inv {\'dirt\': 1}'],
    '000232': [4202, 4203, -3028.7, 63, -5579.5, 'look_abs(yaw=90,pitch=70,ticks=10) -> 10 ticks: moved 0.0'],
    '000233': [4203, 4231, -3028.7, 63, -5579.5, '{"attack":1} x50: moved 0.0, inv {\'dirt\': 1}, milestone [\'mine_iron_ore\']'],
    '000234': [4231, 4236, -3028.7, 63, -5579.5, '{"forward":1} x5: moved 0.8']
  };
  // Life 2's rows on the way down to the vein (previous/life_2/index.jsonl): id, steps, summary.
  var PREV2 = [
    ['000233', 4657, 4660, 'look_abs(yaw=90,pitch=65,ticks=15) -> 15 ticks: moved 0.7'],
    ['000238', 4705, 4707, 'equip_hotbar(slot=7) -> 2 ticks: moved 0.0'],
    ['000250', 4839, 4859, '{"attack":1} x40: moved 0.0, inv {\'dirt\': 1}'],
    ['000255', 4896, 4899, 'look_abs(yaw=0,pitch=35,ticks=15) -> 15 ticks: moved 0.0'],
    ['000262', 4959, 4962, 'look_abs(yaw=90,pitch=0,ticks=15) -> 15 ticks: moved 0.0'],
    ['000267', 5005, 5033, '{"attack":1} x50: moved 0.0, inv {\'dirt\': 1}, milestone [\'mine_iron_ore\']']
  ];
  // The cells life 3 walked by step 4,236 (grid.jsonl: x, z, step).
  var TRAIL = [[-3010,-5573,1],[-3010,-5572,6],[-3010,-5571,11],[-3009,-5570,59],[-3009,-5569,67],[-3009,-5568,72],[-3008,-5568,75],[-3008,-5567,156],[-3009,-5567,610],[-3008,-5566,1002],[-3008,-5565,1121],[-3008,-5564,1128],[-3008,-5563,1271],[-3008,-5562,1410],[-3009,-5562,1709],[-3010,-5562,1829],[-3011,-5562,1971],[-3012,-5562,2132],[-3013,-5562,2188],[-3014,-5562,2247],[-3010,-5561,3051],[-3010,-5560,3139],[-3010,-5559,3145],[-3011,-5560,3608],[-3012,-5560,3615],[-3013,-5560,3622],[-3014,-5560,3630],[-3014,-5561,3633],[-3015,-5561,3638],[-3016,-5561,3646],[-3016,-5562,3650],[-3016,-5563,3667],[-3017,-5563,3668],[-3018,-5563,3681],[-3018,-5564,3683],[-3019,-5565,3693],[-3019,-5566,3697],[-3019,-5567,3705],[-3020,-5567,3718],[-3020,-5568,3719],[-3020,-5569,3726],[-3021,-5569,3727],[-3022,-5569,3739],[-3022,-5570,3748],[-3022,-5571,3755],[-3022,-5572,3773],[-3023,-5572,3779],[-3023,-5573,3780],[-3023,-5574,3786],[-3024,-5574,3788],[-3024,-5575,3792],[-3025,-5575,3797],[-3025,-5576,3799],[-3025,-5577,3806],[-3026,-5577,3807],[-3026,-5578,3815],[-3026,-5579,3825],[-3026,-5580,3830],[-3026,-5581,3836],[-3027,-5581,3897],[-3028,-5581,3996],[-3029,-5581,4081],[-3029,-5580,4145],[-3030,-5580,4234]];
  // Where lives 1 and 2 went on the way to the vein (their index rows: x, z).
  var ROUTE1 = [[-3009.7,-5567.7],[-3009.7,-5568.7],[-3009.1,-5568.8],[-3011.3,-5575.0],[-3016.4,-5580.7],[-3016.7,-5580.1],[-3021.9,-5579.7],[-3022.5,-5579.7],[-3024.7,-5579.7],[-3025.7,-5579.3],[-3027.2,-5579.3],[-3028.7,-5579.3]];
  var ROUTE2 = [[-3008.7,-5558.8],[-3010.7,-5558.8],[-3015.8,-5561.0],[-3016.4,-5561.2],[-3018.9,-5567.4],[-3019.0,-5567.7],[-3023.0,-5574.1],[-3023.3,-5574.5],[-3024.8,-5576.4],[-3024.9,-5576.7],[-3025.7,-5579.0],[-3025.8,-5579.7],[-3025.9,-5580.7],[-3026.6,-5580.7],[-3027.5,-5580.7],[-3028.5,-5580.7],[-3028.7,-5579.8],[-3029.5,-5579.6]];
  // The actions each turn wrote to actions.json, as the environment executed them: one index row each
  // (turn 19 wrote 7 entries, turn 20 wrote 6 and turn 22 wrote 12).
  var QUEUE = {
    19: ['000184', '000185', '000186', '000187', '000188', '000189', '000190'],
    20: ['000191', '000192', '000193', '000194', '000195', '000196'],
    22: ['000222', '000223', '000224', '000225', '000226', '000227', '000228', '000229', '000230', '000231', '000232', '000233']
  };
  // The ore block all three lives mined first: they stood at (-3028.7, 63, -5579.5) facing west, pitch 70.
  var IRON = [-3030, -5580];

  // The agent's own files, as they stood (mine/digest.md is the one life 3 wrote at step 0).
  var DIGEST_HEAD = '…\n';
  var DIGEST_IRON = '- Shallow iron: life_1 steps5296-5335, pose (-3028.70,63,-5579.31) … ep_000266. … Revisited successfully in life_2; …';
  var PROCS = 'west_level.py\nwest_stairs.py: """Cut one or two westward descending steps; hold a pickaxe in a dry tunnel, centered across its width."""';
  var W = {
    3656: '# Current plan — step3656\n…\n- Immediate: yaw151p0 forwardjumpattack44/watch12, then yaw145p0 forwardjumpattack45/watch12, finishyaw135p25. … On arrival compare --then-now previous/life_2/episodes/ep_000226 …',
    3770: '# Current plan — step3770\n…\n- Immediate: yaw145p0 forwardjumpattack40/watch12 through visiblegrassgap; go_to(-3025.7,-5579.3) within.3 n50/watch12; finishyaw90p55. … NO floor mining before inspectingarrival. …',
    3844: '# Current plan — step3844\n…\n- Immediate: HB8stonepick; … two weststeps each p0/45/70 attack35 … Expect(-3028.7,63,-5580.5), ~5-7dirtpickedup, fullhealth, southern dirtwall/stonefloor visible. … On arrival compare --then-now previous/life_2/episodes/ep_000255 …',
    4097: '# Current plan — step4097\n…\n- Immediate: … Expect mine_iron_ore milestone7/24 at(-3028.70,63,-5579.53), …\n- Step4097 exactmatch: … Comparison life2ep255 generatedandVIEWED4097: positionalmatchwithin.06z …',
    4231: '# Current plan — step4231\n- Current: (-3028.70,63,-5579.53), yaw90/p70, HP20 food20, … GUIclosed,7/24: mine_iron_ore verified4231. First ore drop NOT collected yet. …'
  };
  // What the agent said and ran (turns 1, 19, 20, 22 and 23).
  var T = {
    t19: 'Follow two checked surface legs toward shallow iron, adjusting for our eastward offset. Stop before descending and inspect the approaching leaf wall.',
    t20: 'Cross the visible clearing northwest, then approach the remembered iron descent. Stop to inspect the ground before digging; `actions.json` is ready.',
    t22a: 'The three steps reached Y63 with six dirt collected and full health. The final turn shows the southern dirt wall; I’ll compare it with the recorded iron approach.',
    tn: "./tools/episodes.py --then-now previous/life_2/episodes/ep_000255 --q 'Does this match the bottom of the three shallow steps, just north of iron?'",
    tnOut: 'wrote then_now.png: THEN previous/life_2/episodes/ep_000255 | NOW. Q: Does this match the bottom of the three shallow steps, just north of iron?. View it with view_image.',
    rg: "rg -n 'iron|Iron' mine/digest.md | head -15",
    t22b: 'The position matches; I’ll open the cell beside iron.',
    patchW: "apply_patch <<'PATCH' … *** Update File: mine/working.md",
    t22c: 'Open one level cell south, then mine west toward the recorded iron block using the stone pickaxe. Stop at the ore break and inspect before collecting it.',
    patchA: "apply_patch <<'PATCH' … *** Add File: actions.json",
    acts: '+{"procedure": "look_abs", "args": {"yaw": 0, "pitch": 0, "ticks": 10}},\n+{"action": {"attack": 1}, "repeat": 35},\n+…\n+{"procedure": "look_abs", "args": {"yaw": 90, "pitch": 70, "ticks": 10}},\n+{"action": {"attack": 1}, "repeat": 50}',
    actsOut: '12 entries; 257 nominal ticks',
    t23: 'Iron mining is verified at the predicted position, with full health and four more dirt.',
    t1a: 'This is the initial view: full health, empty inventory, and nearby trees. I\u2019ll read the workshop instructions and install safety reflexes before gathering wood.',
    t1: 'Earlier runs found diamonds, but one died near Piglins. I’m preserving those locations and adding damage, lava, fall, and hunger guards.',
    cat: 'cat previous/life_1/mine/working.md previous/life_1/mine/notes.md; cat previous/life_2/mine/digest.md previous/life_2/mine/working.md',
    test: "python - <<'PY'\nimport ast\nimport json\n…",
    testOut: 'west_stairs validated: 379 nominal ticks\nwest_level validated: 296 nominal ticks'
  };

  // ------------------------------------------------------------------ the parts
  var chips = $$('.mf-chips button');
  var playBtn = $('.mf-play');
  var logEl = $('.mf-log');
  var textEl = $('.mf-text');
  var screen = $('.mf-screen');
  var imgs = $$('.mf-f');
  var tn = $('.mf-tn');
  var S = { i: 0, auto: !reduce, live: false, token: 0, timers: [], rows: [], front: 0, want: null, queue: null };

  function after(ms, fn) {
    var t = S.token;
    S.timers.push(setTimeout(function () { if (t === S.token) fn(false); }, ms));
  }
  function halt() {
    S.timers.forEach(clearTimeout);
    S.timers = [];
    S.token++;
  }

  // text that types itself out; `done` runs once it is all there. A scene that is left stops its
  // typing where it is: the next scene sets every part it shows.
  function type(node, text, instant, cps, done) {
    if (instant) { node.textContent = text; if (done) done(); return; }
    var t = S.token, shown = 0, last = null;
    node.textContent = '';
    node.classList.add('typing');
    function tick(now) {
      if (t !== S.token) { node.classList.remove('typing'); return; }
      if (last != null) shown = Math.min(text.length, shown + (now - last) * cps / 1000);
      last = now;
      node.textContent = text.slice(0, Math.floor(shown));
      if (shown < text.length) requestAnimationFrame(tick);
      else { node.classList.remove('typing'); if (done) done(); }
    }
    requestAnimationFrame(tick);
  }
  // a line in the agent's panel: m a message, c a command, o its output, p a line it wrote, who a turn
  function say(cls, text, instant, cps) {
    var p = document.createElement('p');
    p.className = cls;
    logEl.appendChild(p);
    while (logEl.childNodes.length > 14) logEl.removeChild(logEl.firstChild);
    if (cps) type(p, text, instant, cps); else p.textContent = text;
    return p;
  }

  // the head of a turn, with the newest frame: the frame the turn's first action is decided from
  // (each episode's image in store.py), which the agent is shown as the turn begins
  function turnHead(text, id) {
    var p = say('who', '');
    var im = new Image();
    im.src = FRAMES + 'ep_' + id + '.jpg';
    im.alt = '';
    im.title = 'The newest frame, which the agent sees as its turn begins';
    p.appendChild(im);
    p.appendChild(document.createTextNode(text + ' \u00b7 newest frame'));
    return p;
  }
  function clock(html) { $('.mf-clock').innerHTML = html; }
  function stepClock(step) { clock('Life 3 &middot; step <b>' + num(step) + '</b>'); }
  function peek(kind, html) { fig.querySelector('[data-peek="' + kind + '"]').innerHTML = html; }
  // a note with some of its text marked; marks are [text, class] pairs
  function noteHTML(text, marks) {
    var html = esc(text);
    (marks || []).forEach(function (m) {
      html = html.replace(esc(m[0]), '<' + (m[1] === 'ok' ? 'b class="ok"' : 'mark') + '>' + esc(m[0]) + '</' + (m[1] === 'ok' ? 'b' : 'mark') + '>');
    });
    return html.replace(/\n/g, '<br>');
  }
  function digest(mark) {
    var marks = mark === 'line' ? [[DIGEST_IRON, 'mark']] : mark === 'cite' ? [['ep_000266', 'mark'], ['Revisited successfully in life_2', 'mark']] : [];
    return noteHTML(DIGEST_HEAD + DIGEST_IRON, marks);
  }
  function working(step, marks) { return noteHTML(W[step], marks); }
  // a row of an index: id, steps, summary
  function rowHTML(r, cls) {
    return '<div class="' + (cls || '') + '" title="' + esc('ep_' + r[0] + '  steps ' + r[1] + '-' + r[2] + '  ' + r[3]) + '">' +
      '<span>ep_' + r[0] + '</span><span>' + r[1] + '&ndash;' + r[2] + '</span><span>' + esc(r[3]) + '</span></div>';
  }
  // life 3's index as it stood at `step`: the newest rows, the ones new since the last call marked
  function ownRows(step, animate, hit) {
    var all = Object.keys(EP).sort().filter(function (id) { return EP[id][1] <= step; });
    var shown = all.slice(-6);
    var html = '<p class="mf-sub">index.jsonl</p>' + shown.map(function (id) {
      var r = [id, EP[id][0], EP[id][1], EP[id][5]];
      var cls = id === hit ? 'hit' : (animate && S.rows.indexOf(id) < 0 ? 'new' : '');
      return rowHTML(r, cls);
    }).join('');
    S.rows = all;
    peek('episodic', html);
  }
  function lifeTwoRows(hit) {
    peek('episodic', '<p class="mf-sub">previous/life_2/index.jsonl</p>' +
      PREV2.map(function (r) { return rowHTML(r, r[0] === hit ? 'hit' : ''); }).join(''));
  }

  // the actions of a turn under the frame: done, the one the environment is executing, still to come.
  // `cur` is the episode being executed, null when the list is just written, 'all' when it has run.
  function queue(turn, cur) {
    var ids = QUEUE[turn], k = ids.indexOf(cur), n = ids.length;
    var state = cur === 'all' ? 'all ' + n + ' executed' : k < 0 ? n + ' written' : 'executing ' + (k + 1) + ' of ' + n;
    $('.mf-run').innerHTML = '<p class="mf-q-h"><span>actions.json, turn ' + turn + '</span><span>' + state + '</span></p>' +
      '<ol class="mf-q">' + ids.map(function (id, j) {
        var cls = cur === 'all' || (k >= 0 && j < k) ? 'done' : j === k ? 'now' : '';
        return '<li class="' + cls + '" title="ep_' + id + ', steps ' + EP[id][0] + '-' + EP[id][1] + '">' +
          esc(EP[id][5].split(' -> ')[0].split(': ')[0]) + '</li>';
      }).join('') + '</ol>';
    var list = $('.mf-q'), now = list.querySelector('.now');
    if (now && list.scrollHeight > list.clientHeight) list.scrollTop = now.offsetTop - list.clientHeight / 2;
    S.queue = turn;
  }
  function turnOf(id) {
    for (var t in QUEUE) if (QUEUE[t].indexOf(id) >= 0) return t;
    return null;
  }

  // the environment: two images, so that a new frame can fade in over the old one
  function frame(id, instant) {
    var e = EP[id], src = FRAMES + 'ep_' + id + '.jpg';
    S.want = id;
    stepClock(e[0]);
    $('.mf-pos').innerHTML = '<span>state</span>x ' + coord(e[2]) + ' &nbsp;y ' + coord(e[3]) + ' &nbsp;z ' + coord(e[4]);
    // the frame an action is decided from: that action is the one being executed; past the list's end
    // (the first frame of the next turn), the list has all run
    if (turnOf(id)) queue(turnOf(id), id);
    else if (S.queue) queue(S.queue, 'all');
    map.walk(e[0], e[2], e[4]);
    var cur = imgs[S.front], next = imgs[1 - S.front];
    var swap = function () {
      if (S.want !== id) return;
      next.style.opacity = 1; cur.style.opacity = 0;
      next.alt = 'The agent’s view at step ' + num(e[0]) + '.'; cur.alt = '';
      S.front = 1 - S.front;
    };
    if (instant) { cur.src = src; cur.style.opacity = 1; next.style.opacity = 0; cur.alt = 'The agent’s view at step ' + num(e[0]) + '.'; return; }
    if (next.getAttribute('src') === src && next.complete) swap();
    else { next.onload = swap; next.src = src; }
  }
  // between two lists of actions the environment stands still while the agent takes its turn
  function idle() {
    $('.mf-run').innerHTML = '<p class="mf-q-h"><span>waiting for actions</span></p>' +
      '<p class="mf-q-wait">The environment pauses while the agent takes its turn.</p>';
    S.queue = null;
  }
  function overlay(kind) {
    tn.hidden = kind !== 'thennow';
    Array.prototype.forEach.call(screen.querySelectorAll('.mf-toast, .mf-lives'), function (n) { n.remove(); });
    if (kind === 'thennow') {
      var r = PREV2[3];
      $('.mf-tn-row').innerHTML = 'ep_' + r[0] + '<br>steps ' + num(r[1]) + '&ndash;' + num(r[2]) + '<br>(&minus;3028.7, 63, &minus;5580.7)';
      tn.querySelector('.now img').src = FRAMES + 'ep_000222.jpg';
    }
    if (kind === 'toast') {
      screen.insertAdjacentHTML('beforeend', '<div class="mf-toast"><i class="ico" style="--i:5" aria-hidden="true"></i>Iron ore &middot; step 4,231</div>');
    }
    if (kind === 'lives') {
      screen.insertAdjacentHTML('beforeend',
        '<div class="mf-lives"><p>First iron ore, all three at this block</p>' +
        [['Life 1', 5325, '--life-1'], ['Life 2', 5033, '--life-2'], ['Life 3', 4231, '--life-3']].map(function (l) {
          return '<div class="bar" style="--w:' + (l[1] / 5600 * 100).toFixed(1) + '%;--c:var(' + l[2] + ')"><span>' + l[0] +
            '</span><span><i></i></span><em>step ' + num(l[1]) + '</em></div>';
        }).join('') +
        '<p>episodes carried in: 0, 1,170 and 3,957</p></div>');
    }
  }

  // the map: the cells walked so far, the routes of the earlier lives, the vein and the agent
  var map = (function () {
    var NS = 'http://www.w3.org/2000/svg', svg = $('.mf-map');
    function el(name, attrs, parent) {
      var e = document.createElementNS(NS, name);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      (parent || svg).appendChild(e);
      return e;
    }
    var pts = function (list) { return list.map(function (p) { return p[0] + ',' + p[1]; }).join(' '); };
    var r1 = el('polyline', { class: 'r1', points: pts(ROUTE1) });
    var r2 = el('polyline', { class: 'r2', points: pts(ROUTE2) });
    var cells = TRAIL.map(function (c) {
      var r = el('rect', { class: 'cell', x: c[0] + 0.08, y: c[1] + 0.08, width: 0.84, height: 0.84 });
      r.step = c[2];
      return r;
    });
    var cx = IRON[0] + 0.5, cz = IRON[1] + 0.5;
    var iron = el('polygon', { class: 'iron', points: [cx, cz - 0.9, cx + 0.9, cz, cx, cz + 0.9, cx - 0.9, cz].join(' ') });
    var ironText = el('text', { x: cx - 0.4, y: cz + 2.6, 'text-anchor': 'middle' });
    ironText.textContent = 'iron';
    var spawn = el('text', { x: -3009.5, y: -5574.4, 'text-anchor': 'middle' });
    spawn.textContent = 'spawn';
    var me = el('circle', { class: 'me', r: 0.75, cx: -3025.7, cy: -5580.2 });
    return {
      walk: function (step, x, z) {
        cells.forEach(function (c) { c.style.display = c.step <= step ? '' : 'none'; });
        me.style.display = '';
        me.setAttribute('cx', x); me.setAttribute('cy', z);
      },
      routes: function (lives) {
        r1.style.display = lives.indexOf(1) >= 0 ? '' : 'none';
        r2.style.display = lives.indexOf(2) >= 0 ? '' : 'none';
      },
      iron: function (state) {
        iron.style.display = ironText.style.display = state ? '' : 'none';
        iron.classList.toggle('got', state === 'got');
      },
      hideMe: function () { me.style.display = 'none'; }
    };
  })();

  // ------------------------------------------------------------------ the scenes
  // parts: what the scene lights. start: how the figure stands when it begins. beats: [ms, fn],
  // each fn called with `instant` (true when the scene is shown at once). length: ms to the last beat.
  function frames(list, t0, dt, extra) {
    return list.map(function (id, k) {
      return [t0 + k * dt, function (instant) { frame(id, instant); if (extra) extra(id, instant); }];
    });
  }
  var SCENES = [
    {
      key: 'record',
      parts: ['game', 'l-record', 'episodic', 'spatial'],
      caption: '<b>1 Record.</b> The environment executes the agent\u2019s actions one at a time. For each one ' +
        'the harness files an episode: the frame the action was decided from, the agent\u2019s position, health ' +
        'and inventory, the action and its outcome. Each episode gets a row of cues in <code>index.jsonl</code>, ' +
        'and the cells the agent crosses go into <code>grid.jsonl</code>. These records are never edited.',
      start: function () {
        frame('000184', true);
        ownRows(3656, false);
        map.routes([]); map.iron(null);
        peek('semantic', digest()); peek('procedural', noteHTML(PROCS)); peek('working', working(3656));
        turnHead('turn 19 \u00b7 step 3,656', '000184'); say('m', T.t19);
      },
      beats: frames(['000185', '000186', '000188', '000189'], 600, 680, function (id, instant) { ownRows(EP[id][0], !instant); })
        .concat([[3360, function (instant) {
          frame('000191', instant); ownRows(3770, !instant);
          turnHead('turn 20 \u00b7 step 3,770', '000191'); say('m', T.t20, instant, 75);
          peek('working', working(3770));
        }]])
        .concat(frames(['000192', '000193', '000194', '000195', '000196'], 4500, 680, function (id, instant) { ownRows(EP[id][0], !instant); })),
      length: 7300
    },
    {
      key: 'retrieve',
      parts: ['agent', 'l-query', 'episodic', 'semantic', 'previous', 'game'],
      caption: '<b>2 Retrieve.</b> Each turn begins with the newest frame. At step 4,097 the agent has dug three ' +
        'stairs down toward the vein. Before digging further, it searches its memory: it puts life 2\u2019s frame of ' +
        'this spot beside the live view (<code>--then-now</code>) and looks up its note on the vein. Life 2\u2019s ' +
        'frames are not part of this page\u2019s data, so that episode appears as its index row.',
      start: function () {
        frame('000222', true);
        map.routes([2]); map.iron('ring');
        idle();
        lifeTwoRows(null);
        peek('semantic', digest()); peek('procedural', noteHTML(PROCS)); peek('working', working(3844));
        $('.mf-prev [data-life="2"]').classList.add('hit');
        turnHead('turn 20 \u00b7 step 3,770', '000191'); say('m', T.t20);
      },
      beats: [
        [0, function (instant) { turnHead('turn 22 \u00b7 step 4,097', '000222'); say('m', T.t22a, instant, 80); }],
        [2300, function (instant) { say('c', T.tn, instant, 120); }],
        [3700, function () { say('o', T.tnOut); lifeTwoRows('000255'); overlay('thennow'); }],
        [4900, function (instant) { say('c', T.rg, instant, 120); }],
        [5500, function () { peek('semantic', digest('line')); }],
        [6200, function (instant) { say('m', T.t22b, instant, 80); }]
      ],
      length: 6900
    },
    {
      key: 'consolidate',
      parts: ['agent', 'l-write', 'semantic', 'procedural', 'working'],
      caption: '<b>3 Consolidate.</b> What the agent learns goes into files it writes itself: facts in ' +
        '<code>digest.md</code>, procedures it can call as actions, and the plan in <code>working.md</code>. ' +
        'Each entry cites its evidence; the note on the vein cites the life-1 episode where the vein was found. ' +
        'Here the agent rewrites its plan, naming the life-2 episode it just compared and where it expects the iron.',
      start: function () {
        frame('000222', true);
        map.routes([2]); map.iron('ring');
        idle();
        lifeTwoRows('000255');
        peek('semantic', digest()); peek('procedural', noteHTML(PROCS)); peek('working', working(3844));
        turnHead('turn 22 \u00b7 step 4,097', '000222'); say('m', T.t22a); say('c', T.tn); say('o', T.tnOut);
        say('c', T.rg); say('m', T.t22b);
      },
      beats: [
        [0, function (instant) { say('c', T.patchW, instant, 120); }],
        [900, function (instant) {
          var box = fig.querySelector('[data-peek="working"]');
          type(box, W[4097], instant, 150, function () {
            box.innerHTML = working(4097, [['Expect mine_iron_ore milestone7/24 at(-3028.70,63,-5579.53)', 'mark'], ['life2ep255', 'mark']]);
          });
          say('p', '+# Current plan — step4097');
        }],
        [1900, function (instant) { say('p', '+- Immediate: … reachesiron. … Expect mine_iron_ore milestone7/24 at(-3028.70,63,-5579.53) …', instant, 140); }],
        [3300, function (instant) { say('p', '+- Step4097 exactmatch: … Comparison life2ep255 generatedandVIEWED4097: positionalmatchwithin.06z …', instant, 140); }],
        [4700, function () { peek('semantic', digest('cite')); }],
        [5400, function (instant) { say('m', T.t22c, instant, 85); }]
      ],
      length: 7200
    },
    {
      key: 'act',
      parts: ['agent', 'l-read', 'l-act', 'game', 'working'],
      caption: '<b>4 Act.</b> The turn ends with a short list of actions. The environment executes them and the ' +
        'harness records each one, which is stage 1 again. The plan from step 4,097 expected the iron at ' +
        '(&minus;3028.7, 63, &minus;5579.5); at step 4,231 the agent mined it there.',
      start: function () {
        frame('000222', true);
        map.routes([2]); map.iron('ring');
        idle();
        ownRows(4097, false);
        peek('semantic', digest()); peek('procedural', noteHTML(PROCS));
        peek('working', working(4097, [['Expect mine_iron_ore milestone7/24 at(-3028.70,63,-5579.53)', 'mark']]));
        turnHead('turn 22 \u00b7 step 4,097', '000222'); say('m', T.t22b); say('c', T.patchW); say('m', T.t22c);
      },
      beats: [
        [0, function (instant) { say('c', T.patchA, instant, 120); }],
        [700, function (instant) { say('p', T.acts, instant, 260); queue(22, null); }],
        [1900, function () { say('o', T.actsOut); }]
      ].concat(frames(['000223', '000225', '000227', '000229', '000231', '000233'], 2400, 560, function (id, instant) { ownRows(EP[id][0], !instant); }))
        .concat([[5900, function (instant) {
          frame('000234', instant); ownRows(4231, !instant, '000233');
          overlay('toast'); map.iron('got');
        }], [6600, function (instant) {
          turnHead('turn 23 \u00b7 step 4,231', '000234'); say('m', T.t23, instant, 80);
          peek('working', working(4231, [['7/24: mine_iron_ore verified4231', 'ok']]));
        }]]),
      length: 7700
    },
    {
      key: 'carry',
      parts: ['game', 'previous', 'episodic', 'semantic', 'procedural', 'working', 'agent'],
      caption: '<b>5 Carry over.</b> When a life ends, its records and the agent’s files pass on to the next life ' +
        'under <code>previous/</code>, in the same world and with the same model. Life 3 began by reading ' +
        'them and testing the two procedures it kept from life 2. All three lives mined their first iron at ' +
        'this block, each sooner than the one before.',
      start: function () {
        var cur = imgs[S.front];
        cur.src = FRAMES + 'ep_000000.jpg'; cur.style.opacity = 1; imgs[1 - S.front].style.opacity = 0;
        S.want = null;
        clock('Lives 1 to 3');
        $('.mf-pos').innerHTML = '<span>world</span>the same world and spawn in every life';
        $('.mf-run').textContent = ''; S.queue = null;
        map.walk(5000, 0, 0); map.hideMe(); map.routes([1, 2]); map.iron('got');
        peek('episodic', '<p class="mf-sub">previous/</p><div><span>life_1/index.jsonl</span><span>1,170 rows</span></div>' +
          '<div><span>life_2/index.jsonl</span><span>2,787 rows</span></div><p class="mf-sub">and this life’s own index.jsonl</p>');
        peek('semantic', digest()); peek('procedural', noteHTML(PROCS));
        peek('working', working(4231));
        $$('.mf-prev [data-life]').forEach(function (n) { n.classList.add('hit'); });
        overlay('lives');
        turnHead('life 3, turn 1 \u00b7 step 0', '000000'); say('m', T.t1a);
      },
      beats: [
        [0, function (instant) { say('m', T.t1, instant, 80); }],
        [300, function () { bars(0); }], [900, function () { bars(1); }], [1500, function () { bars(2); }],
        [2600, function (instant) { say('c', T.cat, instant, 130); }],
        [4000, function (instant) { say('c', T.test, instant, 130); }],
        [4900, function () { say('o', T.testOut); }]
      ],
      length: 5600
    }
  ];
  function bars(k) {
    var b = screen.querySelectorAll('.mf-lives .bar')[k];
    if (b) b.classList.add('in');
  }

  // ------------------------------------------------------------------ playing
  function begin(sc) {
    fig.classList.add('focus');
    $$('[data-part]').forEach(function (n) { n.classList.toggle('on', sc.parts.indexOf(n.dataset.part) >= 0); });
    $$('.mf-prev .hit').forEach(function (n) { n.classList.remove('hit'); });
    textEl.innerHTML = sc.caption;
    logEl.textContent = '';
    S.rows = [];
    overlay(null);
    sc.start();
  }
  // how: 'auto' plays the scene and goes on to the next; 'once' plays it and stays; 'still' shows its end
  function run(i, how) {
    halt();
    S.i = i;
    var sc = SCENES[i], still = how === 'still' || reduce;
    chips.forEach(function (b, k) {
      b.setAttribute('aria-pressed', String(k === i));
      var bar = b.querySelector('i');
      bar.style.transition = 'none';
      bar.style.width = k === i && how !== 'auto' ? '100%' : '0';
    });
    begin(sc);
    if (still) sc.beats.forEach(function (b) { b[1](true); });
    else sc.beats.forEach(function (b) { after(b[0], b[1]); });
    if (how === 'auto') {
      var bar = chips[i].querySelector('i');
      void bar.offsetWidth;
      bar.style.transition = 'width ' + (sc.length + HOLD) + 'ms linear';
      bar.style.width = '100%';
      after(sc.length + HOLD, function () { run((i + 1) % SCENES.length, 'auto'); });
    }
  }
  function syncPlay() {
    playBtn.textContent = S.auto ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', String(!S.auto));
    playBtn.setAttribute('aria-label', (S.auto ? 'Pause' : 'Play') + ' the figure');
  }

  $('.mf-chips').hidden = false;
  playBtn.hidden = false;
  syncPlay();
  chips.forEach(function (b, k) {
    b.addEventListener('click', function () {
      S.auto = false;
      syncPlay();
      textEl.setAttribute('aria-live', 'polite');
      run(k, 'once');
    });
  });
  playBtn.addEventListener('click', function () {
    S.auto = !S.auto;
    syncPlay();
    if (S.auto) run(S.i, 'auto');
    else run(S.i, 'still');
  });

  // The first scene stands still until the figure is on screen; then it plays while it is in view.
  run(0, 'still');
  var preload = function () {
    Object.keys(EP).concat(['000000']).forEach(function (id) { new Image().src = FRAMES + 'ep_' + id + '.jpg'; });
    preload = function () {};
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) preload();
    }, { rootMargin: '600px 0px' }).observe(fig);
    // in view: a third of the figure, or half the window when the figure is taller than that
    new IntersectionObserver(function (entries) {
      var e = entries[0], h = e.rootBounds ? e.rootBounds.height : window.innerHeight;
      var live = e.isIntersecting && (e.intersectionRatio >= 0.35 || e.intersectionRect.height >= 0.5 * h);
      if (live === S.live) return;
      S.live = live;
      if (!S.auto) return;
      if (live) run(S.i, 'auto');
      else halt();
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.35, 0.5, 0.7, 1] }).observe(fig);
    document.addEventListener('visibilitychange', function () {
      if (!S.auto || !S.live) return;
      if (document.hidden) halt();
      else run(S.i, 'auto');
    });
  }
})();
