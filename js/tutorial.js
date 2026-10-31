// Capital Street tutorial (Goal 22, rebuilt in Goal 31): Penny the piggy bank gives a new player one short, practical
// mission: buy a share, sell it, collect a reward, then pick what to aim for next. Time stands still while she talks
// and runs while you act. Property, jobs, land, businesses, auctions and the office then open up one by one as you
// play, so there's never everything at once. It's all kept in the save (state.onboard, state.goal), so it follows your
// account; players from before Goal 31 keep everything open. "How to play" in the menu runs the mission again.
'use strict';
window.Tutorial = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const REWARD = 500;
  const S = () => M.state;
  // a save from before Goal 31 that has been played counts as done, with everything open
  const ob = () => { const s = S(); if (!s.onboard) s.onboard = s.started ? { done: true, legacy: true } : { done: false }; return s.onboard; };
  const lvl = () => window.Levels ? Levels.level : 1;

  // ---------- what opens when ----------
  const LOCKS = {
    property: () => !ob().done && 'Finish your first trade with Penny and property opens up.',
    jobs: () => !ob().done && 'Finish your first trade with Penny and the jobs open up.',
    land: () => lvl() < 3 && 'Land and businesses open at level 3.',
    business: () => lvl() < 3 && 'Businesses open at level 3.',
    auctions: () => lvl() < 3 && 'Auctions open at level 3.',
    office: () => lvl() < 5 && 'Your own office opens at level 5, with skyscraper floors.',
  };
  function lock(f) { if (ob().legacy) return ''; const r = LOCKS[f] && LOCKS[f](); return r || ''; }
  const BTN = { bProps: 'property', earnG: 'jobs', earnM: 'jobs', cashPlus: 'jobs', bOffice: 'office' };
  for (const [id, f] of Object.entries(BTN)) {
    const b = $(id); if (!b) continue;
    b.addEventListener('click', e => { const why = lock(f); if (why) { e.stopImmediatePropagation(); e.preventDefault(); toast('Not yet', why); } }, true);
  }
  document.querySelectorAll('#mdock [data-go="bProps"]').forEach(b => b.addEventListener('click', e => { const why = M.state.started && lock('property'); if (why) { e.stopImmediatePropagation(); toast('Not yet', why); } }, true));
  setInterval(() => { for (const [id, f] of Object.entries(BTN)) { const b = $(id); if (b) b.classList.toggle('locked', !!lock(f)); } }, 1000);

  // ---------- goals to pick from after the mission ----------
  const GOALS = {
    landlord: { title: 'Buy your first building', icon: 'key', why: 'Tenants pay rent every night', prog: () => [Math.min(1, Object.keys(S().props).length), 1], go: () => window.Property && Property.open('sale') },
    trader: { title: 'Grow your money to $5,000', icon: 'chart', why: 'Buy low, sell high on the Exchange', prog: () => [Math.min(5000, Math.round(M.netWorth())), 5000], go: () => window.CSUI && CSUI.openEx() },
    banker: { title: 'Take a starter loan and repay it', icon: 'bank', why: 'A good credit score opens bigger loans', prog: () => [Math.min(1, S().loansRepaid || 0), 1], go: () => $('bBank').click() },
    rent: { title: 'Pay your first rent', icon: 'building', why: `${usd(M.RENT)} at the end of day 3`, prog: () => [Math.min(1, S().rentPaid || 0), 1], go: () => toast('Rent', `It's paid by itself at the end of day 3, if you have ${usd(M.RENT)} in cash.`) },
    level3: { title: 'Reach level 3', icon: 'star', why: 'Land, businesses and auctions open', prog: () => [Math.min(3, lvl()), 3], go: () => $('earnG').click() },
  };
  const NEXT = { landlord: 'level3', trader: 'landlord', banker: 'landlord', rent: 'level3' };
  function checkGoal() {
    const g = S().goal; if (!g || g.done || !GOALS[g.id]) return;
    const [have, need] = GOALS[g.id].prog(); if (have < need) return;
    g.done = true; const cash = 400;
    S().cash = +(S().cash + cash).toFixed(2); M.save();
    if (window.Levels) Levels.give(60);
    const nx = NEXT[g.id];
    window.CSUI && CSUI.story(`<small>GOAL DONE</small><b>${GOALS[g.id].title}</b><p>Nicely done. Here's ${usd(cash)} towards whatever comes next.</p>`,
      [nx ? [`Next: ${GOALS[nx].title}`, () => setGoal(nx)] : ['Thanks', () => {}], ['Pick another goal', () => choose()]]);
  }
  function setGoal(id) { S().goal = { id, at: S().time, done: false }; M.save(); drawObj(); }
  M.on(t => { if (t !== 'tick') checkGoal(); });
  setInterval(checkGoal, 3000);

  // ---------- Penny ----------
  const el = document.createElement('div');
  el.id = 'tut'; el.hidden = true;
  el.innerHTML = '<div class="thole" id="tHole"></div><div class="tbub" id="tBub"><div class="tpig">' + IC('penny') + '</div><div class="ttxt"><small id="tStep"></small><p id="tText"></p><div class="tbtns"><button class="lnk" id="tSkip">Skip</button><button class="btn pri" id="tNext">Next</button></div></div></div>';
  document.body.appendChild(el);
  const did = { buy: false, sell: false };
  M.on((t, d) => { if (t === 'fill' && d) did[d.side] = true; });
  const exOpen = () => $('ex') && !$('ex').hidden;
  // each step: what Penny says, what to light up, and either Next (time stands still) or something to do (time runs)
  const steps = [
    { say: () => `Hi! I'm <b>Penny</b>. This is your studio: a fifth-floor walk-up at the <b>South Street Seaport</b>, a short walk from Wall Street. Rent of ${usd(M.RENT)} is due in 3 days, and you have ${usd(S().cash)}.`, next: 'Hi Penny!' },
    { at: 'money', say: () => `That's your <b>cash</b>, and your <b>rent</b> with how long you've got. Let's make some money with one quick trade.`, next: "Let's trade" },
    { at: 'bExchange', say: () => 'Open the <b>Exchange</b>.', wait: () => exOpen(), tap: true },
    { at: 'ticket', say: () => `Pick any company, choose a small amount like <b>$100</b>, then press <b>BUY</b>.${M.isOpen() ? '' : ' <small>(The market opens at 9:30.)</small>'}`, wait: () => did.buy || !exOpen(), tap: true, back: () => !exOpen() && !did.buy ? 2 : null },
    { say: () => 'You own shares! Their price moves every minute. Now <b>sell</b> it, and you\'ve done a whole trade. Win or lose a little, that\'s how it works.', next: 'Sell it' },
    { at: 'ticket', say: () => `Press <b>SELL</b> to sell what you bought. ${exOpen() ? '' : 'Open the <b>Exchange</b> first.'}`, wait: () => did.sell, tap: true, before: () => { if (!exOpen() && window.CSUI) CSUI.openEx(null, 'companies'); } },
    { say: () => `Your first trade, done! Here's a reward for it.`, next: () => `Collect ${usd(REWARD)}`, act: () => reward() },
    { say: () => 'What do you want to aim for next? You can change it any time from the goal under your cash.', choose: true },
  ];
  let i = -1, holding = false;
  function hold(on) { if (on === holding || !window.CSUI) return; holding = on; CSUI.setPaused(on); } // time stands still while Penny talks
  function show(n) {
    i = n;
    const s = steps[i];
    if (!s) { stop(); return; }
    if (s.before) s.before();
    if (s.choose) { el.hidden = true; hold(true); choose(true); return; }
    $('tStep').textContent = `FIRST TRADE · ${Math.min(i + 1, 7)} / 7`;
    $('tText').innerHTML = s.say();
    $('tNext').textContent = (typeof s.next === 'function' ? s.next() : s.next) || 'Next';
    $('tNext').hidden = !!s.wait;
    el.classList.toggle('tap', !!s.tap);
    el.hidden = false;
    hold(!s.wait);
    place(); drawObj();
  }
  function stop(skip) {
    i = -1; el.hidden = true; hold(false);
    const o = ob(); if (!o.done) { o.done = true; o.skipped = !!skip; M.save(); }
    drawObj();
  }
  function reward() {
    const o = ob(); if (o.reward) return; // once per game, even if the mission runs again
    o.reward = true; S().cash = +(S().cash + REWARD).toFixed(2); M.save();
    if (window.Levels) Levels.give(40);
    toast('Reward collected', `+${usd(REWARD)} for your first trade`);
  }
  $('tNext').onclick = () => { const s = steps[i]; if (s && s.act) s.act(); show(i + 1); };
  $('tSkip').onclick = () => stop(true);

  function choose(first) {
    const ids = ['landlord', 'trader', 'banker'].concat(S().rentPaid ? [] : ['rent']);
    window.CSUI && CSUI.story(`<small>${first ? 'YOUR FIRST GOAL' : 'PICK A GOAL'}</small><b>What next?</b><p>${first ? 'Property and the jobs are open now. Land, businesses and auctions open at level 3, your own office at level 5.' : 'Pick one. The goal under your cash shows how far you are.'}</p>`,
      ids.map(id => [`${GOALS[id].title}<small>${GOALS[id].why}</small>`, () => { setGoal(id); if (first) stop(); GOALS[id].go(); }]));
    if (first) { const o = ob(); o.done = true; M.save(); }
  }

  // the light follows its target around the screen; the bubble sits above or below it
  function place() {
    if (i < 0) return;
    const s = steps[i], t = s.at && $(s.at), hole = $('tHole'), bub = $('tBub');
    const r = t && t.getBoundingClientRect(), vis = r && r.width > 0 && r.height > 0;
    if (vis) {
      const pad = 8;
      Object.assign(hole.style, { display: 'block', left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      const below = r.top + r.height / 2 < innerHeight / 2, bh = bub.offsetHeight, bw = bub.offsetWidth;
      const left = Math.min(innerWidth - bw - 12, Math.max(12, r.left + r.width / 2 - bw / 2));
      bub.style.left = left + 'px';
      let top = below ? Math.min(innerHeight - bh - 12, r.bottom + pad + 14) : Math.max(12, r.top - pad - 14 - bh);
      if (r.height > innerHeight * 0.5) top = innerHeight - bh - 12; // a big panel: the bubble goes along the bottom
      bub.style.top = top + 'px';
    } else {
      hole.style.display = 'none';
      bub.style.left = (innerWidth - bub.offsetWidth) / 2 + 'px';
      bub.style.top = (s.tap ? innerHeight - bub.offsetHeight - 12 : (innerHeight - bub.offsetHeight) / 2) + 'px'; // while you act, out of the way at the bottom
    }
    el.classList.toggle('dim', !vis && !s.tap);
  }
  (function loop() {
    if (i >= 0) {
      const s = steps[i];
      if (s.back && s.back() != null) show(s.back());
      else if (s.wait && s.wait()) show(i + 1); else place();
    }
    requestAnimationFrame(loop);
  })();
  setInterval(() => { if (i >= 0 && steps[i] && steps[i].wait) $('tText').innerHTML = steps[i].say(); }, 1000); // keeps "the market opens at 9:30" up to date

  // ---------- the objective under your cash: the mission step, your goal, or today's tasks ----------
  const obj = document.createElement('button');
  obj.id = 'objective'; obj.setAttribute('aria-label', 'Current objective');
  const bar = $('bar'); if (bar) bar.appendChild(obj); // in the top bar, under the day and the clock
  function drawObj() {
    if (!S().started) { obj.hidden = true; return; }
    const g = S().goal, G = g && !g.done && GOALS[g.id];
    let txt, sub = '';
    if (i >= 0) { txt = ['Meet Penny', 'Meet Penny', 'Open the Exchange', 'Buy one share', 'Sell your share', 'Sell your share', 'Collect your reward', 'Pick a goal'][i] || 'First trade'; sub = `Step ${Math.min(i + 1, 7)} of 7`; }
    else if (G) { const [have, need] = G.prog(); txt = G.title; sub = need > 1 ? `${have.toLocaleString('en-US')} / ${need.toLocaleString('en-US')}` : 'Goal'; }
    else if (!ob().done) { txt = 'Make your first trade'; sub = 'Tap to start'; }
    else if (window.Tasks) { txt = 'Today\'s tasks'; sub = `${Tasks.progress()} / 3 done`; }
    else { obj.hidden = true; return; }
    obj.hidden = false;
    obj.innerHTML = `<span class="oi">🎯</span><span><b>${txt}</b><small>${sub}</small></span>${G ? `<i style="width:${Math.round(100 * G.prog()[0] / G.prog()[1])}%"></i>` : ''}`;
  }
  obj.onclick = () => {
    const g = S().goal;
    if (i >= 0) return;
    if (!ob().done) { start(); return; }
    if (g && !g.done && GOALS[g.id]) { GOALS[g.id].go(); return; }
    if (g && g.done) { choose(); return; }
    $('earnG').click();
  };
  setInterval(drawObj, 1000);

  function start() {
    if (!M.state.started) M.start();
    did.buy = did.sell = false;
    show(0);
  }
  return {
    start, lock, choose, goals: GOALS,
    want: () => !ob().done, active: () => i >= 0,
    reset: () => { const o = ob(); o.done = false; M.save(); // runs the mission again; never locks anything an older save already had open
      try { localStorage.removeItem('cs-tutorial-done'); } catch (e) { /* fine */ } }
  };
})();
