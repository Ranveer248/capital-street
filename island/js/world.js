// Capital Island (Goal 32, checkpoint 2). One designed main island and three smaller islands that are built the first
// time you travel to them. Everything is generated here from the hand-made layout below: no map data, no outside models.
// Rendering rules that keep it clean and steady:
//  - one ground mesh, roads raised above it with a polygon offset: no coplanar layers fighting for depth
//  - near/far planes follow the camera, so depth precision stays high
//  - real multisampling, mipmapped facade textures (windows blend into walls at a distance instead of shimmering)
//  - a sun shadow box sized to what you see and snapped to its texels, so shadows don't swim while the camera moves
//  - merged buildings and instanced trees are split into map tiles, so the camera only draws the tiles it can see
//  - small details fade out with distance instead of popping
'use strict';
window.World = (function () {
  const lin = c => new THREE.Color(c).convertSRGBToLinear();
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const GROUND = 3; // the height towns are built at
  let Q = 'high';

  // ---------- the coastline: a smooth closed curve through hand-placed points ----------
  const MAIN = [[-760, -60], [-725, -300], [-560, -470], [-260, -540], [40, -515], [330, -555], [565, -430], [700, -220], [735, 40], [705, 255], [612, 405], [440, 468], [306, 430], [262, 352], [200, 336], [120, 340], [40, 342], [-40, 346], [-112, 362], [-168, 440], [-330, 476], [-522, 432], [-684, 300], [-762, 128]];
  function curve(ctrl, per) {
    const out = [], n = ctrl.length;
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    return out;
  }
  const coast = curve(MAIN, 16);
  const ISLET = { x: 566, z: 588, r: 56 }; // Lighthouse Point, joined by a bridge
  // signed distance to the coast, fast: segments are sorted into 64 m cells (for distance) and 8 m bands (for inside/outside),
  // so a query looks at a handful of segments instead of all of them. Distances are exact up to 320 m, clamped beyond.
  function fastSD(P, RMAX = 320, CELL = 64, BAND = 8) {
    const n = P.length, segs = [];
    for (let i = 0, j = n - 1; i < n; j = i++) segs.push([P[j][0], P[j][1], P[i][0], P[i][1]]);
    const X0 = -1400, Z0 = -1400, NC = Math.ceil(2800 / CELL), cells = Array.from({ length: NC * NC }, () => []), bands = new Map();
    const segDist = (s, x, z) => { const ex = s[2] - s[0], ez = s[3] - s[1], t = clamp(((x - s[0]) * ex + (z - s[1]) * ez) / (ex * ex + ez * ez || 1), 0, 1); return Math.hypot(s[0] + t * ex - x, s[1] + t * ez - z); };
    segs.forEach((s, k) => {
      const r = RMAX + CELL * 0.71, ci0 = Math.max(0, Math.floor((Math.min(s[0], s[2]) - r - X0) / CELL)), ci1 = Math.min(NC - 1, Math.floor((Math.max(s[0], s[2]) + r - X0) / CELL)), cj0 = Math.max(0, Math.floor((Math.min(s[1], s[3]) - r - Z0) / CELL)), cj1 = Math.min(NC - 1, Math.floor((Math.max(s[1], s[3]) + r - Z0) / CELL));
      for (let j = cj0; j <= cj1; j++) for (let i = ci0; i <= ci1; i++) if (segDist(s, X0 + (i + 0.5) * CELL, Z0 + (j + 0.5) * CELL) < r) cells[j * NC + i].push(k);
      for (let b = Math.floor(Math.min(s[1], s[3]) / BAND); b <= Math.floor(Math.max(s[1], s[3]) / BAND); b++) { if (!bands.has(b)) bands.set(b, []); bands.get(b).push(k); }
    });
    return (x, z) => {
      const ci = Math.floor((x - X0) / CELL), cj = Math.floor((z - Z0) / CELL), list = ci >= 0 && cj >= 0 && ci < NC && cj < NC ? cells[cj * NC + ci] : [];
      let d = RMAX; for (const k of list) d = Math.min(d, segDist(segs[k], x, z));
      let inside = false; for (const k of bands.get(Math.floor(z / BAND)) || []) { const s = segs[k]; if ((s[1] > z) !== (s[3] > z) && x < s[0] + (z - s[1]) / (s[3] - s[1]) * (s[2] - s[0])) inside = !inside; }
      return inside ? d : -d;
    };
  }
  const coastSD = fastSD(coast);
  const land = (x, z) => Math.max(coastSD(x, z), ISLET.r - Math.hypot(x - ISLET.x, z - ISLET.z));

  // ---------- the other islands: a wavy circle each, far enough out to be their own trip ----------
  const ISLES = [
    { id: 'pine', name: 'Pine Isle', x: -2350, z: -950, R: 300, a1: 0.13, a2: 0.07, p1: 1.1, p2: 2.3, kind: 'forest', blurb: 'Pine forest, a logging camp and a small port. Timber is cheapest to cut here.' },
    { id: 'coral', name: 'Coral Key', x: 2250, z: 1050, R: 270, a1: 0.11, a2: 0.08, p1: 0.4, p2: 4.1, kind: 'resort', blurb: 'Beaches, hotels and the builders who pay the most for timber.' },
    { id: 'gull', name: 'Gull Rock', x: -1150, z: 1650, R: 150, a1: 0.14, a2: 0.06, p1: 2.2, p2: 0.7, kind: 'private', blurb: 'A small island for sale. Buy it and build your own estate.' },
  ];
  const isleR = (I, x, z) => { const th = Math.atan2(z - I.z, x - I.x); return I.R * (1 + I.a1 * Math.sin(3 * th + I.p1) + I.a2 * Math.sin(5 * th + I.p2)); };
  const isleSD = (I, x, z) => isleR(I, x, z) - Math.hypot(x - I.x, z - I.z);

  // ---------- districts: flat ground where towns stand ----------
  const ZONES = [
    { id: 'centre', name: 'Capital Centre', x0: -190, x1: 180, z0: -250, z1: 125 },
    { id: 'oldtown', name: 'Old Town', x0: 170, x1: 575, z0: -265, z1: 300 },
    { id: 'northgate', name: 'Northgate', x0: 170, x1: 525, z0: -428, z1: -265 },
    { id: 'harbour', name: 'Harbourside', x0: -210, x1: 300, z0: 110, z1: 336 },
    { id: 'marina', name: 'Marina Park', x0: 290, x1: 590, z0: 300, z1: 428 },
    { id: 'hillcrest', name: 'Hillcrest', x0: -530, x1: -170, z0: 300, z1: 428 },
    { id: 'farms', name: 'Greenfields', x0: -690, x1: -250, z0: -70, z1: 300 },
    { id: 'golf', name: 'Capital Links', x0: -480, x1: -205, z0: -255, z1: -85 },
    { id: 'mill', name: 'Pine Ridge Mill', x0: -120, x1: 120, z0: -430, z1: -240 },
    { id: 'beach', name: 'Sunny Beach', x0: 575, x1: 700, z0: -190, z1: 360 },
  ];
  const TOWN = new Set(['centre', 'oldtown', 'northgate', 'harbour', 'marina', 'hillcrest', 'beach']);
  const zoneAt = (x, z) => ZONES.find(Z => x >= Z.x0 && x <= Z.x1 && z >= Z.z0 && z <= Z.z1);
  const flatMask = (x, z) => { let m = 0; for (const Z of ZONES) { const dx = Math.max(Z.x0 - x, 0, x - Z.x1), dz = Math.max(Z.z0 - z, 0, z - Z.z1); m = Math.max(m, 1 - smooth(0, 70, Math.hypot(dx, dz))); } return m; };

  // ---------- roads: nodes and the streets between them ----------
  const R = []; // { a:[x,z], b:[x,z], w, kind }
  const road = (a, b, w = 9, kind = 'street') => R.push({ a, b, w, kind });
  // Capital Avenue, east to west across the island
  road([-640, 100], [-250, 100], 12, 'avenue'); road([-250, 100], [600, 100], 12, 'avenue');
  // the business grid
  for (const x of [-160, -80, 0, 80, 160]) road([x, -220], [x, 100]);
  for (const z of [-220, -140, -60, 20]) road([-160, z], [160, z]);
  // Old Town, and Northgate up the hill behind it
  for (const x of [240, 320, 400, 480]) road([x, -240], [x, 260], 8);
  for (const z of [-240, -160, -80, 20, 180, 260]) road([160, z], [560, z], 8);
  road([160, -240], [160, -220], 8);
  for (const x of [240, 320, 400, 480]) road([x, -400], [x, -240], 8);
  road([240, -320], [480, -320], 8); road([200, -400], [520, -400], 8);
  // the beach road and the bridge to Lighthouse Point
  road([560, -240], [600, -150], 8); road([600, -150], [600, 340], 8); road([560, 260], [600, 260], 8); road([560, 180], [600, 180], 8); road([560, -80], [600, -80], 8);
  road([600, 340], [566, 420], 8); road([566, 420], [566, 545], 8, 'bridge');
  // Marina Park promenade
  road([320, 260], [320, 330], 8); road([320, 330], [600, 330], 9);
  // Harbourside
  road([-100, 100], [-100, 300], 9); road([60, 100], [60, 300], 9); road([200, 100], [200, 300], 9);
  road([-100, 300], [240, 300], 10, 'quay'); road([240, 260], [240, 300], 8);
  // Hillcrest, the suburb by the south-west bay
  road([-250, 100], [-250, 330], 8); road([-520, 330], [-180, 330], 8); road([-480, 390], [-200, 390], 8);
  road([-430, 290], [-430, 390], 7); road([-330, 330], [-330, 390], 8); road([-200, 330], [-200, 390], 8);
  // Greenfields lanes, each ending at a farm
  road([-430, 100], [-430, 290], 7, 'lane'); road([-580, 100], [-580, 250], 7, 'lane'); road([-430, 100], [-430, -20], 7, 'lane'); road([-560, 230], [-450, 230], 7, 'lane');
  // the golf club and the timber mill
  road([-250, 100], [-250, -110], 8);
  road([0, -220], [0, -400], 9);
  const segD = (x, z, s) => { const [ax, az] = s.a, [bx, bz] = s.b, ex = bx - ax, ez = bz - az, t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1), 0, 1); return Math.hypot(ax + t * ex - x, az + t * ez - z); };
  const roadDistIn = list => (x, z) => { let d = 1e9; for (const s of list) if (s.kind !== 'bridge') d = Math.min(d, segD(x, z, s) - s.w / 2); return d; };
  const roadDist = roadDistIn(R);
  let landF = land, roadF = roadDist; // what placement checks against: the main island, or the island being built

  // ---------- terrain height ----------
  const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const fbm = (x, z) => vnoise(x / 260, z / 260) * 0.6 + vnoise(x / 110, z / 110) * 0.28 + vnoise(x / 45, z / 45) * 0.12;
  function heightAt(x, z, s = land(x, z)) {
    if (s < 0) return Math.max(-9, s * 0.14) - 0.6; // the sea floor
    const beach = -0.35 + smooth(0, 30, s) * (GROUND + 0.35); // the beach climbs out of the water at a clear angle
    const north = smooth(-150, -380, z) * 0.9 + smooth(-380, -700, x) * 0.6; // hills in the north and west
    const hill = (fbm(x, z) - 0.35) * 95 * clamp(north, 0, 1) + fbm(x + 999, z) * 6;
    const wild = smooth(30, 140, s) * (1 - flatMask(x, z)) * smooth(10, 42, roadDist(x, z)); // flat under towns and along every road
    return beach + Math.max(0, hill) * wild;
  }

  // ---------- the scene ----------
  let renderer, scene, camera, controls, sun, ocean, sky, clouds, clock = 0, camDist = 500;
  const fadeMats = []; // materials that fade out with distance: [material, near, far]
  const buildings = []; // { id, type, name, x, z, w, d, h, rot, floors, district, isle }
  const tick = [];
  const extraTrees = [], noTrees = [], parked = [], turbines = [];
  function init(canvas, q) {
    Q = q || 'high';
    renderer = new THREE.WebGLRenderer({ canvas, antialias: Q !== 'low', powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, Q === 'low' ? 1 : Q === 'medium' ? 1.5 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = Q !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    const HORIZON = 0xcfeaf6;
    scene.fog = new THREE.Fog(lin(HORIZON), 1500, 5000);
    camera = new THREE.PerspectiveCamera(36, 1, 1, 6000);
    controls = new THREE.MapControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.1; controls.screenSpacePanning = false;
    controls.minDistance = 28; controls.maxDistance = 1750; controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.12;
    // light: a bright sky, a warm sun, a cool bounce from below so shaded walls stay colourful
    scene.add(new THREE.HemisphereLight(lin(0xd6ecff), lin(0x8aa36a), 1.0));
    sun = new THREE.DirectionalLight(lin(0xffeccc), 2.35);
    sun.castShadow = Q !== 'low';
    sun.shadow.mapSize.setScalar(Q === 'high' ? 2048 : 1024);
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.6;
    scene.add(sun, sun.target);
    ISLES.forEach(defineIsle);
    World.times = {};
    for (const [k, f] of [['sky', () => buildSky(HORIZON)], ['terrain', buildTerrain], ['ocean', buildOcean], ['roads', () => buildRoads(R, scene, (s) => { const z = zoneAt((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2); return !!z && TOWN.has(z.id) && s.kind !== 'lane'; })],
      ['town', buildTown], ['harbour', buildHarbour], ['farms', () => { buildFarms(); buildGolf(); buildMarina(); flush(); }], ['nature', buildNature], ['islands', () => ISLES.forEach(silhouette)], ['life', buildLife]]) {
      const t0 = performance.now(); f(); World.times[k] = Math.round(performance.now() - t0); // how long each part takes, for measuring
    }
    resize(); addEventListener('resize', resize);
  }
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  function buildSky(horizon) {
    const g = new THREE.SphereGeometry(1, 32, 16);
    sky = new THREE.Mesh(g, new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: lin(0x3f93e4) }, mid: { value: lin(horizon) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, mid; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(mid, top, smoothstep(0.0, 0.5, h)), 1.0); }' }));
    sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
    // soft clouds, high above the island: seen from far away, gone when you zoom in
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.9, flatShading: true, depthWrite: false }), geo = new THREE.IcosahedronGeometry(1, 1);
    clouds = new THREE.Group(); seed = 77;
    for (let i = 0; i < 22; i++) {
      const c = new THREE.Group(), n = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) { const m = new THREE.Mesh(geo, mat); m.position.set((k - n / 2) * 15 + rnd() * 6, rnd() * 6, rnd() * 10 - 5); m.scale.set(13 + rnd() * 10, 7 + rnd() * 5, 11 + rnd() * 6); c.add(m); }
      c.position.set(-2000 + rnd() * 4000, 250 + rnd() * 90, -1500 + rnd() * 3000); clouds.add(c);
    }
    scene.add(clouds);
    tick.push(dt => { mat.opacity = 0.88 * smooth(420, 820, camDist); clouds.visible = mat.opacity > 0.02; for (const c of clouds.children) { c.position.x += dt * 5; if (c.position.x > 2100) c.position.x = -2100; } });
  }

  // one ground mesh for the whole island and its shallow sea floor
  const SAND = lin(0xf0dba3), WET = lin(0xcdb47c), GRASS = lin(0x7fcf5c), GRASS2 = lin(0x66bd4d), FOREST = lin(0x4f9a45), ROCK = lin(0xa39d90), YARD = lin(0xcfcbc1), PLAZA = lin(0xe6dfcf);
  function buildTerrain() {
    const X0 = -1050, X1 = 1050, Z0 = -820, Z1 = 820, S = 6, nx = Math.round((X1 - X0) / S) + 1, nz = Math.round((Z1 - Z0) / S) + 1;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), H = new Float32Array(nx * nz), c = new THREE.Color();
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = X0 + i * S, z = Z0 + j * S, s = land(x, z), h = heightAt(x, z, s), k = j * nx + i;
      H[k] = h; pos.set([x, h, z], k * 3);
      const beachZone = x > 612 && z > -200 && z < 380; // Sunny Beach: sand all the way up to the road
      if (s < 0) c.copy(WET);
      else if (beachZone && s < 90) c.copy(SAND);
      else {
        c.copy(GRASS).lerp(GRASS2, fbm(x * 3, z * 3)); if (h > 14) c.lerp(FOREST, smooth(14, 30, h)); if (h > 46) c.lerp(ROCK, smooth(46, 70, h)); c.lerp(SAND, 1 - smooth(3, 9, s));
        const zn = zoneAt(x, z), inPark = Math.abs(x + 40) < 36 && Math.abs(z + 20) < 36;
        if (zn && zn.id === 'harbour' && z > 112 && x < 246) c.copy(YARD).lerp(GRASS, 0.08 * fbm(x * 4, z * 4)); // concrete yards round the warehouses
        else if (zn && zn.id === 'centre' && !inPark && z < 92) c.copy(PLAZA); // paved plazas between the offices
        else if (zn && zn.id === 'golf') c.copy(FOREST).lerp(GRASS, 0.5); // the rough, darker than the fairways
      }
      col.set([c.r, c.g, c.b], k * 3);
    }
    // steep slopes show rock
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i, sl = Math.hypot(H[k + 1] - H[k - 1], H[k + nx] - H[k - nx]) / (2 * S);
      if (sl > 0.5 && H[k] > 6) { c.setRGB(col[k * 3], col[k * 3 + 1], col[k * 3 + 2]).lerp(ROCK, smooth(0.5, 0.9, sl)); col.set([c.r, c.g, c.b], k * 3); }
    }
    const m = gridMesh(pos, col, H, nx, nz); scene.add(m); World.ground = m;
  }
  function gridMesh(pos, col, H, nx, nz) {
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; if (H[a] < -8 && H[b] < -8 && H[d] < -8 && H[e] < -8) continue; idx.push(a, d, b, b, d, e); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    m.receiveShadow = true; return m;
  }

  // the sea: shallow turquoise near every shore, a line of foam, deep blue further out, gentle waves and sparkles
  function buildOcean() {
    const N = 256, E = 1300, data = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -E + (i + 0.5) / N * 2 * E, z = -E + (j + 0.5) / N * 2 * E; data[j * N + i] = clamp(Math.round(-land(x, z) / 300 * 255), 0, 255); }
    const tex = new THREE.DataTexture(data, N, N, THREE.LuminanceFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({ fog: true, transparent: false,
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { sd: { value: tex }, E: { value: E }, t: { value: 0 },
        isA: { value: ISLES.map(I => new THREE.Vector4(I.x, I.z, I.R, 0)) }, isB: { value: ISLES.map(I => new THREE.Vector4(I.p1, I.p2, I.a1, I.a2)) },
        deep: { value: lin(0x2f86d6) }, mid: { value: lin(0x2fb2e6) }, shallow: { value: lin(0x62dfd6) }, foam: { value: lin(0xf6fcff) } }),
      vertexShader: `varying vec2 vW; #include <fog_pars_vertex>
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition; #include <fog_vertex>
}`.replace(/#include/g, '\n#include').replace(/ void main/, '\nvoid main'),
      fragmentShader: `uniform sampler2D sd; uniform float E, t; uniform vec3 deep, mid, shallow, foam; uniform vec4 isA[3]; uniform vec4 isB[3]; varying vec2 vW;
        #include <fog_pars_fragment>
        void main(){
          vec2 uv = (vW + E) / (2.0 * E); float d = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 300.0 : texture2D(sd, uv).r * 300.0;
          for (int i = 0; i < 3; i++) { vec2 p = vW - isA[i].xy; float th = atan(p.y, p.x); float r = isA[i].z * (1.0 + isB[i].z * sin(3.0 * th + isB[i].x) + isB[i].w * sin(5.0 * th + isB[i].y)); d = min(d, max(length(p) - r, 0.0)); }
          float w = sin(vW.x * 0.045 + t * 0.9) * sin(vW.y * 0.05 - t * 0.7) + sin((vW.x + vW.y) * 0.11 + t * 1.6) * 0.5;
          vec3 c = mix(shallow, mid, smoothstep(4.0, 60.0, d)); c = mix(c, deep, smoothstep(60.0, 260.0, d));
          c += w * 0.014 * (1.0 - smoothstep(150.0, 900.0, d)); // ripples fade out with depth, so the open sea stays calm
          float sp = sin(vW.x * 0.31 + t * 2.1) * sin(vW.y * 0.29 - t * 1.7); c += pow(max(sp, 0.0), 14.0) * 0.16 * (1.0 - smoothstep(150.0, 450.0, gl_FragCoord.z / gl_FragCoord.w)); // sparkles, close up only
          float f = (1.0 - smoothstep(0.0, 7.0, d + w * 1.5)) * (0.55 + 0.45 * sin(t * 1.3 + vW.x * 0.07 + vW.y * 0.05));
          c = mix(c, foam, clamp(f, 0.0, 1.0) * 0.8);
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }` });
    ocean = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000).rotateX(-Math.PI / 2), mat);
    mat.polygonOffset = true; mat.polygonOffsetFactor = 2; mat.polygonOffsetUnits = 4; // where beach and water meet, the beach wins cleanly
    ocean.renderOrder = 0; scene.add(ocean);
    tick.push(dt => { mat.uniforms.t.value += dt; });
  }

  // ---------- roads: asphalt raised over the ground, pavements in town, centre lines, crossings, finished junctions ----------
  const ROAD_Y = GROUND + 0.06;
  function strip(arr, a, b, w, y, uvLen) { // a flat ribbon from a to b
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), nx = -dz / L * w / 2, nz = dx / L * w / 2;
    const p = [[a[0] + nx, a[1] + nz], [a[0] - nx, a[1] - nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz]];
    const u1 = uvLen ? L / uvLen : 1;
    arr.push([p[0], 0, 0], [p[1], 1, 0], [p[2], 0, u1], [p[2], 0, u1], [p[1], 1, 0], [p[3], 1, u1]);
    return L;
  }
  function flatMesh(tris, y, mat, parent = scene) {
    const pos = [], uv = [];
    for (const [[x, z], u, v] of tris) { pos.push(x, y, z); uv.push(u, v); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    mat.side = THREE.DoubleSide; // ribbons are built in either winding: draw both faces
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; parent.add(m); return m;
  }
  function canvasTex(w, h, draw, repeat) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const off = (m, f = -1) => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f * 2; return m; };
  let roadTex = null;
  function buildRoads(list, parent, isTown) {
    const ASPH = lin(0x4d525b), PAVE = lin(0xdcd6c8);
    if (!roadTex) roadTex = {
      line: canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#4d525b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f6e7a8'; g.fillRect(w / 2 - 2, 20, 4, 110); }, true),
      zebra: canvasTex(64, 16, (g, w, h) => { g.fillStyle = '#4d525b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f4f0'; for (let x = 3; x < w; x += 11) g.fillRect(x, 0, 6, h); }),
    };
    const roadT = [], paveT = [], lineT = [], zebraT = [];
    const nodes = new Map();
    for (const s of list) {
      if (s.kind === 'bridge') continue;
      const town = isTown(s);
      if (town) strip(paveT, s.a, s.b, s.w + 6);
      strip(roadT, s.a, s.b, s.w);
      const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz);
      if (s.w >= 9 && L > 20) { const k = 8 / L; strip(lineT, [s.a[0] + dx * k, s.a[1] + dz * k], [s.b[0] - dx * k, s.b[1] - dz * k], 0.9, 0, 8); } // centre line, kept out of junctions
      for (const p of [s.a, s.b]) { const key = p.join(','), n = nodes.get(key) || { p, w: 0, town: false, segs: [] }; n.w = Math.max(n.w, s.w); n.town = n.town || town; n.segs.push(s); nodes.set(key, n); }
    }
    for (const n of nodes.values()) { // junction squares, zebra crossings in town, and turning circles where lanes end at a farm
      const h = n.w / 2 + (n.town ? 0 : 1);
      const sq = (arr, r) => arr.push([[n.p[0] - r, n.p[1] - r], 0, 0], [[n.p[0] - r, n.p[1] + r], 0, 1], [[n.p[0] + r, n.p[1] - r], 1, 0], [[n.p[0] + r, n.p[1] - r], 1, 0], [[n.p[0] - r, n.p[1] + r], 0, 1], [[n.p[0] + r, n.p[1] + r], 1, 1]);
      sq(roadT, h); if (n.town) sq(paveT, h + 3);
      if (n.town && n.segs.length >= 3) for (const s of n.segs) {
        const far = s.a.join(',') === n.p.join(',') ? s.b : s.a, dx = far[0] - n.p[0], dz = far[1] - n.p[1], L = Math.hypot(dx, dz); if (L < 30) continue;
        const k0 = (h + 1.2) / L, k1 = (h + 4.2) / L;
        strip(zebraT, [n.p[0] + dx * k0, n.p[1] + dz * k0], [n.p[0] + dx * k1, n.p[1] + dz * k1], s.w - 1.4);
      }
    }
    flatMesh(paveT, GROUND + 0.18, off(new THREE.MeshStandardMaterial({ color: PAVE, roughness: 0.9 }), -1), parent);
    flatMesh(roadT, ROAD_Y + 0.14, off(new THREE.MeshStandardMaterial({ color: ASPH, roughness: 0.85 }), -2), parent);
    flatMesh(lineT, ROAD_Y + 0.15, off(new THREE.MeshStandardMaterial({ map: roadTex.line, roughness: 0.8 }), -3), parent);
    if (zebraT.length) flatMesh(zebraT, ROAD_Y + 0.16, off(new THREE.MeshStandardMaterial({ map: roadTex.zebra, roughness: 0.8 }), -4), parent);
    if (list === R) buildBridge();
  }
  function buildBridge() { // a finished bridge: deck, kerbs, railings, piers and lamps
    const a = [566, 420], b = [566, 548], g = new THREE.Group(), deckY = 7;
    const M = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.8 });
    const box = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    const L = b[1] - a[1], cz = (a[1] + b[1]) / 2;
    const ramp = (z0, z1, y0, y1) => { const o = box(10, 0.6, Math.hypot(z1 - z0, y1 - y0), 566, (y0 + y1) / 2, (z0 + z1) / 2, M(0x4d525b)); o.rotation.x = Math.atan2(y1 - y0, z1 - z0) * -1; };
    box(10, 0.8, L - 40, 566, deckY, cz, M(0x4d525b));
    ramp(a[1] - 6, a[1] + 20, GROUND + 0.2, deckY); ramp(b[1] - 20, b[1] + 4, deckY, GROUND + 0.2);
    box(1.2, 1.0, L - 40, 561, deckY + 0.6, cz, M(0xe9e4d8)); box(1.2, 1.0, L - 40, 571, deckY + 0.6, cz, M(0xe9e4d8));
    for (let z = a[1] + 26; z <= b[1] - 26; z += 22) { box(2.2, deckY + 8, 2.2, 559, (deckY - 8) / 2, z, M(0xcfc8b8)); box(2.2, deckY + 8, 2.2, 573, (deckY - 8) / 2, z, M(0xcfc8b8)); }
    for (let z = a[1] + 30; z <= b[1] - 30; z += 24) for (const x of [560.8, 571.2]) { box(0.25, 4, 0.25, x, deckY + 2.6, z, M(0x2b3a4a)); box(0.7, 0.4, 0.7, x, deckY + 4.6, z, new THREE.MeshStandardMaterial({ color: lin(0xfff2c0), emissive: lin(0x6b5a20) })); }
    scene.add(g);
  }

  // ---------- merged geometry: buckets by material and by map tile, kept in growable typed arrays ----------
  class Buf {
    constructor() { this.a = new Float32Array(6144); this.n = 0; }
    room(k) { if (this.n + k > this.a.length) { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; } }
    p3(x, y, z) { this.room(3); const a = this.a; a[this.n++] = x; a[this.n++] = y; a[this.n++] = z; }
    p2(x, y) { this.room(2); const a = this.a; a[this.n++] = x; a[this.n++] = y; }
  }
  const parts = new Map(); let tileKey = '0';
  const tileOf = (x, z) => Math.floor(x / 360) + ',' + Math.floor(z / 360);
  function part(k) { const key = k + '|' + tileKey; let P = parts.get(key); if (!P) parts.set(key, P = { k, pos: new Buf(), nor: new Buf(), uv: new Buf(), col: new Buf() }); return P; }
  const NI = new WeakMap(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
  function addGeo(k, geo, mtx, color) { // bake a transformed geometry into a material bucket
    let g = NI.get(geo); if (!g) { g = geo.index ? geo.toNonIndexed() : geo; if (!g.attributes.normal) g.computeVertexNormals(); NI.set(geo, g); }
    const P = part(k), p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv ? g.attributes.uv.array : null;
    _nm.getNormalMatrix(mtx);
    for (let i = 0, N = p.length / 3; i < N; i++) {
      _v.set(p[3 * i], p[3 * i + 1], p[3 * i + 2]).applyMatrix4(mtx); P.pos.p3(_v.x, _v.y, _v.z);
      _n.set(n[3 * i], n[3 * i + 1], n[3 * i + 2]).applyMatrix3(_nm).normalize(); P.nor.p3(_n.x, _n.y, _n.z);
      P.uv.p2(u ? u[2 * i] : 0, u ? u[2 * i + 1] : 0); P.col.p3(color.r, color.g, color.b);
    }
  }
  // walls: four sides with UVs in bays and floors, so the facade texture tiles exactly; the foot of each wall is shaded a
  // little, which grounds the building the way soft ambient shadow would
  function walls(k, M, w, d, y0, y1, color, bay = 3.2, floor = 3.2) {
    const P = part(k), nm = new THREE.Matrix3().getNormalMatrix(M), foot = color.clone().multiplyScalar(y0 < 1.5 ? 0.72 : 0.9);
    const sides = [[[-w / 2, d / 2], [w / 2, d / 2], [0, 1]], [[w / 2, d / 2], [w / 2, -d / 2], [1, 0]], [[w / 2, -d / 2], [-w / 2, -d / 2], [0, -1]], [[-w / 2, -d / 2], [-w / 2, d / 2], [-1, 0]]];
    for (const [a, b, n] of sides) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), bays = Math.max(1, Math.round(L / bay)), fl = (y1 - y0) / floor;
      const q = [[a[0], y0, a[1], 0, 0], [b[0], y0, b[1], bays, 0], [b[0], y1, b[1], bays, fl], [a[0], y1, a[1], 0, fl]];
      const nn = new THREE.Vector3(n[0], 0, n[1]).applyMatrix3(nm).normalize();
      for (const i of [0, 1, 2, 0, 2, 3]) { _v.set(q[i][0], q[i][1], q[i][2]).applyMatrix4(M); P.pos.p3(_v.x, _v.y, _v.z); P.nor.p3(nn.x, nn.y, nn.z); P.uv.p2(q[i][3], q[i][4]); const c = i < 2 ? foot : color; P.col.p3(c.r, c.g, c.b); }
    }
  }
  const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 24), PLANE_X = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const HALF = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
  const tmp = new THREE.Object3D(), _m4 = new THREE.Matrix4();
  function geoAt(k, geo, M, x, y, z, color, ry = 0, sx = 1, sy = 1, sz = 1) { tmp.position.set(x, y, z); tmp.rotation.set(0, ry, 0); tmp.scale.set(sx, sy, sz); tmp.updateMatrix(); addGeo(k, geo, _m4.multiplyMatrices(M, tmp.matrix), color); }
  const boxAt = (k, M, w, h, d, x, y, z, color, ry = 0) => geoAt(k, BOX, M, x, y + h / 2, z, color, ry, w, h, d);
  function frameAt(k, M, w, d, h, t, x, z, color, y = 0) { boxAt(k, M, w, h, t, x, y, z - d / 2 + t / 2, color); boxAt(k, M, w, h, t, x, y, z + d / 2 - t / 2, color); boxAt(k, M, t, h, d - 2 * t, x - w / 2 + t / 2, y, z, color); boxAt(k, M, t, h, d - 2 * t, x + w / 2 - t / 2, y, z, color); }
  function roofGeo(k, M, pos, color) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2)); addGeo(k, g, M, color); }
  function gable(k, M, w, d, y, rise, color, over = 0.5) { // a pitched roof, ridge along x
    const hw = w / 2 + over, hd = d / 2 + over, P = [[-hw, y, -hd], [hw, y, -hd], [hw, y + rise, 0], [-hw, y + rise, 0], [-hw, y, hd], [hw, y, hd]], pos = [];
    for (const t of [[0, 3, 1], [1, 3, 2], [4, 5, 3], [5, 2, 3], [0, 4, 3], [1, 2, 5]]) for (const i of t) pos.push(...P[i]);
    roofGeo(k, M, pos, color);
  }
  function hip(k, M, w, d, y, rise, color, over = 0.5) { // a hipped roof: sloping on all four sides
    if (w < d) { hip(k, rotY(M), d, w, y, rise, color, over); return; }
    const hw = w / 2 + over, hd = d / 2 + over, r = Math.max(0, hw - hd), A = [-hw, y, -hd], B = [hw, y, -hd], Cc = [hw, y, hd], D = [-hw, y, hd], R0 = [-r, y + rise, 0], R1 = [r, y + rise, 0], pos = [];
    for (const t of [[A, R0, B], [B, R0, R1], [D, Cc, R1], [D, R1, R0], [A, D, R0], [B, R1, Cc]]) for (const p of t) pos.push(...p);
    roofGeo(k, M, pos, color);
  }
  function cylWalls(k, M, r, y0, y1, color, floor) { // a round glass tower: the facade texture wraps in 4 m bays
    const bays = Math.max(8, Math.round(2 * Math.PI * r / 4)), g = new THREE.CylinderGeometry(r, r, y1 - y0, bays, 1, true), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * bays, uv.getY(i) * (y1 - y0) / floor);
    geoAt(k, g, M, 0, (y0 + y1) / 2, 0, color);
  }
  function sign(M, i, w, h, x, y, z, ry = 0) { // a shop or roof sign: one cell of the sign sheet on a board
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, u0 = (i % 4) / 4, u1 = u0 + 0.25, v1 = 1 - Math.floor(i / 4) / 4, v0 = v1 - 0.25;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    geoAt('sign', g, M, x, y, z, WHITE, ry);
  }
  const ROT90 = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  const rotY = M => M.clone().multiply(ROT90);
  const mul = (M, x, y, z, ry = 0) => M.clone().multiply(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
  function extraTree(M, x, z, s, kind = 0) { const p = new THREE.Vector3(x, 0, z).applyMatrix4(M); extraTrees.push([p.x, p.y, p.z, s, kind]); }

  // ---------- facade and sign textures: one bay by one floor, drawn once and repeated, with mipmaps ----------
  const tex = {};
  const SIGNS = ['CAFÉ', 'BAKERY', 'BOOKS', 'PIZZA', 'FLOWERS', 'MARKET', 'DELI', 'SHOES', 'SUSHI', 'TOYS', 'PHARMACY', 'BURGERS', 'HOTEL', 'CAPITAL COLA', 'TIMBER CO.', 'GELATO'];
  const SIGNC = ['#c0392b', '#e67e22', '#2e74c9', '#d35400', '#8e44ad', '#27ae60', '#16a085', '#34495e', '#e84393', '#f39c12', '#2f8f5b', '#c0392b', '#1f3f8f', '#d62828', '#7a4e2d', '#ff6f91'];
  function facades() {
    const T = draw => canvasTex(128, 128, draw, true);
    const glassGrad = (g, y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#a6d2f2'); gr.addColorStop(0.45, '#5f93c4'); gr.addColorStop(1, '#2f5d8c'); return gr; };
    tex.home = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ece6da'; g.fillRect(0, 118, 128, 10);
      g.fillStyle = '#9c9c9c'; g.fillRect(20, 28, 13, 64); g.fillRect(95, 28, 13, 64); // shutters: tinted by the wall, so they read as a deeper shade of it
      g.fillStyle = '#fff'; g.fillRect(35, 26, 58, 68); g.fillStyle = glassGrad(g, 31, 89); g.fillRect(40, 31, 48, 58); g.fillStyle = '#fff'; g.fillRect(62, 31, 4, 58); g.fillRect(40, 57, 48, 4); g.fillStyle = '#d6cdbb'; g.fillRect(31, 94, 66, 7); });
    tex.apart = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#efe9dd'; g.fillRect(0, 0, 128, 10); g.fillStyle = '#e4dccb'; g.fillRect(28, 14, 72, 8);
      g.fillStyle = '#f7f3ea'; g.fillRect(30, 22, 68, 78); g.fillStyle = glassGrad(g, 30, 92); g.fillRect(38, 30, 52, 62); g.fillStyle = '#f7f3ea'; g.fillRect(62, 30, 4, 62); g.fillStyle = '#cfc6b4'; g.fillRect(26, 100, 76, 8); });
    tex.office = T(g => { g.fillStyle = '#f2f4f6'; g.fillRect(0, 0, 128, 128); g.fillStyle = glassGrad(g, 18, 108); g.fillRect(6, 18, 116, 88); g.fillStyle = '#dfe6ec'; g.fillRect(62, 18, 4, 88); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(10, 22, 30, 80); });
    tex.glass = T(g => { const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#b4e0f6'); gr.addColorStop(0.5, '#5d9dcc'); gr.addColorStop(1, '#2d628f'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#e8f0f6'; g.fillRect(0, 0, 128, 6); g.fillRect(0, 0, 3, 128); g.fillRect(63, 0, 2, 128); g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(8, 128); g.lineTo(58, 0); g.lineTo(80, 0); g.lineTo(30, 128); g.fill(); });
    tex.ribbon = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = glassGrad(g, 48, 118); g.fillRect(0, 48, 128, 68); g.fillStyle = '#eef2f5'; for (let x = 0; x < 128; x += 32) g.fillRect(x, 48, 3, 68); });
    tex.civic = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ebe4d6'; g.fillRect(0, 0, 128, 6); g.fillRect(0, 122, 128, 6);
      g.fillStyle = '#2f4f74'; g.fillRect(40, 30, 48, 80); g.beginPath(); g.arc(64, 30, 24, Math.PI, 0); g.fill(); g.fillStyle = '#7fa6cf'; g.fillRect(40, 30, 48, 10); g.fillStyle = '#fff'; g.fillRect(62, 8, 4, 102); g.fillRect(40, 66, 48, 3); g.fillStyle = '#ddd3c0'; g.fillRect(34, 110, 60, 6); });
    tex.shopTop = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = glassGrad(g, 28, 88); g.fillRect(24, 28, 34, 60); g.fillRect(70, 28, 34, 60); g.fillStyle = '#dcd4c4'; g.fillRect(20, 88, 42, 7); g.fillRect(66, 88, 42, 7); });
    tex.shopFront = T(g => { g.fillStyle = '#efe7d7'; g.fillRect(0, 0, 128, 128); const gr = g.createLinearGradient(0, 30, 0, 128); gr.addColorStop(0, '#9cc6e2'); gr.addColorStop(1, '#2c4f73'); g.fillStyle = gr; g.fillRect(8, 30, 112, 98); g.fillStyle = '#efe7d7'; g.fillRect(62, 30, 4, 98); g.fillStyle = '#ffd98a'; g.globalAlpha = 0.4; g.fillRect(8, 96, 112, 32); g.globalAlpha = 1; });
    tex.shed = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e4e4e4'; for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 3, 128); g.fillStyle = '#3d5f86'; g.fillRect(20, 14, 88, 18); g.fillStyle = '#7fa6cf'; g.fillRect(20, 14, 88, 6); });
    tex.brick = T(g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e8ddd5'; for (let y = 0; y < 128; y += 8) { g.fillRect(0, y, 128, 1); for (let x = (y / 8) % 2 * 8; x < 128; x += 16) g.fillRect(x, y, 1, 8); } g.fillStyle = '#2f4f74'; g.fillRect(36, 18, 56, 84); g.beginPath(); g.arc(64, 18, 28, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.fillRect(62, 0, 4, 102); g.fillRect(36, 56, 56, 3); });
    tex.signs = canvasTex(1024, 256, g => { for (let i = 0; i < 16; i++) { const x = (i % 4) * 256, y = Math.floor(i / 4) * 64; g.fillStyle = '#fff'; g.fillRect(x, y, 256, 64); g.fillStyle = SIGNC[i]; g.fillRect(x + 4, y + 4, 248, 56); g.fillStyle = '#fff'; g.font = `900 ${SIGNS[i].length > 9 ? 30 : 38}px 'Arial Black', Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(SIGNS[i], x + 128, y + 34); } });
    tex.pitch = canvasTex(256, 128, g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#5fb04a' : '#6cbf54'; g.fillRect(i * 32, 0, 32, 128); } g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(8, 8, 240, 112); g.beginPath(); g.moveTo(128, 8); g.lineTo(128, 120); g.stroke(); g.beginPath(); g.arc(128, 64, 18, 0, Math.PI * 2); g.stroke(); g.strokeRect(8, 40, 28, 48); g.strokeRect(220, 40, 28, 48); });
  }
  let MATS = null;
  function mats() {
    if (MATS) return MATS;
    const S = o => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85 }, o));
    MATS = { home: S({ map: tex.home }), apart: S({ map: tex.apart }), office: S({ map: tex.office, roughness: 0.4, metalness: 0.15 }), glass: S({ map: tex.glass, roughness: 0.25, metalness: 0.2 }), ribbon: S({ map: tex.ribbon, roughness: 0.5 }), civic: S({ map: tex.civic }),
      shopFront: S({ map: tex.shopFront, roughness: 0.5 }), shopTop: S({ map: tex.shopTop }), shed: S({ map: tex.shed, roughness: 0.8 }), brick: S({ map: tex.brick, roughness: 0.9 }),
      roof: S({ roughness: 0.8, flatShading: true }), trim: S({ roughness: 0.75 }), trim2: S({ roughness: 0.75, side: THREE.DoubleSide }), lawn: S({ roughness: 1 }), gold: S({ roughness: 0.3, metalness: 0.6 }),
      water: S({ roughness: 0.06, metalness: 0.15 }), glow: new THREE.MeshBasicMaterial({ vertexColors: true }), sign: new THREE.MeshBasicMaterial({ map: tex.signs, vertexColors: true }),
      pitch: S({ map: tex.pitch, roughness: 1, vertexColors: false }), glassy: S({ transparent: true, opacity: 0.5, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
      detail: S({ roughness: 0.7, transparent: true }) };
    fadeMats.push([MATS.detail, 380, 640]);
    return MATS;
  }
  const NOSHADOW = { lawn: 1, water: 1, pitch: 1, sign: 1, glow: 1, glassy: 1 };
  function flush(into) {
    const M = mats();
    for (const P of parts.values()) {
      if (!P.pos.n) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P.pos.a.slice(0, P.pos.n), 3)); g.setAttribute('normal', new THREE.BufferAttribute(P.nor.a.slice(0, P.nor.n), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(P.uv.a.slice(0, P.uv.n), 2)); g.setAttribute('color', new THREE.BufferAttribute(P.col.a.slice(0, P.col.n), 3));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, M[P.k]); m.castShadow = !NOSHADOW[P.k]; m.receiveShadow = true; m.matrixAutoUpdate = false; (into || scene).add(m);
    }
    parts.clear();
  }

  // ---------- buildings ----------
  const C = c => lin(c), WHITE = new THREE.Color(1, 1, 1);
  const WALLS = {
    home: [0xfff0d6, 0xffd9c2, 0xd7f0d0, 0xe6dcff, 0xcfe9ff, 0xffe9a8, 0xf7c6c6, 0xffffff, 0xf2d7b5],
    roof: [0xe0603f, 0xc94a3a, 0x4f6d8f, 0x7a5546, 0x3f8f7a, 0x5a5f6b, 0xd9783f],
    apart: [0xd98a6a, 0xe8b98f, 0xe3a07f, 0xc7d3e0, 0xf0dcb4, 0xf5c4a1, 0xb9d8c8],
    hotel: [0xffffff, 0xffe6d5, 0xd5f2ee, 0xfff1c9, 0xf2e1ff],
    shop: [0xf4ead6, 0xe9d7bf, 0xd8e4ec, 0xf1dccc, 0xffe3e3, 0xe2f2dc],
    awn: [0xe94f4f, 0x2f8f5b, 0x2e74c9, 0xf2a531, 0x8a4fd6, 0xff6f91, 0x16a085],
    office: [0xd7e6f4, 0xc4dcef, 0xf0e8da, 0xd5e8de, 0xe4dcf0, 0xffffff, 0xffd9b0, 0xbfeee2, 0xc4ccff, 0xffe9a8, 0xf6c9c0],
    oroof: [0x56657a, 0x4f6b6a, 0x6a5a6e, 0x5b6b84, 0x3f7f8f],
    shed: [0xd9dfe4, 0xc9d6dd, 0xe2d6c2, 0xcfe0d4], brick: [0xc0674b, 0xb35a42, 0xa94f3c], lot: [0x86d063, 0x7cc75a, 0x92d66c],
  };
  function addBuilding(b) {
    tileKey = (b.isle || '') + tileOf(b.x, b.z);
    const M = new THREE.Matrix4().makeRotationY(b.rot).setPosition(b.x, GROUND, b.z), T = b.type;
    const f = T === 'home' || T === 'villa' ? drawHome : T === 'apart' || T === 'starter' || T === 'hotel' ? drawApart : T === 'shop' || T === 'market' ? drawShop : T === 'office' || T === 'tower' ? drawOffice : drawOther;
    b.h = f(b, M, b.w, b.d);
    buildings.push(b);
  }
  function yard(b, M, w, d, villa) { // the back garden: lawn, a hedge or a picket fence, sometimes a pool, a shed or a tree
    const yd = b.yd, ww = w + 2.4, back = -d / 2 - yd / 2;
    boxAt('lawn', M, ww, 0.12, d + yd + 1.6, 0, 0, (1.6 - yd) / 2, C(pick(WALLS.lot)));
    boxAt('lawn', M, 1.4, 0.16, 1.7, villa ? w * 0.25 : -w * 0.2, 0, d / 2 + 0.85, C(0xe8e0cf)); // front path
    const hedge = villa || rnd() < 0.55, fc = C(hedge ? 0x4f9a45 : 0xfaf7f0), fh = hedge ? 1.3 : 0.9, ft = hedge ? 0.8 : 0.16;
    boxAt('trim', M, ft, fh, yd, -ww / 2 + ft / 2, 0, back, fc); boxAt('trim', M, ft, fh, yd, ww / 2 - ft / 2, 0, back, fc); boxAt('trim', M, ww, fh, ft, 0, 0, -d / 2 - yd + ft / 2, fc);
    boxAt('lawn', M, w * 0.6, 0.16, 2.6, 0, 0, -d / 2 - 1.3, C(0xe9e2d2)); // patio
    if (villa || rnd() < 0.28) { const px = (rnd() - 0.5) * Math.max(0, ww - 9), pz = back - 0.4; frameAt('trim', M, 4.4, 6.8, 0.45, 0.4, px, pz, C(0xf7f5f0)); boxAt('water', M, 3.6, 0.26, 6, px, 0, pz, C(0x45c9ec)); }
    else if (rnd() < 0.35) { boxAt('trim', M, 2.4, 2.1, 2, ww / 2 - 2.4, 0, -d / 2 - yd + 2.2, C(pick(WALLS.home))); boxAt('roof', M, 2.8, 0.25, 2.4, ww / 2 - 2.4, 2.1, -d / 2 - yd + 2.2, C(pick(WALLS.roof))); }
    if (rnd() < 0.85) extraTree(M, -ww / 2 + 2.6, -d / 2 - yd + 2.6, 0.62 + rnd() * 0.3);
    if (yd > 11 && rnd() < 0.6) extraTree(M, ww / 2 - 2.6, back + 1, 0.55);
  }
  function drawHome(b, M, w, d) {
    const villa = b.type === 'villa', wc = C(b.color || pick(WALLS.home)), rc = C(b.roof || pick(WALLS.roof));
    if (b.yd) yard(b, M, w, d, villa);
    boxAt('trim', M, w + 0.4, 0.5, d + 0.4, 0, 0, 0, C(0xe2d9c6));
    if (villa) { // a modern villa: a white ground floor, a glass upper floor set back, flat roofs
      walls('home', M, w, d, 0.5, 3.8, wc);
      boxAt('trim', M, w + 0.8, 0.35, d + 0.8, 0, 3.8, 0, C(0xf7f5f0));
      walls('glass', mul(M, -w * 0.12, 0, -d * 0.08), w * 0.66, d * 0.72, 4.15, 7.4, C(0xeaf6ff), 3.2, 3.25);
      boxAt('trim', M, w * 0.66 + 1.2, 0.4, d * 0.72 + 1.2, -w * 0.12, 7.4, -d * 0.08, C(0xf7f5f0)); boxAt('roof', M, w * 0.66, 0.1, d * 0.72, -w * 0.12, 7.8, -d * 0.08, C(0x9aa3ad));
      boxAt('detail', M, 2.6, 0.25, 1.8, w * 0.3, 4.15, d * 0.18, C(0x2b3a55)); // solar panels
      boxAt('trim', M, 1.6, 2.4, 0.3, w * 0.25, 0.5, d / 2 + 0.15, C(0x3b3f48));
      return 7.9;
    }
    const fl = b.floors || 2, st = b.style != null ? b.style : Math.floor(rnd() * 3); let h = 0.5 + fl * 3;
    walls('home', M, w, d, 0.5, h, wc, 3.2, 3);
    if (st === 1) hip('roof', M, w, d, h, 2.8, rc); else if (st === 2) gable('roof', rotY(M), d, w, h, 3, rc); else gable('roof', M, w, d, h, 3.2, rc);
    const dx = -w * 0.2;
    boxAt('trim', M, 1.3, 2.3, 0.3, dx, 0.5, d / 2 + 0.15, C(pick([0x6b4a33, 0x2e5a8a, 0xb5443a, 0x2f7a55])));
    boxAt('detail', M, 3.2, 0.22, 1.8, dx, 2.95, d / 2 + 0.9, C(0xf7f3ea));
    for (const sx of [-1.35, 1.35]) boxAt('detail', M, 0.2, 2.45, 0.2, dx + sx, 0.5, d / 2 + 1.6, C(0xf7f3ea));
    boxAt('detail', M, 1, 2.6, 1, w * 0.28, h + 0.8, -d * 0.15, C(0xa45a46)); // chimney
    if (fl > 1 && rnd() < 0.5) boxAt('detail', M, 2.2, 0.35, 0.5, w * 0.22, 3.7, d / 2 + 0.25, C(pick([0xff6f91, 0xffd21f, 0xe94f4f, 0xb07cff]))); // a window box of flowers
    return h + 3;
  }
  function drawApart(b, M, w, d) { // a walk-up or a hotel: stone base, balconies, cornice, a busy flat roof
    const fl = b.floors || 3, hotel = b.type === 'hotel', wc = C(b.color || pick(hotel ? WALLS.hotel : WALLS.apart)), h = 0.8 + fl * 3.2, top = h + 0.5;
    boxAt('trim', M, w + 0.3, 0.8, d + 0.3, 0, 0, 0, C(0xcfc6b4));
    walls('apart', M, w, d, 0.8, h, wc);
    boxAt('trim', M, w + 0.8, 0.5, d + 0.8, 0, h, 0, C(0xf1ead9)); // cornice
    boxAt('roof', M, w - 0.2, 0.12, d - 0.2, 0, top, 0, C(pick([0x6e737c, 0x7a6a5e, 0x5f6b74])));
    boxAt('trim', M, 1.8, 2.6, 0.35, 0, 0.8, d / 2 + 0.17, C(0x5a3a28)); // door
    for (let s = 0; s < 3; s++) boxAt('trim', M, 2.6, 0.27, 0.4, 0, s * 0.27, d / 2 + 0.6 + (2 - s) * 0.38, C(0xbfb8a8)); // stoop
    boxAt('detail', M, 2.8, 0.2, 1.3, 0, 3.5, d / 2 + 0.65, C(b.type === 'starter' ? 0x2e74c9 : pick([0x3d7a58, 0xb5443a, 0x2e5a8a]))); // canopy
    const n = Math.max(1, Math.round(w / 3.2)), bw = w / n, rail = C(hotel ? 0xffffff : 0x3a4150), slab = C(0xf4efe4);
    for (let f = 1; f < fl; f++) for (let i = 0; i < n; i++) for (const side of hotel ? [1, -1] : [1]) {
      if (!hotel && (i + f) % 2) continue;
      const x = -w / 2 + (i + 0.5) * bw, y = 0.8 + f * 3.2, z = side * (d / 2 + 0.6);
      boxAt('trim', M, bw * 0.84, 0.2, 1.2, x, y - 0.1, z, slab); boxAt('trim', M, bw * 0.84, 0.9, 0.1, x, y + 0.1, z + side * 0.55, rail);
    }
    if (hotel && rnd() < 0.6) { frameAt('trim', M, 7.4, 5, 0.55, 0.4, -w * 0.12, -d * 0.1, C(0xffffff), top); boxAt('water', M, 6.6, 0.4, 4.2, -w * 0.12, top, -d * 0.1, C(0x45c9ec)); }
    else if (rnd() < 0.22) { boxAt('lawn', M, w * 0.42, 0.45, d * 0.38, -w * 0.18, top, d * 0.14, C(0x6cbf55)); boxAt('detail', M, 1.4, 1.2, 1.4, -w * 0.18, top + 0.45, d * 0.14, C(0x4f9a45)); }
    else geoAt('detail', CYL, M, -w * 0.25, top + 2.1, -d * 0.2, C(0x9b6a43), 0, 1.2, 2, 1.2); // water tank
    boxAt('detail', M, 2, 1.1, 1.4, w * 0.27, top, -d * 0.2, C(0xb9bec6)); boxAt('detail', M, 1.4, 0.9, 1.2, w * 0.27, top, d * 0.15, C(0xc9ced6));
    if (hotel) { for (const sx of [-2.6, 2.6]) boxAt('trim', M, 0.25, 1.4, 0.25, sx, top, d / 2 - 0.6, C(0x5a606b)); sign(M, 12, Math.min(w * 0.6, 9), 1.8, 0, top + 2.2, d / 2 - 0.5); }
    return top + 3.2;
  }
  function drawShop(b, M, w, d) { // shopfront, striped awning, a sign, flats above, plant and sometimes a billboard on the roof
    const wc = C(pick(WALLS.shop)), fl = b.floors || 2, h = 4 + (fl - 1) * 3.2;
    walls('shopFront', M, w, d, 0, 4, C(0xffffff), w / Math.max(1, Math.round(w / 5)), 4);
    walls('shopTop', M, w, d, 4, h, wc, 4.4);
    boxAt('trim', M, w + 0.6, 0.45, d + 0.6, 0, h, 0, C(0xefe7d6)); boxAt('roof', M, w - 0.2, 0.12, d - 0.2, 0, h + 0.45, 0, C(pick([0x7a7f88, 0x6f6458, 0x5c6d78])));
    boxAt('detail', M, w - 1, 0.22, 2.1, 0, 3.55, d / 2 + 1.05, C(b.awn || pick(WALLS.awn))); boxAt('detail', M, w - 1, 0.5, 0.08, 0, 3.3, d / 2 + 2.08, C(0xffffff)); // awning and its valance
    sign(M, b.sign != null ? b.sign : Math.floor(rnd() * 12), Math.min(w * 0.7, 9), 1.2, 0, 4.5, d / 2 + 0.06);
    boxAt('detail', M, 2.2, 0.9, 1.6, w * 0.25, h + 0.45, -d * 0.2, C(0xb9bec6));
    if (b.type !== 'market' && rnd() < 0.2) { for (const sx of [-2.5, 2.5]) boxAt('trim', M, 0.3, 3, 0.3, sx, h + 0.45, -d * 0.1, C(0x5a606b)); sign(M, 13, 8, 2.4, 0, h + 4.4, -d * 0.1 + 0.2); return h + 5.6; }
    return h + 1.4;
  }
  function drawOffice(b, M, w, d) { // glass, ribbon windows or stone frames; square, set back or round; plant, gardens or a helipad on top
    const fl = b.floors, tower = b.type === 'tower', st = tower ? 0 : (b.style != null ? b.style : fl > 7 ? Math.floor(rnd() * 4) : [0, 3, 3, 1][Math.floor(rnd() * 4)]);
    const r0 = rnd(), k = st === 2 ? 'glass' : st === 3 ? 'ribbon' : fl <= 6 && r0 < 0.3 ? 'brick' : r0 < 0.6 ? 'office' : 'glass', wc = C(b.color || pick(k === 'brick' ? WALLS.brick : WALLS.office));
    let h = 5 + fl * 3.6, wt = w, dt = d, round = 0;
    walls('shopFront', M, w, d, 0, 5, C(0xf0f3f6), 5.5, 5);
    if (st === 2) {
      round = Math.min(w, d) * 0.5; boxAt('trim', M, w + 0.6, 0.6, d + 0.6, 0, 5, 0, C(0xe1e6eb));
      cylWalls(k, M, round, 5.6, h, wc, 3.6);
      geoAt('trim', CYL, M, 0, h + 0.4, 0, C(0xe1e6eb), 0, round + 0.4, 0.8, round + 0.4); geoAt('roof', CYL, M, 0, h + 0.85, 0, C(pick(WALLS.oroof)), 0, round - 0.3, 0.1, round - 0.3);
      h += 0.9; wt = dt = round * 1.4;
    } else if (st === 1) {
      const f1 = Math.max(2, Math.ceil(fl * 0.55)), h1 = 5 + f1 * 3.6;
      walls(k, M, w, d, 5, h1, wc, 4, 3.6); boxAt('trim', M, w + 0.6, 0.6, d + 0.6, 0, h1, 0, C(0xe1e6eb)); boxAt('lawn', M, w - 0.8, 0.3, d - 0.8, 0, h1 + 0.6, 0, C(0x7cc75a)); // a roof terrace garden on the setback
      wt = w * 0.66; dt = d * 0.66; h = h1 + 0.9 + (fl - f1 + 1) * 3.6; walls(k, M, wt, dt, h1 + 0.9, h, wc, 4, 3.6);
    } else {
      walls(k, M, w, d, 5, h, wc, 4, 3.6);
      if (st === 0) for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt('trim', M, 0.7, h - 5, 0.7, sx * w / 2, 5, sz * d / 2, C(0xeef2f6)); // crisp corner piers
    }
    if (!round) { boxAt('trim', M, wt + 0.6, 0.8, dt + 0.6, 0, h, 0, C(0xd2d9e0)); boxAt('roof', M, wt - 0.4, 0.12, dt - 0.4, 0, h + 0.8, 0, C(pick(WALLS.oroof))); h += 0.8; }
    boxAt('detail', M, 8, 0.4, 3, 0, 4.4, d / 2 + 1.5, C(0x2c3e57)); // lobby canopy
    if (tower) return drawTowerTop(M, w, d, h, wc);
    if (fl >= 9 && !round && wt > 15) { geoAt('detail', CYL, M, 0, h + 0.15, 0, C(0xffd21f), 0, 6.4, 0.3, 6.4); geoAt('detail', CYL, M, 0, h + 0.3, 0, C(0x3a3f48), 0, 5.7, 0.3, 5.7); } // helipad
    else { boxAt('detail', M, wt * 0.35, 3, dt * 0.3, wt * 0.12, h, -dt * 0.1, C(0xc5cad1)); boxAt('detail', M, 3, 2, 3, -wt * 0.28, h, dt * 0.2, C(0xb3b9c1)); }
    if (fl >= 10) { const gc = C(pick([0x9fe8ff, 0xfff1b0, 0xffffff])); if (round) geoAt('glow', CYL, M, 0, h - 1.6, 0, gc, 0, round + 0.15, 0.35, round + 0.15); else boxAt('glow', M, wt + 0.7, 0.35, dt + 0.7, 0, h - 1.6, 0, gc); } // a band of light at the crown
    return h + 3;
  }
  function drawTowerTop(M, w, d, h, wc) { // Capital Tower: setbacks, bands of light, a gold crown and a spire, the island's landmark
    const w2 = w * 0.72, d2 = d * 0.72, h2 = h + 18;
    walls('office', M, w2, d2, h, h2, wc, 4, 3.6); boxAt('trim', M, w2 + 0.8, 0.8, d2 + 0.8, 0, h2, 0, C(0xe9ecef)); boxAt('glow', M, w + 0.7, 0.4, d + 0.7, 0, h - 1.4, 0, C(0xfff1b0));
    const w3 = w2 * 0.6, h3 = h2 + 12; walls('office', M, w3, w3, h2 + 0.8, h3, wc, 4, 3.6); boxAt('glow', M, w2 + 1, 0.4, d2 + 1, 0, h2 - 1.4, 0, C(0xfff1b0));
    boxAt('gold', M, w3 + 1.2, 2.2, w3 + 1.2, 0, h3, 0, C(0xf2c14e));
    geoAt('gold', new THREE.ConeGeometry(2.4, 22, 8), M, 0, h3 + 13, 0, C(0xf2c14e)); geoAt('glow', BOX, M, 0, h3 + 24.5, 0, C(0xff5a5a), 0, 0.8, 0.8, 0.8);
    return h3 + 25;
  }
  function drawOther(b, M, w, d) {
    const T = b.type;
    if (T === 'warehouse') { // corrugated sides, roller doors, a curved roof, loading bays
      const h = 9; walls('shed', M, w, d, 0, h, C(b.color || pick(WALLS.shed)), 3.2, 9);
      geoAt('roof', new THREE.CylinderGeometry(d / 2, d / 2, w, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), M, 0, h, 0, C(b.roof || pick([0x5f7d95, 0x8a5a44, 0x6d8a64, 0x3f7f8f])), 0, 1, 0.35, 1);
      for (let i = -1; i <= 1; i++) { boxAt('trim', M, 5, 5.5, 0.3, i * w * 0.28, 0, d / 2 + 0.15, C(0x9aa6b0)); boxAt('detail', M, 5.6, 0.3, 2.4, i * w * 0.28, 5.6, d / 2 + 1.2, C(0x5a606b)); }
      boxAt('trim', M, w * 0.9, 1.1, 2.2, 0, 0, d / 2 + 1.1, C(0xb8b2a6)); // loading dock
      return h + d * 0.18;
    }
    if (T === 'factory') { // brick, tall windows, a sawtooth roof and a chimney
      const h = 11; walls('brick', M, w, d, 0, h, C(pick(WALLS.brick)), 5, 11);
      const n = Math.max(3, Math.round(w / 8));
      for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n, s = w / n / 2, P = [[-s, 0, -d / 2], [s, 0, -d / 2], [s, 4, -d / 2], [-s, 0, d / 2], [s, 0, d / 2], [s, 4, d / 2]], pos = []; for (const t of [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4]]) for (const q of t) pos.push(P[q][0] + x, P[q][1] + h, P[q][2]); roofGeo('roof', M, pos, C(0x6b7078)); }
      geoAt('trim', new THREE.CylinderGeometry(1.4, 1.9, 22, 12), M, w * 0.38, 22, -d * 0.3, C(0xa4573f)); geoAt('trim', CYL, M, w * 0.38, 33.2, -d * 0.3, C(0xf2f2f2), 0, 1.5, 1.2, 1.5);
      boxAt('trim', M, 6, 6, 0.3, 0, 0, d / 2 + 0.15, C(0x8c96a0));
      return 22;
    }
    if (T === 'barn') { // a red barn with white trim and a silo
      walls('shed', M, w, d, 0, 5.5, C(0xc0473a), 2.4, 5.5); gable('roof', M, w, d, 5.5, 3.2, C(0x6b4b3a), 0.4);
      boxAt('trim', M, 3.6, 3.8, 0.3, 0, 0, d / 2 + 0.15, C(0xf4efe6));
      geoAt('trim', new THREE.CylinderGeometry(2.6, 2.6, 11, 14), M, w / 2 + 3.4, 5.5, 0, C(0xd9dde0)); geoAt('trim', new THREE.SphereGeometry(2.6, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), M, w / 2 + 3.4, 11, 0, C(0x9aa3ab));
      return 13;
    }
    if (T === 'mill') { // the timber mill: wooden sheds, a saw house, a sawdust silo and a chimney
      walls('shed', M, w, d, 0, 8, C(0xb58a5b), 2.6, 8); gable('roof', M, w, d, 8, 3.5, C(0x4f5a62), 0.6);
      boxAt('trim', M, 6, 6, 0.3, 0, 0, d / 2 + 0.15, C(0x6b4a33));
      geoAt('trim', new THREE.CylinderGeometry(2.2, 2.2, 10, 12), M, -w / 2 - 3, 5, -d * 0.2, C(0xc9ced6)); geoAt('trim', new THREE.ConeGeometry(2.4, 2.4, 12), M, -w / 2 - 3, 11.2, -d * 0.2, C(0x8c96a0));
      geoAt('trim', new THREE.CylinderGeometry(0.6, 0.8, 8, 8), M, w * 0.3, 12, -d * 0.2, C(0x5a606b));
      return 12;
    }
    if (T === 'kiosk') { walls('shopFront', M, w, d, 0, 3, C(0xffffff), w, 3); boxAt('detail', M, w + 1.6, 0.25, d + 1.6, 0, 3, 0, C(b.awn || pick(WALLS.awn))); return 3.3; }
    if (T === 'hall') { // City Hall: stone steps, a portico of columns, a dome with a lantern
      const h = 14, stone = C(0xf4ecdc), Mp = mul(M, 0, 0, d / 2 + 2.8);
      for (let s = 0; s < 3; s++) boxAt('trim', M, w + 6 - s * 2, 0.4, d + 10 - s * 2, 0, s * 0.4, 1.5, C(0xe2d8c4));
      walls('civic', M, w, d, 1.2, h, stone, 4.4, 6.4);
      boxAt('trim', M, w + 1.2, 1.2, d + 1.2, 0, h, 0, C(0xfaf5ea)); boxAt('roof', M, w - 0.4, 0.1, d - 0.4, 0, h + 1.2, 0, C(0x7d8a96));
      for (let i = 0; i < 6; i++) geoAt('trim', CYL, Mp, -w * 0.3 + i * w * 0.12, 6.8, 0, stone, 0, 0.8, 11.2, 0.8);
      boxAt('trim', Mp, w * 0.72, 1, 6.6, 0, 12.4, 0, C(0xfaf5ea)); gable('trim', rotY(Mp), 6.6, w * 0.72, 13.4, 3.6, C(0xfaf5ea), 0.2);
      geoAt('civic', new THREE.CylinderGeometry(8, 8, 5, 24, 1, true), M, 0, h + 3.7, 0, stone); geoAt('roof', new THREE.SphereGeometry(8.6, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), M, 0, h + 6.2, 0, C(0x6fbfa6));
      geoAt('gold', new THREE.CylinderGeometry(1.4, 1.4, 3, 10), M, 0, h + 16.2, 0, C(0xf2c14e)); geoAt('gold', new THREE.ConeGeometry(1.8, 2.6, 10), M, 0, h + 19, 0, C(0xf2c14e));
      return h + 21;
    }
    if (T === 'church') { // a nave running back from the street, a bell tower and a spire
      const stone = C(0xefe3cf), Mt = mul(M, 0, 0, d / 2 - 3.5);
      walls('civic', M, w, d, 0, 9, stone, 3.6, 9); gable('roof', rotY(M), d, w, 9, 6, C(0x5a4a4a));
      walls('civic', Mt, 7, 7, 0, 21, stone, 3.5, 5.25); boxAt('trim', Mt, 7.8, 0.6, 7.8, 0, 21, 0, C(0xfaf5ea));
      geoAt('roof', new THREE.ConeGeometry(5, 12, 4), Mt, 0, 27.6, 0, C(0x4f4a5a), Math.PI / 4); geoAt('gold', BOX, Mt, 0, 34.6, 0, C(0xf2c14e), 0, 0.3, 2, 0.3); geoAt('gold', BOX, Mt, 0, 35, 0, C(0xf2c14e), 0, 1.2, 0.3, 0.3);
      return 36;
    }
    if (T === 'school') { // two wings of classrooms and a sports pitch inside a running track
      const A = mul(M, -w / 2 + 18, 0, d / 2 - 7), B = mul(M, -w / 2 + 8, 0, -4);
      for (const [Mx, ww, dd, c] of [[A, 34, 13, 0xf7c873], [B, 14, 22, 0xf2a07a]]) { walls('shopFront', Mx, ww, dd, 0, 3.6, C(0xffffff), 5, 3.6); walls('ribbon', Mx, ww, dd, 3.6, 7.6, C(c), 4, 3.6); boxAt('trim', Mx, ww + 0.8, 0.6, dd + 0.8, 0, 7.6, 0, C(0xf1ead9)); boxAt('roof', Mx, ww - 0.2, 0.1, dd - 0.2, 0, 8.2, 0, C(0x6e737c)); }
      boxAt('lawn', M, 36, 0.14, 26, w / 2 - 19, 0, -d / 2 + 14, C(0xc8664a)); geoAt('pitch', PLANE_X, M, w / 2 - 19, 0.18, -d / 2 + 14, WHITE, 0, 29, 1, 19);
      return 10;
    }
    if (T === 'hospital') { // a white tower with a red cross on the roof and a low wing with a helipad
      const A = mul(M, 0, 0, d / 2 - 9), B = mul(M, 0, 0, -d / 2 + 8), top = 5 + 6 * 3.6;
      walls('shopFront', A, 30, 16, 0, 5, C(0xffffff), 5.5, 5); walls('ribbon', A, 30, 16, 5, top, C(0xffffff), 4, 3.6); boxAt('trim', A, 30.8, 0.8, 16.8, 0, top, 0, C(0xd9e4ee)); boxAt('roof', A, 29.6, 0.1, 15.6, 0, top + 0.8, 0, C(0x8fa3b5));
      boxAt('glow', A, 6, 0.3, 1.8, 0, top + 0.9, 0, C(0xe63946)); boxAt('glow', A, 1.8, 0.3, 6, 0, top + 0.9, 0, C(0xe63946));
      walls('ribbon', B, 40, 14, 0, 7.6, C(0xd8ecff), 4, 3.8); boxAt('trim', B, 40.8, 0.6, 14.8, 0, 7.6, 0, C(0xd9e4ee)); boxAt('roof', B, 39.6, 0.1, 13.6, 0, 8.2, 0, C(0x8fa3b5));
      geoAt('detail', CYL, B, 10, 8.4, 0, C(0xffd21f), 0, 5.6, 0.3, 5.6); geoAt('detail', CYL, B, 10, 8.55, 0, C(0x3a3f48), 0, 4.9, 0.3, 4.9);
      boxAt('detail', A, 8, 0.4, 3, 0, 4.4, 9.5, C(0xe63946));
      return top + 2;
    }
    if (T === 'fire') { // the fire station: red brick, three engine doors, a drill tower
      walls('brick', M, w, d, 0, 8, C(0xc0473a), 5, 8); boxAt('trim', M, w + 0.6, 0.6, d + 0.6, 0, 8, 0, C(0xf1ead9)); boxAt('roof', M, w - 0.2, 0.1, d - 0.2, 0, 8.6, 0, C(0x6e737c));
      for (let i = -1; i <= 1; i++) boxAt('trim', M, 4.6, 4.6, 0.3, i * 6.4, 0, d / 2 + 0.15, C(0xe63946));
      walls('brick', mul(M, w / 2 - 2.5, 0, -d / 2 + 2.5), 5, 5, 8, 17, C(0xb35a42), 5, 4.5); boxAt('trim', M, 5.6, 0.6, 5.6, w / 2 - 2.5, 17, -d / 2 + 2.5, C(0xf1ead9));
      return 18;
    }
    if (T === 'stadium') { // an oval bowl in two colours, a striped pitch and four floodlights
      const V = (x, y) => new THREE.Vector2(x, y);
      geoAt('trim2', new THREE.LatheGeometry([V(31, 0), V(31, 2.6), V(44, 13), V(46, 13.6), V(46, 0)], 40), M, 0, 0, 0, C(0xf2f4f7), 0, 1, 1, 0.82);
      geoAt('trim2', new THREE.LatheGeometry([V(31.6, 2.85), V(37.5, 8)], 40), M, 0, 0, 0, C(0x2e74c9), 0, 1, 1, 0.82);
      geoAt('trim2', new THREE.LatheGeometry([V(37.5, 8), V(44, 13.2)], 40), M, 0, 0, 0, C(0xffc93c), 0, 1, 1, 0.82);
      geoAt('lawn', CYL, M, 0, 0.08, 0, C(0x5fb04a), 0, 31, 0.16, 25.4); geoAt('pitch', PLANE_X, M, 0, 0.2, 0, WHITE, 0, 48, 1, 32);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { boxAt('trim', M, 0.8, 26, 0.8, sx * 33, 0, sz * 27, C(0x8c96a0)); boxAt('glow', M, 4, 2, 1, sx * 33, 26, sz * 27, C(0xfffbe0), Math.atan2(sx, sz)); }
      return 28;
    }
    if (T === 'site') { // a tower going up: floor slabs on columns, a core, blue hoardings, site cabins
      const fl = 9;
      frameAt('trim', M, w - 2, d - 2, 2.2, 0.25, 0, 0, C(0x2e74c9));
      for (let f = 0; f <= fl; f++) boxAt('trim', M, 24, 0.5, 18, 0, f * 3.6, -3, C(0xcdc9c0));
      for (const sx of [-11.5, -3.8, 3.8, 11.5]) for (const sz of [-11.5, 5.5]) boxAt('trim', M, 0.7, fl * 3.6, 0.7, sx, 0, sz, C(0xb9b4aa));
      boxAt('trim', M, 6, fl * 3.6 + 3, 6, -6, 0, -5, C(0xa9a397));
      boxAt('trim', M, 6, 2.6, 2.5, w / 2 - 5, 0, d / 2 - 4, C(0xf2a531)); boxAt('trim', M, 6, 2.6, 2.5, w / 2 - 5, 2.6, d / 2 - 4, C(0xf4f1ea));
      return fl * 3.6 + 3;
    }
    if (T === 'greenhouse') { for (let i = 0; i < 3; i++) { geoAt('glassy', HALF, M, 0, 0, -d / 2 + 4 + i * 8, C(0xeaf6ff), 0, w, 3.4, 3.4); boxAt('lawn', M, w - 1, 0.6, 5, 0, 0, -d / 2 + 4 + i * 8, C(0x5fae4f)); } return 4; }
    if (T === 'stack') { const cc = [0xd9453b, 0x2e74c9, 0x2f8f5b, 0xf2a531, 0xe8e2d6]; for (let i = 0; i < 2; i++) for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) boxAt('trim', M, 12, 2.6, 2.5, 0, k * 2.6, (i - 0.5) * 2.8, C(pick(cc))); return 8; }
    return 4;
  }

  // ---------- placing buildings along streets: each faces its street and keeps clear of roads, the shore and each other ----------
  const placed = [];
  // footprints are turned boxes (streets on the other islands run at an angle): a quick bounding-box check, then a
  // separating-axis test
  const obb = (x, z, w, d, rot, m = 0) => { const c = Math.cos(rot), s = Math.sin(rot), ex = w / 2 + m, ez = d / 2 + m, ac = Math.abs(c), as = Math.abs(s); return { x, z, ex, ez, c, s, hw: ex * ac + ez * as, hd: ex * as + ez * ac }; };
  function apart(A, B) {
    const dx = B.x - A.x, dz = B.z - A.z;
    for (const [nx, nz] of [[A.c, -A.s], [A.s, A.c], [B.c, -B.s], [B.s, B.c]]) {
      const ra = A.ex * Math.abs(A.c * nx - A.s * nz) + A.ez * Math.abs(A.s * nx + A.c * nz), rb = B.ex * Math.abs(B.c * nx - B.s * nz) + B.ez * Math.abs(B.s * nx + B.c * nz);
      if (Math.abs(dx * nx + dz * nz) > ra + rb) return true;
    }
    return false;
  }
  const overlaps = (x, z, w, d, rot) => {
    const A = obb(x, z, w, d, rot, 1.2);
    for (const p of placed) if (Math.abs(p.x - x) < A.hw + p.hw && Math.abs(p.z - z) < A.hd + p.hd && !apart(A, p.ex != null ? p : obb(p.x, p.z, p.hw * 2, p.hd * 2, 0))) return true;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const lx = i * w / 2, lz = j * d / 2, px = x + lx * A.c + lz * A.s, pz = z - lx * A.s + lz * A.c; if (roadF(px, pz) < 3.2 || landF(px, pz) < 18) return true; }
    return false;
  };
  function claimRect(x, z, w, d, rot) { placed.push(obb(x, z, w, d, rot)); }
  const claim = b => claimRect(b.x, b.z, b.w, b.d, b.rot);
  let nextId = 1;
  const STREETS = { centre: ['Harbour Row', 'Bank Street', 'Mint Lane', 'Exchange Place'], oldtown: ['Shell Street', 'Lantern Lane', 'Orchard Road', 'Kite Street', 'Bell Lane'], northgate: ['Summit Road', 'Ridge View', 'Skylark Way'], harbour: ['Quay Road', 'Anchor Way', 'Net Street'], marina: ['Promenade'],
    hillcrest: ['Hillcrest Drive', 'Laurel Way', 'Fern Lane'], farms: ['Meadow Lane', 'Mill Track'], beach: ['Beach Road'], mill: ['Ridge Road'], golf: ['Links Road'], pine: ['Camp Road', 'Sawmill Lane'], coral: ['Coral Drive', 'Lagoon Road', 'Palm Walk'], gull: ['Gull Lane'] };
  function along(s, side, gap, make, Z) {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz * side, nz = ux * side;
    for (let t = 13; t < L - 13;) {
      const spec = make(); if (!spec) break;
      const mid = t + spec.w / 2; if (mid + spec.w / 2 > L - 13) break;
      const offs = s.w / 2 + 3 + 1.6 + spec.d / 2, x = s.a[0] + ux * mid + nx * offs, z = s.a[1] + uz * mid + nz * offs, yd = spec.yd || 0;
      const rot = Math.atan2(-nx, -nz); // the model's front (+z) faces the street
      const zone = Z || zoneAt(x, z), lx = x + nx * yd / 2, lz = z + nz * yd / 2; // a garden runs back from the house
      if (zone && !overlaps(lx, lz, spec.w + (yd ? 2.4 : 0), spec.d + yd, rot)) {
        const names = STREETS[zone.id] || ['Island Road'], b = Object.assign({ id: 'b' + nextId++, x, z, rot, district: zone.name, zoneId: zone.id, isle: zone.isle, street: names[Math.abs(Math.round(s.a[0] + s.a[1])) % names.length] }, spec);
        b.name = `${1 + Math.floor(rnd() * 90)} ${b.street}`;
        claimRect(lx, lz, spec.w + (yd ? 2.4 : 0), spec.d + yd, rot); addBuilding(b);
        t += spec.w + gap();
      } else t += 4;
    }
  }
  const faceRoad = (x, z) => { let best = 0, bd = 1e9; for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const d = roadF(x + Math.sin(r) * 24, z + Math.cos(r) * 24); if (d < bd) { bd = d; best = r; } } return best; };
  const special = (b, d) => { Object.assign(b, { district: d.name, zoneId: d.id, street: (STREETS[d.id] || ['Island Road'])[0], owner: b.owner || 'city' }); claim(b); addBuilding(b); return b; };
  const zById = id => ZONES.find(z => z.id === id);

  const places = {}; // job sites: where timber is cut, stored, bought and shipped
  function buildTown() {
    facades();
    // landmarks first, so the streets fill in round them
    const tower = special({ id: 'tower', type: 'tower', name: 'Capital Tower', w: 34, d: 34, floors: 18, x: 40, z: -100, rot: 0 }, zById('centre'));
    tower.street = 'Exchange Place';
    special({ id: 'hall', type: 'hall', name: 'City Hall', w: 40, d: 26, x: -40, z: -108, rot: 0 }, zById('centre'));
    placed.push({ x: -40, z: -20, hw: 34, hd: 34 }); // Founders Park
    World.park = [-40, -20];
    places.site = { b: special({ id: 'site', type: 'site', name: 'Capital Builders site', w: 50, d: 46, x: 120, z: -176, rot: 0 }, zById('centre')), pile: [104, -160], dock: [100, -140] };
    // the starter walk-up, on Shell Street in Old Town, two blocks from the beach and the avenue
    const home = { id: 'home', type: 'starter', name: '14 Shell Street', w: 13, d: 15, floors: 3, x: 0, z: 0, rot: 0, color: 0xd9906f, district: 'Old Town', zoneId: 'oldtown', street: 'Shell Street', owner: 'you' };
    home.x = 400 - (4 + 4.6 + home.d / 2); home.z = -12; home.rot = Math.PI / 2; // west side of Lantern Lane, facing the street
    claim(home); addBuilding(home); World.home = home;
    special({ id: 'church', type: 'church', name: "St Brendan's", w: 16, d: 30, x: 280, z: -205, rot: 0 }, zById('oldtown'));
    special({ id: 'fire', type: 'fire', name: 'Fire Station', w: 24, d: 16, x: 520, z: 50, rot: 0 }, zById('oldtown'));
    special({ id: 'school', type: 'school', name: 'Northgate School', w: 60, d: 50, x: 280, z: -362, rot: 0 }, zById('northgate'));
    special({ id: 'hospital', type: 'hospital', name: 'Island Hospital', w: 46, d: 40, x: 440, z: -362, rot: 0 }, zById('northgate'));
    special({ id: 'stadium', type: 'stadium', name: 'Marina Stadium', w: 96, d: 80, x: 432, z: 386, rot: 0 }, zById('marina'));
    ferris(special({ id: 'wheel', type: 'wheel', name: 'The Big Wheel', w: 22, d: 10, x: 548, z: 372, rot: -0.35 }, zById('marina')));
    places.quay = { b: special({ id: 'yard', type: 'warehouse', name: 'Harbour Timber Yard', w: 34, d: 22, x: 80, z: 262, rot: -Math.PI / 2, color: 0xe8d5b0, roof: 0x8a5a44 }, zById('harbour')), pile: [112, 272], dock: [62, 280] };
    placed.push({ x: 112, z: 272, hw: 9, hd: 9 });
    special({ id: 'club', type: 'home', name: 'Capital Links Clubhouse', w: 24, d: 14, floors: 1, style: 1, color: 0xffffff, roof: 0x3f8f7a, x: -278, z: -100, rot: Math.PI / 2 }, zById('golf'));
    placed.push({ x: -40, z: -300, hw: 11, hd: 9 }); // the mill's log yard
    seed = 11;
    const HOME = () => rnd() < 0.62 ? { type: 'home', w: 10 + rnd() * 2, d: 9 + rnd() * 2, yd: 9 } : { type: 'apart', w: 12 + rnd() * 3, d: 13, floors: 3 + (rnd() < 0.3 ? 1 : 0) };
    for (const s of R) {
      const zone = zoneAt((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2); if (!zone || s.kind === 'bridge') continue;
      for (const side of [1, -1]) {
        if (zone.id === 'centre') along(s, side, () => 5, () => s.kind === 'avenue' ? { type: 'shop', w: 14 + rnd() * 4, d: 13, floors: 2 + (rnd() < 0.5 ? 1 : 0) } : { type: 'office', w: 22 + rnd() * 8, d: 20 + rnd() * 6, floors: 4 + Math.floor(rnd() * 9) });
        else if (zone.id === 'oldtown') along(s, side, () => 4, () => s.kind === 'avenue' ? { type: 'shop', w: 13 + rnd() * 3, d: 12, floors: 2 } : HOME());
        else if (zone.id === 'northgate') along(s, side, () => 5, () => rnd() < 0.7 ? { type: 'villa', w: 13 + rnd() * 3, d: 11, yd: 13 } : { type: 'home', w: 11, d: 10, yd: 11, floors: 2 });
        else if (zone.id === 'hillcrest') along(s, side, () => 4, () => ({ type: 'home', w: 9.5 + rnd() * 2.5, d: 9 + rnd() * 2, yd: 10, floors: rnd() < 0.35 ? 1 : 2 }));
        else if (zone.id === 'marina') along(s, side, () => side > 0 ? 18 : 4, () => side > 0 ? { type: 'kiosk', w: 5, d: 4 } : { type: 'shop', w: 13 + rnd() * 3, d: 12, floors: 2, sign: pick([0, 3, 8, 11, 15]) });
        else if (zone.id === 'harbour') along(s, side, () => 8, () => s.kind === 'avenue' ? { type: 'shop', w: 15, d: 13, floors: 2 } : rnd() < 0.7 ? { type: 'warehouse', w: 30 + rnd() * 12, d: 22 + rnd() * 4 } : { type: 'factory', w: 36, d: 26 });
        else if (zone.id === 'farms' && s.kind === 'lane') along(s, side, () => 60, () => rnd() < 0.5 ? { type: 'barn', w: 14, d: 10 } : { type: 'home', w: 10, d: 9, roof: 0x7a4e3a, yd: 8 });
        else if (zone.id === 'mill') along(s, side, () => 12, () => ({ type: 'mill', w: 22 + rnd() * 8, d: 14 }));
        else if (zone.id === 'beach' && side === 1) along(s, side, () => 60, () => ({ type: 'kiosk', w: 5, d: 4 }));
      }
    }
    const mill = buildings.filter(b => b.type === 'mill').sort((a, b) => Math.hypot(a.x + 20, a.z + 300) - Math.hypot(b.x + 20, b.z + 300))[0];
    mill.name = 'Pine Ridge Sawmill'; mill.owner = 'city';
    places.mill = { b: mill, pile: [-40, -300], dock: [0, -300] };
    // Harbourside yards: a second row of sheds, and stacks of containers wherever there's room
    seed = 21;
    for (let x = -190; x <= 290; x += 24) for (let z = 128; z <= 286; z += 22) {
      if (zoneAt(x, z) !== zById('harbour')) continue;
      const shed = rnd() < 0.45, w = shed ? 20 : 14, d = shed ? 14 : 8, rot = rnd() < 0.5 ? 0 : Math.PI / 2;
      if (overlaps(x, z, w, d, rot)) continue;
      const b = { id: 'b' + nextId++, type: shed ? 'warehouse' : 'stack', w, d, x, z, rot, district: 'Harbourside', zoneId: 'harbour', street: 'Anchor Way' };
      b.name = `Yard ${nextId} Anchor Way`; claim(b);
      if (shed) addBuilding(b); else { tileKey = tileOf(x, z); drawOther(b, new THREE.Matrix4().makeRotationY(rot).setPosition(x, GROUND, z), w, d); }
    }
    fillBlocks();
    streetLife();
    flush();
  }
  // the insides of the blocks: second-row offices, car parks and plazas in the centre; gardens, playgrounds and pools elsewhere
  function fillBlocks() {
    seed = 33;
    for (const Z of ZONES) {
      if (!['centre', 'oldtown', 'northgate', 'hillcrest', 'marina'].includes(Z.id)) continue;
      const step = Z.id === 'centre' ? 22 : 13;
      for (let x = Z.x0 + step / 2; x < Z.x1; x += step) for (let z = Z.z0 + step / 2; z < Z.z1; z += step) {
        if (zoneAt(x, z) !== Z) continue;
        if (Z.id === 'centre') {
          const rot = faceRoad(x, z);
          if (!overlaps(x, z, 20, 18, rot)) { const b = { id: 'b' + nextId++, type: 'office', w: 20, d: 18, floors: 3 + Math.floor(rnd() * 6), x, z, rot, district: Z.name, zoneId: Z.id, street: pick(STREETS.centre) }; b.name = `${1 + Math.floor(rnd() * 90)} ${b.street}`; claim(b); addBuilding(b); }
          else if (!overlaps(x, z, 16, 12, 0)) carPark(x, z, 16, 12);
          else if (!overlaps(x, z, 6, 6, 0)) { claimRect(x, z, 6, 6, 0); extraTrees.push([x, GROUND, z, 0.7, 0]); }
        } else if (!overlaps(x, z, 10, 10, 0)) garden(x, z);
      }
    }
    // trees and shrubs in every leftover gap between the gardens, so no block is bare lawn
    const free = (x, z, pad) => !placed.some(p => Math.abs(p.x - x) < p.hw + pad && Math.abs(p.z - z) < p.hd + pad);
    for (const id of ['oldtown', 'northgate', 'hillcrest', 'marina']) {
      const Z = zById(id);
      for (let x = Z.x0 + 3; x < Z.x1; x += 6.5) for (let z = Z.z0 + 3; z < Z.z1; z += 6.5) {
        const px = x + (rnd() - 0.5) * 3, pz = z + (rnd() - 0.5) * 3;
        if (zoneAt(px, pz) !== Z || roadF(px, pz) < 5.5 || landF(px, pz) < 20 || !free(px, pz, 1.2) || rnd() < 0.3) continue;
        extraTrees.push([px, GROUND, pz, 0.45 + rnd() * 0.35, rnd() < 0.35 ? 5 : rnd() < 0.05 ? 3 : 0]);
      }
    }
    // Pine Ridge: stacks of sawn timber by the sheds, and a young plantation in rows round the mill
    const Zm = zById('mill');
    for (let i = 0; i < 40; i++) { const x = Zm.x0 + 10 + rnd() * (Zm.x1 - Zm.x0 - 20), z = Zm.z0 + 10 + rnd() * (Zm.z1 - Zm.z0 - 20); if (overlaps(x, z, 7, 4, 0)) continue; claimRect(x, z, 7, 4, 0); tileKey = tileOf(x, z); const M = new THREE.Matrix4().setPosition(x, GROUND, z); boxAt('lawn', M, 8, 0.12, 5, 0, 0, 0, C(0xc9b89a)); for (let k = 0; k < 2; k++) boxAt('trim', M, 6, 1.4, 1.6, 0, k * 1.42, k ? 0.9 : -0.9, C(pick([0xe0bb8a, 0xd4ad7a, 0xe8c99a]))); }
    for (let x = Zm.x0 + 4; x < Zm.x1; x += 7) for (let z = Zm.z0 + 4; z < Zm.z1; z += 7) if (roadF(x, z) > 7 && free(x, z, 2)) extraTrees.push([x, GROUND, z, 0.5 + rnd() * 0.15, 1]);
  }
  function carPark(x, z, w, d) {
    claimRect(x, z, w, d, 0); tileKey = tileOf(x, z); const M = new THREE.Matrix4().setPosition(x, GROUND, z);
    boxAt('lawn', M, w, 0.14, d, 0, 0, 0, C(0x5c616b));
    for (let i = 0; i <= 5; i++) { const px = -w / 2 + 1 + i * (w - 2) / 5; boxAt('lawn', M, 0.2, 0.16, 4.6, px, 0, -d / 2 + 2.6, C(0xf4f4f0)); boxAt('lawn', M, 0.2, 0.16, 4.6, px, 0, d / 2 - 2.6, C(0xf4f4f0)); if (i < 5) for (const sz of [-1, 1]) if (rnd() < 0.7) parked.push([x + px + (w - 2) / 10, GROUND + 0.14, z + sz * (d / 2 - 2.6), sz > 0 ? Math.PI : 0]); }
  }
  function garden(x, z) {
    claimRect(x, z, 10, 10, 0); tileKey = tileOf(x, z); const M = new THREE.Matrix4().setPosition(x, GROUND, z), r = rnd();
    boxAt('lawn', M, 11, 0.12, 11, 0, 0, 0, C(pick(WALLS.lot)));
    if (r < 0.45) { extraTree(M, -2.5, -2, 0.7); extraTree(M, 2.6, 2.4, 0.55); }
    else if (r < 0.62) { boxAt('lawn', M, 8, 0.16, 8, 0, 0, 0, C(0xf2d48f)); boxAt('trim', M, 0.5, 2.6, 0.5, -2, 0, -2, C(0xe94f4f)); boxAt('trim', M, 3, 0.3, 1, -0.8, 2.4, -2, C(0xffd21f)); boxAt('trim', M, 1, 1.6, 3, 2.2, 0, 1.5, C(0x2e74c9)); boxAt('trim', M, 2.4, 0.2, 0.4, 2, 1.8, -2.4, C(0x8a4fd6)); } // a playground
    else if (r < 0.75) { frameAt('trim', M, 5.4, 8, 0.45, 0.45, 0, 0, C(0xf7f5f0)); boxAt('water', M, 4.6, 0.3, 7.2, 0, 0, 0, C(0x45c9ec)); extraTree(M, 4, 4, 0.5); } // a pool
    else { for (let i = 0; i < 4; i++) boxAt('trim', M, 7, 0.45, 1, 0, 0.1, -3 + i * 2, C(pick([0x5fae4f, 0x3f8f3f, 0xe85d3f, 0xf2a531]))); extraTree(M, 4, -4, 0.45); } // a vegetable plot
  }
  // street trees and lamps along every town street, and the parked cars
  const LAMPS = [];
  function streetLife() {
    const hits = (x, z) => placed.some(p => Math.abs(p.x - x) < p.hw + 0.6 && Math.abs(p.z - z) < p.hd + 0.6);
    for (const s of R) {
      const zn = zoneAt((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2); if (!zn || !TOWN.has(zn.id) || s.kind === 'bridge' || s.kind === 'lane') continue;
      const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
      for (let t = 12, i = 0; t < L - 12; t += 11, i++) for (const side of [1, -1]) {
        const nx = -uz * side, nz = ux * side, off = s.w / 2 + 1.7, x = s.a[0] + ux * t + nx * off, z = s.a[1] + uz * t + nz * off;
        if (hits(x, z)) continue;
        if ((i + (side > 0 ? 0 : 2)) % 4 === 0) LAMPS.push([x, GROUND + 0.18, z, 1, Math.atan2(-nx, -nz)]);
        else if ((i + (side > 0 ? 0 : 2)) % 4 === 2 && zn.id !== 'harbour') extraTrees.push([x, GROUND + 0.18, z, 0.58, 0]);
      }
    }
  }

  // ---------- farms, the golf course and Marina Park ----------
  function buildFarms() { // a patchwork of fields: wheat, corn, lavender, sunflowers, vegetables, pasture, orchards, greenhouses
    const Z = zById('farms'), kinds = ['wheat', 'corn', 'lavender', 'sun', 'pasture', 'orchard', 'veg', 'green', 'wheat', 'pasture', 'corn'];
    seed = 41;
    for (const [W, D] of [[50, 38], [30, 22], [18, 14]]) // big fields first, then smaller ones in the gaps by the lanes
      for (let x = Z.x0 + 4; x + W < Z.x1; x += W / 2) for (let z = Z.z0 + 4; z + D < Z.z1; z += D / 2) {
        const cx = x + W / 2, cz = z + D / 2;
        if (overlaps(cx, cz, W - 2.4, D - 2.4, 0) || [[x, z], [x + W, z], [x, z + D], [x + W, z + D], [cx, cz]].some(([px, pz]) => roadDist(px, pz) < 5 || land(px, pz) < 26)) continue;
        claimRect(cx, cz, W, D, 0); noTrees.push([x - 2, z - 2, x + W + 2, z + D + 2]);
        field(W < 20 ? pick(['veg', 'green', 'orchard', 'lavender']) : pick(kinds), cx, cz, W, D);
      }
  }
  const BALE = new THREE.CylinderGeometry(0.8, 0.8, 1.4, 10).rotateZ(Math.PI / 2);
  function field(kind, cx, cz, W, D) {
    tileKey = tileOf(cx, cz); const M = new THREE.Matrix4().setPosition(cx, GROUND, cz);
    boxAt('lawn', M, W, 0.12, D, 0, 0, 0, C({ wheat: 0xe7c45a, corn: 0x8a6b4a, lavender: 0x8f7458, sun: 0x8a6b4a, pasture: 0x93d46b, orchard: 0x88c95f, veg: 0x8f6e4e, green: 0xd8d2c4 }[kind]));
    const rows = (gap, f) => { for (let z = -D / 2 + 1.6; z < D / 2 - 1; z += gap) f(z); };
    if (kind === 'wheat') { rows(4, z => boxAt('lawn', M, W - 1, 0.17, 1.4, 0, 0, z, C(0xd6ad45))); for (let i = 0; i < 5; i++) geoAt('trim', BALE, M, (rnd() - 0.5) * (W - 6), 0.9, (rnd() - 0.5) * (D - 6), C(0xf0d67e), rnd() * 3); }
    else if (kind === 'corn') rows(2.4, z => { boxAt('trim', M, W - 2, 1.7, 1.1, 0, 0.12, z, C(0x6fae3f)); boxAt('trim', M, W - 2, 0.25, 0.7, 0, 1.82, z, C(0xd9c25a)); });
    else if (kind === 'lavender') rows(2.2, z => boxAt('trim', M, W - 2, 0.8, 1.2, 0, 0.12, z, C(0x9b7fd4)));
    else if (kind === 'sun') rows(2.4, z => { boxAt('trim', M, W - 2, 1.3, 0.8, 0, 0.12, z, C(0x5f9e3f)); boxAt('trim', M, W - 2, 0.4, 1.2, 0, 1.42, z, C(0xffd21f)); });
    else if (kind === 'veg') { let i = 0; rows(2, z => boxAt('trim', M, W - 2, 0.45, 1, 0, 0.12, z, C([0x5fae4f, 0x3f8f3f, 0xe85d3f, 0xf2a531][i++ % 4]))); }
    else if (kind === 'pasture') { frameAt('trim', M, W - 1, D - 1, 1, 0.15, 0, 0, C(0xf7f3ea)); for (let i = 0; i < 6; i++) { const x = (rnd() - 0.5) * (W - 8), z = (rnd() - 0.5) * (D - 8), a = rnd() * 6, c = C(rnd() < 0.6 ? 0xf7f5f0 : 0x8a5a3c); boxAt('trim', M, 1.8, 0.7, 0.9, x, 0, z, C(0x3b3b3b), a); boxAt('trim', M, 2.4, 1.1, 1.1, x, 0.7, z, c, a); boxAt('trim', M, 0.8, 0.8, 0.8, x + Math.cos(a) * 1.5, 1.1, z - Math.sin(a) * 1.5, c, a); } }
    else if (kind === 'orchard') { for (let x = -W / 2 + 4; x < W / 2 - 2; x += 6) for (let z = -D / 2 + 4; z < D / 2 - 2; z += 6) extraTree(M, x, z, 0.5, 2); }
    else if (kind === 'green') { const b = { type: 'greenhouse' }; drawOther(b, M, W - 4, D - 8); }
  }
  const DISC = new THREE.CylinderGeometry(1, 1, 1, 28);
  function buildGolf() { // Capital Links: four fairways, greens with flags, bunkers, a pond, trees in the rough
    seed = 61; tileKey = 'golf'; const M = new THREE.Matrix4().setPosition(0, GROUND, 0), Z = zById('golf');
    const holes = [[[-460, -232], [-330, -228]], [[-300, -240], [-232, -170]], [[-300, -134], [-440, -168]], [[-462, -118], [-372, -104]]], fair = [];
    for (const [a, b] of holes) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 9);
      for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, r = 11 + Math.sin(t * Math.PI) * 3; geoAt('lawn', DISC, M, x, 0.06 + (i % 2) * 0.01, z, C(i % 2 ? 0x9be06a : 0x8ad35c), 0, r, 0.12, r); fair.push([x, z, r]); }
      boxAt('lawn', M, 6, 0.2, 6, a[0], 0, a[1], C(0xb9ee90));
      geoAt('lawn', DISC, M, b[0], 0.1, b[1], C(0xbff29a), 0, 8, 0.12, 8);
      for (let k = 0; k < 2; k++) { const ang = rnd() * 6.28; geoAt('lawn', DISC, M, b[0] + Math.cos(ang) * 11, 0.12, b[1] + Math.sin(ang) * 11, C(0xf3e2a6), ang, 4.5, 0.12, 2.8); }
      boxAt('trim', M, 0.15, 3.4, 0.15, b[0] + 1.5, 0.1, b[1], C(0xffffff)); boxAt('glow', M, 1.6, 1, 0.08, b[0] + 2.3, 2.6, b[1], C(0xe63946));
    }
    geoAt('water', DISC, M, -390, 0.14, -195, C(0x3fb6e0), 0.3, 18, 0.14, 11);
    for (let i = 0; i < 900; i++) { const x = Z.x0 + 6 + rnd() * (Z.x1 - Z.x0 - 12), z = Z.z0 + 6 + rnd() * (Z.z1 - Z.z0 - 12); if (fair.some(f => Math.hypot(f[0] - x, f[1] - z) < f[2] + 6) || Math.hypot(x + 390, z + 195) < 24 || roadDist(x, z) < 6 || placed.some(p => Math.abs(p.x - x) < p.hw + 3 && Math.abs(p.z - z) < p.hd + 3)) continue; extraTrees.push([x, GROUND, z, 0.7 + rnd() * 0.4, rnd() < 0.35 ? 1 : 0]); }
  }
  function buildMarina() { // wooden piers into the bay, moored boats and sailboats
    seed = 71; tileKey = 'marina'; const M = new THREE.Matrix4();
    for (const x of [330, 368, 406]) {
      const z0 = 432 + (x - 330) * 0.22, L = 64;
      boxAt('trim', M, 4, 0.5, L, x, 1.4, z0 + L / 2, C(0xb08559));
      for (let z = z0 + 4; z < z0 + L; z += 8) for (const sx of [-2, 2]) boxAt('trim', M, 0.45, 6, 0.45, x + sx, -4.2, z, C(0x6b4a33));
      for (let z = z0 + 10; z < z0 + L - 4; z += 11) for (const sx of [-1, 1]) {
        if (rnd() < 0.25) continue; const bx = x + sx * 6.5, Mb = mul(M, bx, 0.1, z, Math.PI / 2), c = C(pick([0xffffff, 0xf4f1ea, 0x2e74c9, 0xe94f4f]));
        boxAt('trim', Mb, 8, 1.4, 2.8, 0, 0, 0, c); boxAt('trim', Mb, 7.4, 0.2, 2.4, 0, 1.4, 0, C(0xc79b6b));
        if (rnd() < 0.5) { boxAt('trim', Mb, 2.6, 1.2, 2, -1, 1.6, 0, C(0xf4f1ea)); } else { boxAt('trim', Mb, 0.16, 9, 0.16, 0.6, 1.6, 0, C(0xeeeeee)); const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0.6, 2.4, 0, 0.6, 10.2, 0, -3, 2.4, 0], 3)); sail.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0], 2)); sail.computeVertexNormals(); addGeo('trim2', sail, Mb, C(0xffffff)); }
      }
    }
  }

  // ---------- moving landmarks: the Big Wheel, the tower crane, wind turbines ----------
  const SM = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.6 });
  function ferris(b) {
    const g = new THREE.Group(), R0 = 17, hub = R0 + 4; g.position.set(b.x, GROUND, b.z); g.rotation.y = b.rot; b.h = hub + R0;
    const L = Math.hypot(5.5, hub), leg = new THREE.BoxGeometry(0.8, L, 0.8), white = SM(0xf4f1ea);
    for (const sz of [-2.4, 2.4]) for (const sx of [-1, 1]) { const o = new THREE.Mesh(leg, white); o.position.set(sx * 2.75, hub / 2, sz); o.rotation.z = Math.atan2(sx * 5.5, hub); o.castShadow = true; g.add(o); }
    const wheel = new THREE.Group(); wheel.position.y = hub; g.add(wheel);
    for (const z of [-1.4, 1.4]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.32, 6, 48), white); rim.position.z = z; wheel.add(rim); }
    const hubM = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 5.6, 12).rotateX(Math.PI / 2), SM(0xe94f4f)); wheel.add(hubM);
    const cabins = [], cols = [0xe94f4f, 0xffd21f, 0x2e74c9, 0x2fbf6a, 0xff6f91, 0x8a4fd6];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, sp = new THREE.Mesh(new THREE.BoxGeometry(0.25, R0, 0.25), white); sp.position.set(Math.cos(a) * R0 / 2, Math.sin(a) * R0 / 2, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
      const cab = new THREE.Group(); cab.position.set(Math.cos(a) * R0, Math.sin(a) * R0, 0);
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2.2), SM(cols[i % cols.length])); body.position.y = -1.6; body.castShadow = true; cab.add(body);
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.9, 4), white); top.rotation.y = Math.PI / 4; top.position.y = -0.2; cab.add(top);
      wheel.add(cab); cabins.push(cab);
    }
    scene.add(g);
    tick.push(dt => { wheel.rotation.z += dt * 0.1; for (const c of cabins) c.rotation.z = -wheel.rotation.z; });
  }
  function towerCrane(x, z, H) {
    const g = new THREE.Group(), y = SM(0xffc21f), dark = SM(0x2b3440); g.position.set(x, GROUND, z);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.8, H, 1.8), y); mast.position.y = H / 2; mast.castShadow = true; g.add(mast);
    const top = new THREE.Group(); top.position.y = H; g.add(top);
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; top.add(o); return o; };
    add(new THREE.BoxGeometry(44, 1.3, 1.3), y, 16, 0, 0); add(new THREE.BoxGeometry(14, 1.1, 1.1), y, -7, 0, 0); add(new THREE.BoxGeometry(4, 3, 2.4), SM(0x9aa3ab), -12, -1.8, 0);
    add(new THREE.BoxGeometry(2.4, 2.4, 2.4), dark, 1.8, -1.6, 1.6); add(new THREE.BoxGeometry(0.8, 6, 0.8), y, 0, 3, 0);
    add(new THREE.BoxGeometry(0.1, 18, 0.1), dark, 30, -9, 0); add(new THREE.BoxGeometry(1.2, 1, 1.2), SM(0xe94f4f), 30, -18.5, 0);
    scene.add(g);
    tick.push((dt, t) => { top.rotation.y = Math.sin(t * 0.08) * 1.4; });
  }
  function buildTurbines() { // wind turbines along the western and northern ridges
    seed = 51; const white = SM(0xf7f9fb);
    for (let i = 0; i < 400 && turbines.length < 9; i++) {
      const x = -720 + rnd() * 900, z = -520 + rnd() * 560, s = land(x, z); if (s < 70 || zoneAt(x, z) || roadDist(x, z) < 40) continue;
      const h = heightAt(x, z, s); if (h < 24 || turbines.some(t => Math.hypot(t[0] - x, t[1] - z) < 130)) continue;
      turbines.push([x, z]);
      const g = new THREE.Group(); g.position.set(x, h - 1, z); g.rotation.y = 0.9;
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.3, 42, 10), white); tw.position.y = 21; tw.castShadow = true; g.add(tw);
      const nac = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 5.5), white); nac.position.set(0, 42.5, 0.8); g.add(nac);
      const rotor = new THREE.Group(); rotor.position.set(0, 42.5, 3.8); g.add(rotor);
      rotor.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), white));
      for (let k = 0; k < 3; k++) { const p = new THREE.Group(); p.rotation.z = k * Math.PI * 2 / 3; const bl = new THREE.Mesh(new THREE.BoxGeometry(1, 19, 0.35), white); bl.position.y = 9.8; bl.castShadow = true; p.add(bl); rotor.add(p); }
      const sp = 0.8 + rnd() * 0.5; scene.add(g); tick.push(dt => { rotor.rotation.z += dt * sp; });
    }
  }

  // ---------- the harbour: quay walls, cranes, containers and ships ----------
  const MAT = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.8 });
  function hull(L, B, H, c, deckC) {
    const s = new THREE.Group(), shape = new THREE.Shape();
    shape.moveTo(-L / 2, -B / 2); shape.lineTo(L / 2 - B * 0.9, -B / 2); shape.quadraticCurveTo(L / 2 + B * 0.2, 0, L / 2 - B * 0.9, B / 2); shape.lineTo(-L / 2, B / 2); shape.lineTo(-L / 2, -B / 2);
    const hm = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false }).rotateX(-Math.PI / 2), MAT(c)); hm.position.y = -1.2; hm.castShadow = true; s.add(hm);
    const dk = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), MAT(deckC)); dk.position.y = H - 1.19; s.add(dk); return s;
  }
  const CONT = [0xd9453b, 0x2e74c9, 0x2f8f5b, 0xf2a531, 0x8a4fd6, 0xe8e2d6];
  function buildHarbour() {
    const g = new THREE.Group();
    const box = (w, h, d, x, y, z, m, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    // the quay: a stone wall along the bay, with bollards
    const qy = GROUND + 0.2;
    box(340, qy + 7, 48, 52, -7, 334, MAT(0xb7b0a2));
    box(340, 0.3, 48, 52, qy - 0.1, 334, MAT(0xcfc9bb));
    for (let x = -112; x <= 216; x += 14) box(0.7, 0.9, 0.7, x, qy + 0.2, 356, MAT(0x2e3640));
    // two gantry cranes
    for (const x of [-30, 110]) {
      const m = MAT(0xf2a531), dark = MAT(0x2b3440);
      box(1.2, 26, 1.2, x - 7, qy, 336, m); box(1.2, 26, 1.2, x + 7, qy, 336, m); box(1.2, 26, 1.2, x - 7, qy, 352, m); box(1.2, 26, 1.2, x + 7, qy, 352, m);
      box(16, 2.2, 52, x, qy + 26, 360, m); box(5, 4, 6, x, qy + 28, 350, dark); box(0.3, 14, 0.3, x, qy + 14, 372, dark);
    }
    // stacks of containers
    const cols = CONT.map(c => MAT(c));
    seed = 5;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) box(12, 2.6, 2.6, -95 + i * 16 + (i > 2 ? 60 : 0), qy + k * 2.6, 312 + j * 3, pick(cols));
    // ships: a container ship at the quay, a ferry, fishing boats and sailboats in the bay
    const ship = hull(70, 13, 6, 0x1f3f6b, 0x8c5a40); ship.position.set(70, 0, 367);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) for (let j = 0; j < 4; j++) { const c = new THREE.Mesh(new THREE.BoxGeometry(11, 2.5, 2.5), pick(cols)); c.position.set(-18 + i * 12, 6.1 + k * 2.6, -3.9 + j * 2.6); c.castShadow = true; ship.add(c); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 11), MAT(0xf4f1ea)); br.position.set(-29, 8.6, 0); br.castShadow = true; ship.add(br);
    g.add(ship);
    const ferry = hull(38, 10, 4, 0xf4f1ea, 0xdfe6ec); ferry.position.set(-60, 0, 420); ferry.rotation.y = 0.5;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 8), MAT(0x2e74c9)); cab.position.set(-2, 5, 0); ferry.add(cab); g.add(ferry);
    const boats = [];
    for (let i = 0; i < 6; i++) { const b = hull(9, 3.2, 2, pick([0xe94f4f, 0xf4f1ea, 0x2f8f5b, 0xf2a531]), 0xc79b6b); b.position.set(-100 + i * 50 + rnd() * 20, 0, 380 + rnd() * 70); b.rotation.y = rnd() * 6; if (i % 2) { const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9), MAT(0xeeeeee)); mast.position.y = 5.5; b.add(mast); const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 9.5, 0), new THREE.Vector3(0, 1.5, 3.8)]), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })); sail.geometry.computeVertexNormals(); b.add(sail); } g.add(b); boats.push(b); }
    tick.push((dt, t) => { boats.forEach((b, i) => { b.position.y = Math.sin(t * 1.2 + i) * 0.18; b.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.03; }); ship.position.y = Math.sin(t * 0.5) * 0.08; ferry.position.y = Math.sin(t * 0.8) * 0.12; });
    // a wooden pier for the fishing boats
    box(6, 0.4, 60, -150, qy - 0.6, 395, MAT(0xa77b52)); for (let z = 370; z <= 422; z += 8) for (const x of [-152.5, -147.5]) box(0.5, 8, 0.5, x, -6, z, MAT(0x6b4a33));
    // the lighthouse on its islet
    const lh = new THREE.Group(); lh.position.set(ISLET.x + 10, GROUND, ISLET.z + 18);
    const seg = (r0, r1, h, y, c) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 16), MAT(c)); o.position.y = y + h / 2; o.castShadow = true; lh.add(o); };
    seg(4.2, 3.6, 7, 0, 0xf4f1ea); seg(3.6, 3.1, 7, 7, 0xd9453b); seg(3.1, 2.7, 7, 14, 0xf4f1ea); seg(2.7, 2.4, 3, 21, 0xd9453b);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3, 12), new THREE.MeshStandardMaterial({ color: lin(0xfff3b0), emissive: lin(0x8a6a10) })); lamp.position.y = 25.5; lh.add(lamp);
    const capm = new THREE.Mesh(new THREE.ConeGeometry(3, 3, 12), MAT(0x2b3440)); capm.position.y = 28.5; lh.add(capm);
    g.add(lh);
    scene.add(g);
    towerCrane(132, -190, 52);
    buildTurbines();
  }

  // ---------- trees, palms, bushes, rocks, lamps: instanced, split into map tiles ----------
  function mergeColored(list) { // [[geometry, colour]] -> one geometry with vertex colours
    const pos = [], nor = [], col = [];
    for (const [geo, c] of list) { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
  }
  const TRUNK = new THREE.Color(0.55, 0.42, 0.34), LEAF = new THREE.Color(1, 1, 1);
  let TREE_GEO = null;
  function treeGeos() {
    if (TREE_GEO) return TREE_GEO;
    const trunk = (h, r) => new THREE.CylinderGeometry(r * 0.75, r, h, 5, 1, true).translate(0, h / 2, 0);
    TREE_GEO = {
      round: mergeColored([[trunk(3.4, 0.45), TRUNK], [new THREE.IcosahedronGeometry(3.1, 0).scale(1, 1.12, 1).translate(0, 5.8, 0), LEAF]]),
      fancy: mergeColored([[trunk(3.4, 0.45), TRUNK], [new THREE.IcosahedronGeometry(2.8, 0).translate(0, 5.6, 0), LEAF], [new THREE.IcosahedronGeometry(2.1, 0).translate(1.3, 7.1, 0.7), LEAF], [new THREE.IcosahedronGeometry(1.9, 0).translate(-1.2, 6.8, -0.8), LEAF]]),
      pine: mergeColored([[trunk(3, 0.4), TRUNK], [new THREE.ConeGeometry(2.9, 6, 7).translate(0, 5.6, 0), LEAF], [new THREE.ConeGeometry(2.1, 4.4, 7).translate(0, 8.6, 0), LEAF]]),
      palm: mergeColored([[trunk(8.4, 0.32), TRUNK], [new THREE.IcosahedronGeometry(3.6, 0).scale(1, 0.32, 1).translate(0, 8.6, 0), LEAF], [new THREE.ConeGeometry(0.9, 1.4, 6).translate(0, 9.2, 0), LEAF]]),
      bush: mergeColored([[new THREE.IcosahedronGeometry(1.5, 0).scale(1, 0.75, 1).translate(0, 0.9, 0), LEAF]]),
      lamp: mergeColored([[new THREE.CylinderGeometry(0.11, 0.15, 6, 5).translate(0, 3, 0), new THREE.Color(0.18, 0.2, 0.24)], [new THREE.BoxGeometry(0.12, 0.12, 1.5).translate(0, 5.9, 0.65), new THREE.Color(0.18, 0.2, 0.24)], [new THREE.BoxGeometry(0.55, 0.25, 0.85).translate(0, 5.78, 1.3), new THREE.Color(1, 0.93, 0.7)]]),
    };
    // far away, every tree becomes a few triangles and casts no shadow: the island looks the same from up high at a
    // fraction of the cost
    const oct = () => new THREE.OctahedronGeometry(3.2, 0);
    TREE_GEO.lo = {
      round: mergeColored([[oct().scale(1, 1.15, 1).translate(0, 5.6, 0), LEAF]]), fancy: mergeColored([[oct().scale(1.1, 1.2, 1.1).translate(0, 6, 0), LEAF]]),
      pine: mergeColored([[new THREE.ConeGeometry(2.9, 9.5, 5).translate(0, 6.2, 0), LEAF]]), palm: mergeColored([[oct().scale(1.1, 0.35, 1.1).translate(0, 8.6, 0), LEAF]]),
      bush: mergeColored([[new THREE.OctahedronGeometry(1.5, 0).scale(1, 0.75, 1).translate(0, 0.9, 0), LEAF]]),
    };
    return TREE_GEO;
  }
  const treeLod = { pairs: [], lamps: [] }; // detailed and simple versions of each tile of trees
  const PAL = { round: [0x5fae4f, 0x6dbb52, 0x4f9e45, 0x7cc35a, 0x58a84a], pine: [0x3f8a4a, 0x2f7a45, 0x4a9a50], palm: [0x4caf50, 0x5cbf4a], bush: [0x5aa84a, 0x6dbb52, 0x4a9a45], blossom: [0xff9fc0, 0xffb3cf], autumn: [0xf2a531, 0xe0703f], orchard: [0x7cc35a, 0x8fd16a] };
  function instTiles(geo, mat, list, setM, setC, parent = scene, cast = true) {
    const groups = new Map(), out = [];
    for (const t of list) { const k = Math.floor(t[0] / 260) + ',' + Math.floor(t[2] / 260); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
    for (const arr of groups.values()) {
      const g = geo.clone(), m = new THREE.InstancedMesh(g, mat, arr.length); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y1 = 0;
      arr.forEach((t, i) => { setM(t); m.setMatrixAt(i, tmp.matrix); if (setC) m.setColorAt(i, setC(t)); x0 = Math.min(x0, t[0]); x1 = Math.max(x1, t[0]); z0 = Math.min(z0, t[2]); z1 = Math.max(z1, t[2]); y1 = Math.max(y1, t[1]); });
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, y1 / 2, (z0 + z1) / 2), Math.hypot(x1 - x0, z1 - z0) / 2 + 20 + y1);
      m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = true; parent.add(m); out.push(m); // r128 instanced meshes skip culling unless told

    }
    return out;
  }
  const treeMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  function plant(kinds, parent) { // kinds: { round: [[x,y,z,s,tint]], ... }
    const G = treeGeos(), mat = treeMat(), c = new THREE.Color();
    for (const k of Object.keys(kinds)) {
      if (!kinds[k].length) continue;
      const setM = t => { tmp.position.set(t[0], t[1], t[2]); tmp.rotation.set(0, (t[0] * 7.3 + t[2]) % 6.28, 0); tmp.scale.setScalar(t[3]); tmp.updateMatrix(); };
      const setC = t => { const p = t[4] === 2 ? PAL.orchard : t[4] === 3 ? PAL.blossom : t[4] === 4 ? PAL.autumn : PAL[k] || PAL.round; return c.set(p[Math.abs(Math.floor(t[0] * 13 + t[2] * 7)) % p.length]).convertSRGBToLinear(); };
      const hi = instTiles(G[k], mat, kinds[k], setM, setC, parent), lo = instTiles(G.lo[k], mat, kinds[k], setM, setC, parent, false);
      hi.forEach((m, i) => treeLod.pairs.push([m, lo[i]]));
    }
  }
  function buildNature() {
    const kinds = { round: [], fancy: [], pine: [], palm: [], bush: [] }, target = { low: 4500, medium: 8000, high: 12000 }[Q] || 12000;
    seed = 99;
    for (let i = 0; i < target * 6 && kinds.round.length + kinds.pine.length + kinds.bush.length < target; i++) {
      const x = -770 + rnd() * 1520, z = -570 + rnd() * 1060, s = land(x, z);
      if (s < 20 || zoneAt(x, z) || roadDist(x, z) < 7) continue;
      if (noTrees.some(r => x > r[0] && x < r[2] && z > r[1] && z < r[3]) || turbines.some(t => Math.hypot(t[0] - x, t[1] - z) < 9)) continue;
      const h = heightAt(x, z, s), wild = z < -150 || x < -500 || h > 10;
      if (!wild && fbm(x * 2.2, z * 2.2) < 0.42 && rnd() < 0.5) continue; // meadows between the groves
      const pine = h > 18 ? rnd() < 0.75 : wild ? rnd() < 0.4 : rnd() < 0.1, r = rnd();
      if (!pine && r < 0.14) kinds.bush.push([x, h, z, 0.8 + rnd() * 0.6, 0]);
      else (pine ? kinds.pine : kinds.round).push([x, h - 0.2, z, 0.75 + rnd() * 0.6, !pine && r > 0.985 ? 3 : !pine && r > 0.96 ? 4 : 0]);
    }
    for (let x = -66; x <= -14; x += 13) for (let z = -46; z <= 6; z += 13) if (Math.hypot(x + 40, z + 20) > 9) kinds.fancy.push([x + rnd() * 3, GROUND, z + rnd() * 3, 0.85, rnd() < 0.2 ? 3 : 0]);
    for (const t of extraTrees.splice(0)) (t[4] === 1 ? kinds.pine : t[4] === 5 ? kinds.bush : kinds.fancy).push(t);
    for (let z = -180; z < 352; z += 12) for (let k = 0; k < 2; k++) { const x = 622 + rnd() * 50, s = land(x, z); if (s > 10 && s < 80) kinds.palm.push([x, heightAt(x, z, s), z, 0.85 + rnd() * 0.35, 0]); }
    plant(kinds);
    // the park: a fountain and paths
    const pk = World.park, pg = new THREE.Group(), pm = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.8 });
    const fo = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 0.8, 24), pm(0xd8d2c4)); fo.position.set(pk[0], GROUND + 0.4, pk[1]); pg.add(fo);
    const wa = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.2, 24), pm(0x5fc3d8)); wa.position.set(pk[0], GROUND + 0.75, pk[1]); pg.add(wa);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: lin(0xdff6ff), transparent: true, opacity: 0.8 })); jet.position.set(pk[0], GROUND + 2.6, pk[1]); pg.add(jet);
    flatMesh([[[pk[0] - 34, pk[1] - 2], 0, 0], [[pk[0] - 34, pk[1] + 2], 0, 1], [[pk[0] + 34, pk[1] - 2], 1, 0], [[pk[0] + 34, pk[1] - 2], 1, 0], [[pk[0] - 34, pk[1] + 2], 0, 1], [[pk[0] + 34, pk[1] + 2], 1, 1], [[pk[0] - 2, pk[1] - 34], 0, 0], [[pk[0] - 2, pk[1] + 34], 0, 1], [[pk[0] + 2, pk[1] - 34], 1, 0], [[pk[0] + 2, pk[1] - 34], 1, 0], [[pk[0] - 2, pk[1] + 34], 0, 1], [[pk[0] + 2, pk[1] + 34], 1, 1]], GROUND + 0.12, off(pm(0xe6dcc6), -1));
    scene.add(pg);
    // beach umbrellas
    const ucol = [0xe94f4f, 0x2e74c9, 0xf2a531, 0xffffff];
    for (let z = -150, i = 0; z < 330; z += 22) for (let k = 0; k < 2; k++, i++) { const x = 648 + k * 16 + (z % 3) * 4, s = land(x, z); if (s < 6 || s > 60) continue; const y = heightAt(x, z, s); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3), pm(0xffffff)); pole.position.set(x, y + 1.5, z); const top = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1, 8), new THREE.MeshStandardMaterial({ color: lin(ucol[i % 4]), flatShading: true })); top.position.set(x, y + 3.2, z); top.castShadow = true; const towel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 2.2), pm(ucol[(i + 1) % 4])); towel.position.set(x + 2, y + 0.05, z + 1); scene.add(pole, top, towel); }
    // rocks along the wilder shores
    const rocks = []; seed = 17;
    for (let i = 0; i < coast.length; i += 2) { const [x, z] = coast[i]; if ((x > 600 && z > -210 && z < 390) || (x > -130 && x < 250 && z > 290) || rnd() < 0.45) continue; for (let k = 0; k < 2; k++) { const rx = x + (rnd() - 0.5) * 12, rz = z + (rnd() - 0.5) * 12; rocks.push([rx, heightAt(rx, rz) - 0.5, rz, 1.4 + rnd() * 2.8, 0]); } }
    const rc = new THREE.Color();
    instTiles(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), rocks, t => { tmp.position.set(t[0], t[1], t[2]); tmp.rotation.set(t[0] % 3, t[2] % 3, 0); tmp.scale.set(t[3], t[3] * 0.7, t[3] * 1.1); tmp.updateMatrix(); }, t => rc.set(pick([0xa39d90, 0x8f8a80, 0xb5afa2])).convertSRGBToLinear());
    // street lamps
    treeLod.lamps.push(...instTiles(treeGeos().lamp, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), LAMPS, t => { tmp.position.set(t[0], t[1], t[2]); tmp.rotation.set(0, t[4], 0); tmp.scale.setScalar(1); tmp.updateMatrix(); }));
  }

  // ---------- life: cars on the roads, cars in the car parks ----------
  function carGeo() { return mergeTwo(new THREE.BoxGeometry(2, 1.2, 4.2).translate(0, 0.9, 0), new THREE.BoxGeometry(1.7, 0.8, 2.2).translate(0, 1.8, -0.2)); }
  const CAR_COL = [0xe94f4f, 0x2e74c9, 0xf2a531, 0xf4f1ea, 0x2f8f5b, 0x3b3f48, 0x8a4fd6, 0x2fd0c0];
  function buildLife() {
    const segs = R.filter(s => s.kind !== 'bridge' && s.kind !== 'lane'), n = { low: 90, medium: 180, high: 260 }[Q] || 260, cars = [];
    const geo = carGeo(), m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.45 }), n), col = CAR_COL.map(c => lin(c));
    seed = 3;
    for (let i = 0; i < n; i++) { cars.push({ s: pick(segs), t: rnd(), v: (8 + rnd() * 6) * (rnd() < 0.5 ? 1 : -1) }); m.setColorAt(i, pick(col)); }
    m.castShadow = true; m.frustumCulled = false; scene.add(m);
    tick.push(dt => {
      cars.forEach((c, i) => {
        const s = c.s, dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz);
        c.t += c.v * dt / L;
        if (c.t > 1 || c.t < 0) { c.t = c.t > 1 ? 1 : 0; const end = c.t ? s.b : s.a, next = segs.filter(o => o !== s && (o.a + '' === end + '' || o.b + '' === end + '')); if (next.length) { const o = pick(next); c.s = o; const fromA = o.a + '' === end + ''; c.t = fromA ? 0 : 1; c.v = Math.abs(c.v) * (fromA ? 1 : -1); } else c.v = -c.v; }
        const lane = (c.v > 0 ? 1 : -1) * s.w / 4, nx = -dz / L, nz = dx / L;
        tmp.position.set(s.a[0] + dx * c.t + nx * lane, ROAD_Y + 0.14, s.a[1] + dz * c.t + nz * lane); tmp.rotation.set(0, Math.atan2(dx * Math.sign(c.v), dz * Math.sign(c.v)), 0); tmp.scale.setScalar(1); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    });
    if (parked.length) { const p = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.45 }), parked.length); parked.forEach((t, i) => { tmp.position.set(t[0], t[1], t[2]); tmp.rotation.set(0, t[3], 0); tmp.scale.setScalar(1); tmp.updateMatrix(); p.setMatrixAt(i, tmp.matrix); p.setColorAt(i, col[i % col.length]); }); p.castShadow = true; p.frustumCulled = false; scene.add(p); }
  }
  function mergeTwo(a, b) { const g = new THREE.BufferGeometry(), A = a.toNonIndexed(), B = b.toNonIndexed(); for (const k of ['position', 'normal']) g.setAttribute(k, new THREE.Float32BufferAttribute([...A.attributes[k].array, ...B.attributes[k].array], 3)); return g; }

  // ---------- the other islands ----------
  function defineIsle(I) {
    const L = Math.hypot(I.x, I.z); I.u = [-I.x / L, -I.z / L]; I.v = [-I.u[1], I.u[0]];
    I.Rp = isleR(I, I.x + I.u[0] * I.R, I.z + I.u[1] * I.R);
    const P = (a, b) => [I.x + I.u[0] * a + I.v[0] * b, I.z + I.u[1] * a + I.v[1] * b], Rp = I.Rp; I.P = P;
    I.roads = []; const rd = (a, b, w = 8) => I.roads.push({ a, b, w, kind: 'street' });
    if (I.kind === 'private') { rd(P(Rp - 26, 0), P(Rp * 0.05, 0), 7); I.plots = [[Rp * 0.58, -24], [Rp * 0.58, 24], [Rp * 0.22, -24], [Rp * 0.22, 24]].map(([a, b], i) => ({ i, p: P(a, b), rot: Math.atan2(I.v[0] * (b > 0 ? -1 : 1), I.v[1] * (b > 0 ? -1 : 1)) })); }
    else { rd(P(Rp - 30, 0), P(-Rp * 0.4, 0), 9); for (const a of [Rp * 0.58, Rp * 0.16, -Rp * 0.26]) rd(P(a, -Rp * 0.44), P(a, Rp * 0.44), 8); }
    I.rd = roadDistIn(I.roads); I.dock = P(Rp + 20, 0); I.sea = P(Rp + 90, 0);
  }
  function isleH(I, x, z, s = isleSD(I, x, z)) {
    if (s < 0) return Math.max(-9, s * 0.14) - 0.6;
    const beach = -0.35 + smooth(0, I.kind === 'resort' ? 40 : 26, s) * (GROUND + 0.35);
    const hill = Math.max(0, fbm(x + 500, z - 300) - 0.3) * (I.kind === 'forest' ? 130 : I.kind === 'private' ? 46 : 60);
    const flat = I.plots ? Math.min(...I.plots.map(p => smooth(14, 40, Math.hypot(p.p[0] - x, p.p[1] - z)))) : 1;
    return beach + hill * smooth(30, 120, s) * smooth(22, 62, I.rd(x, z)) * flat;
  }
  function isleTerrain(I, S) {
    const X0 = I.x - I.R * 1.35, Z0 = I.z - I.R * 1.35, n = Math.round(I.R * 2.7 / S) + 1, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), H = new Float32Array(n * n), c = new THREE.Color();
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = X0 + i * S, z = Z0 + j * S, s = isleSD(I, x, z), h = isleH(I, x, z, s), k = j * n + i; H[k] = h; pos.set([x, h, z], k * 3);
      if (s < 0) c.copy(WET); else { c.copy(GRASS).lerp(GRASS2, fbm(x * 3, z * 3)); if (I.kind === 'forest' || h > 14) c.lerp(FOREST, I.kind === 'forest' ? 0.55 : smooth(14, 30, h)); if (h > 40) c.lerp(ROCK, smooth(40, 70, h)); c.lerp(SAND, 1 - smooth(I.kind === 'resort' ? 30 : 4, I.kind === 'resort' ? 46 : 10, s)); }
      col.set([c.r, c.g, c.b], k * 3);
    }
    return gridMesh(pos, col, H, n, n);
  }
  function silhouette(I) { I.sil = isleTerrain(I, 18); I.sil.castShadow = false; scene.add(I.sil); }
  function buildIsle(I) {
    if (I.built) return; I.built = true;
    const t0 = performance.now(), keep = [landF, roadF], first = placed.length; landF = (x, z) => isleSD(I, x, z); roadF = I.rd;
    scene.remove(I.sil); I.sil.geometry.dispose();
    const g = new THREE.Group(); scene.add(g); I.group = g;
    g.add(isleTerrain(I, 5));
    buildRoads(I.roads, g, () => I.kind !== 'private');
    // the port: a quay into the sea, a crane, containers and bollards
    const ang = Math.atan2(I.u[0], I.u[1]), [qx, qz] = I.P(I.Rp + 2, 0), box = (w, h, d, a, b, y, c) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT(c)); const [x, z] = I.P(a, b); o.position.set(x, y + h / 2, z); o.rotation.y = ang; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    box(I.kind === 'private' ? 10 : 26, GROUND + 7.2, 56, I.Rp + 2, 0, -7, 0xb7b0a2);
    if (I.kind !== 'private') { box(1.2, 20, 1.2, I.Rp + 16, -9, GROUND, 0xf2a531); box(1.2, 20, 1.2, I.Rp + 16, -3, GROUND, 0xf2a531); box(10, 1.6, 30, I.Rp + 22, -6, GROUND + 20, 0xf2a531); for (let k = 0; k < 4; k++) box(2.5, 2.6, 11, I.Rp - 6 + (k % 2) * 3, 8 + Math.floor(k / 2) * 3, GROUND + 0.2, CONT[k + I.R % 3]); }
    seed = 300 + I.R; const zone = { id: I.id, name: I.name, isle: I.id };
    tileKey = I.id;
    const kinds = { round: [], fancy: [], pine: [], palm: [], bush: [] };
    // the job site on each working island first (the camp's log yard, the timber buyer by the port); streets fill in round it
    if (I.kind !== 'private') {
      const sd = I.kind === 'forest' ? 1 : -1, [px, pz] = I.P(I.Rp * 0.42, 34 * sd), rot = Math.atan2(-I.v[0] * sd, -I.v[1] * sd);
      const b = Object.assign(I.kind === 'forest' ? { id: 'pinecamp', type: 'mill', name: 'Pine Isle Logging Camp', w: 26, d: 16 } : { id: 'coralyard', type: 'market', name: 'Coral Key Builders', w: 22, d: 14, floors: 2, sign: 14, awn: 0x7a4e2d },
        { x: px, z: pz, rot, isle: I.id, district: I.name, zoneId: I.id, street: STREETS[I.id][0], owner: 'city' });
      claim(b); addBuilding(b);
      const pile = I.P(I.Rp * 0.42 - 18, 17 * sd); claimRect(pile[0], pile[1], 14, 22, 0);
      places[I.kind === 'forest' ? 'pine' : 'coral'] = { b, pile, dock: I.P(I.Rp * 0.42, 0) };
    }
    if (I.kind === 'forest') {
      const s0 = I.roads[0];
      for (const side of [1, -1]) along(s0, side, () => 8, () => rnd() < 0.45 ? { type: 'mill', w: 20 + rnd() * 6, d: 14 } : { type: 'home', w: 9, d: 8, floors: 1 + (rnd() < 0.4 ? 1 : 0), color: pick([0xc8a27a, 0xb5855a, 0xe0c39a]), roof: pick([0x3f6b4a, 0x5a4a3a]), yd: 7 }, zone);
      for (const s of I.roads.slice(1)) for (const side of [1, -1]) along(s, side, () => 6, () => ({ type: 'home', w: 9, d: 8, floors: 1, color: pick([0xc8a27a, 0xb5855a, 0xe0c39a, 0xd9c4a0]), roof: pick([0x3f6b4a, 0x5a4a3a, 0x7a4e3a]), yd: 7 }), zone);
    } else if (I.kind === 'resort') {
      for (const s of I.roads) for (const side of [1, -1]) along(s, side, () => 5, () => { const r = rnd(); return r < 0.38 ? { type: 'hotel', w: 16 + rnd() * 4, d: 14, floors: 5 + Math.floor(rnd() * 6) } : r < 0.62 ? { type: 'shop', w: 13 + rnd() * 3, d: 12, floors: 2, sign: pick([0, 3, 4, 8, 9, 15]) } : { type: 'villa', w: 13 + rnd() * 3, d: 11, yd: 12, color: pick(WALLS.hotel) }; }, zone);
    }
    if (I.kind === 'private') for (const p of I.plots) { tileKey = I.id; const M = new THREE.Matrix4().makeRotationY(p.rot).setPosition(p.p[0], GROUND, p.p[1]); boxAt('lawn', M, 22, 0.12, 22, 0, 0, 0, C(0xa6dc7e)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt('trim', M, 0.5, 1.2, 0.5, sx * 10.5, 0, sz * 10.5, C(0xffd21f)); claimRect(p.p[0], p.p[1], 22, 22, 0); I.plotM = I.plotM || []; I.plotM[p.i] = M; }
    flush(g);
    // trees: dense pines on Pine Isle, palms on Coral Key, a mix on Gull Rock
    const target = I.kind === 'forest' ? 3600 : I.kind === 'resort' ? 1100 : 600, ours = placed.slice(first);
    for (let i = 0; i < target * 5 && kinds.pine.length + kinds.round.length + kinds.palm.length < target; i++) {
      const x = I.x + (rnd() - 0.5) * I.R * 2.2, z = I.z + (rnd() - 0.5) * I.R * 2.2, s = isleSD(I, x, z);
      if (s < (I.kind === 'resort' ? 14 : 20) || I.rd(x, z) < 7 || ours.some(p => Math.abs(p.x - x) < p.hw + 2 && Math.abs(p.z - z) < p.hd + 2)) continue;
      if (Math.hypot(x - I.dock[0], z - I.dock[1]) < 70) continue;
      const h = isleH(I, x, z, s), t = [x, h - 0.2, z, 0.8 + rnd() * 0.6, 0];
      if (I.kind === 'forest') (rnd() < 0.8 ? kinds.pine : kinds.round).push(t); else if (I.kind === 'resort') (s < 70 || rnd() < 0.5 ? kinds.palm : kinds.round).push(t); else (rnd() < 0.5 ? kinds.pine : rnd() < 0.5 ? kinds.round : kinds.bush).push(t);
    }
    for (const t of extraTrees.splice(0)) (t[4] === 1 ? kinds.pine : kinds.fancy).push(t);
    plant(kinds, g);
    landF = keep[0]; roadF = keep[1];
    I.ms = Math.round(performance.now() - t0);
  }
  function buildPlot(id, i, type) { // build on a plot of your own island
    const I = ISLES.find(x => x.id === id); if (!I || !I.built) return null;
    const p = I.plots[i], spec = { home: { w: 12, d: 10, floors: 2, yd: 8 }, villa: { w: 15, d: 12, yd: 6 }, mill: { w: 18, d: 12 }, warehouse: { w: 18, d: 12 } }[type];
    const b = Object.assign({ id: `${id}-plot${i}`, type, name: `${I.name} plot ${i + 1}`, x: p.p[0], z: p.p[1], rot: p.rot, isle: id, district: I.name, zoneId: id, street: 'Gull Lane', owner: 'you' }, spec);
    seed = 900 + i; addBuilding(b); flush(I.group);
    if (extraTrees.length) plant({ fancy: extraTrees.splice(0) }, I.group);
    return b;
  }

  // ---------- timber on the move: log piles at each site, trucks on the roads, ships between islands ----------
  const piles = {};
  function setPile(id, n) {
    const pl = places[id]; if (!pl) return;
    if (!piles[id]) { const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 6, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: lin(0xb07a45), roughness: 0.9 }), 120); m.castShadow = true; m.frustumCulled = false; scene.add(m); piles[id] = m;
      for (let i = 0; i < 120; i++) { const stack = Math.floor(i / 40), j = i % 40, layer = Math.floor(j / 8), k = j % 8; tmp.position.set(pl.pile[0] + (k - 3.5) * 1.12, GROUND + 0.55 + layer * 0.95, pl.pile[1] + (stack - 1) * 7); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); } }
    piles[id].count = clamp(Math.ceil(n / 2), 0, 120);
  }
  const ROUTES = { 'mill-quay': [[0, -300], [0, 100], [60, 100], [60, 280]], 'mill-site': [[0, -300], [0, -140], [100, -140]], 'quay-site': [[60, 280], [60, 100], [80, 100], [80, -140], [100, -140]] };
  const movers = [];
  function vehicle(kind) {
    const g = new THREE.Group();
    if (kind === 'truck') {
      const add = (w, h, d, x, y, z, c) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT(c)); o.position.set(x, y, z); o.castShadow = true; g.add(o); };
      add(2.4, 2.2, 2.4, 0, 1.6, 3.4, 0xe94f4f); add(2.4, 0.4, 7, 0, 0.9, -1.4, 0x3b3f48);
      for (let i = 0; i < 6; i++) { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 6.6, 8).rotateX(Math.PI / 2), MAT(0xb07a45)); o.position.set(-0.75 + (i % 3) * 0.75, 1.55 + Math.floor(i / 3) * 0.8, -1.4); o.castShadow = true; g.add(o); }
    } else {
      const s = hull(34, 8, 4, 0x2f5f8f, 0x8c5a40); g.add(s);
      for (let i = 0; i < 24; i++) { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 9, 8).rotateZ(Math.PI / 2), MAT(0xb07a45)); o.position.set(i < 12 ? -2 : 8, 3.6 + Math.floor((i % 12) / 4) * 1.1, -2.4 + (i % 4) * 1.5); o.castShadow = true; g.add(o); }
      const br = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 7), MAT(0xf4f1ea)); br.position.set(-12, 5, 0); br.castShadow = true; g.add(br);
    }
    scene.add(g); return g;
  }
  function follow(path, secs, frac, kind, lane) { // move a truck or a ship along a path over secs seconds, starting part-way
    const pts = path.map(p => new THREE.Vector2(p[0], p[1])), lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = lens[lens.length - 1], g = vehicle(kind), mv = { g, k: clamp(frac || 0, 0, 1), secs, done: false };
    mv.step = dt => {
      mv.k = Math.min(1, mv.k + dt / mv.secs); const e = mv.k < 0.08 ? mv.k * mv.k / 0.16 : mv.k > 0.92 ? 1 - (1 - mv.k) * (1 - mv.k) / 0.16 : mv.k - 0.04, d = clamp(e, 0, 1) * total;
      let i = 1; while (i < lens.length - 1 && lens[i] < d) i++;
      const a = pts[i - 1], b = pts[i], t = (d - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1), dx = b.x - a.x, dz = b.y - a.y, L = Math.hypot(dx, dz) || 1;
      g.position.set(a.x + dx * t - dz / L * lane, kind === 'truck' ? ROAD_Y + 0.14 : Math.sin(clock * 0.8) * 0.15, a.y + dz * t + dx / L * lane);
      g.rotation.y = Math.atan2(dx, dz) - (kind === 'truck' ? 0 : Math.PI / 2);
      if (mv.k >= 1) { mv.done = true; scene.remove(g); }
    };
    mv.step(0); movers.push(mv); return mv;
  }
  function convoy(route, secs, frac) { const p = ROUTES[route] || ROUTES[route.split('-').reverse().join('-')]?.slice().reverse(); return p ? follow(p, secs, frac, 'truck', 2.2) : null; }
  function voyage(from, to, secs, frac) {
    const port = id => { if (id === 'quay') return { dock: [70, 395], sea: [70, 520] }; const I = ISLES.find(x => x.id === (id === 'pine' ? 'pine' : id === 'coral' ? 'coral' : id)); return { dock: I.dock, sea: I.sea }; };
    const a = port(from), b = port(to); return follow([a.dock, a.sea, b.sea, b.dock], secs, frac, 'ship', 0);
  }
  tick.push(dt => { for (let i = movers.length - 1; i >= 0; i--) { movers[i].step(dt); if (movers[i].done) movers.splice(i, 1); } });

  // ---------- each frame: camera clipping, shadows that follow the view, fading detail ----------
  const SUN = new THREE.Vector3(-0.55, 0.62, 0.5).normalize();
  let active = null; // null while on Capital Island, or the island you travelled to
  function frame(dt) {
    clock += dt;
    controls.update();
    // keep the camera over the island you're on
    const t = controls.target;
    if (!fly) { const B = active ? [active.x - active.R, active.x + active.R, active.z - active.R, active.z + active.R] : [-700, 680, -500, 520]; t.x = clamp(t.x, B[0], B[1]); t.z = clamp(t.z, B[2], B[3]); }
    t.y = GROUND;
    const dist = camDist = camera.position.distanceTo(t);
    camera.near = clamp(dist * 0.03, 0.5, 40); camera.far = dist * 5 + 3000; camera.updateProjectionMatrix();
    scene.fog.near = dist * 1.6 + 600; scene.fog.far = dist * 4 + 3500;
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9);
    // the shadow box covers what you see, snapped to whole texels so it doesn't shimmer as you move
    const size = clamp(dist * 1.5, 140, 1700), cam = sun.shadow.camera;
    cam.left = cam.bottom = -size / 2; cam.right = cam.top = size / 2; cam.near = 1; cam.far = size * 2 + 600; cam.updateProjectionMatrix();
    const texel = size / sun.shadow.mapSize.x, c = t.clone();
    const right = new THREE.Vector3().crossVectors(SUN, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, SUN);
    const r = Math.round(c.dot(right) / texel) * texel, u = Math.round(c.dot(up) / texel) * texel, f = c.dot(SUN);
    c.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(SUN, f);
    sun.target.position.copy(c); sun.position.copy(c).addScaledVector(SUN, size + 300);
    for (const [m, a, b] of fadeMats) { const o = 1 - smooth(a, b, dist); m.opacity = o; m.visible = o > 0.01; m.depthWrite = o > 0.99; }
    // trees switch to their simple version tile by tile once the tile is far from the camera (or the whole island when high up)
    for (const [hi, lo] of treeLod.pairs) { const s = hi.geometry.boundingSphere, far = dist > 620 || camera.position.distanceTo(s.center) - s.radius * 0.6 > 520; hi.visible = !far; lo.visible = far; }
    for (const m of treeLod.lamps) m.visible = dist < 620;
    for (const f2 of tick) f2(dt, clock);
    renderer.render(scene, camera);
  }

  // ---------- camera helpers ----------
  function view(x, z, dist, polar, az) { return { t: new THREE.Vector3(x, GROUND, z), dist, polar, az }; }
  function place(v) { const s = Math.sin(v.polar) * v.dist; controls.target.copy(v.t); camera.position.set(v.t.x + Math.sin(v.az) * s, v.t.y + Math.cos(v.polar) * v.dist, v.t.z + Math.cos(v.az) * s); camera.lookAt(v.t); }
  function current() { const d = camera.position.clone().sub(controls.target), dist = d.length(); return { t: controls.target.clone(), dist, polar: Math.acos(clamp(d.y / dist, -1, 1)), az: Math.atan2(d.x, d.z) }; }
  let fly = null;
  function flyTo(v, secs = 1.6, done) { const a = current(), far = a.t.distanceTo(v.t); fly = { a, b: v, k: 0, secs, done, arc: far > 900 ? clamp(far / 1400, 0.6, 2.2) : 0 }; controls.enabled = false; }
  function step(dt) {
    if (fly) {
      fly.k = Math.min(1, fly.k + dt / fly.secs); const e = fly.k < 0.5 ? 4 * fly.k ** 3 : 1 - (-2 * fly.k + 2) ** 3 / 2, a = fly.a, b = fly.b;
      let daz = b.az - a.az; daz = Math.atan2(Math.sin(daz), Math.cos(daz));
      const lift = 1 + fly.arc * Math.sin(Math.PI * e); // long trips rise over the sea and come down on the other island
      place({ t: a.t.clone().lerp(b.t, e), dist: Math.exp(Math.log(a.dist) * (1 - e) + Math.log(b.dist) * e) * lift, polar: a.polar + (b.polar - a.polar) * e, az: a.az + daz * e });
      if (fly.k >= 1) { const d = fly.done; fly = null; controls.enabled = true; if (d) d(); }
    }
    frame(dt);
  }
  const fit = d => d * clamp(1.3 / camera.aspect, 1, 2.1); // narrow (portrait) screens stand further back so the whole building fits
  const homeView = () => view(World.home.x, World.home.z, fit(78), 0.8, World.home.rot + 0.6);
  const overview = () => view(-10, -10, 1600, 0.62, 0.35);
  const isleView = I => view(I.x + I.u[0] * I.R * 0.15, I.z + I.u[1] * I.R * 0.15, fit(I.R * 2.4), 0.78, Math.atan2(I.u[0], I.u[1]) + 0.4);
  function viewOf(b) { return view(b.x, b.z, fit(clamp(Math.max(b.w, b.d, b.h) * 3, 70, 420)), 0.85, b.rot + 0.55); }
  function travel(id, secs = 3.4, done) { // fly to another island; it's built the first time you go
    const I = ISLES.find(i => i.id === id) || null;
    if (I) buildIsle(I);
    active = I; controls.maxDistance = I ? I.R * 3.4 : 1750;
    flyTo(I ? isleView(I) : homeView(), secs, done);
  }
  const isleOf = b => b && b.isle ? b.isle : 'main';

  // ---------- picking a building ----------
  const ray = new THREE.Raycaster();
  function pickAt(nx, ny) { // nearest building whose footprint the ray passes over
    ray.setFromCamera({ x: nx, y: ny }, camera);
    const o = ray.ray.origin, dir = ray.ray.direction; let best = null, bt = 1e9;
    for (const b of buildings) {
      const tC = ((b.x - o.x) * dir.x + (b.h / 2 + GROUND - o.y) * dir.y + (b.z - o.z) * dir.z);
      if (tC < 0) continue;
      const px = o.x + dir.x * tC, py = o.y + dir.y * tC, pz = o.z + dir.z * tC, c = Math.cos(-b.rot), s = Math.sin(-b.rot), lx = (px - b.x) * c - (pz - b.z) * s, lz = (px - b.x) * s + (pz - b.z) * c;
      if (Math.abs(lx) < b.w / 2 + 1 && Math.abs(lz) < b.d / 2 + 1 && py < b.h + GROUND + 2 && tC < bt) { bt = tC; best = b; }
    }
    return best;
  }
  // a ring and a pin that mark a building, for fast travel and the selected card
  let marker = null;
  function mark(b) {
    if (!marker) {
      marker = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.95, depthWrite: false }));
      ring.renderOrder = 5; marker.add(ring); marker.ring = ring;
      const pin = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 16).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: lin(0xffd21f), emissive: lin(0x7a5a00) })); marker.add(pin); marker.pin = pin;
      scene.add(marker);
      tick.push((dt, t) => { if (!marker.visible) return; marker.pin.position.y = marker.h + 6 + Math.sin(t * 3) * 1.2; marker.ring.material.opacity = 0.65 + Math.sin(t * 4) * 0.3; });
    }
    marker.visible = !!b; if (!b) return;
    const r = Math.hypot(b.w, b.d) / 2 + 3; marker.position.set(b.x, GROUND + 0.35, b.z); marker.ring.scale.setScalar(r); marker.h = b.h;
  }

  // ---------- property pictures: one shared renderer pass into a small target, cached by building and version ----------
  const shots = new Map();
  let rt = null;
  function photo(b) {
    const key = b.id + ':' + (b.v || 0);
    if (shots.has(key)) return shots.get(key);
    const W = 480, H = 300, SS = 2; // drawn at twice the size and scaled down: smooth edges
    if (!rt) { rt = new THREE.WebGLRenderTarget(W * SS, H * SS); rt.texture.encoding = THREE.sRGBEncoding; } // same colours as the screen
    const cam = new THREE.PerspectiveCamera(30, W / H, 1, 3000);
    // frame the whole building and its plot: fit the box (with padding and a strip of street) into the view
    const az = b.rot + 0.62, pol = 1.05, dir = new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az));
    const R0 = Math.hypot(b.w, b.d) / 2 + 6, centre = new THREE.Vector3(b.x, GROUND + b.h * 0.42, b.z);
    const fovV = cam.fov * Math.PI / 180, fovH = 2 * Math.atan(Math.tan(fovV / 2) * cam.aspect);
    const need = Math.max((b.h * 0.62 + 4) / Math.tan(fovV / 2), R0 / Math.tan(fovH / 2)) * 1.12;
    cam.position.copy(centre).addScaledVector(dir, need); cam.lookAt(centre); cam.near = need * 0.2; cam.far = need * 6; cam.updateProjectionMatrix();
    const vis = marker && marker.visible, cv0 = clouds.visible; if (marker) marker.visible = false; clouds.visible = false;
    for (const [m] of fadeMats) { m.opacity = 1; m.visible = true; }
    for (const [hi, lo] of treeLod.pairs) { hi.visible = true; lo.visible = false; } // pictures always use the detailed trees
    const old = { fn: scene.fog.near, ff: scene.fog.far }; scene.fog.near = 1e5; scene.fog.far = 2e5;
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
    scene.fog.near = old.fn; scene.fog.far = old.ff; if (marker) marker.visible = vis; clouds.visible = cv0;
    const BW = W * SS, BH = H * SS, px = new Uint8Array(BW * BH * 4); renderer.readRenderTargetPixels(rt, 0, 0, BW, BH, px);
    const big = document.createElement('canvas'); big.width = BW; big.height = BH; const bg = big.getContext('2d'), img = bg.createImageData(BW, BH);
    for (let y = 0; y < BH; y++) img.data.set(px.subarray((BH - 1 - y) * BW * 4, (BH - y) * BW * 4), y * BW * 4); // flip: WebGL rows start at the bottom
    bg.putImageData(img, 0, 0);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, W, H);
    const url = cv.toDataURL('image/jpeg', 0.86); shots.set(key, url);
    return url;
  }

  return { init, step, frame, place, view, flyTo, current, homeView, overview, isleView, viewOf, pickAt, mark, photo, buildings, ZONES, ISLES, land, heightAt, travel, isleOf, places, setPile, convoy, voyage, buildPlot,
    get active() { return active ? active.id : 'main'; }, get camera() { return camera; }, get renderer() { return renderer; }, get scene() { return scene; }, get controls() { return controls; }, get flying() { return !!fly; } };
})();
