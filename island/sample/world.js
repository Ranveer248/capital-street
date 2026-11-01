// Capital Island, sample 3: a small, finished corner of the island to approve before the rest is built.
// One road-network definition drives both the roads you see and the traffic that drives on them: every edge is a
// centreline; lanes, junctions, turning circles and the bridge deck are all derived from it, and cars only ever move
// along lane paths and the smooth connector curves between them, so they can't jump, spin, leave the road or cross water.
'use strict';
window.World = (function () {
  const lin = c => new THREE.Color(c).convertSRGBToLinear();
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const TOWN_Y = 3;

  // ---------- coastlines: hand-placed points, each marked beach (b), rock (r) or quay (q) ----------
  const MAIN_C = [[-470, -262, 'r'], [-432, -382, 'r'], [-322, -462, 'r'], [-190, -472, 'r'], [-100, -425, 'b'], [-30, -398, 'b'], [40, -432, 'b'], [120, -458, 'r'], [210, -410, 'r'], [262, -330, 'r'], [300, -252, 'r'], [322, -176, 'r'],
    [276, -110, 'r'], [256, -58, 'q'], [242, -30, 'q'], [242, 40, 'q'], [242, 118, 'q'], [272, 150, 'r'], [262, 196, 'r'], [205, 202, 'r'], [150, 172, 'b'], [70, 168, 'b'], [-20, 205, 'b'], [-110, 218, 'b'], [-195, 214, 'b'], [-238, 228, 'r'], [-280, 268, 'r'],
    [-340, 262, 'r'], [-378, 236, 'q'], [-386, 196, 'q'], [-430, 184, 'q'], [-452, 222, 'q'], [-478, 268, 'r'], [-548, 252, 'r'], [-604, 160, 'r'], [-614, 48, 'r'], [-566, -60, 'r'], [-506, -160, 'r']];
  const ISLE_C = [[446, -190, 'r'], [468, -250, 'r'], [540, -270, 'r'], [606, -228, 'r'], [618, -150, 'r'], [578, -96, 'q'], [505, -94, 'r'], [455, -128, 'r']];
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
  function shape(P, isle) { // signed distance to a closed coastline, fast: segments sorted into cells and bands
    const segs = []; for (let i = 0, j = P.length - 1; i < P.length; j = i++) segs.push(P[j].concat(P[i]));
    const RMAX = 240, CELL = 32, X0 = -1200, Z0 = -1200, NC = Math.ceil(2400 / CELL), cells = Array.from({ length: NC * NC }, () => []), bands = new Map();
    const sd = (s, x, z) => { const ex = s[4] - s[0], ez = s[5] - s[1], t = clamp(((x - s[0]) * ex + (z - s[1]) * ez) / (ex * ex + ez * ez || 1), 0, 1); return [Math.hypot(s[0] + t * ex - x, s[1] + t * ez - z), t]; };
    segs.forEach((s, k) => {
      const r = RMAX + CELL, i0 = Math.max(0, Math.floor((Math.min(s[0], s[4]) - r - X0) / CELL)), i1 = Math.min(NC - 1, Math.floor((Math.max(s[0], s[4]) + r - X0) / CELL)), j0 = Math.max(0, Math.floor((Math.min(s[1], s[5]) - r - Z0) / CELL)), j1 = Math.min(NC - 1, Math.floor((Math.max(s[1], s[5]) + r - Z0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (sd(s, X0 + (i + 0.5) * CELL, Z0 + (j + 0.5) * CELL)[0] < r) cells[j * NC + i].push(k);
      for (let b = Math.floor(Math.min(s[1], s[5]) / 8); b <= Math.floor(Math.max(s[1], s[5]) / 8); b++) { if (!bands.has(b)) bands.set(b, []); bands.get(b).push(k); }
    });
    return (x, z) => {
      const ci = Math.floor((x - X0) / CELL), cj = Math.floor((z - Z0) / CELL), list = ci >= 0 && cj >= 0 && ci < NC && cj < NC ? cells[cj * NC + ci] : [];
      let d = RMAX, best = null, bt = 0; for (const k of list) { const [dd, t] = sd(segs[k], x, z); if (dd < d) { d = dd; best = segs[k]; bt = t; } }
      let inside = false; for (const k of bands.get(Math.floor(z / 8)) || []) { const s = segs[k]; if ((s[1] > z) !== (s[5] > z) && x < s[0] + (z - s[1]) / (s[5] - s[1]) * (s[4] - s[0])) inside = !inside; }
      K.rock = best ? mix(best[2], best[6], bt) : 1; K.quay = best ? mix(best[3], best[7], bt) : 0; K.isle = isle;
      return inside ? d : -d;
    };
  }
  const mainSD = shape(curve(MAIN_C, 12), false), isleSD = shape(curve(ISLE_C, 12), true);
  function land(x, z) { const a = mainSD(x, z), r = K.rock, q = K.quay, b = isleSD(x, z); if (b > a) return b; K.rock = r; K.quay = q; K.isle = false; return a; }

  // ---------- natural ground: beaches, cliffs, hills, and the flat terraces the towns, farms and stadium stand on ----------
  const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const fbm = (x, z) => vnoise(x / 90, z / 90) * 0.6 + vnoise(x / 40, z / 40) * 0.3 + vnoise(x / 15, z / 15) * 0.1;
  const g2 = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));
  const FLATS = [[-212, 214, -122, 150], [-215, 250, -412, -110], [-420, -20, -432, -188]]; // south town, business centre and stadium, Greenfields farms
  const townMask = (x, z) => { let m = 0; for (const [x0, x1, z0, z1] of FLATS) { const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); m = Math.max(m, 1 - smooth(0, 28, Math.hypot(dx, dz))); } return m; };
  function natural(x, z) {
    const d = land(x, z), rock = K.rock, quay = K.quay, isle = K.isle;
    if (d < 0) return quay > 0.5 ? -7 : Math.max(-14, d * 0.13) - 0.6; // the sea floor; deep water straight off a quay
    const beach = -0.45 + smooth(0, quay > 0.5 ? 1.5 : 34, d) * (TOWN_Y + 0.45);
    const plat = isle ? 6 : 6 * rock * (1 - smooth(50, 100, d)), raise = plat * smooth(0, 8, d); // cliffs: rock shores rise steeply to a plateau
    const hill = 46 * g2(x, z, -520, -95, 82) + 30 * g2(x, z, -470, -320, 60) + 14 * g2(x, z, -560, 70, 55) + 9 * g2(x, z, -300, 150, 60) + 6 * fbm(x, z);
    return beach + (raise + (isle ? 0 : hill * smooth(4, 45, d))) * (1 - townMask(x, z));
  }

  // ---------- the road network: one definition for the roads you see and the routes cars take ----------
  // nodes: [x, z, road height]; edges: [from, to, width, kind, via points]. 'town' roads get pavements, 'bridge' a deck.
  const NODES = { A: [-210, 55, 3], B: [-60, 55, 3], C: [60, 55, 3], D: [190, 58, 3], E: [190, -30, 3], F: [190, -110, 3], G: [60, -110, 3], H: [-60, -110, 3], I: [-200, -96, 3],
    J: [-96, 92, 3], K: [224, 12, 3], X: [190, 12, 3],
    H2: [-60, -200, 3], G2: [60, -200, 3], F2: [190, -200, 3], I2: [-200, -200, 3], S1: [40, -265, 3], S2: [222, -265, 3], SP: [22, -318, 3], SQ: [234, -306, 3], FA: [-270, -282, 3], FB: [-395, -256, 3], FC: [-212, -386, 3],
    V1: [-290, 62, 'auto'], V2: [-390, 32, 'auto'], V3: [-488, 40, 'auto'], V4: [-540, 118, 'auto'], V5: [-478, 150, 'auto'], V6: [-400, 132, 'auto'], MQ: [-410, 166, 3], L: [252, -152, 7.4], M: [296, -167, 9], N: [460, -181, 9], O: [503, -180, 9], P: [546, -140, 9], Q: [588, -182, 9], R: [546, -226, 9] };
  const EDGES = [['A', 'B', 8, 'town', [[-135, 63]]], ['B', 'C', 8, 'town'], ['C', 'D', 8, 'town', [[125, 61]]], ['D', 'X', 9, 'town'], ['X', 'E', 9, 'town'], ['E', 'F', 9, 'town'], ['F', 'G', 8, 'town', [[125, -119]]], ['G', 'H', 8, 'town'],
    ['H', 'I', 8, 'town', [[-135, -105]]], ['I', 'A', 8, 'town', [[-226, -22]]], ['B', 'H', 7, 'town'], ['C', 'G', 7, 'town'], ['B', 'J', 7, 'town', [[-74, 80]]], ['X', 'K', 8, 'quay'],
    ['F', 'L', 8, 'road', [[226, -136]]], ['L', 'M', 8, 'road'], ['M', 'N', 9, 'bridge'], ['N', 'O', 8, 'road'], ['H', 'H2', 7, 'town'], ['G', 'G2', 7, 'town'], ['F', 'F2', 9, 'town'], ['I', 'I2', 8, 'town'], ['I2', 'H2', 8, 'town'], ['H2', 'G2', 8, 'town'], ['G2', 'F2', 8, 'town'],
    ['G2', 'S1', 8, 'town', [[48, -236]]], ['S1', 'S2', 9, 'town'], ['S2', 'F2', 8, 'town', [[214, -236]]], ['S1', 'SP', 7, 'town'], ['S2', 'SQ', 7, 'town'],
    ['I2', 'FA', 8, 'road', [[-236, -246]]], ['FA', 'FB', 7, 'farm', [[-335, -276]]], ['FA', 'FC', 7, 'farm', [[-246, -336]]],
    ['A', 'V1', 7, 'road', [[-250, 64]]], ['V1', 'V2', 7, 'road', [[-340, 52]]], ['V2', 'V3', 7, 'road', [[-440, 26]]], ['V3', 'V4', 7, 'road', [[-528, 74]]], ['V4', 'V5', 7, 'road', [[-515, 150]]], ['V5', 'V6', 7, 'road', [[-440, 146]]], ['V6', 'V1', 7, 'road', [[-345, 104]]], ['V6', 'MQ', 7, 'quay'],
    ['O', 'P', 7, 'road', [[520, -152]]], ['P', 'Q', 7, 'road', [[574, -154]]], ['Q', 'R', 7, 'road', [[578, -214]]], ['R', 'O', 7, 'road', [[516, -214]]]];
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
  EDGES.forEach(([a, b, w, kind, via], i) => {
    const A = nodes[a], B = nodes[b], c2 = catmull([[A.x, A.z], ...(via || []), [B.x, B.z]], 2), d2 = [0];
    for (let k = 1; k < c2.length; k++) d2.push(d2[k - 1] + Math.hypot(c2[k][0] - c2[k - 1][0], c2[k][1] - c2[k - 1][1])); // heights go by distance along the road, so slopes are even
    const pts = c2.map(([x, z], k) => { const t = d2[k] / (d2[d2.length - 1] || 1); return [x, kind === 'bridge' ? mix(A.y, B.y, t) + 2.6 * Math.sin(Math.PI * t) : mix(A.y, B.y, A.auto || B.auto ? t : smooth(0, 1, t)), z]; });
    const e = { id: i, a: A, b: B, w, kind, pts, closed: false }; e.cum = cumOf(pts); e.len = e.cum[e.cum.length - 1];
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
    const ln = makePath(cut(offsetLine(base, e.w / 4), trimAt(from), L - trimAt(to)), { kind: 'lane', e, dir, from, to, vmax: e.kind === 'bridge' || e.kind === 'road' ? 13 : e.kind === 'quay' ? 6 : e.kind === 'farm' ? 8 : 10 });
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
    const dist = {}, prev = {}, Q = new Set(Object.keys(nodes)); for (const k of Q) dist[k] = 1e12; dist[fromId] = 0;
    while (Q.size) { let u = null; for (const k of Q) if (u === null || dist[k] < dist[u]) u = k; Q.delete(u); if (u === toId || dist[u] >= 1e12) break;
      for (const e of nodes[u].edges) { if (e.closed) continue; const v = e.a.id === u ? e.b.id : e.a.id, nd = dist[u] + e.len; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; } } }
    if (dist[toId] >= 1e12) return null; const out = [toId]; while (out[0] !== fromId) out.unshift(prev[out[0]]); return out;
  }
  const laneBetween = (u, v) => nodes[u].out.find(l => l.to.id === v);

  // ---------- terrain height ----------
  // road segments in a grid, so the ground can settle under each road quickly
  const RSEG = [], RGRID = new Map();
  for (const e of edges) for (let i = 1; i < e.pts.length; i++) { const p = e.pts[i - 1], q = e.pts[i], s = { ax: p[0], ay: p[1], az: p[2], bx: q[0], by: q[1], bz: q[2], w: e.w, bridge: e.kind === 'bridge', t0: e.cum[i - 1] / e.len, t1: e.cum[i] / e.len };
    RSEG.push(s); for (let gx = Math.floor((Math.min(p[0], q[0]) - 30) / 20); gx <= Math.floor((Math.max(p[0], q[0]) + 30) / 20); gx++) for (let gz = Math.floor((Math.min(p[2], q[2]) - 30) / 20); gz <= Math.floor((Math.max(p[2], q[2]) + 30) / 20); gz++) { const k = gx + ',' + gz; if (!RGRID.has(k)) RGRID.set(k, []); RGRID.get(k).push(s); } }
  function nearRoad(x, z) { // distance to the nearest road edge, and that road's height there
    let best = 1e9, y = 0, bridge = false, tt = 0; for (const s of RGRID.get(Math.floor(x / 20) + ',' + Math.floor(z / 20)) || []) { const ex = s.bx - s.ax, ez = s.bz - s.az, t = clamp(((x - s.ax) * ex + (z - s.az) * ez) / (ex * ex + ez * ez || 1), 0, 1), d = Math.hypot(s.ax + t * ex - x, s.az + t * ez - z) - s.w / 2; if (d < best) { best = d; y = mix(s.ay, s.by, t); bridge = s.bridge; tt = mix(s.t0, s.t1, t); } }
    return [best, y, bridge, tt];
  }
  const PADS = []; // flat ground under buildings off the town terrace: [x, z, r, y]
  // villas: plots beside the villa roads, each levelled to the road's height
  const VILLAS = [];
  for (const e of edges) if (/^V/.test(e.a.id) && /^V/.test(e.b.id)) for (let s0 = 22; s0 < e.len - 22; s0 += 32) for (const sd of [1, -1]) {
    const i = e.cum.findIndex(c => c >= s0), p = e.pts[i], q = e.pts[Math.min(e.pts.length - 1, i + 1)], dx = q[0] - p[0], dz = q[2] - p[2], L = Math.hypot(dx, dz) || 1, nx = -dz / L * sd, nz = dx / L * sd, off = e.w / 2 + 3 + 8.5, x = p[0] + nx * off, z = p[2] + nz * off;
    if (land(x, z) < 16 || nearRoad(x, z)[0] < 11 || VILLAS.some(v => Math.hypot(v.x - x, v.z - z) < 30)) continue;
    VILLAS.push({ x, z, rot: Math.atan2(-nx, -nz), y: p[1] + 0.1 }); PADS.push([x, z, 12, p[1] + 0.1]);
  }
  function heightAt(x, z) {
    let h = natural(x, z);
    const [rd, ry, br] = nearRoad(x, z); if (!br) h = mix(h, ry - 0.05, 1 - smooth(1.5, 14, rd));
    for (const p of PADS) { const dd = Math.hypot(x - p[0], z - p[1]); if (dd < p[2] + 10) h = mix(h, p[3], 1 - smooth(p[2], p[2] + 10, dd)); }
    return h;
  }

  // ---------- the scene ----------
  let renderer, scene, camera, controls, sun, clock = 0, camDist = 400, Q = 'high';
  const tick = [], fadeMats = [], buildings = [], LABELS = [];
  const X0 = -660, X1 = 700, Z0 = -520, Z1 = 340;
  function init(canvas, q) {
    Q = q || 'high';
    renderer = new THREE.WebGLRenderer({ canvas, antialias: Q !== 'low', powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, Q === 'low' ? 1 : Q === 'medium' ? 1.5 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    // colour: the last build lit every surface at about 2.5x its own colour and then squeezed that through ACES, which
    // flattens and greys anything bright. Here the sun and sky add up to about 1x, and a linear curve keeps colours true:
    // measured on screen, grass #5cb447 shows as #58ac44 and terracotta #d9643a as #d27342 (World.colourReport()).
    renderer.toneMapping = THREE.LinearToneMapping; renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = Q !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    const HORIZON = lin(0xbfe3f7); scene.fog = new THREE.Fog(HORIZON, 900, 4000); scene.background = HORIZON;
    camera = new THREE.PerspectiveCamera(34, 1, 1, 5000);
    controls = new THREE.MapControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.1; controls.screenSpacePanning = false;
    controls.minDistance = 30; controls.maxDistance = 1500; controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.1;
    scene.add(new THREE.HemisphereLight(lin(0xd8ecff), lin(0x5d7a3a), 0.47));
    sun = new THREE.DirectionalLight(lin(0xfff3df), 1.02);
    sun.castShadow = Q !== 'low'; sun.shadow.mapSize.setScalar(Q === 'high' ? 2048 : 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5; sun.shadow.radius = 3;
    scene.add(sun, sun.target);
    World.times = {};
    for (const [k, f] of [['terrain', buildTerrain], ['ocean', buildOcean], ['roads', buildRoads], ['town', buildTown], ['nature', buildNature], ['traffic', buildTraffic]]) { const t0 = performance.now(); f(); World.times[k] = Math.round(performance.now() - t0); }
    resize(); addEventListener('resize', resize);
  }
  function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }

  // one ground mesh: sea floor, warm beaches, grass, forest on the hill, grey rock on the cliffs
  const COL = { sand: lin(0xf0cf86), wet: lin(0xd4ae6a), grass: lin(0x5cb447), grass2: lin(0x47a23c), grass3: lin(0x78c457), forest: lin(0x2f8a3a), rock: lin(0x8f8a84), rock2: lin(0x6f6c6a), floor: lin(0xc9b27a), lawn: lin(0x63bb4b) };
  function buildTerrain() {
    const S = 4, nx = Math.round((X1 - X0) / S) + 1, nz = Math.round((Z1 - Z0) / S) + 1, pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), H = new Float32Array(nx * nz), c = new THREE.Color(), D = new Float32Array(nx * nz), R = new Float32Array(nx * nz);
    const Qy = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = X0 + i * S, z = Z0 + j * S, k = j * nx + i; H[k] = heightAt(x, z); D[k] = land(x, z); R[k] = K.rock; Qy[k] = K.quay; pos.set([x, H[k], z], k * 3); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = X0 + i * S, z = Z0 + j * S, d = D[k], h = H[k];
      const sl = i > 0 && j > 0 && i < nx - 1 && j < nz - 1 ? Math.hypot(H[k + 1] - H[k - 1], H[k + nx] - H[k - nx]) / (2 * S) : 0;
      if (d < 0) c.copy(COL.floor);
      else {
        c.copy(COL.grass).lerp(COL.grass2, smooth(0.35, 0.75, fbm(x * 2, z * 2))).lerp(COL.grass3, smooth(0.6, 0.85, fbm(x * 1.3 - 70, z * 1.3)) * 0.6).lerp(COL.forest, smooth(0.55, 0.8, fbm(x * 0.7 + 50, z * 0.7)) * 0.3); // patches of lighter and deeper green if (h > 10) c.lerp(COL.forest, smooth(10, 26, h) * 0.8);
        const sandy = (1 - R[k]) * (1 - Qy[k]) * (1 - smooth(40, 52, d + fbm(x * 3, z * 3) * 8)); // beaches, with a soft, uneven edge into the grass
        if (sandy > 0) c.lerp(COL.sand, smooth(0.3, 0.7, sandy)).lerp(COL.wet, (1 - smooth(1, 6, d)) * sandy);
        const cliff = R[k] * (1 - smooth(10, 18, d)) + smooth(1.3, 2.2, sl) * 0.5; // rocky shores show grey cliffs; only very steep ground inland does
        if (cliff > 0) c.lerp(fbm(x * 5, z * 5) > 0.5 ? COL.rock : COL.rock2, clamp(cliff, 0, 0.92));
      }
      col.set([c.r, c.g, c.b], k * 3);
    }
    const idx = []; for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; if (H[a] < -9 && H[b] < -9 && H[d] < -9 && H[e] < -9) continue; idx.push(a, d, b, b, d, e); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); m.receiveShadow = true; scene.add(m);
  }
  function buildOcean() { // turquoise shallows, a foam line, deeper blue further out
    const N = 256, EX0 = -1100, EZ0 = -1000, EW = 2200, data = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) data[j * N + i] = clamp(Math.round(-land(EX0 + (i + 0.5) / N * EW, EZ0 + (j + 0.5) / N * EW) / 240 * 255), 0, 255);
    const tex = new THREE.DataTexture(data, N, N, THREE.LuminanceFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({ fog: true,
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { sd: { value: tex }, O: { value: new THREE.Vector3(EX0, EZ0, EW) }, t: { value: 0 },
        deep: { value: lin(0x0f5fb8) }, mid: { value: lin(0x1693d8) }, shallow: { value: lin(0x22c9cf) }, edge: { value: lin(0x7fe8dc) }, foam: { value: lin(0xffffff) } }),
      vertexShader: 'varying vec2 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: `uniform sampler2D sd; uniform vec3 O; uniform float t; uniform vec3 deep, mid, shallow, edge, foam; varying vec2 vW;
        #include <fog_pars_fragment>
        void main(){
          vec2 uv = (vW - O.xy) / O.z; float d = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 240.0 : texture2D(sd, uv).r * 240.0;
          float w = sin(vW.x * 0.05 + t * 0.9) * sin(vW.y * 0.055 - t * 0.7) + sin((vW.x + vW.y) * 0.12 + t * 1.5) * 0.5;
          vec3 c = mix(edge, shallow, smoothstep(2.0, 16.0, d)); c = mix(c, mid, smoothstep(16.0, 70.0, d)); c = mix(c, deep, smoothstep(70.0, 200.0, d));
          c *= 1.0 + w * 0.025 * (1.0 - smoothstep(60.0, 200.0, d));
          float f = (1.0 - smoothstep(0.0, 4.5, d + w * 1.2)) * (0.6 + 0.4 * sin(t * 1.4 + vW.x * 0.08 + vW.y * 0.06));
          gl_FragColor = vec4(mix(c, foam, clamp(f, 0.0, 1.0) * 0.85), 1.0);
          #include <fog_fragment>
        }` });
    mat.polygonOffset = true; mat.polygonOffsetFactor = 2; mat.polygonOffsetUnits = 4;
    const o = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2), mat); scene.add(o);
    tick.push(dt => { mat.uniforms.t.value += dt; });
  }

  // ---------- merged geometry: buckets by material, typed arrays ----------
  class Buf { constructor() { this.a = new Float32Array(6144); this.n = 0; } room(k) { if (this.n + k > this.a.length) { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; } } p3(x, y, z) { this.room(3); this.a[this.n++] = x; this.a[this.n++] = y; this.a[this.n++] = z; } p2(x, y) { this.room(2); this.a[this.n++] = x; this.a[this.n++] = y; } }
  const parts = new Map(); let tileKey = '0';
  const tileAt = (x, z) => { tileKey = Math.floor(x / 200) + ',' + Math.floor(z / 200); };
  const part = k => { const key = k + '|' + tileKey; let P = parts.get(key); if (!P) parts.set(key, P = { k, pos: new Buf(), nor: new Buf(), uv: new Buf(), col: new Buf() }); return P; };
  const NI = new WeakMap(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3(), tmp = new THREE.Object3D(), _m4 = new THREE.Matrix4();
  function addGeo(k, geo, mtx, color) {
    let g = NI.get(geo); if (!g) { g = geo.index ? geo.toNonIndexed() : geo; if (!g.attributes.normal) g.computeVertexNormals(); NI.set(geo, g); }
    const P = part(k), p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv ? g.attributes.uv.array : null; _nm.getNormalMatrix(mtx);
    for (let i = 0, N = p.length / 3; i < N; i++) { _v.set(p[3 * i], p[3 * i + 1], p[3 * i + 2]).applyMatrix4(mtx); P.pos.p3(_v.x, _v.y, _v.z); _n.set(n[3 * i], n[3 * i + 1], n[3 * i + 2]).applyMatrix3(_nm).normalize(); P.nor.p3(_n.x, _n.y, _n.z); P.uv.p2(u ? u[2 * i] : 0, u ? u[2 * i + 1] : 0); P.col.p3(color.r, color.g, color.b); }
  }
  function walls(k, M, w, d, y0, y1, color, bay = 3.2, floor = 3.2) { // facade texture tiles in bays and floors; the foot of the wall is shaded to sit it on the ground
    const P = part(k), nm = new THREE.Matrix3().getNormalMatrix(M), foot = color.clone().multiplyScalar(y0 < 1.5 ? 0.7 : 0.9);
    for (const [a, b, n] of [[[-w / 2, d / 2], [w / 2, d / 2], [0, 1]], [[w / 2, d / 2], [w / 2, -d / 2], [1, 0]], [[w / 2, -d / 2], [-w / 2, -d / 2], [0, -1]], [[-w / 2, -d / 2], [-w / 2, d / 2], [-1, 0]]]) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), bays = Math.max(1, Math.round(L / bay)), fl = (y1 - y0) / floor, q = [[a[0], y0, a[1], 0, 0], [b[0], y0, b[1], bays, 0], [b[0], y1, b[1], bays, fl], [a[0], y1, a[1], 0, fl]], nn = new THREE.Vector3(n[0], 0, n[1]).applyMatrix3(nm).normalize();
      for (const i of [0, 1, 2, 0, 2, 3]) { _v.set(q[i][0], q[i][1], q[i][2]).applyMatrix4(M); P.pos.p3(_v.x, _v.y, _v.z); P.nor.p3(nn.x, nn.y, nn.z); P.uv.p2(q[i][3], q[i][4]); const c = i < 2 ? foot : color; P.col.p3(c.r, c.g, c.b); }
    }
  }
  const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 20), CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8), PLANE_X = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), SPH = new THREE.SphereGeometry(1, 12, 8);
  function geoAt(k, geo, M, x, y, z, color, ry = 0, sx = 1, sy = 1, sz = 1) { tmp.position.set(x, y, z); tmp.rotation.set(0, ry, 0); tmp.scale.set(sx, sy, sz); tmp.updateMatrix(); addGeo(k, geo, _m4.multiplyMatrices(M, tmp.matrix), color); }
  const boxAt = (k, M, w, h, d, x, y, z, color, ry = 0) => geoAt(k, BOX, M, x, y + h / 2, z, color, ry, w, h, d);
  function frameAt(k, M, w, d, h, t, x, z, color, y = 0) { boxAt(k, M, w, h, t, x, y, z - d / 2 + t / 2, color); boxAt(k, M, w, h, t, x, y, z + d / 2 - t / 2, color); boxAt(k, M, t, h, d - 2 * t, x - w / 2 + t / 2, y, z, color); boxAt(k, M, t, h, d - 2 * t, x + w / 2 - t / 2, y, z, color); }
  function roofGeo(k, M, pos, color) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2)); addGeo(k, g, M, color); }
  const ROT90 = new THREE.Matrix4().makeRotationY(Math.PI / 2), rotY = M => M.clone().multiply(ROT90);
  const mul = (M, x, y, z, ry = 0) => M.clone().multiply(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
  function hip(k, M, w, d, y, rise, color, over = 0.6) {
    if (w < d) { hip(k, rotY(M), d, w, y, rise, color, over); return; }
    const hw = w / 2 + over, hd = d / 2 + over, r = Math.max(0, hw - hd), A = [-hw, y, -hd], B = [hw, y, -hd], Cc = [hw, y, hd], D = [-hw, y, hd], R0 = [-r, y + rise, 0], R1 = [r, y + rise, 0], pos = [];
    for (const t of [[A, R0, B], [B, R0, R1], [D, Cc, R1], [D, R1, R0], [A, D, R0], [B, R1, Cc]]) for (const p of t) pos.push(...p);
    roofGeo(k, M, pos, color); boxAt('trim', M, w + over * 2, 0.35, d + over * 2, 0, y - 0.35, 0, C(0xf5efe3)); // white eaves under the roof
  }
  function gable(k, M, w, d, y, rise, color, over = 0.5) {
    const hw = w / 2 + over, hd = d / 2 + over, P = [[-hw, y, -hd], [hw, y, -hd], [hw, y + rise, 0], [-hw, y + rise, 0], [-hw, y, hd], [hw, y, hd]], pos = [];
    for (const t of [[0, 3, 1], [1, 3, 2], [4, 5, 3], [5, 2, 3], [0, 4, 3], [1, 2, 5]]) for (const i of t) pos.push(...P[i]);
    roofGeo(k, M, pos, color);
  }
  function sign(M, i, w, h, x, y, z, ry = 0) { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, u0 = (i % 4) / 4, u1 = u0 + 0.25, v1 = 1 - Math.floor(i / 4) / 8, v0 = v1 - 0.125; uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); geoAt('sign', g, M, x, y, z, WHITE, ry); }
  function canvasTex(w, h, draw, repeat) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
  const C = c => lin(c), WHITE = new THREE.Color(1, 1, 1);
  const tex = {};
  const SIGNS = ['BAKERY', 'CAFÉ', 'GROCER', 'PHARMACY', 'FLOWERS', 'LIBRARY', 'HARBOUR', 'HOTEL AZURE', 'SEAFOOD', 'BEACH BAR', 'PROCESSING', 'BUS', 'TIMBER', 'MARKET', 'ICE CREAM', 'DEPOT',
    'STADIUM', 'CAPITAL BANK', 'CITY HALL', 'MARINA', 'FARM CO-OP', 'EXCHANGE', 'OFFICES', 'YACHT CLUB', 'GATE A', 'GATE B', 'TICKETS', 'PARKING', 'FRESH FOOD', 'CAPITAL LIFE', 'HOTEL', 'FARM SHOP'];
  const SIGNC = ['#c0392b', '#7a4e2d', '#27ae60', '#16a085', '#d6458b', '#2e5aa8', '#1f3f8f', '#0f6fb8', '#e67e22', '#ff8a3d', '#5a6270', '#f2b705', '#7a4e2d', '#27ae60', '#ff6f91', '#34495e',
    '#c0392b', '#1f3f8f', '#2e5aa8', '#0f6fb8', '#2f8f3a', '#7a4e2d', '#34495e', '#0f6fb8', '#1f5fbf', '#d8392b', '#f2a900', '#2e74c9', '#27ae60', '#8e44ad', '#0f6fb8', '#2f8f3a'];
  function textures() {
    const T = draw => canvasTex(128, 128, draw, true), glass = (g, y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#9fd3f5'); gr.addColorStop(0.5, '#3f86c4'); gr.addColorStop(1, '#1f4f86'); return gr; };
    tex.flat = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e9e1d2'; g.fillRect(0, 120, 128, 8); g.fillStyle = '#8c8c8c'; g.fillRect(22, 26, 12, 62); g.fillRect(94, 26, 12, 62); g.fillStyle = '#fff'; g.fillRect(36, 24, 56, 68); g.fillStyle = glass(g, 28, 88); g.fillRect(41, 29, 46, 58); g.fillStyle = '#fff'; g.fillRect(62, 29, 4, 58); g.fillStyle = '#d2c7b2'; g.fillRect(32, 92, 64, 7); });
    tex.hotel = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = glass(g, 14, 104); g.fillRect(10, 14, 108, 90); g.fillStyle = '#fff'; g.fillRect(62, 14, 4, 90); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(14, 18, 26, 82); g.fillStyle = '#e8eef2'; g.fillRect(0, 104, 128, 24); });
    tex.shop = T(g => { g.fillStyle = '#f3ead9'; g.fillRect(0, 0, 128, 128); const gr = g.createLinearGradient(0, 26, 0, 128); gr.addColorStop(0, '#a6d2ee'); gr.addColorStop(1, '#2c5079'); g.fillStyle = gr; g.fillRect(10, 26, 108, 102); g.fillStyle = '#f3ead9'; g.fillRect(62, 26, 4, 102); g.fillStyle = '#ffd98a'; g.globalAlpha = 0.45; g.fillRect(10, 96, 108, 32); g.globalAlpha = 1; });
    tex.office = T(g => { g.fillStyle = '#f2f4f6'; g.fillRect(0, 0, 128, 128); g.fillStyle = glass(g, 18, 108); g.fillRect(6, 18, 116, 88); g.fillStyle = '#e4eaef'; g.fillRect(62, 18, 4, 88); });
    tex.shed = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#dcdcdc'; for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 3, 128); g.fillStyle = '#35587e'; g.fillRect(16, 12, 96, 16); });
    tex.brick = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e2d5cb'; for (let y = 0; y < 128; y += 8) { g.fillRect(0, y, 128, 1); for (let x = (y / 8) % 2 * 8; x < 128; x += 16) g.fillRect(x, y, 1, 8); } g.fillStyle = '#35587e'; g.fillRect(34, 22, 60, 70); g.fillStyle = '#fff'; g.fillRect(62, 22, 4, 70); });
    tex.signs = canvasTex(1024, 512, g => { for (let i = 0; i < 32; i++) { const x = (i % 4) * 256, y = Math.floor(i / 4) * 64; g.fillStyle = '#fff'; g.fillRect(x, y, 256, 64); g.fillStyle = SIGNC[i]; g.fillRect(x + 4, y + 4, 248, 56); g.fillStyle = '#fff'; g.font = `900 ${SIGNS[i].length > 9 ? 30 : 38}px 'Arial Black', Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(SIGNS[i], x + 128, y + 34); } });
    tex.road = canvasTex(64, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(3, 0, 3, h); g.fillRect(w - 6, 0, 3, h); g.fillStyle = '#ffd34a'; g.fillRect(w / 2 - 1.5, 30, 3, 120); }, true);
    tex.pitch = canvasTex(256, 128, g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#4fa63e' : '#5ab548'; g.fillRect(i * 32, 0, 32, 128); } g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(8, 8, 240, 112); });
  }
  let MATS = null;
  function mats() {
    if (MATS) return MATS;
    const S = o => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85 }, o));
    MATS = { flat: S({ map: tex.flat }), hotel: S({ map: tex.hotel, roughness: 0.45 }), shop: S({ map: tex.shop, roughness: 0.55 }), office: S({ map: tex.office, roughness: 0.4, metalness: 0.15 }), shed: S({ map: tex.shed }), brick: S({ map: tex.brick, roughness: 0.9 }),
      roof: S({ roughness: 0.75, flatShading: true }), trim: S({ roughness: 0.75 }), trim2: S({ roughness: 0.75, side: THREE.DoubleSide }), lawn: S({ roughness: 1 }), metal: S({ roughness: 0.4, metalness: 0.5 }),
      water: S({ roughness: 0.05, metalness: 0.1 }), glow: new THREE.MeshBasicMaterial({ vertexColors: true }), sign: new THREE.MeshBasicMaterial({ map: tex.signs, vertexColors: true }), glassy: S({ transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }),
      pitch: S({ map: tex.pitch, roughness: 1, vertexColors: false }), detail: S({ roughness: 0.7, transparent: true }) };
    fadeMats.push([MATS.detail, 420, 700]);
    return MATS;
  }
  const NOSHADOW = { lawn: 1, water: 1, sign: 1, glow: 1, glassy: 1 };
  function flush() { const M = mats(); for (const P of parts.values()) { if (!P.pos.n) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P.pos.a.slice(0, P.pos.n), 3)); g.setAttribute('normal', new THREE.BufferAttribute(P.nor.a.slice(0, P.nor.n), 3)); g.setAttribute('uv', new THREE.BufferAttribute(P.uv.a.slice(0, P.uv.n), 2)); g.setAttribute('color', new THREE.BufferAttribute(P.col.a.slice(0, P.col.n), 3)); g.computeBoundingSphere(); const m = new THREE.Mesh(g, M[P.k]); m.castShadow = !NOSHADOW[P.k]; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); } parts.clear(); }

  // ---------- roads, built from the network ----------
  function ribbon(arr, pts, wl, wr, lift) { // triangles for a strip along a polyline, from wl left to wr right of it; u across, v along (metres)
    const c = cumOf(pts);
    for (let i = 0; i < pts.length - 1; i++) {
      const q = [i, i + 1].map(k => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, p = pts[k]; return [[p[0] - nx * wl, p[1] + lift, p[2] - nz * wl, 0, c[k]], [p[0] + nx * wr, p[1] + lift, p[2] + nz * wr, 1, c[k]]]; });
      arr.push(q[0][0], q[0][1], q[1][0], q[1][0], q[0][1], q[1][1]);
    }
  }
  function disc(arr, x, y, z, r, lift, n = 28) { for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; arr.push([x, y + lift, z, 0.5, 0], [x + Math.cos(a0) * r, y + lift, z + Math.sin(a0) * r, 0, 0], [x + Math.cos(a1) * r, y + lift, z + Math.sin(a1) * r, 1, 0]); } }
  function triMesh(arr, mat, uvScale = 1) {
    const pos = [], uv = []; for (const v of arr) { pos.push(v[0], v[1], v[2]); uv.push(v[3], v[4] / uvScale); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    mat.side = THREE.DoubleSide; const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
  }
  const off = (m, f) => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f * 2; return m; };
  function buildRoads() {
    textures();
    const asph = [], pave = [], marks = [], curbs = [];
    for (const e of edges) {
      if (e.kind !== 'bridge') ribbon(asph, e.pts, e.w / 2, e.w / 2, 0.14);
      if (e.kind === 'town' || e.kind === 'quay') ribbon(pave, e.pts, e.w / 2 + 2.6, e.w / 2 + 2.6, 0.1);
      const s0 = e.a.deg >= 3 ? e.a.r + 1 : e.a.deg === 1 ? e.a.r : 0, s1 = e.len - (e.b.deg >= 3 ? e.b.r + 1 : e.b.deg === 1 ? e.b.r : 0);
      if (s1 - s0 > 4) ribbon(marks, cut(e.pts, s0, s1), e.w / 2 - 0.2, e.w / 2 - 0.2, 0.16);
    }
    for (const id in nodes) { const N = nodes[id]; if (N.deg === 2 && N.edges.every(e => e.kind !== 'bridge')) disc(asph, N.x, N.y, N.z, Math.max(...N.edges.map(e => e.w)) / 2, 0.14); if (N.r) { disc(asph, N.x, N.y, N.z, N.r, 0.14); if (N.edges.some(e => e.kind === 'town' || e.kind === 'quay')) disc(pave, N.x, N.y, N.z, N.r + 2.6, 0.1); } }
    triMesh(pave, off(new THREE.MeshStandardMaterial({ color: lin(0xd9d3c6), roughness: 0.9 }), -1));
    triMesh(asph, off(new THREE.MeshStandardMaterial({ color: lin(0x474c55), roughness: 0.85 }), -2));
    const mk = triMesh(marks, off(new THREE.MeshStandardMaterial({ map: tex.road, transparent: true, roughness: 0.8, depthWrite: false }), -3), 16); mk.renderOrder = 2;
    void curbs;
    buildBridge(edges.find(e => e.kind === 'bridge'));
  }
  function buildBridge(e) { // a finished bridge: deck, parapets, piers on footings, arches between them, lamps; approaches meet the road
    const M = new THREE.Matrix4(), deck = [], pts = e.pts;
    ribbon(deck, pts, e.w / 2, e.w / 2, 0.14); triMesh(deck, off(new THREE.MeshStandardMaterial({ color: lin(0x474c55), roughness: 0.85 }), -2));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2, nx = -dz / L, nz = dx / L;
      boxAt('trim', M, e.w + 2.4, 1.3, L + 0.05, mx, my - 1.2, mz, C(0xe6e0d4), ry); // deck slab
      for (const s of [-1, 1]) boxAt('trim', M, 0.5, 1.1, L + 0.05, mx + nx * s * (e.w / 2 + 0.7), my + 0.1, mz + nz * s * (e.w / 2 + 0.7), C(0xf3efe7), ry); // parapets
    }
    const span = 31, n = Math.floor(e.len / span);
    for (let k = 1; k < n + 1; k++) {
      const s = k * e.len / (n + 1), i = e.cum.findIndex(c => c >= s), p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], ry = Math.atan2(q[0] - p[0], q[2] - p[2]);
      boxAt('trim', M, e.w + 1, p[1] + 7.8, 3, p[0], -9, p[2], C(0xd8d1c3), ry); boxAt('trim', M, e.w + 3, 1.5, 4.5, p[0], -0.6, p[2], C(0xbdb5a5), ry); // pier and its footing at the waterline
      for (const sd of [-1, 1]) { const nx = Math.cos(ry) * sd * (e.w / 2 + 0.7), nz = -Math.sin(ry) * sd * (e.w / 2 + 0.7); boxAt('trim', M, 0.22, 4.2, 0.22, p[0] + nx, p[1] + 0.6, p[2] + nz, C(0x2b3440)); boxAt('glow', M, 0.6, 0.35, 0.9, p[0] + nx * 0.85, p[1] + 4.7, p[2] + nz * 0.85, C(0xfff2c0), ry); }
    }
    barrier = new THREE.Group(); barrier.visible = false; scene.add(barrier); // shown when the bridge is closed
    for (const p of [pts[3], pts[pts.length - 4]]) for (let k = 0; k < 4; k++) { const o = new THREE.Mesh(new THREE.BoxGeometry(e.w / 4, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: lin(k % 2 ? 0xffffff : 0xd8392b) })); const ry = Math.atan2(pts[4][0] - pts[2][0], pts[4][2] - pts[2][2]); o.position.set(p[0] + Math.cos(ry) * (k - 1.5) * e.w / 4, p[1] + 0.9, p[2] - Math.sin(ry) * (k - 1.5) * e.w / 4); o.rotation.y = ry; barrier.add(o); }
    for (let k = 0; k <= n; k++) { // a shallow arch under each span
      const s0 = k * e.len / (n + 1), s1 = (k + 1) * e.len / (n + 1);
      for (let j = 0; j < 8; j++) { const sa = mix(s0, s1, j / 8), sb = mix(s0, s1, (j + 1) / 8), at = s => { const i = Math.max(1, e.cum.findIndex(c => c >= s)); const t = (s - e.cum[i - 1]) / (e.cum[i] - e.cum[i - 1]); return pts[i - 1].map((v, m) => v + (pts[i][m] - v) * t); }, A = at(sa), B = at(sb), drop = u => 5 * (1 - Math.sin(Math.PI * u));
        const ya = A[1] - 2 - drop(j / 8), yb = B[1] - 2 - drop((j + 1) / 8), L = Math.hypot(B[0] - A[0], B[2] - A[2]); tmp.position.set((A[0] + B[0]) / 2, (ya + yb) / 2, (A[2] + B[2]) / 2); tmp.rotation.set(0, Math.atan2(B[0] - A[0], B[2] - A[2]), 0); tmp.rotateX(-Math.atan2(yb - ya, L)); tmp.scale.set(e.w - 1, 0.9, L + 0.3); tmp.updateMatrix(); addGeo('trim', BOX, tmp.matrix, C(0xd8d1c3)); }
    }
  }

  // ---------- buildings: hand-placed for the sample ----------
  const WALL = { cream: 0xfff1d6, peach: 0xffd8bd, white: 0xffffff, yellow: 0xffe6a1, pink: 0xf9cfc4, sky: 0xd6ecff, sand: 0xf4dfb8 }, TERRA = [0xd9643a, 0xc9512f, 0xe07a45, 0xb84a2c], AWN = [0xe8483f, 0x1f8f5b, 0x2e74c9, 0xf2a531, 0xd6458b];
  function addBuilding(b) {
    tileAt(b.x, b.z); const y = b.y != null ? b.y : TOWN_Y, M = new THREE.Matrix4().makeRotationY(b.rot).setPosition(b.x, y, b.z), f = DRAW[b.type];
    if (b.scale) M.multiply(new THREE.Matrix4().makeScale(b.scale, b.scale, b.scale));
    b.h = f(b, M, b.w, b.d) * (b.scale || 1); b.y = y; buildings.push(b); return b;
  }
  const DRAW = {
    flat(b, M, w, d) { // a modest apartment block: plinth, shutters, balconies on the street side, terracotta hip roof
      const fl = b.floors || 3, h = 0.7 + fl * 3.1, wc = C(b.color || WALL.cream);
      boxAt('trim', M, w + 0.3, 0.7, d + 0.3, 0, 0, 0, C(0xd8cdb8)); walls('flat', M, w, d, 0.7, h, wc, 3.1, 3.1);
      hip('roof', M, w, d, h + 0.35, Math.min(w, d) * 0.32, C(b.roof || pick(TERRA)));
      boxAt('trim', M, 1.6, 2.5, 0.35, 0, 0.7, d / 2 + 0.17, C(0x5a3a28)); boxAt('detail', M, 2.6, 0.18, 1.2, 0, 3.3, d / 2 + 0.6, C(pick([0x2e74c9, 0x1f8f5b, 0xb5443a])));
      const n = Math.max(1, Math.round(w / 3.1)), bw = w / n;
      for (let f = 1; f < fl; f++) for (let i = 0; i < n; i++) if ((i + f) % 2 === 0 && Math.abs(-w / 2 + (i + 0.5) * bw) > 1.5) { const x = -w / 2 + (i + 0.5) * bw, yy = 0.7 + f * 3.1; boxAt('trim', M, bw * 0.8, 0.18, 1.1, x, yy - 0.1, d / 2 + 0.55, C(0xf4efe4)); boxAt('trim', M, bw * 0.8, 0.85, 0.08, x, yy + 0.08, d / 2 + 1.06, C(0x3a4150)); }
      boxAt('detail', M, 0.9, 2.2, 0.9, w * 0.3, h + 0.6, -d * 0.15, C(0xa45a46));
      return h + Math.min(w, d) * 0.32 + 0.5;
    },
    shophouse(b, M, w, d) { // a shop on the ground floor, two flats above, an awning and a painted sign
      const fl = b.floors || 3, h = 4 + (fl - 1) * 3.1, wc = C(b.color || WALL.cream);
      walls('shop', M, w, d, 0, 4, C(0xffffff), w / Math.max(1, Math.round(w / 5)), 4); walls('flat', M, w, d, 4, h, wc, 3.1, 3.1);
      boxAt('trim', M, w + 0.4, 0.4, d + 0.4, 0, 3.9, 0, C(0xf5efe3)); hip('roof', M, w, d, h + 0.35, Math.min(w, d) * 0.3, C(b.roof || pick(TERRA)));
      const ac = C(b.awn || pick(AWN)); boxAt('detail', M, w - 1.2, 0.2, 2, 0, 3.3, d / 2 + 1, ac); boxAt('detail', M, w - 1.2, 0.45, 0.08, 0, 3.05, d / 2 + 1.98, C(0xffffff));
      sign(M, b.sign, Math.min(w * 0.7, 9), 1.15, 0, 4.6, d / 2 + 0.06);
      for (let i = 0; i < 2; i++) { geoAt('trim', CYL8, M, -w * 0.25 + i * w * 0.5, 0.55, d / 2 + 2.6, C(0xffffff), 0, 0.5, 0.06, 0.5); geoAt('trim', CYL8, M, -w * 0.25 + i * w * 0.5, 0.27, d / 2 + 2.6, C(0x3a4150), 0, 0.06, 0.55, 0.06); } // café tables
      return h + Math.min(w, d) * 0.3 + 0.5;
    },
    hotel(b, M, w, d) { // Hotel Azure: white terraces of balconies facing the sea, a blue canopy, a roof terrace with a bar
      const fl = b.floors, h = 4.5 + (fl - 1) * 3.2;
      walls('shop', M, w, d, 0, 4.5, C(0xffffff), 5, 4.5); walls('hotel', M, w, d, 4.5, h, C(0xffffff), 3.6, 3.2);
      boxAt('trim', M, w + 0.8, 0.6, d + 0.8, 0, h, 0, C(0xf2ede4)); boxAt('roof', M, w - 0.4, 0.12, d - 0.4, 0, h + 0.6, 0, C(0xcfd6dc));
      const n = Math.round(w / 3.6), bw = w / n;
      for (let f = 1; f < fl; f++) { const yy = 4.5 + (f - 1) * 3.2; boxAt('trim', M, w + 0.2, 0.22, 2, 0, yy - 0.1, d / 2 + 1, C(0xffffff)); boxAt('glassy', M, w, 0.95, 0.08, 0, yy + 0.12, d / 2 + 1.96, C(0x9fdcff)); for (let i = 0; i <= n; i++) boxAt('trim', M, 0.25, 3.1, 1.9, -w / 2 + i * bw, yy, d / 2 + 1, C(0xffffff)); }
      if (b.top) { boxAt('trim', M, w * 0.3, 3, d * 0.5, -w * 0.25, h + 0.6, -d * 0.1, C(0xffffff)); boxAt('roof', M, w * 0.34, 0.3, d * 0.56, -w * 0.25, h + 3.6, -d * 0.1, C(0xd9643a)); for (let i = 0; i < 4; i++) geoAt('detail', new THREE.ConeGeometry(1.6, 0.8, 8), M, w * 0.05 + i * 4, h + 3, d * 0.2, C(pick([0xffffff, 0x0f6fb8])), 0); sign(M, 7, 11, 2.2, w * 0.15, h + 2.2, d / 2 - 0.2); }
      return h + (b.top ? 4.2 : 1);
    },
    office(b, M, w, d) { // the harbour office: glass and white bands, a flagpole
      const fl = b.floors || 3, h = 4.5 + (fl - 1) * 3.4;
      walls('shop', M, w, d, 0, 4.5, C(0xffffff), 5, 4.5); walls('office', M, w, d, 4.5, h, C(b.color || 0xe0f0ff), 4, 3.4);
      boxAt('trim', M, w + 0.6, 0.7, d + 0.6, 0, h, 0, C(0xf2f4f6)); boxAt('roof', M, w - 0.4, 0.12, d - 0.4, 0, h + 0.7, 0, C(0x5b7fa8));
      boxAt('detail', M, 7, 0.35, 2.4, 0, 3.6, d / 2 + 1.2, C(0x1f3f8f)); sign(M, b.sign, 8, 1.2, 0, 4.9, d / 2 + 0.06);
      boxAt('trim', M, 0.15, 7, 0.15, w / 2 - 1, h + 0.7, d / 2 - 1, C(0xffffff)); boxAt('glow', M, 1.6, 1, 0.06, w / 2 - 0.2, h + 6.4, d / 2 - 1, C(0x0f6fb8));
      return h + 7.5;
    },
    civic(b, M, w, d) { // the library: stone, columns at the door, a small dome
      const h = 9, st = C(0xf4ead6);
      walls('brick', M, w, d, 0, h, st, 4.2, 4.5); boxAt('trim', M, w + 0.8, 0.8, d + 0.8, 0, h, 0, C(0xfaf5ea)); boxAt('roof', M, w - 0.2, 0.1, d - 0.2, 0, h + 0.8, 0, C(0x8a96a2));
      for (let i = 0; i < 4; i++) geoAt('trim', CYL, M, -4.5 + i * 3, 3.6, d / 2 + 2.2, st, 0, 0.45, 7.2, 0.45); boxAt('trim', M, 12, 0.8, 4, 0, 7.2, d / 2 + 2, C(0xfaf5ea)); gable('trim', rotY(mul(M, 0, 0, d / 2 + 2)), 4, 12, 8, 2.2, C(0xfaf5ea), 0.2);
      if (b.dome !== false) geoAt('roof', new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M, 0, h + 0.8, -d * 0.1, C(0x5fb3a0)); sign(M, b.sign != null ? b.sign : 5, 7, 1, 0, 8.3, d / 2 + 4.05);
      return h + 5;
    },
    warehouse(b, M, w, d) { // corrugated sides, roller doors, a blue curved roof, a loading dock
      const h = 9; walls('shed', M, w, d, 0, h, C(b.color || 0xe7ebee), 3.2, 9);
      geoAt('roof', new THREE.CylinderGeometry(d / 2, d / 2, w, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), M, 0, h, 0, C(b.roof || 0x2e6fbf), 0, 1, 0.32, 1);
      for (let i = -1; i <= 1; i++) { boxAt('trim', M, 5, 5.4, 0.3, i * w * 0.28, 0, d / 2 + 0.15, C(0x9aa6b0)); boxAt('detail', M, 5.6, 0.3, 2.2, i * w * 0.28, 5.6, d / 2 + 1.1, C(0x3a4150)); }
      boxAt('trim', M, w * 0.9, 1.1, 2.2, 0, 0, d / 2 + 1.1, C(0xbab4a8)); if (b.sign != null) sign(M, b.sign, 8, 1.4, 0, 7.4, d / 2 + 0.05);
      return h + d * 0.16;
    },
    plant(b, M, w, d) { // the processing plant on Industrial Isle: a long hall, chimneys, tanks, pipes
      const h = 12; walls('brick', M, w, d, 0, h, C(0xb9b2a8), 5, 12); boxAt('trim', M, w + 0.6, 0.6, d + 0.6, 0, h, 0, C(0x8a9097)); boxAt('roof', M, w - 0.2, 0.1, d - 0.2, 0, h + 0.6, 0, C(0x5c6670));
      for (const [x, z] of [[w * 0.3, -d * 0.25], [w * 0.42, -d * 0.25]]) for (let s = 0; s < 6; s++) geoAt('trim', CYL, M, x, h + 2.5 + s * 5, z, C(s % 2 ? 0xffffff : 0xd8392b), 0, 1.5 - s * 0.08, 5, 1.5 - s * 0.08);
      for (let i = 0; i < 3; i++) { geoAt('metal', CYL, M, -w / 2 - 4.5, 5, -d / 2 + 5 + i * 8, C(0xe9edf0), 0, 3.2, 10, 3.2); geoAt('metal', new THREE.SphereGeometry(3.2, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), M, -w / 2 - 4.5, 10, -d / 2 + 5 + i * 8, C(0xe9edf0)); }
      boxAt('trim', M, 6, 6, 0.3, 0, 0, d / 2 + 0.15, C(0x8c96a0)); sign(M, 10, 10, 1.6, 0, 8, d / 2 + 0.05); boxAt('trim', M, 1, 1, w * 0.7, -w / 2 - 2, 9, 0, C(0x9aa3ab), Math.PI / 2);
      return h + 30;
    },
    house(b, M, w, d) { // a small family house: two floors, a hipped terracotta roof, a garden with a hedge behind
      const h = 0.5 + 2 * 3, wc = C(b.color);
      boxAt('lawn', M, w + 3, 0.1, d + 7, 0, 0, -2, C(pick([0x5cb447, 0x63bb4b, 0x55ad42])));
      boxAt('trim', M, w + 3, 1.1, 0.6, 0, 0, -d / 2 - 5.2, C(0x3f8f3a)); for (const sx of [-1, 1]) boxAt('trim', M, 0.6, 1.1, 6, sx * (w / 2 + 1.2), 0, -d / 2 - 2.5, C(0x3f8f3a));
      boxAt('trim', M, w + 0.3, 0.5, d + 0.3, 0, 0, 0, C(0xd8cdb8)); walls('flat', M, w, d, 0.5, h, wc, 3.1, 3);
      hip('roof', M, w, d, h + 0.35, Math.min(w, d) * 0.38, C(b.roof));
      boxAt('trim', M, 1.2, 2.2, 0.3, -w * 0.2, 0.5, d / 2 + 0.15, C(pick([0x6b4a33, 0x2e5a8a, 0x2f7a55]))); boxAt('detail', M, 0.8, 2, 0.8, w * 0.28, h + 1, -d * 0.15, C(0xa45a46));
      if (rnd() < 0.5) boxAt('detail', M, 2, 0.3, 0.45, w * 0.22, 3.5, d / 2 + 0.22, C(pick([0xff6f91, 0xffd21f, 0xe8483f])));
      return h + Math.min(w, d) * 0.38 + 0.4;
    },
    tower(b, M, w, d) { // offices: glass or banded, square, set back or round, plant or a garden on the roof
      const fl = b.floors, st = b.style || 0, wc = C(b.color || 0xe0f0ff), h0 = 4.5; let h = h0 + fl * 3.4, wt = w, dt = d;
      walls('shop', M, w, d, 0, h0, C(0xffffff), 5, h0);
      if (st === 2) { const r = Math.min(w, d) / 2, g = new THREE.CylinderGeometry(r, r, h - h0, 20, 1, true), uv = g.attributes.uv, bays = Math.round(2 * Math.PI * r / 4); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * bays, uv.getY(i) * (h - h0) / 3.4);
        boxAt('trim', M, w + 0.6, 0.6, d + 0.6, 0, h0, 0, C(0xe8edf2)); geoAt('hotel', g, M, 0, (h + h0) / 2 + 0.3, 0, wc); geoAt('trim', CYL, M, 0, h + 0.7, 0, C(0xe8edf2), 0, r + 0.4, 0.8, r + 0.4); geoAt('roof', CYL, M, 0, h + 1.15, 0, C(b.roof || 0x5b7fa8), 0, r - 0.4, 0.1, r - 0.4);
        if (b.sign != null) sign(M, b.sign, 8, 1.2, 0, 4.9, d / 2 + 0.06); return h + 3; }
      if (st === 1) { const f1 = Math.ceil(fl * 0.6), h1 = h0 + f1 * 3.4; walls('office', M, w, d, h0, h1, wc, 4, 3.4); boxAt('trim', M, w + 0.6, 0.6, d + 0.6, 0, h1, 0, C(0xe8edf2)); boxAt('lawn', M, w - 0.8, 0.3, d - 0.8, 0, h1 + 0.6, 0, C(0x63bb4b)); wt = w * 0.66; dt = d * 0.66; walls('office', M, wt, dt, h1 + 0.9, h, wc, 4, 3.4); }
      else walls(st === 3 ? 'hotel' : 'office', M, w, d, h0, h, wc, 4, 3.4);
      boxAt('trim', M, wt + 0.6, 0.7, dt + 0.6, 0, h, 0, C(0xe8edf2)); boxAt('roof', M, wt - 0.4, 0.12, dt - 0.4, 0, h + 0.7, 0, C(b.roof || 0x5b7fa8));
      boxAt('detail', M, wt * 0.3, 2.4, dt * 0.3, wt * 0.15, h + 0.7, -dt * 0.1, C(0xc5cad1)); boxAt('detail', M, 7, 0.35, 2.4, 0, 3.6, d / 2 + 1.2, C(0x1f3f8f));
      if (b.sign != null) sign(M, b.sign, 8, 1.2, 0, 4.9, d / 2 + 0.06);
      return h + 3.2;
    },
    cityhall(b, M, w, d) { // City Hall: stone steps, a portico of columns under a pediment, a green dome, a flag
      const h = 13, st = C(0xf4ead6), Mp = mul(M, 0, 0, d / 2 + 3);
      for (let k = 0; k < 3; k++) boxAt('trim', M, w + 6 - k * 2, 0.4, d + 12 - k * 2, 0, k * 0.4, 2, C(0xe2d8c4));
      walls('brick', M, w, d, 1.2, h, st, 4.2, 5.9); boxAt('trim', M, w + 1, 1, d + 1, 0, h, 0, C(0xfaf5ea)); boxAt('roof', M, w - 0.4, 0.1, d - 0.4, 0, h + 1, 0, C(0x8a96a2));
      for (let i = 0; i < 6; i++) geoAt('trim', CYL, Mp, -w * 0.3 + i * w * 0.12, 6.6, 0, st, 0, 0.75, 10.8, 0.75);
      boxAt('trim', Mp, w * 0.72, 1.2, 6.5, 0, 12, 0, C(0xfaf5ea)); gable('trim', rotY(Mp), 6.5, w * 0.72, 13.2, 3.4, C(0xfaf5ea), 0.2); sign(Mp, 18, 9, 1, 0, 12.6, 3.3);
      geoAt('brick', new THREE.CylinderGeometry(8, 8, 5, 24, 1, true), M, 0, h + 3.5, 0, st); geoAt('roof', new THREE.SphereGeometry(8.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), M, 0, h + 6, 0, C(0x5fb3a0));
      geoAt('trim', CYL, M, 0, h + 15.7, 0, C(0xf2c14e), 0, 1.2, 2.6, 1.2); boxAt('trim', M, 0.15, 8, 0.15, w / 2 - 2, h + 1, d / 2 - 2, C(0xffffff)); boxAt('glow', M, 2, 1.2, 0.06, w / 2 - 1, h + 7.6, d / 2 - 2, C(0x0f6fb8));
      return h + 18;
    },
    villa(b, M, w, d) { // a modern villa: white walls, a glass upper floor, a pool and a garden behind a hedge
      const wc = C(b.color || 0xffffff);
      boxAt('lawn', M, w + 10, 0.12, d + 14, 0, 0, -3, C(0x5cb447));
      boxAt('trim', M, w + 10, 1.2, 0.7, 0, 0, -d / 2 - 10, C(0x3f8f3a)); for (const sx of [-1, 1]) boxAt('trim', M, 0.7, 1.2, d + 13, sx * (w / 2 + 5), 0, -3.5, C(0x3f8f3a));
      boxAt('trim', M, w + 0.4, 0.5, d + 0.4, 0, 0, 0, C(0xe6dfd2)); walls('flat', M, w, d, 0.5, 3.9, wc, 3.2, 3.4); boxAt('trim', M, w + 1, 0.35, d + 1, 0, 3.9, 0, C(0xf7f5f0));
      walls('hotel', mul(M, -w * 0.12, 0, -d * 0.1), w * 0.64, d * 0.7, 4.25, 7.4, C(0xeaf6ff), 3.2, 3.15); boxAt('trim', M, w * 0.64 + 1.2, 0.4, d * 0.7 + 1.2, -w * 0.12, 7.4, -d * 0.1, C(0xf7f5f0)); boxAt('roof', M, w * 0.64, 0.1, d * 0.7, -w * 0.12, 7.8, -d * 0.1, C(b.roof || 0xd9643a));
      frameAt('trim', M, 5, 9, 0.45, 0.45, w * 0.18, -d / 2 - 6, C(0xffffff)); boxAt('water', M, 4.1, 0.3, 8.1, w * 0.18, 0, -d / 2 - 6, C(0x35c6ea));
      for (let i = 0; i < 2; i++) boxAt('trim', M, 0.8, 0.3, 1.9, w * 0.18 - 4.2 + i * 1.3, 0.12, -d / 2 - 6, C(0xffffff));
      boxAt('trim', M, 1.5, 2.4, 0.3, w * 0.25, 0.5, d / 2 + 0.15, C(0x3b3f48)); boxAt('lawn', M, 3, 0.16, 7, w * 0.25, 0, d / 2 + 3.5, C(0xe8e0cf));
      extraTrees.push([...[[-w / 2 - 2, -d / 2 - 7]].map(([lx, lz]) => { const p = new THREE.Vector3(lx, 0, lz).applyMatrix4(M); return [p.x, p.y, p.z]; })[0], 0.85, 'palm']);
      return 8;
    },
    barn(b, M, w, d) { // a red barn with white doors and two grain silos
      walls('shed', M, w, d, 0, 6, C(0xc0473a), 2.4, 6); gable('roof', M, w, d, 6, 3.4, C(0x5a4a3a), 0.4); boxAt('trim', M, 4, 4.2, 0.3, 0, 0, d / 2 + 0.15, C(0xf4efe6));
      for (let i = 0; i < 2; i++) { geoAt('metal', CYL, M, w / 2 + 3.6 + i * 6, 6, 0, C(0xd9dde0), 0, 2.6, 12, 2.6); geoAt('metal', new THREE.SphereGeometry(2.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M, w / 2 + 3.6 + i * 6, 12, 0, C(0x9aa3ab)); }
      return 14;
    },
    stadium(b, M) { // an oval bowl: stepped seats in team colours, an upper tier, a roof ring, four gates, floodlights and a striped pitch
      const S = 0.82, V = (x, y) => new THREE.Vector2(x, y), seats = (pts, colours) => colours.forEach((c, i) => geoAt('trim2', new THREE.LatheGeometry(pts, 6, i * Math.PI * 2 / colours.length, Math.PI * 2 / colours.length), M, 0, 0, 0, C(c), 0, 1, 1, S));
      const lower = [V(34, 0.5)]; for (let i = 0; i < 9; i++) lower.push(V(34 + i * 1.3, 0.5 + (i + 1) * 0.8), V(34 + (i + 1) * 1.3, 0.5 + (i + 1) * 0.8));
      const upper = [V(46, 9)]; for (let i = 0; i < 6; i++) upper.push(V(46 + i * 1.6, 9 + (i + 1) * 1.0), V(46 + (i + 1) * 1.6, 9 + (i + 1) * 1.0));
      seats(lower, [0x1f5fbf, 0xd8392b, 0x1f5fbf, 0xd8392b, 0x1f5fbf, 0xd8392b, 0x1f5fbf, 0xd8392b]); seats(upper, [0x2e74c9, 0xf2f4f7, 0x2e74c9, 0xf2f4f7]);
      geoAt('trim2', new THREE.CylinderGeometry(56, 56, 15.6, 48, 1, true), M, 0, 7.8, 0, C(0xf2f4f7), 0, 1, 1, S); // the outer wall
      geoAt('trim2', new THREE.LatheGeometry([V(43, 19), V(58, 17.2)], 48), M, 0, 0, 0, C(0xffffff), 0, 1, 1, S); // the roof ring
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; geoAt('trim', CYL8, M, Math.cos(a) * 56.5, 8.6, Math.sin(a) * 56.5 * S, C(0xd9dde0), 0, 0.5, 17.2, 0.5); }
      geoAt('lawn', CYL, M, 0, 0.1, 0, C(0x4fa63e), 0, 34, 0.2, 34 * S); geoAt('pitch', PLANE_X, M, 0, 0.24, 0, WHITE, 0, 62, 1, 40);
      for (const [a, sg] of [[Math.PI / 2, 24], [-Math.PI / 2, 25], [0, 26], [Math.PI, 26]]) { const x = Math.cos(a) * 57.5, z = Math.sin(a) * 57.5 * S, ry = Math.atan2(x, z); boxAt('trim', M, 12, 8, 3, x, 0, z, C(0xe9edf2), ry); boxAt('trim', M, 8, 5.4, 3.2, x, 0, z, C(0x2b3440), ry); sign(mul(M, x, 0, z, ry), sg, 8, 1.4, 0, 6.6, 1.65); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { boxAt('metal', M, 1, 34, 1, sx * 44, 0, sz * 37, C(0x9aa3ab)); boxAt('glow', M, 5, 2.4, 1, sx * 44, 34, sz * 37, C(0xfffbe0), Math.atan2(sx, sz * S)); }
      sign(M, 16, 16, 2.6, 0, 12.4, 56 * S + 0.6); // STADIUM, over the main gate
      return 36;
    },
    kiosk(b, M, w, d) { walls('shop', M, w, d, 0, 3, C(0xffffff), w, 3); boxAt('detail', M, w + 1.6, 0.25, d + 1.6, 0, 3, 0, C(b.awn || 0xff8a3d)); if (b.sign != null) sign(M, b.sign, w * 0.9, 0.8, 0, 3.7, d / 2 + 0.8); return 4; },
    lighthouse(b, M) { const st = [[4.2, 3.6, 7, 0xffffff], [3.6, 3.1, 7, 0xd8392b], [3.1, 2.7, 7, 0xffffff], [2.7, 2.4, 3, 0xd8392b]]; let y = 0; for (const [r0, r1, hh, c] of st) { geoAt('trim', new THREE.CylinderGeometry(r1, r0, hh, 16), M, 0, y + hh / 2, 0, C(c)); y += hh; } geoAt('glow', CYL, M, 0, y + 1.5, 0, C(0xfff3b0), 0, 2.2, 3, 2.2); geoAt('roof', new THREE.ConeGeometry(3, 3, 14), M, 0, y + 4.5, 0, C(0x26323e)); return y + 6; },
  };

  const PEOPLE = []; // walkers: [x0, z0, x1, z1, y]
  const PARKED = []; // parked vehicles: [type, x, z, heading]
  const extraTrees = [];
  function buildTown() {
    let id = 1;
    const B = (o) => addBuilding(Object.assign({}, o, { id: o.id || 'b' + id++ }));
    // Beachfront: Hotel Azure, its pool deck, the drop-off loop, the promenade, the beach
    const hotel = B({ id: 'hotel', type: 'hotel', name: 'Hotel Azure', area: 'Beachfront', x: -165, z: 91, rot: 0, w: 56, d: 18, floors: 7, top: true, owner: 'city' });
    B({ id: 'hotel2', type: 'hotel', name: 'Hotel Azure · Garden wing', area: 'Beachfront', x: -124, z: 96, rot: 0, w: 22, d: 16, floors: 4, owner: 'city' });
    const M0 = new THREE.Matrix4().setPosition(0, TOWN_Y, 0);
    boxAt('lawn', M0, 104, 0.18, 26, -150, 0, 121, C(0xece3cf)); // pool deck
    for (const [x, z, w, d] of [[-168, 122, 26, 9], [-128, 123, 9, 6]]) { frameAt('trim', M0, w + 1.2, d + 1.2, 0.5, 0.6, x, z, C(0xffffff)); boxAt('water', M0, w, 0.4, d, x, 0, z, C(0x35c6ea)); }
    for (let i = 0; i < 12; i++) { const x = -185 + i * 6, z = i % 2 ? 130 : 113; boxAt('trim', M0, 0.9, 0.35, 2, x, 0.2, z, C(0xffffff)); if (i % 3 === 0) { geoAt('trim', CYL8, M0, x + 1.6, 1.5, z, C(0xffffff), 0, 0.06, 2.6, 0.06); geoAt('detail', new THREE.ConeGeometry(1.7, 0.7, 8), M0, x + 1.6, 2.9, z, C(pick([0x0f6fb8, 0xffffff]))); } }
    boxAt('detail', M0, 6, 0.3, 6, -104, 4, 92, C(0x0f6fb8)); for (const [x, z] of [[-101.5, 89.5], [-101.5, 94.5]]) boxAt('trim', M0, 0.3, 4, 0.3, x, 0, z, C(0xffffff)); // entrance canopy at the drop-off
    boxAt('lawn', M0, 290, 0.16, 7, -78, 0, 142, C(0xe7dccb)); // the promenade
    PEOPLE.push([-210, 141, 60, 143, TOWN_Y + 0.16], [-200, 143.5, 50, 140, TOWN_Y + 0.16], [-16, -52, 16, -12, TOWN_Y + 0.16], [-16, -12, 16, -52, TOWN_Y + 0.16], [-55, 49.6, 55, 49.6, TOWN_Y + 0.1]); // the promenade, the square and the shop pavement
    B({ id: 'bar', type: 'kiosk', name: 'Beach bar', area: 'Beachfront', x: -30, z: 153, rot: Math.PI, w: 7, d: 5, sign: 9, awn: 0xff8a3d, y: heightAt(-30, 153) });
    B({ id: 'ice', type: 'kiosk', name: 'Ice-cream stand', area: 'Beachfront', x: 30, z: 150, rot: Math.PI, w: 5, d: 4, sign: 14, awn: 0xff6f91, y: heightAt(30, 150) });
    // the pier and the beach: umbrellas, towels, a volleyball net, a lifeguard tower
    for (let z = 150; z < 250; z += 6) boxAt('trim', M0, 3.4, 0.4, 6.2, -78, -2.2, z, C(0xb08559)); for (let z = 160; z < 250; z += 12) for (const s of [-1.4, 1.4]) boxAt('trim', M0, 0.4, 6, 0.4, -78 + s, -8, z, C(0x6b4a33));
    seed = 12; const UMB = [];
    for (let x = -200; x < 40; x += 9) for (let row = 0; row < 3; row++) { const z = 160 + row * 11 + (x % 2) * 2, d = land(x, z); if (d < 9 || d > 46 || Math.abs(x + 78) < 6) continue; UMB.push([x + rnd() * 3, heightAt(x, z), z, row]); }
    for (const [x, y, z] of UMB) { const M = new THREE.Matrix4().setPosition(x, y, z); geoAt('trim', CYL8, M, 0, 1.5, 0, C(0xffffff), 0, 0.06, 3, 0.06); geoAt('detail', new THREE.ConeGeometry(2.1, 0.8, 8), M, 0, 3, 0, C(pick([0xe8483f, 0x0f6fb8, 0xf2b705, 0xffffff, 0x1f8f5b]))); boxAt('lawn', M, 1.1, 0.08, 2.1, 1.6, 0, 1, C(pick([0xff6f91, 0x2e74c9, 0xffd21f]))); }
    { const x = -140, z = 178, y = heightAt(x, z), M = new THREE.Matrix4().setPosition(x, y, z); for (const s of [-5, 5]) geoAt('trim', CYL8, M, s, 1.2, 0, C(0xffffff), 0, 0.08, 2.4, 0.08); boxAt('trim', M, 10, 0.9, 0.05, 0, 1.4, 0, C(0xf4f4f4)); }
    { const x = -10, z = 170, y = heightAt(x, z), M = new THREE.Matrix4().setPosition(x, y, z); for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt('trim', M, 0.2, 3, 0.2, sx, 0, sz, C(0xffffff)); boxAt('trim', M, 2.6, 1.4, 2.6, 0, 3, 0, C(0xe8483f)); boxAt('trim', M, 3, 0.2, 3, 0, 4.4, 0, C(0xffffff)); }
    // the Old Quarter: shops on Beach Road, flats round a market square, your home on Market Street
    const SH = [[-41, 18, 0, 0xfff1d6], [-20, 17, 1, 0xffd8bd], [0, 16, 2, 0xffffff], [20, 16, 3, 0xffe6a1], [41, 18, 4, 0xf9cfc4]];
    for (const [x, w, s, c] of SH) B({ type: 'shophouse', name: SIGNS[s][0] + SIGNS[s].slice(1).toLowerCase() + ', Beach Road', area: 'Old Quarter', x, z: 41.5, rot: 0, w, d: 12, floors: 3, sign: s, color: c, sale: true });
    for (const [z, c] of [[8, 0xffd8bd], [-20, 0xfff1d6], [-48, 0xd6ecff]]) B({ type: 'flat', name: `${30 + Math.round(-z / 2)} Hotel Street`, area: 'Old Quarter', x: -47, z, rot: -Math.PI / 2, w: 16, d: 12, floors: 4, color: c, sale: true });
    for (const [z, c, hm] of [[8, 0xffe6a1], [-20, 0xffffff, true], [-48, 0xf9cfc4]]) B({ id: hm ? 'home' : undefined, type: 'flat', name: hm ? '12 Market Street' : `${20 + Math.round(-z / 2)} Market Street`, area: 'Old Quarter', x: 47, z, rot: Math.PI / 2, w: 16, d: 12, floors: hm ? 3 : 4, color: c, sale: !hm, owner: hm ? 'you' : undefined });
    for (const [x, c] of [[-38, 0xfff1d6], [-13, 0xffd8bd], [13, 0xf4dfb8], [36, 0xd6ecff]]) B({ type: 'flat', name: `${Math.abs(x)} High Street`, area: 'Old Quarter', x, z: -96.5, rot: Math.PI, w: 20, d: 12, floors: 3, color: c, sale: true });
    // the market square: paving, a fountain, benches, trees, a newspaper kiosk
    boxAt('lawn', M0, 40, 0.16, 46, 0, 0, -32, C(0xe9dfca)); geoAt('trim', CYL, M0, 0, 0.45, -32, C(0xe2d8c4), 0, 5, 0.9, 5); geoAt('water', CYL, M0, 0, 0.85, -32, C(0x46c9e8), 0, 4.3, 0.2, 4.3); geoAt('glassy', CYL8, M0, 0, 2, -32, C(0xdff6ff), 0, 0.5, 2.6, 0.5);
    for (const [x, z] of [[-12, -18], [12, -18], [-12, -46], [12, -46]]) { boxAt('trim', M0, 3, 0.45, 0.8, x, 0.3, z + (z < -32 ? -3 : 3), C(0x8a5a3c)); extraTrees.push([x, TOWN_Y, z, 0.8, 'round']); }
    B({ type: 'kiosk', name: 'Square kiosk', area: 'Old Quarter', x: 14, z: -32, rot: -Math.PI / 2, w: 4, d: 4, awn: 0x2e74c9 });
    { const M = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(-2, TOWN_Y, 63.5); boxAt('trim', M, 5, 0.15, 1.8, 0, 2.6, 0, C(0x2e74c9)); for (const x of [-2.3, 2.3]) boxAt('trim', M, 0.12, 2.6, 0.12, x, 0, 0.7, C(0xd9dde0)); boxAt('glassy', M, 4.6, 2.1, 0.05, 0, 0.4, -0.8, C(0xcfeeff)); sign(M, 11, 1.5, 0.6, 2.8, 3.1, 0.1); }
    LABELS.push({ text: 'Market Square', level: 'place', x: 0, y: 12, z: -32 }, { text: 'Bus stop', level: 'place', x: -2, y: 8, z: 64, small: true });
    // a second row of small flats facing the square, with gardens between
    for (const [x, c] of [[-31, 0xffe6a1], [31, 0xfff1d6]]) B({ type: 'flat', name: `${x < 0 ? 3 : 5} Square Row`, area: 'Old Quarter', x, z: -70, rot: x < 0 ? Math.PI / 2 : -Math.PI / 2, w: 14, d: 12, floors: 3, color: c, sale: true });
    for (let i = 0; i < 26; i++) { const x = (rnd() < 0.5 ? -1 : 1) * (24 + rnd() * 14), z = -86 + rnd() * 112; if (!inside(x, z, 2) && Math.abs(z + 32) > 26) extraTrees.push([x, TOWN_Y, z, 0.6 + rnd() * 0.3, rnd() < 0.3 ? 'flower' : 'round']); }
    // the beach park in front of the shops: a basketball court, a café terrace, lawns and palms
    { const M = new THREE.Matrix4().setPosition(-20, TOWN_Y, 98); boxAt('lawn', M, 15, 0.12, 26, 0, 0, 0, C(0x2e74c9)); boxAt('lawn', M, 13, 0.16, 24, 0, 0, 0, C(0xd9643a)); for (const z of [-11, 11]) { boxAt('trim', M, 0.2, 3, 0.2, 0, 0, z, C(0xffffff)); boxAt('trim', M, 1.2, 0.9, 0.1, 0, 2.8, z - Math.sign(z) * 0.2, C(0xffffff)); } }
    { const M = new THREE.Matrix4().setPosition(25, TOWN_Y, 95); boxAt('lawn', M, 18, 0.14, 12, 0, 0, 0, C(0xe9dfca)); for (let i = 0; i < 6; i++) { const x = -6 + (i % 3) * 6, z = -2.5 + Math.floor(i / 3) * 5; geoAt('trim', CYL8, M, x, 0.6, z, C(0xffffff), 0, 0.6, 0.06, 0.6); geoAt('trim', CYL8, M, x, 1.6, z, C(0xffffff), 0, 0.05, 2.6, 0.05); geoAt('detail', new THREE.ConeGeometry(1.6, 0.6, 8), M, x, 2.9, z, C(pick([0xe8483f, 0xffffff]))); } }
    // harbour-side lawns: a car park, a boatyard with boats on stands, the sailing club
    { const M = new THREE.Matrix4().setPosition(92, TOWN_Y, 100); boxAt('lawn', M, 40, 0.12, 22, 0, 0, 0, C(0x5c616b)); for (let i = 0; i <= 8; i++) for (const z of [-6.5, 6.5]) boxAt('lawn', M, 0.18, 0.16, 5, -20 + 2 + i * 4.5, 0, z, C(0xf4f4f0)); PARKED.push(...[[-15.7, -6.5], [-6.7, -6.5], [2.3, 6.5], [11.3, 6.5], [-11.2, 6.5], [15.8, -6.5]].map(([x, z], i) => [i % 3 ? 'sedan' : 'compact', 92 + x, 100 + z, z < 0 ? 0 : Math.PI])); }
    for (let i = 0; i < 4; i++) { const M = new THREE.Matrix4().makeRotationY(0.3).setPosition(150 + i * 13, TOWN_Y, 118 - i * 3); boxAt('trim', M, 2.6, 1.6, 8, 0, 1.2, 0, C(pick([0xffffff, 0x2e74c9, 0xe8483f]))); boxAt('trim', M, 2.2, 0.8, 3, 0, 2.8, -0.6, C(0xffffff)); for (const z of [-2.5, 2.5]) boxAt('trim', M, 2, 1.2, 0.3, 0, 0, z, C(0x6b4a33)); }
    B({ id: 'club', type: 'shophouse', name: 'Sailing club', area: 'Harbour', x: 208, z: 150, rot: Math.PI * 1.05, w: 16, d: 10, floors: 2, sign: 8, color: 0xffffff, roof: 0x2e6fbf, awn: 0x2e74c9, y: heightAt(208, 150), owner: 'city' });
    // fill every free plot with small houses (or sheds by the harbour), each facing its nearest road; keep squares, parks and yards clear
    const KEEP = [[-22, 22, -57, -7], [-172, -88, -78, 12], [-110, -90, -68, -52], [74, 134, -56, 0], [-210, -40, 66, 150], [-40, 60, 64, 150], [60, 240, 64, 170], [-45, -35, -48, 12]];
    const faceRoad = (x, z) => { let best = 0, bd = 1e9; for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const d = nearRoad(x + Math.sin(r) * 18, z + Math.cos(r) * 18)[0]; if (d < bd) { bd = d; best = r; } } return best; };
    const LOTS = [], inRect = (px, pz, r) => { const c = Math.cos(r.rot), s = Math.sin(r.rot), lx = (px - r.x) * c - (pz - r.z) * s, lz = (px - r.x) * s + (pz - r.z) * c; return Math.abs(lx) < r.w / 2 && Math.abs(lz) < r.d / 2; };
    const pts9 = r => { const c = Math.cos(r.rot), s = Math.sin(r.rot), out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push([r.x + i * r.w / 2 * c + j * r.d / 2 * s, r.z - i * r.w / 2 * s + j * r.d / 2 * c]); return out; };
    const fits = (x, z, w, d, rot) => { const me = { x, z, w, d, rot }; for (const [px, pz] of pts9(me)) if (inside(px, pz, 1.2) || nearRoad(px, pz)[0] < 2.9 || KEEP.some(r => px > r[0] && px < r[1] && pz > r[2] && pz < r[3]) || LOTS.some(r => inRect(px, pz, r))) return false; if (LOTS.some(r => pts9(r).some(([px, pz]) => inRect(px, pz, me)))) return false; LOTS.push(me); return true; };
    const HOUSE = [0xfff1d6, 0xffd8bd, 0xffffff, 0xffe6a1, 0xf9cfc4, 0xd6ecff, 0xf4dfb8];
    seed = 31;
    for (const [x0, x1, z0, z1, kind] of [[-205, -62, -98, 50, 'house'], [-42, 42, -92, 30, 'house'], [66, 184, -104, 30, 'shed']]) for (let x = x0; x <= x1; x += 5) for (let z = z0; z <= z1; z += 5) {
      const rot = faceRoad(x, z), w = kind === 'shed' ? 20 : 9 + rnd() * 2, d = kind === 'shed' ? 14 : 8 + rnd() * 1.5;
      if (!fits(x, z + (kind === 'house' ? 0 : 0), w + (kind === 'house' ? 3 : 1), d + (kind === 'house' ? 8 : 2), rot)) continue;
      const bx = x + (kind === 'house' ? Math.sin(rot) * 2.5 : 0), bz = z + (kind === 'house' ? Math.cos(rot) * 2.5 : 0); // the house sits forward, the garden runs back
      if (kind === 'house') B({ type: 'house', name: `${2 + Math.floor(rnd() * 60)} ${x < -60 ? 'Park Lane' : 'Quarter Lane'}`, area: 'Old Quarter', x: bx, z: bz, rot, w, d, color: pick(HOUSE), roof: pick(TERRA), sale: true });
      else B({ type: 'warehouse', name: 'Store shed', area: 'Harbour', x, z, rot, w, d, roof: pick([0x2e6fbf, 0x2e8f6f, 0x5c6670]), sale: true });
    }
    // west of Hotel Street: the library and a park with a playground
    B({ id: 'library', type: 'civic', name: 'Capital Library', area: 'Old Quarter', x: -168, z: 36, rot: 0, w: 22, d: 14, owner: 'city' });
    B({ type: 'flat', name: '4 Park Lane', area: 'Old Quarter', x: -108, z: 38, rot: 0, w: 16, d: 12, floors: 3, color: 0xffe6a1, sale: true });
    B({ type: 'flat', name: '6 Park Lane', area: 'Old Quarter', x: -86, z: 38, rot: 0, w: 14, d: 12, floors: 3, color: 0xfff1d6, sale: true });
    boxAt('lawn', M0, 118, 0.14, 4, -130, 0, -20, C(0xe9dfca)); boxAt('lawn', M0, 4, 0.14, 90, -130, 0, -30, C(0xe9dfca));
    { const M = new THREE.Matrix4().setPosition(-100, TOWN_Y, -60); boxAt('lawn', M, 16, 0.16, 14, 0, 0, 0, C(0xf2d48f)); boxAt('trim', M, 0.5, 2.6, 0.5, -3, 0, -3, C(0xe8483f)); boxAt('trim', M, 3.2, 0.3, 1, -1.8, 2.4, -3, C(0xffd21f)); boxAt('trim', M, 1, 1.6, 3, 3, 0, 2, C(0x2e74c9)); boxAt('trim', M, 3, 0.2, 0.4, 3, 1.8, -3, C(0x8a4fd6)); }
    for (let i = 0; i < 150; i++) { const x = -195 + rnd() * 125, z = -88 + rnd() * 108; if (Math.abs(x + 130) < 4 || Math.abs(z + 20) < 4 || (Math.abs(x + 100) < 11 && Math.abs(z + 60) < 10)) continue; extraTrees.push([x, TOWN_Y, z, 0.75 + rnd() * 0.4, rnd() < 0.2 ? 'cypress' : 'round']); }
    // the Harbour: office, warehouses, depot, quay apron, gantry cranes, the cargo ship, marina, breakwater
    B({ id: 'office', type: 'office', name: 'Harbour Office', area: 'Harbour', x: 150, z: 39, rot: 0, w: 24, d: 16, floors: 4, sign: 6, owner: 'city' });
    B({ id: 'wh1', type: 'warehouse', name: 'Warehouse 1', area: 'Harbour', x: 168, z: -8, rot: Math.PI / 2, w: 38, d: 26, sale: true });
    B({ id: 'wh2', type: 'warehouse', name: 'Warehouse 2', area: 'Harbour', x: 168, z: -66, rot: Math.PI / 2, w: 34, d: 26, roof: 0x2e8f6f, sale: true });
    B({ id: 'depot', type: 'warehouse', name: 'Delivery depot', area: 'Harbour', x: 96, z: -86, rot: Math.PI, w: 30, d: 18, roof: 0xd9643a, color: 0xfff1d6, sign: 15, sale: true });
    boxAt('lawn', M0, 60, 0.16, 52, 104, 0, -28, C(0xc9c4ba)); // depot yard
    const CONT = [0xd8392b, 0x2e74c9, 0x1f8f5b, 0xf2a531, 0x8a4fd6, 0xe8e2d6];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) for (let k = 0; k < 1 + ((i + r) % 3); k++) boxAt('trim', M0, 2.5, 2.6, 12, 82 + i * 3 + r * 18, k * 2.6, -10 - (r % 2) * 16, C(CONT[(i + k + r) % 6]));
    PARKED.push(['truck', 130, -40, Math.PI / 2], ['truck', 130, -48, Math.PI / 2], ['van', 85, -45, 0], ['van', 89, -45, 0]);
    boxAt('lawn', M0, 46, 0.06, 168, 219, 0, 40, C(0xcfcac0)); // the quay apron, just under the pavement and road
    { const M = new THREE.Matrix4(); boxAt('trim', M, 4, 10.2, 168, 241, -7, 40, C(0xb8b0a0)); for (let z = -40; z <= 118; z += 12) boxAt('trim', M, 0.7, 0.8, 0.7, 240, TOWN_Y + 0.2, z, C(0x2e3640)); }
    for (const z of [-22, 75]) { const M = new THREE.Matrix4().setPosition(232, TOWN_Y, z); for (const [x, zz] of [[-6, -7], [6, -7], [-6, 7], [6, 7]]) boxAt('metal', M, 1.1, 24, 1.1, x, 0, zz, C(0xf2b705)); boxAt('metal', M, 50, 2, 3, 12, 24, 0, C(0xf2b705)); boxAt('trim', M, 4, 3, 4, 10, 21, 0, C(0x2b3440)); boxAt('trim', M, 0.25, 12, 0.25, 22, 10, 0, C(0x2b3440)); }
    for (let i = 0; i < 4; i++) for (let k = 0; k < 1 + (i % 3); k++) for (let j = 0; j < 2; j++) boxAt('trim', M0, 2.5, 2.6, 12, 206 + j * 2.7, k * 2.6, 52 + i * 14, C(CONT[(i * 2 + j + k) % 6]));
    for (const [x, z] of [[222, 96], [216, -38]]) { boxAt('trim', M0, 6, 3.4, 4, x, 0, z, C(0xffffff)); boxAt('roof', M0, 6.4, 0.3, 4.4, x, 3.4, z, C(0x2e6fbf)); }
    LABELS.push({ text: 'Quay', level: 'place', x: 222, y: 10, z: 12, small: true });
    // marina pontoons and the breakwater with its little lighthouse
    for (const z of [128, 140]) { boxAt('trim', new THREE.Matrix4(), 34, 0.5, 2.4, 262, 0.5, z, C(0xc9a77a)); }
    for (let i = 0; i < 9; i++) { const t = i / 8, x = 274 + t * 58, z = 150 - t * 52; geoAt('roof', new THREE.DodecahedronGeometry(1, 0), new THREE.Matrix4(), x, 0.8, z, C(pick([0xa39d90, 0x8f8a80])), i, 5, 3.2, 5); }
    B({ id: 'beacon', type: 'lighthouse', name: 'Harbour light', area: 'Harbour', x: 334, z: 96, rot: 0, w: 6, d: 6, y: 2.2, scale: 0.5, owner: 'city' });
    B({ type: 'kiosk', name: 'Seafood shack', area: 'Harbour', x: 120, z: 78, rot: Math.PI, w: 9, d: 6, sign: 8, awn: 0x2e74c9, sale: true });
    // Industrial Isle: the processing plant inside its loop road, a store shed, and the lighthouse on the far headland
    B({ id: 'plant', type: 'plant', name: 'Capital Processing Plant', area: 'Industrial Isle', x: 546, z: -184, rot: -Math.PI / 2, w: 34, d: 22, y: 9, owner: 'city' });
    PADS.push([546, -184, 26, 9]);
    B({ id: 'store', type: 'warehouse', name: 'Isle cold store', area: 'Industrial Isle', x: 540, z: -112, rot: Math.PI, w: 24, d: 14, y: 9, roof: 0x5c6670, sale: true });
    B({ id: 'light', type: 'lighthouse', name: 'Lighthouse Point', area: 'Lighthouse Point', x: -440, z: -322, rot: 0, w: 8, d: 8, y: heightAt(-440, -322), owner: 'city' });
    // ---------- the business centre: City Hall on its square, Capital Bank, the Exchange and office towers ----------
    B({ id: 'cityhall', type: 'cityhall', name: 'City Hall', area: 'Business Centre', x: -132, z: -160, rot: 0, w: 44, d: 24, owner: 'city' });
    { const M = new THREE.Matrix4().setPosition(-132, TOWN_Y, -128); tileAt(-132, -128); boxAt('lawn', M, 70, 0.16, 26, 0, 0, 0, C(0xe9dfca)); geoAt('trim', CYL, M, 0, 0.45, 0, C(0xe2d8c4), 0, 5, 0.9, 5); geoAt('water', CYL, M, 0, 0.85, 0, C(0x46c9e8), 0, 4.3, 0.2, 4.3); for (const x of [-28, -16, 16, 28]) extraTrees.push([-132 + x, TOWN_Y, -122, 0.8, 'round']); }
    B({ id: 'bank', type: 'civic', name: 'Capital Bank', area: 'Business Centre', x: 0, z: -178, rot: Math.PI, w: 26, d: 16, sign: 17, dome: false, owner: 'city' });
    B({ type: 'tower', name: '2 Exchange Place', area: 'Business Centre', x: -30, z: -132, rot: 0, w: 22, d: 18, floors: 8, style: 0, color: 0xd6ecff, sign: 22, sale: true, office: true });
    B({ type: 'tower', name: '4 Exchange Place', area: 'Business Centre', x: 28, z: -132, rot: 0, w: 22, d: 18, floors: 6, style: 3, color: 0xffffff, roof: 0x2e8f6f, sale: true, office: true });
    for (const [x, fl, c] of [[-38, 5, 0xfff1d6], [38, 6, 0xd6ecff]]) B({ type: 'tower', name: `${Math.abs(x)} Capital Avenue`, area: 'Business Centre', x, z: -186, rot: Math.PI, w: 20, d: 16, floors: fl, style: 3, color: c, roof: 0xd9643a, sale: true, office: true });
    B({ type: 'tower', name: '80 Capital Avenue', area: 'Business Centre', x: 80, z: -188, rot: Math.PI, w: 16, d: 14, floors: 5, style: 0, color: 0xffe6a1, sale: true, office: true });
    B({ type: 'tower', name: 'Harbour View Tower', area: 'Business Centre', x: 100, z: -150, rot: 0, w: 24, d: 24, floors: 14, style: 1, color: 0xcfe4f7, sale: true, office: true });
    B({ type: 'tower', name: 'Capital Life Tower', area: 'Business Centre', x: 158, z: -158, rot: 0, w: 26, d: 26, floors: 12, style: 2, color: 0xe6f6ff, sign: 29, owner: 'city' });
    B({ id: 'exchange', type: 'tower', name: 'The Exchange', area: 'Business Centre', x: 120, z: -186, rot: Math.PI, w: 34, d: 14, floors: 3, style: 0, color: 0xfff1d6, roof: 0xd9643a, sign: 21, owner: 'city' });
    { const M = new THREE.Matrix4(); tileAt(0, -150); for (const [x, z, w, d] of [[0, -150, 40, 20], [128, -128, 30, 14]]) boxAt('lawn', M.clone().setPosition(x, TOWN_Y, z), w, 0.16, d, 0, 0, 0, C(0xe9dfca)); for (const x of [-12, 0, 12]) extraTrees.push([x, TOWN_Y, -150, 0.7, 'round']); }
    LOTS.push({ x: -132, z: -128, w: 72, d: 28, rot: 0 }, { x: 0, z: -150, w: 42, d: 22, rot: 0 }, { x: 128, z: -128, w: 32, d: 16, rot: 0 });
    for (let x = -196; x < 186; x += 8) for (let z = -196; z < -114; z += 8) { const px = x + (rnd() - 0.5) * 4, pz = z + (rnd() - 0.5) * 4; if (rnd() < 0.45 && !inside(px, pz, 3) && nearRoad(px, pz)[0] > 4.5 && !LOTS.some(r => inRect(px, pz, r))) extraTrees.push([px, TOWN_Y, pz, 0.65 + rnd() * 0.3, rnd() < 0.2 ? 'cypress' : 'round']); } // trees on the lawns between the offices
    // ---------- the stadium: the bowl, the forecourt, ticket booths, two car parks off Stadium Way ----------
    B({ id: 'stadium', type: 'stadium', name: 'Capital Stadium', area: 'Stadium', x: 130, z: -335, rot: 0, w: 116, d: 95, owner: 'city' });
    { const M = new THREE.Matrix4().setPosition(130, TOWN_Y, -280); tileAt(130, -280); boxAt('lawn', M, 90, 0.16, 18, 0, 0, 0, C(0xe9dfca)); for (const x of [-30, 30]) { boxAt('trim', M, 4, 2.6, 3, x, 0, 2, C(0xffffff)); boxAt('roof', M, 4.6, 0.3, 3.6, x, 2.6, 2, C(0xd8392b)); sign(M, 26, 3.6, 0.6, x, 3.3, 3.55); } for (const x of [-40, -20, 0, 20, 40]) extraTrees.push([130 + x, TOWN_Y, -272, 0.6, 'round']); }
    LOTS.push({ x: 130, z: -280, w: 92, d: 20, rot: 0 });
    const carPark = (cx, cz, w, d, rows) => { LOTS.push({ x: cx, z: cz, w: w + 2, d: d + 2, rot: 0 }); tileAt(cx, cz); const M = new THREE.Matrix4().setPosition(cx, TOWN_Y, cz); boxAt('lawn', M, w, 0.12, d, 0, 0, 0, C(0x5c616b)); for (const [z, h] of rows) for (let x = -w / 2 + 2; x < w / 2 - 2; x += 3) { boxAt('lawn', M, 0.18, 0.16, 5, x, 0, z, C(0xf4f4f0)); if (rnd() < 0.55) PARKED.push([rnd() < 0.5 ? 'sedan' : 'compact', cx + x + 1.5, cz + z, h]); } };
    carPark(10, -345, 40, 34, [[-12, 0], [12, Math.PI]]); carPark(236, -288, 26, 16, [[-4.5, Math.PI / 2 * 0 + Math.PI], [4.5, 0]]);
    // ---------- Greenfields: the farm co-op store, barns, farmhouses and a patchwork of fields ----------
    B({ id: 'coop', type: 'warehouse', name: 'Greenfields Farm Co-op', area: 'Greenfields', x: -300, z: -303, rot: 0, w: 32, d: 18, color: 0xfff1d6, roof: 0x2f8f3a, sign: 20, owner: 'city' });
    B({ type: 'barn', name: 'West Barn', area: 'Greenfields', x: -398, z: -290, rot: 0, w: 16, d: 11, owner: 'city' });
    B({ type: 'barn', name: 'North Barn', area: 'Greenfields', x: -246, z: -398, rot: Math.PI / 2, w: 16, d: 11, owner: 'city' });
    for (const [x, z, r] of [[-355, -235, Math.PI], [-232, -296, -Math.PI / 2]]) B({ type: 'house', name: 'Farmhouse', area: 'Greenfields', x, z, rot: r, w: 10, d: 9, color: 0xfff1d6, roof: 0x8a5a3c, sale: true });
    const field = (cx, cz, W, D, kind) => { tileAt(cx, cz); const M = new THREE.Matrix4().setPosition(cx, TOWN_Y, cz), rows = (gap, f) => { for (let z = -D / 2 + 1.6; z < D / 2 - 1; z += gap) f(z); };
      boxAt('lawn', M, W, 0.12, D, 0, 0, 0, C({ wheat: 0xe3c35a, corn: 0x8a6b4a, veg: 0x8f6e4e, pasture: 0x7fcf5c, orchard: 0x6fbf55, sun: 0x8a6b4a }[kind]));
      if (kind === 'wheat') rows(4, z => boxAt('lawn', M, W - 1, 0.18, 1.4, 0, 0, z, C(0xcfa944)));
      else if (kind === 'corn') rows(2.4, z => { boxAt('trim', M, W - 2, 1.6, 1.1, 0, 0.12, z, C(0x5f9e3a)); boxAt('trim', M, W - 2, 0.25, 0.7, 0, 1.72, z, C(0xd9c25a)); });
      else if (kind === 'sun') rows(2.4, z => { boxAt('trim', M, W - 2, 1.3, 0.8, 0, 0.12, z, C(0x5f9e3f)); boxAt('trim', M, W - 2, 0.4, 1.2, 0, 1.42, z, C(0xffd21f)); });
      else if (kind === 'veg') { let i = 0; rows(2, z => boxAt('trim', M, W - 2, 0.45, 1, 0, 0.12, z, C([0x4caf3f, 0x3f8f3f, 0xe85d3f, 0xf2a531][i++ % 4]))); }
      else if (kind === 'pasture') { frameAt('trim', M, W - 1, D - 1, 1, 0.15, 0, 0, C(0xf7f3ea)); for (let i = 0; i < 5; i++) { const x = (rnd() - 0.5) * (W - 8), z = (rnd() - 0.5) * (D - 8), a = rnd() * 6, c = C(rnd() < 0.6 ? 0xf7f5f0 : 0x8a5a3c); boxAt('trim', M, 1.8, 0.7, 0.9, x, 0, z, C(0x3b3b3b), a); boxAt('trim', M, 2.4, 1.1, 1.1, x, 0.7, z, c, a); boxAt('trim', M, 0.8, 0.8, 0.8, x + Math.cos(a) * 1.5, 1.1, z - Math.sin(a) * 1.5, c, a); } }
      else if (kind === 'orchard') for (let x = -W / 2 + 4; x < W / 2 - 2; x += 6) for (let z = -D / 2 + 4; z < D / 2 - 2; z += 6) extraTrees.push([cx + x, TOWN_Y, cz + z, 0.5, 'round']);
    };
    seed = 41;
    for (const [W, D] of [[44, 32], [26, 20]]) for (let x = -414 + W / 2; x < -24 - W / 2; x += W / 2) for (let z = -428 + D / 2; z < -212 - D / 2; z += D / 2) if ([[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([a, b]) => land(x + a * W / 2, z + b * D / 2) > 22) && fits(x, z, W + 2, D + 2, 0)) field(x, z, W, D, pick(['wheat', 'corn', 'veg', 'wheat', 'pasture', 'orchard', 'sun', 'corn']));
    for (const e of edges) if (e.kind === 'farm' || (e.a.id === 'I2' && e.b.id === 'FA')) for (let s0 = 10; s0 < e.len - 10; s0 += 12) { const i = e.cum.findIndex(c => c >= s0), p = e.pts[i], q = e.pts[Math.min(e.pts.length - 1, i + 1)], dx = q[0] - p[0], dz = q[2] - p[2], L = Math.hypot(dx, dz) || 1; for (const sd of [-1, 1]) { const x = p[0] - dz / L * sd * (e.w / 2 + 2.5), z = p[2] + dx / L * sd * (e.w / 2 + 2.5); if (!inside(x, z, 1) && !LOTS.some(r => inRect(x, z, r))) extraTrees.push([x, TOWN_Y, z, 0.6, rnd() < 0.5 ? 'cypress' : 'round']); } }
    // ---------- Villa Point: villas with pools and gardens on the hillside, and the marina in its cove ----------
    VILLAS.forEach((v, i) => B({ type: 'villa', name: `${3 + i * 4} Villa Point Road`, area: 'Villa Point', x: v.x, z: v.z, rot: v.rot, y: v.y, w: 14, d: 11, color: pick([0xffffff, 0xfff8ec, 0xf4eee2]), roof: pick([0xd9643a, 0x5b7fa8, 0x2f8f6f]), sale: true, premium: true }));
    B({ id: 'yacht', type: 'shophouse', name: 'Yacht Club', area: 'Villa Point', x: -440, z: 174, rot: Math.PI, w: 16, d: 10, floors: 2, sign: 23, color: 0xffffff, roof: 0x2e6fbf, awn: 0x0f6fb8, y: 3.1, owner: 'city' });
    B({ type: 'kiosk', name: 'Marina office', area: 'Villa Point', x: -384, z: 172, rot: -Math.PI / 2, w: 6, d: 5, sign: 19, awn: 0x0f6fb8, y: 3.1, owner: 'city' });
    { const M = new THREE.Matrix4(); tileAt(-410, 215); boxAt('trim', M, 2.6, 0.5, 50, -412, 0.9, 214, C(0xc9a77a)); for (let z = 196; z <= 236; z += 9) for (const sd of [-1, 1]) { boxAt('trim', M, 9, 0.4, 1.6, -412 + sd * 5.6, 0.95, z, C(0xc9a77a)); if (rnd() < 0.8) { const Mb = mul(M, -412 + sd * 6.2, 0.1, z + 3.4, Math.PI / 2); boxAt('trim', Mb, 9, 1.5, 3, 0, 0, 0, C(0xffffff)); boxAt('trim', Mb, 9.1, 0.35, 3.1, 0, 0.9, 0, C(pick([0x1f3f8f, 0x0f6fb8, 0xd8392b]))); boxAt('trim', Mb, 4, 1.3, 2.2, -0.5, 1.5, 0, C(0xffffff)); boxAt('glassy', Mb, 3.6, 0.6, 2.3, -0.5, 2.1, 0, C(0x9fdcff)); } } }
    // labels and plaques for the new places
    LABELS.push({ text: 'Business Centre', level: 'district', x: 40, y: 50, z: -160 }, { text: 'Stadium', level: 'district', x: 130, y: 40, z: -335 }, { text: 'Greenfields', level: 'district', x: -320, y: 30, z: -330 }, { text: 'Villa Point', level: 'district', x: -460, y: 40, z: 70 }, { text: 'Marina', level: 'place', x: -412, y: 10, z: 214 });
    flush();
    World.home = buildings.find(b => b.id === 'home');
    // the ships: a cargo ship at the quay, a tug, sailboats out in the bay
    const g = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.7 });
    const hull = (L, Bw, H, c, deck) => { const s = new THREE.Group(), sh = new THREE.Shape(); sh.moveTo(-L / 2, -Bw / 2); sh.lineTo(L / 2 - Bw, -Bw / 2); sh.quadraticCurveTo(L / 2 + Bw * 0.2, 0, L / 2 - Bw, Bw / 2); sh.lineTo(-L / 2, Bw / 2); sh.closePath(); const hm = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false }).rotateX(-Math.PI / 2), M(c)); hm.position.y = -1.3; hm.castShadow = true; s.add(hm); const dk = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), M(deck)); dk.position.y = H - 1.28; s.add(dk); return s; };
    const ship = hull(80, 14, 6.5, 0x1f3f6b, 0x9c4a32); ship.position.set(253, 0, 40); ship.rotation.y = -Math.PI / 2;
    for (let i = 0; i < 5; i++) for (let k = 0; k < 2; k++) for (let j = 0; j < 4; j++) { const c = new THREE.Mesh(new THREE.BoxGeometry(11, 2.5, 2.5), M(CONT[(i + j + k) % 6])); c.position.set(-16 + i * 12, 6.6 + k * 2.6, -3.9 + j * 2.6); c.castShadow = true; ship.add(c); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 12), M(0xffffff)); br.position.set(-33, 9, 0); br.castShadow = true; ship.add(br); g.add(ship);
    const sails = [];
    for (let i = 0; i < 4; i++) { const b = hull(9, 3, 2, 0xffffff, 0xc79b6b), mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 9), M(0xeeeeee)); mast.position.y = 5.3; b.add(mast); const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.5, 0, 0, 9.4, 0, -3.6, 1.5, 0], 3)); sg.computeVertexNormals(); b.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }))); g.add(b); sails.push({ b, cx: [-120, 60, 360, -320][i], cz: [290, 270, 210, 320][i], r: [60, 45, 50, 70][i], s: 0.04 + i * 0.01, a: i * 2 }); }
    for (const [x, z] of [[252, 128], [270, 128], [256, 140], [278, 140], [-74, 236]]) { const b = hull(8, 2.8, 1.8, pick([0xffffff, 0xe8483f, 0x2e74c9]), 0xc79b6b); b.position.set(x, 0, z); g.add(b); }
    const cargo = hull(34, 8, 4, 0x2f5f8f, 0x9c4a32); for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.4, 2.4), M(CONT[i % 6])); c.position.set(-6 + (i % 3) * 6, 3.6, i < 3 ? -1.3 : 1.3); cargo.add(c); } const cb = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 7), M(0xffffff)); cb.position.set(-12, 4.5, 0); cargo.add(cb); g.add(cargo);
    const LANE = [[262, 92], [300, 70], [380, -10], [470, -70], [548, -84]].map(p => new THREE.Vector3(p[0], 0, p[1])), sea = new THREE.CatmullRomCurve3(LANE), voyage = { k: 0, dir: 1, wait: 4 };
    World.SEA = { from: 'Harbour quay', to: 'Isle quay', state: () => voyage.wait > 0 ? (voyage.dir > 0 ? 'loading at the harbour' : 'loading at the isle') : 'at sea' };
    tick.push(dt => { if (voyage.wait > 0) voyage.wait -= dt; else { voyage.k = clamp(voyage.k + voyage.dir * dt / 70, 0, 1); if (voyage.k === 0 || voyage.k === 1) { voyage.dir *= -1; voyage.wait = 8; } } const p = sea.getPointAt(voyage.k), q = sea.getTangentAt(voyage.k).multiplyScalar(voyage.dir); cargo.position.set(p.x, Math.sin(clock * 0.7) * 0.1, p.z); cargo.rotation.y = Math.atan2(q.x, q.z) - Math.PI / 2; });
    scene.add(g);
    tick.push((dt, t) => { ship.position.y = Math.sin(t * 0.5) * 0.08; for (const s of sails) { s.a += dt * s.s; s.b.position.set(s.cx + Math.cos(s.a) * s.r, Math.sin(t + s.a) * 0.15, s.cz + Math.sin(s.a) * s.r * 0.6); s.b.rotation.y = -s.a; } });
    LABELS.push({ text: 'Capital Island', level: 'island', x: -120, y: 40, z: -100 }, { text: 'Industrial Isle', level: 'island', x: 535, y: 40, z: -180, minor: true },
      { text: 'Beachfront', level: 'district', x: -120, y: 30, z: 165 }, { text: 'Old Quarter', level: 'district', x: 0, y: 30, z: -40 }, { text: 'Harbour', level: 'district', x: 205, y: 30, z: 20 },
      { text: 'Industrial Isle', level: 'district', x: 535, y: 30, z: -180 }, { text: 'Lighthouse Point', level: 'district', x: -440, y: 50, z: -340 }, { text: 'Pine Hill', level: 'district', x: -520, y: 70, z: -95 });
    for (const b of buildings) if (['hotel', 'library', 'office', 'plant', 'home', 'depot', 'cityhall', 'bank', 'exchange', 'stadium', 'coop', 'yacht'].includes(b.id)) LABELS.push({ text: b.id === 'home' ? 'Your home' : b.name, level: 'place', x: b.x, y: b.h + 6, z: b.z, b, home: b.id === 'home' });
  }

  // ---------- trees and rocks ----------
  function treeGeo(kind) {
    const merge = list => { const pos = [], nor = [], col = []; for (const [geo, c] of list) { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; };
    const TR = new THREE.Color(0.42, 0.3, 0.22), LF = new THREE.Color(1, 1, 1), trunk = (h, r) => new THREE.CylinderGeometry(r * 0.7, r, h, 5, 1, true).translate(0, h / 2, 0);
    return { round: merge([[trunk(3, 0.4), TR], [new THREE.IcosahedronGeometry(2.8, 0).translate(0, 5.2, 0), LF], [new THREE.IcosahedronGeometry(2, 0).translate(1.2, 6.6, 0.6), LF]]),
      pine: merge([[trunk(2.6, 0.38), TR], [new THREE.ConeGeometry(2.7, 5.5, 7).translate(0, 5, 0), LF], [new THREE.ConeGeometry(1.9, 4, 7).translate(0, 7.8, 0), LF]]),
      cypress: merge([[trunk(1.4, 0.3), TR], [new THREE.ConeGeometry(1.25, 9, 7).translate(0, 5.6, 0), LF]]),
      palm: merge([[new THREE.CylinderGeometry(0.2, 0.3, 8, 5, 1, true).translate(0, 4, 0), TR], [new THREE.IcosahedronGeometry(0.55, 0).translate(0, 8.1, 0), LF], ...[0, 1, 2, 3, 4, 5, 6].map(i => [new THREE.BoxGeometry(3.4, 0.12, 0.9).translate(1.75, 0, 0).rotateZ(-0.42).translate(0, 8.2, 0).rotateY(i * Math.PI * 2 / 7), LF])]),
      bush: merge([[new THREE.IcosahedronGeometry(1.4, 0).scale(1, 0.75, 1).translate(0, 0.8, 0), LF]]), flower: merge([[new THREE.IcosahedronGeometry(1.1, 0).scale(1, 0.7, 1).translate(0, 0.7, 0), LF]]) }[kind];
  }
  const PAL = { round: [0x3f9a3a, 0x4caf3f, 0x2f8a35, 0x59b847], pine: [0x24703a, 0x2f7f3d], cypress: [0x235f32, 0x2a6b38], palm: [0x3fa64a, 0x4cb04f], bush: [0x4caf3f, 0x3f9a3a, 0x358f37], flower: [0xe8659a, 0xf2b705, 0xb07cff, 0xff8a5c] };
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  function plant(kind, list) { // trees in 150 m tiles, each with its own bounds, so only the tiles in view (and in the sun's view) are drawn
    if (!list.length) return; const geo = treeGeo(kind), tiles = new Map(), c = new THREE.Color();
    for (const t of list) { const k = Math.floor(t[0] / 150) + ',' + Math.floor(t[2] / 150); if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push(t); }
    for (const arr of tiles.values()) {
      const g = geo.clone(), m = new THREE.InstancedMesh(g, treeMat, arr.length); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9;
      arr.forEach((t, i) => { tmp.position.set(t[0], t[1], t[2]); tmp.rotation.set(0, (t[0] * 7.3 + t[2]) % 6.28, 0); tmp.scale.setScalar(t[3]); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); const p = PAL[kind]; m.setColorAt(i, c.set(p[Math.abs(Math.floor(t[0] * 13 + t[2] * 7)) % p.length]).convertSRGBToLinear()); x0 = Math.min(x0, t[0]); x1 = Math.max(x1, t[0]); z0 = Math.min(z0, t[2]); z1 = Math.max(z1, t[2]); y0 = Math.min(y0, t[1]); y1 = Math.max(y1, t[1]); });
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2 + 6, (z0 + z1) / 2), Math.hypot(x1 - x0, z1 - z0, y1 - y0) / 2 + 14);
      m.frustumCulled = true; m.castShadow = true; m.receiveShadow = true; scene.add(m); // r128 instanced meshes skip culling unless told
    }
  }
  const inside = (x, z, pad) => !buildings.every(b => { const c = Math.cos(b.rot), s = Math.sin(b.rot), lx = (x - b.x) * c - (z - b.z) * s, lz = (x - b.x) * s + (z - b.z) * c; return !(Math.abs(lx) < b.w / 2 + pad && Math.abs(lz) < b.d / 2 + pad); });
  function clearOf(x, z, pad) { for (const b of buildings) { const c = Math.cos(b.rot), s = Math.sin(b.rot), lx = (x - b.x) * c - (z - b.z) * s, lz = (x - b.x) * s + (z - b.z) * c; if (Math.abs(lx) < b.w / 2 + pad && Math.abs(lz) < b.d / 2 + pad) return false; } return nearRoad(x, z)[0] > pad + 2.5; }
  function buildNature() {
    const T = { round: [], pine: [], cypress: [], palm: [], bush: [], flower: [] }; seed = 99;
    for (const t of extraTrees) T[t[4]].push(t);
    for (let i = 0; i < 26000 && T.round.length + T.pine.length < 5200; i++) { // the wild land: forest on the hill, groves elsewhere, nothing on the beach or in the water
      const x = X0 + rnd() * (X1 - X0), z = Z0 + rnd() * (Z1 - Z0), d = land(x, z); if (d < 9 || townMask(x, z) > 0.2) continue;
      const h = heightAt(x, z); if (K.rock < 0.4 && !K.isle && d < 50 && h < 4) continue; if (!clearOf(x, z, 3)) continue;
      if (K.isle && d > 14) continue; // the industrial isle keeps a green fringe, the middle is the works
      const r = rnd(), f = fbm(x * 1.7, z * 1.7); if (h < 12 && f < 0.45 && r < 0.6) continue;
      (h > 22 ? (r < 0.6 ? T.pine : r < 0.8 ? T.cypress : T.round) : r < 0.12 ? T.cypress : r < 0.2 ? T.bush : T.round).push([x, h - 0.15, z, 0.75 + rnd() * 0.5]);
    }
    for (let x = -205; x < 55; x += 12) for (const z of [136.5, 148]) { const y = z < 140 ? TOWN_Y : heightAt(x, z); if (Math.abs(x + 78) > 4 && Math.abs(x + 30) > 6 && Math.abs(x - 30) > 5) T.palm.push([x + (z > 140 ? 5 : 0), y, z, 0.9 + rnd() * 0.25]); }
    for (let i = 0; i < 90; i++) { const x = -60 + rnd() * 240, z = 70 + rnd() * 70; if (x > 60 && (Math.abs(x - 92) < 24 && Math.abs(z - 100) < 14 || Math.abs(x - 120) < 8 && Math.abs(z - 78) < 6 || x > 140 && z > 105)) continue; if (land(x, z) > 30 && clearOf(x, z, 1.5) && Math.abs(z - 142) > 5) (rnd() < 0.5 ? T.palm : T.round).push([x, TOWN_Y, z, 0.8 + rnd() * 0.3]); }
    for (const e of edges) if (e.kind === 'town') for (let s = 14; s < e.len - 14; s += 16) for (const sd of [-1, 1]) { const i = e.cum.findIndex(c => c >= s), p = e.pts[i], q = e.pts[Math.min(e.pts.length - 1, i + 1)], dx = q[0] - p[0], dz = q[2] - p[2], L = Math.hypot(dx, dz) || 1, x = p[0] - dz / L * sd * (e.w / 2 + 1.7), z = p[2] + dx / L * sd * (e.w / 2 + 1.7); if (inside(x, z, 2.4) || Object.values(nodes).some(N => Math.hypot(N.x - x, N.z - z) < N.r + 6)) continue; T.round.push([x, p[1], z, 0.55]); }
    for (const k in T) plant(k, T[k]);
    const rocks = []; seed = 17;
    for (const pts of [curve(MAIN_C, 12), curve(ISLE_C, 12)]) for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (p[2] < 0.6 || rnd() < 0.4) continue; for (let k = 0; k < 2; k++) { const x = p[0] + (rnd() - 0.5) * 14, z = p[1] + (rnd() - 0.5) * 14; rocks.push([x, Math.min(heightAt(x, z), 1) - 0.4, z, 1.2 + rnd() * 2.6]); } }
    const rm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), rocks.length), rc = new THREE.Color();
    rocks.forEach((t, i) => { tmp.position.set(t[0], t[1], t[2]); tmp.rotation.set(t[0] % 3, t[2] % 3, 0); tmp.scale.set(t[3], t[3] * 0.75, t[3] * 1.1); tmp.updateMatrix(); rm.setMatrixAt(i, tmp.matrix); rm.setColorAt(i, rc.set(pick([0x9a958d, 0x85817b, 0xaaa59b])).convertSRGBToLinear()); });
    rm.castShadow = true; scene.add(rm);
    // lamps along the promenade and the town streets
    const lampGeo = new THREE.CylinderGeometry(0.1, 0.14, 5, 5).translate(0, 2.5, 0), lampTop = new THREE.SphereGeometry(0.35, 8, 6).translate(0, 5.1, 0), lamps = [];
    for (let x = -200; x < 55; x += 24) lamps.push([x, TOWN_Y + 0.16, 139]);
    const lm = new THREE.InstancedMesh(lampGeo, new THREE.MeshStandardMaterial({ color: lin(0x2b3440) }), lamps.length), lt = new THREE.InstancedMesh(lampTop, new THREE.MeshBasicMaterial({ color: lin(0xfff2c0) }), lamps.length);
    lamps.forEach((t, i) => { tmp.position.set(...t); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); lm.setMatrixAt(i, tmp.matrix); lt.setMatrixAt(i, tmp.matrix); }); lm.castShadow = true; scene.add(lm, lt);
  }

  // ---------- vehicles: compact cars, saloons, vans, a bus, cargo trucks ----------
  function taper(w, h, d, tw, td, dz = 0) { // a box narrower at the top: cabins with sloped windscreens
    const v = [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2], [-tw / 2, h, -td / 2 + dz], [tw / 2, h, -td / 2 + dz], [tw / 2, h, td / 2 + dz], [-tw / 2, h, td / 2 + dz]], f = [[0, 1, 2, 3], [7, 6, 5, 4], [3, 2, 6, 7], [1, 0, 4, 5], [2, 1, 5, 6], [0, 3, 7, 4]], pos = [];
    for (const q of f) for (const i of [q[0], q[1], q[2], q[0], q[2], q[3]]) pos.push(...v[i]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  }
  const VCOL = { glass: new THREE.Color(0.06, 0.1, 0.16), tyre: new THREE.Color(0.04, 0.04, 0.05), rim: new THREE.Color(0.7, 0.72, 0.75), lamp: new THREE.Color(1, 0.95, 0.75), tail: new THREE.Color(0.8, 0.05, 0.05), dark: new THREE.Color(0.12, 0.13, 0.15), white: new THREE.Color(1, 1, 1), cab: lin(0x1f4fbf), stripe: lin(0x1f6fd0) };
  function vehicleGeo(type) { // two geometries: the painted body (tinted per vehicle) and the fixed parts (glass, wheels, lights)
    const body = [], fixed = [], W = WHITE, at = (list, g, c, x, y, z) => list.push([g.clone().translate(x, y, z), c]);
    const wheel = (r, wd) => new THREE.CylinderGeometry(r, r, wd, 10).rotateZ(Math.PI / 2), wheels = (r, wd, xs, zs) => { for (const x of xs) for (const z of zs) { at(fixed, wheel(r, wd), VCOL.tyre, x, r, z); at(fixed, wheel(r * 0.55, wd + 0.04), VCOL.rim, x, r, z); } };
    const lights = (w, y, f, b) => { for (const s of [-1, 1]) { at(fixed, new THREE.BoxGeometry(0.34, 0.16, 0.06), VCOL.lamp, s * (w / 2 - 0.3), y, f); at(fixed, new THREE.BoxGeometry(0.3, 0.14, 0.06), VCOL.tail, s * (w / 2 - 0.28), y, b); } };
    if (type === 'compact') { at(body, new THREE.BoxGeometry(1.66, 0.62, 3.5), W, 0, 0.62, 0); at(fixed, taper(1.6, 0.62, 2.05, 1.36, 1.5, -0.15), VCOL.glass, 0, 0.93, -0.18); at(body, new THREE.BoxGeometry(1.38, 0.07, 1.42), W, 0, 1.58, -0.33); wheels(0.31, 0.24, [-0.73, 0.73], [-1.12, 1.12]); lights(1.66, 0.75, 1.76, -1.76); }
    else if (type === 'sedan') { at(body, new THREE.BoxGeometry(1.8, 0.6, 4.6), W, 0, 0.62, 0); at(fixed, taper(1.72, 0.58, 2.3, 1.44, 1.6, -0.1), VCOL.glass, 0, 0.92, -0.25); at(body, new THREE.BoxGeometry(1.46, 0.07, 1.52), W, 0, 1.53, -0.35); wheels(0.33, 0.26, [-0.8, 0.8], [-1.5, 1.45]); lights(1.8, 0.75, 2.31, -2.31); }
    else if (type === 'van') { at(body, new THREE.BoxGeometry(2, 1.95, 3.9), W, 0, 1.43, -0.55); at(body, taper(2, 1.2, 1.25, 1.9, 0.7, -0.27), W, 0, 0.45, 2.02); at(fixed, new THREE.BoxGeometry(1.82, 0.62, 0.06), VCOL.glass, 0, 1.55, 2.0); at(fixed, new THREE.BoxGeometry(2.02, 0.32, 3.4), VCOL.stripe, 0, 1.0, -0.5); for (const s of [-1, 1]) at(fixed, new THREE.BoxGeometry(0.04, 0.55, 0.7), VCOL.glass, s * 1.0, 1.65, 1.15); wheels(0.36, 0.28, [-0.88, 0.88], [-1.6, 1.75]); lights(2, 0.75, 2.66, -2.51); }
    else if (type === 'bus') { at(body, new THREE.BoxGeometry(2.5, 2.7, 11), W, 0, 1.75, 0); at(fixed, new THREE.BoxGeometry(2.54, 1.0, 9.6), VCOL.glass, 0, 2.05, -0.2); at(fixed, new THREE.BoxGeometry(2.2, 1.3, 0.06), VCOL.glass, 0, 2.0, 5.51); at(fixed, new THREE.BoxGeometry(1.6, 0.3, 0.06), lin(0xffd21f), 0, 2.85, 5.52); at(fixed, new THREE.BoxGeometry(2.3, 0.12, 10.4), VCOL.white, 0, 3.15, 0); wheels(0.5, 0.32, [-1.08, 1.08], [-3.6, 3.6]); lights(2.5, 0.85, 5.51, -5.51); }
    else if (type === 'truck') { at(fixed, new THREE.BoxGeometry(2.4, 2.4, 2.3), VCOL.cab, 0, 1.75, 3.3); at(fixed, new THREE.BoxGeometry(2.2, 0.9, 0.06), VCOL.glass, 0, 2.25, 4.46); for (const s of [-1, 1]) at(fixed, new THREE.BoxGeometry(0.04, 0.7, 1.0), VCOL.glass, s * 1.21, 2.3, 3.4); at(fixed, new THREE.BoxGeometry(2.2, 0.35, 9), VCOL.dark, 0, 0.75, -0.5); at(body, new THREE.BoxGeometry(2.5, 2.6, 6.6), W, 0, 2.25, -1.6); wheels(0.5, 0.36, [-1.0, 1.0], [-3.9, -2.8, 3.3]); lights(2.4, 0.95, 4.46, -4.91); }
    const merge = list => { const pos = [], nor = [], col = []; for (const [g0, c] of list) { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; };
    return { body: merge(body), fixed: merge(fixed) };
  }
  const VT = { compact: { len: 3.6, paint: [0xe8483f, 0xf2b705, 0x2fb7c4, 0x8a4fd6, 0xffffff], vf: 1 }, sedan: { len: 4.6, paint: [0xffffff, 0x2e5aa8, 0xb9c0c8, 0x24282e, 0xc0392b], vf: 1 }, van: { len: 5.3, paint: [0xffffff], vf: 0.9 }, bus: { len: 11, paint: [0xf28c28], vf: 0.8 }, truck: { len: 9.5, paint: [0xf2b705, 0xe8762c, 0x1f8f5b, 0xd8392b], vf: 0.8 } };

  // ---------- traffic: lane following, junction turns, gaps, routes, shipments ----------
  const cars = [], meshes = {}, stats = { maxJump: 0, maxYawRate: 0, teleports: 0, frames: 0, stuck: 0 };
  const SHIP = []; // the delivery jobs the trucks and vans run: queued → loading → travelling → delivered (or failed)
  function buildTraffic() {
    seed = 3; const plan = [];
    for (let i = 0; i < 15; i++) plan.push({ type: 'compact' }); for (let i = 0; i < 13; i++) plan.push({ type: 'sedan' });
    plan.push({ type: 'bus', loop: ['A', 'B', 'C', 'D', 'X', 'E', 'F', 'F2', 'G2', 'H2', 'H', 'I'], stops: [['B', 'C', 0.55], ['G2', 'H2', 0.5]] });
    plan.push({ type: 'truck', job: { name: 'Containers → Processing Plant', from: 'K', to: 'P' } }, { type: 'truck', job: { name: 'Crates → Harbour quay', from: 'P', to: 'K' } }, { type: 'truck', job: { name: 'Goods → Delivery depot', from: 'K', to: 'G' } });
    plan.push({ type: 'van', job: { name: 'Groceries → Old Quarter shops', from: 'G', to: 'C' } }, { type: 'van', job: { name: 'Linen → Hotel Azure', from: 'G', to: 'J' } });
    for (const k in VT) { const n = plan.filter(p => p.type === k).length + PARKED.filter(p => p[0] === k).length + (k === 'truck' || k === 'van' ? 6 : 0), G = vehicleGeo(k), body = new THREE.InstancedMesh(G.body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.1 }), n), fixed = new THREE.InstancedMesh(G.fixed, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), n); body.castShadow = fixed.castShadow = true; body.frustumCulled = fixed.frustumCulled = false; scene.add(body, fixed); meshes[k] = { body, fixed, n: 0 }; }
    const startLanes = lanes.filter(l => l.e.kind !== 'bridge' && l.len > 30), c = new THREE.Color();
    plan.forEach((p, i) => {
      const m = meshes[p.type], car = { i: m.n++, type: p.type, len: VT[p.type].len, vf: VT[p.type].vf * (0.9 + rnd() * 0.2), v: 0, h: 0, pos: new THREE.Vector3(), last: null, wait: 0, stopped: 0, next: null, route: null, loop: p.loop, stops: p.stops, job: p.job };
      m.body.setColorAt(car.i, c.set(pick(VT[p.type].paint)).convertSRGBToLinear());
      if (p.loop) { car.path = laneBetween('A', 'B'); car.s = 10; car.li = 1; }
      else if (p.job) { const ln = nodes[p.job.from].inn.find(l => l.len > 20) || nodes[p.job.from].inn[0]; car.path = ln; car.s = Math.max(0, ln.len - 14 - SHIP.length * 3); car.ship = { name: p.job.name, from: p.job.from, to: p.job.to, status: 'loading', t: 4 + SHIP.length * 3, runs: 0 }; SHIP.push(car.ship); }
      else { car.path = startLanes[Math.floor(rnd() * startLanes.length)]; car.s = rnd() * car.path.len * 0.8; }
      if (car.path.occ.some(o => Math.abs(o.s - car.s) < 14)) car.s = (car.s + 20) % Math.max(1, car.path.len - 2);
      car.path.occ.push(car); cars.push(car);
    });
    for (const [type, x, z, h] of PARKED) { const m = meshes[type], i = m.n++; m.body.setColorAt(i, c.set(pick(VT[type].paint)).convertSRGBToLinear()); tmp.position.set(x, TOWN_Y + 0.12, z); tmp.rotation.set(0, h, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); m.body.setMatrixAt(i, tmp.matrix); m.fixed.setMatrixAt(i, tmp.matrix); }
    for (const k of ['truck', 'van']) { const m = meshes[k]; for (let j = 0; j < 6; j++) { const i = m.n++; SPARE[k].push(i); hide(m, i); m.body.setColorAt(i, c.set(0xffc93c).convertSRGBToLinear()); } }
    for (const k in meshes) meshes[k].body.instanceColor.needsUpdate = true;
    tick.push(dt => { if (dt > 0) stepTraffic(Math.min(dt, 0.05)); }); // a zero step (a paused frame) moves nothing
    let pt = 0; tick.push(dt => { pt += dt; if (pt > 1) { pt = 0; startPending(); } });
  }
  // ---------- player shipments: a vehicle from your fleet drives the real route; its arrival is what completes the delivery ----------
  const SPARE = { truck: [], van: [] }, pending = [];
  function hide(m, i) { tmp.position.set(0, -50, 0); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(0.0001); tmp.updateMatrix(); m.body.setMatrixAt(i, tmp.matrix); m.fixed.setMatrixAt(i, tmp.matrix); m.body.instanceMatrix.needsUpdate = m.fixed.instanceMatrix.needsUpdate = true; }
  function routeInfo(from, to) { const r = route(from, to); if (!r) return null; let len = 0; for (let k = 0; k + 1 < r.length; k++) len += laneBetween(r[k], r[k + 1]).len; return { path: r, len }; }
  function dispatch(o) { // o: { type: 'truck' | 'van', from, to, frac, paint, onArrive }
    const h = { o, status: 'queued', why: 'Waiting for a vehicle', car: null };
    h.progress = () => h.car ? clamp((h.car.odo || 0) / h.total, 0, 1) : (o.frac || 0);
    pending.push(h); startPending(); return h;
  }
  function startPending() {
    for (let i = pending.length - 1; i >= 0; i--) {
      const h = pending[i]; if (h.cancelled) { pending.splice(i, 1); continue; }
      const r = route(h.o.from, h.o.to); if (!r) { h.status = 'failed'; h.why = 'No open route: waiting for it to reopen'; continue; }
      if (!SPARE[h.o.type].length) { h.status = 'queued'; h.why = 'Waiting for a vehicle'; continue; }
      pending.splice(i, 1); spawn(h, r);
    }
  }
  function spawn(h, r) {
    const type = h.o.type, m = meshes[type], i = SPARE[type].pop(), L = []; for (let k = 0; k + 1 < r.length; k++) L.push(laneBetween(r[k], r[k + 1]));
    const total = L.reduce((a, l) => a + l.len, 0), start = clamp(h.o.frac || 0, 0, 0.97) * total; let target = start, li = 0; while (li < L.length - 1 && target > L[li].len) { target -= L[li].len; li++; }
    const car = { i, type, len: VT[type].len, vf: VT[type].vf, v: 0, h: 0, last: null, wait: 0, stopped: 0, next: null, route: r, path: L[li], s: clamp(target, 0, L[li].len - 0.5), conn: null, player: h, odo: start, ship: { name: '', from: h.o.from, to: h.o.to, status: 'travelling', runs: 0, t: 0 } };
    m.body.setColorAt(i, new THREE.Color(h.o.paint || 0xffc93c).convertSRGBToLinear()); m.body.instanceColor.needsUpdate = true;
    car.path.occ.push(car); cars.push(car); h.car = car; h.total = total; h.status = 'travelling'; h.why = '';
  }
  function despawn(car) {
    const k = cars.indexOf(car); if (k >= 0) cars.splice(k, 1); const o = car.path.occ.indexOf(car); if (o >= 0) car.path.occ.splice(o, 1);
    for (const id in nodes) if (nodes[id].busy === car) nodes[id].busy = null;
    hide(meshes[car.type], car.i); SPARE[car.type].push(car.i); car.player.car = null;
  }
  const poseAt = (path, s, out) => { const c = path.cum, p = path.pts; let i = 1; while (i < c.length - 1 && c[i] < s) i++; const t = clamp((s - c[i - 1]) / ((c[i] - c[i - 1]) || 1), 0, 1); return out.set(mix(p[i - 1][0], p[i][0], t), mix(p[i - 1][1], p[i][1], t), mix(p[i - 1][2], p[i][2], t)); };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();
  function chooseNext(car) { // where to turn at the end of this lane: along the route if it has one, otherwise any open road that isn't straight back
    const ln = car.path, N = ln.to; let next = null;
    if (car.route) {
      let k = car.route.indexOf(N.id); if (k < 0 && car.ship) { car.route = route(N.id, car.ship.to); k = car.route ? 0 : -1; } // off the plan: plan again from here
      const v = car.route && k >= 0 ? car.route[k + 1] : null; if (v) next = N.out.find(l => l.to.id === v && !l.e.closed);
    }
    if (!next && car.loop) { const k = car.loop.indexOf(N.id); if (k >= 0) next = N.out.find(l => l.to.id === car.loop[(k + 1) % car.loop.length] && !l.e.closed); }
    if (!next && !car.route && !car.loop) { const opts = N.out.filter(l => l.e !== ln.e && !l.e.closed && !(l.to.deg === 1 && rnd() < 0.7)); if (opts.length) next = opts[Math.floor(rnd() * opts.length)]; }
    if (!next) next = N.out.find(l => l.e === ln.e); // a dead end, or every way on is closed: turn round (the turning circle or the junction allows it)
    return next;
  }
  function leaderGap(car) { // free road ahead on this path and the next two, minus the length of whoever is in front
    let path = car.path, acc = 0;
    for (let k = 0; k < 3 && path; k++) {
      const s0 = k ? 0 : car.s; let best = null;
      for (const o of path.occ) if (o !== car && (k ? true : o.s > s0) && (!best || o.s < best.s)) best = o;
      if (best) return [acc + best.s - s0 - (best.len + car.len) / 2, best];
      acc += path.len - s0; path = path.kind === 'lane' ? (path === car.path ? car.conn : null) : path.to;
    }
    return [1e9, null];
  }
  function stepTraffic(dt) {
    stats.frames++;
    const gone = [];
    for (const car of cars) {
      const sh = car.ship;
      if (sh && sh.status === 'loading') { sh.t -= dt; car.v = 0; if (sh.t <= 0) { car.route = route(car.path.to.id, sh.to); if (car.route) { sh.status = 'travelling'; sh.why = ''; } else { sh.status = 'failed'; sh.why = 'No open route: driving round until it reopens'; sh.t = 2; } } }
      else if (sh && sh.status === 'failed') { sh.t -= dt; if (sh.t <= 0) { sh.t = 2; const r = route(car.path.to.id, sh.to); if (r) { car.route = r; sh.status = 'travelling'; sh.why = ''; } } } // keeps moving, checks again every 2 s
      const path = car.path;
      if (path.kind === 'lane' && !car.conn) { car.next = chooseNext(car); car.conn = connector(path, car.next); }
      // target speed: the road's limit, slower into turns, stop at a busy junction, keep a gap to the car in front
      let vt = path.vmax * car.vf; const rem = path.len - car.s;
      if (path.kind === 'lane') {
        const N = path.to, cv = car.conn.vmax * car.vf; vt = Math.min(vt, Math.sqrt(cv * cv + 2 * 3.5 * Math.max(0, rem - 1)));
        const stopsHere = sh && sh.status === 'travelling' && N.id === sh.to;
        if (N.deg >= 3) { const first = !path.occ.some(o => o !== car && o.s > car.s); if (first && !stopsHere && rem < car.v * car.v / 7 + 8 && !N.busy) N.busy = car; if (N.busy && N.busy !== car) vt = Math.min(vt, Math.sqrt(2 * 3.5 * Math.max(0, rem - 1.5))); }
        if (car.ship && car.ship.status === 'travelling' && N.id === car.ship.to) vt = Math.min(vt, Math.sqrt(2 * 3 * Math.max(0, rem - 3)));
        if (car.stops && !car.stopped) for (const [u, v, f] of car.stops) if (path.from.id === u && path.to.id === v) { const d = path.len * f - car.s; if (d > -0.5 && d < 40) vt = Math.min(vt, Math.sqrt(2 * 2.5 * Math.max(0, d))); if (Math.abs(d) < 0.6 && car.v < 0.3) car.stopped = 5; }
      }
      if (car.stopped > 0) { car.stopped -= dt; vt = 0; if (car.stopped <= 0) car.stopped = -1; }
      if (car.ship && car.ship.status === 'travelling' && path.kind === 'lane' && path.to.id === car.ship.to && rem < 3.5 && car.v < 0.4) { car.ship.status = 'delivered'; car.ship.runs++; car.ship.t = 5; car.ship.at = performance.now(); if (car.player) { gone.push(car); continue; } }
      if (car.player) { car.player.status = car.ship.status; car.player.why = car.ship.why || ''; car.odo = (car.odo || 0) + car.v * dt; }
      if (sh && sh.status === 'delivered') { vt = 0; sh.t -= dt; if (sh.t <= 0) { [sh.from, sh.to] = [sh.to, sh.from]; sh.status = 'loading'; sh.t = 3; car.route = null; } } // unload, then load the return trip
      const [gap] = leaderGap(car); vt = Math.min(vt, Math.max(0, (gap - 2.2) / 1.1));
      car.v += clamp(vt - car.v, -7 * dt, 2.2 * dt); if (car.v < 0) car.v = 0;
      car.s += car.v * dt;
      // move on to the next piece of road; the pieces join exactly, so nothing jumps
      while (car.s > car.path.len) {
        const over = car.s - car.path.len, from = car.path; from.occ.splice(from.occ.indexOf(car), 1);
        if (from.kind === 'lane') { car.path = car.conn; } else { if (from.node.busy === car) from.node.busy = null; car.path = from.to; car.conn = null; if (car.stopped < 0) car.stopped = 0; }
        car.path.occ.push(car); car.s = over;
        if (car.path.kind === 'lane') { car.conn = null; }
      }
      if (car.path.kind === 'lane' && car.path.from.busy === car) car.path.from.busy = null;
      // pose: position on the path, heading from the path's direction, smoothed; pitch on slopes
      poseAt(car.path, car.s, _p); _a.copy(_p); const ahead = car.s + 2.5, nx = car.path.kind === 'lane' ? car.conn : car.path.to; if (ahead <= car.path.len || !nx) poseAt(car.path, Math.min(ahead, car.path.len), _b); else poseAt(nx, Math.min(ahead - car.path.len, nx.len), _b); // steer towards a point 2.5 m ahead, across joins
      let h = Math.atan2(_b.x - _a.x, _b.z - _a.z); if (_a.distanceToSquared(_b) < 0.01) h = car.h; if (!car.last) car.h = h; // first frame: face the road
      const dh = Math.atan2(Math.sin(h - car.h), Math.cos(h - car.h)); car.h += dh * Math.min(1, dt * 12);
      if (car.last) { const jump = car.last.distanceTo(_p), allowed = car.v * dt + 0.25; stats.maxJump = Math.max(stats.maxJump, jump - car.v * dt); if (jump > allowed + 0.5) { stats.teleports++; stats.lastJump = { type: car.type, kind: car.path.kind, s: +car.s.toFixed(2), len: +car.path.len.toFixed(2), jump: +jump.toFixed(2), from: car.path.kind === 'lane' ? car.path.from.id + '>' + car.path.to.id : car.path.node.id, uturn: !!car.path.uturn }; } stats.maxYawRate = Math.max(stats.maxYawRate, Math.abs(dh * Math.min(1, dt * 12)) / dt); } else car.last = new THREE.Vector3();
      car.last.copy(_p); car.wait = car.v < 0.05 ? car.wait + dt : 0;
      const pitch = -Math.atan2(_b.y - _a.y, Math.hypot(_b.x - _a.x, _b.z - _a.z));
      tmp.position.copy(_p).y += 0.02; tmp.rotation.set(0, 0, 0); tmp.rotateY(car.h); tmp.rotateX(pitch); tmp.scale.setScalar(1); tmp.updateMatrix();
      const m = meshes[car.type]; m.body.setMatrixAt(car.i, tmp.matrix); m.fixed.setMatrixAt(car.i, tmp.matrix);
    }
    for (const car of gone) { const h = car.player; despawn(car); h.status = 'delivered'; if (h.o.onArrive) h.o.onArrive(h); }
    stats.stuck = cars.filter(c => c.wait > 25 && !(c.ship && c.ship.status !== 'travelling') && !(c.stopped > 0)).length;
    for (const k in meshes) { meshes[k].body.instanceMatrix.needsUpdate = true; meshes[k].fixed.instanceMatrix.needsUpdate = true; }
    // a few people walking the promenade and the square
    if (people) { people.t += dt; PEOPLE_W.forEach((w, i) => { const u = (Math.sin(people.t * w.sp + w.ph) + 1) / 2; tmp.position.set(mix(w.p[0], w.p[2], u), w.p[4], mix(w.p[1], w.p[3], u)); tmp.rotation.set(0, Math.atan2(w.p[2] - w.p[0], w.p[3] - w.p[1]) + (Math.cos(people.t * w.sp + w.ph) < 0 ? Math.PI : 0), 0); tmp.scale.setScalar(1); tmp.updateMatrix(); people.m.setMatrixAt(i, tmp.matrix); }); people.m.instanceMatrix.needsUpdate = true; }
  }
  let people = null; const PEOPLE_W = [];
  function buildPeople() {
    seed = 23; for (let i = 0; i < 48; i++) { const p = PEOPLE[i % PEOPLE.length], o = (rnd() - 0.5) * 3; PEOPLE_W.push({ p: [p[0] + o, p[1] + o, p[2] + o, p[3] + o, p[4]], sp: 0.01 + rnd() * 0.012, ph: rnd() * 6.28 }); }
    const g = (() => { const parts = [[new THREE.CylinderGeometry(0.22, 0.26, 1.0, 6).translate(0, 0.95, 0), WHITE], [new THREE.CylinderGeometry(0.1, 0.1, 0.5, 4).translate(-0.1, 0.25, 0), VCOL.dark], [new THREE.CylinderGeometry(0.1, 0.1, 0.5, 4).translate(0.1, 0.25, 0), VCOL.dark], [new THREE.SphereGeometry(0.2, 8, 6).translate(0, 1.65, 0), lin(0xe0b48c)]]; const pos = [], nor = [], col = []; for (const [g0, c] of parts) { const gg = g0.toNonIndexed(); pos.push(...gg.attributes.position.array); nor.push(...gg.attributes.normal.array); for (let i = 0; i < gg.attributes.position.count; i++) col.push(c.r, c.g, c.b); } const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g1.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g1.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g1; })();
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), PEOPLE_W.length), c = new THREE.Color();
    PEOPLE_W.forEach((w, i) => m.setColorAt(i, c.set(pick([0xe8483f, 0x2e74c9, 0xf2b705, 0x1f8f5b, 0xffffff, 0xff6f91])).convertSRGBToLinear())); m.castShadow = true; m.frustumCulled = false; scene.add(m); people = { m, t: 0 };
  }

  // ---------- each frame ----------
  const SUN = new THREE.Vector3(-0.5, 0.68, 0.53).normalize();
  function frame(dt) {
    clock += dt; controls.update();
    const t = controls.target; if (!fly) { t.x = clamp(t.x, -620, 620); t.z = clamp(t.z, -470, 280); } t.y = TOWN_Y;
    const dist = camDist = camera.position.distanceTo(t);
    camera.near = clamp(dist * 0.03, 0.5, 30); camera.far = dist * 5 + 2500; camera.updateProjectionMatrix();
    scene.fog.near = dist * 1.8 + 500; scene.fog.far = dist * 5 + 3000;
    const size = clamp(dist * 1.6, 120, 1400), cam = sun.shadow.camera; cam.left = cam.bottom = -size / 2; cam.right = cam.top = size / 2; cam.near = 1; cam.far = size * 2 + 600; cam.updateProjectionMatrix();
    const texel = size / sun.shadow.mapSize.x, c = t.clone(), right = new THREE.Vector3().crossVectors(SUN, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, SUN);
    c.copy(right).multiplyScalar(Math.round(t.dot(right) / texel) * texel).addScaledVector(up, Math.round(t.dot(up) / texel) * texel).addScaledVector(SUN, t.dot(SUN));
    sun.target.position.copy(c); sun.position.copy(c).addScaledVector(SUN, size + 300);
    for (const [m, a, b] of fadeMats) { const o = 1 - smooth(a, b, dist); m.opacity = o; m.visible = o > 0.01; m.depthWrite = o > 0.99; }
    for (const f of tick) f(dt, clock);
    renderer.render(scene, camera);
  }
  function view(x, z, dist, polar, az) { return { t: new THREE.Vector3(x, TOWN_Y, z), dist, polar, az }; }
  function place(v) { const s = Math.sin(v.polar) * v.dist; controls.target.copy(v.t); camera.position.set(v.t.x + Math.sin(v.az) * s, v.t.y + Math.cos(v.polar) * v.dist, v.t.z + Math.cos(v.az) * s); camera.lookAt(v.t); }
  function current() { const d = camera.position.clone().sub(controls.target), dist = d.length(); return { t: controls.target.clone(), dist, polar: Math.acos(clamp(d.y / dist, -1, 1)), az: Math.atan2(d.x, d.z) }; }
  let fly = null;
  function flyTo(v, secs = 1.4, done) { fly = { a: current(), b: v, k: 0, secs, done }; controls.enabled = false; }
  function step(dt) {
    dt = clamp(dt || 0, 0, 0.1); // a frame timestamp can come in earlier than the clock read before it: never step backwards
    if (fly) { fly.k = Math.min(1, fly.k + dt / fly.secs); const e = fly.k < 0.5 ? 4 * fly.k ** 3 : 1 - (-2 * fly.k + 2) ** 3 / 2, a = fly.a, b = fly.b; let daz = Math.atan2(Math.sin(b.az - a.az), Math.cos(b.az - a.az));
      place({ t: a.t.clone().lerp(b.t, e), dist: Math.exp(mix(Math.log(a.dist), Math.log(b.dist), e)), polar: mix(a.polar, b.polar, e), az: a.az + daz * e }); if (fly.k >= 1) { const d = fly.done; fly = null; controls.enabled = true; if (d) d(); } }
    frame(dt);
  }
  const fit = d => d * clamp(1.3 / camera.aspect, 1, 2);
  const overview = () => view(-20, -90, fit(1350), 0.6, 0.3);
  const viewOf = b => view(b.x, b.z, fit(clamp(Math.max(b.w, b.d, b.h) * 2.6, 60, 300)), 0.9, b.rot + 0.6);
  const homeView = () => view(World.home.x - 20, World.home.z, fit(95), 0.86, 0.9);

  // picking, the marker ring, property pictures
  const ray = new THREE.Raycaster();
  function pickAt(nx, ny) { ray.setFromCamera({ x: nx, y: ny }, camera); const o = ray.ray.origin, dir = ray.ray.direction; let best = null, bt = 1e9;
    for (const b of buildings) { const tC = (b.x - o.x) * dir.x + (b.h / 2 + b.y - o.y) * dir.y + (b.z - o.z) * dir.z; if (tC < 0) continue; const px = o.x + dir.x * tC, py = o.y + dir.y * tC, pz = o.z + dir.z * tC, c = Math.cos(-b.rot), s = Math.sin(-b.rot), lx = (px - b.x) * c - (pz - b.z) * s, lz = (px - b.x) * s + (pz - b.z) * c; if (Math.abs(lx) < b.w / 2 + 1 && Math.abs(lz) < b.d / 2 + 1 && py < b.h + b.y + 2 && tC < bt) { bt = tC; best = b; } }
    return best; }
  let marker = null;
  function mark(b) {
    if (!marker) { marker = new THREE.Group(); const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, depthWrite: false })); ring.renderOrder = 5; marker.add(ring); marker.ring = ring; const pin = new THREE.Mesh(new THREE.ConeGeometry(2, 4.5, 16).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: lin(0xffd21f), emissive: lin(0x7a5a00) })); marker.add(pin); marker.pin = pin; scene.add(marker); tick.push((dt, t) => { if (marker.visible) { marker.pin.position.y = marker.h + 5 + Math.sin(t * 3); marker.ring.material.opacity = 0.65 + Math.sin(t * 4) * 0.3; } }); }
    marker.visible = !!b; if (!b) return; marker.position.set(b.x, b.y + 0.4, b.z); marker.ring.scale.setScalar(Math.hypot(b.w, b.d) / 2 + 3); marker.h = b.h;
  }
  const shots = new Map(); let rt = null;
  function photo(b) {
    if (shots.has(b.id)) return shots.get(b.id);
    const W = 480, H = 300, SS = 2; if (!rt) { rt = new THREE.WebGLRenderTarget(W * SS, H * SS); rt.texture.encoding = THREE.sRGBEncoding; }
    const cam = new THREE.PerspectiveCamera(30, W / H, 1, 3000), az = b.rot + 0.62, pol = 1.05, dir = new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)), R0 = Math.hypot(b.w, b.d) / 2 + 6, centre = new THREE.Vector3(b.x, b.y + b.h * 0.42, b.z);
    const fovV = cam.fov * Math.PI / 180, fovH = 2 * Math.atan(Math.tan(fovV / 2) * cam.aspect), need = Math.max((b.h * 0.62 + 4) / Math.tan(fovV / 2), R0 / Math.tan(fovH / 2)) * 1.12;
    cam.position.copy(centre).addScaledVector(dir, need); cam.lookAt(centre); cam.near = need * 0.2; cam.far = need * 6; cam.updateProjectionMatrix();
    const vis = marker && marker.visible; if (marker) marker.visible = false; for (const [m] of fadeMats) { m.opacity = 1; m.visible = true; }
    const fog = [scene.fog.near, scene.fog.far]; scene.fog.near = 1e5; scene.fog.far = 2e5; renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null); [scene.fog.near, scene.fog.far] = fog; if (marker) marker.visible = vis;
    const BW = W * SS, BH = H * SS, px = new Uint8Array(BW * BH * 4); renderer.readRenderTargetPixels(rt, 0, 0, BW, BH, px);
    const big = document.createElement('canvas'); big.width = BW; big.height = BH; const bg = big.getContext('2d'), img = bg.createImageData(BW, BH); for (let y = 0; y < BH; y++) img.data.set(px.subarray((BH - 1 - y) * BW * 4, (BH - y) * BW * 4), y * BW * 4); bg.putImageData(img, 0, 0);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, W, H); const url = cv.toDataURL('image/jpeg', 0.86); shots.set(b.id, url); return url;
  }

  // ---------- checks: the network, every route to the harbour both ways, and a probe drive along each ----------
  function roadReport() {
    const seen = new Set(['K']), stack = ['K']; while (stack.length) { const u = stack.pop(); for (const e of nodes[u].edges) { const v = e.a.id === u ? e.b.id : e.a.id; if (!seen.has(v)) { seen.add(v); stack.push(v); } } }
    let wet = 0, maxSlope = 0; for (const e of edges) for (let i = 0; i < e.pts.length; i++) { const p = e.pts[i]; if (e.kind !== 'bridge' && land(p[0], p[2]) < 1) wet++; if (i) { const q = e.pts[i - 1]; maxSlope = Math.max(maxSlope, Math.abs(p[1] - q[1]) / (Math.hypot(p[0] - q[0], p[2] - q[2]) || 1)); } }
    const clash = buildings.filter(b => { const c = Math.cos(b.rot), s = Math.sin(b.rot); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const lx = i / 4 * b.w * 0.95, lz = j / 4 * b.d * 0.95; if (nearRoad(b.x + lx * c + lz * s, b.z - lx * s + lz * c)[0] < -0.3) return true; } return false; }).map(b => b.name);
    return { nodes: Object.keys(nodes).length, edges: edges.length, connected: seen.size === Object.keys(nodes).length, deadEnds: Object.values(nodes).filter(n => n.deg === 1).map(n => `${n.id} (turning circle r=${n.r} m)`), roadPointsOverWater: wet, maxGrade: +(maxSlope * 100).toFixed(1) + '%', buildingsOnRoads: clash };
  }
  function probe(r) { // drive the route's lanes and connectors at speed and measure every step
    const pieces = []; for (let i = 0; i + 1 < r.length; i++) { const ln = laneBetween(r[i], r[i + 1]); if (!ln) return { ok: false, why: `no lane ${r[i]}→${r[i + 1]}` }; if (pieces.length) pieces.push(connector(pieces[pieces.length - 1], ln)); pieces.push(ln); }
    let maxJump = 0, maxTurn = 0, wet = 0, last = null, lastH = null, len = 0, worst = null, ratio = 0, vPrev = 0; const dt = 1 / 60;
    const all = makePath(pieces.flatMap((q, i) => i ? q.pts.slice(1) : q.pts)); let base = 0; /* the whole drive as one joined line, steered 2.5 m ahead like the cars */
    for (const p of pieces) { const v = Math.min(13, p.vmax); len += p.len; for (let s = 0; s <= p.len; s += v * dt) { poseAt(p, s, _p); poseAt(all, Math.min(all.len, base + s + 2.5), _b); const h = Math.atan2(_b.x - _p.x, _b.z - _p.z); if (last) { maxJump = Math.max(maxJump, last.distanceTo(_p)); ratio = Math.max(ratio, last.distanceTo(_p) / (Math.max(v, vPrev) * dt)); const tr = Math.abs(Math.atan2(Math.sin(h - lastH), Math.cos(h - lastH))) / dt; if (tr > maxTurn) { maxTurn = tr; worst = { kind: p.kind, s: +s.toFixed(2), len: +p.len.toFixed(2), at: p.kind === 'lane' ? p.from.id + '>' + p.to.id : p.node.id }; } } if (!(p.kind === 'lane' && p.e.kind === 'bridge') && land(_p.x, _p.z) < 0.5 && !(p.kind === 'conn' && p.node.edges.some(e => e.kind === 'bridge'))) wet++; last = (last || new THREE.Vector3()).copy(_p); lastH = h; vPrev = v; } base += p.len; }
    return { ok: ratio < 1.6 && maxTurn < 3 && wet === 0, length: Math.round(len), maxStepRatio: +ratio.toFixed(2), maxTurnRate: +maxTurn.toFixed(2), overWater: wet, worst };
  }
  function routeTest() {
    const places = { 'Beachfront (hotel)': 'J', 'Old Quarter (shops)': 'C', 'Old Quarter (High St)': 'H', 'Business Centre': 'G2', 'Stadium car park': 'SP', 'Greenfields co-op': 'FA', 'Greenfields west yard': 'FB', 'Greenfields north yard': 'FC', 'Villa Point': 'V4', 'Marina': 'MQ', 'Industrial Isle (plant)': 'P', 'Industrial Isle (far side)': 'R' }, out = [];
    for (const [name, id] of Object.entries(places)) for (const [a, b, dir] of [[id, 'K', 'to harbour'], ['K', id, 'from harbour']]) { const r = route(a, b); out.push(Object.assign({ route: `${name} ${dir}`, path: r ? r.join('→') : null }, r ? probe(r) : { ok: false, why: 'no route' })); }
    for (const [a, b] of [['L', 'O'], ['O', 'L']]) { const r = route(a, b); out.push(Object.assign({ route: `Bridge ${a === 'L' ? 'eastbound' : 'westbound'}`, path: r && r.join('→') }, probe(r))); }
    return out;
  }
  function setClosed(edgeKind, closed) { // close or reopen a road; vehicles already planning to use it re-plan or wait
    for (const e of edges) if (e.kind === edgeKind) e.closed = closed;
    if (barrier) barrier.visible = closed && edgeKind === 'bridge';
    for (const c of cars) if (c.path.kind === 'lane' && c.conn && c.conn.to.e.closed) c.conn = null; // not yet at the junction: choose again (cars already turning onto it carry on)
    for (const c of cars) if (c.ship && c.ship.status === 'travelling') { const r = route(c.path.to.id, c.ship.to); if (r) c.route = r; else { c.route = null; c.ship.status = 'failed'; c.ship.why = 'Route closed: driving round until it reopens'; c.ship.t = 2; } }
  }
  let barrier = null;
  function colourReport() { // what the screen actually shows for grass, sand, shallow and deep water, roads and roofs at the current view
    const gl = renderer.getContext(), px = new Uint8Array(4), probeAt = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera), sx = Math.round((v.x + 1) / 2 * gl.drawingBufferWidth), sy = Math.round((v.y + 1) / 2 * gl.drawingBufferHeight); if (Math.abs(v.x) > 0.98 || Math.abs(v.y) > 0.98 || v.z > 1) return 'off-screen'; renderer.render(scene, camera); gl.readPixels(sx, sy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return '#' + [...px.slice(0, 3)].map(c => c.toString(16).padStart(2, '0')).join(''); };
    return { grass: probeAt(-150, TOWN_Y, -60), sand: probeAt(-120, heightAt(-120, 190), 190), shallow: probeAt(-120, 0, 232), deep: probeAt(-60, 0, 330), road: probeAt(0, TOWN_Y + 0.15, 55), roof: probeAt(47, World.home.y + World.home.h - 1.5, -22) };
  }

  function simulate(seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) { clock += dt; for (const f of tick) f(dt, clock); } return stats; } // the same traffic code without drawing, for tests
  return { simulate, dispatch, routeInfo, SPARE, init: (c, q) => { init(c, q); buildPeople(); }, step, frame, place, view, flyTo, current, overview, viewOf, homeView, pickAt, mark, photo, buildings, LABELS, nodes, edges, cars, SHIP, stats, roadReport, routeTest, setClosed, colourReport, route, land, heightAt,
    get camera() { return camera; }, get renderer() { return renderer; }, get scene() { return scene; }, get controls() { return controls; }, get flying() { return !!fly; }, get dist() { return camDist; } };
})();
