// Capital Street tutorial (Goal 22): Penny the piggy bank shows a new player around in a few simple steps, lighting up
// the one thing to tap each time. It starts the first time you play; "How to play" in the menu shows it again.
'use strict';
window.Tutorial = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const KEY = 'cs-tutorial-done';
  const done = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
  const finish = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* storage blocked */ } };

  const el = document.createElement('div');
  el.id = 'tut'; el.hidden = true;
  el.innerHTML = '<div class="thole" id="tHole"></div><div class="tbub" id="tBub"><div class="tpig">🐷</div><div class="ttxt"><small id="tStep"></small><p id="tText"></p><div class="tbtns"><button class="lnk" id="tSkip">Skip tutorial</button><button class="btn pri" id="tNext">Next</button></div></div></div>';
  document.body.appendChild(el);

  // each step: what Penny says, what to light up, and either a Next button or something you have to do
  const steps = [
    { say: () => `Hi! I'm <b>Penny</b>. I'll show you how to get rich in New York. It's easy!`, next: "Let's go!" },
    { at: 'cashV', say: () => `This is your <b>money</b>. You have ${usd(M.state.cash)}. Let's make it grow!` },
    { at: 'rentBox', say: () => `Don't forget your <b>rent</b>: ${usd(M.RENT)} is due in a few days. Keep enough money to pay it, or you lose your apartment!`, skipIf: () => !$('rentBox') },
    { at: 'bExchange', say: () => `Tap <b>Exchange</b>. That's where you buy <b>shares</b>: tiny pieces of companies.`, wait: () => !$('ex').hidden, tap: true },
    { at: 'list', say: () => `Pick any company. <b class="g">Green</b> means its price went up today, <b class="r">red</b> means it went down.`, wait: () => picked, tap: true },
    { at: 'ticket', say: () => M.status() === 'OPEN' ? 'Now tap <b>BUY</b>. If the price goes up later, your shares are worth more!' : `This is where you <b>BUY</b>. The market is closed right now: it opens at 9:30, so come back and buy then.`, wait: () => bought, tap: true, next: () => M.status() === 'OPEN' ? 'Skip this' : 'Next' },
    { at: 'exX', say: () => `You're an investor now! Sell when the price is <b>higher</b> than you paid. Close the exchange for now.`, wait: () => $('ex').hidden, tap: true },
    { at: 'bProps', say: () => `Later you can buy <b>buildings</b> in Property. Tenants pay you rent every night, even while you sleep!` },
    { at: 'earnG', say: () => `Tap the gold <b>EARN</b> button any time to see <b>every way to make money</b>: buildings, land, farms, shipping, your own company and more.` },
    { say: () => `Watch out for <b>BREAKING NEWS</b>! Markets can crash 📉 or soar 📈 at any moment. Even a plane can crash into a tower!` },
    { say: () => `That's it! Pay your rent, grow your money, buy buildings and become a <b>Wall Street Legend</b>. Good luck!`, next: 'Play!' }
  ];
  let i = -1, picked = false, bought = false;
  M.on((type, d) => { if (type === 'fill' && d.side === 'buy') bought = true; if (type === 'order') bought = true; });
  document.addEventListener('click', e => { if (i >= 0 && e.target.closest && e.target.closest('#list')) picked = true; }, true);

  function show(n) {
    i = n;
    while (steps[i] && steps[i].skipIf && steps[i].skipIf()) i++;
    const s = steps[i];
    if (!s) { stop(); return; }
    $('tStep').textContent = `${i + 1} / ${steps.length}`;
    $('tText').innerHTML = s.say();
    $('tNext').textContent = (typeof s.next === 'function' ? s.next() : s.next) || 'Next';
    $('tNext').hidden = !!s.wait && !s.next;
    el.classList.toggle('tap', !!s.tap);
    el.hidden = false;
    place();
  }
  function stop() { i = -1; el.hidden = true; finish(); }
  $('tNext').onclick = () => show(i + 1);
  $('tSkip').onclick = stop;

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
      bub.style.top = (below ? Math.min(innerHeight - bh - 12, r.bottom + pad + 14) : Math.max(12, r.top - pad - 14 - bh)) + 'px';
    } else {
      hole.style.display = 'none';
      bub.style.left = (innerWidth - bub.offsetWidth) / 2 + 'px';
      bub.style.top = (innerHeight - bub.offsetHeight) / 2 + 'px';
    }
    el.classList.toggle('dim', !vis);
  }
  (function loop() {
    if (i >= 0) {
      const s = steps[i];
      if (s.wait && s.wait()) show(i + 1); else place();
    }
    requestAnimationFrame(loop);
  })();

  function start() {
    picked = bought = false;
    if (!M.state.started) M.start();
    show(0);
  }
  return { start, want: () => !done(), active: () => i >= 0, reset: () => { try { localStorage.removeItem(KEY); } catch (e) { /* fine */ } } };
})();
