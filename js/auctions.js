// Capital Street property market (Goal 13): daily deals, auctions with max bids, and everything for sale lit up on the map.
// Deals: every morning motivated sellers list some buildings and plots 6-28% below value.
// Auctions: three new lots every morning (two buildings and a plot), each running until 15:00 the next day. You set a
// maximum and the game bids for you, like a proxy bid: other bidders join over time, each with a hidden maximum, and
// the winner pays one step above the second-highest maximum. Deals and auctions are worked out from the city and the
// day, so they need nothing saved except your bids (state.auc).
'use strict';
window.Auctions = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = (v, dp = 0) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const short = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'k' : usd(v);
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const DAY = M.DAY, START = 9 * 60, END = 15 * 60;
  const S = () => { if (!M.state.auc) M.state.auc = {}; return M.state.auc; };
  let keys = null;
  const buildingKeys = () => keys || (keys = [...groups.keys()]);
  const plotList = () => [...Land.plots.values()];
  const ready = () => window.Property && window.Land && typeof groups !== 'undefined' && groups.size > 0;
  // something is for sale while neither you nor another player owns it
  const freeB = g => !M.state.props[Property.key(g)] && !(window.Net && Net.ownerOf(Property.key(g)));
  const freeP = p => !Land.mine(p) && !Land.theirs(p);

  // ---------- deals ----------
  let dealDay = -1, dealCity = '', deals = new Map(); // save key -> { kind: 'b' | 'p', g | p, disc }
  function makeDeals() {
    const d = M.day();
    if (d === dealDay && CITY.id === dealCity) return;
    dealDay = d; dealCity = CITY.id; deals = new Map();
    const r = rng(hash(CITY.id + ':deals:' + d)), ks = buildingKeys(), ps = plotList();
    for (let n = 0, tries = 0; n < 36 && tries < 500; tries++) {
      const g = ks[Math.floor(r() * ks.length)], it = Property.info(g), disc = Math.round((0.06 + r() * 0.16) * 100) / 100;
      if (!it || it.footprint < 60) continue;
      deals.set(Property.key(g), { kind: 'b', g, disc }); n++;
    }
    for (let n = 0; n < 14 && ps.length; n++) { const p = ps[Math.floor(r() * ps.length)]; deals.set(Land.keyOf(p), { kind: 'p', p, disc: Math.round((0.08 + r() * 0.2) * 100) / 100 }); }
  }
  const discount = k => { makeDeals(); const d = deals.get(k); return d && (d.kind === 'b' ? freeB(d.g) : freeP(d.p)) ? d.disc : 0; };

  // ---------- auctions ----------
  const lots$ = new Map();
  function lotsOf(d) { // the three lots that go up on day d in this city
    const id0 = CITY.id + ':' + d;
    if (lots$.has(id0)) return lots$.get(id0);
    const r = rng(hash(CITY.id + ':auc:' + d)), ks = buildingKeys(), ps = plotList(), out = [];
    for (let n = 0, tries = 0; n < 3 && tries < 800; tries++) {
      let lot;
      if (n === 2) { // the third lot is land
        if (!ps.length) break;
        const p = ps[Math.floor(r() * ps.length)];
        lot = { kind: 'p', p, key: Land.keyOf(p), name: p.name, type: 'Land plot', value: () => Land.value(p) };
      } else {
        const g = ks[Math.floor(r() * ks.length)], it = Property.info(g);
        if (!it || it.footprint < 150 || it.floors < 2) continue;
        lot = { kind: 'b', g, it, key: Property.key(g), name: it.name, type: it.type, value: () => it.floors * Property.perFloor(it) };
      }
      const start = (d - 1) * DAY + START, end = d * DAY + END, bidders = [];
      for (let b = 0, nb = 2 + Math.floor(r() * 4); b < nb; b++) bidders.push({ name: 'Bidder ' + (10 + Math.floor(r() * 89)), mult: 0.7 + r() * 0.42, at: start + r() * (end - start - 60) });
      out.push(Object.assign(lot, { id: `${id0}:${n}`, day: d, start, end, bidders }));
      n++;
    }
    lots$.set(id0, out);
    return out;
  }
  const step = v => { const e = Math.pow(10, Math.floor(Math.log10(Math.max(100, v * 0.01)))); return Math.ceil(v * 0.01 / e) * e; }; // about 1%, a round number
  function standing(lot, t) {
    const v = lot.value(), opening = Math.round(v * 0.5 / step(v)) * step(v), inc = step(v), mine = S()[lot.id];
    const bids = lot.bidders.filter(b => b.at <= t).map(b => ({ name: b.name, max: v * b.mult, at: b.at }));
    if (mine && mine.max) bids.push({ name: 'You', max: mine.max, at: mine.at, me: true });
    const live = bids.filter(b => b.max >= opening).sort((a, b) => b.max - a.max || a.at - b.at);
    const top = live[0], second = live[1];
    const price = !top ? opening : second ? Math.min(top.max, second.max + inc) : opening;
    return { v, opening, inc, price, leader: top || null, n: live.length, next: price + (top ? inc : 0) };
  }
  const free = lot => lot.kind === 'b' ? freeB(lot.g) : freeP(lot.p);
  function live() { // lots open right now in this city: today's and yesterday's
    if (!ready()) return [];
    const t = M.state.time, d = M.day();
    return [...lotsOf(d - 1), ...lotsOf(d)].filter(l => t >= l.start && t < l.end && (free(l) || (S()[l.id] && S()[l.id].done)));
  }
  const atAuction = k => live().some(l => l.key === k && !(S()[l.id] && S()[l.id].done));
  function bid(lot, max) {
    const st = standing(lot, M.state.time);
    if (!(max > 0)) return { ok: false, why: 'Type your maximum bid' };
    if (st.leader && !st.leader.me && max < st.price + st.inc) return { ok: false, why: `Bid at least ${usd(st.price + st.inc)}` };
    if (max < st.opening) return { ok: false, why: `The opening bid is ${usd(st.opening)}` };
    S()[lot.id] = { max: Math.round(max), at: M.state.time, city: CITY.id, key: lot.key, name: lot.name, end: lot.end };
    M.save();
    const now = standing(lot, M.state.time);
    return { ok: true, leading: !!(now.leader && now.leader.me), price: now.price };
  }
  let settling = false;
  async function settle() { // auctions you bid on that have finished: did you win?
    if (!ready() || settling) return;
    const t = M.state.time;
    if (!Object.values(S()).some(b => !b.done && b.city === CITY.id && t >= b.end)) return; // nothing has finished
    settling = true; // one at a time: buying waits on the server, and the clock keeps ticking meanwhile
    try { await settleNow(); } finally { settling = false; }
  }
  async function settleNow() {
    const t = M.state.time;
    for (const [id, b] of Object.entries(S())) {
      if (b.done || b.city !== CITY.id || t < b.end) continue;
      const d = +id.split(':')[1], lot = lotsOf(d).find(l => l.id === id);
      if (!lot) { b.done = 'gone'; continue; }
      if (!free(lot)) { b.done = 'gone'; toast('Auction cancelled', `${lot.name} was sold before the auction ended.`); continue; }
      const st = standing(lot, lot.end);
      if (!st.leader || !st.leader.me) { b.done = 'lost'; b.price = st.price; toast('Auction lost', `${st.leader ? st.leader.name : 'Another bidder'} won ${lot.name} for ${usd(st.price)}. Your maximum was ${usd(b.max)}.`); continue; }
      let r;
      if (lot.kind === 'p') r = await Land.buy(lot.p, st.price);
      else {
        const it = lot.it;
        if (st.price > M.state.cash) r = { ok: false, why: 'not enough cash' };
        else {
          if (window.Net) { const c = await Net.claim(lot.key, it.floors, it.name); if (!c.ok) r = c; }
          if (!r) r = M.buyProperty(lot.key, it.floors, { name: it.name, type: it.type, floorPrice: it.floorPrice, totalFloors: it.floors, x: it.x, z: it.z, city: CITY.id }, st.price);
          if (!r.ok && window.Net && !M.state.props[lot.key]) Net.release(lot.key); // never let go of a building you already own
        }
      }
      b.price = st.price;
      if (r.ok) { b.done = 'won'; M.emit('auction', { kind: 'won', id, price: st.price }); CSUI.story(`<small>AUCTION WON</small><b>${esc(lot.name)}</b><p>The hammer falls at ${usd(st.price)}, ${Math.round((1 - st.price / st.v) * 100)}% below its value of ${usd(st.v)}. It's yours.</p>`, [['Nice', () => {}]]); }
      else { b.done = 'unpaid'; toast('Auction lost', `You won ${lot.name} but couldn't pay ${usd(st.price)} (${r.why}). It went to the next bidder.`); }
    }
    for (const [id, b] of Object.entries(S())) if (b.done && t - b.end > 4 * DAY) delete S()[id]; // keep a few days of results
    M.save(); draw();
  }

  // ---------- lit up on the map: deals gold, auctions purple, price tags up close ----------
  let show = true;
  try { show = localStorage.getItem('cs-forsale') !== '0'; } catch (e) { /* storage blocked */ }
  const mat = (c, e) => new THREE.MeshStandardMaterial({ color: lin(c), emissive: lin(e), roughness: 0.6, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const dealMat = mat(0xffd21f, 0x6b4c00), aucMat = mat(0xa35cff, 0x2c1060);
  let dealMesh = null, aucMesh = null, tags = [], drawT = 0;
  function draw() { clearTimeout(drawT); drawT = setTimeout(drawNow, 200); }
  function drawNow() {
    if (!ready()) return;
    makeDeals();
    for (const m of [dealMesh, aucMesh]) if (m) { scene.remove(m); m.geometry.dispose(); }
    dealMesh = aucMesh = null;
    for (const l of tags) { l.el.remove(); labels.splice(labels.indexOf(l), 1); }
    tags = [];
    const lots = live().filter(l => !(S()[l.id] && S()[l.id].done));
    const dealP = new Map(), aucP = new Set();
    if (show) {
      for (const [k, d] of deals) if (d.kind === 'p' && freeP(d.p)) dealP.set(k, d.disc);
      for (const l of lots) if (l.kind === 'p') aucP.add(l.key);
    }
    Land.setMarks({ deal: dealP, auction: aucP });
    if (!show) return;
    const dg = [...deals.values()].filter(d => d.kind === 'b' && freeB(d.g)), ag = lots.filter(l => l.kind === 'b');
    if (dg.length) { dealMesh = new THREE.Mesh(Property.merged(dg.map(d => d.g), 0.3), dealMat); dealMesh.renderOrder = 11; scene.add(dealMesh); }
    if (ag.length) { aucMesh = new THREE.Mesh(Property.merged(ag.map(l => l.g), 0.3), aucMat); aucMesh.renderOrder = 11; scene.add(aucMesh); }
    for (const d of dg) {
      const it = Property.info(d.g), l = label(`${short(Property.wholePrice(it) * (1 - d.disc))} <i>−${Math.round(d.disc * 100)}%</i>`, 'place deal', [it.x, it.z], it.maxH + 6, 0, 2500);
      l.el.onclick = () => Property.select(d.g, true); tags.push(l);
    }
    for (const lot of lots) {
      const st = standing(lot, M.state.time), at = lot.kind === 'b' ? [lot.it.x, lot.it.z] : [lot.p.x, lot.p.z], y = lot.kind === 'b' ? lot.it.maxH + 6 : 4;
      const l = label(`AUCTION · ${short(st.price)}`, 'place auctag', at, y, 0, lot.kind === 'b' ? 5000 : 20000);
      l.el.onclick = () => Property.open('auctions'); tags.push(l);
    }
  }
  frameHooks.push(() => { const hs = tiles.length ? tiles[0].mesh.scale.y : 1; if (dealMesh) dealMesh.scale.y = hs; if (aucMesh) aucMesh.scale.y = hs; });
  function toggle() { show = !show; try { localStorage.setItem('cs-forsale', show ? '1' : '0'); } catch (e) { /* storage blocked */ } drawNow(); Property.redraw(); }

  // ---------- the Deals, Auctions and Land tabs in the property screen ----------
  let dSort = 'disc', dKind = 'all', lSort = 'near', aTimer = 0;
  const chip = (attr, v, cur, txt) => `<button ${attr}="${v}" class="${v === cur ? 'on' : ''}">${txt}</button>`;
  const lightChip = () => `<button id="mkLight" class="${show ? 'on' : ''}">${show ? '★ Lit up on the map' : '☆ Light up on the map'}</button>`;
  const plotCard = (p, price, extra) => `<button class="pcard" data-plot="${p.i},${p.j}"><div class="pp">${Land.art(p)}${extra || ''}</div><b>${usd(price)}</b><span>${(p.area / 10000).toFixed(2)} ha · ${usd(p.ppm * M.state.reIndex, 2)}/m²</span><span>${esc(p.name)}</span></button>`;
  function left(t) { const m = Math.max(0, Math.round(t)), h = Math.floor(m / 60); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${m % 60}m` : `${m}m`; }
  function drawTab(tab, body) {
    clearInterval(aTimer);
    makeDeals();
    let html = '';
    if (tab === 'deals') {
      const list = [...deals.values()].filter(d => d.kind === 'b' ? freeB(d.g) : freeP(d.p)).filter(d => dKind === 'all' || (dKind === 'land') === (d.kind === 'p'))
        .map(d => { const v = d.kind === 'b' ? Property.wholePrice(Property.info(d.g)) : Land.value(d.p); return Object.assign({ v, price: v * (1 - d.disc) }, d); });
      list.sort(dSort === 'disc' ? (a, b) => b.disc - a.disc : dSort === 'cheap' ? (a, b) => a.price - b.price : (a, b) => b.v - a.v);
      html += `<div class="goal"><small>★ TODAY'S DEALS · DAY ${M.day()}</small><b>Motivated sellers, below value</b><span>New listings every morning. Buy before they're gone.</span></div>${window.Trade ? Trade.listingsHTML() : ''}<small class="ahd">FROM THE CITY'S SELLERS</small>
        <div class="chips">${chip('data-dk', 'all', dKind, 'All')}${chip('data-dk', 'b', dKind, 'Buildings')}${chip('data-dk', 'land', dKind, 'Land')}</div>
        <div class="chips">${chip('data-ds', 'disc', dSort, 'Biggest discount')}${chip('data-ds', 'cheap', dSort, 'Cheapest')}${chip('data-ds', 'big', dSort, 'Most valuable')}${lightChip()}</div>
        <p class="note">${list.length} deals</p><div class="pgrid">${list.map(d => d.kind === 'b'
          ? (() => { const it = Property.info(d.g); return `<button class="pcard" data-g="${d.g}"><div class="pp">${Property.card(it).match(/<div class="pp">([\s\S]*?)<\/div>/)[1]}<span class="tag deal">−${Math.round(d.disc * 100)}%</span></div><b>${usd(d.price)}</b><span class="was">was ${usd(d.v)}</span><span>${it.type} · ${esc(it.name)}</span></button>`; })()
          : plotCard(d.p, d.price, `<span class="tag deal">−${Math.round(d.disc * 100)}%</span>`)).join('')}</div>`;
    } else if (tab === 'auctions') {
      const lots = live(), t = M.state.time, mine = Object.entries(S()).filter(([, b]) => b.done).sort((a, b) => b[1].end - a[1].end).slice(0, 6);
      html += `<div class="goal"><small>★ AUCTION HOUSE</small><b>Set your maximum, the game bids for you</b><span>You only pay one step above the next-highest bid. New lots every morning at 09:00; each closes at 15:00 the next day.</span></div><div class="chips">${lightChip()}</div>${window.Trade ? Trade.auctionsHTML() : ''}<small class="ahd">CITY AUCTIONS · GAME TIME</small>`;
      html += lots.length ? lots.map(l => {
        const st = standing(l, t), b = S()[l.id], done = b && b.done, me = st.leader && st.leader.me;
        const pic = l.kind === 'p' ? Land.art(l.p) : Property.card(l.it).match(/<div class="pp">([\s\S]*?)<\/div>/)[1];
        return `<div class="auc" data-a="${l.id}"><div class="pp" ${l.kind === 'b' ? `data-g="${l.g}"` : `data-plot="${l.p.i},${l.p.j}"`}>${pic}</div><div class="ab">
          <b>${esc(l.name)}</b><span>${l.type}${l.kind === 'b' ? ` · ${l.it.floors} floors` : ''} · value ${usd(st.v)}</span>
          <div class="arow"><div>Current bid<strong data-ap>${usd(st.price)}</strong></div><div>Leading<strong data-al class="${me ? 'up' : ''}">${st.leader ? (me ? 'You' : st.leader.name) : 'No bids'}</strong></div><div>Ends in<strong data-at>${left(l.end - t)}</strong></div></div>
          ${done ? '' : `<form class="abid" data-f="${l.id}"><input type="number" inputmode="numeric" min="0" step="${st.inc}" placeholder="Your max (at least ${usd(me ? st.price : st.next)})" value="${b ? b.max : ''}" aria-label="Your maximum bid"><button class="btn pri">${b ? 'Change max' : 'Bid'}</button></form>`}
          ${b && !done ? `<small data-am>Your max ${usd(b.max)}${b.max > M.state.cash ? ' · more than your cash: you must be able to pay when it ends' : ''}</small>` : ''}
        </div></div>`;
      }).join('') : '<p class="note">No auctions right now. New lots go up at 09:00.</p>';
      if (mine.length) html += `<small class="ahd">YOUR RESULTS</small>` + mine.map(([, b]) => `<div class="ares ${b.done}"><b>${esc(b.name)}</b><span>${b.done === 'won' ? `Won for ${usd(b.price)}` : b.done === 'lost' ? `Lost at ${usd(b.price)} (your max ${usd(b.max)})` : b.done === 'unpaid' ? 'Won, but you couldn\'t pay' : 'Sold before it ended'}</span></div>`).join('');
    } else if (tab === 'land') {
      const t = controls.target, ps = plotList().filter(freeP).map(p => ({ p, price: Land.value(p) * (1 - discount(Land.keyOf(p))), d: (p.x - t.x) ** 2 + (p.z - t.z) ** 2 }));
      ps.sort(lSort === 'near' ? (a, b) => a.d - b.d : lSort === 'cheap' ? (a, b) => a.price - b.price : (a, b) => b.price - a.price);
      const own = Object.values(M.state.land || {}), val = own.reduce((s, o) => s + o.area * o.ppm * M.state.reIndex, 0), lease = own.reduce((s, o) => s + o.earned, 0);
      html += `<div class="cards"><div>Your land<b>${own.length} plot${own.length === 1 ? '' : 's'}</b></div><div>Value<b>${usd(val)}</b></div><div>Lease earned<b class="up">${usd(lease, 2)}</b></div></div>
        <div class="chips">${chip('data-ls', 'near', lSort, 'Nearest')}${chip('data-ls', 'cheap', lSort, 'Cheapest')}${chip('data-ls', 'dear', lSort, 'Best located')}${lightChip()}</div>
        <p class="note">${ps.length.toLocaleString('en-US')} plots for sale around ${esc(CITY.name)}${ps.length > 48 ? ', showing 48' : ''}. Zoom out over the city to see them outlined on the map.</p>
        <div class="pgrid">${ps.slice(0, 48).map(({ p, price }) => plotCard(p, price, discount(Land.keyOf(p)) ? `<span class="tag deal">−${Math.round(discount(Land.keyOf(p)) * 100)}%</span>` : '')).join('')}</div>`;
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-dk]').forEach(b => b.onclick = () => { dKind = b.dataset.dk; Property.redraw(); });
    body.querySelectorAll('[data-ds]').forEach(b => b.onclick = () => { dSort = b.dataset.ds; Property.redraw(); });
    body.querySelectorAll('[data-ls]').forEach(b => b.onclick = () => { lSort = b.dataset.ls; Property.redraw(); });
    body.querySelectorAll('[data-plot]').forEach(b => b.onclick = () => { $('props').hidden = true; Land.select('x:' + b.dataset.plot.replace(',', ':'), true); });
    if ($('mkLight')) $('mkLight').onclick = toggle;
    if (window.Trade) Trade.bindTab(body);
    body.querySelectorAll('form[data-f]').forEach(f => f.onsubmit = e => {
      e.preventDefault();
      const lot = live().find(l => l.id === f.dataset.f); if (!lot) return;
      const r = bid(lot, +f.querySelector('input').value);
      if (!r.ok) { toast('Bid not placed', r.why); return; }
      toast(r.leading ? 'You\'re winning' : 'Outbid already', r.leading ? `Current bid ${usd(r.price)}. The game bids for you up to your maximum.` : `Another bidder's maximum is higher. The bid is now ${usd(r.price)}.`);
      Property.redraw(); draw();
    });
    if (tab === 'auctions') aTimer = setInterval(() => { // keep the numbers moving without redrawing the form you might be typing in
      if ($('props').hidden || Property.tab !== 'auctions') { clearInterval(aTimer); return; }
      const t = M.state.time;
      for (const el of body.querySelectorAll('.auc')) {
        const lot = live().find(l => l.id === el.dataset.a); if (!lot) continue;
        const st = standing(lot, t), me = st.leader && st.leader.me;
        el.querySelector('[data-ap]').textContent = usd(st.price);
        const ld = el.querySelector('[data-al]'); ld.textContent = st.leader ? (me ? 'You' : st.leader.name) : 'No bids'; ld.className = me ? 'up' : '';
        el.querySelector('[data-at]').textContent = left(lot.end - t);
      }
    }, 1000);
  }

  // ---------- keeping up with the day ----------
  M.onDay(() => setTimeout(() => { makeDeals(); draw(); Property.redraw(); }, 0));
  let lastLive = '';
  M.on(type => {
    if (type === 'property' || type === 'land' || type === 'reset') { draw(); if (type === 'land') Property.redraw(); }
    if (type === 'tick') {
      settle();
      const ids = live().map(l => l.id).join(); // a lot opened or closed: redraw the lights
      if (ids !== lastLive) { lastLive = ids; draw(); }
    }
  });
  if (window.Net) Net.on(t => { if (t === 'owners') draw(); });
  const boot = setInterval(() => { if (ready() && Land.plots.size >= 0 && $('load').hidden) { clearInterval(boot); draw(); } }, 300);

  return { discount, atAuction, live, standing, bid, settle, drawTab, toggle, deals: () => { makeDeals(); return deals; }, get shown() { return show; } };
})();
