// Capital Street companies (Goal 17): found your own company and take it public on the Share Exchange.
// The company is your empire: its book value is your buildings, land, businesses and goods. It is split into shares when you found it.
// Going public sells 20-40% of them to investors for cash; after that its ticker trades on the exchange next to the
// fictional companies, with a fair price that follows the book value plus a multiple of what your empire earns each
// night, so building a better business moves your share price. Shares investors own count against your net worth
// (they own that part of your empire), and you can buy them back on the exchange like any other shares.
'use strict';
window.Company = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = (v, dp = 0) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const FOUND_AT = 250000, FOUND_FEE = 25000;
  const C = () => M.state.myco;
  const sh = () => (C() && C().shares) || 1e6; // set when you found it, so it lists at about $20 a share

  // ---------- what the company is worth ----------
  function book(S = M.state) {
    let v = Object.values(S.props).reduce((s, p) => s + p.floors * p.floorPrice * S.reIndex, 0);
    for (const o of Object.values(S.land || {})) { v += o.area * o.ppm * S.reIndex; if (o.biz) v += o.biz.spent * 0.5; }
    if (window.Biz) for (const [g, q] of Object.entries(S.goods || {})) if (Biz.GOODS[g]) v += q * Biz.priceOf(g);
    return Math.max(10000, v);
  }
  const fairPrice = (S = M.state) => (book(S) + 20 * Math.max(0, (C() && C().earn) || 0)) / sh();

  // ---------- on the exchange ----------
  function list() { // put the company among the exchange's companies (after a load, or when it goes public)
    const c = C(); if (!c || !c.ipo || M.company(c.t)) return;
    M.COMPANIES.push({ t: c.t, name: c.name, sector: 'Finance', price: c.ipo.price, vol: 0.03, beta: 1.0, shares: sh() / 1e6, city: 'nyc', mine: true });
    if (!M.state.stocks[c.t]) { // two days of quiet history before the first day, so the charts aren't empty
      const h = [], p0 = c.ipo.price;
      for (let d = 2; d > 0; d--) for (let m = M.OPEN; m < M.CLOSE; m += 5) h.push({ t: (M.day() - d - 1) * M.DAY + m, p: p0, v: 0 });
      M.state.stocks[c.t] = { price: p0, fair: p0, open: p0, prevClose: p0, hist: h, vol: 0 };
    }
  }
  function unlist() { const i = M.COMPANIES.findIndex(x => x.mine); if (i >= 0) M.COMPANIES.splice(i, 1); }
  const price = () => { const c = C(); return c && c.ipo && M.state.stocks[c.t] ? M.state.stocks[c.t].price : 0; };

  // ---------- founding and going public ----------
  function found(name, t) {
    name = String(name).trim(); t = String(t).trim().toUpperCase();
    if (C()) return { ok: false, why: 'You already have a company' };
    if (M.netWorth() < FOUND_AT) return { ok: false, why: `Reach a net worth of ${usd(FOUND_AT)} first` };
    if (!/^[A-Za-z0-9][A-Za-z0-9 &.'-]{1,30}$/.test(name)) return { ok: false, why: 'Give it a name of 2 to 31 letters' };
    if (!/^[A-Z]{3,4}$/.test(t)) return { ok: false, why: 'The ticker is 3 or 4 letters' };
    if (M.company(t)) return { ok: false, why: `${t} is taken on the exchange` };
    if (FOUND_FEE > M.state.cash) return { ok: false, why: `Founding costs ${usd(FOUND_FEE)} in cash` };
    M.state.cash = +(M.state.cash - FOUND_FEE).toFixed(2);
    M.state.myco = { name, t, founded: M.day(), ipo: null, float: 0, earn: 0, shares: Math.max(10000, Math.round(book() / 20 / 1000) * 1000) };
    M.save(); M.emit('company', { kind: 'founded' });
    return { ok: true };
  }
  function ipo(pct) {
    const c = C();
    if (!c || c.ipo) return { ok: false, why: 'Not possible' };
    if (!M.isOpen()) return { ok: false, why: 'Listings happen while the market is open' };
    const p = +(fairPrice() * 1.1).toFixed(2), n = Math.round(sh() * pct), cash = n * p * 0.97; // 3% to the bankers
    c.ipo = { pct, price: p, day: M.day() }; c.float = n;
    M.state.cash = +(M.state.cash + cash).toFixed(2);
    list(); M.save(); M.emit('company', { kind: 'ipo', cash });
    return { ok: true, cash, price: p };
  }
  // investors' part of your empire counts against your net worth; shares you buy back sit in your portfolio
  M.addWorth(S => S.myco && S.myco.ipo && S.stocks[S.myco.t] ? -S.myco.float * S.stocks[S.myco.t].price : 0);

  // ---------- every night: the fair price follows the empire ----------
  let lastBook = null;
  M.onDay(S => {
    const c = S.myco; if (!c) return;
    const b = book(S);
    c.earn = lastBook == null ? 0 : (c.earn || 0) * 0.6 + (b - lastBook) * 0.4; // smoothed growth of the empire
    lastBook = b;
    if (!c.ipo || !S.stocks[c.t]) return;
    const st = S.stocks[c.t], f = fairPrice(S);
    st.fair = f; st.price = +(st.price * 0.7 + f * 0.3).toFixed(2); // investors reprice overnight
  });
  M.on((type, d) => {
    if (type === 'reset') unlist();
    // buying back shares on the exchange shrinks what investors own; selling yours adds to it
    if (type === 'fill' && C() && C().ipo && d.t === C().t) { C().float = Math.max(0, C().float + (d.side === 'buy' ? -d.shares : d.shares)); M.save(); }
  });

  // ---------- in the Business tab ----------
  function section() {
    const c = C(), w = M.netWorth();
    if (!c) return `<small class="ahd">YOUR COMPANY</small><div class="co">${w < FOUND_AT
      ? `<p class="note">Turn your empire into a company and take it public on the Share Exchange. You need a net worth of ${usd(FOUND_AT)} (now ${usd(w)}).</p><div class="sbar"><i style="width:${Math.min(100, w / FOUND_AT * 100)}%"></i></div>`
      : `<form class="askf xform" id="coFound"><input id="coName" maxlength="31" placeholder="Company name" aria-label="Company name" style="width:180px"><input id="coT" maxlength="4" placeholder="TICK" aria-label="Ticker" style="width:70px;text-transform:uppercase"><button class="btn pri">Found it · ${usd(FOUND_FEE)}</button></form><p class="note">Its value is your buildings, land, businesses and goods: about ${usd(book())} today.</p>`}</div>`;
    const b = book(), pr = price(), stake = sh() - c.float;
    return `<small class="ahd">YOUR COMPANY</small><div class="co"><div class="coh"><b>${esc(c.name)}</b><span class="tick">${esc(c.t)}</span></div>
      <div class="cards"><div>Book value<b>${usd(b)}</b></div><div>${c.ipo ? 'Share price' : 'Per share'}<b>${usd(c.ipo ? pr : b / sh(), 2)}</b></div><div>${c.ipo ? 'Market cap' : 'Founded'}<b>${c.ipo ? usd(pr * sh()) : 'day ' + c.founded}</b></div></div>
      ${c.ipo ? `<p class="note">Listed on the Share Exchange as <b>${esc(c.t)}</b> since day ${c.ipo.day} at ${usd(c.ipo.price, 2)}. You own ${(stake / sh() * 100).toFixed(1)}%; investors own ${(c.float / sh() * 100).toFixed(1)}% (${usd(c.float * pr)}, counted against your net worth). Grow your empire and the price follows; buy shares back on the exchange to own more of it.</p><div class="lbtns"><button class="plain" id="coTrade">Open ${esc(c.t)} on the exchange</button></div>`
        : `<p class="note">Go public: sell part of the company to investors at about ${usd(fairPrice() * 1.1, 2)} a share (10% over book; the bankers keep 3%). ${M.isOpen() ? '' : 'Listings happen while the market is open.'}</p><div class="lbtns">${[0.2, 0.3, 0.4].map(p => `<button class="buy" data-ipo="${p}" ${M.isOpen() ? '' : 'disabled'}>Sell ${p * 100}% · ${usd(sh() * p * fairPrice() * 1.1 * 0.97)}</button>`).join('')}</div>`}</div>`;
  }
  function bind(body) {
    if ($('coFound')) $('coFound').onsubmit = e => { e.preventDefault(); const r = found($('coName').value, $('coT').value); if (!r.ok) toast('Can\'t found it', r.why); else toast('Company founded', `${C().name} (${C().t}) is yours. Take it public when you're ready.`); Property.redraw(); };
    body.querySelectorAll('[data-ipo]').forEach(b => b.onclick = () => {
      const p = +b.dataset.ipo;
      CSUI.story(`<small>GO PUBLIC</small><b>${esc(C().name)} on the exchange</b><p>Sell ${p * 100}% of the company to investors for about ${usd(sh() * p * fairPrice() * 1.1 * 0.97)}. From then on ${esc(C().t)} trades every minute, and anything can happen to it.</p>`,
        [['Ring the bell', () => { const r = ipo(p); if (!r.ok) toast('Can\'t list', r.why); else CSUI.story(`<small>LISTED</small><b>${esc(C().t)} opens at ${usd(r.price, 2)}</b><p>Investors paid ${usd(r.cash)} for their shares. Your company now trades on the Share Exchange.</p>`, [['Great', () => {}]]); Property.redraw(); }], ['Not yet', () => {}]]);
    });
    if ($('coTrade')) $('coTrade').onclick = () => { $('props').hidden = true; if (window.CSUI && CSUI.openExchange) CSUI.openExchange(C().t); else $('bExchange').click(); };
  }

  const boot = setInterval(() => { if (window.CS && $('load').hidden) { clearInterval(boot); list(); lastBook = C() ? book() : null; } }, 300);
  return { book, fairPrice, found, ipo, section, bind, price, shares: () => sh() };
})();
