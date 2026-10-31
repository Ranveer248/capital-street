// Capital Street loading screen (Goal 31). Runs before anything big downloads: checks that the browser can draw 3D,
// picks a graphics quality that suits the device (a new player chooses it before the city is built), shows each real
// loading stage with progress, and explains what to do when something fails instead of hanging on one line of text.
'use strict';
window.Boot = (function () {
  const $ = id => document.getElementById(id);
  const PRESETS = {
    low: { cap: 1, scale: 0.7, shadows: 'off', detail: 'low', aa: false },
    medium: { cap: 1.5, scale: 0.85, shadows: 'low', detail: 'high', aa: true },
    high: { cap: 2, scale: 1, shadows: 'high', detail: 'high', aa: true },
    ultra: { cap: 3, scale: 1, shadows: 'high', detail: 'high', aa: true },
  };
  const NAMES = { low: ['Low', 'Weaker phones and laptops'], medium: ['Medium', 'Most phones and tablets'], high: ['High', 'Gaming PCs and new phones'], ultra: ['Ultra', 'Fast graphics cards'] };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } } };

  // ---------- can this browser draw 3D at all, and with a real graphics card? ----------
  let ok = false, gpu = '', soft = false;
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
    if (gl) {
      ok = true;
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : '';
      soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); // give the test context back
    }
  } catch (e) { ok = false; }
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8, touch = matchMedia('(pointer: coarse)').matches;
  const rec = soft || mem <= 2 || cores <= 2 ? 'low' : touch || mem <= 4 || cores <= 4 ? 'medium' : 'high';

  // a new player picks before the city is built; anyone who has played before keeps their settings and isn't asked
  let saved = null; try { saved = JSON.parse(store.get('cs-gfx') || 'null'); } catch (e) { saved = null; }
  const player = (() => { try { const s = JSON.parse(store.get('capital-street-market-v1') || 'null'); return !!(s && s.started); } catch (e) { return false; } })();
  const asked = !!store.get('cs-gfx-picked') || player;
  if (!asked) store.set('cs-gfx', JSON.stringify(Object.assign({}, saved || {}, PRESETS[rec], { preset: rec })));
  let chose; const ready = asked ? Promise.resolve() : new Promise(r => { chose = r; });

  // ---------- the screen ----------
  const STEPS = [['gfx', 'Graphics'], ['data', 'Map download'], ['build', 'Building the city']];
  const el = $('load');
  el.innerHTML = `<div class="lbox"><b id="loadT">Loading New York…</b>
    <ol class="lsteps">${STEPS.map(([k, t]) => `<li data-s="${k}">${t}</li>`).join('')}</ol>
    <div class="lbar"><i id="loadBar"></i></div><small id="loadMsg">Checking your graphics</small>
    <div id="lq"></div><div id="lerr" hidden></div></div>`;
  let cur = 0, last = Date.now(), finished = false;
  const times = []; // [stage, ms since the page opened]: how long each part of loading takes, for measuring
  function step(k, msg) {
    const i = STEPS.findIndex(s => s[0] === k);
    if (i >= 0) { cur = i; el.querySelectorAll('.lsteps li').forEach((li, j) => { li.className = j < i ? 'done' : j === i ? 'on' : ''; }); }
    if (msg != null) { $('loadMsg').textContent = msg; if (!/^Downloading the map:/.test(msg)) times.push([msg, Math.round(performance.now())]); }
    alive();
  }
  function progress(f) { $('loadBar').style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; alive(); }
  function alive() { last = Date.now(); const w = $('lslow'); if (w) w.remove(); }

  function quality() {
    const q = $('lq'), now = (() => { try { return JSON.parse(store.get('cs-gfx') || '{}').preset; } catch (e) { return rec; } })() || rec;
    if (!asked && chose) {
      q.innerHTML = `<small>PICK YOUR GRAPHICS</small><div class="lqbig">${Object.keys(PRESETS).map(k => `<button data-q="${k}" class="${k === rec ? 'rec' : ''}"><b>${NAMES[k][0]}</b><span>${k === rec ? 'Best for this device' : NAMES[k][1]}</span></button>`).join('')}</div>
        ${soft ? '<p class="lnote">Your browser is drawing 3D without the graphics card, so the game will be slow. Turn on hardware acceleration in its settings for a smoother game.</p>' : '<p class="lnote">You can change this any time in Settings.</p>'}`;
    } else {
      q.innerHTML = `<small>GRAPHICS</small><div class="lqrow">${Object.keys(PRESETS).map(k => `<button data-q="${k}" class="${k === now ? 'on' : ''}">${NAMES[k][0]}</button>`).join('')}</div>${soft ? '<p class="lnote">Drawing without the graphics card: pick Low for a smoother game.</p>' : ''}`;
    }
    q.querySelectorAll('[data-q]').forEach(b => b.onclick = () => pick(b.dataset.q));
  }
  function pick(k) {
    const g = Object.assign({}, (() => { try { return JSON.parse(store.get('cs-gfx') || '{}'); } catch (e) { return {}; } })(), PRESETS[k], { preset: k });
    store.set('cs-gfx', JSON.stringify(g)); store.set('cs-gfx-picked', '1');
    if (typeof GFX !== 'undefined') { Object.assign(GFX, PRESETS[k], { preset: k }); if (window.PC && PC.applyGfx) PC.applyGfx(); }
    if (chose) { const c = chose; chose = null; c(); }
    quality();
  }

  // ---------- when something goes wrong ----------
  function fail(title, body, opts = {}) {
    finished = true;
    el.hidden = false;
    el.classList.add('bad');
    $('loadT').textContent = 'Capital Street can not start yet';
    const e = $('lerr');
    e.hidden = false;
    e.innerHTML = `<b>${title}</b><p>${body}</p>${opts.detail ? `<code>${String(opts.detail).replace(/[<&>]/g, '')}</code>` : ''}
      <div class="lbtns2"><button class="btn pri" id="lRetry">TRY AGAIN</button>${opts.low === false ? '' : '<button class="btn" id="lLow">TRY LOW GRAPHICS</button>'}</div>`;
    $('lRetry').onclick = () => location.reload();
    if ($('lLow')) $('lLow').onclick = () => { pick('low'); location.reload(); };
    $('lq').hidden = true;
  }
  const NO_GL = 'Capital Street needs WebGL to draw the city, and this browser has it switched off or blocked. To fix it:<br>• turn on <b>hardware acceleration</b> (Chrome and Edge: Settings → System; Firefox: Settings → Performance)<br>• update the browser and your graphics driver<br>• close other tabs and apps that use 3D, then try again<br>• or open the game in Chrome, Edge, Firefox or Safari';
  function noGL(detail) { fail('This browser can\'t show 3D graphics', NO_GL, { detail }); }

  // the graphics card can be taken away while you play (driver reset, too many tabs): say so, and get it back
  let lostT = 0;
  function lost() {
    if (window.Market) try { Market.save(); } catch (e) { /* the save banner reports it */ }
    let o = $('glLost');
    if (!o) { o = document.createElement('div'); o.id = 'glLost'; o.className = 'ov2'; document.body.appendChild(o); }
    o.innerHTML = '<div class="jbox"><b>Graphics paused</b><p>Your browser took the graphics card away for a moment. Getting it back…</p></div>';
    o.hidden = false;
    clearTimeout(lostT);
    lostT = setTimeout(() => { o.innerHTML = '<div class="jbox"><b>Graphics stopped</b><p>The browser didn\'t give the graphics back. Your game is saved: reload to carry on. If this keeps happening, pick Low graphics in Settings.</p><button class="btn pri big" id="glReload">RELOAD</button></div>'; $('glReload').onclick = () => location.reload(); }, 6000);
  }
  function restored() { clearTimeout(lostT); const o = $('glLost'); if (o) o.hidden = true; }

  // nothing has moved for a while: offer a way out rather than a frozen screen
  setInterval(() => {
    if (finished || el.hidden || Date.now() - last < 25000 || $('lslow')) return;
    const w = document.createElement('div'); w.id = 'lslow';
    w.innerHTML = `<p>This is taking longer than usual${cur === 1 ? ' (a slow connection?)' : ''}.</p><button class="btn" id="lSlowR">TRY AGAIN</button>`;
    $('lerr').before(w); $('lSlowR').onclick = () => location.reload();
  }, 2000);

  // once the game can't start, the scripts after it fail one by one; the screen above already says why, so they stay quiet
  addEventListener('error', e => { if (el.classList.contains('bad') && !window.CS) e.preventDefault(); });

  function done() { finished = true; progress(1); el.classList.remove('bad'); }

  if (!ok) noGL('WebGL is not available');
  else { step('gfx', soft ? 'Graphics found, but without hardware acceleration' : 'Graphics OK'); quality(); }
  return { dead: !ok, ready, step, progress, fail, noGL, lost, restored, done, rec, soft, gpu, PRESETS, times, waiting: () => !!chose };
})();
