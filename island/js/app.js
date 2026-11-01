// Capital Island review sample: the cover, joining, the HUD, one panel at a time, property cards with pictures, Visit
// (fast travel), island trips, the timber jobs (cut, truck, ship, sell), your own island, and Ollie the guide.
// Kept apart from the live game: its own save key, nothing sent anywhere.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const usd = v => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ic = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
  const clock = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const KEY = 'cs-island-preview-v1', COLORS = ['#ffd21f', '#4c8dff', '#f04e5e', '#2fbf6a', '#a970ff', '#ff9f43', '#2fd0c0', '#ff8fb1'];
  const freshJobs = () => ({ stock: { mill: 0, pine: 0, quay: 0, site: 0, coral: 0 }, tasks: [], price: { quay: 1, site: 1, coral: 1 }, stats: { cut: 0, moved: 0, sold: 0, earned: 0, spent: 0 }, at: Date.now() });
  const fresh = () => ({ v: 2, name: '', color: COLORS[1], cash: 2340, lvl: 1, xp: 0, owned: {}, t: 9 * 60, rentDue: 3 * 1440, guide: 0, jobs: freshJobs(), visited: {}, gull: null });
  let S; try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  S.jobs = Object.assign(freshJobs(), S.jobs || {}); S.visited = S.visited || {}; // older preview saves get the new parts
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* the preview keeps going */ } };
  const RENT = 650;
  const q = new URLSearchParams(location.search);

  // ---------- toasts: below the top bar, never over the buttons ----------
  let toastT = 0;
  function toast(t, b = '', kind = '') { $('toastT').textContent = t; $('toastB').textContent = b; $('toast').className = 'on ' + kind; clearTimeout(toastT); toastT = setTimeout(() => $('toast').className = '', 2600); }

  // ---------- Ollie: an original guide, drawn here ----------
  const OLLIE = `<svg viewBox="0 0 120 120" width="100%" height="100%"><circle cx="60" cy="60" r="60" fill="#7fd0f0"/>
    <path d="M18 122c3-24 20-36 42-36s39 12 42 36z" fill="#f7f7fb" stroke="#0a0f2e" stroke-width="3"/><path d="M27 104h66M23 114h74" stroke="#2f5bff" stroke-width="5"/>
    <circle cx="31" cy="44" r="10" fill="#a8693c" stroke="#0a0f2e" stroke-width="3"/><circle cx="89" cy="44" r="10" fill="#a8693c" stroke="#0a0f2e" stroke-width="3"/><circle cx="31" cy="44" r="4.5" fill="#6e3f20"/><circle cx="89" cy="44" r="4.5" fill="#6e3f20"/>
    <ellipse cx="60" cy="63" rx="33" ry="30" fill="#b9773f" stroke="#0a0f2e" stroke-width="3"/><ellipse cx="60" cy="76" rx="22" ry="15" fill="#f5dcb5"/>
    <ellipse cx="47" cy="62" rx="5" ry="6" fill="#141833"/><ellipse cx="73" cy="62" rx="5" ry="6" fill="#141833"/><circle cx="48.6" cy="59.6" r="1.9" fill="#fff"/><circle cx="74.6" cy="59.6" r="1.9" fill="#fff"/>
    <ellipse cx="60" cy="71" rx="6.4" ry="4.4" fill="#2a1a12"/><path d="M54 78q6 5 12 0" stroke="#2a1a12" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="39" cy="74" r="4.5" fill="#ff8fa3" opacity=".55"/><circle cx="81" cy="74" r="4.5" fill="#ff8fa3" opacity=".55"/>
    <path d="M41 77l-10-2M41 80l-10 1M79 77l10-2M79 80l10 1" stroke="#6e3f20" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M29 42q31-26 62 0l-2 7q-29-14-58 0z" fill="#1f2a6b" stroke="#0a0f2e" stroke-width="3" stroke-linejoin="round"/><path d="M31 49q29-12 58 0l-1 5q-28-11-56 0z" fill="#ffd21f" stroke="#0a0f2e" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M60 30v8M56.5 33.5h7M56 38q4 3 8 0" stroke="#ffd21f" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
  $('gFace').innerHTML = OLLIE;

  // ---------- joining: the name screen, with progress, a way back from errors, and one submit at a time ----------
  const join = $('join');
  let busy = false, quality = (() => { try { return localStorage.getItem('cs-island-q') || 'high'; } catch (e) { return 'high'; } })();
  function webgl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function drawJoin(state = 'form', why = '') {
    join.hidden = false;
    if (state === 'form') {
      join.innerHTML = `<form class="card" id="jf"><div class="cface">${OLLIE}</div><h2>What should we call you?</h2><p>Everyone on Capital Island sees this name.</p>
        <label for="jn">Your name</label><input id="jn" maxlength="20" autocomplete="nickname" placeholder="Your name" value="${esc(S.name)}" required>
        <label>Your colour</label><div class="swatch">${COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === S.color ? 'on' : ''}" aria-label="Colour"></button>`).join('')}</div>
        ${why ? `<p class="why">${esc(why)}</p>` : ''}
        <button class="btn pri big" id="jgo">LET'S GO!</button><p class="note" style="text-align:center">Preview: your name stays on this device.</p></form>`;
      join.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { S.color = b.dataset.c; join.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
      setTimeout(() => $('jn') && $('jn').focus(), 60);
      $('jf').onsubmit = e => { e.preventDefault(); submit(); };
    } else if (state === 'load') {
      join.innerHTML = `<div class="card"><h2>Getting ready</h2><div class="steps" id="jst"></div><div class="bar"><i id="jbar"></i></div><p class="note" style="text-align:center" id="jmsg">Building Capital Island…</p></div>`;
    } else if (state === 'fail') {
      join.innerHTML = `<div class="card"><h2>That didn't work</h2><p class="why">${esc(why)}</p><div class="acts"><button class="btn pri" id="jre">TRY AGAIN</button><button class="btn" id="jlow">LOW GRAPHICS</button></div></div>`;
      $('jre').onclick = () => location.reload();
      $('jlow').onclick = () => { try { localStorage.setItem('cs-island-q', 'low'); } catch (e) { /* fine */ } location.reload(); };
    }
  }
  const STEPS = ['Saving your name', 'Building Capital Island', 'Moving in'];
  function steps(i) { $('jst').innerHTML = STEPS.map((s, k) => `<div class="${k < i ? 'ok' : k === i ? 'on' : ''}"><i>${k < i ? '✓' : ''}</i>${s}</div>`).join(''); $('jbar').style.width = Math.round(i / STEPS.length * 100) + '%'; }
  async function submit() {
    if (busy) return; // a second tap while joining does nothing
    const name = ($('jn').value || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]{1,18}[A-Za-z0-9]$/.test(name)) { drawJoin('form', '3 to 20 letters or numbers (spaces, dots and dashes in the middle are fine).'); return; }
    busy = true; S.name = name; $('jgo').disabled = true; $('jgo').textContent = 'JOINING…';
    drawJoin('load'); steps(0);
    await wait(250); save(); steps(1);
    await start();
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------- starting the island ----------
  let started = false;
  async function start() {
    if (started) return; started = true;
    if (!webgl()) { busy = false; drawJoin('fail', 'This browser can\'t show 3D graphics. Turn on hardware acceleration in its settings, or try Chrome, Edge, Firefox or Safari.'); return; }
    $('jmsg').textContent = 'Building Capital Island…';
    await wait(60); // let the progress card paint before the heavy work
    try {
      const t0 = performance.now();
      $('c').hidden = false;
      World.init($('c'), quality);
      window.buildMs = Math.round(performance.now() - t0);
    } catch (e) { console.error(e); busy = false; drawJoin('fail', 'The island couldn\'t be built (' + (e.message || e) + ').'); return; }
    steps(2); await wait(200);
    $('cover').hidden = true; join.hidden = true;
    World.place(World.overview());
    resumeJobs();
    loop(performance.now());
    World.flyTo(World.homeView(), 2.2, () => { $('hud').hidden = false; draw(); if (S.guide < GUIDE.length) guide(S.guide); else drawObj(); });
  }
  $('play').onclick = () => { if (S.name) { drawJoin('load'); steps(1); busy = true; start(); } else drawJoin('form'); };
  if (S.name) $('play').textContent = 'PLAY AS ' + S.name.toUpperCase();

  // ---------- the frame loop and the clock (time stands still while Ollie talks) ----------
  let last = 0, paused = false, acc = 0, frames = 0, fpsT = 0;
  function loop(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    if (!paused && !$('hud').hidden) { acc += dt; while (acc >= 1) { acc -= 1; minute(); } }
    World.step(dt);
    labels();
    frames++; fpsT += dt; if (fpsT > 1) { $('fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
    requestAnimationFrame(loop);
  }
  function minute() { // one game minute passes every real second
    S.t++;
    if (S.t % 1440 === 0) { const inc = Math.round(Object.keys(S.owned).reduce((a, id) => { const b = byId(id); return a + (b ? rentOf(b) : 0); }, 0) / 7); if (inc) { S.cash += inc; toast('Rent collected', `+${usd(inc)} from your buildings`, 'good'); } }
    if (S.t >= S.rentDue) { S.rentDue += 7 * 1440; S.cash -= RENT; toast('Rent paid', `${usd(RENT)} for 14 Shell Street`); }
  }
  setInterval(() => { if (!$('hud').hidden) { jobsTick(); draw(); drawObj(); save(); } }, 1000);
  function draw() {
    $('av').textContent = (S.name || '?')[0].toUpperCase(); $('av').style.background = S.color; $('nm').textContent = S.name || 'Player';
    $('lvN').textContent = 'LV ' + S.lvl; $('lvF').style.width = Math.min(100, S.xp / (60 * S.lvl) * 100) + '%';
    $('cashV').textContent = usd(S.cash);
    const left = S.rentDue - S.t, d = Math.floor(left / 1440), h = Math.floor(left % 1440 / 60);
    $('rentV').textContent = `Rent ${usd(RENT)} · ${d ? d + 'd ' : ''}${h}h`; $('rentV').classList.toggle('late', left < 1440 && S.cash < RENT);
    const section = stack.length ? stack[0][0] : panelName; // a card opened from Property keeps Property lit
    document.querySelectorAll('#nav button').forEach(b => { b.classList.toggle('on', b.dataset.p === section); b.classList.toggle('locked', b.dataset.p === 'office' && S.lvl < 5); });
    const running = S.jobs.tasks.length; $('jobsDot').hidden = !running; $('jobsDot').textContent = running;
  }
  const gain = xp => { S.xp += xp; while (S.xp >= 60 * S.lvl) { S.xp -= 60 * S.lvl; S.lvl++; toast(`Level ${S.lvl}!`, 'New property opens up as you level up.', 'good'); } };

  // ---------- labels over the island: your home, the job sites, district and island names from far away ----------
  const LAB = $('labels'), labs = [];
  function lab(text, cls, x, y, z, min, max, isle = 'main') { const el = document.createElement('div'); el.className = 'lab ' + cls; el.innerHTML = text; LAB.appendChild(el); labs.push({ el, v: new THREE.Vector3(x, y, z), min, max, isle }); }
  let labelled = false;
  function labels() {
    if (!World.camera) return;
    if (!labelled) {
      labelled = true;
      lab(`${ic('home')}HOME`, 'home', World.home.x, 30, World.home.z, 0, 1e9);
      const D = { centre: [-20, -90], oldtown: [360, -40], northgate: [360, -350], harbour: [40, 220], marina: [440, 360], hillcrest: [-350, 370], farms: [-470, 140], golf: [-340, -170], mill: [0, -330], beach: [650, 80] };
      for (const Z of World.ZONES) if (D[Z.id]) lab(Z.name.toUpperCase(), 'dist', D[Z.id][0], 40, D[Z.id][1], 700, 1e9);
      lab('LIGHTHOUSE POINT', 'dist', 566, 30, 600, 700, 1e9);
      for (const I of World.ISLES) lab(I.name.toUpperCase(), 'dist isle', I.x, 60, I.z, 0, 1e9, I.id);
      for (const id of ['mill', 'quay', 'site']) { const p = World.places[id]; lab(`${ic(id === 'site' ? 'crane' : id === 'mill' ? 'tree' : 'ship')}${SITES[id].tag}`, 'job', p.b.x, p.b.h + 10, p.b.z, 0, 620); }
    }
    const cam = World.camera, dist = World.current().dist, v = new THREE.Vector3(), hideAll = !$('panel').hidden && innerWidth < 760, here = World.active;
    for (const l of labs) {
      v.copy(l.v).project(cam);
      const isleLab = l.el.classList.contains('isle'), on = !hideAll && (isleLab ? l.isle !== here || dist > 500 : l.isle === here) && dist >= l.min && dist <= l.max && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      l.el.style.display = on ? '' : 'none';
      if (on) l.el.style.left = (v.x + 1) / 2 * innerWidth + 'px', l.el.style.top = (1 - v.y) / 2 * innerHeight + 'px';
    }
  }
  function siteLabel(id) { const p = World.places[id]; if (p && !labs.some(l => l.site === id)) { lab(`${ic(id === 'pine' ? 'tree' : 'crane')}${SITES[id].tag}`, 'job', p.b.x, p.b.h + 10, p.b.z, 0, 620, SITES[id].isle); labs[labs.length - 1].site = id; } }

  // ---------- property: prices, what you can buy, pictures ----------
  const KIND = { home: 'Home', villa: 'Villa', apart: 'Apartments', starter: 'Walk-up', hotel: 'Hotel', shop: 'Shop', market: 'Market', office: 'Offices', tower: 'Landmark tower', warehouse: 'Warehouse', factory: 'Factory', barn: 'Farm', mill: 'Timber mill', kiosk: 'Beach kiosk',
    hall: 'City Hall', church: 'Church', school: 'School', hospital: 'Hospital', stadium: 'Stadium', wheel: 'Big wheel', fire: 'Fire station', site: 'Building site' };
  const RATE = { home: 95, villa: 110, apart: 85, hotel: 130, shop: 120, market: 100, office: 150, warehouse: 45, factory: 40, barn: 30, mill: 35, kiosk: 160 }; // a small house is about a week's rent: a first goal you can reach
  const ISLE_RATE = { main: 1, pine: 0.7, coral: 1.5, gull: 1 };
  const priceOf = b => Math.round(b.w * b.d * Math.max(1, b.floors || (b.type === 'home' ? 2 : 1)) * (RATE[b.type] || 800) / 100 * ISLE_RATE[World.isleOf(b)]) * 10;
  const rentOf = b => Math.max(10, Math.round(priceOf(b) * 0.05 / 10) * 10);
  const isleName = id => id === 'main' ? 'Capital Island' : (World.ISLES.find(i => i.id === id) || {}).name;
  function lockOf(b) {
    if (b.owner === 'you') return S.owned[b.id] ? '' : 'Your home: the landlord isn\'t selling.';
    if (b.id === 'tower') return 'Capital Tower belongs to the island. Offices inside open at level 5.';
    if (b.owner === 'city') return `${b.name} belongs to the island and isn't for sale.`;
    if (b.type === 'office' && b.floors > 7 && S.lvl < 5) return 'Office towers open at level 5.';
    if ((b.type === 'factory' || b.type === 'mill') && S.lvl < 3) return 'Industry opens at level 3.';
    return '';
  }
  const SIL = { home: '<path d="M10 40 32 20l22 20v24H10z"/>', apart: '<path d="M14 14h36v50H14z"/>', shop: '<path d="M10 30h44v34H10zM8 24h48l-4 8H12z"/>', office: '<path d="M16 6h32v58H16z"/>', tower: '<path d="M20 10h24v54H20zM28 2h8v8h-8z"/>', warehouse: '<path d="M6 34q26-16 52 0v30H6z"/>', factory: '<path d="M6 64V34l12 8v-8l12 8v-8l12 8V20h6v44z"/>', barn: '<path d="M12 34 32 18l20 16v30H12z"/>', mill: '<path d="M8 36 32 20l24 16v28H8z"/>', kiosk: '<path d="M18 30h28v34H18zM12 24h40l-4 6H16z"/>', starter: '<path d="M14 14h36v50H14z"/>' };
  const placeholder = b => `<div class="wait"><svg viewBox="0 0 64 70" fill="#3c5a7a">${SIL[b.type] || SIL.home}</svg></div>`;
  // pictures: memory first, then the device's cache, then one render at a time between frames
  const VER = 'p2', mem = new Map(), queue = [];
  let db = null; const idb = () => db || (db = new Promise(r => { try { const o = indexedDB.open('cs-island-shots', 1); o.onupgradeneeded = () => o.result.createObjectStore('s'); o.onsuccess = () => r(o.result); o.onerror = () => r(null); } catch (e) { r(null); } }));
  const idbGet = async k => { const d = await idb(); if (!d) return null; return new Promise(r => { try { const t = d.transaction('s').objectStore('s').get(k); t.onsuccess = () => r(t.result || null); t.onerror = () => r(null); } catch (e) { r(null); } }); };
  const idbPut = async (k, v) => { const d = await idb(); if (d) try { d.transaction('s', 'readwrite').objectStore('s').put(v, k); } catch (e) { /* only a cache */ } };
  function picture(el, b) {
    if (!el || !b) return;
    const k = `${b.id}:${b.v || 0}:${VER}`;
    if (mem.has(k)) { show(el, mem.get(k)); return; }
    el.innerHTML = placeholder(b);
    idbGet(k).then(u => { if (u) { mem.set(k, u); show(el, u); } else { queue.push([el, b, k]); pump(); } });
  }
  function show(el, url) { el.innerHTML = `<img alt="" src="${url}">`; }
  let pumping = false;
  function pump() {
    if (pumping || !queue.length) return; pumping = true;
    requestAnimationFrame(() => setTimeout(() => {
      const [el, b, k] = queue.shift();
      if (el.isConnected) { try { const u = World.photo(b); mem.set(k, u); idbPut(k, u); show(el, u); } catch (e) { el.innerHTML = placeholder(b).replace('<div class="wait">', '<div class="wait" style="animation:none">') + '<span class="tag2">No picture</span>'; } }
      pumping = false; pump();
    }, 0));
  }

  // ---------- the panel: one at a time, with back and close ----------
  let panelName = '', stack = [], curArg = null;
  const P = $('panel');
  const SECTION = { home: ['home', '#ff9f43'], property: ['key', '#2fbf6a'], jobs: ['jobs', '#ffd21f'], bank: ['bank', '#2fd0c0'], office: ['office', '#a970ff'], island: ['island', '#4c8dff'], menu: ['gear', '#aeb7ea'], card: ['pin', '#2fbf6a'] };
  function open(name, arg, push) {
    if (push && panelName) stack.push([panelName, curArg]); else if (!push) stack = [];
    panelName = name; curArg = arg;
    P.hidden = false; $('pBack').hidden = !stack.length;
    document.body.classList.add('pOpen');
    const r = PANELS[name](arg), sec = SECTION[name] || SECTION.card;
    $('pTitle').textContent = r.title; $('pSub').textContent = r.sub || ''; $('pIcon').innerHTML = ic(sec[0]); $('pIcon').style.background = sec[1];
    const keep = name === lastRendered ? $('pbody').scrollTop : 0; lastRendered = name;
    $('pbody').innerHTML = r.html; $('pbody').scrollTop = keep;
    if (r.bind) r.bind($('pbody'));
    draw(); events.emit('panel', name);
  }
  let lastRendered = '';
  function close() { document.body.classList.remove('pOpen'); P.hidden = true; panelName = ''; lastRendered = ''; stack = []; World.mark(null); draw(); events.emit('panel', ''); }
  const refresh = () => { if (panelName && !P.hidden) { const st = stack.slice(); open(panelName, curArg, false); stack = st; $('pBack').hidden = !stack.length; } };
  $('pX').onclick = close;
  $('pBack').onclick = () => { const [n, a] = stack.pop() || []; if (n) { const st = stack.slice(); panelName = ''; open(n, a, false); stack = st; $('pBack').hidden = !stack.length; } };
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => {
    const p = b.dataset.p;
    if (panelName === p) { close(); return; }
    if (p === 'home') { if (World.active !== 'main') travel('main'); else World.flyTo(World.homeView(), 1.3); }
    if (p === 'island') World.flyTo(World.active === 'main' ? World.overview() : World.isleView(World.ISLES.find(i => i.id === World.active)), 1.6);
    open(p);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !P.hidden) { if (stack.length) $('pBack').click(); else close(); } });
  const events = { fns: [], on(f) { this.fns.push(f); }, emit(t, d) { for (const f of this.fns) f(t, d); } };

  // fast travel: the camera goes to the building (crossing to its island first) and marks it; it never buys anything
  function visit(b) {
    const there = World.isleOf(b), go = () => { World.flyTo(World.viewOf(b), 1.4, () => events.emit('visited', b.id)); World.mark(b); };
    if (innerWidth < 760) P.hidden = true;
    if (there !== World.active) { travel(there, () => go()); toast('Visiting ' + b.name, `${b.district} · ${isleName(there)}`); }
    else { go(); toast('Visiting ' + b.name, b.district); }
  }
  // island trips: the island is built the first time, then the camera flies across the sea
  function travel(id, after) {
    if (id === World.active) { if (after) after(); return; }
    const I = World.ISLES.find(i => i.id === id), first = I && !I.built;
    if (first) toast(`Loading ${I.name}…`, 'Building the island for the first time');
    setTimeout(() => {
      World.travel(id, 3.4, () => {
        if (I) { S.visited[id] = true; if (!I.seen) { I.seen = true; if (id === 'pine' || id === 'coral') { siteLabel(id); setPile(id); } if (id === 'gull') rebuildPlots(); } }
        toast(id === 'main' ? 'Back on Capital Island' : `Welcome to ${I.name}`, id === 'main' ? 'Home is on Shell Street.' : I.blurb, 'good');
        events.emit('travel', id); if (after) after(); refresh();
      });
    }, first ? 60 : 0);
  }

  const near = (x, z, n, f = () => true) => World.buildings.filter(f).map(b => [b, Math.hypot(b.x - x, b.z - z)]).sort((a, c) => a[1] - c[1]).slice(0, n).map(a => a[0]);
  const forSale = b => !S.owned[b.id] && b.owner !== 'you' && b.owner !== 'city' && b.type !== 'kiosk' && b.type !== 'stack' && RATE[b.type];
  function cardHTML(b) { const lk = lockOf(b), own = S.owned[b.id] || b.owner === 'you' && b.id !== 'home'; return `<button class="pc" data-b="${b.id}"><div class="ph" data-ph="${b.id}"></div>${lk && !own ? '<span class="tag2 lock">LOCKED</span>' : own ? '<span class="tag2 yours">YOURS</span>' : ''}<div class="tx"><b>${esc(b.name)}</b><small>${KIND[b.type] || 'Building'} · ${esc(b.district)}</small><em>${own ? 'Yours' : usd(priceOf(b))}</em></div></button>`; }
  function bindCards(root) {
    root.querySelectorAll('[data-ph]').forEach(el => picture(el, byId(el.dataset.ph)));
    root.querySelectorAll('[data-b]').forEach(el => el.onclick = () => open('card', el.dataset.b, true));
  }
  const byId = id => World.buildings.find(b => b.id === id);
  let filter = 'all';
  const GROUP = { homes: ['home', 'villa', 'apart'], shops: ['shop', 'hotel', 'market'], offices: ['office'], industry: ['warehouse', 'factory', 'barn', 'mill'] };

  // ---------- jobs: the timber loop. Cut logs, truck or ship them, sell them where builders pay most ----------
  const SITES = {
    mill: { name: 'Pine Ridge Sawmill', tag: 'SAWMILL', isle: 'main', cut: { wage: 5, secs: 0.6 } },
    pine: { name: 'Pine Isle Logging Camp', tag: 'LOGGING CAMP', isle: 'pine', cut: { wage: 3, secs: 0.45 } },
    quay: { name: 'Harbour Timber Yard', tag: 'TIMBER YARD', isle: 'main', buy: 11 },
    site: { name: 'Capital Builders site', tag: 'BUILDERS', isle: 'main', buy: 15 },
    coral: { name: 'Coral Key Builders', tag: 'BUILDERS', isle: 'coral', buy: 22 },
  };
  const LINKS = [
    { from: 'mill', to: 'quay', mode: 'truck', cost: 40, secs: 25, cap: 60 }, { from: 'mill', to: 'site', mode: 'truck', cost: 40, secs: 20, cap: 60 }, { from: 'quay', to: 'site', mode: 'truck', cost: 40, secs: 25, cap: 60 },
    { from: 'quay', to: 'coral', mode: 'ship', cost: 180, secs: 60, cap: 200 }, { from: 'pine', to: 'quay', mode: 'ship', cost: 120, secs: 45, cap: 200 }, { from: 'pine', to: 'coral', mode: 'ship', cost: 200, secs: 70, cap: 200 },
  ];
  const J = () => S.jobs, now = () => Date.now();
  let qty = 40, jobTab = '';
  const priceAt = id => SITES[id].buy * J().price[id];
  function saleValue(id, n) { const f = J().price[id], avg = Math.max(0.5, f - 0.0025 * (n - 1) / 2); return Math.round(n * SITES[id].buy * avg); } // each log sold nudges the price down a little; it recovers over time
  function canCut(id) { return id === 'mill' || S.visited.pine; }
  function cut(id, n) {
    const s = SITES[id], cost = n * s.cut.wage;
    if (!canCut(id)) { toast('Visit Pine Isle first', 'Travel there once to hire the logging crew.'); return; }
    if (J().tasks.some(t => t.kind === 'cut' && t.site === id)) { toast('The crew is busy', 'One batch at a time at each site.'); return; }
    if (S.cash < cost) { toast('Not enough cash', `Wages for ${n} logs are ${usd(cost)}.`); return; }
    S.cash -= cost; J().stats.spent += cost;
    J().tasks.push({ id: 't' + now(), kind: 'cut', site: id, qty: n, cost, start: now(), end: now() + n * s.cut.secs * 1000 });
    save(); toast(`Cutting ${n} logs`, `${s.name} · ${usd(cost)} in wages · ${clock(n * s.cut.secs)}`); events.emit('job', 'cut'); refresh();
  }
  function move(L) {
    const n = Math.min(J().stock[L.from], L.cap);
    if (!n) { toast('Nothing to move', `No timber waiting at ${SITES[L.from].name}.`); return; }
    if (S.cash < L.cost) { toast('Not enough cash', `This ${L.mode === 'ship' ? 'voyage' : 'trip'} costs ${usd(L.cost)}.`); return; }
    S.cash -= L.cost; J().stats.spent += L.cost; J().stock[L.from] -= n; setPile(L.from);
    const t = { id: 't' + now(), kind: 'move', from: L.from, to: L.to, mode: L.mode, qty: n, cost: L.cost, start: now(), end: now() + L.secs * 1000 };
    J().tasks.push(t); animate(t);
    save(); toast(`${L.mode === 'ship' ? 'Shipping' : 'Trucking'} ${n} logs`, `${SITES[L.from].tag.toLowerCase()} → ${SITES[L.to].name} · ${clock(L.secs)}`); events.emit('job', 'move'); refresh();
  }
  function sell(id) {
    const n = J().stock[id]; if (!n) return;
    const v = saleValue(id, n); J().stock[id] = 0; J().price[id] = Math.max(0.5, J().price[id] - 0.0025 * n);
    S.cash += v; J().stats.sold += n; J().stats.earned += v; gain(Math.round(n / 2)); setPile(id);
    save(); toast(`Sold ${n} logs for ${usd(v)}`, SITES[id].name, 'good'); events.emit('job', 'sell'); refresh();
  }
  function animate(t) { // trucks and ships are just for show: the timer decides when the timber arrives
    const frac = (now() - t.start) / (t.end - t.start), secs = (t.end - now()) / 1000 / Math.max(0.01, 1 - frac);
    if (frac >= 1) return;
    if (t.mode === 'truck') World.convoy(`${t.from}-${t.to}`, secs, frac); else World.voyage(t.from, t.to, secs, frac);
  }
  function setPile(id) { World.setPile(id, J().stock[id] + J().tasks.filter(t => t.kind === 'cut' && t.site === id).reduce((a, t) => a + Math.floor(t.qty * Math.min(1, (now() - t.start) / (t.end - t.start))), 0)); }
  function resumeJobs() { // after a reload: running trips carry on from where they were; time away counts
    const mins = (now() - (J().at || now())) / 60000; for (const k in J().price) J().price[k] = Math.min(1, J().price[k] + 0.006 * mins); J().at = now();
    for (const t of J().tasks) if (t.kind === 'move') animate(t);
    for (const id of ['mill', 'quay', 'site']) setPile(id);
  }
  function jobsTick() {
    const done = J().tasks.filter(t => t.end <= now());
    for (const t of done) {
      J().tasks.splice(J().tasks.indexOf(t), 1);
      if (t.kind === 'cut') { J().stock[t.site] += t.qty; J().stats.cut += t.qty; gain(8); toast(`${t.qty} logs ready`, `at ${SITES[t.site].name}. Move them or sell them.`, 'good'); }
      else { J().stock[t.to] += t.qty; J().stats.moved += t.qty; gain(10); toast(`${t.qty} logs arrived`, `at ${SITES[t.to].name}.`, 'good'); setPile(t.to); }
    }
    const mins = (now() - J().at) / 60000; J().at = now(); for (const k in J().price) J().price[k] = Math.min(1, J().price[k] + 0.006 * mins);
    for (const t of J().tasks) if (t.kind === 'cut') setPile(t.site);
    if (done.length) { events.emit('job', 'done'); refresh(); }
    else if (panelName === 'jobs') document.querySelectorAll('[data-tk]').forEach(el => { const t = J().tasks.find(x => x.id === el.dataset.tk); if (!t) return; const f = Math.min(1, (now() - t.start) / (t.end - t.start)); el.querySelector('i').style.width = f * 100 + '%'; el.querySelector('span').textContent = clock((t.end - now()) / 1000); });
  }
  const taskText = t => t.kind === 'cut' ? `Cutting ${t.qty} logs · ${SITES[t.site].tag.toLowerCase()}` : `${t.mode === 'ship' ? 'Ship' : 'Truck'}: ${t.qty} logs → ${SITES[t.to].name}`;
  function tasksHTML() {
    if (!J().tasks.length) return '';
    return `<p class="sec">Under way</p>${J().tasks.map(t => { const f = Math.min(1, (now() - t.start) / (t.end - t.start)); return `<div class="task" data-tk="${t.id}"><span class="ic">${ic(t.kind === 'cut' ? 'tree' : t.mode === 'ship' ? 'ship' : 'truck')}</span><div><b>${taskText(t)}</b><div class="bar"><i style="width:${f * 100}%"></i></div></div><span class="tl">${clock((t.end - now()) / 1000)}</span></div>`; }).join('')}`;
  }
  const stockChip = id => `<span class="chip2 ${J().stock[id] ? 'has' : ''}">${ic('log')}${J().stock[id]}</span>`;
  const JOBS = {
    producer: () => `<p class="note">Hire a crew to cut logs. Wages are paid up front; the logs pile up at the site when the batch is done.</p>
      <div class="seg qty">${[20, 40, 80].map(n => `<button data-q="${n}" class="${n === qty ? 'on' : ''}">${n} logs</button>`).join('')}</div>
      ${['mill', 'pine'].map(id => { const s = SITES[id], ok = canCut(id), busyHere = J().tasks.some(t => t.kind === 'cut' && t.site === id), cost = qty * s.cut.wage; return `<div class="jcard"><div class="ph" data-site="${id}"></div><div class="jt"><b>${s.name}</b><small>${isleName(s.isle)} · wages ${usd(s.cut.wage)}/log · ${s.cut.secs}s a log</small>
        <div class="kv"><span>In the yard ${stockChip(id)}</span><span>Batch <b>${usd(cost)}</b> · ${clock(qty * s.cut.secs)}</span></div>
        ${ok ? '' : '<p class="note lock">Travel to Pine Isle once to hire the crew there.</p>'}
        <div class="acts"><button class="btn" data-visit="${id}">${ic('pin')}VISIT</button><button class="btn go" data-cut="${id}" ${!ok || busyHere || S.cash < cost ? 'disabled' : ''}>${busyHere ? 'CUTTING…' : S.cash < cost ? 'NEED ' + usd(cost - S.cash) : 'CUT ' + qty}</button></div></div></div>`; }).join('')}`,
    shipper: () => `<p class="note">Trucks run on the roads, ships between islands. You pay per trip; each trip takes as much as is waiting, up to its capacity.</p>
      ${LINKS.map((L, i) => { const n = Math.min(J().stock[L.from], L.cap), there = SITES[L.to].isle; return `<div class="row route"><span class="ic ${L.mode}">${ic(L.mode)}</span><div><b>${SITES[L.from].tag.toLowerCase().replace(/^./, c => c.toUpperCase())} → ${SITES[L.to].name}</b><small>${L.mode === 'ship' ? 'Ship' : 'Truck'} · up to ${L.cap} logs · ${usd(L.cost)} · ${clock(L.secs)}${there !== 'main' ? ' · ' + isleName(there) : ''}</small><small>Waiting: ${stockChip(L.from)}</small></div><button class="btn go" data-move="${i}" ${!n || S.cash < L.cost ? 'disabled' : ''}>SEND ${n || ''}</button></div>`; }).join('')}`,
    seller: () => `<p class="note">Builders buy timber at their own price. Selling a lot at once lowers it a little; it recovers over the next minutes.</p>
      ${['quay', 'site', 'coral'].map(id => { const s = SITES[id], n = J().stock[id], p = J().price[id]; return `<div class="row"><span class="ic">${ic(id === 'quay' ? 'ship' : 'crane')}</span><div><b>${s.name}</b><small>${isleName(s.isle)} · pays <b class="${p < 0.97 ? 'dn' : 'up'}">$${priceAt(id).toFixed(2)}</b> a log${p < 0.995 ? ` (${Math.round(p * 100)}%)` : ''}</small><small>Here: ${stockChip(id)}${n ? ` · worth ${usd(saleValue(id, n))}` : ''}</small></div><button class="btn go" data-sell="${id}" ${n ? '' : 'disabled'}>SELL</button></div>`; }).join('')}`,
    owner: () => { const own = Object.keys(S.owned).map(byId).filter(Boolean), wk = own.reduce((a, b) => a + rentOf(b), 0); return `<p class="note">Buy buildings and they pay rent every night. Your own island comes with plots to build on.</p>
      <div class="stats"><div>Owned<b>${own.length}</b></div><div>Rent in<b>${usd(wk)}/wk</b></div><div>Gull Rock<b>${S.gull ? 'Yours' : usd(GULL)}</b></div></div>
      ${own.length ? `<div class="grid2">${own.map(cardHTML).join('')}</div>` : ''}<div class="acts"><button class="btn" id="oFind">${ic('key')}FIND PROPERTY</button><button class="btn" id="oGull">${ic('island')}GULL ROCK</button></div>`; },
  };
  function bestTab() { const st = J().stock; if (st.quay || st.site || st.coral) return st.mill || st.pine ? 'shipper' : 'seller'; if (st.mill || st.pine) return 'shipper'; return 'producer'; }

  // ---------- your own island ----------
  const GULL = 40000, PLOT = { home: ['Cottage', 6000], villa: ['Villa', 14000], warehouse: ['Boat shed', 5000] };
  function rebuildPlots() { if (!S.gull) return; S.gull.plots.forEach((t, i) => { if (t && !byId(`gull-plot${i}`)) World.buildPlot('gull', i, t); }); }

  const PANELS = {
    home: () => { const h = World.home, opp = near(h.x, h.z, 4, forSale); return { title: 'Your home', sub: '14 Shell Street · Old Town',
      html: `<div class="ph hero" data-ph="home"></div><div class="row"><span class="ic">${ic('home')}</span><div><b>${esc(h.name)}</b><small>A top-floor studio in a three-storey walk-up</small></div></div>
        <div class="stats"><div>Rent<b>${usd(RENT)}/wk</b></div><div>Beach<b>2 min</b></div><div>Centre<b>5 min</b></div></div>
        <p class="sec">Nearby opportunities</p><div class="grid2">${opp.map(cardHTML).join('')}</div>
        <p class="sec">Moving up</p><div class="row"><span class="ic">${ic('jobs')}</span><div><b>Earn with a timber run</b><small>Cut logs, ship them, sell them. Then buy a house or a shop: it pays rent every night.</small></div><button class="btn" id="hJobs">JOBS</button></div>`,
      bind: r => { picture(r.querySelector('[data-ph="home"]'), h); bindCards(r); $('hJobs').onclick = () => open('jobs'); } }; },
    property: () => { const here = World.active, ref = here === 'main' ? World.home : World.ISLES.find(i => i.id === here); const list = World.buildings.filter(b => World.isleOf(b) === here && forSale(b) && (filter === 'all' || GROUP[filter].includes(b.type))).map(b => [b, Math.hypot(b.x - ref.x, b.z - ref.z)]).sort((a, c) => a[1] - c[1]).slice(0, 12).map(a => a[0]);
      return { title: 'Property', sub: `For sale on ${isleName(here)}`,
      html: `<div class="seg">${[['all', 'All'], ['homes', 'Homes'], ['shops', 'Shops'], ['offices', 'Offices'], ['industry', 'Industry']].map(([k, n]) => `<button data-f="${k}" class="${k === filter ? 'on' : ''}">${n}</button>`).join('')}</div>
        <p class="sec">${here === 'main' ? 'Closest to your home' : 'On this island'}</p>${list.length ? `<div class="grid2">${list.map(cardHTML).join('')}</div>` : '<p class="note">Nothing of this kind for sale here.</p>'}`,
      bind: r => { r.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; open('property'); }); bindCards(r); } }; },
    card: id => { const b = byId(id), lk = lockOf(b), own = S.owned[b.id], p = priceOf(b); return { title: KIND[b.type] || 'Building', sub: `${b.district} · ${isleName(World.isleOf(b))}`,
      html: `<div class="ph hero" data-ph="${b.id}"></div><div><b class="big">${esc(b.name)}</b></div>
        ${RATE[b.type] ? `<div class="stats"><div>Price<b>${usd(p)}</b></div><div>Rent<b>${usd(rentOf(b))}/wk</b></div><div>Floors<b>${b.floors || (b.type === 'home' ? 2 : 1)}</b></div></div>` : ''}
        ${lk ? `<p class="note lock">${esc(lk)}</p>` : ''}
        <div class="acts"><button class="btn" id="cVisit">${ic('pin')}VISIT</button>${own || !RATE[b.type] ? `<button class="btn" disabled>${own ? 'YOURS' : 'NOT FOR SALE'}</button>` : `<button class="btn go" id="cBuy" ${lk || S.cash < p ? 'disabled' : ''}>${!lk && S.cash < p ? 'NEED ' + usd(p - S.cash) : 'BUY ' + usd(p)}</button>`}</div>
        <p class="note">Visit flies the camera there and marks it. It never buys anything.</p>`,
      bind: r => { picture(r.querySelector('[data-ph]'), b); World.mark(b); $('cVisit').onclick = () => visit(b);
        if ($('cBuy')) $('cBuy').onclick = () => { if (S.cash < p) { toast('Not enough cash', `You need ${usd(p)}.`); return; } if (S.owned[b.id]) return; S.cash -= p; S.owned[b.id] = { at: S.t }; gain(40); save(); toast('Bought ' + b.name, `It pays ${usd(rentOf(b))} a week.`, 'good'); events.emit('bought', b.id); open('card', id, false); }; } }; },
    jobs: () => { const tab = jobTab || bestTab(), st = J().stats; return { title: 'Jobs', sub: `Timber: cut → ship → sell · profit ${usd(st.earned - st.spent)}`,
      html: `${tasksHTML()}<div class="seg tabs">${[['producer', 'Producer', 'tree'], ['shipper', 'Shipper', 'ship'], ['seller', 'Seller', 'shop'], ['owner', 'Owner', 'key']].map(([k, n, i]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${ic(i)}${n}</button>`).join('')}</div>${JOBS[tab]()}
        <div class="ledger"><span>Cut <b>${st.cut}</b></span><span>Moved <b>${st.moved}</b></span><span>Sold <b>${st.sold}</b></span><span>Earned <b>${usd(st.earned)}</b></span></div>`,
      bind: r => {
        r.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { jobTab = b.dataset.t; open('jobs'); });
        r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { qty = +b.dataset.q; open('jobs'); });
        r.querySelectorAll('[data-cut]').forEach(b => b.onclick = () => { jobTab = 'producer'; cut(b.dataset.cut, qty); });
        r.querySelectorAll('[data-move]').forEach(b => b.onclick = () => { jobTab = 'shipper'; move(LINKS[+b.dataset.move]); });
        r.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { jobTab = 'seller'; sell(b.dataset.sell); });
        r.querySelectorAll('[data-visit]').forEach(b => b.onclick = () => { const id = b.dataset.visit, s = World.places[id]; if (s) visit(s.b); else travel(SITES[id].isle); });
        r.querySelectorAll('[data-site]').forEach(el => { const s = World.places[el.dataset.site]; if (s) picture(el, s.b); else el.innerHTML = `<div class="wait" style="animation:none"><svg viewBox="0 0 64 70" fill="#3c5a7a">${SIL.mill}</svg></div><span class="tag2">Not visited yet</span>`; });
        if ($('oFind')) { $('oFind').onclick = () => open('property', null, true); $('oGull').onclick = () => open('island', null, true); bindCards(r); }
      } }; },
    bank: () => { const st = J().stats; return { title: 'Bank', sub: 'Your money at a glance', html: `<div class="stats"><div>Cash<b>${usd(S.cash)}</b></div><div>Rent<b>${usd(RENT)}/wk</b></div><div>Owned<b>${Object.keys(S.owned).length}</b></div></div>
      <div class="stats"><div>Timber earned<b>${usd(st.earned)}</b></div><div>Costs<b>${usd(st.spent)}</b></div><div>Profit<b>${usd(st.earned - st.spent)}</b></div></div><p class="note">Loans, savings and your credit score move here in the full build.</p>` }; },
    office: () => { const t = byId('tower'); return { title: 'Office', sub: 'Run a business from Capital Centre', html: `<p class="note ${S.lvl < 5 ? 'lock' : ''}">${S.lvl < 5 ? 'Your own office opens at level 5: a floor in Capital Tower or an office block in Capital Centre.' : 'Pick an office building in Capital Centre.'}</p><div class="grid2">${cardHTML(t)}</div>`, bind: bindCards }; },
    island: () => { const here = World.active; return { title: 'Islands', sub: `You're on ${isleName(here)}`, html: `<p class="sec">Travel</p>
        ${[{ id: 'main', name: 'Capital Island', blurb: 'The capital: offices, Old Town, the harbour, farms and beaches.' }, ...World.ISLES].map(I => `<div class="row isle ${I.id === here ? 'here' : ''}"><span class="ic" style="background:${{ main: '#4c8dff', pine: '#2f8f5b', coral: '#ff8fb1', gull: '#ff9f43' }[I.id]}">${ic(I.id === 'pine' ? 'tree' : I.id === 'gull' ? 'key' : 'island')}</span><div><b>${I.name}${I.id === 'gull' && S.gull ? ' · yours' : ''}</b><small>${I.blurb}</small></div>${I.id === here ? '<span class="here">HERE</span>' : `<button class="btn" data-go="${I.id}">TRAVEL</button>`}</div>`).join('')}
        ${here === 'main' ? `<p class="sec">Districts of Capital Island</p><div class="dgrid">${World.ZONES.map(Z => `<button class="dist" data-z="${Z.id}">${Z.name}</button>`).join('')}</div>` : ''}
        ${here === 'gull' ? (S.gull ? `<p class="sec">Your plots</p><p class="note">Only you can build on Gull Rock. Visitors can look around and see what you've built.</p>${S.gull.plots.map((t, i) => `<div class="row"><span class="ic">${ic('key')}</span><div><b>Plot ${i + 1}</b><small>${t ? PLOT[t][0] + ' built' : 'Empty: choose what to build'}</small></div>${t ? '' : `<div class="mini">${Object.entries(PLOT).map(([k, [n, c]]) => `<button class="btn" data-plot="${i}:${k}" ${S.cash < c ? 'disabled' : ''}>${n} ${usd(c)}</button>`).join('')}</div>`}</div>`).join('')}`
          : `<p class="sec">For sale</p><div class="row"><span class="ic">${ic('key')}</span><div><b>Buy Gull Rock</b><small>Four plots to build on, a jetty, and it's yours alone.</small></div><button class="btn go" id="buyGull" ${S.cash < GULL ? 'disabled' : ''}>${S.cash < GULL ? 'NEED ' + usd(GULL - S.cash) : 'BUY ' + usd(GULL)}</button></div>`) : ''}`,
      bind: r => {
        r.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { if (innerWidth < 760) close(); travel(b.dataset.go); });
        r.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { const Z = World.ZONES.find(z => z.id === b.dataset.z); World.mark(null); World.flyTo(World.view((Z.x0 + Z.x1) / 2, (Z.z0 + Z.z1) / 2, 420, 0.8, 0.5), 1.5); if (innerWidth < 760) close(); });
        if ($('buyGull')) $('buyGull').onclick = () => { if (S.cash < GULL || S.gull) return; S.cash -= GULL; S.gull = { plots: [null, null, null, null] }; gain(60); save(); toast('Gull Rock is yours!', 'Pick what to build on each plot.', 'good'); refresh(); };
        r.querySelectorAll('[data-plot]').forEach(b => b.onclick = () => { const [i, k] = b.dataset.plot.split(':'), c = PLOT[k][1]; if (S.cash < c || S.gull.plots[i]) return; S.cash -= c; S.gull.plots[i] = k; const nb = World.buildPlot('gull', +i, k); if (nb) { S.owned[nb.id] = { at: S.t }; World.flyTo(World.viewOf(nb), 1.2); World.mark(nb); } gain(20); save(); toast(`${PLOT[k][0]} built`, `Plot ${+i + 1} on Gull Rock`, 'good'); refresh(); });
      } }; },
    menu: () => ({ title: 'Settings', sub: 'Preview options', html: `<div class="row"><div><b>Replay Ollie's tour</b><small>Show the guide again</small></div><button class="btn" id="mG">REPLAY</button></div>
        <div class="row"><div><b>Graphics</b><small>Takes effect after a reload</small></div><div class="seg">${['low', 'medium', 'high'].map(k => `<button data-q="${k}" class="${k === quality ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></div>
        <div class="row"><div><b>Frame rate</b><small>Show it in the corner</small></div><button class="btn" id="mF">${$('fps').hidden ? 'SHOW' : 'HIDE'}</button></div>
        <div class="row"><div><b>Reset the preview</b><small>Back to the start (your real game is never touched)</small></div><button class="btn" id="mR">RESET</button></div>
        <p class="note">© 2026 Pocket Rocket Studio</p>`,
      bind: r => { $('mG').onclick = () => { close(); S.guide = 0; guide(0); }; $('mF').onclick = () => { $('fps').hidden = !$('fps').hidden; open('menu'); };
        r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { quality = b.dataset.q; try { localStorage.setItem('cs-island-q', quality); } catch (e) { /* fine */ } open('menu'); toast('Graphics: ' + quality, 'Reload to apply'); });
        $('mR').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) { /* fine */ } location.reload(); }; } }),
  };
  $('menu').onclick = () => panelName === 'menu' ? close() : open('menu');
  $('cash').onclick = () => panelName === 'bank' ? close() : open('bank');
  $('who').onclick = () => toast(`Level ${S.lvl}`, `${60 * S.lvl - S.xp} XP to level ${S.lvl + 1}. Jobs and property earn XP.`);

  // tap a building to see its card
  let down = null;
  $('c').addEventListener('pointerdown', e => { down = [e.clientX, e.clientY, performance.now()]; });
  $('c').addEventListener('pointerup', e => {
    if (!down || $('hud').hidden || World.flying) return;
    const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]), quick = performance.now() - down[2] < 450; down = null;
    if (moved > 8 || !quick) return;
    const b = World.pickAt(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (b) open('card', b.id); else if (!P.hidden && innerWidth >= 760) close();
  });

  // ---------- the objective: one short line, collapsible; it walks you through the first timber run ----------
  function drawObj() {
    let t, s; const st = J().stock, run = J().tasks[0];
    if (gi >= 0) { t = GUIDE[gi].obj; s = `Step ${gi + 1} of ${GUIDE.length}`; }
    else if (run) { t = taskText(run); s = `${clock((run.end - now()) / 1000)} left${J().tasks.length > 1 ? ` · ${J().tasks.length - 1} more under way` : ''}`; }
    else if (!J().stats.cut) { t = 'Start a timber run'; s = 'Jobs → Producer → cut 40 logs'; }
    else if (st.mill || st.pine) { t = 'Move your timber'; s = 'Jobs → Shipper: truck it or ship it'; }
    else if (st.quay || st.site || st.coral) { t = 'Sell your timber'; s = 'Jobs → Seller'; }
    else if (!Object.keys(S.owned).length) { t = 'Buy your first building'; s = 'Property → pick one you can afford'; }
    else if (!J().stats.moved || !S.visited.coral) { t = 'Try Coral Key prices'; s = 'Ship timber there: builders pay $22 a log'; }
    else { t = 'Grow your fortune'; s = `${Object.keys(S.owned).length} building${Object.keys(S.owned).length > 1 ? 's' : ''} · ${usd(J().stats.earned - J().stats.spent)} timber profit`; }
    $('objT').textContent = t; $('objS').textContent = s;
  }
  $('obj').onclick = () => { if ($('obj').classList.contains('min')) $('obj').classList.remove('min'); else if (gi < 0 && !J().tasks.length && panelName !== 'jobs') open('jobs'); else $('obj').classList.add('min'); };

  // ---------- Ollie's tour: short, never covering what you tap, time paused while he explains ----------
  const GUIDE = [
    { obj: 'Meet Ollie', say: () => `Hi, I'm <b>Ollie</b>! Welcome to <b>Capital Island</b>. This is your first home: a small flat at <b>14 Shell Street</b> in Old Town.`, next: 'Hi Ollie!' },
    { obj: 'Your money', at: '#cash', say: () => `Your <b>cash</b>, and the <b>rent</b> with how long until it's due. Keep enough to pay it.`, next: 'Next' },
    { obj: 'Open Property', at: '[data-p="property"]', say: () => `Tap <b>Property</b> to see what's for sale near you.`, wait: t => t === 'panel:property' },
    { obj: 'Pick a building', at: '#pbody .pc', say: () => `Tap a building to see its card and picture.`, wait: t => t === 'panel:card' },
    { obj: 'Visit it', at: '#cVisit', say: () => `Press <b>Visit</b> to fly there. Visiting never buys anything.`, wait: t => t.startsWith('visited') },
    { obj: 'Earn some money', at: '[data-p="jobs"]', say: () => `Now let's earn. Open <b>Jobs</b>: cut timber at the sawmill, ship it, and sell it to builders.`, wait: t => t === 'panel:jobs' },
    { obj: 'Your first goal', say: () => `Cut a batch, move it to a buyer, sell it. Coral Key pays the most. Then <b>buy your first building</b>: it pays rent every night.`, next: 'Got it' },
  ];
  let gi = -1, glowEl = null;
  function guide(i) {
    gi = i; S.guide = i; save();
    if (glowEl) { glowEl.classList.remove('glow'); glowEl = null; }
    const g = GUIDE[i];
    if (!g) { gi = -1; $('guide').hidden = true; paused = false; S.guide = GUIDE.length; save(); drawObj(); return; }
    $('gStep').textContent = `OLLIE · ${i + 1} OF ${GUIDE.length}`; $('gText').innerHTML = g.say();
    $('gNext').hidden = !!g.wait; $('gNext').textContent = g.next || 'Next';
    $('guide').hidden = false; paused = !g.wait; // time stands still while Ollie talks, runs while you act
    drawObj(); setTimeout(placeGuide, 30);
  }
  function placeGuide() {
    if (gi < 0) return;
    const g = GUIDE[gi], el = g.at ? document.querySelector(g.at) : null, G = $('guide');
    if (glowEl !== el) { if (glowEl) glowEl.classList.remove('glow'); glowEl = el; if (el) el.classList.add('glow'); }
    // keep the bubble away from what it points at and from an open bottom sheet
    const r = el ? el.getBoundingClientRect() : null, sheet = !P.hidden && innerWidth < 760;
    G.classList.toggle('top', !!(sheet || (r && r.top > innerHeight * 0.55)));
  }
  setInterval(placeGuide, 400);
  $('gNext').onclick = () => guide(gi + 1);
  $('gSkip').onclick = () => guide(GUIDE.length);
  events.on((t, d) => { if (gi < 0) return; const g = GUIDE[gi]; const key = t + ':' + (d || ''); if (g.wait && g.wait(key)) guide(gi + 1); else placeGuide(); });

  // the review build can jump straight in: ?play skips the cover and the name (for screenshots and tests)
  if (q.has('play')) { S.name = S.name || 'Reviewer'; save(); drawJoin('load'); steps(1); busy = true; start(); }
  window.App = { S, open, close, visit, travel, guide, priceOf, lockOf, cut, move, sell, LINKS, jobsTick };
})();
