// Capital Island's geography: the coast, the ground, the rivers and the road network, as pure maths with no 3D library,
// so the game (world.js) and the tests share one definition. The bigger island (Goal 39) is shown only with ?expand while it is
// being built; without it the first island is exactly as it was: the same coast, the same ground, the same roads.
(function (root) {
  'use strict';
  const EXPANDED = (typeof location !== 'undefined' && /[?&]expand\b/.test(location.search)) || (typeof process !== 'undefined' && !!process.env && process.env.ISLAND_EXPAND === '1');
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
    [-842, -452, 'r'], [-836, -500, 'b'], [-818, -560, 'b'], [-812, -625, 'b'], [-822, -690, 'b'], [-850, -736, 'b'], // the resort bay: a long crescent beach
    [-892, -770, 'r'], [-940, -800, 'r'], [-952, -846, 'r'], [-1000, -870, 'r'], [-1010, -920, 'r'], [-962, -960, 'r'], [-900, -975, 'r'], // Coral Point and Lantern Head
    [-850, -1010, 'r'], [-770, -1040, 'r'], [-690, -1050, 'r'], [-620, -1040, 'b'], [-560, -1052, 'b'], [-500, -1040, 'r'], [-430, -1060, 'r'], [-350, -1048, 'r'], [-290, -1020, 'r'], // the Highlands meet the sea
    [-250, -1034, 'r'], [-205, -1050, 'r'], [-165, -1040, 'b'], [-150, -995, 'b'], [-120, -948, 'b'], [-70, -922, 'b'], [-15, -925, 'b'], [30, -950, 'b'], [55, -995, 'b'], [90, -1030, 'r'], [150, -1030, 'r'], [200, -1000, 'r'], [250, -975, 'r'], // Northhaven Bay
    [320, -955, 'r'], [390, -925, 'r'], [440, -880, 'r'], [455, -835, 'r'], [415, -800, 'r'], [360, -790, 'r'], [310, -768, 'r'], // Fort Point
    [285, -735, 'b'], [225, -730, 'b'], [160, -724, 'b'], [95, -708, 'b'], [30, -690, 'b'], [-45, -668, 'b'], [-125, -645, 'b'], [-205, -622, 'b'], [-280, -598, 'b'], [-345, -568, 'b'], [-392, -532, 'b'], [-384, -490, 'b']]; // Silver Bay and its head
  const EAST_C = [[590, -930, 'r'], [660, -985, 'r'], [750, -1015, 'b'], [850, -1045, 'r'], [950, -1050, 'r'], [1040, -1022, 'r'], [1098, -975, 'b'], [1138, -940, 'b'], [1195, -948, 'r'], [1250, -918, 'r'], [1292, -852, 'r'], [1282, -792, 'r'], [1238, -752, 'b'], [1212, -690, 'b'], [1228, -628, 'b'], [1275, -584, 'b'], [1330, -566, 'r'], [1372, -515, 'r'], [1392, -435, 'r'], [1412, -345, 'r'], [1422, -255, 'b'],
    [1436, -165, 'b'], [1450, -75, 'b'], [1456, 15, 'b'], [1438, 105, 'b'], [1405, 175, 'b'], [1352, 232, 'b'], [1290, 285, 'b'], [1205, 312, 'b'], [1125, 285, 'b'], [1062, 238, 'r'], [990, 236, 'b'], [925, 252, 'q'], [860, 246, 'q'], [800, 226, 'q'], [748, 198, 'q'], [722, 150, 'r'], [712, 80, 'r'], [700, -10, 'r'], [706, -90, 'r'], [716, -170, 'r'], [702, -240, 'r'], [676, -310, 'r'],
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
    return (x, z) => {
      if (x < bx0 || x > bx1 || z < bz0 || z > bz1) { K.rock = 1; K.quay = 0; K.isle = isle; return -RMAX; } // far from this coast
      const ci = Math.floor((x - WX0) / CELL), cj = Math.floor((z - WZ0) / CELL), list = ci >= 0 && cj >= 0 && ci < NX && cj < NZ ? tmp[cj * NX + ci] : null;
      let d = RMAX, best = -1, bt = 0;
      if (list) for (let a = 0; a < list.length; a++) { const o = list[a] * 8, x0 = segs[o], z0 = segs[o + 1], ex = segs[o + 4] - x0, ez = segs[o + 5] - z0; let t = ((x - x0) * ex + (z - z0) * ez) / (ex * ex + ez * ez || 1); t = t < 0 ? 0 : t > 1 ? 1 : t; const px = x0 + t * ex - x, pz = z0 + t * ez - z, dd = Math.sqrt(px * px + pz * pz); if (dd < d) { d = dd; best = o; bt = t; } }
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
  const PLAINS = [[-300, 280, -930, -740, 110], [-860, -768, -740, -450, 90], [-205, 165, -1010, -885, 80], [715, 1015, -440, 125, 120], [840, 1450, -70, 252, 120], [612, 770, -705, -445, 100]];
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
    { id: 'coral', name: 'Coral Creek', pts: [[-700, -600, 5], [-745, -598, 6], [-790, -600, 8], [-818, -598, 10]] },
    { id: 'quarrybrook', name: 'Quarry Brook', pts: [[1000, -760, 5], [930, -700, 6], [860, -650, 7], [780, -620, 8], [700, -615, 10], [588, -605, 12]] },
    { id: 'eastmill', name: 'East Mill', pts: [[1180, -450, 5], [1100, -400, 6], [1010, -350, 7], [930, -322, 8], [850, -308, 9], [780, -300, 10], [708, -292, 12]] }];
  const catmullRaw = (ctrl, step) => { const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = []; for (let i = 1; i < P.length - 2; i++) { const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]], L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / step)); for (let k = 0; k < n; k++) { const u = k / n, u2 = u * u, u3 = u2 * u, f = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3); out.push([f(0), f(1), mix(p1[2], p2[2], u)]); } } out.push(ctrl[ctrl.length - 1].slice()); return out; };
  const RGRID_ = new Map(); let riversReady = false;
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
    return h;
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
  function natural(x, z) { const g = ground0(x, z); return EXPANDED && lastD > 0 ? carve(x, z, g) : g; }
  // where the ground keeps 4 m detail (the first island and the places that get built), and the zones of land use that colour the ground
  const DETAIL = !EXPANDED ? [[-1e5, 1e5, -1e5, 1e5]] : [[-262, 336, -434, 276], [-626, -196, -102, 276], [-422, -18, -434, -186], [438, 626, -276, -88], [-420, -200, -760, -560], [-900, -740, -780, -400], [-810, -620, -450, -80], [320, 490, -900, -770], [-210, 80, -980, -840], [-130, 210, -870, -690], [600, 770, -710, -440], [720, 1030, -450, 130], [740, 960, 100, 260], [1080, 1340, 20, 150], [930, 1130, -860, -700], [1090, 1230, -660, -540]];
  const RIVER_KEYS = new Set(); // the 128 m squares a river runs through keep 4 m detail, so its banks and water are cut cleanly
  const detailAt = (x0, z0, s) => { for (const R of DETAIL) if (x0 < R[1] && x0 + s > R[0] && z0 < R[3] && z0 + s > R[2]) return true; if (RIVERS.length) { if (!riversReady) buildRivers(); if (RIVER_KEYS.has(Math.round(x0 / 128) + ',' + Math.round(z0 / 128))) return true; } return false; };
  const ZONES = !EXPANDED ? {} : { farm: [[-430, -20, -440, -188, 40], [-300, 280, -930, -740, 60]], industry: [[730, 1010, -430, 120, 50]], quarry: [[930, 1130, -860, -700, 50], [1090, 1230, -660, -540, 40]], airport: [[880, 1450, -50, 230, 40]] };
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
  const NEW_NODES = {N0:[214,-344,'auto'],N1:[226,-772,'auto'],ML:[28,-788,'auto'],NH:[-60,-868,'auto'],HC:[-276,-708,'auto'],FL:[-508,-572,'auto'],SL:[-540,-636,'auto'],FP:[404,-852,'auto'],C2:[-628,-236,'auto'],C3:[-660,-356,'auto'],C4:[-708,-436,'auto'],C5:[-740,-484,'auto'],C6:[-780,-508,'auto'],C7:[-780,-716,'auto'],C8:[-788,-732,'auto'],MC:[-724,-420,'auto'],E1:[756,-188,'auto'],ES1:[852,-60,'auto'],ES2:[1004,-60,'auto'],TG:[852,148,'auto'],AP:[1188,68,'auto'],ES3:[796,-340,'auto'],EG:[700,-572,'auto'],QU:[1028,-676,'auto'],MN:[1132,-668,'auto'],N1ML1:[170.7,-772.1,'auto'],N1ML2:[115.3,-772.2,'auto'],N1ML3:[60,-772.3,'auto'],N1FP1:[253.4,-811.7,'auto'],N1FP2:[268,-823.6,'auto'],N1FP3:[300,-826.5,'auto'],N1FP4:[332,-829.5,'auto'],N1FP5:[372,-850.5,'auto'],MLNH1:[-4,-819.8,'auto'],MLNH2:[-36,-851.7,'auto'],MLHC1:[-16,-787.6,'auto'],MLHC2:[-60,-787.3,'auto'],MLHC3:[-104,-786.9,'auto'],MLHC4:[-148,-786.5,'auto'],MLHC5:[-164,-778.5,'auto'],MLHC6:[-200,-745.5,'auto'],MLHC7:[-236,-712.4,'auto'],MLHCr0:[-167.9,-774.9,'auto'],MLHCr1:[-183.1,-761,'auto'],HCFC1:[-287.6,-692,'auto'],HCFC2:[-300.3,-646.3,'auto'],HCFC3:[-332,-619.9,'auto'],HCFC4:[-361.8,-589,'auto'],HCFC5:[-391.6,-558.1,'auto'],HCFC6:[-421.4,-527.2,'auto'],HCFC7:[-451.2,-496.3,'auto'],HCFC8:[-419.6,-474.9,'auto'],HCFC9:[-388,-453.5,'auto'],HCFC10:[-350.7,-451.5,'auto'],HCFC11:[-313.3,-449.6,'auto'],HCFC12:[-276,-447.6,'auto'],HCFC13:[-244,-416.8,'auto'],HCFCr2:[-407.5,-541.7,'auto'],HCFL1:[-295.4,-673.4,'auto'],HCFL2:[-314.9,-638.9,'auto'],HCFL3:[-336.2,-635.6,'auto'],HCFL4:[-350.9,-646.1,'auto'],HCFL5:[-359.2,-645.6,'auto'],HCFL6:[-393.6,-615,'auto'],HCFL7:[-428,-584.4,'auto'],HCFL8:[-476,-573.2,'auto'],HCFLr4:[-454.4,-578.2,'auto'],FLSL1:[-518.3,-611.9,'auto'],IC21:[-236,-130.5,'auto'],IC22:[-252,-138.5,'auto'],IC23:[-295.9,-139,'auto'],IC24:[-339.8,-139.4,'auto'],IC25:[-383.7,-139.9,'auto'],IC26:[-392.1,-132.1,'auto'],IC27:[-401.4,-134.8,'auto'],IC28:[-431.6,-163.1,'auto'],IC29:[-461.8,-191.4,'auto'],IC210:[-492,-219.7,'auto'],IC211:[-516,-234.5,'auto'],IC212:[-553.3,-235,'auto'],IC213:[-590.7,-235.5,'auto'],C2C31:[-613.5,-245.5,'auto'],C2C32:[-613.5,-300,'auto'],C2C33:[-621.5,-316,'auto'],C3C41:[-634,-332.2,'auto'],C3C42:[-608.1,-308.5,'auto'],C3C43:[-594.1,-325.2,'auto'],C3C44:[-598.4,-348,'auto'],C3C45:[-637.2,-387.3,'auto'],C3C46:[-676,-426.5,'auto'],C4C51:[-730.5,-460,'auto'],C5C61:[-764,-503.6,'auto'],C6C71:[-780.1,-540,'auto'],C6C72:[-780.3,-572,'auto'],C6C73:[-784.1,-600,'auto'],C6C74:[-788,-628,'auto'],C6C75:[-784,-672,'auto'],C6C7r6:[-782.8,-590.1,'auto'],C6C7r8:[-785.5,-609.9,'auto'],C3MC1:[-659.4,-363.7,'auto'],C3MC2:[-644.6,-376.3,'auto'],C3MC3:[-662.3,-404.8,'auto'],C3MC4:[-684,-418.5,'auto'],E1ES11:[760.3,-156,'auto'],E1ES12:[781.2,-118.9,'auto'],E1ES13:[812,-107.4,'auto'],E1ES14:[832,-83.7,'auto'],ES1ES21:[902.7,-60,'auto'],ES1ES22:[953.3,-60,'auto'],ES1TG1:[852,-8,'auto'],ES1TG2:[852,44,'auto'],ES1TG3:[852,96,'auto'],ES2AP1:[1034,-30.4,'auto'],ES2AP2:[1064,-0.7,'auto'],ES2AP3:[1094,28.9,'auto'],ES2AP4:[1124,58.5,'auto'],ES2AP5:[1140,66.5,'auto'],ES1ES31:[851.6,-114,'auto'],ES1ES32:[851.3,-168,'auto'],ES1ES33:[850.9,-222,'auto'],ES1ES34:[850.5,-276,'auto'],ES1ES35:[842.5,-292,'auto'],ES1ES36:[819.3,-316,'auto'],ES1ES3r9:[837.4,-297.3,'auto'],ES1ES3r10:[820.3,-315,'auto'],ES3EG1:[796,-377.3,'auto'],ES3EG2:[796,-414.7,'auto'],ES3EG3:[796,-452,'auto'],ES3EG4:[791.6,-476,'auto'],ES3EG5:[761.1,-508,'auto'],ES3EG6:[730.5,-540,'auto'],EGQU1:[748,-572.7,'auto'],EGQU2:[796,-573.5,'auto'],EGQU3:[820,-590.5,'auto'],EGQU4:[844,-607.6,'auto'],EGQU5:[890.5,-616.4,'auto'],EGQU6:[909.5,-642.5,'auto'],EGQU7:[947.3,-644,'auto'],EGQU8:[985.1,-645.4,'auto'],EGQU9:[990.9,-658.6,'auto'],EGQU10:[1017.1,-664.4,'auto'],QUMN1:[1068,-675.8,'auto'],QUMN2:[1108,-675.7,'auto']};
  const NEW_EDGES = [
    ['SQ','N0',9,'road',[],null],
    ['N0','N1',10,'bridge',[],{'hump':9,'style':'suspension'}],
    ['N1','N1ML1',9,'road',[],null],
    ['N1ML1','N1ML2',9,'road',[],null],
    ['N1ML2','N1ML3',9,'road',[],null],
    ['N1ML3','ML',9,'road',[],null],
    ['N1','N1FP1',8,'road',[],null],
    ['N1FP1','N1FP2',8,'road',[],null],
    ['N1FP2','N1FP3',8,'road',[],null],
    ['N1FP3','N1FP4',8,'road',[],null],
    ['N1FP4','N1FP5',8,'road',[],null],
    ['N1FP5','FP',8,'road',[],null],
    ['ML','MLNH1',8,'road',[],null],
    ['MLNH1','MLNH2',8,'road',[],null],
    ['MLNH2','NH',8,'road',[],null],
    ['ML','MLHC1',9,'road',[],null],
    ['MLHC1','MLHC2',9,'road',[],null],
    ['MLHC2','MLHC3',9,'road',[],null],
    ['MLHC3','MLHC4',9,'road',[],null],
    ['MLHC4','MLHC5',9,'road',[],null],
    ['MLHC5','MLHCr0',9,'road',[]],
    ['MLHCr0','MLHCr1',9,'bridge',[],{'hump':0.5,'style':'river'}],
    ['MLHCr1','MLHC6',9,'road',[],null],
    ['MLHC6','MLHC7',9,'road',[],null],
    ['MLHC7','HC',9,'road',[],null],
    ['HC','HCFC1',9,'road',[],null],
    ['HCFC1','HCFC2',9,'road',[],null],
    ['HCFC2','HCFC3',9,'road',[],null],
    ['HCFC3','HCFC4',9,'road',[],null],
    ['HCFC4','HCFC5',9,'road',[],null],
    ['HCFC5','HCFCr2',9,'road',[]],
    ['HCFCr2','HCFC6',9,'bridge',[],{'hump':0.5,'style':'river'}],
    ['HCFC6','HCFC7',9,'road',[],null],
    ['HCFC7','HCFC8',9,'road',[],null],
    ['HCFC8','HCFC9',9,'road',[],null],
    ['HCFC9','HCFC10',9,'road',[],null],
    ['HCFC10','HCFC11',9,'road',[],null],
    ['HCFC11','HCFC12',9,'road',[],null],
    ['HCFC12','HCFC13',9,'road',[],null],
    ['HCFC13','FC',9,'road',[],null],
    ['HC','HCFL1',7,'road',[],null],
    ['HCFL1','HCFL2',7,'road',[],null],
    ['HCFL2','HCFL3',7,'road',[],null],
    ['HCFL3','HCFL4',7,'road',[],null],
    ['HCFL4','HCFL5',7,'road',[],null],
    ['HCFL5','HCFL6',7,'road',[],null],
    ['HCFL6','HCFL7',7,'road',[],null],
    ['HCFL7','HCFLr4',7,'road',[]],
    ['HCFLr4','HCFL8',7,'bridge',[],{'hump':0.5,'style':'river'}],
    ['HCFL8','FL',7,'road',[],null],
    ['FL','FLSL1',6,'road',[],null],
    ['FLSL1','SL',6,'road',[],null],
    ['I','IC21',9,'road',[],null],
    ['IC21','IC22',9,'road',[],null],
    ['IC22','IC23',9,'road',[],null],
    ['IC23','IC24',9,'road',[],null],
    ['IC24','IC25',9,'road',[],null],
    ['IC25','IC26',9,'road',[],null],
    ['IC26','IC27',9,'road',[],null],
    ['IC27','IC28',9,'road',[],null],
    ['IC28','IC29',9,'road',[],null],
    ['IC29','IC210',9,'road',[],null],
    ['IC210','IC211',9,'road',[],null],
    ['IC211','IC212',9,'road',[],null],
    ['IC212','IC213',9,'road',[],null],
    ['IC213','C2',9,'road',[],null],
    ['C2','C2C31',8,'road',[],null],
    ['C2C31','C2C32',8,'road',[],null],
    ['C2C32','C2C33',8,'road',[],null],
    ['C2C33','C3',8,'road',[],null],
    ['C3','C3C41',8,'road',[],null],
    ['C3C41','C3C42',8,'road',[],null],
    ['C3C42','C3C43',8,'road',[],null],
    ['C3C43','C3C44',8,'road',[],null],
    ['C3C44','C3C45',8,'road',[],null],
    ['C3C45','C3C46',8,'road',[],null],
    ['C3C46','C4',8,'road',[],null],
    ['C4','C4C51',8,'road',[],null],
    ['C4C51','C5',8,'road',[],null],
    ['C5','C5C61',8,'road',[],null],
    ['C5C61','C6',8,'road',[],null],
    ['C6','C6C71',8,'road',[],null],
    ['C6C71','C6C72',8,'road',[],null],
    ['C6C72','C6C7r6',8,'road',[]],
    ['C6C7r6','C6C73',8,'bridge',[],{'hump':0.5,'style':'river'}],
    ['C6C73','C6C7r8',8,'bridge',[],{'hump':0.5,'style':'river'}],
    ['C6C7r8','C6C74',8,'road',[],null],
    ['C6C74','C6C75',8,'road',[],null],
    ['C6C75','C7',8,'road',[],null],
    ['C7','C8',8,'road',[],null],
    ['C3','C3MC1',7,'villa',[],null],
    ['C3MC1','C3MC2',7,'villa',[],null],
    ['C3MC2','C3MC3',7,'villa',[],null],
    ['C3MC3','C3MC4',7,'villa',[],null],
    ['C3MC4','MC',7,'villa',[],null],
    ['Q','E1',9,'bridge',[],{'hump':1}],
    ['E1','E1ES11',9,'works',[],null],
    ['E1ES11','E1ES12',9,'works',[],null],
    ['E1ES12','E1ES13',9,'works',[],null],
    ['E1ES13','E1ES14',9,'works',[],null],
    ['E1ES14','ES1',9,'works',[],null],
    ['ES1','ES1ES21',9,'works',[],null],
    ['ES1ES21','ES1ES22',9,'works',[],null],
    ['ES1ES22','ES2',9,'works',[],null],
    ['ES1','ES1TG1',9,'works',[],null],
    ['ES1TG1','ES1TG2',9,'works',[],null],
    ['ES1TG2','ES1TG3',9,'works',[],null],
    ['ES1TG3','TG',9,'works',[],null],
    ['ES2','ES2AP1',9,'road',[],null],
    ['ES2AP1','ES2AP2',9,'road',[],null],
    ['ES2AP2','ES2AP3',9,'road',[],null],
    ['ES2AP3','ES2AP4',9,'road',[],null],
    ['ES2AP4','ES2AP5',9,'road',[],null],
    ['ES2AP5','AP',9,'road',[],null],
    ['ES1','ES1ES31',9,'works',[],null],
    ['ES1ES31','ES1ES32',9,'works',[],null],
    ['ES1ES32','ES1ES33',9,'works',[],null],
    ['ES1ES33','ES1ES34',9,'works',[],null],
    ['ES1ES34','ES1ES35',9,'works',[],null],
    ['ES1ES35','ES1ES3r9',9,'works',[]],
    ['ES1ES3r9','ES1ES3r10',9,'bridge',[],{'hump':0.5,'style':'river'}],
    ['ES1ES3r10','ES1ES36',9,'works',[],null],
    ['ES1ES36','ES3',9,'works',[],null],
    ['ES3','ES3EG1',8,'road',[],null],
    ['ES3EG1','ES3EG2',8,'road',[],null],
    ['ES3EG2','ES3EG3',8,'road',[],null],
    ['ES3EG3','ES3EG4',8,'road',[],null],
    ['ES3EG4','ES3EG5',8,'road',[],null],
    ['ES3EG5','ES3EG6',8,'road',[],null],
    ['ES3EG6','EG',8,'road',[],null],
    ['EG','EGQU1',10,'road',[],null],
    ['EGQU1','EGQU2',10,'road',[],null],
    ['EGQU2','EGQU3',10,'road',[],null],
    ['EGQU3','EGQU4',10,'road',[],null],
    ['EGQU4','EGQU5',10,'road',[],null],
    ['EGQU5','EGQU6',10,'road',[],null],
    ['EGQU6','EGQU7',10,'road',[],null],
    ['EGQU7','EGQU8',10,'road',[],null],
    ['EGQU8','EGQU9',10,'road',[],null],
    ['EGQU9','EGQU10',10,'road',[],null],
    ['EGQU10','QU',10,'road',[],null],
    ['QU','QUMN1',10,'road',[],null],
    ['QUMN1','QUMN2',10,'road',[],null],
    ['QUMN2','MN',10,'road',[],null]];

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
    RSEG.push(s); for (let gx = Math.floor((Math.min(p[0], q[0]) - 30) / 20); gx <= Math.floor((Math.max(p[0], q[0]) + 30) / 20); gx++) for (let gz = Math.floor((Math.min(p[2], q[2]) - 30) / 20); gz <= Math.floor((Math.max(p[2], q[2]) + 30) / 20); gz++) { const k = gx + ',' + gz; if (!RGRID.has(k)) RGRID.set(k, []); RGRID.get(k).push(s); } }
  function nearRoad(x, z) { // distance to the nearest road edge, and that road's height there
    let best = 1e9, y = 0, bridge = false, tt = 0, kind = ''; for (const s of RGRID.get(Math.floor(x / 20) + ',' + Math.floor(z / 20)) || []) { const ex = s.bx - s.ax, ez = s.bz - s.az, t = clamp(((x - s.ax) * ex + (z - s.az) * ez) / (ex * ex + ez * ez || 1), 0, 1), d = Math.hypot(s.ax + t * ex - x, s.az + t * ez - z) - s.w / 2; if (d < best) { best = d; y = mix(s.ay, s.by, t); bridge = s.bridge; tt = mix(s.t0, s.t1, t); kind = s.kind; } }
    return [best, y, bridge, tt, kind];
  }
  const PADS = []; // flat ground under buildings off the town terrace: [x, z, r, y]
  // villas: plots beside the villa roads, each levelled to the road's height
  const FROZEN_VILLAS = [[-309.22,43.49,-0.18,10.31],[-339.01,36.58,-0.33,10.89],[-348.65,64.99,2.81,10.89],[-409.63,13.31,-0.16,13.61],[-414.37,42.94,2.98,13.61],[-446.54,11.69,0.17,16.29],[-515.45,41.64,0.65,19.58],[-542.27,68.6,1.07,18.82],[-515.91,82.91,-2.07,18.82],[-540.03,145.62,2.2,16.09],[-515.7,128.07,-0.95,16.09],[-500.05,167.34,-3.1,13.58],[-453.36,163.21,-3.03,10.21],[-429,126.94,0.35,7.93],[-372.44,135.58,-2.7,6.79],[-385.35,108.5,0.45,6.79],[-342.91,120.29,-2.61,7.72],[-314.88,100.91,-2.49,8.66]];
  // villa plots beside the villa lanes, each levelled to the lane's height (fixed, so the plots people own never move)
  const VILLAS = FROZEN_VILLAS.map(([x, z, rot, y]) => ({ x, z, rot, y }));
  for (const v of VILLAS) PADS.push([v.x, v.z, 12, v.y]);
  function heightAt(x, z) {
    let h = natural(x, z);
    const [rd, ry, br] = nearRoad(x, z); if (!br) h = mix(h, ry - 0.05, 1 - smooth(1.5, 14, rd));
    for (const p of PADS) { const dd = Math.hypot(x - p[0], z - p[1]); if (dd < p[2] + 10) h = mix(h, p[3], 1 - smooth(p[2], p[2] + 10, dd)); }
    return h;
  }

  const bbox = (() => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const P of COAST_LISTS) for (const p of P) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); } return { x0: a, x1: b, z0: c, z1: d }; })();
  const WORLD = EXPANDED ? { x0: Math.floor((bbox.x0 - 90) / 16) * 16, x1: Math.ceil((bbox.x1 + 90) / 16) * 16, z0: Math.floor((bbox.z0 - 90) / 16) * 16, z1: Math.ceil((bbox.z1 + 90) / 16) * 16 } : { x0: -660, x1: 700, z0: -520, z1: 340 };
  const api = { forestDensity, NOTREE, landFar, pnoise, detailAt, zoneMask, ZONES, DETAIL, EXPANDED, WORLD, COAST_LISTS, clamp, smooth, mix, TOWN_Y, MAIN_C, ISLE_C, curve, K, land, hash, vnoise, fbm, g2, FLATS, townMask, natural, naturalOld, ground0, protect, plainMask, relief, PEAKS, PLAINS, RIVERS, nearRiver, riverSamples, NODES, EDGES, nodes, edges, catmull, cumOf, offsetLine, cut, bend, trimAt, lanes, makePath, conns, connector, route, laneBetween, RSEG, RGRID, nearRoad, PADS, VILLAS, heightAt };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandGeo = api;
})(typeof self !== 'undefined' ? self : this);
