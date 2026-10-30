// Capital Street menus and screen (Goal 22): one shared online world, a simpler screen and a clean map.
// Play takes you online: the first time you pick a name and a colour and you're in, as a guest (an email can be added
// later to keep the account). There is no offline game (Goal 25): if the server can't be reached, you can try again.
// In the game, the map only shows your apartment and your own buildings and land; buildings for sale, deals, auctions,
// other players' buildings, plot outlines and street names appear while you browse property, or up close.
'use strict';
window.HUD = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const COLORS = ['#4c8dff', '#f5b83d', '#e05d5d', '#a970ff', '#2fd0c0', '#ff8fb1', '#9be15d', '#ff9f43'];
  const shown = id => $(id) && !$(id).hidden;

  // ---------- browsing property: everything for sale lights up ----------
  let browsing = false;
  const forSale = [lin(0xffd21f), lin(0xa35cff), lin(0x4c8dff)]; // deals, auctions, other players (js/auctions.js, js/property.js)
  frameHooks.push((dt, dist) => {
    browsing = shown('props') || shown('listing');
    const menu = !$('title').hidden;
    $('labels').style.visibility = menu ? 'hidden' : '';
    for (const l of labels) {
      if (l.max0 == null) l.max0 = l.max;
      const c = l.el.className;
      let max = l.max0;
      if (!browsing) {
        if (/\b(deal|auctag|theirs)\b/.test(c)) max = Math.min(max, 650);
        else if (/\b(district|water)\b/.test(c)) max = -1;
        else if (/\bplace\b/.test(c) && !/\bmine\b/.test(c)) max = Math.min(max, 1800);
      }
      l.max = max;
    }
    for (const o of scene.children) {
      if (o.renderOrder !== 11 || !o.isMesh || !o.material || !o.material.color) continue;
      if (forSale.some(c => c.equals(o.material.color))) o.visible = browsing || dist < 1200;
    }
  });

  // ---------- Play: online first ----------
  const join = document.createElement('div');
  join.id = 'join'; join.className = 'ov2'; join.hidden = true;
  document.body.appendChild(join);
  let color = COLORS[Math.floor(Math.random() * COLORS.length)], busy = false, why = '', name = '';
  try { name = localStorage.getItem('cs-name') || ''; } catch (e) { /* storage blocked */ }
  let wantPlay = false; // you tapped Play and are waiting to get online
  let after = null; // what to open once you're in, when you tapped a bar button or an Earn tile on the menu
  function play(then) {
    after = typeof then === 'function' && !(window.Tutorial && Tutorial.want()) ? then : null;
    const st = window.Net ? Net.status : 'off';
    if (!window.Net || !Net.configured || st === 'online') { go(); return; }
    why = ''; wantPlay = true; join.hidden = false; drawJoin();
  }
  function go() {
    join.hidden = true; wantPlay = false; CS.startGame();
    if (!after) return;
    const f = after; after = null;
    const t = setInterval(() => { if ($('hud').hidden || !window.Property || !Property.loaded()) return; clearInterval(t); setTimeout(f, 300); }, 200);
  }
  function drawJoin() {
    if (join.hidden) return;
    const st = Net.status;
    if (st === 'online') { go(); return; }
    let body;
    if (st === 'connecting') body = '<div class="jspin"></div><p>Connecting to New York…</p>';
    else if (st === 'error' || st === 'off') {
      body = `<p>Capital Street is online only, and we can't reach the game server right now. Check your connection and try again.</p>
        <div class="jrow"><button class="btn pri" id="jRetry">TRY AGAIN</button></div>`;
    } else {
      body = `<p>Everyone plays in the same city. Pick the name other players will see.</p>
        <form id="jForm"><input id="jName" maxlength="20" placeholder="Your name" aria-label="Your name" autocomplete="nickname" value="${esc(name)}" required>
        <div class="jcols">${COLORS.map(c => `<button type="button" data-c="${c}" class="${c === color ? 'on' : ''}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
        ${why ? `<p class="jwhy">${esc(why)}</p>` : ''}
        <button class="btn pri big" ${busy ? 'disabled' : ''}>${busy ? 'JOINING…' : 'PLAY'}</button></form>
        <button class="lnk" id="jAcc">I already have an account</button>`;
    }
    join.innerHTML = `<div class="jbox"><button class="jx" id="jX" aria-label="Close">${IC('close')}</button><div class="jlogo">${IC('skyline')}</div><b>Join New York</b>${body}
      <small>By playing you agree to the <a href="terms.html" target="_blank" rel="noopener">Terms</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</small></div>`;
    $('jX').onclick = () => { join.hidden = true; after = null; wantPlay = false; };
    if ($('jRetry')) $('jRetry').onclick = () => location.reload();
    if ($('jAcc')) $('jAcc').onclick = () => { join.hidden = true; Net.open('account'); };
    join.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { color = b.dataset.c; join.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
    if ($('jForm')) {
      if (!busy) setTimeout(() => $('jName') && $('jName').focus(), 50);
      $('jForm').onsubmit = async e => {
        e.preventDefault();
        if (busy) return;
        name = $('jName').value.trim();
        try { localStorage.setItem('cs-name', name); } catch (er) { /* fine */ }
        busy = true; why = ''; drawJoin();
        try {
          if (Net.status === 'signed-out') {
            const r = await Net.guest();
            if (!r.ok) { why = r.why; return; }
            for (let i = 0; i < 50 && Net.status !== 'no-player' && Net.status !== 'online'; i++) await new Promise(res => setTimeout(res, 100));
          }
          if (Net.status === 'no-player') { const r = await Net.createPlayer(name, color); if (!r.ok) why = r.why; }
        } finally { busy = false; drawJoin(); }
      };
    }
  }
  if (window.Net) Net.on(t => { if (t === 'me' && !join.hidden && !busy) drawJoin(); });
  let lastSt = ''; // and whenever the status changes (the 'me' news can come before the status does)
  setInterval(() => {
    if (wantPlay && window.Net && Net.status === 'online' && !$('title').hidden) { go(); return; } // a safety net: tapped Play, now online
    if (!window.Net || join.hidden || busy || Net.status === lastSt) return; lastSt = Net.status; drawJoin();
  }, 300);
  $('mTut').onclick = () => { if (window.Tutorial) Tutorial.reset(); play(); };

  // ---------- one game bar, in the game and on the menu (Goal 24) ----------
  // The menu shows the same bar as the game: each button takes you in and straight there.
  document.querySelectorAll('#mdock [data-go]').forEach(b => b.onclick = () => {
    const id = b.dataset.go;
    if (id === 'mWorld') { $('mWorld').click(); return; }
    play(id === 'bHome' ? null : () => { if (id === 'bOffice' ? !Office.active() : id === 'bExchange' ? $('ex').hidden : id === 'bBank' ? $('bank').hidden : $('props').hidden) $(id).click(); });
  });

  // ---------- Jobs (Goal 25): every way to make money, each paying about the same for the money and time you put in ----------
  const S = () => M.state, usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const owned = () => Object.keys(S().props || {}).length;
  const ex = () => { if ($('ex').hidden) $('bExchange').click(); };
  const JOBS = [
    ['chart', 'Trader', 'Buy shares cheap, sell them for more', 'When you sell', ex, () => { const n = Object.keys(S().positions).length; return n ? n + ' compan' + (n === 1 ? 'y' : 'ies') + ' owned' : ''; }],
    ['building', 'Landlord', 'Buy buildings: tenants pay rent', 'Every night', () => Property.open('sale'), () => owned() ? owned() + ' building' + (owned() === 1 ? '' : 's') : ''],
    ['crane', 'Developer', 'Knock down a building you own and build a new one', 'More rent, worth more', () => { Property.open('mine'); toast('Developer', 'Pick one of your buildings, then tap Rebuild.'); }],
    ['gavel', 'Auctioneer', 'Auction your buildings to other players', 'When it sells', () => { Property.open('mine'); toast('Auctioneer', 'Pick one of your buildings, then put it up for auction.'); }],
    ['tag', 'Bargain hunter', 'Grab deals and city auctions below value', 'When you resell', () => Property.open('deals')],
    ['farm', 'Farmer', 'Buy land and grow produce', 'Every day you collect', () => Property.open('land')],
    ['mine', 'Miner', 'Dig ore and pump oil on your land', 'Every day you collect', () => Property.open('land')],
    ['shop', 'Shopkeeper', 'Run shops and factories that turn goods into more money', 'Every night', () => Property.open('business')],
    ['ship', 'Shipper', 'Ship your goods to cities that pay more', 'When it arrives', () => Property.open('business')],
    ['trade', 'Merchant', 'Buy and sell goods with other players', 'When you sell', () => Property.open('business')],
    ['hire', 'Boss', 'Hire staff in your office who earn for you', 'Every day', () => { if (!Office.active()) Office.enter(); }],
    ['company', 'Tycoon', 'Start your own company and sell its shares', 'When you float it', () => Property.open('business')]
  ];
  const earn = document.createElement('div');
  earn.id = 'earn'; earn.className = 'ov2'; earn.hidden = true;
  document.body.appendChild(earn);
  function openEarn() {
    const inGame = $('title').hidden;
    earn.innerHTML = `<div class="ebox"><button id="earnX" class="ex" aria-label="Close">${IC('close')}</button><b>Jobs</b><p>You have ${usd(S().cash)}. Every job pays about the same for the money and time you put in: pick the ones you enjoy.</p>
      <div class="egrid">${JOBS.map(([ic, n, d, pay, , st], i) => { const x = st && st(); return `<button data-w="${i}"><i>${IC(ic)}</i><span><b>${n}</b><small>${d}</small><em>${x ? esc(x) : 'Pays: ' + pay.toLowerCase()}</em></span></button>`; }).join('')}</div></div>`;
    earn.hidden = false;
    $('earnX').onclick = () => { earn.hidden = true; };
    earn.onclick = e => { if (e.target === earn) earn.hidden = true; };
    earn.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
      const go = JOBS[+b.dataset.w][4];
      earn.hidden = true;
      if (inGame) { if ($('ex').hidden === false && go !== ex) $('ex').hidden = true; go(); } else play(go);
    });
  }
  $('earnG').onclick = openEarn; $('earnM').onclick = openEarn;
  if ($('cashPlus')) $('cashPlus').onclick = openEarn;

  // ---------- the lobby's cards (Goal 26): today in the city, one tap to go there ----------
  const CARDS = [
    ['tag', () => window.Auctions ? Auctions.deals().size : 0, 'Deals', () => Property.open('deals')],
    ['gavel', () => window.Auctions && Auctions.live ? Auctions.live().length : 0, 'Auctions', () => Property.open('auctions')],
    ['key', () => Object.keys(S().props || {}).length, 'Yours', () => Property.open('mine')]
  ];
  let cardsSig = '';
  setInterval(() => {
    if ($('title').hidden || !$('lcards')) return;
    let vals;
    try { vals = CARDS.map(c => c[1]()); } catch (e) { return; } // the city isn't loaded yet
    const sig = vals.join(',');
    if (sig === cardsSig) return;
    cardsSig = sig;
    $('lcards').innerHTML = CARDS.map(([ic, , label], i) => `<button data-lc="${i}">${IC(ic)}<b>${vals[i]}</b><small>${label}</small></button>`).join('');
    $('lcards').querySelectorAll('[data-lc]').forEach(b => b.onclick = () => play(CARDS[+b.dataset.lc][3]));
  }, 700);

  // ---------- the menu's player card ----------
  setInterval(() => {
    if ($('title').hidden) return;
    const n = window.Net, st = n ? n.status : 'off', me = n && n.me;
    $('pName').textContent = me ? me.name : 'New player';
    $('pAv').style.background = me ? me.color : '#9aa6b8';
    $('pAv').textContent = me ? me.name[0].toUpperCase() : '?';
    $('onlineD').textContent = st === 'online' ? `● ${n.online.length} online now` : st === 'connecting' ? 'Connecting…' : st === 'off' || st === 'error' ? 'Offline' : 'Tap Play to join';
    $('mOnline').classList.toggle('on', st === 'online');
  }, 400);

  // ---------- in the game: only what you need ----------
  setInterval(() => {
    if ($('hud').hidden) return;
    const s = M.state, left = s.rentDue - s.time;
    $('rentBox').classList.toggle('soon', left < 1440 * 1.5); // rent shows up when it's due within a day and a half
    document.body.classList.toggle('wide', shown('ex')); // the exchange is wide: the dock steps aside on PCs
  }, 500);

  return { play, earn: openEarn, get browsing() { return browsing; } };
})();
