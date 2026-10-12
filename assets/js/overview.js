// The method figure (#mf in index.html): one stretch of a recorded run, replayed in five scenes.
// Life 2 of a GPT-6-Astra Ender Dragon chain (assets/demo/gpt6_dragon_l2_36k, the explorer's Ender
// Dragon run) digs down to the iron vein its first life found, and mines it at step 8,992 (life 1:
// 18,231). The frames are the run's own; the frame of life 1 is that life's ep_000673. The rows,
// cells, commands, messages and file lines below are copied from the export (data.json: index,
// previous, grid, turns 1 and 99 to 103, mine/GUIDE.md), cut where "…" stands; the agent's messages
// are shown without the labels "OBSERVED vs EXPECTED:" and "[PLAN]". In turn 102 one command wrote
// both actions.json and mine/working.md: stage 3 shows the second and stage 4 the first, and the
// turn's closing message comes after both, as it did.
(function () {
  'use strict';

  var fig = document.getElementById('mf');
  if (!fig) return;
  var RUN = 'assets/demo/gpt6_dragon_l2_36k/';
  var FRAMES = RUN + 'frames/';
  var THEN = RUN + 'previous/life_1/ep_000673.jpg';   // life 1's frame of the vein (step 18,201)
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
  // Life 2's episodes (index.jsonl): first step, last step, x, y, z, summary without "[ACTION] ".
  var EP = {
    '000449': [8823, 8825, -2953.4, 18, -5605.4, 'equip_hotbar(slot=4) -> 2 ticks: moved 0.0'],
    '000450': [8825, 8827, -2953.4, 18, -5605.4, 'look_abs(pitch=20,yaw=-180,ticks=10) -> 10 ticks: moved 0.0'],
    '000451': [8827, 8833, -2953.4, 18, -5605.4, 'look_abs(pitch=35,yaw=0,ticks=10) -> 10 ticks: moved 0.0'],
    '000452': [8833, 8835, -2953.4, 18, -5605.4, 'equip_hotbar(slot=9) -> 2 ticks: moved 0.0'],
    '000453': [8835, 8852, -2953.4, 18, -5605.4, '{"attack":1} x45: moved 0.0'],
    '000454': [8852, 8853, -2953.4, 18, -5605.4, 'look_abs(pitch=65,yaw=0,ticks=10) -> 10 ticks: moved 0.0'],
    '000455': [8853, 8870, -2953.4, 18, -5605.4, '{"attack":1} x45: moved 0.0, inv {\'cobblestone\': 1}'],
    '000456': [8870, 8871, -2953.4, 18, -5605.4, 'look_abs(pitch=60,yaw=0,ticks=10) -> 10 ticks: moved 0.0'],
    '000457': [8871, 8890, -2953.4, 18, -5605.4, 'descend_one() -> 19 ticks: moved 1.1, descended 1.0, inv {\'cobblestone\': 1}'],
    '000458': [8890, 8963, -2953.4, 17, -5604.3, 'cut_step(yaw=0) -> 191 ticks: moved 1.0, descended 1.0, inv {\'cobblestone\': 3}'],
    '000459': [8963, 8964, -2953.4, 16, -5603.3, 'look_abs(pitch=35,yaw=0,ticks=10) -> 10 ticks: moved 0.0'],
    '000460': [8964, 8992, -2953.4, 16, -5603.3, '{"attack":1} x45: moved 0.0, milestone [\'mine_iron_ore\']'],
    '000461': [8992, 9002, -2953.4, 16, -5603.3, 'watch(until=inventory,n=24) -> 24 ticks: moved 0.0, inv {\'iron_ore\': 1}']
  };
  // Life 1's rows where it reached the vein (previous/index.jsonl): id, steps, summary.
  var PREV1 = [
    ['000670', 17972, 18075, 'level_step(yaw=90,steps=2) -> 258 ticks: moved 2.0, inv {\'cobblestone\': 2, \'granite\': 2}'],
    ['000671', 18075, 18077, 'look_abs(pitch=0,yaw=135,ticks=15) -> 15 ticks: moved 0.0'],
    ['000672', 18077, 18201, 'level_step(yaw=90,steps=3) -> 387 ticks: moved 2.0, inv {\'cobblestone\': 2, \'granite\': 2}'],
    ['000673', 18201, 18231, 'aim_speckles(x=330,y=81,pick=7) -> 111 ticks: moved 0.0, inv {\'cobblestone\': 1}, milestone [\'mine_iron_ore\']'],
    ['000674', 18231, 18232, 'look_abs(pitch=30,yaw=90,ticks=15) -> 15 ticks: moved 0.0'],
    ['000675', 18232, 18249, '{"attack":1} x35: moved 0.0, inv {\'iron_ore\': 1}']
  ];
  // The cells life 2 walked by step 9,010 (grid.jsonl, kind "walked": x, z, the step it first stood there).
  var TRAIL = [[-3010,-5573,1],[-3010,-5572,111],[-3010,-5571,228],[-3009,-5571,248],[-3008,-5571,560],[-3007,-5571,566],[-3007,-5570,567],[-3007,-5569,573],[-3007,-5568,579],[-3007,-5567,727],[-3007,-5566,732],[-3008,-5566,1169],[-3009,-5566,1481],[-3007,-5565,1832],[-3006,-5565,1840],[-3010,-5566,2227],[-3011,-5566,2275],[-3012,-5566,2323],[-3013,-5566,2465],[-3014,-5566,2513],[-3015,-5566,2715],[-3016,-5566,2763],[-3008,-5567,3156],[-3006,-5567,3204],[-3006,-5568,3205],[-3006,-5569,3285],[-3005,-5569,3338],[-3004,-5569,3375],[-3004,-5570,3541],[-3004,-5571,3548],[-3003,-5570,3556],[-3002,-5570,3562],[-3002,-5569,3563],[-3001,-5569,3577],[-3000,-5569,3583],[-2999,-5569,3588],[-2998,-5569,3607],[-2998,-5570,3611],[-2997,-5570,3615],[-2997,-5571,3622],[-2996,-5572,3630],[-2995,-5572,3711],[-2994,-5572,3718],[-2993,-5572,3780],[-2992,-5572,3825],[-2991,-5572,3832],[-2990,-5572,3849],[-2989,-5572,3877],[-2988,-5572,3882],[-2988,-5573,3885],[-2987,-5573,3889],[-2986,-5573,3901],[-2986,-5574,3904],[-2985,-5574,3910],[-2985,-5575,3912],[-2984,-5575,3917],[-2984,-5576,3920],[-2983,-5576,3925],[-2983,-5577,3933],[-2983,-5578,3957],[-2982,-5578,3961],[-2982,-5579,3977],[-2981,-5579,3981],[-2981,-5580,3983],[-2980,-5581,3990],[-2980,-5582,3997],[-2979,-5582,3999],[-2979,-5583,4002],[-2978,-5583,4007],[-2978,-5584,4008],[-2978,-5585,4013],[-2977,-5585,4015],[-2977,-5586,4021],[-2976,-5586,4025],[-2976,-5587,4027],[-2976,-5588,4032],[-2975,-5588,4033],[-2975,-5589,4038],[-2974,-5589,4041],[-2974,-5590,4044],[-2973,-5591,4049],[-2972,-5591,4057],[-2971,-5591,4062],[-2970,-5591,4067],[-2969,-5591,4071],[-2968,-5591,4076],[-2967,-5591,4081],[-2966,-5591,4087],[-2966,-5592,4089],[-2965,-5592,4093],[-2965,-5593,4097],[-2964,-5593,4099],[-2964,-5594,4105],[-2963,-5594,4107],[-2962,-5595,4114],[-2961,-5595,4121],[-2961,-5596,4122],[-2960,-5596,4128],[-2960,-5597,4130],[-2959,-5597,4135],[-2959,-5598,4137],[-2958,-5598,4143],[-2958,-5599,4145],[-2958,-5600,4780],[-2958,-5601,4787],[-2958,-5602,4950],[-2957,-5602,5055],[-2956,-5602,5136],[-2955,-5602,5235],[-2954,-5602,5308],[-2953,-5602,5381],[-2953,-5603,5466],[-2953,-5604,5539],[-2953,-5605,5612],[-2954,-5605,5714],[-2955,-5605,5790],[-2956,-5605,5872],[-2956,-5604,5965],[-2956,-5603,6044],[-2953,-5606,6636],[-2952,-5606,6699],[-2951,-5606,6784],[-2951,-5605,6817],[-2951,-5604,6929],[-2951,-5603,7073],[-2951,-5602,7146],[-2952,-5602,7232],[-2954,-5603,7479],[-2954,-5604,7563],[-2952,-5605,7794],[-2954,-5606,8815]];
  // Where life 1 went on its way to the vein: a level tunnel from the east at y 15 (its index rows
  // from step 17,000 on: x, z; the map begins at x -2930).
  var ROUTE1 = [[-2930.7,-5603.4],[-2931.7,-5603.4],[-2932.7,-5603.4],[-2933.7,-5603.4],[-2934.7,-5603.4],[-2936.7,-5603.4],[-2939.7,-5603.4],[-2942.7,-5603.4],[-2945.7,-5603.4],[-2948.7,-5603.4],[-2950.7,-5603.4],[-2952.7,-5603.4]];
  // The actions each turn wrote to actions.json, as the environment executed them: one index row each.
  // Turn 102 wrote three; the milestone ended its list after the second, so the third never ran.
  var QUEUE = {
    99: ['000452', '000453', '000454', '000455', '000456'],
    100: ['000457'],
    101: ['000458'],
    102: ['000459', '000460', { skip: 'watch(until=inventory,n=20)' }]
  };
  // Where the vein is: life 1 mined its first ore standing at (-2952.7, 15, -5603.4); life 2 stood
  // one block higher and west of that, at (-2953.4, 16, -5603.3), facing south.
  var IRON = [-2953, -5603];

  // The agent's own files, as they stood (life 2 wrote mine/GUIDE.md at step 0 and had not changed it).
  var GUIDE_HEAD = '# World guide — workshop, life 2\n…\n';
  var GUIDE_IRON = '- Iron: player (-2952.7, 15, -5603.4), step18201–18231, previous/life_1/episodes/ep_000673/observation/image.png. Several ore blocks in this vein.';
  var GUIDE_CITE = 'previous/life_1/episodes/ep_000673/observation/image.png';
  var PROCS = 'descend_one.py: """descend_one: enter an inspected one-block-lower solid landing about one block ahead, then inspect at pitch35; …"""\n' +
    'cut_step.py: """cut_step: cut one descending step and advance; … Proven at steps5068-5249."""';
  var W = {
    8833: 'Step8833 pos(-2953.4,18,-5605.4) pitch35yaw0 HP17food17 heldsword4. … Plan equip9 pick101 minecrosshair35 singleblock45 thenlook65south mineone45 look60south10, STATIONARY. … Targetiron(-2952.7,15,-5603.4) priorlife1ep673 viewed3568 then-nowarrivalpending3below2south. …',
    8871: 'Step8871 pos(-2953.4,18,-5605.4) pitch60yaw0 HP17food17 pick99slot9. … Plan descend_one forward5 settle8 look35 sneak5 into inspected one-lower landing south; … Targetiron(-2952.7,15,-5603.4) priorlife1ep673 viewed3568 then-nowarrivalpending; threebelowcurrent. …',
    8890: 'Step8890 pos(-2953.4,17,-5604.3) pitch35yaw0 HP17food17 pick99slot9 cobble87. … Plan cut_step0 south1 ->(-2953.4,16,-5603.3) pick96 cobble90 approximately; inspectforiron before nextturn east/down. Targetiron(-2952.7,15,-5603.4) priorlife1ep673 viewed3568 then-nowarrivalpending2below .7east .9south. …',
    8963: 'Step8963 pos(-2953.4,16,-5603.3) pitch60yaw0 HP17food17 pick96slot9 cobble90. Southcut matched3stone and1down; IRON VISIBLE upperface directlysouth above granitefloor! Ran then-now previous/life_1/episodes/ep_000673/observation/image.png viewed /tmp/iron_then_now.png: consistentironovergranite from oneblockhigher/west; arrivedvein vicinity. Plan look35south10 attack45pure oneblock thenwatchinventory20 stationary, expect mine_iron_ore milestone ironore1 pick95 samepos. …',
    8992: 'Step8992 MILESTONE mine_iron_ore VERIFIED7/24! pos(-2953.4,16,-5603.3) pitch35yaw0 HP17food17 pickdisplay96slot9 staleatbreak. Firstironbroken statsverified … planinterruptedatmilestone beforewatch. … priorlife1ep673 then-nowDONE8963: ironovergranite matchedvicinity from1higherwest. …'
  };
  var W_THEN = 'Ran then-now previous/life_1/episodes/ep_000673/observation/image.png';
  var W_EXPECT = 'expect mine_iron_ore milestone';
  // What the agent said and ran (turns 99 to 103, and turn 1).
  var T = {
    t99: 'Equip the fresh pickaxe and mine two blocks ahead while stationary. Inspect the exposed landing before moving.',
    t100: 'Enter the inspected landing and collect the drop. Raise the view to inspect the next wall.',
    t101: 'Descended one block and collected the drop as expected; the view now shows a close solid wall. Cut one descending step south toward the remembered iron. Inspect the newly exposed blocks before turning east.',
    t102a: 'The step matched exactly, and the newly exposed upper face has iron-colored speckles. I’ll aim at that face and mine it to verify the iron milestone.',
    tn: "python tools/episodes.py --then-now previous/life_1/episodes/ep_000673/observation/image.png --out /tmp/iron_then_now.png --q 'Does the exposed iron over granite match the remembered iron vein, approached one block higher and west?'",
    tnOut: 'wrote /tmp/iron_then_now.png: THEN previous/life_1/episodes/ep_000673/observation/image.png | NOW. Q: Does the exposed iron over granite match the remembered iron vein, approached one block higher and west?. View it with view_image.',
    writeW: "python - <<'PY' … Path('mine/working.md').write_text('Step8963 …",
    writeA: "python - <<'PY' … Path('actions.json').write_text(json.dumps({'actions':[",
    acts: "{'procedure':'look_abs','args':{'pitch':35,'yaw':0,'ticks':10}},\n{'action':{'attack':1},'repeat':45},\n{'procedure':'watch','args':{'until':'inventory','n':20}}",
    t102b: 'The descent matched; iron is now visible above granite, consistent with the remembered vein. Aim at the iron face and mine one block while stationary. Wait briefly for its drop.',
    t103: 'Iron mining verified—7/24 milestones. The view still shows the breaking iron face; pickup and durability have not updated.',
    t1a: 'This is the initial view: full health, empty inventory, and spruce trees ahead. I’ll read the workshop instructions, inspect inherited scripts and earlier resource locations, and install the safety reflexes. Then I’ll start gathering wood from the nearby trees.',
    t1: 'The earlier life found iron and a four-diamond vein, but lost its tools after stepping off a tunnel edge into lava. I’ll record those resource locations, retain its safer lava stop, and disable the tunnel procedure implicated in that fall.',
    cat: 'cat previous/life_1/mine/working.md previous/life_1/mine/notes.md previous/life_1/mine/pre_death_46291.md previous/scripts.md; …',
    q: "./tools/episodes.py --previous --tag milestone --q 'Where did the earlier life find iron and diamonds?'",
    qOut: "…\nep_000673  steps 18201-18231  tags=milestone,inventory_changed,note pos=(-2952.7,-5603.4)  action=aim_speckles  … milestone ['mine_iron_ore']  …  -> previous/life_1/episodes/ep_000673/\n…",
    shop: "python - <<'PY'\n…\np=Path('mine/procedures/level_step.py')\np.rename(p.with_name('_level_step.py'))\nPath('mine/GUIDE.md').write_text('''# World guide — workshop, life 2\n…",
    shopOut: 'Created actions.json: 4 entries, 221 maximum raw ticks. Workshop guide and working memory saved; four reflexes active.'
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
    p.appendChild(document.createTextNode(text + ' · newest frame'));
    return p;
  }
  function clock(html) { $('.mf-clock').innerHTML = html; }
  function stepClock(step) { clock('Life 2 &middot; step <b>' + num(step) + '</b>'); }
  function peek(kind, html) { fig.querySelector('[data-peek="' + kind + '"]').innerHTML = html; }
  // a note with some of its text marked; marks are [text, class] pairs
  function noteHTML(text, marks) {
    var html = esc(text);
    (marks || []).forEach(function (m) {
      html = html.replace(esc(m[0]), '<' + (m[1] === 'ok' ? 'b class="ok"' : 'mark') + '>' + esc(m[0]) + '</' + (m[1] === 'ok' ? 'b' : 'mark') + '>');
    });
    return html.replace(/\n/g, '<br>');
  }
  function guide(mark) {
    var marks = mark === 'line' ? [[GUIDE_IRON, 'mark']] : mark === 'cite' ? [[GUIDE_CITE, 'mark']] : [];
    return noteHTML(GUIDE_HEAD + GUIDE_IRON, marks);
  }
  function working(step, marks) { return noteHTML(W[step], marks); }
  // a row of an index: id, steps, summary
  function rowHTML(r, cls) {
    return '<div class="' + (cls || '') + '" title="' + esc('ep_' + r[0] + '  steps ' + r[1] + '-' + r[2] + '  ' + r[3]) + '">' +
      '<span>ep_' + r[0] + '</span><span>' + r[1] + '&ndash;' + r[2] + '</span><span>' + esc(r[3]) + '</span></div>';
  }
  // life 2's index as it stood at `step`: the newest rows, the ones new since the last call marked
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
  function lifeOneRows(hit) {
    peek('episodic', '<p class="mf-sub">previous/index.jsonl &middot; life 1</p>' +
      PREV1.map(function (r) { return rowHTML(r, r[0] === hit ? 'hit' : ''); }).join(''));
  }

  // the actions of a turn under the frame: done, the one the environment is executing, still to come.
  // `cur` is the episode being executed, null when the list is just written, 'all' when it has run.
  // An entry { skip: label } was written but never executed.
  function queue(turn, cur) {
    var ids = QUEUE[turn], k = ids.indexOf(cur), n = ids.length;
    var ran = ids.filter(function (id) { return typeof id === 'string'; }).length;
    var state = cur === 'all' ? (ran < n ? ran + ' of ' + n + ' executed' : 'all ' + n + ' executed')
      : k < 0 ? n + ' written' : 'executing ' + (k + 1) + ' of ' + n;
    $('.mf-run').innerHTML = '<p class="mf-q-h"><span>actions.json, turn ' + turn + '</span><span>' + state + '</span></p>' +
      '<ol class="mf-q">' + ids.map(function (id, j) {
        if (typeof id !== 'string') return '<li title="written, never executed">' + esc(id.skip.split('(')[0]) + '</li>';
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

  // the environment: two images, so that a new frame can fade in over the old one.
  // `ran` shows the list that led to this frame as executed, instead of the frame's own action
  // (the first frame of a turn the agent has not taken yet).
  function frame(id, instant, ran) {
    var e = EP[id], src = FRAMES + 'ep_' + id + '.jpg';
    S.want = id;
    stepClock(e[0]);
    $('.mf-pos').innerHTML = '<span>state</span>x ' + coord(e[2]) + ' &nbsp;y ' + coord(e[3]) + ' &nbsp;z ' + coord(e[4]);
    // the frame an action is decided from: that action is the one being executed; past the list's end
    // (the first frame of the next turn), the list has all run
    if (turnOf(id) && !ran) queue(turnOf(id), id);
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
      tn.querySelector('.then img').src = THEN;
      tn.querySelector('.now img').src = FRAMES + 'ep_000459.jpg';
    }
    if (kind === 'toast') {
      screen.insertAdjacentHTML('beforeend', '<div class="mf-toast"><i class="ico" style="--i:5" aria-hidden="true"></i>Iron ore &middot; step 8,992</div>');
    }
    if (kind === 'lives') {
      screen.insertAdjacentHTML('beforeend',
        '<div class="mf-lives"><p>First iron ore, both from this vein</p>' +
        [['Life 1', 18231, '--life-1'], ['Life 2', 8992, '--life-2']].map(function (l) {
          return '<div class="bar" style="--w:' + (l[1] / 19000 * 100).toFixed(1) + '%;--c:var(' + l[2] + ')"><span>' + l[0] +
            '</span><span><i></i></span><em>step ' + num(l[1]) + '</em></div>';
        }).join('') +
        '<p>episodes carried in: 0 and 3,035</p></div>');
    }
  }

  // the map: the cells walked so far, the route of the earlier life, the vein and the agent
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
    var r1Text = el('text', { x: -2931, y: -5606, 'text-anchor': 'end' });
    r1Text.textContent = 'life 1';
    var cells = TRAIL.map(function (c) {
      var r = el('rect', { class: 'cell', x: c[0], y: c[1], width: 1, height: 1 });
      r.step = c[2];
      return r;
    });
    var cx = IRON[0] + 0.5, cz = IRON[1] + 0.5;
    var iron = el('polygon', { class: 'iron', points: [cx, cz - 2.6, cx + 2.6, cz, cx, cz + 2.6, cx - 2.6, cz].join(' ') });
    var ironText = el('text', { x: cx, y: cz + 7.6, 'text-anchor': 'middle' });
    ironText.textContent = 'iron';
    var spawn = el('text', { x: -3009.5, y: -5576, 'text-anchor': 'middle' });
    spawn.textContent = 'spawn';
    var me = el('circle', { class: 'me', r: 2, cx: -2953.4, cy: -5605.4 });
    return {
      walk: function (step, x, z) {
        cells.forEach(function (c) { c.style.display = c.step <= step ? '' : 'none'; });
        me.style.display = '';
        me.setAttribute('cx', x); me.setAttribute('cy', z);
      },
      routes: function (lives) {
        r1.style.display = r1Text.style.display = lives.indexOf(1) >= 0 ? '' : 'none';
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
      caption: '<b>1 Record.</b> The environment executes the agent’s actions one at a time. For each one ' +
        'the harness files an episode: the frame the action was decided from, the agent’s position, health ' +
        'and inventory, the action and its outcome. Each episode gets a row of cues in <code>index.jsonl</code>, ' +
        'and the cells the agent crosses go into <code>grid.jsonl</code>. These records are never edited. ' +
        'Here the agent is underground at y 18, digging down toward the iron its first life found.',
      start: function () {
        frame('000452', true);
        ownRows(8833, false);
        map.routes([]); map.iron(null);
        peek('semantic', guide()); peek('procedural', noteHTML(PROCS)); peek('working', working(8833));
        turnHead('turn 99 · step 8,833', '000452'); say('m', T.t99);
      },
      beats: frames(['000453', '000454', '000455', '000456'], 600, 620, function (id, instant) { ownRows(EP[id][0], !instant); })
        .concat([[3100, function (instant) {
          frame('000457', instant); ownRows(8871, !instant);
          turnHead('turn 100 · step 8,871', '000457'); say('m', T.t100, instant, 75);
          peek('working', working(8871));
        }], [4700, function (instant) {
          frame('000458', instant); ownRows(8890, !instant);
          turnHead('turn 101 · step 8,890', '000458'); say('m', T.t101, instant, 90);
          peek('working', working(8890));
        }], [7000, function (instant) {
          frame('000459', instant, true); ownRows(8963, !instant);
        }]]),
      length: 7300
    },
    {
      key: 'retrieve',
      parts: ['agent', 'l-query', 'episodic', 'semantic', 'previous', 'game'],
      caption: '<b>2 Retrieve.</b> Each turn begins with the newest frame. At step 8,963 the stair the agent ' +
        'just cut has exposed iron-colored speckles. Before mining, it searches its memory: it puts life 1’s ' +
        'frame of the vein, the one its guide cites, beside the live view (<code>--then-now</code>) and checks ' +
        'that the two show the same place.',
      start: function () {
        frame('000459', true, true);
        map.routes([1]); map.iron('ring');
        idle();
        lifeOneRows(null);
        peek('semantic', guide()); peek('procedural', noteHTML(PROCS)); peek('working', working(8890));
        $('.mf-prev [data-life="1"]').classList.add('hit');
        turnHead('turn 101 · step 8,890', '000458'); say('m', T.t101);
      },
      beats: [
        [0, function (instant) { turnHead('turn 102 · step 8,963', '000459'); say('m', T.t102a, instant, 80); }],
        [2300, function (instant) { say('c', T.tn, instant, 140); }],
        [4100, function () { say('o', T.tnOut); lifeOneRows('000673'); overlay('thennow'); }],
        [5300, function () { peek('semantic', guide('line')); }]
      ],
      length: 6600
    },
    {
      key: 'consolidate',
      parts: ['agent', 'l-write', 'semantic', 'procedural', 'working'],
      caption: '<b>3 Consolidate.</b> What the agent learns goes into files it writes itself: places and facts in ' +
        '<code>GUIDE.md</code>, procedures it can call as actions, and the plan in <code>working.md</code>. ' +
        'Each entry cites its evidence; the guide’s line on the vein names the life-1 frame to open. ' +
        'Here the agent rewrites its plan, naming the frame it just compared and the milestone it expects.',
      start: function () {
        frame('000459', true, true);
        map.routes([1]); map.iron('ring');
        idle();
        lifeOneRows('000673');
        peek('semantic', guide()); peek('procedural', noteHTML(PROCS)); peek('working', working(8890));
        turnHead('turn 102 · step 8,963', '000459'); say('m', T.t102a); say('c', T.tn); say('o', T.tnOut);
      },
      beats: [
        [0, function (instant) { say('c', T.writeW, instant, 120); }],
        [900, function (instant) {
          var box = fig.querySelector('[data-peek="working"]');
          type(box, W[8963], instant, 170, function () {
            box.innerHTML = working(8963, [[W_THEN, 'mark'], [W_EXPECT, 'mark']]);
          });
          say('p', 'Step8963 … IRON VISIBLE upperface directlysouth above granitefloor!');
        }],
        [1900, function (instant) { say('p', W_THEN + ' … consistentironovergranite from oneblockhigher/west; arrivedvein vicinity.', instant, 150); }],
        [3500, function (instant) { say('p', 'Plan look35south10 attack45pure oneblock thenwatchinventory20 stationary, expect mine_iron_ore milestone …', instant, 150); }],
        [5000, function () { peek('semantic', guide('cite')); }]
      ],
      length: 6000
    },
    {
      key: 'act',
      parts: ['agent', 'l-read', 'l-act', 'game', 'working'],
      caption: '<b>4 Act.</b> The turn ends with a short list of actions. The environment executes them and the ' +
        'harness records each one, which is stage 1 again. The plan from step 8,963 expected the iron ' +
        'milestone from one swing at the exposed face; at step 8,992 the agent had it. The milestone ended ' +
        'the list, so the third action never ran.',
      start: function () {
        frame('000459', true, true);
        map.routes([1]); map.iron('ring');
        idle();
        ownRows(8963, false);
        peek('semantic', guide()); peek('procedural', noteHTML(PROCS));
        peek('working', working(8963, [[W_EXPECT, 'mark']]));
        turnHead('turn 102 · step 8,963', '000459'); say('c', T.tn); say('c', T.writeW);
      },
      beats: [
        [0, function (instant) { say('c', T.writeA, instant, 120); }],
        [700, function (instant) { say('p', T.acts, instant, 260); queue(102, null); }],
        [1900, function (instant) { say('m', T.t102b, instant, 95); }],
        [4000, function (instant) { frame('000459', instant); }],
        [4600, function (instant) { frame('000460', instant); ownRows(8964, !instant); }],
        [5700, function (instant) {
          frame('000461', instant, true); ownRows(8992, !instant, '000460');
          overlay('toast'); map.iron('got');
        }],
        [6400, function (instant) {
          turnHead('turn 103 · step 8,992', '000461'); say('m', T.t103, instant, 80);
          peek('working', working(8992, [['MILESTONE mine_iron_ore VERIFIED7/24!', 'ok']]));
        }]
      ],
      length: 7600
    },
    {
      key: 'carry',
      parts: ['game', 'previous', 'episodic', 'semantic', 'procedural', 'working', 'agent'],
      caption: '<b>5 Carry over.</b> When a life ends, its records and the agent’s files pass on to the next life ' +
        'under <code>previous/</code>, in the same world and with the same model. Life 2 began by reading ' +
        'them: it asked the earlier life’s index where iron and diamonds were found, wrote those places ' +
        'into its guide with the frames to open, and retired the procedure implicated in life 1’s death. ' +
        'It mined its first iron at step 8,992, where life 1 needed 18,231.',
      start: function () {
        var cur = imgs[S.front];
        cur.src = FRAMES + 'ep_000000.jpg'; cur.style.opacity = 1; imgs[1 - S.front].style.opacity = 0;
        S.want = null;
        clock('Lives 1 and 2');
        $('.mf-pos').innerHTML = '<span>world</span>the same world and spawn in both lives';
        $('.mf-run').textContent = ''; S.queue = null;
        map.walk(9010, 0, 0); map.hideMe(); map.routes([1]); map.iron('got');
        peek('episodic', '<p class="mf-sub">previous/</p><div><span>life_1/index.jsonl</span><span>3,035 rows</span></div>' +
          '<p class="mf-sub">and this life’s own index.jsonl</p>');
        peek('semantic', guide()); peek('procedural', noteHTML(PROCS));
        peek('working', working(8992));
        $$('.mf-prev [data-life]').forEach(function (n) { n.classList.add('hit'); });
        overlay('lives');
        turnHead('life 2, turn 1 · step 0', '000000'); say('m', T.t1a);
      },
      beats: [
        [300, function () { bars(0); }], [900, function () { bars(1); }],
        [1200, function (instant) { say('c', T.cat, instant, 140); }],
        [2400, function (instant) { say('c', T.q, instant, 140); }],
        [3400, function () { say('o', T.qOut); }],
        [4200, function (instant) { say('m', T.t1, instant, 95); }],
        [6900, function (instant) { say('c', T.shop, instant, 160); }],
        [8200, function () { say('o', T.shopOut); peek('semantic', guide('line')); }]
      ],
      length: 8900
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
    new Image().src = THEN;
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
