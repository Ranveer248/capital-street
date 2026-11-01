// Capital Island sample 3: the cover, the compact HUD, five-button navigation, one panel at a time, zoom-dependent
// labels, property cards with pictures and Visit, live delivery status, and the road checks. Its own save key; the
// live game and the earlier previews are not touched.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const usd = v => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ic = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
  const KEY = 'cs-sample3-v1';
  const fresh = () => ({ cash: 2340, xp: 0, owned: {}, seen: {}, done: {} });
  let S; try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* keeps going */ } };
  let quality = (() => { try { return localStorage.getItem('cs-sample3-q') || 'high'; } catch (e) { return 'high'; } })();

  // ---------- progression: each level unlocks something you can use, and the next reward is always shown ----------
  const LEVELS = [
    { xp: 0, reward: 'Your flat on Market Street' },
    { xp: 60, reward: 'Delivery van: run shop deliveries' },
    { xp: 150, reward: 'Warehouse plots at the harbour' },
    { xp: 280, reward: 'Supply contract with Hotel Azure' },
    { xp: 450, reward: 'Office in the business centre' },
  ];
  const level = () => { let l = 0; while (l + 1 < LEVELS.length && S.xp >= LEVELS[l + 1].xp) l++; return l; };
  function award(key, xp, why) { // each award is earned once: no farming by repeating the same action
    if (S.done[key]) return; S.done[key] = true; const before = level(); S.xp += xp; save();
    toast(`+${xp} XP`, why); if (level() > before) setTimeout(() => toast(`Level ${level() + 1}!`, 'Unlocked: ' + LEVELS[level()].reward), 1600); draw();
  }

  let toastT = 0;
  function toast(t, b = '') { $('toastT').textContent = t; $('toastB').textContent = b; $('toast').classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.remove('on'), 2600); }

  // ---------- start: the cover is a picture; the world is built only after Play ----------
  let started = false;
  $('play').onclick = () => {
    if (started) return; started = true; $('play').disabled = true; $('play').textContent = 'LOADING…';
    setTimeout(() => {
      try { $('c').hidden = false; const t0 = performance.now(); World.init($('c'), quality); window.buildMs = Math.round(performance.now() - t0); }
      catch (e) { console.error(e); $('play').textContent = 'TRY AGAIN'; $('play').disabled = false; started = false; return; }
      $('cover').hidden = true; World.place(World.overview()); loop(performance.now());
      World.flyTo(World.homeView(), 2, () => { $('hud').hidden = false; draw(); objective(); });
    }, 50);
  };
  if (new URLSearchParams(location.search).has('play')) $('play').click();

  let last = 0, frames = 0, fpsT = 0, follow = null;
  function loop(now) {
    const dt = Math.max(0, Math.min(0.1, (now - (last || now)) / 1000)); last = now;
    if (follow) { follow.t -= dt; const c = follow.car; if (c.last && follow.t > 0) { const v = World.current(); v.t.set(c.last.x, 3, c.last.z); World.place(v); } else follow = null; }
    World.step(dt); labels();
    frames++; fpsT += dt; if (fpsT > 1) { $('fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
    requestAnimationFrame(loop);
  }
  setInterval(() => { if (!$('hud').hidden) { draw(); objective(); if (panel === 'trade') refresh(); } }, 1000);
  function draw() {
    const l = level(), nx = LEVELS[l + 1];
    $('lvN').textContent = l + 1; $('lvT').textContent = `Level ${l + 1}`; $('lvNext').textContent = nx ? `Next: ${nx.reward.split(':')[0]} · ${nx.xp - S.xp} XP` : 'Top level in the sample';
    $('lvRing').style.setProperty('--p', (nx ? (S.xp - LEVELS[l].xp) / (nx.xp - LEVELS[l].xp) * 100 : 100) + '%');
    $('cash').textContent = usd(S.cash);
    const sec = stack.length ? stack[0][0] : panel; document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.p === sec));
  }
  function objective() { // one short goal at a time, based on what you've done
    const areas = Object.keys(S.seen).length; let t, s;
    if (!S.done.zoom) { t = 'See the whole island'; s = 'Pinch or scroll out, or Map → Island view'; }
    else if (areas < 4) { t = `Visit the areas (${areas}/5)`; s = 'Map → pick an area'; }
    else if (!Object.keys(S.owned).length) { t = 'Buy your first property'; s = 'Build → a house you can afford'; }
    else if (!S.done.track) { t = 'Follow a delivery'; s = 'Trade → Track a truck over the bridge'; }
    else { t = 'Sample complete'; s = 'Jobs and trade loops come after approval'; }
    $('objT').textContent = t; $('objS').textContent = s;
  }
  $('obj').onclick = () => $('obj').classList.toggle('min');

  // ---------- labels: island name far out, district names in between, a few useful places up close; no overlaps ----------
  const els = new Map(); let sel = null;
  function labelEl(L) { let el = els.get(L); if (!el) { el = document.createElement('div'); el.className = `lab ${L.level}${L.minor ? ' minor' : ''}${L.small ? ' small' : ''}${L.home ? ' home' : ''}`; el.textContent = L.text; $('labels').appendChild(el); els.set(L, el); L.w = 0; } return el; }
  const v3 = new THREE.Vector3();
  function labels() {
    if (!World.camera || $('hud').hidden) return;
    const d = World.dist, lvl = d > 620 ? 'island' : d > 210 ? 'district' : 'place', t = World.controls.target, placed = [], W = innerWidth, H = innerHeight;
    if (lvl === 'island' && !S.done.zoom) award('zoom', 10, 'You found the whole island');
    const want = World.LABELS.filter(L => L.level === lvl || (L.home && lvl !== 'island') || (sel && L.b === sel)).map(L => ({ L, pri: (L.b && L.b === sel ? 0 : L.home ? 1 : 2) + (lvl === 'place' ? Math.hypot(L.x - t.x, L.z - t.z) / 1000 : 0) })).sort((a, b) => a.pri - b.pri);
    const shown = new Set();
    for (const { L } of want) {
      if (lvl === 'place' && !L.home && !(L.b && L.b === sel) && Math.hypot(L.x - t.x, L.z - t.z) > 160) continue; // close up: only what's nearby
      v3.set(L.x, L.y, L.z).project(World.camera); if (v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) continue;
      const el = labelEl(L); if (!L.w) { L.w = el.offsetWidth || 80; L.h = el.offsetHeight || 20; }
      const x = (v3.x + 1) / 2 * W - L.w / 2, y = (1 - v3.y) / 2 * H - L.h, r = [x - 4, y - 3, x + L.w + 4, y + L.h + 3];
      const pr = !P.hidden ? P.getBoundingClientRect() : null; if (pr && r[2] > pr.left && r[0] < pr.right && r[3] > pr.top && r[1] < pr.bottom) continue;
      if (x < 6 || x + L.w > W - 6 || y < 100 || y > H - 96 || placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) continue; // keep clear of the bars and of each other
      placed.push(r); shown.add(L); el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; el.classList.toggle('sel', !!(L.b && L.b === sel));
    }
    for (const [L, el] of els) el.classList.toggle('on', shown.has(L));
  }

  // ---------- pictures for property cards: one render at a time, kept for the session ----------
  const queue = []; let pumping = false;
  function picture(el, b) { el.classList.add('wait'); queue.push([el, b]); pump(); }
  function pump() { if (pumping || !queue.length) return; pumping = true; requestAnimationFrame(() => setTimeout(() => { const [el, b] = queue.shift(); if (el.isConnected) { try { el.innerHTML = `<img alt="" src="${World.photo(b)}">`; } catch (e) { el.textContent = 'No picture'; } el.classList.remove('wait'); } pumping = false; pump(); }, 0)); }

  // ---------- panels: one at a time, Back returns to where you came from, Close always closes ----------
  let panel = '', arg = null, stack = [];
  const P = $('panel');
  function open(name, a, push) {
    if (push && panel) stack.push([panel, arg]); else if (!push) stack = [];
    const keep = name === panel ? $('pbody').scrollTop : 0; panel = name; arg = a;
    const r = PANELS[name](a); P.hidden = false; $('pBack').hidden = !stack.length; $('pTitle').textContent = r.title; $('pbody').innerHTML = r.html; $('pbody').scrollTop = keep; if (r.bind) r.bind($('pbody')); draw();
  }
  const refresh = () => { if (panel && !P.hidden) { const st = stack.slice(); open(panel, arg, true); stack = st; $('pBack').hidden = !stack.length; } };
  function close() { P.hidden = true; panel = ''; stack = []; sel = null; World.mark(null); draw(); }
  $('pX').onclick = close;
  $('pBack').onclick = () => { const [n, a] = stack.pop() || []; if (n) { const st = stack.slice(); panel = ''; open(n, a); stack = st; $('pBack').hidden = !stack.length; } };
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { const p = b.dataset.p; if (panel === p && !stack.length) close(); else open(p); });
  $('gear').onclick = () => panel === 'settings' ? close() : open('settings');
  addEventListener('keydown', e => { if (e.key === 'Escape' && !P.hidden) (stack.length ? $('pBack') : $('pX')).click(); });

  const byId = id => World.buildings.find(b => b.id === id);
  const priceOf = b => Math.round(b.w * b.d * ({ house: 2, flat: b.floors || 3, shophouse: 3, warehouse: 1, kiosk: 1 }[b.type] || 1) * ({ house: 13, flat: 9, shophouse: 12, warehouse: 4, kiosk: 30 }[b.type] || 10) / 10) * 10;
  const rentOf = b => Math.round(priceOf(b) * 0.05 / 10) * 10;
  function visit(b) { sel = b; World.mark(b); World.flyTo(World.viewOf(b), 1.3); if (innerWidth < 760) P.hidden = true, panel = ''; seeArea(b.area); }
  function seeArea(a) { if (!a || S.seen[a]) return; S.seen[a] = true; save(); award('area:' + a, 15, 'First visit: ' + a); }
  const AREAS = [['Beachfront', -130, 140, 'Hotel Azure, the promenade, the beach and the pier'], ['Old Quarter', -20, -20, 'Flats, small houses, local shops, the square and the park'], ['Harbour', 190, 20, 'Quay, cranes, the cargo ship, warehouses and the depot'], ['Industrial Isle', 540, -180, 'The processing plant, across the bridge'], ['Lighthouse Point', -370, -130, 'Cliffs, pines and the lighthouse']];
  const card = b => `<button class="pc" data-b="${b.id}"><div class="ph" data-ph="${b.id}"></div>${S.owned[b.id] || b.owner === 'you' ? '<span class="tag yours">YOURS</span>' : ''}<div class="tx"><b>${esc(b.name)}</b><small>${esc(b.area)}</small><em>${S.owned[b.id] || b.owner === 'you' ? 'Yours' : usd(priceOf(b))}</em></div></button>`;
  const bindCards = r => { r.querySelectorAll('[data-ph]').forEach(el => picture(el, byId(el.dataset.ph))); r.querySelectorAll('[data-b]').forEach(el => el.onclick = () => open('card', el.dataset.b, true)); };
  let filter = 'homes';
  const placeName = { K: 'Harbour quay', P: 'Processing Plant', G: 'Delivery depot', C: 'Old Quarter shops', J: 'Hotel Azure' };
  const PANELS = {
    home: () => { const h = World.home; return { title: 'Home', html: `<div class="ph" data-ph="home"></div><div class="row"><span class="ic">${ic('home')}</span><div><b>${esc(h.name)}</b><small>Your flat in the Old Quarter, by the market square</small></div><button class="btn" id="hv">VISIT</button></div>
      <div class="stats"><div>Cash<b>${usd(S.cash)}</b></div><div>Owned<b>${Object.keys(S.owned).length}</b></div><div>Level<b>${level() + 1}</b></div></div>
      <p class="sec">Money and business</p><button class="row" id="hBank" style="text-align:left"><span class="ic">${ic('bank')}</span><div><b>Bank</b><small>Cash, rent income and loans</small></div></button>
      <button class="row ${level() < 4 ? 'lock' : ''}" id="hOffice" style="text-align:left"><span class="ic">${ic('office')}</span><div><b>Office</b><small>Run your companies from the business centre</small></div>${level() < 4 ? '<span class="lockt">LEVEL 5</span>' : ''}</button>`,
      bind: r => { picture(r.querySelector('[data-ph]'), h); $('hv').onclick = () => visit(h); $('hBank').onclick = () => open('bank', null, true); $('hOffice').onclick = () => open('office', null, true); } }; },
    bank: () => { const inc = Object.keys(S.owned).map(byId).filter(Boolean).reduce((a, b) => a + rentOf(b), 0); return { title: 'Bank', html: `<div class="stats"><div>Cash<b>${usd(S.cash)}</b></div><div>Rent in<b>${usd(inc)}/wk</b></div><div>Loans<b>None</b></div></div><p class="note">Loans and savings arrive with the full economy. In the sample, rent income is shown but not paid out.</p>` }; },
    office: () => ({ title: 'Office', html: `<div class="row lock"><span class="ic">${ic('lock')}</span><div><b>Opens at level 5</b><small>${LEVELS[4].reward}</small></div></div><p class="note">From your office you'll run the companies you start in Jobs: contracts, staff and fleets.</p>` }),
    build: () => { const G = { homes: ['house', 'flat'], shops: ['shophouse', 'kiosk'], harbour: ['warehouse'] }, list = World.buildings.filter(b => b.sale && !S.owned[b.id] && G[filter].includes(b.type)).sort((a, b) => priceOf(a) - priceOf(b)).slice(0, 10), own = Object.keys(S.owned).map(byId).filter(Boolean);
      return { title: 'Build & property', html: `<div class="seg">${[['homes', 'Homes'], ['shops', 'Shops'], ['harbour', 'Harbour']].map(([k, n]) => `<button data-f="${k}" class="${k === filter ? 'on' : ''}">${n}</button>`).join('')}</div>
        ${own.length ? `<p class="sec">Yours</p><div class="cards">${own.map(card).join('')}</div>` : ''}<p class="sec">For sale · cheapest first</p><div class="cards">${list.map(card).join('')}</div>
        <div class="row ${level() < 2 ? 'lock' : ''}"><span class="ic">${ic('build')}</span><div><b>Build on a plot</b><small>${LEVELS[2].reward}</small></div>${level() < 2 ? '<span class="lockt">LEVEL 3</span>' : ''}</div>`,
        bind: r => { r.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; open('build'); }); bindCards(r); } }; },
    card: id => { const b = byId(id), mine = S.owned[b.id] || b.owner === 'you', p = priceOf(b); sel = b; World.mark(b); return { title: b.type === 'warehouse' ? 'Warehouse' : b.type === 'shophouse' ? 'Shop with flats' : b.type === 'kiosk' ? 'Kiosk' : b.type === 'house' ? 'House' : b.sale ? 'Flats' : 'Landmark',
      html: `<div class="ph" data-ph="${b.id}"></div><b class="big">${esc(b.name)}</b><p class="note">${esc(b.area)}</p>
        ${b.sale || mine ? `<div class="stats"><div>Price<b>${usd(p)}</b></div><div>Rent<b>${usd(rentOf(b))}/wk</b></div><div>Floors<b>${b.floors || (b.type === 'house' ? 2 : 1)}</b></div></div>` : '<p class="note">Owned by the island; not for sale.</p>'}
        <div class="acts"><button class="btn" id="cv">${ic('map')}VISIT</button>${mine ? '<button class="btn" disabled>YOURS</button>' : b.sale ? `<button class="btn go" id="cb" ${S.cash < p ? 'disabled' : ''}>${S.cash < p ? 'NEED ' + usd(p - S.cash) : 'BUY ' + usd(p)}</button>` : '<button class="btn" disabled>NOT FOR SALE</button>'}</div>
        <p class="note">Visit moves the camera there and marks it. It never buys anything.</p>`,
      bind: r => { picture(r.querySelector('[data-ph]'), b); $('cv').onclick = () => visit(b); if ($('cb')) $('cb').onclick = () => { if (S.cash < p || S.owned[b.id]) return; S.cash -= p; S.owned[b.id] = { at: Date.now() }; save(); toast('Bought ' + b.name, `Rent ${usd(rentOf(b))} a week`); award('buy:' + b.id, 30, 'First purchase of ' + b.name); open('card', id, true); stack.pop(); }; } }; },
    jobs: () => ({ title: 'Jobs', html: `<p class="note">The economy is built after you approve this sample. This is the first chain it will run, end to end:</p>
      <div class="chain"><span>Farm: crops</span><i>→</i><span>Ship to Industrial Isle</span><i>→</i><span>Plant: food</span><i>→</i><span>Shops &amp; Hotel Azure</span></div>
      ${[['Producer', 'Grow crops or extract resources', 1], ['Shipper', 'Move goods by van, truck and ship', 2], ['Seller', 'Stock a shop and meet demand', 2], ['Manufacturer', 'Process resources at the plant', 3], ['Hotel owner', 'Supply and upgrade a hotel', 4], ['Property owner', 'Develop buildings for rent', 1]].map(([n, d, l]) => `<div class="row ${level() + 1 < l ? 'lock' : ''}"><span class="ic">${ic('jobs')}</span><div><b>${n}</b><small>${d}</small></div><span class="lockt">${level() + 1 >= l ? 'NEXT STAGE' : 'LEVEL ' + l}</span></div>`).join('')}` }),
    trade: () => ({ title: 'Trade', html: `<p class="note">Live deliveries on the road network. Each vehicle follows a real route; if a road closes it re-plans or waits.</p>
      ${World.SHIP.map((s, i) => `<div class="row"><span class="ic">${ic('truck')}</span><div><b>${esc(placeName[s.from] || s.from)} → ${esc(placeName[s.to] || s.to)}</b><small>${s.why ? esc(s.why) : `${s.runs} delivered so far`}</small></div><span class="chip ${s.status}">${{ loading: 'LOADING', travelling: 'TRAVELLING', delivered: 'DELIVERED', failed: 'FAILED' }[s.status]}</span><button class="btn" data-track="${i}">TRACK</button></div>`).join('')}
      <div class="row"><span class="ic">${ic('trade')}</span><div><b>Bridge to Industrial Isle</b><small>${bridgeClosed ? 'Closed: trucks for the plant wait and re-plan' : 'Open both ways'}</small></div><button class="btn" id="tb">${bridgeClosed ? 'REOPEN' : 'CLOSE (TEST)'}</button></div>`,
      bind: r => { r.querySelectorAll('[data-track]').forEach(b => b.onclick = () => { const sh = World.SHIP[+b.dataset.track], car = World.cars.find(c => c.ship === sh); follow = { car, t: 12 }; const v = World.current(); v.dist = 120; v.polar = 0.9; World.place(v); if (innerWidth < 760) close(); award('track', 10, 'You followed a delivery'); }); $('tb').onclick = () => { bridgeClosed = !bridgeClosed; World.setClosed('bridge', bridgeClosed); toast(bridgeClosed ? 'Bridge closed' : 'Bridge reopened', bridgeClosed ? 'Traffic turns back at the barrier' : 'Deliveries resume'); refresh(); }; } }),
    map: () => ({ title: 'Map', html: `<div class="acts"><button class="btn gold" id="mi">ISLAND VIEW</button><button class="btn" id="mh">MY HOME</button></div><p class="sec">Areas</p>
      ${AREAS.map(([n, , , d], i) => `<div class="row"><span class="ic">${ic('map')}</span><div><b>${n}${S.seen[n] ? '' : ' ·  new'}</b><small>${d}</small></div><button class="btn" data-a="${i}">GO</button></div>`).join('')}
      <p class="sec">Road checks</p><div class="row"><span class="ic">${ic('truck')}</span><div><b>Traffic</b><small>${World.cars.length} vehicles · ${World.stats.teleports} jumps · ${World.stats.stuck} stuck</small></div><button class="btn" id="mt">RUN ROUTE TEST</button></div><div id="rt"></div>`,
      bind: () => { $('mi').onclick = () => { World.mark(null); World.flyTo(World.overview(), 1.5); if (innerWidth < 760) close(); }; $('mh').onclick = () => visit(World.home);
        document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const [n, x, z] = AREAS[+b.dataset.a]; World.mark(null); World.flyTo(World.view(x, z, 300, 0.85, 0.4), 1.4); seeArea(n); if (innerWidth < 760) close(); });
        $('mt').onclick = () => { const res = World.routeTest(), rep = World.roadReport(); $('rt').innerHTML = `<p class="note">${rep.connected ? '<span class="ok">All roads connected.</span>' : '<span class="bad">Some roads are not connected.</span>'} Dead ends: ${rep.deadEnds.join(', ')}. Road points over water: ${rep.roadPointsOverWater}. Steepest grade ${rep.maxGrade}.</p><table class="t">${res.map(t => `<tr><td>${esc(t.route)}<br><small>${esc(t.path || t.why)}</small></td><td class="${t.ok ? 'ok' : 'bad'}">${t.ok ? 'PASS' : 'FAIL'}<br><small>${t.length || ''} m</small></td></tr>`).join('')}</table>`; }; } }),
    settings: () => ({ title: 'Settings', html: `<div class="row"><div><b>Graphics</b><small>After a reload</small></div><div class="seg">${['low', 'medium', 'high'].map(k => `<button data-q="${k}" class="${k === quality ? 'on' : ''}">${k}</button>`).join('')}</div></div>
      <div class="row"><div><b>Frame rate</b><small>In the corner</small></div><button class="btn" id="sf">${$('fps').hidden ? 'SHOW' : 'HIDE'}</button></div><div class="row"><div><b>Reset the sample</b><small>Your real game is never touched</small></div><button class="btn" id="sr">RESET</button></div><p class="note">© 2026 Pocket Rocket Studio</p>`,
      bind: r => { r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { quality = b.dataset.q; try { localStorage.setItem('cs-sample3-q', quality); } catch (e) { /* fine */ } open('settings'); toast('Graphics: ' + quality, 'Reload to apply'); }); $('sf').onclick = () => { $('fps').hidden = !$('fps').hidden; open('settings'); }; $('sr').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) { /* fine */ } location.reload(); }; } }),
  };
  let bridgeClosed = false;

  // tap a building: its card
  let down = null;
  $('c').addEventListener('pointerdown', e => { down = [e.clientX, e.clientY, performance.now()]; follow = null; });
  $('c').addEventListener('pointerup', e => { if (!down || $('hud').hidden || World.flying) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]), quick = performance.now() - down[2] < 450; down = null; if (moved > 8 || !quick) return; const b = World.pickAt(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); if (b) open('card', b.id); else if (!P.hidden && innerWidth >= 760) close(); });
  window.App = { S, open, close, visit, award, level, frame: () => loop(performance.now()) }; // frame(): one step by hand, for tests in a hidden tab
})();
