// Capital Street businesses (Goal 14): farms, mines, oil wells and shops on your land.
// Each business costs money to build and a little upkeep every night, and fills its own storage with goods (up to
// three days' worth). Collecting takes a visit (that's the effort), and goods sell to the city's buyers, whose price
// drops the more everyone sells in a day and recovers overnight, so income rewards setup and effort without
// flooding the economy. Shops turn crates from your farms into cash at a better price: the first production chain.
// A business lives on its plot's save record (state.land[key].biz), so it goes with the plot when you sell it.
'use strict';
window.Biz = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = (v, dp = 0) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // goods: base price and how much the city buys in a day before the price halves
  const GOODS = {
    crates: { name: 'Crates of produce', unit: 'crate', price: 10, demand: 600, icon: '🌾' },
    ore: { name: 'Iron ore', unit: 't', price: 40, demand: 400, icon: '⛏' },
    oil: { name: 'Crude oil', unit: 'bbl', price: 160, demand: 250, icon: '🛢' },
    // made in factories (Goal 15)
    food: { name: 'Packaged food', unit: 'box', price: 58, demand: 300, icon: '📦' },
    steel: { name: 'Steel', unit: 't', price: 210, demand: 150, icon: '🔩' },
    fuel: { name: 'Fuel', unit: 'drum', price: 430, demand: 120, icon: '⛽' },
    machines: { name: 'Machinery', unit: 'machine', price: 1500, demand: 40, icon: '⚙' }
  };
  const TYPES = {
    farm: { name: 'Farm', cost: 6000, upkeep: 30, makes: 'crates', out: 24, need: null, blurb: 'Grows produce. Rich soil grows more.' },
    mine: { name: 'Iron mine', cost: 28000, upkeep: 150, makes: 'ore', out: 30, need: 'ore', blurb: 'Digs iron ore. Needs an ore deposit.' },
    oil: { name: 'Oil well', cost: 70000, upkeep: 350, makes: 'oil', out: 20, need: 'oil', blurb: 'Pumps crude oil. Needs an oil field.' },
    shop: { name: 'Shop', cost: 15000, upkeep: 90, makes: null, out: 40, need: 'town', blurb: 'Sells crates from your farms at $18 each, up to 40 a day; a little income without stock. Needs to be near town.' },
    // factories (Goal 15): take goods from your warehouse every night and ship what they make back to it
    food: { name: 'Food factory', cost: 20000, upkeep: 120, makes: 'food', out: 40, uses: { crates: 4 }, blurb: 'Packs 4 crates into a box of food.' },
    steel: { name: 'Steel mill', cost: 45000, upkeep: 220, makes: 'steel', out: 20, uses: { ore: 3 }, blurb: 'Smelts 3 t of ore into 1 t of steel.' },
    refinery: { name: 'Refinery', cost: 90000, upkeep: 400, makes: 'fuel', out: 15, uses: { oil: 2 }, blurb: 'Refines 2 barrels of crude into a drum of fuel.' },
    machines: { name: 'Machine works', cost: 160000, upkeep: 600, makes: 'machines', out: 6, uses: { steel: 2, fuel: 1 }, blurb: 'Builds a machine from 2 t of steel and a drum of fuel.' }
  };
  const factory = type => !!TYPES[type].uses;
  const recipe = T => Object.entries(T.uses).map(([g, q]) => `${q} ${GOODS[g].unit} ${GOODS[g].name.toLowerCase()}`).join(' + ');
  const LEVELS = [1, 1.6, 2.5], MAXLVL = 3, STORE_DAYS = 3;
  const upCost = b => Math.round(TYPES[b.type].cost * (b.lvl === 1 ? 1.5 : 2.2));
  const output = b => TYPES[b.type].out * LEVELS[b.lvl - 1] * (b.rich || 1);
  const upkeep = b => Math.round(TYPES[b.type].upkeep * (1 + (b.lvl - 1) * 0.4));
  const cap = b => Math.round(output(b) * STORE_DAYS);

  // ---------- what's under each plot: soil, ore, oil, and how close town is ----------
  const h = (i, j, s) => { let x = Math.imul(i * 73856093 ^ j * 19349663 ^ s * 83492791, 2654435761) >>> 0; x ^= x >>> 15; return (x >>> 0) / 4294967296; };
  function ground(p) {
    const d = Math.hypot(p.x, p.z);
    return {
      soil: Math.round((0.6 + h(p.i, p.j, 1) * 0.9) * 100) / 100,
      ore: h(p.i, p.j, 2) < 0.18 ? Math.round((0.7 + h(p.i, p.j, 3) * 0.8) * 100) / 100 : 0,
      oil: h(p.i, p.j, 4) < 0.08 ? Math.round((0.7 + h(p.i, p.j, 5) * 0.9) * 100) / 100 : 0,
      town: d < 5500 ? Math.round((1.4 - d / 5500 * 0.8) * 100) / 100 : 0
    };
  }
  const richFor = (type, g) => factory(type) ? 1 : type === 'farm' ? g.soil : type === 'mine' ? g.ore : type === 'oil' ? g.oil : g.town;

  // ---------- state ----------
  const fill = (o, v) => { for (const g of Object.keys(GOODS)) if (o[g] == null) o[g] = v; return o; }; // goods added since the save was made
  const inv = () => fill(M.state.goods || (M.state.goods = {}), 0);
  const mult = () => fill(M.state.gmult || (M.state.gmult = {}), 1);
  const asks = () => M.state.asks || (M.state.asks = {}); // your own price lists: good -> { qty, price }
  const all = () => Object.entries(M.state.land || {}).filter(([, o]) => o.biz);
  const priceOf = g => GOODS[g].price * mult()[g] * Math.sqrt(M.state.reIndex);
  function sellValue(g, q) { // selling q units walks the price down: each unit takes a slice off it
    const k = 0.5 / GOODS[g].demand, m0 = mult()[g], m1 = Math.max(0.25, m0 * Math.exp(-k * q));
    return { total: GOODS[g].price * Math.sqrt(M.state.reIndex) * (m0 - m1) / k, after: m1 };
  }

  // ---------- doing things ----------
  function build(p, type) {
    const o = Land.mine(p), T = TYPES[type], g = ground(p), rich = richFor(type, g);
    if (!o) return { ok: false, why: 'Buy the plot first' };
    if (o.biz) return { ok: false, why: 'There is already a business here' };
    if (T.need && !rich) return { ok: false, why: T.need === 'town' ? 'Too far from town for a shop' : `No ${T.need === 'ore' ? 'ore deposit' : 'oil field'} under this plot` };
    if (T.cost > M.state.cash) return { ok: false, why: `You need ${usd(T.cost)} in cash` };
    M.state.cash = +(M.state.cash - T.cost).toFixed(2);
    o.biz = { type, lvl: 1, rich, stock: 0, spent: T.cost, built: M.state.time, made: 0, earned: 0 };
    M.save(); M.emit('biz', { kind: 'built', type, cost: T.cost }); draw3d();
    toast(`${T.name} built`, T.makes ? `It makes about ${Math.round(output(o.biz))} ${GOODS[T.makes].unit} a day. Come back to collect.` : 'It opens tonight. Keep crates in stock for the best takings.');
    return { ok: true };
  }
  function upgrade(o) {
    const b = o.biz, c = upCost(b);
    if (b.lvl >= MAXLVL) return { ok: false, why: 'Already at the top level' };
    if (c > M.state.cash) return { ok: false, why: `You need ${usd(c)} in cash` };
    M.state.cash = +(M.state.cash - c).toFixed(2); b.lvl++; b.spent += c;
    M.save(); M.emit('biz', { kind: 'upgraded', type: b.type, lvl: b.lvl, cost: c }); draw3d();
    toast(`${TYPES[b.type].name} upgraded`, `Level ${b.lvl}: about ${Math.round(output(b))} a day.`);
    return { ok: true };
  }
  function collect(o) {
    const b = o.biz, T = TYPES[b.type];
    if (!T.makes || T.uses || b.stock < 1) return 0; // factories ship straight to the warehouse
    const q = Math.floor(b.stock); inv()[T.makes] += q; b.stock -= q;
    M.save(); M.emit('biz', { kind: 'collected', good: T.makes, q });
    return q;
  }
  function collectAll() { let n = 0; for (const [, o] of all()) n += collect(o); if (n) toast('Collected', `${n.toLocaleString('en-US')} units into your warehouse.`); else toast('Nothing to collect', 'Your businesses fill up overnight.'); draw2d(); return n; }
  function sell(g, q) {
    q = Math.min(Math.floor(q), inv()[g]);
    if (!(q > 0)) return { ok: false, why: 'Nothing to sell' };
    const v = sellValue(g, q);
    inv()[g] -= q; mult()[g] = v.after; M.state.cash = +(M.state.cash + v.total).toFixed(2);
    M.save(); M.emit('biz', { kind: 'sold', good: g, q, total: v.total });
    return { ok: true, total: v.total, q };
  }
  function demolish(o) { const b = o.biz, back = b.spent * 0.3; delete o.biz; M.state.cash = +(M.state.cash + back).toFixed(2); M.save(); M.emit('biz', { kind: 'demolished' }); draw3d(); return back; }

  // ---------- every night: upkeep, production, shop takings, prices recover ----------
  M.onDay(S => {
    let made = 0, takings = 0, unpaid = 0, full = 0, built = 0, listed = 0;
    const goods = fill(S.goods || (S.goods = {}), 0), ORDER = ['food', 'steel', 'refinery', 'machines'];
    const list = Object.values(S.land || {}).filter(o => o.biz).sort((a, b) => ORDER.indexOf(a.biz.type) - ORDER.indexOf(b.biz.type)); // raw goods first, then each factory in chain order
    for (const o of list) {
      const b = o.biz;
      const up = upkeep(b);
      if (S.cash < up) { unpaid++; continue; } // can't pay the workers: nothing gets made tonight
      S.cash = +(S.cash - up).toFixed(2);
      const T = TYPES[b.type];
      if (T.uses) { // a factory: as many as its inputs allow, straight to the warehouse
        let n = Math.floor(output(b));
        for (const [g, q] of Object.entries(T.uses)) n = Math.min(n, Math.floor(goods[g] / q));
        for (const [g, q] of Object.entries(T.uses)) goods[g] -= n * q;
        goods[T.makes] += n; b.made += n; built += n; b.last = n;
      } else if (T.makes) { const before = b.stock; b.stock = Math.min(cap(b), b.stock + output(b)); made += b.stock - before; b.made += b.stock - before; if (b.stock >= cap(b)) full++; }
      else { // a shop: sells crates from your warehouse, more in busier spots
        const sold = Math.min(goods.crates, Math.floor(output(b))), cash = sold * 18 * Math.sqrt(S.reIndex) + 60 * b.rich;
        goods.crates -= sold; S.cash = +(S.cash + cash).toFixed(2); b.earned += cash; takings += cash;
      }
    }
    const gm = fill(S.gmult || (S.gmult = {}), 1);
    // your price lists: buyers take more the further below the city's price you ask, and none above 1.3×
    for (const [g, a] of Object.entries(S.asks || {})) {
      if (!GOODS[g] || !(a.qty > 0)) continue;
      const city = GOODS[g].price * gm[g] * Math.sqrt(S.reIndex), keen = Math.min(1, Math.max(0, (1.3 - a.price / city) / 0.6));
      const q = Math.min(a.qty, Math.floor(GOODS[g].demand * 0.6 * keen));
      if (q < 1) continue;
      a.qty -= q; const cash = q * a.price; S.cash = +(S.cash + cash).toFixed(2); listed += cash;
      gm[g] = Math.max(0.25, gm[g] * Math.exp(-0.5 / GOODS[g].demand * q * 0.5)); // your sales still weigh on the price
      if (!a.qty) delete S.asks[g];
    }
    for (const g of Object.keys(GOODS)) gm[g] = Math.min(1.3, Math.max(0.25, gm[g] + (1 - gm[g]) * 0.35 + (Math.random() - 0.5) * 0.08));
    if (made || takings || unpaid || built || listed) M.emit('biz', { kind: 'night', made, takings, unpaid, full, built, listed });
  });
  M.on((type, d) => {
    if (type === 'event' && d.kind === 'storm') for (const [, o] of all()) if (o.biz.type === 'farm') o.biz.stock *= 0.5; // a hurricane flattens the crops
    if (type === 'event' && (d.kind === 'crash' || d.kind === 'fed')) mult().oil *= 0.85;
    if (type === 'biz' && d.kind === 'night') {
      const bits = [];
      if (d.made) bits.push(`made ${Math.round(d.made).toLocaleString('en-US')} units`);
      if (d.takings) bits.push(`your shops took ${usd(d.takings)}`);
      if (d.built) bits.push(`factories made ${Math.round(d.built).toLocaleString('en-US')} goods`);
      if (d.listed) bits.push(`buyers paid ${usd(d.listed)} at your prices`);
      if (d.full) bits.push(`${d.full} ${d.full > 1 ? 'are' : 'is'} full: collect!`);
      if (d.unpaid) bits.push(`${d.unpaid} couldn't pay upkeep and stood still`);
      toast('Your businesses overnight', bits.join(', ') + '.');
    }
    if (type === 'biz' || type === 'land' || type === 'reset') { draw2d(); if (type !== 'biz' || d.kind !== 'night') draw3d(); }
  });
  M.addWorth(S => { // businesses resell for a third of what went in; goods at today's price
    let w = 0;
    for (const o of Object.values(S.land || {})) if (o.biz) w += o.biz.spent * 0.3;
    for (const [g, q] of Object.entries(S.goods || {})) if (GOODS[g]) w += q * GOODS[g].price * ((S.gmult || {})[g] || 1) * Math.sqrt(S.reIndex) * 0.9;
    for (const a of Object.values(S.asks || {})) w += a.qty * a.price * 0.9;
    return w;
  });

  // ---------- on the plot's card ----------
  function section(p) {
    const o = Land.mine(p); if (!o) return '';
    const g = ground(p), b = o.biz;
    const facts = `<div class="ground"><span>Soil <b>${Math.round(g.soil * 100)}%</b></span><span>Ore <b>${g.ore ? Math.round(g.ore * 100) + '%' : 'none'}</b></span><span>Oil <b>${g.oil ? Math.round(g.oil * 100) + '%' : 'none'}</b></span><span>Town <b>${g.town ? 'near' : 'far'}</b></span></div>`;
    if (!b) return `<div class="biz"><small>BUILD A BUSINESS</small>${facts}<div class="bopts">${Object.entries(TYPES).map(([k, T]) => {
      const r = richFor(k, g), no = T.need && !r;
      return `<button class="bopt ${k}" data-build="${k}" ${no ? 'disabled' : ''}><i></i><b>${T.name}</b><span>${usd(T.cost)} · ${no ? (T.need === 'town' ? 'too far from town' : 'nothing here') : T.uses ? `up to ${T.out} ${GOODS[T.makes].unit}/day` : T.makes ? `~${Math.round(T.out * r)} ${GOODS[T.makes].unit}/day` : `${Math.round(r * 100)}% footfall`}</span></button>`;
    }).join('')}</div><p class="note">${Object.values(TYPES).map(T => `${T.name}: ${T.blurb}`).join(' ')} Factories take what they need from your warehouse every night.</p></div>`;
    const T = TYPES[b.type], pct = T.makes && !T.uses ? Math.min(100, b.stock / cap(b) * 100) : 0;
    return `<div class="biz own ${b.type}"><small>${T.name.toUpperCase()} · LEVEL ${b.lvl}</small>${T.uses ? '' : facts}
      ${T.uses ? `<p class="note">Every night: ${recipe(T)} → 1 ${GOODS[T.makes].unit} of ${GOODS[T.makes].name.toLowerCase()}, up to ${Math.round(output(b))}. In your warehouse: ${Object.keys(T.uses).map(g => `${inv()[g].toLocaleString('en-US')} ${GOODS[g].unit} ${GOODS[g].name.toLowerCase()}`).join(', ')}. Last night it made ${b.last || 0}.</p>`
        : T.makes ? `<div class="store"><div class="sbar"><i style="width:${pct}%"></i></div><span>${Math.floor(b.stock)} / ${cap(b)} ${GOODS[T.makes].unit} in storage</span></div>` : `<p class="note">Sells up to ${Math.round(output(b))} crates a night from your warehouse (you have ${inv().crates}). Takings so far ${usd(b.earned)}.</p>`}
      <div class="stats"><div>Makes<b>${T.makes ? `${T.uses ? 'up to ' : ''}${Math.round(output(b))} ${GOODS[T.makes].unit}/day` : 'shop takings'}</b></div><div>Upkeep<b class="dn">${usd(upkeep(b))}/day</b></div><div>Invested<b>${usd(b.spent)}</b></div><div>${T.makes ? 'Made so far' : 'Earned'}<b>${T.makes ? Math.round(b.made).toLocaleString('en-US') : usd(b.earned)}</b></div></div>
      <div class="lbtns">${T.makes && !T.uses ? `<button class="buy" id="bzCol" ${b.stock < 1 ? 'disabled' : ''}>Collect ${Math.floor(b.stock)} ${GOODS[T.makes].unit}</button>` : ''}
        ${b.lvl < MAXLVL ? `<button class="plain" id="bzUp">Upgrade to level ${b.lvl + 1} · ${usd(upCost(b))}</button>` : ''}
        <button class="plain" id="bzDel">Demolish (get ${usd(b.spent * 0.3)} back)</button></div></div>`;
  }
  function bind(p, sheet, redraw) {
    const o = Land.mine(p); if (!o) return;
    sheet.querySelectorAll('[data-build]').forEach(btn => btn.onclick = () => {
      const T = TYPES[btn.dataset.build];
      CSUI.story(`<small>BUILD</small><b>${T.name} on ${esc(p.name)}</b><p>${T.blurb} It costs ${usd(T.cost)} to build and ${usd(T.upkeep)} a night to run.</p>`, [['Build it', () => { const r = build(p, btn.dataset.build); if (!r.ok) toast('Can\'t build', r.why); redraw(); }], ['Not now', () => {}]]);
    });
    if ($('bzCol')) $('bzCol').onclick = () => { const q = collect(o); toast('Collected', `${q} ${GOODS[TYPES[o.biz.type].makes].unit} into your warehouse. Sell them in Property → Business.`); redraw(); };
    if ($('bzUp')) $('bzUp').onclick = () => { const r = upgrade(o); if (!r.ok) toast('Can\'t upgrade', r.why); redraw(); };
    if ($('bzDel')) { let arm = 0; $('bzDel').onclick = () => { if (Date.now() - arm > 3000) { arm = Date.now(); $('bzDel').textContent = 'Tap again to demolish'; return; } const back = demolish(o); toast('Demolished', `You got ${usd(back)} back.`); redraw(); }; }
  }

  // ---------- the Business tab in the property screen ----------
  function drawTab(body) {
    const list = all(), here = list.filter(([, o]) => o.city === CITY.id), I = inv();
    const ready = list.reduce((s, [, o]) => s + (TYPES[o.biz.type].makes && !TYPES[o.biz.type].uses ? Math.floor(o.biz.stock) : 0), 0);
    let html = `<div class="cards"><div>Businesses<b>${list.length}</b></div><div>Ready to collect<b>${ready.toLocaleString('en-US')}</b></div><div>Upkeep<b class="dn">${usd(list.reduce((s, [, o]) => s + upkeep(o.biz), 0))}/day</b></div></div>`;
    html += `<small class="ahd">YOUR WAREHOUSE · SELL TO THE CITY NOW, OR SET YOUR OWN PRICE</small><div class="goods">${Object.entries(GOODS).filter(([g]) => I[g] >= 1 || asks()[g] || ['crates', 'ore', 'oil'].includes(g)).map(([g, G]) => {
      const m = mult()[g], q = I[g], a = asks()[g];
      return `<div class="good"><span class="gi">${G.icon}</span><div><b>${G.name}</b><span>${q.toLocaleString('en-US')} ${G.unit} · ${usd(priceOf(g), 2)} each <em class="${m >= 1 ? 'up' : 'dn'}">${m >= 1 ? '▲' : '▼'} ${Math.round((m - 1) * 100)}%</em></span>
          ${a ? `<span class="ask">Listed: ${a.qty.toLocaleString('en-US')} at ${usd(a.price, 2)} <button class="lnk" data-unask="${g}">take back</button></span>` : q >= 1 ? `<form class="askf" data-ask="${g}"><input type="number" min="1" max="${q}" value="${q}" aria-label="How many"> at $<input type="number" min="0.01" step="0.01" value="${priceOf(g).toFixed(2)}" aria-label="Your price"><button class="btn">List</button></form>` : ''}</div>
        <div class="gb">${[0.25, 1].map(f => `<button class="btn" data-sell="${g}" data-f="${f}" ${q < 1 ? 'disabled' : ''}>${f === 1 ? 'Sell all' : 'Sell ¼'}<small>${q >= 1 ? usd(sellValue(g, Math.max(1, Math.floor(q * f))).total) : '-'}</small></button>`).join('')}</div></div>`;
    }).join('')}</div><p class="note">Selling now: the more anyone sells in a day, the lower the price goes; it recovers overnight. Your own price: buyers take a little each night, more the cheaper you ask, and nothing above 1.3× the city's price. Shops sell your crates for more.</p>`;
    // the factory planner: what it takes to make a product every day, and what it earns at today's prices
    html += `<small class="ahd">FACTORY PLANNER</small><form class="plan" id="bzPlan"><span>Make</span><input type="number" min="1" value="${plan.n}" aria-label="How many a day"><select aria-label="Product">${['food', 'steel', 'fuel', 'machines'].map(g => `<option value="${g}" ${g === plan.g ? 'selected' : ''}>${GOODS[g].name} (${GOODS[g].unit})</option>`).join('')}</select><span>a day</span></form>${planHTML(plan.g, plan.n)}`;
    html += `<small class="ahd">YOUR BUSINESSES${here.length < list.length ? ` (${list.length - here.length} in other cities)` : ''}</small><div class="lbtns"><button class="buy" id="bzAll" ${ready ? '' : 'disabled'}>Collect everything (${ready.toLocaleString('en-US')})</button></div>`;
    html += here.length ? here.map(([k, o]) => { const b = o.biz, T = TYPES[b.type]; return `<button class="bzrow ${b.type}" data-plot="${o.i},${o.j}"><i></i><div><b>${T.name} · level ${b.lvl}</b><span>${esc(o.name)}</span></div><span>${T.makes ? `${Math.floor(b.stock)} / ${cap(b)} ${GOODS[T.makes].unit}` : usd(b.earned)}</span></button>`; }).join('')
      : '<p class="note">No businesses yet. Buy a land plot (Land tab), then build a farm, mine, oil well or shop on it.</p>';
    if (window.Company) html += Company.section();
    if (window.Trade) html += Trade.exchangeHTML();
    body.innerHTML = html;
    body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const g = b.dataset.sell, r = sell(g, Math.max(1, Math.floor(inv()[g] * +b.dataset.f))); if (r.ok) toast('Sold', `${r.q.toLocaleString('en-US')} ${GOODS[g].unit} for ${usd(r.total)}.`); else toast('Can\'t sell', r.why); draw2d(); });
    if ($('bzAll')) $('bzAll').onclick = collectAll;
    if (window.Company) Company.bind(body);
    if (window.Trade) Trade.bindExchange(body);
    body.querySelectorAll('form[data-ask]').forEach(f => f.onsubmit = e => { e.preventDefault(); const [q, p] = [...f.querySelectorAll('input')].map(i => +i.value), r = ask(f.dataset.ask, q, p); if (!r.ok) toast('Can\'t list', r.why); else toast('Listed', `Buyers pick it up overnight. Closer to the city's price sells faster.`); draw2d(); });
    body.querySelectorAll('[data-unask]').forEach(b => b.onclick = () => { unask(b.dataset.unask); draw2d(); });
    if ($('bzPlan')) $('bzPlan').oninput = () => { const f = $('bzPlan'); plan = { n: Math.max(1, Math.min(10000, +f.querySelector('input').value || 1)), g: f.querySelector('select').value }; const out = $('bzPlanOut'); if (out) out.outerHTML = planHTML(plan.g, plan.n); };
    body.querySelectorAll('[data-plot]').forEach(b => b.onclick = () => { $('props').hidden = true; Land.select('x:' + b.dataset.plot.replace(',', ':'), true); });
  }
  // ---------- your own price lists ----------
  function ask(g, q, price) {
    q = Math.min(Math.floor(q), inv()[g]);
    if (!(q > 0)) return { ok: false, why: 'Nothing to list' };
    if (!(price > 0)) return { ok: false, why: 'Set a price' };
    inv()[g] -= q; asks()[g] = { qty: q, price: +price.toFixed(2) }; M.save();
    return { ok: true };
  }
  function unask(g) { const a = asks()[g]; if (!a) return; inv()[g] += a.qty; delete asks()[g]; M.save(); }

  // ---------- the factory planner ----------
  let plan = { g: 'machines', n: 6 };
  const MAKER = { crates: 'farm', ore: 'mine', oil: 'oil', food: 'food', steel: 'steel', fuel: 'refinery', machines: 'machines' };
  function needs(g, n, acc) { // walk the chain down to farms, mines and wells (level 1, an average plot)
    const t = MAKER[g], T = TYPES[t];
    acc[t] = (acc[t] || 0) + n / T.out;
    if (T.uses) for (const [i, q] of Object.entries(T.uses)) needs(i, n * q, acc);
    return acc;
  }
  function planHTML(g, n) {
    const acc = needs(g, n, {}), rows = Object.entries(acc).map(([t, k]) => [t, Math.ceil(k - 1e-9)]);
    const cost = rows.reduce((s, [t, k]) => s + k * TYPES[t].cost, 0), up = rows.reduce((s, [t, k]) => s + k * TYPES[t].upkeep, 0);
    const rev = n * priceOf(g), plots = rows.reduce((s, [, k]) => s + k, 0);
    return `<div class="planout" id="bzPlanOut">${rows.map(([t, k]) => `<div class="bzrow ${t}"><i></i><div><b>${k} × ${TYPES[t].name}</b><span>${TYPES[t].uses ? recipe(TYPES[t]) + ' → ' + GOODS[TYPES[t].makes].name.toLowerCase() : `${TYPES[t].out} ${GOODS[TYPES[t].makes].unit}/day each${TYPES[t].need ? ` (needs ${TYPES[t].need === 'ore' ? 'an ore deposit' : 'an oil field'})` : ''}`}</span></div><span>${usd(k * TYPES[t].cost)}</span></div>`).join('')}
      <div class="cards"><div>To build<b>${usd(cost)}</b><span>${plots} plots</span></div><div>Upkeep<b class="dn">${usd(up)}/day</b></div><div>Sells for<b class="up">${usd(rev)}/day</b><span>at today's price</span></div></div>
      <p class="note">${rev - up > 0 ? `About ${usd(rev - up)} a day before the price drops from selling that much: pays back in ${Math.ceil(cost / (rev - up))} days.` : 'At today\'s price this chain costs more to run than it earns.'} Rich plots and upgrades need fewer buildings.</p></div>`;
  }

  function draw2d() { if (window.Property && Property.tab === 'business') Property.redraw(); if (Land.selected && !$('listing').hidden) Land.redraw(); }

  // ---------- on the map: crops, a mine's pit and headframe, nodding pumpjacks, a shop ----------
  const mats = {}, m = (c, r = 0.85) => mats[c] || (mats[c] = new THREE.MeshStandardMaterial({ color: lin(c), roughness: r }));
  const box = (w, hh, d, c, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m(c)); o.position.set(x, y + hh / 2, z); o.castShadow = o.receiveShadow = true; return o; };
  let group = null; const jacks = [];
  function model(o) {
    const b = o.biz, g = new THREE.Group(), s = 1 + (b.lvl - 1) * 0.25;
    if (b.type === 'farm') {
      for (let r = 0; r < 6; r++) g.add(box(120, 0.8, 14, r % 2 ? 0xe8c547 : 0x5fae3c, -8, 0.2, -50 + r * 18));
      g.add(box(22 * s, 11 * s, 16 * s, 0xc0392b, 58, 0, -48)); g.add(box(24 * s, 2, 18 * s, 0x6b2a20, 58, 11 * s, -48));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 18 * s, 12), m(0xdfe6ee)).translateX(58).translateY(9 * s).translateZ(-30));
    } else if (b.type === 'mine') {
      const pit = new THREE.Mesh(new THREE.CylinderGeometry(42, 30, 3, 24), m(0x6d6259)); pit.position.y = 0.6; g.add(pit);
      for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) g.add(box(2, 30 * s, 2, 0x3a4048, x * 0.6, 0, z * 0.6));
      g.add(box(16, 3, 16, 0x8a2b1f, 0, 30 * s, 0));
      for (let k = 0; k < 3 + b.lvl; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(9, 8, 10), m(0x7c4a32)); c.position.set(-50 + k * 14, 4, 52); g.add(c); }
    } else if (b.type === 'oil') {
      for (let k = 0; k < b.lvl; k++) {
        const j = new THREE.Group(); j.position.set(-30 + k * 30, 0, -10);
        j.add(box(20, 2, 6, 0x3a4048, 0, 0, 0)); j.add(box(2, 10, 2, 0x3a4048, 0, 2, 0));
        const beam = new THREE.Group(); beam.position.y = 12; beam.add(box(22, 1.6, 2, 0x2b2b2b, 0, -0.8, 0)); beam.add(box(3, 5, 2.4, 0xffd21f, 11, -4, 0));
        j.add(beam); g.add(j); jacks.push(beam);
      }
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 12, 18), m(0xe9eef2, 0.5)); tank.position.set(45, 6, 40); g.add(tank);
    } else if (TYPES[b.type].uses) { // a factory hall with a saw-tooth roof stripe and chimneys
      const c = { food: 0xf0b35a, steel: 0x8a95a5, refinery: 0xdfe4ea, machines: 0x5b7bd6 }[b.type];
      g.add(box(70 * s, 16, 44, c, -10, 0, -10)); g.add(box(72 * s, 3, 46, 0x3a4048, -10, 16, -10));
      for (let k = 0; k < (b.type === 'refinery' ? 3 : 1) + b.lvl - 1; k++) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 34, 12), m(b.type === 'refinery' ? 0xe9eef2 : 0xa0432c)); ch.position.set(30 + k * 10, 17, -30); g.add(ch); }
      g.add(box(30, 0.4, 40, 0x3e4046, 40, 0, 40));
      for (let k = 0; k < 4; k++) g.add(box(8, 6, 8, 0xc8a26b, 30 + (k % 2) * 12, 0, 30 + Math.floor(k / 2) * 12)); // crates and pallets in the yard
    } else {
      g.add(box(40 * s, 9, 26, 0xf3efe6, 0, 0, 0)); g.add(box(42 * s, 2, 6, 0xff5fa2, 0, 7, 15)); g.add(box(24, 0.4, 30, 0x3e4046, 0, 0, 34));
    }
    g.position.set(o.i * Land.SIZE + Land.SIZE / 2, 0.6, o.j * Land.SIZE + Land.SIZE / 2);
    return g;
  }
  function draw3d() {
    if (group) { scene.remove(group); group.traverse(x => { if (x.geometry) x.geometry.dispose(); }); }
    jacks.length = 0; group = new THREE.Group();
    for (const [, o] of all()) if (o.city === CITY.id) group.add(model(o));
    scene.add(group);
  }
  let t = 0;
  frameHooks.push((dt, dist) => { if (!group) return; group.visible = dist < 30000; t += dt; jacks.forEach((j, k) => { j.rotation.z = Math.sin(t * 1.6 + k) * 0.28; }); });
  const boot = setInterval(() => { if (window.CS && $('load').hidden && Land.plots.size) { clearInterval(boot); draw3d(); } }, 300);

  return { TYPES, GOODS, ground, build, upgrade, collect, collectAll, sell, sellValue, priceOf, section, bind, drawTab, worth: b => b.spent * 0.3, output, cap, inv, ask, unask, needs };
})();
