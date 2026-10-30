// Capital Street land (Goal 13): the open land around each city, cut into 160 m plots you can buy, hold and sell.
// Plots are found by painting the city's land onto a small canvas (its built-up centre, parks and lakes left out) and
// keeping every square that is land all the way across. Owned plots earn a small lease and count toward net worth;
// in multiplayer they are claimed through the same server rules as buildings (key "plot:i:j").
'use strict';
window.Land = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = (v, dp = 0) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const SIZE = 160, R = 9000, LEASE = 0.002; // lease: a share of the plot's value each game day (buildings earn 0.4%)
  const plots = new Map(); // "i,j" -> { i, j, x, z, ppm, area, name, lot }
  const S = () => { if (!M.state.land) M.state.land = {}; return M.state.land; };
  const keyOf = p => `${CITY.id}:plot:${p.i}:${p.j}`; // in the save
  const netKey = p => `plot:${p.i}:${p.j}`;           // on the server, next to the city
  const value = p => p.area * p.ppm * M.state.reIndex;
  const mine = p => S()[keyOf(p)];
  const theirs = p => window.Net ? Net.ownerOf(netKey(p)) : null;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let marks = { deal: new Map(), auction: new Set() }; // set by js/auctions.js: plot key -> discount, and plots up for auction

  // ---------- finding the plots ----------
  function init(d) {
    const PX = 20, N = Math.ceil(2 * R / PX), cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const g = cv.getContext('2d');
    g.setTransform(1 / PX, 0, 0, 1 / PX, R / PX, R / PX); // world metres -> canvas pixels
    const paint = (name, fill, grow) => {
      const r = d[name + '.r'], xy = d[name + '.xy'];
      if (!r) return;
      let ri = 1, p = 0;
      g.fillStyle = g.strokeStyle = fill; g.lineWidth = grow * 2; g.lineJoin = 'round';
      for (let k = 0; k < r[0]; k++) {
        const rings = r[ri++]; g.beginPath();
        for (let h = 0; h < rings; h++) { const n = r[ri++]; for (let i = 0; i < n; i++, p += 2) i ? g.lineTo(xy[p], xy[p + 1]) : g.moveTo(xy[p], xy[p + 1]); g.closePath(); }
        g.fill('evenodd'); if (grow) g.stroke();
      }
    };
    g.fillStyle = '#000'; g.fillRect(-R, -R, 2 * R, 2 * R);
    paint('region', '#fff', 0);
    paint('land', '#000', 120); // keep clear of the built-up city
    paint('park', '#000', 0); paint('lake', '#000', 0);
    const img = g.getImageData(0, 0, N, N).data;
    const land = (x, z) => { const u = Math.floor((x + R) / PX), v = Math.floor((z + R) / PX); return u >= 0 && v >= 0 && u < N && v < N && img[(v * N + u) * 4] > 127; };
    const named = (CITY.nearby.length ? CITY.nearby : CITY.districts).map(([t, a, b]) => [t, ll(a, b)]); // the areas around the city, not its own districts
    const lim = Math.floor(R / SIZE) - 1;
    for (let i = -lim; i < lim; i++) for (let j = -lim; j < lim; j++) {
      const x = (i + 0.5) * SIZE, z = (j + 0.5) * SIZE, dist = Math.hypot(x, z);
      if (dist > R - SIZE) continue;
      let ok = true;
      for (let a = 0; a < 3 && ok; a++) for (let b = 0; b < 3 && ok; b++) ok = land(x + (a - 1) * SIZE * 0.45, z + (b - 1) * SIZE * 0.45);
      if (!ok) continue;
      let best = '', bd = Infinity;
      for (const [t, q] of named) { const dd = (q[0] - x) ** 2 + (q[1] - z) ** 2; if (dd < bd) { bd = dd; best = t; } }
      const lot = 100 + ((i * 7919 + j * 104729) >>> 0) % 9800;
      const ppm = Math.round((0.15 + 1.85 * Math.exp(-((dist / 6000) ** 2))) * 100) / 100; // dollars a square metre, dearer near the centre
      plots.set(i + ',' + j, { i, j, x, z, ppm, area: SIZE * SIZE, lot, name: `Lot ${lot}, ${best.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')}` });
    }
    build(); drawFills();
  }

  // ---------- on the map: thin white outlines, coloured fills for yours, theirs, deals and auctions ----------
  let lines = null, fills = null, sel = null;
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false });
  const fillMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  function build() {
    const pos = [], Y = 0.6;
    for (const p of plots.values()) {
      const x0 = p.i * SIZE, z0 = p.j * SIZE, x1 = x0 + SIZE, z1 = z0 + SIZE;
      pos.push(x0, Y, z0, x1, Y, z0, x1, Y, z0, x1, Y, z1, x1, Y, z1, x0, Y, z1, x0, Y, z1, x0, Y, z0);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lines = new THREE.LineSegments(geo, lineMat); lines.renderOrder = 6; lines.frustumCulled = false; scene.add(lines);
  }
  const COL = { mine: [0.18, 0.86, 0.43], theirs: [0.3, 0.55, 1], deal: [1, 0.82, 0.12], auction: [0.64, 0.36, 1], sel: [1, 1, 1] };
  function drawFills() {
    if (fills) { scene.remove(fills); fills.geometry.dispose(); fills = null; }
    const pos = [], col = [], Y = 0.5, pad = 6;
    const add = (p, c) => {
      const x0 = p.i * SIZE + pad, z0 = p.j * SIZE + pad, x1 = x0 + SIZE - 2 * pad, z1 = z0 + SIZE - 2 * pad;
      pos.push(x0, Y, z0, x1, Y, z0, x1, Y, z1, x0, Y, z0, x1, Y, z1, x0, Y, z1);
      for (let k = 0; k < 6; k++) col.push(...c);
    };
    for (const p of plots.values()) {
      const k = keyOf(p), c = sel === p ? COL.sel : mine(p) ? COL.mine : theirs(p) ? COL.theirs : marks.auction.has(k) ? COL.auction : marks.deal.has(k) ? COL.deal : null;
      if (c) add(p, c);
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    fills = new THREE.Mesh(geo, fillMat); fills.renderOrder = 5; fills.frustumCulled = false; scene.add(fills);
  }
  frameHooks.push((dt, dist) => { // outlines fade in from 30 km and out again at street level
    if (!lines) return;
    const a = Math.min(1, Math.max(0, (30000 - dist) / 12000)) * Math.min(1, Math.max(0, (dist - 150) / 400));
    lines.visible = a > 0.02; lineMat.opacity = 0.45 * a;
    if (fills) { fills.visible = dist < 60000; fillMat.opacity = 0.65 * Math.min(1, Math.max(0.35, (60000 - dist) / 30000)); }
  });

  // ---------- tapping a plot ----------
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
  function tap(ray) {
    if (!ray.ray.intersectPlane(ground, hitP)) return false;
    const p = plots.get(Math.floor(hitP.x / SIZE) + ',' + Math.floor(hitP.z / SIZE));
    if (!p) { if (sel) { close(); return true; } return false; }
    select(p, false); return true;
  }
  const sheet = $('listing');
  function select(p, fly) {
    if (window.Property) Property.deselect();
    sel = p; drawFills();
    $('ex').hidden = true; $('bank').hidden = true; $('props').hidden = true;
    if (fly) flyTo(view([p.x, p.z], 900, 0.7, current().az), 2.2);
    draw();
  }
  function close() { sel = null; sheet.hidden = true; drawFills(); }
  function art(p) { // a field with a fence and a sign
    const o = mine(p), t = theirs(p), c = o ? '#2edb6e' : t ? '#4c8dff' : '#ffd21f';
    return `<svg viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="lsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#cde6fb"/></linearGradient></defs><rect width="160" height="110" fill="url(#lsky)"/>
      <polygon points="0,62 160,52 160,110 0,110" fill="#6aaa4c"/><polygon points="22,92 80,70 140,84 84,108" fill="#86c25a" stroke="#0a0f2e" stroke-width="2"/>
      ${[[22, 92], [80, 70], [140, 84], [84, 108]].map(([x, y]) => `<rect x="${x - 1.5}" y="${y - 9}" width="3" height="9" fill="#5b3a1e"/>`).join('')}
      <rect x="99" y="58" width="3" height="26" fill="#5b3a1e"/><rect x="80" y="49" width="42" height="17" rx="3" fill="${c}" stroke="#0a0f2e" stroke-width="2"/>
      <text x="101" y="60.8" font-size="7" font-family="Inter,sans-serif" font-weight="800" text-anchor="middle" fill="#0a0f2e">${o ? 'YOURS' : t ? 'SOLD' : 'FOR SALE'}</text></svg>`;
  }
  function draw() {
    const p = sel; if (!p) return;
    const o = mine(p), t = theirs(p), k = keyOf(p), disc = marks.deal.get(k) || 0, v = value(p), price = v * (1 - disc), s = M.state;
    const wall = Math.hypot(p.x - PLACE.wall[0], p.z - PLACE.wall[1]) / 1000;
    sheet.innerHTML = `
      <div class="lsh"><b>LAND FOR SALE</b><button id="ldX" aria-label="Close">✕</button></div>
      <div class="lpic">${art(p)}<span class="tag ${o ? 'own' : t ? 'theirs' : disc ? 'deal' : ''}">${o ? 'YOURS' : t ? `OWNED BY ${esc(t.name).toUpperCase()}` : marks.auction.has(k) ? 'AT AUCTION' : disc ? `DEAL · ${Math.round(disc * 100)}% OFF` : 'FOR SALE'}</span></div>
      <div class="lbody">
        <div class="lt"><div><b>Land plot</b><span>${esc(p.name)}</span></div><div class="lp"><strong>${usd(o ? v : price)}</strong><span>${disc && !o && !t ? `<s>${usd(v)}</s> value` : usd(p.ppm * s.reIndex, 2) + ' a m²'}</span></div></div>
        <div class="stats">
          <div>Size<b>${(p.area / 10000).toFixed(2)} ha</b></div><div>Side<b>${SIZE} m</b></div>${o && o.biz ? '' : `<div>Lease<b class="up">${usd(v * LEASE * 7)}/wk</b></div>`}<div>From Wall St<b>${wall.toFixed(1)} km</b></div>
          <div>Your cash<b>${usd(s.cash, 2)}</b></div>${o ? `<div>You paid<b>${usd(o.paid)}</b></div>${o.biz ? '' : `<div>Lease earned<b class="up">${usd(o.earned, 2)}</b></div>`}` : ''}
        </div>
        ${o && window.Biz ? Biz.section(p) : ''}
        ${window.Trade ? Trade.block({ kind: 'p', key: netKey(p), mine: !!o, value: v, floors: 1, name: p.name, hasBiz: !!(o && o.biz) }) : ''}
        <div class="lbtns">
          ${!o && !t && !marks.auction.has(k) ? `<button class="buy" id="ldBuy">Buy this plot · ${usd(price)}</button>` : ''}
          ${o ? `<button class="sell" id="ldSell">Sell${o.biz ? ' with the business' : ''} · ${usd(v * (1 - M.PROP_FEE) + (o.biz && window.Biz ? Biz.worth(o.biz) : 0))}</button>` : ''}
          ${marks.auction.has(k) && !o ? '<button class="buy" id="ldAuc">See the auction</button>' : ''}
          <button class="plain" id="ldFly">Fly there</button>
        </div>
        <p class="note">Open land around ${esc(CITY.name)}. Build a farm, mine, oil well or shop on it, or let a farmer lease it. Land follows the property market. Selling costs ${M.PROP_FEE * 100}%.</p>
      </div>`;
    sheet.hidden = false;
    $('ldX').onclick = close;
    $('ldFly').onclick = () => select(p, true);
    if ($('ldAuc')) $('ldAuc').onclick = () => { close(); Property.open('auctions'); };
    if ($('ldBuy')) $('ldBuy').onclick = () => CSUI.story(`<small>BUY LAND</small><b>${esc(p.name)}</b><p>${(p.area / 10000).toFixed(2)} hectares for ${usd(price)}. It earns about ${usd(v * LEASE * 7)} a week from a farmer's lease.</p>`,
      [['Buy it', async () => { const r = await buy(p, price); if (!r.ok) toast('Can\'t buy', r.why); draw(); }], ['Not now', () => {}]]);
    if (window.Biz) Biz.bind(p, sheet, draw);
    if (window.Trade) Trade.bind(sheet, { kind: 'p', key: netKey(p), plot: p, floors: 1, name: p.name, value: v, redraw: draw });
    if ($('ldSell')) $('ldSell').onclick = () => { const r = sell(p); if (!r.ok) toast('Can\'t sell', r.why); draw(); };
  }

  // ---------- buying and selling ----------
  async function buy(p, price) { // price: the asking price, a deal or an auction's
    const k = keyOf(p);
    if (mine(p)) return { ok: false, why: 'You already own it' };
    if (M.state.evicted) return { ok: false, why: 'You were evicted' };
    if (price > M.state.cash) return { ok: false, why: `You need ${usd(price)} in cash` };
    if (window.Net) { const c = await Net.claim(netKey(p), 1, p.name); if (!c.ok) return c; } // the shared world first
    if (price > M.state.cash) { if (window.Net) Net.release(netKey(p)); return { ok: false, why: `You need ${usd(price)} in cash` }; }
    M.state.cash = +(M.state.cash - price).toFixed(2);
    S()[k] = { city: CITY.id, i: p.i, j: p.j, name: p.name, area: p.area, ppm: p.ppm, paid: +price.toFixed(2), bought: M.state.time, earned: 0 };
    M.save(); M.emit('land', { kind: 'bought', id: k, cost: price });
    toast('Land bought', `${p.name} for ${usd(price)}. The lease starts tonight.`);
    drawFills();
    return { ok: true };
  }
  function sell(p) {
    const k = keyOf(p), o = S()[k];
    if (!o) return { ok: false, why: 'You don\'t own this' };
    const gets = +(value(p) * (1 - M.PROP_FEE) + (o.biz && window.Biz ? Biz.worth(o.biz) : 0)).toFixed(2); // a business on it sells for a third of what went in
    delete S()[k]; M.state.cash = +(M.state.cash + gets).toFixed(2);
    if (window.Net) Net.release(netKey(p));
    M.save(); M.emit('land', { kind: 'sold', id: k, gets });
    toast('Land sold', `${p.name} for ${usd(gets)}.`);
    drawFills();
    return { ok: true, gets };
  }
  const plotValue = o => o.area * o.ppm * M.state.reIndex;
  M.addWorth(st => Object.values(st.land || {}).reduce((s, o) => s + o.area * o.ppm * st.reIndex, 0));
  M.onDay(st => { // the nightly lease, in every city you own land
    let income = 0;
    for (const o of Object.values(st.land || {})) { if (o.biz) continue; const r = plotValue(o) * LEASE; o.earned += r; income += r; } // a business replaces the lease
    if (income > 0) { st.cash = +(st.cash + income).toFixed(2); M.emit('land', { kind: 'income', income }); }
  });
  M.on((type, d) => {
    if (type === 'reset') drawFills();
    if (type === 'land' && d.kind === 'income') toast('Lease paid', `Farmers paid ${usd(d.income, 2)} for your land overnight.`);
  });
  // multiplayer: show other players' plots, and register land bought while playing alone
  if (window.Net) Net.on(async t => {
    if (t === 'owners') { drawFills(); if (sel && !sheet.hidden) draw(); }
    if (t === 'me' && Net.status === 'online') for (const [k, o] of Object.entries(S())) {
      if (o.city !== CITY.id) continue;
      const p = plots.get(o.i + ',' + o.j); if (!p) continue;
      const other = theirs(p);
      if (other) { delete S()[k]; M.state.cash = +(M.state.cash + o.paid).toFixed(2); M.save(); toast('Land returned', `${other.name} owns ${o.name} in the shared world. You got your money back in full.`); }
      else await Net.claim(netKey(p), 1, o.name);
    }
  });

  return {
    init, tap, select: (k, fly) => { const p = typeof k === 'string' ? plots.get(k.split(':').slice(-2).join(',')) : k; if (p) select(p, fly); }, close, buy, sell, value, plots, keyOf, mine, theirs, SIZE, LEASE, art,
    redraw() { if (sel && !sheet.hidden) draw(); },
    setMarks(m) { marks = m; drawFills(); if (sel && !sheet.hidden) draw(); }, get selected() { return sel; }
  };
})();
