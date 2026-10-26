const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const api = (p, o) => fetch(p, o).then(r => r.json());
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let G = null, timer = null, dash = null;

function show(v) {
  $$('.view').forEach(e => e.hidden = e.id !== 'v-' + v);
  $$('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'dash') loadDash();
  if (v === 'practice') $('#cap').focus();
}

async function newGame() {
  clearInterval(timer);
  const d = await api('/api/text?chars=140');
  G = {text: d.text, pos: 0, ok: 0, err: 0, t0: 0, keys: {}, done: false, level: d.level};
  $('#level').textContent = d.level + 1;
  $('#letters').innerHTML = [...d.letters].map((c, i) =>
    `<b class="${d.level > 0 && i === d.letters.length - 1 ? 'new' : ''}">${c}</b>`).join('');
  $('#text').innerHTML = [...d.text].map(c => `<span>${c}</span>`).join('');
  $('#text').children[0].className = 'cur';
  stats();
  show('practice');
}

function stats() {
  const s = G.t0 ? (performance.now() - G.t0) / 1000 : 0, tot = G.ok + G.err;
  const wpm = s > 1 ? G.ok / 5 / (s / 60) : 0, acc = tot ? G.ok / tot * 100 : 100;
  $('#s-wpm').textContent = Math.round(wpm);
  $('#s-acc').textContent = Math.round(acc) + '%';
  $('#s-err').textContent = G.err;
  $('#s-time').textContent = fmt(s);
  return {s, wpm, acc};
}

function press(ch) {
  if (G.done) return;
  if (!G.t0) { G.t0 = performance.now(); timer = setInterval(stats, 200); }
  const exp = G.text[G.pos], cells = $('#text').children, sp = cells[G.pos];
  const ks = G.keys[exp.toLowerCase()] ??= [0, 0];
  if (ch === exp) {
    ks[0]++; G.ok++;
    sp.className = sp.dataset.e ? 'fix' : 'ok';
    if (++G.pos >= G.text.length) return finish();
    cells[G.pos].className = 'cur';
  } else {
    ks[1]++; G.err++; sp.dataset.e = 1;
    sp.className = 'cur'; void sp.offsetWidth; sp.className = 'cur bad';
  }
  stats();
}

async function finish() {
  G.done = true; clearInterval(timer);
  const r = stats();
  const res = await api('/api/session', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({wpm: r.wpm, acc: r.acc, errors: G.err, secs: r.s, chars: G.ok, level: G.level, keys: G.keys})});
  $('#r-wpm').textContent = Math.round(r.wpm);
  $('#r-acc').textContent = r.acc.toFixed(1) + '%';
  $('#r-err').textContent = G.err;
  $('#r-time').textContent = fmt(r.s);
  $('#r-chars').textContent = G.ok;
  $('#r-title').textContent = res.best ? 'New personal best!' : 'Session complete';
  let note = res.avg ? `Your average before this session was ${Math.round(res.avg)} wpm. ` : 'Your first session is on the books. ';
  if (res.change === 'up') note += `Nice and clean: "${res.letter}" is now unlocked.`;
  else if (res.change === 'down') note += 'Accuracy was low, so the next text uses fewer letters. Slow down and aim for 95%.';
  else note += 'Reach 95% accuracy at 20+ wpm to unlock the next letter.';
  $('#r-note').textContent = note;
  show('results');
}

async function loadDash() {
  dash = await api('/api/progress');
  const ss = dash.sessions, n = ss.length;
  $('#empty').hidden = n > 0;
  const avg = (a, k) => a.length ? a.reduce((t, x) => t + x[k], 0) / a.length : 0, last = ss.slice(-10);
  const cards = [[dash.count, 'sessions'], [Math.round(Math.max(0, ...ss.map(s => s.wpm))), 'best wpm'],
    [Math.round(avg(last, 'wpm')), 'avg wpm (last 10)'], Math.round(avg(last, 'acc')) + '%', fmt(dash.secs)];
  const labels = ['sessions', 'best wpm', 'avg wpm (last 10)', 'avg accuracy', 'time practiced'];
  $('#cards').innerHTML = [dash.count, Math.round(Math.max(0, ...ss.map(s => s.wpm))), Math.round(avg(last, 'wpm')),
    Math.round(avg(last, 'acc')) + '%', fmt(dash.secs)].map((v, i) => `<div><b>${v}</b><small>${labels[i]}</small></div>`).join('');
  $('#keys').innerHTML = [...dash.order].map((c, i) => {
    const k = dash.keys[c], locked = i >= dash.unlocked;
    if (!k || locked) return `<div class="key none">${c}<small>${locked ? 'locked' : '–'}</small></div>`;
    const acc = k[0] / (k[0] + k[1]) * 100, h = Math.max(0, Math.min(130, (acc - 80) * 6.5));
    return `<div class="key" style="--h:${h}">${c}<small>${Math.round(acc)}%</small></div>`;
  }).join('');
  drawChart();
}

function drawChart() {
  const c = $('#chart'), r = c.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  c.width = r.width * dpr; c.height = r.height * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement), d = dash.sessions.map(s => s.wpm);
  const W = r.width, H = r.height, p = 36, max = Math.max(20, ...d) * 1.15;
  const px = i => p + (d.length < 2 ? (W - 2 * p) / 2 : i * (W - 2 * p) / (d.length - 1));
  const py = v => H - p + 6 - v / max * (H - 2 * p);
  x.font = '12px system-ui'; x.fillStyle = css.getPropertyValue('--mute'); x.strokeStyle = css.getPropertyValue('--line');
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, y = py(v);
    x.beginPath(); x.moveTo(p, y); x.lineTo(W - 10, y); x.stroke(); x.fillText(Math.round(v), 6, y + 4);
  }
  if (!d.length) return;
  x.strokeStyle = css.getPropertyValue('--blue'); x.lineWidth = 3; x.lineJoin = 'round'; x.beginPath();
  d.forEach((v, i) => i ? x.lineTo(px(i), py(v)) : x.moveTo(px(i), py(v))); x.stroke();
  x.fillStyle = css.getPropertyValue('--hi');
  d.forEach((v, i) => { x.beginPath(); x.arc(px(i), py(v), 5, 0, 7); x.fill(); x.stroke(); });
}

// Hidden textarea receives all typing (works with mobile keyboards too).
$('#cap').addEventListener('input', e => { for (const ch of e.target.value) press(ch); e.target.value = ''; });
$('#stage').addEventListener('click', () => $('#cap').focus());
document.addEventListener('keydown', e => {
  const v = $$('.view').find(x => !x.hidden).id;
  if (e.key === 'Escape' && v === 'v-practice') newGame();
  else if (e.key === 'Enter' && v === 'v-results') newGame();
  else if (v === 'v-practice' && e.key.length === 1 && document.activeElement !== $('#cap') && !e.metaKey && !e.ctrlKey) $('#cap').focus();
});
$$('[data-v]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); show(b.dataset.v); }));
$('#again').onclick = $('#skip').onclick = newGame;
$('#to-dash').onclick = () => show('dash');
addEventListener('resize', () => { if (!$('#v-dash').hidden && dash) drawChart(); });
newGame();
