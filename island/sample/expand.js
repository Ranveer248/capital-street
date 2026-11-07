// The bigger island: its towns, farms, works, resort, harbour, airport, quarry and landmarks. Shown only with ?expand while it is being built.
// Built from the parts in the scratch folder g40/ex by g40/mkex.js; each region is a function that takes the toolkit K that world.js hands over.
(function () {
  'use strict';
  const G = window.IslandGeo; if (!G.EXPANDED) return;
  // new shop and place signs join the picture atlas (they must be added before the game starts)
  const NEWSIGNS = [['BUTCHER', '#b03a2e'], ['HARDWARE', '#3d5a80'], ['TEA ROOMS', '#8a5a44'], ['BOOKS', '#5b3f8c'], ['FISH MARKET', '#1f78a8'], ['CHANDLER', '#2c5f7c'], ['FISH & CHIPS', '#c47f17'], ['ICE HOUSE', '#4a90a4'], ['POTTERY', '#b5651d'], ['WINE', '#7b1e3a'], ['OLIVE OIL', '#6b7d1e'], ['POST OFFICE', '#c0392b'], ['DIVE SHOP', '#0e7c86'], ['SURF HIRE', '#e8742c'], ['SEAFOOD GRILL', '#c0392b'], ['GELATO', '#e66b9a'], ['SOUVENIRS', '#7d5ba6'],
    ['HOTEL CORAL', '#e0607e'], ['SUNSET HOTEL', '#e07b39'], ['PEARL RESORT', '#2a8fa6'], ['LAGOON HOTEL', '#1f9d8a'], ['MARINA CLUB', '#1f4f86'], ['RESTAURANT', '#8a2f2f'], ['TERMINAL', '#1f4f86'], ['AIRPORT', '#27496d'], ['ARRIVALS', '#2f8f5b'], ['DEPARTURES', '#c0392b'], ['FREIGHT', '#d97a1c'], ['RECYCLING', '#2f8f3a'], ['STEEL', '#5a6270'], ['TIMBER YARD', '#7a4e2d'], ['FACTORY', '#34495e'], ['CUSTOMS', '#8e44ad'], ['PORT OFFICE', '#1f6f9a'],
    ['QUARRY', '#9a7b4f'], ['MINE', '#5a5a5a'], ['CEMENT', '#7f8c8d'], ['FORT', '#6b5a43'], ['LIGHTHOUSE', '#c0392b'], ['GARDENS', '#2f8f3a'], ['TEAHOUSE', '#a15c38'], ['VISITORS', '#2e74c9'], ['FALLS', '#2a8fd0'], ['LOOKOUT', '#2f8f3a'], ['GRAIN STORE', '#a87b32'], ['ORCHARD', '#c0392b'], ['DAIRY', '#4a90d9'], ['MILL', '#8a5a44'], ['BEACH CLUB', '#0f6fb8'], ['SPA', '#7fb5a4'], ['MARKET HALL', '#8a5a44'], ['TOWN HALL', '#5b3f33'], ['CHURCH', '#7a7f87'], ['BOATYARD', '#1f4f86'], ['NETS', '#3f6a7a'], ['SMOKEHOUSE', '#8a4a2a']];
  const S0 = World.signs.SIGNS.length, SG = {}; NEWSIGNS.forEach(([t, c], i) => { World.signs.SIGNS.push(t); World.signs.SIGNC.push(c); SG[t] = S0 + i; });
  Object.assign(SG, { BAKERY: 0, 'CAFÉ': 1, GROCER: 2, PHARMACY: 3, FLOWERS: 4, LIBRARY: 5, HARBOUR: 6, SEAFOOD: 8, 'BEACH BAR': 9, MARKET: 13, 'ICE CREAM': 14, DEPOT: 15, HOTEL: 30, 'FARM SHOP': 31 });
  World.regions.push(function (K, LOTS) {
    const { THREE, lin, C, clamp, smooth, mix, hash, heightAt, land, nearRoad, nodes, edges, scene, tick, boxAt, geoAt, frameAt, walls, hip, gable, sign, mul, rotY, BOX, CYL, CYL8, SPH, DRAW, DOOR, addBuilding, buildings, LAMPS, extraTrees, PARKED, LABELS, tileAt, path, entrances, wnear, blockedAt, inR, obstacleIndex, tmp, addGeo, roofGeo, slab, bench, bin, bikes, planter, umbrellaTable, stall, canvasTex, tex, SIGNS, SIGNC, EXTRA_KINDS, posAt, barBox, crop, hedgerow, tractor, shelter } = K;
    const rnd = K.rnd, pick = K.pick, R = () => K.rnd(), setSeed = K.setSeed, M0 = new THREE.Matrix4(), T0 = performance.now(), TIMES = {};
    const lap = name => { const t = performance.now(); TIMES[name] = Math.round(t - lap.t); lap.t = t; }; lap.t = T0;
    const groundY = (x, z) => heightAt(x, z);
    const rng = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647); // a private random stream, so one region never changes another
    const regionRects = []; // [x0, x1, z0, z1] kept clear of wild trees
    const keepClear = (x0, x1, z0, z1) => { regionRects.push([x0, x1, z0, z1]); G.NOTREE.push([x0, x1, z0, z1]); };
    const WORKS = K.WORLD_WORKS = {};

    // ---------- looks: palettes for each kind of place, and the wall pictures they use ----------
    const T = draw => canvasTex(128, 128, draw, true), glass = (g, y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#a9d8f5'); gr.addColorStop(0.5, '#4a8cc6'); gr.addColorStop(1, '#224f86'); return gr; };
    tex.timber = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#4a3023'; g.fillRect(0, 0, 128, 8); g.fillRect(0, 120, 128, 8); g.fillRect(0, 0, 9, 128); g.fillRect(119, 0, 9, 128); g.fillRect(58, 8, 12, 14);
      g.fillStyle = '#e4dccb'; g.fillRect(30, 30, 68, 70); g.fillStyle = glass(g, 34, 96); g.fillRect(35, 35, 58, 60); g.fillStyle = '#e4dccb'; g.fillRect(62, 35, 4, 60); g.fillRect(35, 62, 58, 4); g.fillStyle = '#4a3023'; g.fillRect(22, 98, 84, 6);
      g.strokeStyle = '#4a3023'; g.lineWidth = 5; g.beginPath(); g.moveTo(9, 120); g.lineTo(30, 100); g.moveTo(119, 120); g.lineTo(98, 100); g.stroke(); });
    tex.cottage = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e8e2d6'; g.fillRect(0, 118, 128, 10); g.fillStyle = '#f7f7f7'; g.fillRect(36, 28, 56, 62); g.fillStyle = glass(g, 32, 86); g.fillRect(41, 33, 46, 52); g.fillStyle = '#f7f7f7'; g.fillRect(62, 33, 4, 52); g.fillStyle = '#9fb6c4'; g.fillRect(20, 28, 14, 62); g.fillRect(94, 28, 14, 62); g.fillStyle = '#d8d2c4'; g.fillRect(30, 92, 68, 6); });
    tex.stucco = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#efe6d4'; g.fillRect(0, 116, 128, 12); g.fillStyle = '#3d3a36'; g.beginPath(); g.moveTo(44, 96); g.lineTo(44, 52); g.quadraticCurveTo(64, 22, 84, 52); g.lineTo(84, 96); g.closePath(); g.fill(); g.fillStyle = '#6a8fae'; g.beginPath(); g.moveTo(49, 94); g.lineTo(49, 54); g.quadraticCurveTo(64, 30, 79, 54); g.lineTo(79, 94); g.closePath(); g.fill(); g.fillStyle = '#e8dcc4'; g.fillRect(62, 40, 4, 54); g.fillStyle = '#8a5a3c'; g.fillRect(24, 44, 14, 52); g.fillRect(90, 44, 14, 52); g.fillStyle = '#c9bda5'; g.fillRect(38, 98, 52, 6); });
    tex.row = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(0,0,0,.07)'; for (let y = 0; y < 128; y += 8) { g.fillRect(0, y, 128, 1); for (let x = (y / 8) % 2 * 8; x < 128; x += 16) g.fillRect(x, y, 1, 8); } g.fillStyle = '#f3efe6'; g.fillRect(14, 30, 36, 52); g.fillRect(78, 30, 36, 52); g.fillStyle = glass(g, 34, 78); g.fillRect(18, 34, 28, 44); g.fillRect(82, 34, 28, 44); g.fillStyle = '#f3efe6'; g.fillRect(30, 34, 3, 44); g.fillRect(94, 34, 3, 44); g.fillRect(10, 84, 44, 5); g.fillRect(74, 84, 44, 5); });
    tex.wall = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, 118, 128, 10); g.fillStyle = '#eef3f6'; g.fillRect(20, 26, 88, 70); g.fillStyle = glass(g, 30, 92); g.fillRect(25, 31, 78, 60); g.fillStyle = '#eef3f6'; g.fillRect(62, 31, 4, 60); });
    for (const k of ['timber', 'cottage', 'stucco', 'row', 'wall']) EXTRA_KINDS[k] = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, map: tex[k] });
    const STY = { // wall colours, roof colours, trim, which wall picture, roof shape, floors (min, max)
      timber: { walls: [0xf4ecd8, 0xe9ddc2, 0xf1e3ca, 0xdcd0b4, 0xf6efe0], roofs: [0x7a4a3a, 0x9a4a38, 0x5f6a74, 0x7a6a58, 0xa05a3c, 0x66584a], trim: 0xd9cdb4, tex: 'timber', roof: 'gable', floors: [2, 3], door: [0x2f5a8a, 0x2f7a55, 0x8a3a35, 0x3a3f48] },
      harbour: { walls: [0xf6d8d0, 0xfbe3a4, 0xcfe8ef, 0xe8f2d0, 0xf6c7b6, 0xdcecf5, 0xffe0c8], roofs: [0x2f6fa8, 0x3f8f9a, 0xc9573f, 0x4a5f7a, 0x7a4a3a], trim: 0xffffff, tex: 'cottage', roof: 'gable', floors: [1, 2], door: [0x2f5a8a, 0xc9573f, 0x2f8a7a, 0xf2b705] },
      terrace: { walls: [0xf7efe2, 0xf3e3c6, 0xefd9b8, 0xf9f4ea, 0xf0dcc0], roofs: [0xc8623b, 0xb9532f, 0xd2733f], trim: 0xe9dcc4, tex: 'stucco', roof: 'hip', floors: [2, 3], door: [0x6a4a35, 0x2f5a8a, 0x3f6a4a] },
      rows: { walls: [0xc27a5c, 0xb56b50, 0xcf8a66, 0xa95f48], roofs: [0x4a525c, 0x3d444d, 0x59616b], trim: 0xe8e0d0, tex: 'row', roof: 'gable', floors: [2, 2], door: [0x2f5a8a, 0x3a3f48, 0x8a3a35] },
      coral: { walls: [0xffd9b0, 0xbfe8e0, 0xffc2c2, 0xfff0a8, 0xcfe0ff, 0xffe2d0], roofs: [0xb08a56, 0x9a7646, 0xc89a60, 0x8a6a3e], trim: 0xffffff, tex: 'cottage', roof: 'hip', floors: [1, 2], door: [0x2f8a7a, 0xc9573f, 0x2e74c9] },
      farm: { walls: [0xf2e8d2, 0xe6d9b8, 0xf0e0c4, 0xd9c9a0], roofs: [0x8a4a34, 0x6e4a3a, 0x55606b], trim: 0xe2d6bc, tex: 'cottage', roof: 'gable', floors: [1, 2], door: [0x6a4a35, 0x2f5a8a, 0x3f6a4a] },
      works: { walls: [0xe3e6e8, 0xd8dde0, 0xf0f1f1], roofs: [0x5b6b7a, 0x4a5764], trim: 0xbfc4c8, tex: 'wall', roof: 'flat', floors: [2, 3], door: [0x3a3f48] } };

    // ---------- building recipes for the new towns: lean (a few boxes each), varied by palette, roof, floors and doors ----------
    const doorOf = (S, hv) => C(S.door[Math.floor(hv(4) * S.door.length) % S.door.length]);
    DRAW.lean = (b, M, w, d) => { // a house or a shop house: plinth, walls with windows, a roof, a door, sometimes an awning and a chimney
      const S = STY[b.style] || STY.timber, hv = k => hash(b.x * 1.3 + k * 7.1, b.z * 0.7 - k * 3.3);
      const wc = C(b.color || S.walls[Math.floor(hv(1) * S.walls.length) % S.walls.length]), rc = C(b.roof || S.roofs[Math.floor(hv(2) * S.roofs.length) % S.roofs.length]);
      const fl = b.floors || S.floors[0] + Math.floor(hv(3) * (S.floors[1] - S.floors[0] + 1)), fh = b.fh || 3.1, h = 0.45 + fl * fh, units = b.units || 1; b.floors = fl;
      const fd = b.found || 1.6; boxAt('trim', M, w + 0.3, fd + 0.45, d + 0.3, 0, -fd, 0, C(S.trim));
      walls(S.tex, M, w, d, 0.45, h, wc, b.bay || 3.2, fh);
      if (b.shop) { boxAt('detail', M, w * 0.9, 0.22, 1.6, 0, 2.7, d / 2 + 0.8, C(b.awn || [0xe8483f, 0x1f8f5b, 0x2e74c9, 0xf2a531, 0xd6458b][Math.floor(hv(6) * 5)])); if (b.sign != null) sign(M, b.sign, Math.min(7, w * 0.8), 0.95, 0, 3.4, d / 2 + 0.07); }
      const roof = b.roof || S.roof, rise = b.rise || Math.min(w, d) * 0.36;
      if (roof === 'gable') { if (b.gableFront) { const R = rotY(M); gable('trim', R, d - 0.02, w - 0.02, h, w * 0.34, wc, 0); gable('roof', R, d, w, h + 0.05, w * 0.34, rc, 0.5); } else { gable('trim', M, w - 0.02, d - 0.02, h, d * 0.34, wc, 0); gable('roof', M, w, d, h + 0.05, d * 0.34, rc, 0.5); } }
      else if (roof === 'hip') hip('roof', M, w, d, h + 0.3, rise, rc);
      else { boxAt('trim', M, w + 0.4, 0.5, d + 0.4, 0, h, 0, C(0xf2f0ea)); boxAt('roof', M, w - 0.3, 0.16, d - 0.3, 0, h + 0.4, 0, rc); }
      b.doorX = units > 1 ? -w / 2 + w / units / 2 : (hv(5) < 0.5 ? -1 : 1) * w * 0.2;
      for (let u = 0; u < units; u++) boxAt('trim', M, 1.2, 2.2, 0.3, units > 1 ? -w / 2 + (u + 0.5) * w / units : b.doorX, 0.45, d / 2 + 0.15, doorOf(S, k => hv(k + u)));
      if (roof !== 'flat') for (let u = 0; u < (units > 1 ? units : (hv(7) < 0.6 ? 1 : 0)); u++) boxAt('detail', M, 0.8, 2.2, 0.8, units > 1 ? -w / 2 + (u + 0.5) * w / units : w * 0.3, h + 0.8, -d * 0.1, C(0xa45a46));
      return h + (roof === 'gable' ? d * 0.34 : roof === 'hip' ? rise : 0.5) + 0.4;
    };
    DOOR.lean = 1;
    DRAW.church = (b, M, w, d) => { // a stone nave with a gabled roof, a square bell tower at the front with a spire and a clock
      const wc = C(b.color || 0xf1e8d6), rc = C(b.roof || 0x8a5a40), tw = 5.4, th = 17;
      boxAt('trim', M, w + 0.4, 2, d + 0.4, 0, -1.6, 0, C(0xcdbf9f)); walls('stucco', M, w, d, 0.4, 7.2, wc, 4.2, 3.6); gable('trim', M, w - 0.02, d - 0.02, 7.2, d * 0.28, wc, 0); gable('roof', M, w, d, 7.25, d * 0.28, rc, 0.5);
      const T = mul(M, 0, 0, d / 2 + tw / 2 - 0.2); boxAt('trim', T, tw + 0.5, 2, tw + 0.5, 0, -1.6, 0, C(0xcdbf9f)); walls('stucco', T, tw, tw, 0.4, th, wc, 4, 4.4); boxAt('trim', T, tw + 0.5, 0.5, tw + 0.5, 0, th, 0, C(0xf2eee6));
      geoAt('roof', new THREE.ConeGeometry(tw * 0.72, 8, 4), T, 0, th + 4.5, 0, rc, Math.PI / 4); boxAt('trim', T, 0.2, 2, 0.2, 0, th + 8.4, 0, C(0xe6d28a));
      for (const [ax, az, ry] of [[0, tw / 2 + 0.06, 0], [tw / 2 + 0.06, 0, Math.PI / 2], [-tw / 2 - 0.06, 0, -Math.PI / 2], [0, -tw / 2 - 0.06, Math.PI]]) { geoAt('trim', CYL, mul(T, ax, th - 3.2, az, ry), 0, 0, 0, C(0xfdfbf4), 0, 0.9, 0.12, 0.9); } // clock faces
      boxAt('trim', M, 2.4, 3.2, 0.3, 0, 0.4, d / 2 + tw - 0.1, C(0x6a4a35)); b.doorX = 0; b.doorZ = tw - 0.3; return th + 9;
    };
    DOOR.church = 1;
    DRAW.guildhall = (b, M, w, d) => { // the town hall: timber and plaster, a steep roof and a clock tower over the door
      const wc = C(0xf3e9d2), rc = C(0x6a4a3c); boxAt('trim', M, w + 0.4, 2.1, d + 0.4, 0, -1.6, 0, C(0xcdbf9f)); walls('timber', M, w, d, 0.5, 9.4, wc, 4, 4.5); gable('trim', M, w - 0.02, d - 0.02, 9.4, d * 0.36, wc, 0); gable('roof', M, w, d, 9.45, d * 0.36, rc, 0.7);
      const T = mul(M, 0, 0, d / 2 - 1.6); boxAt('trim', T, 4.4, 16, 4.4, 0, 6, 0, wc); boxAt('trim', T, 4.9, 0.5, 4.9, 0, 21.4, 0, C(0xf2eee6)); hip('roof', T, 4.4, 4.4, 21.9, 5, rc, 0.5);
      for (const [ax, az] of [[0, 2.26], [0, -2.26]]) geoAt('trim', CYL, mul(T, ax, 18, az, 0), 0, 0, 0, C(0xfdfbf4), 0, 1.1, 0.14, 1.1);
      for (const x of [-1.5, 0, 1.5]) boxAt('trim', M, 0.35, 3.4, 0.35, x * (w / 5), 0.5, d / 2 + 1.2, C(0xf2eee6)); boxAt('trim', M, w * 0.4, 0.4, 2.6, 0, 3.9, d / 2 + 0.9, C(0x6a4a3c)); b.doorX = 0; return 24;
    };
    DOOR.guildhall = 1;
    DRAW.markethall = (b, M, w, d) => { // a long open hall: columns, a low gabled roof, a stone floor
      boxAt('plaza', M, w + 2, 0.3, d + 2, 0, 0, 0, C(0xe6dcc8)); const n = Math.max(2, Math.round(w / 6));
      for (let i = 0; i <= n; i++) for (const s of [-1, 1]) boxAt('trim', M, 0.45, 4.6, 0.45, -w / 2 + i * w / n, 0.3, s * (d / 2 - 0.5), C(0xe9e0cf));
      gable('roof', M, w + 1, d + 1, 4.9, d * 0.28, C(b.roof || 0x8a5a40), 0.6); boxAt('trim', M, w + 1.4, 0.35, d + 1.4, 0, 4.7, 0, C(0xd9cdb4));
      for (let i = 0; i < n; i++) { boxAt('trim', M, 2.6, 0.9, 1.3, -w / 2 + (i + 0.5) * w / n, 0.3, 0, C(0xb58a5c)); boxAt('detail', M, 2.8, 0.14, 1.9, -w / 2 + (i + 0.5) * w / n, 2.6, 0, C(i % 2 ? 0xe8483f : 0xf2a531)); }
      if (b.sign != null) sign(M, b.sign, 6, 0.95, 0, 5.1, d / 2 + 0.7); return 7.5;
    };
    DRAW.marker = (b, M, w, d) => b.hh || 8; // a place with no body of its own (its buildings are drawn by hand): it can still be picked, named and visited

    // ---------- lots: houses and shops along the streets of a town, each facing its street, clear of roads, rivers, water and each other ----------
    const placed = [], lotIndex = new Map(), NOLOT = [], NOFIELD = []; // NOLOT: no houses here; NOFIELD: no fields here
    const rectCorners = (x, z, w, d, rot, m = 0) => { const c = Math.cos(rot), s = Math.sin(rot), out = []; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) { const lx = a * (w / 2 + m), lz = b * (d / 2 + m); out.push([x + lx * c + lz * s, z - lx * s + lz * c]); } return out; };
    const lkey = (i, j) => i + ',' + j, nearLots = (x, z) => { const out = [], i = Math.floor(x / 24), j = Math.floor(z / 24); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const r of lotIndex.get(lkey(i + a, j + b)) || []) out.push(r); return out; };
    const reserve = r => { placed.push(r); const k = lkey(Math.floor(r.x / 24), Math.floor(r.z / 24)); if (!lotIndex.has(k)) lotIndex.set(k, []); lotIndex.get(k).push(r); };
    const hitsLot = me => { for (const r of nearLots(me.x, me.z)) { if (rectCorners(r.x, r.z, r.w, r.d, r.rot).some(([px, pz]) => inR(px, pz, me)) || rectCorners(me.x, me.z, me.w, me.d, me.rot).some(([px, pz]) => inR(px, pz, r))) return true; } return false; };
    const inNoLot = (x, z) => NOLOT.some(r => x > r[0] && x < r[1] && z > r[2] && z < r[3]);
    const riverNear = (x, z, m = 12) => { const r = G.nearRiver(x, z); return r && r.d < Math.max(r.hw, 3.2) + m; };
    const WHY = {}, FIT = { range: 0 }; const no = r => { WHY[r] = (WHY[r] || 0) + 1; return false; };
    function fitsAt(x, z, w, d, rot, o = {}) { // does a lot of this size stand clear on level ground?
      const me = { x, z, w: w + 1.6, d: d + 1.6, rot }; let lo = 1e9, hi = -1e9;
      for (const [px, pz] of rectCorners(x, z, w, d, rot, 1.2)) { if (land(px, pz) < (o.coast || 16)) return no('coast'); if (nearRoad(px, pz)[0] < (o.road || 2.0)) return no('road'); if (riverNear(px, pz, o.river || 10)) return no('river'); if (inNoLot(px, pz)) return no('nolot'); if (blockedAt(px, pz, null)) return no('blocked'); const h = groundY(px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (hi - lo > (o.slope || 1.6)) return no('slope'); FIT.range = hi - lo; return hitsLot(me) ? no('overlap') : true;
    }
    function lotsAlong(e, T, out) { // lots down both sides of one street
      const N0 = e.a, N1 = e.b, s0 = (N0.deg >= 3 ? N0.r : 0) + (T.tight || 4), s1 = e.len - (N1.deg >= 3 ? N1.r : 0) - (T.tight || 4), walk = e.kind === 'villa' ? 1.6 : 2.6, R = rng(Math.floor(e.pts[0][0] * 7 + e.pts[0][2] * 13));
      const main = e.w >= (T.mainW || 9);
      for (const side of [-1, 1]) for (let s = s0; s < s1;) {
        const W = (main ? T.mw : T.w)[0] + R() * ((main ? T.mw : T.w)[1] - (main ? T.mw : T.w)[0]), D = (main ? T.md : T.d)[0] + R() * ((main ? T.md : T.d)[1] - (main ? T.md : T.d)[0]);
        const [x, y, z, ux, uz] = posAt(e, Math.min(s1, s + W / 2)), nx = -uz * side, nz = ux * side, off = e.w / 2 + walk + (T.setback || 3) + D / 2, cx = x + nx * off, cz = z + nz * off, rot = Math.atan2(-nx, -nz);
        if (fitsAt(cx, cz, W, D, rot, T)) { const lot = { x: cx, z: cz, w: W, d: D, rot, edge: e, main, side, found: Math.max(1.6, FIT.range + 0.9) }; reserve({ x: cx, z: cz, w: W + 1.2, d: D + 1.2, rot }); out.push(lot); s += W + (T.gap || 1.2); } else s += 3.5;
      }
    }
    function chainsOf(es) { // streets are chains of short edges: join the ones that meet end to end at a plain bend so a lot can run past the nodes
      const set = new Set(es), used = new Set(), out = [], other = (n, e) => n.deg === 2 ? n.edges.find(x => x !== e && set.has(x) && !used.has(x) && x.kind === e.kind && x.w === e.w) : null;
      for (const e0 of es) { if (used.has(e0)) continue; used.add(e0); const seq = [[e0, 1]]; // [edge, direction]
        for (let e = e0, n = e0.b; ;) { const nx = other(n, e); if (!nx) break; used.add(nx); const fwd = nx.a === n ? 1 : -1; seq.push([nx, fwd]); n = fwd > 0 ? nx.b : nx.a; e = nx; }
        for (let e = e0, n = e0.a; ;) { const nx = other(n, e); if (!nx) break; used.add(nx); const fwd = nx.b === n ? 1 : -1; seq.unshift([nx, fwd]); n = fwd > 0 ? nx.a : nx.b; e = nx; }
        const pts = []; for (const [e, dir] of seq) { const P = dir > 0 ? e.pts : e.pts.slice().reverse(); for (let i = pts.length ? 1 : 0; i < P.length; i++) pts.push(P[i]); }
        const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
        const first = seq[0], last = seq[seq.length - 1]; out.push({ id: e0.id, pts, cum, len: cum[cum.length - 1], w: e0.w, kind: e0.kind, a: first[1] > 0 ? first[0].a : first[0].b, b: last[1] > 0 ? last[0].b : last[0].a }); }
      return out;
    }
    const NAMES = ['High Street', 'Mill Lane', 'Church Row', 'Orchard Way', 'Market Street', 'Bridge Road', 'River Walk', 'Station Road', 'Quay Street', 'Green Lane', 'Chapel Street', 'Park Road'];
    function buildLots(town, T, esOverride) { // place the buildings of one town; returns what was built
      const R = rng(town.id.charCodeAt(0) * 131 + town.id.charCodeAt(1)), es = esOverride || edges.filter(e => e.opt && e.opt.town === town.id && e.kind !== 'bridge'), out = [], streetNo = new Map();
      for (const e of chainsOf(es)) lotsAlong(e, T, out);
      let built = 0;
      for (const l of out) {
        const key = l.edge.a.id + l.edge.b.id, nm = (streetNo.get(key) || 0) + 1; streetNo.set(key, nm); const shop = l.main && R() < (T.shop || 0), spec = T.pickType ? T.pickType(l, R, shop) : {};
        const b = addBuilding(Object.assign({ id: 'n' + town.id + (built++), type: T.type || 'lean', style: T.style, name: `${nm * 2 + (l.side > 0 ? 1 : 0)} ${NAMES[(l.edge.id * 7) % NAMES.length]}`, area: town.name, x: l.x, z: l.z, y: groundY(l.x, l.z), rot: l.rot, w: Math.round(l.w * 2) / 2, d: Math.round(l.d * 2) / 2, shop, sign: shop ? T.signs[Math.floor(R() * T.signs.length)] : null, owner: 'city', found: l.found, gableFront: T.gableFront ? R() < T.gableFront : false, units: spec.units }, spec.b || {}));
        LOTS.push({ x: l.x, z: l.z, w: l.w + 2.5, d: l.d + 6, rot: l.rot });
      }
      return built;
    }

    // ---------- Millford: a market town on the plain: timber-framed houses and shops round a market square, a church and a town hall ----------
    function millford() {
      const town = G.NEW_TOWNS.find(t => t.id === 'ML'); if (!town) return; const cx = town.cx, cz = town.cz;
      const SQ = [cx, cx + 36, cz - 38, cz], CH = [cx - 62, cx - 40, cz - 36, cz - 8]; NOLOT.push(SQ, CH); NOFIELD.push([cx - 100, cx + 112, cz - 62, cz + 62]); keepClear(cx - 100, cx + 100, cz - 60, cz + 60);
      // the square: paving, a fountain, stalls, benches
      const sx = cx + 18, sz = cz - 19; slab(sx, sz, 30, 17, 0xe6dcc8, { y: groundY(sx, sz) + 0.13 }); slab(sx, sz, 12, 12, 0xd9c9a8, { y: groundY(sx, sz) + 0.15, tile: 2 });
      { const M = new THREE.Matrix4().setPosition(sx, groundY(sx, sz), sz); tileAt(sx, sz); geoAt('trim', CYL, M, 0, 0.5, 0, C(0xcfc8ba), 0, 3.4, 0.9, 3.4); geoAt('water', CYL, M, 0, 0.95, 0, C(0x4fc3e8), 0, 3, 0.1, 3); geoAt('trim', CYL8, M, 0, 1.8, 0, C(0xcfc8ba), 0, 0.45, 2.6, 0.45); geoAt('water', CYL, M, 0, 3.2, 0, C(0x4fc3e8), 0, 1.3, 0.2, 1.3); }
      for (let i = 0; i < 4; i++) { const x = sx - 10.5 + i * 7; stall(x, sz + 6.5, Math.PI, [0xe8483f, 0x1f8f5b, 0x2e74c9, 0xf2a531, 0xd6458b][i]); }
      for (const [x, z, ry] of [[sx - 7, sz - 2, Math.PI / 2], [sx + 7, sz - 2, -Math.PI / 2], [sx - 7, sz + 2, Math.PI / 2], [sx + 7, sz + 2, -Math.PI / 2]]) bench(x, z, ry, groundY(x, z) + 0.13);
      for (const [x, z] of [[sx - 14, sz - 6], [sx + 14, sz - 6], [sx - 14, sz + 3], [sx + 14, sz + 3]]) planter(x, z, 2.4, 2.4, 'round', groundY(x, z) + 0.13);
      // the town hall on the north edge, the market hall on the south edge, the church to the west
      addBuilding({ id: 'mlhall', type: 'guildhall', name: 'Millford Town Hall', area: 'Millford', x: sx, z: cz - 32, y: groundY(sx, cz - 32), rot: 0, w: 20, d: 10, owner: 'city' });
      addBuilding({ id: 'mlmarket', type: 'markethall', name: 'Millford Market Hall', area: 'Millford', x: sx, z: cz - 9, y: groundY(sx, cz - 9), rot: Math.PI, w: 24, d: 8, sign: SG['MARKET HALL'], owner: 'city', noPath: true });
      addBuilding({ id: 'mlchurch', type: 'church', name: "St Mary's Church", area: 'Millford', x: cx - 51, z: cz - 26, y: groundY(cx - 51, cz - 26), rot: 0, w: 10, d: 18, owner: 'city' });
      LABELS.push({ text: 'Millford', level: 'district', x: cx, y: 40, z: cz }, { text: 'Market Square', level: 'place', x: sx, y: 12, z: sz }, { text: 'Millford Town Hall', level: 'place', x: sx, y: 30, z: cz - 32, small: true });
      const n = buildLots(town, { style: 'timber', w: [8, 10], d: [10, 12], mw: [9, 12], md: [11, 13], mainW: 9, setback: 3, shop: 0.8, gableFront: 0.45, slope: 1.8, road: 2.2, signs: [SG.BUTCHER, SG.HARDWARE, SG['TEA ROOMS'], SG.GROCER, SG.BAKERY, SG.BOOKS, SG['POST OFFICE'], SG.PHARMACY] });
      WORKS.millford = { lots: n, square: [sx, sz] }; lap('millford');
    }

    // ---------- small boats, net racks and other harbour things ----------
    function boat(x, z, ry, len = 8, c1 = 0xffffff, c2 = 0x2e74c9, y = 0.25) { // a fishing boat lying on the water
      const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z); tileAt(x, z); boxAt('trim', M, len * 0.3, 0.9, len * 0.86, 0, -0.3, 0, C(c1)); boxAt('trim', M, len * 0.22, 0.9, len * 0.2, 0, -0.3, len * 0.5, C(c1), 0.4); boxAt('trim', M, len * 0.22, 0.9, len * 0.2, 0, -0.3, len * 0.5, C(c1), -0.4);
      boxAt('trim', M, len * 0.3, 0.25, len * 0.86, 0, 0.55, 0, C(c2)); boxAt('trim', M, len * 0.2, 1.1, len * 0.2, 0, 0.8, -len * 0.18, C(0xf2efe6)); boxAt('trim', M, 0.12, 2.6, 0.12, 0, 0.8, len * 0.12, C(0xd8d8d8));
    }
    function pier(x0, z0, x1, z1, w, deckY = 1.1) { // a jetty on piles from the shore out over the water
      const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), M = new THREE.Matrix4().makeRotationY(ry).setPosition(x0, 0, z0); tileAt(x0, z0);
      boxAt('trim', M, w, 0.35, L, 0, deckY - 0.35, L / 2, C(0xb08559)); for (let s = 3; s < L; s += 6) for (const sd of [-1, 1]) boxAt('trim', M, 0.4, deckY + 5, 0.4, sd * (w / 2 - 0.3), -5, s, C(0x6b4a33)); for (let s = 5; s < L; s += 10) for (const sd of [-1, 1]) boxAt('trim', M, 0.3, 0.45, 0.3, sd * (w / 2 - 0.15), deckY, s, C(0x3a4150));
      return { x: x1, z: z1, ry };
    }
    function netRack(x, z, ry, y) { const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z); tileAt(x, z); for (const s of [-1.5, 0, 1.5]) boxAt('trim', M, 0.16, 2.4, 0.16, s, 0, 0, C(0x6b4a33)); boxAt('trim', M, 3.4, 0.12, 0.12, 0, 2.3, 0, C(0x6b4a33)); boxAt('detail', M, 3.2, 1.6, 0.06, 0, 0.7, 0, C(0x7fa3b0)); }
    function shoreFrom(x, z, dx, dz, max = 140) { let s = 0; while (s < max && land(x + dx * s, z + dz * s) > 2.2) s += 1; return [x + dx * s, z + dz * s, s]; }

    // ---------- Northhaven: a fishing town round the head of a bay: curving quay street, pastel cottages, a pier with boats, a fish market ----------
    function northhaven() {
      const town = G.NEW_TOWNS.find(t => t.id === 'NH'); if (!town) return; const cx = -60, cz = -880; keepClear(-170, 50, -960, -840); NOFIELD.push([-170, 50, -960, -846]);
      const pieces = []; // the fish market stands on the quay street
      const fm = addBuilding({ id: 'nhfish', type: 'markethall', name: 'Northhaven Fish Market', area: 'Northhaven', x: -86, z: -873, y: groundY(-86, -873), rot: Math.PI, w: 16, d: 7, sign: SG['FISH MARKET'], owner: 'city', noPath: true, roof: 0x2f6fa8 });
      NOLOT.push([-96, -76, -880, -866]);
      const n = buildLots(town, { style: 'harbour', w: [7, 9], d: [8, 10], mw: [8, 10], md: [9, 10], mainW: 8, setback: 2.4, shop: 0.55, gableFront: 0.5, slope: 2.4, road: 2.0, coast: 22, river: 6, signs: [SG['FISH & CHIPS'], SG.CHANDLER, SG['CAFÉ'], SG['ICE HOUSE'], SG.SMOKEHOUSE, SG.NETS, SG.BAKERY] });
      // a pier out from the quay street, boats alongside, net racks on the beach
      const p0 = shoreFrom(-40, -890, 0.1, -1); const e = pier(p0[0] - 2, p0[1] + 6, p0[0] + 3, p0[1] - 34, 4.4); const cols = [[0xffffff, 0x2e74c9], [0xf4efe6, 0xd8392b], [0xffe9a8, 0x1f8f5b], [0xe8f2f6, 0x2f6fa8]];
      for (let i = 0; i < 5; i++) { const side = i % 2 ? -1 : 1, z = p0[1] - 4 - i * 6; boat(p0[0] + 0.5 + side * 5, z, Math.PI / 2 * 0 + 0.05 * side, 7 + (i % 3), ...cols[i % 4]); }
      for (let i = 0; i < 4; i++) { const bx = -110 + i * 14, s = shoreFrom(bx, -905, 0, -1); netRack(bx, s[1] + 6, 0.1, groundY(bx, s[1] + 6)); }
      boat(-90, shoreFrom(-90, -905, 0, -1)[1] + 4, 0.3, 6, 0xffffff, 0x2e74c9, groundY(-90, shoreFrom(-90, -905, 0, -1)[1] + 4) + 0.3);
      LABELS.push({ text: 'Northhaven', level: 'district', x: cx, y: 30, z: cz }, { text: 'Fish Market', level: 'place', x: -86, y: 12, z: -873, small: true });
      WORKS.northhaven = { lots: n, pier: [p0[0], p0[1]] }; lap('northhaven');
    }

    // ---------- Eastgate: the workers' town by the works: brown brick terraces with chimneys, a corner pub, a chapel ----------
    function eastgate() {
      const town = G.NEW_TOWNS.find(t => t.id === 'EG'); if (!town) return; keepClear(610, 880, -660, -460);
      const n = buildLots(town, { style: 'rows', w: [22, 33], d: [9, 10], mw: [22, 33], md: [9, 10], mainW: 8, setback: 1.6, tight: 2.5, shop: 0.12, slope: 1.2, road: 2.0, river: 8, signs: [SG['CAFÉ'], SG.GROCER, SG.BUTCHER, SG.HARDWARE], pickType: (l, R, shop) => { const units = Math.max(3, Math.floor(l.w / 5.5)); l.w = units * 5.5; return { units, b: { bay: 5.5, noPath: true, w: l.w } }; } });
      WORKS.eastgate = { lots: n }; LABELS.push({ text: 'Eastgate', level: 'district', x: town.cx + 60, y: 30, z: town.cz }); lap('eastgate');
    }

    // ---------- Hillcrest: a hill town: plaster houses with terracotta roofs stepping up the contour streets to a church ----------
    function hillcrest() {
      const town = G.NEW_TOWNS.find(t => t.id === 'HC'); if (!town) return; keepClear(-420, -320, -730, -630);
      let w0 = Object.assign({}, WHY), n = buildLots(town, { style: 'terrace', w: [7, 9], d: [7, 8.5], mw: [7, 9], md: [7, 8.5], mainW: 8, shop: 0.2, slope: 10, road: 0.3, coast: 10, river: 5, tight: 1.5, setback: 1.2, signs: [SG.POTTERY, SG.WINE, SG['OLIVE OIL'], SG['TEA ROOMS']] });
      // the church at the top of the hill: the highest street node with room
      let best = null; for (const id of town.nodes) { const N = nodes[id]; if (N && (!best || N.y > best.y) && N.deg >= 1) best = N; }
      if (best) { const x = best.x - 14, z = best.z; if (fitsAt(x, z, 10, 17, -Math.PI / 2, { slope: 6 })) { reserve({ x, z, w: 12, d: 19, rot: -Math.PI / 2 }); addBuilding({ id: 'hcchurch', type: 'church', name: 'Hillcrest Church', area: 'Hillcrest', x, z, y: groundY(x, z), rot: -Math.PI / 2, w: 10, d: 17, owner: 'city', noPath: true }); LABELS.push({ text: 'Hillcrest Church', level: 'place', x, y: 40, z, small: true }); } }
            // the village: houses scattered round the church and the street, each facing the middle, wherever the hill is gentle enough
      { const R2 = rng(4242), hx = town.cx + 8, hz = town.cz + 10; let k = 0; for (let i = 0; i < 400 && k < 30; i++) { const a = R2() * Math.PI * 2, r = 14 + Math.sqrt(R2()) * 78, x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r * 0.85, w = 7.5 + R2() * 2.5, d = 7 + R2() * 1.6, rot = Math.atan2(hx - x, hz - z) + (R2() - 0.5) * 0.6;
        if (!fitsAt(x, z, w, d, rot, { slope: 5.5, road: 3, coast: 12, river: 6 })) continue; reserve({ x, z, w: w + 1.6, d: d + 1.6, rot }); LOTS.push({ x, z, w: w + 2.5, d: d + 6, rot });
        addBuilding({ id: 'hcv' + k, type: 'lean', style: 'terrace', name: (k + 1) + ' ' + NAMES[(k * 7 + 3) % NAMES.length], area: 'Hillcrest', x, z, y: groundY(x, z), rot, w: Math.round(w * 2) / 2, d: Math.round(d * 2) / 2, shop: k % 9 === 4, sign: k % 9 === 4 ? [SG.POTTERY, SG.WINE, SG['OLIVE OIL'], SG['TEA ROOMS']][k % 4] : null, owner: 'city', found: 2 }); k++; } n += k; }
      const df = {}; for (const k in WHY) if (WHY[k] !== (w0[k] || 0)) df[k] = WHY[k] - (w0[k] || 0); WORKS.hillcrest = { lots: n, why: df }; LABELS.push({ text: 'Hillcrest', level: 'district', x: town.cx, y: 50, z: town.cz }); lap('hillcrest');
    }

    // ---------- the farmland on the northern plain: holdings with a farmhouse, a barn and silos, fields in different crops with hedgerows, an orchard, a grain store ----------
    const rotAt = (nodeId) => { const N = nodes[nodeId]; if (!N) return null; const e = N.edges[0], o = e.a === N ? e.b : e.a, dx = o.x - N.x, dz = o.z - N.z, rot = Math.atan2(dx, dz); return { x: N.x, z: N.z, rot, y: groundY(N.x, N.z) }; };
    const FW = {}; const fno = r => { FW[r] = (FW[r] || 0) + 1; return false; };
    function fieldFits(x, z, W, D, ry) { const me = { x, z, w: W + 3, d: D + 3, rot: ry }; let lo = 1e9, hi = -1e9; for (const [px, pz] of rectCorners(x, z, W, D, ry, 2)) { if (land(px, pz) < 18) return fno('coast'); if (nearRoad(px, pz)[0] < 1.6) return fno('road'); if (riverNear(px, pz, 5)) return fno('river'); if (inNoLot(px, pz) || NOFIELD.some(r => px > r[0] && px < r[1] && pz > r[2] && pz < r[3])) return fno('town'); if (blockedAt(px, pz, null)) return fno('blocked'); const h = groundY(px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h); } if (hi - lo > 2.4) return fno('slope'); if (hitsLot(me)) return fno('overlap'); reserve(me); return true; }
    function windpump(M, x, z) { const T = mul(M, x, 0, z); for (const [a, b] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) boxAt('trim', T, 0.16, 11, 0.16, a * 0.7, 0, b * 0.7, C(0xaeb6bd)); boxAt('trim', T, 2.2, 0.2, 2.2, 0, 10.8, 0, C(0xaeb6bd)); for (let i = 0; i < 8; i++) boxAt('detail', mul(T, 0, 12.2, 0.9, i * Math.PI / 4), 0.35, 2.6, 0.06, 0, 0, 0, C(0xe8eaec)); geoAt('trim', CYL8, T, 0, 12.2, 0.8, C(0xd8392b), 0, 0.3, 0.4, 0.3); }
    function silo(M, x, z, r = 3, h = 16, c = 0xd9dde0) { geoAt('metal', CYL, M, x, h / 2, z, C(c), 0, r, h, r); geoAt('metal', new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M, x, h, z, C(0x9aa3ab)); boxAt('trim', M, 0.3, h, 0.3, x + r + 0.1, 0, z, C(0x8a939c)); }
    function holding(id, name, kinds, seedN) {
      const S = rotAt(id); if (!S) return; const R = rng(seedN), ry = S.rot, c = Math.cos(ry), s = Math.sin(ry), L = (lx, lz) => [S.x + lx * c + lz * s, S.z - lx * s + lz * c], Mat = (lx, lz, extra = 0) => { const [x, z] = L(lx, lz); return new THREE.Matrix4().makeRotationY(ry + extra).setPosition(x, groundY(x, z), z); };
      const yard = L(0, -9); reserve({ x: yard[0], z: yard[1], w: 40, d: 40, rot: ry }); keepClear(yard[0] - 70, yard[0] + 70, yard[1] - 70, yard[1] + 70);
      { const [x, z] = yard; tileAt(x, z); boxAt('lawn', new THREE.Matrix4().makeRotationY(ry).setPosition(x, groundY(x, z), z), 34, 0.14, 24, 0, 0, 0, C(0xc4ad84)); } // the packed gravel yard
      const hp = L(-13, -8), hb = L(11, -18), hs = L(-13, -19);
      const h = addBuilding({ id: 'farm' + id, type: 'lean', style: 'farm', name: name + ' farmhouse', area: 'Greenfields plain', x: hp[0], z: hp[1], y: groundY(hp[0], hp[1]), rot: ry, w: 10, d: 8, floors: 2, owner: 'city', gableFront: 0 });
      addBuilding({ id: 'barn' + id, type: 'barn', name: name + ' barn', area: 'Greenfields plain', x: hb[0], z: hb[1], y: groundY(hb[0], hb[1]), rot: ry, w: 16, d: 11, owner: 'city', noPath: true }); LOTS.push({ x: hp[0], z: hp[1], w: 14, d: 12, rot: ry });
      shelter(Mat(0, 0), -13, -19, 0); tractor(Mat(0, 0), 2, -12, ry * 0 + 0.4, 0xd8392b); windpump(Mat(0, 0), 20, -6);
      LABELS.push({ text: name, level: 'place', x: S.x, y: 14, z: S.z, small: true });
      // the fields round the yard, each with a hedgerow and a gate, in a few different crops
      const slots = [[-46, -8, 34, 30], [46, -8, 34, 30], [0, -52, 44, 30], [-46, -46, 34, 30], [46, -46, 34, 30], [-46, 30, 34, 28], [46, 30, 34, 28], [0, -88, 44, 30]]; let k = 0, n = 0;
      for (const [lx, lz, W, D] of slots) { const [x, z] = L(lx, lz); if (!fieldFits(x, z, W, D, ry)) continue; const kind = kinds[k++ % kinds.length], st = ['ripe', 'grow', 'ripe', 'stubble', 'sown', 'grow', 'bare'][Math.floor(R() * 7)], M = Mat(lx, lz); tileAt(x, z); crop(M, W, D, kind, st); hedgerow(M, W, D, true); n++;
        if (R() < 0.3 && kind !== 'orchard' && kind !== 'pasture') tractor(M, (R() - 0.5) * W * 0.5, (R() - 0.5) * D * 0.4, R() * 6, R() < 0.5 ? 0xd8392b : 0x2f8f3a);
        for (let t = -W / 2 + 6; t < W / 2 - 4; t += 13) { const p = new THREE.Vector3(t, 0, D / 2 + 0.6).applyMatrix4(M); extraTrees.push([p.x, groundY(p.x, p.z), p.z, 0.7 + R() * 0.25, 'round']); } }
      return n;
    }
    function grainStore(id) { // silos with a conveyor, a drying shed and a weighbridge beside the road to Millford
      const S = rotAt(id); if (!S) return; const ry = S.rot, c = Math.cos(ry), s = Math.sin(ry), L = (lx, lz) => [S.x + lx * c + lz * s, S.z - lx * s + lz * c], Mat = (lx, lz) => { const [x, z] = L(lx, lz); return new THREE.Matrix4().makeRotationY(ry).setPosition(x, groundY(x, z), z); };
      const yard = L(0, -14); reserve({ x: yard[0], z: yard[1], w: 54, d: 44, rot: ry }); keepClear(yard[0] - 40, yard[0] + 40, yard[1] - 40, yard[1] + 40); tileAt(yard[0], yard[1]); boxAt('lawn', Mat(0, -14), 46, 0.14, 34, 0, 0, 0, C(0xb7b3aa));
      const M = Mat(0, -14); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) silo(M, -13 + i * 9.5, -8 + j * 9.5, 3.6, 18 + (i + j) % 2 * 3);
      boxAt('trim', M, 4, 0.7, 28, 13, 15, -2, C(0x8a939c), 0.0); // the conveyor between the silo tops and the shed
      const b = L(14, -18); addBuilding({ id: 'grainstore', type: 'lean', style: 'works', name: 'Millford Grain Store', area: 'Greenfields plain', x: b[0], z: b[1], y: groundY(b[0], b[1]), rot: ry, w: 18, d: 12, floors: 2, owner: 'city', roof: 'flat', shop: true, sign: SG['GRAIN STORE'], noPath: true });
      boxAt('trim', M, 3.2, 0.3, 8, -18, 0, 12, C(0x7a8087)); boxAt('trim', M, 3, 3, 3, -18, 0, 6, C(0xd9d3c6)); // the weighbridge and its office
      LABELS.push({ text: 'Grain Store', level: 'place', x: S.x, y: 18, z: S.z, small: true }); return 1;
    }
    function fieldMosaic([z0, z1, x0, x1]) { // the rest of the plain is a patchwork of fields in different crops, each inside a hedgerow
      const R = rng(99), KINDS = ['wheat', 'wheat', 'corn', 'corn', 'sun', 'veg', 'pasture', 'pasture', 'orchard', 'veg']; let n = 0;
      for (let z = z0; z < z1; z += 36) for (let x = x0; x < x1; x += 42) { const cx = x + 21, cz = z + 18; if (G.zoneMask('farm', cx, cz) < 0.55) continue; if (!fieldFits(cx, cz, 36, 30, 0)) continue;
        const kind = KINDS[Math.floor((hash(cx * 0.31, cz * 0.17) * 10)) % KINDS.length], st = ['ripe', 'grow', 'ripe', 'stubble', 'sown', 'grow', 'bare'][Math.floor(R() * 7)], M = new THREE.Matrix4().setPosition(cx, groundY(cx, cz), cz); tileAt(cx, cz); crop(M, 36, 30, kind, st); hedgerow(M, 36, 30, true); n++;
        if (R() < 0.18 && kind !== 'orchard' && kind !== 'pasture') tractor(M, (R() - 0.5) * 20, (R() - 0.5) * 14, R() * 6, R() < 0.5 ? 0xd8392b : 0x2f8f3a);
        for (let t = -13; t < 13; t += 12) extraTrees.push([cx + t, groundY(cx + t, cz + 15.6), cz + 15.6, 0.7 + R() * 0.25, 'round']); }
      return n;
    }
    function farms() {
      const a = holding('FM1', 'Brook Farm', ['wheat', 'corn', 'pasture', 'wheat', 'orchard', 'veg'], 11), b = holding('FM2', 'Hill Farm', ['corn', 'sun', 'wheat', 'pasture', 'veg', 'corn'], 12), cc = holding('FM3', 'Millbrook Farm', ['veg', 'orchard', 'wheat', 'sun', 'pasture'], 13), d = holding('FM4', 'Orchard Farm', ['orchard', 'veg', 'orchard', 'pasture', 'wheat'], 14), e5 = holding('FM5', 'Eastbrook Farm', ['wheat', 'corn', 'sun', 'pasture', 'veg', 'orchard'], 15), g = grainStore('GR'); const mosaic = fieldMosaic([-930, -730, -300, 290]) + fieldMosaic([-480, -340, 770, 1090]);
      WORKS.farms = { fields: (a || 0) + (b || 0) + (cc || 0) + (d || 0) + (e5 || 0) + mosaic, store: g }; LABELS.push({ text: 'Greenfields plain', level: 'district', x: -20, y: 40, z: -850 }); lap('farms');
    }

    // ---------- East Island's works estate: factories, a recycling plant, a cold store, warehouses, a freight yard, a tank farm, each in its own block of the works grid ----------
    const bxs = (M, w, h, d, x, y, z, c, ry = 0) => boxAt('trim', M, w, h, d, x, y, z, C(c), ry);
    const CONT = [0xd8392b, 0x2e74c9, 0xf2a531, 0x1f8f5b, 0xe8e0d0, 0x8a4fd6, 0x2fb7c4, 0x3a4a5a, 0xc0392b];
    DRAW.factory = (b, M, w, d) => { // a long hall with a row of ridged roofs, dock doors on the front, an office end and sometimes a tall chimney
      const c = C(b.color || 0xdfe3e6), rc = C(b.roof || 0x5b6b7a), fl = b.fh || 8;
      boxAt('trim', M, w + 0.4, 0.5, d + 0.4, 0, 0, 0, C(0xb8b8b0)); walls('shed', M, w, d, 0.5, fl, c, 4, 7.5);
      const n = Math.max(3, Math.round(w / 9)); for (let k = 0; k < n; k++) { const x = -w / 2 + (k + 0.5) * w / n; gable('roof', rotY(mul(M, x, 0, 0)), d, w / n, fl, 3.2, rc, 0.15); boxAt('glassy', M, 0.12, 1.8, d * 0.9, x - w / n * 0.2, fl + 0.4, 0, C(0xbfe6ff)); }
      for (let k = 0; k < Math.floor(w / 10); k++) { boxAt('trim', M, 4, 4.4, 0.3, -w / 2 + 5 + k * 10, 0.5, d / 2 + 0.15, C(0x39485a)); boxAt('trim', M, 4.4, 0.25, 2.6, -w / 2 + 5 + k * 10, 4.9, d / 2 + 1.3, C(0xd8392b)); }
      boxAt('trim', M, 12, 4, 8, w / 2 - 6, 0.5, d / 2 + 4.2, C(0xf2f0ea)); boxAt('roof', M, 12.4, 0.3, 8.4, w / 2 - 6, 4.5, d / 2 + 4.2, C(0x6a7480)); boxAt('glassy', M, 10, 1.6, 0.1, w / 2 - 6, 1.6, d / 2 + 8.25, C(0xbfe6ff));
      if (b.stack) { geoAt('trim', CYL, M, -w / 2 + 6, 15, -d / 4, C(0xe3ddd0), 0, 1.5, 30, 1.5); for (const y of [20, 26]) geoAt('trim', CYL, M, -w / 2 + 6, y, -d / 4, C(0xd8392b), 0, 1.58, 3, 1.58); }
      if (b.sign != null) sign(M, b.sign, 8, 1.2, 0, 7.3, d / 2 + 0.07); return fl + 4;
    };
    DRAW.coldstore = (b, M, w, d) => { boxAt('trim', M, w + 0.4, 0.5, d + 0.4, 0, 0, 0, C(0xb8b8b0)); walls('shed', M, w, d, 0.5, 11, C(0xf2f6f8), 5, 10); boxAt('trim', M, w + 0.2, 1.6, d + 0.2, 0, 7, 0, C(0x2e74c9)); boxAt('roof', M, w + 0.4, 0.4, d + 0.4, 0, 11, 0, C(0xcfd6dc));
      for (let k = 0; k < 4; k++) { boxAt('trim', M, 4, 2.2, 3, -w / 2 + 7 + k * (w - 14) / 3, 11.4, 0, C(0xa8b0b8)); geoAt('trim', CYL8, M, -w / 2 + 7 + k * (w - 14) / 3, 13.6, 0, C(0x7a838c), 0, 1.3, 0.4, 1.3); }
      for (let k = 0; k < 3; k++) boxAt('trim', M, 4, 4.2, 0.3, -w / 2 + 8 + k * (w - 16) / 2, 0.5, d / 2 + 0.15, C(0x39485a)); if (b.sign != null) sign(M, b.sign, 8, 1.2, 0, 9.5, d / 2 + 0.07); return 14; };
    DRAW.steelworks = (b, M, w, d) => { boxAt('trim', M, w + 0.4, 0.5, d + 0.4, 0, 0, 0, C(0xa9a69e)); walls('shed', M, w, d, 0.5, 13, C(0x9aa5ad), 5, 12.5); gable('roof', M, w, d, 13, 4.5, C(0x4d5863), 0.4); for (let k = 0; k < 3; k++) { boxAt('trim', M, 0.6, 12, 0.6, -w / 2 + 6 + k * w / 3, 0.5, d / 2 + 0.9, C(0x6a7480)); }
      boxAt('trim', M, w * 0.8, 0.8, 1.2, 0, 11.5, d / 2 + 0.9, C(0x6a7480)); geoAt('trim', CYL, M, w / 2 - 5, 18, -d / 3, C(0xcfc6b8), 0, 2.4, 36, 2.4); geoAt('trim', CYL, M, w / 2 - 5, 34, -d / 3, C(0xd8392b), 0, 2.5, 4, 2.5);
      for (let k = 0; k < 6; k++) boxAt('trim', M, 1.4, 1.4, 5, -w / 2 + 6 + k * 2, 0.5, d / 2 + 10, C(k % 2 ? 0x8a939c : 0xb9c0c6)); if (b.sign != null) sign(M, b.sign, 8, 1.2, 0, 9.5, d / 2 + 0.07); return 20; };
    function plotApron(M, w, d, c = 0xb9b6ae) { boxAt('lawn', M, w, 0.14, d, 0, 0.0, 0, C(c)); }
    function tankFarm(M, w, d) { plotApron(M, w, d, 0xaaa79f); const n = 3; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { const x = -w / 2 + w / (n * 2) + i * w / n + 2, z = -d / 4 + j * d / 2.2 - 2; geoAt('metal', CYL, M, x, 5.5, z, C(0xe8ebed), 0, 7, 11, 7); geoAt('metal', new THREE.CylinderGeometry(1, 1.05, 1, 20), M, x, 11.2, z, C(0x8a939c), 0, 7.1, 0.4, 7.1); boxAt('trim', M, 0.3, 11, 0.3, x + 7.3, 0, z, C(0x6a7480)); }
      frameAt('trim', M, w - 2, d - 2, 1.4, 0.6, 0, 0, C(0xc9c3b6)); boxAt('trim', M, 8, 4, 6, w / 2 - 8, 0, d / 2 - 5, C(0xd8392b)); geoAt('trim', CYL8, M, -w / 2 + 3, 12, d / 2 - 3, C(0x8a939c), 0, 0.5, 24, 0.5); boxAt('glow', M, 1.2, 1.2, 1.2, -w / 2 + 3, 24, d / 2 - 3, C(0xff7a2f)); }
    function recyclingYard(M, w, d, R) { plotApron(M, w, d, 0xa5a198); for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) { const x = -w / 2 + 5 + i * 3.2, z = -d / 2 + 5 + j * 3.2, h = 1.2 + (R() * 3 | 0) * 1.2; boxAt('trim', M, 2.8, h, 2.8, x, 0, z, C([0x8a939c, 0xa8774a, 0x3f7fb5, 0xb8b0a0][(i + j * 2) % 4])); }
      for (let i = 0; i < 4; i++) geoAt('trim', new THREE.ConeGeometry(4 + R() * 2, 4 + R() * 2.5, 7), M, -w / 2 + 28 + (i % 2) * 11, 2.2, -d / 2 + 8 + (i >> 1) * 12, C([0x6d5a4a, 0x7b7b7b, 0x8c6f4e, 0x565d63][i]), R() * 6);
      boxAt('trim', M, 16, 9, 12, w / 2 - 12, 0, -d / 4, C(0x7a8a99)); gable('roof', M, 16, 12, 9, 2.6, C(0x4a5764), 0.3); boxAt('trim', M, 3, 3, 6, w / 2 - 12, 9, -d / 4 + 9, C(0xd8a32a), 0.0); boxAt('trim', M, 1.4, 0.5, 12, w / 2 - 12, 7.5, -d / 4 + 14, C(0x39485a));
      for (const sx of [-1, 1]) { boxAt('trim', M, 0.8, 14, 0.8, w / 4 + sx * 8, 0, d / 4, C(0xd8a32a)); } boxAt('trim', M, 17, 0.8, 1.2, w / 4, 13.2, d / 4, C(0xd8a32a)); boxAt('trim', M, 0.3, 4, 0.3, w / 4, 9.2, d / 4, C(0x39485a)); boxAt('trim', M, 2.4, 1.4, 2.4, w / 4, 7.8, d / 4, C(0x8a939c));
      for (let i = 0; i < 4; i++) boxAt('trim', M, 3.2, 1.6, 2, w / 2 - 4, 0, d / 4 + 5 + i * 3.4, C([0x2f8f3a, 0x2e74c9, 0xc0392b, 0x8a939c][i])); }
    function freightYard(M, w, d, R) { plotApron(M, w, d, 0xb3b1aa); for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const x = -w / 2 + 6 + i * 8.2, z = -d / 2 + 6 + j * 6.4, h = 1 + (R() * 3 | 0); if (R() < 0.12) continue; for (let k = 0; k < h; k++) boxAt('trim', M, 6.1, 2.5, 2.4, x, k * 2.5, z, C(CONT[(i * 3 + j * 5 + k) % CONT.length])); }
      for (const z of [-d / 2 + 9.5, -d / 2 + 22]) { for (const sx of [-1, 1]) boxAt('trim', M, 0.8, 11, 0.8, sx * (w / 2 - 6), 0, z, C(0xd8a32a)); boxAt('trim', M, w - 10, 1, 1.6, 0, 10.4, z, C(0xd8a32a)); }
      boxAt('trim', M, 9, 3, 3.2, w / 2 - 8, 0, d / 2 - 4, C(0xf2f0ea)); boxAt('roof', M, 9.4, 0.3, 3.6, w / 2 - 8, 3, d / 2 - 4, C(0x6a7480)); for (let i = 0; i < 3; i++) boxAt('trim', M, 2.5, 3, 7, -w / 2 + 8 + i * 9, 0, d / 2 - 5, C([0xc0392b, 0x2e74c9, 0xf2a531][i])); }
    function cementPlot(M, w, d) { plotApron(M, w, d, 0xb6b2a8); for (let i = 0; i < 4; i++) { geoAt('metal', CYL, M, -w / 2 + 9 + i * 9, 11, -d / 4, C(0xeeeeee), 0, 3.6, 22, 3.6); geoAt('metal', new THREE.ConeGeometry(3.6, 3, 14), M, -w / 2 + 9 + i * 9, 23.5, -d / 4, C(0xb8bdc2)); }
      boxAt('trim', M, w - 8, 0.8, 1.4, 0, 16, -d / 4 + 7, C(0x8a939c)); boxAt('trim', M, 22, 8, 12, 0, 0, d / 4, C(0xcfd3d6)); gable('roof', M, 22, 12, 8, 2.4, C(0x5a6772), 0.3); for (let i = 0; i < 3; i++) boxAt('trim', M, 3, 3, 8, -w / 2 + 8 + i * 5, 0, d / 2 - 6, C(0xf2a531)); }
    function estateBlocks() {
      const GRID = G.NEW_TOWNS.find(t => t.id === 'ES'); if (!GRID) return; let nb = 0; const R = rng(321);
      const kinds = ['recycling', 'steel', 'factory', 'cement', 'warehouse', 'factory2', 'freight', 'cold', 'tanks', 'warehouse2', 'recycling', 'factory'];
      for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
        const n00 = nodes[`ES_${i}_${j}`], n10 = nodes[`ES_${i + 1}_${j}`], n01 = nodes[`ES_${i}_${j + 1}`], n11 = nodes[`ES_${i + 1}_${j + 1}`]; if (!n00 || !n10 || !n01 || !n11) continue;
        const cx = (n00.x + n10.x) / 2, cz = (n00.z + n01.z) / 2, w = n10.x - n00.x - 14, d = n01.z - n00.z - 14, kind = kinds[(j * 4 + i) % kinds.length]; if (w < 30 || d < 30) continue;
        if (!fitsAt(cx, cz, w, d, 0, { slope: 3, road: 0.2, coast: 12, river: 4 })) continue; keepClear(cx - w / 2 - 6, cx + w / 2 + 6, cz - d / 2 - 6, cz + d / 2 + 6);
        const y = groundY(cx, cz), M = new THREE.Matrix4().setPosition(cx, y, cz); tileAt(cx, cz); nb++;
        const mk = (type, name, x, z, ww, dd, extra) => addBuilding(Object.assign({ id: 'es' + nb + type + Math.round(x), type, name, area: 'Works Estate', x, z, y: groundY(x, z), rot: 0, w: ww, d: dd, owner: 'city', noPath: true }, extra));
        if (kind === 'tanks') { tankFarm(M, w, d); mk('lean', 'Fuel depot office', cx + w / 2 - 8, cz + d / 2 - 5, 8, 6, { style: 'works', floors: 1, roof: 'flat' }); }
        else if (kind === 'recycling') recyclingYard(M, w, d, R);
        else if (kind === 'freight') freightYard(M, w, d, R);
        else if (kind === 'cement') cementPlot(M, w, d);
        else if (kind === 'steel') { plotApron(M, w, d); mk('steelworks', 'Capital Steel', cx, cz - 2, w - 6, d - 18, { sign: SG.STEEL }); }
        else if (kind === 'cold') { plotApron(M, w, d); mk('coldstore', 'Ice House Cold Store', cx, cz, w - 8, d - 20, { sign: SG['ICE HOUSE'] }); }
        else if (kind === 'warehouse' || kind === 'warehouse2') { plotApron(M, w, d); for (let k = 0; k < 2; k++) mk('warehouse', k ? 'Logistics Shed B' : 'Logistics Shed A', cx - w / 4 - 1 + k * (w / 2 + 2) * 1, cz - 4, w / 2 - 6, d - 22, { roof: [0x2e6fbf, 0x2e8f6f][k], yard: true }); for (let k = 0; k < 4; k++) PARKED.push(['truck', cx - w / 2 + 8 + k * 10, cz + d / 2 - 6, Math.PI, y]); }
        else { plotApron(M, w, d); mk('factory', kind === 'factory' ? 'Capital Works' : 'Island Foods', cx, cz - 3, w - 6, d - 18, { stack: kind === 'factory', color: kind === 'factory' ? 0xdfe3e6 : 0xf3e7c9, roof: kind === 'factory' ? 0x5b6b7a : 0x2e8f6f, sign: kind === 'factory' ? SG.FACTORY : SG.FREIGHT }); }
      }
      WORKS.estate = { blocks: nb }; LABELS.push({ text: 'Works Estate', level: 'district', x: 900, y: 40, z: -100 }); lap('estate');
    }

    // ---------- ships, cranes, aircraft: pieces the harbour and the airport share ----------
    function shipGroup(L, B, H, hullC, topC) { // a container ship: hull, stacks of containers, a bridge block and a funnel at the stern; faces +x
      const g = new THREE.Group(), mat = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.7 });
      const sh = new THREE.Shape(); sh.moveTo(-L / 2, -B / 2); sh.lineTo(L / 2 - B * 1.2, -B / 2); sh.quadraticCurveTo(L / 2 + B * 0.2, 0, L / 2 - B * 1.2, B / 2); sh.lineTo(-L / 2, B / 2); sh.closePath();
      const hg = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false }); hg.rotateX(-Math.PI / 2); const hull = new THREE.Mesh(hg, mat(hullC)); hull.position.y = -3; hull.castShadow = true; g.add(hull);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, 0.5, B * 0.96), mat(topC)); deck.position.set(-L * 0.02, H - 2.7, 0); g.add(deck);
      for (let i = 0; i < Math.floor(L * 0.5 / 6.2); i++) for (let j = 0; j < 6; j++) { const h = 1 + ((i * 7 + j * 3) % 4); for (let k = 0; k < h; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(6, 2.5, 2.4), mat(CONT[(i + j * 2 + k) % CONT.length])); c.position.set(-L * 0.34 + i * 6.2 + 4, H - 1.2 + k * 2.5 + 1.25, -B * 0.4 + j * 2.5 + 0.9); c.castShadow = true; g.add(c); } }
      const br = new THREE.Mesh(new THREE.BoxGeometry(10, 12, B * 0.8), mat(0xf5f2ec)); br.position.set(-L / 2 + 9, H + 3, 0); br.castShadow = true; g.add(br); const wn = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, B * 0.76), mat(0x2b3a4a)); wn.position.set(-L / 2 + 14.1, H + 6, 0); g.add(wn);
      const fn = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 6, 10), mat(0xd8392b)); fn.position.set(-L / 2 + 6, H + 11, 0); g.add(fn); return g;
    }
    function portalCrane(M, h = 30, span = 15, out = 32, back = 14) { // a quay crane on rails: two legs, a boom reaching over the ship, a cab
      for (const sz of [-span / 2, span / 2]) for (const sx of [-4, 4]) boxAt('trim', M, 1.2, h, 1.2, sx, 0, sz, C(0xe8a21f)); boxAt('trim', M, 10, 1.6, span + 2, 0, h - 1.5, 0, C(0xe8a21f)); boxAt('trim', M, 1.6, 1.6, out + back, 0, h + 0.4, (out - back) / 2 + span / 2 - span / 2, C(0xf2f0ea)); boxAt('trim', M, 0.5, 11, 0.5, 0, h + 1, -span / 2 - back + 1, C(0xd5dae0)); boxAt('trim', M, 3, 2.4, 3.4, 0, h - 4, span / 2 + 3, C(0x2b3440)); boxAt('trim', M, 4, 0.5, span + 6, 0, 0.0, 0, C(0x6a7480));
    }
    function plane(M, c1 = 0xffffff, c2 = 0x2e74c9, big = 1) { // a small airliner nose along +z
      boxAt('trim', M, 2.8 * big, 2.8 * big, 19 * big, 0, 1.6 * big, 0, C(c1)); boxAt('trim', M, 2.6 * big, 2.6 * big, 3.4 * big, 0, 1.6 * big, 10.6 * big, C(c1)); boxAt('trim', M, 2.9 * big, 0.6 * big, 19 * big, 0, 2.2 * big, 0, C(c2)); boxAt('trim', M, 21 * big, 0.35 * big, 3.4 * big, 0, 1.4 * big, 0.8 * big, C(0xe9edf0));
      boxAt('trim', M, 0.45 * big, 4.2 * big, 3.2 * big, 0, 2.6 * big, -8.6 * big, C(c2)); boxAt('trim', M, 7.4 * big, 0.3 * big, 2.2 * big, 0, 2.9 * big, -8.8 * big, C(0xe9edf0)); for (const s of [-1, 1]) { boxAt('trim', M, 1.4 * big, 1.4 * big, 3.2 * big, s * 5.2 * big, 0.5 * big, 2.2 * big, C(0x9aa3ab)); boxAt('trim', M, 0.3 * big, 0.4 * big, 2.4 * big, s * 0.2 * big, 0.2 * big, 5 * big, C(0x2b3440)); }
      boxAt('glassy', M, 2.2 * big, 0.5 * big, 1 * big, 0, 2.7 * big, 10.4 * big, C(0x2b3a4a));
    }
    function planeMesh(c1 = 0xffffff, c2 = 0x2e74c9) { // the same aircraft as a free mesh group that can fly
      const g = new THREE.Group(), mat = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.5 }), add = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); };
      add(2.8, 2.8, 19, 0, 1.6, 0, c1); add(2.6, 2.6, 3.4, 0, 1.6, 10.6, c1); add(2.9, 0.6, 19, 0, 2.2, 0, c2); add(21, 0.35, 3.4, 0, 1.4, 0.8, 0xe9edf0); add(0.45, 4.2, 3.2, 0, 2.6, -8.6, c2); add(7.4, 0.3, 2.2, 0, 2.9, -8.8, 0xe9edf0); for (const s of [-1, 1]) add(1.4, 1.4, 3.2, s * 5.2, 0.5, 2.2, 0x9aa3ab); return g;
    }

    // ---------- the container terminal on East Island's south coast: stacks, quay cranes and a ship alongside ----------
    function terminal() {
      const T = G.NEW_TOWNS.find(t => t.id === 'TM'); if (!T) return; const R = rng(515); keepClear(740, 960, 100, 270);
      const quay = []; for (const x of [770, 800, 830, 860, 890, 915]) { const s = shoreFrom(x, 176, 0.3, 0.95, 120); quay.push([s[0], s[1]]); }
      const ang = Math.atan2(quay[5][1] - quay[0][1], quay[5][0] - quay[0][0]), ry = -ang, tx = Math.cos(ang), tz = Math.sin(ang), nx = -tz, nz = tx; // the quay's direction and its normal towards the water
      // the yard: paving and stacks of containers in rows along the quay
      const MY = (x, z) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, groundY(x, z), z);
      { const cxy = [(quay[0][0] + quay[5][0]) / 2 - nx * 36, (quay[0][1] + quay[5][1]) / 2 - nz * 36]; const M = MY(cxy[0], cxy[1]); tileAt(cxy[0], cxy[1]); boxAt('lawn', M, 168, 0.14, 46, 0, 0.02, 0, C(0xb6b4ad));
        for (let row = 0; row < 3; row++) for (let i = 0; i < 17; i++) { if (R() < 0.1) continue; const h = 1 + (R() * 4 | 0); for (let k = 0; k < h; k++) boxAt('trim', M, 6.1, 2.5, 2.4, -78 + i * 9.2, k * 2.5 + 0.1, -16 + row * 7, C(CONT[(i * 3 + row * 5 + k) % CONT.length])); }
        for (const x of [-60, 20, 90]) { for (const s of [-1, 1]) boxAt('trim', M, 0.8, 10, 0.8, x + s * 3.4, 0, -9.5, C(0xd8a32a)); boxAt('trim', M, 8, 1, 1.2, x, 9.5, -9.5, C(0xd8a32a)); } }
      // quay cranes on the water's edge, a rail behind them
      quay.slice(0, 6).forEach(([x, z], k) => { if (k === 0 || k === 5) return; const cxp = x - nx * 4.5, czp = z - nz * 4.5; tileAt(cxp, czp); portalCrane(new THREE.Matrix4().makeRotationY(Math.atan2(nx, nz)).setPosition(cxp, groundY(cxp, czp), czp), 28, 14, 30, 12); });
      { const x = (quay[0][0] + quay[5][0]) / 2, z = (quay[0][1] + quay[5][1]) / 2, M = MY(x - nx * 4.5, z - nz * 4.5); tileAt(x, z); boxAt('trim', M, 150, 0.3, 0.5, 0, 0.1, 5, C(0x6a7480)); boxAt('trim', M, 150, 0.3, 0.5, 0, 0.1, -5, C(0x6a7480)); }
      // the ship alongside
      const mid = [(quay[1][0] + quay[4][0]) / 2, (quay[1][1] + quay[4][1]) / 2], sp = new THREE.Vector3(mid[0] + nx * 13, 0, mid[1] + nz * 13), ship = shipGroup(112, 18, 9, 0x1f3f6b, 0x9c4a32); ship.position.copy(sp); ship.rotation.y = -ang; scene.add(ship); tick.push((dt, t) => { ship.position.y = Math.sin(t * 0.5) * 0.08; });
      // gate, port office and customs
      const gate = nodes['TM_1_0']; if (gate) { const M = new THREE.Matrix4().setPosition(gate.x + 8, groundY(gate.x + 8, gate.z - 10), gate.z - 10); tileAt(gate.x, gate.z); boxAt('trim', M, 6, 3.4, 4, 0, 0, 0, C(0xf2f0ea)); boxAt('roof', M, 7, 0.3, 5, 0, 3.4, 0, C(0x1f4f86)); boxAt('trim', M, 0.3, 1, 8, -4.5, 0.4, 5, C(0xd8392b)); }
      const po = addBuilding({ id: 'tmoffice', type: 'lean', style: 'works', name: 'Port Office', area: 'Container Terminal', x: 800, z: 108, y: groundY(800, 108), rot: 0, w: 18, d: 11, floors: 3, roof: 'flat', owner: 'city', shop: true, sign: SG['PORT OFFICE'], noPath: true });
      addBuilding({ id: 'tmcustoms', type: 'lean', style: 'works', name: 'Customs House', area: 'Container Terminal', x: 906, z: 108, y: groundY(906, 108), rot: 0, w: 16, d: 10, floors: 2, roof: 'flat', owner: 'city', shop: true, sign: SG.CUSTOMS, noPath: true });
      LABELS.push({ text: 'Container Terminal', level: 'district', x: 850, y: 30, z: 160 }, { text: 'Port Office', level: 'place', x: 800, y: 16, z: 108, small: true });
      WORKS.terminal = { quay: quay.map(q => q.map(Math.round)), ship: [sp.x, sp.z] }; lap('terminal');
    }

    // ---------- the airport: a runway with markings and lights, a taxiway, an apron with aircraft, a terminal with a forecourt, a control tower, hangars, fuel, a fire station ----------
    function airport() {
      const AP = nodes['AP']; if (!AP) return; const R = rng(808), RZ = 205, X0 = 975, X1 = 1465, Y = 3.05; keepClear(940, 1480, 40, 260); NOFIELD.push([930, 1490, 30, 270]);
      const slabAt = (x, z, w, d, c, lift = 0.14) => { tileAt(x, z); boxAt('lawn', new THREE.Matrix4().setPosition(x, groundY(x, z), z), w, lift, d, 0, 0, 0, C(c)); };
      // runway 28 m wide: asphalt, edge lines, centre dashes, thresholds, lights; taxiway and its links; the apron
      const rx = (X0 + X1) / 2, M = new THREE.Matrix4().setPosition(rx, Y, RZ); tileAt(rx, RZ); boxAt('lawn', M, X1 - X0, 0.2, 28, 0, 0, 0, C(0x3b3f46));
      for (const s of [-1, 1]) boxAt('lawn', M, X1 - X0 - 6, 0.24, 0.35, 0, 0, s * 13.2, C(0xf4f4f0)); for (let x = X0 + 30; x < X1 - 36; x += 26) boxAt('lawn', M, 12, 0.24, 0.8, x - rx, 0, 0, C(0xf4f4f0));
      for (const [x, dir] of [[X0 + 6, 1], [X1 - 6, -1]]) { for (let k = -5; k <= 5; k++) if (k) boxAt('lawn', M, 9, 0.24, 1.1, x - rx + dir * 2, 0, k * 2.2, C(0xf4f4f0)); }
      for (let x = X0 + 8; x < X1 - 8; x += 30) for (const s of [-1, 1]) boxAt('glow', M, 0.5, 0.45, 0.5, x - rx, 0.2, s * 14.8, C(0xfff2c0));
      const TZ = 172; slabAt((X0 + X1) / 2 + 30, TZ, X1 - X0 - 70, 14, 0x474c55, 0.18); boxAt('lawn', new THREE.Matrix4().setPosition((X0 + X1) / 2 + 30, Y, TZ), X1 - X0 - 74, 0.2, 0.3, 0, 0.05, 0, C(0xf2c12e));
      for (const x of [1010, 1240, 1425]) slabAt(x, (TZ + RZ) / 2, 14, RZ - TZ - 6, 0x474c55, 0.18);
      slabAt(1200, 140, 250, 46, 0xb4b3ae, 0.16); for (let k = 0; k < 6; k++) boxAt('lawn', new THREE.Matrix4().setPosition(1100 + k * 40, Y, 150), 0.4, 0.2, 18, 0, 0.05, 0, C(0xf2c12e));
      // the terminal: a long glass building with a wide roof, canopies on the apron side, a forecourt and car parks
      const TX = 1200, TZ0 = 98, tM = new THREE.Matrix4().setPosition(TX, groundY(TX, TZ0), TZ0); tileAt(TX, TZ0);
      boxAt('trim', tM, 96, 1.2, 28, 0, 0, 0, C(0xe9e6df)); walls('hotel', tM, 92, 22, 1.2, 10, C(0xdfeaf0), 4.6, 4.4); boxAt('roof', tM, 100, 0.8, 32, 0, 10.2, 0, C(0xf4f4f0)); boxAt('trim', tM, 102, 0.5, 34, 0, 11, 0, C(0x2e74c9));
      for (let k = 0; k < 5; k++) { boxAt('trim', tM, 8, 4.4, 0.4, -36 + k * 18, 0, 16.6, C(0x39485a)); boxAt('trim', tM, 8.4, 0.3, 6, -36 + k * 18, 4.4, 19, C(0xd9dfe4)); for (const sx of [-1, 1]) boxAt('trim', tM, 0.4, 4.4, 0.4, -36 + k * 18 + sx * 4, 0, 21.5, C(0xaeb6bd)); }
      boxAt('trim', tM, 24, 8, 4, 0, 10, 12, C(0xdfeaf0)); sign(tM, SG.AIRPORT, 14, 1.8, 0, 12.5, 14.1);
      addBuilding({ id: 'apterminal', type: 'marker', name: 'Capital Airport Terminal', area: 'Airport', x: TX, z: TZ0, y: groundY(TX, TZ0), rot: 0, w: 96, d: 28, hh: 12, owner: 'city', noPath: true });
      slabAt(1200, 68, 110, 22, 0xcfc9bb, 0.16); for (const [x, z, w, d] of [[1130, 32, 60, 22], [1270, 32, 60, 22]]) { slabAt(x, z, w, d, 0x5b6068, 0.16); for (let i = 0; i < 5; i++) for (const s of [-1, 1]) boxAt('lawn', new THREE.Matrix4().setPosition(x - w / 2 + 6 + i * 11, Y, z + s * 5), 0.25, 0.2, 5, 0, 0.05, 0, C(0xf4f4f0)); for (let i = 0; i < 7; i++) PARKED.push([['compact', 'sedan', 'suv'][i % 3], x - w / 2 + 6 + (i * 8 + 3) % (w - 8), z + (i % 2 ? 5 : -5), Math.PI / 2 * (i % 2 ? 1 : -1) + Math.PI / 2, groundY(x, z)]); }
      // the control tower and its radar
      { const x = 1318, z = 118, T = new THREE.Matrix4().setPosition(x, groundY(x, z), z); tileAt(x, z); geoAt('trim', CYL, T, 0, 14, 0, C(0xe9e6df), 0, 3.2, 28, 3.2); boxAt('trim', T, 9.5, 4.4, 9.5, 0, 28, 0, C(0xe9e6df)); boxAt('glassy', T, 9.8, 2.6, 9.8, 0, 28.9, 0, C(0x7fb5d8)); boxAt('roof', T, 11, 0.6, 11, 0, 33, 0, C(0xd8392b)); boxAt('trim', T, 0.3, 3, 0.3, 0, 33.6, 0, C(0x6a7480)); boxAt('trim', T, 3.6, 0.3, 0.6, 0, 36.6, 0, C(0x6a7480)); }
      // hangars, a fuel farm, a cargo shed and a fire station
      addBuilding({ id: 'aphangar1', type: 'warehouse', name: 'Hangar 1', area: 'Airport', x: 1060, z: 128, y: groundY(1060, 128), rot: 0, w: 34, d: 28, roof: 0x7a8794, owner: 'city', noPath: true, yard: true });
      addBuilding({ id: 'aphangar2', type: 'warehouse', name: 'Hangar 2', area: 'Airport', x: 1100, z: 128, y: groundY(1100, 128), rot: 0, w: 34, d: 28, roof: 0x7a8794, owner: 'city', noPath: true, yard: true });
      addBuilding({ id: 'apcargo', type: 'warehouse', name: 'Air Cargo', area: 'Airport', x: 1352, z: 120, y: groundY(1352, 120), rot: 0, w: 40, d: 26, roof: 0x2e6fbf, owner: 'city', noPath: true, yard: true });
      addBuilding({ id: 'apfire', type: 'lean', style: 'works', name: 'Airport Fire Station', area: 'Airport', x: 1260, z: 160, y: groundY(1260, 160), rot: 0, w: 20, d: 12, floors: 1, roof: 'flat', owner: 'city', noPath: true, color: 0xf2d7cf });
      { const x = 1395, z = 60, M2 = new THREE.Matrix4().setPosition(x, groundY(x, z), z); tileAt(x, z); tankFarm(M2, 40, 28); }
      // aircraft on the apron and at the hangars
      [[1120, 146, 0x2e74c9], [1160, 144, 0xd8392b], [1240, 146, 0x1f8f5b], [1280, 145, 0xf2a531]].forEach(([x, z, c], i) => { const P = new THREE.Matrix4().makeRotationY(Math.PI + (i % 2 ? 0.05 : -0.05)).setPosition(x, groundY(x, z), z); tileAt(x, z); plane(P, 0xffffff, c); });
      // a plane that lands and takes off, again and again
      const fly = planeMesh(0xffffff, 0x2e74c9); fly.visible = false; scene.add(fly); let st = 0, ph = 0; const cycle = 70;
      tick.push(dt => { st += dt; const t = st % cycle; let x, y, z = RZ, ry = Math.PI / 2, pitch = 0; fly.visible = true;
        if (t < 14) { const u = t / 14; x = X0 + 40 + (X1 - X0 - 120) * (u * u * 0.9 + u * 0.1); y = Y + 1.4; const lift = smooth(0.78, 1, u); y += lift * 6; pitch = -lift * 0.3; if (u > 0.9) { y += (u - 0.9) * 70; } }
        else if (t < 26) { const u = (t - 14) / 12; x = X1 - 60 + u * 260; y = Y + 10 + u * 70; pitch = -0.25; z = RZ + u * 60; ry = Math.PI / 2 + u * 0.8; }
        else if (t < 40) { fly.visible = false; x = 0; y = -100; }
        else if (t < 56) { const u = (t - 40) / 16; x = X1 + 220 - u * 230; y = Y + 1.4 + 70 * Math.pow(1 - u, 2.2); z = RZ + 18 * (1 - u); pitch = 0.1 * (1 - u); ry = -Math.PI / 2 - 0.15 * (1 - u); }
        else { const u = (t - 56) / 14; x = X1 - 10 - u * (X1 - X0 - 80) * 0.85; y = Y + 1.4; ry = -Math.PI / 2; pitch = 0; }
        fly.position.set(x, y, z); fly.rotation.set(pitch, ry, 0); });
      // the front door of the airport: a forecourt where the access road ends
      LABELS.push({ text: 'Airport', level: 'district', x: 1200, y: 40, z: 120 }, { text: 'Terminal', level: 'place', x: TX, y: 20, z: TZ0, small: true }, { text: 'Runway', level: 'place', x: 1200, y: 8, z: RZ, small: true });
      WORKS.airport = { runway: [X0, X1, RZ], terminal: [TX, TZ0] }; lap('airport');
    }

    // ---------- the quarry and the mine: raw materials for the works estate and for building ----------
    function conveyor(a, b, w = 1.5) { barBox('trim', a, b, w, C(0x7a838c)); const n = Math.max(1, Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / 9)); for (let i = 0; i <= n; i++) { const x = mix(a[0], b[0], i / n), z = mix(a[2], b[2], i / n), y = mix(a[1], b[1], i / n), g = groundY(x, z); if (y - g > 0.8) barBox('trim', [x, g - 0.2, z], [x, y - 0.4, z], 0.5, C(0x6a737b)); } }
    function excavator(x, z, ry, y) { const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z); tileAt(x, z); for (const s of [-1, 1]) bxs(M, 1.2, 1.1, 5.2, s * 1.5, 0, 0, 0x2b2f36); bxs(M, 3.6, 1.5, 4.4, 0, 1.1, 0, 0xf2b705); bxs(M, 1.7, 1.9, 1.9, -0.8, 2.6, 1.1, 0xf2b705); boxAt('glassy', M, 1.5, 1.2, 0.1, -0.8, 3.0, 2.08, C(0x7fb5d8)); barBox('trim', [x, y + 2.7, z], [x - Math.sin(ry) * 4.5, y + 6, z - Math.cos(ry) * 4.5], 0.6, C(0xf2b705)); barBox('trim', [x - Math.sin(ry) * 4.5, y + 6, z - Math.cos(ry) * 4.5], [x - Math.sin(ry) * 8.5, y + 3.2, z - Math.cos(ry) * 8.5], 0.5, C(0xf2b705)); bxs(mul(M, 0, 0, 0), 1.6, 1.1, 1.4, 0, 3.0, -8.6, 0x6a737b); }
    function dumper(x, z, ry, y, load = true) { const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z); tileAt(x, z); bxs(M, 3.4, 0.8, 9, 0, 1.2, 0, 0x2b2f36); bxs(M, 4.4, 2.2, 6, 0, 2, -1.2, 0xf2b705); if (load) bxs(M, 4, 0.8, 5.6, 0, 4.2, -1.2, 0x8a7a64); bxs(M, 3.2, 2.8, 2.8, 0, 1.4, 3.6, 0xf2b705); boxAt('glassy', M, 2.8, 1.2, 0.1, 0, 2.6, 5.05, C(0x7fb5d8)); for (const sz of [-3, 0.2, 3.2]) for (const s of [-1, 1]) bxs(M, 0.9, 2.2, 2.2, s * 2.1, 0, sz, 0x1b1d20); }
    function stockCone(x, z, r, h, c) { tileAt(x, z); geoAt('trim', new THREE.ConeGeometry(1, 1, 12), new THREE.Matrix4(), x, groundY(x, z) + h / 2 - 0.2, z, C(c), 0, r, h, r); }
    function quarry() {
      keepClear(940, 1160, -860, -610); NOFIELD.push([930, 1170, -870, -600]); const R = rng(444), py = 26;
      for (const [x, z, ry] of [[1025, -748, 0.6], [1068, -722, 2.4]]) excavator(x, z, ry, py);
      for (const [x, z, ry, ld] of [[1038, -733, 1.2, 1], [1056, -742, -0.4, 0], [1018, -724, 3.0, 1]]) dumper(x, z, ry, py, !!ld);
      for (const [x, z, r, h, c] of [[1050, -714, 7, 6, 0xb5a58c], [1020, -748, 5, 4.4, 0xc9c1b0]]) stockCone(x, z, r, h, c);
      // the plant at the top of the haul road: a crusher, a screening tower, conveyors and stockpiles of different sizes
      const PX = 1000, PZ = -706, M = new THREE.Matrix4().setPosition(PX, groundY(PX, PZ), PZ); tileAt(PX, PZ); boxAt('lawn', M, 70, 0.14, 46, 0, 0.02, 0, C(0xb6ad9d));
      bxs(M, 12, 10, 12, 0, 0, 0, 0x7a8794); boxAt('roof', M, 12.4, 0.4, 12.4, 0, 10, 0, C(0x4a5764)); bxs(M, 8, 5, 8, 0, 10, 0, 0xcdd3d8); bxs(M, 8, 17, 8, -22, 0, 4, 0x9aa5ad); boxAt('roof', M, 8.4, 0.4, 8.4, -22, 17, 4, C(0x4a5764)); bxs(M, 10, 6, 10, 22, 0, 6, 0xb9b3a3);
      conveyor([1040, py + 1.2, -738], [PX + 4, groundY(PX, PZ) + 10.5, PZ + 4], 1.6); conveyor([PX - 6, groundY(PX, PZ) + 8, PZ], [PX - 22, groundY(PX, PZ) + 17.5, PZ + 4], 1.4); conveyor([PX - 22, groundY(PX, PZ) + 12, PZ + 8], [PX - 40, groundY(PX, PZ) + 4, PZ + 18], 1.4);
      for (const [dx, dz, r, h, c] of [[-40, 18, 9, 8, 0xc9c1b0], [-30, 26, 8, 7, 0xb5a58c], [-48, 28, 7, 6, 0x9a8a74], [-22, 30, 6, 5, 0xd6cdb9]]) stockCone(PX + dx, PZ + dz, r, h, c);
      addBuilding({ id: 'quoffice', type: 'lean', style: 'works', name: 'Redstone Quarry office', area: 'Redstone Quarry', x: 1010, z: -682, y: groundY(1010, -682), rot: 0, w: 14, d: 8, floors: 2, roof: 'flat', owner: 'city', noPath: true, shop: true, sign: SG.QUARRY });
      addBuilding({ id: 'quworkshop', type: 'warehouse', name: 'Quarry workshop', area: 'Redstone Quarry', x: 1066, z: -690, y: groundY(1066, -690), rot: 0, w: 20, d: 14, roof: 0x7a8794, owner: 'city', noPath: true, yard: true });
      { const T = new THREE.Matrix4().setPosition(1088, groundY(1088, -696), -696); tileAt(1088, -696); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bxs(T, 0.35, 8, 0.35, a * 2, 0, b * 2, 0x7a838c); geoAt('metal', CYL, T, 0, 11, 0, C(0xd9dde0), 0, 3.2, 6, 3.2); }
      boxAt('lawn', new THREE.Matrix4().setPosition(1004, groundY(1004, -668), -668), 4, 0.2, 20, 0, 0, 0, C(0x7a7f87)); // the weighbridge on the way out
      LABELS.push({ text: 'Redstone Quarry', level: 'district', x: 1040, y: 60, z: -735 }, { text: 'Quarry plant', level: 'place', x: PX, y: 26, z: PZ, small: true });
      WORKS.quarry = { pit: [1045, -735], plant: [PX, PZ] }; lap('quarry');
    }
    function mine() {
      const MN = nodes['MN']; if (!MN) return; const X = MN.x + 6, Z = MN.z - 6; keepClear(X - 90, X + 110, Z - 60, Z + 80); NOFIELD.push([X - 90, X + 110, Z - 60, Z + 80]);
      const M = new THREE.Matrix4().setPosition(X, groundY(X, Z), Z); tileAt(X, Z); boxAt('lawn', M, 60, 0.14, 44, 0, 0.02, 0, C(0xa9a08c));
      // the headframe: four legs meeting at a wheel house, cross braces, a winding wheel
      const y0 = groundY(X, Z), top = y0 + 30; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) barBox('trim', [X + a * 5, y0, Z + b * 5], [X + a * 0.8, top, Z + b * 0.8], 0.9, C(0x59636d)); for (const yy of [8, 16, 23]) { const k = 5 - yy / 30 * 4.2; for (const [a, b, c, d] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) barBox('trim', [X + a * k, y0 + yy, Z + b * k], [X + c * k, y0 + yy, Z + d * k], 0.5, C(0x6a737b)); }
      bxs(M, 3.4, 2.8, 3.4, 0, 30, 0, 0x4a525c); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; barBox('trim', [X + Math.cos(a) * 3.2, top + 4.2 + Math.sin(a) * 3.2, Z], [X - Math.cos(a) * 3.2, top + 4.2 - Math.sin(a) * 3.2, Z], 0.4, C(0xd8392b)); } barBox('trim', [X, top + 3, Z], [X + 14, y0 + 8, Z + 6], 0.2, C(0x2b2f36));
      addBuilding({ id: 'mnhoist', type: 'lean', style: 'works', name: 'Deepwell Mine hoist house', area: 'Deepwell Mine', x: X + 14, z: Z + 8, y: groundY(X + 14, Z + 8), rot: 0, w: 14, d: 9, floors: 2, roof: 'flat', owner: 'city', noPath: true, shop: true, sign: SG.MINE });
      addBuilding({ id: 'mnoffice', type: 'lean', style: 'works', name: 'Mine offices', area: 'Deepwell Mine', x: X - 18, z: Z + 20, y: groundY(X - 18, Z + 20), rot: 0, w: 16, d: 8, floors: 2, roof: 'flat', owner: 'city', noPath: true });
      { const B = new THREE.Matrix4().setPosition(X - 20, groundY(X - 20, Z - 14), Z - 14); tileAt(X - 20, Z - 14); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bxs(B, 0.5, 8, 0.5, a * 3, 0, b * 3, 0x59636d); bxs(B, 8, 5, 8, 0, 8, 0, 0x7a838c); bxs(B, 4, 3, 4, 0, 13, 0, 0x6a737b); }
      conveyor([X - 14, y0 + 8, Z - 11], [X - 44, y0 + 2.5, Z - 24], 1.4); stockCone(X - 50, Z - 28, 9, 9, 0x5b5148); stockCone(X + 52, Z + 22, 22, 13, 0x6b5f52); stockCone(X + 74, Z + 14, 14, 9, 0x796c5c);
      for (let i = 0; i < 6; i++) boxAt('trim', M, 3.2, 1.2, 1.8, 14 + i * 3.6, 0, -16, C([0x8a939c, 0x59636d][i % 2])); // ore wagons on a siding
      { const P = new THREE.Matrix4().setPosition(X + 36, groundY(X + 36, Z - 20), Z - 20); tileAt(X + 36, Z - 20); geoAt('water', CYL, P, 0, 0.3, 0, C(0x5aa8c8), 0, 13, 0.3, 11); }
      LABELS.push({ text: 'Deepwell Mine', level: 'district', x: X, y: 60, z: Z }); WORKS.mine = { at: [X, Z] }; lap('mine');
    }

    // ---------- the west coast: Coral Bay (a village), the resort (four different hotels on one long beach), the luxury bluffs and the marina ----------
    const roadChain = (test) => { const es = edges.filter(e => e.kind !== 'bridge' && test(e.a.id) && test(e.b.id)); return chainsOf(es).sort((p, q) => q.len - p.len)[0] || null; };
    function pool(M, x, z, w, d, rot = 0) { // a pool with a white rim, loungers and umbrellas round it
      const P = mul(M, x, 0, z, rot); boxAt('lawn', P, w + 6, 0.16, d + 6, 0, 0, 0, C(0xece3cf)); boxAt('trim', P, w + 1.2, 0.3, d + 1.2, 0, 0.06, 0, C(0xffffff)); boxAt('water', P, w, 0.4, d, 0, 0.12, 0, C(0x35c6ea));
      for (let i = 0; i < Math.floor(w / 2.6); i++) for (const s of [-1, 1]) { boxAt('trim', P, 0.9, 0.35, 2, -w / 2 + 1.4 + i * 2.6, 0.2, s * (d / 2 + 2.2), C(0xffffff)); } for (let i = 0; i < Math.floor(w / 9); i++) { const ux = -w / 2 + 4 + i * 9; geoAt('trim', CYL8, P, ux, 1.4, d / 2 + 4.4, C(0xffffff), 0, 0.06, 2.8, 0.06); geoAt('detail', new THREE.ConeGeometry(2.2, 0.8, 8), P, ux, 2.9, d / 2 + 4.4, C([0xe8483f, 0x0f6fb8, 0xf2b705, 0x1f8f5b][i % 4])); }
    }
    DRAW.resort = (b, M, w, d) => { // four kinds of hotel: the lobby and the drop-off are on the road side; the pool, the terraces and the sand are on the sea side
      const k = b.kind || 'slab', wc = C(b.color || 0xffffff), rc = C(b.roof || 0xe8483f), bk = -d / 2 - 11;
      boxAt('trim', M, w + 1, 1.2, d + 1, 0, -1, 0, C(0xe9e6df)); boxAt('lawn', M, 18, 0.12, 6.4, 0, 0, d / 2 + 3.5, C(0xd9d2c3)); boxAt('trim', M, 12, 0.3, 5, 0, 3.7, d / 2 + 3, C(0xf4f1ea)); for (const s of [-1, 1]) boxAt('trim', M, 0.3, 3.7, 0.3, s * 5.6, 0, d / 2 + 5.2, C(0xaeb6bd));
      if (k === 'slab') { const fl = b.floors || 5, H = fl * 3.2; walls('hotel', M, w, d, 0.2, H, wc, 4.2, 3.2); for (let f = 1; f <= fl; f++) boxAt('trim', M, w + 0.6, 0.3, d + 3.6, 0, f * 3.2 - 0.3, -0.9, C(0xf4f1ea)); boxAt('trim', M, w + 1, 0.5, d + 1, 0, H, 0, C(0xf4f1ea)); boxAt('roof', M, w - 6, 0.3, d - 6, 0, H + 0.5, 0, rc); for (let i = 0; i < 4; i++) geoAt('trim', CYL8, M, -w / 2 + 8 + i * (w - 16) / 3, H + 1.4, 0, C(0xf4f1ea), 0, 0.15, 2.4, 0.15); boxAt('trim', M, w * 0.5, 0.25, d * 0.5, 0, H + 2.6, 0, C(0xf4f1ea)); pool(M, 0, bk, w * 0.7, 8); b.doorX = 0; b.signY = H + 1; return H + 3; }
      if (k === 'steps') { for (let t = 0; t < 3; t++) { const ww = w - t * 9, dd = d - t * 3.5, y0 = t * 3.4, zt = t * 1.75; walls('hotel', mul(M, 0, 0, zt), ww, dd, y0 + 0.2, y0 + 3.4, wc, 3.6, 3.2); boxAt('trim', M, ww + 1, 0.4, dd + 1, 0, y0 + 3.4, zt, C(0xf4f1ea)); boxAt('lawn', M, ww - 3, 0.2, 3, 0, y0 + 3.75, zt - dd / 2 + 1.75, C(0x6bbd4f)); } pool(M, 0, bk, w * 0.6, 8); b.doorX = 0; b.signY = 8.6; return 12; }
      if (k === 'ring') { for (const [x, z, ww, dd] of [[0, d / 2 - 6, w, 12], [-w / 2 + 6, -6, 12, d - 12], [w / 2 - 6, -6, 12, d - 12]]) { walls('hotel', mul(M, x, 0, z), ww, dd, 0.2, 9.6, wc, 4, 3.2); boxAt('trim', M, ww + 0.8, 0.4, dd + 0.8, x, 9.6, z, C(0xf4f1ea)); boxAt('roof', M, ww - 2, 0.3, dd - 2, x, 10, z, rc); for (let f = 1; f < 3; f++) boxAt('trim', M, ww + 0.4, 0.25, dd + 2.6, x, f * 3.2, z, C(0xf4f1ea)); } pool(M, 0, -2, w - 30, 10); b.doorX = 0; b.signY = 9.2; return 12; }
      // bungalows: eight small thatched huts round a lagoon, with a reception lodge on the road
      boxAt('water', M, w * 0.46, 0.4, d * 0.36, 0, 0.05, -2, C(0x35c6ea)); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.4, x = Math.cos(a) * w * 0.38, z = Math.sin(a) * d * 0.36 - 2; const H = mul(M, x, 0, z, -a + Math.PI / 2); walls('cottage', H, 7, 6, 0.3, 3.2, C([0xffe2d0, 0xbfe8e0, 0xfff0a8, 0xffc2c2][i % 4]), 3.5, 3); hip('roof', H, 7, 6, 3.4, 2.6, C(0xb08a56), 0.8); boxAt('trim', H, 1.1, 2.1, 0.2, 0, 0.3, 3.1, C(0x2f8a7a)); }
      walls('cottage', mul(M, 0, 0, d / 2 - 4), 16, 8, 0.3, 4, wc, 4, 3.6); hip('roof', mul(M, 0, 0, d / 2 - 4), 16, 8, 4.2, 3.2, C(0x9a7646), 0.9); b.doorX = 0; b.doorZ = 0; b.signY = 6.6; return 7;
    };
    DOOR.resort = 1;
    function trimChain(ch, zMin) { const keep = ch.pts.map((p, i) => i).filter(i => ch.pts[i][2] < zMin); if (keep.length < 2) return ch; const i0 = keep[0], i1 = keep[keep.length - 1], pts = ch.pts.slice(i0, i1 + 1), cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2])); return Object.assign({}, ch, { pts, cum, len: cum[cum.length - 1] }); }
    const roadChains = test => chainsOf(edges.filter(e => e.kind !== 'bridge' && test(e.a.id) && test(e.b.id))).filter(c => c.len > 30).sort((p, q) => q.pts[0][2] - p.pts[0][2]);
    function resort(chains) {
      if (!chains.length) return; const HOTELS = [['Hotel Coral', 'slab', 0xffffff, SG['HOTEL CORAL'], 46, 15], ['Sunset Hotel', 'steps', 0xffe6c8, SG['SUNSET HOTEL'], 40, 18], ['Pearl Resort', 'bungalows', 0xf6efe0, SG['PEARL RESORT'], 44, 34], ['Lagoon Hotel', 'ring', 0xe6f2f4, SG['LAGOON HOTEL'], 44, 28]];
      keepClear(-935, -745, -775, -526); NOFIELD.push([-935, -745, -780, -526]); const queue = HOTELS.slice(), names = [], lines = []; let n = 0;
      for (const chain of chains) {
        const [mx, , mz, mux, muz] = posAt(chain, chain.len / 2), sg = land(mx - muz * 40, mz + mux * 40) < land(mx + muz * 40, mz - mux * 40) ? 1 : -1;
        for (const side of [sg, -sg]) { let at = 8;
        while (queue.length && at < chain.len - 12) {
          const [name, kind, col, sign_, w, d] = queue[0], s = at + w / 2; if (s > chain.len - 6) break;
          const [x, , z, ux, uz] = posAt(chain, s), nx = -uz * side, nz = ux * side, rot = Math.atan2(-nx, -nz), off = chain.w / 2 + 7 + d / 2, cx = x + nx * off, cz = z + nz * off;
          if (!fitsAt(cx + nx * 11, cz + nz * 11, w + 2, d + 22, rot, { slope: 5, road: 0.5, coast: 5, river: 5 })) { at += 6; continue; }
          const b = addBuilding({ id: 'resort' + n, type: 'resort', kind, name, area: 'Coral Coast', x: cx, z: cz, y: groundY(cx, cz), rot, w, d, color: col, owner: 'city', floors: kind === 'slab' ? 5 : undefined, found: 2.6 });
          reserve({ x: cx + nx * 11, z: cz + nz * 11, w: w + 4, d: d + 22, rot }); sign(new THREE.Matrix4().makeRotationY(rot).setPosition(cx, b.y, cz), sign_, 9, 1.3, 0, b.signY || 10, d / 2 + 0.2, 0); LABELS.push({ text: name, level: 'place', x: cx, y: 24, z: cz, small: true }); names.push(name); queue.shift(); n++; at += w + 8;
        } }
        // the beach: a promenade along the sand 22 m from the water, umbrellas on the sand, palms on the landward side
        const line = []; for (let s = 4; s < chain.len - 4; s += 9) { const [x, , z, ux, uz] = posAt(chain, s), nx = -uz * sg, nz = ux * sg; let k = 14; while (k < 130 && land(x + nx * k, z + nz * k) > 22) k += 2; if (k < 130) line.push({ x: x + nx * k, z: z + nz * k, nx, nz, ux, uz }); }
        let seg = []; const flush = () => { if (seg.length > 2) path(seg.map(p => [p.x, p.z]), { w: 2.6, snap: 3 }); seg = []; };
        for (const p of line) { if (riverNear(p.x, p.z, 9)) { flush(); continue; } seg.push(p); const i = seg.length; for (let j = 0; j < 3; j++) { const ux = p.x + p.nx * (6 + j * 5) + p.ux * (j - 1) * 5, uz = p.z + p.nz * (6 + j * 5) + p.uz * (j - 1) * 5; if (land(ux, uz) < 5 || riverNear(ux, uz, 6)) continue; const T = new THREE.Matrix4().setPosition(ux, groundY(ux, uz), uz); tileAt(ux, uz); geoAt('trim', CYL8, T, 0, 1.3, 0, C(0xffffff), 0, 0.06, 2.6, 0.06); geoAt('detail', new THREE.ConeGeometry(2, 0.8, 8), T, 0, 2.7, 0, C([0xe8483f, 0x0f6fb8, 0xf2b705, 0xffffff][(j + i) % 4])); boxAt('lawn', T, 1.1, 0.08, 2.1, 1.5, 0, 0.8, C([0xff6f91, 0x2e74c9, 0xffd21f][(i + j) % 3])); } if (i % 2 === 0) { const px = p.x - p.nx * 4, pz = p.z - p.nz * 4; if (!riverNear(px, pz, 6)) extraTrees.push([px, groundY(px, pz), pz, 0.9, 'palm']); } }
        flush(); lines.push(line);
      }
      // three beach businesses on the sand, each with its own path to the promenade
      const L1 = lines.filter(l => l.length > 3).sort((p, q) => q.length - p.length)[0] || []; [['Beach bar', SG['BEACH BAR'], 0xff8a3d, 0.25], ['Dive shop', SG['DIVE SHOP'], 0x0e7c86, 0.55], ['Surf hire', SG['SURF HIRE'], 0xe8742c, 0.85]].forEach(([name, sg2, awn, f], i) => { for (let tries = 0; tries < 6; tries++) { const p = L1[Math.min(L1.length - 1, Math.floor(L1.length * f) + tries)]; if (!p) return; const kx = p.x + p.nx * 9, kz = p.z + p.nz * 9, rot = Math.atan2(-p.nx, -p.nz); if (!fitsAt(kx, kz, 8, 6, rot, { slope: 3, road: 0.5, coast: 5, river: 6 })) continue; addBuilding({ id: 'cbk' + i, type: 'kiosk', name, area: 'Coral Coast', x: kx, z: kz, y: groundY(kx, kz), rot, w: 7, d: 5, sign: sg2, awn, owner: 'city' }); reserve({ x: kx, z: kz, w: 9, d: 7, rot }); break; } });
      LABELS.push({ text: 'Coral Coast resort', level: 'district', x: -830, y: 30, z: -650 }); WORKS.resort = { hotels: n, names, chains: chains.map(c => [Math.round(c.len), Math.round(c.pts[0][0]), Math.round(c.pts[0][2]), Math.round(c.pts[c.pts.length - 1][0]), Math.round(c.pts[c.pts.length - 1][2]), c.a.id, c.b.id]) }; lap('resort');
    }
    function coralBay() { // the village behind the south end of the beach: pastel houses and shops along the coast road
      const chain = roadChain(id => id === 'C4' || id === 'C5' || id === 'C6' || id.startsWith('C4C5') || id.startsWith('C5C6')); if (!chain) return; keepClear(-800, -690, -520, -410);
      const n = buildLots({ id: 'CB', name: 'Coral Bay' }, { style: 'coral', w: [7, 9], d: [8, 9], mw: [7, 9], md: [8, 9], mainW: 9, setback: 3, shop: 0.5, slope: 2.4, road: 1.5, coast: 14, river: 6, tight: 2, signs: [SG['DIVE SHOP'], SG.SOUVENIRS, SG['CAFÉ'], SG.GELATO, SG['SEAFOOD GRILL'], SG['SURF HIRE']] }, [{ id: 9001, pts: chain.pts, cum: chain.cum, len: chain.len, w: chain.w, kind: chain.kind, a: chain.a, b: chain.b }]);
      LABELS.push({ text: 'Coral Bay', level: 'district', x: -760, y: 30, z: -480 }); WORKS.coralbay = { lots: n }; lap('coralbay');
    }
    function luxury() { const w0 = Object.assign({}, WHY); // estates on the bluffs: big villas with drives, gates, walled gardens and pools, along the coast road
      const chain = roadChain(id => id === 'C2' || id === 'C3' || id === 'C4' || id.startsWith('C2C3') || id.startsWith('C3C4')); if (!chain) return; keepClear(-780, -600, -460, -200);
      const n = buildLots({ id: 'LX', name: 'Luxury coast' }, { type: 'villa', style: 'villa', w: [23, 25], d: [26, 28], mw: [23, 25], md: [26, 28], mainW: 99, setback: 3, shop: 0, slope: 11, road: 0.5, coast: 10, river: 6, gap: 1, tight: 3, pickType: (l) => ({ b: { w: 14, d: 11 } }) }, [{ id: 9002, pts: chain.pts, cum: chain.cum, len: chain.len, w: chain.w, kind: chain.kind, a: chain.a, b: chain.b }]);
      LABELS.push({ text: 'Luxury coast', level: 'district', x: -690, y: 40, z: -330 }); const df = {}; for (const k in WHY) if (WHY[k] !== (w0[k] || 0)) df[k] = WHY[k] - (w0[k] || 0); WORKS.luxury = { lots: n, why: df, len: Math.round(chain.len), pts: chain.pts.filter((p, i) => i % 3 === 0).map(p => [Math.round(p[0]), Math.round(p[1]), Math.round(p[2])]) }; lap('luxury');
    }
    function marina() { // a yacht harbour in the cove: a clubhouse, a restaurant on the water, jetties with yachts moored along them
      const N = nodes['MC']; if (!N) return; const R2 = rng(61), sh = shoreFrom(N.x, N.z, -1, 0.2, 90); keepClear(N.x - 70, N.x + 30, N.z - 70, N.z + 70);
      const jets = [-26, -8, 10, 28]; jets.forEach((dz, i) => { const z0 = sh[1] + dz, p = pier(sh[0] + 4, z0, sh[0] - 36, z0 + (i % 2 ? 2 : -2), 3.2, 0.9); for (let k = 0; k < 4; k++) { const bx = sh[0] - 8 - k * 8, bz = z0 + (k % 2 ? 4.6 : -4.6); boat(bx, bz, Math.PI / 2 + (k % 2 ? 0.05 : -0.05), 9 + (k + i) % 3 * 2, 0xffffff, [0x1f4f86, 0x2e74c9, 0x111827, 0xd8392b][(k + i) % 4], 0.3); } });
      addBuilding({ id: 'marinaclub', type: 'lean', style: 'coral', name: 'Marina Club', area: 'Marina Cove', x: N.x - 2, z: N.z - 18, y: groundY(N.x - 2, N.z - 18), rot: -Math.PI / 2, w: 16, d: 10, floors: 2, color: 0xffffff, roof: 0x2e6fbf, owner: 'city', shop: true, sign: SG['MARINA CLUB'], awn: 0x1f4f86 });
      addBuilding({ id: 'marinarest', type: 'lean', style: 'coral', name: 'Marina restaurant', area: 'Marina Cove', x: N.x - 2, z: N.z + 14, y: groundY(N.x - 2, N.z + 14), rot: -Math.PI / 2, w: 14, d: 9, floors: 1, color: 0xfff3dc, owner: 'city', shop: true, sign: SG.RESTAURANT, awn: 0xc0392b });
      LABELS.push({ text: 'Marina Cove', level: 'district', x: N.x - 20, y: 30, z: N.z }, { text: 'Yacht marina', level: 'place', x: sh[0] - 14, y: 10, z: sh[1], small: true }); WORKS.marina = { shore: [sh[0], sh[1]] }; lap('marina');
    }
    function westCoast() { resort(roadChains(id => /^C[5-8]/.test(id)).filter(ch => ch.pts[0][2] < -526 || ch.pts[ch.pts.length - 1][2] < -526).map(ch => trimChain(ch, -526))); coralBay(); luxury(); marina(); }

    // ---------- landmarks: a historic fort, a lighthouse, a waterfall with its viewing deck, a lookout, a botanical garden, a waterfront tower, and the trails that join them ----------
    const STONE = 0xd2c4a2, DSTONE = 0x8f8672, SLATE = 0x4a525c;
    const flat = (x, z, w, d, c, lift = 0.14, rot = 0) => { tileAt(x, z); boxAt('lawn', new THREE.Matrix4().makeRotationY(rot).setPosition(x, groundY(x, z), z), w, lift, d, 0, 0.02, 0, C(c)); };
    const bar = (a, b, w, c) => barBox('trim', a, b, w, C(c));
    function fort() { // Fort Verity: a stone fort on the cliff of Fort Point, four bastions, a gate on the landward side, a keep and barracks round a parade ground, cannons, a flagpole
      const FP = nodes['FP']; if (!FP) return; const cx = 392, cz = -874, hw = 14, hd = 12, P = 12.4, M = new THREE.Matrix4().setPosition(cx, 0, cz), H = 5, T = 2.6, gw = 2.6;
      keepClear(cx - 40, cx + 52, cz - 40, cz + 62); NOFIELD.push([cx - 40, cx + 52, cz - 40, cz + 62]); tileAt(cx, cz);
      boxAt('trim', M, hw * 2 + 4, P - 3, hd * 2 + 4, 0, 3, 0, C(DSTONE)); boxAt('lawn', M, hw * 2 - 2, 0.15, hd * 2 - 2, 0, P, 0, C(0xcdbf99));
      for (const [x, z, w, d] of [[0, -hd + T / 2, hw * 2, T], [-hw + T / 2, 0, T, hd * 2], [hw - T / 2, 0, T, hd * 2]]) boxAt('trim', M, w, H, d, x, P, z, C(STONE));
      for (const s of [-1, 1]) boxAt('trim', M, hw - gw, H, T, s * (gw + (hw - gw) / 2), P, hd - T / 2, C(STONE));
      boxAt('trim', M, gw * 2 + 3, 2.2, T + 1.2, 0, P + H - 0.2, hd - T / 2, C(STONE)); for (const s of [-1, 1]) boxAt('trim', M, 3.2, H + 3, T + 1.4, s * (gw + 1.6), P, hd - T / 2, C(STONE)); boxAt('trim', M, gw * 2, 0.5, 0.5, 0, P + H - 1, hd - T / 2 + 0.3, C(0x3a2f26));
      for (const s of [-1, 1]) boxAt('trim', M, 0.9, 1.1, 0.9, s * (gw + 1.6), P + H + 3, hd + 0.6, C(STONE));
      // merlons along the four parapets
      for (const [x0, z0, x1, z1] of [[-hw, -hd + 0.6, hw, -hd + 0.6], [-hw + 0.6, -hd, -hw + 0.6, hd], [hw - 0.6, -hd, hw - 0.6, hd], [-hw, hd - 0.6, -gw - 3.2, hd - 0.6], [gw + 3.2, hd - 0.6, hw, hd - 0.6]]) { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2.5)); for (let i = 0; i <= n; i++) boxAt('trim', M, 1.2, 1.1, 1.2, mix(x0, x1, i / n), P + H, mix(z0, z1, i / n), C(STONE)); }
      // four diamond bastions with gun decks and cannons on the sea side
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const bx = sx * hw, bz = sz * hd; boxAt('trim', M, 9.6, H + 1.2, 9.6, bx, P - 0.6, bz, C(STONE), Math.PI / 4); boxAt('lawn', M, 7.6, 0.2, 7.6, bx, P + H + 0.6, bz, C(0xb9ad8c), Math.PI / 4); if (sz < 0 || sx > 0) { const gx = cx + bx, gz = cz + bz, ox = sx * 0.7, oz = sz * 0.7, y = P + H + 1.5; bar([gx - ox * 1.4, y, gz - oz * 1.4], [gx + ox * 2.8, y + 0.2, gz + oz * 2.8], 0.8, 0x2f3238); boxAt('trim', M, 1.4, 0.7, 1.4, bx, P + H + 0.8, bz, C(0x6b4a2f)); } }
      // the keep along the north wall (a tower at its west end), the barracks along the west wall, a powder store, a well and cannon balls
      const K0 = mul(M, 2, 0, -hd + T + 4.4); walls('cottage', K0, 16, 8, P, P + 7, C(0xe2d6b6), 3.8, 3.4); hip('roof', K0, 16, 8, P + 7, 3.2, C(SLATE), 0.7); const TW = mul(M, -9, 0, -hd + T + 3.2); geoAt('trim', CYL, TW, 0, P + 8.5, 0, C(0xd8caa6), 0, 3, 17, 3); geoAt('roof', new THREE.ConeGeometry(3.6, 4.6, 14), TW, 0, P + 19.3, 0, C(0x8a3a2a));
      const B0 = mul(M, -hw + T + 3.4, 0, 3); walls('cottage', B0, 5.6, 14, P, P + 4.2, C(0xe8dcc0), 3.6, 3.2); gable('roof', B0, 5.6, 14, P + 4.2, 2.4, C(SLATE), 0.5);
      const PS = mul(M, 8, 0, 3.2); boxAt('trim', PS, 6, 3.4, 5, 0, P, 0, C(0xb9ad8c)); geoAt('roof', new THREE.CylinderGeometry(0.1, 3.4, 1.6, 10), PS, 0, P + 4.2, 0, C(0x4a525c)); geoAt('trim', CYL8, M, 2, P + 0.5, 3.5, C(0x9a927c), 0, 1.1, 1, 1.1); geoAt('water', CYL8, M, 2, P + 1.05, 3.5, C(0x2f6f93), 0, 0.8, 0.05, 0.8);
      for (let i = 0; i < 6; i++) geoAt('trim', SPH, M, -4 + (i % 3) * 0.7 + (i > 2 ? 0.35 : 0), P + 0.4 + (i > 2 ? 0.6 : 0), 6 + (i > 2 ? 0.4 : 0), C(0x2f3238), 0, 0.35, 0.35, 0.35);
      for (const [x, z, a] of [[8, -2, 0.7], [-1, 6, 2.2]]) { const gx = cx + x, gz = cz + z, y = P + 0.9; bar([gx - Math.sin(a) * 1.2, y, gz - Math.cos(a) * 1.2], [gx + Math.sin(a) * 1.8, y, gz + Math.cos(a) * 1.8], 0.7, 0x2f3238); boxAt('trim', M, 1.3, 0.5, 1.5, x, P + 0.2, z, C(0x6b4a2f)); }
      // the flagpole
      bar([cx + 4, P, cz - 2], [cx + 4, P + 17, cz - 2], 0.35, 0xe8e8e8); boxAt('trim', M, 3.6, 1.2, 0.08, 4 + 1.9, P + 15.6, -2, C(0xd8392b)); boxAt('trim', M, 3.6, 1.2, 0.08, 4 + 1.9, P + 14.4, -2, C(0xffffff));
      // the way in: stone paving to the gate, a car park at the end of the road, the visitor centre, a coast path with a viewpoint
      flat(cx, cz + hd + 6, 7, 10, 0xcfc4ad, 0.12); const FPn = { x: FP.x, z: FP.z }; flat(FPn.x - 2, FPn.z - 1, 28, 15, 0x4a4f57, 0.16); for (let i = 0; i < 8; i++) { const x = FPn.x - 12 + i * 3.4, z = FPn.z + (i % 2 ? 3.4 : -5.4); boxAt('lawn', new THREE.Matrix4().setPosition(x, groundY(x, z), z), 0.18, 0.2, 5, 0, 0.05, 0, C(0xf4f4f0)); }
      for (let i = 0; i < 4; i++) PARKED.push([['sedan', 'suv', 'compact', 'sedan'][i], FPn.x - 10 + i * 6.8, FPn.z - 6.1, 0, groundY(FPn.x, FPn.z)]);
      addBuilding({ id: 'fvvisit', type: 'lean', style: 'coral', name: 'Fort Verity visitor centre', area: 'Fort Verity', x: FPn.x + 14, z: FPn.z - 4, y: groundY(FPn.x + 14, FPn.z - 4), rot: Math.PI, w: 13, d: 8, floors: 1, color: 0xefe6cf, roof: 0x8a3a2a, owner: 'city', shop: true, sign: SG.VISITORS });
      path([[FPn.x - 2, FPn.z - 8], [FPn.x, FPn.z - 16], [cx, cz + hd + 4]], { w: 2.2, snap: 3 }); path([[cx + hw + 3, cz - 6], [cx + hw + 14, cz - 12], [cx + hw + 26, cz - 8]], { w: 1.6, snap: 3 }); bench(cx + hw + 25, cz - 10, 1.2, groundY(cx + hw + 25, cz - 10) + 0.1);
      LABELS.push({ text: 'Fort Verity', level: 'district', x: cx, y: 40, z: cz }, { text: 'Fort Point', level: 'place', x: cx + 40, y: 14, z: cz - 20, small: true }); WORKS.fort = { at: [cx, cz] }; lap('fort');
    }
    function lantern() { // Lantern Head: a striped lighthouse on the rocky tip, a keeper's cottage and an oil store, a stone wall, a rotating beam
      const tr = (G.NEW_TRAILS || []).find(t => t.id === 'C8LH2'); if (!tr) return; const N = { x: tr.pts[tr.pts.length - 1][0], z: tr.pts[tr.pts.length - 1][1] }; const x0 = -1008, z0 = -906, y0 = groundY(x0, z0), M = new THREE.Matrix4().setPosition(x0, 0, z0), base = y0 - 3.5, stripes = [0xffffff, 0xd8392b, 0xffffff, 0xd8392b, 0xffffff];
      keepClear(x0 - 30, x0 + 40, z0 - 30, z0 + 36); tileAt(x0, z0); geoAt('trim', CYL, M, 0, base + 3, 0, C(0x7d7568), 0, 9.4, 6.6, 9.4); geoAt('trim', CYL, M, 0, y0 + 1.8, 0, C(0x9a927c), 0, 6.6, 1.2, 6.6);
      let y = y0 + 2.4; stripes.forEach((c, i) => { const r0 = 4.4 - i * 0.34, r1 = r0 - 0.34, hh = 6; geoAt('trim', new THREE.CylinderGeometry(r1, r0, hh, 18), M, 0, y + hh / 2, 0, C(c)); y += hh; });
      geoAt('trim', CYL, M, 0, y + 0.25, 0, C(0x3a3f47), 0, 3.9, 0.5, 3.9); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; bar([x0 + Math.cos(a) * 3.7, y + 0.5, z0 + Math.sin(a) * 3.7], [x0 + Math.cos(a) * 3.7, y + 1.7, z0 + Math.sin(a) * 3.7], 0.14, 0x3a3f47); } geoAt('trim', new THREE.TorusGeometry(3.7, 0.08, 4, 20).rotateX(Math.PI / 2), M, 0, y + 1.7, 0, C(0x3a3f47));
      geoAt('glow', CYL, M, 0, y + 2.4, 0, C(0xfff3b0), 0, 2.1, 3.6, 2.1); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; bar([x0 + Math.cos(a) * 2.15, y + 0.6, z0 + Math.sin(a) * 2.15], [x0 + Math.cos(a) * 2.15, y + 4.2, z0 + Math.sin(a) * 2.15], 0.12, 0x3a3f47); }
      geoAt('roof', new THREE.ConeGeometry(2.8, 2.4, 14), M, 0, y + 5.4, 0, C(0xb0301f)); geoAt('trim', SPH, M, 0, y + 6.9, 0, C(0x3a3f47), 0, 0.35, 0.35, 0.35); bar([x0, y + 6.9, z0], [x0, y + 9.2, z0], 0.1, 0x3a3f47);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.16, depthWrite: false })); beam.position.set(x0, y + 2.4, z0); scene.add(beam); tick.push(dt => { beam.rotation.y += dt * 0.9; });
      // the keeper's cottage, the oil store, a low stone wall and the path to the headland trail
      const cx = x0 + 15, cz = z0 + 10, C0 = mul(M, 15, 0, 10), ch = groundY(cx, cz); boxAt('trim', mul(C0, 0, 0, 0), 12.4, Math.max(1, 2), 8.4, 0, ch - 1.6, 0, C(0x9a927c)); walls('cottage', mul(C0, 0, ch, 0), 11, 7, 0.4, 3.6, C(0xf4efe3), 3.6, 3.2); gable('roof', mul(C0, 0, ch, 0), 11, 7, 3.6, 2.8, C(0xb4552d), 0.7); boxAt('trim', mul(C0, 0, ch, 0), 1.3, 2.2, 0.2, -2.2, 0.4, 3.6, C(0x2f6f5f)); boxAt('trim', mul(C0, 0, ch, 0), 1.2, 3.4, 1.2, 3.8, 3.2, -1.2, C(0xc9b9a0));
      const O0 = mul(M, 6, 0, 12), oh = groundY(x0 + 6, z0 + 12); walls('cottage', mul(O0, 0, oh, 0), 5, 4.4, 0.3, 2.8, C(0xe8e2d2), 3.2, 3); gable('roof', mul(O0, 0, oh, 0), 5, 4.4, 2.8, 1.8, C(SLATE), 0.4);
      const wall = []; for (let a = 0.2; a < 2.3; a += 0.12) { const wx = x0 + Math.cos(a - 0.6) * 15 - 2, wz = z0 + Math.sin(a - 0.6) * 15 + 6; if (land(wx, wz) > 5) wall.push([wx, wz]); } for (let i = 1; i < wall.length; i++) bar([wall[i - 1][0], groundY(wall[i - 1][0], wall[i - 1][1]) + 0.2, wall[i - 1][1]], [wall[i][0], groundY(wall[i][0], wall[i][1]) + 0.2, wall[i][1]], 0.6, 0xc9bfa6);
      path([[N.x, N.z], [N.x - 12, N.z + 5], [cx - 4, cz + 6]], { w: 1.6, snap: 3 }); extraTrees.push([x0 + 22, groundY(x0 + 22, z0 - 2), z0 - 2, 0.9, 'pine'], [x0 + 26, groundY(x0 + 26, z0 + 8), z0 + 8, 1, 'pine'], [x0 + 20, groundY(x0 + 20, z0 + 20), z0 + 20, 0.85, 'pine']);
      LABELS.push({ text: 'Lantern Head', level: 'district', x: x0 + 10, y: 50, z: z0 }, { text: 'Lantern Head Light', level: 'place', x: x0, y: y + 12, z: z0, small: true }); WORKS.lantern = { at: [x0, z0], height: Math.round(y + 9 - y0) }; lap('lantern');
    }
    function falls() { // Silverfall: a car park and kiosk at the end of the road, a timber viewing deck on the bank facing the fall, benches and an information board
      const FL = nodes['FL'], F = G.FALL; if (!FL || !F) return; keepClear(FL.x - 40, FL.x + 50, FL.z - 40, FL.z + 40);
      flat(FL.x - 4, FL.z + 8, 20, 12, 0x4a4f57, 0.16); for (let i = 0; i < 3; i++) PARKED.push([['suv', 'sedan', 'compact'][i], FL.x - 10 + i * 6, FL.z + 8, Math.PI / 2, groundY(FL.x, FL.z)]);
      addBuilding({ id: 'flkiosk', type: 'kiosk', name: 'Silverfall kiosk', area: 'Silverfall', x: FL.x + 10, z: FL.z + 10, y: groundY(FL.x + 10, FL.z + 10), rot: Math.PI, w: 7, d: 5, sign: SG.FALLS, awn: 0x2a8fd0, owner: 'city' });
      const px = -F.dz, pz = F.dx, side = ((FL.x - F.x) * px + (FL.z - F.z) * pz) > 0 ? 1 : -1, DC = [F.x + F.dx * 10 + px * side * 12, F.z + F.dz * 10 + pz * side * 12];
      const dx = F.x + F.dx * 1.5 - DC[0], dz = F.z + F.dz * 1.5 - DC[1], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, ry = Math.atan2(ux, uz), gy = groundY(DC[0], DC[1]), D = new THREE.Matrix4().makeRotationY(ry).setPosition(DC[0], gy + 0.45, DC[1]); tileAt(DC[0], DC[1]);
      boxAt('trim', D, 6.4, 0.3, 5.2, 0, 0, 0, C(0x9a7048)); for (let i = 0; i < 7; i++) boxAt('trim', D, 0.06, 0.04, 5.2, -3 + i * 1, 0.3, 0, C(0x7a5538)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt('trim', D, 0.35, 1.6, 0.35, sx * 2.9, -1.5, sz * 2.3, C(0x6a4a30));
      for (const [x, z, w, d] of [[0, 2.5, 6.4, 0.1], [-3.2, 0, 0.1, 5.2], [3.2, 0, 0.1, 5.2]]) { boxAt('trim', D, w, 0.1, d, x, 1.15, z, C(0x6a4a30)); boxAt('trim', D, w === 0.1 ? 0.07 : w, 0.07, w === 0.1 ? d : 0.07, x, 0.65, z, C(0x6a4a30)); } for (let i = 0; i <= 6; i++) boxAt('trim', D, 0.1, 1.2, 0.1, -3.2 + i * 1.07, 0.3, 2.5, C(0x6a4a30));
      const bx = DC[0] - ux * 4.2, bz = DC[1] - uz * 4.2; bench(bx - uz * 1.8, bz + ux * 1.8, ry, groundY(bx, bz) + 0.1); bench(bx + uz * 1.8, bz - ux * 1.8, ry, groundY(bx, bz) + 0.1); boxAt('trim', D, 0.14, 1.5, 0.14, -2.4, -2.9, -3.4, C(0x6a4a30)); boxAt('trim', D, 0.14, 1.5, 0.14, -0.4, -2.9, -3.4, C(0x6a4a30)); boxAt('trim', D, 2.2, 0.9, 0.1, -1.4, 0.35, -3.4, C(0xf4efe3)); sign(D, SG.FALLS, 2, 0.8, -1.4, 0.8, -3.34, Math.PI);
      path([[FL.x, FL.z + 2], [(FL.x + DC[0] - ux * 3) / 2, (FL.z + DC[1] - uz * 3) / 2], [DC[0] - ux * 3.2, DC[1] - uz * 3.2]], { w: 1.8, snap: 3 });
      LABELS.push({ text: 'Silverfall', level: 'district', x: F.x, y: 40, z: F.z }, { text: 'Viewing deck', level: 'place', x: DC[0], y: gy + 6, z: DC[1], small: true }); WORKS.falls = { deck: [Math.round(DC[0]), Math.round(DC[1])] }; lap('falls');
    }
    function lookout() { // Sentinel lookout: a stone tower with a viewing deck, a ring of benches and a car park at the end of the mountain road
      const N = nodes['SL']; if (!N) return; const x0 = N.x - 14, z0 = N.z - 8, y0 = groundY(x0, z0), M = new THREE.Matrix4().setPosition(x0, 0, z0); keepClear(N.x - 40, N.x + 40, N.z - 40, N.z + 40); tileAt(x0, z0);
      geoAt('trim', CYL, M, 0, y0 + 0.4, 0, C(0x8f8672), 0, 7.5, 1.8, 7.5); geoAt('trim', new THREE.CylinderGeometry(3.2, 3.8, 11, 14), M, 0, y0 + 6.5, 0, C(0xc9bfa6)); geoAt('trim', CYL, M, 0, y0 + 12.2, 0, C(0x8f8672), 0, 5.2, 0.7, 5.2); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; bar([x0 + Math.cos(a) * 5, y0 + 12.5, z0 + Math.sin(a) * 5], [x0 + Math.cos(a) * 5, y0 + 13.6, z0 + Math.sin(a) * 5], 0.16, 0x4a4f57); } geoAt('trim', new THREE.TorusGeometry(5, 0.1, 4, 24).rotateX(Math.PI / 2), M, 0, y0 + 13.6, 0, C(0x4a4f57));
      boxAt('trim', M, 1.4, 2.2, 0.3, 0, y0 + 2, 3.7, C(0x3a2f26)); bar([x0, y0 + 12.5, z0], [x0, y0 + 20, z0], 0.12, 0xe8e8e8); boxAt('trim', M, 2.4, 1.2, 0.06, 1.3, y0 + 18.6, 0, C(0x2e74c9));
      const px = N.x, pz = N.z; flat(px - 2, pz + 3, 18, 10, 0x4a4f57, 0.16); for (let i = 0; i < 2; i++) PARKED.push([['suv', 'compact'][i], px - 8 + i * 6.5, pz + 3, Math.PI / 2, groundY(px, pz)]);
      for (let i = 0; i < 3; i++) { const a = -0.6 + i * 0.9, bx = x0 + Math.cos(a) * 9.4, bz = z0 + Math.sin(a) * 9.4; bench(bx, bz, -a + Math.PI / 2, groundY(bx, bz) + 0.1); }
      path([[px, pz], [px - 6, pz - 3], [x0 + 6, z0 + 3]], { w: 1.8, snap: 3 }); boxAt('trim', mul(M, 0, y0, 0), 5.4, 1.5, 0.5, 0, 5.2, 3.1, C(0x3a2f26)); sign(mul(M, 0, y0, 0), SG.LOOKOUT, 5, 1.2, 0, 5.35, 3.4, 0);
      LABELS.push({ text: 'Sentinel Lookout', level: 'place', x: x0, y: y0 + 22, z: z0 }, { text: 'Sentinel Peak', level: 'district', x: -560, y: 130, z: -790 }); WORKS.lookout = { at: [x0, z0] }; lap('lookout');
    }
    function garden() { // the Capital Botanical Garden: a glasshouse, a formal parterre round a fountain, a pond with a bridge and a tea house, a loop path and a collection of trees, in the meadow west of the Old Quarter
      let best = null; for (let x = -340; x <= -225; x += 6) for (let z = -190; z <= 40; z += 6) { if (!fitsAt(x, z, 104, 74, 0, { slope: 4.2, road: 5, coast: 24, river: 8 })) continue; const d = Math.hypot(x + 215, z + 66); if (!best || d < best.d) best = { x, z, d }; }
      if (!best) { WORKS.garden = null; return; } const gx = best.x, gz = best.z; keepClear(gx - 56, gx + 56, gz - 40, gz + 40); NOFIELD.push([gx - 56, gx + 56, gz - 40, gz + 40]); reserve({ x: gx, z: gz, w: 106, d: 76, rot: 0 });
      // the gate is on the side that is nearest a road; the garden is drawn with the gate to the +z of a turned frame
      const sides = [[0, 1, 0], [0, -1, Math.PI]].map(([sx, sz, rot]) => ({ rot, d: nearRoad(gx + sx * (sx ? 52 : 0) + (sx ? 0 : 0), gz + sz * (sz ? 37 : 0))[0] })).sort((p, q) => p.d - q.d)[0], rot = sides.rot, Rm = new THREE.Matrix4().makeRotationY(rot);
      const W = (x, z) => { const v = new THREE.Vector3(x, 0, z).applyMatrix4(Rm); return [gx + v.x, gz + v.z]; }, M = new THREE.Matrix4().makeRotationY(rot).setPosition(gx, groundY(gx, gz), gz), gy = (x, z) => { const p = W(x, z); return groundY(p[0], p[1]); };
      const sw = rot === 0 || rot === Math.PI ? 104 : 74, sd = rot === 0 || rot === Math.PI ? 74 : 104; tileAt(gx, gz); boxAt('lawn', M, 100, 0.12, 70, 0, -0.04, 0, C(0x78c25a));
      const GW = 100, GD = 70, paths = [], P = (pts, w = 2.2) => { path(pts.map(([x, z]) => W(x, z)), { w, snap: 3 }); for (let i = 1; i < pts.length; i++) paths.push([pts[i - 1], pts[i], w]); };
      // glasshouse at the far (-z) end with a dome over the middle and two wings
      const GH = mul(M, 0, 0, -GD / 2 + 11); boxAt('trim', GH, 40, 0.8, 15, 0, -0.2, 0, C(0xe9e6df)); boxAt('glassy', GH, 12, 7.2, 12.4, 0, 0.6, 0, C(0xbfe3ea)); for (const s of [-1, 1]) boxAt('glassy', GH, 13, 5, 12, s * 13, 0.6, 0, C(0xbfe3ea)); gable('glassy', GH, 12, 12.4, 7.8, 3, C(0xcfeef2), 0.2); for (const s of [-1, 1]) gable('glassy', GH, 13, 12, 5.6, 2.6, C(0xcfeef2), 0.2); geoAt('glassy', new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), GH, 0, 7.4, 0, C(0xa9dbe8), 0, 5.4, 4.6, 5.4); for (let i = -3; i <= 3; i++) for (const sz of [-1, 1]) boxAt('trim', GH, 0.2, 5, 0.2, i * 5.6, 0.6, sz * 6.1, C(0xf4f1ea)); sign(GH, SG.GARDENS, 6, 1.4, 0, 6, 6.3, 0);
      for (let i = 0; i < 6; i++) { const q = W(-16 + i * 6.4, -GD / 2 + 11 + (i % 2 ? 2 : -2)); extraTrees.push([q[0], groundY(q[0], q[1]), q[1], 0.7, i % 3 ? 'palm' : 'round']); }
      // the gate pavilion and the gate path
      const gp = W(0, GD / 2 - 5); addBuilding({ id: 'bgate', type: 'lean', style: 'coral', name: 'Botanical Garden', area: 'Botanical Garden', x: gp[0], z: gp[1], y: groundY(gp[0], gp[1]), rot: rot, w: 14, d: 7, floors: 1, color: 0xf1ead6, roof: 0x2f8f3a, owner: 'city', shop: true, sign: SG.GARDENS });
      // the fountain, the parterre of eight beds round it, the cross paths and the loop
      const FZ = 8; geoAt('trim', CYL, M, 0, 0, FZ, C(0xe6e0d2), 0, 5.4, 0.7, 5.4); geoAt('water', CYL, M, 0, 0.55, FZ, C(0x4fb8d8), 0, 4.8, 0.2, 4.8); geoAt('trim', CYL8, M, 0, 0.5, FZ, C(0xe6e0d2), 0, 0.5, 2.6, 0.5); geoAt('water', SPH, M, 0, 3, FZ, C(0xcdeefa), 0, 0.6, 0.6, 0.6);
      const R3 = rng(77), BEDC = [0xe8483f, 0xf2b705, 0xff6f91, 0x8a5bd6, 0xffffff, 0xff8a3d, 0x2e74c9, 0xf2b705]; let bi = 0; for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const k of [0, 1]) { const x = sx * (11 + k * 9.4), z = FZ + sz * (7 + (k ? 3 : 0)) + (sz > 0 ? 1 : -1); if (k && sz < 0) continue; const p = W(x, z), bc = BEDC[bi++ % 8]; slab(p[0], p[1], 8, 5.4, 0x4f9e3a, { k: 'bed', y: groundY(p[0], p[1]) + 0.16, tile: 3 }); for (let f = 0; f < 22; f++) { const fx = p[0] + (R3() - 0.5) * 7.2, fz = p[1] + (R3() - 0.5) * 4.6; boxAt('trim', new THREE.Matrix4().setPosition(fx, groundY(fx, fz) + 0.18, fz), 0.55, 0.45, 0.55, 0, 0, 0, C(f % 4 ? bc : 0xffffff)); } }
      P([[0, GD / 2 - 4], [0, FZ + 6]], 3); P([[0, FZ - 6], [0, -GD / 2 + 19]], 3); P([[-GD / 2 - 6, FZ], [-6, FZ]]); P([[6, FZ], [GD / 2 + 6, FZ]]);
      P([[-44, -GD / 2 + 20], [-44, GD / 2 - 6], [-8, GD / 2 - 6]]); P([[8, GD / 2 - 6], [44, GD / 2 - 6], [44, -GD / 2 + 20], [8, -GD / 2 + 20]]); P([[-8, -GD / 2 + 20], [-44, -GD / 2 + 20]]);
      // a pond on the east side with stepping stones, an arched bridge and the tea house
      const PX = 30, PZ = 6; geoAt('trim', CYL, M, PX, 0, PZ, C(0xcdbfa0), 0, 12.4, 0.5, 8.4); geoAt('water', CYL, M, PX, 0.2, PZ, C(0x4fb8d8), 0, 11.4, 0.3, 7.4); for (let i = 0; i < 4; i++) geoAt('water', CYL8, M, PX - 4 + i * 2.6, 0.55, PZ - 4.4 + (i % 2) * 1.2, C(0x3f9e4a), 0, 0.7, 0.08, 0.7); boxAt('trim', M, 8, 0.4, 3, PX, 0.9, PZ + 1, C(0xe9e6df)); boxAt('trim', M, 4, 0.4, 3, PX, 1.3, PZ + 1, C(0xe9e6df)); for (const s of [-1, 1]) boxAt('trim', M, 8, 0.8, 0.15, PX, 1.1, PZ + 1 + s * 1.4, C(0xe9e6df));
      const th = W(PX + 6, PZ + 14); addBuilding({ id: 'bgtea', type: 'lean', style: 'coral', name: 'Garden tea house', area: 'Botanical Garden', x: th[0], z: th[1], y: groundY(th[0], th[1]), rot: rot, w: 10, d: 7, floors: 1, color: 0xf4e4c8, roof: 0xa15c38, owner: 'city', shop: true, sign: SG.TEAHOUSE, noPath: true });
      P([[PX - 12, FZ], [PX - 8, PZ + 12], [PX + 6, PZ + 10]], 1.8);
      // the tree collection and benches
      const R2 = rng(2025), ok = (x, z) => { if (Math.abs(x) > 47 || Math.abs(z) > 32) return false; if (z < -GD / 2 + 21 && Math.abs(x) < 24) return false; if (Math.hypot((x - PX) / 8, (z - PZ) / 6.4) < 1.2) return false; if (Math.hypot(x, z - FZ) < 22 && Math.abs(x) < 30) return false; for (const [a, b, w] of paths) { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1); if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < w / 2 + 2.2) return false; } return true; };
      let nt = 0; for (let i = 0; i < 260 && nt < 46; i++) { const x = (R2() - 0.5) * 94, z = (R2() - 0.5) * 66; if (!ok(x, z)) continue; const q = W(x, z), r = R2(); extraTrees.push([q[0], groundY(q[0], q[1]), q[1], 0.75 + R2() * 0.5, r < 0.3 ? 'palm' : r < 0.45 ? 'cypress' : r < 0.55 ? 'pine' : 'round']); nt++; }
      for (const [x, z, a] of [[-20, GD / 2 - 9, 0], [20, GD / 2 - 9, 0], [-46, 2, 1.57], [46, -4, -1.57]]) { const q = W(x, z); bench(q[0], q[1], a + rot, groundY(q[0], q[1]) + 0.1); }
      LABELS.push({ text: 'Botanical Garden', level: 'district', x: gx, y: 30, z: gz }, { text: 'Glasshouse', level: 'place', x: W(0, -GD / 2 + 11)[0], y: 14, z: W(0, -GD / 2 + 11)[1], small: true }); WORKS.garden = { at: [Math.round(gx), Math.round(gz)], trees: nt, rot }; lap('garden');
    }
    function beacon() { // the Beacon: a slim waterfront tower with a viewing pod and a red light, on a round plaza at the edge of the capital's east shore
      let best = null; for (let x = 160; x <= 340; x += 5) for (let z = -300; z <= -30; z += 5) { if (!fitsAt(x, z, 36, 36, 0, { slope: 3, road: 6, coast: 11, river: 8 })) continue; const l = land(x, z); if (!best || l < best.l) best = { x, z, l }; }
      if (!best) { WORKS.beacon = null; return; } const x0 = best.x, z0 = best.z, y0 = groundY(x0, z0), M = new THREE.Matrix4().setPosition(x0, 0, z0); keepClear(x0 - 24, x0 + 24, z0 - 24, z0 + 24); reserve({ x: x0, z: z0, w: 40, d: 40, rot: 0 }); tileAt(x0, z0);
      geoAt('lawn', CYL, M, 0, y0, 0, C(0xd9d2c3), 0, 17, 0.2, 17); geoAt('lawn', CYL, M, 0, y0 + 0.15, 0, C(0xc9c1b0), 0, 12.5, 0.12, 12.5); geoAt('trim', CYL, M, 0, y0 + 0.2, 0, C(0xe9e6df), 0, 7.4, 1.4, 7.4);
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5, bx = Math.cos(a) * 4.4, bz = Math.sin(a) * 4.4; bar([x0 + bx, y0 + 0.4, z0 + bz], [x0 + Math.cos(a) * 1.6, y0 + 22, z0 + Math.sin(a) * 1.6], 1.6, 0xdfe3e6); }
      geoAt('trim', new THREE.CylinderGeometry(2.2, 3.2, 62, 20), M, 0, y0 + 31.5, 0, C(0xf1f3f4)); for (let k = 0; k < 4; k++) geoAt('trim', new THREE.CylinderGeometry(2.3 - k * 0.04, 2.3 - k * 0.04, 0.4, 20), M, 0, y0 + 14 + k * 14, 0, C(0x2e74c9));
      const PY = y0 + 63; geoAt('trim', new THREE.CylinderGeometry(9.2, 4.2, 4, 24), M, 0, PY - 1, 0, C(0xe9ecee)); geoAt('glassy', CYL, M, 0, PY + 2.6, 0, C(0x7fb5d8), 0, 9.2, 4.6, 9.2); geoAt('trim', CYL, M, 0, PY + 4.8, 0, C(0x2e74c9), 0, 9.6, 0.8, 9.6); geoAt('trim', new THREE.CylinderGeometry(2.4, 9.4, 2, 24), M, 0, PY + 6, 0, C(0xe9ecee)); geoAt('trim', new THREE.CylinderGeometry(0.4, 1.2, 14, 8), M, 0, PY + 13, 0, C(0xf1f3f4)); geoAt('glow', SPH, M, 0, PY + 20.5, 0, C(0xff4b3a), 0, 1.1, 1.1, 1.1);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; bar([x0 + Math.cos(a) * 9.8, PY + 4.8, z0 + Math.sin(a) * 9.8], [x0 + Math.cos(a) * 9.8, PY + 5.8, z0 + Math.sin(a) * 9.8], 0.12, 0x3a3f47); }
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, bx = x0 + Math.cos(a) * 14.5, bz = z0 + Math.sin(a) * 14.5; if (land(bx, bz) < 5) continue; extraTrees.push([bx, groundY(bx, bz), bz, 0.7, i % 2 ? 'palm' : 'round']); if (i % 3 === 0) bench(x0 + Math.cos(a) * 11.4, z0 + Math.sin(a) * 11.4, -a + Math.PI / 2, y0 + 0.2); }
      addBuilding({ id: 'bkcafe', type: 'kiosk', name: 'Beacon café', area: 'Beacon Quay', x: x0 - 20, z: z0 + 2, y: groundY(x0 - 20, z0 + 2), rot: -Math.PI / 2, w: 7, d: 5, sign: SG['CAFÉ'], awn: 0x2e74c9, owner: 'city' });
      const toRoad = nearRoad(x0, z0), rt = K.toNet(x0 - 13, z0, { b: null, lots: [] }, 90); if (rt && rt.length > 1) path([[x0 - 13, z0]].concat(rt), { w: 2, snap: 3 });
      LABELS.push({ text: 'The Beacon', level: 'district', x: x0, y: PY + 24, z: z0 }); WORKS.beacon = { at: [x0, z0], height: Math.round(PY + 21 - y0), roadDist: Math.round(toRoad[0]) }; lap('beacon');
    }
    function trailsDraw() { for (const t of G.NEW_TRAILS || []) { if (t.id !== 'FLFALL' && t.pts.length > 1) path(t.pts, { w: t.w || 1.8, snap: 3, kind: 'trail' }); } WORKS.trails = (G.NEW_TRAILS || []).length; lap('trails'); }
    function landmarks() { for (const f of [fort, lantern, falls, lookout, garden, beacon, trailsDraw]) { try { f(); } catch (e) { console.error('landmark failed:', f.name, e); } } }

    // ---------- plots: empty ground to buy, then build on, farm or mine (the game draws and sells them: plots.js and app.js) ----------
    function plots() {
      const LOGP = [], out = [], R = rng(31337), CAT = [
        // [kind, area, boxes [x0,x1,z0,z1], w, d, how many, extra, how near a road at most]
        ['town', 'Millford', [[-130, 150, -910, -690]], 20, 22, 6, null, 60], ['town', 'Northhaven', [[-190, 70, -980, -810]], 20, 22, 4, null, 60], ['town', 'Eastgate', [[620, 920, -680, -440]], 20, 22, 5, null, 60], ['town', 'Hillcrest', [[-440, -300, -730, -630]], 18, 20, 2, null, 50],
        ['farm', 'Greenfields plain', [[40, 420, -940, -690]], 44, 32, 6, null, 90], ['farm', 'East farms', [[760, 1100, -490, -330]], 44, 32, 4, null, 90],
        ['stone', 'Redstone Quarry', [[880, 1130, -900, -640]], 34, 34, 3, { res: 'stone' }, 120], ['coal', 'Deepwell Mine', [[1040, 1280, -740, -540]], 34, 34, 3, { res: 'coal' }, 120], ['oil', 'Southern oil field', [[700, 1000, -20, 130]], 34, 34, 3, { res: 'oil' }, 120],
        ['villa', 'Luxury coast', [[-700, -540, -400, -200]], 28, 30, 4, null, 70], ['villa', 'Coral Coast', [[-860, -700, -760, -480]], 28, 30, 3, null, 70],
        ['industrial', 'Works Estate', [[740, 1040, -330, -70]], 38, 38, 5, null, 80], ['harbour', 'Northhaven quay', [[-190, 70, -990, -880]], 40, 36, 2, null, 100],
        ['tower', 'Capital', [[-260, 260, -330, 120]], 30, 30, 5, null, 70],
        // added later (Goal 40): new entries go at the END so the plots above keep their ids (the island server knows them)
        ['harbour', 'Northhaven quay', [[-320, 160, -1080, -820]], 28, 24, 2, { port: 1 }, 200], ['harbour', 'Marina Cove', [[-900, -600, -560, -280]], 28, 24, 1, { port: 1 }, 200], ['harbour', 'Eastgate docks', [[560, 1100, -800, -380]], 28, 24, 1, { port: 1 }, 200], ['harbour', 'Works quay', [[640, 1150, -380, -40]], 28, 24, 1, { port: 1 }, 200], ['harbour', 'South quay', [[560, 1100, -60, 200]], 28, 24, 1, { port: 1 }, 200]];
      for (const [kind, area, boxes, w, d, n, extra0, near] of CAT) { const res = !!(extra0 && extra0.res), port = !!(extra0 && extra0.port), extra = port ? null : extra0;
        const w0 = Object.assign({}, WHY); let made = 0, far = 0; for (let t = 0; t < 1800 && made < n; t++) {
          const b = boxes[t % boxes.length], x = b[0] + R() * (b[1] - b[0]), z = b[2] + R() * (b[3] - b[2]);
          if (!fitsAt(x, z, w + 6, d + 6, 0, { slope: res ? 9 : kind === 'farm' || kind === 'villa' ? 5.5 : 3.4, road: 3, coast: port ? 0.5 : kind === 'harbour' ? 10 : 18, river: 8 })) continue; if (nearRoad(x, z)[0] > near || (kind === 'harbour' && land(x, z) > (port ? 60 : 75))) { far++; continue; }
          if (!res && !['industrial', 'harbour'].includes(kind) && NOFIELD.some(r => x > r[0] && x < r[1] && z > r[2] && z < r[3]) || K.FARMRECTS.some(f => inR(x, z, { x: f.x, z: f.z, w: f.w + w + 10, d: f.d + d + 10, rot: f.rot || 0 }))) continue;
          if (out.some(p => Math.abs(p.x - x) < (p.w + w) / 2 + 8 && Math.abs(p.z - z) < (p.d + d) / 2 + 8)) continue;
          reserve({ x, z, w: w + 4, d: d + 4, rot: 0 }); out.push(Object.assign({ id: 'pl' + out.length, kind, area, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, y: Math.round(groundY(x, z) * 100) / 100, w, d, rot: 0, old: R() < (kind === 'town' || kind === 'villa' ? 0.5 : 0.15) }, extra || {})); made++;
        }
        const df = {}; for (const k in WHY) if (WHY[k] !== (w0[k] || 0)) df[k] = WHY[k] - (w0[k] || 0); LOGP.push([kind, area, made, far, df]);
      }
      World.plotSites = out; const by = {}; for (const p of out) by[p.kind] = (by[p.kind] || 0) + 1; WORKS.plots = { n: out.length, by }; WORKS.plots.log = LOGP; lap('plots');
    }

    // ---------- build every region, then give every new front door its path ----------
    function skyline() { // Goal 40: a skyline for the capital: tall glass towers on free ground near its streets (after plots, so plot ids stay put)
      const R = rng(4242), made = [], NAMES = ['Ocean Gate Tower', 'Coral Heights', 'Sugar Cane Plaza', 'The Lagoon Tower', 'Port Royal One', 'Island Trade Centre'], COLS = [0xcfe4f7, 0xbfe0f0, 0xe6f6ff, 0xd6ecff, 0xc9dcef, 0xdff3ff];
      for (let t = 0; t < 2600 && made.length < 6; t++) { const x = -300 + R() * 620, z = -360 + R() * 520, w = 22 + Math.floor(R() * 3) * 2;
        if (!fitsAt(x, z, w + 4, w + 4, 0, { slope: 2.4, road: 4, coast: 16, river: 8 }) || nearRoad(x, z)[0] > w / 2 + 16 || made.some(m => Math.hypot(m.x - x, m.z - z) < 70)) continue;
        const k = made.length; reserve({ x, z, w: w + 6, d: w + 6, rot: 0 }); keepClear(x - w / 2 - 3, x + w / 2 + 3, z - w / 2 - 3, z + w / 2 + 3);
        addBuilding({ id: 'sky' + k, type: 'tower', name: NAMES[k], area: 'Business Centre', x, z, y: groundY(x, z), rot: 0, w, d: w, floors: 18 + Math.floor(R() * 13), style: 1 + (k % 2), color: COLS[k], owner: 'city' }); made.push({ x, z }); }
      WORKS.skyline = made.length; lap('skyline');
    }
    const ORDER = [millford, northhaven, eastgate, hillcrest, farms, estateBlocks, terminal, airport, quarry, mine, westCoast, landmarks, plots, skyline];
    for (const f of ORDER) { try { f(); } catch (e) { console.error('region failed:', f.name, e); } }
    obstacleIndex(LOTS); entrances(LOTS);
    K.WORLD_WORKS.times = TIMES; K.WORLD_WORKS.why = WHY; K.WORLD_WORKS.fwhy = FW; Object.assign(K.WORLD_WORKS, WORKS); World.expansion = K.WORLD_WORKS;
  });
})();
