// Capital Island's trade rules, in one place: the goods, the island's businesses and how their prices move, the road
// distances, and the delivery-contract board. The game uses it for offline play; the server's functions (server/island2.sql)
// use the same arithmetic, and a test checks that both give the same answers.
//
// A business has a stock (a supplier) or a demand (a buyer) that is finite, shared by every player and refills with time.
// A supplier gets cheaper the fuller its stock, a buyer pays more the more it still wants: nobody can buy low and sell high
// for ever, because buying empties the shelf and selling fills the buyer.
// All sums use whole cents and whole units, so the game and the server agree to the cent.
(function (root) {
  'use strict';
  const GOODS = { crop: ['crate', 'crates', 'Crops'], food: ['box', 'boxes', 'Food'], goods: ['carton', 'cartons', 'Goods'], fuel: ['drum', 'drums', 'Fuel'] };
  const PLACES = { FA: 'Greenfields Co-op', P: 'Processing Plant', C: 'Old Quarter shops', J: 'Hotel Azure', K: 'Harbour quay' };
  // road distance in metres between the places (measured on the island's road network; the server keeps the same table)
  const METERS = { 'FA>P': 867, 'FA>C': 563, 'FA>J': 502, 'FA>K': 655, 'P>FA': 867, 'P>C': 612, 'P>J': 767, 'P>K': 469, 'C>FA': 563, 'C>P': 612, 'C>J': 155, 'C>K': 178, 'J>FA': 503, 'J>P': 768, 'J>C': 156, 'J>K': 334, 'K>FA': 655, 'K>P': 469, 'K>C': 178, 'K>J': 333 };
  // the businesses that deal in the wholesale goods. side 'sell': the harbour depot sells to you; 'buy': they buy from you.
  // cap: the most they hold (sell) or want (buy); refill: seconds for one more unit; base: price in cents at half full; level: needed to deal.
  const BIZ = {
    'harbour-goods': { name: 'Harbour depot', node: 'K', side: 'sell', good: 'goods', cap: 60, refill: 20, base: 2600, level: 0 },
    'harbour-fuel': { name: 'Harbour depot', node: 'K', side: 'sell', good: 'fuel', cap: 80, refill: 12, base: 1200, level: 0 },
    'shops-goods': { name: 'Old Quarter shops', node: 'C', side: 'buy', good: 'goods', cap: 40, refill: 15, base: 3300, level: 0 },
    'hotel-goods': { name: 'Hotel Azure', node: 'J', side: 'buy', good: 'goods', cap: 20, refill: 20, base: 3500, level: 2 },
    'hotel-fuel': { name: 'Hotel Azure', node: 'J', side: 'buy', good: 'fuel', cap: 30, refill: 15, base: 1600, level: 2 },
    'coop-fuel': { name: 'Greenfields Co-op', node: 'FA', side: 'buy', good: 'fuel', cap: 40, refill: 12, base: 1700, level: 0 },
    'plant-fuel': { name: 'Processing Plant', node: 'P', side: 'buy', good: 'fuel', cap: 50, refill: 12, base: 1600, level: 0 },
  };
  // integer division that rounds halves up (the server does the same)
  const rdiv = (a, b) => Math.floor((2 * a + b) / (2 * b));
  // the price of one unit, in cents, with q whole units in stock (sell) or still wanted (buy)
  const unitCents = (side, base, cap, q) => side === 'sell' ? rdiv(base * (250 * cap - 100 * q), 200 * cap) : rdiv(base * (150 * cap + 100 * q), 200 * cap);
  // the price of n units in cents: the average of the price before and after, because buying empties the shelf and selling fills the buyer
  const totalCents = (side, base, cap, q, n) => side === 'sell' ? rdiv(n * base * (250 * cap - 50 * (2 * q - n)), 200 * cap) : rdiv(n * base * (150 * cap + 50 * (2 * q - n)), 200 * cap);
  // how many whole units a business has after time passes: stock or demand creeps back up to its cap
  const units = (qty, atMs, nowMs, refill, cap) => Math.floor(Math.min(cap, qty + Math.max(0, nowMs - atMs) / 1000 / refill) + 1e-9);
  // shipping by road, the same rule as the food chain
  const fee = (vehicle, meters) => Math.round(vehicle === 'van' ? 8 + meters * 0.03 : 12 + meters * 0.035);
  const vehicleFor = (qty, level) => qty <= 20 && level >= 1 ? 'van' : 'truck';
  const meters = (a, b) => METERS[a + '>' + b] || 0;

  // ---------- the contract board: any player may take one; the cargo comes from the business that posted it ----------
  // every 2 minutes two contracts are posted. They follow from the clock alone, so the game and the server (and a second player's game) agree without talking.
  const SLOT_S = 120, LIVE_S = 480;
  const TEMPLATES = [
    { from: 'FA', to: 'P', good: 'crop', lo: 20, hi: 40, level: 0 }, { from: 'P', to: 'C', good: 'food', lo: 10, hi: 20, level: 0 }, { from: 'P', to: 'J', good: 'food', lo: 10, hi: 20, level: 2 },
    { from: 'K', to: 'C', good: 'goods', lo: 10, hi: 20, level: 0 }, { from: 'K', to: 'J', good: 'goods', lo: 8, hi: 16, level: 2 }, { from: 'K', to: 'FA', good: 'fuel', lo: 10, hi: 20, level: 0 },
    { from: 'FA', to: 'K', good: 'crop', lo: 20, hi: 40, level: 1 }, { from: 'P', to: 'K', good: 'food', lo: 10, hi: 20, level: 1 },
  ];
  const reward = (m, qty) => 10 + Math.floor((4 * m + 45 * qty + 50) / 100); // dollars: a base, the distance, the load
  const slotOf = nowMs => Math.floor(nowMs / 1000 / SLOT_S);
  const mod = 2147483647;
  const hash = (slot, n) => { const h1 = (slot * 48271 + 12345) % mod, h2 = (h1 * 16807 + (n + 1) * 69621 + 7) % mod; return [h2, (h2 * 48271 + 99) % mod]; };
  function posted(slot) { // the two contracts posted in a slot
    return [0, 1].map(n => { const [h, h3] = hash(slot, n), t = TEMPLATES[h % TEMPLATES.length], qty = t.lo + (h3 % ((t.hi - t.lo) / 2 + 1)) * 2, m = meters(t.from, t.to);
      return { id: 's' + slot + '-' + n, slot, tpl: h % TEMPLATES.length, good: t.good, from: t.from, to: t.to, qty, meters: m, reward: reward(m, qty), level: t.level, postedMs: slot * SLOT_S * 1000, expiresMs: (slot * SLOT_S + LIVE_S) * 1000 }; });
  }
  // the contracts open at a moment: the last four slots' worth that haven't expired
  function board(nowMs) { const s = slotOf(nowMs), out = []; for (let k = s - 3; k <= s; k++) for (const c of posted(k)) if (c.expiresMs > nowMs) out.push(c); return out; }
  const api = { GOODS, PLACES, METERS, BIZ, TEMPLATES, SLOT_S, LIVE_S, rdiv, unitCents, totalCents, units, fee, vehicleFor, meters, reward, slotOf, hash, posted, board };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Market = api;
})(typeof self !== 'undefined' ? self : this);
