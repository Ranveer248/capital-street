// Capital Street levels (Goal 12): XP for what you do, a level star with an XP bar, and a level-up screen.
// XP to the next level is 40 × level^1.8, like the city builders. Levels give a title and a small cash bonus that
// grows slowly, so they reward playing without flooding the economy. Kept in the save (and the cloud save) as state.lvl.
'use strict';
window.Levels = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const TITLES = ['Student', 'Intern', 'Day Trader', 'Trader', 'Senior Trader', 'Broker', 'Investor', 'Landlord', 'Fund Manager', 'Banker', 'Tycoon', 'Mogul', 'Wall Street Legend'];
  const need = n => Math.round(40 * Math.pow(n, 1.8));
  const title = n => TITLES[Math.min(TITLES.length - 1, n - 1)];
  const bonus = n => Math.round(25 * Math.pow(n, 1.6) / 5) * 5;
  const L = () => { const S = M.state; if (!S.lvl || typeof S.lvl.n !== 'number') S.lvl = { n: 1, xp: 0, total: 0 }; return S.lvl; };
  const star = id => `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd21f"/><stop offset="1" stop-color="#e89b00"/></linearGradient></defs><path d="M50 5 63 35 96 37 70 58 79 91 50 73 21 91 30 58 4 37 37 35Z" fill="url(#${id})" stroke="#0a0f2e" stroke-width="7" stroke-linejoin="round"/></svg>`;

  // ---------- the badge, top left ----------
  const badge = document.createElement('button');
  badge.id = 'lvl'; badge.setAttribute('aria-label', 'Your level');
  badge.innerHTML = `<span class="star">${star('gLvl')}<b id="lvlN">1</b></span><span class="bar"><small id="lvlT">Student</small><span class="track"><i id="lvlF"></i><span id="lvlX">0 / 40 XP</span></span></span>`;
  $('hud').appendChild(badge);
  function draw() {
    const l = L();
    $('lvlN').textContent = l.n; $('lvlT').textContent = title(l.n);
    $('lvlF').style.width = Math.min(100, l.xp / need(l.n) * 100) + '%';
    $('lvlX').textContent = `${Math.floor(l.xp)} / ${need(l.n)} XP`;
  }
  badge.onclick = () => { const l = L(); window.toast && toast(`Level ${l.n} · ${title(l.n)}`, `${need(l.n) - Math.floor(l.xp)} XP to level ${l.n + 1} (${title(l.n + 1)}). Trade, pay the rent, buy property, hire staff and open new cities.`); };

  // ---------- earning XP ----------
  function floater(amount) {
    const r = badge.getBoundingClientRect(), f = document.createElement('div');
    f.className = 'xpf'; f.textContent = `+${amount} XP`;
    f.style.left = (r.left + r.width * 0.55) + 'px'; f.style.top = (r.bottom + 2) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1400);
  }
  const queue = []; // levels gained while the screen is busy, shown one after another
  function give(amount) {
    amount = Math.round(amount);
    if (!(amount > 0) || !M.state.started) return;
    const l = L(); l.xp += amount; l.total += amount;
    while (l.xp >= need(l.n)) { l.xp -= need(l.n); l.n++; queue.push(l.n); }
    if (!$('hud').hidden) floater(amount);
    draw(); badge.classList.remove('bounce'); void badge.offsetWidth; badge.classList.add('bounce');
    M.save(); showNext();
  }
  M.on((type, d) => {
    d = d || {};
    if (type === 'fill') give(5 + Math.min(45, d.total / 400));
    else if (type === 'property' && d.kind === 'bought') give(Math.min(250, 40 + d.cost / 2500));
    else if (type === 'property' && d.kind === 'income') give(10);
    else if (type === 'loan' && d.kind === 'repaid') give(d.onTime ? 80 : 30);
    else if (type === 'loan' && d.kind === 'collected') give(40);
    else if (type === 'rent' && d.paid) give(60);
    else if (type === 'city') give(400);
    else if (type === 'land' && d.kind === 'bought') give(Math.min(150, 30 + d.cost / 2000));
    else if (type === 'auction' && d.kind === 'won') give(120);
    else if (type === 'office') give(15);
    else if (type === 'close') give(10); // you made it through another trading day
    else if (type === 'reset') draw();
  });

  // ---------- level up ----------
  const up = document.createElement('div');
  up.id = 'lvlUp'; up.hidden = true;
  up.innerHTML = `<div class="rays"></div><div class="lucard" role="dialog" aria-labelledby="luH"><div class="bigstar">${star('gLvlBig')}<b id="luN">2</b></div><h2 id="luH">LEVEL UP!</h2><p id="luT"></p><div class="rew" id="luR"></div><button class="btn pri" id="luGo">COLLECT</button></div>`;
  document.body.appendChild(up);
  let showing = 0;
  function showNext() {
    if (showing || !queue.length || $('hud').hidden || (window.Office && Office.active && Office.active())) return;
    const n = queue.shift(); showing = n;
    $('luN').textContent = n; $('luT').textContent = `You are now ${/^[AEIOU]/.test(title(n)) ? 'an' : 'a'} ${title(n)}`;
    $('luR').innerHTML = `<div style="--rc:var(--c-green);--rc2:var(--c-green2)"><i>$</i><b>+${usd(bonus(n))}</b><small>Level bonus</small></div>
      <div style="--rc:var(--c-gold);--rc2:var(--c-gold2)"><i>★</i><b>${title(n)}</b><small>New title</small></div>
      <div style="--rc:var(--c-blue);--rc2:var(--c-blue2)"><i>↑</i><b>${need(n)} XP</b><small>To level ${n + 1}</small></div>`;
    up.hidden = false; $('luGo').focus();
  }
  $('luGo').onclick = () => {
    const n = showing; if (!n) return;
    M.state.cash = +(M.state.cash + bonus(n)).toFixed(2); M.save();
    up.hidden = true; showing = 0;
    setTimeout(showNext, 400);
  };
  document.addEventListener('keydown', e => { if (!up.hidden && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); $('luGo').click(); } }, true);
  setInterval(showNext, 1500); // a level gained in the menu or the office waits until you're back in the city

  const ready = setInterval(() => { if (window.CS && $('load').hidden) { clearInterval(ready); draw(); } }, 200);
  draw();
  return { give, need, title, get level() { return L().n; } };
})();
