// Capital Island review sample: the cover, joining, the HUD, one panel at a time, property cards with pictures,
// Visit (fast travel), and Ollie the guide. Kept apart from the live game: its own save key, nothing sent anywhere.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ic = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
  const KEY = 'cs-island-preview-v1', COLORS = ['#ffd21f', '#4c8dff', '#f04e5e', '#2fbf6a', '#a970ff', '#ff9f43', '#2fd0c0', '#ff8fb1'];
  const fresh = () => ({ name: '', color: COLORS[1], cash: 2340, lvl: 1, xp: 0, owned: {}, t: 9 * 60, rentDue: 3 * 1440, guide: 0, goal: null });
  let S; try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* the preview keeps going */ } };
  const RENT = 650;
  const q = new URLSearchParams(location.search);

  // ---------- toasts: below the top bar, never over the buttons ----------
  let toastT = 0;
  function toast(t, b = '') { $('toastT').textContent = t; $('toastB').textContent = b; $('toast').classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.remove('on'), 2400); }

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

  // ---------- joining: the name screen you liked, with progress, a way back from errors, and one submit at a time ----------
  const join = $('join');
  let busy = false, quality = (() => { try { return localStorage.getItem('cs-island-q') || 'high'; } catch (e) { return 'high'; } })();
  function webgl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function drawJoin(state = 'form', why = '') {
    join.hidden = false;
    if (state === 'form') {
      join.innerHTML = `<form class="card" id="jf"><h2>What should we call you?</h2><p>Everyone on Capital Island sees this name.</p>
        <label for="jn">Your name</label><input id="jn" maxlength="20" autocomplete="nickname" placeholder="Your name" value="${esc(S.name)}" required>
        <div class="swatch">${COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === S.color ? 'on' : ''}" aria-label="Colour"></button>`).join('')}</div>
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
    loop(performance.now());
    World.flyTo(World.homeView(), 2.2, () => { $('hud').hidden = false; draw(); if (S.guide < GUIDE.length) guide(S.guide); else drawObj(); });
  }
  $('play').onclick = () => { if (S.name) { drawJoin('load'); steps(1); busy = true; start(); } else drawJoin('form'); };

  // ---------- the frame loop and the clock (time stands still while Ollie talks) ----------
  let last = 0, paused = false, acc = 0, frames = 0, fpsT = 0;
  function loop(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    if (!paused && !$('hud').hidden) { acc += dt; while (acc >= 1) { acc -= 1; S.t++; if (S.t >= S.rentDue) { S.rentDue += 7 * 1440; S.cash -= RENT; toast('Rent paid', `${usd(RENT)} for 14 Shell Street`); } } }
    World.step(dt);
    labels();
    frames++; fpsT += dt; if (fpsT > 1) { $('fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
    requestAnimationFrame(loop);
  }
  setInterval(() => { if (!$('hud').hidden) { draw(); save(); } }, 1000);
  function draw() {
    $('av').textContent = (S.name || '?')[0].toUpperCase(); $('av').style.background = S.color; $('nm').textContent = S.name || 'Player';
    $('lvN').textContent = 'LV ' + S.lvl; $('lvF').style.width = Math.min(100, S.xp / (60 * S.lvl) * 100) + '%';
    $('cashV').textContent = usd(S.cash);
    const left = S.rentDue - S.t, d = Math.floor(left / 1440), h = Math.floor(left % 1440 / 60);
    $('rentV').textContent = `Rent ${usd(RENT)} · ${d ? d + 'd ' : ''}${h}h`; $('rentV').classList.toggle('late', left < 1440 && S.cash < RENT);
    const section = stack.length ? stack[0][0] : panelName; // a card opened from Property keeps Property lit
    document.querySelectorAll('#nav button').forEach(b => { b.classList.toggle('on', b.dataset.p === section); b.classList.toggle('locked', b.dataset.p === 'office' && S.lvl < 5); });
  }
  const gain = xp => { S.xp += xp; while (S.xp >= 60 * S.lvl) { S.xp -= 60 * S.lvl; S.lvl++; toast(`Level ${S.lvl}!`, 'New property opens up as you level up.'); } };

  // ---------- labels over the island: your home always, district names from far away ----------
  const LAB = $('labels'), labs = [];
  function lab(text, cls, x, y, z, min, max) { const el = document.createElement('div'); el.className = 'lab ' + cls; el.textContent = text; LAB.appendChild(el); labs.push({ el, v: new THREE.Vector3(x, y, z), min, max }); }
  let labelled = false;
  function labels() {
    if (!World.camera) return;
    if (!labelled) {
      labelled = true;
      lab('HOME', 'home', World.home.x, 30, World.home.z, 0, 1e9);
      const D = { centre: [-20, -90], oldtown: [360, -40], harbour: [40, 220], farms: [-470, 140], mill: [0, -330], beach: [650, 80] };
      for (const Z of World.ZONES) if (D[Z.id]) lab(Z.name.toUpperCase(), 'dist', D[Z.id][0], 40, D[Z.id][1], 700, 1e9);
      lab('LIGHTHOUSE POINT', 'dist', 566, 30, 600, 700, 1e9);
    }
    const cam = World.camera, dist = World.current().dist, v = new THREE.Vector3(), hideAll = !$('panel').hidden && innerWidth < 760;
    for (const l of labs) {
      v.copy(l.v).project(cam);
      const on = !hideAll && dist >= l.min && dist <= l.max && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      l.el.style.display = on ? '' : 'none';
      if (on) l.el.style.left = (v.x + 1) / 2 * innerWidth + 'px', l.el.style.top = (1 - v.y) / 2 * innerHeight + 'px';
    }
  }

  // ---------- property: prices, what you can buy, pictures ----------
  const KIND = { home: 'Home', apart: 'Apartments', starter: 'Walk-up', shop: 'Shop', office: 'Offices', tower: 'Landmark tower', warehouse: 'Warehouse', factory: 'Factory', barn: 'Farm', mill: 'Timber mill', kiosk: 'Beach kiosk' };
  const RATE = { home: 95, apart: 85, shop: 120, office: 150, warehouse: 45, factory: 40, barn: 30, mill: 35, kiosk: 160 }; // a small house is about a week's rent: a first goal you can reach
  const priceOf = b => Math.round(b.w * b.d * Math.max(1, b.floors || (b.type === 'home' ? 2 : 1)) * (RATE[b.type] || 800) / 100) * 10;
  const rentOf = b => Math.max(10, Math.round(priceOf(b) * 0.05 / 10) * 10);
  function lockOf(b) {
    if (b.owner === 'you') return 'Your home: the landlord isn\'t selling.';
    if (b.owner === 'city') return 'Capital Tower belongs to the island. Offices inside open at level 5.';
    if (b.type === 'office' && b.floors > 7 && S.lvl < 5) return 'Office towers open at level 5.';
    if ((b.type === 'factory' || b.type === 'mill') && S.lvl < 3) return 'Industry opens at level 3.';
    return '';
  }
  const SIL = { home: '<path d="M10 40 32 20l22 20v24H10z"/>', apart: '<path d="M14 14h36v50H14z"/>', shop: '<path d="M10 30h44v34H10zM8 24h48l-4 8H12z"/>', office: '<path d="M16 6h32v58H16z"/>', tower: '<path d="M20 10h24v54H20zM28 2h8v8h-8z"/>', warehouse: '<path d="M6 34q26-16 52 0v30H6z"/>', factory: '<path d="M6 64V34l12 8v-8l12 8v-8l12 8V20h6v44z"/>', barn: '<path d="M12 34 32 18l20 16v30H12z"/>', mill: '<path d="M8 36 32 20l24 16v28H8z"/>', kiosk: '<path d="M18 30h28v34H18zM12 24h40l-4 6H16z"/>', starter: '<path d="M14 14h36v50H14z"/>' };
  const placeholder = b => `<div class="wait"><svg viewBox="0 0 64 70" fill="#3c5a7a">${SIL[b.type] || SIL.home}</svg></div>`;
  // pictures: memory first, then the device's cache, then one render at a time between frames
  const VER = 'p1', mem = new Map(), queue = [];
  let db = null; const idb = () => db || (db = new Promise(r => { try { const o = indexedDB.open('cs-island-shots', 1); o.onupgradeneeded = () => o.result.createObjectStore('s'); o.onsuccess = () => r(o.result); o.onerror = () => r(null); } catch (e) { r(null); } }));
  const idbGet = async k => { const d = await idb(); if (!d) return null; return new Promise(r => { try { const t = d.transaction('s').objectStore('s').get(k); t.onsuccess = () => r(t.result || null); t.onerror = () => r(null); } catch (e) { r(null); } }); };
  const idbPut = async (k, v) => { const d = await idb(); if (d) try { d.transaction('s', 'readwrite').objectStore('s').put(v, k); } catch (e) { /* only a cache */ } };
  function picture(el, b) {
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
  let panelName = '', stack = [];
  const P = $('panel');
  function open(name, arg, push) {
    if (push && panelName) stack.push([panelName, curArg]); else if (!push) stack = [];
    panelName = name; curArg = arg;
    P.hidden = false; $('pBack').hidden = !stack.length;
    const r = PANELS[name](arg);
    $('pTitle').textContent = r.title; $('pbody').innerHTML = r.html; $('pbody').scrollTop = 0;
    if (r.bind) r.bind($('pbody'));
    draw(); events.emit('panel', name);
  }
  let curArg = null;
  function close() { P.hidden = true; panelName = ''; stack = []; World.mark(null); draw(); events.emit('panel', ''); }
  $('pX').onclick = close;
  $('pBack').onclick = () => { const [n, a] = stack.pop() || []; if (n) { panelName = ''; open(n, a, false); stack = stack; $('pBack').hidden = !stack.length; } };
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => {
    const p = b.dataset.p;
    if (panelName === p) { close(); return; }
    if (p === 'home') World.flyTo(World.homeView(), 1.3);
    if (p === 'island') World.flyTo(World.overview(), 1.6);
    open(p);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !P.hidden) { if (stack.length) $('pBack').click(); else close(); } });
  const events = { fns: [], on(f) { this.fns.push(f); }, emit(t, d) { for (const f of this.fns) f(t, d); } };

  // fast travel: the camera goes to the building and marks it; it never buys or changes anything
  function visit(b) { World.flyTo(World.viewOf(b), 1.4, () => events.emit('visited', b.id)); World.mark(b); if (innerWidth < 760) P.hidden = true; toast('Visiting ' + b.name, b.district); }

  const near = (x, z, n, f = () => true) => World.buildings.filter(f).map(b => [b, Math.hypot(b.x - x, b.z - z)]).sort((a, c) => a[1] - c[1]).slice(0, n).map(a => a[0]);
  const forSale = b => !S.owned[b.id] && b.owner !== 'you' && b.owner !== 'city' && b.type !== 'kiosk';
  function cardHTML(b) { const lk = lockOf(b), own = S.owned[b.id]; return `<button class="pc" data-b="${b.id}"><div class="ph" data-ph="${b.id}"></div><div class="tx"><b>${esc(b.name)}</b><small>${KIND[b.type]} · ${esc(b.district)}</small><em>${own ? 'Yours' : usd(priceOf(b))}</em></div></button>`.replace('<div class="tx">', (lk && !own ? '<span class="tag2 lock">LOCKED</span>' : own ? '<span class="tag2 yours">YOURS</span>' : '') + '<div class="tx">'); }
  function bindCards(root) {
    root.querySelectorAll('[data-ph]').forEach(el => picture(el, byId(el.dataset.ph)));
    root.querySelectorAll('[data-b]').forEach(el => el.onclick = () => open('card', el.dataset.b, true));
  }
  const byId = id => World.buildings.find(b => b.id === id);
  let filter = 'all';
  const PANELS = {
    home: () => { const h = World.home, opp = near(h.x, h.z, 4, forSale); return { title: 'Your home',
      html: `<div class="ph" data-ph="home"></div><div class="row"><span class="ic">${ic('home')}</span><div><b>${esc(h.name)}</b><small>A top-floor studio in a three-storey walk-up · Old Town</small></div></div>
        <div class="stats"><div>Rent<b>${usd(RENT)}/wk</b></div><div>Beach<b>2 min</b></div><div>Centre<b>5 min</b></div></div>
        <p class="sec">Nearby opportunities</p>${opp.map(cardHTML).join('').replace(/^/, '<div class="grid2">') + '</div>'}
        <p class="sec">Moving up</p><div class="row"><span class="ic">${ic('key')}</span><div><b>Buy your first building</b><small>A house or a shop pays rent every night. Bigger flats open at level 3, office towers at level 5.</small></div></div>`,
      bind: r => { picture(r.querySelector('[data-ph="home"]'), h); bindCards(r); } }; },
    property: () => { const h = World.home; const list = World.buildings.filter(b => forSale(b) && (filter === 'all' || (filter === 'homes' ? ['home', 'apart'].includes(b.type) : filter === 'shops' ? b.type === 'shop' : filter === 'offices' ? b.type === 'office' : ['warehouse', 'factory', 'barn', 'mill'].includes(b.type)))).map(b => [b, Math.hypot(b.x - h.x, b.z - h.z)]).sort((a, c) => a[1] - c[1]).slice(0, 12).map(a => a[0]);
      return { title: 'Property',
      html: `<div class="seg">${[['all', 'All'], ['homes', 'Homes'], ['shops', 'Shops'], ['offices', 'Offices'], ['industry', 'Industry']].map(([k, n]) => `<button data-f="${k}" class="${k === filter ? 'on' : ''}">${n}</button>`).join('')}</div>
        <p class="sec">For sale near your home</p><div class="grid2">${list.map(cardHTML).join('')}</div>`,
      bind: r => { r.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; open('property'); }); bindCards(r); } }; },
    card: id => { const b = byId(id), lk = lockOf(b), own = S.owned[b.id], p = priceOf(b); return { title: KIND[b.type],
      html: `<div class="ph" data-ph="${b.id}"></div><div><b style="font:400 22px 'Lilita One',sans-serif">${esc(b.name)}</b><p class="note">${esc(b.district)}</p></div>
        <div class="stats"><div>Price<b>${usd(p)}</b></div><div>Rent<b>${usd(rentOf(b))}/wk</b></div><div>Floors<b>${b.floors || (b.type === 'home' ? 2 : 1)}</b></div></div>
        ${lk ? `<p class="note lock">${esc(lk)}</p>` : ''}
        <div class="acts"><button class="btn" id="cVisit">${ic('pin')}VISIT</button>${own ? '<button class="btn" disabled>YOURS</button>' : `<button class="btn go" id="cBuy" ${lk || S.cash < p ? 'disabled' : ''}>${!lk && S.cash < p ? 'NEED ' + usd(p - S.cash) : 'BUY'}</button>`}</div>
        <p class="note">Visit flies the camera there and marks it. It never buys anything.</p>`,
      bind: r => { picture(r.querySelector('[data-ph]'), b); World.mark(b); $('cVisit').onclick = () => visit(b);
        if ($('cBuy')) $('cBuy').onclick = () => { if (S.cash < p) { toast('Not enough cash', `You need ${usd(p)}.`); return; } if (S.owned[b.id]) return; S.cash -= p; S.owned[b.id] = { at: S.t }; gain(40); save(); toast('Bought ' + b.name, `It pays ${usd(rentOf(b))} a week.`); events.emit('bought', b.id); open('card', id, false); }; } }; },
    jobs: () => ({ title: 'Jobs', html: `<p class="note">Four ways to make money on Capital Island. In this preview they're described; the next build makes the first one fully playable: <b>timber</b>, cut at Pine Ridge Mill, shipped from Harbourside and sold to builders.</p>
        ${[['shop', 'Seller', 'Buy goods, keep stock, fill orders, earn the margin.'], ['factory', 'Producer', 'Run farms, the mill or factories: turn resources into products.'], ['ship', 'Shipper', 'Move cargo between islands: capacity, travel time and delivery costs.'], ['key', 'Property owner', 'Buy and improve buildings, collect rent every night.']].map(([i, t, d]) => `<div class="row"><span class="ic">${ic(i)}</span><div><b>${t}</b><small>${d}</small></div></div>`).join('')}
        <p class="sec">First loop, next build</p><div class="row"><span class="ic">${ic('tree')}</span><div><b>Timber run</b><small>Cut 40 logs at Pine Ridge Mill → truck to the quay → ship → sell to Capital Centre builders. Every step shows quantity, cost, delivery time and profit.</small></div><button class="btn" id="jMill">VISIT</button></div>`,
      bind: () => { $('jMill').onclick = () => { const m = World.buildings.find(b => b.type === 'mill'); if (m) visit(m); }; } }),
    bank: () => ({ title: 'Bank', html: `<div class="stats"><div>Cash<b>${usd(S.cash)}</b></div><div>Rent<b>${usd(RENT)}/wk</b></div><div>Owned<b>${Object.keys(S.owned).length}</b></div></div><p class="note">Loans, savings and your credit score move here in the full build.</p>` }),
    office: () => { const t = World.buildings.find(b => b.id === 'tower'); return { title: 'Office', html: `<p class="note ${S.lvl < 5 ? 'lock' : ''}">${S.lvl < 5 ? 'Your own office opens at level 5: a floor in Capital Tower or an office block in Capital Centre.' : 'Pick an office building in Capital Centre.'}</p><div class="grid2">${cardHTML(t)}</div>`, bind: bindCards }; },
    island: () => ({ title: 'Capital Island', html: `<p class="note">The whole island, district by district. Tap one to fly there.</p>
        ${World.ZONES.map(Z => `<div class="row"><span class="ic">${ic(Z.id === 'harbour' ? 'ship' : Z.id === 'farms' || Z.id === 'mill' ? 'tree' : Z.id === 'oldtown' ? 'home' : Z.id === 'beach' ? 'island' : 'office')}</span><div><b>${Z.name}</b><small>${({ centre: 'Offices, the bank and Capital Tower', oldtown: 'Houses, walk-ups and corner shops. Your home is here', harbour: 'Quay, cranes, warehouses and factories', farms: 'Fields and barns', mill: 'Forest and the timber mill', beach: 'Sand, kiosks and the bridge to the lighthouse' })[Z.id]}</small></div><button class="btn" data-z="${Z.id}">GO</button></div>`).join('')}
        <p class="sec">Other islands</p><div class="row"><span class="ic">${ic('island')}</span><div><b>Your own island</b><small>Buy a small island later and develop it. Each island loads only when you visit.</small></div></div>`,
      bind: r => r.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { const Z = World.ZONES.find(z => z.id === b.dataset.z); World.mark(null); World.flyTo(World.view((Z.x0 + Z.x1) / 2, (Z.z0 + Z.z1) / 2, 420, 0.8, 0.5), 1.5); if (innerWidth < 760) close(); }) }),
    menu: () => ({ title: 'Menu', html: `<div class="row"><div><b>Replay Ollie's tour</b><small>Show the guide again</small></div><button class="btn" id="mG">REPLAY</button></div>
        <div class="row"><div><b>Graphics</b><small>Takes effect after a reload</small></div><div class="seg">${['low', 'medium', 'high'].map(k => `<button data-q="${k}" class="${k === quality ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></div>
        <div class="row"><div><b>Frame rate</b><small>Show it in the corner</small></div><button class="btn" id="mF">${$('fps').hidden ? 'SHOW' : 'HIDE'}</button></div>
        <div class="row"><div><b>Reset the preview</b><small>Back to the start (your real game is never touched)</small></div><button class="btn" id="mR">RESET</button></div>`,
      bind: r => { $('mG').onclick = () => { close(); S.guide = 0; guide(0); }; $('mF').onclick = () => { $('fps').hidden = !$('fps').hidden; open('menu'); };
        r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { quality = b.dataset.q; try { localStorage.setItem('cs-island-q', quality); } catch (e) { /* fine */ } open('menu'); toast('Graphics: ' + quality, 'Reload to apply'); });
        $('mR').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) { /* fine */ } location.reload(); }; } }),
  };
  $('menu').onclick = () => panelName === 'menu' ? close() : open('menu');
  $('cash').onclick = () => panelName === 'bank' ? close() : open('bank');
  $('who').onclick = () => toast(`Level ${S.lvl}`, `${60 * S.lvl - S.xp} XP to level ${S.lvl + 1}. Buying property and finishing jobs earn XP.`);

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

  // ---------- the objective: one short line, collapsible ----------
  function drawObj() {
    let t, s;
    if (gi >= 0) { t = GUIDE[gi].obj; s = `Step ${gi + 1} of ${GUIDE.length}`; }
    else if (!Object.keys(S.owned).length) { t = 'Buy your first building'; s = 'Property → pick one you can afford'; }
    else { t = 'Earn rent, then grow'; s = `${Object.keys(S.owned).length} building${Object.keys(S.owned).length > 1 ? 's' : ''} owned`; }
    $('objT').textContent = t; $('objS').textContent = s;
  }
  $('obj').onclick = () => $('obj').classList.toggle('min');

  // ---------- Ollie's tour: short, never covering what you tap, time paused while he explains ----------
  const GUIDE = [
    { obj: 'Meet Ollie', say: () => `Hi, I'm <b>Ollie</b>! Welcome to <b>Capital Island</b>. This is your first home: a small flat at <b>14 Shell Street</b> in Old Town.`, next: 'Hi Ollie!' },
    { obj: 'Your money', at: 'cash', say: () => `Your <b>cash</b>, and the <b>rent</b> with how long until it's due. Keep enough to pay it.`, next: 'Next' },
    { obj: 'Open Property', at: '[data-p="property"]', say: () => `Tap <b>Property</b> to see what's for sale near you.`, wait: t => t === 'panel:property' },
    { obj: 'Pick a building', at: '#pbody .pc', say: () => `Tap a building to see its card and picture.`, wait: t => t === 'panel:card' },
    { obj: 'Visit it', at: '#cVisit', say: () => `Press <b>Visit</b> to fly there. Visiting never buys anything.`, wait: t => t.startsWith('visited') },
    { obj: 'Your first goal', say: () => `That's how you find your next home or business. When you're ready, <b>buy your first building</b>: it pays rent every night.`, next: 'Got it' },
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
    G.classList.toggle('right', !!(r && !sheet && r.left < 380 && r.top < innerHeight * 0.55 && innerWidth >= 760 ? false : !P.hidden && innerWidth >= 760 ? false : false));
  }
  setInterval(placeGuide, 400);
  $('gNext').onclick = () => guide(gi + 1);
  $('gSkip').onclick = () => guide(GUIDE.length);
  events.on((t, d) => { if (gi < 0) return; const g = GUIDE[gi]; const key = t + ':' + (d || ''); if (g.wait && g.wait(key)) guide(gi + 1); else placeGuide(); });

  // the review build can jump straight in: ?play skips the cover and the name (for screenshots and tests)
  if (q.has('play')) { S.name = S.name || 'Reviewer'; save(); drawJoin('load'); steps(1); busy = true; start(); }
  window.App = { S, open, close, visit, guide, priceOf, lockOf };
})();
