// Capital Street inside buildings (Goal 16): rooms let to tenants, fit-outs, heating and cooling, basements, extensions,
// and the weather. A year in the game is 28 days, from a cold winter to a summer heatwave. Every building you own (not
// your office, which has its own furniture and staff) has rooms, two per floor; how many are let depends on how nice
// the rooms are and whether they're comfortable in this weather. The market pays full rent for the floors you own, so
// this adds the difference each night: better fit-outs earn more, empty rooms earn nothing, extensions add floors and
// basements add parking. Building records keep it all in state.props[key].in, so it saves and follows the account.
'use strict';
window.Interior = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = (v, dp = 0) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const YEAR = 28;
  const FITS = [{ name: 'Basic', rent: 0, cost: 0, happy: 0 }, { name: 'Nice', rent: 0.15, cost: 0.08, happy: 0.12 }, { name: 'Luxury', rent: 0.35, cost: 0.2, happy: 0.22 }];
  const HVAC = [{ name: 'None', run: 0, cost: 0, cover: 0 }, { name: 'Heating', run: 3, cost: 0.03, cover: 1 }, { name: 'Heating and cooling', run: 7, cost: 0.07, cover: 2 }];
  const FIRST = ['Ava', 'Leo', 'Mia', 'Noah', 'Zoe', 'Eli', 'Ivy', 'Sam', 'Ana', 'Raj', 'Kim', 'Tom', 'Lia', 'Max', 'Uma', 'Ben'];
  const LAST = ['Park', 'Diaz', 'Okafor', 'Rossi', 'Chen', 'Novak', 'Haddad', 'Silva', 'Murphy', 'Sato', 'Kaur', 'Adler'];

  // ---------- the weather ----------
  function temp(day = M.day()) { // °C: about -2 in deep winter, 30 in a summer heatwave
    const t = 14 + 14 * Math.sin(2 * Math.PI * (day - 7) / YEAR), wobble = Math.sin(day * 12.9898) * 3;
    return Math.round(t + wobble);
  }
  const season = d => { const t = temp(d); return t <= 4 ? ['Winter', IC('snow')] : t >= 25 ? ['Heatwave', IC('sun')] : t >= 18 ? ['Summer', IC('sun')] : t <= 11 ? ['Autumn', IC('leaf')] : ['Spring', IC('sprout')]; };
  // how comfortable rooms are: heating covers the cold, cooling the heat
  function comfort(t, cover) {
    const cold = Math.max(0, 12 - t), hot = Math.max(0, t - 24);
    return 1 - Math.min(1, ((cover >= 1 ? 0 : cold) + (cover >= 2 ? 0 : hot)) / 14);
  }

  // ---------- a building's rooms ----------
  const rooms = p => (p.floors + (p.in ? p.in.ext : 0)) * 2;
  function st(p) { if (!p.in) p.in = { fit: 0, hvac: 0, base: false, ext: 0, occ: 0.92, happy: 0.8, spent: 0 }; return p.in; }
  function target(p) { const i = st(p); return Math.max(0.2, Math.min(1, 0.7 + FITS[i.fit].happy + 0.25 * comfort(temp(), HVAC[i.hvac].cover))); }
  const baseRent = p => p.floors * M.floorValue(p) * M.PROP_YIELD; // what the market already pays each night
  function nightly(p) { // the difference this building makes tonight on top of the market's rent
    const i = st(p), per = M.floorValue(p) * M.PROP_YIELD;
    const rent = (p.floors + i.ext) * per * (1 + FITS[i.fit].rent) * i.occ + (i.base ? per * 1.2 : 0);
    return rent - baseRent(p) - HVAC[i.hvac].run * (p.floors + i.ext);
  }
  const tenantsOf = (k, p) => { // the same names every time for the same building, as many as are let
    const n = Math.round(rooms(p) * st(p).occ), out = [];
    let h = 0; for (const c of k) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0;
    for (let j = 0; j < Math.min(n, 4); j++) out.push(FIRST[(h + j * 7) % FIRST.length] + ' ' + LAST[(h >>> 4 + j * 3) % LAST.length]);
    return { n, names: out };
  };

  // ---------- every night ----------
  M.onDay(S => {
    let extra = 0, moved = 0, n = 0;
    for (const [k, p] of Object.entries(S.props)) {
      if (window.Office && Office.hq && p.city === CITY.id && Property.gOf(k) === Office.hq()) continue;
      const i = st(p), before = Math.round(rooms(p) * i.occ), tg = target(p);
      i.occ = Math.max(0.1, Math.min(1, i.occ + (tg - i.occ) * 0.35 + (Math.random() - 0.5) * 0.04));
      i.happy = tg; moved += Math.round(rooms(p) * i.occ) - before;
      extra += nightly(p); n++;
    }
    if (!n) return;
    S.cash = +(S.cash + extra).toFixed(2);
    M.emit('interior', { kind: 'night', extra, moved });
  });
  M.on((type, d) => {
    if (type === 'interior' && d.kind === 'night' && Math.abs(d.extra) >= 1) {
      const [sn, ic] = season();
      toast(`${sn}, ${temp()}°C`, `Your tenants ${d.extra >= 0 ? 'paid an extra' : 'cost you'} ${usd(Math.abs(d.extra))} tonight${d.moved > 0 ? `; ${d.moved} moved in` : d.moved < 0 ? `; ${-d.moved} moved out` : ''}.`);
    }
  });
  M.addWorth(S => { // extensions add floors, basements add a little; fit-outs and HVAC are worth a third of what they cost
    let w = 0;
    for (const p of Object.values(S.props)) if (p.in) w += p.in.ext * p.floorPrice * S.reIndex + (p.in.base ? p.floorPrice * S.reIndex * 0.6 : 0) + p.in.spent * 0.33;
    return w;
  });

  // ---------- doing things ----------
  function pay(p, cost, what) {
    if (cost > M.state.cash) { toast('Can\'t afford it', `You need ${usd(cost)} in cash`); return false; }
    M.state.cash = +(M.state.cash - cost).toFixed(2); st(p).spent += cost; M.save(); M.emit('interior', { kind: what, cost });
    return true;
  }
  const fitCost = (p, f) => Math.round((p.floors + st(p).ext) * p.floorPrice * M.state.reIndex * FITS[f].cost);
  const hvacCost = (p, h) => Math.round((p.floors + st(p).ext) * p.floorPrice * M.state.reIndex * HVAC[h].cost);
  const baseCost = p => Math.round(p.floorPrice * M.state.reIndex * 0.6 / 0.66); // dug out, sold for parking
  const extCost = p => Math.round(p.floorPrice * M.state.reIndex * 1.3);

  // ---------- on the building's card ----------
  function section(k, p) {
    if (!p || !p.floorPrice) return '';
    if (window.Office && Office.hq && Property.gOf(k) === Office.hq()) return '';
    const i = st(p), t = tenantsOf(k, p), [sn, ic] = season(), c = comfort(temp(), HVAC[i.hvac].cover), night = nightly(p);
    return `<div class="inside"><small>INSIDE · ${rooms(p)} ROOMS</small>
      <div class="store"><div class="sbar occ"><i style="width:${Math.round(i.occ * 100)}%"></i></div><span>${t.n} of ${rooms(p)} rooms let (${Math.round(i.occ * 100)}%)${t.names.length ? ` · ${t.names.join(', ')}${t.n > t.names.length ? ` and ${t.n - t.names.length} more` : ''}` : ''}</span></div>
      <div class="ground"><span>${ic} ${sn} <b>${temp()}°C</b></span><span>Comfort <b>${Math.round(c * 100)}%</b></span><span>Tenants happy <b>${Math.round(target(p) * 100)}%</b></span><span>Tonight <b class="${night >= 0 ? 'up' : 'dn'}">${night >= 0 ? '+' : ''}${usd(night)}</b></span></div>
      <div class="opts">
        <div><b>Fit-out</b><span>${FITS.map((f, j) => `<button data-fit="${j}" class="${j === i.fit ? 'on' : ''}" ${j <= i.fit ? 'disabled' : ''}>${f.name}${j > i.fit ? ` · ${usd(fitCost(p, j))}` : ''}</button>`).join('')}</span></div>
        <div><b>Heating & cooling</b><span>${HVAC.map((h, j) => `<button data-hvac="${j}" class="${j === i.hvac ? 'on' : ''}" ${j <= i.hvac ? 'disabled' : ''}>${h.name}${j > i.hvac ? ` · ${usd(hvacCost(p, j))}` : ''}</button>`).join('')}</span></div>
        <div><b>Basement</b><span>${i.base ? '<button class="on" disabled>Parking basement</button>' : `<button data-base="1">Dig a parking basement · ${usd(baseCost(p))}</button>`}</span></div>
        <div><b>Extension</b><span>${i.ext ? `<button class="on" disabled>+${i.ext} floor${i.ext > 1 ? 's' : ''}</button>` : ''}${i.ext < 3 ? `<button data-ext="1">Add a floor on top · ${usd(extCost(p))}</button>` : ''}</span></div>
      </div>
      <p class="note">Nicer rooms rent for more and keep tenants; without heating, winter empties rooms, and without cooling, so does a heatwave. Heating and cooling cost ${usd(HVAC[i.hvac].run * (p.floors + i.ext))} a night to run.</p></div>`;
  }
  function bind(root, k, p, redraw) {
    root.querySelectorAll('[data-fit]').forEach(b => b.onclick = () => { const j = +b.dataset.fit; if (pay(p, fitCost(p, j), 'fit')) { st(p).fit = j; toast('Fit-out done', `${FITS[j].name} rooms: rent +${Math.round(FITS[j].rent * 100)}%.`); } redraw(); });
    root.querySelectorAll('[data-hvac]').forEach(b => b.onclick = () => { const j = +b.dataset.hvac; if (pay(p, hvacCost(p, j), 'hvac')) { st(p).hvac = j; toast('Installed', `${HVAC[j].name}. Tenants stay through the ${j === 2 ? 'winter and the heatwaves' : 'winter'}.`); } redraw(); });
    root.querySelectorAll('[data-base]').forEach(b => b.onclick = () => { if (pay(p, baseCost(p), 'base')) { st(p).base = true; toast('Basement dug', 'Parking pays every night.'); } redraw(); });
    root.querySelectorAll('[data-ext]').forEach(b => b.onclick = () => { if (pay(p, extCost(p), 'ext')) { st(p).ext++; toast('Extension built', `${p.floors + st(p).ext} floors now: two more rooms to let.`); } redraw(); });
  }

  // ---------- the weather in the top bar ----------
  const chip = document.createElement('span');
  chip.id = 'wx'; chip.title = 'The weather: heating keeps tenants in winter, cooling in a heatwave';
  const place = setInterval(() => { const c = $('clock'); if (!c) return; clearInterval(place); c.after(chip); }, 300);
  setInterval(() => { const [sn, ic] = season(); chip.innerHTML = `${ic} ${temp()}°C`; chip.title = `${sn}: day ${((M.day() - 1) % YEAR) + 1} of ${YEAR} in the year`; }, 1000);

  return { temp, season, comfort, section, bind, nightly, rooms, YEAR };
})();
