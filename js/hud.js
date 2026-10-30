// Capital Street menus and screen (Goal 22): one shared online world, a simpler screen and a clean map.
// Play takes you online: the first time you pick a name and a colour and you're in, as a guest (an email can be added
// later to keep the account). Only if the server can't be reached can you play offline for now.
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
  function play() {
    const st = window.Net ? Net.status : 'off';
    if (!window.Net || !Net.configured || st === 'online') { go(); return; }
    why = ''; join.hidden = false; drawJoin();
  }
  function go() { join.hidden = true; CS.startGame(); }
  function drawJoin() {
    if (join.hidden) return;
    const st = Net.status;
    if (st === 'online') { go(); return; }
    let body;
    if (st === 'connecting') body = '<div class="jspin"></div><p>Connecting to New York…</p>';
    else if (st === 'error' || st === 'off') {
      body = `<p>We can't reach the game server right now. Check your connection and try again.</p>
        <div class="jrow"><button class="btn pri" id="jRetry">TRY AGAIN</button><button class="btn" id="jOff">PLAY OFFLINE FOR NOW</button></div>`;
    } else {
      body = `<p>Everyone plays in the same city. Pick the name other players will see.</p>
        <form id="jForm"><input id="jName" maxlength="20" placeholder="Your name" aria-label="Your name" autocomplete="nickname" value="${esc(name)}" required>
        <div class="jcols">${COLORS.map(c => `<button type="button" data-c="${c}" class="${c === color ? 'on' : ''}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
        ${why ? `<p class="jwhy">${esc(why)}</p>` : ''}
        <button class="btn pri big" ${busy ? 'disabled' : ''}>${busy ? 'JOINING…' : 'PLAY'}</button></form>
        <button class="lnk" id="jAcc">I already have an account</button>`;
    }
    join.innerHTML = `<div class="jbox"><button class="jx" id="jX" aria-label="Close">✕</button><div class="jlogo">🏙️</div><b>Join New York</b>${body}
      <small>By playing you agree to the <a href="terms.html" target="_blank" rel="noopener">Terms</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</small></div>`;
    $('jX').onclick = () => { join.hidden = true; };
    if ($('jRetry')) $('jRetry').onclick = () => location.reload();
    if ($('jOff')) $('jOff').onclick = go;
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
  $('mTut').onclick = () => { if (window.Tutorial) Tutorial.reset(); play(); };

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

  return { play, get browsing() { return browsing; } };
})();
