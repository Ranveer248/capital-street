// Capital Island: the cover, the compact HUD, five-button navigation, one panel at a time, zoom-dependent labels,
// property cards with pictures and Visit, and the first complete economy loop: grow crops at Greenfields, truck them over
// the bridge to the processing plant, process them into food, deliver the food to the Old Quarter shops or Hotel Azure.
// Every step is quoted before you confirm; storage, vehicles and demand are limited; real vehicles do the driving.
// Its own save key: the live game and the earlier previews are not touched.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const usd = v => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ic = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
  const clock = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const now = () => Date.now();
  const KEY = 'cs-sample3-v1';
  const freshEco = () => ({ farm: { qty: 0, cost: 0 }, plantIn: { qty: 0, cost: 0 }, plantOut: { qty: 0, cost: 0 }, grows: [], procs: [], ships: [], demand: { shops: 60, hotel: 40 }, at: now(), match: now() + 4 * 60e3, stats: { grown: 0, shipped: 0, processed: 0, sold: 0, revenue: 0, profit: 0 } });
  const fresh = () => ({ cash: 2340, xp: 0, owned: {}, seen: {}, done: {}, eco: freshEco() });
  let S; try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  S.eco = Object.assign(freshEco(), S.eco || {}); // saves from the first sample gain the economy
  const E = S.eco, save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* keeps going */ } };
  let quality = (() => { try { return localStorage.getItem('cs-sample3-q') || 'high'; } catch (e) { return 'high'; } })();

  // ---------- progression: each level unlocks something you use, the next reward is always shown ----------
  const LEVELS = [
    { xp: 0, reward: 'A field at Greenfields and one truck' },
    { xp: 120, reward: 'Delivery van: a second vehicle for food runs' },
    { xp: 300, reward: 'Hotel Azure supply contract: a second buyer that pays more' },
    { xp: 550, reward: 'Bigger co-op storage and a second truck' },
    { xp: 900, reward: 'An office in the business centre' },
  ];
  const level = () => { let l = 0; while (l + 1 < LEVELS.length && S.xp >= LEVELS[l + 1].xp) l++; return l; };
  const FLEET = () => ({ truck: level() >= 3 ? 2 : 1, van: level() >= 1 ? 1 : 0 });
  const CAP = () => ({ farm: level() >= 3 ? 240 : 120, plantIn: 200, plantOut: 200, truck: 40, van: 20 });
  function xp(n, why) { if (n <= 0 || NET.online) return; /* online, XP is the server's to give */ const before = level(); S.xp += n; save(); toast(`+${n} XP`, why); if (level() > before) setTimeout(() => toast(`Level ${level() + 1}!`, 'Unlocked: ' + LEVELS[level()].reward), 1800); draw(); }
  function once(key, n, why) { if (S.done[key]) return; S.done[key] = true; xp(n, why); } // one-off rewards can't be repeated

  let toastT = 0;
  function toast(t, b = '') { $('toastT').textContent = t; $('toastB').textContent = b; $('toast').classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.remove('on'), 2800); }

  // ---------- multiplayer: when the island server is reachable, money, stores, shipments, ownership and the market live
  // there and every action is checked there; the game shows what the server says. Offline, the same game runs locally.
  const NET = (() => {
    const cfg = window.CS_NET || {}, ok = !!(cfg.url && cfg.key && window.supabase && supabase.createClient);
    const sb = ok ? supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cs-auth' } }) : null; // the same guest account as Capital Street
    const N = { ok, online: false, me: null, status: 'offline', players: new Map() };
    const msgOf = e => (e && e.message) || 'Something went wrong';
    N.call = async (fn, args) => {
      let r; try { r = await sb.rpc(fn, args || {}); } catch (e) { r = { error: { message: 'Failed to fetch' } }; }
      if (r.error) { const err = new Error(msgOf(r.error)); err.net = !r.error.code && /fetch|network|timeout|load failed/i.test(msgOf(r.error)); throw err; }
      return r.data;
    };
    N.join = async (name, color) => {
      try {
        let { data } = await sb.auth.getSession(), session = data && data.session;
        if (!session) { const r = await sb.auth.signInAnonymously(); if (r.error) return { ok: false, net: !/anonymous/i.test(msgOf(r.error)), why: /anonymous/i.test(msgOf(r.error)) ? 'Guest play is switched off on this server.' : 'Can\'t reach the island server. Check your connection and try again.' }; session = r.data.session; }
        N.me = session.user.id;
        const st = await N.call('ci_join', { p_name: name, p_color: color });
        N.online = true; return { ok: true, state: st };
      } catch (e) { if (/Could not find the function|does not exist/i.test(e.message)) return { ok: false, missing: true }; return { ok: false, net: e.net, why: e.net ? 'Can\'t reach the island server. Check your connection and try again.' : e.message }; }
    };
    let pend = null, again = false;
    N.refresh = () => { // fetch the whole state; one request at a time, and a call made meanwhile waits for a fresh one
      if (!N.online) return Promise.resolve(); if (pend) { again = true; return pend; }
      pend = (async () => { do { again = false;
        try { applyState(await N.call('ci_state')); if (N.status === 'reconnecting' && live && live.ok) setStatus('live'); } catch (e) { if (e.net) setStatus('reconnecting'); }
      } while (again); pend = null; })();
      return pend;
    };
    let live = null, pres = null, backoff = 0, rT = 0, lastTrack = 0, lastPos = null;
    function setStatus(st) { N.status = st; const el = $('netp'); if (el) { el.className = 'pill net ' + st; $('netT').textContent = st === 'live' ? `Online · ${N.players.size + 1} here` : st === 'reconnecting' ? 'Reconnecting…' : 'Offline'; } }
    N.setStatus = setStatus;
    function connect() { // live updates for what everyone shares, and who is on the island; reconnects on its own
      clearTimeout(rT); if (live) { const o = live; live = null; sb.removeChannel(o); } if (pres) { const o = pres; pres = null; sb.removeChannel(o); }
      const ch = live = sb.channel('ci-island'); ch.ok = false;
      /* not ci_players: every refresh stamps last_seen there, so open games would keep refreshing each other */
      for (const t of ['ci_buyers', 'ci_property', 'ci_listings']) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => N.refresh());
      ch.subscribe(st => { if (live !== ch) return; if (st === 'SUBSCRIBED') { ch.ok = true; backoff = 0; setStatus('live'); N.refresh(); } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { ch.ok = false; setStatus('reconnecting'); rT = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(5, backoff++))); } });
      const pc = pres = sb.channel('ci-online', { config: { presence: { key: N.me } } });
      pc.on('presence', { event: 'sync' }, () => { if (pres !== pc) return; const m = new Map(); for (const metas of Object.values(pc.presenceState())) for (const x of metas) if (x && x.id && x.id !== N.me) m.set(x.id, x); N.players = m; setStatus(N.status); if (panel === 'map') refresh(); });
      pc.subscribe(st => { if (pres === pc && st === 'SUBSCRIBED') { lastTrack = 0; N.track(); } });
    }
    N.track = () => { // where you are looking, so friends can see you and visit
      if (!pres || !World.controls) return; const t = World.controls.target, moved = !lastPos || Math.hypot(t.x - lastPos[0], t.z - lastPos[1]) > 25;
      if (!moved && performance.now() - lastTrack < 20000) return; lastPos = [t.x, t.z]; lastTrack = performance.now();
      pres.track({ id: N.me, name: S.name, color: S.color, x: Math.round(t.x), z: Math.round(t.z), at: Date.now() });
    };
    N.live = () => { connect(); setInterval(() => { N.refresh(); }, 5000); setInterval(() => N.track(), 3000); addEventListener('online', () => connect()); };
    return N;
  })();

  // ---------- start: the cover is a picture; your name, then the island. The world is built only after Play ----------
  const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{1,18}[A-Za-z0-9]$/, COLORS = ['#ffc93c', '#4c8dff', '#f04e5e', '#2fbf6a', '#a970ff', '#ff9f43', '#2fd0c0', '#ff8fb1'];
  S.color = S.color || COLORS[1];
  $('nm').value = S.name || ''; $('sw').innerHTML = COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === S.color ? 'on' : ''}" aria-label="Colour"></button>`).join('');
  $('sw').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { S.color = b.dataset.c; $('sw').querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
  const jmsg = (t, bad) => { $('jmsg').textContent = t; $('jmsg').classList.toggle('bad', !!bad); };
  let started = false, joining = false, offline = !NET.ok;
  async function join() {
    if (joining || started) return; // one join at a time, however often Play is pressed
    const name = $('nm').value.trim();
    if (!NAME_RE.test(name)) { jmsg('Names are 3 to 20 letters or numbers (spaces, dots and dashes in the middle are fine).', true); return; }
    joining = true; S.name = name; save(); $('play').disabled = true; $('offline').hidden = true;
    if (!offline) {
      $('play').textContent = 'JOINING…'; jmsg('Connecting to Capital Island…');
      const r = await NET.join(name, S.color);
      if (r.missing) { offline = true; jmsg('Multiplayer is not switched on for the island yet: playing offline.'); } // the island tables aren't on this server yet
      else if (!r.ok) { jmsg(r.why, true); $('play').textContent = 'TRY AGAIN'; $('play').disabled = false; if (r.net) $('offline').hidden = false; joining = false; return; }
      else applyState(r.state);
    }
    jmsg(offline ? 'Playing offline: your progress stays on this device.' : 'Building the island…'); $('play').textContent = 'LOADING…';
    setTimeout(startWorld, 50);
  }
  function startWorld() {
    started = true;
    try { $('c').hidden = false; const t0 = performance.now(); World.init($('c'), quality); window.buildMs = Math.round(performance.now() - t0); }
    catch (e) { console.error(e); jmsg('The island couldn\'t be built (' + (e.message || e) + '). Try Low graphics in Settings.', true); $('play').textContent = 'TRY AGAIN'; $('play').disabled = false; started = joining = false; return; }
    $('cover').hidden = true; World.place(World.overview()); if (NET.online) { NET.live(); applyState(lastState); } else { NET.setStatus('offline'); resume(); } loop(performance.now());
    World.flyTo(World.homeView(), 2, () => { $('hud').hidden = false; draw(); objective(); });
  }
  $('play').onclick = join; $('nm').onkeydown = e => { if (e.key === 'Enter') join(); };
  $('offline').onclick = () => { offline = true; joining = false; join(); };
  { const q = new URLSearchParams(location.search); if (q.get('name')) $('nm').value = q.get('name'); if (q.has('offline')) offline = true; if (q.has('play')) join(); }

  let last = 0, frames = 0, fpsT = 0, follow = null;
  function loop(t) {
    const dt = Math.max(0, Math.min(0.1, (t - (last || t)) / 1000)); last = t;
    if (follow) { follow.t -= dt; const c = follow.h.car; if (c && c.last && follow.t > 0) { const v = World.current(); v.t.set(c.last.x, 3, c.last.z); World.place(v); } else follow = null; }
    World.step(dt); labels();
    frames++; fpsT += dt; if (fpsT > 1) { $('fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
    requestAnimationFrame(loop);
  }
  setInterval(() => { if (!$('hud').hidden) { economy(); draw(); objective(); if (panel === 'trade' || panel === 'jobs') refresh(); } }, 1000);
  function draw() {
    const l = level(), nx = LEVELS[l + 1];
    $('lvN').textContent = l + 1; $('lvT').textContent = `Level ${l + 1}`; $('lvNext').textContent = nx ? `Next: ${nx.reward.split(':')[0]} · ${nx.xp - S.xp} XP` : 'Top level';
    $('lvRing').style.setProperty('--p', (nx ? (S.xp - LEVELS[l].xp) / (nx.xp - LEVELS[l].xp) * 100 : 100) + '%');
    $('cash').textContent = usd(S.cash);
    const sec = stack.length ? stack[0][0] : panel; document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.p === sec));
  }

  // ---------- the food chain ----------
  const NODE = { farm: 'FA', plant: 'P', shops: 'C', hotel: 'J' };
  const PLACE = { FA: 'Greenfields Co-op', P: 'Processing Plant', C: 'Old Quarter shops', J: 'Hotel Azure', K: 'Harbour quay', G: 'Delivery depot' };
  const SEED = 3, GROW_S = 0.8, PROC_FEE = 2, PROC_S = 0.6;
  const BUYER = { shops: { name: 'Old Quarter shops', base: 16, max: 60, refill: 5 }, hotel: { name: 'Hotel Azure', base: 21, max: 40, refill: 7 } };
  const matchOn = () => NET.online ? !!E.matchOn : now() > E.match && now() < E.match + 90e3;
  const priceOf = k => { if (NET.online && E.prices) return E.prices[k]; const B = BUYER[k]; return Math.round(B.base * (0.7 + 0.3 * E.demand[k] / B.max) * (k === 'shops' && matchOn() ? 1.15 : 1) * 100) / 100; };
  const shipFee = (type, len) => Math.round((type === 'van' ? 8 : 12) + len * (type === 'van' ? 0.03 : 0.035));
  const eta = len => Math.round(len / 8.5 + 8); // seconds: average road speed with junctions, plus loading
  const growing = () => E.grows.reduce((a, g) => a + g.qty, 0), inbound = to => E.ships.filter(s => s.to === to && s.status !== 'delivered').reduce((a, s) => a + s.qty, 0);
  const busy = type => E.ships.filter(s => s.vehicle === type && (s.status === 'travelling' || s.status === 'failed')).length;
  const avg = st => st.qty ? st.cost / st.qty : 0;
  const take = (st, n) => { const c = avg(st) * n; st.qty -= n; st.cost -= c; if (st.qty <= 0) { st.qty = 0; st.cost = 0; } return c; };
  const handles = new Map(); // shipment id -> the vehicle on the road
  function economy() { // timers, demand refills, the stadium's match day, finished jobs
    for (const x of E.ships) { const hd = handles.get(x.id); if (hd && x.status !== 'delivered') { x.status = hd.status === 'delivered' ? x.status : hd.status; x.why = hd.why; x.frac = hd.progress(); } }
    if (NET.online) { save(); return; } // online, the server settles jobs, demand and the queue
    const t = now(), mins = (t - E.at) / 1000; E.at = t;
    for (const k in BUYER) { const B = BUYER[k]; E.demand[k] = Math.min(B.max, E.demand[k] + mins / B.refill); }
    if (t > E.match + 90e3) { E.match = t + 6 * 60e3; E.matchSaid = false; } else if (t > E.match && !E.matchSaid) { E.matchSaid = true; E.demand.shops = Math.min(BUYER.shops.max + 30, E.demand.shops + 30); toast('Match day at Capital Stadium!', 'Shops want more food, and pay 15% more for 90 s'); }
    for (const g of E.grows.filter(g => g.end <= t)) { E.grows.splice(E.grows.indexOf(g), 1); E.farm.qty += g.qty; E.farm.cost += g.cost; E.stats.grown += g.qty; toast(`${g.qty} crates harvested`, 'Ready at Greenfields Co-op'); }
    for (const p of E.procs.filter(p => p.end <= t)) { E.procs.splice(E.procs.indexOf(p), 1); E.plantOut.qty += p.qty; E.plantOut.cost += p.cost; E.stats.processed += p.qty; toast(`${p.qty} boxes of food packed`, 'Ready at the Processing Plant'); }
    for (const s of E.ships) { const h = handles.get(s.id); if (h && s.status !== 'delivered') { s.status = h.status === 'delivered' ? s.status : h.status; s.why = h.why; s.frac = h.progress(); } }
    for (const s of E.ships.filter(s => s.status === 'queued' && !handles.has(s.id))) if (busy(s.vehicle) < FLEET()[s.vehicle]) send(s);
    E.ships = E.ships.filter(s => s.status !== 'delivered' || t - s.done < 30e3); // delivered ones stay on the list for half a minute
    save();
  }
  function send(s) { // put the shipment on the road: a real vehicle drives the route
    const h = World.dispatch({ type: s.vehicle, from: s.from, to: s.to, frac: s.frac || 0, paint: s.kind === 'crop' ? 0x8fd16a : 0xffc93c, onArrive: () => arrive(s) });
    handles.set(s.id, h); s.status = h.status; s.why = h.why;
  }
  async function deliverOnline(s, tries = 0) { // the vehicle is there: the server checks the trip and pays once
    try { const st = await NET.call('ci_deliver', { p_id: s.id }), r = st.result; applyState(st); if (r && r.kind === 'food') toast(`Sold ${r.qty} boxes for ${usd(r.revenue)}`, `profit ${usd(r.profit)} · +${r.xp} XP`); else if (r) toast(`${r.qty} crates delivered`, 'In the Processing Plant store'); }
    catch (e) { if (tries < 80) setTimeout(() => deliverOnline(s, tries + 1), 3000); } // offline or not quite there yet: try again shortly
  }
  function arrive(s) {
    if (NET.online) { handles.delete(s.id); s.arrived = true; s.frac = 1; deliverOnline(s); return; }
    handles.delete(s.id); s.status = 'delivered'; s.done = now(); s.frac = 1;
    if (s.kind === 'crop') { E.plantIn.qty += s.qty; E.plantIn.cost += s.basis + s.fee; E.stats.shipped += s.qty; toast(`${s.qty} crates delivered`, 'In the Processing Plant store'); }
    else { const rev = s.qty * s.price, profit = rev - s.basis - s.fee; S.cash += rev; E.demand[s.buyer] = Math.max(0, E.demand[s.buyer] - s.qty); E.stats.sold += s.qty; E.stats.revenue += rev; E.stats.profit += profit; toast(`Sold ${s.qty} boxes for ${usd(rev)}`, `${BUYER[s.buyer].name} · profit ${usd(profit)}`); xp(Math.min(60, Math.round(profit / 10)), 'Profit from a delivery'); once('firstSale', 20, 'Your first complete food chain'); }
    save(); refresh();
  }
  function resume() { for (const s of E.ships) if (s.status !== 'delivered' && s.status !== 'queued') send(s); } // after a reload, trips carry on from where they were
  const R = (a, b) => World.routeInfo(a, b);
  let OWN = new Map(), MARKET = [], skew = 0, lastState = null, seenJobs = null;
  const srv = t => Date.parse(t) - skew; // server time, in this device's clock
  const lotOf = b => `${b.type}@${Math.round(b.x)},${Math.round(b.z)}`;
  function applyState(st) {
    if (!st || !st.player || (lastState && Date.parse(st.now) < Date.parse(lastState.now))) return; lastState = st; /* an answer older than one already shown is dropped */ skew = Date.parse(st.now) - Date.now();
    const lvl0 = level(); S.cash = +st.player.cash; S.xp = st.player.xp; S.name = st.player.name; S.color = st.player.color;
    const sk = k => ({ qty: st.stock[k] ? +st.stock[k].qty : 0, cost: st.stock[k] ? +st.stock[k].cost : 0 });
    E.farm = sk('farm'); E.plantIn = sk('plant_in'); E.plantOut = sk('plant_out');
    const jobs = st.jobs.map(j => ({ id: j.id, kind: j.kind, qty: j.qty, cost: +j.cost, end: srv(j.ends_at), start: srv(j.ends_at) - j.qty * (j.kind === 'grow' ? GROW_S : PROC_S) * 1000 }));
    if (seenJobs) for (const [id, j] of seenJobs) if (!jobs.some(x => x.id === id)) toast(j.kind === 'grow' ? `${j.qty} crates harvested` : `${j.qty} boxes of food packed`, j.kind === 'grow' ? 'Ready at Greenfields Co-op' : 'Ready at the Processing Plant');
    seenJobs = new Map(jobs.map(j => [j.id, j])); E.grows = jobs.filter(j => j.kind === 'grow'); E.procs = jobs.filter(j => j.kind === 'process');
    const routes = new Map((st.routes || []).map(r => [r.from_node + r.to_node, +r.meters]));
    E.ships = st.ships.map(x => { const old = E.ships.find(o => o.id === x.id), meters = routes.get(x.from_node + x.to_node) || 800;
      const est = x.depart_at ? Math.min(0.95, Math.max(0, (Date.now() - srv(x.depart_at)) / 1000 * 8.5 / meters)) : 0;
      return { id: x.id, kind: x.kind, from: x.from_node, to: x.to_node, buyer: x.buyer, qty: x.qty, fee: +x.fee, price: +x.price, basis: +x.basis, vehicle: x.vehicle, status: old && old.status === 'failed' && x.status === 'travelling' ? 'failed' : x.status, why: old ? old.why : '', frac: old && old.frac ? old.frac : est, done: x.delivered_at ? srv(x.delivered_at) : 0 }; });
    for (const b of st.buyers) { E.demand[b.buyer] = +b.demand; (E.prices = E.prices || {})[b.buyer] = +b.price; }
    E.matchOn = st.match; E.matchAt = Date.now() + st.match_in * 1000;
    OWN = new Map(st.property.map(p => [p.lot, p])); MARKET = st.listings;
    if (World.cars) for (const x of E.ships) if (x.status === 'travelling' && !handles.has(x.id) && !x.arrived) send(x); // trips on the road get their vehicle (after a reload too)
    if (level() > lvl0) toast(`Level ${level() + 1}!`, 'Unlocked: ' + LEVELS[level()].reward);
    save(); if (!$('hud').hidden) { draw(); objective(); }
  }
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

  // what each action costs and earns, worked out before you confirm
  function quote(act, qty, buyer) {
    const c = CAP(), F = FLEET(), q = { act, qty, rows: [], ok: true, why: '' }, row = (k, v, cls = '') => q.rows.push([k, v, cls]);
    if (act === 'grow') {
      const room = c.farm - E.farm.qty - growing(); q.max = room; const cost = qty * SEED, r1 = R('FA', 'P'), r2 = R('P', 'C'), estShip = shipFee('truck', r1 ? r1.len : 900) * Math.ceil(qty / 40) + shipFee('truck', r2 ? r2.len : 900) * Math.ceil(qty / 40), est = qty * priceOf('shops') - cost - qty * PROC_FEE - estShip;
      row('Seed and labour', `${usd(SEED)} × ${qty} = ${usd(cost)}`); row('Ready in', clock(qty * GROW_S)); row('Co-op storage after', `${E.farm.qty + growing() + qty} / ${c.farm} crates`);
      row('Whole chain, at today\'s shop price', `${usd(qty * priceOf('shops'))} revenue`); row('Estimated net profit', usd(est), est > 0 ? 'ok' : 'bad');
      q.cost = cost; if (qty > room) { q.ok = false; q.why = 'Not enough room at the co-op.'; } else if (S.cash < cost) { q.ok = false; q.why = `You need ${usd(cost)}.`; }
    } else if (act === 'ship') {
      const r = R('FA', 'P'), room = c.plantIn - E.plantIn.qty - inbound('P'), max = Math.min(E.farm.qty, c.truck, room); q.max = max; q.vehicle = 'truck';
      const fee = shipFee('truck', r ? r.len : 0); q.cost = fee;
      row('Crates', `${qty} of ${E.farm.qty} at the co-op · truck takes ${c.truck}`); row('Cost of the crates so far', usd(avg(E.farm) * qty)); row('Shipping', `${usd(fee)} · ${r ? (r.len / 1000).toFixed(2) + ' km over the bridge' : 'no route'}`); row('Delivery time', r ? '~' + clock(eta(r.len)) : '—');
      row('Selling price', 'None yet: the crates go into the plant\'s store'); row('Trucks free', `${F.truck - busy('truck')} of ${F.truck}${F.truck - busy('truck') <= 0 ? ' (it will queue)' : ''}`);
      if (!r) { q.ok = false; q.why = 'No open route to the plant.'; } else if (!qty || qty > max) { q.ok = false; q.why = !E.farm.qty ? 'No crates at the co-op yet.' : room <= 0 ? 'The plant\'s store is full.' : 'Too many for one truck.'; } else if (S.cash < fee) { q.ok = false; q.why = `You need ${usd(fee)}.`; }
    } else if (act === 'process') {
      const room = c.plantOut - E.plantOut.qty - E.procs.reduce((a, p) => a + p.qty, 0), max = Math.min(E.plantIn.qty, room); q.max = max; const fee = qty * PROC_FEE; q.cost = fee;
      row('Crates in', `${qty} of ${E.plantIn.qty} in the store`); row('Processing fee', `${usd(PROC_FEE)} × ${qty} = ${usd(fee)}`); row('Ready in', clock(qty * PROC_S)); row('Food out', `${qty} boxes`);
      if (!qty || qty > max) { q.ok = false; q.why = !E.plantIn.qty ? 'No crates at the plant yet.' : 'Not enough room for the food.'; } else if (S.cash < fee) { q.ok = false; q.why = `You need ${usd(fee)}.`; }
    } else if (act === 'deliver') {
      const B = BUYER[buyer], r = R('P', NODE[buyer]), want = Math.floor(E.demand[buyer] - inbound(NODE[buyer])), vehicle = qty <= c.van && F.van ? 'van' : 'truck', max = Math.max(0, Math.min(E.plantOut.qty, want, F.van ? Math.max(c.truck, c.van) : c.truck)); q.max = max; q.vehicle = vehicle;
      const fee = shipFee(vehicle, r ? r.len : 0), price = priceOf(buyer), basis = avg(E.plantOut) * qty, rev = qty * price, net = rev - basis - fee; q.cost = fee; q.price = price;
      row('Food boxes', `${qty} of ${E.plantOut.qty} at the plant`); row('What they cost you', `${usd(basis)} (crops, trucking, processing)`); row('Shipping', `${usd(fee)} by ${vehicle} · ${r ? (r.len / 1000).toFixed(2) + ' km' : 'no route'}`);
      row('Delivery time', r ? '~' + clock(eta(r.len)) : '—'); row('Selling price', `${usd(price)} a box, agreed now${buyer === 'shops' && matchOn() ? ' (match day +15%)' : ''}`); row(`${B.name} want`, `${Math.max(0, want)} more boxes`);
      row('Revenue', usd(rev)); row('Net profit', usd(net), net > 0 ? 'ok' : 'bad');
      if (buyer === 'hotel' && level() < 2) { q.ok = false; q.why = 'The Hotel Azure contract opens at level 3.'; } else if (!r) { q.ok = false; q.why = 'No open route.'; } else if (!qty || qty > max) { q.ok = false; q.why = !E.plantOut.qty ? 'No food at the plant yet.' : want <= 0 ? `${B.name} don't need more right now: demand refills over time.` : 'Too many for this order.'; } else if (S.cash < fee) { q.ok = false; q.why = `You need ${usd(fee)}.`; }
    }
    return q;
  }
  let pendingCall = false;
  async function confirmOnline(q, buyer) { // the server books it, or says why not; nothing changes here until it answers
    if (pendingCall) return; pendingCall = true; const ok = $('qok'); if (ok) { ok.disabled = true; ok.textContent = 'SENDING…'; }
    const id = uuid(), call = q.act === 'grow' ? ['ci_grow', { p_qty: q.qty }] : q.act === 'process' ? ['ci_process', { p_qty: q.qty }] : ['ci_ship', { p_id: id, p_kind: q.act === 'ship' ? 'crop' : 'food', p_qty: q.qty, p_buyer: q.act === 'deliver' ? buyer : null }];
    try { applyState(await NET.call(call[0], call[1])); toast({ grow: `Planting ${q.qty} crates`, process: `Processing ${q.qty} crates`, ship: `Truck booked: ${q.qty} crates`, deliver: `Delivery booked: ${q.qty} boxes` }[q.act], 'Confirmed by the island server'); pendingCall = false; open('jobs'); }
    catch (e) { pendingCall = false; toast(e.net ? 'No connection' : 'Not done', e.net ? 'Check Jobs when you are back online: it may or may not have gone through.' : e.message); if (ok) { ok.disabled = false; ok.textContent = 'CONFIRM'; } NET.refresh(); }
  }
  function confirm(q, buyer) {
    if (!q.ok) return;
    if (NET.online) return confirmOnline(q, buyer);
    const id = 's' + now() + Math.floor(Math.random() * 1000);
    if (q.act === 'grow') { S.cash -= q.cost; E.grows.push({ qty: q.qty, cost: q.cost, start: now(), end: now() + q.qty * GROW_S * 1000 }); toast(`Planting ${q.qty} crates`, `Ready in ${clock(q.qty * GROW_S)}`); }
    else if (q.act === 'process') { S.cash -= q.cost; const basis = take(E.plantIn, q.qty); E.procs.push({ qty: q.qty, cost: basis + q.cost, start: now(), end: now() + q.qty * PROC_S * 1000 }); toast(`Processing ${q.qty} crates`, `Food ready in ${clock(q.qty * PROC_S)}`); }
    else if (q.act === 'ship') { S.cash -= q.cost; const s = { id, kind: 'crop', from: 'FA', to: 'P', qty: q.qty, fee: q.cost, basis: take(E.farm, q.qty), vehicle: 'truck', status: 'queued', frac: 0 }; E.ships.push(s); if (busy('truck') < FLEET().truck) send(s); toast(`Truck booked: ${q.qty} crates`, 'Greenfields → Processing Plant'); }
    else if (q.act === 'deliver') { S.cash -= q.cost; const s = { id, kind: 'food', from: 'P', to: NODE[buyer], buyer, qty: q.qty, fee: q.cost, price: q.price, basis: take(E.plantOut, q.qty), vehicle: q.vehicle, status: 'queued', frac: 0 }; E.ships.push(s); if (busy(q.vehicle) < FLEET()[q.vehicle]) send(s); toast(`Delivery booked: ${q.qty} boxes`, `Processing Plant → ${BUYER[buyer].name}`); }
    once('first:' + q.act, 5, 'First ' + q.act); save(); open('jobs');
  }

  // ---------- the objective: what to do next, from what you have ----------
  function objective() {
    let t, s; const sh = E.ships.find(x => x.status !== 'delivered');
    if (E.grows.length) { const g = E.grows[0]; t = `Crops growing: ${g.qty} crates`; s = `${clock((g.end - now()) / 1000)} left · Greenfields`; }
    else if (sh) { t = `${sh.kind === 'crop' ? 'Crates' : 'Food'} ${sh.status === 'queued' ? 'waiting for a vehicle' : sh.status === 'failed' ? 'held up' : 'on the way'}`; s = `${PLACE[sh.from]} → ${PLACE[sh.to]} · ${Math.round((sh.frac || 0) * 100)}%`; }
    else if (E.procs.length) { const p = E.procs[0]; t = `Processing ${p.qty} crates`; s = `${clock((p.end - now()) / 1000)} left · Industrial Isle`; }
    else if (E.plantOut.qty) { t = 'Deliver food to the shops'; s = `Jobs → Seller · ${E.plantOut.qty} boxes ready`; }
    else if (E.plantIn.qty) { t = 'Process the crates into food'; s = `Jobs → Manufacturer · ${E.plantIn.qty} crates at the plant`; }
    else if (E.farm.qty) { t = 'Truck the crates to the plant'; s = `Jobs → Shipper · ${E.farm.qty} crates at the co-op`; }
    else if (!E.stats.sold) { t = 'Grow your first crops'; s = 'Jobs → Producer → Grow'; }
    else { const nx = LEVELS[level() + 1]; t = nx ? `Run the chain again: ${nx.xp - S.xp} XP to level ${level() + 2}` : 'Run your food business'; s = `Profit so far ${usd(E.stats.profit)}`; }
    $('objT').textContent = t; $('objS').textContent = s;
  }
  $('obj').onclick = () => { if (panel !== 'jobs') open('jobs'); else $('obj').classList.toggle('min'); };

  // ---------- labels: island name far out, district names in between, a few useful places up close; no overlaps ----------
  const els = new Map(); let sel = null;
  function labelEl(L) { let el = els.get(L); if (!el) { el = document.createElement('div'); el.className = `lab ${L.friend ? 'place friend' : L.level}${L.minor ? ' minor' : ''}${L.small ? ' small' : ''}${L.home ? ' home' : ''}`; el.textContent = L.text; if (L.color) el.style.setProperty('--c', L.color); $('labels').appendChild(el); els.set(L, el); L.w = 0; } return el; }
  const FRIENDS = new Map(), OWNERS = new Map();
  function friendLabels(lvl) { // other players (district and close views) and, close up, who owns the buildings nearby
    if (!NET.online) return [];
    const out = [];
    for (const [id, p] of NET.players) { let L = FRIENDS.get(id); if (!L) { L = { text: p.name, level: 'friend', friend: true }; FRIENDS.set(id, L); } L.x = p.x; L.z = p.z; L.y = 14; if (L.text !== p.name) { L.text = p.name; const el = els.get(L); if (el) el.textContent = p.name, L.w = 0; } L.color = p.color; if (lvl !== 'island') out.push(L); }
    for (const [id, L] of FRIENDS) if (!NET.players.has(id)) { const el = els.get(L); if (el) el.remove(); els.delete(L); FRIENDS.delete(id); }
    if (lvl === 'place') for (const b of World.buildings) { if (!b.sale) continue; const o = OWN.get(lotOf(b)); if (!o) continue; let L = OWNERS.get(b.id); if (!L || L.text !== (o.owner === NET.me ? 'Yours' : o.name)) { if (L && els.get(L)) { els.get(L).remove(); els.delete(L); } L = { text: o.owner === NET.me ? 'Yours' : o.name, level: 'place', small: true, owner: true, x: b.x, y: b.h + 3, z: b.z, color: o.color }; OWNERS.set(b.id, L); } out.push(L); }
    return out;
  }
  const v3 = new THREE.Vector3();
  function labels() {
    if (!World.camera || $('hud').hidden) return;
    const d = World.dist, lvl = d > 760 ? 'island' : d > 230 ? 'district' : 'place', t = World.controls.target, placed = [], W = innerWidth, H = innerHeight, pr = !P.hidden ? P.getBoundingClientRect() : null;
    if (lvl === 'island') once('zoom', 10, 'You found the whole island');
    const FL = friendLabels(lvl), want = World.LABELS.concat(FL).filter(L => L.level === lvl || (L.friend && lvl !== 'island') || (L.home && lvl !== 'island') || (sel && L.b === sel)).map(L => ({ L, pri: (L.b && L.b === sel ? 0 : L.home ? 1 : 2) + (lvl === 'place' ? Math.hypot(L.x - t.x, L.z - t.z) / 1000 : 0) })).sort((a, b) => a.pri - b.pri);
    const shown = new Set();
    for (const { L } of want) {
      if (lvl === 'place' && !L.home && !L.friend && !(L.b && L.b === sel) && Math.hypot(L.x - t.x, L.z - t.z) > 170) continue;
      v3.set(L.x, L.y, L.z).project(World.camera); if (v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) continue;
      const el = labelEl(L); if (!L.w) { L.w = el.offsetWidth || 80; L.h = el.offsetHeight || 20; }
      const x = (v3.x + 1) / 2 * W - L.w / 2, y = (1 - v3.y) / 2 * H - L.h, r = [x - 4, y - 3, x + L.w + 4, y + L.h + 3];
      if (pr && r[2] > pr.left && r[0] < pr.right && r[3] > pr.top && r[1] < pr.bottom) continue;
      if (x < 6 || x + L.w > W - 6 || y < 100 || y > H - 96 || placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) continue;
      placed.push(r); shown.add(L); el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; el.classList.toggle('sel', !!(L.b && L.b === sel));
    }
    for (const [L, el] of els) el.classList.toggle('on', shown.has(L));
  }

  // ---------- pictures for property cards ----------
  const queue = []; let pumping = false;
  function picture(el, b) { if (!el || !b) return; el.classList.add('wait'); queue.push([el, b]); pump(); }
  function pump() { if (pumping || !queue.length) return; pumping = true; requestAnimationFrame(() => setTimeout(() => { const [el, b] = queue.shift(); if (el.isConnected) { try { el.innerHTML = `<img alt="" src="${World.photo(b)}">`; } catch (e) { el.textContent = 'No picture'; } el.classList.remove('wait'); } pumping = false; pump(); }, 0)); }

  // ---------- panels: one at a time; Back returns to where you came from, Close always closes ----------
  let panel = '', arg = null, stack = [];
  const P = $('panel');
  function open(name, a, push) {
    if (push && panel) stack.push([panel, arg]); else if (!push) stack = [];
    const keep = name === panel ? $('pbody').scrollTop : 0; panel = name; arg = a;
    const r = PANELS[name](a); P.hidden = false; $('pBack').hidden = !stack.length; $('pTitle').textContent = r.title; $('pbody').innerHTML = r.html; $('pbody').scrollTop = keep; if (r.bind) r.bind($('pbody')); draw();
  }
  const refresh = () => { if (panel && !P.hidden && panel !== 'quote') { const st = stack.slice(); open(panel, arg, true); stack = st; $('pBack').hidden = !stack.length; } };
  function close() { P.hidden = true; panel = ''; stack = []; sel = null; World.mark(null); draw(); }
  $('pX').onclick = close;
  $('pBack').onclick = () => { const [n, a] = stack.pop() || []; if (n) { const st = stack.slice(); panel = ''; open(n, a); stack = st; $('pBack').hidden = !stack.length; } };
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { const p = b.dataset.p; if (panel === p && !stack.length) close(); else open(p); });
  $('gear').onclick = () => panel === 'settings' ? close() : open('settings');
  addEventListener('keydown', e => { if (e.key === 'Escape' && !P.hidden) (stack.length ? $('pBack') : $('pX')).click(); });

  const byId = id => World.buildings.find(b => b.id === id);
  const RATE = { house: 13, flat: 9, shophouse: 12, warehouse: 4, kiosk: 30, villa: 42, tower: 7 };
  const valueOf = b => Math.round(b.w * b.d * ({ house: 2, flat: b.floors || 3, shophouse: 3, villa: 2, tower: b.floors || 4 }[b.type] || 1) * (RATE[b.type] || 10) / 10) * 10;
  const rentOf = b => Math.round(valueOf(b) * 0.05 / 10) * 10;
  function visit(b) { sel = b; World.mark(b); World.flyTo(World.viewOf(b), 1.3); if (innerWidth < 760) { P.hidden = true; panel = ''; } seeArea(b.area); }
  function seeArea(a) { if (!a || S.seen[a]) return; S.seen[a] = true; save(); once('area:' + a, 10, 'First visit: ' + a); }
  const AREAS = [['Beachfront', -130, 140, 'Hotel Azure, the promenade and the beach. Buys food (level 3).'], ['Old Quarter', -20, -20, 'Flats, houses and the shops that buy your food'], ['Business Centre', 40, -160, 'City Hall, Capital Bank, the Exchange and offices'],
    ['Stadium', 130, -320, 'Capital Stadium: match days raise food demand'], ['Greenfields', -300, -300, 'Farms and the co-op where your crops grow'], ['Villa Point', -450, 90, 'Villas with pools, the marina and the yacht club'],
    ['Harbour', 190, 20, 'Quay, cranes and the ship to Industrial Isle'], ['Industrial Isle', 540, -180, 'The processing plant, over the bridge'], ['Lighthouse Point', -440, -320, 'Cliffs, pines and the lighthouse']];
  const ownerOf = b => NET.online ? OWN.get(lotOf(b)) : (S.owned[b.id] ? { owner: 'me', name: S.name } : null);
  const isMine = b => b.owner === 'you' || (ownerOf(b) && (ownerOf(b).owner === NET.me || ownerOf(b).owner === 'me'));
  const card = b => { const o = ownerOf(b), mine = isMine(b); return `<button class="pc" data-b="${b.id}"><div class="ph" data-ph="${b.id}"></div>${mine ? '<span class="tag yours">YOURS</span>' : o ? `<span class="tag" style="background:${esc(o.color)}">${esc(o.name)}</span>` : ''}<div class="tx"><b>${esc(b.name)}</b><small>${esc(b.area)}</small><em>${mine ? 'Yours' : o ? 'Owned by ' + esc(o.name) : usd(valueOf(b))}</em></div></button>`; };
  const bindCards = r => { r.querySelectorAll('[data-ph]').forEach(el => picture(el, byId(el.dataset.ph))); r.querySelectorAll('[data-b]').forEach(el => el.onclick = () => open('card', el.dataset.b, true)); };
  let filter = 'homes', qtyPick = {};
  const bar = (n, cap) => `<div class="bar"><i style="width:${Math.min(100, n / cap * 100)}%"></i></div>`;
  const chipOf = s => `<span class="chip ${s.status}">${{ queued: 'QUEUED', travelling: 'TRAVELLING', delivered: 'DELIVERED', failed: 'FAILED' }[s.status] || s.status.toUpperCase()}</span>`;
  const shipRow = s => `<div class="row"><span class="ic">${ic('truck')}</span><div><b>${s.qty} ${s.kind === 'crop' ? 'crates' : 'boxes'} → ${esc(PLACE[s.to])}</b><small>from ${esc(PLACE[s.from])} · ${s.status === 'travelling' ? Math.round((s.frac || 0) * 100) + '% of the way' : s.status === 'queued' ? 'Waiting for a free ' + s.vehicle : s.status === 'failed' ? esc(s.why || 'Route closed') : 'Arrived'} · ${s.vehicle}</small></div>${chipOf(s)}${handles.get(s.id) && handles.get(s.id).car ? `<button class="btn" data-track="${s.id}">TRACK</button>` : ''}</div>`;
  const bindTrack = r => r.querySelectorAll('[data-track]').forEach(b => b.onclick = () => { const h = handles.get(b.dataset.track); if (!h || !h.car) return; follow = { h, t: 15 }; const v = World.current(); v.dist = 110; v.polar = 0.9; World.place(v); if (innerWidth < 760) close(); once('track', 5, 'You followed a delivery'); });
  const PANELS = {
    home: () => { const h = World.home; return { title: 'Home', html: `<div class="ph" data-ph="home"></div><div class="row"><span class="ic">${ic('home')}</span><div><b>${esc(h.name)}</b><small>Your flat in the Old Quarter</small></div><button class="btn" id="hv">VISIT</button></div>
      <div class="stats"><div>Cash<b>${usd(S.cash)}</b></div><div>Food profit<b>${usd(E.stats.profit)}</b></div><div>Level<b>${level() + 1}</b></div></div>
      <p class="sec">Money and business</p><button class="row" id="hBank" style="text-align:left"><span class="ic">${ic('bank')}</span><div><b>Capital Bank</b><small>Your accounts, income and costs</small></div></button>
      <button class="row ${level() < 4 ? 'lock' : ''}" id="hOffice" style="text-align:left"><span class="ic">${ic('office')}</span><div><b>Office</b><small>Run your companies from the business centre</small></div>${level() < 4 ? '<span class="lockt">LEVEL 5</span>' : ''}</button>`,
      bind: r => { picture(r.querySelector('[data-ph]'), h); $('hv').onclick = () => visit(h); $('hBank').onclick = () => open('bank', null, true); $('hOffice').onclick = () => open('office', null, true); } }; },
    bank: () => { const inc = Object.keys(S.owned).map(byId).filter(Boolean).reduce((a, b) => a + rentOf(b), 0), st = E.stats; return { title: 'Capital Bank', html: `<div class="stats"><div>Cash<b>${usd(S.cash)}</b></div><div>Food sold<b>${st.sold} boxes</b></div><div>Revenue<b>${usd(st.revenue)}</b></div></div>
      <div class="stats"><div>Net profit<b>${usd(st.profit)}</b></div><div>Rent value<b>${usd(inc)}/wk</b></div><div>Loans<b>None</b></div></div><p class="note">Loans arrive with the next stage. Rent from property is shown but not yet paid out.</p>`,
      bind: () => {} }; },
    office: () => ({ title: 'Office', html: `<div class="row lock"><span class="ic">${ic('lock')}</span><div><b>Opens at level 5</b><small>${LEVELS[4].reward}</small></div></div><p class="note">From your office you'll run the companies you start in Jobs.</p>` }),
    build: () => { const G = { homes: ['house', 'flat'], villas: ['villa'], shops: ['shophouse', 'kiosk'], offices: ['tower'], harbour: ['warehouse'] }, list = World.buildings.filter(b => b.sale && !ownerOf(b) && G[filter].includes(b.type)).sort((a, b) => valueOf(a) - valueOf(b)).slice(0, 10), own = World.buildings.filter(b => b.sale && isMine(b));
      return { title: 'Build & property', html: `<div class="seg">${[['homes', 'Homes'], ['villas', 'Villas'], ['shops', 'Shops'], ['offices', 'Offices'], ['harbour', 'Harbour']].map(([k, n]) => `<button data-f="${k}" class="${k === filter ? 'on' : ''}">${n}</button>`).join('')}</div>
        ${own.length ? `<p class="sec">Yours</p><div class="cards">${own.map(card).join('')}</div>` : ''}<p class="sec">For sale · cheapest first</p><div class="cards">${list.map(card).join('')}</div>`,
        bind: r => { r.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; open('build'); }); bindCards(r); } }; },
    card: id => { const b = byId(id), mine = isMine(b), other = !mine && ownerOf(b), p = valueOf(b); sel = b; World.mark(b); return { title: { warehouse: 'Warehouse', shophouse: 'Shop with flats', kiosk: 'Kiosk', house: 'House', villa: 'Villa', tower: 'Offices', flat: 'Flats' }[b.type] || 'Landmark',
      html: `<div class="ph" data-ph="${b.id}"></div><b class="big">${esc(b.name)}</b><p class="note">${esc(b.area)}</p>
        ${b.sale || mine ? `<div class="stats"><div>Price<b>${usd(p)}</b></div><div>Rent<b>${usd(rentOf(b))}/wk</b></div><div>Floors<b>${b.floors || (b.type === 'house' || b.type === 'villa' ? 2 : 1)}</b></div></div>` : '<p class="note">Owned by the island; not for sale.</p>'}
        ${other ? `<p class="note">Owned by <b style="color:${esc(other.color)}">${esc(other.name)}</b>. You can visit; only the owner can change it.</p>` : ''}
        <div class="acts"><button class="btn" id="cv">${ic('map')}VISIT</button>${mine ? '<button class="btn" disabled>YOURS</button>' : other ? '<button class="btn" disabled>OWNED</button>' : b.sale ? `<button class="btn go" id="cb" ${S.cash < p ? 'disabled' : ''}>${S.cash < p ? 'NEED ' + usd(p - S.cash) : 'BUY ' + usd(p)}</button>` : '<button class="btn" disabled>NOT FOR SALE</button>'}</div>
        <p class="note">Visit moves the camera there and marks it. It never buys anything.</p>`,
      bind: r => { picture(r.querySelector('[data-ph]'), b); $('cv').onclick = () => visit(b); if ($('cb')) $('cb').onclick = async () => { if (NET.online) { if (pendingCall) return; pendingCall = true; $('cb').disabled = true; $('cb').textContent = 'BUYING…'; try { applyState(await NET.call('ci_buy_property', { p_lot: lotOf(b) })); toast('Bought ' + b.name, 'Confirmed by the island server'); } catch (e) { toast(e.net ? 'No connection' : 'Not bought', e.net ? 'Try again when you are back online.' : e.message); NET.refresh(); } pendingCall = false; open('card', id, true); stack.pop(); return; } if (S.cash < p || S.owned[b.id]) return; S.cash -= p; S.owned[b.id] = { at: now() }; save(); toast('Bought ' + b.name, `Rent ${usd(rentOf(b))} a week`); once('buy:' + b.id, 25, 'First purchase of ' + b.name); open('card', id, true); stack.pop(); }; } }; },
    jobs: () => { const c = CAP(), F = FLEET(), run = (list, verb) => list.map(j => `<div class="row"><span class="ic">${ic('jobs')}</span><div><b>${verb} ${j.qty}</b>${bar(now() - j.start, j.end - j.start)}</div><span class="lockt">${clock((j.end - now()) / 1000)}</span></div>`).join('');
      const step = (n, role, title, where, stock, btn, act, extra = '') => `<div class="step"><div class="sh"><span class="n">${n}</span><div><b>${title}</b><small>${role} · ${where}</small></div>${btn ? `<button class="btn go" data-act="${act}">${btn}</button>` : ''}</div>${stock}${extra}</div>`;
      return { title: 'Jobs · food chain', html: `<div class="chain"><span>Grow</span><i>→</i><span>Truck</span><i>→</i><span>Process</span><i>→</i><span>Deliver &amp; sell</span></div>
        ${step(1, 'Producer', 'Grow crops', 'Greenfields Co-op', `<small class="kv">Co-op store: ${E.farm.qty} / ${c.farm} crates${growing() ? ` · ${growing()} growing` : ''}</small>${bar(E.farm.qty + growing(), c.farm)}`, 'GROW', 'grow', run(E.grows, 'Growing'))}
        ${step(2, 'Shipper', 'Truck crates to the plant', 'over the bridge', `<small class="kv">Trucks: ${F.truck - busy('truck')} free of ${F.truck} · ${c.truck} crates each${F.van ? ` · van: ${F.van - busy('van')} free` : ''}</small>`, E.farm.qty ? 'SHIP' : '', 'ship', E.ships.filter(s => s.status !== 'delivered').map(shipRow).join(''))}
        ${step(3, 'Manufacturer', 'Process crops into food', 'Industrial Isle', `<small class="kv">Plant store: ${E.plantIn.qty} crates in · ${E.plantOut.qty} boxes of food out</small>${bar(E.plantIn.qty, c.plantIn)}`, E.plantIn.qty ? 'PROCESS' : '', 'process', run(E.procs, 'Packing'))}
        ${step(4, 'Seller', 'Deliver and sell food', 'shops and hotel', `<small class="kv">Old Quarter shops pay ${usd(priceOf('shops'))} a box · want ${Math.max(0, Math.floor(E.demand.shops - inbound('C')))}${matchOn() ? ' · MATCH DAY' : ''}</small><small class="kv">Hotel Azure pays ${usd(priceOf('hotel'))} · ${level() >= 2 ? `want ${Math.max(0, Math.floor(E.demand.hotel - inbound('J')))}` : 'opens at level 3'}</small>`, E.plantOut.qty ? 'SHOPS' : '', 'deliver:shops', E.plantOut.qty && level() >= 2 ? `<button class="btn" data-act="deliver:hotel">DELIVER TO HOTEL AZURE</button>` : '')}
        <p class="sec">Other jobs</p><div class="row ${level() < 2 ? 'lock' : ''}"><span class="ic">${ic('home')}</span><div><b>Hotel owner</b><small>Supply Hotel Azure; buy and upgrade hotels next</small></div><span class="lockt">${level() >= 2 ? 'OPEN' : 'LEVEL 3'}</span></div>
        <div class="row"><span class="ic">${ic('build')}</span><div><b>Property owner</b><small>Buy homes, villas, shops and offices in Build</small></div><span class="lockt">OPEN</span></div>
        <p class="note">Every step is quoted before you confirm. Profit earns XP; a completed chain earns more than any single step.</p>`,
        bind: r => { r.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { const [act, buyer] = b.dataset.act.split(':'); open('quote', { act, buyer }, true); }); bindTrack(r); } }; },
    quote: a => { const opts = [5, 10, 20, 40, 80], probe = quote(a.act, 1, a.buyer), max = Math.max(0, probe.max || 0), choices = opts.filter(n => n <= Math.max(max, 5)); let qty = qtyPick[a.act + (a.buyer || '')] || Math.min(max || 5, a.act === 'grow' ? 40 : 40); if (qty > max && max) qty = choices.filter(n => n <= max).pop() || max; const q = quote(a.act, qty, a.buyer);
      return { title: { grow: 'Grow crops', ship: 'Truck crates', process: 'Process food', deliver: 'Deliver food' }[a.act], html: `<p class="sec">How many</p><div class="seg">${[...new Set([...choices.filter(n => n <= max), max].filter(n => n > 0))].sort((x, y) => x - y).map(n => `<button data-q="${n}" class="${n === qty ? 'on' : ''}">${n === max && !opts.includes(n) ? 'All ' + n : n}</button>`).join('') || '<span class="note">Nothing available</span>'}</div>
        <table class="t">${q.rows.map(([k, v, cls]) => `<tr><td>${esc(k)}</td><td class="${cls}">${esc(v)}</td></tr>`).join('')}</table>${q.ok ? '' : `<p class="note bad">${esc(q.why)}</p>`}
        <div class="acts"><button class="btn" id="qc">CANCEL</button><button class="btn go" id="qok" ${q.ok ? '' : 'disabled'}>CONFIRM ${q.cost ? usd(q.cost) : ''}</button></div>`,
      bind: r => { r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { qtyPick[a.act + (a.buyer || '')] = +b.dataset.q; open('quote', a, true); stack.pop(); }); $('qc').onclick = () => $('pBack').click(); $('qok').onclick = () => confirm(q, a.buyer); } }; },
    trade: () => { const mine = E.ships.slice().reverse(); return { title: 'Trade', html: `<p class="sec">Your shipments</p>${mine.length ? mine.map(shipRow).join('') : '<p class="note">None yet: start in Jobs.</p>'}
      <p class="sec">Buyers</p><div class="row"><span class="ic">${ic('home')}</span><div><b>Old Quarter shops</b><small>${usd(priceOf('shops'))} a box · want ${Math.max(0, Math.floor(E.demand.shops))}${matchOn() ? ' · match day +15%' : ` · next match in ${clock((E.match - now()) / 1000)}`}</small>${bar(E.demand.shops, BUYER.shops.max)}</div></div>
      <div class="row ${level() < 2 ? 'lock' : ''}"><span class="ic">${ic('home')}</span><div><b>Hotel Azure</b><small>${usd(priceOf('hotel'))} a box · want ${Math.max(0, Math.floor(E.demand.hotel))}</small>${bar(E.demand.hotel, BUYER.hotel.max)}</div>${level() < 2 ? '<span class="lockt">LEVEL 3</span>' : ''}</div>
      ${NET.online ? `<p class="sec">Market between players</p>
      ${MARKET.filter(l => l.seller !== NET.me).map(l => `<div class="row"><span class="ic">${ic('trade')}</span><div><b>${l.qty} boxes from ${esc(l.name)}</b><small>${usd(l.price)} a box · ${usd(l.qty * l.price)} in all · into your plant store at once</small></div><button class="btn go" data-mbuy="${l.id}">BUY</button></div>`).join('') || '<p class="note">No offers from other players right now.</p>'}
      ${MARKET.filter(l => l.seller === NET.me).map(l => `<div class="row"><span class="ic">${ic('trade')}</span><div><b>Your offer: ${l.qty} boxes</b><small>${usd(l.price)} a box · waiting for a buyer</small></div><button class="btn" data-mcan="${l.id}">CANCEL</button></div>`).join('')}
      <button class="btn" id="mlist" ${E.plantOut.qty ? '' : 'disabled'} style="width:100%">OFFER FOOD TO PLAYERS</button>` : ''}
      <p class="sec">Routes</p><div class="row"><span class="ic">${ic('trade')}</span><div><b>Sea route: harbour ⇄ Industrial Isle</b><small>Cargo boat ${World.SEA ? World.SEA.state() : ''}</small></div></div>
      <div class="row"><span class="ic">${ic('trade')}</span><div><b>Bridge to Industrial Isle</b><small>${bridgeClosed ? 'Closed: trucks wait and re-plan' : 'Open both ways'}</small></div><button class="btn" id="tb">${bridgeClosed ? 'REOPEN' : 'CLOSE (TEST)'}</button></div>
      <p class="sec">Island deliveries</p>${World.SHIP.map(s => `<div class="row"><span class="ic">${ic('truck')}</span><div><b>${esc(PLACE[s.from] || s.from)} → ${esc(PLACE[s.to] || s.to)}</b><small>${s.runs} delivered</small></div>${chipOf({ status: s.status === 'loading' ? 'queued' : s.status })}</div>`).join('')}`,
      bind: r => { bindTrack(r);
        r.querySelectorAll('[data-mbuy]').forEach(b => b.onclick = () => open('mbuy', b.dataset.mbuy, true)); r.querySelectorAll('[data-mcan]').forEach(b => b.onclick = () => market('ci_cancel_listing', { p_id: b.dataset.mcan }, 'Offer cancelled', 'The boxes are back in your store'));
        if ($('mlist')) $('mlist').onclick = () => open('mlist', null, true);
        $('tb').onclick = () => { bridgeClosed = !bridgeClosed; World.setClosed('bridge', bridgeClosed); toast(bridgeClosed ? 'Bridge closed' : 'Bridge reopened', bridgeClosed ? 'Traffic turns back at the barrier' : 'Deliveries resume'); refresh(); }; } }; },
    mbuy: id => { const l = MARKET.find(x => x.id === id); if (!l) return { title: 'Offer', html: '<p class="note">That offer has gone.</p>' }; const total = l.qty * l.price, shop = priceOf('shops'); return { title: 'Buy from a player', html: `<table class="t"><tr><td>Seller</td><td>${esc(l.name)}</td></tr><tr><td>Food boxes</td><td>${l.qty}</td></tr><tr><td>Price</td><td>${usd(l.price)} a box</td></tr><tr><td>Total</td><td>${usd(total)}</td></tr><tr><td>Delivery</td><td>At once, into your plant store</td></tr><tr><td>Shops pay today</td><td>${usd(shop)} a box (before shipping)</td></tr></table>${S.cash < total ? '<p class="note bad">Not enough cash.</p>' : ''}<div class="acts"><button class="btn" id="qc">CANCEL</button><button class="btn go" id="qok" ${S.cash < total ? 'disabled' : ''}>BUY ${usd(total)}</button></div>`,
      bind: () => { $('qc').onclick = () => $('pBack').click(); $('qok').onclick = () => market('ci_buy_listing', { p_id: id }, `Bought ${l.qty} boxes from ${l.name}`, 'They are in your plant store', true); } }; },
    mlist: () => { const max = E.plantOut.qty, shop = priceOf('shops'), prices = [Math.max(1, Math.round(shop - 2)), Math.round(shop), Math.round(shop + 2)], k = mlistPick; k.qty = Math.min(k.qty || 10, max) || max; k.price = k.price || prices[1]; const basis = avg(E.plantOut) * k.qty;
      return { title: 'Offer food to players', html: `<p class="sec">How many</p><div class="seg">${[...new Set([5, 10, 20, max].filter(n => n > 0 && n <= max))].map(n => `<button data-q="${n}" class="${n === k.qty ? 'on' : ''}">${n}</button>`).join('')}</div><p class="sec">Price a box</p><div class="seg">${prices.map(n => `<button data-p="${n}" class="${n === k.price ? 'on' : ''}">${usd(n)}</button>`).join('')}</div>
        <table class="t"><tr><td>Boxes</td><td>${k.qty} of ${max}</td></tr><tr><td>What they cost you</td><td>${usd(basis)}</td></tr><tr><td>If sold</td><td>${usd(k.qty * k.price)}</td></tr><tr><td>Net profit</td><td class="${k.qty * k.price - basis > 0 ? 'ok' : 'bad'}">${usd(k.qty * k.price - basis)}</td></tr><tr><td>While on offer</td><td>The boxes are held; cancel any time</td></tr></table>
        <div class="acts"><button class="btn" id="qc">CANCEL</button><button class="btn go" id="qok" ${max ? '' : 'disabled'}>OFFER</button></div>`,
      bind: r => { r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { k.qty = +b.dataset.q; open('mlist', null, true); stack.pop(); }); r.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { k.price = +b.dataset.p; open('mlist', null, true); stack.pop(); }); $('qc').onclick = () => $('pBack').click(); $('qok').onclick = () => market('ci_list_food', { p_id: uuid(), p_qty: k.qty, p_price: k.price }, `Offered ${k.qty} boxes`, 'Other players can buy them now', true); } }; },
    map: () => ({ title: 'Map', html: `<div class="acts"><button class="btn gold" id="mi">ISLAND VIEW</button><button class="btn" id="mh">MY HOME</button></div>
      ${NET.online ? `<p class="sec">On the island now</p>${[...NET.players.values()].map(p => `<div class="row"><span class="ic" style="background:${esc(p.color)}">${ic('home')}</span><div><b>${esc(p.name)}</b><small>Looking around near ${esc(areaAt(p.x, p.z))}</small></div><button class="btn" data-pv="${esc(p.id)}">VISIT</button></div>`).join('') || '<p class="note">Nobody else is here right now. Share the link with a friend.</p>'}` : ''}<p class="sec">Areas</p>
      ${AREAS.map(([n, , , d], i) => `<div class="row"><span class="ic">${ic('map')}</span><div><b>${n}${S.seen[n] ? '' : ' · new'}</b><small>${d}</small></div><button class="btn" data-a="${i}">GO</button></div>`).join('')}
      <p class="sec">Road checks</p><div class="row"><span class="ic">${ic('truck')}</span><div><b>Traffic</b><small>${World.cars.length} vehicles · ${World.stats.teleports} jumps · ${World.stats.stuck} stuck</small></div><button class="btn" id="mt">RUN ROUTE TEST</button></div><div id="rt"></div>`,
      bind: () => { $('mi').onclick = () => { World.mark(null); World.flyTo(World.overview(), 1.5); if (innerWidth < 760) close(); }; $('mh').onclick = () => visit(World.home);
        document.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => { const p = NET.players.get(b.dataset.pv); if (!p) return; World.mark(null); World.flyTo(World.view(p.x, p.z, 160, 0.9, 0.5), 1.4); if (innerWidth < 760) close(); });
        document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const [n, x, z] = AREAS[+b.dataset.a]; World.mark(null); World.flyTo(World.view(x, z, 320, 0.85, 0.4), 1.4); seeArea(n); if (innerWidth < 760) close(); });
        $('mt').onclick = () => { const res = World.routeTest(), rep = World.roadReport(); $('rt').innerHTML = `<p class="note">${rep.connected ? '<span class="ok">All roads connected.</span>' : '<span class="bad">Some roads are not connected.</span>'} Dead ends, each with a turning circle: ${rep.deadEnds.length}. Road points over water: ${rep.roadPointsOverWater}. Steepest grade ${rep.maxGrade}.</p><table class="t">${res.map(t => `<tr><td>${esc(t.route)}</td><td class="${t.ok ? 'ok' : 'bad'}">${t.ok ? 'PASS' : 'FAIL'} · ${t.length || ''} m</td></tr>`).join('')}</table>`; }; } }),
    settings: () => ({ title: 'Settings', html: `<div class="row"><div><b>Graphics</b><small>After a reload</small></div><div class="seg">${['low', 'medium', 'high'].map(k => `<button data-q="${k}" class="${k === quality ? 'on' : ''}">${k}</button>`).join('')}</div></div>
      <div class="row"><div><b>Frame rate</b><small>In the corner</small></div><button class="btn" id="sf">${$('fps').hidden ? 'SHOW' : 'HIDE'}</button></div><div class="row"><div><b>Reset this preview</b><small>Your real game is never touched</small></div><button class="btn" id="sr">RESET</button></div><p class="note">© 2026 Pocket Rocket Studio</p>`,
      bind: r => { r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { quality = b.dataset.q; try { localStorage.setItem('cs-sample3-q', quality); } catch (e) { /* fine */ } open('settings'); toast('Graphics: ' + quality, 'Reload to apply'); }); $('sf').onclick = () => { $('fps').hidden = !$('fps').hidden; open('settings'); }; $('sr').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) { /* fine */ } location.reload(); }; } }),
  };
  let bridgeClosed = false, mlistPick = {};
  const areaAt = (x, z) => { let best = AREAS[0][0], d = 1e9; for (const [n, ax, az] of AREAS) { const e = Math.hypot(ax - x, az - z); if (e < d) { d = e; best = n; } } return best; };
  async function market(fn, args, ok, sub, back) { if (pendingCall) return; pendingCall = true; try { applyState(await NET.call(fn, args)); toast(ok, sub); if (back) open('trade'); else refresh(); } catch (e) { toast(e.net ? 'No connection' : 'Not done', e.net ? 'Try again when you are back online.' : e.message); NET.refresh(); } pendingCall = false; }

  // tap a building: its card
  let down = null;
  $('c').addEventListener('pointerdown', e => { down = [e.clientX, e.clientY, performance.now()]; follow = null; });
  $('c').addEventListener('pointerup', e => { if (!down || $('hud').hidden || World.flying) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]), quick = performance.now() - down[2] < 450; down = null; if (moved > 8 || !quick) return; const b = World.pickAt(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); if (b) open('card', b.id); else if (!P.hidden && innerWidth >= 760) close(); });
  window.App = { S, E, NET, open, close, visit, level, quote, confirm, economy, handles, lotOf, market, get OWN() { return OWN; }, get MARKET() { return MARKET; }, frame: () => loop(performance.now()) }; // frame(): one step by hand, for tests in a hidden tab
})();
