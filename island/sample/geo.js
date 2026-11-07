// Capital Island's geography: the coast, the ground, the rivers and the road network, as pure maths with no 3D library,
// so the game (world.js) and the tests share one definition. The bigger island (Goal 39) is the default; with ?classic the first
// island is exactly as it was: the same coast, the same ground, the same roads.
(function (root) {
  'use strict';
  const EXPANDED = (typeof location !== 'undefined' && !/[?&]classic\b/.test(location.search)) || (typeof process !== 'undefined' && !!process.env && process.env.ISLAND_EXPAND === '1');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const TOWN_Y = 3;

  // ---------- coastlines: hand-placed points, each marked beach (b), rock (r) or quay (q) ----------
  const OLD_MAIN_C = [[-470, -262, 'r'], [-432, -382, 'r'], [-322, -462, 'r'], [-190, -472, 'r'], [-100, -425, 'b'], [-30, -398, 'b'], [40, -432, 'b'], [120, -458, 'r'], [210, -410, 'r'], [262, -330, 'r'], [300, -252, 'r'], [322, -176, 'r'],
    [276, -110, 'r'], [256, -58, 'q'], [242, -30, 'q'], [242, 40, 'q'], [242, 118, 'q'], [272, 150, 'r'], [262, 196, 'r'], [205, 202, 'r'], [150, 172, 'b'], [70, 168, 'b'], [-20, 205, 'b'], [-110, 218, 'b'], [-195, 214, 'b'], [-238, 228, 'r'], [-280, 268, 'r'],
    [-340, 262, 'r'], [-378, 236, 'q'], [-386, 196, 'q'], [-430, 184, 'q'], [-452, 222, 'q'], [-478, 268, 'r'], [-548, 252, 'r'], [-604, 160, 'r'], [-614, 48, 'r'], [-566, -60, 'r'], [-506, -160, 'r']];
  const ISLE_C = [[446, -190, 'r'], [468, -250, 'r'], [540, -270, 'r'], [606, -228, 'r'], [618, -150, 'r'], [578, -96, 'q'], [505, -94, 'r'], [455, -128, 'r']];

  // ---------- the bigger island: new coast added to the old one ----------
  // the old island's north shore, east, south and west coast are kept point for point, so everything built on them stays where it is
  const KEPT = OLD_MAIN_C.slice(2, 37);
  const NEW_COAST = [
    [-628, -98, 'r'], [-668, -150, 'r'], [-688, -196, 'b'], [-676, -232, 'b'], [-700, -266, 'r'], [-752, -290, 'r'], [-742, -334, 'b'], [-722, -368, 'b'], [-746, -404, 'b'], [-790, -420, 'r'], // luxury bluffs and their coves
    [-858, -452, 'r'], [-896, -500, 'b'], [-890, -560, 'b'], [-884, -625, 'b'], [-892, -690, 'b'], [-906, -736, 'b'], // the resort bay: a long crescent beach
    [-892, -770, 'r'], [-940, -800, 'r'], [-952, -846, 'r'], [-1000, -870, 'r'], [-1010, -920, 'r'], [-962, -960, 'r'], [-900, -975, 'r'], // Coral Point and Lantern Head
    [-850, -1010, 'r'], [-770, -1040, 'r'], [-690, -1050, 'r'], [-620, -1040, 'b'], [-560, -1052, 'b'], [-500, -1040, 'r'], [-430, -1060, 'r'], [-350, -1048, 'r'], [-290, -1020, 'r'], // the Highlands meet the sea
    [-250, -1034, 'r'], [-205, -1050, 'r'], [-165, -1040, 'b'], [-150, -995, 'b'], [-120, -948, 'b'], [-70, -922, 'b'], [-15, -925, 'b'], [30, -950, 'b'], [55, -995, 'b'], [90, -1030, 'r'], [150, -1030, 'r'], [200, -1000, 'r'], [250, -975, 'r'], // Northhaven Bay
    [320, -955, 'r'], [390, -925, 'r'], [440, -880, 'r'], [455, -835, 'r'], [415, -800, 'r'], [360, -790, 'r'], [310, -768, 'r'], // Fort Point
    [285, -735, 'b'], [225, -730, 'b'], [160, -724, 'b'], [95, -708, 'b'], [30, -690, 'b'], [-45, -668, 'b'], [-125, -645, 'b'], [-205, -622, 'b'], [-280, -598, 'b'], [-345, -568, 'b'], [-392, -532, 'b'], [-384, -490, 'b']]; // Silver Bay and its head
  const EAST_C = [[590, -930, 'r'], [660, -985, 'r'], [750, -1015, 'b'], [850, -1045, 'r'], [950, -1050, 'r'], [1040, -1022, 'r'], [1098, -975, 'b'], [1138, -940, 'b'], [1195, -948, 'r'], [1250, -918, 'r'], [1292, -852, 'r'], [1282, -792, 'r'], [1238, -752, 'b'], [1212, -690, 'b'], [1228, -628, 'b'], [1275, -584, 'b'], [1330, -566, 'r'], [1372, -515, 'r'], [1392, -435, 'r'], [1412, -345, 'r'], [1422, -255, 'b'],
    [1446, -165, 'b'], [1470, -75, 'b'], [1500, 15, 'b'], [1520, 105, 'b'], [1525, 185, 'b'], [1500, 245, 'b'], [1440, 290, 'b'], [1350, 315, 'b'], [1250, 318, 'b'], [1150, 290, 'b'], [1062, 238, 'r'], [990, 236, 'b'], [925, 252, 'q'], [860, 246, 'q'], [800, 226, 'q'], [748, 198, 'q'], [722, 150, 'r'], [712, 80, 'r'], [700, -10, 'r'], [706, -90, 'r'], [716, -170, 'r'], [702, -240, 'r'], [676, -310, 'r'],
    [632, -372, 'r'], [606, -440, 'r'], [592, -520, 'r'], [588, -600, 'r'], [592, -690, 'r'], [584, -770, 'r'], [578, -855, 'r']];
  const islet = (x, z, r, tag = 'r') => Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2, k = 1 + 0.18 * Math.sin(i * 2.3 + x); return [x + Math.cos(a) * r * k, z + Math.sin(a) * r * k, tag]; });
  const ISLETS = [islet(-1012, -905, 24), islet(-928, -622, 15), islet(-944, -668, 11), islet(402, -764, 22), islet(60, 322, 26, 'b'), islet(-1040, -300, 16), islet(480, 285, 20)];

  const MAIN_C = EXPANDED ? KEPT.slice(34).concat(NEW_COAST, KEPT.slice(0, 34)) : OLD_MAIN_C;
  const COAST_LISTS = EXPANDED ? [MAIN_C, ISLE_C, EAST_C].concat(ISLETS) : [MAIN_C, ISLE_C];

  function curve(ctrl, per) {
    const out = [], n = ctrl.length, K = c => c[2] === 'r' ? [1, 0] : c[2] === 'q' ? [0, 1] : [0, 0];
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n], k1 = K(p1), k2 = K(p2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t, f = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
        out.push([f(0), f(1), mix(k1[0], k2[0], t), mix(k1[1], k2[1], t)]);
      }
    }
    return out;
  }
  const K = { rock: 0, quay: 0, isle: false }; // what kind of shore the last land() query was nearest to
  const WX0 = -1300, WZ0 = -1400, WW = 3200, WH = 2000; // the world's box
  function shape(P, isle, RMAX) { // signed distance to a closed coastline, fast: segments sorted into cells and bands; the distance is clipped to RMAX
    const n = P.length, segs = new Float64Array(n * 8); // each segment: x0 z0 rock0 quay0 x1 z1 rock1 quay1
    for (let i = 0, j = n - 1; i < n; j = i++) { const o = i * 8, a = P[j], b = P[i]; segs[o] = a[0]; segs[o + 1] = a[1]; segs[o + 2] = a[2]; segs[o + 3] = a[3]; segs[o + 4] = b[0]; segs[o + 5] = b[1]; segs[o + 6] = b[2]; segs[o + 7] = b[3]; }
    const CELL = 32, NX = Math.ceil(WW / CELL), NZ = Math.ceil(WH / CELL), tmp = new Array(NX * NZ), band = new Map();
    const segD = (o, x, z) => { const x0 = segs[o], z0 = segs[o + 1], ex = segs[o + 4] - x0, ez = segs[o + 5] - z0; let t = ((x - x0) * ex + (z - z0) * ez) / (ex * ex + ez * ez || 1); t = t < 0 ? 0 : t > 1 ? 1 : t; const px = x0 + t * ex - x, pz = z0 + t * ez - z; return Math.sqrt(px * px + pz * pz); };
    let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
    for (let k = 0; k < n; k++) {
      const o = k * 8, r = RMAX + CELL, i0 = Math.max(0, Math.floor((Math.min(segs[o], segs[o + 4]) - r - WX0) / CELL)), i1 = Math.min(NX - 1, Math.floor((Math.max(segs[o], segs[o + 4]) + r - WX0) / CELL)), j0 = Math.max(0, Math.floor((Math.min(segs[o + 1], segs[o + 5]) - r - WZ0) / CELL)), j1 = Math.min(NZ - 1, Math.floor((Math.max(segs[o + 1], segs[o + 5]) + r - WZ0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (segD(o, WX0 + (i + 0.5) * CELL, WZ0 + (j + 0.5) * CELL) < r) (tmp[j * NX + i] || (tmp[j * NX + i] = [])).push(k);
      for (let b = Math.floor(Math.min(segs[o + 1], segs[o + 5]) / 8); b <= Math.floor(Math.max(segs[o + 1], segs[o + 5]) / 8); b++) { if (!band.has(b)) band.set(b, []); band.get(b).push(k); }
      bx0 = Math.min(bx0, segs[o], segs[o + 4]); bx1 = Math.max(bx1, segs[o], segs[o + 4]); bz0 = Math.min(bz0, segs[o + 1], segs[o + 5]); bz1 = Math.max(bz1, segs[o + 1], segs[o + 5]);
    }
    bx0 -= RMAX; bx1 += RMAX; bz0 -= RMAX; bz1 += RMAX;
    // each cell's segments nearest-first, with their distance from the cell centre: a point in the cell is never closer to a
    // segment than (that distance - the cell's half diagonal), so the search stops as soon as the rest can't beat the best
    // found (same answer as checking every segment, in a fraction of the work)
    const dist = new Array(NX * NZ), HALF = CELL * 0.7072;
    for (let c = 0; c < tmp.length; c++) { const L = tmp[c]; if (!L) continue; const cx = WX0 + (c % NX + 0.5) * CELL, cz = WZ0 + (Math.floor(c / NX) + 0.5) * CELL, dd = L.map(k => segD(k * 8, cx, cz)), ord = L.map((_, i) => i).sort((p, q) => dd[p] - dd[q]); tmp[c] = Int32Array.from(ord, i => L[i]); dist[c] = Float64Array.from(ord, i => dd[i]); }
    return (x, z) => {
      if (x < bx0 || x > bx1 || z < bz0 || z > bz1) { K.rock = 1; K.quay = 0; K.isle = isle; return -RMAX; } // far from this coast
      const ci = Math.floor((x - WX0) / CELL), cj = Math.floor((z - WZ0) / CELL), ce = cj * NX + ci, list = ci >= 0 && cj >= 0 && ci < NX && cj < NZ ? tmp[ce] : null;
      let d = RMAX, best = -1, bt = 0;
      if (list) { const dl = dist[ce]; for (let a = 0; a < list.length; a++) { if (dl[a] - HALF >= d) break; const o = list[a] * 8, x0 = segs[o], z0 = segs[o + 1], ex = segs[o + 4] - x0, ez = segs[o + 5] - z0; let t = ((x - x0) * ex + (z - z0) * ez) / (ex * ex + ez * ez || 1); t = t < 0 ? 0 : t > 1 ? 1 : t; const px = x0 + t * ex - x, pz = z0 + t * ez - z, dd = Math.sqrt(px * px + pz * pz); if (dd < d) { d = dd; best = o; bt = t; } } }
      let inside = false; const bl = band.get(Math.floor(z / 8)); if (bl) for (let a = 0; a < bl.length; a++) { const o = bl[a] * 8; if ((segs[o + 1] > z) !== (segs[o + 5] > z) && x < segs[o] + (z - segs[o + 1]) / (segs[o + 5] - segs[o + 1]) * (segs[o + 4] - segs[o])) inside = !inside; }
      K.rock = best >= 0 ? mix(segs[best + 2], segs[best + 6], bt) : 1; K.quay = best >= 0 ? mix(segs[best + 3], segs[best + 7], bt) : 0; K.isle = isle;
      return inside ? d : -d;
    };
  }
  const RM = EXPANDED ? 120 : 240; // the ground never looks further than 100 m from a shore; the old island keeps its own 240 so it is exactly as it was
  const SHAPES = COAST_LISTS.map(P => shape(curve(P, ISLETS.includes(P) ? 6 : 12), P === ISLE_C, RM));
  let lastD = 0; // the distance of the last land() query, so the ground does not look it up twice
  function land(x, z) { let best = -1e9, r = 0, q = 0, ie = false; for (let i = 0; i < SHAPES.length; i++) { const d = SHAPES[i](x, z); if (d > best) { best = d; r = K.rock; q = K.quay; ie = K.isle; } } K.rock = r; K.quay = q; K.isle = ie; lastD = best; return best; }
  const OLD_SHAPES = EXPANDED ? [shape(curve(OLD_MAIN_C, 12), false, 120), shape(curve(ISLE_C, 12), true, 120)] : null;
  function landOld(x, z) { if (!OLD_SHAPES) return land(x, z); let best = -1e9, r = 0, q = 0, ie = false; for (const S of OLD_SHAPES) { const d = S(x, z); if (d > best) { best = d; r = K.rock; q = K.quay; ie = K.isle; } } K.rock = r; K.quay = q; K.isle = ie; lastD = best; return best; }
  const FAR_SHAPES = EXPANDED ? COAST_LISTS.map(P => shape(curve(P, ISLETS.includes(P) ? 6 : 12), P === ISLE_C, 240)) : null;
  function landFar(x, z) { if (!FAR_SHAPES) return land(x, z); let best = -1e9; for (let i = 0; i < FAR_SHAPES.length; i++) { const d = FAR_SHAPES[i](x, z); if (d > best) best = d; } return best; } // the sea's distance from the shore out to 240 m, for its colour

  // ---------- natural ground: beaches, cliffs, hills, and the flat terraces the towns, farms and stadium stand on ----------
  const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const fbm = (x, z) => vnoise(x / 90, z / 90) * 0.6 + vnoise(x / 40, z / 40) * 0.3 + vnoise(x / 15, z / 15) * 0.1;
  const g2 = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));
  const FLATS = [[-212, 214, -122, 150], [-215, 250, -412, -110], [-420, -20, -432, -188]]; // south town, business centre and stadium, Greenfields farms
  const townMask = (x, z) => { let m = 0; for (const [x0, x1, z0, z1] of FLATS) { const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); m = Math.max(m, 1 - smooth(0, 28, Math.hypot(dx, dz))); } return m; };
  function naturalOld(x, z) {
    const d = land(x, z), rock = K.rock, quay = K.quay, isle = K.isle;
    if (d < 0) return quay > 0.5 ? -7 : Math.max(-14, d * 0.13) - 0.6; // the sea floor; deep water straight off a quay
    const beach = -0.45 + smooth(0, quay > 0.5 ? 1.5 : 34, d) * (TOWN_Y + 0.45);
    const plat = isle ? 6 : 6 * rock * (1 - smooth(50, 100, d)), raise = plat * smooth(0, 8, d); // cliffs: rock shores rise steeply to a plateau
    const hill = 46 * g2(x, z, -520, -95, 82) + 30 * g2(x, z, -470, -320, 60) + 14 * g2(x, z, -560, 70, 55) + 9 * g2(x, z, -300, 150, 60) + 6 * fbm(x, z);
    return beach + (raise + (isle ? 0 : hill * smooth(4, 45, d))) * (1 - townMask(x, z));
  }
  // the first island's ground worked out with the first island's own coast (its north-west shore is gone in the bigger island), so it stays exactly as it was
  function naturalAsBefore(x, z) {
    const d = landOld(x, z), rock = K.rock, quay = K.quay, isle = K.isle;
    if (d < 0) return quay > 0.5 ? -7 : Math.max(-14, d * 0.13) - 0.6; // the sea floor; deep water straight off a quay
    const beach = -0.45 + smooth(0, quay > 0.5 ? 1.5 : 34, d) * (TOWN_Y + 0.45);
    const plat = isle ? 6 : 6 * rock * (1 - smooth(50, 100, d)), raise = plat * smooth(0, 8, d); // cliffs: rock shores rise steeply to a plateau
    const hill = 46 * g2(x, z, -520, -95, 82) + 30 * g2(x, z, -470, -320, 60) + 14 * g2(x, z, -560, 70, 55) + 9 * g2(x, z, -300, 150, 60) + 6 * fbm(x, z);
    return beach + (raise + (isle ? 0 : hill * smooth(4, 45, d))) * (1 - townMask(x, z));
  }


  // ---------- the bigger island's ground: mountains, plains and river valleys (the old island's own ground is left exactly alone) ----------
  const rectMask = (x, z, R, f) => { const dx = Math.max(R[0] - x, 0, x - R[1]), dz = Math.max(R[2] - z, 0, z - R[3]); return 1 - smooth(0, f, Math.hypot(dx, dz)); };
  // the old built-up ground is never touched by the new relief
  const KEEP = [[-262, 336, -434, 276], [-626, -196, -102, 276], [-422, -18, -434, -186], [438, 626, -276, -88]];
  const protect = (x, z) => { let m = 0; for (const R of KEEP) m = Math.max(m, rectMask(x, z, R, 150)); return m; };
  // flat country: the relief is mostly switched off here, the ground stays at the plain's height
  const PLAINS = [[-300, 280, -930, -740, 110], [-900, -740, -740, -450, 60], [-205, 165, -1010, -885, 80], [715, 1015, -440, 125, 120], [840, 1450, -70, 252, 120], [612, 770, -705, -445, 100]];
  const plainMask = (x, z) => { let m = 0; for (const R of PLAINS) m = Math.max(m, rectMask(x, z, R, R[4])); return m; };
  // mountains and hills: [x, z, height, radius, sharpness]
  const PEAKS = [[-560, -830, 150, 150, 2.2], [-655, -800, 95, 190, 1.7], [-465, -790, 85, 170, 1.7], [-560, -810, 45, 330, 1.3], [-800, -930, 60, 230, 1.4], [-900, -880, 45, 140, 1.4], [-340, -960, 55, 200, 1.4],
    [-400, -660, 28, 170, 1.4], [-490, -560, 34, 150, 1.4], [-730, -640, 55, 190, 1.5], [-690, -300, 30, 140, 1.5], [-640, -150, 26, 120, 1.5],
    [1020, -800, 42, 320, 1.5], [1190, -860, 40, 230, 1.6], [880, -900, 28, 210, 1.5], [1150, -570, 36, 200, 1.6], [1360, -300, 22, 180, 1.3], [680, -860, 26, 200, 1.5], [1330, -520, 24, 160, 1.4]];
  // quick gradient noise (a table of directions on an integer lattice): about -1 to 1
  const NT = new Float32Array(512); for (let i = 0; i < 256; i++) { const a = i * 2.399963; NT[2 * i] = Math.cos(a); NT[2 * i + 1] = Math.sin(a); }
  const lat = (i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) & 255) * 2; };
  const pnoise = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
    let k = lat(xi, zi); const a = NT[k] * xf + NT[k + 1] * zf; k = lat(xi + 1, zi); const b = NT[k] * (xf - 1) + NT[k + 1] * zf; k = lat(xi, zi + 1); const c = NT[k] * xf + NT[k + 1] * (zf - 1); k = lat(xi + 1, zi + 1); const d = NT[k] * (xf - 1) + NT[k + 1] * (zf - 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.4;
  };
  const pfbm = (x, z) => pnoise(x / 60, z / 60) * 0.55 + pnoise(x / 27 + 5, z / 27 - 9) * 0.3 + pnoise(x / 12 - 3, z / 12 + 4) * 0.15;
  function relief(x, z) {
    let h = 0; for (const p of PEAKS) { const dx = x - p[0], R = p[3]; if (dx > R || dx < -R) continue; const dz = z - p[1]; if (dz > R || dz < -R) continue; const r2 = dx * dx + dz * dz; if (r2 < R * R) h += p[2] * Math.pow(1 - Math.sqrt(r2) / R, p[4]); }
    if (h > 0.5) { const crag = 1 - Math.abs(pnoise(x / 58, z / 58)), west = x < 400 ? 1 : 0.12; h += (crag * crag * 20 * smooth(30, 120, h) + pfbm(x + 130, z - 70) * 9 * smooth(4, 45, h)) * west; } // crags on the high ground: the Highlands are rugged, the east is rolling // ridged noise: crags and spurs on the high ground
    return h + pfbm(x * 1.3 + 40, z * 1.3 + 90) * 2.6; // a gentle swell on the lowland
  }
  // rivers: the water level follows the ground down to the sea; the banks are cut into the land
  const RIVERS = !EXPANDED ? [] : [
    { id: 'silver', name: 'Silver River', pts: [[-430, -905, 7], [-350, -885, 9], [-270, -860, 11], [-200, -838, 13], [-130, -858, 15], [-95, -895, 17], [-72, -932, 20]] },
    { id: 'millbrook', name: 'Millbrook', pts: [[-250, -780, 5], [-180, -770, 6], [-100, -748, 7], [-30, -735, 8], [40, -718, 9], [92, -700, 11]] },
    { id: 'headwater', name: 'Head Water', pts: [[-560, -690, 5], [-520, -640, 6], [-482, -592, 7], [-440, -555, 8], [-412, -532, 10], [-394, -512, 13]] },
    { id: 'coral', name: 'Coral Creek', pts: [[-700, -600, 5], [-745, -598, 6], [-790, -600, 8], [-818, -598, 10], [-850, -596, 11], [-880, -594, 13]] },
    { id: 'quarrybrook', name: 'Quarry Brook', pts: [[1000, -760, 5], [930, -700, 6], [860, -650, 7], [780, -620, 8], [700, -615, 10], [588, -605, 12]] },
    { id: 'eastmill', name: 'East Mill', pts: [[1180, -450, 5], [1100, -400, 6], [1010, -350, 7], [930, -322, 8], [850, -308, 9], [780, -300, 10], [708, -292, 12]] }];
  const catmullRaw = (ctrl, step) => { const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = []; for (let i = 1; i < P.length - 2; i++) { const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]], L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / step)); for (let k = 0; k < n; k++) { const u = k / n, u2 = u * u, u3 = u2 * u, f = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3); out.push([f(0), f(1), mix(p1[2], p2[2], u)]); } } out.push(ctrl[ctrl.length - 1].slice()); return out; };
  const RGRID_ = new Map(); let riversReady = false;
  // Silverfall: the land drops 14 m across the river's path, with steep walls either side (a gorge)
  const FALL = { x: -500, z: -618, dx: 0.62, dz: 0.78, drop: 22 };
  const fallStep = (x, z) => { if (!EXPANDED) return 0; const a = x - FALL.x, b = z - FALL.z; if (a * a + b * b > 130 * 130) return 0; const u = a * FALL.dx + b * FALL.dz, v = Math.abs(-a * FALL.dz + b * FALL.dx); return FALL.drop * smooth(-1.5, 4.5, u) * (1 - smooth(22, 62, v)); };
  function ground0(x, z) { // the land before any river is cut
    if (!EXPANDED) return naturalOld(x, z);
    const pr = protect(x, z); let ho = 0, dOld = 0; if (pr > 0) { ho = naturalAsBefore(x, z); dOld = lastD; }
    const d = land(x, z), rock = K.rock, quay = K.quay, w = pr > 0 ? pr * (1 - smooth(2, 12, d - dOld)) : 0; // the old built ground comes out exactly as it was, except where the old coast has gone and the land carries on
    if (w >= 1) { lastD = dOld; return ho; }
    if (d < 0) return quay > 0.5 ? -7 : Math.max(-14, d * 0.13) - 0.6; // the sea floor
    const beach = -0.45 + smooth(0, quay > 0.5 ? 1.5 : 34, d) * (TOWN_Y + 0.45), raise = 6 * rock * (1 - smooth(50, 100, d)) * smooth(0, 8, d), sm = smooth(4, 45, d); // the shore: beaches, and cliffs up to a plateau on rock
    const hills = sm > 0 ? sm * (46 * g2(x, z, -520, -95, 82) + 30 * g2(x, z, -470, -320, 60) + 14 * g2(x, z, -560, 70, 55) + 9 * g2(x, z, -300, 150, 60)) : 0; // the first island's hills carry on into the new ground
    let h = beach + (raise + hills) * (1 - townMask(x, z)); const k = (1 - pr) * (1 - 0.92 * plainMask(x, z)) * smooth(0, 30, d); if (k > 0) h += relief(x, z) * k; // no new relief on the old built ground
    if (w > 0) h = mix(h, ho, w);
    return h - fallStep(x, z) * (1 - w);
  }
  function buildRivers() {
    riversReady = true;
    for (const r of RIVERS) {
      const s = catmullRaw(r.pts, 4); let L = 1e9, cum = 0;
      r.s = s.map((p, i) => { if (i) cum += Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]); const g = ground0(p[0], p[1]); L = Math.min(L - 0.004 * (i ? 4 : 0), g - 1.5); return { x: p[0], z: p[1], hw: p[2] / 2, L: Math.max(0.02, L), g, cum }; });
      r.len = cum; for (const q of r.s) for (const a of [-14, 14]) for (const b of [-14, 14]) RIVER_KEYS.add(Math.floor((q.x + a) / 128) + ',' + Math.floor((q.z + b) / 128));
      r.s.forEach((p, i) => { for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const kk = (Math.floor(p.x / 24) + a) + ',' + (Math.floor(p.z / 24) + b); if (!RGRID_.has(kk)) RGRID_.set(kk, []); RGRID_.get(kk).push([r, i]); } });
    }
  }
  function riverSamples() { if (!riversReady) buildRivers(); return RIVERS; }
  function nearRiver(x, z) { // the closest river sample: { d: distance to its centre, hw, L: water level, r, i }
    if (!RIVERS.length) return null; if (!riversReady) buildRivers();
    const cell = RGRID_.get(Math.floor(x / 24) + ',' + Math.floor(z / 24)); if (!cell) return null;
    let best = null, bd = 1e9; for (const [r, i] of cell) { const p = r.s[i], d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = { d, hw: p.hw, L: p.L, r, i }; } }
    return best;
  }
  function carve(x, z, h) {
    const n = nearRiver(x, z); if (!n || n.d > 52) return h; const hw = Math.max(n.hw, 3.2), dr = n.d - hw, bed = n.L - 0.9, bank = n.L + 1.2; // the channel is cut at least 6.4 m wide so the ground mesh can show it
    const g = dr <= 0 ? bed + (n.d / hw) ** 2 * 0.5 : bank + Math.max(0, dr - 2.5) * 0.3;
    return mix(h, Math.min(h, g), 1 - smooth(18, 46, dr));
  }
  // the quarry: a pit with a flat floor and benches (steps) cut into the hillside
  const QC = Math.cos(0.25), QS = Math.sin(0.25);
  function quarryPit(x, z, h) {
    const dx = x - 1045, dz = z + 735; if (Math.abs(dx) > 150 || Math.abs(dz) > 130) return h; const u = (dx * QC + dz * QS) / 78, v = (-dx * QS + dz * QC) / 56, r = Math.hypot(u, v); if (r > 2.1) return h;
    const FL = 26; if (r < 0.55) return Math.min(h, FL); const k = Math.floor((r - 0.55) / 0.2), t = ((r - 0.55) % 0.2) / 0.2; return Math.min(h, FL + 4.6 * k + 4.6 * smooth(0.82, 1, t));
  }
  function natural(x, z) { const g = ground0(x, z); return EXPANDED && lastD > 0 ? quarryPit(x, z, carve(x, z, g)) : g; }
  // where the ground keeps 4 m detail (the first island and the places that get built), and the zones of land use that colour the ground
  const DETAIL = !EXPANDED ? [[-1e5, 1e5, -1e5, 1e5]] : [[-262, 336, -434, 276], [-626, -196, -102, 276], [-422, -18, -434, -186], [438, 626, -276, -88], [-420, -200, -760, -560], [-900, -740, -780, -400], [-810, -620, -450, -80], [320, 490, -900, -770], [-210, 80, -980, -840], [-130, 210, -870, -690], [600, 770, -710, -440], [720, 1030, -450, 130], [740, 960, 100, 260], [1080, 1340, 20, 150], [930, 1130, -860, -700], [1090, 1230, -660, -540]];
  const RIVER_KEYS = new Set(); // the 128 m squares a river runs through keep 4 m detail, so its banks and water are cut cleanly
  const detailAt = (x0, z0, s) => { for (const R of DETAIL) if (x0 < R[1] && x0 + s > R[0] && z0 < R[3] && z0 + s > R[2]) return true; if (RIVERS.length) { if (!riversReady) buildRivers(); if (RIVER_KEYS.has(Math.round(x0 / 128) + ',' + Math.round(z0 / 128))) return true; } return false; };
  const ZONES = !EXPANDED ? {} : { farm: [[-430, -20, -440, -188, 40], [-300, 280, -930, -740, 60], [770, 1090, -480, -340, 50]], industry: [[730, 1010, -430, 120, 50]], quarry: [[930, 1130, -860, -700, 50], [1090, 1230, -660, -540, 40]], airport: [[880, 1450, -50, 230, 40]] };
  const zoneMask = (name, x, z) => { let m = 0; for (const R of ZONES[name] || []) m = Math.max(m, rectMask(x, z, R, R[4])); return m; };
  // how thick the wild forest grows at a point: hilly, inland ground is wooded, the plains hold only groves; beaches, fields, works, rock and the places people have built hold none
  const NOTREE = []; // [x0, x1, z0, z1] squares kept clear of wild trees (towns and parks plant their own)
  const noTreeMask = (x, z) => { for (const R of NOTREE) if (x > R[0] && x < R[1] && z > R[2] && z < R[3]) return 1; return 0; };
  function forestDensity(x, z, h, d) {
    if (d < 12) return 0; const inland = smooth(12, 45, d), low = smooth(4, 16, h), hi = 1 - smooth(95, 135, h);
    let f = mix(0.1, 1, low) * (1 - 0.6 * plainMask(x, z)) * hi * inland; if (f <= 0) return 0;
    f *= smooth(-0.55, 0.15, pnoise(x / 80 + 3, z / 80 - 5) + (h > 10 ? 0.45 : 0)); // clearings and groves
    return f * (1 - zoneMask('farm', x, z)) * (1 - zoneMask('industry', x, z)) * (1 - zoneMask('quarry', x, z)) * (1 - zoneMask('airport', x, z)) * (1 - noTreeMask(x, z));
  }


  // ---------- the new roads of the bigger island (shown only with ?expand): planned over the ground so that grades stay gentle and rivers are crossed by short bridges ----------
  // nodes: id: [x, z, height or 'auto']; edges: [from, to, width, kind, via points, options]
  const NEW_NODES = {N0:[214,-344,'auto'],N1:[226,-772,'auto'],FL:[-540,-580,'auto'],SL:[-540,-636,'auto'],FP:[404,-852,'auto'],C2:[-628,-236,'auto'],C3:[-660,-356,'auto'],C4:[-708,-436,'auto'],C5:[-788,-468,'auto'],C6:[-780,-532,'auto'],C7:[-796,-660,'auto'],C8:[-836,-700,'auto'],MC:[-724,-420,'auto'],E1:[756,-188,'auto'],AP:[1188,68,'auto'],QU:[1020,-700,'auto'],MN:[1132,-668,'auto'],FM1:[140,-868,'auto'],FM2:[212,-860,'auto'],FM3:[-204,-804,'auto'],FM4:[-148,-900,'auto'],GR:[148,-828,'auto'],FM5:[884,-404,'auto'],QP:[1044,-724,'auto'],ML_0_0:[-62,-840,'auto'],ML_1_0:[-26,-840,'auto'],ML_2_0:[10,-840,'auto'],ML_3_0:[46,-840,'auto'],ML_4_0:[82,-840,'auto'],ML_0_1:[-62,-802,'auto'],ML_1_1:[-26,-802,'auto'],ML_2_1:[10,-802,'auto'],ML_3_1:[46,-802,'auto'],ML_4_1:[82,-802,'auto'],ML_0_2:[-62,-764,'auto'],ML_1_2:[-26,-764,'auto'],ML_2_2:[10,-764,'auto'],ML_3_2:[46,-764,'auto'],ML_4_2:[82,-764,'auto'],NH_0:[-135,-935,'auto'],NH_1:[-112,-905,'auto'],NH_2:[-85,-888,'auto'],NH_1x0:[-107.4,-902.1,'auto'],NH_3:[-55,-885,'auto'],NH_4:[-25,-893,'auto'],NH_5:[0,-908,'auto'],NH_6:[22,-930,'auto'],NH_7:[-118,-870,'auto'],NH_1x2:[-114.9,-888,'auto'],NH_8:[-50,-862,'auto'],NH_9:[12,-882,'auto'],NH_10:[-84,-866,'auto'],NH_7x4:[-98.5,-867.7,'auto'],NH_11:[-17,-866,'auto'],HC_0_0:[-361.7,-758,'auto'],HC_0_1:[-361.2,-744,'auto'],HC_0_2:[-361.2,-730,'auto'],HC_0_3:[-360.3,-716,'auto'],HC_0_4:[-358.7,-702,'auto'],HC_0_5:[-354.3,-688,'auto'],HC_0_6:[-347.4,-674,'auto'],HC_0_7:[-343,-660,'auto'],HC_0_8:[-343.4,-646,'auto'],HC_0_9:[-355.6,-632,'auto'],"HC_L0_-700_1":[-350.9,-701.6,'auto'],"HC_L0_-700_2":[-343.1,-701.1,'auto'],"HC_L0_-700_3":[-335.3,-700.7,'auto'],EG_0_0:[650,-627.1,'auto'],EG_1_0:[719.7,-634.1,'auto'],EG_2_0:[789.3,-641.1,'auto'],EG_0_1:[653.6,-591.3,'auto'],EG_1_1:[723.3,-598.3,'auto'],EG_2_1:[792.9,-605.3,'auto'],EG_3_1:[862.6,-612.3,'auto'],EG_0_2:[657.2,-555.5,'auto'],EG_1_2:[726.9,-562.5,'auto'],EG_2_2:[796.5,-569.5,'auto'],EG_3_2:[866.2,-576.5,'auto'],EG_0_3:[660.8,-519.7,'auto'],EG_1_3:[730.5,-526.7,'auto'],EG_2_3:[800.1,-533.7,'auto'],EG_3_3:[869.8,-540.7,'auto'],EG_0_4:[664.4,-483.9,'auto'],EG_1_4:[734.1,-490.9,'auto'],EG_2_4:[803.7,-497.8,'auto'],EG_3_4:[873.4,-504.8,'auto'],EG_0_0x5:[650.5,-621.6,'auto'],EG_0_0x6:[652.9,-598.8,'auto'],EG_1_0x7:[720.4,-626.6,'auto'],EG_1_0x8:[722.8,-603.8,'auto'],EG_2_0x9:[790.2,-631.7,'auto'],EG_2_0x10:[792.2,-612.8,'auto'],ES_0_0:[760,-240,'auto'],ES_1_0:[830,-240,'auto'],ES_2_0:[900,-240,'auto'],ES_3_0:[970,-240,'auto'],ES_4_0:[1040,-240,'auto'],ES_0_1:[760,-170,'auto'],ES_1_1:[830,-170,'auto'],ES_2_1:[900,-170,'auto'],ES_3_1:[970,-170,'auto'],ES_4_1:[1040,-170,'auto'],ES_0_2:[760,-100,'auto'],ES_1_2:[830,-100,'auto'],ES_2_2:[900,-100,'auto'],ES_3_2:[970,-100,'auto'],ES_4_2:[1040,-100,'auto'],ES_0_3:[760,-30,'auto'],ES_1_3:[830,-30,'auto'],ES_2_3:[900,-30,'auto'],ES_3_3:[970,-30,'auto'],ES_4_3:[1040,-30,'auto'],TM_0_0:[780,120,'auto'],TM_1_0:[850,120,'auto'],TM_2_0:[920,120,'auto'],TM_0_1:[780,170,'auto'],TM_1_1:[850,170,'auto'],TM_2_1:[920,170,'auto'],N1ML_4_11:[202.7,-772.1,'auto'],N1ML_4_12:[179.3,-772.1,'auto'],N1ML_4_13:[156,-772.2,'auto'],N1ML_4_14:[132,-774.6,'auto'],N1ML_4_15:[107.5,-784.4,'auto'],N1ML_4_16:[94.7,-793.2,'auto'],N1FP1:[240.6,-786.7,'auto'],N1FP2:[255.1,-801.3,'auto'],N1FP3:[276.7,-815.1,'auto'],N1FP4:[296.4,-819.9,'auto'],N1FP5:[316,-824.7,'auto'],N1FP6:[340,-836,'auto'],N1FP7:[364,-847.2,'auto'],N1FP8:[380,-850.7,'auto'],ML_2_0NH_81:[-4.9,-839.2,'auto'],ML_2_0NH_82:[-20,-841.8,'auto'],ML_2_0NH_83:[-35.1,-849.8,'auto'],ML_0_1HC_0_01:[-81.1,-802.9,'auto'],ML_0_1HC_0_02:[-100.1,-803.9,'auto'],ML_0_1HC_0_03:[-128.1,-803.7,'auto'],ML_0_1HC_0_04:[-156,-803.4,'auto'],ML_0_1HC_0_05:[-172,-801.3,'auto'],ML_0_1HC_0_06:[-188,-795.6,'auto'],ML_0_1HC_0_07:[-212,-778.7,'auto'],ML_0_1HC_0_08:[-228,-763.3,'auto'],ML_0_1HC_0_09:[-244,-747.9,'auto'],ML_0_1HC_0_010:[-260,-732.5,'auto'],ML_0_1HC_0_011:[-271.9,-722.3,'auto'],ML_0_1HC_0_012:[-283.8,-712.1,'auto'],ML_0_1HC_0_013:[-301.9,-701.5,'auto'],ML_0_1HC_0_014:[-319.9,-690.8,'auto'],ML_0_1HC_0_015:[-338,-680.2,'auto'],ML_0_1HC_0_016:[-343.5,-674.5,'auto'],ML_0_1HC_0_017:[-352.4,-658.4,'auto'],ML_0_1HC_0_018:[-357.1,-655,'auto'],ML_0_1HC_0_019:[-361,-659.2,'auto'],ML_0_1HC_0_020:[-363.6,-676.8,'auto'],ML_0_1HC_0_021:[-363,-703.9,'auto'],ML_0_1HC_0_022:[-362.3,-730.9,'auto'],ML_0_1HC_0_06x11:[-206.8,-782.4,'auto'],ML_0_1HC_0_07x13:[-223.1,-768,'auto'],HC_0_8FC1:[-339.1,-629.4,'auto'],HC_0_8FC2:[-342,-617.4,'auto'],HC_0_8FC3:[-357.5,-597,'auto'],HC_0_8FC4:[-380.1,-580.4,'auto'],HC_0_8FC5:[-396,-574.7,'auto'],HC_0_8FC6:[-419.3,-572.6,'auto'],HC_0_8FC7:[-438.7,-574.6,'auto'],HC_0_8FC8:[-464,-585,'auto'],HC_0_8FC9:[-472.6,-583.4,'auto'],HC_0_8FC10:[-476.4,-580.4,'auto'],HC_0_8FC11:[-482.7,-563.1,'auto'],HC_0_8FC12:[-483.3,-543.5,'auto'],HC_0_8FC13:[-483.9,-524,'auto'],HC_0_8FC14:[-482.6,-508.1,'auto'],HC_0_8FC15:[-481.3,-492.2,'auto'],HC_0_8FC16:[-475.6,-477.3,'auto'],HC_0_8FC17:[-471,-470.7,'auto'],HC_0_8FC18:[-458.7,-460.4,'auto'],HC_0_8FC19:[-435.9,-453.3,'auto'],HC_0_8FC20:[-405.9,-452.9,'auto'],HC_0_8FC21:[-376,-452.5,'auto'],HC_0_8FC22:[-346,-452.2,'auto'],HC_0_8FC23:[-316,-451.8,'auto'],HC_0_8FC24:[-300,-450.7,'auto'],HC_0_8FC25:[-284,-447,'auto'],HC_0_8FC26:[-268,-439,'auto'],HC_0_8FC27:[-252,-426.6,'auto'],HC_0_8FC28:[-232,-406.3,'auto'],HC_0_8FC10x16:[-478.5,-574.6,'auto'],HC_0_1FL1:[-363.7,-714.5,'auto'],HC_0_1FL2:[-366.2,-685,'auto'],HC_0_1FL3:[-370.2,-672.2,'auto'],HC_0_1FL4:[-377,-663.5,'auto'],HC_0_1FL5:[-397.5,-650.8,'auto'],HC_0_1FL6:[-415.6,-642.9,'auto'],HC_0_1FL7:[-445.5,-643.2,'auto'],HC_0_1FL8:[-475.3,-643.6,'auto'],HC_0_1FL9:[-489.2,-642.1,'auto'],HC_0_1FL10:[-501.1,-637.9,'auto'],HC_0_1FL11:[-512,-629.9,'auto'],HC_0_1FL12:[-527.7,-611,'auto'],HC_0_1FL13:[-535.3,-595.8,'auto'],HC_0_1FL10x17:[-505.3,-634.8,'auto'],HC_0_1FL11x19:[-518.4,-622.2,'auto'],FLSL1:[-540,-608,'auto'],IC21:[-221.1,-115.8,'auto'],IC22:[-236.2,-127.3,'auto'],IC23:[-260,-137.3,'auto'],IC24:[-280,-138.7,'auto'],IC25:[-300,-140,'auto'],IC26:[-323.2,-139.6,'auto'],IC27:[-346.3,-139.2,'auto'],IC28:[-369.5,-138.8,'auto'],IC29:[-393.7,-135.7,'auto'],IC210:[-403.1,-138.2,'auto'],IC211:[-421.6,-151.2,'auto'],IC212:[-439.2,-167.7,'auto'],IC213:[-456.8,-184.2,'auto'],IC214:[-474.4,-200.8,'auto'],IC215:[-492,-217.3,'auto'],IC216:[-516,-231,'auto'],IC217:[-540,-235.4,'auto'],IC218:[-569.3,-235.6,'auto'],IC219:[-598.7,-235.8,'auto'],C2C31:[-622.1,-256,'auto'],C2C32:[-616.2,-276,'auto'],C2C33:[-615.8,-292,'auto'],C2C34:[-617.5,-300,'auto'],C2C35:[-630.7,-324,'auto'],C2C36:[-645.3,-340,'auto'],C3C41:[-649,-360.6,'auto'],C3C42:[-642.1,-368.2,'auto'],C3C43:[-641.1,-379,'auto'],C3C44:[-645.7,-391.5,'auto'],C3C45:[-661.7,-411.4,'auto'],C3C46:[-676.3,-423.2,'auto'],C3C47:[-692,-431.3,'auto'],C4C51:[-728,-448.1,'auto'],C4C52:[-748,-460.1,'auto'],C4C53:[-764,-465.4,'auto'],C5C61:[-787.5,-484,'auto'],C5C62:[-786.9,-500,'auto'],C5C63:[-783.5,-516,'auto'],C6C71:[-783.6,-556,'auto'],C6C72:[-789.3,-580,'auto'],C6C73:[-794.9,-604,'auto'],C6C74:[-795.5,-632,'auto'],C6C72x20:[-791.7,-590.5,'auto'],C6C73x22:[-795,-610.2,'auto'],C7C81:[-816,-680,'auto'],C3MC1:[-672.4,-371.8,'auto'],C3MC2:[-684.8,-387.7,'auto'],C3MC3:[-697.3,-403.5,'auto'],C3MC4:[-709.5,-412.7,'auto'],E1ES_0_21:[756.3,-160,'auto'],E1ES_0_22:[756.5,-132,'auto'],E1ES_0_23:[758.3,-116,'auto'],ES_2_3TM_1_01:[899.8,-5.3,'auto'],ES_2_3TM_1_02:[899.6,19.3,'auto'],ES_2_3TM_1_03:[899.4,44,'auto'],ES_2_3TM_1_04:[895,68,'auto'],ES_2_3TM_1_05:[881,91.5,'auto'],ES_2_3TM_1_06:[865.5,105.7,'auto'],ES_4_2AP1:[1061.9,-80,'auto'],ES_4_2AP2:[1083.8,-60,'auto'],ES_4_2AP3:[1103.5,-40,'auto'],ES_4_2AP4:[1123.2,-20,'auto'],ES_4_2AP5:[1143,0,'auto'],ES_4_2AP6:[1162.7,20,'auto'],ES_4_2AP7:[1179.7,44,'auto'],ES_2_0EG_0_41:[884.4,-254.7,'auto'],ES_2_0EG_0_42:[868.7,-269.4,'auto'],ES_2_0EG_0_43:[853.1,-284.1,'auto'],ES_2_0EG_0_44:[838.7,-302.7,'auto'],ES_2_0EG_0_45:[824.3,-321.4,'auto'],ES_2_0EG_0_46:[809.9,-340,'auto'],ES_2_0EG_0_47:[798.8,-352,'auto'],ES_2_0EG_0_48:[787.8,-364,'auto'],ES_2_0EG_0_49:[767.8,-384,'auto'],ES_2_0EG_0_410:[747.8,-404,'auto'],ES_2_0EG_0_411:[727.8,-424,'auto'],ES_2_0EG_0_412:[707.8,-444,'auto'],ES_2_0EG_0_413:[686.1,-463.9,'auto'],ES_2_0EG_0_43x23:[842.6,-297.6,'auto'],ES_2_0EG_0_44x25:[828.8,-315.6,'auto'],EG_3_3QU1:[873.6,-556.3,'auto'],EG_3_3QU2:[881,-572.1,'auto'],EG_3_3QU3:[895.3,-593.3,'auto'],EG_3_3QU4:[909.5,-614.5,'auto'],EG_3_3QU5:[923.8,-635.6,'auto'],EG_3_3QU6:[934.6,-641.3,'auto'],EG_3_3QU7:[952.2,-643.2,'auto'],EG_3_3QU8:[969.8,-645.1,'auto'],EG_3_3QU9:[984.6,-650.2,'auto'],EG_3_3QU10:[996.4,-664.2,'auto'],EG_3_3QU11:[1008.2,-678.2,'auto'],QUMN1:[1044,-699.7,'auto'],QUMN2:[1068,-699.4,'auto'],QUMN3:[1092,-695,'auto'],QUMN4:[1108,-687.1,'auto'],QUMN5:[1120,-677.5,'auto'],N1ML_4_14FM11:[132.4,-795.1,'auto'],N1ML_4_14FM12:[132.7,-815.5,'auto'],N1ML_4_14FM13:[133.1,-836,'auto'],N1ML_4_14FM14:[136.5,-852,'auto'],N1ML_4_11FM21:[203.9,-800.1,'auto'],N1ML_4_11FM22:[205.1,-828,'auto'],N1ML_4_11FM23:[208.5,-844,'auto'],ML_0_1HC_0_07x26:[-210.1,-784.7,'auto'],ML_0_1HC_0_04FM41:[-158.7,-831.7,'auto'],ML_0_1HC_0_04FM42:[-161.3,-860,'auto'],ML_0_1HC_0_04FM43:[-158.9,-876,'auto'],ML_0_1HC_0_04FM41x27:[-158.8,-833,'auto'],ML_0_1HC_0_04FM41x28:[-161.2,-858.7,'auto'],N1ML_4_13GR1:[154.9,-788.1,'auto'],N1ML_4_13GR2:[153.9,-804,'auto'],ES_2_0EG_0_49FM51:[786,-382.1,'auto'],ES_2_0EG_0_49FM52:[804.2,-380.3,'auto'],ES_2_0EG_0_49FM53:[824.1,-381.5,'auto'],ES_2_0EG_0_49FM54:[844,-382.7,'auto'],ES_2_0EG_0_49FM55:[860,-388.3,'auto'],QUQP1:[1032,-712,'auto']};
  const NEW_EDGES = [
    ['ML_0_0','ML_1_0',8,'town',[],{'town':'ML'}],
    ['ML_1_0','ML_2_0',8,'town',[],{'town':'ML'}],
    ['ML_2_0','ML_3_0',8,'town',[],{'town':'ML'}],
    ['ML_3_0','ML_4_0',8,'town',[],{'town':'ML'}],
    ['ML_0_1','ML_1_1',9,'town',[],{'town':'ML'}],
    ['ML_1_1','ML_2_1',9,'town',[],{'town':'ML'}],
    ['ML_2_1','ML_3_1',9,'town',[],{'town':'ML'}],
    ['ML_3_1','ML_4_1',9,'town',[],{'town':'ML'}],
    ['ML_0_2','ML_1_2',8,'town',[],{'town':'ML'}],
    ['ML_1_2','ML_2_2',8,'town',[],{'town':'ML'}],
    ['ML_2_2','ML_3_2',8,'town',[],{'town':'ML'}],
    ['ML_3_2','ML_4_2',8,'town',[],{'town':'ML'}],
    ['ML_0_0','ML_0_1',8,'town',[],{'town':'ML'}],
    ['ML_0_1','ML_0_2',8,'town',[],{'town':'ML'}],
    ['ML_1_0','ML_1_1',8,'town',[],{'town':'ML'}],
    ['ML_1_1','ML_1_2',8,'town',[],{'town':'ML'}],
    ['ML_2_0','ML_2_1',8,'town',[],{'town':'ML'}],
    ['ML_2_1','ML_2_2',8,'town',[],{'town':'ML'}],
    ['ML_3_0','ML_3_1',8,'town',[],{'town':'ML'}],
    ['ML_3_1','ML_3_2',8,'town',[],{'town':'ML'}],
    ['ML_4_0','ML_4_1',8,'town',[],{'town':'ML'}],
    ['ML_4_1','ML_4_2',8,'town',[],{'town':'ML'}],
    ['NH_0','NH_1',8,'town',[],{'town':'NH'}],
    ['NH_1','NH_1x0',8,'town',[],{'town':'NH'}],
    ['NH_1x0','NH_2',8,'bridge',[],{'hump':0.5,'style':'river'}],
    ['NH_2','NH_3',8,'town',[],{'town':'NH'}],
    ['NH_3','NH_4',8,'town',[],{'town':'NH'}],
    ['NH_4','NH_5',8,'town',[],{'town':'NH'}],
    ['NH_5','NH_6',8,'town',[],{'town':'NH'}],
    ['NH_1','NH_1x2',6,'villa',[],{'town':'NH'}],
    ['NH_1x2','NH_7',7,'bridge',[],{'hump':0.5,'style':'river'}],
    ['NH_3','NH_8',7,'town',[],{'town':'NH'}],
    ['NH_5','NH_9',6,'villa',[],{'town':'NH'}],
    ['NH_7','NH_7x4',7,'bridge',[],{'hump':0.5,'style':'river'}],
    ['NH_7x4','NH_10',6,'villa',[],{'town':'NH'}],
    ['NH_10','NH_8',6,'villa',[],{'town':'NH'}],
    ['NH_8','NH_11',6,'villa',[],{'town':'NH'}],
    ['NH_11','NH_9',6,'villa',[],{'town':'NH'}],
    ['HC_0_0','HC_0_1',8,'town',[],{'town':'HC'}],
    ['HC_0_1','HC_0_2',8,'town',[],{'town':'HC'}],
    ['HC_0_2','HC_0_3',8,'town',[],{'town':'HC'}],
    ['HC_0_3','HC_0_4',8,'town',[],{'town':'HC'}],
    ['HC_0_4','HC_0_5',8,'town',[],{'town':'HC'}],
    ['HC_0_5','HC_0_6',8,'town',[],{'town':'HC'}],
    ['HC_0_6','HC_0_7',8,'town',[],{'town':'HC'}],
    ['HC_0_7','HC_0_8',8,'town',[],{'town':'HC'}],
    ['HC_0_8','HC_0_9',8,'town',[],{'town':'HC'}],
    ['HC_0_4','HC_L0_-700_1',5,'villa',[],{'town':'HC'}],
    ['HC_L0_-700_1','HC_L0_-700_2',5,'villa',[],{'town':'HC'}],
    ['HC_L0_-700_2','HC_L0_-700_3',5,'villa',[],{'town':'HC'}],
    ['EG_0_0','EG_1_0',7,'town',[],{'town':'EG'}],
    ['EG_1_0','EG_2_0',7,'town',[],{'town':'EG'}],
    ['EG_0_1','EG_1_1',7,'town',[],{'town':'EG'}],
    ['EG_1_1','EG_2_1',7,'town',[],{'town':'EG'}],
    ['EG_2_1','EG_3_1',7,'town',[],{'town':'EG'}],
    ['EG_0_2','EG_1_2',8,'town',[],{'town':'EG'}],
    ['EG_1_2','EG_2_2',8,'town',[],{'town':'EG'}],
    ['EG_2_2','EG_3_2',8,'town',[],{'town':'EG'}],
    ['EG_0_3','EG_1_3',7,'town',[],{'town':'EG'}],
    ['EG_1_3','EG_2_3',7,'town',[],{'town':'EG'}],
    ['EG_2_3','EG_3_3',7,'town',[],{'town':'EG'}],
    ['EG_0_4','EG_1_4',7,'town',[],{'town':'EG'}],
    ['EG_1_4','EG_2_4',7,'town',[],{'town':'EG'}],
    ['EG_2_4','EG_3_4',7,'town',[],{'town':'EG'}],
    ['EG_0_0','EG_0_0x5',7,'town',[],{'town':'EG'}],
    ['EG_0_0x5','EG_0_0x6',7,'bridge',[],{'hump':0.5,'style':'river'}],
    ['EG_0_0x6','EG_0_1',7,'town',[],{'town':'EG'}],
    ['EG_0_1','EG_0_2',7,'town',[],{'town':'EG'}],
    ['EG_0_2','EG_0_3',7,'town',[],{'town':'EG'}],
    ['EG_0_3','EG_0_4',7,'town',[],{'town':'EG'}],
    ['EG_1_0','EG_1_0x7',7,'town',[],{'town':'EG'}],
    ['EG_1_0x7','EG_1_0x8',7,'bridge',[],{'hump':0.5,'style':'river'}],
    ['EG_1_0x8','EG_1_1',7,'town',[],{'town':'EG'}],
    ['EG_1_1','EG_1_2',7,'town',[],{'town':'EG'}],
    ['EG_1_2','EG_1_3',7,'town',[],{'town':'EG'}],
    ['EG_1_3','EG_1_4',7,'town',[],{'town':'EG'}],
    ['EG_2_0','EG_2_0x9',7,'town',[],{'town':'EG'}],
    ['EG_2_0x9','EG_2_0x10',7,'bridge',[],{'hump':0.5,'style':'river'}],
    ['EG_2_0x10','EG_2_1',7,'town',[],{'town':'EG'}],
    ['EG_2_1','EG_2_2',7,'town',[],{'town':'EG'}],
    ['EG_2_2','EG_2_3',7,'town',[],{'town':'EG'}],
    ['EG_2_3','EG_2_4',7,'town',[],{'town':'EG'}],
    ['EG_3_1','EG_3_2',7,'town',[],{'town':'EG'}],
    ['EG_3_2','EG_3_3',7,'town',[],{'town':'EG'}],
    ['EG_3_3','EG_3_4',7,'town',[],{'town':'EG'}],
    ['ES_0_0','ES_1_0',9,'works',[],{'town':'ES'}],
    ['ES_1_0','ES_2_0',9,'works',[],{'town':'ES'}],
    ['ES_2_0','ES_3_0',9,'works',[],{'town':'ES'}],
    ['ES_3_0','ES_4_0',9,'works',[],{'town':'ES'}],
    ['ES_0_1','ES_1_1',9,'works',[],{'town':'ES'}],
    ['ES_1_1','ES_2_1',9,'works',[],{'town':'ES'}],
    ['ES_2_1','ES_3_1',9,'works',[],{'town':'ES'}],
    ['ES_3_1','ES_4_1',9,'works',[],{'town':'ES'}],
    ['ES_0_2','ES_1_2',10,'works',[],{'town':'ES'}],
    ['ES_1_2','ES_2_2',10,'works',[],{'town':'ES'}],
    ['ES_2_2','ES_3_2',10,'works',[],{'town':'ES'}],
    ['ES_3_2','ES_4_2',10,'works',[],{'town':'ES'}],
    ['ES_0_3','ES_1_3',9,'works',[],{'town':'ES'}],
    ['ES_1_3','ES_2_3',9,'works',[],{'town':'ES'}],
    ['ES_2_3','ES_3_3',9,'works',[],{'town':'ES'}],
    ['ES_3_3','ES_4_3',9,'works',[],{'town':'ES'}],
    ['ES_0_0','ES_0_1',9,'works',[],{'town':'ES'}],
    ['ES_0_1','ES_0_2',9,'works',[],{'town':'ES'}],
    ['ES_0_2','ES_0_3',9,'works',[],{'town':'ES'}],
    ['ES_1_0','ES_1_1',9,'works',[],{'town':'ES'}],
    ['ES_1_1','ES_1_2',9,'works',[],{'town':'ES'}],
    ['ES_1_2','ES_1_3',9,'works',[],{'town':'ES'}],
    ['ES_2_0','ES_2_1',9,'works',[],{'town':'ES'}],
    ['ES_2_1','ES_2_2',9,'works',[],{'town':'ES'}],
    ['ES_2_2','ES_2_3',9,'works',[],{'town':'ES'}],
    ['ES_3_0','ES_3_1',9,'works',[],{'town':'ES'}],
    ['ES_3_1','ES_3_2',9,'works',[],{'town':'ES'}],
    ['ES_3_2','ES_3_3',9,'works',[],{'town':'ES'}],
    ['ES_4_0','ES_4_1',9,'works',[],{'town':'ES'}],
    ['ES_4_1','ES_4_2',9,'works',[],{'town':'ES'}],
    ['ES_4_2','ES_4_3',9,'works',[],{'town':'ES'}],
    ['TM_0_0','TM_1_0',10,'works',[],{'town':'TM'}],
    ['TM_1_0','TM_2_0',10,'works',[],{'town':'TM'}],
    ['TM_0_1','TM_1_1',9,'works',[],{'town':'TM'}],
    ['TM_1_1','TM_2_1',9,'works',[],{'town':'TM'}],
    ['TM_0_0','TM_0_1',9,'works',[],{'town':'TM'}],
    ['TM_1_0','TM_1_1',9,'works',[],{'town':'TM'}],
    ['TM_2_0','TM_2_1',9,'works',[],{'town':'TM'}],
    ['SQ','N0',9,'road',[]],
    ['N0','N1',10,'bridge',[],{'hump':9,'style':'suspension'}],
    ['N1','N1ML_4_11',9,'road',[]],
    ['N1ML_4_11','N1ML_4_12',9,'road',[]],
    ['N1ML_4_12','N1ML_4_13',9,'road',[]],
    ['N1ML_4_13','N1ML_4_14',9,'road',[]],
    ['N1ML_4_14','N1ML_4_15',9,'road',[]],
    ['N1ML_4_15','N1ML_4_16',9,'road',[]],
    ['N1ML_4_16','ML_4_1',9,'road',[]],
    ['N1','N1FP1',8,'road',[]],
    ['N1FP1','N1FP2',8,'road',[]],
    ['N1FP2','N1FP3',8,'road',[]],
    ['N1FP3','N1FP4',8,'road',[]],
    ['N1FP4','N1FP5',8,'road',[]],
    ['N1FP5','N1FP6',8,'road',[]],
    ['N1FP6','N1FP7',8,'road',[]],
    ['N1FP7','N1FP8',8,'road',[]],
    ['N1FP8','FP',8,'road',[]],
    ['ML_2_0','ML_2_0NH_81',8,'road',[]],
    ['ML_2_0NH_81','ML_2_0NH_82',8,'road',[]],
    ['ML_2_0NH_82','ML_2_0NH_83',8,'road',[]],
    ['ML_2_0NH_83','NH_8',8,'road',[]],
    ['ML_0_1','ML_0_1HC_0_01',9,'road',[]],
    ['ML_0_1HC_0_01','ML_0_1HC_0_02',9,'road',[]],
    ['ML_0_1HC_0_02','ML_0_1HC_0_03',9,'road',[]],
    ['ML_0_1HC_0_03','ML_0_1HC_0_04',9,'road',[]],
    ['ML_0_1HC_0_04','ML_0_1HC_0_05',9,'road',[]],
    ['ML_0_1HC_0_05','ML_0_1HC_0_06',9,'road',[]],
    ['ML_0_1HC_0_06','ML_0_1HC_0_06x11',9,'road',[]],
    ['ML_0_1HC_0_06x11','ML_0_1HC_0_07',9,'bridge',[],{'hump':0.5,'style':'river'}],
    ['ML_0_1HC_0_07','ML_0_1HC_0_07x13',9,'bridge',[],{'hump':0.5,'style':'river'}],
    ['ML_0_1HC_0_07x13','ML_0_1HC_0_08',9,'road',[]],
    ['ML_0_1HC_0_08','ML_0_1HC_0_09',9,'road',[]],
    ['ML_0_1HC_0_09','ML_0_1HC_0_010',9,'road',[]],
    ['ML_0_1HC_0_010','ML_0_1HC_0_011',9,'road',[]],
    ['ML_0_1HC_0_011','ML_0_1HC_0_012',9,'road',[]],
    ['ML_0_1HC_0_012','ML_0_1HC_0_013',9,'road',[]],
    ['ML_0_1HC_0_013','ML_0_1HC_0_014',9,'road',[]],
    ['ML_0_1HC_0_014','ML_0_1HC_0_015',9,'road',[]],
    ['ML_0_1HC_0_015','ML_0_1HC_0_016',9,'road',[]],
    ['ML_0_1HC_0_016','ML_0_1HC_0_017',9,'road',[]],
    ['ML_0_1HC_0_017','ML_0_1HC_0_018',9,'road',[]],
    ['ML_0_1HC_0_018','ML_0_1HC_0_019',9,'road',[]],
    ['ML_0_1HC_0_019','ML_0_1HC_0_020',9,'road',[]],
    ['ML_0_1HC_0_020','ML_0_1HC_0_021',9,'road',[]],
    ['ML_0_1HC_0_021','ML_0_1HC_0_022',9,'road',[]],
    ['ML_0_1HC_0_022','HC_0_0',9,'road',[]],
    ['HC_0_8','HC_0_8FC1',9,'road',[]],
    ['HC_0_8FC1','HC_0_8FC2',9,'road',[]],
    ['HC_0_8FC2','HC_0_8FC3',9,'road',[]],
    ['HC_0_8FC3','HC_0_8FC4',9,'road',[]],
    ['HC_0_8FC4','HC_0_8FC5',9,'road',[]],
    ['HC_0_8FC5','HC_0_8FC6',9,'road',[]],
    ['HC_0_8FC6','HC_0_8FC7',9,'road',[]],
    ['HC_0_8FC7','HC_0_8FC8',9,'road',[]],
    ['HC_0_8FC8','HC_0_8FC9',9,'bridge',[],{'hump':0.5,'style':'river'}],
    ['HC_0_8FC9','HC_0_8FC10',9,'bridge',[],{'hump':0.5,'style':'river'}],
    ['HC_0_8FC10','HC_0_8FC10x16',9,'bridge',[],{'hump':0.5,'style':'river'}],
    ['HC_0_8FC10x16','HC_0_8FC11',9,'road',[]],
    ['HC_0_8FC11','HC_0_8FC12',9,'road',[]],
    ['HC_0_8FC12','HC_0_8FC13',9,'road',[]],
    ['HC_0_8FC13','HC_0_8FC14',9,'road',[]],
    ['HC_0_8FC14','HC_0_8FC15',9,'road',[]],
    ['HC_0_8FC15','HC_0_8FC16',9,'road',[]],
    ['HC_0_8FC16','HC_0_8FC17',9,'road',[]],
    ['HC_0_8FC17','HC_0_8FC18',9,'road',[]],
    ['HC_0_8FC18','HC_0_8FC19',9,'road',[]],
    ['HC_0_8FC19','HC_0_8FC20',9,'road',[]],
    ['HC_0_8FC20','HC_0_8FC21',9,'road',[]],
    ['HC_0_8FC21','HC_0_8FC22',9,'road',[]],
    ['HC_0_8FC22','HC_0_8FC23',9,'road',[]],
    ['HC_0_8FC23','HC_0_8FC24',9,'road',[]],
    ['HC_0_8FC24','HC_0_8FC25',9,'road',[]],
    ['HC_0_8FC25','HC_0_8FC26',9,'road',[]],
    ['HC_0_8FC26','HC_0_8FC27',9,'road',[]],
    ['HC_0_8FC27','HC_0_8FC28',9,'road',[]],
    ['HC_0_8FC28','FC',9,'road',[]],
    ['HC_0_1','HC_0_1FL1',7,'road',[]],
    ['HC_0_1FL1','HC_0_1FL2',7,'road',[]],
    ['HC_0_1FL2','HC_0_1FL3',7,'road',[]],
    ['HC_0_1FL3','HC_0_1FL4',7,'road',[]],
    ['HC_0_1FL4','HC_0_1FL5',7,'road',[]],
    ['HC_0_1FL5','HC_0_1FL6',7,'road',[]],
    ['HC_0_1FL6','HC_0_1FL7',7,'road',[]],
    ['HC_0_1FL7','HC_0_1FL8',7,'road',[]],
    ['HC_0_1FL8','HC_0_1FL9',7,'road',[]],
    ['HC_0_1FL9','HC_0_1FL10',7,'road',[]],
    ['HC_0_1FL10','HC_0_1FL10x17',7,'road',[]],
    ['HC_0_1FL10x17','HC_0_1FL11',7,'bridge',[],{'hump':0.5,'style':'river'}],
    ['HC_0_1FL11','HC_0_1FL11x19',7,'bridge',[],{'hump':0.5,'style':'river'}],
    ['HC_0_1FL11x19','HC_0_1FL12',7,'road',[]],
    ['HC_0_1FL12','HC_0_1FL13',7,'road',[]],
    ['HC_0_1FL13','FL',7,'road',[]],
    ['FL','FLSL1',6,'road',[]],
    ['FLSL1','SL',6,'road',[]],
    ['I','IC21',9,'road',[]],
    ['IC21','IC22',9,'road',[]],
    ['IC22','IC23',9,'road',[]],
    ['IC23','IC24',9,'road',[]],
    ['IC24','IC25',9,'road',[]],
    ['IC25','IC26',9,'road',[]],
    ['IC26','IC27',9,'road',[]],
    ['IC27','IC28',9,'road',[]],
    ['IC28','IC29',9,'road',[]],
    ['IC29','IC210',9,'road',[]],
    ['IC210','IC211',9,'road',[]],
    ['IC211','IC212',9,'road',[]],
    ['IC212','IC213',9,'road',[]],
    ['IC213','IC214',9,'road',[]],
    ['IC214','IC215',9,'road',[]],
    ['IC215','IC216',9,'road',[]],
    ['IC216','IC217',9,'road',[]],
    ['IC217','IC218',9,'road',[]],
    ['IC218','IC219',9,'road',[]],
    ['IC219','C2',9,'road',[]],
    ['C2','C2C31',8,'road',[]],
    ['C2C31','C2C32',8,'road',[]],
    ['C2C32','C2C33',8,'road',[]],
    ['C2C33','C2C34',8,'road',[]],
    ['C2C34','C2C35',8,'road',[]],
    ['C2C35','C2C36',8,'road',[]],
    ['C2C36','C3',8,'road',[]],
    ['C3','C3C41',8,'road',[]],
    ['C3C41','C3C42',8,'road',[]],
    ['C3C42','C3C43',8,'road',[]],
    ['C3C43','C3C44',8,'road',[]],
    ['C3C44','C3C45',8,'road',[]],
    ['C3C45','C3C46',8,'road',[]],
    ['C3C46','C3C47',8,'road',[]],
    ['C3C47','C4',8,'road',[]],
    ['C4','C4C51',8,'road',[]],
    ['C4C51','C4C52',8,'road',[]],
    ['C4C52','C4C53',8,'road',[]],
    ['C4C53','C5',8,'road',[]],
    ['C5','C5C61',8,'road',[]],
    ['C5C61','C5C62',8,'road',[]],
    ['C5C62','C5C63',8,'road',[]],
    ['C5C63','C6',8,'road',[]],
    ['C6','C6C71',8,'road',[]],
    ['C6C71','C6C72',8,'road',[]],
    ['C6C72','C6C72x20',8,'road',[]],
    ['C6C72x20','C6C73',8,'bridge',[],{'hump':0.5,'style':'river'}],
    ['C6C73','C6C73x22',8,'bridge',[],{'hump':0.5,'style':'river'}],
    ['C6C73x22','C6C74',8,'road',[]],
    ['C6C74','C7',8,'road',[]],
    ['C7','C7C81',8,'road',[]],
    ['C7C81','C8',8,'road',[]],
    ['C3','C3MC1',7,'villa',[]],
    ['C3MC1','C3MC2',7,'villa',[]],
    ['C3MC2','C3MC3',7,'villa',[]],
    ['C3MC3','C3MC4',7,'villa',[]],
    ['C3MC4','MC',7,'villa',[]],
    ['Q','E1',9,'bridge',[],{'hump':1}],
    ['E1','E1ES_0_21',9,'works',[]],
    ['E1ES_0_21','E1ES_0_22',9,'works',[]],
    ['E1ES_0_22','E1ES_0_23',9,'works',[]],
    ['E1ES_0_23','ES_0_2',9,'works',[]],
    ['ES_2_3','ES_2_3TM_1_01',9,'works',[]],
    ['ES_2_3TM_1_01','ES_2_3TM_1_02',9,'works',[]],
    ['ES_2_3TM_1_02','ES_2_3TM_1_03',9,'works',[]],
    ['ES_2_3TM_1_03','ES_2_3TM_1_04',9,'works',[]],
    ['ES_2_3TM_1_04','ES_2_3TM_1_05',9,'works',[]],
    ['ES_2_3TM_1_05','ES_2_3TM_1_06',9,'works',[]],
    ['ES_2_3TM_1_06','TM_1_0',9,'works',[]],
    ['ES_4_2','ES_4_2AP1',9,'road',[]],
    ['ES_4_2AP1','ES_4_2AP2',9,'road',[]],
    ['ES_4_2AP2','ES_4_2AP3',9,'road',[]],
    ['ES_4_2AP3','ES_4_2AP4',9,'road',[]],
    ['ES_4_2AP4','ES_4_2AP5',9,'road',[]],
    ['ES_4_2AP5','ES_4_2AP6',9,'road',[]],
    ['ES_4_2AP6','ES_4_2AP7',9,'road',[]],
    ['ES_4_2AP7','AP',9,'road',[]],
    ['ES_2_0','ES_2_0EG_0_41',8,'road',[]],
    ['ES_2_0EG_0_41','ES_2_0EG_0_42',8,'road',[]],
    ['ES_2_0EG_0_42','ES_2_0EG_0_43',8,'road',[]],
    ['ES_2_0EG_0_43','ES_2_0EG_0_43x23',8,'road',[]],
    ['ES_2_0EG_0_43x23','ES_2_0EG_0_44',8,'bridge',[],{'hump':0.5,'style':'river'}],
    ['ES_2_0EG_0_44','ES_2_0EG_0_44x25',8,'bridge',[],{'hump':0.5,'style':'river'}],
    ['ES_2_0EG_0_44x25','ES_2_0EG_0_45',8,'road',[]],
    ['ES_2_0EG_0_45','ES_2_0EG_0_46',8,'road',[]],
    ['ES_2_0EG_0_46','ES_2_0EG_0_47',8,'road',[]],
    ['ES_2_0EG_0_47','ES_2_0EG_0_48',8,'road',[]],
    ['ES_2_0EG_0_48','ES_2_0EG_0_49',8,'road',[]],
    ['ES_2_0EG_0_49','ES_2_0EG_0_410',8,'road',[]],
    ['ES_2_0EG_0_410','ES_2_0EG_0_411',8,'road',[]],
    ['ES_2_0EG_0_411','ES_2_0EG_0_412',8,'road',[]],
    ['ES_2_0EG_0_412','ES_2_0EG_0_413',8,'road',[]],
    ['ES_2_0EG_0_413','EG_0_4',8,'road',[]],
    ['EG_3_3','EG_3_3QU1',10,'road',[]],
    ['EG_3_3QU1','EG_3_3QU2',10,'road',[]],
    ['EG_3_3QU2','EG_3_3QU3',10,'road',[]],
    ['EG_3_3QU3','EG_3_3QU4',10,'road',[]],
    ['EG_3_3QU4','EG_3_3QU5',10,'road',[]],
    ['EG_3_3QU5','EG_3_3QU6',10,'road',[]],
    ['EG_3_3QU6','EG_3_3QU7',10,'road',[]],
    ['EG_3_3QU7','EG_3_3QU8',10,'road',[]],
    ['EG_3_3QU8','EG_3_3QU9',10,'road',[]],
    ['EG_3_3QU9','EG_3_3QU10',10,'road',[]],
    ['EG_3_3QU10','EG_3_3QU11',10,'road',[]],
    ['EG_3_3QU11','QU',10,'road',[]],
    ['QU','QUMN1',10,'road',[]],
    ['QUMN1','QUMN2',10,'road',[]],
    ['QUMN2','QUMN3',10,'road',[]],
    ['QUMN3','QUMN4',10,'road',[]],
    ['QUMN4','QUMN5',10,'road',[]],
    ['QUMN5','MN',10,'road',[]],
    ['N1ML_4_14','N1ML_4_14FM11',6,'farm',[]],
    ['N1ML_4_14FM11','N1ML_4_14FM12',6,'farm',[]],
    ['N1ML_4_14FM12','N1ML_4_14FM13',6,'farm',[]],
    ['N1ML_4_14FM13','N1ML_4_14FM14',6,'farm',[]],
    ['N1ML_4_14FM14','FM1',6,'farm',[]],
    ['N1ML_4_11','N1ML_4_11FM21',6,'farm',[]],
    ['N1ML_4_11FM21','N1ML_4_11FM22',6,'farm',[]],
    ['N1ML_4_11FM22','N1ML_4_11FM23',6,'farm',[]],
    ['N1ML_4_11FM23','FM2',6,'farm',[]],
    ['ML_0_1HC_0_07','ML_0_1HC_0_07x26',7,'bridge',[],{'hump':0.5,'style':'river'}],
    ['ML_0_1HC_0_07x26','FM3',6,'farm',[]],
    ['ML_0_1HC_0_04','ML_0_1HC_0_04FM41',6,'farm',[]],
    ['ML_0_1HC_0_04FM41','ML_0_1HC_0_04FM41x27',6,'farm',[]],
    ['ML_0_1HC_0_04FM41x27','ML_0_1HC_0_04FM41x28',7,'bridge',[],{'hump':0.5,'style':'river'}],
    ['ML_0_1HC_0_04FM41x28','ML_0_1HC_0_04FM42',6,'farm',[]],
    ['ML_0_1HC_0_04FM42','ML_0_1HC_0_04FM43',6,'farm',[]],
    ['ML_0_1HC_0_04FM43','FM4',6,'farm',[]],
    ['N1ML_4_13','N1ML_4_13GR1',8,'farm',[]],
    ['N1ML_4_13GR1','N1ML_4_13GR2',8,'farm',[]],
    ['N1ML_4_13GR2','GR',8,'farm',[]],
    ['ES_2_0EG_0_49','ES_2_0EG_0_49FM51',6,'farm',[]],
    ['ES_2_0EG_0_49FM51','ES_2_0EG_0_49FM52',6,'farm',[]],
    ['ES_2_0EG_0_49FM52','ES_2_0EG_0_49FM53',6,'farm',[]],
    ['ES_2_0EG_0_49FM53','ES_2_0EG_0_49FM54',6,'farm',[]],
    ['ES_2_0EG_0_49FM54','ES_2_0EG_0_49FM55',6,'farm',[]],
    ['ES_2_0EG_0_49FM55','FM5',6,'farm',[]],
    ['QU','QUQP1',10,'road',[]],
    ['QUQP1','QP',10,'road',[]]];
  const NEW_TRAILS = [{"id":"FLFALL","w":1.8,"pts":[[-540,-580],[-532.1,-583.4],[-524.2,-586.9],[-516.4,-590.3],[-509.6,-597.5],[-502.8,-604.8],[-496,-612]]},{"id":"C8LH2","w":1.8,"pts":[[-836,-700],[-836.2,-708],[-836.3,-716],[-836.5,-724],[-836.6,-732],[-836.8,-740],[-839.9,-748.6],[-843.1,-757.3],[-846.2,-765.9],[-849.4,-774.6],[-842.5,-779.3],[-833,-780.5],[-823.4,-781.7],[-817.2,-786.6],[-817.2,-794.5],[-817.2,-802.4],[-820.3,-806.9],[-823.4,-811.4],[-830.5,-815.4],[-837.5,-819.5],[-844.6,-823.5],[-850,-828.9],[-855.4,-834.3],[-864.6,-835.3],[-873.7,-836.3],[-882.9,-837.3],[-892,-838.3],[-900,-842.3],[-908,-846.3],[-914.4,-852.3],[-920.7,-858.2],[-927.1,-864.1],[-933.5,-870.1],[-939.8,-876],[-945.9,-883],[-952.1,-889.9],[-958.2,-896.9],[-964.3,-903.8],[-970.4,-910.8],[-978.5,-910.8],[-986.6,-910.8],[-995.6,-906.9],[-1004.6,-903.1],[-1012.3,-901.5],[-1020,-900]]}];
  const NEW_TOWNS = [{id:'ML',name:'Millford',cx:10,cz:-802,style:'timber',nodes:['ML_0_0','ML_1_0','ML_2_0','ML_3_0','ML_4_0','ML_0_1','ML_1_1','ML_2_1','ML_3_1','ML_4_1','ML_0_2','ML_1_2','ML_2_2','ML_3_2','ML_4_2']},{id:'NH',name:'Northhaven',cx:-60,cz:-880,style:'harbour',nodes:['NH_0','NH_1','NH_2','NH_3','NH_4','NH_5','NH_6','NH_7','NH_8','NH_9','NH_10','NH_11']},{id:'HC',name:'Hillcrest',cx:-370,cz:-690,style:'terrace',nodes:['HC_0_0','HC_0_1','HC_0_2','HC_0_3','HC_0_4','HC_0_5','HC_0_6','HC_0_7','HC_0_8','HC_0_9','HC_L0_-700_1','HC_L0_-700_2','HC_L0_-700_3']},{id:'EG',name:'Eastgate',cx:702,cz:-560,style:'rows',nodes:['EG_0_0','EG_1_0','EG_2_0','EG_0_1','EG_1_1','EG_2_1','EG_3_1','EG_0_2','EG_1_2','EG_2_2','EG_3_2','EG_0_3','EG_1_3','EG_2_3','EG_3_3','EG_0_4','EG_1_4','EG_2_4','EG_3_4']},{id:'ES',name:'Works Estate',cx:900,cz:-100,style:'works',nodes:['ES_0_0','ES_1_0','ES_2_0','ES_3_0','ES_4_0','ES_0_1','ES_1_1','ES_2_1','ES_3_1','ES_4_1','ES_0_2','ES_1_2','ES_2_2','ES_3_2','ES_4_2','ES_0_3','ES_1_3','ES_2_3','ES_3_3','ES_4_3']},{id:'TM',name:'Container Terminal',cx:850,cz:140,style:'harbour',nodes:['TM_0_0','TM_1_0','TM_2_0','TM_0_1','TM_1_1','TM_2_1']}];

  // ---------- the road network: one definition for the roads you see and the routes cars take ----------
  // nodes: [x, z, road height]; edges: [from, to, width, kind, via points]. 'town' roads get pavements, 'bridge' a deck.
  const NODES = { A: [-210, 55, 3], B: [-60, 55, 3], C: [60, 55, 3], D: [190, 58, 3], E: [190, -30, 3], F: [190, -110, 3], G: [60, -110, 3], H: [-60, -110, 3], I: [-200, -96, 3],
    J: [-96, 92, 3], K: [224, 12, 3], X: [190, 12, 3], SH1: [190, 98, 3], PK: [113, 98, 3], SC: [201, 129, 3],
    H2: [-60, -200, 3], G2: [60, -200, 3], F2: [190, -200, 3], I2: [-200, -200, 3], S1: [40, -265, 3], S2: [222, -265, 3], SP: [22, -318, 3], SQ: [234, -306, 3], FA: [-270, -282, 3], FB: [-395, -256, 3], FC: [-212, -386, 3],
    V1: [-290, 62, 'auto'], V2: [-390, 32, 'auto'], V3: [-488, 40, 'auto'], V4: [-540, 118, 'auto'], V5: [-478, 150, 'auto'], V6: [-400, 132, 'auto'], MQ: [-410, 166, 3], L: [252, -152, 7.4], M: [296, -167, 9], N: [460, -181, 9], O: [503, -180, 9], P: [546, -140, 9], Q: [588, -182, 9], R: [546, -226, 9] };
  const EDGES = [['A', 'B', 8, 'town', [[-135, 63]]], ['B', 'C', 8, 'town'], ['C', 'D', 8, 'town', [[125, 61]]], ['D', 'X', 9, 'town'], ['X', 'E', 9, 'town'], ['E', 'F', 9, 'town'], ['F', 'G', 8, 'town', [[125, -119]]], ['G', 'H', 8, 'town'],
    ['H', 'I', 8, 'town', [[-135, -105]]], ['I', 'A', 8, 'town', [[-226, -22]]], ['B', 'H', 7, 'town'], ['C', 'G', 7, 'town'], ['B', 'J', 7, 'town', [[-74, 80]]], ['X', 'K', 8, 'quay'], ['D', 'SH1', 8, 'road'], ['SH1', 'PK', 7, 'road'], ['SH1', 'SC', 7, 'road', [[190, 116]]],
    ['F', 'L', 8, 'road', [[226, -136]]], ['L', 'M', 8, 'road'], ['M', 'N', 9, 'bridge'], ['N', 'O', 8, 'works'], ['H', 'H2', 7, 'town'], ['G', 'G2', 7, 'town'], ['F', 'F2', 9, 'town'], ['I', 'I2', 8, 'town'], ['I2', 'H2', 8, 'town'], ['H2', 'G2', 8, 'town'], ['G2', 'F2', 8, 'town'],
    ['G2', 'S1', 8, 'town', [[48, -236]]], ['S1', 'S2', 9, 'town'], ['S2', 'F2', 8, 'town', [[214, -236]]], ['S1', 'SP', 7, 'town'], ['S2', 'SQ', 7, 'town'],
    ['I2', 'FA', 8, 'road', [[-236, -246]]], ['FA', 'FB', 7, 'farm', [[-335, -276]]], ['FA', 'FC', 7, 'farm', [[-246, -336]]],
    ['A', 'V1', 7, 'road', [[-250, 64]]], ['V1', 'V2', 7, 'villa', [[-340, 52]]], ['V2', 'V3', 7, 'villa', [[-440, 26]]], ['V3', 'V4', 7, 'villa', [[-528, 74]]], ['V4', 'V5', 7, 'villa', [[-515, 150]]], ['V5', 'V6', 7, 'villa', [[-440, 146]]], ['V6', 'V1', 7, 'villa', [[-345, 104]]], ['V6', 'MQ', 7, 'quay'],
    ['O', 'P', 7, 'works', [[520, -152]]], ['P', 'Q', 7, 'works', [[574, -154]]], ['Q', 'R', 7, 'works', [[578, -214]]], ['R', 'O', 7, 'works', [[516, -214]]]];
  if (EXPANDED) { Object.assign(NODES, NEW_NODES); EDGES.push(...NEW_EDGES); }
  const nodes = {}, edges = [];
  for (const id in NODES) { const [x, z, y] = NODES[id]; nodes[id] = { id, x, y: y === 'auto' ? Math.max(TOWN_Y, natural(x, z) + 0.2) : y, auto: y === 'auto', z, edges: [], out: [], inn: [], busy: null, r: 0 }; } // villa roads follow the hillside
  for (let it = 0; it < 40; it++) for (const [a, b] of EDGES) { const A = nodes[a], B = nodes[b], lim = 0.085 * Math.hypot(A.x - B.x, A.z - B.z), dy = B.y - A.y; if (Math.abs(dy) <= lim) continue; const fix = Math.abs(dy) - lim; if (A.auto && B.auto) { A.y += Math.sign(dy) * fix / 2; B.y -= Math.sign(dy) * fix / 2; } else if (A.auto) A.y += Math.sign(dy) * fix; else if (B.auto) B.y -= Math.sign(dy) * fix; }
  function catmull(ctrl, step) { // an open curve through the points, sampled every `step` metres
    const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = [];
    for (let i = 1; i < P.length - 2; i++) {
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]], L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
    }
    out.push(ctrl[ctrl.length - 1]); return out;
  }
  const cumOf = pts => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2])); return c; };
  EDGES.forEach(([a, b, w, kind, via, opt], i) => {
    const A = nodes[a], B = nodes[b], c2 = catmull([[A.x, A.z], ...(via || []), [B.x, B.z]], 2), d2 = [0];
    for (let k = 1; k < c2.length; k++) d2.push(d2[k - 1] + Math.hypot(c2[k][0] - c2[k - 1][0], c2[k][1] - c2[k - 1][1])); // heights go by distance along the road, so slopes are even
    const pts = c2.map(([x, z], k) => { const t = d2[k] / (d2[d2.length - 1] || 1); return [x, kind === 'bridge' ? mix(A.y, B.y, t) + (opt && opt.hump != null ? opt.hump : 2.6) * Math.sin(Math.PI * t) : mix(A.y, B.y, A.auto || B.auto ? t : smooth(0, 1, t)), z]; });
    const e = { id: i, a: A, b: B, w, kind, pts, closed: false, opt: opt || null }; e.cum = cumOf(pts); e.len = e.cum[e.cum.length - 1];
    edges.push(e); A.edges.push(e); B.edges.push(e);
  });
  for (const id in nodes) { const N = nodes[id], deg = N.edges.length; N.deg = deg; N.r = deg === 1 ? 10 : deg >= 3 ? Math.max(...N.edges.map(e => e.w)) / 2 + 2 : 0; }
  // roundabouts (the bigger island): open junctions of the main roads, away from town streets and lights, where every arm is long enough,
  // get a planted island that the traffic drives round (keeping it on the left: they drive on the right)
  if (EXPANDED) for (const id in nodes) { const N = nodes[id], R = 11; if (N.deg < 3 || N.deg > 4 || !N.edges.some(e => e.kind === 'road') || N.edges.some(e => ['town', 'bridge', 'works', 'quay'].includes(e.kind))) continue;
    if (N.edges.every(e => { const o = e.a === N ? e.b : e.a; return e.len - R - (o.deg >= 3 ? Math.max(o.r, R) : 8) >= 3; })) { N.round = 3.6; N.r = R; } }
  // lanes: drive on the right, a lane each way, offset from the centreline; trimmed where a junction takes over
  function offsetLine(pts, off) {
    return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1; return [p[0] - dz / L * off, p[1], p[2] + dx / L * off]; });
  }
  function cut(pts, s0, s1) { // the part of a polyline between two distances along it
    const c = cumOf(pts), at = s => { let i = 1; while (i < c.length - 1 && c[i] < s) i++; const t = clamp((s - c[i - 1]) / ((c[i] - c[i - 1]) || 1), 0, 1); return pts[i - 1].map((v, j) => v + (pts[i][j] - v) * t); };
    const out = [at(s0)]; for (let i = 0; i < pts.length; i++) if (c[i] > s0 && c[i] < s1) out.push(pts[i]); out.push(at(s1)); return out;
  }
  // where two roads meet at an angle, the lanes stop short of the corner so the connector can be a proper curve
  const bend = N => { if (N.deg !== 2) return 0; const d = N.edges.map(e => { const pts = e.a === N ? e.pts : e.pts.slice().reverse(), q = pts[Math.min(4, pts.length - 1)]; return Math.atan2(q[2] - N.z, q[0] - N.x); }); return Math.PI - Math.abs(Math.atan2(Math.sin(d[0] - d[1]), Math.cos(d[0] - d[1]))); };
  const trimAt = N => N.deg >= 3 ? N.r : N.deg === 2 ? (bend(N) > 0.35 ? 8 : 4) : 0;
  const lanes = [];
  const makePath = (pts, extra) => { const p = Object.assign({ pts, occ: [] }, extra); p.cum = cumOf(pts); p.len = p.cum[p.cum.length - 1]; return p; };
  for (const e of edges) for (const dir of [1, -1]) {
    const from = dir > 0 ? e.a : e.b, to = dir > 0 ? e.b : e.a, base = dir > 0 ? e.pts : e.pts.slice().reverse(), L = e.len;
    const ln = makePath(cut(offsetLine(base, e.w / 4), trimAt(from), L - trimAt(to)), { kind: 'lane', e, dir, from, to, vmax: e.kind === 'bridge' || e.kind === 'road' ? 13 : e.kind === 'villa' ? 11 : e.kind === 'quay' ? 6 : e.kind === 'farm' ? 8 : e.kind === 'works' ? 9 : 10 });
    ln.id = lanes.length; lanes.push(ln); from.out.push(ln); to.inn.push(ln);
  }
  const conns = new Map();
  function connector(a, b) { // a smooth curve from the end of one lane to the start of the next, through the junction
    const key = a.id + '>' + b.id; if (conns.has(key)) return conns.get(key);
    if (a.to.round) { // a roundabout: in, round the island the short way that keeps it on the left, and out (a U-turn goes all the way round)
      const N = a.to, P0 = a.pts[a.pts.length - 1], P3 = b.pts[0], Rr = N.round + 3.4, dl = 0.45, ta = Math.atan2(P0[2] - N.z, P0[0] - N.x), tb = Math.atan2(P3[2] - N.z, P3[0] - N.x);
      let D = ((ta - tb) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); if (D < 2 * dl + 0.25) D += 2 * Math.PI;
      const th = []; for (let t = ta - dl; t > ta - D + dl; t -= 0.14) th.push(t); th.push(ta - D + dl);
      const r0 = Math.hypot(P0[0] - N.x, P0[2] - N.z), r3 = Math.hypot(P3[0] - N.x, P3[2] - N.z), at = (r, t) => [N.x + Math.cos(t) * r, 0, N.z + Math.sin(t) * r];
      const raw = [P0, at(r0 * 0.62 + Rr * 0.38, ta - dl * 0.3), ...th.map(t => at(Rr, t)), at(r3 * 0.62 + Rr * 0.38, ta - D + dl * 0.3), P3], pts = raw.map((p, i) => [p[0], mix(P0[1], P3[1], i / (raw.length - 1)), p[2]]);
      const c = makePath(pts, { kind: 'conn', node: N, from: a, to: b, uturn: a.e === b.e, round: true }); c.vmax = 7; conns.set(key, c); return c;
    }
    const P0 = a.pts[a.pts.length - 1], P3 = b.pts[0], far = (pts, from, dir) => { let i = from; while (i + dir >= 0 && i + dir < pts.length && Math.hypot(pts[i][0] - pts[from][0], pts[i][2] - pts[from][2]) < 1.5) i += dir; return pts[i]; }, pa = far(a.pts, a.pts.length - 1, -1), pb = far(b.pts, 0, 1); // directions from points at least 1.5 m apart, never from a sliver
    const t0 = [P0[0] - pa[0], P0[2] - pa[2]], t3 = [pb[0] - P3[0], pb[2] - P3[2]], n0 = Math.hypot(...t0) || 1, n3 = Math.hypot(...t3) || 1;
    const uturn = a.e === b.e, dist = Math.hypot(P3[0] - P0[0], P3[2] - P0[2]), k = uturn ? 7.5 : Math.max(1.5, dist * 0.42);
    const C1 = [P0[0] + t0[0] / n0 * k, P0[2] + t0[1] / n0 * k], C2 = [P3[0] - t3[0] / n3 * k, P3[2] - t3[1] / n3 * k], pts = [], n = Math.max(4, Math.ceil((dist + k) / 1));
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; pts.push([w[0] * P0[0] + w[1] * C1[0] + w[2] * C2[0] + w[3] * P3[0], mix(P0[1], P3[1], t), w[0] * P0[2] + w[1] * C1[1] + w[2] * C2[1] + w[3] * P3[2]]); }
    const turn = Math.abs(Math.atan2(t0[0] * t3[1] - t0[1] * t3[0], t0[0] * t3[0] + t0[1] * t3[1])), c = makePath(pts, { kind: 'conn', node: a.to, from: a, to: b, uturn });
    c.vmax = turn < 0.2 ? Math.min(a.vmax, b.vmax) : clamp(Math.sqrt(2.6 * c.len / turn), 3, 9); // gentler for sharper turns
    conns.set(key, c); return c;
  }
  // routing: shortest path over open edges
  function route(fromId, toId) {
    if (!nodes[fromId] || !nodes[toId]) return null; // an unknown place has no route (and must never send the search round for ever)
    const dist = {}, prev = {}, Q = new Set(Object.keys(nodes)); for (const k of Q) dist[k] = 1e12; dist[fromId] = 0;
    while (Q.size) { let u = null; for (const k of Q) if (u === null || dist[k] < dist[u]) u = k; Q.delete(u); if (u === toId || dist[u] >= 1e12) break;
      for (const e of nodes[u].edges) { if (e.closed) continue; const v = e.a.id === u ? e.b.id : e.a.id, nd = dist[u] + e.len; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; } } }
    if (dist[toId] >= 1e12) return null; const out = [toId]; while (out[0] !== fromId) out.unshift(prev[out[0]]); return out;
  }
  const laneBetween = (u, v) => nodes[u].out.find(l => l.to.id === v);

  // ---------- terrain height ----------
  // road segments in a grid, so the ground can settle under each road quickly
  const RSEG = [], RGRID = new Map();
  for (const e of edges) for (let i = 1; i < e.pts.length; i++) { const p = e.pts[i - 1], q = e.pts[i], s = { ax: p[0], ay: p[1], az: p[2], bx: q[0], by: q[1], bz: q[2], w: e.w, bridge: e.kind === 'bridge' || e.kind === 'tunnel', kind: e.kind, t0: e.cum[i - 1] / e.len, t1: e.cum[i] / e.len };
    RSEG.push(s); for (let gx = Math.floor((Math.min(p[0], q[0]) - 30) / 20); gx <= Math.floor((Math.max(p[0], q[0]) + 30) / 20); gx++) for (let gz = Math.floor((Math.min(p[2], q[2]) - 30) / 20); gz <= Math.floor((Math.max(p[2], q[2]) + 30) / 20); gz++) { const k = gx * 100003 + gz; if (!RGRID.has(k)) RGRID.set(k, []); RGRID.get(k).push(s); } } // numeric cell keys: building a string for every lookup was a large part of the build time
  function nearRoad(x, z) { // distance to the nearest road edge, and that road's height there
    let best = 1e9, y = 0, bridge = false, tt = 0, kind = ''; for (const s of RGRID.get(Math.floor(x / 20) * 100003 + Math.floor(z / 20)) || []) { const ex = s.bx - s.ax, ez = s.bz - s.az, t0 = ((x - s.ax) * ex + (z - s.az) * ez) / (ex * ex + ez * ez || 1), t = t0 < 0 ? 0 : t0 > 1 ? 1 : t0, px = s.ax + t * ex - x, pz = s.az + t * ez - z, d = Math.sqrt(px * px + pz * pz) - s.w / 2; if (d < best) { best = d; y = mix(s.ay, s.by, t); bridge = s.bridge; tt = mix(s.t0, s.t1, t); kind = s.kind; } }
    return [best, y, bridge, tt, kind];
  }
  const PADS = []; // flat ground under buildings off the town terrace: [x, z, r, y]
  // villas: plots beside the villa roads, each levelled to the road's height
  const FROZEN_VILLAS = [[-309.22,43.49,-0.18,10.31],[-339.01,36.58,-0.33,10.89],[-348.65,64.99,2.81,10.89],[-409.63,13.31,-0.16,13.61],[-414.37,42.94,2.98,13.61],[-446.54,11.69,0.17,16.29],[-515.45,41.64,0.65,19.58],[-542.27,68.6,1.07,18.82],[-515.91,82.91,-2.07,18.82],[-540.03,145.62,2.2,16.09],[-515.7,128.07,-0.95,16.09],[-500.05,167.34,-3.1,13.58],[-453.36,163.21,-3.03,10.21],[-429,126.94,0.35,7.93],[-372.44,135.58,-2.7,6.79],[-385.35,108.5,0.45,6.79],[-342.91,120.29,-2.61,7.72],[-314.88,100.91,-2.49,8.66]];
  // villa plots beside the villa lanes, each levelled to the lane's height (fixed, so the plots people own never move)
  const VILLAS = FROZEN_VILLAS.map(([x, z, rot, y]) => ({ x, z, rot, y }));
  for (const v of VILLAS) PADS.push([v.x, v.z, 12, v.y]);
  let PADLIM = -1; // the ground squares are drawn later than they were once worked out: they use only the pads that existed then, so they come out exactly as before
  function heightAt(x, z) {
    let h = natural(x, z);
    const [rd, ry, br] = nearRoad(x, z); if (!br) h = mix(h, ry - 0.05, 1 - smooth(1.5, 14, rd));
    for (let i = 0, n = PADLIM < 0 ? PADS.length : PADLIM; i < n; i++) { const p = PADS[i], R = p[2] + 10, ex = x - p[0], ez = z - p[1]; if (ex > R || ex < -R || ez > R || ez < -R) continue; const dd = Math.sqrt(ex * ex + ez * ez); if (dd < R) h = mix(h, p[3], 1 - smooth(p[2], R, dd)); }
    return h;
  }

  const bbox = (() => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const P of COAST_LISTS) for (const p of P) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); } return { x0: a, x1: b, z0: c, z1: d }; })();
  const WORLD = EXPANDED ? { x0: Math.floor((bbox.x0 - 90) / 16) * 16, x1: Math.ceil((bbox.x1 + 90) / 16) * 16, z0: Math.floor((bbox.z0 - 90) / 16) * 16, z1: Math.ceil((bbox.z1 + 90) / 16) * 16 } : { x0: -660, x1: 700, z0: -520, z1: 340 };
  const api = { setPadLimit: n => { PADLIM = n; }, FALL, NEW_TRAILS, NEW_TOWNS, forestDensity, NOTREE, landFar, pnoise, detailAt, zoneMask, ZONES, DETAIL, EXPANDED, WORLD, COAST_LISTS, clamp, smooth, mix, TOWN_Y, MAIN_C, ISLE_C, curve, K, land, hash, vnoise, fbm, g2, FLATS, townMask, natural, naturalOld, ground0, protect, plainMask, relief, PEAKS, PLAINS, RIVERS, nearRiver, riverSamples, NODES, EDGES, nodes, edges, catmull, cumOf, offsetLine, cut, bend, trimAt, lanes, makePath, conns, connector, route, laneBetween, RSEG, RGRID, nearRoad, PADS, VILLAS, heightAt };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandGeo = api;
})(typeof self !== 'undefined' ? self : this);
