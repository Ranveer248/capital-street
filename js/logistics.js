// Capital Street logistics (Goal 18): ports, ships, air freight and truck fleets.
// Each city's buyers pay their own prices: Tokyo wants ore and steel, Dubai food and machines, London produce and
// oil. Send goods from your warehouse to any other city you've opened: by ship (cheap, about a game day per 6,000 km,
// needs a port of yours in the city you ship from) or by air (fast, dear). They sell on arrival at that city's price,
// which drops as you sell and recovers overnight. Truck fleets pick up from your farms, mines and wells every night
// for a fee, so you don't have to collect by hand. Ships you send or expect sail in and out of your port on the map.
'use strict';
window.Logistics = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = (v, dp = 0) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const PRICE = {
    nyc: {}, london: { crates: 1.2, oil: 1.15, food: 1.15, fuel: 1.1, ore: 0.9 },
    tokyo: { ore: 1.3, steel: 1.25, machines: 1.2, crates: 1.15, oil: 1.1 },
    hongkong: { steel: 1.2, food: 1.25, machines: 1.3, fuel: 1.15, crates: 0.9 },
    dubai: { crates: 1.4, food: 1.3, machines: 1.35, oil: 0.75, fuel: 0.85 }
  };
  const MODES = { ship: { name: 'Ship', icon: '🚢', fix: 0.02, perKm: 0.000008, kmDay: 6000 }, air: { name: 'Air freight', icon: '✈', fix: 0.08, perKm: 0.00004, kmDay: 60000 } };
  const TRUCK = 40; // a night, for each farm, mine or well a fleet picks up from
  const S = () => M.state;
  const ships = () => S().ships || (S().ships = []);
  const trucks = () => S().trucks || (S().trucks = {});
  const cm = (c, g) => { const x = S().cmult || (S().cmult = {}); x[c] = x[c] || {}; if (x[c][g] == null) x[c][g] = 1; return x[c][g]; };
  const km = (a, b) => { const A = CITIES[a], B = CITIES[b], r = Math.PI / 180, h = Math.sin((B.lat - A.lat) * r / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin((B.lon - A.lon) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  const priceIn = (c, g) => Biz.GOODS[g].price * ((PRICE[c] || {})[g] || 1) * cm(c, g) * Math.sqrt(S().reIndex);
  function quote(to, g, qty, mode) {
    const d = km(CITY.id, to), Md = MODES[mode], G = Biz.GOODS[g];
    const k = 0.5 / G.demand, m0 = cm(to, g), m1 = Math.max(0.25, m0 * Math.exp(-k * qty));
    const gross = G.price * ((PRICE[to] || {})[g] || 1) * Math.sqrt(S().reIndex) * (m0 - m1) / k;
    const cost = qty * Biz.priceOf(g) * (Md.fix + Md.perKm * d);
    return { km: d, days: d / Md.kmDay, gross, cost, net: gross - cost, here: Biz.sellValue(g, qty).total };
  }
  const myPorts = () => Object.values(S().land || {}).filter(o => o.biz && o.biz.type === 'port' && o.city === CITY.id);
  const fmtDays = d => d < 1 ? `${Math.max(1, Math.round(d * 24))} h` : `${d.toFixed(1)} days`;

  function send(to, g, qty, mode) {
    qty = Math.floor(qty);
    const inv = Biz.inv();
    if (!CITIES[to] || to === CITY.id) return { ok: false, why: 'Pick another city' };
    if (!S().cities[to]) return { ok: false, why: `Open a branch in ${CITIES[to].name} first` };
    if (!(qty > 0) || qty > inv[g]) return { ok: false, why: `You have ${inv[g] || 0}` };
    if (mode === 'ship' && !myPorts().length) return { ok: false, why: `Ships need a port of yours in ${CITY.name}: build one on a waterfront plot` };
    const q = quote(to, g, qty, mode);
    if (q.cost > S().cash) return { ok: false, why: `Shipping costs ${usd(q.cost)}` };
    S().cash = +(S().cash - q.cost).toFixed(2); inv[g] -= qty;
    ships().push({ id: Date.now(), from: CITY.id, to, good: g, qty, mode, left: S().time, arrive: S().time + Math.max(60, Math.round(q.days * M.DAY)) });
    M.save(); M.emit('ship', { kind: 'sent' }); return { ok: true, q };
  }
  function arrive() {
    const now = S().time, done = [];
    for (const sh of ships()) if (now >= sh.arrive) done.push(sh);
    if (!done.length) return;
    S().ships = ships().filter(s => !done.includes(s));
    for (const sh of done) {
      const G = Biz.GOODS[sh.good], k = 0.5 / G.demand, m0 = cm(sh.to, sh.good), m1 = Math.max(0.25, m0 * Math.exp(-k * sh.qty));
      const total = G.price * ((PRICE[sh.to] || {})[sh.good] || 1) * Math.sqrt(S().reIndex) * (m0 - m1) / k;
      S().cmult[sh.to][sh.good] = m1; S().cash = +(S().cash + total).toFixed(2);
      M.emit('biz', { kind: 'sold', good: sh.good, q: sh.qty, total });
      toast(`${MODES[sh.mode].icon} Arrived in ${CITIES[sh.to].name}`, `${sh.qty.toLocaleString('en-US')} ${G.unit} of ${G.name.toLowerCase()} sold for ${usd(total)}.`);
    }
    M.save(); if (window.Property) Property.redraw();
  }
  M.on(type => { if (type === 'tick') arrive(); });
  M.onDay(St => {
    for (const c of Object.keys(St.cmult || {})) for (const g of Object.keys(St.cmult[c])) St.cmult[c][g] += (1 - St.cmult[c][g]) * 0.35; // prices recover overnight
    // truck fleets: after the businesses have made tonight's goods, pick them up for a fee
    let n = 0, fee = 0;
    for (const o of Object.values(St.land || {})) {
      const b = o.biz;
      if (!b || !(St.trucks || {})[o.city] || !['farm', 'mine', 'oil'].includes(b.type)) continue;
      if (St.cash < TRUCK) continue;
      St.cash = +(St.cash - TRUCK).toFixed(2); fee += TRUCK;
      n += Biz.collect(o);
    }
    if (fee) M.emit('ship', { kind: 'trucks', n, fee });
  });
  M.addWorth(St => (St.ships || []).reduce((s, sh) => s + sh.qty * Biz.GOODS[sh.good].price * 0.9, 0)); // goods at sea still count
  M.on((type, d) => { if (type === 'ship' && d.kind === 'trucks' && d.n) toast('🚚 Trucks', `Picked up ${d.n.toLocaleString('en-US')} units overnight for ${usd(d.fee)}.`); });

  // ---------- in the Business tab ----------
  let form = { g: 'crates', to: '', mode: 'ship', qty: 100 };
  function section() {
    const open = Object.keys(CITIES).filter(c => c !== CITY.id && S().cities[c]), G = Biz.GOODS, inv = Biz.inv(), raw = Object.values(S().land || {}).filter(o => o.city === CITY.id && o.biz && ['farm', 'mine', 'oil'].includes(o.biz.type)).length;
    if (!open.includes(form.to)) form.to = open[0] || '';
    let html = `<small class="ahd">LOGISTICS · ${myPorts().length ? `${myPorts().length} PORT${myPorts().length > 1 ? 'S' : ''}` : 'NO PORT YET'} IN ${CITY.name.toUpperCase()}</small><div class="logi">`;
    html += `<div class="opts"><div><b>Truck fleet</b><span><button id="lgTruck" class="${trucks()[CITY.id] ? 'on' : ''}">${trucks()[CITY.id] ? `On: picks up from ${raw} business${raw === 1 ? '' : 'es'} every night (${usd(raw * TRUCK)})` : `Hire trucks · ${usd(TRUCK)} a night per farm, mine or well`}</button></span></div></div>`;
    if (!open.length) html += '<p class="note">Open a branch in another city (World) to ship goods there: each city pays its own prices.</p>';
    else {
      const q = form.to && inv[form.g] >= 1 ? quote(form.to, form.g, Math.min(form.qty, inv[form.g]), form.mode) : null;
      html += `<form class="askf xform" id="lgForm">Send <input type="number" min="1" value="${form.qty}" aria-label="How many"> <select id="lgG" aria-label="Goods">${Object.keys(G).map(g => `<option value="${g}" ${g === form.g ? 'selected' : ''}>${G[g].name} (${inv[g].toLocaleString('en-US')})</option>`).join('')}</select>
        to <select id="lgTo" aria-label="City">${open.map(c => `<option value="${c}" ${c === form.to ? 'selected' : ''}>${CITIES[c].flag} ${CITIES[c].name}</option>`).join('')}</select>
        by <select id="lgMode" aria-label="How">${Object.entries(MODES).map(([k, Md]) => `<option value="${k}" ${k === form.mode ? 'selected' : ''}>${Md.icon} ${Md.name}</option>`).join('')}</select><button class="btn pri">Send</button></form>`;
      html += q ? `<p class="note">${CITIES[form.to].name} pays ${usd(priceIn(form.to, form.g), 2)} each (here ${usd(Biz.priceOf(form.g), 2)}). ${Math.round(q.km).toLocaleString('en-US')} km, ${fmtDays(q.days)} game time. Sells for about ${usd(q.gross)}, shipping ${usd(q.cost)}: <b class="${q.net > q.here ? 'up' : 'dn'}">${usd(q.net)}</b> against ${usd(q.here)} selling here.${form.mode === 'ship' && !myPorts().length ? ' Ships need a port: build one on a waterfront plot.' : ''}</p>` : '<p class="note">Nothing of that in your warehouse yet.</p>';
    }
    const list = ships();
    html += list.length ? list.map(sh => `<div class="ares"><b>${MODES[sh.mode].icon} ${sh.qty.toLocaleString('en-US')} ${Biz.GOODS[sh.good].name.toLowerCase()} → ${CITIES[sh.to].name}</b><span>${fmtDays(Math.max(0, (sh.arrive - S().time) / M.DAY))} to go</span></div>`).join('') : '';
    return html + '</div>';
  }
  function bind(body) {
    if ($('lgTruck')) $('lgTruck').onclick = () => { trucks()[CITY.id] = !trucks()[CITY.id]; M.save(); Property.redraw(); };
    const f = $('lgForm'); if (!f) return;
    const read = () => { form = { qty: Math.max(1, +f.querySelector('input').value || 1), g: $('lgG').value, to: $('lgTo').value, mode: $('lgMode').value }; };
    f.onchange = () => { read(); Property.redraw(); };
    f.onsubmit = e => { e.preventDefault(); read(); const r = send(form.to, form.g, form.qty, form.mode); if (!r.ok) toast('Can\'t send', r.why); else toast(`${MODES[form.mode].icon} On its way`, `${form.qty.toLocaleString('en-US')} ${Biz.GOODS[form.g].unit} to ${CITIES[form.to].name}, arriving in ${fmtDays(r.q.days)}.`); Property.redraw(); };
  }

  // ---------- ships sailing out of (and into) your port ----------
  const hull = new THREE.MeshStandardMaterial({ color: lin(0x2b3a67), roughness: 0.7 }), deck = new THREE.MeshStandardMaterial({ color: lin(0xe9eef2), roughness: 0.6 });
  const boxes = [0xd94c3d, 0x3b6fd8, 0xffd21f, 0x2fd47a].map(c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.8 }));
  function boat() {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.BoxGeometry(70, 8, 16), hull); h.position.y = 3; g.add(h);
    const c = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 12), deck); c.position.set(-28, 12, 0); g.add(c);
    for (let k = 0; k < 8; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 6), boxes[k % 4]); b.position.set(-14 + (k % 4) * 11, 9.5, k < 4 ? -3.5 : 3.5); g.add(b); }
    return g;
  }
  const fleet = new Map();
  frameHooks.push((dt, dist) => {
    const port = myPorts()[0];
    for (const [id, b] of fleet) if (!port || !ships().some(s => s.id === id)) { scene.remove(b); fleet.delete(id); }
    if (!port) return;
    const px = port.i * Land.SIZE + Land.SIZE / 2, pz = port.j * Land.SIZE + Land.SIZE / 2, l = Math.hypot(px, pz) || 1, dx = px / l, dz = pz / l;
    for (const sh of ships()) {
      if (sh.mode !== 'ship' || (sh.from !== CITY.id && sh.to !== CITY.id)) continue;
      const t = Math.min(1, Math.max(0, (S().time - sh.left) / Math.max(1, sh.arrive - sh.left)));
      const out = sh.from === CITY.id ? t : 1 - t, d = 120 + out * 40000; // out to sea, or in from it
      let b = fleet.get(sh.id); if (!b) { b = boat(); scene.add(b); fleet.set(sh.id, b); }
      b.visible = d < 9000 && dist < 40000;
      b.position.set(px + dx * d, 0.5, pz + dz * d); b.rotation.y = Math.atan2(-dz, dx) + (sh.from === CITY.id ? 0 : Math.PI);
      b.position.y = 0.5 + Math.sin(performance.now() / 600 + sh.id) * 0.4;
    }
  });

  return { send, quote, priceIn, section, bind, PRICE, MODES, km };
})();
