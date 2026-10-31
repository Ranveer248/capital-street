// Capital Street multiplayer (Goal 11): accounts, one shared world and chat, on Supabase.
// The database (server/schema.sql) decides who owns which building, so two players can never own the same one.
// Without a server set in js/net-config.js, or while signed out, the game plays alone exactly as before.
'use strict';
window.Net = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const col = c => /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#4c8dff'; // colours from other players' games are checked before use
  const cfg = window.CS_NET || {};
  const configured = !!(cfg.url && cfg.key && window.supabase && supabase.createClient);
  const sb = configured ? supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cs-auth' } }) : null;
  const COLORS = ['#4c8dff', '#f5b83d', '#e05d5d', '#a970ff', '#2fd0c0', '#ff8fb1', '#9be15d', '#ff9f43'];
  const NAME_OK = /^[A-Za-z0-9][A-Za-z0-9 _.-]{1,18}[A-Za-z0-9]$/;

  let user = null, me = null, status = configured ? 'connecting' : 'off'; // off | connecting | signed-out | no-player | online | error
  let why = '', conn = 'offline'; // why: what went wrong, in words; conn: live | reconnecting | offline (presence and live updates)
  const owners = new Map();   // building key, as the save stores it -> { owner, name, color, floors }
  const players = new Map();  // player id -> { name, color }
  let online = [];            // who is playing right now: [{ id, name, city, color }]
  const msgs = [];            // recent chat, both rooms
  let room = 'global';
  const listeners = [];
  const emit = (t, d) => { for (const f of listeners) try { f(t, d); } catch (e) { console.error(e); } };
  const err = e => (e && (e.message || e.error_description)) || 'Something went wrong. Try again.';
  const friendly = e => { const m = err(e); return /fetch|network|load failed|timed? ?out|ECONN/i.test(m) ? 'Can\'t reach the game server. Check your internet connection.' : /jwt|token|refresh/i.test(m) ? 'Your sign-in ran out. Sign in again.' : m; };

  // ---------- signing in ----------
  async function afterAuth() {
    me = null;
    if (!user) { status = 'signed-out'; emit('me'); return; }
    const { data, error } = await sb.from('cs_players').select('*').eq('id', user.id).maybeSingle();
    if (error) { status = 'error'; why = friendly(error); emit('me'); retrySoon(); return; }
    why = '';
    me = data; status = me ? 'online' : 'no-player';
    if (me) { players.set(me.id, { name: me.name, color: me.color }); if (await loadCloud()) return; await syncSave(); track(); report(); }
    emit('me');
  }
  const guest = async () => { const { error } = await sb.auth.signInAnonymously(); return error ? { ok: false, why: /anonymous/i.test(err(error)) ? 'Guest play is switched off on this server. Sign in with an email instead.' : err(error) } : { ok: true }; };
  const signIn = async (email, password) => { const { error } = await sb.auth.signInWithPassword({ email, password }); return error ? { ok: false, why: err(error) } : { ok: true }; };
  const signUp = async (email, password) => {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { ok: false, why: err(error) };
    return { ok: true, confirm: !data.session }; // some servers ask you to confirm your email first
  };
  const saveEmail = async (email, password) => { const { error } = await sb.auth.updateUser({ email, password }); return error ? { ok: false, why: err(error) } : { ok: true }; };
  const signOut = async () => { untrack(); await sb.auth.signOut(); };
  async function createPlayer(name, color) {
    name = name.trim();
    if (!NAME_OK.test(name)) return { ok: false, why: '3 to 20 letters, numbers, spaces, dots, dashes or underscores, starting and ending with a letter or number' };
    const { data, error } = await sb.from('cs_players').insert({ id: user.id, name, color, city: CITY.id }).select().single();
    if (error) return { ok: false, why: /cs_players_name|duplicate/.test(error.message) ? `${name} is taken. Try another name.` : err(error) };
    me = data; status = 'online'; players.set(me.id, { name: me.name, color: me.color });
    if (await loadCloud()) return { ok: true };
    await syncSave(); track(); report(); emit('me');
    return { ok: true };
  }
  async function deleteMe() {
    const { error } = await sb.rpc('cs_delete_me');
    if (error) return { ok: false, why: err(error) };
    for (const [k, o] of owners) if (me && o.owner === me.id) owners.delete(k);
    emit('owners'); await signOut();
    return { ok: true };
  }

  // ---------- the shared world: who owns which building in this city ----------
  async function loadOwners() {
    owners.clear();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('cs_buildings').select('building, owner, floors, name, design, cs_players(name, color)').eq('city', CITY.id).range(from, from + 999);
      if (error) return;
      for (const r of data) {
        if (r.cs_players) players.set(r.owner, r.cs_players);
        owners.set(r.building, { owner: r.owner, floors: r.floors, name: (r.cs_players || {}).name || 'a player', color: (r.cs_players || {}).color || '#4c8dff', design: r.design || null });
      }
      if (data.length < 1000) break;
    }
    emit('owners');
  }
  async function playerOf(id) {
    if (players.has(id)) return players.get(id);
    const { data } = await sb.from('cs_players').select('name, color').eq('id', id).maybeSingle();
    const p = data || { name: 'a player', color: '#4c8dff' }; players.set(id, p); return p;
  }
  const ownerOf = k => { const o = owners.get(k); return o && !(me && o.owner === me.id) ? o : null; }; // someone else's
  // claim before paying: the server refuses if another player got there first
  async function claim(k, floors, name) {
    if (status !== 'online') return { ok: true, local: true };
    const { data, error } = await sb.rpc('cs_claim_building', { p_city: CITY.id, p_building: k, p_floors: floors, p_name: name || '' });
    if (error) return { ok: false, why: /Another player/.test(error.message) ? 'Another player just bought this building.' : err(error) };
    owners.set(k, { owner: me.id, floors: data.floors, name: me.name, color: me.color, design: data.design || null }); emit('owners');
    return { ok: true };
  }
  // what you built on a building (js/build.js), so every player sees it; it stays with the building when it's sold
  async function setDesign(k, design) {
    if (status !== 'online') return { ok: true, local: true };
    const { error } = await sb.rpc('cs_set_design', { p_city: CITY.id, p_building: k, p_design: design });
    if (error) return { ok: false, why: err(error) };
    const o = owners.get(k); if (o) o.design = design;
    return { ok: true };
  }
  async function release(k) {
    if (status !== 'online') return;
    await sb.rpc('cs_release_building', { p_city: CITY.id, p_building: k });
    const o = owners.get(k); if (o && o.owner === me.id) { owners.delete(k); emit('owners'); } // sold to a player: it's theirs now, not empty
  }
  // your save and the shared world must agree: claim what you bought while playing alone; if someone else got a
  // building first, you get your money back in full
  async function syncSave() {
    if (!me) return;
    if (window.Trade) await Trade.collect(); // things sold to other players while you were away leave your save first
    const here = Object.entries(M.state.props).filter(([k]) => window.Property ? Property.isHere(k) : true);
    for (const [k, p] of here) {
      const o = owners.get(k);
      if (o && o.owner !== me.id) {
        const r = M.sellProperty(k, p.floors);
        if (r.ok) { M.state.cash = +(M.state.cash + r.gets / (1 - M.PROP_FEE) * M.PROP_FEE).toFixed(2); M.save(); }
        toast('Building returned', `${o.name} owns ${p.name || 'a building you had'} in the shared world. You got your money back in full.`);
      } else if (!o || o.floors !== p.floors) await claim(k, p.floors, p.name);
    }
  }

  // ---------- cloud saves: your cash, shares, loans, buildings and office follow your account (table cs_saves) ----------
  // This device remembers which cloud copy it last matched. If the cloud copy changed since (you played on another
  // device), the cloud copy wins and this device's save is kept as a backup; otherwise this device's save goes up.
  const SAVE_KEY = 'capital-street-market-v1', SYNC_KEY = 'cs-cloud-sync';
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } } };
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) | 0; return h; };
  const marker = () => { try { return JSON.parse(ls.get(SYNC_KEY)) || {}; } catch (e) { return {}; } };
  // Goal 31: each upload names the version it replaces (cs_put_save), so an older copy from another tab or device can
  // never overwrite a newer one; failures are reported (js/saves.js) and retried, never hidden.
  let cloudAt = null, cloudBusy = null, legacy = false, retryT = 0, paused = false;
  const cloud = { state: 'off', at: 0, why: '', fails: 0 }; // off | saving | ok | error | conflict
  const setCloud = (state, w) => { cloud.state = state; cloud.why = w || ''; emit('cloud'); };
  function mark(at, h) { cloudAt = at; ls.set(SYNC_KEY, JSON.stringify({ uid: me.id, at, hash: h })); }
  function packSave() { // the charts keep one point per 15 game minutes, so a save is about 150 KB instead of 2.5 MB
    const S = M.state, stocks = {};
    for (const [t, st] of Object.entries(S.stocks)) stocks[t] = Object.assign({}, st, { hist: st.hist.filter((h, i, a) => i === a.length - 1 || Math.floor(h.t / 15) !== Math.floor(a[i + 1].t / 15)) });
    return { v: 1, city: CITY.id, market: Object.assign({}, S, { stocks }) };
  }
  async function pushCloud(force) {
    if (status !== 'online' || paused) return { ok: false, why: 'offline' };
    if (cloud.state === 'conflict') return { ok: false, why: 'conflict' };
    while (cloudBusy) await cloudBusy; // one upload at a time, in order
    const body = packSave(), h = hash(JSON.stringify(body));
    if (force !== true && h === marker().hash && cloud.state === 'ok') return { ok: true }; // nothing new since the last upload
    let done; cloudBusy = new Promise(r => { done = r; });
    setCloud('saving');
    let r = null;
    try {
      if (!legacy) {
        r = await sb.rpc('cs_put_save', { p_data: body, p_base: cloudAt });
        if (r.error && /PGRST202|Could not find the function/i.test((r.error.code || '') + ' ' + r.error.message)) legacy = true; // a server from before Goal 31
      }
      if (legacy) { const q = await sb.from('cs_saves').upsert({ player: me.id, data: body }).select('updated_at').single(); r = { data: q.data && q.data.updated_at, error: q.error }; }
    } catch (e) { r = { error: e }; }
    cloudBusy = null; done();
    if (!r.error) { mark(r.data, h); cloud.at = Date.now(); cloud.fails = 0; setCloud('ok'); return { ok: true }; }
    if (/Newer save/.test(err(r.error))) { setCloud('conflict', 'A newer save came from another device or tab'); return { ok: false, why: 'conflict' }; }
    cloud.fails++; setCloud('error', friendly(r.error));
    clearTimeout(retryT); retryT = setTimeout(() => pushCloud(), Math.min(60000, 5000 * 2 ** (cloud.fails - 1)));
    return { ok: false, why: friendly(r.error) };
  }
  const changedHere = () => hash(JSON.stringify(packSave())) !== marker().hash; // played on this device since the last upload
  function useCloud(d, at, msg) { // the cloud copy replaces this device's game (which is kept as a backup), then the page reloads
    ls.set(SAVE_KEY + '-backup', ls.get(SAVE_KEY) || '');
    mark(at, null);
    const S = M.state;
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, d.market); M.save(); M.freeze();
    if (CITIES[d.city] && d.market.cities && d.market.cities[d.city]) ls.set('cs-city', d.city);
    toast('Cloud save loaded', msg || 'Your game from your account. This device\'s old save is kept as a backup.');
    setTimeout(() => location.reload(), 1200);
  }
  async function resolveConflict(which) {
    const { data, error } = await sb.from('cs_saves').select('data, updated_at').eq('player', me.id).maybeSingle();
    if (error) return { ok: false, why: friendly(error) };
    if (which === 'load') { if (data && data.data && data.data.market) useCloud(data.data, data.updated_at); return { ok: true }; }
    if (data && data.data) ls.set(SAVE_KEY + '-cloud-backup', JSON.stringify(data.data)); // the account's copy is kept on this device
    cloudAt = data ? data.updated_at : null; setCloud('saving');
    return pushCloud(true);
  }
  async function loadCloud() { // true when the page reloads with the cloud save
    const { data, error } = await sb.from('cs_saves').select('data, updated_at').eq('player', me.id).maybeSingle();
    if (error) { setCloud('error', friendly(error)); return false; }
    const mk = marker();
    if (ls.get('cs-cloud-import')) { // you loaded a backup file (js/saves.js): it goes up to your account
      ls.set('cs-cloud-import', ''); cloudAt = data && data.updated_at;
      const r = await pushCloud(true); toast(r.ok ? 'Backup uploaded' : 'Backup loaded on this device', r.ok ? 'Your account now has the game from your backup file.' : 'It uploads to your account when the connection is back.');
      return false;
    }
    if (!data || (mk.uid === me.id && mk.at === data.updated_at)) { cloudAt = data && data.updated_at; await pushCloud(!data); return false; }
    const d = data.data;
    if (!d || !d.market || !d.market.stocks) return false;
    if (mk.uid === me.id && changedHere()) { // both this device and another one played since they last agreed: you choose
      cloudAt = mk.at; setCloud('conflict', 'This device and another one both have new progress');
      setTimeout(() => window.CSUI && CSUI.story(`<small>TWO SAVES</small><b>Which game do you want?</b><p>You played on another device or tab, and on this one too, since they last saved together.</p><p>The other one was saved to your account at ${new Date(data.updated_at).toLocaleString()}. Whichever you don't pick is kept on this device as a backup.</p>`,
        [['Load my account\'s save', () => useCloud(d, data.updated_at)], ['Keep this device\'s game', () => resolveConflict('upload')]]), 1500);
      return false;
    }
    useCloud(d, data.updated_at);
    return true;
  }
  setInterval(() => pushCloud(), 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pushCloud(); });
  M.on(type => { if (type === 'property' || type === 'loan' || type === 'city' || type === 'reset') setTimeout(pushCloud, 2000); });

  M.on((type, d) => { // sales of any kind (yours, or forced by the bank) give the building back to the world
    if (type !== 'property' || d.kind !== 'sold' || status !== 'online') return;
    const p = M.state.props[d.id];
    if (p) claim(d.id, p.floors, p.name); else release(d.id);
  });

  // ---------- who's online, and your entry on the rich list ----------
  // Goal 31: one entry per player however many tabs they have open; a dropped connection shows as reconnecting, comes
  // back by itself, and then reloads what changed while it was away (owners, listings, auctions, your inbox).
  let presence = null, backoff = 0, wasLive = false, rT = 0;
  const TAB = Math.random().toString(36).slice(2, 8);
  function setConn(c) {
    if (c === conn) return;
    const was = conn; conn = c; emit('conn');
    if (c === 'live') { if (wasLive && was !== 'live') resync(); wasLive = true; }
  }
  async function resync() { await loadOwners(); await loadChat(); if (window.Trade) { await Trade.reload(); await Trade.collect(); } pushCloud(); }
  function track() {
    if (!me || presence || paused) return;
    const ch = presence = sb.channel('cs-online', { config: { presence: { key: me.id } } });
    ch.on('presence', { event: 'sync' }, () => {
      if (presence !== ch) return;
      const seen = new Map();
      for (const metas of Object.values(ch.presenceState())) for (const m of metas) if (m && m.id && !seen.has(m.id)) seen.set(m.id, m);
      online = [...seen.values()]; emit('online');
    }).subscribe(st => {
      if (presence !== ch) return;
      if (st === 'SUBSCRIBED') { backoff = 0; setConn('live'); ch.track({ id: me.id, name: me.name, color: me.color, city: CITY.id, tab: TAB }); }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { setConn(navigator.onLine === false ? 'offline' : 'reconnecting'); reconnectSoon(); }
    });
  }
  function reconnectSoon() {
    clearTimeout(rT);
    rT = setTimeout(() => { if (!me || paused) return; if (presence) { const p = presence; presence = null; sb.removeChannel(p); } track(); }, Math.min(30000, 1000 * 2 ** Math.min(5, backoff++)));
  }
  function untrack() { clearTimeout(rT); if (presence) { const p = presence; presence = null; sb.removeChannel(p); } online = []; setConn('offline'); emit('online'); }
  addEventListener('offline', () => { if (me) setConn('offline'); });
  addEventListener('online', () => { backoff = 0; if (me) { reconnectSoon(); pushCloud(); } else if (status === 'error') retrySoon(1); });
  let bootT = 0;
  function retrySoon(ms = 10000) { clearTimeout(bootT); bootT = setTimeout(async () => { if (status !== 'error') return; status = 'connecting'; emit('me'); try { await loadOwners(); await afterAuth(); await loadChat(); } catch (e) { status = 'error'; why = friendly(e); emit('me'); retrySoon(); } }, ms); }
  function pause() { paused = true; untrack(); setCloud('off'); } // another tab took over (js/saves.js)
  function report() { // your city and net worth, for the rich list (reported by your game until the economy runs on the server)
    if (status !== 'online') return;
    sb.from('cs_players').update({ city: CITY.id, net_worth: Math.round(M.netWorth()), last_seen: new Date().toISOString() }).eq('id', me.id).then(() => {});
  }
  setInterval(report, 60000);
  async function richList() {
    if (!sb) return [];
    const { data } = await sb.from('cs_players').select('id, name, color, net_worth, city').order('net_worth', { ascending: false }).limit(10);
    return data || [];
  }

  // ---------- chat: the whole world, or just this city ----------
  async function loadChat() {
    const { data } = await sb.from('cs_chat').select('id, room, name, body, created_at').in('room', ['global', CITY.id]).order('id', { ascending: false }).limit(100);
    msgs.length = 0; if (data) msgs.push(...data.reverse());
    emit('chat');
  }
  async function send(text) {
    text = text.trim();
    if (!text) return { ok: false, why: '' };
    if (status !== 'online') return { ok: false, why: 'Sign in and pick a name to chat.' };
    const { error } = await sb.from('cs_chat').insert({ room: room === 'city' ? CITY.id : 'global', body: text.slice(0, 280) });
    return error ? { ok: false, why: err(error) } : { ok: true };
  }

  // ---------- the panel: chat, players, your account ----------
  const panel = document.createElement('div');
  panel.id = 'net'; panel.hidden = true;
  panel.innerHTML = '<div class="exh"><b>ONLINE</b><span class="st" id="netSt"></span><button id="netX" aria-label="Close">✕</button></div><div class="tabs"><button data-nt="chat" class="on">Chat</button><button data-nt="players">Players</button><button data-nt="account">Account</button></div><div id="netBody"></div>';
  document.body.appendChild(panel);
  let tab = 'chat', richCache = [], delArm = 0;
  const swatches = cur => `<div class="swatches">${COLORS.map(c => `<button data-c="${c}" style="background:${c}" class="${c === cur ? 'on' : ''}" aria-label="Colour ${c}"></button>`).join('')}</div>`;
  function line(m) {
    const p = [...players.values()].find(x => x.name === m.name), t = new Date(m.created_at);
    return `<div class="msg"><span class="mt">${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}</span><b style="color:${p ? col(p.color) : '#9aa6b8'}">${esc(m.name)}</b> ${esc(m.body)}</div>`;
  }
  function draw() {
    panel.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.nt === tab));
    $('netSt').textContent = status === 'online' ? (conn === 'live' ? `${online.length} ONLINE` : conn === 'reconnecting' ? 'RECONNECTING…' : 'OFFLINE') : status === 'off' ? 'NOT SET UP' : status === 'error' ? 'CAN\'T CONNECT' : '';
    const body = $('netBody');
    if (status === 'off') {
      body.innerHTML = '<div class="netp"><b>Multiplayer is coming</b><p>This copy of the game isn\'t connected to a server yet, so you\'re playing alone. Your progress is saved on this device.</p></div>';
      return;
    }
    if (tab === 'chat') {
      const list = msgs.filter(m => room === 'city' ? m.room === CITY.id : m.room === 'global');
      body.innerHTML = `<div class="rooms"><button data-r="global" class="${room === 'global' ? 'on' : ''}">World</button><button data-r="city" class="${room === 'city' ? 'on' : ''}">${esc(CITY.name)}</button></div>
        <div class="msgs" id="netMsgs">${list.length ? list.map(line).join('') : '<p class="note">No messages yet. Say hello.</p>'}</div>
        ${status === 'online' ? '<form id="netForm" class="say"><input id="netIn" maxlength="280" autocomplete="off" placeholder="Message" aria-label="Message"><button>Send</button></form>' : '<p class="note">Sign in and pick a name to chat. <button class="lnk" data-go="account">Account</button></p>'}`;
      const box = $('netMsgs'); box.scrollTop = box.scrollHeight;
      body.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { room = b.dataset.r; draw(); });
      if ($('netForm')) $('netForm').onsubmit = async e => {
        e.preventDefault(); const inp = $('netIn'), v = inp.value; inp.value = '';
        const r = await send(v); if (!r.ok && r.why) { toast('Not sent', r.why); inp.value = v; }
      };
    } else if (tab === 'players') {
      const isMe = id => me && id === me.id, here = id => [...owners.values()].filter(o => o.owner === id).length;
      const you = id => isMe(id) ? ' <em class="you">YOU</em>' : '';
      const find = id => here(id) ? `<button class="lnk" data-find="${esc(id)}">Find ${here(id) > 1 ? `(${here(id)})` : ''}</button>` : '';
      body.innerHTML = `<div class="netp">${status === 'online' ? `<div class="invite"><div><b>Play with a friend</b><small>Everyone shares one New York. Send this link: they join and land on your buildings.</small></div><button class="btn pri" id="netInv">INVITE</button></div>` : ''}
        <small>ONLINE NOW · ${online.length}</small>${online.length ? online.map(p => `<div class="prow"><i style="background:${col(p.color)}"></i><b>${esc(p.name)}${you(p.id)}</b><span>${esc((CITIES[p.city] || {}).name || '')} · ${here(p.id)} building${here(p.id) === 1 ? '' : 's'} here</span>${find(p.id)}</div>`).join('') : '<p class="note">Nobody else is here right now.</p>'}
        <small>RICHEST PLAYERS</small>${richCache.map((p, i) => `<div class="prow"><span class="rk">${i + 1}</span><i style="background:${col(p.color)}"></i><b>${esc(p.name)}${you(p.id)}</b><span>${usd(p.net_worth)}</span>${find(p.id)}</div>`).join('') || '<p class="note">No players yet.</p>'}
        <p class="note">Each player's buildings carry their colour and name on the map. Net worth is reported by each player's game.</p></div>`;
      body.querySelectorAll('[data-find]').forEach(b => b.onclick = () => findPlayer(b.dataset.find));
      if ($('netInv')) $('netInv').onclick = invite;
      richList().then(r => { const was = JSON.stringify(richCache); richCache = r; if (tab === 'players' && !panel.hidden && JSON.stringify(r) !== was) draw(); });
    } else if (status === 'signed-out' || status === 'error' || status === 'connecting') {
      body.innerHTML = `<div class="netp">${status === 'error' ? `<p class="swarn">${esc(why || 'Can\'t reach the game server.')} Trying again by itself.</p>` : ''}<b>Play online</b><p>Share one world with everyone: see who owns which building, and chat. Your buildings are kept safe on the server.</p>
        <button class="btn pri wide" id="netGuest">PLAY ONLINE AS A GUEST</button>
        <form id="netLogin" class="cols"><small>OR USE AN EMAIL (KEEPS YOUR ACCOUNT ON EVERY DEVICE)</small><input id="netEm" type="email" autocomplete="email" placeholder="Email" aria-label="Email" required><input id="netPw" type="password" autocomplete="current-password" placeholder="Password (8+ characters)" aria-label="Password" minlength="8" required>
        <div class="row2"><button class="btn" id="netIn2" type="submit">SIGN IN</button><button class="btn" id="netUp" type="button">CREATE ACCOUNT</button></div></form>
        <p class="note">By playing online you agree to the <a href="terms.html" target="_blank" rel="noopener">Terms</a>. See the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> for what's stored.</p></div>`;
      $('netGuest').onclick = async () => { const r = await guest(); if (!r.ok) toast('Can\'t sign in', r.why); };
      $('netLogin').onsubmit = async e => { e.preventDefault(); const r = await signIn($('netEm').value, $('netPw').value); if (!r.ok) toast('Can\'t sign in', r.why); };
      $('netUp').onclick = async () => {
        if (!$('netLogin').reportValidity()) return;
        const r = await signUp($('netEm').value, $('netPw').value);
        if (!r.ok) toast('Can\'t create the account', r.why); else if (r.confirm) toast('Check your email', 'Open the link we sent you, then sign in.');
      };
    } else if (status === 'no-player') {
      let col = COLORS[Math.floor(Math.random() * COLORS.length)];
      body.innerHTML = `<div class="netp"><b>Pick your name</b><p>Everyone sees it on your buildings and in chat.</p>
        <form id="netName" class="cols"><input id="netNm" maxlength="20" placeholder="Your name" aria-label="Player name" required>${swatches(col)}<button class="btn pri wide">START</button></form></div>`;
      body.querySelectorAll('.swatches button').forEach(b => b.onclick = e => { e.preventDefault(); col = b.dataset.c; body.querySelectorAll('.swatches button').forEach(x => x.classList.toggle('on', x === b)); });
      $('netName').onsubmit = async e => { e.preventDefault(); const r = await createPlayer($('netNm').value, col); if (!r.ok) toast('Pick another name', r.why); };
    } else {
      const anon = user && user.is_anonymous, mineHere = [...owners.values()].filter(o => o.owner === me.id).length;
      body.innerHTML = `<div class="netp"><div class="prow big"><i style="background:${col(me.color)}"></i><b>${esc(me.name)}</b><span>${anon ? 'Guest' : esc(user.email || '')}</span></div>
        <div class="split"><div><b>Only yours</b><small>Cash, shares, loans, level, tasks and your office: your own save, kept on this device and on your account.</small></div><div><b>Shared with everyone</b><small>Who owns each building and plot, listings, player auctions, the goods exchange and chat.</small></div></div>
        <p class="note">${mineHere} building${mineHere === 1 ? '' : 's'} in ${esc(CITY.name)} registered to you. ${cloudAt ? `Your game is saved to your account (last at ${new Date(cloudAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}), so it follows you to any device you sign in on.` : 'Saving your game to your account…'}</p>
        ${anon ? `<form id="netSave" class="cols"><small>KEEP THIS ACCOUNT: ADD AN EMAIL AND PASSWORD</small><input id="netEm" type="email" autocomplete="email" placeholder="Email" aria-label="Email" required><input id="netPw" type="password" autocomplete="new-password" placeholder="Password (8+ characters)" aria-label="Password" minlength="8" required><button class="btn">SAVE MY ACCOUNT</button></form>` : ''}
        <div class="row2"><button class="btn" id="netOut">SIGN OUT</button><button class="btn danger" id="netDel">DELETE MY ACCOUNT</button></div></div>`;
      if ($('netSave')) $('netSave').onsubmit = async e => { e.preventDefault(); const r = await saveEmail($('netEm').value, $('netPw').value); toast(r.ok ? 'Check your email' : 'Can\'t save', r.ok ? 'Confirm the address to finish saving your account.' : r.why); };
      $('netOut').onclick = signOut;
      $('netDel').onclick = async () => {
        if (Date.now() - delArm > 4000) { delArm = Date.now(); $('netDel').textContent = 'CLICK AGAIN TO DELETE'; return; }
        const r = await deleteMe(); toast(r.ok ? 'Account deleted' : 'Can\'t delete', r.ok ? 'Your player, buildings and messages are gone from the server.' : r.why);
      };
    }
    body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { tab = b.dataset.go; draw(); });
  }
  panel.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.nt; draw(); });
  $('netX').onclick = () => { panel.hidden = true; };
  function open(which) { if (which) tab = which; for (const id of ['ex', 'bank', 'props', 'listing']) if ($(id)) $(id).hidden = true; panel.hidden = false; draw(); if (tab === 'chat' && $('netIn')) $('netIn').focus(); }
  function chip() {
    const el = $('netV'); if (!el) return;
    el.parentElement.onclick = () => open(status === 'online' ? 'players' : 'account');
    const live = status === 'online' && conn === 'live';
    el.textContent = status === 'online' ? (live ? `${online.length} online` : conn === 'reconnecting' ? 'Reconnecting…' : 'Offline') : status === 'off' ? 'Solo' : status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Offline' : 'Sign in';
    el.parentElement.classList.toggle('on', live);
    el.parentElement.classList.toggle('warn', status === 'error' || (status === 'online' && !live));
    el.parentElement.title = status === 'error' ? why : status === 'online' && !live ? 'Your game keeps saving on this device and catches up when the connection is back.' : '';
  }
  // ---------- finding a player's buildings, and inviting a friend ----------
  const findAt = new Map();
  function findPlayer(id) {
    const keys = [...owners.entries()].filter(([k, o]) => o.owner === id && (!window.Property || Property.isHere(k) || k.startsWith('plot:'))).map(([k]) => k);
    if (!keys.length) { toast('Nothing here yet', 'They don\'t own anything in this city.'); return false; }
    const i = (findAt.get(id) || 0) % keys.length, k = keys[i]; findAt.set(id, i + 1);
    panel.hidden = true;
    if (k.includes('plot:') && window.Land) Land.select('x:' + k.split('plot:')[1].replace(',', ':'), true);
    else if (window.Property) Property.select(Property.gOf(k), true);
    if (keys.length > 1) toast(`${i + 1} of ${keys.length}`, 'Press Find again for the next one.');
    return true;
  }
  async function findByName(name) {
    const lower = String(name || '').toLowerCase();
    let id = [...players.entries()].find(([, p]) => (p.name || '').toLowerCase() === lower);
    id = id && id[0];
    if (!id) { const { data } = await sb.from('cs_players').select('id, name, color').eq('name', name).maybeSingle(); if (data) { players.set(data.id, data); id = data.id; } }
    return id || null;
  }
  async function invite() {
    const url = location.origin + location.pathname + '?with=' + encodeURIComponent(me.name);
    let copied = false; try { await navigator.clipboard.writeText(url); copied = true; } catch (e) { /* not allowed: show it instead */ }
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: 'Capital Street', text: `Come and play with me in New York. I'm ${me.name}.`, url }); return; } catch (e) { /* cancelled */ } }
    window.CSUI && CSUI.story(`<small>INVITE A FRIEND</small><b>${copied ? 'Link copied' : 'Send this link'}</b><p>When your friend opens it and picks a name, they join the same New York and the camera takes them to your buildings.</p><input class="invl" readonly value="${esc(url)}" onclick="this.select()">`, [['Done', () => {}]]);
  }
  listeners.push(t => {
    chip();
    if (!panel.hidden && (t !== 'chat' || tab === 'chat')) { const typing = document.activeElement && document.activeElement.id === 'netIn' ? $('netIn').value : null; draw(); if (typing != null && $('netIn')) { $('netIn').value = typing; $('netIn').focus(); } }
  });

  // ---------- start ----------
  async function boot() {
    chip();
    if (!configured) return;
    sb.auth.onAuthStateChange((ev, session) => {
      const u = session ? session.user : null;
      if ((u && u.id) !== (user && user.id)) { user = u; if (!u) untrack(); setTimeout(afterAuth, 0); } else user = u;
    });
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    await loadOwners();
    await afterAuth();
    await loadChat();
    if (status === 'online' && !presence) track();
    sb.channel('cs-' + CITY.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cs_buildings', filter: 'city=eq.' + CITY.id }, async p => {
        if (p.eventType === 'DELETE') { owners.delete(p.old.building); emit('owners'); return; }
        const r = p.new, pl = await playerOf(r.owner);
        owners.set(r.building, { owner: r.owner, floors: r.floors, name: pl.name, color: pl.color, design: r.design || null }); emit('owners');
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cs_chat', filter: `room=in.(global,${CITY.id})` }, p => {
        msgs.push(p.new); if (msgs.length > 200) msgs.shift(); emit('chat', p.new);
      })
      .subscribe();
  }
  const ready = setInterval(() => { if (window.CS && $('load').hidden) { clearInterval(ready); boot().catch(e => { status = 'error'; why = friendly(e); console.error(e); emit('me'); retrySoon(); }); } }, 200);

  return {
    get status() { return status; }, get why() { return why; }, get conn() { return conn; }, get legacy() { return legacy; }, cloud, pushCloud, resolveConflict, findPlayer, findByName, invite, pause, retry: () => retrySoon(1),
    get me() { return me; }, get online() { return online; }, get sb() { return sb; }, get user() { return user; }, configured, playerOf,
    on: f => listeners.push(f), ownerOf, owners, claim, release, setDesign, designOf: k => (owners.get(k) || {}).design || null, open, send, guest, signIn, signUp, signOut, createPlayer, deleteMe,
  };
})();
