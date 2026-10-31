// Capital Street daily tasks (Goal 28): three small jobs a day, like the city builders' daily orders. Each one pays a
// cash reward that grows with your net worth, and finishing all three pays a bonus. They're picked from every job, so
// they nudge you to try them all. Kept in the save as state.tasks; a new set comes each game day.
'use strict';
window.Tasks = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const ex = () => { if ($('ex').hidden) $('bExchange').click(); };
  // Goal 31: each task also says when it makes sense: unlocked, something to do it with, and affordable
  const L = f => !(window.Tutorial && Tutorial.lock(f)), S = () => M.state, cash = () => S().cash;
  const lands = () => Object.values(S().land || {}), hasBiz = () => lands().some(o => o.biz), goods = () => window.Biz && Object.values(Biz.inv() || {}).some(n => n > 0);
  const OK = {
    building: () => L('property') && cash() >= 3000, bid: () => L('auctions') && cash() >= 5000, land: () => L('land') && cash() >= 8000,
    collect: () => hasBiz(), goods: () => hasBiz() && goods(), business: () => L('business') && lands().some(o => !o.biz) && cash() >= 5000,
    ship: () => hasBiz() && goods(), rebuild: () => L('property') && Object.values(S().props).some(p => p.floors >= (p.totalFloors || 1)), hire: () => !!(S().office && S().office.g != null)
  };
  const fits = id => !OK[id] || OK[id]();
  // id, icon, what to do, how many, does this event count, where to go
  const POOL = [
    ['buyshare', 'chart', 'Buy shares in any company', 1, (t, d) => t === 'fill' && d.side === 'buy', ex],
    ['trades', 'trade', 'Make 3 share trades', 3, t => t === 'fill', ex],
    ['sellshare', 'coin', 'Sell some shares', 1, (t, d) => t === 'fill' && d.side === 'sell', ex],
    ['building', 'building', 'Buy a building or a floor', 1, (t, d) => t === 'property' && d.kind === 'bought', () => Property.open('sale')],
    ['bid', 'gavel', 'Bid at a city auction', 1, (t, d) => t === 'auction' && d.kind === 'bid', () => Property.open('auctions')],
    ['land', 'land', 'Buy a plot of land', 1, (t, d) => t === 'land' && d.kind === 'bought', () => Property.open('land')],
    ['collect', 'farm', 'Collect from a farm, mine or oil well', 1, (t, d) => t === 'biz' && d.kind === 'collected', () => Property.open('business')],
    ['goods', 'box', 'Sell goods to the city', 1, (t, d) => t === 'biz' && d.kind === 'sold', () => Property.open('business')],
    ['business', 'hammer', 'Build a business on your land', 1, (t, d) => t === 'biz' && d.kind === 'built', () => Property.open('land')],
    ['ship', 'ship', 'Ship goods to another city', 1, (t, d) => t === 'ship' && d.kind === 'sent', () => Property.open('business')],
    ['rebuild', 'crane', 'Start a new building', 1, (t, d) => t === 'build' && d.kind === 'started', () => Property.open('mine')],
    ['hire', 'hire', 'Hire someone for your office', 1, t => t === 'hire', () => { if (!Office.active()) Office.enter(); }]
  ];
  const EASY = ['buyshare', 'trades', 'building', 'bid'];
  const P = id => POOL.find(p => p[0] === id);
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  function today() {
    const s = M.state, d = M.day();
    if (!s.tasks || s.tasks.day !== d) { // a new day: one easy task and two others, picked from what you can do right now
      let r = hash('cs-tasks:' + d);
      const rnd = () => (r = Math.imul(r ^ (r >>> 15), 2246822507) >>> 0) / 4294967296;
      const can = POOL.map(p => p[0]).filter(fits), easies = EASY.filter(fits);
      const easy = easies[Math.floor(rnd() * easies.length)], rest = can.filter(id => id !== easy).sort(() => rnd() - 0.5);
      s.tasks = { day: d, list: [easy, rest[0], rest[1]].map(id => ({ id, n: 0, claimed: false })), bonus: false };
      M.save();
    }
    return s.tasks;
  }
  const reward = () => Math.round(Math.min(20000, Math.max(300, M.netWorth() * 0.005)) / 50) * 50;
  const done = t => t.n >= P(t.id)[3];
  const claimable = () => { const T = today(); return T.list.filter(t => done(t) && !t.claimed).length + (T.list.every(t => t.claimed) && !T.bonus ? 1 : 0); };

  M.on((type, d) => {
    if (!M.state.started || type === 'tick') return;
    const T = today();
    for (const t of T.list) {
      if (t.claimed || done(t) || !P(t.id)[4](type, d || {})) continue;
      t.n++; M.save();
      if (done(t)) toast('Task done!', `${P(t.id)[2]}. Collect your ${usd(reward())} in Jobs.`);
    }
  });

  function claim(i) {
    const T = today(), t = T.list[i];
    if (!t || !done(t) || t.claimed) return;
    const r = reward();
    t.claimed = true; M.state.cash = +(M.state.cash + r).toFixed(2); M.save();
    if (window.Levels) Levels.give(25);
    toast('Reward collected', `+${usd(r)}`);
  }
  function claimBonus() {
    const T = today();
    if (T.bonus || !T.list.every(t => t.claimed)) return;
    const r = reward() * 2;
    T.bonus = true; M.state.cash = +(M.state.cash + r).toFixed(2); M.save();
    if (window.Levels) Levels.give(60);
    toast('All tasks done!', `Bonus +${usd(r)}`);
  }
  // the section at the top of the Jobs sheet
  function html() {
    const T = today(), r = reward(), all = T.list.every(t => t.claimed);
    return `<div class="tasks"><div class="tkh"><b>Today's tasks</b><small>${T.list.filter(t => t.claimed).length} / 3 done · new tasks every day</small></div>
      ${T.list.map((t, i) => { const p = P(t.id), ok = done(t); return `<div class="tk2 ${t.claimed ? 'got' : ''}"><i>${IC(p[1])}</i><span><b>${p[2]}</b><small>${t.claimed ? 'Collected' : ok ? 'Done!' : p[3] > 1 ? `${t.n} / ${p[3]}` : 'Reward ' + usd(r)}</small></span>${t.claimed ? `<em>${IC('star')}</em>` : ok ? `<button class="btn pri" data-tc="${i}">Collect ${usd(r)}</button>` : `<button class="btn" data-tg="${i}">Go</button>`}</div>`; }).join('')}
      ${all ? (T.bonus ? '<p class="note">All done for today. Come back tomorrow!</p>' : `<button class="btn pri big tkb" id="tkBonus">Collect the bonus: ${usd(r * 2)}</button>`) : `<p class="note">Finish all three for a ${usd(r * 2)} bonus.</p>`}</div>`;
  }
  function bind(root, redraw, go) {
    root.querySelectorAll('[data-tc]').forEach(b => b.onclick = () => { claim(+b.dataset.tc); redraw(); });
    root.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => go(P(today().list[+b.dataset.tg].id)[5]));
    const bb = root.querySelector('#tkBonus'); if (bb) bb.onclick = () => { claimBonus(); redraw(); };
  }
  // a red badge on the JOBS buttons when there's a reward to collect
  setInterval(() => { if (!M.state.started) return; const n = claimable(); for (const id of ['earnG', 'earnM']) { const b = $(id); if (b) b.dataset.n = n || ''; } }, 1000);

  return { html, bind, claimable, today, progress: () => today().list.filter(t => t.claimed).length };
})();
