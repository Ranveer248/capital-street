// Capital Street trading between players (Goal 15 part 2, and the Goal 13 add-on): sell buildings and plots to other
// players at your price or by auction, and buy and sell goods on an exchange where players set every price.
// The server (server/schema.sql) moves ownership and goods and keeps an inbox of who owes whom; cash still lives in
// each player's save, so this game pays for what you buy, holds goods or cash for your open orders, and collects
// your inbox (money from sales, goods you bought, auctions you won) as soon as it arrives.
'use strict';
window.Trade = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = (v, dp = 0) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const err = e => (e && e.message ? e.message.replace(/^.*?: /, '') : 'Something went wrong. Try again.');
  const on = () => window.Net && Net.status === 'online';
  const sb = () => Net.sb;
  const listings = new Map(); // building key on the server -> { seller, price, floors, name, sellerName }
  let auctions = [], book = [], myOrders = [], exGood = 'ore';

  // ---------- your inbox ----------
  const pending = () => M.state.tradePending || (M.state.tradePending = []); // things won in another city wait until you're there
  function applyHere() {
    const keep = [];
    for (const r of pending()) {
      if (r.city !== CITY.id) { keep.push(r); continue; }
      if (r.building.startsWith('plot:')) {
        const [, i, j] = r.building.split(':'), p = Land.plots.get(i + ',' + j);
        if (p && !Land.mine(p)) M.state.land[Land.keyOf(p)] = { city: CITY.id, i: p.i, j: p.j, name: p.name, area: p.area, ppm: p.ppm, paid: r.price, bought: M.state.time, earned: 0 };
      } else {
        const g = Property.gOf(r.building), it = Property.info(g);
        if (it && !M.state.props[r.building]) M.state.props[r.building] = { floors: r.floors, paid: r.price, bought: M.state.time, earned: 0, name: it.name, type: it.type, floorPrice: it.floorPrice, totalFloors: it.floors, x: it.x, z: it.z, city: CITY.id };
      }
    }
    M.state.tradePending = keep;
  }
  let collecting = null;
  function collect() { return collecting || (collecting = collectNow().finally(() => { collecting = null; })); }
  // Goal 31: the inbox is a ledger applied exactly once. Open rows are read (not taken), applied, and their ids saved
  // in your game (state.ledger); the save goes up to your account, and only then are the rows marked done. If the page
  // closes or the connection drops anywhere in between, nothing is lost and nothing is paid twice.
  async function collectNow() {
    if (!on()) return;
    if (Net.legacy) return collectOld();
    const S = M.state, done = S.ledger || (S.ledger = []);
    const q = await sb().from('cs_inbox').select('*').eq('player', Net.me.id).eq('collected', false).order('id', { ascending: true }).limit(200);
    if (q.error) return;
    const open = (q.data || []).map(r => r.id), fresh = (q.data || []).filter(r => !done.includes(r.id));
    if (fresh.length) { applyRows(fresh); done.push(...fresh.map(r => r.id)); M.save(); }
    if (!open.length) { if (done.length) { S.ledger = []; M.save(); } return; }
    const up = await Net.pushCloud(true); // your account must have the save with these rows in it first
    if (!up.ok) return; // tried again next time: the ids in your save stop them being applied twice
    const ack = await sb().rpc('cs_inbox_ack', { p_ids: open.filter(id => done.includes(id)) });
    if (!ack.error) { S.ledger = done.filter(id => !open.includes(id)); M.save(); }
  }
  async function collectOld() { // a server from before Goal 31
    const { data, error } = await sb().rpc('cs_collect_inbox');
    if (error || !data || !data.length) return;
    applyRows(data); M.save();
  }
  function applyRows(data) {
    const lines = [], bought = [], inv = window.Biz ? Biz.inv() : (M.state.goods || (M.state.goods = {}));
    for (const r of data) {
      const cash = +r.cash || 0;
      if (cash) M.state.cash = +(M.state.cash + cash).toFixed(2);
      if (r.kind === 'sold') { // gone to another player: out of your save, no refund (the money is in this row)
        if (r.building && r.building.startsWith('plot:')) { delete (M.state.land || {})[`${r.city}:${r.building}`]; M.emit('land', { kind: 'sold', id: `${r.city}:${r.building}`, gets: cash }); }
        else if (r.building && M.state.props[r.building]) { delete M.state.props[r.building]; M.emit('property', { kind: 'sold', id: r.building, floors: r.floors, gets: cash }); }
        lines.push(`${r.note}: +${usd(cash)}`);
      } else if (r.kind === 'won' || r.kind === 'bought') { // yours now: paid from your cash, through the ledger
        pending().push({ city: r.city, building: r.building, floors: r.floors, price: -cash });
        if (r.kind === 'bought') bought.push({ kind: 'bought', id: r.building, floors: r.floors, cost: -cash, fromPlayer: true });
        lines.push(`${r.note}: ${usd(cash)}`);
      } else if (r.kind === 'goods') { inv[r.good] = (inv[r.good] || 0) + r.qty; lines.push(r.note); }
      else lines.push(cash ? `${r.note}: +${usd(cash)}` : r.note);
    }
    applyHere();
    for (const b of bought) M.emit('property', b); // XP and tasks, once the building is in your save
    if (window.Property) Property.refreshOwned();
    toast('Trades with players', lines.slice(0, 3).join(' · ') + (lines.length > 3 ? ` · and ${lines.length - 3} more` : ''));
    if (M.state.cash < 0) setTimeout(() => toast('You owe money', `Your cash is ${usd(M.state.cash)} after an auction you won. Sell something to get back above zero.`), 2600);
    redraw();
  }

  // ---------- loading what's on offer ----------
  async function loadListings() {
    if (!window.Net || !Net.sb) return;
    const { data } = await sb().from('cs_listings').select('building, seller, price, floors, name, cs_players(name)').eq('city', CITY.id).limit(500);
    listings.clear();
    for (const r of data || []) listings.set(r.building, { seller: r.seller, price: +r.price, floors: r.floors, name: r.name, sellerName: (r.cs_players || {}).name || 'a player' });
    redraw();
  }
  async function loadAuctions() {
    if (!window.Net || !Net.sb) return;
    const { data } = await sb().rpc('cs_auctions_open', { p_city: CITY.id });
    auctions = data || [];
  }
  async function loadBook() {
    if (!window.Net || !Net.sb) return;
    const { data } = await sb().from('cs_orders').select('id, player, side, good, qty, filled, price').eq('status', 'open').eq('good', exGood).order('price', { ascending: true }).limit(200);
    book = data || [];
    if (on()) { const r = await sb().from('cs_orders').select('id, side, good, qty, filled, price').eq('status', 'open').eq('player', Net.me.id).order('id'); myOrders = r.data || []; } else myOrders = [];
  }
  let redrawT = 0;
  function redraw() { clearTimeout(redrawT); redrawT = setTimeout(() => { if (window.Property) Property.redraw(); if (window.Land && Land.redraw) Land.redraw(); }, 150); }

  // ---------- on a building's or plot's card ----------
  // ctx: { kind: 'b' | 'p', key (the server's building key), mine, theirs (owner from Net), value, floors, hasBiz }
  function block(ctx) {
    if (!window.Net || !Net.configured) return '';
    const l = listings.get(ctx.key), a = auctions.find(x => x.building === ctx.key);
    if (!on()) return ctx.mine || l || a ? '<p class="note">Sign in (Online → Account) to trade with other players.</p>' : '';
    if (ctx.mine) {
      if (a) return `<div class="trade"><small>UP FOR AUCTION TO PLAYERS</small><p class="note">Current bid ${usd(a.price)} · ${a.bidders} bidder${a.bidders === 1 ? '' : 's'} · ends ${ends(a.ends_at)}</p></div>`;
      if (l) return `<div class="trade"><small>LISTED FOR PLAYERS</small><p class="note">Asking ${usd(l.price)}. Anyone can buy it at that price.</p><div class="lbtns"><button class="plain" id="trUnlist">Take it off the market</button></div></div>`;
      if (ctx.hasBiz) return '<p class="note">To sell this plot to players, demolish its business first.</p>';
      return `<div class="trade"><small>SELL TO OTHER PLAYERS</small>
        <form class="askf" id="trList">Ask $<input type="number" min="1" step="1" value="${Math.round(ctx.value)}" aria-label="Your asking price"><button class="btn">List it</button></form>
        <form class="askf" id="trAuc">Auction from $<input type="number" min="1" step="1" value="${Math.round(ctx.value * 0.6)}" aria-label="Opening bid"> for <select aria-label="How long"><option value="6">6 hours</option><option value="24" selected>a day</option><option value="72">3 days</option></select><button class="btn">Start</button></form>
        <p class="note">Real-world hours. The money arrives in your game when it sells, even if you're away.</p></div>`;
    }
    if (l) return `<div class="trade"><small>FOR SALE BY ${esc(l.sellerName).toUpperCase()}</small><div class="lbtns"><button class="buy" id="trBuy">Buy from ${esc(l.sellerName)} · ${usd(l.price)}</button></div></div>`;
    if (a) return `<div class="trade"><small>${esc(a.seller).toUpperCase()} IS AUCTIONING THIS</small><p class="note">Current bid ${usd(a.price)} · ends ${ends(a.ends_at)}</p><div class="lbtns"><button class="plain" id="trSeeAuc">See the auction</button></div></div>`;
    return '';
  }
  function bind(root, ctx) {
    const q = id => root.querySelector('#' + id);
    if (q('trUnlist')) q('trUnlist').onclick = async () => { await sb().rpc('cs_unlist_property', { p_city: CITY.id, p_building: ctx.key }); await loadListings(); ctx.redraw(); };
    if (q('trList')) q('trList').onsubmit = async e => {
      e.preventDefault();
      const price = +q('trList').querySelector('input').value;
      if (window.Net) await Net.claim(ctx.key, ctx.floors, ctx.name); // make sure the server knows it's yours
      const { error } = await sb().rpc('cs_list_property', { p_city: CITY.id, p_building: ctx.key, p_price: price });
      if (error) toast('Can\'t list', err(error)); else toast('Listed', `Other players can now buy it for ${usd(price)}.`);
      await loadListings(); ctx.redraw();
    };
    if (q('trAuc')) q('trAuc').onsubmit = async e => {
      e.preventDefault();
      const f = q('trAuc'), opening = +f.querySelector('input').value, hours = +f.querySelector('select').value;
      if (window.Net) await Net.claim(ctx.key, ctx.floors, ctx.name);
      const { error } = await sb().rpc('cs_start_auction', { p_city: CITY.id, p_building: ctx.key, p_opening: opening, p_hours: hours });
      if (error) toast('Can\'t start the auction', err(error)); else toast('Auction started', `Bidding opens at ${usd(opening)} and runs ${hours === 24 ? 'a day' : hours + ' hours'}.`);
      await loadListings(); await loadAuctions(); ctx.redraw();
    };
    if (q('trSeeAuc')) q('trSeeAuc').onclick = () => Property.open('auctions');
    if (q('trBuy')) q('trBuy').onclick = () => {
      const l = listings.get(ctx.key); if (!l) return;
      CSUI.story(`<small>BUY FROM ${esc(l.sellerName).toUpperCase()}</small><b>${esc(l.name || ctx.name)}</b><p>${usd(l.price)}${ctx.value ? `, against a market value of ${usd(ctx.value)}` : ''}. The money goes to ${esc(l.sellerName)}.</p>`,
        [['Buy it', () => buyListing(ctx)], ['Not now', () => {}]]);
    };
  }
  let busy = false; // one purchase or bid at a time: a double click can't send two
  const synced = async () => { const r = await Net.pushCloud(true); if (r.ok) return true; toast('Not connected', r.why === 'conflict' ? 'Your game was saved from another device or tab. Sort it out in Settings → Your save first.' : 'Your game couldn\'t reach the server just now. Try again in a moment.'); return false; };
  async function buyListing(ctx) {
    const l = listings.get(ctx.key); if (!l || busy) return;
    if (l.price > M.state.cash) { toast('Can\'t buy', `You need ${usd(l.price)} in cash`); return; }
    busy = true;
    try {
      if (!Net.legacy && !(await synced())) return;
      const { error } = await sb().rpc('cs_buy_listing', { p_city: CITY.id, p_building: ctx.key, p_price: l.price });
      if (error) { toast('Can\'t buy', err(error)); await loadListings(); ctx.redraw(); return; }
      if (Net.legacy) { // the old server didn't write the buyer's side of the ledger
        if (ctx.kind === 'p') await Land.buy(ctx.plot, l.price);
        else { const it = ctx.it; M.buyProperty(ctx.key, l.floors, { name: it.name, type: it.type, floorPrice: it.floorPrice, totalFloors: it.floors, x: it.x, z: it.z, city: CITY.id }, l.price); }
      } else await collect(); // the ledger moves the money and the building into your game, exactly once
      toast('Bought from ' + l.sellerName, `${l.name || ctx.name} for ${usd(l.price)}. The money went to ${l.sellerName}.`);
      await loadListings(); ctx.redraw();
    } finally { busy = false; }
  }

  // ---------- in the property screen: player listings (Deals) and player auctions (Auctions) ----------
  function ends(t) { const m = Math.max(0, Math.round((new Date(t) - Date.now()) / 60000)), h = Math.floor(m / 60); return m <= 0 ? 'now' : h >= 24 ? `in ${Math.floor(h / 24)}d ${h % 24}h` : h ? `in ${h}h ${m % 60}m` : `in ${m}m`; }
  const nameOf = b => b.startsWith('plot:') ? ((Land.plots.get(b.split(':').slice(1).join(',')) || {}).name || 'A plot') : ((Property.info(Property.gOf(b)) || {}).name || 'A building');
  function open(b) { $('props').hidden = true; if (b.startsWith('plot:')) Land.select('x:' + b.split(':').slice(1).join(':'), true); else Property.select(Property.gOf(b), true); }
  function listingsHTML() {
    if (!window.Net || !Net.configured) return '';
    const mine = on() ? Net.me.id : null, list = [...listings.entries()].filter(([, l]) => l.seller !== mine);
    return `<small class="ahd">FROM OTHER PLAYERS</small>${list.length ? list.map(([b, l]) => `<button class="bzrow trl" data-tr="${esc(b)}"><i></i><div><b>${esc(l.name || nameOf(b))}</b><span>by ${esc(l.sellerName)}${l.floors > 1 ? ` · ${l.floors} floors` : ''}</span></div><span>${usd(l.price)}</span></button>`).join('') : '<p class="note">No player is selling anything here right now. List one of yours from its card.</p>'}`;
  }
  function auctionsHTML() {
    if (!window.Net || !Net.configured) return '';
    return `<small class="ahd">PLAYER AUCTIONS · REAL TIME</small>${auctions.length ? auctions.map(a => `<div class="auc pa" data-pa="${a.id}"><div class="ab">
      <b>${esc(a.name || nameOf(a.building))}</b><span>by ${esc(a.seller)}${a.floors > 1 ? ` · ${a.floors} floors` : ''} · opened at ${usd(a.opening)}</span>
      <div class="arow"><div>Current bid<strong>${usd(a.price)}</strong></div><div>Leading<strong class="${a.leader_is_me ? 'up' : ''}">${a.leader_is_me ? 'You' : a.leader ? esc(a.leader) : 'No bids'}</strong></div><div>Ends<strong>${ends(a.ends_at)}</strong></div></div>
      ${a.seller_is_me ? '<small>Your auction</small>' : on() ? `<form class="abid" data-pf="${a.id}"><input type="number" min="0" step="${a.step}" placeholder="Your max (at least ${usd(a.leader_is_me ? a.price : a.bidders ? +a.price + +a.step : a.opening)})" value="${a.my_max || ''}" aria-label="Your maximum bid"><button class="btn pri">${a.my_max ? 'Change max' : 'Bid'}</button></form>${a.my_max ? `<small>Your max ${usd(a.my_max)}</small>` : ''}` : '<small>Sign in to bid</small>'}
      <button class="lnk" data-tr="${esc(a.building)}">See it on the map</button></div></div>`).join('') : '<p class="note">No player auctions in this city right now. Start one from the card of a building or plot you own.</p>'}`;
  }
  function bindTab(body) {
    body.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => open(b.dataset.tr));
    body.querySelectorAll('form[data-pf]').forEach(f => f.onsubmit = async e => {
      e.preventDefault();
      const max = +f.querySelector('input').value;
      if (busy) return;
      if (max > M.state.cash) { toast('Bid not placed', `You can bid up to your cash (${usd(M.state.cash)}): the winner pays when it ends.`); return; }
      busy = true;
      try {
        if (!Net.legacy && !(await synced())) return;
        const { error } = await sb().rpc('cs_bid', { p_auction: +f.dataset.pf, p_max: max });
        if (error) toast('Bid not placed', err(error)); else toast('Bid placed', 'The server bids for you up to your maximum. Nobody else can see it.');
        await loadAuctions(); redraw();
      } finally { busy = false; }
    });
  }

  // ---------- in the Business tab: the exchange ----------
  const GOODS = () => window.Biz ? Biz.GOODS : {};
  function exchangeHTML() {
    if (!window.Net || !Net.configured) return '';
    const G = GOODS(), g = G[exGood], asks = book.filter(o => o.side === 'sell').slice(0, 6), bids = book.filter(o => o.side === 'buy').sort((a, b) => b.price - a.price).slice(0, 6);
    const row = o => `<div class="obr ${o.side}"><span>${(o.qty - o.filled).toLocaleString('en-US')}</span><b>${usd(o.price, 2)}</b>${on() && o.player === Net.me.id ? '<i>you</i>' : ''}</div>`;
    return `<small class="ahd">PLAYER EXCHANGE · PLAYERS SET EVERY PRICE</small>
      <div class="chips">${Object.keys(G).map(k => `<button data-xg="${k}" class="${k === exGood ? 'on' : ''}">${G[k].icon} ${G[k].name}</button>`).join('')}</div>
      <div class="obook"><div><small>SELLING (ASKS)</small>${asks.map(row).join('') || '<p class="note">Nobody is selling.</p>'}</div><div><small>BUYING (BIDS)</small>${bids.map(row).join('') || '<p class="note">Nobody is buying.</p>'}</div></div>
      ${on() ? `<form class="askf xform" id="trOrd"><select aria-label="Buy or sell"><option value="sell">Sell</option><option value="buy">Buy</option></select><input type="number" min="1" step="1" value="10" aria-label="How many"> ${esc(g.unit)} at $<input type="number" min="0.01" step="0.01" value="${(window.Biz ? Biz.priceOf(exGood) : g.price).toFixed(2)}" aria-label="Price each"><button class="btn pri">Place order</button></form>
        <p class="note">You have ${(Biz.inv()[exGood] || 0).toLocaleString('en-US')} ${esc(g.unit)}. An order trades at once with any waiting order at your price or better; the rest waits. Selling holds the goods, buying holds the cash, until it trades or you cancel.</p>
        ${myOrders.length ? `<small class="ahd">YOUR OPEN ORDERS</small>${myOrders.map(o => `<div class="ares"><b>${o.side === 'buy' ? 'Buy' : 'Sell'} ${(o.qty - o.filled).toLocaleString('en-US')} ${esc(G[o.good].name.toLowerCase())} at ${usd(o.price, 2)}</b><button class="lnk" data-xc="${o.id}">cancel</button></div>`).join('')}` : ''}`
      : '<p class="note">Sign in (Online → Account) to trade goods with other players.</p>'}`;
  }
  function bindExchange(body) {
    body.querySelectorAll('[data-xg]').forEach(b => b.onclick = async () => { exGood = b.dataset.xg; await loadBook(); redraw(); });
    if ($('trOrd')) $('trOrd').onsubmit = async e => {
      e.preventDefault();
      const f = $('trOrd'), side = f.querySelector('select').value, [qi, pi] = f.querySelectorAll('input'), qty = Math.floor(+qi.value), price = Math.round(+pi.value * 100) / 100, inv = Biz.inv();
      if (!(qty > 0) || !(price > 0)) { toast('Can\'t place the order', 'Set how many and a price'); return; }
      if (side === 'sell' && qty > (inv[exGood] || 0)) { toast('Can\'t place the order', `You have ${inv[exGood] || 0}`); return; }
      if (side === 'buy' && qty * price > M.state.cash) { toast('Can\'t place the order', `You need ${usd(qty * price, 2)} in cash`); return; }
      if (side === 'sell') inv[exGood] -= qty; else M.state.cash = +(M.state.cash - qty * price).toFixed(2); // held for the order
      M.save();
      const { data, error } = await sb().rpc('cs_place_order', { p_side: side, p_good: exGood, p_qty: qty, p_price: price });
      if (error) { if (side === 'sell') inv[exGood] += qty; else M.state.cash = +(M.state.cash + qty * price).toFixed(2); M.save(); toast('Can\'t place the order', err(error)); return; }
      const r = (data || [])[0] || { out_filled: 0, out_total: 0 }, n = r.out_filled, total = +r.out_total;
      if (side === 'sell' && n) M.state.cash = +(M.state.cash + total).toFixed(2);
      if (side === 'buy' && n) { inv[exGood] += n; M.state.cash = +(M.state.cash + (n * price - total)).toFixed(2); } // you paid the sellers' prices, not your limit
      M.save(); M.emit('biz', { kind: 'traded' });
      toast(n ? 'Traded' : 'Order placed', n ? `${side === 'buy' ? 'Bought' : 'Sold'} ${n} for ${usd(total, 2)}${n < qty ? `; ${qty - n} wait in the book` : ''}.` : 'It waits in the book until someone takes it.');
      await loadBook(); redraw();
    };
    body.querySelectorAll('[data-xc]').forEach(b => b.onclick = async () => {
      const { data, error } = await sb().rpc('cs_cancel_order', { p_id: +b.dataset.xc });
      const r = (data || [])[0];
      if (error || !r) { toast('Can\'t cancel', error ? err(error) : 'It already traded'); }
      else { if (r.out_side === 'sell') Biz.inv()[r.out_good] += r.out_left; else M.state.cash = +(M.state.cash + r.out_left * r.out_price).toFixed(2); M.save(); toast('Order cancelled', 'What it was holding is back.'); }
      await loadBook(); redraw();
    });
  }

  // ---------- staying up to date ----------
  let chan = null, inboxChan = null;
  function subscribe() {
    if (chan || !window.Net || !Net.sb) return;
    chan = sb().channel('cs-trade-' + CITY.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cs_listings', filter: 'city=eq.' + CITY.id }, () => loadListings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cs_pauctions', filter: 'city=eq.' + CITY.id }, async () => { await loadAuctions(); redraw(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cs_orders' }, async p => { if ((p.new || p.old || {}).good === exGood && Property.tab === 'business') { await loadBook(); redraw(); } })
      .subscribe();
  }
  function watchInbox() {
    if (inboxChan || !on()) return;
    inboxChan = sb().channel('cs-inbox-' + Net.me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cs_inbox', filter: 'player=eq.' + Net.me.id }, () => collect()).subscribe();
  }
  const boot = setInterval(async () => {
    if (!window.Net || !window.CS || !$('load').hidden || !window.Land || !Land.plots || Net.status === 'connecting') return; // after the sign-in is restored: one connection, not a dropped first try
    clearInterval(boot);
    if (!Net.configured) return;
    applyHere(); subscribe(); await loadListings(); await loadAuctions(); await loadBook(); redraw();
  }, 500);
  if (window.Net) Net.on(async t => { if (t === 'me' && on()) { watchInbox(); await collect(); await loadAuctions(); await loadBook(); redraw(); } });
  setInterval(async () => { // ended auctions get settled by whichever game is online; keep the numbers fresh
    if (!on()) return;
    const { data } = await sb().rpc('cs_settle_due');
    await loadAuctions();
    if (data || Property.tab === 'auctions') redraw();
  }, 30000);

  return { collect, block, bind, listingsHTML, auctionsHTML, bindTab, exchangeHTML, bindExchange, listing: k => listings.get(k), auctionOf: k => auctions.find(a => a.building === k), reload: async () => { await loadListings(); await loadAuctions(); await loadBook(); } };
})();
