// Life on the water, in the air and on the beaches: boats with wakes, ferries and ships, airliners with trails, a helicopter, balloons, gulls,
// and the beaches (lifeguard towers with lifeguards, umbrellas, kiosks, buoys, swimmers, kayaks). Everything here only moves or decorates:
// it never changes the land, the roads or the plots. © 2026 Pocket Rocket Studio
(function () {
  'use strict';
  const G = window.IslandGeo; if (!G || !G.EXPANDED) return;
  World.regions.push(function (K) {
    const { THREE, scene, tick, land, heightAt, clamp, nearRoad, blockedAt } = K, T0 = performance.now();
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7771), L = World.life = { boats: 0, planes: 0, gulls: 0, towers: 0, umbrellas: 0, swimmers: 0, routes: 0, ms: {} };
    const camScale = () => 1 + clamp((World.dist - 700) / 1500, 0, 2.2); // far away, boats and planes are drawn bigger so they still show
    // ---------- a tiny modeller: boxes, cylinders, spheres and flat triangles with their colours baked in, joined into one geometry ----------
    const BOXG = new THREE.BoxGeometry(1, 1, 1), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), c3 = new THREE.Color();
    function acc() {
      const pos = [], nor = [], col = [];
      const push = (g, hex, m) => { const t = g.index ? g.toNonIndexed() : g.clone(); if (m) t.applyMatrix4(m); const a = t.attributes.position.array, n = t.attributes.normal.array; c3.setHex(hex).convertSRGBToLinear(); for (let i = 0; i < a.length; i++) { pos.push(a[i]); nor.push(n[i]); } for (let i = 0; i < a.length; i += 3) col.push(c3.r, c3.g, c3.b); };
      const M = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx, sy, sz));
      const tri = (a, b, c, hex, hint) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
        c3.setHex(hex).convertSRGBToLinear(); for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); nor.push(nx, ny, nz); col.push(c3.r, c3.g, c3.b); } };
      return { box: (w, h, d, x, y, z, hex, ry, rx, rz) => push(BOXG, hex, M(x, y, z, rx, ry, rz, w, h, d)), cyl: (rt, rb, h, x, y, z, hex, seg = 10, rx, rz, ry) => push(new THREE.CylinderGeometry(rt, rb, h, seg), hex, M(x, y, z, rx, ry, rz, 1, 1, 1)),
        sph: (r, x, y, z, hex, sx = 1, sy = 1, sz = 1) => push(new THREE.SphereGeometry(1, 10, 6), hex, M(x, y, z, 0, 0, 0, r * sx, r * sy, r * sz)), cone: (r, h, x, y, z, hex, seg = 10, rx, rz) => push(new THREE.ConeGeometry(r, h, seg), hex, M(x, y, z, rx, 0, rz, 1, 1, 1)), tri, quad: (a, b, c, d, hex, hint) => { tri(a, b, c, hex, hint); tri(a, c, d, hex, hint); },
        count: () => pos.length / 3, geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; } };
    }
    // a hull lofted from stations along its length: topsides (painted), bottom, deck; +z is the bow, the waterline is y = 0
    function hull(P, F, len, beam, depth, deck) {
      const ST = 12, S = []; for (let i = 0; i <= ST; i++) { const t = i / ST, wide = t < 0.12 ? 0.82 + 0.18 * t / 0.12 : t < 0.55 ? 1 : Math.pow(Math.max(0, Math.cos((t - 0.55) / 0.45 * Math.PI / 2)), 0.8); S.push({ z: (t - 0.5) * len, wd: beam / 2 * wide, dk: depth * (0.8 + 0.3 * t * t), kl: -depth * (0.55 - 0.2 * t * t) }); }
      const sec = s => [[s.wd, s.dk], [s.wd * 0.97, 0], [s.wd * 0.6, s.kl * 0.8], [0, s.kl], [-s.wd * 0.6, s.kl * 0.8], [-s.wd * 0.97, 0], [-s.wd, s.dk]];
      for (let i = 0; i < ST; i++) { const a = sec(S[i]), b = sec(S[i + 1]);
        for (let k = 0; k < 6; k++) { const top = k === 0 || k === 5, A = top ? P : F, hex = top ? 0xffffff : 0x8c2f2f, cx = (a[k][0] + a[k + 1][0]) / 2, cy = (a[k][1] + a[k + 1][1]) / 2; A.quad([a[k][0], a[k][1], S[i].z], [a[k + 1][0], a[k + 1][1], S[i].z], [b[k + 1][0], b[k + 1][1], S[i + 1].z], [b[k][0], b[k][1], S[i + 1].z], hex, [cx, cy < 0 ? cy - 0.3 : 0.2, 0]); }
        F.quad([a[0][0], a[0][1], S[i].z], [a[6][0], a[6][1], S[i].z], [b[6][0], b[6][1], S[i + 1].z], [b[0][0], b[0][1], S[i + 1].z], deck, [0, 1, 0]); }
    }
    const WIN = 0x24384c;
    // each type: [paint parts (tinted per boat), fixed parts]; length in metres
    const TYPES = {
      fishing: { len: 9, build(P, F) { hull(P, F, 9, 2.9, 1.5, 0xc9a26b); P.box(2.1, 1.9, 2.5, 0, 1.9, -1.5, 0xffffff); F.box(1.9, 0.6, 0.08, 0, 2.2, -0.22, WIN); F.box(2.3, 0.2, 2.8, 0, 2.95, -1.5, 0xd8d8d8); F.cyl(0.07, 0.07, 4.6, 0, 3.1, 1.3, 0xcfcfcf, 6); F.box(0.06, 0.06, 3.2, 0, 3.9, 2.4, 0xcfcfcf, 0, -0.5); F.box(1.4, 0.7, 1.6, 0.4, 1.35, 1.8, 0xe08a2e); F.sph(0.5, -0.7, 1.4, 2.6, 0xf2f2f2); } },
      sail: { len: 10, build(P, F) { hull(P, F, 10, 3.0, 1.3, 0xd9b88a); F.box(1.8, 0.7, 2.6, 0, 1.5, -0.6, 0xf2efe6); F.box(1.7, 0.4, 0.06, 0, 1.6, 0.72, WIN); F.cyl(0.07, 0.09, 13, 0, 7.2, 0.7, 0xdddddd, 6); F.cyl(0.05, 0.05, 4.6, 0, 2.2, -1.2, 0xdddddd, 6, Math.PI / 2);
        for (const [ax, hex] of [[0, 0xffffff]]) { F.tri([0, 11.4, 0.55], [0, 2.4, 0.55], [0, 2.4, -3.6], 0xf4f1ea, [1, 0, 0]); F.tri([0, 11.4, 0.55], [0, 2.4, -3.6], [0, 2.4, 0.55], 0xf4f1ea, [-1, 0, 0]); F.tri([0, 10.2, 1.0], [0, 2.0, 4.6], [0, 2.0, 1.0], 0xe9f1f6, [1, 0, 0]); F.tri([0, 10.2, 1.0], [0, 2.0, 1.0], [0, 2.0, 4.6], 0xe9f1f6, [-1, 0, 0]); void ax; void hex; } } },
      speed: { len: 6.2, build(P, F) { hull(P, F, 6.2, 2.2, 1.0, 0xe8e2d4); F.box(1.5, 0.5, 0.9, 0, 1.3, 0.2, 0x35506a, 0, -0.5); F.box(1.7, 0.5, 1.3, 0, 0.95, -1.5, 0xf2efe6); P.box(0.3, 0.3, 2.4, 0.95, 0.9, -0.2, 0xffffff); P.box(0.3, 0.3, 2.4, -0.95, 0.9, -0.2, 0xffffff); F.box(0.5, 0.9, 0.5, 0, 0.7, -3.2, 0x20242a); } },
      yacht: { len: 22, build(P, F) { hull(P, F, 22, 5.2, 2.4, 0xe6dcc6); P.box(4.4, 1.9, 11, 0, 3.2, -2.5, 0xffffff); F.box(4.5, 0.6, 9, 0, 3.4, -2.5, WIN); P.box(3.6, 1.7, 6, 0, 5.0, -3.2, 0xffffff); F.box(3.7, 0.55, 4.6, 0, 5.2, -3.2, WIN); F.box(3.9, 0.25, 6.4, 0, 5.95, -3.2, 0xeeeeee); F.cyl(0.07, 0.07, 3, 0, 7.4, -3.4, 0xdddddd, 6); F.box(0.9, 0.12, 0.9, 0, 6.5, -3.4, 0x444c55); F.box(3.4, 0.5, 4.5, 0, 2.7, 5.4, 0xf2efe6); } },
      ferry: { len: 36, build(P, F) { hull(P, F, 36, 8.4, 3.2, 0xe8e8e8); P.box(7.8, 3.0, 28, 0, 4.9, -1.5, 0xffffff); F.box(7.9, 1.1, 27, 0, 5.1, -1.5, WIN); P.box(7.0, 2.8, 22, 0, 7.8, -2.5, 0xffffff); F.box(7.1, 1.0, 21, 0, 8.0, -2.5, WIN); P.box(6.2, 2.2, 6.5, 0, 10.5, 3.2, 0xf5f5f5); F.box(6.3, 0.8, 5.6, 0, 10.7, 3.4, WIN); F.box(7.4, 0.3, 24, 0, 9.3, -2.5, 0xd9dde0); F.cyl(1.1, 1.3, 3.2, 0, 11, -9, 0xd8392b, 12); F.cyl(1.12, 1.12, 0.6, 0, 12.4, -9, 0x222831, 12); } },
      cargo: { len: 96, build(P, F) { hull(P, F, 96, 15, 8, 0x9c4a32); const cols = [0xd8392b, 0x2e74c9, 0x1f8f5b, 0xf2a531, 0xdfe3e6, 0x8e44ad]; for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { const h = 1 + ((i * 5 + j * 3) % 3); for (let k = 0; k < h; k++) F.box(2.4, 2.5, 9.4, -4.8 + j * 3.2, 10 + k * 2.5, 6 + i * 9.4 - 36, cols[(i * 3 + j * 2 + k) % cols.length]); } P.box(13, 15, 9, 0, 13, -42, 0xf5f2ec); F.box(13.2, 1.6, 7, 0, 18, -42, WIN); F.cyl(2.3, 2.7, 6, 0, 22, -44, 0xd8392b, 12); } },
      tug: { len: 14, build(P, F) { hull(P, F, 14, 5.4, 2.2, 0x2a2f36); P.box(3.6, 3.4, 5, 0, 3.4, -1.6, 0xd8392b); F.box(3.7, 0.9, 4, 0, 3.7, -1.5, WIN); F.cyl(0.6, 0.7, 2.2, 0, 6.2, -2.8, 0xffffff, 10); F.cyl(0.62, 0.62, 0.5, 0, 7.3, -2.8, 0x111111, 10); for (const s of [-1, 1]) F.box(0.5, 0.6, 5, s * 2.5, 0.8, 1.2, 0x222222); } },
      rescue: { len: 6.5, build(P, F) { F.box(2.6, 0.7, 6.4, 0, 0.25, 0, 0xd9ddE2); P.box(0.8, 0.8, 6.4, 1.2, 0.4, 0, 0xff7a1a); P.box(0.8, 0.8, 6.4, -1.2, 0.4, 0, 0xff7a1a); P.box(0.9, 0.9, 1.4, 0, 0.45, 3.1, 0xff7a1a); F.box(0.7, 1.0, 0.5, 0, 1.0, -0.6, 0x20242a); F.box(0.9, 0.4, 0.2, 0, 1.6, -0.8, 0x35506a, 0, -0.4); F.box(0.4, 0.5, 0.4, 0, 0.6, -3.0, 0x20242a); } },
      kayak: { len: 3.6, build(P, F) { P.box(0.55, 0.25, 3.4, 0, 0.12, 0, 0xffffff); P.sph(0.4, 0, 0.12, 1.7, 0xffffff, 0.7, 0.5, 1.2); F.sph(0.25, 0, 0.5, -0.1, 0xe8c9a0, 1, 1, 1); F.box(0.3, 0.5, 0.2, 0, 0.35, -0.1, 0xd8392b); F.box(0.05, 0.05, 2.0, 0, 0.55, 0.1, 0xdddddd, 0.25, 0, 0.12); } },
      jetski: { len: 3.0, build(P, F) { P.box(0.8, 0.45, 2.8, 0, 0.3, 0, 0xffffff); P.box(0.7, 0.25, 1.0, 0, 0.7, 0.9, 0xffffff); F.box(0.5, 0.3, 0.7, 0, 0.7, -0.4, 0x20242a); F.box(0.7, 0.06, 0.06, 0, 0.95, 0.7, 0x20242a); F.sph(0.28, 0, 1.05, -0.4, 0xe8c9a0); F.box(0.34, 0.5, 0.24, 0, 0.78, -0.45, 0xe8483f); } } };
    // ---------- sea lanes: routes offset from each coast, kept in open water ----------
    const wet = (x, z, d) => land(x, z) < -d;
    function lanes(P, off, clear) { // runs of points about `off` m out from the shore, with the outward direction at each; broken wherever the water is too shallow or another island is near
      const pts = G.curve(P, 6), n = pts.length, good = [], runs = []; let cur = [], last = null;
      for (let i = 0; i < n; i++) { const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1; let nx = -tz / l, nz = tx / l; const p = pts[i]; if (land(p[0] + nx * 8, p[1] + nz * 8) > land(p[0] - nx * 8, p[1] - nz * 8)) { nx = -nx; nz = -nz; } good.push(wet(p[0] + nx * off, p[1] + nz * off, clear) ? [p[0] + nx * off, p[1] + nz * off, nx, nz] : null); }
      const flush = () => { if (cur.length > 5) runs.push(cur); cur = []; last = null; };
      for (let i = 0; i < n; i++) { const q = good[i]; if (!q) { flush(); continue; } if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) < 46) continue; if (last) { let ok = true; for (let k = 1; k < 6; k++) if (!wet(last[0] + (q[0] - last[0]) * k / 6, last[1] + (q[1] - last[1]) * k / 6, clear * 0.8)) ok = false; if (!ok) flush(); } cur.push(q); last = q; }
      flush(); return runs;
    }
    function loopOf(run, gap) { // out along the run and back a little further out: a closed circuit
      const back = run.map(q => [q[0] + q[2] * gap, q[1] + q[3] * gap]).reverse().filter(q => wet(q[0], q[1], 30)); return run.map(q => [q[0], q[1]]).concat(back.length > 3 ? back : []);
    }
    function route(points, ds = 7) { // a closed smooth line sampled every ds metres
      const cv = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal'), len = cv.getLength(), n = Math.max(8, Math.round(len / ds)), xy = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { const p = cv.getPoint(i / n); xy[i * 2] = p.x; xy[i * 2 + 1] = p.z; } return { xy, n, ds: len / n, len };
    }
    const RUNS = []; // [{ pts, loop, off, len }]
    { const t0 = performance.now(); G.COAST_LISTS.slice(0, 4).forEach((P, isl) => { for (const off of [100, 215]) for (const r of lanes(P, off, off * 0.45)) { const loop = loopOf(r, 30); if (loop.length > 8) RUNS.push({ isl, off, loop, len: r.length * 46 }); } }); L.routes = RUNS.length; L.ms.lanes = Math.round(performance.now() - t0); }
    // ---------- the boats ----------
    const BOATS = []; const MESH = {}, bob = new THREE.Vector3();
    const mat = o => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.55, metalness: 0.04 }, o || {}));
    function addType(name, count) { const T = TYPES[name], P = acc(), F = acc(); T.build(P, F); const pm = new THREE.InstancedMesh(P.geo(), mat(), count), fm = new THREE.InstancedMesh(F.geo(), mat(), count); pm.setColorAt(0, c3.setRGB(1, 1, 1)); pm.instanceColor.array.fill(1); pm.castShadow = fm.castShadow = name === 'cargo' || name === 'ferry' || name === 'yacht'; pm.frustumCulled = fm.frustumCulled = false; pm.count = fm.count = 0; scene.add(pm, fm); MESH[name] = { pm, fm, n: 0, cap: count, len: T.len }; }
    const WK = { cap: 100, n: 0 }; { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -1, 0, -1, 1, 0, -1], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, -1, 1, 1, 1], 2));
      WK.a = new Float32Array(WK.cap * 4); WK.b = new Float32Array(WK.cap * 4); g.setAttribute('ia', new THREE.InstancedBufferAttribute(WK.a, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('ib', new THREE.InstancedBufferAttribute(WK.b, 4).setUsage(THREE.DynamicDrawUsage)); g.instanceCount = 0;
      WK.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        vertexShader: 'attribute vec4 ia;attribute vec4 ib;varying vec2 vU;varying float vF;void main(){vU=uv;vF=ib.w;float c=cos(ia.w),s=sin(ia.w);vec2 p=vec2(position.x*ib.x,position.z*ib.y);vec2 r=vec2(p.x*c+p.y*s,-p.x*s+p.y*c);gl_Position=projectionMatrix*viewMatrix*vec4(ia.x+r.x,ia.y,ia.z+r.y,1.0);}',
        fragmentShader: 'varying vec2 vU;varying float vF;void main(){float v=vU.y;float u=abs(vU.x)/max(v,0.001);float a=(1.0-v)*(0.12+0.5*smoothstep(0.5,0.98,u))+(1.0-v)*0.5*(1.0-smoothstep(0.0,0.16,abs(vU.x)))*(1.0-smoothstep(0.0,0.6,v));a*=vF;if(a<0.01)discard;gl_FragColor=vec4(1.0,1.0,1.0,min(0.85,a));}' })); WK.mesh.frustumCulled = false; WK.mesh.renderOrder = 3; scene.add(WK.mesh); }
    function addBoat(name, r, o = {}) { const M = MESH[name]; if (!M || M.n >= M.cap) return null; const b = { name, M, i: M.n++, r, s: rng() * r.len, v: (o.v || 4) * (0.85 + rng() * 0.3), dir: o.dir || (rng() < 0.5 ? 1 : -1), ph: rng() * 6.28, wk: o.wake !== false, tint: o.tint, sc: o.sc || 1 }; BOATS.push(b); L.boats++; M.pm.count = M.fm.count = M.n;
      const c = new THREE.Color(o.tint != null ? o.tint : [0xffffff, 0xf4efe6, 0xe9f1f6, 0xfff3d6, 0xe3f0e8, 0xffe5e0][Math.floor(rng() * 6)]).convertSRGBToLinear(); M.pm.setColorAt(b.i, c); M.pm.instanceColor.needsUpdate = true; return b; }
    // which routes: the long ones carry ferries and ships, the shorter ones the small boats
    const byLen = RUNS.slice().sort((a, b) => b.len - a.len), far = byLen.filter(r => r.off > 150), near = byLen.filter(r => r.off <= 150);
    const need = { fishing: 12, sail: 14, speed: 7, yacht: 7, ferry: 3, cargo: 3, tug: 2 }; for (const k in need) addType(k, need[k]);
    addType('rescue', 6); addType('kayak', 14); addType('jetski', 6);
    const R = RUNS.map(r => route(r.loop.length > 10 ? r.loop : r.loop.concat(r.loop.slice().reverse())));
    const idx = list => list.map(r => RUNS.indexOf(r)), farI = idx(far), nearI = idx(near), pickR = a => a[Math.floor(rng() * a.length)];
    if (RUNS.length) {
      for (let i = 0; i < need.ferry; i++) addBoat('ferry', R[farI.length ? farI[i % farI.length] : 0], { v: 7.5 });
      for (let i = 0; i < need.cargo; i++) addBoat('cargo', R[farI.length ? farI[(i + 1) % farI.length] : 0], { v: 4.6, tint: 0xffffff });
      for (let i = 0; i < need.tug; i++) addBoat('tug', R[(nearI.length ? pickR(nearI) : 0)], { v: 3.2 });
      for (let i = 0; i < need.fishing; i++) addBoat('fishing', R[nearI.length ? pickR(nearI) : 0], { v: 3.4 });
      for (let i = 0; i < need.sail; i++) { const lst = rng() < 0.7 && nearI.length ? nearI : farI.length ? farI : nearI; addBoat('sail', R[lst.length ? pickR(lst) : 0], { v: 3.2 }); }
      for (let i = 0; i < need.speed; i++) addBoat('speed', R[pickR(RUNS.map((_, k) => k))], { v: 9.5 });
      for (let i = 0; i < need.yacht; i++) addBoat('yacht', R[pickR(RUNS.map((_, k) => k))], { v: 5.2 });
    }
    World.lifeBoat = (name, pts, o) => addBoat(name, route(pts, 5), o); // the beaches add their own small boats
    const _o = new THREE.Object3D();
    function stepBoats(dt, t) {
      const sc = camScale(); let w = 0;
      for (const b of BOATS) { const r = b.r, xy = r.xy, n = r.n; b.s = (b.s + b.dir * b.v * dt + r.len * 4) % r.len; const f = b.s / r.ds, i = Math.floor(f) % n, k = f - Math.floor(f), j = (i + 1) % n, h = ((i + (b.dir > 0 ? 3 : n - 3)) % n);
        const x = xy[i * 2] + (xy[j * 2] - xy[i * 2]) * k, z = xy[i * 2 + 1] + (xy[j * 2 + 1] - xy[i * 2 + 1]) * k, hx = xy[h * 2] - x, hz = xy[h * 2 + 1] - z, yaw = Math.atan2(hx, hz), ob = b.M, S = b.sc * sc;
        const y = 0.08 + Math.sin(t * 1.3 + b.ph) * 0.12, roll = Math.sin(t * 0.9 + b.ph) * 0.045 + (b.name === 'sail' ? 0.09 : 0), pitch = Math.sin(t * 1.1 + b.ph * 2) * 0.025;
        _o.position.set(x, y, z); _o.rotation.set(pitch, yaw, roll, 'YXZ'); _o.scale.setScalar(S); _o.updateMatrix(); ob.pm.setMatrixAt(b.i, _o.matrix); ob.fm.setMatrixAt(b.i, _o.matrix);
        if (b.wk && w < WK.cap) { const L2 = ob.len * S, sp = Math.min(1, b.v / 6), o = w * 4, bx = x - Math.sin(yaw) * L2 * 0.45, bz = z - Math.cos(yaw) * L2 * 0.45; WK.a[o] = bx; WK.a[o + 1] = 0.1; WK.a[o + 2] = bz; WK.a[o + 3] = yaw; WK.b[o] = L2 * 0.5 * (0.7 + sp * 0.6); WK.b[o + 1] = ob.len * (1.8 + sp * 2.2) * (1 + (S - 1) * 0.3); WK.b[o + 3] = 0.55 + sp * 0.4; w++; } }
      for (const k in MESH) { const M = MESH[k]; if (M.n) { M.pm.instanceMatrix.needsUpdate = true; M.fm.instanceMatrix.needsUpdate = true; } }
      WK.mesh.geometry.instanceCount = w; WK.mesh.geometry.attributes.ia.needsUpdate = true; WK.mesh.geometry.attributes.ib.needsUpdate = true;
    }
    tick.push(stepBoats);
    // ---------- the air: airliners with trails, a prop plane, a helicopter, hot-air balloons, and gulls ----------
    const t1 = performance.now();
    function airliner(A, fin, stripe) { // a twin-jet airliner, nose along +z, wings level at y = 0
      A.cyl(2.0, 2.0, 34, 0, 0, -2, 0xf4f6f8, 12, Math.PI / 2); A.cone(2.0, 7, 0, 0, 18.5, 0xf4f6f8, 12, Math.PI / 2); A.cone(2.0, 12, 0, 0.5, -22, 0xf4f6f8, 12, -Math.PI / 2); A.box(2.06, 0.5, 31, 0, 0.2, -2, stripe); A.box(2.1, 0.4, 26, 0, 0.7, 0, 0x24384c); A.box(3.4, 0.2, 5, 0, -0.9, 0, 0x9aa3ab);
      for (const s of [-1, 1]) { A.quad([s * 1.9, -0.5, 4], [s * 19, -0.2, -6], [s * 19, -0.2, -9.5], [s * 1.9, -0.5, -7], 0xe9edf0, [0, 1, 0]); A.quad([s * 1.9, -0.5, 4], [s * 19, -0.2, -6], [s * 19, -0.2, -9.5], [s * 1.9, -0.5, -7], 0xcfd5da, [0, -1, 0]); A.cyl(1.1, 0.95, 4.6, s * 7, -2.0, 0.6, 0xc9ced3, 10, Math.PI / 2); A.cyl(0.8, 0.8, 0.5, s * 7, -2.0, 3.1, 0x2b3440, 10, Math.PI / 2);
        A.quad([s * 1.8, 1.0, -17], [s * 8, 0.9, -23], [s * 8, 0.9, -25], [s * 1.8, 1.0, -22], 0xe9edf0, [0, 1, 0]); A.quad([s * 1.8, 1.0, -17], [s * 8, 0.9, -23], [s * 8, 0.9, -25], [s * 1.8, 1.0, -22], 0xcfd5da, [0, -1, 0]); }
      A.tri([0, 1.8, -14], [0, 9.5, -23], [0, 1.8, -23], fin, [1, 0, 0]); A.tri([0, 1.8, -14], [0, 1.8, -23], [0, 9.5, -23], fin, [-1, 0, 0]); A.box(0.1, 1.2, 9, 0, 2.6, -18.5, stripe);
    }
    function propPlane(A) { A.cyl(0.8, 0.5, 7, 0, 0, 0, 0xf2eee0, 10, Math.PI / 2); A.cone(0.8, 1.6, 0, 0, 4.2, 0xd8392b, 10, Math.PI / 2); A.quad([-5.2, 0.5, 1.6], [5.2, 0.5, 1.6], [5.2, 0.5, 0.2], [-5.2, 0.5, 0.2], 0xf2eee0, [0, 1, 0]); A.quad([-5.2, 0.5, 1.6], [5.2, 0.5, 1.6], [5.2, 0.5, 0.2], [-5.2, 0.5, 0.2], 0xd9d4c4, [0, -1, 0]); A.box(0.1, 1.6, 1.4, 0, 1.1, -3.2, 0xd8392b); A.box(3, 0.1, 0.9, 0, 0.3, -3.2, 0xf2eee0); A.box(1.0, 0.45, 1.2, 0, 0.55, 0.9, 0x24384c); A.box(0.5, 0.1, 0.15, 0, 0, 4.4, 0x333333, 0, 0, 0.3); }
    function balloon(A, cols) { const g = new THREE.SphereGeometry(1, 16, 10).toNonIndexed(), a = g.attributes.position.array, V = o => [a[o] * 10, a[o + 1] * 12 + 16, a[o + 2] * 10];
      for (let i = 0; i < a.length; i += 9) { const cx = (a[i] + a[i + 3] + a[i + 6]) / 3, cy = (a[i + 1] + a[i + 4] + a[i + 7]) / 3, cz = (a[i + 2] + a[i + 5] + a[i + 8]) / 3, k = Math.floor((Math.atan2(cx, cz) + Math.PI) / (Math.PI * 2) * cols.length * 3) % cols.length; A.tri(V(i), V(i + 3), V(i + 6), cols[k], [cx, cy, cz]); }
      A.cone(3.4, 6, 0, 4.2, 0, 0x2b2f36, 10, Math.PI); A.box(2.4, 1.6, 2.4, 0, 0.6, 0, 0xb5885a); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.box(0.08, 4, 0.08, x * 0.9, 3, z * 0.9, 0x6b4a33); }
    function heli(A) { A.sph(1.6, 0, 0, 0.4, 0xd8392b, 0.95, 0.9, 1.4); A.box(0.5, 0.5, 5.4, 0, 0.5, -3.6, 0xd8392b); A.box(0.1, 1.4, 0.9, 0, 1.2, -6.2, 0xf2f2f2); A.box(0.1, 0.1, 3.4, 0, -1.7, 0.2, 0x2b2f36, 0, 0, 0); for (const s of [-1, 1]) { A.box(0.1, 0.1, 3.4, s * 1.1, -1.7, 0.3, 0x2b2f36); A.box(0.08, 1.1, 0.08, s * 1.0, -1.15, 1.0, 0x2b2f36); A.box(0.08, 1.1, 0.08, s * 1.0, -1.15, -0.5, 0x2b2f36); } A.box(1.3, 0.55, 0.1, 0, 0.45, 1.7, 0x24384c, 0, -0.3); A.cyl(0.18, 0.18, 0.7, 0, 1.55, 0, 0x2b2f36, 6); }
    const AIR = [], air = (geoFn, o) => { const A = acc(); geoFn(A); const m = new THREE.Mesh(A.geo(), mat({ roughness: 0.45 })); m.frustumCulled = false; scene.add(m); const t = { m, cx: o.cx, cz: o.cz, rx: o.rx, rz: o.rz, rot: o.rot || 0, y: o.y, v: o.v, a: rng() * 6.28, dir: o.dir || 1, bank: 0, last: 0, trail: o.trail !== false, sc: o.sc || 1, wob: o.wob || 0, spin: null, hist: [] }; AIR.push(t); L.planes++; return t; };
    [[0xd8392b, 0xd8392b, { cx: 520, cz: 150, rx: 2300, rz: 1150, rot: 0.3, y: 360, v: 96 }], [0x2e74c9, 0x2e74c9, { cx: 900, cz: 1150, rx: 1900, rz: 850, rot: -0.4, y: 450, v: 90, dir: -1 }], [0x1f8f5b, 0xf2b705, { cx: -250, cz: -250, rx: 1500, rz: 950, rot: 0.8, y: 280, v: 84 }]].forEach(([fin, stripe, o]) => air(A => airliner(A, fin, stripe), o));
    air(propPlane, { cx: 150, cz: 250, rx: 800, rz: 520, rot: 0.2, y: 150, v: 48, sc: 1, trail: false });
    const HEL = air(heli, { cx: 5, cz: -110, rx: 330, rz: 330, rot: 0, y: 150, v: 38, trail: false, wob: 1 });
    { const A = acc(); const rot = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.05, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false })); rot.position.y = 1.9; HEL.m.add(rot);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(14, 0.06, 0.45), new THREE.MeshBasicMaterial({ color: 0x2b2f36 })); bl.position.y = 1.95; HEL.m.add(bl); HEL.spin = bl; void A; }
    const BAL = [[[0xd8392b, 0xf2f2f2, 0x2e74c9, 0xf2b705], 1000, 760, 280, 120, 2.4], [[0x1f8f5b, 0xf2b705, 0xd8392b], 1250, 1000, 220, 95, -2.0], [[0x8e44ad, 0xf2f2f2, 0xe08a2e], 700, 1100, 340, 140, 1.7], [[0x2e74c9, 0xf2f2f2], 1550, 880, 260, 110, -2.2]];
    for (const [cols, cx, cz, r, y, v] of BAL) air(A => balloon(A, cols), { cx, cz, rx: r, rz: r * 0.8, y, v: Math.abs(v), dir: v < 0 ? -1 : 1, trail: false, sc: 1, wob: 2 });
    // trails: a thin white ribbon behind each airliner, fading out
    const TR = AIR.filter(a => a.trail), TN = 34, tpos = new Float32Array(TR.length * TN * 2 * 3), tal = new Float32Array(TR.length * TN * 2), tidx = []; TR.forEach((a, k) => { for (let i = 0; i < TN - 1; i++) { const v = (k * TN + i) * 2; tidx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); } for (let i = 0; i < TN; i++) { tal[(k * TN + i) * 2] = tal[(k * TN + i) * 2 + 1] = Math.pow(1 - i / TN, 1.6) * 0.85; } });
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tpos, 3).setUsage(THREE.DynamicDrawUsage)); tg.setAttribute('al', new THREE.BufferAttribute(tal, 1)); tg.setIndex(tidx);
    const trails = new THREE.Mesh(tg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: 'attribute float al;varying float vA;void main(){vA=al;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying float vA;void main(){gl_FragColor=vec4(1.0,1.0,1.0,vA*0.7);}' })); trails.frustumCulled = false; trails.renderOrder = 7; if (TR.length) scene.add(trails);
    function stepAir(dt, t) {
      const sc = camScale();
      for (const a of AIR) { const w = a.v / ((a.rx + a.rz) / 2); a.a += a.dir * w * dt; const ca = Math.cos(a.a), sa = Math.sin(a.a), cr = Math.cos(a.rot), sr = Math.sin(a.rot), ex = ca * a.rx, ez = sa * a.rz, x = a.cx + ex * cr - ez * sr, z = a.cz + ex * sr + ez * cr;
        const dx = -sa * a.rx * a.dir, dz = ca * a.rz * a.dir, hx = dx * cr - dz * sr, hz = dx * sr + dz * cr, yaw = Math.atan2(hx, hz), y = a.y + (a.wob === 2 ? Math.sin(t * 0.3 + a.a) * 12 : Math.sin(t * 0.15 + a.a * 3) * 10), bank = clamp(a.dir * -0.22, -0.4, 0.4) * (a.wob ? 0.2 : 1);
        a.m.position.set(x, y, z); a.m.rotation.set(a.wob === 2 ? 0 : -0.04, a.wob === 2 ? 0 : yaw, a.wob === 2 ? 0 : bank, 'YXZ'); const S = a.wob === 2 ? 1 + (sc - 1) * 0.5 : sc; a.m.scale.setScalar(S); if (a.wob === 1) { a.m.rotation.x = 0.12; a.spin.rotation.y += dt * 38; }
        if (a.trail) { const hl = Math.hypot(hx, hz) || 1; a.head = [x - hx / hl * 20 * S, y, z - hz / hl * 20 * S, yaw]; a.acc = (a.acc || 0) + dt; if (a.acc > 0.35 || !a.hist.length) { a.acc = 0; a.hist.unshift(a.head); if (a.hist.length > TN) a.hist.pop(); } } }
      TR.forEach((a, k) => { for (let i = 0; i < TN; i++) { const h = i === 0 ? a.head : (a.hist[Math.min(i - 1, a.hist.length - 1)] || a.head || [0, -9999, 0, 0]), wd = (1.6 + i * 0.07) * sc, c = Math.cos(h[3]), s = Math.sin(h[3]), o = (k * TN + i) * 6; tpos[o] = h[0] + c * wd; tpos[o + 1] = h[1]; tpos[o + 2] = h[2] - s * wd; tpos[o + 3] = h[0] - c * wd; tpos[o + 4] = h[1]; tpos[o + 5] = h[2] + s * wd; } });
      tg.attributes.position.needsUpdate = true;
    }
    tick.push(stepAir);
    // gulls: instanced birds that flap, circling the harbours and beaches
    { const GN = 70, gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, -0.1, 0, -0.4, 0.1, 0, -0.4, 0, 0, 0.3, -1.2, 0, -0.1, 0, 0, -0.3, 0, 0, 0.3, 0, 0, -0.3, 1.2, 0, -0.1], 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 1, 1, 1, 0.55, 0.57, 0.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.55, 0.57, 0.6], 3));
      const ph = new Float32Array(GN); for (let i = 0; i < GN; i++) ph[i] = rng() * 6.28; gg.setAttribute('ph', new THREE.InstancedBufferAttribute(ph, 1));
      const gu = { uT: { value: 0 } }, gm = new THREE.InstancedMesh(gg, new THREE.ShaderMaterial({ uniforms: gu, side: THREE.DoubleSide, vertexShader: 'uniform float uT;attribute float ph;attribute vec3 color;varying vec3 vC;void main(){vC=color;vec3 p=position;p.y+=abs(p.x)*sin(uT*8.0+ph)*0.55;gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(p,1.0);}', fragmentShader: 'varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.0);}' }), GN); gm.frustumCulled = false; scene.add(gm);
      // flocks round: harbours, beach bays and the fishing quays (centre, radius)
      const SPOTS = [[253, 40, 120], [-130, 190, 160], [-130, 160, 110], [40, -920, 140], [850, 200, 150], [1200, 330, 140], [937, 760, 140], [2250, 1210, 110], [-560, 930, 150], [-740, -480, 120], [-760, -420, 100], [-1010, -905, 90], [700, 600, 160], [1500, 740, 130]].filter(s => land(s[0], s[1]) > -90);
      const gulls = []; for (let i = 0; i < GN; i++) { const s = SPOTS[i % SPOTS.length]; gulls.push({ cx: s[0] + (rng() - 0.5) * 30, cz: s[1] + (rng() - 0.5) * 30, r: s[2] * (0.4 + rng() * 0.8), a: rng() * 6.28, w: (0.1 + rng() * 0.12) * (rng() < 0.5 ? 1 : -1), y: 14 + rng() * 40, ph: rng() * 6 }); } L.gulls = GN;
      const o = new THREE.Object3D(); tick.push((dt, t) => { gu.uT.value = t; const S = 1 + (camScale() - 1) * 0.6; for (let i = 0; i < GN; i++) { const g = gulls[i]; g.a += g.w * dt; const x = g.cx + Math.cos(g.a) * g.r, z = g.cz + Math.sin(g.a) * g.r, yaw = Math.atan2(-Math.sin(g.a) * Math.sign(g.w), Math.cos(g.a) * Math.sign(g.w)); o.position.set(x, g.y + Math.sin(t * 0.5 + g.ph) * 3 + (heightAt(x, z) > 2 ? heightAt(x, z) * 0.5 : 0), z); o.rotation.set(0, yaw, -0.35 * Math.sign(g.w), 'YXZ'); o.scale.setScalar(S * 1.4); o.updateMatrix(); gm.setMatrixAt(i, o.matrix); } gm.instanceMatrix.needsUpdate = true; }); }
    L.ms.air = Math.round(performance.now() - t1);
    // ---------- the beaches: lifeguard towers with lifeguards, umbrellas and loungers, kiosks, swim buoys, swimmers, kayaks, jet skis and rescue boats ----------
    const t2 = performance.now(), SKIN = [0xf1c9a5, 0xd9a577, 0xa8714a, 0x7a4a2e, 0xf6d7bd], BRIGHT = [0xe8483f, 0x0f6fb8, 0xf2b705, 0xffffff, 0x1f8f5b, 0xff6f91, 0x2ec4b6, 0xff8a3d];
    function mk2(build, count) { const P = acc(), F = acc(); build(P, F); const pm = new THREE.InstancedMesh(P.geo(), mat(), count), fm = F.count() ? new THREE.InstancedMesh(F.geo(), mat(), count) : null; pm.setColorAt(0, c3.setRGB(1, 1, 1)); pm.instanceColor.array.fill(1); for (const m of [pm, fm]) if (m) { m.frustumCulled = false; m.count = 0; m.castShadow = true; scene.add(m); } return { pm, fm, n: 0, cap: count }; }
    const put = (M, x, y, z, yaw, s, tint) => { if (M.n >= M.cap) return false; _o.position.set(x, y, z); _o.rotation.set(0, yaw, 0); _o.scale.setScalar(s); _o.updateMatrix(); M.pm.setMatrixAt(M.n, _o.matrix); if (M.fm) M.fm.setMatrixAt(M.n, _o.matrix); c3.setHex(tint == null ? 0xffffff : tint).convertSRGBToLinear(); M.pm.setColorAt(M.n, c3); M.n++; M.pm.count = M.n; if (M.fm) M.fm.count = M.n; return true; };
    const BM = {
      tower: mk2((P, F) => { // a lifeguard tower: stilts, a platform with a rail, a cabin, a ladder, a flag, a rescue buoy, a board, and the lifeguard watching the sea (+z)
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F.box(0.16, 2.5, 0.16, x * 1.1, 1.25, z * 1.1, 0x8a5a33); F.box(2.4, 0.1, 0.1, 0, 0.9, 1.1, 0x8a5a33); F.box(2.4, 0.1, 0.1, 0, 0.9, -1.1, 0x8a5a33); F.box(0.1, 0.1, 2.4, 1.1, 1.5, 0, 0x8a5a33, 0, 0, 0); F.box(0.1, 0.1, 2.4, -1.1, 1.5, 0, 0x8a5a33);
        F.box(2.8, 0.14, 2.8, 0, 2.5, 0, 0xc9a26b); P.box(2.0, 1.6, 1.7, 0, 3.35, -0.45, 0xffffff); F.box(1.9, 0.7, 0.08, 0, 3.55, 0.42, 0x24384c); F.box(2.5, 0.14, 2.3, 0, 4.25, -0.35, 0xf4f1ea); F.box(2.5, 0.14, 0.5, 0, 4.4, -1.55, 0xf4f1ea, 0, 0.25);
        for (const s of [-1, 1]) F.box(0.06, 0.9, 0.06, s * 1.3, 2.97, 1.3, 0xeeeeee); F.box(2.7, 0.06, 0.06, 0, 3.4, 1.3, 0xeeeeee);
        for (const s of [-0.3, 0.3]) F.box(0.06, 2.7, 0.06, s, 1.25, -1.45, 0xd9c8a8, 0, -0.25); for (let k = 0; k < 6; k++) F.box(0.6, 0.05, 0.05, 0, 0.4 + k * 0.4, -1.28 - k * 0.0, 0xd9c8a8);
        F.cyl(0.03, 0.03, 4.4, 1.5, 4.7, -1.2, 0xeeeeee, 6); F.box(1.0, 0.55, 0.03, 1.95, 6.2, -1.2, 0xe8483f); F.box(1.0, 0.27, 0.03, 1.95, 5.9, -1.2, 0xf2b705);
        F.cyl(0.34, 0.34, 0.1, 0, 3.0, 1.38, 0xff7a1a, 12, Math.PI / 2); F.box(0.5, 0.5, 0.04, -1.45, 3.7, 0.2, 0xffffff, 1.5708); F.box(0.4, 0.08, 0.04, -1.47, 3.7, 0.2, 0xe8483f, 1.5708); F.box(0.08, 0.4, 0.04, -1.47, 3.7, 0.2, 0xe8483f, 1.5708); F.box(0.5, 0.06, 2.1, -1.0, 1.1, 1.6, 0xff7a1a, 0, 0.5);
        F.box(0.3, 0.5, 0.2, 0.7, 2.82, 0.95, 0xe8483f); F.sph(0.13, 0.7, 3.2, 0.95, 0xf1c9a5); F.box(0.34, 0.06, 0.34, 0.7, 3.36, 0.95, 0xffffff); F.box(0.11, 0.4, 0.11, 0.62, 2.45, 0.95, 0xf1c9a5); F.box(0.11, 0.4, 0.11, 0.78, 2.45, 0.95, 0xf1c9a5); F.box(0.1, 0.1, 0.4, 0.5, 3.0, 1.15, 0xf1c9a5); F.box(0.1, 0.1, 0.4, 0.9, 3.0, 1.15, 0xf1c9a5); }, 90),
      umb: mk2((P, F) => { F.cyl(0.04, 0.04, 2.5, 0, 1.25, 0, 0xeeeeee, 6); P.cone(1.2, 0.75, 0, 2.55, 0, 0xffffff, 10); F.sph(0.07, 0, 2.95, 0, 0xdddddd); }, 520),
      lounger: mk2((P, F) => { P.box(0.65, 0.09, 1.45, 0, 0.3, 0.2, 0xffffff); P.box(0.65, 0.09, 0.8, 0, 0.55, -0.85, 0xffffff, 0, 0.7); F.box(0.06, 0.3, 0.06, 0.28, 0.14, 0.7, 0xe9e9e9); F.box(0.06, 0.3, 0.06, -0.28, 0.14, 0.7, 0xe9e9e9); F.box(0.06, 0.3, 0.06, 0.28, 0.14, -0.3, 0xe9e9e9); F.box(0.06, 0.3, 0.06, -0.28, 0.14, -0.3, 0xe9e9e9); }, 900),
      kiosk: mk2((P, F) => { P.box(3.4, 2.5, 2.4, 0, 1.25, 0, 0xffffff); F.box(3.9, 0.18, 3.0, 0, 2.6, 0.1, 0xf4f1ea); F.box(3.0, 0.1, 1.5, 0, 2.3, 1.9, 0xe8483f, 0, 0.18); F.box(3.0, 0.1, 0.75, 0, 2.27, 1.9, 0xffffff, 0, 0.18); F.box(2.6, 0.95, 0.12, 0, 1.55, 1.2, 0x24384c); F.box(3.0, 0.14, 0.7, 0, 1.0, 1.5, 0xc9a26b); F.box(2.0, 0.5, 0.06, 0, 2.2, 1.24, 0xffffff); F.box(0.5, 0.3, 0.06, -0.6, 2.2, 1.28, 0xe8483f); F.box(0.5, 0.3, 0.06, 0.2, 2.2, 1.28, 0x2e74c9); for (const s of [-1, 1]) { F.cyl(0.22, 0.22, 0.55, s * 1.1, 0.3, 2.7, 0xf2efe6, 8); } }, 40),
      buoy: mk2((P, F) => { P.sph(0.32, 0, 0.12, 0, 0xffffff, 1, 1, 1); }, 360),
      swim: mk2((P, F) => { F.sph(0.14, 0, 0.1, 0.35, 0xf1c9a5); P.sph(0.2, 0, 0.0, -0.1, 0xffffff, 1, 0.55, 1.5); F.box(0.1, 0.05, 0.6, 0.28, 0.12, 0.55, 0xf1c9a5, 0.2); F.box(0.1, 0.05, 0.6, -0.28, 0.12, 0.35, 0xf1c9a5, -0.2); }, 80) };
    const SW = [], ZONES = [], REJ = { land: 0, h: 0, road: 0, bf: 0, blocked: 0, ok: 0 }, sandOK = (x, z) => { if (!(land(x, z) > 1.8)) { REJ.land++; return false; } if (!(nearRoad(x, z)[0] > 6)) { REJ.road++; return false; } if (x > -215 && x < 70 && z > 115 && z < 265) { REJ.bf++; return false; } if (blockedAt(x, z, null)) { REJ.blocked++; return false; } REJ.ok++; return true; };
    const runs = []; G.COAST_LISTS.forEach(P => { const pts = G.curve(P, 6), n = pts.length; let run = [];
      for (let i = 0; i < n; i++) { const p = pts[i], on = p[2] < 0.25 && p[3] < 0.25; if (on) { const gx = land(p[0] + 6, p[1]) - land(p[0] - 6, p[1]), gz = land(p[0], p[1] + 6) - land(p[0], p[1] - 6), l = Math.hypot(gx, gz) || 1; run.push({ x: p[0], z: p[1], nx: gx / l, nz: gz / l }); } else { if (run.length > 5) runs.push(run); run = []; } }
      if (run.length > 5) runs.push(run); });
    let beachLen = 0, nextTower = 55, nextUmb = 20, nextKiosk = 140, nextPalm = 6, towerN = 0;
    for (const run of runs) { let s = 0; const zone = { pts: [] }; // walk the beach: s is the distance along it
      for (let i = 1; i < run.length; i++) { const a = run[i - 1], b = run[i], seg = Math.hypot(b.x - a.x, b.z - a.z); if (seg < 0.1) continue; const tx = (b.x - a.x) / seg, tz = (b.z - a.z) / seg;
        while (nextTower < s + seg || nextUmb < s + seg || nextKiosk < s + seg || nextPalm < s + seg) { const nx = Math.min(nextTower, nextUmb, nextKiosk, nextPalm), f = nx - s, bx = a.x + tx * f, bz = a.z + tz * f, ix = b.nx, iz = b.nz, yaw = Math.atan2(-ix, -iz), sea = [-ix, -iz];
          const at = d => [bx + ix * d, bz + iz * d];
          if (nx === nextTower) { nextTower += 110 + rng() * 60; const [x, z] = at(5.5); if (sandOK(x, z) && towerN < 90) { put(BM.tower, x, heightAt(x, z), z, yaw, 1, [0xe8483f, 0xf2b705, 0x0f6fb8, 0xff7a1a][towerN % 4]); towerN++; L.towers++; (L.towerPos = L.towerPos || []).push([Math.round(x), Math.round(z)]); const f1 = at(7.5), f2 = [f1[0] + tx * 14, f1[1] + tz * 14]; zone.pts.push({ x: bx, z: bz, nx: ix, nz: iz, tx, tz }); } }
          else if (nx === nextUmb) { nextUmb += 22 + rng() * 26; const k = 3 + Math.floor(rng() * 3); for (let j = 0; j < k; j++) { const d = 4.2 + (j % 2) * 2.8 + rng() * 0.8, off = (j - k / 2) * 3.4 + rng(), [x, z] = at(d), px = x + tx * off, pz = z + tz * off; if (!sandOK(px, pz)) continue; const y = heightAt(px, pz), tint = BRIGHT[Math.floor(rng() * BRIGHT.length)]; put(BM.umb, px, y, pz, rng() * 6.28, 0.9 + rng() * 0.2, tint); L.umbrellas++; if (L.umbrellas % 12 === 1) (L.umbPos = L.umbPos || []).push([Math.round(px), Math.round(pz)]); for (let q = 0; q < 1 + (rng() < 0.6 ? 1 : 0); q++) { const lx = px + tx * (q ? 0.9 : -0.9) - ix * 1.2, lz = pz + tz * (q ? 0.9 : -0.9) - iz * 1.2; if (sandOK(lx, lz)) put(BM.lounger, lx, heightAt(lx, lz), lz, yaw + (rng() - 0.5) * 0.3, 1, BRIGHT[Math.floor(rng() * BRIGHT.length)]); } } }
          else if (nx === nextKiosk) { nextKiosk += 260 + rng() * 140; const [x, z] = at(9.5); if (sandOK(x, z)) put(BM.kiosk, x, heightAt(x, z), z, yaw, 1, [0xfff1d6, 0xd6ecff, 0xffd8bd, 0xe2f2d0][Math.floor(rng() * 4)]); }
          else { nextPalm += 11 + rng() * 16; const [x, z] = at(10 + rng() * 5); if (sandOK(x, z) && nearRoad(x, z)[0] > 8) K.extraTrees.push([x, heightAt(x, z), z, 0.8 + rng() * 0.4, 'palm']); }
          void sea; }
        s += seg; }
      beachLen += s; nextTower -= s; nextUmb -= s; nextKiosk -= s; nextPalm -= s; if (zone.pts.length) ZONES.push(zone); }
    // a swim zone off each fifth tower: a line of buoys, swimmers between it and the sand, and kayaks, jet skis and a rescue boat circling
    ZONES.forEach((z, zi) => { for (const T of z.pts) { if (T.done || (zi + z.pts.indexOf(T)) % 2) continue; T.done = 1; const L0 = 70, bx = T.x - T.nx * 44, bz = T.z - T.nz * 44, ok = (px, pz) => land(px, pz) < -6;
        if (!ok(bx, bz) || !ok(bx + T.tx * L0, bz + T.tz * L0)) continue; for (let k = 0; k <= L0; k += 7) { const px = bx + T.tx * k, pz = bz + T.tz * k; if (ok(px, pz)) put(BM.buoy, px, 0.05, pz, 0, 1, k % 14 ? 0xffffff : 0xff7a1a); }
        for (let k = 0; k < 3; k++) SW.push({ x0: T.x + T.tx * 6 - T.nx * (14 + k * 8), z0: T.z + T.tz * 6 - T.nz * (14 + k * 8), tx: T.tx, tz: T.tz, len: L0 - 10, a: rng() * 6.28, w: 0.12 + rng() * 0.1, tint: BRIGHT[Math.floor(rng() * BRIGHT.length)] });
        const ell = (cx, cz, rx, rz) => Array.from({ length: 10 }, (_, i) => { const a = i / 10 * 6.2832, ex = Math.cos(a) * rx, ez = Math.sin(a) * rz; return [cx + T.tx * ex - T.nx * ez, cz + T.tz * ex - T.nz * ez]; });
        const cx = bx + T.tx * L0 / 2, cz = bz + T.tz * L0 / 2; if (World.lifeBoat) { const lp = ell(cx - T.nx * 8, cz - T.nz * 8, 52, 12); if (lp.every(p => land(p[0], p[1]) < -4)) { World.lifeBoat('kayak', lp, { v: 1.4 }); World.lifeBoat('kayak', ell(cx - T.nx * 14, cz - T.nz * 14, 40, 8), { v: 1.1 }); }
          const jp = ell(cx - T.nx * 70, cz - T.nz * 70, 90, 30); if (jp.every(p => land(p[0], p[1]) < -20)) { World.lifeBoat('jetski', jp, { v: 9 }); const rp = ell(cx - T.nx * 56, cz - T.nz * 56, 70, 16); if (rp.every(p => land(p[0], p[1]) < -14)) World.lifeBoat('rescue', rp, { v: 2.6, tint: 0xff7a1a }); } } } });
    for (const k in BM) { const M = BM[k]; M.pm.instanceMatrix.needsUpdate = true; if (M.pm.instanceColor) M.pm.instanceColor.needsUpdate = true; if (M.fm) M.fm.instanceMatrix.needsUpdate = true; }
    L.swimmers = Math.min(SW.length, BM.swim.cap);
    tick.push((dt, t) => { for (let i = 0; i < L.swimmers; i++) { const w = SW[i]; w.a += w.w * dt; const f = (Math.sin(w.a) * 0.5 + 0.5) * w.len, x = w.x0 + w.tx * f, z = w.z0 + w.tz * f, yaw = Math.atan2(w.tx * Math.cos(w.a), w.tz * Math.cos(w.a)); _o.position.set(x, 0.05 + Math.sin(t * 2 + i) * 0.05, z); _o.rotation.set(0, yaw, 0); _o.scale.setScalar(1 + (camScale() - 1) * 0.5); _o.updateMatrix(); BM.swim.pm.setMatrixAt(i, _o.matrix); BM.swim.fm.setMatrixAt(i, _o.matrix); if (!w.c) { c3.setHex(w.tint).convertSRGBToLinear(); BM.swim.pm.setColorAt(i, c3); BM.swim.pm.instanceColor.needsUpdate = true; w.c = 1; } } BM.swim.pm.count = BM.swim.fm.count = L.swimmers; BM.swim.pm.instanceMatrix.needsUpdate = true; BM.swim.fm.instanceMatrix.needsUpdate = true; });
    L.rej = REJ; L.beachKm = Math.round(beachLen / 100) / 10; L.runs = runs.length; L.ms.beaches = Math.round(performance.now() - t2);
    World.lifeInfo = () => BOATS.map(b => ({ name: b.name, x: Math.round(b.r.xy[0]), z: Math.round(b.r.xy[1]) }));
    L.ms.boats = Math.round(performance.now() - T0);
  });
})();
