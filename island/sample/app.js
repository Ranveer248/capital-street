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
  const freshEco = () => ({ farm: { qty: 0, cost: 0 }, plantIn: { qty: 0, cost: 0 }, plantOut: { qty: 0, cost: 0 }, grows: [], procs: [], ships: [], demand: { shops: 60, hotel: 40 }, at: now(), match: now() + 4 * 60e3, stats: { grown: 0, shipped: 0, processed: 0, sold: 0, revenue: 0, profit: 0 }, inv: {}, mk: {}, taken: {} });
  const fresh = () => ({ cash: 2340, xp: 0, owned: {}, seen: {}, done: {}, eco: freshEco() });
  let S; try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  S.eco = Object.assign(freshEco(), S.eco || {}); // saves from the first sample gain the economy
  let saveFail = false; // a device can refuse to store anything (full, or private browsing): say so rather than lose progress silently
  const E = S.eco, save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); saveFail = false; } catch (e) { if (!saveFail) { saveFail = true; if (!NET.online) setTimeout(() => toast('Progress is not being saved', 'This device\'s storage is full or blocked (private browsing?). Playing online keeps your progress on the island server.', true), 0); } } };
  const QS = ['auto', 'low', 'medium', 'high'];
  let qpref = (() => { try { const v = localStorage.getItem('cs-sample3-q'); return QS.includes(v) ? v : 'auto'; } catch (e) { return 'auto'; } })(); // what the player picked; Auto lets the device decide

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
  function toast(t, b = '', bad) { $('toastT').textContent = t; $('toastB').textContent = b; $('toast').classList.toggle('bad', !!bad); $('toast').classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.remove('on'), bad ? 6500 : 2800); }

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
      for (const t of ['ci_buyers', 'ci_property', 'ci_listings'].concat(N.v2 ? ['ci_market', 'ci_contracts'] : [])) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => N.refresh());
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
  const nm = $('nm'), cnt = () => { $('nmCount').textContent = `${nm.value.trim().length} / 20`; };
  nm.value = S.name || ''; cnt();
  $('sw').insertAdjacentHTML('beforeend', COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === S.color ? 'on' : ''}" aria-label="Colour" aria-pressed="${c === S.color}"></button>`).join(''));
  $('sw').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { S.color = b.dataset.c; $('sw').querySelectorAll('[data-c]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); });
  const jmsg = (t, bad) => { $('jmsg').textContent = t; $('jmsg').classList.toggle('bad', !!bad); nm.classList.toggle('bad', !!bad); };
  const nameProblem = n => n.length < 3 ? 'Use at least 3 characters.' : n.length > 20 ? 'Use at most 20 characters.' : !/^[A-Za-z0-9 _.-]+$/.test(n) ? 'Only letters, numbers, spaces, dots, dashes and underscores.' : !NAME_RE.test(n) ? 'Start and end with a letter or a number.' : '';
  nm.oninput = () => { cnt(); const n = nm.value.trim(), p = n.length >= 3 || n.length > 20 ? nameProblem(n) : ''; jmsg(p, !!p); }; // say what's wrong while typing, but not before there's a name to judge
  // ---------- graphics: checked before Play, so a device that can't draw 3D says so here and not after a failed load ----------
  const GFX = (() => {
    const G = { ok: false, soft: false, renderer: '', why: '' };
    try {
      const cv = document.createElement('canvas'), gl = cv.getContext('webgl2') || cv.getContext('webgl') || cv.getContext('experimental-webgl');
      if (!gl) G.why = window.WebGLRenderingContext ? 'the browser would not create a 3D drawing surface (hardware acceleration is off or blocked)' : 'this browser has no WebGL';
      else {
        const x = gl.getExtension('WEBGL_debug_renderer_info'), tex = gl.getParameter(gl.MAX_TEXTURE_SIZE) | 0;
        G.renderer = String((x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '');
        G.soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(G.renderer); // drawn by the processor, not a graphics chip
        G.ok = tex >= 2048; if (!G.ok) G.why = `the graphics chip is too limited (largest texture ${tex} px, 2048 needed)`;
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); // the probe hands its context back; the game makes its own
      }
    } catch (e) { G.why = 'the graphics check failed (' + (e.message || e) + ')'; }
    return G;
  })();
  const autoQ = () => GFX.soft || (navigator.deviceMemory && navigator.deviceMemory <= 1) ? 'low' : navigator.deviceMemory && navigator.deviceMemory <= 2 ? 'medium' : 'high';
  const effQ = () => qpref === 'auto' ? autoQ() : qpref, cap = s => s[0].toUpperCase() + s.slice(1);
  const setQ = k => { qpref = k; try { localStorage.setItem('cs-sample3-q', k); } catch (e) { /* the choice holds for this visit */ } };
  const gfxMsg = (t, bad) => { const g = $('gfxmsg'); g.textContent = t; g.hidden = !t; g.classList.toggle('bad', !!bad); };
  const gfxNote = () => gfxMsg(!GFX.ok ? '' : GFX.soft ? 'This device draws 3D graphics in software, so the island will run slowly.' + (qpref === 'auto' ? ' Auto uses Low.' : '') : qpref === 'auto' ? `Auto uses ${cap(autoQ())} graphics on this device.` : '');
  $('gfx').insertAdjacentHTML('beforeend', QS.map(k => `<button type="button" data-q="${k}" class="${k === qpref ? 'on' : ''}" aria-pressed="${k === qpref}">${k[0].toUpperCase() + k.slice(1)}</button>`).join(''));
  $('gfx').querySelectorAll('[data-q]').forEach(b => b.onclick = () => { setQ(b.dataset.q); $('gfx').querySelectorAll('[data-q]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); gfxNote(); });
  if (GFX.ok) gfxNote();
  else { $('gfx').hidden = true; gfxMsg(`Capital Street can't start on this device: ${GFX.why}. Turn on hardware acceleration or update the browser, or try Chrome, Edge, Firefox or Safari. A lower graphics level can't fix this.`, true); $('play').disabled = true; $('play').textContent = 'CAN\'T PLAY HERE'; }
  // the device can take the graphics away (a background tab, a busy graphics chip): say so, and carry on when they come back
  (() => { let t = 0; const c = $('c'), box = $('glx');
    c.addEventListener('webglcontextlost', e => { e.preventDefault(); box.hidden = false; $('glxR').hidden = true; clearTimeout(t); t = setTimeout(() => { $('glxR').hidden = false; }, 6000); });
    c.addEventListener('webglcontextrestored', () => { clearTimeout(t); box.hidden = true; toast('Graphics are back', 'Nothing was lost'); });
    $('glxR').onclick = () => location.reload(); })();
  // phones and tablets: the on-screen keyboard shrinks the visible area, so the cover follows it and PLAY stays above the keys
  if (window.visualViewport) { const vv = visualViewport, cv = $('cover'); const fit = () => { const shrunk = vv.height < innerHeight - 120; cv.style.top = shrunk ? vv.offsetTop + 'px' : ''; cv.style.height = shrunk ? vv.height + 'px' : ''; if (shrunk && document.activeElement === nm) { const r = $('play').getBoundingClientRect(), over = r.bottom - (vv.offsetTop + vv.height) + 8; if (over > 0) cv.scrollBy({ top: over, behavior: 'smooth' }); } }; vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); nm.addEventListener('focus', () => setTimeout(fit, 400)); }
  const playBtn = (on, label) => { const b = $('play'); b.disabled = on; b.innerHTML = on ? `<span class="spin"></span>${label}` : label; };
  let started = false, joining = false, offline = !NET.ok;
  async function join() {
    if (joining || started || !GFX.ok) return; // one join at a time, however often Play is pressed (and none on a device that can't draw)
    const name = nm.value.trim(), bad = nameProblem(name);
    if (bad) { jmsg(bad, true); nm.focus(); return; } // what was typed stays, so it can be fixed
    joining = true; S.name = name; save(); $('offline').hidden = true;
    if (!offline) {
      playBtn(true, 'CONNECTING…'); jmsg('Connecting to the island server…');
      const r = await NET.join(name, S.color);
      if (r.missing) { offline = true; jmsg('The island server isn\'t switched on: playing offline on this device.'); } // the island tables aren't on this server yet
      else if (!r.ok) { const taken = /taken|in use|already/i.test(r.why || ''); jmsg(taken ? `Someone on the island is already called "${name}". Pick another name, like ${name.slice(0, 17)}${10 + Math.floor(Math.random() * 90)}.` : r.why, true); playBtn(false, 'TRY AGAIN'); if (r.net) $('offline').hidden = false; joining = false; nm.focus(); if (taken) nm.select(); return; }
      else applyState(r.state);
    }
    jmsg(offline ? 'Playing offline: your progress stays on this device.' : 'Joined. Building the island…'); playBtn(true, 'LOADING…');
    setTimeout(startWorld, 50);
  }
  function startWorld() {
    started = true;
    try { $('c').hidden = false; const t0 = performance.now(); World.init($('c'), effQ()); window.buildMs = Math.round(performance.now() - t0); }
    catch (e) {
      console.error(e); $('c').hidden = true; started = joining = false; const why = (e && e.message) || String(e);
      if (/webgl|context/i.test(why)) { jmsg('This device couldn\'t start 3D graphics (' + why + '). Turn on hardware acceleration, update the browser or try another one. A lower graphics level can\'t fix this.', true); playBtn(false, 'TRY AGAIN'); return; }
      setQ('low'); jmsg('The island couldn\'t be built here (' + why + '). Graphics are now set to Low: reload and press Play. Your progress is safe.', true); const b = $('play'); b.disabled = false; b.textContent = 'RELOAD'; b.onclick = () => location.reload(); return;
    }
    if (World.plotSites && window.Plots) { try { Plots.init(World, World.scene, typeof World.camera === 'function' ? World.camera() : World.camera, World.plotSites); } catch (e) { console.error('plots', e); } plotsSyncAll(); }
    $('cover').hidden = true; World.place(World.overview()); if (NET.online) { NET.live(); applyState(lastState); } else { NET.setStatus('offline'); resume(); } loop(performance.now());
    World.flyTo(World.homeView(), 2, () => { $('hud').hidden = false; draw(); objective(); });
  }
  $('play').onclick = join; nm.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); join(); } };
  $('offline').onclick = () => { offline = true; joining = false; join(); };
  if (matchMedia('(pointer: fine)').matches && !new URLSearchParams(location.search).has('play')) setTimeout(() => nm.focus(), 200); // a keyboard is there: start typing (on phones the keyboard would cover the picture)
  { const q = new URLSearchParams(location.search); if (q.get('name')) $('nm').value = q.get('name'); if (q.has('offline')) offline = true; if (q.has('play')) join(); }

  let last = 0, frames = 0, fpsT = 0, follow = null;
  function loop(t) {
    const dt = Math.max(0, Math.min(0.1, (t - (last || t)) / 1000)); last = t;
    if (follow) { const c = follow.h.car; if (c && c.last) { const v = World.current(); v.t.lerp(new THREE.Vector3(c.last.x, 3, c.last.z), 0.25); World.place(v); } else unfollow(); } // until it arrives, or you move the map
    World.step(dt); labels();
    frames++; fpsT += dt; if (fpsT > 1) { $('fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
    requestAnimationFrame(loop);
  }
  function world() { const g = E.grows[0]; World.farm({ grow: g ? clamp01((now() - g.start) / ((g.end - g.start) || 1)) : -1, harvested: E.farm.qty > 0 || E.plantIn.qty > 0 || E.plantOut.qty > 0 || E.ships.length > 0 || E.stats.grown > 0, farm: E.farm.qty, plantIn: E.plantIn.qty, plantOut: E.plantOut.qty, proc: E.procs.length > 0 }); World.event({ match: matchOn() }); } // the world shows your farm, stores and the match
  const clamp01 = v => Math.max(0, Math.min(1, v));
  setInterval(() => { if (!$('hud').hidden) { economy(); world(); draw(); objective(); if (panel === 'trade' || panel === 'jobs') refresh(); } }, 1000);
  function draw() {
    const l = level(), nx = LEVELS[l + 1];
    $('lvN').textContent = l + 1; $('lvT').textContent = `Level ${l + 1}`; $('lvNext').textContent = nx ? `${S.xp} / ${nx.xp} XP · ${nx.reward.split(':')[0]}` : `${S.xp} XP · top level`; // XP so far against the total the next level needs
    $('lvBar').style.setProperty('--p', (nx ? (S.xp - LEVELS[l].xp) / (nx.xp - LEVELS[l].xp) * 100 : 100) + '%');
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
    const h = World.dispatch({ type: s.vehicle === 'truck' ? ((s.good || s.kind) === 'crop' ? 'flatbed' : s.good === 'fuel' ? 'tanker' : 'truck') : s.vehicle, from: s.from, to: s.to, frac: s.frac || 0, paint: PAINT[s.good || s.kind], onArrive: () => arrive(s) });
    handles.set(s.id, h); s.status = h.status; s.why = h.why;
  }
  async function deliverOnline(s, tries = 0) { // the vehicle is there: the server checks the trip and pays once
    try { const st = await NET.call('ci_deliver', { p_id: s.id }), r = st.result; applyState(st); if (r && r.kind === 'contract') { S.done.firstContract = true; toast(`Contract done: +${usd(r.revenue)}`, `${gname(r.good, r.qty)} · +${r.xp} XP`); } else if (r && (r.kind === 'goods' || r.kind === 'fuel')) { S.done.firstTrade = true; toast(`Sold ${gname(r.good, r.qty)} for ${usd2(r.revenue)}`, `profit ${usd2(r.profit)} · +${r.xp} XP`); } else if (r && r.kind === 'food') toast(`Sold ${r.qty} boxes for ${usd(r.revenue)}`, `profit ${usd(r.profit)} · +${r.xp} XP`); else if (r) toast(`${r.qty} crates delivered`, 'In the Processing Plant store'); }
    catch (e) { if (tries < 80) setTimeout(() => deliverOnline(s, tries + 1), 3000); } // offline or not quite there yet: try again shortly
  }
  function arrive(s) {
    if (NET.online) { handles.delete(s.id); s.arrived = true; s.frac = 1; deliverOnline(s); return; }
    if (s.good) return arriveV2(s);
    handles.delete(s.id); s.status = 'delivered'; s.done = now(); s.frac = 1;
    if (s.kind === 'crop') { E.plantIn.qty += s.qty; E.plantIn.cost += s.basis + s.fee; E.stats.shipped += s.qty; toast(`${s.qty} crates delivered`, 'In the Processing Plant store'); }
    else { const rev = s.qty * s.price, profit = rev - s.basis - s.fee; logCash(rev, `Sold ${gname('food', s.qty)} to ${BUYER[s.buyer].name}`); E.demand[s.buyer] = Math.max(0, E.demand[s.buyer] - s.qty); E.stats.sold += s.qty; E.stats.revenue += rev; E.stats.profit += profit; toast(`Sold ${s.qty} boxes for ${usd(rev)}`, `${BUYER[s.buyer].name} · profit ${usd(profit)}`); xp(Math.min(60, Math.max(0, Math.floor(profit / 10))), 'Profit from a delivery') /* the same rule as the server */; once('firstSale', 20, 'Your first complete food chain'); }
    save(); refresh();
  }
  function resume() { for (const s of E.ships) if (s.status !== 'delivered' && s.status !== 'queued') send(s); } // after a reload, trips carry on from where they were
  const R = (a, b) => World.routeInfo(a, b);
  let OWN = new Map(), MARKET = [], skew = 0, lastState = null, seenJobs = null;
  const srv = t => Date.parse(t) - skew; // server time, in this device's clock
  const lotOf = b => b.lot || `${b.type}@${Math.round(b.x)},${Math.round(b.z)}`; // a building that had to move keeps the id of the plot it was sold as
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
      return { id: x.id, kind: x.kind, good: x.good || null, reward: x.reward == null ? null : +x.reward, contract: x.contract || null, from: x.from_node, to: x.to_node, buyer: x.buyer, qty: x.qty, fee: +x.fee, price: +x.price, basis: +x.basis, vehicle: x.vehicle, status: old && old.status === 'failed' && x.status === 'travelling' ? 'failed' : x.status, why: old ? old.why : '', frac: old && old.frac ? old.frac : est, done: x.delivered_at ? srv(x.delivered_at) : 0 }; });
    for (const b of st.buyers) { E.demand[b.buyer] = +b.demand; (E.prices = E.prices || {})[b.buyer] = +b.price; }
    E.matchOn = st.match; E.matchAt = Date.now() + st.match_in * 1000;
    OWN = new Map(st.property.map(p => [p.lot, p])); MARKET = st.listings;
    NET.v2 = !!st.v2; if (NET.online && !NET.v2) { jobsTab = 'food'; tradeTab = 'food'; } if (st.v2) { E.v2 = { market: st.v2.market, contracts: st.v2.contracts, ledger: st.v2.ledger, at: Date.now() }; E.inv = {}; for (const i of st.v2.inv) E.inv[i.good] = { qty: i.qty, cost: +i.cost }; } // the new economy, once the server has it
    if (World.cars) for (const x of E.ships) if (x.status === 'travelling' && !handles.has(x.id) && !x.arrived) send(x); // trips on the road get their vehicle (after a reload too)
    if (level() > lvl0) toast(`Level ${level() + 1}!`, 'Unlocked: ' + LEVELS[level()].reward);
    save(); if (!$('hud').hidden) { draw(); objective(); }
  }
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

  // what each action costs and earns, worked out before you confirm: what you pay now is kept apart from what you already
  // spent on the goods, and anything that depends on a later price is marked as an estimate
  function quote(act, qty, buyer) {
    if (act === 'buygoods' || act === 'sendgoods' || act === 'contract') return quoteV2(act, qty, buyer);
    const c = CAP(), F = FLEET(), q = { act, qty, rows: [], ok: true, why: '', note: '' }, row = (k, v, cls = '') => q.rows.push([k, v, cls]), shopP = priceOf('shops');
    if (act === 'grow') {
      const room = c.farm - E.farm.qty - growing(); q.max = Math.max(0, room); const cost = qty * SEED, r1 = R('FA', 'P'), r2 = R('P', 'C'), trips = Math.ceil(qty / c.truck), estShip = shipFee('truck', r1 ? r1.len : 900) * trips + shipFee(F.van && qty <= c.van ? 'van' : 'truck', r2 ? r2.len : 900) * trips, est = qty * shopP - cost - qty * PROC_FEE - estShip;
      row('You pay now', `${usd(cost)} (seed and labour, ${usd(SEED)} × ${qty})`, 'key'); row('Ready in', `${clock(qty * GROW_S)}, on your field at Greenfields`); row('Co-op store after', `${E.farm.qty + growing() + qty} of ${c.farm} crates`); row('Next', 'Truck the crates to the plant');
      row('If all of it sells to the shops at today\'s price', `about ${usd(qty * shopP)} back, ${usd(est)} profit after every step (estimate)`, 'est');
      q.cost = cost; if (qty > room) { q.ok = false; q.why = room <= 0 ? 'The co-op store is full. Truck crates to the plant first.' : `There's room for ${room} more crates.`; } else if (S.cash < cost) { q.ok = false; q.why = `You need ${usd(cost)}; you have ${usd(S.cash)}. Try fewer crates.`; }
    } else if (act === 'ship') {
      const r = R('FA', 'P'), room = c.plantIn - E.plantIn.qty - inbound('P'), max = Math.min(E.farm.qty, c.truck, Math.max(0, room)); q.max = max; q.vehicle = 'truck';
      const fee = shipFee('truck', r ? r.len : 0), free = F.truck - busy('truck'); q.cost = fee;
      row('Crates', `${qty} of ${E.farm.qty} at the co-op (a truck carries ${c.truck})`); row('Already spent on them', usd(avg(E.farm) * qty)); row('You pay now', `${usd(fee)} shipping`, 'key');
      row('Route', r ? `${(r.len / 1000).toFixed(1)} km by road, over the bridge, about ${clock(eta(r.len))}` : 'No open route'); row('Truck', free > 0 ? 'Sets off now' : 'Your truck is on another trip: this one waits for it');
      row('Sale', 'None yet: this moves the crates to your store at the plant'); row('Worth as food at today\'s shop price', `about ${usd(qty * shopP)} (estimate)`, 'est');
      if (!r) { q.ok = false; q.why = 'The road to the plant is closed. Try again when it reopens.'; } else if (!qty || qty > max) { q.ok = false; q.why = !E.farm.qty ? 'No crates at the co-op yet.' : room <= 0 ? 'Your store at the plant is full: process what is there first.' : 'Too many for one truck.'; } else if (S.cash < fee) { q.ok = false; q.why = `Shipping costs ${usd(fee)}; you have ${usd(S.cash)}.`; }
    } else if (act === 'process') {
      const room = c.plantOut - E.plantOut.qty - E.procs.reduce((a, p) => a + p.qty, 0), max = Math.min(E.plantIn.qty, Math.max(0, room)); q.max = max; const fee = qty * PROC_FEE; q.cost = fee;
      row('Crates in', `${qty} of ${E.plantIn.qty} in your plant store`); row('Already spent on them', usd(avg(E.plantIn) * qty)); row('You pay now', `${usd(fee)} processing (${usd(PROC_FEE)} × ${qty})`, 'key'); row('Ready in', clock(qty * PROC_S)); row('Makes', `${qty} boxes of food, in the same store`); row('Next', 'Deliver the food to a buyer');
      if (!qty || qty > max) { q.ok = false; q.why = !E.plantIn.qty ? 'No crates at the plant yet.' : 'Not enough room for the food: deliver some first.'; } else if (S.cash < fee) { q.ok = false; q.why = `Processing costs ${usd(fee)}; you have ${usd(S.cash)}.`; }
    } else if (act === 'deliver') {
      const B = BUYER[buyer], r = R('P', NODE[buyer]), want = Math.floor(E.demand[buyer] - inbound(NODE[buyer])), vehicle = qty <= c.van && F.van ? 'van' : 'truck', max = Math.max(0, Math.min(E.plantOut.qty, want, F.van ? Math.max(c.truck, c.van) : c.truck)); q.max = max; q.vehicle = vehicle;
      const fee = shipFee(vehicle, r ? r.len : 0), price = priceOf(buyer), basis = avg(E.plantOut) * qty, rev = qty * price, net = rev - basis - fee; q.cost = fee; q.price = price;
      row('Food boxes', `${qty} of ${E.plantOut.qty} at the plant`); row('Price, fixed now', `${usd(price)} a box${buyer === 'shops' && matchOn() ? ' (match day +15%)' : ''}`); row('Paid to you on arrival', usd(rev));
      row('Already spent on this food', usd(basis)); row('You pay now', `${usd(fee)} shipping by ${vehicle}`, 'key'); row('Route', r ? `${(r.len / 1000).toFixed(1)} km, about ${clock(eta(r.len))}` : 'No open route');
      row('Profit when it arrives', usd(net), net > 0 ? 'ok' : 'bad'); row(`${B.name} still want`, `${Math.max(0, want)} boxes`);
      q.note = 'Every player sells to the same buyers. Booking reserves these boxes of demand and fixes the price, so it stays the same while the food travels.';
      if (buyer === 'hotel' && level() < 2) { q.ok = false; q.why = 'The Hotel Azure contract opens at level 3.'; } else if (!r) { q.ok = false; q.why = 'No open route.'; } else if (!qty || qty > max) { q.ok = false; q.why = !E.plantOut.qty ? 'No food at the plant yet.' : want <= 0 ? `${B.name} don't need more right now: demand refills over a few minutes.` : 'Too many for one trip.'; } else if (S.cash < fee) { q.ok = false; q.why = `Shipping costs ${usd(fee)}; you have ${usd(S.cash)}.`; }
    }
    return q;
  }
  let pendingCall = false;
  async function confirmOnline(q, buyer) { // the server books it, or says why not; nothing changes here until it answers
    if (pendingCall) return; pendingCall = true; const ok = $('qok'); if (ok) { ok.disabled = true; ok.textContent = 'SENDING…'; }
    const id = uuid(), call = q.act === 'grow' ? ['ci_grow', { p_qty: q.qty }] : q.act === 'process' ? ['ci_process', { p_qty: q.qty }] : ['ci_ship', { p_id: id, p_kind: q.act === 'ship' ? 'crop' : 'food', p_qty: q.qty, p_buyer: q.act === 'deliver' ? buyer : null }];
    try { applyState(await NET.call(call[0], call[1])); toast({ grow: `Planting ${q.qty} crates`, process: `Processing ${q.qty} crates`, ship: `Truck booked: ${q.qty} crates`, deliver: `Delivery booked: ${q.qty} boxes` }[q.act], 'Confirmed by the island server'); pendingCall = false; open('jobs'); }
    catch (e) { pendingCall = false; toast(e.net ? 'No connection' : 'Not done', e.net ? 'Check Jobs when you are back online: it may or may not have gone through.' : e.message, true); if (ok) { ok.disabled = false; ok.textContent = 'CONFIRM'; } NET.refresh(); }
  }
  function confirm(q, buyer) {
    if (q.act === 'buygoods' || q.act === 'sendgoods' || q.act === 'contract') return confirmV2(q, buyer);
    if (!q.ok) return;
    if (NET.online) return confirmOnline(q, buyer);
    const id = 's' + now() + Math.floor(Math.random() * 1000);
    if (q.act === 'grow') { logCash(-q.cost, `Seed for ${q.qty} crates`); E.grows.push({ qty: q.qty, cost: q.cost, start: now(), end: now() + q.qty * GROW_S * 1000 }); toast(`Planting ${q.qty} crates`, `Ready in ${clock(q.qty * GROW_S)}`); }
    else if (q.act === 'process') { logCash(-q.cost, `Processing ${q.qty} crates`); const basis = take(E.plantIn, q.qty); E.procs.push({ qty: q.qty, cost: basis + q.cost, start: now(), end: now() + q.qty * PROC_S * 1000 }); toast(`Processing ${q.qty} crates`, `Food ready in ${clock(q.qty * PROC_S)}`); }
    else if (q.act === 'ship') { logCash(-q.cost, `Shipping ${gname('crop', q.qty)}`); const s = { id, kind: 'crop', from: 'FA', to: 'P', qty: q.qty, fee: q.cost, basis: take(E.farm, q.qty), vehicle: 'truck', status: 'queued', frac: 0 }; E.ships.push(s); if (busy('truck') < FLEET().truck) send(s); toast(`Truck booked: ${q.qty} crates`, 'Greenfields → Processing Plant'); }
    else if (q.act === 'deliver') { logCash(-q.cost, `Shipping ${gname('food', q.qty)}`); const s = { id, kind: 'food', from: 'P', to: NODE[buyer], buyer, qty: q.qty, fee: q.cost, price: q.price, basis: take(E.plantOut, q.qty), vehicle: q.vehicle, status: 'queued', frac: 0 }; E.ships.push(s); if (busy(q.vehicle) < FLEET()[q.vehicle]) send(s); toast(`Delivery booked: ${q.qty} boxes`, `Processing Plant → ${BUYER[buyer].name}`); }
    once('first:' + q.act, 5, 'First ' + q.act); save(); open('jobs');
  }

  // ---------- wholesale goods and delivery contracts (always offline; online once the server has them) ----------
  // The rules (prices, refills, the contract board) are in market.js, which the server's functions follow too.
  const MK = Market, usd2 = v => (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2), PAINT = { crop: 0x8fd16a, food: 0xffc93c, goods: 0x4c8dff, fuel: 0xd8392b };
  const gname = (g, n) => { const x = MK.GOODS[g]; return `${n} ${n === 1 ? x[0] : x[1]} of ${x[2].toLowerCase()}`; }; // "20 cartons of goods"
  const inv = g => (E.inv && E.inv[g]) || { qty: 0, cost: 0 }; // what you hold in your warehouse at the quay
  const logCash = (d, note) => { S.cash += d; if (d) { (S.ledger = S.ledger || []).unshift({ t: now(), n: note, a: d, c: S.cash }); S.ledger.length = Math.min(S.ledger.length, 60); } }; // offline: money in and out, with what it was for
  const sclock = () => Date.now() + (NET.online ? skew : 0); // the island's time: the server's when online
  const bizNow = id => { // a business with the whole units it holds (supplier) or still wants (buyer) right now
    const b = MK.BIZ[id]; let units;
    if (NET.online) { const m = ((E.v2 && E.v2.market) || []).find(x => x.biz === id); units = m ? MK.units(m.units, E.v2.at, now(), b.refill, b.cap) : 0; }
    else { const m = E.mk[id] || (E.mk[id] = { qty: b.cap, at: now() }); units = MK.units(m.qty, m.at, now(), b.refill, b.cap); }
    return Object.assign({ id, units }, b);
  };
  const bizList = side => Object.keys(MK.BIZ).filter(k => MK.BIZ[k].side === side).map(bizNow);
  const contracts = () => NET.online ? ((E.v2 && E.v2.contracts) || []).map(c => ({ id: c.id, good: c.good, from: c.from, to: c.to, qty: c.qty, reward: +c.reward, level: c.level, meters: MK.meters(c.from, c.to), expiresMs: srv(c.expires_at) })) : MK.board(now()).filter(c => !E.taken[c.id]);
  function bestBuyer(good, qty) { // the buyer who'd pay most for these, after shipping, at today's demand
    let best = null; for (const b of bizList('buy').filter(b => b.good === good && b.level <= level() && b.units > 0)) { const n = Math.min(qty, b.units), total = MK.totalCents('buy', b.base, b.cap, b.units, n) / 100, fee = MK.fee(MK.vehicleFor(n, level()), MK.meters('K', b.node)), net = total - fee; if (!best || net > best.net) best = { name: b.name, n, total, fee, net }; }
    return best;
  }
  function quoteV2(act, qty, id) {
    const q = { act, qty, rows: [], ok: true, why: '', note: '' }, row = (k, v, cls = '') => q.rows.push([k, v, cls]), L = level(), F = FLEET();
    if (act === 'buygoods') {
      const b = bizNow(id), held = inv(b.good), room = Math.max(0, 200 - held.qty), max = Math.max(0, Math.min(b.units, 80, room)), total = qty ? MK.totalCents('sell', b.base, b.cap, b.units, qty) / 100 : 0, best = qty ? bestBuyer(b.good, qty) : null;
      q.max = max; q.cost = total;
      row('You pay now', `${usd2(total)} for ${gname(b.good, qty)}`, 'key'); row('Price', qty ? `${usd2(total / qty)} each on average; the first costs ${usd2(MK.unitCents('sell', b.base, b.cap, b.units) / 100)} and the price rises as the depot sells` : 'n/a');
      row(`${b.name} has`, `${b.units} of ${b.cap} now, ${Math.max(0, b.units - qty)} after you buy`); row('Goes to', `your warehouse at the harbour quay (${held.qty} held, room for ${room})`);
      if (best) row(`Sent to ${best.name} today`, `about ${usd2(best.total)} on arrival, ${usd2(best.fee)} shipping: about ${usd2(best.total - total - best.fee)} profit (estimate)`, 'est');
      q.note = 'The depot\'s stock is shared by every player and refills over time. This is not a sale yet: next you send the goods to a business that wants them.';
      if (b.level > L) { q.ok = false; q.why = `${b.name} opens at level ${b.level + 1}.`; } else if (!qty || qty > max) { q.ok = false; q.why = b.units <= 0 ? `${b.name} is sold out for now: stock refills over a few minutes.` : room <= 0 ? 'Your warehouse is full.' : `You can buy up to ${max} now.`; } else if (S.cash < total) { q.ok = false; q.why = `You need ${usd2(total)}; you have ${usd(S.cash)}.`; }
    } else if (act === 'sendgoods') {
      const b = bizNow(id), held = inv(b.good), vehicle = MK.vehicleFor(qty, L), r = R('K', b.node), fee = MK.fee(vehicle, MK.meters('K', b.node)), max = Math.max(0, Math.min(held.qty, b.units, 40)), total = qty ? MK.totalCents('buy', b.base, b.cap, b.units, qty) / 100 : 0, basis = held.qty ? held.cost / held.qty * qty : 0, net = total - basis - fee, free = F[vehicle] - busy(vehicle);
      q.max = max; q.cost = fee; q.total = total; q.vehicle = vehicle;
      row('Cargo', `${gname(b.good, qty)}, of ${held.qty} in your warehouse`); row('Price, fixed now', qty ? `${usd2(total / qty)} each on average` : 'n/a'); row('Paid to you on arrival', usd2(total)); row('Already spent on them', usd2(basis));
      row('You pay now', `${usd(fee)} shipping by ${vehicle}`, 'key'); row('Route', r ? `${(r.len / 1000).toFixed(1)} km, about ${clock(eta(r.len))}` : 'No open route'); row(vehicle === 'van' ? 'Van' : 'Truck', free > 0 ? 'Sets off now' : 'Your vehicle is on another trip: this one waits for it');
      row('Profit when it arrives', usd2(net), net > 0 ? 'ok' : 'bad'); row(`${b.name} still want`, `${b.units} now, ${Math.max(0, b.units - qty)} after this`);
      q.note = 'Every player sells to the same businesses. Booking reserves this demand and fixes the price, so it stays the same while the goods travel.';
      if (b.level > L) { q.ok = false; q.why = `${b.name} opens at level ${b.level + 1}.`; } else if (!r) { q.ok = false; q.why = 'No open route.'; } else if (!qty || qty > max) { q.ok = false; q.why = !held.qty ? `You hold no ${MK.GOODS[b.good][2].toLowerCase()}: buy some at the harbour depot first.` : b.units <= 0 ? `${b.name} don't want more right now: demand refills over a few minutes.` : `You can send up to ${max} now.`; } else if (S.cash < fee) { q.ok = false; q.why = `Shipping costs ${usd(fee)}; you have ${usd(S.cash)}.`; }
    } else { // a delivery contract
      const c = contracts().find(x => x.id === id); q.fixed = true; q.cost = 0;
      if (!c) { q.ok = false; q.why = 'That contract has gone: someone took it, or it expired.'; return q; }
      const vehicle = MK.vehicleFor(c.qty, L), r = R(c.from, c.to), free = F[vehicle] - busy(vehicle), running = E.ships.filter(s => s.kind === 'contract' && s.status !== 'delivered').length;
      q.qty = c.qty; q.vehicle = vehicle; q.reward = c.reward;
      row('Carry', gname(c.good, c.qty)); row('From', PLACE[c.from]); row('To', PLACE[c.to]); row('Route', r ? `${(r.len / 1000).toFixed(1)} km, about ${clock(eta(r.len))}` : 'No open route'); row(vehicle === 'van' ? 'Van' : 'Truck', free > 0 ? 'Sets off now' : 'Waits until your vehicle is free');
      row('You pay now', '$0: the cargo and the bill are theirs', 'key'); row('Paid to you on arrival', usd(c.reward), 'ok'); row('XP', `+${Math.min(25, Math.floor(c.reward / 8))}`);
      q.note = 'Contracts are shared: the first player to confirm gets it. Your vehicle is busy until it arrives.';
      if (c.level > L) { q.ok = false; q.why = `This contract opens at level ${c.level + 1}.`; } else if (running >= 3) { q.ok = false; q.why = 'You already have 3 contracts running.'; } else if (!r) { q.ok = false; q.why = 'No open route.'; }
    }
    return q;
  }
  async function confirmV2(q, id) {
    if (!q.ok) return;
    if (NET.online) { // the server books it, or says why not; nothing changes here until it answers
      if (pendingCall) return; pendingCall = true; const ok = $('qok'); if (ok) { ok.disabled = true; ok.textContent = 'SENDING…'; }
      const tid = uuid(), call = q.act === 'buygoods' ? ['ci_buy_goods', { p_id: tid, p_biz: id, p_qty: q.qty }] : q.act === 'sendgoods' ? ['ci_sell_goods', { p_id: tid, p_good: MK.BIZ[id].good, p_qty: q.qty, p_biz: id }] : ['ci_take_contract', { p_id: tid, p_contract: id }];
      try { applyState(await NET.call(call[0], call[1])); toast(q.act === 'buygoods' ? `Bought ${gname(MK.BIZ[id].good, q.qty)}` : q.act === 'sendgoods' ? `Delivery booked: ${gname(MK.BIZ[id].good, q.qty)}` : 'Contract taken', 'Confirmed by the island server'); pendingCall = false; open(q.act === 'contract' ? 'jobs' : 'trade'); }
      catch (e) { pendingCall = false; toast(e.net ? 'No connection' : 'Not done', e.net ? 'Check Trade and Jobs when you are back online: it may or may not have gone through.' : e.message, true); if (ok) { ok.disabled = false; ok.textContent = 'CONFIRM'; } NET.refresh(); }
      return;
    }
    const tid = 's' + now() + Math.floor(Math.random() * 1000);
    if (q.act === 'buygoods') {
      const b = bizNow(id), h = E.inv[b.good] || (E.inv[b.good] = { qty: 0, cost: 0 }), m = E.mk[id];
      logCash(-q.cost, `Bought ${gname(b.good, q.qty)} from ${b.name}`); m.qty = b.units - q.qty; m.at = now(); h.qty += q.qty; h.cost += q.cost; toast(`Bought ${gname(b.good, q.qty)}`, `${usd2(q.cost)} · in your warehouse at the quay`);
    } else if (q.act === 'sendgoods') {
      const b = bizNow(id), m = E.mk[id], basis = take(E.inv[b.good], q.qty);
      logCash(-q.cost, `Shipping ${gname(b.good, q.qty)} to ${b.name}`); m.qty = b.units - q.qty; m.at = now();
      const s = { id: tid, kind: b.good, good: b.good, from: 'K', to: b.node, buyer: id, qty: q.qty, fee: q.cost, price: q.total / q.qty, reward: q.total, basis, vehicle: q.vehicle, status: 'queued', frac: 0 }; E.ships.push(s); if (busy(q.vehicle) < FLEET()[q.vehicle]) send(s); toast(`Delivery booked: ${gname(b.good, q.qty)}`, `Harbour quay → ${b.name}`);
    } else {
      const c = contracts().find(x => x.id === id); if (!c) return; E.taken[id] = now();
      const s = { id: tid, kind: 'contract', good: c.good, contract: id, from: c.from, to: c.to, qty: c.qty, fee: 0, reward: c.reward, basis: 0, vehicle: q.vehicle, status: 'queued', frac: 0 }; E.ships.push(s); if (busy(q.vehicle) < FLEET()[q.vehicle]) send(s); toast('Contract taken', `${gname(c.good, c.qty)} · ${PLACE[c.from]} → ${PLACE[c.to]}`);
    }
    once('first:' + q.act, 5, 'First ' + ({ buygoods: 'wholesale purchase', sendgoods: 'wholesale delivery', contract: 'contract' })[q.act]); save(); open(q.act === 'contract' ? 'jobs' : 'trade');
  }
  function arriveV2(s) { // goods, fuel and contracts reach their place: the business pays what was fixed when the trip was booked
    handles.delete(s.id); s.status = 'delivered'; s.done = now(); s.frac = 1;
    if (s.kind === 'contract') { logCash(s.reward, `Contract: carried ${gname(s.good, s.qty)}`); xp(Math.min(25, Math.floor(s.reward / 8)), 'Contract delivered'); toast(`Contract done: +${usd(s.reward)}`, `${gname(s.good, s.qty)} · ${PLACE[s.from]} → ${PLACE[s.to]}`); once('firstContract', 15, 'Your first contract'); }
    else { const rev = s.reward, profit = rev - s.basis - s.fee, b = MK.BIZ[s.buyer]; logCash(rev, `Sold ${gname(s.good, s.qty)} to ${b.name}`); xp(Math.min(60, Math.max(0, Math.floor(profit / 10))), 'Profit from a delivery'); toast(`Sold ${gname(s.good, s.qty)} for ${usd2(rev)}`, `${b.name} · profit ${usd2(profit)}`); once('firstTrade', 20, 'Your first wholesale trade'); }
    save(); refresh();
  }
  // ---------- the new screens ----------
  let jobsTab = 'contracts', tradeTab = 'goods';
  const seg2 = (key, cur, items) => `<div class="seg">${items.map(([k, n]) => `<button data-${key}="${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  const jobsSeg = () => seg2('jt', jobsTab, [['contracts', 'Contracts'], ['food', 'Food business'], ['business', 'My business']]), tradeSeg = () => seg2('tt', tradeTab, [['goods', 'Wholesale'], ['food', 'Food & players'], ['market', 'Resources']]);
  const bindSegs = r => { r.querySelectorAll('[data-jt]').forEach(b => b.onclick = () => { jobsTab = b.dataset.jt; open('jobs'); }); r.querySelectorAll('[data-tt]').forEach(b => b.onclick = () => { tradeTab = b.dataset.tt; open('trade'); }); };
  const ledger = () => NET.online ? ((E.v2 && E.v2.ledger) || []).map(x => ({ t: srv(x.at), n: x.note, a: +x.amount, c: +x.cash })) : (S.ledger || []);
  function contractsPanel() {
    const L = level(), F = FLEET(), list = contracts().sort((a, b) => b.reward - a.reward), mine = E.ships.filter(s => s.kind === 'contract' && s.status !== 'delivered'), nextIn = MK.SLOT_S - (sclock() / 1000) % MK.SLOT_S;
    const row = c => { const lock = c.level > L, v = MK.vehicleFor(c.qty, L); return `<div class="row ${lock ? 'lock' : ''}"><span class="ic">${ic({ crop: 'crop', food: 'factory' }[c.good] || 'truck')}</span><div><b>${esc(gname(c.good, c.qty))}</b><small>${esc(PLACE[c.from])} → ${esc(PLACE[c.to])} · ${(c.meters / 1000).toFixed(1)} km · by ${v} · ${clock((c.expiresMs - sclock()) / 1000)} left</small></div>${lock ? `<span class="lockt">LEVEL ${c.level + 1}</span>` : `<button class="btn go" data-ct="${esc(c.id)}">${usd(c.reward)}</button>`}</div>`; };
    return { title: 'Jobs · contracts', html: `${jobsSeg()}<p class="note">Delivery contracts pay you to carry another business's cargo. You pay nothing: the cargo and the bill are theirs, and the reward comes when it arrives. Two new ones every two minutes; the first player to confirm gets each one.</p>
      ${mine.length ? `<p class="sec">Yours · on the road</p>${mine.map(shipRow).join('')}` : ''}
      <p class="sec">Open now · next in ${clock(nextIn)}</p>${list.map(row).join('') || '<p class="note">None open right now: the next is on its way.</p>'}
      <p class="note">Vehicles: ${F.truck - busy('truck')} of ${F.truck} truck${F.truck > 1 ? 's' : ''} free${F.van ? ` · ${F.van - busy('van')} of ${F.van} van free` : ''}. A van takes up to 20, a truck up to 40; your food trips use the same ones.</p>`,
      bind: r => { bindSegs(r); bindTrack(r); r.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => open('quote', { act: 'contract', buyer: b.dataset.ct }, true)); } };
  }
  function goodsPanel() {
    const L = level(), sup = bizList('sell'), buy = bizList('buy'), trips = E.ships.filter(s => s.good && s.kind !== 'contract' && s.status !== 'delivered'), held = inv('goods').qty + inv('fuel').qty;
    const supRow = b => `<div class="row"><span class="ic">${ic('trade')}</span><div><b>${esc(b.name)} · ${esc(MK.GOODS[b.good][2])}</b><small>${usd2(MK.unitCents('sell', b.base, b.cap, b.units) / 100)} a ${MK.GOODS[b.good][0]} · ${b.units} in stock · refills about ${Math.round(60 / b.refill)} a minute</small>${bar(b.units, b.cap)}</div><button class="btn go" data-bg="${b.id}" ${b.units && !(b.level > L) ? '' : 'disabled'}>BUY</button></div>`;
    const buyRow = b => { const have = inv(b.good).qty, lock = b.level > L; return `<div class="row ${lock ? 'lock' : ''}"><span class="ic">${ic('home')}</span><div><b>${esc(b.name)} · ${esc(MK.GOODS[b.good][2])}</b><small>${usd2(MK.unitCents('buy', b.base, b.cap, b.units) / 100)} a ${MK.GOODS[b.good][0]} · want ${b.units} · ${(MK.meters('K', b.node) / 1000).toFixed(1)} km from the quay</small>${bar(b.units, b.cap)}</div>${lock ? `<span class="lockt">LEVEL ${b.level + 1}</span>` : `<button class="btn ${have ? 'go' : 'ghost'}" data-sg="${b.id}" ${have && b.units ? '' : 'disabled'}>SEND</button>`}</div>`; };
    return { title: 'Trade · wholesale', html: `${tradeSeg()}<div class="inv"><div>Goods<b>${inv('goods').qty}</b>cartons at the quay</div><div>Fuel<b>${inv('fuel').qty}</b>drums at the quay</div><div>Spent on them<b>${usd(inv('goods').cost + inv('fuel').cost)}</b>so far</div><div>On the road<b>${trips.reduce((a, s) => a + s.qty, 0)}</b>${trips.length} trip${trips.length === 1 ? '' : 's'}</div></div>
      <p class="sec">Buy at the harbour · the price rises as the stock falls</p>${sup.map(supRow).join('')}
      <p class="sec">Send to a business · they pay more the more they still want</p>${buy.map(buyRow).join('')}
      <p class="note">${held ? 'Your goods wait at the quay until you send them.' : 'Buy goods or fuel at the depot, then send them to a business that wants them.'} Every player shares these businesses: buying empties the depot's shelf and selling fills a buyer, then both refill slowly. Prices are fixed when you book a delivery. Margins come from picking the best buyer while they still want more.</p>
      ${trips.length ? `<p class="sec">On the road</p>${trips.map(shipRow).join('')}` : ''}`,
      bind: r => { bindSegs(r); bindTrack(r); r.querySelectorAll('[data-bg]').forEach(b => b.onclick = () => open('quote', { act: 'buygoods', buyer: b.dataset.bg }, true)); r.querySelectorAll('[data-sg]').forEach(b => b.onclick = () => open('quote', { act: 'sendgoods', buyer: b.dataset.sg }, true)); } };
  }
  const v2on = () => !NET.online || NET.v2; // offline the new economy is always there; online it needs the upgraded island server
  const soon = (title, seg) => ({ title, html: `${seg}<p class="note">Contracts and wholesale trading aren't switched on for the online island yet: the island server needs its upgrade first. Until then you can try them offline (add <b>?offline</b> to the address); the food business, property and offers between players work online as before.</p>`, bind: r => bindSegs(r) });
  function overview() { // on Home: your wholesale goods, money in and out, and what each change was for
    if (!v2on()) return '';
    const led = ledger(), cut = sclock() - 10 * 60e3, recent = led.filter(x => x.t > cut), earned = recent.filter(x => x.a > 0).reduce((a, x) => a + x.a, 0), spent = -recent.filter(x => x.a < 0).reduce((a, x) => a + x.a, 0);
    return `<p class="sec">Wholesale goods</p><div class="inv"><div>Goods<b>${inv('goods').qty}</b>cartons at the quay</div><div>Fuel<b>${inv('fuel').qty}</b>drums at the quay</div></div>
      <p class="sec">Money in and out · last 10 minutes</p><div class="stats"><div>In<b>${usd(earned)}</b></div><div>Out<b>${usd(spent)}</b></div><div>Net<b>${usd(earned - spent)}</b></div></div>
      ${led.length ? `<div class="led">${led.slice(0, 10).map(x => `<div><span>${esc(x.n)}</span><b class="${x.a > 0 ? 'ok' : 'bad'}">${x.a > 0 ? '+' : ''}${usd2(x.a)}</b></div>`).join('')}</div>` : '<p class="note">Nothing yet: what you pay and earn appears here.</p>'}`;
  }

  // ---------- the objective: what to do next, from what you have ----------
  function objective() {
    let t, s; const sh = E.ships.find(x => x.status !== 'delivered');
    if (E.grows.length) { const g = E.grows[0]; t = `Crops growing: ${g.qty} crates`; s = `${clock((g.end - now()) / 1000)} left · Greenfields`; }
    else if (sh) { t = `${sh.kind === 'contract' ? 'Contract cargo' : sh.good ? MK.GOODS[sh.good][2] : sh.kind === 'crop' ? 'Crates' : 'Food'} ${sh.status === 'queued' ? 'waiting for a vehicle' : sh.status === 'failed' ? 'held up' : 'on the way'}`; s = `${PLACE[sh.from]} → ${PLACE[sh.to]} · ${Math.round((sh.frac || 0) * 100)}%`; }
    else if (E.procs.length) { const p = E.procs[0]; t = `Processing ${p.qty} crates`; s = `${clock((p.end - now()) / 1000)} left · Industrial Isle`; }
    else if (E.plantOut.qty) { t = 'Deliver food to the shops'; s = `${E.plantOut.qty} boxes at the plant · Jobs, step 4`; }
    else if (E.plantIn.qty) { t = 'Process the crates into food'; s = `${E.plantIn.qty} crates at the plant · Jobs, step 3`; }
    else if (E.farm.qty) { t = 'Truck the crates to the plant'; s = `${E.farm.qty} crates at the co-op · Jobs, step 2`; }
    else if (v2on() && !S.done.firstContract && !S.done.firstTrade && !E.stats.sold) { t = 'Earn your first money: take a contract'; s = 'You pay nothing · Jobs, Contracts'; }
    else if (v2on() && S.cash < SEED * 5 && !E.stats.sold) { t = 'Low on cash? Take a contract'; s = 'You pay nothing and are paid on arrival · Jobs, Contracts'; }
    else if (!E.stats.sold) { t = 'Grow your first crops'; s = 'Seed costs $3 a crate · Jobs, food business'; }
    else { const nx = LEVELS[level() + 1]; t = nx ? `Run the chain again: ${nx.xp - S.xp} XP to level ${level() + 2}` : 'Run your food business'; s = `Profit so far ${usd(E.stats.profit)}`; }
    $('objT').textContent = t; $('objS').textContent = s;
  }
  $('obj').onclick = () => { if (panel !== 'jobs') open('jobs'); else $('obj').classList.toggle('min'); };

  // ---------- labels: island name far out, district names in between, a few useful places up close; no overlaps ----------
  const els = new Map(); let sel = null;
  function labelEl(L) { let el = els.get(L); if (!el) { el = document.createElement('div'); el.className = `lab ${L.friend ? 'place friend' : L.level}${L.minor ? ' minor' : ''}${L.small ? ' small' : ''}${L.home ? ' home' : ''}${L.mine ? ' mine' : ''}`; if (L.friend) el.innerHTML = `<em>${esc(String(L.text)[0] || '?').toUpperCase()}</em>${esc(L.text)}`; else el.textContent = L.text; if (L.color) el.style.setProperty('--c', L.color); $('labels').appendChild(el); els.set(L, el); L.w = 0; } return el; }
  const FRIENDS = new Map(), OWNERS = new Map();
  function friendLabels(lvl) { // other players (district and close views) and, close up, who owns the buildings nearby
    if (!NET.online) { World.players([]); return []; }
    const out = [];
    const list = [...NET.players.entries()], at = World.players(list.map(([, p]) => p));
    list.forEach(([id, p], i) => { let L = FRIENDS.get(id); if (!L) { L = { text: p.name, level: 'friend', friend: true }; FRIENDS.set(id, L); } if (at[i]) { L.x = at[i].x; L.y = at[i].y; L.z = at[i].z; } if (L.text !== p.name) { L.text = p.name; const el = els.get(L); if (el) { el.innerHTML = `<em>${esc(String(p.name)[0] || '?').toUpperCase()}</em>${esc(p.name)}`; L.w = 0; } } if (L.color !== p.color) { L.color = p.color; const el = els.get(L); if (el) el.style.setProperty('--c', p.color); } if (lvl !== 'island') out.push(L); });
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
  $('pExp').onclick = () => { P.classList.toggle('big'); $('pExp').setAttribute('aria-label', P.classList.contains('big') ? 'Make smaller' : 'Expand'); }; // phones: half height, or nearly full
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
  if (window.IslandGeo && window.IslandGeo.EXPANDED) AREAS.push(
    ['Millford', 10, -802, 'A market town with a grid of streets, shops and a town hall', 'Towns'], ['Northhaven', -60, -880, 'A fishing harbour town with boatyards and fish markets', 'Towns'], ['Eastgate', 762, -560, 'A town on East Island close to the works and the airport', 'Towns'], ['Hillcrest', -370, -690, 'A village on the hillside among the pines', 'Towns'], ['Coral Bay', -760, -480, 'Pastel houses and shops by the beach road', 'Coast'],
    ['Coral Coast resort', -830, -650, 'Four hotels, a long beach, a promenade and beach bars', 'Coast'], ['Luxury coast', -690, -330, 'Villas with pools on the bluffs', 'Coast'], ['Marina Cove', -744, -420, 'A yacht harbour with jetties and a club', 'Coast'], ['Greenfields plain', 179, -785, 'Farms, orchards and fields that grow your crops', 'Farms and works'],
    ['Works Estate', 900, -100, 'Factories, a recycling plant and freight yards', 'Farms and works'], ['Container Terminal', 850, 160, 'Cranes, stacks of containers and a ship at the quay', 'Farms and works'], ['Airport', 1200, 120, 'A runway, a terminal and planes that take off', 'Farms and works'], ['Redstone Quarry', 1040, -735, 'A stone pit with diggers and a crushing plant', 'Farms and works'], ['Deepwell Mine', 1138, -674, 'A headframe, ore wagons and spoil heaps', 'Farms and works'],
    ['Fort Verity', 392, -874, 'A historic stone fort on the cliff', 'Landmarks'], ['Lantern Head', -998, -906, 'A striped lighthouse on a rocky headland', 'Landmarks'], ['Silverfall', -500, -618, 'A waterfall with a timber viewing deck', 'Landmarks'], ['Sentinel Peak', -552, -644, 'The tall mountain and its lookout tower', 'Landmarks'], ['Botanical Garden', -238, -190, 'A glasshouse, a fountain, flower beds and a pond', 'Landmarks'], ['The Beacon', 240, -205, 'The tallest tower on the island', 'Landmarks']);
  const ownerOf = b => NET.online ? OWN.get(lotOf(b)) : (S.owned[b.id] ? { owner: 'me', name: S.name } : null);
  const isMine = b => b.owner === 'you' || (ownerOf(b) && (ownerOf(b).owner === NET.me || ownerOf(b).owner === 'me'));
  const card = b => { const o = ownerOf(b), mine = isMine(b); return `<button class="pc" data-b="${b.id}"><div class="ph" data-ph="${b.id}"></div>${mine ? '<span class="tag yours">YOURS</span>' : o ? `<span class="tag" style="background:${esc(o.color)}">${esc(o.name)}</span>` : ''}<div class="tx"><b>${esc(b.name)}</b><small>${esc(b.area)}</small><em>${mine ? 'Yours' : o ? 'Owned by ' + esc(o.name) : usd(valueOf(b))}</em></div></button>`; };
  const bindCards = r => { r.querySelectorAll('[data-ph]').forEach(el => picture(el, byId(el.dataset.ph))); r.querySelectorAll('[data-b]').forEach(el => el.onclick = () => open('card', el.dataset.b, true)); };
  let filter = 'homes', qtyPick = {};
  const bar = (n, cap) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, n / (cap || 1) * 100))}%"></i></div>`;
  const STATUS = { queued: 'QUEUED', travelling: 'TRAVELLING', delivered: 'DELIVERED', failed: 'HELD UP' };
  const chipOf = s => `<span class="chip ${s.status}">${STATUS[s.status] || String(s.status).toUpperCase()}</span>`;
  const shipRow = s => { const h = handles.get(s.id), what = s.good ? gname(s.good, s.qty) : `${s.qty} ${s.kind === 'crop' ? 'crates' : 'boxes of food'}`, how = s.status === 'travelling' ? `${Math.round((s.frac || 0) * 100)}% of the way` : s.status === 'queued' ? `waiting for your ${s.vehicle}` : s.status === 'failed' ? (s.why || 'route closed: waiting') : s.kind === 'contract' ? `paid ${usd(s.reward)}` : s.good ? `sold for ${usd2(s.reward)}` : s.kind === 'food' ? `sold for ${usd(s.qty * s.price)}` : 'in your plant store';
    return `<div class="ship"><div class="rt">${esc(PLACE[s.from])}<i>→</i>${esc(PLACE[s.to])}</div>${chipOf(s)}<div class="meta">${what} · by ${s.vehicle} · ${esc(how)}</div>${s.status === 'travelling' ? bar(s.frac || 0, 1) : ''}${h && h.car ? `<button class="btn ghost" data-track="${s.id}">${ic('target')}FOLLOW IT</button>` : ''}</div>`; };
  function follow0(h, what) { follow = { h }; $('fol').hidden = false; $('folT').textContent = 'Following ' + what; }
  function unfollow() { follow = null; $('fol').hidden = true; }
  $('folX').onclick = unfollow;
  const bindTrack = r => r.querySelectorAll('[data-track]').forEach(b => b.onclick = () => { const h = handles.get(b.dataset.track), s = E.ships.find(x => x.id === b.dataset.track); if (!h || !h.car) return; follow0(h, `your ${s ? s.vehicle : 'truck'} to ${s ? PLACE[s.to] : 'its stop'}`); const v = World.current(); v.dist = 70; v.polar = 0.95; World.place(v); if (innerWidth < 760) close(); once('track', 5, 'You followed a delivery'); });
  const kv = rows => `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const DEV = new URLSearchParams(location.search).has('dev'); // test tools (road checks, closing the bridge) only with ?dev
  function nextStep() { if (E.plantOut.qty) return 4; if (E.plantIn.qty && !E.procs.length) return 3; if (E.farm.qty) return 2; return E.grows.length || E.ships.some(s => s.status !== 'delivered') || E.procs.length ? 0 : 1; }
  const broke = () => S.cash < SEED * 5 && !E.farm.qty && !E.plantIn.qty && !E.plantOut.qty && !E.grows.length && !E.procs.length && !E.ships.some(s => s.status !== 'delivered');
  const PANELS = {
    home: () => { const h = World.home, own = World.buildings.filter(b => b.sale && isMine(b)), worth = own.reduce((a, b) => a + valueOf(b), 0), l = level();
      return { title: 'Home', html: `<div class="ph" data-ph="home"></div><div class="row"><span class="ic">${ic('home')}</span><div><b>${esc(h.name)}</b><small>Your flat in the Old Quarter</small></div><button class="btn ghost" id="hv">${ic('map')}VIEW</button></div>
      <div class="stats"><div>Cash<b>${usd(S.cash)}</b></div><div>Property<b>${own.length ? usd(worth) : 'None yet'}</b></div><div>Food profit<b>${usd(E.stats.profit)}</b></div></div>
      <p class="sec">Your goods</p><div class="inv"><div>Co-op store<b>${E.farm.qty}</b>crates</div><div>At the plant<b>${E.plantIn.qty}</b>crates</div><div>At the plant<b>${E.plantOut.qty}</b>boxes of food</div><div>On the road<b>${E.ships.filter(s => s.status !== 'delivered').reduce((a, s) => a + s.qty, 0)}</b>crates or boxes</div></div>
      ${overview()}
      <p class="sec">Level ${l + 1} · ${S.xp} XP</p>${LEVELS.map((L, i) => `<div class="row ${i > l ? 'lock' : ''}"><span class="ic">${i <= l ? '✓' : i + 1}</span><div><b>Level ${i + 1}${i ? ` · ${L.xp} XP` : ''}</b><small>${esc(L.reward)}</small></div>${i === l + 1 ? `<span class="lockt">${L.xp - S.xp} XP TO GO</span>` : ''}</div>`).join('')}
      <p class="note">XP comes from profit on food you deliver (up to 60 a delivery), first visits and first purchases. It can't be farmed by repeating one step.</p>
      ${own.length ? `<p class="sec">Your property</p><div class="cards">${own.map(card).join('')}</div>` : ''}
      <button class="row" id="hBank"><span class="ic">${ic('bank')}</span><div><b>Capital Bank</b><small>Income, costs and what you've sold</small></div></button>`,
      bind: r => { picture(r.querySelector('[data-ph="home"]'), h); $('hv').onclick = () => visit(h); $('hBank').onclick = () => open('bank', null, true); bindCards(r); } }; },
    bank: () => { const own = World.buildings.filter(b => b.sale && isMine(b)), inc = own.reduce((a, b) => a + rentOf(b), 0), st = E.stats; return { title: 'Capital Bank', html: `<div class="stats"><div>Cash<b>${usd(S.cash)}</b></div><div>Food sold<b>${st.sold} boxes</b></div><div>Revenue<b>${usd(st.revenue)}</b></div></div>
      <div class="stats"><div>Net profit<b>${usd(st.profit)}</b></div><div>Rent value<b>${usd(inc)}/wk</b></div><div>Loans<b>None</b></div></div><p class="note">Rent is shown as each property's value to a tenant; it isn't paid out yet in this version. Loans aren't available yet.</p>` }; },
    build: () => { const G = { homes: ['house', 'flat'], villas: ['villa'], shops: ['shophouse', 'kiosk'], offices: ['tower'], harbour: ['warehouse'] }, list = World.buildings.filter(b => b.sale && !ownerOf(b) && G[filter].includes(b.type)).sort((a, b) => valueOf(a) - valueOf(b)).slice(0, 12), own = World.buildings.filter(b => b.sale && isMine(b));
      return { title: 'Build & property', html: `<div class="acts"><button class="btn gold" id="bplots">PLOTS · BUY LAND AND BUILD</button></div><div class="seg">${[['homes', 'Homes'], ['villas', 'Villas'], ['shops', 'Shops'], ['offices', 'Offices'], ['harbour', 'Harbour']].map(([k, n]) => `<button data-f="${k}" class="${k === filter ? 'on' : ''}">${n}</button>`).join('')}</div>
        ${own.length ? `<p class="sec">Yours</p><div class="cards">${own.map(card).join('')}</div>` : ''}<p class="sec">For sale · cheapest first</p>${list.length ? `<div class="cards">${list.map(card).join('')}</div>` : '<p class="note">Everything here has an owner. Try another kind.</p>'}<p class="note">Buying puts your name on it for everyone. Property doesn't earn rent yet; it counts towards your worth.</p>`,
        bind: r => { $('bplots').onclick = () => open('plots', null, true); r.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; open('build'); }); bindCards(r); } }; },
    card: id => { const b = byId(id), mine = isMine(b), other = !mine && ownerOf(b), p = valueOf(b); sel = b; World.mark(b); const fl = b.floors || (b.type === 'villa' ? 2 : 1);
      return { title: { warehouse: 'Warehouse', shophouse: 'Shop with flats', kiosk: 'Kiosk', house: 'House', villa: 'Villa', tower: 'Offices', flat: 'Flats' }[b.type] || 'Landmark',
      html: `<div class="ph" data-ph="${b.id}"></div><b class="big">${esc(b.name)}</b><p class="note">${esc(b.area)}${mine ? ' · <b class="ok">yours</b>' : other ? ` · owned by <b style="color:${esc(other.color)}">${esc(other.name)}</b>` : b.sale ? ' · for sale' : ' · owned by the island'}</p>
        ${b.sale || mine ? `<div class="stats"><div>Price<b>${usd(p)}</b></div><div>Floors<b>${fl}</b></div><div>Rent value<b>${usd(rentOf(b))}/wk</b></div></div>` : ''}
        <div class="acts sticky"><button class="btn ghost" id="cv">${ic('map')}VIEW ON MAP</button>${mine ? '<button class="btn" disabled>YOURS</button>' : other ? '<button class="btn" disabled>OWNED</button>' : b.sale ? `<button class="btn go" id="cb" ${S.cash < p ? 'disabled' : ''}>${S.cash < p ? 'NEED ' + usd(p - S.cash) + ' MORE' : 'BUY ' + usd(p)}</button>` : '<button class="btn" disabled>NOT FOR SALE</button>'}</div>`,
      bind: r => { picture(r.querySelector('[data-ph]'), b); $('cv').onclick = () => visit(b); if ($('cb')) $('cb').onclick = async () => { if (NET.online) { if (pendingCall) return; pendingCall = true; $('cb').disabled = true; $('cb').innerHTML = '<span class="spin"></span>BUYING…'; try { applyState(await NET.call('ci_buy_property', { p_lot: lotOf(b) })); toast('Bought ' + b.name, 'Confirmed by the island server'); } catch (e) { toast(e.net ? 'No connection: not bought' : 'Not bought', e.net ? 'Nothing was charged. Try again when you are back online.' : e.message, true); NET.refresh(); } pendingCall = false; open('card', id, true); stack.pop(); return; } if (S.cash < p || S.owned[b.id]) return; logCash(-p, `Bought ${b.name}`); S.owned[b.id] = { at: now() }; save(); toast('Bought ' + b.name, 'It\'s yours: your name shows on it'); once('buy:' + b.id, 25, 'First purchase of ' + b.name); open('card', id, true); stack.pop(); }; } }; },
    jobs: () => jobsTab === 'business' ? bizPanel() : jobsTab === 'contracts' ? (v2on() ? contractsPanel() : soon('Jobs · contracts', jobsSeg())) : PANELS.foodjobs(),
    foodjobs: () => { const c = CAP(), F = FLEET(), road = E.ships.filter(s => s.status !== 'delivered'), ns = nextStep(), r1 = R('FA', 'P'), r2 = R('P', 'C'), r3 = R('P', 'J');
      const timer = (list, verb) => list.map(j => `<div class="row"><span class="ic">${ic('jobs')}</span><div><b>${verb} ${j.qty}</b>${bar(now() - j.start, j.end - j.start)}</div><span class="lockt">${clock((j.end - now()) / 1000)}</span></div>`).join('');
      const step = (n, title, where, rows, btns, why, extra = '') => `<div class="step ${ns === n ? 'now' : ''}"><div class="sh"><span class="n">${n}</span><div><b>${title}</b><small>${where}</small></div></div>${kv(rows)}${extra}${btns}${why ? `<p class="note why">${why}</p>` : ''}</div>`;
      const B = (label, a, ok) => `<button class="btn ${ok ? 'go' : ''}" data-act="${a}" ${ok ? '' : 'disabled'}>${label}</button>`;
      const room = c.farm - E.farm.qty - growing(), pRoom = c.plantIn - E.plantIn.qty - inbound('P'), oRoom = c.plantOut - E.plantOut.qty - E.procs.reduce((a, p) => a + p.qty, 0);
      const g1 = room > 0 && S.cash >= SEED, w1 = room <= 0 ? 'The co-op store is full: truck crates to the plant (step 2).' : S.cash < SEED ? `Seed costs ${usd(SEED)} a crate; you have ${usd(S.cash)}.` : '';
      const g2 = E.farm.qty > 0 && pRoom > 0 && r1, w2 = !E.farm.qty ? (E.grows.length ? 'Your crops are still growing.' : 'Nothing at the co-op yet: grow crops first (step 1).') : pRoom <= 0 ? 'Your store at the plant is full: process what is there (step 3).' : !r1 ? 'The road to the plant is closed: bookings wait until it reopens.' : '';
      const g3 = E.plantIn.qty > 0 && oRoom > 0, w3 = !E.plantIn.qty ? (road.some(s => s.kind === 'crop') ? 'Your crates are on the way to the plant.' : 'No crates at the plant yet: truck some there (step 2).') : oRoom <= 0 ? 'The food store is full: deliver some food (step 4).' : '';
      const g4 = E.plantOut.qty > 0, w4 = !E.plantOut.qty ? (E.procs.length ? 'The plant is still packing your food.' : 'No food to sell yet: process crates (step 3).') : '';
      return { title: 'Jobs · food business', html: `${jobsSeg()}<div class="inv"><div>Co-op store<b>${E.farm.qty}<small style="display:inline;font-size:10px"> / ${c.farm}</small></b>crates</div><div>Plant store<b>${E.plantIn.qty}</b>crates in</div><div>Plant store<b>${E.plantOut.qty}</b>food boxes</div><div>On the road<b>${road.reduce((a, s) => a + s.qty, 0)}</b>${road.length} trip${road.length === 1 ? '' : 's'}</div></div>
        <p class="note">You run all four steps yourself. Each is charged when you confirm it; money comes back when food reaches a buyer.</p>
        ${broke() ? `<div class="row"><span class="ic">${ic('bank')}</span><div><b>Short of money?</b><small>${NET.online ? (v2on() ? 'Take a delivery contract in Jobs: you pay nothing and are paid when the cargo arrives. Selling food you hold to other players in Trade also works.' : 'Sell food you hold to other players in Trade. A grant from the island server isn\'t available yet.') : 'The co-op advances new growers seed money.'}</small></div>${NET.online ? '' : `<button class="btn go" id="grant" ${S.grantAt && now() - S.grantAt < 15 * 60e3 ? 'disabled' : ''}>GET $150</button>`}</div>` : ''}
        ${step(1, 'Grow crops', 'Your field at Greenfields', [['Costs', `${usd(SEED)} a crate (seed and labour)`], ['Takes', `${GROW_S} s a crate · 40 crates in ${clock(40 * GROW_S)}`], ['Makes', `crates in the co-op store (${E.farm.qty + growing()} of ${c.farm} used)`], ['Then', 'truck them to the plant']], B('GROW CROPS', 'grow', g1), w1, timer(E.grows, 'Growing'))}
        ${step(2, 'Truck crates to the plant', 'Greenfields → over the bridge → Industrial Isle', [['You have', `${E.farm.qty} crates at the co-op`], ['Costs', `${usd(shipFee('truck', r1 ? r1.len : 0))} a trip · up to ${c.truck} crates`], ['Takes', r1 ? `~${clock(eta(r1.len))} · ${(r1.len / 1000).toFixed(1)} km` : 'road closed'], ['Vehicles', `${F.truck - busy('truck')} of ${F.truck} truck${F.truck > 1 ? 's' : ''} free`], ['Then', 'they wait in your plant store']], B('SHIP CRATES', 'ship', g2), w2, road.filter(s => s.kind === 'crop').map(shipRow).join(''))}
        ${step(3, 'Process into food', 'Processing Plant, Industrial Isle', [['You have', `${E.plantIn.qty} crates at the plant`], ['Costs', `${usd(PROC_FEE)} a crate`], ['Takes', `${PROC_S} s a crate`], ['Makes', '1 box of food per crate'], ['Then', 'deliver it to a buyer']], B('PROCESS', 'process', g3), w3, timer(E.procs, 'Packing'))}
        ${step(4, 'Deliver and sell food', 'The Old Quarter shops or Hotel Azure', [['You have', `${E.plantOut.qty} boxes at the plant`], ['Shops pay', `${usd(priceOf('shops'))} a box · want ${Math.max(0, Math.floor(E.demand.shops - inbound('C')))}${matchOn() ? ' · match day +15%' : ''}`], ['Hotel pays', level() >= 2 ? `${usd(priceOf('hotel'))} a box · want ${Math.max(0, Math.floor(E.demand.hotel - inbound('J')))}` : 'contract opens at level 3'], ['Costs', `shipping ${usd(shipFee(F.van ? 'van' : 'truck', r2 ? r2.len : 0))}–${usd(shipFee('truck', r3 ? r3.len : 0))} a trip`], ['Then', 'paid on arrival, plus XP from the profit']], `<div class="acts">${B('SELL TO SHOPS', 'deliver:shops', g4)}${B(level() >= 2 ? 'SELL TO HOTEL' : 'HOTEL · LEVEL 3', 'deliver:hotel', g4 && level() >= 2)}</div>`, w4, road.filter(s => s.kind === 'food').map(shipRow).join(''))}
        <p class="sec">Other ways to grow</p><button class="row" id="jb"><span class="ic">${ic('build')}</span><div><b>Buy property</b><small>Homes, villas, shops and offices, in Build</small></div></button>`,
        bind: r => { bindSegs(r); r.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { const [act, buyer] = b.dataset.act.split(':'); open('quote', { act, buyer }, true); }); bindTrack(r); $('jb').onclick = () => open('build');
          if ($('grant')) $('grant').onclick = () => { logCash(150, 'The co-op advanced seed money'); S.grantAt = now(); save(); toast('The co-op advanced $150', 'Enough seed for 50 crates'); open('jobs'); }; } }; },
    quote: a => { const opts = [5, 10, 20, 40, 80], probe = quote(a.act, 1, a.buyer), max = Math.max(0, probe.max || 0), choices = opts.filter(n => n <= Math.max(max, 5)); let qty = qtyPick[a.act + (a.buyer || '')] || Math.min(max || 5, 40); if (qty > max && max) qty = choices.filter(n => n <= max).pop() || max; const q = quote(a.act, qty, a.buyer);
      return { title: { grow: 'Grow crops', ship: 'Truck crates to the plant', process: 'Process into food', deliver: 'Deliver and sell', buygoods: 'Buy wholesale', sendgoods: 'Send to a business', contract: 'Delivery contract' }[a.act], html: `${q.fixed ? '' : `<p class="sec">How many</p><div class="seg">${[...new Set([...choices.filter(n => n <= max), max].filter(n => n > 0))].sort((x, y) => x - y).map(n => `<button data-q="${n}" class="${n === qty ? 'on' : ''}">${n === max && !opts.includes(n) ? 'All ' + n : n}</button>`).join('') || '<span class="note">Nothing available</span>'}</div>`}
        <table class="t">${q.rows.map(([k, v, cls]) => `<tr class="${cls === 'key' || cls === 'sum' ? cls : ''}"><td>${esc(k)}</td><td class="${cls === 'est' ? 'est' : cls === 'key' || cls === 'sum' ? '' : cls}">${esc(v)}</td></tr>`).join('')}</table>
        ${q.note ? `<p class="note">${esc(q.note)}</p>` : ''}${q.ok ? '' : `<p class="note why">${esc(q.why)}</p>`}
        <div class="acts sticky"><button class="btn ghost" id="qc">CANCEL</button><button class="btn go" id="qok" ${q.ok ? '' : 'disabled'}>${q.cost ? 'PAY ' + usd(q.cost) : q.act === 'contract' ? 'TAKE THE CONTRACT' : 'CONFIRM'}</button></div>`,
      bind: r => { r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { qtyPick[a.act + (a.buyer || '')] = +b.dataset.q; open('quote', a, true); stack.pop(); }); $('qc').onclick = () => $('pBack').click(); $('qok').onclick = () => confirm(q, a.buyer); } }; },
    trade: () => tradeTab === 'market' ? marketPanel() : tradeTab === 'goods' ? (v2on() ? goodsPanel() : soon('Trade · wholesale', tradeSeg())) : PANELS.foodtrade(),
    foodtrade: () => { const mine = E.ships.slice().reverse(), rb = R('L', 'O'), rr = R('FA', 'P'); return { title: 'Trade · food', html: `${tradeSeg()}<p class="sec">Your shipments</p>${mine.length ? mine.map(shipRow).join('') : '<p class="note">None yet. Book trips in Jobs: steps 2 and 4.</p>'}
      <p class="sec">Buyers · shared by every player</p>
      <div class="row"><span class="ic">${ic('home')}</span><div><b>Old Quarter shops</b><small>${usd(priceOf('shops'))} a box · want ${Math.max(0, Math.floor(E.demand.shops))}${matchOn() ? ' · match day: +15% and more wanted' : ` · next match in ${clock(((NET.online ? E.matchAt : E.match) - now()) / 1000)}`}</small>${bar(E.demand.shops, BUYER.shops.max)}</div></div>
      <div class="row ${level() < 2 ? 'lock' : ''}"><span class="ic">${ic('home')}</span><div><b>Hotel Azure</b><small>${usd(priceOf('hotel'))} a box · want ${Math.max(0, Math.floor(E.demand.hotel))}</small>${bar(E.demand.hotel, BUYER.hotel.max)}</div>${level() < 2 ? '<span class="lockt">LEVEL 3</span>' : ''}</div>
      <p class="note">The price falls as a buyer fills up and recovers as demand refills over time. When you book a delivery the price is fixed and those boxes are reserved for you, so changes while your goods travel don't touch your sale.</p>
      ${NET.online ? `<p class="sec">Offers between players</p>
      ${MARKET.filter(l => l.seller !== NET.me).map(l => `<div class="row"><span class="ic">${ic('trade')}</span><div><b>${l.qty} boxes from ${esc(l.name)}</b><small>${usd(l.price)} a box · ${usd(l.qty * l.price)} for all · straight into your plant store</small></div><button class="btn go" data-mbuy="${l.id}">BUY</button></div>`).join('') || '<p class="note">No offers from other players right now.</p>'}
      ${MARKET.filter(l => l.seller === NET.me).map(l => `<div class="row"><span class="ic">${ic('trade')}</span><div><b>Your offer: ${l.qty} boxes</b><small>${usd(l.price)} a box · held until someone buys or you cancel</small></div><button class="btn ghost" data-mcan="${l.id}">CANCEL</button></div>`).join('')}
      <button class="btn" id="mlist" ${E.plantOut.qty ? '' : 'disabled'} style="width:100%">OFFER FOOD TO PLAYERS</button>${E.plantOut.qty ? '' : '<p class="note">You need food boxes at the plant to make an offer.</p>'}` : '<p class="note">Offers between players need the island server: you are playing offline.</p>'}
      <p class="sec">Routes to Industrial Isle</p>
      <div class="row"><span class="ic">${ic('truck')}</span><div><b>Road over the bridge</b><small>${bridgeClosed ? 'Closed: trips wait, and set off again when it reopens' : `Open · trucks and vans · Greenfields to the plant ${rr ? (rr.len / 1000).toFixed(1) + ' km, ~' + clock(eta(rr.len)) : ''}`}</small></div>${DEV ? `<button class="btn ghost" id="tb">${bridgeClosed ? 'REOPEN' : 'CLOSE'}</button>` : ''}</div>
      <div class="row"><span class="ic">${ic('trade')}</span><div><b>Sea route: harbour ⇄ the isle</b><small>The island's cargo boat, ${World.SEA ? World.SEA.state() : ''}. It carries the island's own freight; booking space on it isn't available yet.</small></div></div>`,
      bind: r => { bindSegs(r); bindTrack(r);
        r.querySelectorAll('[data-mbuy]').forEach(b => b.onclick = () => open('mbuy', b.dataset.mbuy, true)); r.querySelectorAll('[data-mcan]').forEach(b => b.onclick = () => market('ci_cancel_listing', { p_id: b.dataset.mcan }, 'Offer cancelled', 'The boxes are back in your store'));
        if ($('mlist')) $('mlist').onclick = () => open('mlist', null, true);
        if ($('tb')) $('tb').onclick = () => { bridgeClosed = !bridgeClosed; World.setClosed('bridge', bridgeClosed); toast(bridgeClosed ? 'Bridge closed (test)' : 'Bridge reopened', bridgeClosed ? 'Traffic turns back at the barrier' : 'Deliveries resume'); refresh(); }; } }; },
    mbuy: id => { const l = MARKET.find(x => x.id === id); if (!l) return { title: 'Offer', html: '<p class="note">That offer has gone: someone else bought it or it was cancelled.</p>' }; const total = l.qty * l.price, shop = priceOf('shops'); return { title: 'Buy from a player', html: `<table class="t"><tr><td>Seller</td><td>${esc(l.name)}</td></tr><tr><td>Food boxes</td><td>${l.qty}</td></tr><tr><td>Price</td><td>${usd(l.price)} a box</td></tr><tr class="key"><td>You pay now</td><td>${usd(total)}</td></tr><tr><td>Where they go</td><td>Your plant store, at once</td></tr><tr><td>Shops pay today</td><td class="est">${usd(shop)} a box, before shipping</td></tr></table>${S.cash < total ? `<p class="note why">You need ${usd(total - S.cash)} more.</p>` : ''}<div class="acts sticky"><button class="btn ghost" id="qc">CANCEL</button><button class="btn go" id="qok" ${S.cash < total ? 'disabled' : ''}>PAY ${usd(total)}</button></div>`,
      bind: () => { $('qc').onclick = () => $('pBack').click(); $('qok').onclick = () => market('ci_buy_listing', { p_id: id }, `Bought ${l.qty} boxes from ${l.name}`, 'They are in your plant store', true); } }; },
    mlist: () => { const max = E.plantOut.qty, shop = priceOf('shops'), prices = [Math.max(1, Math.round(shop - 2)), Math.round(shop), Math.round(shop + 2)], k = mlistPick; k.qty = Math.min(k.qty || 10, max) || max; k.price = k.price || prices[1]; const basis = avg(E.plantOut) * k.qty;
      return { title: 'Offer food to players', html: `<p class="sec">How many</p><div class="seg">${[...new Set([5, 10, 20, max].filter(n => n > 0 && n <= max))].map(n => `<button data-q="${n}" class="${n === k.qty ? 'on' : ''}">${n}</button>`).join('')}</div><p class="sec">Price a box</p><div class="seg">${prices.map(n => `<button data-p="${n}" class="${n === k.price ? 'on' : ''}">${usd(n)}</button>`).join('')}</div>
        <table class="t"><tr><td>Boxes</td><td>${k.qty} of ${max}</td></tr><tr><td>Already spent on them</td><td>${usd(basis)}</td></tr><tr class="key"><td>If someone buys</td><td>${usd(k.qty * k.price)}</td></tr><tr class="sum"><td>Profit</td><td class="${k.qty * k.price - basis > 0 ? 'ok' : 'bad'}">${usd(k.qty * k.price - basis)}</td></tr></table><p class="note">The boxes are held while on offer; cancel any time to get them back.</p>
        <div class="acts sticky"><button class="btn ghost" id="qc">CANCEL</button><button class="btn go" id="qok" ${max ? '' : 'disabled'}>OFFER</button></div>`,
      bind: r => { r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { k.qty = +b.dataset.q; open('mlist', null, true); stack.pop(); }); r.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { k.price = +b.dataset.p; open('mlist', null, true); stack.pop(); }); $('qc').onclick = () => $('pBack').click(); $('qok').onclick = () => market('ci_list_food', { p_id: uuid(), p_qty: k.qty, p_price: k.price }, `Offered ${k.qty} boxes`, 'Other players can buy them now', true); } }; },
    map: () => ({ title: 'Map', html: `<div class="acts"><button class="btn gold" id="mi">WHOLE ISLAND</button><button class="btn ghost" id="mh">${ic('home')}MY HOME</button></div>
      ${NET.online ? `<p class="sec">Players on the island now · ${NET.players.size + 1}</p><div class="row"><span class="ic" style="background:${esc(S.color)};color:#fff">${esc((S.name || '?')[0].toUpperCase())}</span><div><b>${esc(S.name)} (you)</b><small>Others see a pin in your colour where you are looking</small></div></div>${[...NET.players.values()].map(p => `<div class="row"><span class="ic" style="background:${esc(p.color)};color:#fff">${esc(String(p.name || '?')[0].toUpperCase())}</span><div><b>${esc(p.name)}</b><small>Near ${esc(areaAt(p.x, p.z))}</small></div><button class="btn ghost" data-pv="${esc(p.id)}">GO</button></div>`).join('') || '<p class="note">Nobody else is here right now. Send a friend the link.</p>'}` : '<p class="note">Offline: other players appear when you play online.</p>'}
      <p class="sec">Places</p>${AREAS.map(([n, , , d, g], i) => (g && g !== (AREAS[i - 1] || [])[4] ? `<p class="sec">${g}</p>` : '') + `<div class="row"><span class="ic">${ic('map')}</span><div><b>${n}${S.seen[n] ? ' · visited' : ' · first visit +10 XP'}</b><small>${d}</small></div><button class="btn ghost" data-a="${i}">GO</button></div>`).join('')}
      ${DEV ? `<p class="sec">Road checks (test)</p><div class="row"><span class="ic">${ic('truck')}</span><div><b>Traffic</b><small>${World.cars.length} vehicles · ${World.stats.teleports} jumps · ${World.stats.stuck} stuck</small></div><button class="btn ghost" id="mt">RUN</button></div><div id="rt"></div>` : ''}`,
      bind: () => { $('mi').onclick = () => { World.mark(null); World.flyTo(World.overview(), 1.5); if (innerWidth < 760) close(); }; $('mh').onclick = () => visit(World.home);
        document.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => { const p = NET.players.get(b.dataset.pv); if (!p) return; World.mark(null); World.flyTo(World.view(p.x, p.z, 160, 0.9, 0.5), 1.4); if (innerWidth < 760) close(); });
        document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const [n, x, z] = AREAS[+b.dataset.a]; World.mark(null); World.flyTo(World.view(x, z, 320, 0.85, 0.4), 1.4); seeArea(n); if (innerWidth < 760) close(); });
        if ($('mt')) $('mt').onclick = () => { const res = World.routeTest(), rep = World.roadReport(); $('rt').innerHTML = `<p class="note">${rep.connected ? '<span class="ok">All roads connected.</span>' : '<span class="bad">Some roads are not connected.</span>'} Road points over water: ${rep.roadPointsOverWater}. Doors on the path network: ${World.access.joined}, at a road edge: ${World.access.road}, none: ${World.access.none.length}.</p><table class="t">${res.map(t => `<tr><td>${esc(t.route)}</td><td class="${t.ok ? 'ok' : 'bad'}">${t.ok ? 'PASS' : 'FAIL'} · ${t.length || ''} m</td></tr>`).join('')}</table>`; }; } }),
    settings: () => ({ title: 'Settings', html: `<div class="row wrap"><div><b>Graphics</b><small>${qpref === 'auto' ? 'Auto is using ' + cap(effQ()) : 'Low is fastest on older phones'} · applies after a reload</small></div><div class="seg">${QS.map(k => `<button data-q="${k}" class="${k === qpref ? 'on' : ''}">${k}</button>`).join('')}</div></div>
      <div class="row"><div><b>Frame rate</b><small>A counter in the corner</small></div><button class="btn ghost" id="sf">${$('fps').hidden ? 'SHOW' : 'HIDE'}</button></div><div class="row"><div><b>Clear this device</b><small>${NET.online ? 'Online progress stays on the island server' : 'Deletes your offline progress'}</small></div><button class="btn ghost" id="sr">CLEAR</button></div>${saveFail ? '<p class="note" style="color:#c0392b">This device is not saving your progress (storage is full or blocked).' + (NET.online ? ' Online progress is kept on the island server.' : ' Playing online keeps it on the server.') + '</p>' : ''}<div class="row"><div><b>What's new</b><small>What changed on the island, and when</small></div><button class="btn ghost" id="swn">OPEN</button></div><p class="note">© 2026 Pocket Rocket Studio</p>`,
      bind: r => { $('swn').onclick = () => window.open('../../changelog.html', '_blank', 'noopener'); r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { setQ(b.dataset.q); open('settings'); toast('Graphics: ' + b.dataset.q, 'Reload to apply'); }); $('sf').onclick = () => { $('fps').hidden = !$('fps').hidden; open('settings'); }; $('sr').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) { /* fine */ } location.reload(); }; } }),
  };
  // ---------- plots: buy ground, pull down the old house, build, rent, farm, mine, renovate, customise; resources, the island market and business jobs ----------
  S.plots = S.plots || {}; S.res = S.res || {}; S.cd = S.cd || {};
  const HOUR = 120e3; // one game hour is two real minutes, and income waits for you for up to eight of them
  const PT = { town: 'Town plot', villa: 'Villa plot', farm: 'Farmland', stone: 'Stone ground', coal: 'Coal ground', oil: 'Oil field', industrial: 'Industrial plot', harbour: 'Harbour plot', tower: 'Tower plot' };
  const PBASE = { town: 1400, villa: 3800, farm: 1000, stone: 1600, coal: 1800, oil: 2200, industrial: 2400, harbour: 3600, tower: 4200 };
  const OPTS = { town: ['house', 'shop', 'office'], villa: ['villa'], farm: ['farm'], stone: ['mine'], coal: ['mine'], oil: ['mine'], industrial: ['warehouse', 'factory'], harbour: ['harbour'], tower: ['tower', 'office'] };
  const BLD = { house: ['House', 1800, 'Rent it out for steady income. Renovate for a garage, more rooms and a pool.'], shop: ['Shop', 2600, 'Sells to the town while it has stock. Restock it to keep the till busy.'], office: ['Office', 5200, 'Tenants pay rent, and an office lets you trade on the island market.'], villa: ['Villa', 6500, 'A big modern home with a pool. Rents for a lot.'], farm: ['Farm', 2200, 'Grows crates of crops that feed your food business at the co-op.'], mine: ['Mine', 3000, 'Digs the resource under this ground. Sell it, or feed a factory.'], warehouse: ['Warehouse', 3200, 'Rent out the space; holds goods for freight jobs.'], factory: ['Factory', 7500, 'Turns stone, coal and oil into goods that sell for much more.'], harbour: ['Harbour', 6800, 'Port fees, freight jobs, and exports that pay better prices.'], tower: ['Tower', 9500, 'A glass skyscraper. Add floors to raise the rent.'] };
  const RATEH = { house: 180, villa: 420, shop: 170, office: 260, tower: 700, warehouse: 150, harbour: 320 }, TOWERT = [1, 1.9, 3.2];
  const OUT = { stone: ['Stone', 16, 14], coal: ['Coal', 12, 22], oil: ['Oil', 10, 38], goods: ['Goods', 0, 95] };
  const SW = [0xf1e6d0, 0xf4c7a8, 0xbfe3d4, 0xc9d6f2, 0xf2e07a, 0xe8b8c8, 0xdadada, 0x9fb7a0], RW = [0xb4552d, 0x6b3a2a, 0x3d5a80, 0x2f6f5f, 0x4a4f57];
  const plotsOn = () => !NET.online && !!(window.Plots && Plots.sites.length);
  const siteOf = id => Plots.by[id], pstate = id => S.plots[id] || null, plotPrice = s => Math.round(PBASE[s.kind] * (0.9 + (s.n * 37 % 21) / 100) / 10) * 10;
  const rateOf = b => b.kind === 'tower' ? RATEH.tower * TOWERT[(b.tier || 1) - 1] : (RATEH[b.kind] || 0) * (b.tier || 1);
  const yieldOf = b => b.kind === 'mine' ? OUT[b.res || 'stone'][1] * (b.tier || 1) : b.kind === 'farm' ? 14 * (b.tier || 1) : b.kind === 'factory' ? 6 * (b.tier || 1) : 0;
  const hoursSince = b => Math.min(8, Math.max(0, (now() - (b.t || now())) / HOUR));
  function pending(b) { // what is waiting at this plot: { cash, units, what }
    const h = hoursSince(b); if (b.kind === 'farm') return { cash: 0, units: Math.floor(yieldOf(b) * h), what: 'crates' };
    if (b.kind === 'mine') return { cash: 0, units: Math.floor(yieldOf(b) * h), what: b.res || 'stone' };
    if (b.kind === 'factory') { const r = S.res, n = Math.min(Math.floor(yieldOf(b) * h), r.stone >> 1, r.coal || 0, r.oil || 0); return { cash: 0, units: Math.max(0, n), what: 'goods' }; }
    if (b.kind === 'shop') { const hh = Math.min(h, (b.stock || 0) / 25); return { cash: Math.floor(rateOf(b) * hh), units: 0, what: 'sales' }; }
    if (b.kind === 'house' || b.kind === 'villa') return { cash: b.rent === false ? 0 : Math.floor(rateOf(b) * h), units: 0, what: 'rent' };
    return { cash: Math.floor(rateOf(b) * h), units: 0, what: 'rent' };
  }
  function plotSync(id) { const s = siteOf(id), p = pstate(id); if (!s) return; Plots.set(id, { owned: !!p, old: !!s.old && !(p && (p.cleared || p.b)), b: p && p.b ? p.b : null }); }
  function plotsSyncAll() { if (!window.Plots || !Plots.sites.length) return; for (const id in S.plots) plotSync(id); }
  const collect = id => { const p = pstate(id), b = p && p.b; if (!b) return 0; const o = pending(b); if (!o.cash && !o.units) return 0; const h = hoursSince(b);
    if (o.cash) { logCash(o.cash, (BLD[b.kind] || ['Plot'])[0] + ' ' + (o.what === 'sales' ? 'sales' : 'rent') + ' at ' + (b.name || siteOf(id).area)); if (b.kind === 'shop') b.stock = Math.max(0, (b.stock || 0) - 25 * Math.min(h, (b.stock || 0) / 25)); }
    if (o.units) { if (o.what === 'crates') { E.farm.qty += o.units; E.farm.cost += o.units * 4; } else { S.res[o.what] = (S.res[o.what] || 0) + o.units; if (b.kind === 'factory') { S.res.stone -= o.units * 2; S.res.coal -= o.units; S.res.oil -= o.units; } } }
    b.t = now(); save(); return o.cash || o.units; };
  const myBuilt = kind => Object.entries(S.plots).filter(([, p]) => p.b && (!kind || (Array.isArray(kind) ? kind.includes(p.b.kind) : p.b.kind === kind)));
  const needTxt = { mine: 'a Mine', farm: 'a Farm', shop: 'a Shop', harbour: 'a Harbour', office: 'an Office or a Tower', warehouse: 'a Warehouse' };
  const wobble = k => 1 + 0.15 * Math.sin(now() / 45e3 + k.length * 2.1);
  const price = k => Math.round(OUT[k][2] * wobble(k));
  const plotRow = (id, mine) => { const s = siteOf(id), p = pstate(id), b = p && p.b; return `<div class="row"><span class="ic">${ic('map')}</span><div><b>${esc(b ? (b.name || BLD[b.kind][0]) : PT[s.kind])}${mine && !b && s.old && !p.cleared ? ' · old house' : ''}</b><small>${esc(s.area)} · ${s.w}×${s.d} m${s.res ? ' · ' + OUT[s.res][0] : ''}${b ? ' · ' + BLD[b.kind][0] + ' L' + (b.tier || 1) : ''}</small></div>${mine ? '' : `<span class="lockt">${usd(plotPrice(s))}</span>`}<button class="btn ghost" data-pl="${id}">${mine ? 'OPEN' : 'LOOK'}</button></div>`; };
  const swatches = (cls, list, cur) => list.map(c => `<button class="csw ${c === cur ? 'on' : ''}" data-${cls}="${c}" style="background:#${c.toString(16).padStart(6, '0')}" aria-label="colour"></button>`).join('');
  const plotsPanel = () => { const ids = Object.keys(S.plots).filter(i => siteOf(i)), forSale = Plots.sites.filter(s => !S.plots[s.id]).sort((a, b) => plotPrice(a) - plotPrice(b)); let cash = 0, units = {}; for (const i of ids) { const b = S.plots[i].b; if (b) { const o = pending(b); cash += o.cash; if (o.units) units[o.what] = (units[o.what] || 0) + o.units; } }
    const wait = [cash ? usd(cash) : '', ...Object.entries(units).map(([k, v]) => `${v} ${k}`)].filter(Boolean).join(' · ');
    return { title: 'Plots', html: `${plotsOn() ? '' : '<p class="note">Plots need the island server upgrade before they can be switched on for the online island. Add <b>?offline</b> to the address to try them on this device.</p>'}
      <div class="acts"><button class="btn gold" id="pcol" ${wait ? '' : 'disabled'}>${wait ? 'COLLECT ' + wait : 'NOTHING TO COLLECT'}</button></div><p class="sec">Yours (${ids.length})</p>${ids.length ? ids.map(i => plotRow(i, true)).join('') : '<p class="note">You own no plots yet. Pick one below, or tap a yellow border on the map. A flag on it says it is for sale.</p>'}
      <p class="sec">For sale · cheapest first</p>${forSale.slice(0, 14).map(s => plotRow(s.id, false)).join('')}<p class="note">Buy a plot, clear the old house if there is one, then build a house, a shop, a farm, a mine or a tower on it.</p>`,
      bind: r => { r.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { const s = siteOf(b.dataset.pl); World.flyTo(World.view(s.x, s.z, 110, 0.8, 0.5), 1.1); open('plot', b.dataset.pl, true); }); $('pcol').onclick = () => { let n = 0; for (const i of ids) n += collect(i) ? 1 : 0; toast(n ? 'Collected from ' + n + ' plot' + (n > 1 ? 's' : '') : 'Nothing yet', n ? 'Cash and goods are in your stores' : 'Income builds up while you play'); open('plots'); }; } }; };
  const plotPanel = id => { const s = siteOf(id), p = pstate(id), b = p && p.b, mine = !!p; World.mark(null); const price = plotPrice(s), on = plotsOn();
    let body = '', acts = '';
    if (!mine) { acts = `<button class="btn go" id="pbuy" ${on && S.cash >= price ? '' : 'disabled'}>${!on ? 'OFFLINE ONLY FOR NOW' : S.cash < price ? 'NEED ' + usd(price - S.cash) + ' MORE' : 'BUY ' + usd(price)}</button>`; body = `<p class="note">${esc(PT[s.kind])} in ${esc(s.area)}. ${s.old ? 'There is an old house on it that you can pull down.' : 'Empty ground.'}${s.res ? ' Under it: <b>' + OUT[s.res][0] + '</b>.' : ''}</p>`; }
    else if (!b && s.old && !p.cleared) { acts = `<button class="btn go" id="pdem" ${S.cash >= 300 ? '' : 'disabled'}>DEMOLISH OLD HOUSE · $300</button><button class="btn ghost" id="psell">SELL PLOT · ${usd(price * 0.6)}</button>`; body = '<p class="note">An old, empty house stands here. Pull it down to build something new.</p>'; }
    else if (!b) { body = `<p class="sec">Build here</p>` + OPTS[s.kind].map(k => `<div class="row"><span class="ic">${ic('home')}</span><div><b>${BLD[k][0]} · ${usd(BLD[k][1])}</b><small>${BLD[k][2]}</small></div><button class="btn go" data-bk="${k}" ${S.cash >= BLD[k][1] ? '' : 'disabled'}>BUILD</button></div>`).join(''); acts = `<button class="btn ghost" id="psell">SELL PLOT · ${usd(price * 0.6)}</button>`; }
    else { const o = pending(b), rent = b.kind === 'house' || b.kind === 'villa', up = (b.tier || 1) < 3, upc = Math.round(BLD[b.kind][1] * 0.8 * (b.tier || 1)), lock = b.kind === 'shop' || b.kind === 'house' || b.kind === 'villa';
      body = `<div class="stats"><div>Level<b>${b.tier || 1} of 3</b></div><div>${o.what === 'sales' || o.what === 'rent' ? 'Waiting' : 'Ready'}<b>${o.cash ? usd(o.cash) : o.units ? o.units + ' ' + o.what : '—'}</b></div><div>${b.kind === 'shop' ? 'Stock' : 'Per hour'}<b>${b.kind === 'shop' ? (b.stock || 0) + '%' : yieldOf(b) ? yieldOf(b) + ' units' : usd(rateOf(b))}</b></div></div>
        ${rent ? `<div class="row"><div><b>${b.rent === false ? 'You live here' : 'Rented out'}</b><small>${b.rent === false ? 'No rent comes in' : usd(rateOf(b)) + ' a game hour from tenants'}</small></div><button class="btn ghost" id="prent">${b.rent === false ? 'RENT OUT' : 'MOVE IN'}</button></div>` : ''}
        ${b.kind === 'shop' ? `<div class="row"><div><b>Shelves</b><small>${b.stock || 0}% stocked · sells 25% an hour</small></div><button class="btn ghost" id="pstock" ${S.cash >= 60 && (b.stock || 0) < 100 ? '' : 'disabled'}>RESTOCK · $60</button></div>` : ''}
        ${b.kind === 'factory' ? `<p class="note">Uses 2 stone, 1 coal and 1 oil from your stores for every goods you make. You have ${S.res.stone || 0} stone, ${S.res.coal || 0} coal, ${S.res.oil || 0} oil.</p>` : ''}
        ${lock ? `<p class="sec">Customise</p><div class="csws">${swatches('c', SW, b.color)}</div><div class="csws">${swatches('r', RW, b.roof)}</div>${rent || b.kind === 'shop' ? `<div class="seg">${[['modern', 'Modern'], ['cosy', 'Cosy'], ['luxury', 'Luxury']].map(([k, n]) => `<button data-st="${k}" class="${(b.style || 'modern') === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}<div class="acts"><button class="btn ghost" id="pname">RENAME</button>${rent ? '<button class="btn ghost" id="pin">LOOK INSIDE</button>' : ''}</div>` : ''}`;
      acts = `<button class="btn gold" id="pcol1" ${o.cash || o.units ? '' : 'disabled'}>COLLECT</button>${up ? `<button class="btn go" id="pup" ${S.cash >= upc ? '' : 'disabled'}>${b.kind === 'tower' ? 'ADD FLOORS' : 'RENOVATE'} · ${usd(upc)}</button>` : ''}<button class="btn ghost" id="pdem2">DEMOLISH</button>`; }
    return { title: b ? (b.name || BLD[b.kind][0]) : PT[s.kind], html: `<b class="big">${esc(b ? (b.name || BLD[b.kind][0]) : PT[s.kind])}</b><p class="note">${esc(s.area)} · ${s.w}×${s.d} m${b ? '' : ''}</p>${body}<div class="acts sticky"><button class="btn ghost" id="pview">${ic('map')}VIEW</button>${acts}</div>`,
      bind: r => { const sync = () => { plotSync(id); save(); open('plot', id, true); stack.pop(); }, view = () => World.flyTo(World.view(s.x, s.z, 90, 0.8, 0.5), 1.1);
        $('pview').onclick = () => { view(); if (innerWidth < 760) { P.hidden = true; panel = ''; } };
        if ($('pbuy')) $('pbuy').onclick = () => { if (!on || S.cash < price) return; logCash(-price, 'Bought a ' + PT[s.kind].toLowerCase() + ' in ' + s.area); S.plots[id] = { at: now() }; once('plot:first', 25, 'First plot'); sync(); toast('Plot bought', 'It is yours now'); };
        if ($('psell')) $('psell').onclick = () => { logCash(Math.round(price * 0.6), 'Sold a plot in ' + s.area); delete S.plots[id]; sync(); toast('Plot sold', usd(price * 0.6)); };
        if ($('pdem')) $('pdem').onclick = () => { logCash(-300, 'Cleared the old house in ' + s.area); p.cleared = true; sync(); toast('Old house pulled down', 'The ground is clear'); };
        r.querySelectorAll('[data-bk]').forEach(x => x.onclick = () => { const k = x.dataset.bk, c = BLD[k][1]; if (S.cash < c) return; logCash(-c, 'Built a ' + BLD[k][0].toLowerCase() + ' in ' + s.area); p.b = { kind: k, tier: 1, color: SW[(s.n * 3) % SW.length], roof: RW[(s.n * 5) % RW.length], style: 'modern', name: '', res: s.res, t: now(), stock: 100, rent: true, invest: c }; once('plot:build:' + k, 20, 'First ' + BLD[k][0].toLowerCase()); plotSync(id); save(); open('plot', id, true); stack.pop(); toast(BLD[k][0] + ' built', 'It starts earning straight away'); view(); });
        if ($('pcol1')) $('pcol1').onclick = () => { const n = collect(id); toast(n ? 'Collected' : 'Nothing yet', ''); open('plot', id, true); stack.pop(); };
        if ($('pup')) $('pup').onclick = () => { const c = Math.round(BLD[b.kind][1] * 0.8 * (b.tier || 1)); if (S.cash < c) return; logCash(-c, 'Renovated in ' + s.area); collect(id); b.tier = (b.tier || 1) + 1; b.invest = (b.invest || 0) + c; plotSync(id); save(); open('plot', id, true); stack.pop(); toast('Renovated', 'Level ' + b.tier); view(); };
        if ($('pdem2')) $('pdem2').onclick = () => { collect(id); const back = Math.round((b.invest || 0) * 0.25); logCash(back, 'Demolished in ' + s.area); delete p.b; p.cleared = true; Plots.cutaway(id, false); sync(); toast('Demolished', back ? usd(back) + ' back for the materials' : ''); };
        if ($('prent')) $('prent').onclick = () => { collect(id); b.rent = b.rent === false; save(); open('plot', id, true); stack.pop(); };
        if ($('pstock')) $('pstock').onclick = () => { collect(id); logCash(-60, 'Restocked the shop'); b.stock = 100; save(); open('plot', id, true); stack.pop(); };
        r.querySelectorAll('[data-c]').forEach(x => x.onclick = () => { b.color = +x.dataset.c; sync(); }); r.querySelectorAll('[data-r]').forEach(x => x.onclick = () => { b.roof = +x.dataset.r; sync(); }); r.querySelectorAll('[data-st]').forEach(x => x.onclick = () => { b.style = x.dataset.st; sync(); });
        if ($('pname')) $('pname').onclick = () => { const n = prompt('Name this place', b.name || ''); if (n != null) { b.name = n.trim().slice(0, 18); sync(); } };
        if ($('pin')) $('pin').onclick = () => { const on2 = Plots.open !== id; Plots.cutaway(id, on2); World.flyTo(World.view(s.x, s.z, on2 ? 42 : 90, on2 ? 1.0 : 0.8, on2 ? 0 : 0.5), 1.1); $('pin').textContent = on2 ? 'CLOSE THE HOUSE' : 'LOOK INSIDE'; if (on2 && innerWidth < 760) { P.hidden = true; panel = ''; } }; } }; };
  const bizDefs = [['mine', 'Mine shift', 'Dig for an hour and a half of output at once.'], ['farm', 'Harvest run', 'Bring in an hour of crates right now.'], ['shop', 'Counter shift', 'Serve customers at your shop for a lump of cash.'], ['harbour', 'Freight run', 'Take a cargo out of your harbour for port fees.']];
  const bizPanel = () => { const cd = k => Math.max(0, Math.ceil(((S.cd[k] || 0) - now()) / 1000));
    return { title: 'Jobs · my business', html: `${jobsSeg()}<p class="note">These jobs need something you own. Build it on a plot, then work shifts here for a quick boost on top of the income it makes while you play.</p>${bizDefs.map(([k, n, d]) => { const has = myBuilt(k).length, c = cd(k); return `<div class="row ${has ? '' : 'lock'}"><span class="ic">${ic('truck')}</span><div><b>${n}</b><small>${has ? d : 'Needs ' + needTxt[k] + ' on one of your plots'}</small></div>${has ? `<button class="btn go" data-bz="${k}" ${c ? 'disabled' : ''}>${c ? c + 's' : 'WORK'}</button>` : '<button class="btn ghost" id="bzf">FIND PLOTS</button>'}</div>`; }).join('')}`,
      bind: r => { bindSegs(r); if ($('bzf')) r.querySelectorAll('#bzf').forEach(b => b.onclick = () => open('plots', null, true)); r.querySelectorAll('[data-bz]').forEach(b => b.onclick = () => { const k = b.dataset.bz, mine = myBuilt(k); if (!mine.length || (S.cd[k] || 0) > now()) return; const bl = mine[0][1].b; let what = '';
        if (k === 'mine') { const n = Math.round(yieldOf(bl) * 1.5); S.res[bl.res || 'stone'] = (S.res[bl.res || 'stone'] || 0) + n; what = n + ' ' + (bl.res || 'stone'); } else if (k === 'farm') { const n = Math.round(yieldOf(bl)); E.farm.qty += n; E.farm.cost += n * 4; what = n + ' crates'; } else { const c = k === 'shop' ? Math.round(rateOf(bl) * 0.6) : Math.round(rateOf(bl) * 1.2); logCash(c, bizDefs.find(d => d[0] === k)[1]); what = usd(c); }
        S.cd[k] = now() + (k === 'harbour' ? 120e3 : 75e3); xp(4, 'Business job'); save(); toast('Shift done', what); open('jobs'); }); } }; };
  const marketPanel = () => { const trade = myBuilt(['office', 'tower']).length > 0, port = myBuilt('harbour').length > 0, mul = port ? 1.35 : 1;
    return { title: 'Trade · resources', html: `${tradeSeg()}<p class="note">${trade ? 'Island buyers pay these prices, and they move. ' + (port ? 'Your harbour ships exports for 35% more.' : 'A Harbour plot would add 35% on exports.') : 'To trade you need an Office or a Tower on one of your plots.'}</p>
      ${['stone', 'coal', 'oil', 'goods'].map(k => { const n = S.res[k] || 0, pr = Math.round(price(k) * mul); return `<div class="row"><span class="ic">${ic('truck')}</span><div><b>${OUT[k][0]} · ${usd(pr)} each</b><small>You have ${n}</small></div><button class="btn go" data-sell="${k}" ${trade && n ? '' : 'disabled'}>SELL ALL${n ? ' · ' + usd(n * pr) : ''}</button></div>`; }).join('')}
      ${trade ? '' : '<button class="btn ghost" id="mfind">FIND PLOTS</button>'}`,
      bind: r => { bindSegs(r); if ($('mfind')) $('mfind').onclick = () => open('plots', null, true); r.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const k = b.dataset.sell, n = S.res[k] || 0; if (!n || !trade) return; const t = n * Math.round(price(k) * mul); S.res[k] = 0; logCash(t, 'Sold ' + n + ' ' + OUT[k][0].toLowerCase()); once('sell:' + k, 10, 'First sale of ' + OUT[k][0].toLowerCase()); save(); toast('Sold ' + n + ' ' + OUT[k][0].toLowerCase(), usd(t)); open('trade'); }); } }; };
  PANELS.plots = plotsPanel; PANELS.plot = plotPanel;
  setInterval(() => { if ((panel === 'plot' || panel === 'plots' || panel === 'jobs' || panel === 'trade') && !P.hidden && !document.querySelector('#pbody :focus')) refresh(); }, 6000);
  let bridgeClosed = false, mlistPick = {};
  const areaAt = (x, z) => { let best = AREAS[0][0], d = 1e9; for (const [n, ax, az] of AREAS) { const e = Math.hypot(ax - x, az - z); if (e < d) { d = e; best = n; } } return best; };
  async function market(fn, args, ok, sub, back) { if (pendingCall) return; pendingCall = true; try { applyState(await NET.call(fn, args)); toast(ok, sub); if (back) open('trade'); else refresh(); } catch (e) { toast(e.net ? 'No connection' : 'Not done', e.net ? 'Nothing changed. Try again when you are back online.' : e.message, true); NET.refresh(); } pendingCall = false; }

  // tap a building: its card
  let down = null;
  $('c').addEventListener('pointerdown', e => { down = [e.clientX, e.clientY, performance.now()]; if (follow) unfollow(); });
  $('c').addEventListener('pointerup', e => { if (!down || $('hud').hidden || World.flying) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]), quick = performance.now() - down[2] < 450; down = null; if (moved > 8 || !quick) return; const nx = e.clientX / innerWidth * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1, pid = window.Plots && Plots.sites.length ? Plots.pick(nx, ny) : null; if (pid) { open('plot', pid); return; } const b = World.pickAt(nx, ny); if (b) open('card', b.id); else if (!P.hidden && innerWidth >= 760) close(); });
  window.App = { S, E, NET, open, close, visit, level, quote, confirm, economy, handles, lotOf, market, get OWN() { return OWN; }, get MARKET() { return MARKET; }, frame: () => loop(performance.now()) }; // frame(): one step by hand, for tests in a hidden tab
})();
