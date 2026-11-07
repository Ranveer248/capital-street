// Capital Island (Capital Street's island): districts, streets of several kinds, a walking network, farms, the harbour and Industrial Isle.
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

  // ---------- geography: the coast, the ground, the rivers and the road network live in geo.js, shared with the tests ----------
  const G = window.IslandGeo, { EXPANDED, MAIN_C, ISLE_C, curve, K, land, hash, vnoise, fbm, g2, FLATS, townMask, natural, nodes, edges, catmull, cumOf, offsetLine, cut, bend, trimAt, lanes, makePath, conns, connector, route, laneBetween, RSEG, RGRID, nearRoad, PADS, VILLAS, heightAt } = G;

  // ---------- the scene ----------
  let renderer, scene, camera, controls, sun, hemi, clock = 0, camDist = 400, Q = 'high';
  const tick = [], fadeMats = [], buildings = [], LABELS = [];
  const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = G.WORLD;
  // the page gets a turn to draw between the build steps, so the loading bar moves and the phone never looks frozen
  const paintNow = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 80); }); // (a hidden tab draws nothing: the timer lets it carry on)
  async function init(canvas, q, progress) { // progress(label, 0..1) is told which step is next
    Q = q || 'high';
    renderer = new THREE.WebGLRenderer({ canvas, antialias: Q !== 'low', powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, Q === 'low' ? 1 : Q === 'medium' ? 1.5 : 2));
    renderer.debug.checkShaderErrors = /[?&]debug\b/.test(location.search); // three.js asks the driver about every shader the moment it links it, which makes the driver compile them one at a time and stalls the first frame for seconds; unasked, it compiles them together
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
    controls.minDistance = 30; controls.maxDistance = EXPANDED ? 7200 : 1500; controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.1;
    hemi = new THREE.HemisphereLight(lin(0xd8ecff), lin(0x5d7a3a), 0.47); scene.add(hemi);
    sun = new THREE.DirectionalLight(lin(0xfff3df), 1.02);
    sun.castShadow = Q !== 'low'; sun.shadow.mapSize.setScalar(Q === 'high' ? 2048 : 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5; sun.shadow.radius = 3;
    scene.add(sun, sun.target);
    World.times = {};
    // the steps, with what the player is told and roughly how much of the wait each one is (measured: shaping the land and building the towns are the long ones)
    const STEPS = [['terrain', buildTerrain, 'Shaping the land', 0.22], ['ocean', buildOcean, 'Filling the sea', 0.02], ['rivers', buildRiverWater, 'Running the rivers', 0.01], ['roads', buildRoads, 'Laying the roads', 0.03], ['town', buildTown, 'Building the towns', 0.34], ['nature', buildNature, 'Planting the trees', 0.1], ['traffic', buildTraffic, 'Starting the traffic', 0.02], ['weather', buildWeather, 'Checking the weather', 0.01]];
    let done = 0; const total = STEPS.reduce((a, s) => a + s[3], 0.25);
    for (const [k, f, label, w] of STEPS) { if (progress) { progress(label, done / total); await paintNow(); } const t0 = performance.now(); f(); World.times[k] = Math.round(performance.now() - t0); done += w; }
    resize(); addEventListener('resize', resize);
    if (progress) { progress('Getting the graphics ready', done / total); await paintNow(); }
    { const t0 = performance.now(); try { renderer.compile(scene, camera); } catch (e) { /* the first frame compiles whatever is missing */ } World.times.compile = Math.round(performance.now() - t0); } // every shader is handed to the driver now, together, rather than one by one during the first frames
    if (progress) progress('Ready', 1);
  }
  function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  // a weak graphics card draws fewer pixels instead of dropping frames: slow for a few seconds -> a little lower, comfortable for a while -> a little higher
  let pxMax = 0, px = 0, pxCap = 0, pxMs = 16.7, pxN = 0, pxCalm = 0, pxAt = 0, pxTry = null, pxStop = false;
  function adapt(dt) {
    if (!(dt > 0 && dt < 0.1)) return; // a pause or a hidden tab says nothing about speed
    if (!pxMax) pxMax = px = pxCap = renderer.getPixelRatio();
    pxMs += (dt * 1000 - pxMs) * 0.06; if (++pxN < 120) return; // let the first frames settle
    const now = performance.now();
    if (pxTry) { const t = pxTry; pxTry = null; if (pxMs > t.ms * 0.92) { px = t.from; pxStop = true; pxN = 60; renderer.setPixelRatio(px); return; } } // fewer pixels did not help (a 30 Hz screen, a slow CPU): put them back, stop trying
    if (pxStop) return;
    if (pxMs > 21 && px > 0.6) { pxTry = { from: px, ms: pxMs }; px = Math.max(0.6, px * 0.85); pxCap = Math.min(pxCap, px * 1.12); pxAt = now; pxN = 60; pxCalm = 0; renderer.setPixelRatio(px); }
    else if (pxMs < 18 && px < Math.min(pxMax, pxCap) - 0.01 && ++pxCalm > 360) { px = Math.min(pxMax, pxCap, px * 1.12); pxN = 60; pxCalm = 0; renderer.setPixelRatio(px); }
    if (pxCap < pxMax && now - pxAt > 60000) pxCap = pxMax; // try the full picture again now and then
  }

  const COL = { sand: lin(0xf0cf86), wet: lin(0xd4ae6a), grass: lin(0x5cb447), grass2: lin(0x47a23c), grass3: lin(0x78c457), forest: lin(0x2f8a3a), rock: lin(0x8f8a84), rock2: lin(0x6f6c6a), floor: lin(0xc9b27a), lawn: lin(0x63bb4b), gravel: lin(0xbdb6a6), gravel2: lin(0xaaa396), quarry: lin(0xb9a48a), quarry2: lin(0xa38b73), meadow: lin(0x9ccb52), hay: lin(0xc9c060), soil: lin(0x8a6e48) };
  // the ground is built in 128 m squares, so only the squares in view are drawn: 4 m between vertices where there is detail (the first island, towns), 8 m elsewhere
  const CH = 128, GR = { chunks: 0, verts: 0, tris: 0, ms: 0 };
  const fastF = (x, z) => clamp(0.5 + 0.5 * (G.pnoise(x / 90, z / 90) * 0.6 + G.pnoise(x / 40, z / 40) * 0.3 + G.pnoise(x / 15, z / 15) * 0.1), 0, 1); // the bigger island's patches of colour: the same look, much cheaper than the old noise
  const F = EXPANDED ? fastF : fbm;
  function groundColour(c, x, z, h, d, rock, quay, isle, sl) { // what colour the ground is: grass in patches, the hills wooded, rock on cliffs and high ground, sand on beaches, gravel on the works
    c.copy(COL.grass).lerp(COL.grass2, smooth(0.35, 0.75, F(x * 2, z * 2))).lerp(COL.grass3, smooth(0.6, 0.85, F(x * 1.3 - 70, z * 1.3)) * 0.6).lerp(COL.forest, smooth(0.55, 0.8, F(x * 0.7 + 50, z * 0.7)) * 0.3); // patches of lighter and deeper green
    if (h > 10) c.lerp(COL.forest, smooth(10, 26, h) * 0.6); // the hills are wooded
    if (isle) c.lerp(F(x * 4, z * 4) > 0.5 ? COL.gravel : COL.gravel2, smooth(9, 20, d) * 0.92); // Industrial Isle: gravel and bare ground inside a green fringe
    else { const farm = EXPANDED ? G.zoneMask('farm', x, z) : (1 - smooth(-60, -20, x)) * (1 - smooth(-225, -195, z)); if (farm > 0) { c.lerp(COL.meadow, farm * (0.3 + 0.5 * smooth(0.4, 0.7, F(x * 0.8 + 20, z * 0.8)))); c.lerp(COL.hay, farm * 0.5 * smooth(0.6, 0.8, F(x * 1.6 + 5, z * 1.6 - 15))); c.lerp(COL.soil, farm * 0.55 * smooth(0.68, 0.8, F(x * 2.4 - 40, z * 2.4 + 10))); } } // Greenfields and the farmland: drier meadow, hay-coloured and bare patches
    if (EXPANDED) { const hi = smooth(60, 120, h); if (hi > 0) c.lerp(F(x * 3 + 9, z * 3) > 0.5 ? COL.rock : COL.rock2, hi * 0.8); // bare rock on the mountains
      const ind = G.zoneMask('industry', x, z), qu = G.zoneMask('quarry', x, z), ap = G.zoneMask('airport', x, z); if (ind > 0) c.lerp(F(x * 4, z * 4) > 0.5 ? COL.gravel : COL.gravel2, ind * 0.85); if (qu > 0) c.lerp(F(x * 2.5, z * 2.5) > 0.5 ? COL.quarry : COL.quarry2, qu * 0.9); if (ap > 0) c.lerp(COL.lawn, ap * 0.6); }
    const sandy = (1 - rock) * (1 - quay) * (1 - smooth(40, 52, d + F(x * 3, z * 3) * 8)); // beaches, with a soft, uneven edge into the grass
    if (sandy > 0) c.lerp(COL.sand, smooth(0.3, 0.7, sandy)).lerp(COL.wet, (1 - smooth(1, 6, d)) * sandy);
    const cliff = rock * (1 - smooth(10, 18, d)) + smooth(1.3, 2.2, sl) * 0.5; // rocky shores show grey cliffs; only very steep ground inland does
    if (cliff > 0) c.lerp(F(x * 5, z * 5) > 0.5 ? COL.rock : COL.rock2, clamp(cliff, 0, 0.92));
  }
  let groundMat = null, farGround = null; const groundMeshes = [];
  function groundGrid(x0, z0, nx, nz, S, skirt, sink) { // a grid of ground: heights with a ring of extra samples for smooth normals, colours, and (for squares) a skirt so squares of different detail never show a crack
    const m = nx + 1, q = nz + 1, E = nx + 3, F2 = nz + 3, Hh = new Float32Array(E * F2), c = new THREE.Color();
    for (let j = 0; j < F2; j++) for (let i = 0; i < E; i++) Hh[j * E + i] = heightAt(x0 + (i - 1) * S, z0 + (j - 1) * S);
    const ns = skirt ? 2 * (m + q) : 0, nv = m * q + ns, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = []; let wet = 0;
    for (let j = 0; j < q; j++) for (let i = 0; i < m; i++) {
      const x = x0 + i * S, z = z0 + j * S, k = j * m + i, h = Hh[(j + 1) * E + i + 1], d = land(x, z), rock = K.rock, quay = K.quay, isle = K.isle ? 1 : 0;
      const dx = (Hh[(j + 1) * E + i + 2] - Hh[(j + 1) * E + i]) / (2 * S), dz = (Hh[(j + 2) * E + i + 1] - Hh[j * E + i + 1]) / (2 * S), sl = Math.hypot(dx, dz), il = 1 / Math.hypot(dx, 1, dz);
      pos[3 * k] = x; pos[3 * k + 1] = h - sink; pos[3 * k + 2] = z; nor[3 * k] = -dx * il; nor[3 * k + 1] = il; nor[3 * k + 2] = -dz * il;
      if (d < 0) c.copy(COL.floor); else groundColour(c, x, z, h, d, rock, quay, isle, sl);
      col[3 * k] = c.r; col[3 * k + 1] = c.g; col[3 * k + 2] = c.b; if (h > -9) wet++;
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * m + i, b = a + 1, d = a + m, e = d + 1; if (pos[3 * a + 1] < -9 && pos[3 * b + 1] < -9 && pos[3 * d + 1] < -9 && pos[3 * e + 1] < -9) continue; idx.push(a, d, b, b, d, e); }
    if (skirt) { // a strip hanging 3 m below each edge
      const top = [], bot = [], lef = [], rig = []; for (let i = 0; i < m; i++) { top.push(i); bot.push((q - 1) * m + i); } for (let j = 0; j < q; j++) { lef.push(j * m); rig.push(j * m + m - 1); }
      let base = m * q; for (const [list, flip] of [[top, 1], [bot, 0], [lef, 0], [rig, 1]]) { const s0 = base; list.forEach((k, t) => { const s = base + t; pos[3 * s] = pos[3 * k]; pos[3 * s + 1] = pos[3 * k + 1] - 3; pos[3 * s + 2] = pos[3 * k + 2]; nor[3 * s] = nor[3 * k]; nor[3 * s + 1] = nor[3 * k + 1]; nor[3 * s + 2] = nor[3 * k + 2]; col[3 * s] = col[3 * k]; col[3 * s + 1] = col[3 * k + 1]; col[3 * s + 2] = col[3 * k + 2]; });
        for (let t = 0; t < list.length - 1; t++) { const p1 = list[t], p2 = list[t + 1], s1 = s0 + t, s2 = s1 + 1; if (flip) idx.push(p1, p2, s1, p2, s2, s1); else idx.push(p1, s1, p2, p2, s1, s2); } base += list.length; }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    return { g, wet, tris: idx.length / 3 };
  }
  function buildTerrain() {
    const t0 = performance.now(); groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }); /* pushed back a little, so yards and paving laid on it never flicker where the ground rises through them */
    const i0 = Math.floor(X0 / CH), i1 = Math.ceil(X1 / CH), j0 = Math.floor(Z0 / CH), j1 = Math.ceil(Z1 / CH), work = [];
    for (let cj = j0; cj < j1; cj++) for (let ci = i0; ci < i1; ci++) {
      const x0 = ci * CH, z0 = cj * CH; let sea = true; for (let a = 0; a <= 4 && sea; a++) for (let b = 0; b <= 4; b++) if (land(x0 + a * CH / 4, z0 + b * CH / 4) > -10) { sea = false; break; } if (sea) continue; // nothing but open sea
      work.push([x0, z0]);
    }
    const padN = PADS.length; // a square's heights use the ground pads that exist now, whenever the square is drawn, so the ground is exactly what it always was
    let farOn = false;
    const make = ([x0, z0]) => {
      const S = G.detailAt(x0, z0, CH) ? 4 : 8; G.setPadLimit(padN); let r; try { r = groundGrid(x0, z0, CH / S, CH / S, S, true, 0); } finally { G.setPadLimit(-1); } if (!r.wet) return;
      const m = new THREE.Mesh(r.g, groundMat); m.receiveShadow = true; m.matrixAutoUpdate = false; m.name = 'ground'; m.visible = !farOn; scene.add(m); groundMeshes.push(m); GR.chunks++; GR.verts += r.g.attributes.position.count; GR.tris += r.tris;
    };
    if (!EXPANDED) for (const w of work) make(w); // the first island: every square at once, as before
    if (EXPANDED) { // seen from far away the whole island is one coarse mesh (16 m), sunk a little so roads and buildings laid on the fine ground never hide under it
      const fx = Math.floor(X0 / 16) * 16, fz = Math.floor(Z0 / 16) * 16, r = groundGrid(fx, fz, Math.ceil((X1 - fx) / 16), Math.ceil((Z1 - fz) / 16), 16, false, 1.2);
      farGround = new THREE.Mesh(r.g, groundMat); farGround.receiveShadow = true; farGround.matrixAutoUpdate = false; farGround.visible = true; farGround.name = 'ground-far'; scene.add(farGround); GR.farVerts = r.g.attributes.position.count; GR.farTris = r.tris;
      // the detailed squares are drawn after the game starts, a few milliseconds a frame, nearest home first: the island is playable at once and the coarse ground stands in for any square not drawn yet
      const HX = 27, HZ = -20; work.sort((a, b) => Math.hypot(a[0] + CH / 2 - HX, a[1] + CH / 2 - HZ) - Math.hypot(b[0] + CH / 2 - HX, b[1] + CH / 2 - HZ)); GR.pending = work.length;
      tick.push(() => {
        const far = camDist > (farOn ? 1150 : 1350); if (far !== farOn) { farOn = far; for (const m of groundMeshes) m.visible = !far; }
        if (work.length) { const t1 = performance.now(); do { make(work.shift()); } while (work.length && performance.now() - t1 < 6); GR.pending = work.length; }
        farGround.visible = farOn || work.length > 0;
      });
    }
    GR.ms = Math.round(performance.now() - t0);
  }
  function buildRiverWater() { // each river is a ribbon of water at its own level, flowing downstream; it stops where the sea takes over
    if (!EXPANDED) return; const mat = new THREE.MeshStandardMaterial({ color: lin(0x3aa7e0), roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.88, depthWrite: false }); mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -4;
    tex.flow = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(190,230,255,.8)'; for (let i = 0; i < 9; i++) { g.fillRect(6 + (i * 29) % 50, (i * 41) % h, 2.5, 20 + (i * 7) % 18); } g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h); }, true); mat.map = tex.flow;
    const pos = [], uv = [], idx = [], fallsAt = [];
    for (const r of G.riverSamples()) { let prev = -1; for (let i = 0; i < r.s.length; i++) { const p = r.s[i], a = r.s[Math.max(0, i - 1)], b = r.s[Math.min(r.s.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, hw = p.hw * 0.95, y = p.L - 0.05;
      const gh = heightAt(p.x, p.z); if (gh > y - 0.1 || land(p.x, p.z) < 2) { prev = -1; continue; } // the bed lies under the water; where the sea starts the ribbon ends
      const k = pos.length / 3; pos.push(p.x - nx * hw, y, p.z - nz * hw, p.x + nx * hw, y, p.z + nz * hw); uv.push(0, p.cum / 12, 1, p.cum / 12); const q0 = r.s[Math.max(0, i - 1)]; if (prev >= 0 && q0.L - p.L > 6) { fallsAt.push([r.s[i - 1], p, hw]); prev = k; continue; } if (prev >= 0) idx.push(prev, prev + 1, k, prev + 1, k + 1, k); prev = k; } }
    if (!pos.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.renderOrder = 1; scene.add(m); tick.push(dt => { tex.flow.offset.y -= dt * 0.35; });
    if (fallsAt.length) { // a fall: a near-vertical white sheet, a pool and drifting mist at its foot
      const fp = [], fu = [], fi = [], fm = new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide, map: tex.flow }), mist = [];
      for (const [a, b, hw] of fallsAt) { const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, k = fp.length / 3, hh = hw * 0.9; fp.push(a.x - nx * hh, a.L - 0.05, a.z - nz * hh, a.x + nx * hh, a.L - 0.05, a.z + nz * hh, b.x - nx * hh, b.L + 0.2, b.z - nz * hh, b.x + nx * hh, b.L + 0.2, b.z + nz * hh); fu.push(0, 0, 1, 0, 0, 3, 1, 3); fi.push(k / 3, k / 3 + 1, k / 3 + 2, k / 3 + 1, k / 3 + 3, k / 3 + 2);
        const pool = new THREE.Mesh(new THREE.CylinderGeometry(hw * 1.9, hw * 2.1, 0.12, 20), new THREE.MeshStandardMaterial({ color: lin(0x5fc3e8), roughness: 0.2, transparent: true, opacity: 0.85 })); pool.position.set(b.x + dx / L * hw, b.L - 0.12, b.z + dz / L * hw); scene.add(pool);
        for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(hw * (0.5 + (i % 3) * 0.25), 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false })); s.position.set(b.x + (i - 2.5) * hw * 0.3 + dx / L * hw * 0.7, b.L + 0.6 + i % 2, b.z + (i % 3 - 1) * hw * 0.4 + dz / L * hw * 0.7); scene.add(s); mist.push(s); } }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2)); fg.setIndex(fi); const fmesh = new THREE.Mesh(fg, fm); fmesh.renderOrder = 2; scene.add(fmesh); World.falls = fallsAt.map(([a, b]) => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, top: a.L, bottom: b.L }));
      tick.push((dt, t) => { mist.forEach((s, i) => { s.scale.setScalar(1 + 0.18 * Math.sin(t * 1.3 + i * 1.7)); s.position.y += Math.sin(t * 0.9 + i) * 0.004; }); });
    }
  }
  function buildOcean() { // turquoise shallows, a foam line, deeper blue further out
    const EX0 = EXPANDED ? X0 - 300 : -1100, EZ0 = EXPANDED ? Z0 - 300 : -1000, EW = EXPANDED ? X1 - X0 + 600 : 2200, EH = EXPANDED ? Z1 - Z0 + 600 : 2200, NX = EXPANDED ? Math.round(EW / 12) : 256, NZ = EXPANDED ? Math.round(EH / 12) : 256, data = new Uint8Array(NX * NZ); // the sea's distance from the shore, one texel per 12 m on the bigger island, 8 m on the first
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) data[j * NX + i] = clamp(Math.round(-G.landFar(EX0 + (i + 0.5) / NX * EW, EZ0 + (j + 0.5) / NZ * EH) / 240 * 255), 0, 255);
    const tex = new THREE.DataTexture(data, NX, NZ, THREE.LuminanceFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({ fog: true,
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { sd: { value: tex }, O: { value: new THREE.Vector4(EX0, EZ0, EW, EH) }, t: { value: 0 },
        deep: { value: lin(0x0f5fb8) }, mid: { value: lin(0x1693d8) }, shallow: { value: lin(0x22c9cf) }, edge: { value: lin(0x7fe3d4) }, foam: { value: lin(0xffffff) }, lagoon: { value: lin(0x4fdcd2) }, lagoonDeep: { value: lin(0x1fb4cf) }, deep2: { value: lin(0x0a4896) } }),
      vertexShader: 'varying vec2 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: `uniform sampler2D sd; uniform vec4 O; uniform float t; uniform vec3 deep, deep2, mid, shallow, edge, foam, lagoon, lagoonDeep; varying vec2 vW;
        #include <fog_pars_fragment>
        void main(){
          vec2 uv = (vW - O.xy) / O.zw; float d = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 240.0 : texture2D(sd, uv).r * 240.0;
          float w = sin(vW.x * 0.05 + t * 0.9) * sin(vW.y * 0.055 - t * 0.7) + sin((vW.x + vW.y) * 0.12 + t * 1.5) * 0.5;
          float nz = sin(vW.x * 0.021) * sin(vW.y * 0.017) * 0.5 + 0.5;
          float nz2 = sin(vW.x * 0.0093 + 1.7) * sin(vW.y * 0.0079 - 0.6) * 0.5 + 0.5;
          // a lagoon of light water over sand out to a reef, then the drop to deep blue; how far out the reef lies changes along the coast (70 to 200 m)
          float reef = 70.0 + nz2 * 130.0;
          vec3 c = mix(edge, shallow, smoothstep(1.0, 9.0 + nz * 14.0, d)); // a soft, uneven shallow band rather than one bright outline
          c = mix(c, lagoon, smoothstep(10.0, 46.0, d));
          c = mix(c, lagoonDeep, smoothstep(40.0, reef, d) * 0.65);
          c = mix(c, mid, smoothstep(reef - 8.0, reef + 18.0, d));
          c = mix(c, deep, smoothstep(reef + 18.0, min(reef + 90.0, 232.0), d)); // (open sea, which the texture reports as 240 m, is one even deep blue wherever the reef lies)
          c = mix(c, deep2, smoothstep(160.0, 235.0, d) * 0.6);
          c *= 1.0 + w * 0.025 * (1.0 - smoothstep(60.0, 200.0, d));
          float f = (1.0 - smoothstep(0.0, 4.5, d + w * 1.2)) * (0.6 + 0.4 * sin(t * 1.4 + vW.x * 0.08 + vW.y * 0.06));
          float rf = (1.0 - smoothstep(0.0, 4.0, abs(d - reef + w * 1.4))) * smoothstep(0.42, 0.62, nz) * step(30.0, d); // surf breaking on the reef, with gaps where a pass cuts through
          gl_FragColor = vec4(mix(mix(c, foam, clamp(f, 0.0, 1.0) * 0.6), foam, rf * 0.7), 1.0);
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
  function sign(M, i, w, h, x, y, z, ry = 0) { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, u0 = (i % 4) / 4, u1 = u0 + 0.25, v1 = 1 - Math.floor(i / 4) / 32, v0 = v1 - 1 / 32; uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); geoAt('sign', g, M, x, y, z, WHITE, ry); }
  function canvasTex(w, h, draw, repeat) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
  const C = c => lin(c), WHITE = new THREE.Color(1, 1, 1);
  const tex = {};
  const SIGNS = ['BAKERY', 'CAFÉ', 'GROCER', 'PHARMACY', 'FLOWERS', 'LIBRARY', 'HARBOUR', 'HOTEL AZURE', 'SEAFOOD', 'BEACH BAR', 'PROCESSING', 'BUS', 'TIMBER', 'MARKET', 'ICE CREAM', 'DEPOT',
    'STADIUM', 'CAPITAL BANK', 'CITY HALL', 'MARINA', 'FARM CO-OP', 'EXCHANGE', 'OFFICES', 'YACHT CLUB', 'GATE A', 'GATE B', 'TICKETS', 'PARKING', 'FRESH FOOD', 'CAPITAL LIFE', 'HOTEL', 'FARM SHOP',
    'INBOUND', 'OUTBOUND', 'DELIVERIES', 'SNACKS', 'HARBOUR GATE', 'LOOKOUT', 'COLD STORE', 'YOUR FIELD',
    'WORKS GATE', 'FUEL STORE', 'CONTAINERS', 'SPORTS PARK', 'PAVILION', 'FAN SHOP', 'WHARF', 'FARM STAND', 'COURTS', 'CAFÉ BAR'];
  const SIGNC = ['#c0392b', '#7a4e2d', '#27ae60', '#16a085', '#d6458b', '#2e5aa8', '#1f3f8f', '#0f6fb8', '#e67e22', '#ff8a3d', '#5a6270', '#f2b705', '#7a4e2d', '#27ae60', '#ff6f91', '#34495e',
    '#c0392b', '#1f3f8f', '#2e5aa8', '#0f6fb8', '#2f8f3a', '#7a4e2d', '#34495e', '#0f6fb8', '#1f5fbf', '#d8392b', '#f2a900', '#2e74c9', '#27ae60', '#8e44ad', '#0f6fb8', '#2f8f3a',
    '#2f8f3a', '#c0392b', '#34495e', '#d8392b', '#1f3f8f', '#2e74c9', '#2e5aa8', '#f2a900',
    '#c0392b', '#2e5aa8', '#1f3f8f', '#2f8f3a', '#7a4e2d', '#c0392b', '#0f6fb8', '#2f8f3a', '#2e74c9', '#7a4e2d'];
  function textures() {
    const T = draw => canvasTex(128, 128, draw, true), glass = (g, y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#9fd3f5'); gr.addColorStop(0.5, '#3f86c4'); gr.addColorStop(1, '#1f4f86'); return gr; };
    tex.flat = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e9e1d2'; g.fillRect(0, 120, 128, 8); g.fillStyle = '#8c8c8c'; g.fillRect(22, 26, 12, 62); g.fillRect(94, 26, 12, 62); g.fillStyle = '#fff'; g.fillRect(36, 24, 56, 68); g.fillStyle = glass(g, 28, 88); g.fillRect(41, 29, 46, 58); g.fillStyle = '#fff'; g.fillRect(62, 29, 4, 58); g.fillStyle = '#d2c7b2'; g.fillRect(32, 92, 64, 7); });
    tex.hotel = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = glass(g, 14, 104); g.fillRect(10, 14, 108, 90); g.fillStyle = '#fff'; g.fillRect(62, 14, 4, 90); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(14, 18, 26, 82); g.fillStyle = '#e8eef2'; g.fillRect(0, 104, 128, 24); });
    tex.shop = T(g => { g.fillStyle = '#f3ead9'; g.fillRect(0, 0, 128, 128); const gr = g.createLinearGradient(0, 26, 0, 128); gr.addColorStop(0, '#a6d2ee'); gr.addColorStop(1, '#2c5079'); g.fillStyle = gr; g.fillRect(10, 26, 108, 102); g.fillStyle = '#f3ead9'; g.fillRect(62, 26, 4, 102); g.fillStyle = '#ffd98a'; g.globalAlpha = 0.45; g.fillRect(10, 96, 108, 32); g.globalAlpha = 1; });
    tex.office = T(g => { g.fillStyle = '#f2f4f6'; g.fillRect(0, 0, 128, 128); g.fillStyle = glass(g, 18, 108); g.fillRect(6, 18, 116, 88); g.fillStyle = '#e4eaef'; g.fillRect(62, 18, 4, 88); });
    tex.shed = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#dcdcdc'; for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 3, 128); g.fillStyle = '#35587e'; g.fillRect(16, 12, 96, 16); });
    tex.brick = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e2d5cb'; for (let y = 0; y < 128; y += 8) { g.fillRect(0, y, 128, 1); for (let x = (y / 8) % 2 * 8; x < 128; x += 16) g.fillRect(x, y, 1, 8); } g.fillStyle = '#35587e'; g.fillRect(34, 22, 60, 70); g.fillStyle = '#fff'; g.fillRect(62, 22, 4, 70); });
    tex.signs = canvasTex(1024, 2048, g => { for (let i = 0; i < SIGNS.length; i++) { const x = (i % 4) * 256, y = Math.floor(i / 4) * 64; g.fillStyle = '#fff'; g.fillRect(x, y, 256, 64); g.fillStyle = SIGNC[i]; g.fillRect(x + 4, y + 4, 248, 56); g.fillStyle = '#fff'; g.font = `900 ${SIGNS[i].length > 9 ? 30 : 38}px 'Arial Black', Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(SIGNS[i], x + 128, y + 34); } });
    tex.road = canvasTex(64, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(3, 0, 3, h); g.fillRect(w - 6, 0, 3, h); g.fillStyle = '#ffd34a'; g.fillRect(w / 2 - 1.5, 30, 3, 120); }, true);
    tex.roadV = canvasTex(64, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(w / 2 - 1.2, 40, 2.4, 90); }, true); // villa lanes: a white centre dash
    tex.roadW = canvasTex(64, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#f2c12e'; g.fillRect(3, 0, 3, h); g.fillRect(w - 6, 0, 3, h); }, true); // works roads: yellow edges
    tex.paving = canvasTex(128, 128, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 238 + Math.round(Math.sin(i * 7.1 + j * 3.3) * 9); g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); } g.fillStyle = 'rgba(120,110,95,.35)'; for (let k = 0; k <= 4; k++) { g.fillRect(k * 32 - 1, 0, 2, 128); g.fillRect(0, k * 32 - 1, 128, 2); } }, true);
    tex.pitch = canvasTex(256, 128, g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#4fa63e' : '#5ab548'; g.fillRect(i * 32, 0, 32, 128); } g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(8, 8, 240, 112); });
  }
  let MATS = null;
  function mats() {
    if (MATS) return MATS;
    const S = o => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85 }, o));
    MATS = { flat: S({ map: tex.flat }), hotel: S({ map: tex.hotel, roughness: 0.45 }), shop: S({ map: tex.shop, roughness: 0.55 }), office: S({ map: tex.office, roughness: 0.4, metalness: 0.15 }), shed: S({ map: tex.shed }), brick: S({ map: tex.brick, roughness: 0.9 }),
      roof: S({ roughness: 0.75, flatShading: true }), trim: S({ roughness: 0.75 }), trim2: S({ roughness: 0.75, side: THREE.DoubleSide }), lawn: S({ roughness: 1 }), metal: S({ roughness: 0.4, metalness: 0.5 }),
      water: S({ roughness: 0.05, metalness: 0.1 }), glow: new THREE.MeshBasicMaterial({ vertexColors: true }), sign: new THREE.MeshBasicMaterial({ map: tex.signs, vertexColors: true }), glassy: S({ transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }),
      pitch: S({ map: tex.pitch, roughness: 1, vertexColors: false }), detail: S({ roughness: 0.7, transparent: true }), plaza: off(S({ map: tex.paving, roughness: 0.92 }), -1), bed: off(S({ roughness: 1 }), -2), flood: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x8a8f96 }) };
    for (const k in EXTRA_KINDS) MATS[k] = EXTRA_KINDS[k](MATS);
    fadeMats.push([MATS.detail, 420, 700]);
    return MATS;
  }
  const REGION_BUILDERS = [], EXTRA_KINDS = {}; // the regions of the bigger island register here (expand.js)
  const NOSHADOW = { lawn: 1, bed: 1, water: 1, sign: 1, glow: 1, glassy: 1, plaza: 1, flood: 1 };
  function flush() { const M = mats(); for (const P of parts.values()) { if (!P.pos.n) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P.pos.a.slice(0, P.pos.n), 3)); g.setAttribute('normal', new THREE.BufferAttribute(P.nor.a.slice(0, P.nor.n), 3)); g.setAttribute('uv', new THREE.BufferAttribute(P.uv.a.slice(0, P.uv.n), 2)); g.setAttribute('color', new THREE.BufferAttribute(P.col.a.slice(0, P.col.n), 3)); g.computeBoundingSphere(); const m = new THREE.Mesh(g, M[P.k]); m.name = P.k; m.castShadow = !NOSHADOW[P.k]; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); } parts.clear(); }

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
  // each kind of street looks like what it is: town streets have kerbed pavements both sides and zebra crossings set back
  // from the junctions; villa lanes are narrower with a footpath each side; rural roads have edge lines and gravel shoulders;
  // farm tracks are packed gravel; the works roads on Industrial Isle and the quay are concrete. A junction is shaped from its
  // arms (each mouth joined to the next by a kerb curve); a dead end opens into the yard, car park or forecourt it serves.
  const SURF = { town: 'asph', road: 'asph', villa: 'asph', bridge: 'asph', quay: 'conc', works: 'conc', farm: 'grav' };
  const WALK = { town: 2.6, quay: 2.6, villa: 1.6 }; // pavement width each side, metres
  const END = { J: 'paving', K: 'conc', SP: 'asph', SQ: 'asph', MQ: 'asph', FB: 'grav', FC: 'grav', PK: 'asph', SC: 'asph' }; // what each dead end opens into
  const JUNC = [], ENDS = [], CROSS = []; // junction outlines, dead-end pads (both for the on-the-road checks), zebra crossings
  const armAt = (N, e, s) => { const pts = e.a === N ? e.pts : e.pts.slice().reverse(), c = cumOf(pts); let i = 1; while (i < c.length - 1 && c[i] < s) i++; const t = clamp((s - c[i - 1]) / ((c[i] - c[i - 1]) || 1), 0, 1); return pts[i - 1].map((v, j) => v + (pts[i][j] - v) * t); };
  function armsOf(N) { // each road leaving a junction: its mouth, its direction out, its two kerb corners; sorted round the junction
    return N.edges.map(e => { const m = armAt(N, e, N.r), q = armAt(N, e, N.r + 2), L = Math.hypot(q[0] - m[0], q[2] - m[2]) || 1, u = [(q[0] - m[0]) / L, (q[2] - m[2]) / L], n = [-u[1], u[0]], hw = e.w / 2;
      return { e, m, u, n, hw, ang: Math.atan2(u[1], u[0]), R: [m[0] - n[0] * hw, m[1], m[2] - n[1] * hw], Lf: [m[0] + n[0] * hw, m[1], m[2] + n[1] * hw] }; }).sort((p, q) => p.ang - q.ang);
  }
  function kerb(A, B, steps = 8) { // the kerb from one arm's mouth round to the next: a curve through where the two road edges would meet
    const P0 = A.Lf, P2 = B.R, cr = A.u[0] * B.u[1] - A.u[1] * B.u[0]; let Cc = [(P0[0] + P2[0]) / 2, (P0[2] + P2[2]) / 2];
    if (Math.abs(cr) > 0.08) { const dx = P2[0] - P0[0], dz = P2[2] - P0[2], t = (dx * B.u[1] - dz * B.u[0]) / cr; if (t < 0 && t > -30) Cc = [P0[0] + A.u[0] * t, P0[2] + A.u[1] * t]; }
    const out = []; for (let i = 0; i <= steps; i++) { const t = i / steps, w0 = (1 - t) * (1 - t), w1 = 2 * t * (1 - t), w2 = t * t; out.push([w0 * P0[0] + w1 * Cc[0] + w2 * P2[0], mix(P0[1], P2[1], t), w0 * P0[2] + w1 * Cc[1] + w2 * P2[2]]); }
    return out;
  }
  const fan = (arr, c, ring, lift) => { for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; arr.push([c[0], c[1] + lift, c[2], 0, 0], [p[0], p[1] + lift, p[2], 0, 0], [q[0], q[1] + lift, q[2], 0, 0]); } };
  function quad(arr, x, y, z, ux, uz, hu, hn, lift) { // a rectangle centred on (x, z): hu along (ux, uz), hn across
    const nx = -uz, nz = ux, P = [[-hu, -hn], [hu, -hn], [hu, hn], [-hu, hn]].map(([a, b]) => [x + ux * a + nx * b, y + lift, z + uz * a + nz * b, (a + hu) / (2 * hu), (b + hn) / (2 * hn)]);
    arr.push(P[0], P[1], P[2], P[0], P[2], P[3]);
  }
  const inPoly = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][2] > z) !== (P[j][2] > z) && x < P[j][0] + (z - P[j][2]) / (P[i][2] - P[j][2]) * (P[i][0] - P[j][0])) c = !c; return c; };
  const paved = (x, z) => nearRoad(x, z)[0] < 0.2 || JUNC.some(P => Math.hypot(P.c[0] - x, P.c[2] - z) < 30 && inPoly(x, z, P)) || ENDS.some(P => Math.hypot(P.c[0] - x, P.c[2] - z) < 30 && inPoly(x, z, P));
  const crossAt = e => { const out = []; for (const [N, s] of [[e.a, e.a.r + 7.5], [e.b, e.len - e.b.r - 7.5]]) if (e.kind === 'town' && N.deg >= 3 && s > 8 && s < e.len - 8) out.push([N, s]); if (out.length === 2 && out[1][1] - out[0][1] < 16) out.length = 1; return out; };
  function buildRoads() {
    textures();
    const S = { asph: [], conc: [], grav: [], paving: [] }, pave = [], curb = [], tact = [], paint = [], marks = { road: [], villa: [], works: [] }, ISL = [], ROUND = [];
    for (const e of edges) {
      const W = WALK[e.kind], hw = e.w / 2, sa = e.a.deg >= 3 ? e.a.r : 0, sb = e.len - (e.b.deg >= 3 ? e.b.r : 0), xs = crossAt(e);
      if (e.kind !== 'bridge') ribbon(S[SURF[e.kind]], e.pts, hw, hw, 0.14);
      if (e.kind === 'road') ribbon(S.grav, e.pts, hw + 1.1, hw + 1.1, 0.11); // gravel shoulders on the rural roads
      if (W && sb - sa > 1) { // pavements, with a kerb along each that drops at the crossings
        ribbon(pave, cut(e.pts, sa, sb), hw + W, hw + W, 0.1);
        const stops = xs.map(x => x[1]).sort((p, q) => p - q); let k0 = e.a.deg === 2 ? 1.5 : sa; const kEnd = sb - (e.b.deg === 2 ? 1.5 : 0);
        for (const s of stops.concat([kEnd + 1.9])) { const k1 = s - 1.9; if (k1 - k0 > 1) { const K2 = cut(e.pts, k0, k1); ribbon(curb, K2, -(hw - 0.02), hw + 0.28, 0.17); ribbon(curb, K2, hw + 0.28, -(hw - 0.02), 0.17); } k0 = s + 1.9; }
      }
      for (const [N, s] of xs) { // a zebra set back from the junction, with tactile paving at each end
        const p = armAt(e.a, e, s), q = armAt(e.a, e, s + 1), L = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1, ux = (q[0] - p[0]) / L, uz = (q[2] - p[2]) / L, nx = -uz, nz = ux;
        for (let k = -hw + 0.75; k <= hw - 0.6; k += 1.1) quad(paint, p[0] + nx * k, p[1], p[2] + nz * k, ux, uz, 1.6, 0.28, 0.19);
        for (const sd of [-1, 1]) quad(tact, p[0] + nx * sd * (hw + W / 2), p[1], p[2] + nz * sd * (hw + W / 2), ux, uz, 1.6, W / 2 - 0.1, 0.13);
        CROSS.push({ x: p[0], y: p[1], z: p[2], ux, uz, hw, W, e, node: N, s });
      }
      for (const N of [e.a, e.b]) if (N.deg >= 3 && e.kind !== 'farm') { const p = armAt(N, e, N.r + 1.2), q = armAt(N, e, N.r + 2.2), L = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1, ux = (q[0] - p[0]) / L, uz = (q[2] - p[2]) / L; quad(paint, p[0] + uz * hw / 2, p[1], p[2] - ux * hw / 2, ux, uz, 0.22, hw / 2 - 0.15, 0.19); } // stop line across the lane coming in
      const mk = e.kind === 'villa' ? 'villa' : e.kind === 'works' ? 'works' : e.kind === 'town' || e.kind === 'road' || e.kind === 'bridge' ? 'road' : null;
      if (mk) { const m0 = e.a.deg >= 3 ? (xs.some(c => c[0] === e.a) ? e.a.r + 10 : e.a.r + 2.4) : e.a.deg === 1 ? 4 : 0, m1 = e.len - (e.b.deg >= 3 ? (xs.some(c => c[0] === e.b) ? e.b.r + 10 : e.b.r + 2.4) : e.b.deg === 1 ? 4 : 0); if (m1 - m0 > 4) ribbon(marks[mk], cut(e.pts, m0, m1), hw - 0.2, hw - 0.2, 0.16); }
    }
    for (const id in nodes) {
      const N = nodes[id];
      if (N.deg >= 3) { // the junction: mouths and kerb curves, filled; pavement round each corner where both roads have one
        const A = armsOf(N), ring = [];
        A.forEach((a, i) => { const b = A[(i + 1) % A.length], k = kerb(a, b); ring.push(a.R, a.Lf, ...k.slice(1, -1)); const W = Math.min(WALK[a.e.kind] || 0, WALK[b.e.kind] || 0); if (W) { ribbon(pave, k, W, 0.6, 0.1); ribbon(curb, k, 0.28, 0.02, 0.17); } });
        fan(S[A.some(a => SURF[a.e.kind] === 'asph') ? 'asph' : 'conc'], [N.x, N.y, N.z], ring, 0.15); ring.c = [N.x, N.y, N.z]; JUNC.push(ring);
        if (N.round) { // a roundabout: a round carriageway, a kerbed island of grass, a give-way ring painted round it
          const circ = (r, n = 36) => Array.from({ length: n + 1 }, (_, i) => [N.x + Math.cos(i / n * Math.PI * 2) * r, N.y, N.z + Math.sin(i / n * Math.PI * 2) * r]);
          disc(S.asph, N.x, N.y, N.z, N.r - 0.4, 0.155, 40); disc(ISL, N.x, N.y, N.z, N.round, 0.42, 32); ribbon(curb, circ(N.round), 0.05, 0.35, 0.44); ribbon(paint, circ(N.r - 1.4), 0.12, 0.12, 0.17); ROUND.push(N);
        }
      } else if (N.deg === 2 && N.edges.every(e => e.kind !== 'bridge')) { // a bend: fill the outside of the corner
        const hw = Math.max(...N.edges.map(e => e.w)) / 2, W = Math.min(...N.edges.map(e => WALK[e.kind] || 0)); disc(S[SURF[N.edges[0].kind]], N.x, N.y, N.z, hw, 0.14); if (W) disc(pave, N.x, N.y, N.z, hw + W, 0.1);
      } else if (N.deg === 1) { // a dead end: a pad the vehicles turn on, in the surface of the place it serves
        const e = N.edges[0], b = armAt(N, e, 3), L = Math.hypot(N.x - b[0], N.z - b[2]) || 1, ux = (N.x - b[0]) / L, uz = (N.z - b[2]) / L, nx = -uz, nz = ux, hw = e.w / 2 + 2.2, fw = 9.5, rr = 4, P = [[-4, -hw], [-4, hw]];
        for (let i = 0; i <= 6; i++) { const a = Math.PI / 2 - i / 6 * Math.PI / 2; P.push([fw - rr + Math.cos(a) * rr, hw - rr + Math.sin(a) * rr]); }
        for (let i = 0; i <= 6; i++) { const a = -i / 6 * Math.PI / 2; P.push([fw - rr + Math.cos(a) * rr, -hw + rr + Math.sin(a) * rr]); }
        const ring = P.map(([a, c]) => [N.x + ux * a + nx * c, N.y, N.z + uz * a + nz * c]), kind = END[N.id] || SURF[e.kind]; fan(S[kind], [N.x + ux * 3, N.y, N.z + uz * 3], ring, kind === 'asph' ? 0.15 : 0.13); ring.c = [N.x, N.y, N.z]; ENDS.push(ring);
      }
    }
    const M = (c, f, o = {}) => off(new THREE.MeshStandardMaterial(Object.assign({ color: lin(c), roughness: 0.9 }, o)), f);
    triMesh(pave, M(0xd9d3c6, -1)); triMesh(S.asph, M(0x474c55, -2, { roughness: 0.85 })); triMesh(S.conc, M(0xb7b3aa, -2)); triMesh(S.grav, M(0xc4ad84, -2, { roughness: 1 })); triMesh(S.paving, M(0xe6dcc8, -2));
    triMesh(curb, M(0xf1ede4, -3)); triMesh(tact, M(0xe2c66a, -2)); if (ISL.length) triMesh(ISL, M(0x5fa83a, -1));
    World.roundabouts = ROUND.map(N => [Math.round(N.x), Math.round(N.z)]);
    for (const N of ROUND) { // in the middle: a palm and a ring of flowers
      const g = new THREE.Group(); g.position.set(N.x, N.y + 0.42, N.z); const st = (geo, c, x, y, z, sx, sy, sz, rx, ry) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.8 })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; m.castShadow = true; g.add(m); return m; };
      const cyl = new THREE.CylinderGeometry(1, 1, 1, 8), cone = new THREE.ConeGeometry(1, 1, 5), sph = new THREE.SphereGeometry(1, 8, 6);
      st(cyl, 0x8a6a46, 0, 3, 0, 0.22, 6, 0.22); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, leaf = st(cone, 0x2f8f3a, Math.cos(a) * 1.4, 5.9, Math.sin(a) * 1.4, 0.5, 3, 0.25, 0, -a); leaf.rotation.z = Math.PI / 2 + 0.35; leaf.rotation.order = 'YZX'; }
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; st(sph, [0xe8483f, 0xf2b705, 0xff8fb1, 0xffffff][i % 4], Math.cos(a) * (N.round - 0.9), 0.25, Math.sin(a) * (N.round - 0.9), 0.4, 0.3, 0.4); }
      scene.add(g); } const pm = triMesh(paint, M(0xf7f7f2, -4, { roughness: 0.7 })); pm.renderOrder = 3;
    for (const [k, t] of [['road', tex.road], ['villa', tex.roadV], ['works', tex.roadW]]) { if (!marks[k].length) continue; const mk = triMesh(marks[k], off(new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false }), -3), 16); mk.renderOrder = 2; }
    for (const e of edges) if (e.kind === 'bridge') { const st = e.opt && e.opt.style; if (st === 'river') buildSmallBridge(e); else if (st === 'suspension') buildSuspension(e); else buildBridge(e); }
  }
  const posAt = (e, s) => { const c = e.cum; let i = 1; while (i < c.length - 1 && c[i] < s) i++; const t = clamp((s - c[i - 1]) / ((c[i] - c[i - 1]) || 1), 0, 1), a = e.pts[i - 1], b = e.pts[i], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1; return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t), dx / L, dz / L]; };
  const bridgeDeck = () => off(new THREE.MeshStandardMaterial({ color: lin(0x474c55), roughness: 0.85 }), -2);
  const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
  function barBox(k, p, q, w, color) { // a straight bar from point p to point q, square section w
    _d.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]); const L = _d.length() || 0.01; _d.divideScalar(L); tileAt((p[0] + q[0]) / 2, (p[2] + q[2]) / 2);
    tmp.position.set((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2); tmp.quaternion.setFromUnitVectors(_up, _d); tmp.scale.set(w, L, w); tmp.updateMatrix(); addGeo(k, BOX, tmp.matrix, color);
  }
  function buildSmallBridge(e) { // a short road bridge over a river: a deck with parapets on two abutments
    const M = new THREE.Matrix4(), deck = [], pts = e.pts; ribbon(deck, pts, e.w / 2, e.w / 2, 0.14); triMesh(deck, bridgeDeck());
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz); if (L < 0.01) continue; const ry = Math.atan2(dx, dz), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2, nx = -dz / L, nz = dx / L; tileAt(mx, mz);
      boxAt('trim', M, e.w + 1.6, 0.9, L + 0.05, mx, my - 0.8, mz, C(0xe6e0d4), ry);
      for (const s of [-1, 1]) boxAt('trim', M, 0.4, 1.0, L + 0.05, mx + nx * s * (e.w / 2 + 0.5), my + 0.1, mz + nz * s * (e.w / 2 + 0.5), C(0xf3efe7), ry);
    }
    for (const [p, q] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]]) { const ry = Math.atan2(q[0] - p[0], q[2] - p[2]), g = heightAt(p[0], p[2]); tileAt(p[0], p[2]); boxAt('trim', M, e.w + 1.8, Math.max(0.6, p[1] - g + 1.2), 2.4, p[0], g - 0.4, p[2], C(0xbdb5a5), ry); }
  }
  function buildSuspension(e) { // the Silver Bay Bridge: a deck 10 m wide hung from two cables over two pairs of leaning white towers; the cables are anchored behind the towers
    const M = new THREE.Matrix4(), pts = e.pts, deck = [], white = C(0xeef2f5), steel = C(0xd5dce3), len = e.len;
    ribbon(deck, pts, e.w / 2, e.w / 2, 0.14); triMesh(deck, bridgeDeck());
    for (let i = 0; i + 2 < pts.length; i += 2) { // a slab and parapets along the whole deck
      const a = pts[i], b = pts[i + 2], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz); if (L < 0.01) continue; const ry = Math.atan2(dx, dz), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2, nx = -dz / L, nz = dx / L; tileAt(mx, mz);
      boxAt('trim', M, e.w + 2, 1.5, L + 0.05, mx, my - 1.4, mz, C(0xd9d3c6), ry);
      for (const s of [-1, 1]) boxAt('trim', M, 0.45, 1.1, L + 0.05, mx + nx * s * (e.w / 2 + 0.6), my + 0.1, mz + nz * s * (e.w / 2 + 0.6), C(0xf3efe7), ry);
    }
    const TS = [len * 0.22, len * 0.78], HT = 56, LAT = e.w / 2 + 2.4, towers = [];
    for (const s of TS) { // each tower: two legs leaning together, cross beams, a foundation in the water
      const [x, y, z, ux, uz] = posAt(e, s), nx = -uz, nz = ux, ry = Math.atan2(ux, uz); towers.push({ x, y, z, nx, nz, ux, uz }); tileAt(x, z);
      boxAt('trim', M, e.w + 9, 10, 9, x, -9, z, C(0xcfc8ba), ry); boxAt('trim', M, e.w + 6, 2, 6, x, y - 3.4, z, C(0xe6e0d4), ry); // the foundation and the deck's saddle
      for (const sd of [-1, 1]) { barBox('trim', [x + nx * sd * (LAT + 3.4), y - 2, z + nz * sd * (LAT + 3.4)], [x + nx * sd * (LAT - 0.6), y + HT, z + nz * sd * (LAT - 0.6)], 2.7, white); }
      for (const f of [0.34, 0.66, 0.97]) { const lat = LAT + 3.4 - (LAT + 3.4 - (LAT - 0.6)) * f, hy = y - 2 + (HT + 2) * f; barBox('trim', [x - nx * (lat), hy, z - nz * (lat)], [x + nx * (lat), hy, z + nz * (lat)], f > 0.9 ? 2.2 : 1.6, white); }
      boxAt('glow', M, 0.9, 0.9, 0.9, x, y + HT + 1.2, z, C(0xff4b3a)); // a red light on top
    }
    const [A, B] = towers, topY = t => t.y + HT + 0.4, sag = 30;
    for (const sd of [-1, 1]) { // the main cables and the back stays, each a chain of short bars; hangers drop to the deck
      const at = (t, lat) => [t.x + t.nx * sd * lat, topY(t), t.z + t.nz * sd * lat];
      const main = []; for (let i = 0; i <= 28; i++) { const u = i / 28, tx = mix(A.x, B.x, u), tz = mix(A.z, B.z, u); main.push([tx + A.nx * sd * (LAT - 0.6), mix(topY(A), topY(B), u) - sag * 4 * u * (1 - u), tz + A.nz * sd * (LAT - 0.6), u]); }
      for (let i = 0; i < main.length - 1; i++) barBox('trim', main[i], main[i + 1], 0.55, steel);
      for (let i = 1; i < main.length - 1; i++) { const m = main[i], [dx, dy, dz] = posAt(e, mix(TS[0], TS[1], m[3])); const deckY = dy; if (m[1] - deckY > 1.2) barBox('trim', [m[0], m[1], m[2]], [m[0], deckY + 1, m[2]], 0.16, steel); }
      for (const [t, end, S0] of [[A, 0, 0], [B, len, len]]) { const [ex, ey, ez, ux, uz] = posAt(e, end === 0 ? 14 : len - 14), nx = -uz, nz = ux, top = at(t, LAT - 0.6), foot = [ex + nx * sd * LAT, ey + 1.5, ez + nz * sd * LAT]; const seg = []; for (let i = 0; i <= 10; i++) { const u = i / 10; seg.push([mix(foot[0], top[0], u), mix(foot[1], top[1], u) - 3 * 4 * u * (1 - u), mix(foot[2], top[2], u)]); } for (let i = 0; i < seg.length - 1; i++) barBox('trim', seg[i], seg[i + 1], 0.5, steel); }
    }
    for (const s of [14, 40, 70, 100, 130, 160, 190, 220, 250, 280, 310, 340, 370, 400]) { if (s > len - 8) continue; const [x, y, z, ux, uz] = posAt(e, s); for (const sd of [-1, 1]) LAMPS.push([x - uz * sd * (e.w / 2 + 0.7), y + 0.1, z + ux * sd * (e.w / 2 + 0.7)]); }
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
    if (!barrier) { barrier = new THREE.Group(); barrier.visible = false; scene.add(barrier); } else return; // shown when the bridge is closed (the first, old bridge only)
    for (const p of [pts[3], pts[pts.length - 4]]) for (let k = 0; k < 4; k++) { const o = new THREE.Mesh(new THREE.BoxGeometry(e.w / 4, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: lin(k % 2 ? 0xffffff : 0xd8392b) })); const ry = Math.atan2(pts[4][0] - pts[2][0], pts[4][2] - pts[2][2]); o.position.set(p[0] + Math.cos(ry) * (k - 1.5) * e.w / 4, p[1] + 0.9, p[2] - Math.sin(ry) * (k - 1.5) * e.w / 4); o.rotation.y = ry; barrier.add(o); }
    for (let k = 0; k <= n; k++) { // a shallow arch under each span
      const s0 = k * e.len / (n + 1), s1 = (k + 1) * e.len / (n + 1);
      for (let j = 0; j < 8; j++) { const sa = mix(s0, s1, j / 8), sb = mix(s0, s1, (j + 1) / 8), at = s => { const i = Math.max(1, e.cum.findIndex(c => c >= s)); const t = (s - e.cum[i - 1]) / (e.cum[i] - e.cum[i - 1]); return pts[i - 1].map((v, m) => v + (pts[i][m] - v) * t); }, A = at(sa), B = at(sb), drop = u => 5 * (1 - Math.sin(Math.PI * u));
        const ya = A[1] - 2 - drop(j / 8), yb = B[1] - 2 - drop((j + 1) / 8), L = Math.hypot(B[0] - A[0], B[2] - A[2]); tmp.position.set((A[0] + B[0]) / 2, (ya + yb) / 2, (A[2] + B[2]) / 2); tmp.rotation.set(0, Math.atan2(B[0] - A[0], B[2] - A[2]), 0); tmp.rotateX(-Math.atan2(yb - ya, L)); tmp.scale.set(e.w - 1, 0.9, L + 0.3); tmp.updateMatrix(); addGeo('trim', BOX, tmp.matrix, C(0xd8d1c3)); }
    }
  }

  // ---------- buildings: hand-placed for the sample ----------
  const WALL = { cream: 0xfff1d6, peach: 0xffd8bd, white: 0xffffff, yellow: 0xffe6a1, pink: 0xf9cfc4, sky: 0xd6ecff, sand: 0xf4dfb8 }, TERRA = [0xd9643a, 0xc9512f, 0xe07a45, 0xb84a2c], AWN = [0xe8483f, 0x1f8f5b, 0x2e74c9, 0xf2a531, 0xd6458b];
  const HPAL = [{ wall: [0xf3e6cf, 0xf1d6c3, 0xe8d3a9], roof: [0xc9663f, 0xb85a3a] }, { wall: [0xf6f1e7, 0xdfe6d6, 0xd9e3ea], roof: [0x5b6470, 0x6b4f43] }, { wall: [0xe9dcc9, 0xf3e6cf, 0xe6d8c0], roof: [0xa9523a, 0x7a5a46] },
    { wall: [0xf6f4ef, 0xd8d4cc], roof: [0x4a5058] }, { wall: [0xf1d6c3, 0xe8d3a9, 0xf3e6cf], roof: [0xc9663f, 0xd17a4a] }, { wall: [0xf6f1e7, 0xe4ead9], roof: [0x5b6470, 0x3f4a5a] }]; // house styles' walls and roofs
  const DOORS = [0x2f5a8a, 0x2f7a55, 0x8a3a35, 0xc9902e, 0x3a3f48], SHUT = [0x3f6f8f, 0x4f7f4a, 0x8a5a3c, 0x6b7280];
  function addBuilding(b) {
    tileAt(b.x, b.z); const y = b.y != null ? b.y : TOWN_Y, M = new THREE.Matrix4().makeRotationY(b.rot).setPosition(b.x, y, b.z), f = DRAW[b.type];
    if (b.scale) M.multiply(new THREE.Matrix4().makeScale(b.scale, b.scale, b.scale));
    b.h = f(b, M, b.w, b.d) * (b.scale || 1); b.y = y; buildings.push(b); return b;
  }
  const DRAW = {
    flat(b, M, w, d) { // a modest apartment block: plinth, shutters, balconies on the street side, terracotta hip roof
      const fl = b.floors || 3, h = 0.7 + fl * 3.1, wc = C(b.color || WALL.cream);
      boxAt('trim', M, w + 0.3, 0.7, d + 0.3, 0, 0, 0, C(0xd8cdb8)); walls('flat', M, w, d, 0.7, h, wc, 3.1, 3.1);
      const fs = b.style != null ? b.style : Math.floor(hash(b.x * 0.53, b.z * 0.29) * 3) % 3; b.style = fs; // roofs: hipped, gabled, or flat with a roof garden
      if (fs === 0) hip('roof', M, w, d, h + 0.35, Math.min(w, d) * 0.32, C(b.roof || pick(TERRA)));
      else if (fs === 1) { gable('trim', M, w - 0.02, d - 0.02, h, d * 0.3, wc, 0); gable('roof', M, w, d, h + 0.05, d * 0.3, C(b.roof || 0x8a4a35), 0.5); boxAt('trim', M, w + 0.3, 0.6, d + 0.3, 0, 0.7, 0, C(0xe2d8c4)); }
      else { boxAt('trim', M, w + 0.4, 0.6, d + 0.4, 0, h, 0, C(0xf2ede4)); boxAt('lawn', M, w - 1.6, 0.3, d - 1.6, 0, h + 0.4, 0, C(0x63bb4b)); for (const s of [-1, 1]) boxAt('trim', M, 0.15, 2.4, 0.15, s * w * 0.25, h + 0.6, 0, C(0x8a5a3c)); boxAt('trim', M, w * 0.6, 0.15, 2.4, 0, h + 3, 0, C(0x8a5a3c)); }
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
    house(b, M, w, d) { // family houses in six styles: hipped cottage, side gable with a porch, front gable with a bay window, flat-roofed
      // modern, bungalow with a garage wing, gabled with a columned porch. Each has a front garden behind a fence or low hedge, a gap
      // at the front path, hedges round the back garden; colours come from each style's own restrained palette.
      const st = b.style != null ? b.style : Math.floor(hash(b.x * 0.37, b.z * 0.61) * 6) % 6, P = HPAL[st], hv = k => hash(b.x * 1.7 + k, b.z * 0.9 - k);
      const wc = C(b.color || P.wall[Math.floor(hv(1) * P.wall.length)]), rc = C(b.roof || P.roof[Math.floor(hv(2) * P.roof.length)]), dc = C(DOORS[Math.floor(hv(3) * DOORS.length)]), sh = C(SHUT[Math.floor(hv(4) * SHUT.length)]);
      const fl = st === 4 ? 1 : 2, h = 0.5 + fl * 3; b.floors = fl; b.style = st; b.doorX = st === 2 ? w * 0.22 : st === 5 ? 0 : -w * 0.2; const gx = b.doorX;
      boxAt('lawn', M, w + 3, 0.1, d + 7, 0, 0, -2, C(0x5cb447)); const hg = C(0x3f8f3a); boxAt('trim', M, w + 3, 1.1, 0.6, 0, 0, -d / 2 - 5.2, hg); for (const sx of [-1, 1]) boxAt('trim', M, 0.6, 1.1, d + 6.4, sx * (w / 2 + 1.2), 0, -1.8, hg);
      const fz = d / 2 + 1.3, fence = st === 3 ? [0.55, 0.3, C(0xd8d2c6)] : st % 2 ? [0.9, 0.12, C(0xffffff)] : [0.75, 0.55, hg], gaps = [[gx - 0.8, gx + 0.8]].concat(st === 4 ? [[w * 0.3 - 1.6, w * 0.3 + 1.6]] : []).sort((p, q) => p[0] - q[0]);
      let fx = -w / 2 - 1.5; for (const [a, c] of gaps.concat([[w / 2 + 1.5, w / 2 + 1.5]])) { if (a - fx > 0.3) boxAt('trim', M, a - fx, fence[0], fence[1], (a + fx) / 2, 0, fz, fence[2]); fx = c; }
      if (st % 2 && st !== 3) for (const s of [-1, 1]) boxAt('trim', M, 0.18, 1.15, 0.18, gx + s * 0.85, 0, fz, C(0xffffff)); // gate posts
      boxAt('trim', M, w + 0.3, 0.5, d + 0.3, 0, 0, 0, C(0xd8cdb8));
      const winBox = (x, y, z, ry = 0) => { boxAt('detail', M, 1.4, 0.25, 0.4, x, y, z, C(pick([0xff6f91, 0xffd21f, 0xe8483f, 0xb07cff]))); };
      if (st === 4) { // bungalow and garage
        const mw = w * 0.66, gw = w - mw, mx = -w / 2 + mw / 2, gxc = w / 2 - gw / 2;
        walls('flat', mul(M, mx, 0, 0), mw, d, 0.5, h, wc, 3.1, 3); hip('roof', mul(M, mx, 0, 0), mw, d, h + 0.3, Math.min(mw, d) * 0.36, rc);
        boxAt('trim', M, gw, 2.9, d * 0.9, gxc, 0, -d * 0.05, wc.clone().multiplyScalar(0.94)); boxAt('roof', M, gw + 0.3, 0.35, d * 0.9 + 0.3, gxc, 2.9, -d * 0.05, rc); boxAt('trim', M, gw * 0.8, 2.3, 0.12, gxc, 0, d * 0.4 + 0.02, C(0xe9e6df));
        b.doorX = gx; b.gate = [w * 0.3, fz]; b.drive = gw * 0.8;
      } else {
        walls('flat', M, w, d, 0.5, h, wc, 3.1, 3);
        if (st === 0) { hip('roof', M, w, d, h + 0.35, Math.min(w, d) * 0.38, rc); boxAt('detail', M, 0.8, 2, 0.8, w * 0.28, h + 1, -d * 0.15, C(0xa45a46)); boxAt('trim', M, 2, 0.15, 1, gx, 2.9, d / 2 + 0.5, rc); if (hv(5) < 0.6) winBox(w * 0.22, 3.5, d / 2 + 0.22); }
        else if (st === 1 || st === 5) { gable('trim', M, w - 0.02, d - 0.02, h, d * 0.34, wc, 0); gable('roof', M, w, d, h + 0.05, d * 0.34, rc, 0.45); boxAt('detail', M, 0.9, 2.4, 0.9, -w / 2 + 0.6, h + 0.6, 0, C(0x9a5a46));
          if (st === 1) { boxAt('trim', M, 2.6, 0.18, 1.6, gx, 2.8, d / 2 + 0.8, C(0xffffff)); for (const s of [-1, 1]) boxAt('trim', M, 0.15, 2.8, 0.15, gx + s * 1.15, 0, d / 2 + 1.5, C(0xffffff)); }
          else { boxAt('trim', M, w * 0.7, 0.3, 2, 0, 3.1, d / 2 + 1, C(0xffffff)); for (let i = 0; i < 4; i++) geoAt('trim', CYL8, M, -w * 0.3 + i * w * 0.2, 1.8, d / 2 + 1.7, C(0xffffff), 0, 0.18, 2.6, 0.18); boxAt('trim', M, w * 0.7, 0.2, 2, 0, 0.5, d / 2 + 1, C(0xe2d8c4)); } }
        else if (st === 2) { const R = rotY(M); gable('trim', R, d - 0.02, w - 0.02, h, w * 0.36, wc, 0); gable('roof', R, d, w, h + 0.05, w * 0.36, rc, 0.45); // the gable end faces the street
          boxAt('trim', M, 2.8, 2.6, 0.9, -w * 0.2, 0.5, d / 2 + 0.45, wc); boxAt('glassy', M, 2.5, 1.5, 0.92, -w * 0.2, 1.1, d / 2 + 0.47, C(0x9fdcff)); hip('roof', mul(M, -w * 0.2, 0, d / 2 + 0.45), 2.8, 0.9, 3.1, 0.5, rc, 0.15); }
        else { boxAt('trim', M, w + 0.4, 0.5, d + 0.4, 0, h, 0, C(0xf2f0ea)); boxAt('roof', M, w - 0.3, 0.16, d - 0.3, 0, h + 0.4, 0, C(0x7d838c)); /* its top stands 6 cm above the parapet slab: level with it, the two flickered */ boxAt('trim', M, w * 0.35, h - 0.6, 0.15, w * 0.28, 0.5, d / 2 + 0.05, C(0x8a5a3c)); boxAt('glassy', M, w * 0.3, 1.8, 0.1, -w * 0.12, 3.9, d / 2 + 0.06, C(0x9fdcff)); }
        if (st !== 3) for (const x of [-w * 0.38, w * 0.38]) for (const y of [1.2, 4.2]) for (const s of [-1, 1]) boxAt('detail', M, 0.35, 1.5, 0.08, x + s * 0.85, y, d / 2 + 0.06, sh); // shutters
      }
      boxAt('trim', M, 1.2, 2.2, 0.3, b.doorX, 0.5, d / 2 + 0.15, dc);
      return h + (st === 3 ? 0.9 : st === 4 ? Math.min(w * 0.66, d) * 0.36 : st === 2 ? w * 0.36 : d * 0.38) + 0.4;
    },
    tower(b, M, w, d) { // offices: glass or banded, square, set back or round, plant or a garden on the roof
      const fl = b.floors, st = b.style || 0, wc = C(b.color || 0xe0f0ff), h0 = 4.5; let h = h0 + fl * 3.4, wt = w, dt = d;
      walls('shop', M, w, d, 0, h0, C(0xffffff), 5, h0);
      if (st === 2) { const r = Math.min(w, d) / 2, g = new THREE.CylinderGeometry(r, r, h - h0, 20, 1, true), uv = g.attributes.uv, bays = Math.round(2 * Math.PI * r / 4); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * bays, uv.getY(i) * (h - h0) / 3.4);
        boxAt('trim', M, w + 0.6, 0.6, d + 0.6, 0, h0, 0, C(0xe8edf2)); geoAt('hotel', g, M, 0, (h + h0) / 2 + 0.3, 0, wc); geoAt('trim', CYL, M, 0, h + 0.7, 0, C(0xe8edf2), 0, r + 0.4, 0.8, r + 0.4); geoAt('roof', CYL, M, 0, h + 1.15, 0, C(b.roof || 0x5b7fa8), 0, r - 0.4, 0.1, r - 0.4);
        if (b.sign != null) sign(M, b.sign, 8, 1.2, 0, 4.9, d / 2 + 0.06); boxAt('trim', M, 0.4, 9, 0.4, 0, h + 1.2, 0, C(0x8a939c)); boxAt('glow', M, 0.7, 0.7, 0.7, 0, h + 10.2, 0, C(0xff4b3a)); return h + 11; }
      if (st === 1) { const f1 = Math.ceil(fl * 0.6), h1 = h0 + f1 * 3.4; walls('office', M, w, d, h0, h1, wc, 4, 3.4); boxAt('trim', M, w + 0.6, 0.6, d + 0.6, 0, h1, 0, C(0xe8edf2)); boxAt('lawn', M, w - 0.8, 0.3, d - 0.8, 0, h1 + 0.6, 0, C(0x63bb4b)); wt = w * 0.66; dt = d * 0.66; walls('office', M, wt, dt, h1 + 0.9, h, wc, 4, 3.4); }
      else walls(st === 3 ? 'hotel' : 'office', M, w, d, h0, h, wc, 4, 3.4);
      boxAt('trim', M, wt + 0.6, 0.7, dt + 0.6, 0, h, 0, C(0xe8edf2)); boxAt('roof', M, wt - 0.4, 0.12, dt - 0.4, 0, h + 0.7, 0, C(b.roof || 0x5b7fa8));
      boxAt('detail', M, wt * 0.3, 2.4, dt * 0.3, wt * 0.15, h + 0.7, -dt * 0.1, C(0xc5cad1)); boxAt('detail', M, 7, 0.35, 2.4, 0, 3.6, d / 2 + 1.2, C(0x1f3f8f));
      for (const s of [-1, 1]) boxAt('detail', M, Math.min(5, w * 0.2), 0.22, 1.5, s * (3.5 + Math.min(5, w * 0.2) / 2 + 0.7), 3.4, d / 2 + 0.75, C([0xe8483f, 0x2e74c9, 0xf2a531, 0x2f8f3a][Math.floor(hash(b.x * 0.3 + s, b.z * 0.9) * 4) % 4])); // shop awnings beside the entrance
      if (b.sign != null) sign(M, b.sign, 8, 1.2, 0, 4.9, d / 2 + 0.06);
      if (b.id === 'exchange') { const st0 = C(0xf4ead6); for (let i = 0; i < 6; i++) geoAt('trim', CYL, M, -w * 0.3 + i * w * 0.12, 4.3, d / 2 + 2.4, st0, 0, 0.55, 8.6, 0.55); boxAt('trim', M, w * 0.72, 1, 4, 0, 8.6, d / 2 + 2.2, C(0xfaf5ea)); gable('trim', rotY(mul(M, 0, 0, d / 2 + 2.2)), 4, w * 0.72, 9.6, 2.6, C(0xfaf5ea), 0.2);
        boxAt('trim', M, 6, 8, 6, 0, h, 0, st0); boxAt('glow', M, 3, 3, 0.08, 0, h + 4, 3.05, C(0xfff6d8)); boxAt('trim', M, 0.15, 1.2, 0.08, 0, h + 5.1, 3.1, C(0x2b3440)); hip('roof', M, 6, 6, h + 8.3, 2.6, C(0x5fb3a0), 0.3); return h + 12; } // the Exchange: a portico and a clock tower
      { const ck = st === 1 ? (fl >= 8 ? 0 : 9) : Math.floor(hash(b.x * 0.71, b.z * 0.43) * 4), top = h + 0.7; // a different top for each tower
        if (ck === 0 && fl >= 8) { boxAt('trim', M, 0.4, 10, 0.4, 0, top, 0, C(0x8a939c)); boxAt('glow', M, 0.7, 0.7, 0.7, 0, top + 10, 0, C(0xff4b3a)); return h + 11; }
        if (ck === 0 || ck === 1) { walls('office', M, wt * 0.6, dt * 0.6, top, top + 6.8, wc, 4, 3.4); boxAt('trim', M, wt * 0.6 + 0.5, 0.5, dt * 0.6 + 0.5, 0, top + 6.8, 0, C(0xe8edf2)); boxAt('roof', M, wt * 0.6 - 0.2, 0.12, dt * 0.6 - 0.2, 0, top + 7.3, 0, C(b.roof || 0x5b7fa8)); return h + 8.4; }
        if (ck === 2) { boxAt('lawn', M, wt - 1.6, 0.3, dt - 1.6, 0, top, 0, C(0x63bb4b)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt('trim', M, 0.25, 3, 0.25, sx * wt * 0.3, top, sz * dt * 0.3, C(0xf4efe6)); boxAt('trim', M, wt * 0.6 + 0.6, 0.25, dt * 0.6 + 0.6, 0, top + 3, 0, C(0xf4efe6)); return h + 4.4; }
        if (ck === 3) { hip('roof', M, wt * 0.5, dt * 0.5, top, 3.4, C(0x8cc4e6), 0.1); return h + 4.6; } }
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
    villa(b, M, w, d) { // villas in three styles on generous plots: a front wall with gate piers, a drive to a carport, a paved terrace and
      // pool behind, a balcony over the garden, privacy hedges and cypresses; the wild trees stay outside the plot (clear)
      const st = Math.floor(hash(b.x * 0.21, b.z * 0.43) * 3) % 3, wc = C(st === 1 ? 0xf3e6cf : st === 2 ? 0xf4f1ea : 0xffffff), F = d / 2 + 4.4, cx = w / 2 + 2.4; b.doorX = -w * 0.15; b.style = st; b.clear = 11; b.gate = [cx, F];
      boxAt('lawn', M, w + 10, 0.12, d + 14.4, 0, 0, -2.8, C(0x5cb447)); const hg = C(0x3f8f3a);
      boxAt('trim', M, w + 10, 1.5, 0.8, 0, 0, -d / 2 - 10, hg); for (const sx of [-1, 1]) boxAt('trim', M, 0.8, 1.5, d + 14.4, sx * (w / 2 + 5), 0, -2.8, hg);
      let fx = -w / 2 - 5; for (const [a, c] of [[b.doorX - 0.8, b.doorX + 0.8], [cx - 1.9, cx + 1.9], [w / 2 + 5, w / 2 + 5]]) { if (a - fx > 0.3) boxAt('trim', M, a - fx, 0.95, 0.4, (a + fx) / 2, 0, F, C(0xefe7d8)); fx = c; }
      for (const s of [-1, 1]) boxAt('trim', M, 0.7, 1.6, 0.7, cx + s * 2.2, 0, F, C(0xe2d8c4)); // gate piers at the drive
      boxAt('lawn', M, 3.4, 0.16, F - d / 2 + 0.5, cx, 0, (F + d / 2 - 0.5) / 2, C(0xcfc6b4)); // the drive
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt('trim', M, 0.2, 2.6, 0.2, cx + sx * 1.8, 0, 2.5 + sz * 2.8, C(0x3b3f48)); boxAt('roof', M, 4.2, 0.2, 6.2, cx, 2.6, 2.5, C(0x3b3f48));
      { const p = new THREE.Vector3(cx, 0, 2.3).applyMatrix4(M); PARKED.push([pick(['suv', 'sedan', 'compact']), p.x, p.z, b.rot + Math.PI, b.y + 0.05]); }
      boxAt('trim', M, w + 0.4, 0.5, d + 0.4, 0, 0, 0, C(0xe6dfd2));
      if (st === 0) { walls('flat', M, w, d, 0.5, 3.9, wc, 3.2, 3.4); boxAt('trim', M, w + 1, 0.35, d + 1, 0, 3.9, 0, C(0xf7f5f0)); walls('hotel', mul(M, -w * 0.12, 0, -d * 0.1), w * 0.64, d * 0.7, 4.25, 7.4, C(0xeaf6ff), 3.2, 3.15); boxAt('trim', M, w * 0.64 + 1.2, 0.4, d * 0.7 + 1.2, -w * 0.12, 7.4, -d * 0.1, C(0xf7f5f0)); boxAt('roof', M, w * 0.64, 0.1, d * 0.7, -w * 0.12, 7.8, -d * 0.1, C(b.roof || 0x5b7fa8)); }
      else if (st === 1) { walls('flat', M, w, d, 0.5, 7, wc, 3.2, 3.25); hip('roof', M, w, d, 7.3, Math.min(w, d) * 0.3, C(0xc9663f)); for (let i = 0; i < 3; i++) { boxAt('trim', M, 2.2, 2.7, 0.3, -w * 0.3 + i * w * 0.3, 0.5, d / 2 + 0.05, C(0x6a4a3a)); boxAt('trim', M, 2.8, 0.35, 0.4, -w * 0.3 + i * w * 0.3, 3.2, d / 2 + 0.1, C(0xe2d8c4)); } }
      else { walls('flat', mul(M, -w * 0.22, 0, 0), w * 0.56, d, 0.5, 7, wc, 3.2, 3.25); boxAt('roof', M, w * 0.56 + 0.4, 0.4, d + 0.4, -w * 0.22, 7, 0, C(0x5c6670)); walls('flat', mul(M, w * 0.28, 0, 0.5), w * 0.44, d - 1, 0.5, 3.7, wc, 3.2, 3.2); boxAt('trim', M, w * 0.44 + 0.4, 0.35, d - 0.6, w * 0.28, 3.7, 0.5, C(0xf7f5f0)); boxAt('trim', M, w * 0.56, 2.2, 0.15, -w * 0.22, 4.4, d / 2 + 0.06, C(0x8a5a3c)); frameAt('glassy', M, w * 0.44, d - 1, 1, 0.08, w * 0.28, 0.5, C(0xcfeeff), 4.05); }
      boxAt('trim', M, w * 0.6, 0.25, 2, -w * 0.1, 3.9, -d / 2 - 1, C(0xf7f5f0)); boxAt('glassy', M, w * 0.6, 1, 0.06, -w * 0.1, 4.15, -d / 2 - 1.97, C(0xcfeeff)); // balcony over the garden
      boxAt('lawn', M, 10.5, 0.2, 13, w * 0.18, 0, -d / 2 - 6.2, C(0xeae3d4)); frameAt('trim', M, 5, 9, 0.45, 0.45, w * 0.18, -d / 2 - 6, C(0xffffff)); boxAt('water', M, 4.1, 0.3, 8.1, w * 0.18, 0, -d / 2 - 6, C(0x35c6ea));
      for (let i = 0; i < 2; i++) boxAt('trim', M, 0.8, 0.3, 1.9, w * 0.18 - 4.2 + i * 1.3, 0.2, -d / 2 - 6, C(0xffffff)); geoAt('trim', CYL8, M, w * 0.18 + 3.8, 1.3, -d / 2 - 9, C(0xffffff), 0, 0.05, 2.6, 0.05); geoAt('detail', new THREE.ConeGeometry(1.4, 0.5, 8), M, w * 0.18 + 3.8, 2.6, -d / 2 - 9, C(0xffffff));
      boxAt('trim', M, 1.5, 2.4, 0.3, b.doorX, 0.5, d / 2 + 0.15, C(0x3b3f48));
      for (const sx of [-1, 1]) for (let z = -d / 2 - 8; z <= d / 2 - 1; z += 4.5) { if (sx > 0 && z > -2.2 && z < 7.2) continue; /* the carport is there */ const p = new THREE.Vector3(sx * (w / 2 + 3.9), 0, z).applyMatrix4(M); extraTrees.push([p.x, heightAt(p.x, p.z), p.z, 0.75, 'cypress']); }
      { const p = new THREE.Vector3(-w / 2 - 2, 0, -d / 2 - 7).applyMatrix4(M); extraTrees.push([p.x, heightAt(p.x, p.z), p.z, 0.85, 'palm']); }
      return st === 0 ? 8 : 8.6;
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
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * 46, z = sz * 46 * S, ry = Math.atan2(sx, sz * S); boxAt('metal', M, 0.7, 30, 0.7, x, 0, z, C(0x9aa3ab)); for (let k = 0; k < 6; k++) boxAt('metal', M, 1.4, 0.12, 0.12, x, 4 + k * 4.4, z, C(0x9aa3ab), ry + (k % 2 ? 0.6 : -0.6)); boxAt('trim', M, 5.4, 3.2, 0.5, x, 30, z, C(0x3a4150), ry); boxAt('flood', M, 4.8, 2.6, 0.12, x - sx * 0.25, 30.3, z - sz * 0.25 * S, C(0xffffff), ry); } // floodlight masts on the rim: lit on match days
      sign(M, 16, 16, 2.6, 0, 12.4, 56 * S + 0.6); // STADIUM, over the main gate
      return 36;
    },
    kiosk(b, M, w, d) { walls('shop', M, w, d, 0, 3, C(0xffffff), w, 3); boxAt('detail', M, w + 1.6, 0.25, d + 1.6, 0, 3, 0, C(b.awn || 0xff8a3d)); if (b.sign != null) sign(M, b.sign, w * 0.9, 0.8, 0, 3.7, d / 2 + 0.8); return 4; },
    lighthouse(b, M) { const st = [[4.2, 3.6, 7, 0xffffff], [3.6, 3.1, 7, 0xd8392b], [3.1, 2.7, 7, 0xffffff], [2.7, 2.4, 3, 0xd8392b]]; let y = 0; for (const [r0, r1, hh, c] of st) { geoAt('trim', new THREE.CylinderGeometry(r1, r0, hh, 16), M, 0, y + hh / 2, 0, C(c)); y += hh; } geoAt('glow', CYL, M, 0, y + 1.5, 0, C(0xfff3b0), 0, 2.2, 3, 2.2); geoAt('roof', new THREE.ConeGeometry(3, 3, 14), M, 0, y + 4.5, 0, C(0x26323e)); return y + 6; },
  };

  // ---------- walking: one network for the pavements, kerb corners, crossings, footpaths and front paths ----------
  // Every front door is joined to it (or, out of town, to the road edge), the people in town walk only on it, and the road
  // checks list any door it can't reach. Footpaths are routed round buildings and gardens, never through them.
  const WG = { v: [], links: [], grid: new Map() }, WCELL = 12, vmap = new Map();
  const wkey = (x, z) => Math.floor(x / WCELL) * 100003 + Math.floor(z / WCELL); // numeric cell keys: strings were slow
  function wvert(x, y, z) { // a vertex, shared with any other within half a metre
    const kx = Math.round(x * 2), kz = Math.round(z * 2);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const v = vmap.get((kx + i) + ',' + (kz + j)); if (v && Math.hypot(v.x - x, v.z - z) < 0.55) return v; }
    const v = { x, y, z, adj: [], id: WG.v.length }; WG.v.push(v); vmap.set(kx + ',' + kz, v); return v;
  }
  function wlink(pts, kind = 'path') {
    if (pts.length < 2) return null; const a = wvert(...pts[0]), b = wvert(...pts[pts.length - 1]); if (a === b) return null;
    pts[0] = [a.x, a.y, a.z]; pts[pts.length - 1] = [b.x, b.y, b.z]; const L = { a, b, pts, kind, cum: cumOf(pts) }; L.len = L.cum[L.cum.length - 1];
    WG.links.push(L); a.adj.push(L); b.adj.push(L);
    for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1], n = Math.ceil(Math.hypot(q[0] - p[0], q[2] - p[2]) / 4) + 1; for (let k = 0; k <= n; k++) { const key = wkey(mix(p[0], q[0], k / n), mix(p[2], q[2], k / n)); if (!WG.grid.has(key)) WG.grid.set(key, new Set()); WG.grid.get(key).add(L); } }
    return L;
  }
  function wunlink(L) { WG.links.splice(WG.links.indexOf(L), 1); L.a.adj.splice(L.a.adj.indexOf(L), 1); L.b.adj.splice(L.b.adj.indexOf(L), 1); for (const s of WG.grid.values()) s.delete(L); }
  function wnear(x, z, r = 3, kind) { // the nearest point on the walking network within r metres
    let best = null, bd = r; const gx = Math.floor(x / WCELL), gz = Math.floor(z / WCELL), R = Math.ceil(r / WCELL);
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (const L of WG.grid.get((gx + i) * 100003 + gz + j) || []) { if (kind && L.kind !== kind) continue; for (let k = 0; k < L.pts.length - 1; k++) {
      const p = L.pts[k], q = L.pts[k + 1], ex = q[0] - p[0], ez = q[2] - p[2], t0 = ((x - p[0]) * ex + (z - p[2]) * ez) / (ex * ex + ez * ez || 1), t = t0 < 0 ? 0 : t0 > 1 ? 1 : t0, qx = p[0] + ex * t - x, qz = p[2] + ez * t - z, d = Math.sqrt(qx * qx + qz * qz);
      if (d < bd) { bd = d; best = { L, k, t, d, x: p[0] + ex * t, y: mix(p[1], q[1], t), z: p[2] + ez * t, s: L.cum[k] + (L.cum[k + 1] - L.cum[k]) * t }; } } }
    return best;
  }
  function wsplit(h) { // a vertex at that point on the network (the link is split there)
    const L = h.L; if (h.s < 0.6) return L.a; if (h.s > L.len - 0.6) return L.b;
    const P = [h.x, h.y, h.z], A = L.pts.slice(0, h.k + 1).concat([P]), Bp = [P].concat(L.pts.slice(h.k + 1)); wunlink(L); wlink(A, L.kind); wlink(Bp, L.kind); return wvert(...P);
  }
  const offAlong = (pts, off) => pts.map((p, i) => { let a = i, b = i; while (a > 0 && Math.hypot(pts[a][0] - p[0], pts[a][2] - p[2]) < 0.4) a--; while (b < pts.length - 1 && Math.hypot(pts[b][0] - p[0], pts[b][2] - p[2]) < 0.4) b++; const dx = pts[b][0] - pts[a][0], dz = pts[b][2] - pts[a][2], L = Math.hypot(dx, dz) || 1; return [p[0] - dz / L * off, p[1], p[2] + dx / L * off]; });
  function buildWalkNet() { // pavements both sides of every street that has them, joined round each junction corner and across each zebra
    for (const e of edges) { const W = WALK[e.kind]; if (!W) continue; const hw = e.w / 2, o = hw + W * 0.62, sa = e.a.deg >= 3 ? e.a.r : 0, sb = e.len - (e.b.deg >= 3 ? e.b.r : 0); if (sb - sa < 1) continue;
      const xs = crossAt(e), cuts = [sa, ...xs.map(c => c[1]), sb].sort((p, q) => p - q);
      for (const sd of [1, -1]) for (let i = 0; i + 1 < cuts.length; i++) wlink(offAlong(cut(e.pts, cuts[i], cuts[i + 1]), sd * o).map(p => [p[0], p[1] + 0.1, p[2]]), 'pave');
      for (const [, s] of xs) { const p = armAt(e.a, e, s), q = armAt(e.a, e, s + 1), L = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1, nx = -(q[2] - p[2]) / L, nz = (q[0] - p[0]) / L; wlink([[p[0] + nx * o, p[1] + 0.1, p[2] + nz * o], [p[0] - nx * o, p[1] + 0.1, p[2] - nz * o]], 'cross'); }
    }
    for (const id in nodes) { const N = nodes[id]; if (N.deg < 3) continue; const A = armsOf(N);
      A.forEach((a, i) => { const b = A[(i + 1) % A.length], Wa = WALK[a.e.kind], Wb = WALK[b.e.kind]; if (!Wa || !Wb) return; const oa = a.hw + Wa * 0.62, ob = b.hw + Wb * 0.62;
        const P0 = [a.m[0] + a.n[0] * oa, a.m[1] + 0.1, a.m[2] + a.n[1] * oa], P2 = [b.m[0] - b.n[0] * ob, b.m[1] + 0.1, b.m[2] - b.n[1] * ob], cr = a.u[0] * b.u[1] - a.u[1] * b.u[0]; let Cc = [(P0[0] + P2[0]) / 2, (P0[2] + P2[2]) / 2];
        if (Math.abs(cr) > 0.08) { const t = ((P2[0] - P0[0]) * b.u[1] - (P2[2] - P0[2]) * b.u[0]) / cr; if (t < 0 && t > -30) Cc = [P0[0] + a.u[0] * t, P0[2] + a.u[1] * t]; }
        const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6, w0 = (1 - t) * (1 - t), w1 = 2 * t * (1 - t), w2 = t * t; pts.push([w0 * P0[0] + w1 * Cc[0] + w2 * P2[0], mix(P0[1], P2[1], t), w0 * P0[2] + w1 * Cc[1] + w2 * P2[2]]); }
        wlink(pts, 'pave'); }); }
    for (const id in nodes) { const N = nodes[id]; if (N.deg !== 1 || !WALK[N.edges[0].kind]) continue; const ends = WG.v.filter(v => v.adj.length === 1 && Math.hypot(v.x - N.x, v.z - N.z) < N.edges[0].w / 2 + 4); if (ends.length === 2) wlink([[ends[0].x, ends[0].y, ends[0].z], [ends[1].x, ends[1].y, ends[1].z]], 'cross'); } // round the head of a dead end
    for (const v of WG.v.slice()) if (v.adj.length === 1) { let best = null, bd = 2.6; for (const u of WG.v) if (u !== v && u.adj.length === 1 && Math.hypot(u.x - v.x, u.z - v.z) < bd && !v.adj.some(L => L.a === u || L.b === u)) { best = u; bd = Math.hypot(u.x - v.x, u.z - v.z); } if (best) wlink([[v.x, v.y, v.z], [best.x, best.y, best.z]], 'pave'); } // the two pavements meeting round a bend
  }
  // obstacles for footpaths: buildings (with a margin), gardens and yards, carriageways, the sea; indexed in 20 m cells
  let BIDX = null; const bcell = (x, z) => Math.floor(x / 20) + ',' + Math.floor(z / 20);
  function obstacleIndex(LOTS) { BIDX = new Map(); const add = (o, x0, x1, z0, z1) => { for (let i = Math.floor(x0 / 20); i <= Math.floor(x1 / 20); i++) for (let j = Math.floor(z0 / 20); j <= Math.floor(z1 / 20); j++) { const k = i + ',' + j; if (!BIDX.has(k)) BIDX.set(k, []); BIDX.get(k).push(o); } };
    for (const b of buildings) { const r = Math.hypot(b.w, b.d) / 2 + 2; add({ b, x: b.x, z: b.z, w: b.w + 1.4, d: b.d + 1.4, rot: b.rot }, b.x - r, b.x + r, b.z - r, b.z + r); }
    for (const L of LOTS) { if (L.open) continue; const r = Math.hypot(L.w, L.d) / 2 + 1; add({ lot: L, x: L.x, z: L.z, w: L.w, d: L.d, rot: L.rot }, L.x - r, L.x + r, L.z - r, L.z + r); } }
  const inR = (px, pz, r) => { const c = Math.cos(r.rot), s = Math.sin(r.rot), lx = (px - r.x) * c - (pz - r.z) * s, lz = (px - r.x) * s + (pz - r.z) * c; return Math.abs(lx) < r.w / 2 && Math.abs(lz) < r.d / 2; };
  const LRC = new Map();
  function blockedAt(x, z, own) { // own: { b, lots } that a front path may cross (its own building's front and garden)
    const key = x * 4096 + z; let wet = LRC.get(key); if (wet === undefined) { wet = land(x, z) < 2.5 || nearRoad(x, z)[0] < 0.25; LRC.set(key, wet); } if (wet) return true; // the sea and the carriageways don't change: worked out once per metre
    for (const o of BIDX.get(bcell(x, z)) || []) if (inR(x, z, o) && !(own && (o.b === own.b || (o.lot && own.lots.includes(o.lot))))) return true;
    return false;
  }
  const clearLine = (a, b, own) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 0.5); for (let i = 1; i < n; i++) if (blockedAt(mix(a[0], b[0], i / n), mix(a[1], b[1], i / n), own)) return false; return true; };
  const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  function route2d(sx, sz, goal, own, R = 50) { // a footpath route on a 1 m grid to wherever goal(x, z) says, round obstacles; smoothed
    const N = 2 * R + 1, ox = Math.round(sx) - R, oz = Math.round(sz) - R, g = new Float32Array(N * N).fill(1e9), from = new Int32Array(N * N).fill(-1), shut = new Uint8Array(N * N), heap = [];
    const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const k0 = R * N + R; g[k0] = 0; push(k0, 0); let found = -1;
    while (heap.length) { const [, k] = pop(); if (shut[k]) continue; shut[k] = 1; const i = k % N, j = (k / N) | 0;
      if (k !== k0 && goal(ox + i, oz + j)) { found = k; break; }
      for (const [di, dj, c] of D8) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nk = nj * N + ni; if (shut[nk] || g[k] + c >= g[nk]) continue; if (blockedAt(ox + ni, oz + nj, own)) { shut[nk] = 1; continue; } g[nk] = g[k] + c; from[nk] = k; push(nk, g[nk]); } }
    if (found < 0) return null; const raw = []; for (let c = found; c >= 0; c = from[c]) raw.unshift([ox + c % N, oz + ((c / N) | 0)]); raw[0] = [sx, sz];
    const out = [raw[0]]; let i = 0; while (i < raw.length - 1) { let j = raw.length - 1; while (j > i + 1 && !clearLine(raw[i], raw[j], own)) j--; out.push(raw[j]); i = j; } return out; // pulled straight wherever the way is clear
  }
  const FOOT = { path: [], front: [] }, POI = []; // footpath ribbons to draw; places people walk to: { v, kind, b }
  function lay(pts2, w, kind) { const P = []; for (let i = 0; i < pts2.length - 1; i++) { const a = pts2[i], b = pts2[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let k = 0; k < n; k++) P.push([mix(a[0], b[0], k / n), mix(a[1], b[1], k / n)]); } P.push(pts2[pts2.length - 1]); return P.map(([x, z]) => [x, Math.max(heightAt(x, z), TOWN_Y - 0.4) + 0.12, z]); }
  function path(pts2, o = {}) { // a footpath: drawn, and joined to the network at both ends where the network is close
    const w = o.w || 1.6, P = lay(pts2, w); if (!o.hidden) ribbon(FOOT[o.front ? 'front' : 'path'], P, w / 2, w / 2, 0);
    for (const end of [0, P.length - 1]) { const h = wnear(P[end][0], P[end][2], o.snap || 1.4); if (h && !(o.front && end === 0)) { const v = wsplit(h); P[end] = [v.x, v.y, v.z]; } }
    return wlink(P, o.kind || 'path');
  }
  function toNet(x, z, own, R = 45, kind) { return route2d(x, z, (gx, gz) => !!wnear(gx, gz, 1.0, kind), own, R); } // a route from a point to the nearest walkway (or pavement)
  function poi(x, z, kind, b) { const h = wnear(x, z, 2.5); if (!h) return null; const p = { v: wsplit(h), kind, b }; POI.push(p); return p; }
  const DOOR = { house: 1, flat: 1, shophouse: 1, villa: 1, civic: 1, office: 1, tower: 1, cityhall: 1, kiosk: 1 };
  const ACCESS = { joined: 0, road: 0, none: [] };
  function entrances(LOTS) { // a path from every front door to the pavement, straight out where it can, round obstacles where it can't
    for (const b of buildings) { if (!DOOR[b.type] || b.noPath || b.door || b.toRoad) continue;
      const f = [Math.sin(b.rot), Math.cos(b.rot)], sx = [Math.cos(b.rot), -Math.sin(b.rot)], dx = (b.doorX || 0) * (b.scale || 1), fz = (b.d / 2 + (b.doorZ || 0)) * (b.scale || 1), D = [b.x + f[0] * fz + sx[0] * dx, b.z + f[1] * fz + sx[1] * dx];
      const own = { b, lots: LOTS.filter(r => inR(D[0] - f[0] * 0.5, D[1] - f[1] * 0.5, r) || inR(D[0] + f[0] * 0.8, D[1] + f[1] * 0.8, r)) }; let route = null, toRoad = false;
      for (let s = 0.4; s < 28; s += 0.4) { const x = D[0] + f[0] * s, z = D[1] + f[1] * s; if (wnear(x, z, 0.9)) { if (clearLine(D, [x, z], own)) route = [D, [x, z]]; break; } if (nearRoad(x, z)[0] < 0.3) { if (clearLine(D, [x - f[0] * 0.5, z - f[1] * 0.5], own)) { route = [D, [x, z]]; toRoad = true; } break; } if (blockedAt(x, z, own)) break; }
      if (!route) { const r = toNet(D[0] + f[0] * 0.9, D[1] + f[1] * 0.9, own, EXPANDED ? 80 : 40); if (r) route = [D].concat(r); }
      if (!route) { ACCESS.none.push(b.name); continue; }
      const L = path(route, { w: b.type === 'villa' || b.type === 'house' ? 1.3 : 1.8, front: true, kind: 'front', hidden: toRoad && b.type === 'villa' }); if (toRoad) { ACCESS.road++; b.toRoad = true; } else ACCESS.joined++;
      if (L) { b.door = L.a; POI.push({ v: L.a, kind: b.type, b }); }
    }
  }
  // ---------- public places, joined to the streets: Market Square, Quarter Park, the business plazas ----------
  const LAMPS = []; // lamp posts anywhere in town, drawn together
  const freeOfPaths = (x, z, r = 1.3) => !wnear(x, z, r);
  function slab(x, z, w, d, color, o = {}) { tileAt(x, z); const tile = o.tile || 2.4, g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile); geoAt(o.k || 'plaza', g, new THREE.Matrix4(), x, o.y != null ? o.y : TOWN_Y + 0.13, z, C(color), o.ry || 0); }
  function bench(x, z, ry, y = TOWN_Y + 0.13) { tileAt(x, z); const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z); boxAt('trim', M, 1.9, 0.1, 0.55, 0, 0.42, 0, C(0x9a6a44)); boxAt('trim', M, 1.9, 0.45, 0.08, 0, 0.55, -0.26, C(0x9a6a44)); for (const s of [-0.8, 0.8]) boxAt('trim', M, 0.1, 0.42, 0.5, s, 0, 0, C(0x3a4150)); }
  function bin(x, z, y = TOWN_Y + 0.13) { tileAt(x, z); geoAt('trim', CYL8, new THREE.Matrix4(), x, y + 0.45, z, C(0x2f6b4a), 0, 0.28, 0.9, 0.28); }
  function bikes(x, z, ry, n = 4, y = TOWN_Y + 0.13) { tileAt(x, z); const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z); for (let i = 0; i < n; i++) { boxAt('trim', M, 0.06, 0.75, 0.7, -n * 0.45 + i * 0.9, 0, 0, C(0x9aa3ab)); if (i % 2 === 0) { boxAt('detail', M, 0.05, 0.55, 1.6, -n * 0.45 + i * 0.9 + 0.2, 0.25, 0, C(pick([0xd8392b, 0x2e74c9, 0x1f8f5b, 0x24282e]))); } } }
  function planter(x, z, w, d, tree, y = TOWN_Y + 0.13) { tileAt(x, z); const M = new THREE.Matrix4().setPosition(x, y, z); frameAt('trim', M, w, d, 0.45, 0.3, 0, 0, C(0xd2c7b0)); boxAt('lawn', M, w - 0.5, 0.38, d - 0.5, 0, 0, 0, C(0x5a9e3e)); if (tree) extraTrees.push([x, y + 0.35, z, 0.62, tree]); else for (let i = 0; i < Math.round(w * d / 3); i++) extraTrees.push([x + (rnd() - 0.5) * (w - 1), y + 0.3, z + (rnd() - 0.5) * (d - 1), 0.35 + rnd() * 0.2, rnd() < 0.5 ? 'flower' : 'bush']); }
  function umbrellaTable(x, z, c, y = TOWN_Y + 0.13) { tileAt(x, z); const M = new THREE.Matrix4().setPosition(x, y, z); geoAt('trim', CYL8, M, 0, 0.72, 0, C(0xffffff), 0, 0.55, 0.06, 0.55); geoAt('trim', CYL8, M, 0, 1.3, 0, C(0xdddddd), 0, 0.05, 2.6, 0.05); geoAt('detail', new THREE.ConeGeometry(1.5, 0.5, 8), M, 0, 2.6, 0, C(c)); for (const a of [0, 2.1, 4.2]) boxAt('trim', M, 0.4, 0.45, 0.4, Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95, C(0x3a4150)); }
  function stall(x, z, ry, c) { tileAt(x, z); const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, TOWN_Y + 0.13, z); for (const sx of [-1.4, 1.4]) for (const sz of [-0.9, 0.9]) boxAt('trim', M, 0.09, 2.3, 0.09, sx, 0, sz, C(0xe9e4da));
    for (let i = 0; i < 6; i++) boxAt('detail', M, 0.52, 0.12, 2.3, -1.3 + i * 0.52, 2.3, 0, C(i % 2 ? 0xffffff : c)); boxAt('trim', M, 2.8, 0.8, 1.4, 0, 0, 0.1, C(0xb58a5c));
    for (let i = 0; i < 4; i++) boxAt('detail', M, 0.55, 0.28, 0.45, -1 + i * 0.68, 0.8, 0.3, C([0xe8483f, 0xf2a531, 0x6fbf3f, 0xffd21f][i])); }
  function buildPlaces(LOTS) {
    obstacleIndex(LOTS); buildWalkNet(); seed = 57;
    // Market Square: warm stone with banded paving, a fountain in a ring of seats, four planted corners with shade trees,
    // a row of market stalls (fresh food, the trade the island's farms supply), a café kiosk; an entrance on each side
    const SQ = [0, -32]; slab(0, -32, 44, 50, 0xe9dcc2); slab(0, -32, 3, 50, 0xd7c4a2, { y: TOWN_Y + 0.135 }); slab(0, -32, 44, 3, 0xd7c4a2, { y: TOWN_Y + 0.135 });
    { const M = new THREE.Matrix4().setPosition(0, TOWN_Y + 0.14, -32); geoAt('plaza', CYL, M, 0, 0, 0, C(0xd2bc96), 0, 9.5, 0.02, 9.5); geoAt('trim', CYL, M, 0, 0.4, 0, C(0xe2d8c4), 0, 5, 0.8, 5); geoAt('water', CYL, M, 0, 0.78, 0, C(0x46c9e8), 0, 4.4, 0.1, 4.4); geoAt('trim', CYL, M, 0, 1, 0, C(0xe2d8c4), 0, 1.6, 2, 1.6); geoAt('water', CYL, M, 0, 2.02, 0, C(0x7fdcf2), 0, 1.3, 0.06, 1.3); geoAt('glassy', CYL8, M, 0, 2.8, 0, C(0xdff6ff), 0, 0.35, 1.6, 0.35); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = sx * 14, z = -32 + sz * 15.5; planter(x, z, 9, 8, null); extraTrees.push([x, TOWN_Y + 0.4, z, 0.95, 'round']); bench(x - sx * 5.4, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2); bench(x, z - sz * 4.9, sz > 0 ? Math.PI : 0); bin(x - sx * 5.3, z - sz * 4.6); LAMPS.push([sx * 8, TOWN_Y + 0.13, -32 + sz * 8]); }
    for (let i = 0; i < 6; i++) stall(-13.5 + i * 5.4 + (i > 2 ? 2.4 : 0), -12, Math.PI, [0x2f8f3a, 0xe8483f, 0x2e74c9, 0xf2a531, 0x2f8f3a, 0xd6458b][i]);
    for (const [x, z] of [[9, -50], [13, -47], [5.5, -46.5]]) umbrellaTable(x, z, 0x2e74c9); bikes(-17.5, -36.5, Math.PI / 2, 5);
    { const r = 7.6, ring = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; ring.push([Math.cos(a) * r, SQ[1] + Math.sin(a) * r]); } path(ring, { hidden: true }); }
    for (const [a, b] of [[[0, -24.4], [0, -9]], [[0, -39.6], [0, -55]], [[-7.6, -32], [-22, -32]], [[7.6, -32], [22, -32]]]) { path([a, b], { hidden: true, snap: 0.8 }); const r = toNet(b[0], b[1], null, 60, 'pave'); if (r && r.length > 1) path(r, { w: 2.2 }); }
    poi(0, -24.4, 'square'); poi(-7.6, -32, 'square'); poi(0, -39.6, 'square'); poi(-10, -12, 'market'); poi(10, -12, 'market');
    LABELS.push({ text: 'Market Square', level: 'place', x: 0, y: 12, z: -32 });
    // Quarter Park: a bandstand on a ring path, a woodland walk, a community garden and the playground; every path reaches a street
    const PK = [-130, -22]; LAMPS.push([-140, TOWN_Y, -12], [-120, TOWN_Y, -32], [-140, TOWN_Y, -32], [-120, TOWN_Y, -12]);
    { const r = 10, ring = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2; ring.push([PK[0] + Math.cos(a) * r, PK[1] + Math.sin(a) * r]); } path(ring, { w: 2.2 });
      const M = new THREE.Matrix4().setPosition(PK[0], TOWN_Y, PK[1]); tileAt(PK[0], PK[1]); geoAt('trim', CYL, M, 0, 0.3, 0, C(0xe2d8c4), 0, 5.2, 0.6, 5.2); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; geoAt('trim', CYL8, M, Math.cos(a) * 4.6, 2.2, Math.sin(a) * 4.6, C(0xffffff), 0, 0.15, 3.4, 0.15); } geoAt('roof', new THREE.ConeGeometry(5.8, 2.4, 8), M, 0, 5, 0, C(0x2f8f6f)); }
    const arms = [[[PK[0] - 10, PK[1]], [-178, PK[1] + 2]], [[PK[0] + 10, PK[1]], [-84, PK[1] - 2]], [[PK[0], PK[1] - 10], [PK[0] - 2, -76]], [[PK[0], PK[1] + 10], [PK[0] + 2, 10]]];
    for (const [a, b] of arms) { path([a, b], { w: 2.2 }); const r = toNet(b[0], b[1], null, 50, 'pave'); if (r && r.length > 1) path(r, { w: 2 }); }
    { const loop = []; for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2, rr = 15 + Math.sin(a * 3) * 2.5; loop.push([-158 + Math.cos(a) * rr, -52 + Math.sin(a) * rr]); } path(loop, { w: 1.6 }); path([[-143, -52], [-131, -52]], { w: 1.6 }); path([[-158, -37], [-158, -21]], { w: 1.6 }); }
    path([[-129, -60], [-109, -60]], { w: 1.8 }); poi(-109, -60, 'park'); poi(PK[0] + 10, PK[1], 'park'); poi(-158, -67, 'park');
    entrances(LOTS); // front paths now, so the planting and furniture that follow keep clear of them
    { const M = new THREE.Matrix4().setPosition(-156, TOWN_Y, -4); tileAt(-156, -4); frameAt('trim', M, 22, 16, 1, 0.12, 0, 0, C(0xf4efe6)); boxAt('trim', M, 2.2, 1.1, 0.4, 0, 0, -8, C(0x5cb447)); // the community garden: beds of crops, a shed, a gate onto the path
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { boxAt('lawn', M, 3.6, 0.25, 5, -7.5 + i * 4.8, 0, -2.5 + j * 7, C(0x7a5a3c)); for (let k = 0; k < 3; k++) boxAt('trim', M, 3.2, 0.35, 0.5, -7.5 + i * 4.8, 0.25, -4.2 + j * 7 + k * 1.7, C(pick([0x4caf3f, 0x6fbf3f, 0xe85d3f, 0x3f8f3f]))); }
      boxAt('trim', M, 3, 2.4, 2.4, 8.5, 0, 5, C(0x8a6a4a)); gable('roof', M, 3, 2.4, 2.4, 1, C(0x5a4a3a), 0.2); path([[-156, -12.4], [-156, -19.5]], { w: 1.4 }); }
    for (const [x, z] of [[-112, 2], [-104, -6], [-114, -10]]) { tileAt(x, z); const M = new THREE.Matrix4().setPosition(x, TOWN_Y, z); boxAt('trim', M, 2, 0.1, 0.9, 0, 0.72, 0, C(0x9a6a44)); for (const s of [-0.75, 0.75]) boxAt('trim', M, 2, 0.08, 0.3, 0, 0.42, s, C(0x9a6a44)); } // picnic tables on the open lawn
    for (const [x, z, r] of [[-140, -20, Math.PI / 2], [-120, -20, -Math.PI / 2], [-130, -30, 0], [-130, -10, Math.PI]]) bench(x, z, r, TOWN_Y);
    for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 24, x = -158 + Math.cos(a) * rr, z = -54 + Math.sin(a) * rr; if (freeOfPaths(x, z, 1.8) && !inside(x, z, 2) && x > -184 && x < -134 && z > -80 && z < -30) extraTrees.push([x, TOWN_Y, z, 0.8 + rnd() * 0.45, rnd() < 0.25 ? 'pine' : rnd() < 0.3 ? 'cypress' : 'round']); } // the wood
    for (let i = 0; i < 30; i++) { const x = -178 + rnd() * 92, z = -74 + rnd() * 84; if (freeOfPaths(x, z, 2.5) && !inside(x, z, 3) && Math.hypot(x - PK[0], z - PK[1]) > 15 && !(x < -134 && z < -30) && !(Math.abs(x + 156) < 13 && Math.abs(z + 4) < 10) && !(Math.abs(x + 100) < 11 && Math.abs(z + 60) < 10)) extraTrees.push([x, TOWN_Y, z, 0.8 + rnd() * 0.3, 'round']); }
    LABELS.push({ text: 'Quarter Park', level: 'place', x: PK[0], y: 10, z: PK[1], small: true });
    buildDistricts(LOTS);
    // the business centre: paved blocks with planted courtyards, street trees in planters, cafés and bike racks at the towers
    for (const [x0, x1, z0, z1] of [[-193.4, -66.1, -193.4, -116.6], [-53.9, 53.9, -193.4, -116.6], [66.1, 182.9, -193.4, -116.6]]) {
      slab((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0xdcd5c8, { y: TOWN_Y + 0.12, tile: 3 });
      for (let x = x0 + 4; x < x1 - 3; x += 11) for (const z of [z0 + 3.2, z1 - 3.2]) if (!inside(x, z, 1.5) && freeOfPaths(x, z, 1.8) && nearRoad(x, z)[0] > 2) planter(x, z, 1.8, 1.8, 'round', TOWN_Y + 0.12);
      for (let z = z0 + 14; z < z1 - 12; z += 11) for (const x of [x0 + 3.2, x1 - 3.2]) if (!inside(x, z, 1.5) && freeOfPaths(x, z, 1.8) && nearRoad(x, z)[0] > 2) planter(x, z, 1.8, 1.8, 'round', TOWN_Y + 0.12);
    }
    for (const [x, z, w, d] of [[-174, -166, 30, 44], [-90, -166, 30, 44], [0, -150, 34, 16], [138, -128, 22, 10]]) { slab(x, z, w, d, 0x63b44b, { k: 'bed', y: TOWN_Y + 0.2, tile: 50 }); frameAt('trim', new THREE.Matrix4().setPosition(x, TOWN_Y, z), w, d, 0.5, 0.35, 0, 0, C(0xd2c7b0)); for (let i = 0; i < Math.floor(w / 9); i++) for (let j = 0; j < Math.floor(d / 9); j++) extraTrees.push([x - w / 2 + 4.5 + i * 9 + (j % 2) * 2, TOWN_Y + 0.2, z - d / 2 + 4.5 + j * 9, 0.75, j % 3 === 2 ? 'cypress' : 'round']); }
    for (const [x, z] of [[-6, -121], [6, -121], [-46, -121], [50, -121], [120, -121], [132, -121]]) { const c = pick([0x1f3f8f, 0xffffff, 0x2f8f6f]); if (nearRoad(x, z)[0] > 2) umbrellaTable(x, z, c, TOWN_Y + 0.12); }
    for (const [x, z, r] of [[-17, -121, 0], [40, -121, 0], [112, -136, Math.PI / 2], [-132, -119, 0]]) bikes(x, z, r, 4, TOWN_Y + 0.12);
    { const t0 = performance.now(); buildWorks(); const t1 = performance.now(); buildExtras(LOTS); World.times.works = Math.round(t1 - t0); World.times.extras = Math.round(performance.now() - t1); }
  }
  // ---------- Industrial Isle as a working site: a gate on the bridge road, a tank farm with a pipe rack across the loop road to
  // the plant, a workshop, a container yard and a wharf where the cargo boat ties up. Each piece is placed where the ground is
  // clear (off the road, the water and other buildings) and recorded in World.works. ----------
  const WORKS = {};
  function buildWorks() {
    const I = new THREE.Matrix4(), PZ = new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2), dome = r => new THREE.SphereGeometry(r, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), LN = [0x2e5fa8, 0xb5452f, 0x2f7f86];
    const clear = (cx, cz, w, d, pad = 2.5, shore = 11) => { for (let x = -w / 2; x <= w / 2 + 0.1; x += Math.min(4, w / 2)) for (let z = -d / 2; z <= d / 2 + 0.1; z += Math.min(4, d / 2)) { const px = cx + x, pz = cz + z; if (land(px, pz) < shore || nearRoad(px, pz)[0] < pad || inside(px, pz, pad)) return false; } return true; };
    const fit = (x, z, w, d, pad, shore) => { if (clear(x, z, w, d, pad, shore)) return [x, z]; for (let s = 3; s <= 48; s += 3) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * s, pz = z + Math.sin(a) * s; if (clear(px, pz, w, d, pad, shore)) return [px, pz]; } return null; };
    const tank = (x, y, z, r, h, c, band) => { geoAt('trim', CYL, I, x, y + h / 2, z, C(c), 0, r, h, r); geoAt('trim', dome(r), I, x, y + h, z, C(0xdfe5ea)); if (band) geoAt('trim', CYL, I, x, y + h * 0.42, z, C(band), 0, r + 0.05, h * 0.16, r + 0.05); boxAt('trim', I, 0.3, h + 0.6, 0.3, x + r * 0.7, y, z + r * 0.7, C(0x6b7580)); };
    seed = 138;
    // the works gate: a sign gantry over the bridge road, the gatehouse beside it, the barrier standing open
    { const x = 474, zr = -180.7, y = 9; tileAt(x, zr); WORKS.gate = [x, zr];
      for (const s of [-1, 1]) boxAt('trim', I, 0.7, 6.8, 0.7, x, y, zr + s * 5.8, C(0x5c6670));
      boxAt('trim', I, 1.2, 1.5, 13.4, x, y + 6.4, zr, C(0xf2c12e)); sign(I, 40, 11, 1.3, x - 0.65, y + 7.15, zr, -Math.PI / 2); sign(I, 40, 11, 1.3, x + 0.65, y + 7.15, zr, Math.PI / 2);
      boxAt('trim', I, 3.2, 3, 2.6, x - 2, y, zr + 8.6, C(0xffffff)); boxAt('roof', I, 3.8, 0.3, 3.2, x - 2, y + 3, zr + 8.6, C(0x1f3f8f)); boxAt('glassy', I, 3.25, 1, 2.65, x - 2, y + 1.3, zr + 8.6, C(0x9fdcff));
      boxAt('trim', I, 0.2, 3.4, 0.2, x + 0.5, y, zr + 6.6, C(0xd8392b)); boxAt('trim', I, 0.22, 0.5, 0.22, x + 0.5, y + 1, zr + 6.6, C(0xffffff)); }
    // the tank farm behind a bund wall, and a pipe rack that crosses the loop road to the plant
    { const p = fit(546, -247, 40, 22, 2.5, 11); if (p) { const [cx, cz] = p, y = heightAt(cx, cz); WORKS.tanks = p; tileAt(cx, cz);
      boxAt('lawn', I, 40, 0.14, 22, cx, y, cz, C(0xa9a59b)); frameAt('trim', I, 40, 22, 1.2, 0.5, cx, cz, C(0xcdc7ba), y);
      tank(cx - 12, y + 0.1, cz - 4, 6, 11, 0xf1f3f4, 0xd8392b); tank(cx + 2, y + 0.1, cz - 4, 6, 11, 0xf1f3f4, 0x2e74c9); tank(cx + 14, y + 0.1, cz - 4, 4.5, 8.5, 0xe6eef4, 0xf2a531);
      for (const dx of [-12, -4, 4]) tank(cx + dx, y + 0.1, cz + 6.2, 3, 6, 0xdbe7f0, 0x2e5fa8);
      geoAt('metal', PZ, I, cx - 5, y + 0.6, cz - 4, C(0x8a939c), 0, 0.3, 0.3, 1); boxAt('trim', I, 22, 0.5, 0.5, cx - 1, y + 0.2, cz + 1.8, C(0x8a939c));
      boxAt('trim', I, 5, 3.2, 3.4, cx + 14, y, cz + 6.5, C(0xcfd6dc)); boxAt('roof', I, 5.4, 0.3, 3.8, cx + 14, y + 3.2, cz + 6.5, C(0x5c6670)); sign(I, 41, 4.6, 0.9, cx + 14, y + 2.4, cz + 8.25);
      const rx = 556.5, zs = cz + 11, ze = -203;
      if (ze - zs > 8 && Math.abs(cx - rx) < 20) { for (let z = zs + 1; z <= ze; z += 6) { if (nearRoad(rx, z)[0] < 2.4) continue; for (const s of [-1.1, 1.1]) boxAt('trim', I, 0.5, 6.6, 0.5, rx + s, 9, z, C(0x5c6670)); boxAt('trim', I, 3, 0.4, 0.5, rx, 15.4, z, C(0x5c6670)); }
        [[-0.9, 0x8a939c], [0, 0xd8392b], [0.9, 0xf2c12e]].forEach(([dx, c]) => geoAt('metal', PZ, I, rx + dx, 16.2, (zs + ze) / 2, C(c), 0, 0.32, 0.32, ze - zs)); }
    } }
    // the workshop beside the road from the bridge
    { const p = fit(488, -201, 28, 16, 3, 12); if (p) { WORKS.shop = p; addBuilding({ id: 'works', type: 'warehouse', name: 'Isle workshop', area: 'Industrial Isle', x: p[0], z: p[1], rot: 0, w: 26, d: 14, y: 9, roof: 0x6a7480, owner: 'city', yard: true, noPath: true }); } }
    // the container yard: two shipping lines, each stacked together, painted lanes, a truck waiting
    { const p = fit(574, -124, 30, 18, 2.5, 11); if (p) { const [cx, cz] = p, y = heightAt(cx, cz); WORKS.yard = p; tileAt(cx, cz);
      boxAt('lawn', I, 30, 0.16, 18, cx, y, cz, C(0xb7b3aa)); for (let i = 0; i <= 3; i++) boxAt('lawn', I, 0.2, 0.02, 18, cx - 15 + i * 10, y + 0.17, cz, C(0xf2c12e));
      for (let c = 0; c < 2; c++) for (let r = 0; r < 3; r++) for (let k = 0; k < 1 + ((r + c * 2) % 3); k++) boxAt('trim', I, 12, 2.6, 2.5, cx - 7.5 + c * 15, y + 0.16 + k * 2.6, cz - 6 + r * 2.9, C(c ? LN[1] : LN[0]));
      sign(I, 42, 5, 0.9, cx, y + 3.2, cz + 8.6); boxAt('trim', I, 0.2, 3.2, 0.2, cx - 2, y, cz + 8.6, C(0x5c6670)); boxAt('trim', I, 0.2, 3.2, 0.2, cx + 2, y, cz + 8.6, C(0x5c6670));
      PARKED.push(['truck', cx - 5, cz + 5.6, Math.PI / 2, y]); } }
    // the wharf: a concrete deck on a quay wall, bollards, fenders, a gantry crane, containers; the cargo boat ties up alongside
    { const cx = 548, y = 3.5, z0 = -98, z1 = -86.5, zc = (z0 + z1) / 2; tileAt(cx, zc); WORKS.wharf = [cx, zc];
      boxAt('trim', I, 46, 0.9, z1 - z0, cx, y - 0.9, zc, C(0xbdb7aa)); boxAt('trim', I, 46, 10.5, 1, cx, -7, z1 - 0.5, C(0x8f8a80));
      boxAt('lawn', I, 46, 0.03, 0.25, cx, y + 0.02, z1 - 1.1, C(0xf2c12e));
      for (let x = cx - 20; x <= cx + 20; x += 8) { boxAt('trim', I, 0.5, 0.6, 0.5, x, y, z1 - 0.7, C(0x2e3640)); boxAt('trim', I, 2, 0.8, 0.3, x + 4, y - 1.4, z1 + 0.1, C(0x24282e)); }
      for (const dx of [-5, 5]) for (const dz of [-3, 3]) boxAt('metal', I, 0.9, 22, 0.9, cx + dx, y, zc + dz - 1, C(0xf2b705));
      for (const dx of [-5, 5]) boxAt('metal', I, 1.2, 1.8, 36, cx + dx, y + 22, zc + 7, C(0xf2b705)); boxAt('metal', I, 11, 1.2, 1.4, cx, y + 22.3, zc - 2, C(0xf2b705)); boxAt('trim', I, 3, 2.4, 3, cx + 2, y + 19.6, zc + 6, C(0x2b3440)); boxAt('trim', I, 0.2, 12, 0.2, cx + 2, y + 7.6, zc + 6, C(0x2b3440)); boxAt('trim', I, 2.5, 2.6, 12, cx + 2, y + 5, zc + 6, C(LN[0]), Math.PI / 2);
      for (const [dx, c] of [[-17, LN[0]], [17, LN[1]]]) for (let k = 0; k < 2; k++) boxAt('trim', I, 12, 2.6, 2.5, cx + dx, y + k * 2.6, zc - 2.6, C(c));
      for (const dx of [-21, 21]) { boxAt('trim', I, 0.35, 15, 0.35, cx + dx, y, z0 + 1.2, C(0x5c6670)); boxAt('glow', I, 2.4, 0.8, 0.6, cx + dx, y + 15, z0 + 1.2, C(0xffffff)); }
      LABELS.push({ text: 'Wharf', level: 'place', x: cx, y: 14, z: zc, small: true }); }
  }
  // ---------- Capital Sports Park (the block between the Business Centre and the stadium), the stadium's fan plaza, and the
  // meadows and pond of Greenfields. Every footpath joins the pavements; nothing is placed on a road, a field or another path. ----------
  const FARMRECTS = [];
  function buildExtras(LOTS) {
    const I = new THREE.Matrix4(), Y = TOWN_Y + 0.13, CYLX = new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2);
    const obstacle = (x, z, w, d) => { const o = { x, z, w, d, rot: 0 }; for (let i = Math.floor((x - w / 2) / 20); i <= Math.floor((x + w / 2) / 20); i++) for (let j = Math.floor((z - d / 2) / 20); j <= Math.floor((z + d / 2) / 20); j++) { const k = i + ',' + j; if (!BIDX.has(k)) BIDX.set(k, []); BIDX.get(k).push(o); } };
    const mast = (x, z) => { tileAt(x, z); boxAt('trim', I, 0.35, 14, 0.35, x, Y, z, C(0x5c6670)); boxAt('glow', I, 2.6, 0.9, 0.6, x, Y + 14, z, C(0xffffff)); };
    seed = 211;
    // ---- Capital Sports Park: an athletics track round a pitch, a basketball court, a tennis court, a pavilion, tree rows ----
    { const cx = 135, cz = -237, SL = 14, R0 = 10, ring = [], pr = []; tileAt(cx, cz);
      for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + i / 24 * Math.PI; ring.push([cx + SL + Math.cos(a) * R0, Y + 0.03, cz + Math.sin(a) * R0]); }
      for (let i = 0; i <= 24; i++) { const a = Math.PI / 2 + i / 24 * Math.PI; ring.push([cx - SL + Math.cos(a) * R0, Y + 0.03, cz + Math.sin(a) * R0]); } ring.push(ring[0].slice());
      for (let i = 0; i <= 28; i++) { const a = -Math.PI / 2 + i / 28 * Math.PI; pr.push([cx + SL + Math.cos(a) * 15.5, cz + Math.sin(a) * 15.5]); }
      for (let i = 0; i <= 28; i++) { const a = Math.PI / 2 + i / 28 * Math.PI; pr.push([cx - SL + Math.cos(a) * 15.5, cz + Math.sin(a) * 15.5]); } pr.push(pr[0].slice());
      const trk = [], lines = []; ribbon(trk, ring, 3.5, 3.5, 0); for (const o of [-3.4, -2.25, -1.1, 0.05, 1.2, 2.35, 3.4]) ribbon(lines, ring, -(o - 0.06), o + 0.06, 0.02);
      triMesh(trk, off(new THREE.MeshStandardMaterial({ color: lin(0xc4573a), roughness: 0.95 }), -3)); triMesh(lines, off(new THREE.MeshStandardMaterial({ color: lin(0xf4f0e6), roughness: 0.9 }), -4));
      geoAt('pitch', new THREE.PlaneGeometry(32, 11.6).rotateX(-Math.PI / 2), I, cx, Y + 0.06, cz, WHITE);
      for (const s of [-1, 1]) { const x = cx + s * 16.2; for (const t of [-1, 1]) boxAt('trim', I, 0.14, 2.2, 0.14, x, Y, cz + t * 2.8, C(0xffffff)); boxAt('trim', I, 0.14, 0.14, 5.7, x, Y + 2.2, cz, C(0xffffff)); }
      path(pr, { w: 1.8 }); path([[cx, -206], [cx, cz + 15.5]], { w: 2, snap: 3.5 }); path([[cx, -258.5], [cx, cz - 15.5]], { w: 2, snap: 3.5 }); path([[cx - SL - 15.5, cz], [99, cz]], { w: 1.8 }); path([[cx + SL + 15.5, cz], [172, cz]], { w: 1.8 });
      poi(cx, cz + 15.5, 'park'); poi(cx, cz - 15.5, 'park'); poi(99.5, cz, 'park'); poi(171.5, cz, 'park'); obstacle(cx, cz, 59, 31);
      for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; LAMPS.push([cx + Math.cos(t) * (SL + 17.5), Y, cz + Math.sin(t) * 17]); }
      for (const [x, z] of [[cx - 30, cz - 19], [cx + 30, cz - 19], [cx - 30, cz + 19], [cx + 30, cz + 19]]) mast(x, z);
      // the stands on the south side, split by the path, facing the track
      for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) boxAt('trim', I, 13, 0.5 + k * 0.5, 1.2, cx + sx * 9, Y, -218.9 + k * 1.2, C(k ? 0x2e74c9 : 0xd8392b));
      // basketball: a blue court, white lines, two hoops, a low rail
      { const x = 92, z = cz; boxAt('lawn', I, 14, 0.14, 26, x, TOWN_Y, z, C(0x3f7fd0)); frameAt('lawn', I, 12.6, 24.6, 0.02, 0.16, x, z, C(0xffffff), TOWN_Y + 0.15); boxAt('lawn', I, 12.6, 0.02, 0.16, x, TOWN_Y + 0.15, z, C(0xffffff));
        for (const s of [-1, 1]) { boxAt('trim', I, 0.18, 3.6, 0.18, x, TOWN_Y, z + s * 12.4, C(0x5c6670)); boxAt('trim', I, 1.8, 1.2, 0.1, x, TOWN_Y + 3, z + s * 12.2, C(0xffffff)); boxAt('trim', I, 0.5, 0.1, 0.5, x, TOWN_Y + 2.9, z + s * 11.8, C(0xf2761f)); }
        frameAt('trim', I, 15.6, 27.6, 0.9, 0.08, x, z, C(0x6b7580), TOWN_Y); obstacle(x, z, 16.5, 28.5); poi(99, cz, 'park'); }
      // tennis: a green court, lines, a net
      { const x = 178, z = cz; boxAt('lawn', I, 12, 0.14, 24, x, TOWN_Y, z, C(0x3f9f57)); frameAt('lawn', I, 10.6, 22.6, 0.02, 0.14, x, z, C(0xffffff), TOWN_Y + 0.15); boxAt('lawn', I, 10.6, 0.02, 0.14, x, TOWN_Y + 0.15, z, C(0xffffff)); boxAt('trim', I, 11, 1, 0.08, x, TOWN_Y + 0.14, z, C(0xe9e4da));
        frameAt('trim', I, 13.6, 25.6, 0.9, 0.08, x, z, C(0x6b7580), TOWN_Y); obstacle(x, z, 14.5, 26.5); poi(172, cz, 'park'); }
      // the pavilion: a cafe and changing rooms, its door on the street path
      { const x = 108, z = -212; boxAt('trim', I, 11, 3.2, 5.5, x, Y, z, C(0xf1e8d6)); boxAt('roof', I, 12, 0.35, 6.5, x, Y + 3.2, z, C(0x2f8f6f)); boxAt('glassy', I, 7, 1.4, 0.08, x, Y + 0.9, z + 2.8, C(0x9fdcff)); boxAt('detail', I, 8, 0.25, 1.7, x, Y + 2.6, z + 3.4, C(0xe8483f)); sign(I, 44, 4.6, 0.8, x, Y + 3.9, z + 2.85);
        tileAt(x, z); umbrellaTable(x - 4, z + 6.5, 0x2e74c9, Y); umbrellaTable(x + 4, z + 6.5, 0xe8483f, Y); path([[x, -206], [x, z + 2.8]], { w: 1.8, snap: 3.5 }); poi(x, -207.2, 'park'); obstacle(x, z, 13, 8); }
      // tree rows along the north edge and the sides, picnic tables, benches by the track, a sign at the north entrance
      for (let x = 78; x <= 192; x += 7) if (Math.abs(x - cx) > 4) extraTrees.push([x, TOWN_Y, -255.4, 0.8 + rnd() * 0.25, rnd() < 0.2 ? 'cypress' : 'round']);
      for (let i = 0; i < 26; i++) { const x = (i % 2 ? 66 + rnd() * 9 : 193 + rnd() * 9), z = -252 + rnd() * 36; extraTrees.push([x, TOWN_Y, z, 0.8 + rnd() * 0.35, rnd() < 0.3 ? 'pine' : 'round']); }
      for (const [x, z, r] of [[cx - 17, cz + 19.5, 0], [cx + 17, cz + 19.5, 0], [cx - 17, cz - 18.5, Math.PI], [cx + 17, cz - 18.5, Math.PI], [72, -226, Math.PI / 2], [198, -226, -Math.PI / 2]]) bench(x, z, r, Y);
      for (const [x, z] of [[72, -246], [196, -247], [72, -222], [199, -219]]) { tileAt(x, z); const M = new THREE.Matrix4().setPosition(x, TOWN_Y, z); boxAt('trim', M, 2, 0.1, 0.9, 0, 0.72, 0, C(0x9a6a44)); for (const s of [-0.75, 0.75]) boxAt('trim', M, 2, 0.08, 0.3, 0, 0.42, s, C(0x9a6a44)); }
      bikes(cx + 4, -208.5, 0, 5, Y); bin(cx + 3, -213, Y); bin(cx - 3, -213, Y);
      tileAt(cx, -258); sign(I, 43, 6, 1.1, cx, Y + 3.6, -256.6); boxAt('trim', I, 0.25, 3.6, 0.25, cx - 3, Y, -256.6, C(0x5c6670)); boxAt('trim', I, 0.25, 3.6, 0.25, cx + 3, Y, -256.6, C(0x5c6670));
      LABELS.push({ text: 'Sports Park', level: 'place', x: cx, y: 12, z: cz, small: true }); WORKS.park = [cx, cz]; }
    // ---- the stadium's fan plaza between the street and the main gate: ticket booths, a fan shop, flags, planters ----
    { const cx = 130, z = -276.5; tileAt(cx, z); slab(cx, z, 52, 7, 0xe2dacb);
      for (const [x, lab, col] of [[112, 26, 0x1f3f8f], [148, 26, 0x1f3f8f], [120, 45, 0xc0392b], [140, 45, 0xc0392b]]) { boxAt('trim', I, 3.6, 2.6, 2.4, x, Y, z, C(0xffffff)); boxAt('roof', I, 4.2, 0.3, 3, x, Y + 2.6, z, C(col)); boxAt('glassy', I, 2.4, 1, 0.08, x, Y + 1, z + 1.22, C(0x9fdcff)); sign(I, lab, 3.2, 0.7, x, Y + 2.2, z + 1.24); }
      for (let i = 0; i < 5; i++) { const x = 106 + i * 12; boxAt('trim', I, 0.15, 7, 0.15, x, Y, -279, C(0xe9e4da)); boxAt('detail', I, 0.05, 1.1, 1.8, x, Y + 5.6, -279.9, C(i % 2 ? 0x1f5fbf : 0xd8392b)); }
      planter(103, -276.5, 3, 5, 'round', Y); planter(157, -276.5, 3, 5, 'round', Y); for (const x of [112, 126, 134, 148]) planter(x, -273.6, 1.6, 1.6, null, Y); LAMPS.push([124, Y, -274], [136, Y, -274], [108, Y, -274], [152, Y, -274]); bikes(98, -275, Math.PI / 2, 5, Y); WORKS.fan = [cx, z]; }
    // ---- Market Square frontage: shophouses face the square from the east and west, an alley is left for the footpaths ----
    { const okAt = (cx, cz, ww, dd) => { for (let x = -ww / 2 - 1; x <= ww / 2 + 1.01; x += 2) for (let z = -dd / 2 - 3; z <= dd / 2 + 1.01; z += 2) { const px = cx + x, pz = cz + z; if (blockedAt(px, pz, null) || wnear(px, pz, 1.0)) return false; } return true; };
      const UNITS = [[-1, -54, 4, 0xffe6a1], [-1, -43.5, 0, 0xf4c9c9], [-1, -26, 2, 0xd6ecff], [-1, -15.5, 3, 0xfff1d6], [1, -54, 1, 0xe3f2d8], [1, -43.5, 14, 0xf4d6e8], [1, -26, 31, 0xfff1d6], [1, -15.5, 2, 0xd6ecff]], done = [];
      for (const s of [-1, 1]) path([[s * 23.5, -57], [s * 23.5, -8]], { hidden: true, snap: 2.5 });
      let k = 0; for (const [s, z0, sg, col] of UNITS) { let placed = null; for (const dz of [0, 1, -1, 2, -2]) for (const dx of [0, 1, -1]) { const x = s * (30 + dx), z = z0 + dz; if (!placed && done.every(p => p[0] * s < 0 || Math.abs(p[1] - z) >= 10.4) && okAt(x, z, 10, 9)) placed = [x, z]; }
        if (placed) { done.push(placed); WORKS.frontage = (WORKS.frontage || []).concat([placed]); addBuilding({ id: 'sq' + k++, type: 'shophouse', name: SIGNS[sg][0] + SIGNS[sg].slice(1).toLowerCase() + ', Market Square', area: 'Old Quarter', x: placed[0], z: placed[1], rot: s < 0 ? Math.PI / 2 : -Math.PI / 2, w: 10, d: 9, floors: 2, sign: sg, color: col, owner: 'city' }); } }
      entrances(LOTS); }
    // ---- Greenfields meadows: wildflowers, bushes, hay bales, a pond; kept clear of fields, their tracks, paths and roads ----
    { const open = (x, z, r) => land(x, z) > 18 && nearRoad(x, z)[0] > 11 + r && !inside(x, z, r + 6) && !wnear(x, z, r + 2) && FARMRECTS.every(f => !inR(x, z, { x: f.x, z: f.z, w: f.w + 2 * r + 9, d: f.d + 2 * r + 9, rot: f.rot }));
      const bale = (x, z, ry) => { tileAt(x, z); geoAt('trim', CYLX, I, x, TOWN_Y + 0.9, z, C(0xd8c266), ry, 1.7, 0.95, 0.95); };
      let n = 0, nb = 0, p = null; for (const [x, z] of [[-352, -306], [-364, -342], [-248, -334], [-334, -246], [-186, -336], [-160, -300]]) if (!p && open(x, z, 12)) p = [x, z];
      if (p) { const [x, z] = p; tileAt(x, z); geoAt('trim', CYL, I, x, TOWN_Y + 0.03, z, C(0x8a7a5a), 0, 9.4, 0.1, 6.4); geoAt('water', CYL, I, x, TOWN_Y + 0.1, z, C(0x46c9e8), 0, 8.2, 0.06, 5.4); WORKS.pond = p;
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; extraTrees.push([x + Math.cos(a) * 10.4, TOWN_Y, z + Math.sin(a) * 7.4, 0.5 + rnd() * 0.3, i % 4 === 0 ? 'round' : 'bush']); } }
      for (let i = 0; i < 6000 && (n < 80 || nb < 14); i++) { const x = -420 + rnd() * 380, z = -450 + rnd() * 240; if (!open(x, z, 3) || heightAt(x, z) > 5) continue;
        if (n < 80 && rnd() < 0.7) { n++; const k = 5 + Math.floor(rnd() * 5); for (let j = 0; j < k; j++) extraTrees.push([x + (rnd() - 0.5) * 5, TOWN_Y, z + (rnd() - 0.5) * 5, 0.4 + rnd() * 0.3, rnd() < 0.7 ? 'flower' : 'bush']); }
        else if (nb < 14) { nb++; const ry = rnd() * 3; for (let j = 0; j < 3; j++) bale(x + Math.cos(ry) * j * 2.2, z - Math.sin(ry) * j * 2.2 + (j % 2) * 0.6, ry); extraTrees.push([x + 3, TOWN_Y, z + 3, 0.5, 'bush']); } } }
  }
  // ---------- the districts: villa plots, working farms, the beach and Hotel Azure, the stadium, the harbour, Industrial Isle ----------
  const FARM = { crop: null, crates: null, inb: null, outb: null, smoke: null, field: null }, EVENT = { crowd: null, on: null };
  const edgeOf = (a, b) => edges.find(e => (e.a.id === a && e.b.id === b) || (e.a.id === b && e.b.id === a));
  const along = (e, s) => { const p = armAt(e.a, e, s), q = armAt(e.a, e, Math.min(e.len, s + 1)), L = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1; return { p, ux: (q[0] - p[0]) / L, uz: (q[2] - p[2]) / L }; };
  function toRoadEdge(x, z, fx, fz, max = 16) { for (let s = 0; s < max; s += 0.3) if (nearRoad(x + fx * s, z + fz * s)[0] < 0.05) return s; return -1; }
  function crop(M, W, D, kind, stage) { // a field's soil and its crop at a growth stage
    const rows = (gap, f) => { for (let z = -D / 2 + 1.4; z < D / 2 - 1; z += gap) f(z); };
    boxAt('lawn', M, W, 0.1, D, 0, 0, 0, C(kind === 'pasture' ? 0x72c052 : kind === 'orchard' ? 0x67b44c : stage === 'stubble' ? 0xcdb77a : 0x7a5b3d));
    if (kind === 'pasture') { for (let i = 0; i < 6; i++) { const x = (rnd() - 0.5) * (W - 8), z = (rnd() - 0.5) * (D - 8), a = rnd() * 6, c = C(rnd() < 0.6 ? 0xf7f5f0 : 0x8a5a3c); boxAt('trim', M, 2.4, 1.1, 1.1, x, 0.7, z, c, a); boxAt('trim', M, 0.9, 0.7, 0.9, x + Math.sin(a) * 1.5, 1.1, z + Math.cos(a) * 1.5, c, a); for (const s of [-0.8, 0.8]) boxAt('trim', M, 0.25, 0.7, 0.9, x + Math.sin(a) * s, 0, z + Math.cos(a) * s, C(0x3b3b3b), a); } boxAt('trim', M, 3, 0.6, 1, W / 2 - 4, 0, D / 2 - 4, C(0x9aa3ab)); return; }
    if (kind === 'orchard') { for (let x = -W / 2 + 4; x < W / 2 - 2; x += 6) for (let z = -D / 2 + 4; z < D / 2 - 2; z += 6) { const p = new THREE.Vector3(x, 0, z).applyMatrix4(M); extraTrees.push([p.x, TOWN_Y, p.z, 0.5, 'round']); } return; }
    if (stage === 'bare') { rows(1.6, z => boxAt('lawn', M, W - 1.4, 0.18, 0.6, 0, 0, z, C(0x63462f))); return; }
    if (stage === 'sown') { rows(1.6, z => boxAt('lawn', M, W - 1.4, 0.2, 0.45, 0, 0, z, C(0x78a84a))); return; }
    if (stage === 'stubble') { rows(1.2, z => boxAt('lawn', M, W - 1.4, 0.18, 0.35, 0, 0, z, C(0xe6d39a))); for (let i = 0; i < 3; i++) geoAt('trim', CYL, M, -W / 4 + i * W / 4, 0.85, D * (rnd() - 0.5) * 0.6, C(0xe0c46a), 0, 0.85, 1.5, 0.85); return; } // straw bales after the harvest
    const ripe = stage === 'ripe', H = { wheat: 0.75, corn: 1.9, veg: 0.45, sun: 1.6 }[kind] * (ripe ? 1 : 0.55);
    if (kind === 'wheat') { boxAt('trim', M, W - 1.4, H, D - 1.4, 0, 0.1, 0, C(ripe ? 0xe0bf55 : 0x8cc152)); rows(2.4, z => boxAt('lawn', M, W - 1.4, 0.04, 0.22, 0, 0.12 + H, z, C(ripe ? 0xc9a43e : 0x79ab45))); }
    else if (kind === 'corn') rows(2.2, z => { boxAt('trim', M, W - 2, H, 1.1, 0, 0.1, z, C(0x5f9e3a)); if (ripe) boxAt('trim', M, W - 2, 0.25, 0.7, 0, H + 0.1, z, C(0xd9c25a)); });
    else if (kind === 'sun') rows(2.2, z => { boxAt('trim', M, W - 2, H, 0.7, 0, 0.1, z, C(0x5f9e3f)); boxAt('trim', M, W - 2, 0.4, 1.1, 0, H + 0.1, z, C(ripe ? 0xffc21f : 0x9ac94a)); });
    else if (kind === 'cane') { const hc = ripe ? 2.6 : 1.5, c0 = [0x8fc255, 0x9ccb5c, 0xaed063, 0x7ab44c][Math.floor(hash(M.elements[12] * 0.13, M.elements[14] * 0.17) * 4) % 4]; boxAt('trim', M, W - 1.6, hc, D - 1.6, 0, 0.1, 0, C(c0)); for (let z = -D / 2 + 3; z < D / 2 - 2; z += 5.5) boxAt('lawn', M, W - 1.6, 0.04, 0.5, 0, hc + 0.11, z, C(0x6c9f3d)); if (ripe) boxAt('trim', M, W - 2.4, 0.3, D - 2.4, 0, hc + 0.1, 0, C(0xd2e394)); } // sugar cane: a tall block of stalks in rows, pale tassels when it is ripe
    else { let i = 0; rows(1.8, z => boxAt('trim', M, W - 2, H, 0.9, 0, 0.1, z, C([0x4caf3f, 0x3f8f3f, 0x7fc24a, 0x2f7f4f][i++ % 4]))); }
  }
  function hedgerow(M, W, D, gate) { // round a field, 0.6 m outside it; a gap with an open field gate on the near side
    const t = 0.9, h = 1.15, g = C(0x3d7a34), o = 0.6;
    boxAt('trim', M, W + 2 * o + t, h, t, 0, 0, D / 2 + o, g); for (const s of [-1, 1]) boxAt('trim', M, t, h, D + 2 * o, s * (W / 2 + o), 0, 0, g);
    const gw = 5, seg = (W + 2 * o + t - gw) / 2; for (const s of [-1, 1]) boxAt('trim', M, seg, h, t, s * (gw / 2 + seg / 2), 0, -D / 2 - o, g);
    if (gate) { boxAt('trim', M, 0.2, 1.3, 0.2, -gw / 2, 0, -D / 2 - o, C(0x8a6a4a)); boxAt('trim', M, 0.12, 1.1, 2.6, -gw / 2 - 0.2, 0.15, -D / 2 - o - 1.3, C(0xf4efe6)); }
  }
  function tractor(M, x, z, ry, c = 0xd8392b) { const T = mul(M, x, 0, z, ry); boxAt('trim', T, 1.6, 1.1, 3, 0, 0.6, 0, C(c)); boxAt('trim', T, 1.4, 1.2, 1.3, 0, 1.7, -0.6, C(0x2b3440)); for (const s of [-1, 1]) { geoAt('trim', CYL, T, s * 0.95, 0.75, -0.9, C(0x24282e), 0, 0.75, 0.45, 0.75); geoAt('trim', CYL, T, s * 0.85, 0.45, 1.1, C(0x24282e), 0, 0.45, 0.35, 0.45); } }
  function shelter(M, x, z, ry, w = 12, d = 7) { const T = mul(M, x, 0, z, ry); for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt('trim', T, 0.3, 4, 0.3, sx * (w / 2 - 0.3), 0, sz * (d / 2 - 0.3), C(0x6b4a33)); boxAt('roof', T, w + 0.6, 0.25, d + 0.6, 0, 4, 0, C(0x5c6670)); boxAt('trim', T, w, 3.6, 0.2, 0, 0, -d / 2 + 0.1, C(0x8a6a4a)); }
  function buildDistricts(LOTS) {
    const M0 = new THREE.Matrix4();
    // a footpath beside the road from the town to Villa Point, so the villa lanes' footpaths join the town's pavements
    { const e = edgeOf('A', 'V1'), P = offAlong(e.pts, -(e.w / 2 + 2.4)).map(p => [p[0], p[2]]); path(P, { w: 1.6 }); }
    // ---- Villa Point: each plot gets its drive and gates (the house itself draws walls, carport, terrace and pool) ----
    for (const b of buildings) if ((b.type === 'villa' || b.type === 'house') && b.gate) { tileAt(b.x, b.z); const g = new THREE.Vector3(b.gate[0], 0, b.gate[1]).applyMatrix4(new THREE.Matrix4().makeRotationY(b.rot).setPosition(b.x, b.y, b.z)), f = [Math.sin(b.rot), Math.cos(b.rot)], s = toRoadEdge(g.x, g.z, f[0], f[1]);
      if (s > 0) { const Mr = new THREE.Matrix4().makeRotationY(b.rot).setPosition(g.x + f[0] * s / 2, b.y, g.z + f[1] * s / 2); boxAt('lawn', Mr, b.drive || 3.4, 0.22, s + 0.4, 0, 0, 0, C(0xcfc6b4)); } }
    { const e = edgeOf('V3', 'V4'), a = along(e, e.len * 0.5), n = [-a.uz, a.ux], x = a.p[0] - n[0] * 30, z = a.p[2] - n[1] * 30; if (land(x, z) > 6) { const y = heightAt(x, z), M = new THREE.Matrix4().setPosition(x, y, z); tileAt(x, z); boxAt('trim', M, 9, 0.5, 7, 0, 0, 0, C(0xc9a77a)); frameAt('trim', M, 9, 7, 1.1, 0.12, 0, 0, C(0xf4efe6), 0.5); bench(x - 2, z, Math.PI, y + 0.5); geoAt('trim', CYL8, M, 2.5, 1.2, 1.5, C(0x2b3440), 0, 0.08, 1.4, 0.08); boxAt('trim', M, 0.9, 0.35, 0.35, 2.5, 1.85, 1.5, C(0x2b3440)); sign(M, 37, 3, 0.6, 0, 1.6, 3.55); path([[a.p[0] - n[0] * 6, a.p[2] - n[1] * 6], [x, z]], { w: 1.4 }); LABELS.push({ text: 'Lookout', level: 'place', x, y: y + 6, z, small: true }); } }
    // ---- Greenfields: holdings of fields along the farm roads, hedgerows with gates, headland tracks to the back fields,
    // farmyards with shelters and tractors, the co-op's loading yard, and your own field behind the co-op ----
    seed = 41; const FW = FARMRECTS, pts9 = (x, z, W, D, ry) => { const c = Math.cos(ry), s = Math.sin(ry), out = []; for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) { const lx = a * W / 2, lz = b * D / 2; out.push([x + lx * c + lz * s, z - lx * s + lz * c]); } return out; };
    const claim = (x, z, W, D, ry, test) => { const P = pts9(x, z, W + 3, D + 3, ry), me = { x, z, w: W + 3, d: D + 3, rot: ry };
      if (test && (P.some(([px, pz]) => land(px, pz) < 14 || nearRoad(px, pz)[0] < 3.5 || inside(px, pz, 5) || px > -40 || pz > -205 || pz < -445) || FW.some(r => P.some(([px, pz]) => inR(px, pz, r)) || r.P.some(([px, pz]) => inR(px, pz, me))))) return false; me.P = P; FW.push(me); return true; };
    const grav = (x, z, w, d, ry) => { tileAt(x, z); boxAt('lawn', new THREE.Matrix4().makeRotationY(ry).setPosition(x, TOWN_Y, z), w, 0.14, d, 0, 0, 0, C(0xc4ad84)); };
    // the co-op's yard (crates wait here for the truck), a loading dock, the track to your field, your field
    grav(-300, -288.5, 46, 10, 0); { const M = new THREE.Matrix4().setPosition(-300, TOWN_Y, -293.6); boxAt('trim', M, 30, 1, 2, 0, 0, 0, C(0xb7b3aa)); for (let i = 0; i < 4; i++) boxAt('lawn', M, 0.2, 0.18, 6, -288 + 300 + i * 3.4 - 12, 0, 5, C(0xf2c12e)); }
    claim(-300, -289, 46, 10, 0); claim(-300, -303, 34, 20, 0);
    grav(-279, -305, 3.6, 28, 0); grav(-291, -317.2, 27, 3.6, 0);
    const YF = { x: -300, z: -334, W: 34, D: 24, ry: Math.PI }; claim(YF.x, YF.z, YF.W, YF.D, YF.ry); { const M = new THREE.Matrix4().makeRotationY(YF.ry).setPosition(YF.x, TOWN_Y, YF.z); tileAt(YF.x, YF.z); boxAt('lawn', M, YF.W, 0.1, YF.D, 0, 0, 0, C(0x7a5b3d)); hedgerow(M, YF.W, YF.D, true); sign(M, 39, 4, 0.8, -5, 1.6, -YF.D / 2 - 1.2, Math.PI); FARM.field = YF; }
    LABELS.push({ text: 'Your field', level: 'place', x: YF.x, y: 8, z: YF.z, small: true, mine: true });
    // farmyards at the two barns, where the farm roads end
    for (const [x, z, w, d, sx, sz, sr] of [[-398, -276, 34, 40, -386, -292, Math.PI / 2], [-226, -392, 40, 26, -222, -404, 0]]) { grav(x, z, w, d, 0); claim(x, z, w, d, 0); shelter(M0, sx, sz, sr); tractor(M0, sx + (sr ? 0 : -3), sz + (sr ? 2 : 0), sr + 0.3, sx < -300 ? 0xd8392b : 0x2f8f3a); }
    for (const [a, b, kinds] of [['FA', 'FB', ['wheat', 'pasture', 'corn', 'wheat', 'pasture']], ['FA', 'FC', ['veg', 'sun', 'orchard', 'veg', 'corn']], ['I2', 'FA', ['corn', 'wheat', 'sun', 'veg']]]) {
      const e = edgeOf(a, b), hw = e.w / 2; let k = 0;
      for (const sd of [1, -1]) for (let s = 12; s < e.len - 30; ) { // up to three rows of fields deep: the front row gated onto the road, the others onto headland tracks
        const L = 32 + rnd() * 10, m = along(e, s + L / 2), n = [-m.uz * sd, m.ux * sd], ry = Math.atan2(n[0], n[1]); let depth = hw + 5.5;
        for (let row = 0; row < 4; row++) { const Dd = 24 + rnd() * 9, cc = [m.p[0] + n[0] * (depth + Dd / 2), m.p[2] + n[1] * (depth + Dd / 2)];
          if (!claim(cc[0], cc[1], L, Dd, ry, true)) break; const kind = kinds[k++ % kinds.length], st = ['ripe', 'grow', 'ripe', 'stubble', 'sown', 'grow', 'bare'][Math.floor(rnd() * 7)], M = new THREE.Matrix4().makeRotationY(ry).setPosition(cc[0], TOWN_Y, cc[1]); tileAt(cc[0], cc[1]); crop(M, L, Dd, kind, st); hedgerow(M, L, Dd, true);
          if (row === 0) grav(m.p[0] + n[0] * (hw + 2.9), m.p[2] + n[1] * (hw + 2.9), 4.4, 5.2, ry); // the entrance from the road through the gate
          else { const hd = depth - 3.5, g = along(e, s + L + 3.5); grav(m.p[0] + n[0] * hd, m.p[2] + n[1] * hd, L + 7, 3.6, ry); grav(g.p[0] + n[0] * (hw + (hd - hw) / 2 + 1), g.p[2] + n[1] * (hw + (hd - hw) / 2 + 1), 3.6, hd - hw + 2, ry); } // the headland track in front of this row, and its way out to the road between the fields
          if (rnd() < 0.3) tractor(M, (rnd() - 0.5) * L * 0.6, (rnd() - 0.5) * Dd * 0.5, rnd() * 6, rnd() < 0.5 ? 0xd8392b : 0x2f8f3a);
          for (let t = -L / 2 + 6; t < L / 2 - 4; t += 13) { const p = new THREE.Vector3(t, 0, Dd / 2 + 0.6).applyMatrix4(M); extraTrees.push([p.x, TOWN_Y, p.z, 0.7 + rnd() * 0.25, 'round']); } // hedgerow trees along the back
          depth += Dd + 7; }
        s += L + 7; }
    }
    // the crop on your field, the crates in the co-op yard and at the plant: they follow your stock (World.farm)
    const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), cm = (n, c, r = 0.85) => { const m = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ color: lin(c), roughness: r }), n); m.count = 0; m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
    FARM.crop = cm(9 * 15, 0xffffff, 0.9); { const c0 = new THREE.Color(1, 1, 1); for (let i = 0; i < 135; i++) FARM.crop.setColorAt(i, c0); } FARM.crates = cm(48, 0xa8784e); FARM.inb = cm(40, 0xa8784e); FARM.outb = cm(40, 0xd9b27c); // the crop's instance colours exist before its first draw, or they never show
    FARM.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: lin(0xe9eef2), roughness: 1, transparent: true, opacity: 0.8, depthWrite: false }), 14); FARM.smoke.count = 0; scene.add(FARM.smoke);
    // ---- the beach: the promenade is a walk joined to the town at several points; boardwalks onto the sand; sun shelters ----
    const OBST = [[-168, 122, 27, 10], [-128, 123, 10, 7], [-20, 98, 16, 27], [25, 95, 19, 13]]; for (const [x, z, w, d] of OBST) { const o = { x, z, w, d, rot: 0 }; for (let i = Math.floor((x - w) / 20); i <= Math.floor((x + w) / 20); i++) for (let j = Math.floor((z - d) / 20); j <= Math.floor((z + d) / 20); j++) { const k = i + ',' + j; if (!BIDX.has(k)) BIDX.set(k, []); BIDX.get(k).push(o); } } // pools, the court, the café terrace: paths go round
    path([[-218, 142], [64, 142]], { hidden: true });
    for (const x of [-205, -100, -40, 48]) { const r = toNet(x, 139, null, 60, 'pave'); if (r && r.length > 1) path(r, { w: 2.2 }); }
    path([[-104, 88], [-104, 70]], { w: 2.4 }); { const r = toNet(-104, 70, null, 30, 'pave'); if (r && r.length > 1) path(r, { w: 2.2 }); } // the hotel's guest entrance to the street
    path([[-150, 134.5], [-150, 139]], { w: 2 }); poi(-150, 140, 'beach'); poi(-40, 142, 'beach'); poi(30, 143, 'beach'); poi(-104, 80, 'hotel');
    for (const x of [-182, -122, -56, 4, 50]) { const z0 = 145.6, M = new THREE.Matrix4().setPosition(x, 0, 0); tileAt(x, 152); for (let z = z0; z < z0 + 13; z += 1.3) { const y = Math.max(heightAt(x, z), 0.2) + 0.12; boxAt('trim', M, 2.4, 0.12, 1.2, 0, y, z, C(0xc9a77a)); } }
    for (const x of [-196, -136, -70, -8, 58]) { const M = new THREE.Matrix4().setPosition(x, TOWN_Y + 0.16, 145); tileAt(x, 145); for (const sx of [-2, 2]) boxAt('trim', M, 0.18, 2.6, 0.18, sx, 0, 0, C(0xe9e4da)); for (let i = 0; i < 6; i++) boxAt('detail', M, 4.6, 0.12, 0.35, 0, 2.6, -1 + i * 0.4, C(0xd6b48a)); bench(x, 145.6, Math.PI, TOWN_Y + 0.16); }
    // Hotel Azure: a guest forecourt with planters and flags at the drop-off, the service door for deliveries beside it
    { const M = new THREE.Matrix4().setPosition(-100, TOWN_Y, 92); tileAt(-100, 92); for (const [x, z] of [[-6, -7], [6, -7]]) { geoAt('trim', CYL8, M, x, 4, z, C(0xffffff), 0, 0.07, 8, 0.07); boxAt('glow', M, 1.6, 1, 0.05, x + 0.85, 7, z, C(0x0f6fb8)); } planter(-110, 82, 3, 1.6, null); planter(-90, 82, 3, 1.6, null);
      const Md = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(-112.9, TOWN_Y, 99); boxAt('trim', Md, 3.4, 3.2, 0.2, 0, 0, 0, C(0x9aa6b0)); sign(Md, 34, 4, 0.7, 0, 3.7, 0.12); for (let i = 0; i < 3; i++) boxAt('trim', M, 1, 0.8, 1, -10 + i * 1.1, 0, 12.5, C(0xa8784e)); }
    // ---- the stadium: a paved apron round the bowl, paths from both car parks to the gates, snack kiosks, lamps; match-day crowd ----
    { const S = 0.82, M = new THREE.Matrix4().setPosition(130, TOWN_Y + 0.14, -335); tileAt(130, -335); geoAt('plaza', new THREE.RingGeometry(57, 67, 48).rotateX(-Math.PI / 2), M, 0, 0, 0, C(0xe2dacb), 0, 1, 1, S);
      for (const P of [[[31, -340], [62, -337]], [[236, -297], [206, -318], [186, -330]], [[130, -272], [130, -286]], [[40, -330], [40, -318]]]) path(P, { w: 2.6 });
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2, x = 130 + Math.cos(a) * 62, z = -335 + Math.sin(a) * 62 * S; addBuilding({ id: 'snack' + i, type: 'kiosk', name: 'Stadium snacks', area: 'Stadium', x, z, rot: Math.atan2(Math.cos(a), Math.sin(a) * S), w: 4.5, d: 3.4, sign: 35, awn: 0xd8392b, owner: 'city', noPath: true }); LAMPS.push([130 + Math.cos(a + 0.35) * 65, TOWN_Y + 0.14, -335 + Math.sin(a + 0.35) * 65 * S]); }
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, Mb = mul(M, Math.cos(a) * 56.7, 0, Math.sin(a) * 56.7 * S, Math.atan2(Math.cos(a), Math.sin(a) * S)); boxAt('detail', Mb, 1.6, 5, 0.12, 0, 8.5, 0, C(i % 2 ? 0x1f5fbf : 0xd8392b)); }
      poi(62, -337, 'stadium'); poi(186, -330, 'stadium'); poi(130, -286, 'stadium');
      const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.9, 0.5).translate(0, 0.45, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 900), c = new THREE.Color(); let n = 0;
      for (let i = 0; i < 900; i++) { const up = rnd() < 0.4, k = Math.floor(rnd() * (up ? 6 : 9)), r = up ? 46 + (k + 0.5) * 1.6 : 34 + (k + 0.5) * 1.3, y = up ? 9 + (k + 1) * 1.0 : 0.5 + (k + 1) * 0.8, a = rnd() * Math.PI * 2;
        tmp.position.set(130 + Math.cos(a) * r, TOWN_Y + y, -335 + Math.sin(a) * r * S); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); crowd.setMatrixAt(n, tmp.matrix); crowd.setColorAt(n++, c.set(pick([0x1f5fbf, 0x1f5fbf, 0xd8392b, 0xffffff, 0xf2b705])).convertSRGBToLinear()); }
      crowd.visible = false; scene.add(crowd); EVENT.crowd = crowd; }
    // ---- the harbour: a gatehouse and barrier on the quay road, a fence between the working quay and the town, marked
    // loading bays by the quay, and a concrete apron in front of each store shed ----
    { const M = new THREE.Matrix4().setPosition(203, TOWN_Y, 3.2); tileAt(203, 3); boxAt('trim', M, 3, 2.8, 2.6, 0, 0, 0, C(0xffffff)); boxAt('roof', M, 3.6, 0.3, 3.2, 0, 2.8, 0, C(0x1f3f8f)); boxAt('glassy', M, 3.05, 1, 2.65, 0, 1.3, 0, C(0x9fdcff)); sign(M, 36, 3.2, 0.6, 0, 2.3, 1.32); boxAt('trim', M, 0.25, 1.1, 0.25, 0, 0, 2, C(0x2b3440)); boxAt('trim', M, 0.12, 0.12, 4, 0, 1.0, 4, C(0xd8392b)); }
    for (const [z0, z1] of [[-44, 3], [21, 124]]) for (let z = z0; z < z1; z += 3) { const M = new THREE.Matrix4().setPosition(197.5, TOWN_Y, z + 1.5); tileAt(197.5, z); boxAt('trim', M, 0.1, 1.9, 0.1, 0, 0, -1.5, C(0x8a939c)); boxAt('detail', M, 0.05, 1.7, 3, 0, 0.1, 0, C(0xb9c1c8)); }
    for (let i = 0; i < 4; i++) { const M = new THREE.Matrix4().setPosition(222, TOWN_Y + 0.17, 26 + i * 6); for (const s of [-1, 1]) boxAt('lawn', M, 12, 0.02, 0.2, 0, 0, s * 2.6, C(0xf2c12e)); boxAt('lawn', M, 0.2, 0.02, 5.4, 6, 0, 0, C(0xf2c12e)); }
    tick.push((dt, t) => { const m = FARM.smoke; if (!m) return; m.count = FARM.proc ? 14 : 0; if (!FARM.proc) return; for (let i = 0; i < 14; i++) { const k = (t * 0.25 + i / 14) % 1, [x, y, z] = SMOKE[i % 2]; tmp.position.set(x + k * 6, y + k * 16, z + k * 3); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(1.4 + k * 3.2); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); } m.instanceMatrix.needsUpdate = true; m.material.opacity = 0.55; }); // the plant's chimneys smoke while it is processing your crates
    for (const b of buildings) if (b.yard) { const f = [Math.sin(b.rot), Math.cos(b.rot)], x0 = b.x + f[0] * b.d / 2, z0 = b.z + f[1] * b.d / 2, s = toRoadEdge(x0, z0, f[0], f[1], 14); if (s > 0.5) { tileAt(x0, z0); boxAt('lawn', new THREE.Matrix4().makeRotationY(b.rot).setPosition(x0 + f[0] * s / 2, TOWN_Y, z0 + f[1] * s / 2), b.w, 0.16, s + 0.3, 0, 0, 0, C(0xb7b3aa)); } }
    ACCESS.none.length = 0; entrances(LOTS); // a second pass, now the promenade and the other district paths exist
    // ---- Industrial Isle: the plant's loading yard faces the loop road at P: crates in at one door, food out at the other ----
    { const M = new THREE.Matrix4().setPosition(546, 9, -156); tileAt(546, -156); boxAt('lawn', M, 38, 0.18, 22, 0, 0, 0, C(0xb7b3aa)); for (const [x, s] of [[-8, 32], [8, 33]]) { boxAt('trim', M, 6, 5.2, 0.3, x, 0, -10.9, C(0x8c96a0)); sign(M, s, 6, 1, x, 6, -10.7); for (let i = 0; i < 3; i++) boxAt('lawn', M, 0.2, 0.02, 7, x - 3 + i * 3, 0.2, -6, C(0xf2c12e)); } }
  }
  const SMOKE = [[551.5, 53.5, -173.8], [551.5, 50, -169.7]];
  function farmState(o) { // what your farm, the co-op yard and the plant show: crop growth, crates waiting, the plant working
    if (!FARM.crop) return; const F = FARM.field, M = new THREE.Matrix4().makeRotationY(F.ry).setPosition(F.x, TOWN_Y, F.z), c = new THREE.Color(), q = new THREE.Vector3();
    const st = o.grow >= 0 ? 'grow' : o.harvested ? 'stubble' : 'bare', g = clamp(o.grow, 0, 1); let n = 0;
    if (st !== 'bare') for (let i = 0; i < 9; i++) for (let j = 0; j < 15; j++) { q.set(-F.W / 2 + 2 + j * (F.W - 4) / 14, 0, -F.D / 2 + 2 + i * (F.D - 4) / 8).applyMatrix4(M); const h = st === 'grow' ? 0.15 + g * 1.05 : 0.18, w = st === 'grow' ? 0.5 + g * 0.6 : 0.9;
      tmp.position.set(q.x, TOWN_Y + 0.1, q.z); tmp.rotation.set(0, F.ry, 0); tmp.scale.set(w * 1.6, h, w); tmp.updateMatrix(); FARM.crop.setMatrixAt(n, tmp.matrix); FARM.crop.setColorAt(n++, c.set(st === 'stubble' ? 0xe6d39a : g > 0.85 ? 0xe0bf55 : g > 0.6 ? 0xb5c84a : 0x6fae45).convertSRGBToLinear()); }
    FARM.crop.count = n; FARM.crop.instanceMatrix.needsUpdate = true; if (FARM.crop.instanceColor) FARM.crop.instanceColor.needsUpdate = true;
    const stack = (m, qty, x0, z0, cols, per) => { const k = Math.min(m.instanceMatrix.count, Math.ceil(qty / per)); for (let i = 0; i < k; i++) { const lx = i % cols, ly = Math.floor(i / cols) % 2, lz = Math.floor(i / (cols * 2)); tmp.position.set(x0 + lx * 1.35, (m === FARM.inb || m === FARM.outb ? 9.2 : TOWN_Y + 0.15) + ly * 0.95, z0 - lz * 1.35); tmp.rotation.set(0, 0, 0); tmp.scale.set(1.2, 0.9, 1.2); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); } m.count = k; m.instanceMatrix.needsUpdate = true; };
    stack(FARM.crates, o.farm, -321, -287, 6, 5); stack(FARM.inb, o.plantIn, 531, -150, 5, 5); stack(FARM.outb, o.plantOut, 553, -150, 5, 5);
    FARM.proc = !!o.proc;
  }
  const PARKED = []; // parked vehicles: [type, x, z, heading]
  const extraTrees = []; let TREES = null;
  const KIT = () => ({ THREE, G, EXPANDED, lin, C, rnd, pick, setSeed: n => { seed = n; }, clamp, smooth, mix, hash, fbm, TOWN_Y, heightAt, land, K, nearRoad, nodes, edges, route, scene, tick, tmp, camera: () => camera,
    part, tileAt, addGeo, geoAt, boxAt, frameAt, walls, roofGeo, hip, gable, sign, mul, rotY, BOX, CYL, CYL8, SPH, PLANE_X, buildings, DRAW, addBuilding, DOOR, LAMPS, extraTrees, PARKED, LABELS, WORKS, FARMRECTS, SIGNS, SIGNC, EXTRA_KINDS, NOSHADOW,
    path, toNet, poi, entrances, wnear, blockedAt, inR, inside, clearOf, obstacleIndex, bench, bin, bikes, planter, umbrellaTable, stall, slab, canvasTex, tex, ribbon, triMesh, off, disc, quad, fadeMats, barBox, posAt, crop, hedgerow, tractor, shelter, hay: null });
  function buildTown() {
    let id = 1;
    const B = (o) => addBuilding(Object.assign({}, o, { id: o.id || 'b' + id++ }));
    // Beachfront: Hotel Azure, its pool deck, the drop-off loop, the promenade, the beach
    const hotel = B({ id: 'hotel', type: 'hotel', name: 'Hotel Azure', area: 'Beachfront', x: -165, z: 91, rot: 0, w: 56, d: 18, floors: 7, top: true, owner: 'city', noPath: true });
    B({ id: 'hotel2', type: 'hotel', name: 'Hotel Azure · Garden wing', area: 'Beachfront', x: -124, z: 96, rot: 0, w: 22, d: 16, floors: 4, owner: 'city', noPath: true });
    const M0 = new THREE.Matrix4().setPosition(0, TOWN_Y, 0);
    boxAt('lawn', M0, 104, 0.18, 26, -150, 0, 121, C(0xece3cf)); // pool deck
    for (const [x, z, w, d] of [[-168, 122, 26, 9], [-128, 123, 9, 6]]) { frameAt('trim', M0, w + 1.2, d + 1.2, 0.5, 0.6, x, z, C(0xffffff)); boxAt('water', M0, w, 0.4, d, x, 0, z, C(0x35c6ea)); }
    for (let i = 0; i < 12; i++) { const x = -185 + i * 6, z = i % 2 ? 130 : 113; boxAt('trim', M0, 0.9, 0.35, 2, x, 0.2, z, C(0xffffff)); if (i % 3 === 0) { geoAt('trim', CYL8, M0, x + 1.6, 1.5, z, C(0xffffff), 0, 0.06, 2.6, 0.06); geoAt('detail', new THREE.ConeGeometry(1.7, 0.7, 8), M0, x + 1.6, 2.9, z, C(pick([0x0f6fb8, 0xffffff]))); } }
    boxAt('detail', M0, 6, 0.3, 6, -104, 4, 92, C(0x0f6fb8)); for (const [x, z] of [[-101.5, 89.5], [-101.5, 94.5]]) boxAt('trim', M0, 0.3, 4, 0.3, x, 0, z, C(0xffffff)); // entrance canopy at the drop-off
    boxAt('lawn', M0, 290, 0.16, 7, -78, 0, 142, C(0xe7dccb)); // the promenade
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
    B({ type: 'kiosk', name: 'Square café', area: 'Old Quarter', x: 15.5, z: -52, rot: 0, w: 4.5, d: 3.6, awn: 0x2e74c9, sign: 1, noPath: true });
    { const M = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(-2, TOWN_Y, 63.5); boxAt('trim', M, 5, 0.15, 1.8, 0, 2.6, 0, C(0x2e74c9)); for (const x of [-2.3, 2.3]) boxAt('trim', M, 0.12, 2.6, 0.12, x, 0, 0.7, C(0xd9dde0)); boxAt('glassy', M, 4.6, 2.1, 0.05, 0, 0.4, -0.8, C(0xcfeeff)); sign(M, 11, 1.5, 0.6, 2.8, 3.1, 0.1); }
    LABELS.push({ text: 'Bus stop', level: 'place', x: -2, y: 8, z: 64, small: true });
    // a second row of small flats facing the square, with gardens between
    for (const [x, c] of [[-31, 0xffe6a1], [31, 0xfff1d6]]) B({ type: 'flat', name: `${x < 0 ? 3 : 5} Square Row`, area: 'Old Quarter', x, z: -70, rot: x < 0 ? Math.PI / 2 : -Math.PI / 2, w: 14, d: 12, floors: 3, color: c, sale: true });
    for (let i = 0; i < 26; i++) { const x = (rnd() < 0.5 ? -1 : 1) * (24 + rnd() * 14), z = -86 + rnd() * 112; if (!inside(x, z, 2) && Math.abs(z + 32) > 26) extraTrees.push([x, TOWN_Y, z, 0.6 + rnd() * 0.3, rnd() < 0.3 ? 'bush' : 'round']); }
    // the beach park in front of the shops: a basketball court, a café terrace, lawns and palms
    { const M = new THREE.Matrix4().setPosition(-20, TOWN_Y, 98); boxAt('lawn', M, 15, 0.12, 26, 0, 0, 0, C(0x2e74c9)); boxAt('lawn', M, 13, 0.16, 24, 0, 0, 0, C(0xd9643a)); for (const z of [-11, 11]) { boxAt('trim', M, 0.2, 3, 0.2, 0, 0, z, C(0xffffff)); boxAt('trim', M, 1.2, 0.9, 0.1, 0, 2.8, z - Math.sign(z) * 0.2, C(0xffffff)); } }
    { const M = new THREE.Matrix4().setPosition(25, TOWN_Y, 95); boxAt('lawn', M, 18, 0.14, 12, 0, 0, 0, C(0xe9dfca)); for (let i = 0; i < 6; i++) { const x = -6 + (i % 3) * 6, z = -2.5 + Math.floor(i / 3) * 5; geoAt('trim', CYL8, M, x, 0.6, z, C(0xffffff), 0, 0.6, 0.06, 0.6); geoAt('trim', CYL8, M, x, 1.6, z, C(0xffffff), 0, 0.05, 2.6, 0.05); geoAt('detail', new THREE.ConeGeometry(1.6, 0.6, 8), M, x, 2.9, z, C(pick([0xe8483f, 0xffffff]))); } }
    // harbour-side lawns: a car park, a boatyard with boats on stands, the sailing club
    { const M = new THREE.Matrix4().setPosition(92, TOWN_Y, 100); boxAt('lawn', M, 40, 0.12, 22, 0, 0, 0, C(0x5c616b)); for (let i = 0; i <= 8; i++) for (const z of [-6.5, 6.5]) boxAt('lawn', M, 0.18, 0.16, 5, -20 + 2 + i * 4.5, 0, z, C(0xf4f4f0)); PARKED.push(...[[-15.7, -6.5], [-6.7, -6.5], [2.3, 6.5], [11.3, 6.5], [-11.2, 6.5], [15.8, -6.5]].map(([x, z], i) => [i % 3 ? 'sedan' : 'compact', 92 + x, 100 + z, z < 0 ? 0 : Math.PI])); }
    for (let i = 0; i < 4; i++) { const M = new THREE.Matrix4().makeRotationY(0.3).setPosition(136 + i * 11, TOWN_Y, 118 - i * 3); boxAt('trim', M, 2.6, 1.6, 8, 0, 1.2, 0, C(pick([0xffffff, 0x2e74c9, 0xe8483f]))); boxAt('trim', M, 2.2, 0.8, 3, 0, 2.8, -0.6, C(0xffffff)); for (const z of [-2.5, 2.5]) boxAt('trim', M, 2, 1.2, 0.3, 0, 0, z, C(0x6b4a33)); }
    B({ id: 'club', type: 'shophouse', name: 'Sailing club', area: 'Harbour', x: 208, z: 150, rot: Math.PI * 1.05, w: 16, d: 10, floors: 2, sign: 8, color: 0xffffff, roof: 0x2e6fbf, awn: 0x2e74c9, y: heightAt(208, 150), owner: 'city' });
    // fill every free plot with small houses (or sheds by the harbour), each facing its nearest road; keep squares, parks and yards clear
    const KEEP = [[-22, 22, -57, -7], [-172, -88, -78, 12], [-110, -90, -68, -52], [74, 134, -56, 0], [-210, -40, 66, 150], [-40, 60, 64, 150], [60, 240, 64, 170], [-45, -35, -48, 12]];
    const faceRoad = (x, z) => { let best = 0, bd = 1e9; for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const d = nearRoad(x + Math.sin(r) * 18, z + Math.cos(r) * 18)[0]; if (d < bd) { bd = d; best = r; } } return best; };
    const LOTS = [], inRect = (px, pz, r) => { const c = Math.cos(r.rot), s = Math.sin(r.rot), lx = (px - r.x) * c - (pz - r.z) * s, lz = (px - r.x) * s + (pz - r.z) * c; return Math.abs(lx) < r.w / 2 && Math.abs(lz) < r.d / 2; };
    const pts9 = r => { const c = Math.cos(r.rot), s = Math.sin(r.rot), out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push([r.x + i * r.w / 2 * c + j * r.d / 2 * s, r.z - i * r.w / 2 * s + j * r.d / 2 * c]); return out; };
    const fits = (x, z, w, d, rot) => { const me = { x, z, w, d, rot }; for (const [px, pz] of pts9(me)) if (inside(px, pz, 1.2) || nearRoad(px, pz)[0] < 2.9 || KEEP.some(r => px > r[0] && px < r[1] && pz > r[2] && pz < r[3]) || LOTS.some(r => inRect(px, pz, r))) return false; if (LOTS.some(r => pts9(r).some(([px, pz]) => inRect(px, pz, me)))) return false; LOTS.push(me); return true; };
  const FROZEN_HOUSES = [[-207.5,-38,3,9.46,8.5],[-207.5,-23,3,10.22,8.67],[-207.5,-8,3,10.06,9.14],[-207.5,7,3,9.01,9.34],[-202.5,22,3,9.04,8.74],[-197.5,-63,3,9.74,9.08],[-197.5,37,3,9.37,9.23],[-187.5,-83,3,9.48,8.23],[-187.5,-48,3,10.59,8.65],[-187.5,-33,3,9.46,8.09],[-187.5,-18,3,10.74,9.24],[-187.5,-3,3,9.91,9.16],[-180,-70.5,2,9.39,8.19],[-180,24.5,0,9.1,8.81],[-175,44.5,0,10.75,8.64],[-165,24.5,0,9.43,8.29],[-160,44.5,0,9.51,9.02],[-150,24.5,0,10.57,9.49],[-145,44.5,0,10.4,8.13],[-140,-90.5,2,10.68,8.02],[-135,24.5,0,10.79,8.76],[-130,44.5,0,10.92,8.9],[-125,-90.5,2,10.58,8.15],[-120,24.5,0,10.8,8.09],[-115,44.5,0,9.92,9.11],[-110,-90.5,2,10.64,9.5],[-105,24.5,0,9.24,8.7],[-100,44.5,0,10.4,9.02],[-95,-90.5,2,9.34,8.58],[-87.5,22,1,9.79,9.05],[-85,44.5,0,9.22,8.66],[-80,-95.5,2,10.22,9.04],[-72.5,-78,1,9.83,8.33],[-72.5,-63,1,9.86,8.08],[-72.5,-38,1,9.34,9],[-72.5,-23,1,10.77,9.08],[-72.5,-8,1,10.45,8.09],[-72.5,7,1,9.15,8.96],[-27,25.5,0,10.59,9.37],[-24.5,3,3,10.89,8.24],[-17,-79.5,2,9.9,9.4],[-12,25.5,0,9.31,8.74],[-7,5.5,0,9.22,8.92],[-2,-79.5,2,9.87,8.83],[3,25.5,0,10.6,8.91],[8,5.5,0,10.06,8.48],[13,-79.5,2,10.75,8.95],[18,25.5,0,10.42,8.11],[25.5,3,1,10.27,8.1],[40.5,28,1,9.34,8.86]];
  const FROZEN_SHEDS = [[167,-93,2,0x5c6670,76,-89],[76,11,3,0x2e6fbf],[206,-96,3,0x5c6670,96,-99],[115,27,0,0x2e8f6f,96,-79],[96,11,3,0x2e6fbf],[206,-75,3,0x2e8f6f,116,-79],[116,11,0,0x2e8f6f],[121,-99,2,0x5c6670],[141,-79,2,0x2e6fbf],[141,11,0,0x5c6670],[146,-99,2,0x2e6fbf],[146,-59,1,0x2e6fbf],[146,-34,1,0x5c6670],[146,-9,1,0x5c6670],[172,23,1,0x2e8f6f,161,16],[206,-54,3,0x2e8f6f,166,-89],[206,-33,3,0x5c6670,166,-64],[166,-39,1,0x2e6fbf],[206,-11,3,0x2e6fbf,166,-14]];
    // the houses and sheds on their plots: fixed positions, so a plot someone owns is always the same plot. Numbers run along each lane.
    const num = {};
    for (const [x, z, q, w, d] of FROZEN_HOUSES) { const rot = q * Math.PI / 2, st = x < -60 ? 'Park Lane' : 'Quarter Lane'; num[st] = (num[st] || 0) + 1; LOTS.push({ x: x - Math.sin(rot) * 2.5, z: z - Math.cos(rot) * 2.5, w: w + 3, d: d + 8, rot });
      B({ type: 'house', name: `${num[st]} ${st}`, area: 'Old Quarter', x, z, rot, w, d, sale: true }); }
    for (const [x, z, q, roof, ox, oz] of FROZEN_SHEDS) { const rot = q * Math.PI / 2; LOTS.push({ x, z, w: 21, d: 16, rot }); B({ type: 'warehouse', name: 'Store shed', area: 'Harbour', x, z, rot, w: 20, d: 14, roof, sale: true, yard: true, lot: ox != null ? 'warehouse@' + ox + ',' + oz : undefined }); }
    // west of Hotel Street: the library and a park with a playground
    B({ id: 'library', type: 'civic', name: 'Capital Library', area: 'Old Quarter', x: -95, z: -137, rot: Math.PI / 2, w: 22, d: 14, owner: 'city' });
    B({ type: 'flat', name: 'Park Lane Court', area: 'Old Quarter', x: -156, z: -86, rot: Math.PI, w: 16, d: 12, floors: 3, color: 0xffe6a1, sale: true, lot: 'flat@-108,38' });
    B({ type: 'flat', name: '62 Hotel Street', area: 'Old Quarter', x: -46, z: -65, rot: -Math.PI / 2, w: 14, d: 12, floors: 3, color: 0xfff1d6, sale: true, lot: 'flat@-86,38' });
    { const M = new THREE.Matrix4().setPosition(-100, TOWN_Y, -60); boxAt('lawn', M, 16, 0.16, 14, 0, 0, 0, C(0xf2d48f)); boxAt('trim', M, 0.5, 2.6, 0.5, -3, 0, -3, C(0xe8483f)); boxAt('trim', M, 3.2, 0.3, 1, -1.8, 2.4, -3, C(0xffd21f)); boxAt('trim', M, 1, 1.6, 3, 3, 0, 2, C(0x2e74c9)); boxAt('trim', M, 3, 0.2, 0.4, 3, 1.8, -3, C(0x8a4fd6)); }
    // the Harbour: office, warehouses, depot, quay apron, gantry cranes, the cargo ship, marina, breakwater
    B({ id: 'office', type: 'office', name: 'Harbour Office', area: 'Harbour', x: 150, z: 39, rot: 0, w: 24, d: 16, floors: 4, sign: 6, owner: 'city' });
    B({ id: 'wh1', type: 'warehouse', name: 'Warehouse 1', area: 'Harbour', x: 168, z: -8, rot: Math.PI / 2, w: 38, d: 26, sale: true });
    B({ id: 'wh2', type: 'warehouse', name: 'Warehouse 2', area: 'Harbour', x: 168, z: -66, rot: Math.PI / 2, w: 34, d: 26, roof: 0x2e8f6f, sale: true });
    B({ id: 'depot', type: 'warehouse', name: 'Delivery depot', area: 'Harbour', x: 96, z: -86, rot: Math.PI, w: 30, d: 18, roof: 0xd9643a, color: 0xfff1d6, sign: 15, sale: true });
    boxAt('lawn', M0, 60, 0.16, 52, 104, 0, -28, C(0xc9c4ba)); // depot yard
    const CONT = [0xd8392b, 0x2e74c9, 0x1f8f5b, 0xf2a531, 0x8a4fd6, 0xe8e2d6], LINE = [0x2e5fa8, 0xb5452f, 0x2f7f86]; // three shipping lines, each stacked together
    for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) for (let k = 0; k < 1 + ((i + r) % 3); k++) boxAt('trim', M0, 2.5, 2.6, 12, 82 + i * 3 + r * 18, k * 2.6, -10 - (r % 2) * 16, C(k === 2 && i === 3 ? 0xe8e2d6 : LINE[r % 3]));
    PARKED.push(['truck', 130, -40, Math.PI / 2], ['truck', 130, -48, Math.PI / 2], ['van', 85, -45, 0], ['van', 89, -45, 0]);
    boxAt('lawn', M0, 46, 0.06, 168, 219, 0, 40, C(0xcfcac0)); // the quay apron, just under the pavement and road
    { const M = new THREE.Matrix4(); boxAt('trim', M, 4, 10.2, 168, 241, -7, 40, C(0xb8b0a0)); for (let z = -40; z <= 118; z += 12) boxAt('trim', M, 0.7, 0.8, 0.7, 240, TOWN_Y + 0.2, z, C(0x2e3640)); }
    for (const z of [-22, 75]) { const M = new THREE.Matrix4().setPosition(232, TOWN_Y, z); for (const [x, zz] of [[-6, -7], [6, -7], [-6, 7], [6, 7]]) boxAt('metal', M, 1.1, 24, 1.1, x, 0, zz, C(0xf2b705)); boxAt('metal', M, 50, 2, 3, 12, 24, 0, C(0xf2b705)); boxAt('trim', M, 4, 3, 4, 10, 21, 0, C(0x2b3440)); boxAt('trim', M, 0.25, 12, 0.25, 22, 10, 0, C(0x2b3440)); }
    for (let i = 0; i < 4; i++) for (let k = 0; k < 1 + (i % 3); k++) for (let j = 0; j < 2; j++) boxAt('trim', M0, 2.5, 2.6, 12, 206 + j * 2.7, k * 2.6, 52 + i * 14, C(LINE[(i >> 1) % 3]));
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
    LOTS.push({ x: -132, z: -128, w: 72, d: 28, rot: 0, open: true }, { x: 0, z: -150, w: 42, d: 22, rot: 0, open: true }, { x: 128, z: -128, w: 32, d: 16, rot: 0, open: true }); // squares people cross on foot
    // ---------- the stadium: the bowl, the forecourt, ticket booths, two car parks off Stadium Way ----------
    B({ id: 'stadium', type: 'stadium', name: 'Capital Stadium', area: 'Stadium', x: 130, z: -335, rot: 0, w: 116, d: 95, owner: 'city' });
    { const M = new THREE.Matrix4().setPosition(130, TOWN_Y, -280); tileAt(130, -280); boxAt('lawn', M, 90, 0.16, 18, 0, 0, 0, C(0xe9dfca)); for (const x of [-30, 30]) { boxAt('trim', M, 4, 2.6, 3, x, 0, 2, C(0xffffff)); boxAt('roof', M, 4.6, 0.3, 3.6, x, 2.6, 2, C(0xd8392b)); sign(M, 26, 3.6, 0.6, x, 3.3, 3.55); } for (const x of [-40, -20, 0, 20, 40]) extraTrees.push([130 + x, TOWN_Y, -272, 0.6, 'round']); }
    LOTS.push({ x: 130, z: -280, w: 92, d: 20, rot: 0, open: true });
    const carPark = (cx, cz, w, d, rows) => { LOTS.push({ x: cx, z: cz, w: w + 2, d: d + 2, rot: 0, open: true }); tileAt(cx, cz); const M = new THREE.Matrix4().setPosition(cx, TOWN_Y, cz); boxAt('lawn', M, w, 0.12, d, 0, 0, 0, C(0x5c616b)); for (const [z, h] of rows) for (let x = -w / 2 + 2; x < w / 2 - 2; x += 3) { boxAt('lawn', M, 0.18, 0.16, 5, x, 0, z, C(0xf4f4f0)); if (rnd() < 0.55) PARKED.push([rnd() < 0.5 ? 'sedan' : 'compact', cx + x + 1.5, cz + z, h]); } };
    carPark(10, -345, 40, 34, [[-12, 0], [12, Math.PI]]); carPark(236, -288, 26, 16, [[-4.5, Math.PI / 2 * 0 + Math.PI], [4.5, 0]]);
    // ---------- Greenfields: the farm co-op store, barns, farmhouses and a patchwork of fields ----------
    B({ id: 'coop', type: 'warehouse', name: 'Greenfields Farm Co-op', area: 'Greenfields', x: -300, z: -303, rot: 0, w: 32, d: 18, color: 0xfff1d6, roof: 0x2f8f3a, sign: 20, owner: 'city' });
    B({ type: 'barn', name: 'West Barn', area: 'Greenfields', x: -398, z: -290, rot: 0, w: 16, d: 11, owner: 'city' });
    B({ type: 'barn', name: 'North Barn', area: 'Greenfields', x: -246, z: -398, rot: Math.PI / 2, w: 16, d: 11, owner: 'city' });
    for (const [x, z, r] of [[-355, -235, Math.PI], [-232, -296, -Math.PI / 2]]) B({ type: 'house', name: 'Farmhouse', area: 'Greenfields', x, z, rot: r, w: 10, d: 9, color: 0xfff1d6, roof: 0x8a5a3c, sale: true });
    // Greenfields' fields, hedgerows, tracks and yards are laid out in buildDistricts, once the streets and paths are known
    // ---------- Villa Point: villas with pools and gardens on the hillside, and the marina in its cove ----------
    VILLAS.forEach((v, i) => B({ type: 'villa', name: `${3 + i * 4} Villa Point Road`, area: 'Villa Point', x: v.x, z: v.z, rot: v.rot, y: v.y, w: 14, d: 11, color: pick([0xffffff, 0xfff8ec, 0xf4eee2]), roof: pick([0xd9643a, 0x5b7fa8, 0x2f8f6f]), sale: true, premium: true }));
    B({ id: 'yacht', type: 'shophouse', name: 'Yacht Club', area: 'Villa Point', x: -440, z: 174, rot: Math.PI, w: 16, d: 10, floors: 2, sign: 23, color: 0xffffff, roof: 0x2e6fbf, awn: 0x0f6fb8, y: 3.1, owner: 'city' });
    B({ type: 'kiosk', name: 'Marina office', area: 'Villa Point', x: -384, z: 172, rot: -Math.PI / 2, w: 6, d: 5, sign: 19, awn: 0x0f6fb8, y: 3.1, owner: 'city' });
    { const M = new THREE.Matrix4(); tileAt(-410, 215); boxAt('trim', M, 2.6, 0.5, 50, -412, 0.9, 214, C(0xc9a77a)); for (let z = 196; z <= 236; z += 9) for (const sd of [-1, 1]) { boxAt('trim', M, 9, 0.4, 1.6, -412 + sd * 5.6, 0.95, z, C(0xc9a77a)); if (rnd() < 0.8) { const Mb = mul(M, -412 + sd * 6.2, 0.1, z + 3.4, Math.PI / 2); boxAt('trim', Mb, 9, 1.5, 3, 0, 0, 0, C(0xffffff)); boxAt('trim', Mb, 9.1, 0.35, 3.1, 0, 0.9, 0, C(pick([0x1f3f8f, 0x0f6fb8, 0xd8392b]))); boxAt('trim', Mb, 4, 1.3, 2.2, -0.5, 1.5, 0, C(0xffffff)); boxAt('glassy', Mb, 3.6, 0.6, 2.3, -0.5, 2.1, 0, C(0x9fdcff)); } } }
    // labels and plaques for the new places
    buildPlaces(LOTS);
    if (EXPANDED) { const t0 = performance.now(); const kit = KIT(); for (const f of REGION_BUILDERS) f(kit, LOTS); World.times.regions = Math.round(performance.now() - t0); }
    LABELS.push({ text: 'Business Centre', level: 'district', x: 40, y: 50, z: -160 }, { text: 'Stadium', level: 'district', x: 130, y: 40, z: -335 }, { text: 'Greenfields', level: 'district', x: -320, y: 30, z: -330 }, { text: 'Villa Point', level: 'district', x: -460, y: 40, z: 70 }, { text: 'Marina', level: 'place', x: -412, y: 10, z: 214 });
    flush();
    World.home = buildings.find(b => b.id === 'home');
    // the ships: a cargo ship at the quay, a tug, sailboats out in the bay
    const g = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.7 });
    const hull = (L, Bw, H, c, deck) => { const s = new THREE.Group(), sh = new THREE.Shape(); sh.moveTo(-L / 2, -Bw / 2); sh.lineTo(L / 2 - Bw, -Bw / 2); sh.quadraticCurveTo(L / 2 + Bw * 0.2, 0, L / 2 - Bw, Bw / 2); sh.lineTo(-L / 2, Bw / 2); sh.closePath(); const hm = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false }).rotateX(-Math.PI / 2), M(c)); hm.position.y = -1.3; hm.castShadow = true; s.add(hm); const dk = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), M(deck)); dk.position.y = H - 1.28; s.add(dk); return s; };
    const ship = hull(80, 14, 6.5, 0x1f3f6b, 0x9c4a32); ship.position.set(253, 0, 40); ship.rotation.y = -Math.PI / 2;
    for (let i = 0; i < 5; i++) for (let k = 0; k < 2; k++) for (let j = 0; j < 4; j++) { const c = new THREE.Mesh(new THREE.BoxGeometry(11, 2.5, 2.5), M(LINE[(i + (k ? 1 : 0)) % 3])); c.position.set(-16 + i * 12, 6.6 + k * 2.6, -3.9 + j * 2.6); c.castShadow = true; ship.add(c); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 12), M(0xffffff)); br.position.set(-33, 9, 0); br.castShadow = true; ship.add(br); g.add(ship);
    const sails = [];
    for (let i = 0; i < 4; i++) { const b = hull(9, 3, 2, 0xffffff, 0xc79b6b), mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 9), M(0xeeeeee)); mast.position.y = 5.3; b.add(mast); const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.5, 0, 0, 9.4, 0, -3.6, 1.5, 0], 3)); sg.computeVertexNormals(); b.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }))); g.add(b); sails.push({ b, cx: [-120, 60, 360, -320][i], cz: [290, 270, 210, 320][i], r: [60, 45, 50, 70][i], s: 0.04 + i * 0.01, a: i * 2 }); }
    for (const [x, z] of [[252, 128], [270, 128], [256, 140], [278, 140], [-74, 236]]) { const b = hull(8, 2.8, 1.8, pick([0xffffff, 0xe8483f, 0x2e74c9]), 0xc79b6b); b.position.set(x, 0, z); g.add(b); }
    const cargo = hull(34, 8, 4, 0x2f5f8f, 0x9c4a32); for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.4, 2.4), M(LINE[i % 3])); c.position.set(-6 + (i % 3) * 6, 3.6, i < 3 ? -1.3 : 1.3); cargo.add(c); } const cb = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 7), M(0xffffff)); cb.position.set(-12, 4.5, 0); cargo.add(cb); g.add(cargo);
    const LANE = [[262, 92], [300, 70], [380, -10], [470, -70], [520, -78], [550, -81]].map(p => new THREE.Vector3(p[0], 0, p[1])), sea = new THREE.CatmullRomCurve3(LANE), voyage = { k: 0, dir: 1, wait: 4 };
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
  // ---------- the bigger island's forest: tiles of trees, each drawn near (full detail), mid (simple) or far (simple and thinned), because the same trees are shared between the two meshes ----------
  const LODT = []; let lodTick = 0;
  function lowGeo(kind) { // a tree in a handful of triangles, a little bigger to stand in for the ones that are thinned out
    const m = (g, y) => { g = g.toNonIndexed(); g.translate(0, y, 0); const n = g.attributes.position.count, col = new Float32Array(n * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g; };
    return kind === 'round' ? m(new THREE.IcosahedronGeometry(3.4, 0), 5.2) : kind === 'pine' ? m(new THREE.ConeGeometry(3, 10, 5, 1, true), 6) : m(new THREE.ConeGeometry(1.5, 9.5, 5, 1, true), 5.6);
  }
  function plantLOD(kind, list) {
    if (!list.length) return; const hi = treeGeo(kind), lo = lowGeo(kind), tiles = new Map(), c = new THREE.Color(), T = 200;
    for (const t of list) { const k = Math.floor(t[0] / T) + ',' + Math.floor(t[2] / T); if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push(t); }
    for (const arr of tiles.values()) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(hash(arr[i][0], arr[i][2]) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } // shuffled, so drawing the first part of the list thins the tile evenly
      const mh = new THREE.InstancedMesh(hi.clone(), treeMat, arr.length), ml = new THREE.InstancedMesh(lo.clone(), treeMat, arr.length); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9;
      arr.forEach((t, i) => { tmp.position.set(t[0], t[1], t[2]); tmp.rotation.set(0, (t[0] * 7.3 + t[2]) % 6.28, 0); tmp.scale.setScalar(t[3]); tmp.updateMatrix(); mh.setMatrixAt(i, tmp.matrix); const p = PAL[kind]; mh.setColorAt(i, c.set(p[Math.abs(Math.floor(t[0] * 13 + t[2] * 7)) % p.length]).convertSRGBToLinear()); x0 = Math.min(x0, t[0]); x1 = Math.max(x1, t[0]); z0 = Math.min(z0, t[2]); z1 = Math.max(z1, t[2]); y0 = Math.min(y0, t[1]); y1 = Math.max(y1, t[1]); });
      ml.instanceMatrix = mh.instanceMatrix; ml.instanceColor = mh.instanceColor; const bs = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2 + 6, (z0 + z1) / 2), Math.hypot(x1 - x0, z1 - z0, y1 - y0) / 2 + 14); mh.geometry.boundingSphere = bs; ml.geometry.boundingSphere = bs.clone();
      mh.frustumCulled = ml.frustumCulled = true; mh.castShadow = true; mh.receiveShadow = ml.receiveShadow = true; ml.castShadow = false; ml.visible = false; scene.add(mh, ml); LODT.push({ mh, ml, n: arr.length, c: bs.center, r: bs.radius });
    }
    if (!lodTick) { lodTick = 1; let f = 0; tick.push(() => { if (++f % 6) return; const p = camera.position, sc = Q === 'low' ? 0.6 : 1; for (const t of LODT) { const d = Math.max(0, Math.hypot(p.x - t.c.x, p.y - t.c.y, p.z - t.c.z) - t.r) / sc, near = d < 260, frac = d < 260 ? 1 : d < 480 ? 0.6 : d < 900 ? 0.5 : d < 1700 ? 0.26 : 0.14;
      t.mh.visible = near || d < 480; t.ml.visible = !t.mh.visible; const m = t.mh.visible ? t.mh : t.ml; m.count = Math.max(1, Math.ceil(t.n * frac)); } }); }
  }
  function plant(kind, list) { if (EXPANDED && (kind === 'round' || kind === 'pine' || kind === 'cypress')) return plantLOD(kind, list); // trees in 150 m tiles, each with its own bounds, so only the tiles in view (and in the sun's view) are drawn
    if (!list.length) return; const geo = treeGeo(kind), tiles = new Map(), c = new THREE.Color();
    for (const t of list) { const k = Math.floor(t[0] / 150) + ',' + Math.floor(t[2] / 150); if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push(t); }
    for (const arr of tiles.values()) {
      const g = geo.clone(), m = new THREE.InstancedMesh(g, treeMat, arr.length); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9;
      arr.forEach((t, i) => { tmp.position.set(t[0], t[1], t[2]); tmp.rotation.set(0, (t[0] * 7.3 + t[2]) % 6.28, 0); tmp.scale.setScalar(t[3]); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); const p = PAL[kind]; m.setColorAt(i, c.set(p[Math.abs(Math.floor(t[0] * 13 + t[2] * 7)) % p.length]).convertSRGBToLinear()); x0 = Math.min(x0, t[0]); x1 = Math.max(x1, t[0]); z0 = Math.min(z0, t[2]); z1 = Math.max(z1, t[2]); y0 = Math.min(y0, t[1]); y1 = Math.max(y1, t[1]); });
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2 + 6, (z0 + z1) / 2), Math.hypot(x1 - x0, z1 - z0, y1 - y0) / 2 + 14);
      m.frustumCulled = true; m.castShadow = true; m.receiveShadow = true; scene.add(m); // r128 instanced meshes skip culling unless told
    }
  }
  // buildings in a grid of 16 m cells, so a tree or a path asks about the few buildings near it instead of all of them (this was
  // most of the island's build time). Buildings are only ever added, so the grid just takes in the new ones; pads over 8 m ask all.
  const BCELL = 16, BPADMAX = 8, BGRID = new Map(); let BGN = 0;
  const bkey = (i, j) => i * 100003 + j;
  function buildingGrid() {
    if (BGN > buildings.length) { BGRID.clear(); BGN = 0; }
    for (; BGN < buildings.length; BGN++) {
      const b = buildings[BGN], k = b.clear || 0, r = Math.hypot(b.w / 2 + BPADMAX + k, b.d / 2 + BPADMAX + k), o = { b, c: Math.cos(b.rot), s: Math.sin(b.rot) };
      for (let i = Math.floor((b.x - r) / BCELL), i1 = Math.floor((b.x + r) / BCELL); i <= i1; i++) for (let j = Math.floor((b.z - r) / BCELL), j1 = Math.floor((b.z + r) / BCELL); j <= j1; j++) { const key = bkey(i, j); let a = BGRID.get(key); if (!a) BGRID.set(key, a = []); a.push(o); }
    }
    return BGRID;
  }
  const inBox = (o, x, z, pad) => { const b = o.b, lx = (x - b.x) * o.c - (z - b.z) * o.s, lz = (x - b.x) * o.s + (z - b.z) * o.c; return Math.abs(lx) < b.w / 2 + pad && Math.abs(lz) < b.d / 2 + pad; };
  const inside = (x, z, pad) => {
    if (pad > BPADMAX) { for (const b of buildings) if (inBox({ b, c: Math.cos(b.rot), s: Math.sin(b.rot) }, x, z, pad)) return true; return false; }
    const L = buildingGrid().get(bkey(Math.floor(x / BCELL), Math.floor(z / BCELL))); if (L) for (let i = 0; i < L.length; i++) if (inBox(L[i], x, z, pad)) return true; return false;
  };
  function clearOf(x, z, pad) { // villas keep their gardens clear of the woods
    if (pad > BPADMAX) { for (const b of buildings) if (inBox({ b, c: Math.cos(b.rot), s: Math.sin(b.rot) }, x, z, pad + (b.clear || 0))) return false; }
    else { const L = buildingGrid().get(bkey(Math.floor(x / BCELL), Math.floor(z / BCELL))); if (L) for (let i = 0; i < L.length; i++) if (inBox(L[i], x, z, pad + (L[i].b.clear || 0))) return false; }
    return nearRoad(x, z)[0] > pad + 2.5;
  }
  const LEFT_OUT = {}; // why trees were not planted, by rule (World.treeReport shows it)
  function settle(t, kind) { // a tree needs ground: off the carriageway and the footpaths, clear of walls, out of the water, at the height of the ground under it
    const x = t[0], z = t[2], small = kind === 'flower' || kind === 'bush', street = t[4] === 'street', g = heightAt(x, z), no = why => { LEFT_OUT[why] = (LEFT_OUT[why] || 0) + 1; return false; };
    if (land(x, z) < 1.5 || g < 0.2) return no('water'); if (nearRoad(x, z)[0] < (street ? 0.3 : small ? 0.4 : 1.2)) return no('road'); if (inside(x, z, small ? 0 : 0.6)) return no('wall'); if (!street && wnear(x, z, small ? 0.5 : 1.1)) return no('path');
    if (Math.abs(t[1] - g) > 0.7) t[1] = g - 0.1; // on a hillside it stands on the slope (planters and plazas keep their raised base)
    return true;
  }
  const THIN = new Map(); // where every tree stands (1.5 m cells), so trees planted later keep their distance from the ones already there
  function thin(T, seen = new Map()) { // no two trees closer than 1.5 m: their crowns would melt into one lump
    for (const k in T) { if (k === 'flower' || k === 'bush') continue;
      T[k] = T[k].filter(t => { const i = Math.floor(t[0] / 1.5), j = Math.floor(t[2] / 1.5); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const u of seen.get((i + a) + ',' + (j + b)) || []) if (Math.hypot(u[0] - t[0], u[2] - t[2]) < 1.5) { LEFT_OUT.crowded = (LEFT_OUT.crowded || 0) + 1; return false; } const key = i + ',' + j; if (!seen.has(key)) seen.set(key, []); seen.get(key).push(t); return true; });
    }
  }
  function wildForest(T, bx0 = X0, bx1 = X1, bz0 = Z0, bz1 = Z1) { // the land's own trees: on a jittered grid, thick where the ground is hilly and damp, thin on the plains, none on beaches, fields, works, rock or the roads; for the square [bx0, bx1] x [bz0, bz1] (the grid is the same whichever square is asked for)
    if (bx0 === X0 && bz0 === Z0 && bx1 === X1 && bz1 === Z1) seed = 99; const S = Q === "low" ? 10 : Q === "high" ? 6 : 7; let n = 0;
    const xs = X0 + Math.max(0, Math.ceil((bx0 - X0) / S)) * S, zs = Z0 + Math.max(0, Math.ceil((bz0 - Z0) / S)) * S;
    for (let x = xs; x < Math.min(X1, bx1); x += S) for (let z = zs; z < Math.min(Z1, bz1); z += S) {
      const jx = x + (hash(x * 0.37, z * 0.91) - 0.5) * S * 0.9, jz = z + (hash(x * 0.77 + 5, z * 0.13) - 0.5) * S * 0.9, d = land(jx, jz); if (d < 12) continue;
      const h = heightAt(jx, jz), dens = G.forestDensity(jx, jz, h, d); if (dens <= 0.01 || hash(jx * 1.9, jz * 2.3) > dens) continue;
      if (K.isle && d > 14) continue; if (nearRoad(jx, jz)[0] < 3.2 || !clearOf(jx, jz, 2.5) || wnear(jx, jz, 2.2)) continue; const rv = G.nearRiver(jx, jz); if (rv && rv.d < rv.hw + 3) continue;
      const r = hash(jx * 3.1, jz * 1.7), sc = 0.75 + hash(jx, jz * 5.3) * 0.5; n++;
      (h > 26 ? (r < 0.6 ? T.pine : r < 0.8 ? T.cypress : T.round) : r < 0.12 ? T.cypress : r < 0.2 ? T.bush : T.round).push([jx, h - 0.15, jz, sc]);
    }
    LEFT_OUT.forest = (LEFT_OUT.forest || 0) + n;
  }
  // the bigger island's wild forest is planted after the game starts: a 200 m tile at a time, 6 ms a frame, nearest home first, so the island is playable at once and the woods grow in round you
  function wildTile(tx, tz, TS) {
    const T2 = { round: [], pine: [], cypress: [], palm: [], bush: [], flower: [] }; wildForest(T2, tx * TS, (tx + 1) * TS, tz * TS, (tz + 1) * TS);
    let any = false; for (const k in T2) { T2[k] = T2[k].filter(t => settle(t, k)); if (T2[k].length) any = true; } if (!any) return;
    thin(T2, THIN); for (const k in T2) if (T2[k].length) { plant(k, T2[k]); for (const t of T2[k]) TREES[k].push(t); }
  }
  function forestLater() {
    const TS = 200, HX = 27, HZ = -20, queue = []; for (let tx = Math.floor(X0 / TS); tx * TS < X1; tx++) for (let tz = Math.floor(Z0 / TS); tz * TS < Z1; tz++) { let wet = true; for (let a = 0; a <= 2 && wet; a++) for (let b = 0; b <= 2; b++) if (land(tx * TS + a * TS / 2, tz * TS + b * TS / 2) > -20) { wet = false; break; } if (!wet) queue.push([tx, tz]); }
    queue.sort((p, q) => Math.hypot(p[0] * TS + TS / 2 - HX, p[1] * TS + TS / 2 - HZ) - Math.hypot(q[0] * TS + TS / 2 - HX, q[1] * TS + TS / 2 - HZ)); LEFT_OUT.forestTiles = queue.length; World.forestPending = () => queue.length;
    tick.push(() => { if (!queue.length) return; const t1 = performance.now(); do { const [tx, tz] = queue.shift(); wildTile(tx, tz, TS); } while (queue.length && performance.now() - t1 < 6); });
  }
  function buildNature() {
    const T = { round: [], pine: [], cypress: [], palm: [], bush: [], flower: [] }; seed = 99;
    for (const t of extraTrees) if (!wnear(t[0], t[2], t[4] === 'flower' || t[4] === 'bush' ? 0.9 : 1.4)) T[t[4]].push(t); // nothing planted on a path
    for (let i = 0; !EXPANDED && i < 26000 && T.round.length + T.pine.length < 5200; i++) { // the wild land: forest on the hill, groves elsewhere, nothing on the beach or in the water
      const x = X0 + rnd() * (X1 - X0), z = Z0 + rnd() * (Z1 - Z0), d = land(x, z); if (d < 9 || townMask(x, z) > 0.2) continue;
      const h = heightAt(x, z); if (K.rock < 0.4 && !K.isle && d < 50 && h < 4) continue; if (!clearOf(x, z, 3) || wnear(x, z, 2.2)) continue;
      if (K.isle && d > 14) continue; // the industrial isle keeps a green fringe, the middle is the works
      const r = rnd(), f = fbm(x * 1.7, z * 1.7); if (h < 12 && f < 0.45 && r < 0.6) continue;
      (h > 22 ? (r < 0.6 ? T.pine : r < 0.8 ? T.cypress : T.round) : r < 0.12 ? T.cypress : r < 0.2 ? T.bush : T.round).push([x, h - 0.15, z, 0.75 + rnd() * 0.5]);
    }
    // (the bigger island's wild forest is planted later: see forestLater)
    for (let x = -205; x < 55; x += 12) for (const z of [136.5, 148]) { const y = z < 140 ? TOWN_Y : heightAt(x, z); if (Math.abs(x + 78) > 4 && Math.abs(x + 30) > 6 && Math.abs(x - 30) > 5) T.palm.push([x + (z > 140 ? 5 : 0), y, z, 0.9 + rnd() * 0.25]); }
    for (let i = 0; i < 90; i++) { const x = -60 + rnd() * 240, z = 70 + rnd() * 70; if (x > 60 && (Math.abs(x - 92) < 24 && Math.abs(z - 100) < 14 || Math.abs(x - 120) < 8 && Math.abs(z - 78) < 6 || x > 140 && z > 105)) continue; if (land(x, z) > 30 && clearOf(x, z, 1.5) && Math.abs(z - 142) > 5) (rnd() < 0.5 ? T.palm : T.round).push([x, TOWN_Y, z, 0.8 + rnd() * 0.3]); }
    const pits = []; // street trees in pits at the kerb edge of the pavement, lamps between them; none at a crossing, a corner or a front path
    for (const e of edges) if (e.kind === 'town') for (let s = 14; s < e.len - 14; s += 8) for (const sd of [-1, 1]) { const i = e.cum.findIndex(c => c >= s), p = e.pts[i], q = e.pts[Math.min(e.pts.length - 1, i + 1)], dx = q[0] - p[0], dz = q[2] - p[2], L = Math.hypot(dx, dz) || 1, lamp = Math.round(s / 8) % 4 === 2, o = e.w / 2 + (lamp ? 0.45 : 0.8), x = p[0] - dz / L * sd * o, z = p[2] + dx / L * sd * o;
      if (Math.round(s / 8) % 2) continue; if (inside(x, z, 1.2) || Object.values(nodes).some(N => Math.hypot(N.x - x, N.z - z) < N.r + 3.5) || CROSS.some(c => Math.hypot(c.x - x, c.z - z) < c.hw + 4.5) || wnear(x, z, 2.2, 'front') || wnear(x, z, 1.6, 'path')) continue;
      if (lamp) LAMPS.push([x, p[1] + 0.1, z]); else T.round.push([x, p[1] + 0.1, z, 0.55, 'street', dx / L, dz / L]); }
    triMesh(FOOT.path, off(new THREE.MeshStandardMaterial({ color: lin(0xe6dcc8), roughness: 0.9 }), -2)); triMesh(FOOT.front, off(new THREE.MeshStandardMaterial({ color: lin(0xe9e1d0), roughness: 0.9 }), -2));
    for (const k in T) T[k] = T[k].filter(t => settle(t, k)); thin(T, THIN);
    for (const t of T.round) if (t[4] === 'street') quad(pits, t[0], t[1], t[2], t[5], t[6], 0.6, 0.6, 0.015);
    if (pits.length) triMesh(pits, off(new THREE.MeshStandardMaterial({ color: lin(0x6b5640), roughness: 1 }), -3));
    TREES = T; for (const k in T) plant(k, T[k]); if (EXPANDED) forestLater();
    const rocks = []; seed = 17;
    for (const pts of G.COAST_LISTS.map(P => curve(P, 12))) for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (p[2] < 0.6 || rnd() < 0.4) continue; for (let k = 0; k < 2; k++) { const x = p[0] + (rnd() - 0.5) * 14, z = p[1] + (rnd() - 0.5) * 14; rocks.push([x, Math.min(heightAt(x, z), 1) - 0.4, z, 1.2 + rnd() * 2.6]); } }
    const rm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), rocks.length), rc = new THREE.Color();
    rocks.forEach((t, i) => { tmp.position.set(t[0], t[1], t[2]); tmp.rotation.set(t[0] % 3, t[2] % 3, 0); tmp.scale.set(t[3], t[3] * 0.75, t[3] * 1.1); tmp.updateMatrix(); rm.setMatrixAt(i, tmp.matrix); rm.setColorAt(i, rc.set(pick([0x9a958d, 0x85817b, 0xaaa59b])).convertSRGBToLinear()); });
    rm.castShadow = true; scene.add(rm);
    // lamps along the promenade and the town streets
    const lampGeo = new THREE.CylinderGeometry(0.1, 0.14, 5, 5).translate(0, 2.5, 0), lampTop = new THREE.SphereGeometry(0.35, 8, 6).translate(0, 5.1, 0), lamps = [];
    for (let x = -200; x < 55; x += 24) lamps.push([x, TOWN_Y + 0.16, 139]); for (const l of LAMPS) lamps.push(l);
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
  function vehicleGeo(type) { // the painted body (tinted per vehicle) and the fixed parts (glass, bumpers, grilles, lights); the wheels are separate so they turn and steer
    const body = [], fixed = [], W = WHITE, at = (list, g, c, x, y, z) => list.push([g.clone().translate(x, y, z), c]), B = (w, h, d) => new THREE.BoxGeometry(w, h, d), D = VCOL.dark, G = VCOL.glass;
    const lights = (w, y, f, b) => { for (const s of [-1, 1]) { at(fixed, B(0.36, 0.16, 0.06), VCOL.lamp, s * (w / 2 - 0.3), y, f); at(fixed, B(0.32, 0.15, 0.06), VCOL.tail, s * (w / 2 - 0.28), y, b); } };
    const bumpers = (w, y, f, b) => { at(fixed, B(w + 0.04, 0.22, 0.24), D, 0, y, f); at(fixed, B(w + 0.04, 0.22, 0.24), D, 0, y, b); };
    const mirrors = (w, y, z) => { for (const s of [-1, 1]) at(fixed, B(0.2, 0.13, 0.1), D, s * (w / 2 + 0.1), y, z); };
    // the finer parts: number plates, door seams and handles, dark wheel arches, window pillars, side skirts
    const detail = (w, y, h, f, b, doors, arches, ar, pillar) => { for (const z of [f + 0.13, b - 0.13]) at(fixed, B(0.5, 0.12, 0.03), VCOL.white, 0, y - h / 2 + 0.08, z);
      for (const s of [-1, 1]) { for (const z of doors) { at(fixed, B(0.02, h * 0.82, 0.03), D, s * (w / 2 + 0.005), y, z); at(fixed, B(0.03, 0.04, 0.18), VCOL.rim, s * (w / 2 + 0.01), y + h * 0.25, z - 0.3); }
        for (const z of arches) at(fixed, B(0.03, ar * 0.75, ar * 2.4), D, s * (w / 2 + 0.008), ar * 1.35, z); at(fixed, B(0.03, 0.08, Math.abs(f - b) * 0.55), D, s * (w / 2 + 0.008), y - h / 2 + 0.04, (f + b) / 2);
        if (pillar) at(fixed, B(0.06, pillar[1], 0.1), D, s * pillar[0], pillar[2], pillar[3]); } };
    if (type === 'compact') { // a hatchback: short bonnet, steep tailgate
      at(body, B(1.7, 0.52, 3.75), W, 0, 0.62, 0); at(body, taper(1.66, 0.12, 1.05, 1.6, 0.95, -0.05), W, 0, 0.88, 1.32); at(fixed, taper(1.62, 0.6, 2.45, 1.38, 1.6, -0.32), G, 0, 0.88, -0.4); at(body, B(1.42, 0.07, 1.55), W, 0, 1.5, -0.62);
      bumpers(1.7, 0.42, 1.86, -1.86); lights(1.7, 0.74, 1.88, -1.88); mirrors(1.62, 1.02, 0.6); detail(1.7, 0.62, 0.52, 1.86, -1.86, [0.45], [1.2, -1.15], 0.31, [0.74, 0.5, 1.15, -0.2]); }
    else if (type === 'sedan') { // a saloon: bonnet, cabin, boot
      at(body, B(1.8, 0.5, 4.65), W, 0, 0.62, 0); at(fixed, taper(1.74, 0.58, 2.4, 1.44, 1.55, -0.1), G, 0, 0.87, -0.2); at(body, B(1.46, 0.07, 1.5), W, 0, 1.47, -0.3); at(body, B(1.76, 0.06, 1.05), W, 0, 0.9, -1.75); at(body, B(1.76, 0.06, 1.3), W, 0, 0.9, 1.65);
      at(fixed, B(1.0, 0.2, 0.05), D, 0, 0.62, 2.34); bumpers(1.8, 0.42, 2.36, -2.36); lights(1.8, 0.75, 2.36, -2.36); mirrors(1.74, 1.0, 0.8); detail(1.8, 0.62, 0.5, 2.36, -2.36, [0.75, -0.45], [1.45, -1.45], 0.33, [0.8, 0.5, 1.14, -0.15]); }
    else if (type === 'suv') { // tall body, upright cabin, roof rails
      at(body, B(1.92, 0.78, 4.6), W, 0, 0.84, 0); at(fixed, taper(1.88, 0.7, 3.05, 1.74, 2.7, -0.12), G, 0, 1.23, -0.35); at(body, B(1.76, 0.08, 2.65), W, 0, 1.96, -0.45); for (const s of [-1, 1]) at(fixed, B(0.06, 0.08, 2.4), D, s * 0.78, 2.04, -0.45);
      at(fixed, B(1.2, 0.3, 0.05), D, 0, 0.86, 2.31); bumpers(1.92, 0.52, 2.34, -2.34); lights(1.92, 1.02, 2.31, -2.31); mirrors(1.88, 1.35, 0.95); detail(1.92, 0.84, 0.78, 2.34, -2.34, [0.85, -0.5], [1.5, -1.45], 0.4, [0.88, 0.62, 1.58, -0.2]); }
    else if (type === 'pickup') { // a cab and an open load bed
      at(body, B(1.94, 0.66, 5.2), W, 0, 0.76, 0); at(fixed, taper(1.9, 0.72, 2.0, 1.72, 1.7, -0.1), G, 0, 1.09, 0.75); at(body, B(1.74, 0.08, 1.7), W, 0, 1.84, 0.7);
      for (const s of [-1, 1]) at(body, B(0.1, 0.5, 2.3), W, s * 0.92, 1.34, -1.4); at(body, B(1.94, 0.5, 0.1), W, 0, 1.34, -2.55); at(fixed, B(1.72, 0.05, 2.3), D, 0, 1.11, -1.4);
      at(fixed, B(1.2, 0.3, 0.05), D, 0, 0.8, 2.61); bumpers(1.94, 0.5, 2.64, -2.64); lights(1.94, 0.95, 2.61, -2.61); mirrors(1.9, 1.3, 1.4); detail(1.94, 0.76, 0.66, 2.64, -2.64, [1.1], [1.75, -1.55], 0.4, null);
    }
    else if (type === 'sports') { // a low coupe: long bonnet, small glasshouse, a rear wing
      at(body, B(1.86, 0.42, 4.3), W, 0, 0.52, 0); at(body, taper(1.84, 0.1, 1.6, 1.74, 1.5, 0), W, 0, 0.73, 1.3); at(fixed, taper(1.72, 0.44, 2.1, 1.3, 1.1, -0.3), G, 0, 0.73, -0.3); at(body, B(1.28, 0.05, 1.0), W, 0, 1.17, -0.5);
      at(fixed, B(1.76, 0.06, 0.38), D, 0, 1.02, -1.98); for (const s of [-1, 1]) { at(fixed, B(0.08, 0.3, 0.08), D, s * 0.6, 0.86, -1.98); at(fixed, B(0.04, 0.2, 0.7), D, s * 0.94, 0.62, 0.7); }
      at(fixed, B(1.1, 0.12, 0.05), D, 0, 0.45, 2.16); bumpers(1.86, 0.34, 2.16, -2.16); lights(1.86, 0.62, 2.16, -2.16); mirrors(1.72, 0.92, 0.45); detail(1.86, 0.52, 0.42, 2.16, -2.16, [0.1], [1.35, -1.35], 0.32, null); }
    else if (type === 'van') { at(body, B(2, 1.95, 3.9), W, 0, 1.43, -0.55); at(body, taper(2, 1.2, 1.25, 1.9, 0.7, -0.27), W, 0, 0.45, 2.02); at(fixed, B(1.82, 0.62, 0.06), G, 0, 1.55, 2.0); at(fixed, B(2.02, 0.32, 3.4), VCOL.stripe, 0, 1.0, -0.5); for (const s of [-1, 1]) at(fixed, B(0.04, 0.55, 0.7), G, s * 1.0, 1.65, 1.15);
      bumpers(2, 0.42, 2.66, -2.52); lights(2, 0.75, 2.66, -2.51); mirrors(2, 1.6, 1.7); }
    else if (type === 'bus') { at(body, B(2.5, 2.7, 11), W, 0, 1.75, 0); at(fixed, B(2.54, 1.0, 9.6), G, 0, 2.05, -0.2); at(fixed, B(2.2, 1.3, 0.06), G, 0, 2.0, 5.51); at(fixed, B(1.6, 0.3, 0.06), lin(0xffd21f), 0, 2.85, 5.52); at(fixed, B(2.3, 0.12, 10.4), VCOL.white, 0, 3.15, 0); at(fixed, B(0.06, 2.1, 1.1), G, 1.26, 1.45, 3.9); lights(2.5, 0.85, 5.51, -5.51); }
    else if (type === 'truck' || type === 'flatbed' || type === 'tanker') { // a rigid lorry: a two-part cab with a sloped deflector and a grille; a box body, or a flat deck of crates
      const cab = VCOL.cab; at(fixed, B(2.2, 0.35, 9.0), D, 0, 0.75, -0.5); at(fixed, B(2.45, 1.4, 2.3), cab, 0, 1.45, 3.4); at(fixed, B(2.45, 1.0, 2.0), cab, 0, 2.65, 3.25); at(fixed, taper(2.3, 0.45, 1.6, 2.0, 0.7, -0.35), cab, 0, 3.15, 3.05);
      at(fixed, B(2.2, 0.8, 0.06), G, 0, 2.65, 4.26); for (const s of [-1, 1]) at(fixed, B(0.04, 0.6, 1.0), G, s * 1.23, 2.65, 3.5); at(fixed, B(1.6, 0.7, 0.06), D, 0, 1.4, 4.56); at(fixed, B(2.5, 0.35, 0.3), D, 0, 0.85, 4.6); for (const s of [-1, 1]) at(fixed, B(0.12, 0.5, 0.12), D, s * 1.35, 2.6, 4.1);
      lights(2.45, 1.05, 4.58, -4.91);
      if (type === 'truck') { at(body, B(2.55, 2.7, 6.6), W, 0, 2.35, -1.6); at(fixed, B(2.57, 0.4, 6.0), VCOL.stripe, 0, 1.6, -1.6); at(fixed, B(0.06, 2.5, 0.04), D, 0, 2.35, -4.92); }
      else if (type === 'tanker') { const TK = (r, l) => new THREE.CylinderGeometry(r, r, l, 18).rotateX(Math.PI / 2); at(body, TK(1.2, 6.6), W, 0, 2.2, -1.6); for (const z of [-3.9, -0.2]) at(fixed, TK(1.24, 0.45), VCOL.white, 0, 2.2, z);
        at(fixed, B(2.2, 0.3, 6.4), D, 0, 1.05, -1.6); at(fixed, B(1.0, 0.1, 4.8), D, 0, 3.45, -1.6); at(fixed, B(0.9, 0.45, 0.9), D, 0, 3.5, -2.4); at(fixed, TK(0.18, 0.5), D, 0, 3.3, -3.9); at(fixed, B(0.08, 1.6, 0.08), D, 1.28, 2.2, -4.85); }
      else { at(fixed, B(2.5, 0.25, 6.6), lin(0x6b4a33), 0, 1.15, -1.6); for (const s of [-1, 1]) at(body, B(0.12, 0.6, 6.6), W, s * 1.22, 1.55, -1.6); at(body, B(2.5, 1.0, 0.12), W, 0, 1.8, 1.72);
        for (const z of [-3.7, -1.6, 0.5]) for (const s of [-0.6, 0.6]) { at(fixed, B(1.05, 0.8, 1.9), lin(0xb5885a), s, 1.68, z); at(fixed, B(1.05, 0.8, 1.9), lin(0xa8784e), s, 2.5, z); at(fixed, B(0.95, 0.12, 1.75), lin(0x6fbf3f), s, 2.96, z); } } }
    const merge = list => { const pos = [], nor = [], col = []; for (const [g0, c] of list) { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; };
    return { body: merge(body), fixed: merge(fixed) };
  }
  const wl = (x, f, b, r, wd = 0.24, rear2) => [[-x, f, r, wd, 1], [x, f, r, wd, 1], [-x, b, r, wd], [x, b, r, wd]].concat(rear2 != null ? [[-x, rear2, r, wd], [x, rear2, r, wd]] : []); // wheels: [x, z, radius, width, steers]
  const VT = { compact: { len: 3.8, paint: [0xe8483f, 0xf2b705, 0x2fb7c4, 0x8a4fd6, 0xffffff, 0x9fd36a], vf: 1, wheels: wl(0.74, 1.2, -1.15, 0.31) }, sedan: { len: 4.7, paint: [0xffffff, 0x2e5aa8, 0xb9c0c8, 0x24282e, 0xc0392b], vf: 1, wheels: wl(0.8, 1.45, -1.45, 0.33, 0.26) },
    sports: { len: 4.3, paint: [0xd8392b, 0xf2b705, 0x1f8fff, 0x16181c, 0xffffff, 0x2fbf6a], vf: 1.12, wheels: wl(0.82, 1.35, -1.35, 0.32, 0.27) }, suv: { len: 4.7, paint: [0x2e5aa8, 0x24282e, 0xb9c0c8, 0xffffff, 0x7a1f2b], vf: 0.95, wheels: wl(0.84, 1.5, -1.45, 0.4, 0.28) }, pickup: { len: 5.3, paint: [0xc0392b, 0x2f5f3a, 0xf2f2f2, 0x2e5aa8], vf: 0.92, wheels: wl(0.84, 1.75, -1.55, 0.4, 0.28) },
    van: { len: 5.3, paint: [0xffffff], vf: 0.9, wheels: wl(0.88, 1.75, -1.6, 0.36, 0.28) }, bus: { len: 11, paint: [0xf28c28], vf: 0.8, wheels: wl(1.08, 3.6, -3.6, 0.5, 0.32) },
    truck: { len: 9.5, paint: [0xf2b705, 0xe8762c, 0x1f8f5b, 0xd8392b], vf: 0.8, wheels: wl(1.0, 3.3, -2.8, 0.5, 0.36, -3.9) }, flatbed: { len: 9.5, paint: [0x2f8f3a], vf: 0.8, wheels: wl(1.0, 3.3, -2.8, 0.5, 0.36, -3.9) }, tanker: { len: 9.5, paint: [0xd8392b], vf: 0.8, wheels: wl(1.0, 3.3, -2.8, 0.5, 0.36, -3.9) } };
  let WHEEL = null; const _wm = new THREE.Matrix4(), _wq = new THREE.Matrix4();
  function setPose(type, i, M, roll = 0, steer = 0) { // a vehicle's body, fixed parts and wheels (rolling with the distance driven, the front pair steering)
    const m = meshes[type], W = VT[type].wheels; m.body.setMatrixAt(i, M); m.fixed.setMatrixAt(i, M);
    for (let j = 0; j < W.length; j++) { const [x, z, r, wd, fr] = W[j]; _wm.copy(M).multiply(_wq.makeTranslation(x, r, z)); if (fr && steer) _wm.multiply(_wq.makeRotationY(steer)); _wm.multiply(_wq.makeRotationX(roll / r)).multiply(_wq.makeScale(wd, r, r)); WHEEL.setMatrixAt(m.wbase + i * W.length + j, _wm); }
  }

  // ---------- weather: rain that comes and goes, thunder and lightning in the heavy storms, and now and then a tornado far out over the sea (it never touches the land) ----------
  function buildWeather() {
    let mode = (new URLSearchParams(location.search).get('weather') || 'auto'); const N = Q === 'low' ? 900 : 2200, SPAN = 260, TOP = 150, W = World.weather = { rain: 0, target: 0, storm: false, bolts: 0, tornado: null, mode };
    const pos = new Float32Array(N * 6), vel = new Float32Array(N), geo = new THREE.BufferGeometry(); for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * SPAN, y = Math.random() * TOP, z = (Math.random() - 0.5) * SPAN; pos.set([x, y, z, x - 0.7, y - 5, z - 0.4], i * 6); vel[i] = 55 + Math.random() * 25; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const rainMat = new THREE.LineBasicMaterial({ color: 0xcfe0f2, transparent: true, opacity: 0, depthWrite: false }), rain = new THREE.LineSegments(geo, rainMat); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
    const bolt = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf4f0ff, transparent: true, opacity: 0.95, fog: false })); bolt.visible = false; bolt.frustumCulled = false; scene.add(bolt);
    const sky0 = scene.background.clone(), grey = new THREE.Color(0x7f8a96), sun0 = sun.intensity, hemi0 = hemi.intensity; let flash = 0, clearT = 20 + Math.random() * 40, rainT = 0, nextBolt = 6, nextTornado = 150 + Math.random() * 200;
    // the tornado: a funnel of rings, wide at the top and narrow at the foot, with a skirt of spray; it drifts over open water
    const tor = new THREE.Group(), rings = []; for (let i = 0; i < 16; i++) { const f = i / 15, r = 3 + f * f * 34, m = new THREE.Mesh(new THREE.TorusGeometry(r, 1.6 + f * 3, 5, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.6, 0.06, 0.34 + f * 0.2), transparent: true, opacity: 0.72, depthWrite: false })); m.rotation.x = Math.PI / 2; m.position.y = f * 120; tor.add(m); rings.push(m); }
    const spray = new THREE.Mesh(new THREE.CylinderGeometry(24, 30, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xdfe7ee, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })); spray.position.y = 4; tor.add(spray); tor.visible = false; scene.add(tor);
    const place = () => { const c = controls.target; for (let k = 0; k < 80; k++) { const a = Math.random() * Math.PI * 2, r = (k < 40 ? 450 : 250) + Math.random() * 550, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r; if (land(x, z) < -90) return { x, z, a: Math.random() * Math.PI * 2, life: 70 + Math.random() * 40, age: 0 }; } return null; };
    // what the player chooses in Settings: auto (it comes and goes by itself), or sunny, rain, storm or tornado held until changed
    W.set = (what) => {
      if (what === 'auto') { mode = 'auto'; W.mode = 'auto'; clearT = 3; nextTornado = 90 + Math.random() * 120; return; }
      mode = what; W.mode = what;
      if (what === 'clear') { W.target = 0; W.storm = false; clearT = 1e9; W.tornado = null; tor.visible = false; } else if (what === 'rain') { W.target = 0.6; W.storm = false; clearT = 1e9; W.tornado = null; tor.visible = false; } else if (what === 'storm') { W.target = 1; W.storm = true; clearT = 1e9; nextBolt = 1; W.tornado = null; tor.visible = false; } else if (what === 'tornado') { W.target = 1; W.storm = true; clearT = 1e9; nextBolt = 2; W.tornado = place(); } else { clearT = 5; }
    };
    if (mode !== 'auto') W.set(mode);
    tick.push((dt) => {
      if (mode === 'auto') { clearT -= dt; if (clearT <= 0) { if (W.target > 0) { W.target = 0; W.storm = false; clearT = 120 + Math.random() * 240; } else { W.storm = Math.random() < 0.35; W.target = W.storm ? 1 : 0.55; clearT = 40 + Math.random() * 60; } } }
      W.rain += (W.target - W.rain) * Math.min(1, dt * 0.5); const r = W.rain; rain.visible = r > 0.03; rainMat.opacity = 0.8 * Math.min(1, r * 1.5);
      const dark = r * 0.5 + flash; scene.background.copy(sky0).lerp(grey, r * 0.8); scene.fog.color.copy(scene.background); sun.intensity = sun0 * (1 - r * 0.6) + flash * 2.2; hemi.intensity = hemi0 * (1 - r * 0.35) + flash * 1.1; renderer.toneMappingExposure = 1 - r * 0.38 + flash * 0.9; void dark;
      if (rain.visible) { const c = controls.target; rain.position.set(c.x, 0, c.z); const p = geo.attributes.position.array, base = Math.max(0, c.y - 20); for (let i = 0; i < N; i++) { const j = i * 6, d = vel[i] * dt; p[j + 1] -= d; p[j + 4] -= d; if (p[j + 4] < base - 4) { const x = (Math.random() - 0.5) * SPAN, z = (Math.random() - 0.5) * SPAN, y = base + TOP * (0.7 + Math.random() * 0.3); p[j] = x; p[j + 1] = y; p[j + 2] = z; p[j + 3] = x - 0.7; p[j + 4] = y - 5; p[j + 5] = z - 0.3; } } geo.attributes.position.needsUpdate = true; }
      if (W.storm && r > 0.7) { nextBolt -= dt; if (nextBolt <= 0) { nextBolt = 5 + Math.random() * 13; flash = 0.9; W.bolts++; const c = controls.target, bx = c.x + (Math.random() - 0.5) * 700, bz = c.z + (Math.random() - 0.5) * 700, pts = []; let x = bx, z = bz; for (let y = 260; y > 0; y -= 26) { pts.push(x, y, z); x += (Math.random() - 0.5) * 22; z += (Math.random() - 0.5) * 22; } pts.push(x, 0, z); bolt.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); bolt.visible = true; setTimeout(() => { bolt.visible = false; }, 140); if (W.onThunder) W.onThunder(Math.hypot(bx - c.x, bz - c.z)); } }
      flash = Math.max(0, flash - dt * (flash > 0.45 ? 3 : 2.2)); if (flash > 0.4 && flash < 0.5) flash = 0.85; // a second flicker
      if (mode === 'auto') { nextTornado -= dt; if (nextTornado <= 0 && W.storm && !W.tornado) { W.tornado = place(); nextTornado = 240 + Math.random() * 360; } }
      if (mode === 'tornado' && !W.tornado) W.tornado = place(); // held on: a new one rises as soon as the last has gone
      const T = W.tornado; if (T) { T.age += dt; T.x += Math.cos(T.a) * 7 * dt; T.z += Math.sin(T.a) * 7 * dt; const fade = Math.min(1, T.age / 6, (T.life - T.age) / 8); if (T.age > T.life || land(T.x, T.z) > -25) { W.tornado = null; tor.visible = false; } else { tor.visible = true; tor.position.set(T.x, 0, T.z); rings.forEach((m, i) => { m.rotation.z += dt * (2.4 - i * 0.08); m.material.opacity = 0.72 * Math.max(0, fade); m.position.x = Math.sin(clock * 0.9 + i * 0.5) * i * 0.9; m.position.z = Math.cos(clock * 0.8 + i * 0.4) * i * 0.9; }); spray.material.opacity = 0.45 * Math.max(0, fade); spray.rotation.y += dt * 3; } }
    });
  }
  // ---------- traffic: lane following, junction turns, gaps, routes, shipments ----------
  const cars = [], meshes = {}, stats = { maxJump: 0, maxYawRate: 0, teleports: 0, frames: 0, stuck: 0 };
  const SHIP = []; // the delivery jobs the trucks and vans run: queued → loading → travelling → delivered (or failed)
  function buildTraffic() {
    seed = 3; const plan = [];
    for (const [k, n] of (EXPANDED ? [['compact', 18], ['sedan', 17], ['suv', 11], ['pickup', 7], ['sports', 6]] : [['compact', 10], ['sedan', 9], ['suv', 6], ['pickup', 3]])) for (let i = 0; i < n; i++) plan.push({ type: k });
    plan.push({ type: 'bus', loop: ['A', 'B', 'C', 'D', 'X', 'E', 'F', 'F2', 'G2', 'H2', 'H', 'I'], stops: [['B', 'C', 0.55], ['G2', 'H2', 0.5]] });
    plan.push({ type: 'truck', job: { name: 'Containers → Processing Plant', from: 'K', to: 'P' } }, { type: 'truck', job: { name: 'Crates → Harbour quay', from: 'P', to: 'K' } }, { type: 'truck', job: { name: 'Goods → Delivery depot', from: 'K', to: 'G' } });
    plan.push({ type: 'van', job: { name: 'Groceries → Old Quarter shops', from: 'G', to: 'C' } }, { type: 'van', job: { name: 'Linen → Hotel Azure', from: 'G', to: 'J' } });
    if (EXPANDED) for (const [type, name, from, to] of [['truck', 'Stone → Works estate', 'QU', 'E1'], ['truck', 'Ore → Works estate', 'MN', 'E1'], ['van', 'Supplies → Coral Coast resort', 'G', 'C6'], ['van', 'Goods → Millford market', 'N1', 'G']]) if (nodes[from] && nodes[to]) plan.push({ type, job: { name, from, to } });
    for (const k in VT) { const n = plan.filter(p => p.type === k).length + PARKED.filter(p => p[0] === k).length + (k === 'truck' || k === 'van' || k === 'flatbed' || k === 'tanker' ? 6 : 0), G = vehicleGeo(k), body = new THREE.InstancedMesh(G.body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.1 }), n), fixed = new THREE.InstancedMesh(G.fixed, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), n); body.castShadow = fixed.castShadow = true; body.frustumCulled = fixed.frustumCulled = false; scene.add(body, fixed); meshes[k] = { body, fixed, n: 0, type: k, cap: n }; }
    { let total = 0; for (const k in meshes) { meshes[k].wbase = total; total += meshes[k].cap * VT[k].wheels.length; } const tg = new THREE.CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2).toNonIndexed(), rg = new THREE.CylinderGeometry(0.58, 0.58, 1.04, 8).rotateZ(Math.PI / 2).toNonIndexed(), pos = [], nor = [], col = [];
      for (const [g, c] of [[tg, VCOL.tyre], [rg, VCOL.rim]]) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b); }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); wg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      WHEEL = new THREE.InstancedMesh(wg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), total); WHEEL.castShadow = true; WHEEL.frustumCulled = false; scene.add(WHEEL); }
    const startLanes = lanes.filter(l => l.e.kind !== 'bridge' && l.len > 30), c = new THREE.Color();
    plan.forEach((p, i) => {
      const m = meshes[p.type], car = { i: m.n++, type: p.type, len: VT[p.type].len, vf: VT[p.type].vf * 1.15 * (0.9 + rnd() * 0.2), v: 0, h: 0, pos: new THREE.Vector3(), last: null, wait: 0, stopped: 0, next: null, route: null, loop: p.loop, stops: p.stops, job: p.job };
      m.body.setColorAt(car.i, c.set(pick(VT[p.type].paint)).convertSRGBToLinear());
      if (p.loop) { car.path = laneBetween('A', 'B'); car.s = 10; car.li = 1; }
      else if (p.job) { const ln = nodes[p.job.from].inn.find(l => l.len > 20) || nodes[p.job.from].inn[0]; car.path = ln; car.s = Math.max(0, ln.len - 14 - SHIP.length * 3); car.ship = { name: p.job.name, from: p.job.from, to: p.job.to, status: 'loading', t: 4 + SHIP.length * 3, runs: 0 }; SHIP.push(car.ship); }
      else { car.path = startLanes[Math.floor(rnd() * startLanes.length)]; car.s = rnd() * car.path.len * 0.8; }
      if (car.path.occ.some(o => Math.abs(o.s - car.s) < 14)) car.s = (car.s + 20) % Math.max(1, car.path.len - 2);
      car.path.occ.push(car); cars.push(car);
    });
    for (const [type, x, z, h, y] of PARKED) { const m = meshes[type], i = m.n++; m.body.setColorAt(i, c.set(pick(VT[type].paint)).convertSRGBToLinear()); tmp.position.set(x, (y != null ? y : TOWN_Y) + 0.12, z); tmp.rotation.set(0, h, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); setPose(type, i, tmp.matrix); }
    for (const k of ['truck', 'van', 'flatbed', 'tanker']) { const m = meshes[k]; for (let j = 0; j < 6; j++) { const i = m.n++; SPARE[k].push(i); hide(m, i); m.body.setColorAt(i, c.set(0xffc93c).convertSRGBToLinear()); } }
    for (const k in meshes) if (meshes[k].body.instanceColor) meshes[k].body.instanceColor.needsUpdate = true; // a type with no vehicles here has no colours
    // ---------- traffic lights: the busy junctions of the towns get signals; cars stop on red and go on green, and the poles show the colour ----------
    { const SIG = Object.values(nodes).filter(N => N.deg >= 3 && N.edges.some(e => e.kind === 'town') && N.edges.filter(e => e.kind !== 'bridge').length >= 3); World.signals = SIG.length; World.sigNodes = SIG.map(N => [Math.round(N.x), Math.round(N.z)]);
      const n = SIG.length * 4, pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), new THREE.MeshStandardMaterial({ color: 0x2b3440 }), n), head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }), n), m4 = new THREE.Matrix4(), col = new THREE.Color(), rig = [];
      SIG.forEach((N, k) => { N.sig = { off: hash(N.x, N.z) * 32 }; const r = N.r + 3.4; [[1, 1, 0], [-1, -1, 0], [1, -1, 1], [-1, 1, 1]].forEach(([sx, sz, ax], j) => { const x = N.x + sx * r, z = N.z + sz * r, y = heightAt(x, z), i = k * 4 + j; m4.makeTranslation(x, y + 2.5, z); pole.setMatrixAt(i, m4); m4.makeTranslation(x, y + 5.2, z); head.setMatrixAt(i, m4); head.setColorAt(i, col.setRGB(0, 1, 0)); rig.push([N, ax, i]); }); });
      pole.frustumCulled = head.frustumCulled = false; scene.add(pole, head);
      World.light = N => { const t = (clock + N.sig.off) % 32; return t < 14 ? 0 : t < 16 ? -1 : t < 30 ? 1 : -1; }; // which way may go: 0 north-south, 1 east-west, -1 all red
      let acc = 0; tick.push(dt => { acc += dt; if (acc < 0.5) return; acc = 0; for (const [N, ax, i] of rig) { const L = World.light(N), t = (clock + N.sig.off) % 32, amber = (t >= 12 && t < 14) || (t >= 28 && t < 30); const go = L === ax, c = go ? (amber ? [1, 0.75, 0] : [0.1, 0.9, 0.2]) : [0.95, 0.1, 0.1]; head.setColorAt(i, col.setRGB(c[0], c[1], c[2])); } head.instanceColor.needsUpdate = true; }); }
    tick.push(dt => { if (dt > 0) stepTraffic(Math.min(dt, 0.05)); }); // a zero step (a paused frame) moves nothing
    let pt = 0; tick.push(dt => { pt += dt; if (pt > 1) { pt = 0; startPending(); } });
  }
  // ---------- player shipments: a vehicle from your fleet drives the real route; its arrival is what completes the delivery ----------
  const SPARE = { truck: [], van: [], flatbed: [], tanker: [] }, pending = [];
  function hide(m, i) { tmp.position.set(0, -50, 0); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(0.0001); tmp.updateMatrix(); setPose(m.type, i, tmp.matrix); m.body.instanceMatrix.needsUpdate = m.fixed.instanceMatrix.needsUpdate = WHEEL.instanceMatrix.needsUpdate = true; }
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
  // a delivery: the crates come off the truck, drop to the ground beside the road and are carried in
  const CARGO = [], CR = { mesh: null };
  function dropCargo(car) { if (!CR.mesh) { CR.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1.1, 1.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), 40); CR.mesh.count = 0; CR.mesh.frustumCulled = false; CR.mesh.castShadow = true; scene.add(CR.mesh); tick.push(tickCargo); }
    const h = car.h, sx = Math.cos(h), sz = -Math.sin(h); for (let i = 0; i < 4 && CARGO.length < 40; i++) CARGO.push({ x: car.last.x + sx * (3.2 + (i % 2) * 1.7) + Math.sin(h) * (i > 1 ? -1.8 : 0.4), z: car.last.z + sz * (3.2 + (i % 2) * 1.7) + Math.cos(h) * (i > 1 ? -1.8 : 0.4), y: car.last.y, t: -i * 0.35, c: [0xc8913a, 0xd8a84a, 0xb5651d, 0xe0b45a][i] }); }
  function tickCargo(dt) { const m = CR.mesh, M = new THREE.Matrix4(), col = new THREE.Color(); let n = 0; for (let i = CARGO.length - 1; i >= 0; i--) { if (CARGO[i].t > 5.5) CARGO.splice(i, 1); } for (const c of CARGO) { c.t += dt; if (c.t < 0) continue; const drop = Math.min(1, c.t / 1.1), lift = c.t > 4 ? Math.min(1, (c.t - 4) / 1.2) : 0, y = c.y + 2.6 * (1 - drop * drop) + 0.55 + lift * 3, sc = 1 - lift; M.compose(new THREE.Vector3(c.x, y, c.z), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc)); m.setMatrixAt(n, M); m.setColorAt(n, col.set(c.c)); n++; } m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
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
        if (N.sig && !stopsHere) { if (path.ax === undefined) { poseAt(path, Math.max(0, path.len - 4), _a); poseAt(path, path.len, _b); path.ax = Math.abs(_b.x - _a.x) > Math.abs(_b.z - _a.z) ? 1 : 0; } if (World.light(N) !== path.ax && rem > car.v * car.v / 7 + 1.8) vt = Math.min(vt, Math.sqrt(2 * 3.5 * Math.max(0, rem - 1.6))); }
        if (car.ship && car.ship.status === 'travelling' && N.id === car.ship.to) vt = Math.min(vt, Math.sqrt(2 * 3 * Math.max(0, rem - 3)));
        if (car.stops && !car.stopped) for (const [u, v, f] of car.stops) if (path.from.id === u && path.to.id === v) { const d = path.len * f - car.s; if (d > -0.5 && d < 40) vt = Math.min(vt, Math.sqrt(2 * 2.5 * Math.max(0, d))); if (Math.abs(d) < 0.6 && car.v < 0.3) car.stopped = 5; }
      }
      if (car.stopped > 0) { car.stopped -= dt; vt = 0; if (car.stopped <= 0) car.stopped = -1; }
      if (car.ship && car.ship.status === 'travelling' && path.kind === 'lane' && path.to.id === car.ship.to && rem < 3.5 && car.v < 0.4) { car.ship.status = 'delivered'; dropCargo(car); car.ship.runs++; car.ship.t = 5; car.ship.at = performance.now(); if (car.player) { gone.push(car); continue; } }
      if (car.player) { car.player.status = car.ship.status; car.player.why = car.ship.why || ''; car.odo = (car.odo || 0) + car.v * dt; }
      if (sh && sh.status === 'delivered') { vt = 0; sh.t -= dt; if (sh.t <= 0) { [sh.from, sh.to] = [sh.to, sh.from]; sh.status = 'loading'; sh.t = 3; car.route = null; } } // unload, then load the return trip
      const [gap] = leaderGap(car); vt = Math.min(vt, Math.max(0, (gap - 2.2) / 1.1));
      car.v += clamp(vt - car.v, -7 * dt, 2.2 * dt); if (car.v < 0) car.v = 0;
      car.s += car.v * dt;
      // move on to the next piece of road; the pieces join exactly, so nothing jumps
      while (car.s > car.path.len) {
        const over = car.s - car.path.len, from = car.path; from.occ.splice(from.occ.indexOf(car), 1);
        if (from.kind === 'lane') { car.path = car.conn; } else { if (from.node.busy === car) from.node.busy = null; car.path = from.to; car.conn = null; if (car.stopped < 0) car.stopped = 0; }
        if (!car.path) { stats.recovered = (stats.recovered || 0) + 1; const pool = lanes.filter(l => l.e.kind !== 'bridge' && l.len > 30); car.path = (car.next && car.next.kind === 'lane' ? car.next : pool[Math.floor(rnd() * pool.length)]); car.conn = null; car.route = null; car.s = 0; car.last = null; }
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
      const yr = dh * Math.min(1, dt * 12) / Math.max(dt, 1e-3), st = clamp(Math.atan(yr * car.len * 0.62 / Math.max(car.v, 1.5)), -0.5, 0.5); car.steer = (car.steer || 0) + (st - (car.steer || 0)) * Math.min(1, dt * 8); car.roll = (car.roll || 0) + car.v * dt;
      setPose(car.type, car.i, tmp.matrix, car.roll, car.steer);
    }
    for (const car of gone) { const h = car.player; despawn(car); h.status = 'delivered'; if (h.o.onArrive) h.o.onArrive(h); }
    stats.stuck = cars.filter(c => c.wait > 25 && !(c.ship && c.ship.status !== 'travelling') && !(c.stopped > 0)).length;
    for (const k in meshes) { meshes[k].body.instanceMatrix.needsUpdate = true; meshes[k].fixed.instanceMatrix.needsUpdate = true; } WHEEL.instanceMatrix.needsUpdate = true;
  }
  // ---------- people: a few dozen with somewhere to go. Each walks the network to a front door, the square, the market, the
  // park, the beach or (on match days, mostly) the stadium, crossing only at the zebras, pauses there, then sets off again ----------
  let people = null; const WALKERS = [];
  function wroute(a, b) { // the shortest walk between two vertices, as [link, forwards] steps
    if (a === b) return []; const g = new Map([[a, 0]]), from = new Map(), open = [[0, a]], done = new Set();
    while (open.length) { let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i; const [, u] = open.splice(bi, 1)[0]; if (u === b) break; if (done.has(u)) continue; done.add(u);
      for (const L of u.adj) { const v = L.a === u ? L.b : L.a, ng = g.get(u) + L.len; if (ng < (g.has(v) ? g.get(v) : 1e9)) { g.set(v, ng); from.set(v, [u, L]); open.push([ng + Math.hypot(v.x - b.x, v.z - b.z), v]); } } }
    if (!from.has(b)) return null; const out = []; for (let v = b; v !== a; ) { const [u, L] = from.get(v); out.unshift([L, L.a === u]); v = u; } return out;
  }
  const WANT = { shophouse: 3, kiosk: 2, square: 3, market: 3, park: 2, beach: 3, hotel: 1, flat: 1.5, house: 1, tower: 1.5, office: 1, civic: 1, cityhall: 1, stadium: 1 };
  function nextStop(w) { const match = EVENT.match, list = POI.filter(p => p.v !== w.at), tot = list.reduce((a, p) => a + (p.kind === 'stadium' && match ? 14 : WANT[p.kind] || 0.5), 0); let r = rnd() * tot; for (const p of list) { r -= p.kind === 'stadium' && match ? 14 : WANT[p.kind] || 0.5; if (r <= 0) return p; } return list[0]; }
  function plan(w) { for (let t = 0; t < 6; t++) { const p = nextStop(w), r = wroute(w.at, p.v); if (r && r.length) { w.legs = r; w.k = 0; w.s = 0; w.to = p; return true; } } w.dwell = 5; return false; }
  function buildPeople() {
    seed = 23; const main = new Set(); { const big = POI.find(p => p.kind === 'square'); if (big) { const st = [big.v]; main.add(big.v); while (st.length) { const u = st.pop(); for (const L of u.adj) { const v = L.a === u ? L.b : L.a; if (!main.has(v)) { main.add(v); st.push(v); } } } } }
    for (let i = POI.length - 1; i >= 0; i--) if (!main.has(POI[i].v)) POI.splice(i, 1); // only places joined to the town's network
    const N = Q === 'low' ? 40 : 80;
    for (let i = 0; i < N && POI.length > 2; i++) { const w = { at: POI[Math.floor(rnd() * POI.length)].v, sp: 1.05 + rnd() * 0.45, off: (rnd() - 0.5) * 0.8, ph: rnd() * 6, dwell: rnd() * 12, pos: new THREE.Vector3(), h: 0 }; w.pos.set(w.at.x, w.at.y, w.at.z); WALKERS.push(w); }
    const geo = parts => { const pos = [], nor = []; for (const g0 of parts) { const g = g0.toNonIndexed(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g; };
    const torso = geo([new THREE.CylinderGeometry(0.2, 0.25, 0.75, 7).translate(0, 1.22, 0), new THREE.BoxGeometry(0.12, 0.62, 0.14).translate(-0.29, 1.2, 0), new THREE.BoxGeometry(0.12, 0.62, 0.14).translate(0.29, 1.2, 0)]);
    const head = geo([new THREE.SphereGeometry(0.17, 8, 6).translate(0, 1.78, 0), new THREE.SphereGeometry(0.18, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.82, -0.01)]), leg = geo([new THREE.BoxGeometry(0.17, 0.86, 0.2).translate(0, -0.43, 0)]);
    const mk = (g, n) => { const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.8 }), n); m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; }, c = new THREE.Color();
    people = { body: mk(torso, WALKERS.length), head: mk(head, WALKERS.length), legs: mk(leg, WALKERS.length * 2), t: 0 };
    WALKERS.forEach((w, i) => { people.body.setColorAt(i, c.set(pick([0xe8483f, 0x2e74c9, 0xf2b705, 0x1f8f5b, 0xffffff, 0xff8fb1, 0x8a4fd6, 0x2fb7c4])).convertSRGBToLinear()); people.head.setColorAt(i, c.set(pick([0xf0c8a0, 0xd9a77a, 0xa8754e, 0x7a5236, 0xf5d5b8])).convertSRGBToLinear()); const tr = pick([0x2b3440, 0x3a4f7a, 0x5a4a3a, 0x24282e, 0xd8cdb8]); for (const k of [0, 1]) people.legs.setColorAt(i * 2 + k, c.set(tr).convertSRGBToLinear()); });
    tick.push(dt => stepPeople(Math.min(dt, 0.1)));
  }
  const _l = new THREE.Matrix4(), _lr = new THREE.Matrix4();
  function stepPeople(dt) {
    if (!people || !dt) return; people.t += dt; const far = camDist > 700; // far out they still move, drawn less often
    WALKERS.forEach((w, i) => {
      let moving = false;
      if (w.dwell > 0) { w.dwell -= dt; if (w.dwell <= 0 && !plan(w)) w.dwell = 4; }
      else if (w.legs) { w.s += w.sp * dt; while (w.legs && w.s > w.legs[w.k][0].len) { w.s -= w.legs[w.k][0].len; w.k++; if (w.k >= w.legs.length) { w.at = w.to.v; w.legs = null; w.dwell = 5 + rnd() * 18; } }
        if (w.legs) { const [L, fw] = w.legs[w.k], s = fw ? w.s : L.len - w.s; poseAt(L, Math.max(0, Math.min(L.len, s)), _p); poseAt(L, Math.max(0, Math.min(L.len, s + (fw ? 0.6 : -0.6))), _b); const h = Math.atan2(_b.x - _p.x, _b.z - _p.z), off = L.kind === 'cross' ? 0 : w.off;
          w.pos.set(_p.x + Math.cos(h) * off, _p.y, _p.z - Math.sin(h) * off); w.h += Math.atan2(Math.sin(h - w.h), Math.cos(h - w.h)) * Math.min(1, dt * 8); moving = true; } }
      if (far && i % 3) return;
      const sw = moving ? Math.sin(people.t * w.sp * 6.5 + w.ph) * 0.55 : 0;
      tmp.position.copy(w.pos); tmp.rotation.set(0, w.h, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); people.body.setMatrixAt(i, tmp.matrix); people.head.setMatrixAt(i, tmp.matrix);
      for (const k of [0, 1]) { _l.copy(tmp.matrix).multiply(_lr.makeTranslation(k ? 0.11 : -0.11, 0.86, 0)).multiply(_lr.makeRotationX(k ? sw : -sw)); people.legs.setMatrixAt(i * 2 + k, _l); }
    });
    people.body.instanceMatrix.needsUpdate = people.head.instanceMatrix.needsUpdate = people.legs.instanceMatrix.needsUpdate = true;
  }
  // ---------- other players: a pin in their colour where they are on the island, with a ring under it (the name label is the app's) ----------
  let pins = null;
  function players(list) {
    if (!pins) { pins = { cone: new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 5, 16).rotateX(Math.PI).translate(0, 2.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: lin(0x222222) }), 16), ring: new THREE.InstancedMesh(new THREE.RingGeometry(3, 3.8, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }), 16) }; for (const m of [pins.cone, pins.ring]) { m.frustumCulled = false; m.count = 0; scene.add(m); } const c0 = new THREE.Color(1, 1, 1); for (let i = 0; i < 16; i++) { pins.cone.setColorAt(i, c0); pins.ring.setColorAt(i, c0); } }
    const c = new THREE.Color(), n = Math.min(16, list.length), bob = Math.sin(clock * 3) * 0.6;
    for (let i = 0; i < n; i++) { const p = list[i], y = heightAt(p.x, p.z); tmp.rotation.set(0, clock, 0); tmp.scale.setScalar(1); tmp.position.set(p.x, y + 10 + bob, p.z); tmp.updateMatrix(); pins.cone.setMatrixAt(i, tmp.matrix); tmp.rotation.set(0, 0, 0); tmp.position.set(p.x, y + 0.4, p.z); tmp.updateMatrix(); pins.ring.setMatrixAt(i, tmp.matrix); c.set(p.color || '#4c8dff').convertSRGBToLinear(); pins.cone.setColorAt(i, c); pins.ring.setColorAt(i, c); }
    pins.cone.count = pins.ring.count = n; for (const m of [pins.cone, pins.ring]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    return list.slice(0, n).map(p => ({ x: p.x, y: heightAt(p.x, p.z) + 16, z: p.z }));
  }

  // ---------- each frame ----------
  const SUN = new THREE.Vector3(-0.5, 0.68, 0.53).normalize();
  function frame(dt) {
    clock += dt; adapt(dt); controls.update();
    const t = controls.target; if (!fly) { if (EXPANDED) { t.x = clamp(t.x, X0 + 80, X1 - 80); t.z = clamp(t.z, Z0 + 80, Z1 - 80); } else { t.x = clamp(t.x, -620, 620); t.z = clamp(t.z, -470, 280); } } if (EXPANDED) t.y += (clamp(heightAt(t.x, t.z), TOWN_Y, 400) - t.y) * Math.min(1, dt * 3); else t.y = TOWN_Y; // on the bigger island the view rises with the ground
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
  const overview = () => EXPANDED ? view(620, 470, fit(5800), 0.5, 0.3) : view(-20, -90, fit(1350), 0.6, 0.3);
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

  // ---------- checks: the trees, the network, every route to the harbour both ways, and a probe drive along each ----------
  function treeReport() { // every planted tree against the streets, footpaths, buildings, water and the ground it stands on
    const bad = { onRoad: [], onKerb: [], onPath: [], inBuilding: [], inWater: [], floating: [], buried: [], crowded: [], atDoor: [] }, big = [], cell = new Map(); let total = 0;
    for (const k in TREES) for (const t of TREES[k]) {
      const [x, y, z, , st] = t, small = k === 'flower' || k === 'bush', street = st === 'street', say = k + ' ' + Math.round(x) + ',' + Math.round(z), g = heightAt(x, z); total++;
      if (paved(x, z)) bad.onRoad.push(say); else if (!small && !street && nearRoad(x, z)[0] < 1.2) bad.onKerb.push(say);
      if (!street && wnear(x, z, small ? 0.5 : 1.1)) bad.onPath.push(say);
      if (inside(x, z, small ? 0 : 0.6)) bad.inBuilding.push(say);
      if (land(x, z) < 1.5 || g < 0.2) bad.inWater.push(say);
      if (y - g > 0.7) bad.floating.push(say + ' +' + (y - g).toFixed(1)); else if (g - y > 0.9) bad.buried.push(say + ' -' + (g - y).toFixed(1));
      if (!small) { const key = Math.floor(x / 3) + ',' + Math.floor(z / 3); cell.set(key, (cell.get(key) || []).concat(big.length)); big.push(t); if (buildings.some(b => b.door && Math.hypot(b.door.x - x, b.door.z - z) < 1.6)) bad.atDoor.push(say); }
    }
    big.forEach((t, i) => { const a = Math.floor(t[0] / 3), b = Math.floor(t[2] / 3); for (let p = -1; p <= 1; p++) for (let q = -1; q <= 1; q++) for (const j of cell.get((a + p) + ',' + (b + q)) || []) if (j > i && Math.hypot(big[j][0] - t[0], big[j][2] - t[2]) < 1.5) bad.crowded.push(Math.round(t[0]) + ',' + Math.round(t[2])); });
    const out = { trees: total, leftOut: LEFT_OUT }; for (const k in bad) { out[k] = bad[k].length; out[k + 'Eg'] = bad[k].slice(0, 14); } return out;
  }
  function roadReport() {
    const seen = new Set(['K']), stack = ['K']; while (stack.length) { const u = stack.pop(); for (const e of nodes[u].edges) { const v = e.a.id === u ? e.b.id : e.a.id; if (!seen.has(v)) { seen.add(v); stack.push(v); } } }
    let wet = 0, maxSlope = 0; for (const e of edges) for (let i = 0; i < e.pts.length; i++) { const p = e.pts[i]; if (e.kind !== 'bridge' && land(p[0], p[2]) < 1) wet++; if (i) { const q = e.pts[i - 1]; maxSlope = Math.max(maxSlope, Math.abs(p[1] - q[1]) / (Math.hypot(p[0] - q[0], p[2] - q[2]) || 1)); } }
    const clash = buildings.filter(b => { const c = Math.cos(b.rot), s = Math.sin(b.rot); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const lx = i / 4 * b.w * 0.95, lz = j / 4 * b.d * 0.95; if (nearRoad(b.x + lx * c + lz * s, b.z - lx * s + lz * c)[0] < -0.3) return true; } return false; }).map(b => b.name);
    return { nodes: Object.keys(nodes).length, edges: edges.length, connected: seen.size === Object.keys(nodes).length, deadEnds: Object.values(nodes).filter(n => n.deg === 1).map(n => `${n.id} (turning circle r=${n.r} m)`), roadPointsOverWater: wet, maxGrade: +(maxSlope * 100).toFixed(1) + '%', buildingsOnRoads: clash };
  }
  function probe(r) { // drive the route's lanes and connectors at speed and measure every step
    const pieces = []; for (let i = 0; i + 1 < r.length; i++) { const ln = laneBetween(r[i], r[i + 1]); if (!ln) return { ok: false, why: `no lane ${r[i]}→${r[i + 1]}` }; if (pieces.length) pieces.push(connector(pieces[pieces.length - 1], ln)); pieces.push(ln); }
    let maxJump = 0, maxTurn = 0, wet = 0, last = null, lastH = null, len = 0, worst = null, ratio = 0, vPrev = 0, offRoad = 0, offAt = null; const dt = 1 / 60;
    const all = makePath(pieces.flatMap((q, i) => i ? q.pts.slice(1) : q.pts)); let base = 0; /* the whole drive as one joined line, steered 2.5 m ahead like the cars */
    for (const p of pieces) { const v = Math.min(13, p.vmax); len += p.len; for (let s = 0; s <= p.len; s += v * dt) { poseAt(p, s, _p); poseAt(all, Math.min(all.len, base + s + 2.5), _b); const h = Math.atan2(_b.x - _p.x, _b.z - _p.z); if (last) { maxJump = Math.max(maxJump, last.distanceTo(_p)); ratio = Math.max(ratio, last.distanceTo(_p) / (Math.max(v, vPrev) * dt)); const tr = Math.abs(Math.atan2(Math.sin(h - lastH), Math.cos(h - lastH))) / dt; if (tr > maxTurn) { maxTurn = tr; worst = { kind: p.kind, s: +s.toFixed(2), len: +p.len.toFixed(2), at: p.kind === 'lane' ? p.from.id + '>' + p.to.id : p.node.id }; } } if (!(p.kind === 'lane' && p.e.kind === 'bridge') && land(_p.x, _p.z) < 0.5 && !(p.kind === 'conn' && p.node.edges.some(e => e.kind === 'bridge'))) wet++; last = (last || new THREE.Vector3()).copy(_p); lastH = h; vPrev = v; } base += p.len; }
    for (const p of pieces) for (let s = 0; s <= p.len; s += 1) { poseAt(p, s, _p); poseAt(p, Math.min(p.len, s + 0.5), _b); const h = Math.atan2(_b.x - _p.x, _b.z - _p.z), cx = Math.cos(h), sx = -Math.sin(h); for (const o of [0, -1.1, 1.1]) if (!paved(_p.x + cx * o, _p.z + sx * o)) { offRoad++; offAt = offAt || { at: p.kind === 'lane' ? p.from.id + '>' + p.to.id : p.node.id, kind: p.kind, s, side: o }; } }
    return { ok: ratio < 1.6 && maxTurn < 3 && wet === 0 && offRoad === 0, length: Math.round(len), maxStepRatio: +ratio.toFixed(2), maxTurnRate: +maxTurn.toFixed(2), overWater: wet, offRoad, offAt, worst };
  }
  function routeTest() {
    const places = { 'Beachfront (hotel)': 'J', 'Old Quarter (shops)': 'C', 'Old Quarter (High St)': 'H', 'Business Centre': 'G2', 'Stadium car park': 'SP', 'Greenfields co-op': 'FA', 'Greenfields west yard': 'FB', 'Greenfields north yard': 'FC', 'Villa Point': 'V4', 'Marina': 'MQ', 'Industrial Isle (plant)': 'P', 'Industrial Isle (far side)': 'R' }, out = [];
    for (const [name, id] of Object.entries(places)) for (const [a, b, dir] of [[id, 'K', 'to harbour'], ['K', id, 'from harbour']]) { const r = route(a, b); out.push(Object.assign({ route: `${name} ${dir}`, path: r ? r.join('→') : null }, r ? probe(r) : { ok: false, why: 'no route' })); }
    for (const [a, b] of [['L', 'O'], ['O', 'L']]) { const r = route(a, b); out.push(Object.assign({ route: `Bridge ${a === 'L' ? 'eastbound' : 'westbound'}`, path: r && r.join('→') }, probe(r))); }
    return out;
  }
  function setClosed(edgeKind, closed) { // close or reopen a road; vehicles already planning to use it re-plan or wait
    for (const e of edges) if (e.kind === edgeKind && !(e.opt && e.opt.style)) e.closed = closed;
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
  function eventState(o) { if (EVENT.crowd) EVENT.crowd.visible = !!o.match; const f = MATS && MATS.flood; if (f) f.color.set(o.match ? 0xffffff : 0x8a8f96); EVENT.match = !!o.match; } // match day: the crowd in the stands and the floodlights on
  return { signs: { SIGNS, SIGNC }, regions: REGION_BUILDERS, players, farm: farmState, event: eventState, access: ACCESS, works: WORKS, walk: WG, POI, simulate, dispatch, routeInfo, SPARE, init: async (c, q, progress) => { await init(c, q, progress); buildPeople(); }, step, frame, place, view, flyTo, current, overview, viewOf, homeView, pickAt, mark, photo, buildings, LABELS, nodes, edges, cars, SHIP, stats, roadReport, treeReport, routeTest, setClosed, colourReport, route, land, heightAt,
    get ground() { return GR; }, get trees() { return TREES; }, get camera() { return camera; }, get renderer() { return renderer; }, get scene() { return scene; }, get controls() { return controls; }, get flying() { return !!fly; }, get dist() { return camDist; }, get pixelRatio() { return renderer.getPixelRatio(); }, get pixelRatioMax() { return pxMax; } };
})();
