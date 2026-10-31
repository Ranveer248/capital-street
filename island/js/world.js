// Capital Island, review sample (Goal 32). One designed island in the ocean, built in code: no map data, no outlines,
// no post-processing. Everything here is original: the coastline, terrain, roads, buildings and boats are generated
// from the hand-made layout below. Rendering rules that fix the old city's flicker at the source:
//  - one ground mesh, roads raised above it with a polygon offset: no coplanar layers fighting for depth
//  - near/far planes follow the camera over a 3 km island, so depth precision stays high
//  - real multisampling, mipmapped facade textures (windows blend into walls at a distance instead of shimmering)
//  - a sun shadow box sized to what you see and snapped to its texels, so shadows don't swim while the camera moves
//  - small details (chimneys, awnings, roof units, props) fade out with distance instead of popping
'use strict';
window.World = (function () {
  const lin = c => new THREE.Color(c).convertSRGBToLinear();
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const GROUND = 3; // the height towns are built at

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
  function sdPoly(x, z, P) { // signed distance: positive on land
    let d = 1e9, inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [ax, az] = P[j], [bx, bz] = P[i], ex = bx - ax, ez = bz - az, t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez), 0, 1);
      d = Math.min(d, Math.hypot(ax + t * ex - x, az + t * ez - z));
      if ((az > z) !== (bz > z) && x < ax + (z - az) / (bz - az) * ex) inside = !inside;
    }
    return inside ? d : -d;
  }
  // the same signed distance, fast: segments are sorted into 64 m cells (for distance) and 8 m bands (for inside/outside),
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

  // ---------- districts: flat ground where towns stand ----------
  const ZONES = [
    { id: 'centre', name: 'Capital Centre', x0: -190, x1: 180, z0: -250, z1: 125 },
    { id: 'oldtown', name: 'Old Town', x0: 170, x1: 575, z0: -265, z1: 300 },
    { id: 'harbour', name: 'Harbourside', x0: -210, x1: 300, z0: 110, z1: 336 },
    { id: 'farms', name: 'Greenfields', x0: -690, x1: -250, z0: -70, z1: 330 },
    { id: 'mill', name: 'Pine Ridge Mill', x0: -120, x1: 120, z0: -430, z1: -240 },
    { id: 'beach', name: 'Sunny Beach', x0: 575, x1: 700, z0: -190, z1: 360 },
  ];
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
  // Old Town
  for (const x of [240, 320, 400, 480]) road([x, -240], [x, 260], 8);
  for (const z of [-240, -160, -80, 20, 180, 260]) road([160, z], [560, z], 8);
  road([160, -240], [160, -220], 8);
  // the beach road and the bridge to Lighthouse Point
  road([560, -240], [600, -150], 8); road([600, -150], [600, 340], 8); road([560, 260], [600, 260], 8); road([560, 180], [600, 180], 8); road([560, -80], [600, -80], 8);
  road([600, 340], [566, 420], 8); road([566, 420], [566, 545], 8, 'bridge');
  // Harbourside
  road([-100, 100], [-100, 300], 9); road([60, 100], [60, 300], 9); road([200, 100], [200, 300], 9);
  road([-100, 300], [240, 300], 10, 'quay'); road([240, 260], [240, 300], 8);
  // Greenfields lanes, each ending at a farm
  road([-430, 100], [-430, 290], 7, 'lane'); road([-580, 100], [-580, 250], 7, 'lane'); road([-430, 100], [-430, -20], 7, 'lane'); road([-560, 230], [-450, 230], 7, 'lane');
  // up to the timber mill
  road([0, -220], [0, -400], 9);
  const segD = (x, z, s) => { const [ax, az] = s.a, [bx, bz] = s.b, ex = bx - ax, ez = bz - az, t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1), 0, 1); return Math.hypot(ax + t * ex - x, az + t * ez - z); };
  const roadDist = (x, z) => { let d = 1e9; for (const s of R) if (s.kind !== 'bridge') d = Math.min(d, segD(x, z, s) - s.w / 2); return d; };

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
  let renderer, scene, camera, controls, sun, ocean, sky, clock = 0;
  const fadeMats = []; // materials that fade out with distance: [material, near, far]
  const buildings = []; // { id, type, name, x, z, w, d, h, rot, floors, district, mesh refs }
  const tick = [];
  function init(canvas, q) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'low' ? 1 : q === 'medium' ? 1.5 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = q !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    const HORIZON = 0xbfe3f2;
    scene.fog = new THREE.Fog(lin(HORIZON), 1500, 5000);
    camera = new THREE.PerspectiveCamera(36, 1, 1, 6000);
    controls = new THREE.MapControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.1; controls.screenSpacePanning = false;
    controls.minDistance = 28; controls.maxDistance = 1750; controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.12;
    // light: soft sky, one warm sun
    scene.add(new THREE.HemisphereLight(lin(0xdfefff), lin(0x8a9a6a), 0.9));
    sun = new THREE.DirectionalLight(lin(0xfff1d9), 2.2);
    sun.castShadow = q !== 'low';
    sun.shadow.mapSize.setScalar(q === 'high' ? 2048 : 1024);
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.6;
    scene.add(sun, sun.target);
    World.times = {}; for (const [k, f] of [["sky", () => buildSky(HORIZON)], ["terrain", buildTerrain], ["ocean", buildOcean], ["roads", buildRoads], ["town", buildTown], ["harbour", buildHarbour], ["nature", buildNature], ["life", buildLife]]) { const t0 = performance.now(); f(); World.times[k] = Math.round(performance.now() - t0); } // how long each part takes, for measuring
    resize(); addEventListener('resize', resize);
  }
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  function buildSky(horizon) {
    const g = new THREE.SphereGeometry(1, 32, 16);
    sky = new THREE.Mesh(g, new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: lin(0x4aa3e6) }, mid: { value: lin(horizon) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, mid; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(mid, top, smoothstep(0.0, 0.55, h)), 1.0); }' }));
    sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  }

  // one ground mesh for the whole island and its shallow sea floor
  function buildTerrain() {
    const X0 = -1050, X1 = 1050, Z0 = -820, Z1 = 820, S = 6, nx = Math.round((X1 - X0) / S) + 1, nz = Math.round((Z1 - Z0) / S) + 1;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), H = new Float32Array(nx * nz);
    const SAND = lin(0xead49c), WET = lin(0xc8b07a), GRASS = lin(0x86c867), GRASS2 = lin(0x6fb45a), FOREST = lin(0x5a9a4c), ROCK = lin(0x9d988c), YARD = lin(0xc9c5bb), PLAZA = lin(0xe2dccd), c = new THREE.Color();
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
      }
      col.set([c.r, c.g, c.b], k * 3);
    }
    // steep slopes show rock
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i, sl = Math.hypot(H[k + 1] - H[k - 1], H[k + nx] - H[k - nx]) / (2 * S);
      if (sl > 0.5 && H[k] > 6) { c.setRGB(col[k * 3], col[k * 3 + 1], col[k * 3 + 2]).lerp(ROCK, smooth(0.5, 0.9, sl)); col.set([c.r, c.g, c.b], k * 3); }
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; if (H[a] < -8 && H[b] < -8 && H[d] < -8 && H[e] < -8) continue; idx.push(a, d, b, b, d, e); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    m.receiveShadow = true; scene.add(m);
    World.ground = m;
  }

  // the sea: shallow turquoise near the shore, a line of foam, deep blue further out, gentle waves
  function buildOcean() {
    const N = 256, E = 1300, data = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -E + (i + 0.5) / N * 2 * E, z = -E + (j + 0.5) / N * 2 * E; data[j * N + i] = clamp(Math.round(-land(x, z) / 300 * 255), 0, 255); }
    const tex = new THREE.DataTexture(data, N, N, THREE.LuminanceFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({ fog: true, transparent: false,
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { sd: { value: tex }, E: { value: E }, t: { value: 0 },
        deep: { value: lin(0x3b92d2) }, mid: { value: lin(0x35aee0) }, shallow: { value: lin(0x5fd6d3) }, foam: { value: lin(0xf4fbff) } }),
      vertexShader: `varying vec2 vW; #include <fog_pars_vertex>
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition; #include <fog_vertex>
}`.replace(/#include/g, '\n#include').replace(/ void main/, '\nvoid main'),
      fragmentShader: `uniform sampler2D sd; uniform float E, t; uniform vec3 deep, mid, shallow, foam; varying vec2 vW;
        #include <fog_pars_fragment>
        void main(){
          vec2 uv = (vW + E) / (2.0 * E); float d = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 300.0 : texture2D(sd, uv).r * 300.0;
          float w = sin(vW.x * 0.045 + t * 0.9) * sin(vW.y * 0.05 - t * 0.7) + sin((vW.x + vW.y) * 0.11 + t * 1.6) * 0.5;
          vec3 c = mix(shallow, mid, smoothstep(4.0, 60.0, d)); c = mix(c, deep, smoothstep(60.0, 260.0, d));
          c += w * 0.012 * (1.0 - smoothstep(150.0, 900.0, d)); // ripples fade out with depth, so the open sea stays calm
          float f = (1.0 - smoothstep(0.0, 7.0, d + w * 1.5)) * (0.55 + 0.45 * sin(t * 1.3 + vW.x * 0.07 + vW.y * 0.05));
          c = mix(c, foam, clamp(f, 0.0, 1.0) * 0.8);
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }` });
    ocean = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000).rotateX(-Math.PI / 2), mat);
    mat.polygonOffset = true; mat.polygonOffsetFactor = 2; mat.polygonOffsetUnits = 4; // where beach and water meet, the beach wins cleanly
    ocean.renderOrder = 0; scene.add(ocean);
    tick.push(dt => { mat.uniforms.t.value += dt; });
  }

  // ---------- roads: asphalt raised over the ground, pavements in town, centre lines, finished junctions ----------
  const ROAD_Y = GROUND + 0.06;
  function strip(arr, a, b, w, y, uvLen) { // a flat ribbon from a to b
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), nx = -dz / L * w / 2, nz = dx / L * w / 2;
    const p = [[a[0] + nx, a[1] + nz], [a[0] - nx, a[1] - nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz]];
    const u1 = uvLen ? L / uvLen : 1;
    arr.push([p[0], 0, 0], [p[1], 1, 0], [p[2], 0, u1], [p[2], 0, u1], [p[1], 1, 0], [p[3], 1, u1]);
    return L;
  }
  function flatMesh(tris, y, mat, yAt) {
    const pos = [], uv = [];
    for (const [[x, z], u, v] of tris) { pos.push(x, yAt ? yAt(x, z) : y, z); uv.push(u, v); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    mat.side = THREE.DoubleSide; // ribbons are built in either winding: draw both faces
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
  }
  function canvasTex(w, h, draw, repeat) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const off = (m, f = -1) => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f * 2; return m; };
  function buildRoads() {
    const ASPH = lin(0x50545c), PAVE = lin(0xd8d2c4);
    const lineTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#50545c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2e6b3'; g.fillRect(w / 2 - 2, 20, 4, 110); }, true);
    const roadT = [], paveT = [], lineT = [];
    const nodes = new Map();
    for (const s of R) {
      if (s.kind === 'bridge') continue;
      const town = !!zoneAt((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2) && s.kind !== 'lane';
      if (town) strip(paveT, s.a, s.b, s.w + 6);
      strip(roadT, s.a, s.b, s.w);
      if (s.w >= 9) { // centre line, kept out of junctions
        const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz), k = 8 / L;
        if (L > 20) strip(lineT, [s.a[0] + dx * k, s.a[1] + dz * k], [s.b[0] - dx * k, s.b[1] - dz * k], 0.9, 0, 8);
      }
      for (const p of [s.a, s.b]) { const key = p.join(','), n = nodes.get(key) || { p, w: 0, town: false }; n.w = Math.max(n.w, s.w); n.town = n.town || town; nodes.set(key, n); }
    }
    for (const n of nodes.values()) { // junction squares and the turning circles where lanes end at a farm
      const h = n.w / 2 + (n.town ? 0 : 1);
      const sq = (arr, r) => arr.push([[n.p[0] - r, n.p[1] - r], 0, 0], [[n.p[0] - r, n.p[1] + r], 0, 1], [[n.p[0] + r, n.p[1] - r], 1, 0], [[n.p[0] + r, n.p[1] - r], 1, 0], [[n.p[0] - r, n.p[1] + r], 0, 1], [[n.p[0] + r, n.p[1] + r], 1, 1]);
      sq(roadT, h); if (n.town) sq(paveT, h + 3);
    }
    flatMesh(paveT, GROUND + 0.18, off(new THREE.MeshStandardMaterial({ color: PAVE, roughness: 0.9 }), -1));
    flatMesh(roadT, ROAD_Y + 0.14, off(new THREE.MeshStandardMaterial({ color: ASPH, roughness: 0.85 }), -2));
    const lm = flatMesh(lineT, ROAD_Y + 0.15, off(new THREE.MeshStandardMaterial({ map: lineTex, roughness: 0.8, transparent: false }), -3));
    lm.material.map.wrapT = THREE.RepeatWrapping;
    buildBridge();
  }
  function buildBridge() { // a finished bridge: deck, kerbs, railings, piers and lamps
    const a = [566, 420], b = [566, 548], g = new THREE.Group(), deckY = 7;
    const M = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.8 });
    const box = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    const L = b[1] - a[1], cz = (a[1] + b[1]) / 2;
    const ramp = (z0, z1, y0, y1) => { const o = box(10, 0.6, Math.hypot(z1 - z0, y1 - y0), 566, (y0 + y1) / 2, (z0 + z1) / 2, M(0x50545c)); o.rotation.x = Math.atan2(y1 - y0, z1 - z0) * -1; };
    box(10, 0.8, L - 40, 566, deckY, cz, M(0x50545c));
    ramp(a[1] - 6, a[1] + 20, GROUND + 0.2, deckY); ramp(b[1] - 20, b[1] + 4, deckY, GROUND + 0.2);
    box(1.2, 1.0, L - 40, 561, deckY + 0.6, cz, M(0xe9e4d8)); box(1.2, 1.0, L - 40, 571, deckY + 0.6, cz, M(0xe9e4d8));
    for (let z = a[1] + 26; z <= b[1] - 26; z += 22) { box(2.2, deckY + 8, 2.2, 559, (deckY - 8) / 2, z, M(0xcfc8b8)); box(2.2, deckY + 8, 2.2, 573, (deckY - 8) / 2, z, M(0xcfc8b8)); }
    for (let z = a[1] + 30; z <= b[1] - 30; z += 24) for (const x of [560.8, 571.2]) { box(0.25, 4, 0.25, x, deckY + 2.6, z, M(0x2b3a4a)); box(0.7, 0.4, 0.7, x, deckY + 4.6, z, new THREE.MeshStandardMaterial({ color: lin(0xfff2c0), emissive: lin(0x6b5a20) })); }
    scene.add(g);
  }

  // ---------- buildings ----------
  // facade textures: one bay (about 3.2 m) by one floor, drawn once and repeated, with mipmaps so windows blend at a distance
  const tex = {};
  function facades() {
    const T = (draw) => canvasTex(128, 128, draw, true);
    tex.home = T((g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e7e2d8'; g.fillRect(0, 112, 128, 16); g.fillStyle = '#ffffff'; g.fillRect(34, 26, 60, 70); g.fillStyle = '#3d5f86'; g.fillRect(40, 32, 48, 58); g.fillStyle = '#7fa6cf'; g.fillRect(40, 32, 48, 14); g.fillStyle = '#ffffff'; g.fillRect(62, 32, 4, 58); g.fillRect(40, 58, 48, 4); g.fillStyle = '#d9d2c4'; g.fillRect(30, 96, 68, 7); });
    tex.apart = T((g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#efe9dd'; g.fillRect(0, 0, 128, 10); g.fillStyle = '#f7f3ea'; g.fillRect(30, 22, 68, 78); g.fillStyle = '#2f4f74'; g.fillRect(38, 30, 52, 62); g.fillStyle = '#6f98c4'; g.fillRect(38, 30, 52, 16); g.fillStyle = '#f7f3ea'; g.fillRect(62, 30, 4, 62); g.fillStyle = '#cfc6b4'; g.fillRect(26, 100, 76, 8); });
    tex.office = T((g) => { g.fillStyle = '#f2f4f6'; g.fillRect(0, 0, 128, 128); const gr = g.createLinearGradient(0, 18, 0, 108); gr.addColorStop(0, '#6fa3cf'); gr.addColorStop(1, '#2d5a86'); g.fillStyle = gr; g.fillRect(6, 18, 116, 88); g.fillStyle = '#dfe6ec'; g.fillRect(62, 18, 4, 88); g.fillStyle = '#ffffff'; g.globalAlpha = 0.25; g.fillRect(10, 22, 30, 80); g.globalAlpha = 1; });
    tex.shopTop = T((g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#2f4f74'; g.fillRect(24, 28, 34, 60); g.fillRect(70, 28, 34, 60); g.fillStyle = '#6f98c4'; g.fillRect(24, 28, 34, 16); g.fillRect(70, 28, 34, 16); g.fillStyle = '#dcd4c4'; g.fillRect(20, 88, 42, 7); g.fillRect(66, 88, 42, 7); });
    tex.shopFront = T((g) => { g.fillStyle = '#efe7d7'; g.fillRect(0, 0, 128, 128); const gr = g.createLinearGradient(0, 30, 0, 128); gr.addColorStop(0, '#8fbad9'); gr.addColorStop(1, '#2c4f73'); g.fillStyle = gr; g.fillRect(8, 30, 112, 98); g.fillStyle = '#efe7d7'; g.fillRect(62, 30, 4, 98); g.fillStyle = '#ffd98a'; g.globalAlpha = 0.35; g.fillRect(8, 100, 112, 28); g.globalAlpha = 1; });
    tex.shed = T((g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e4e4e4'; for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 3, 128); g.fillStyle = '#3d5f86'; g.fillRect(20, 14, 88, 18); g.fillStyle = '#7fa6cf'; g.fillRect(20, 14, 88, 6); });
    tex.brick = T((g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e8ddd5'; for (let y = 0; y < 128; y += 8) { g.fillRect(0, y, 128, 1); for (let x = (y / 8) % 2 * 8; x < 128; x += 16) g.fillRect(x, y, 1, 8); } g.fillStyle = '#2f4f74'; g.fillRect(36, 18, 56, 84); g.beginPath(); g.arc(64, 18, 28, Math.PI, 0); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(62, 0, 4, 102); g.fillRect(36, 56, 56, 3); });
  }
  const parts = new Map(); // material key -> { pos, nor, uv, col }
  function part(k) { if (!parts.has(k)) parts.set(k, { pos: [], nor: [], uv: [], col: [] }); return parts.get(k); }
  function addGeo(k, geo, mtx, color) { // bake a transformed geometry into a material bucket
    const g = (geo.index ? geo.toNonIndexed() : geo).clone().applyMatrix4(mtx), P = part(k), p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv ? g.attributes.uv.array : null;
    for (let i = 0; i < p.length / 3; i++) { P.pos.push(p[3 * i], p[3 * i + 1], p[3 * i + 2]); P.nor.push(n[3 * i], n[3 * i + 1], n[3 * i + 2]); P.uv.push(u ? u[2 * i] : 0, u ? u[2 * i + 1] : 0); P.col.push(color.r, color.g, color.b); }
  }
  // walls: four sides with UVs in bays and floors, so the facade texture tiles exactly
  function walls(k, M, w, d, y0, y1, color, bay = 3.2, floor = 3.2) {
    const P = part(k), v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(M);
    const sides = [[[-w / 2, d / 2], [w / 2, d / 2], [0, 1]], [[w / 2, d / 2], [w / 2, -d / 2], [1, 0]], [[w / 2, -d / 2], [-w / 2, -d / 2], [0, -1]], [[-w / 2, -d / 2], [-w / 2, d / 2], [-1, 0]]];
    for (const [a, b, n] of sides) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), bays = Math.max(1, Math.round(L / bay)), fl = (y1 - y0) / floor;
      const q = [[a[0], y0, a[1], 0, 0], [b[0], y0, b[1], bays, 0], [b[0], y1, b[1], bays, fl], [a[0], y1, a[1], 0, fl]];
      const nn = new THREE.Vector3(n[0], 0, n[1]).applyMatrix3(nm).normalize();
      for (const i of [0, 1, 2, 0, 2, 3]) { v.set(q[i][0], q[i][1], q[i][2]).applyMatrix4(M); P.pos.push(v.x, v.y, v.z); P.nor.push(nn.x, nn.y, nn.z); P.uv.push(q[i][3], q[i][4]); P.col.push(color.r, color.g, color.b); }
    }
  }
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const tmp = new THREE.Object3D();
  function boxAt(k, M, w, h, d, x, y, z, color, ry = 0) { tmp.position.set(x, y + h / 2, z); tmp.rotation.set(0, ry, 0); tmp.scale.set(w, h, d); tmp.updateMatrix(); addGeo(k, BOX, new THREE.Matrix4().multiplyMatrices(M, tmp.matrix), color); }
  function gable(k, M, w, d, y, rise, color, over = 0.5) { // a pitched roof along x
    const hw = w / 2 + over, hd = d / 2 + over, P = [[-hw, y, -hd], [hw, y, -hd], [hw, y + rise, 0], [-hw, y + rise, 0], [-hw, y, hd], [hw, y, hd]];
    const tri = [[0, 3, 1], [1, 3, 2], [4, 5, 3], [5, 2, 3], [0, 4, 3], [1, 2, 5]], g = new THREE.BufferGeometry(), pos = [];
    for (const t of tri) for (const i of t) pos.push(...P[i]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
    addGeo(k, g, M, color);
  }
  const C = c => lin(c);
  const WALLS = { home: [0xf6e7c8, 0xf3d1b5, 0xd9e8d2, 0xe7dff2, 0xf8f1e4, 0xcfe3ea, 0xf2c9a6], roof: [0xc8553d, 0xb64a3a, 0x5f6f86, 0x7a4e3a, 0xd06a3e], shop: [0xf4ead6, 0xe9d7bf, 0xd8e4ec, 0xf1dccc], awn: [0xe94f4f, 0x2f8f5b, 0x2e74c9, 0xf2a531, 0x8a4fd6], office: [0xbfd3e6, 0xa9c4dd, 0xe6dccb, 0xc9d8cf, 0xd8cfe6], shed: [0xd9dfe4, 0xc9d6dd, 0xe2d6c2], brick: [0xc0674b, 0xb35a42] };
  function addBuilding(b) {
    const M = new THREE.Matrix4().makeRotationY(b.rot).setPosition(b.x, GROUND, b.z), w = b.w, d = b.d;
    let h = 0;
    if (b.type === 'home') { // a two-storey house with a pitched roof, a porch and a chimney
      const wc = C(pick(WALLS.home)); h = 6.4;
      boxAt('trim', M, w + 0.3, 0.5, d + 0.3, 0, 0, 0, C(0xd8d0c0));
      walls('home', M, w, d, 0.5, h, wc);
      gable('roof', M, w, d, h, 3.4, C(b.roof || pick(WALLS.roof)));
      boxAt('trim', M, 1.4, 2.3, 0.3, 0, 0.5, d / 2 + 0.15, C(0x6b4a33)); // front door
      boxAt('detail', M, 3.2, 0.25, 1.6, 0, 2.9, d / 2 + 0.8, C(0xf4f0e6)); // porch roof
      boxAt('detail', M, 1, 2.6, 1, w * 0.28, h + 1.2, -d * 0.15, C(0xa45a46)); // chimney
      h += 3.4;
    } else if (b.type === 'apart' || b.type === 'starter') { // a walk-up: stone base, cornice, stoop, flat roof with a water tank
      const fl = b.floors || 3, wc = C(b.color || pick([0xc9775c, 0xe2b48b, 0xd99a7b, 0xbfc9d4, 0xe8d5b0])); h = 0.8 + fl * 3.2;
      boxAt('trim', M, w + 0.3, 0.8, d + 0.3, 0, 0, 0, C(0xcfc6b4));
      walls('apart', M, w, d, 0.8, h, wc);
      boxAt('trim', M, w + 0.8, 0.5, d + 0.8, 0, h, 0, C(0xf1ead9)); // cornice
      boxAt('roof', M, w - 0.2, 0.12, d - 0.2, 0, h + 0.5, 0, C(pick([0x6e737c, 0x7a6a5e, 0x5f6b74]))); // tar roof inside the cornice
      boxAt('trim', M, 1.8, 2.6, 0.35, 0, 0.8, d / 2 + 0.17, C(0x5a3a28)); // door
      for (let s = 0; s < 3; s++) boxAt('trim', M, 2.6, 0.27, 0.4, 0, s * 0.27, d / 2 + 0.6 + (2 - s) * 0.38, C(0xbfb8a8)); // stoop
      boxAt('detail', M, 2.8, 0.2, 1.3, 0, 3.5, d / 2 + 0.65, C(b.type === 'starter' ? 0x2e74c9 : 0x3d7a58)); // canopy
      if (b.type !== 'starter' || true) { boxAt('detail', M, 0.2, 1.8, 0.2, -w * 0.25 - 0.8, h + 0.2, -d * 0.2, C(0x3b3b3b)); }
      const tank = new THREE.CylinderGeometry(1.2, 1.2, 2, 10); tmp.position.set(-w * 0.25, h + 2.6, -d * 0.2); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); addGeo('detail', tank, new THREE.Matrix4().multiplyMatrices(M, tmp.matrix), C(0x9b6a43));
      h += 0.5;
    } else if (b.type === 'shop') { // shopfront, striped awning, sign and two floors of flats above
      const wc = C(pick(WALLS.shop)), fl = b.floors || 2; h = 4 + (fl - 1) * 3.2;
      walls('shopFront', M, w, d, 0, 4, C(0xffffff), w / Math.max(1, Math.round(w / 5)), 4);
      walls('shopTop', M, w, d, 4, h, wc, 4.4);
      boxAt('trim', M, w + 0.6, 0.45, d + 0.6, 0, h, 0, C(0xefe7d6)); boxAt('roof', M, w - 0.2, 0.12, d - 0.2, 0, h + 0.45, 0, C(pick([0x7a7f88, 0x6f6458, 0x5c6d78])));
      boxAt('detail', M, w - 1, 0.25, 2.2, 0, 3.6, d / 2 + 1.1, C(b.awn || pick(WALLS.awn)), 0); // awning
      boxAt('trim', M, w * 0.6, 0.9, 0.25, 0, 4.25, d / 2 + 0.13, C(0x22304f)); // sign
      boxAt('detail', M, 2.2, 0.9, 1.6, w * 0.25, h + 0.2, -d * 0.2, C(0xb9bec6)); // roof unit
    } else if (b.type === 'office' || b.type === 'tower') { // glass bands, stone frame, a lobby canopy, plant on the roof
      const fl = b.floors, wc = C(pick(WALLS.office)); h = 5 + fl * 3.6;
      walls('shopFront', M, w, d, 0, 5, C(0xf0f3f6), 5.5, 5);
      walls('office', M, w, d, 5, h, wc, 4, 3.6);
      boxAt('trim', M, w + 0.6, 0.8, d + 0.6, 0, h, 0, C(0xc9d0d8)); boxAt('roof', M, w - 0.4, 0.12, d - 0.4, 0, h + 0.8, 0, C(pick([0x56657a, 0x4f6b6a, 0x6a5a6e, 0x5b6b84])));
      boxAt('detail', M, 8, 0.4, 3, 0, 4.4, d / 2 + 1.5, C(0x2c3e57)); // lobby canopy
      boxAt('detail', M, w * 0.35, 3, d * 0.3, w * 0.12, h + 0.8, -d * 0.1, C(0xc5cad1)); boxAt('detail', M, 3, 2, 3, -w * 0.28, h + 0.8, d * 0.2, C(0xb3b9c1));
      if (b.type === 'tower') { // Capital Tower: setbacks, a gold crown and a spire, the island's landmark
        const w2 = w * 0.72, d2 = d * 0.72, h2 = h + 18;
        walls('office', M, w2, d2, h + 0.8, h2, wc, 4, 3.6); boxAt('trim', M, w2 + 0.8, 0.8, d2 + 0.8, 0, h2, 0, C(0xe9ecef));
        const w3 = w2 * 0.6, h3 = h2 + 12; walls('office', M, w3, w3, h2 + 0.8, h3, wc, 4, 3.6);
        boxAt('gold', M, w3 + 1.2, 2.2, w3 + 1.2, 0, h3, 0, C(0xf2c14e));
        const sp = new THREE.ConeGeometry(2.4, 22, 8); tmp.position.set(0, h3 + 13, 0); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); addGeo('gold', sp, new THREE.Matrix4().multiplyMatrices(M, tmp.matrix), C(0xf2c14e));
        h = h3 + 24;
      }
    } else if (b.type === 'warehouse') { // corrugated sides, roller doors, a curved roof
      const wc = C(pick(WALLS.shed)); h = 9;
      walls('shed', M, w, d, 0, h, wc, 3.2, 9);
      const roof = new THREE.CylinderGeometry(d / 2, d / 2, w, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(0);
      tmp.position.set(0, h, 0); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 0.35, 1); tmp.updateMatrix();
      addGeo('roof', roof, new THREE.Matrix4().multiplyMatrices(M, tmp.matrix), C(pick([0x5f7d95, 0x8a5a44, 0x6d8a64])));
      for (let i = -1; i <= 1; i++) boxAt('trim', M, 5, 5.5, 0.3, i * w * 0.28, 0, d / 2 + 0.15, C(0x9aa6b0)); // roller doors
      h += d * 0.35 * 0.5;
    } else if (b.type === 'factory') { // brick, tall windows, a sawtooth roof and a chimney
      h = 11;
      walls('brick', M, w, d, 0, h, C(pick(WALLS.brick)), 5, 11);
      const n = Math.max(3, Math.round(w / 8));
      for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; const tooth = new THREE.BufferGeometry(), s = w / n / 2, P = [[-s, 0, -d / 2], [s, 0, -d / 2], [s, 4, -d / 2], [-s, 0, d / 2], [s, 0, d / 2], [s, 4, d / 2]]; const tri = [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4]], pos = []; for (const t of tri) for (const k of t) pos.push(P[k][0] + x, P[k][1] + h, P[k][2]); tooth.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tooth.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2)); tooth.computeVertexNormals(); addGeo('roof', tooth, M, C(0x6b7078)); }
      const ch = new THREE.CylinderGeometry(1.4, 1.9, 22, 12); tmp.position.set(w * 0.38, 11, -d * 0.3); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); addGeo('trim', ch, new THREE.Matrix4().multiplyMatrices(M, tmp.matrix), C(0xa4573f));
      boxAt('trim', M, 6, 6, 0.3, 0, 0, d / 2 + 0.15, C(0x8c96a0));
      h = 22;
    } else if (b.type === 'barn') { // a red barn with white trim and a silo
      h = 5.5; walls('shed', M, w, d, 0, h, C(0xc0473a), 2.4, 5.5); gable('roof', M, w, d, h, 3.2, C(0x6b4b3a), 0.4);
      boxAt('trim', M, 3.6, 3.8, 0.3, 0, 0, d / 2 + 0.15, C(0xf4efe6));
      const silo = new THREE.CylinderGeometry(2.6, 2.6, 11, 14); tmp.position.set(w / 2 + 3.4, 5.5, 0); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); addGeo('trim', silo, new THREE.Matrix4().multiplyMatrices(M, tmp.matrix), C(0xd9dde0));
      const cap = new THREE.SphereGeometry(2.6, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2); tmp.position.set(w / 2 + 3.4, 11, 0); tmp.updateMatrix(); addGeo('trim', cap, new THREE.Matrix4().multiplyMatrices(M, tmp.matrix), C(0x9aa3ab));
      h = 13;
    } else if (b.type === 'mill') { // the timber mill: wooden sheds and a tall saw house
      h = 8; walls('shed', M, w, d, 0, h, C(0xb58a5b), 2.6, 8); gable('roof', M, w, d, h, 3.5, C(0x4f5a62), 0.6);
      boxAt('trim', M, 6, 6, 0.3, 0, 0, d / 2 + 0.15, C(0x6b4a33)); h = 11.5;
    } else if (b.type === 'kiosk') { h = 3.2; walls('shopFront', M, w, d, 0, 3, C(0xffffff), w, 3); boxAt('detail', M, w + 1.6, 0.25, d + 1.6, 0, 3, 0, C(pick(WALLS.awn))); }
    b.h = h;
    buildings.push(b);
  }
  function flushBuildings() {
    const mats = {
      home: new THREE.MeshStandardMaterial({ map: tex.home, vertexColors: true, roughness: 0.85 }),
      apart: new THREE.MeshStandardMaterial({ map: tex.apart, vertexColors: true, roughness: 0.85 }),
      office: new THREE.MeshStandardMaterial({ map: tex.office, vertexColors: true, roughness: 0.4, metalness: 0.15 }),
      shopFront: new THREE.MeshStandardMaterial({ map: tex.shopFront, vertexColors: true, roughness: 0.5 }),
      shopTop: new THREE.MeshStandardMaterial({ map: tex.shopTop, vertexColors: true, roughness: 0.85 }),
      shed: new THREE.MeshStandardMaterial({ map: tex.shed, vertexColors: true, roughness: 0.8 }),
      brick: new THREE.MeshStandardMaterial({ map: tex.brick, vertexColors: true, roughness: 0.9 }),
      roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }),
      trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
      gold: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6 }),
      detail: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, transparent: true }),
    };
    fadeMats.push([mats.detail, 380, 640]);
    for (const [k, P] of parts) {
      if (!P.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(P.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(P.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(P.col, 3));
      const m = new THREE.Mesh(g, mats[k]); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      if (k === 'detail') World.detailMesh = m;
    }
    parts.clear();
  }

  // place buildings along streets: each faces its street, keeps clear of junctions, roads, the shore and each other
  const placed = [];
  const overlaps = (x, z, w, d, rot) => {
    const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot)), hw = (w * c + d * s) / 2 + 1.2, hd = (w * s + d * c) / 2 + 1.2;
    for (const p of placed) if (Math.abs(p.x - x) < hw + p.hw && Math.abs(p.z - z) < hd + p.hd) return true;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const px = x + i * (hw - 1.2), pz = z + j * (hd - 1.2); if (roadDist(px, pz) < 3.2 || land(px, pz) < 18) return true; }
    return false;
  };
  function claim(b) { const c = Math.abs(Math.cos(b.rot)), s = Math.abs(Math.sin(b.rot)); placed.push({ x: b.x, z: b.z, hw: (b.w * c + b.d * s) / 2, hd: (b.w * s + b.d * c) / 2 }); }
  let nextId = 1;
  const STREETS = { centre: ['Harbour Row', 'Bank Street', 'Mint Lane', 'Exchange Place'], oldtown: ['Shell Street', 'Lantern Lane', 'Orchard Road', 'Kite Street', 'Bell Lane'], harbour: ['Quay Road', 'Anchor Way', 'Net Street'], farms: ['Meadow Lane', 'Mill Track'], beach: ['Beach Road'], mill: ['Ridge Road'] };
  function along(s, side, gap, make) {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz * side, nz = ux * side;
    for (let t = 13; t < L - 13;) {
      const spec = make(); if (!spec) break;
      const mid = t + spec.w / 2; if (mid + spec.w / 2 > L - 13) break;
      const offs = s.w / 2 + 3 + 1.6 + spec.d / 2, x = s.a[0] + ux * mid + nx * offs, z = s.a[1] + uz * mid + nz * offs;
      const rot = Math.atan2(-nx, -nz); // the model's front (+z) faces the street
      const zone = zoneAt(x, z);
      if (zone && !overlaps(x, z, spec.w, spec.d, rot)) {
        const b = Object.assign({ id: 'b' + nextId++, x, z, rot, district: zone.name, zoneId: zone.id, street: STREETS[zone.id] ? STREETS[zone.id][Math.abs(Math.round(s.a[0] + s.a[1])) % STREETS[zone.id].length] : 'Island Road' }, spec);
        b.name = `${1 + Math.floor(rnd() * 90)} ${b.street}`;
        claim(b); addBuilding(b);
        t += spec.w + gap();
      } else t += 4;
    }
  }
  function buildTown() {
    facades();
    // the landmark and the plaza first, so the grid fills in round them
    const tower = { id: 'tower', type: 'tower', name: 'Capital Tower', w: 34, d: 34, floors: 18, x: 40, z: -100, rot: 0, district: 'Capital Centre', zoneId: 'centre', street: 'Exchange Place', owner: 'city' };
    claim(tower); addBuilding(tower);
    placed.push({ x: -40, z: -20, hw: 34, hd: 34 }); // Founders Park
    World.park = [-40, -20];
    // the starter walk-up, on Shell Street in Old Town, two blocks from the beach and the avenue
    const home = { id: 'home', type: 'starter', name: '14 Shell Street', w: 13, d: 15, floors: 3, x: 0, z: 0, rot: 0, color: 0xd9906f, district: 'Old Town', zoneId: 'oldtown', street: 'Shell Street', owner: 'you' };
    home.x = 400 - (4 + 4.6 + home.d / 2); home.z = -12; home.rot = Math.PI / 2; // west side of Lantern Lane, facing the street
    claim(home); addBuilding(home); World.home = home;
    seed = 11;
    for (const s of R) {
      const zone = zoneAt((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2); if (!zone || s.kind === 'bridge') continue;
      for (const side of [1, -1]) {
        if (zone.id === 'centre') along(s, side, () => 6, () => s.kind === 'avenue' ? { type: 'shop', w: 14 + rnd() * 4, d: 13, floors: 2 + (rnd() < 0.5 ? 1 : 0) } : { type: 'office', w: 24 + rnd() * 8, d: 20 + rnd() * 6, floors: 4 + Math.floor(rnd() * 6) });
        else if (zone.id === 'oldtown') along(s, side, () => 4, () => s.kind === 'avenue' ? { type: 'shop', w: 13 + rnd() * 3, d: 12, floors: 2 } : rnd() < 0.62 ? { type: 'home', w: 10 + rnd() * 2, d: 9 + rnd() * 2 } : { type: 'apart', w: 12 + rnd() * 3, d: 13, floors: 3 + (rnd() < 0.3 ? 1 : 0) });
        else if (zone.id === 'harbour') along(s, side, () => 8, () => s.kind === 'avenue' ? { type: 'shop', w: 15, d: 13, floors: 2 } : rnd() < 0.7 ? { type: 'warehouse', w: 30 + rnd() * 12, d: 22 + rnd() * 4 } : { type: 'factory', w: 36, d: 26 });
        else if (zone.id === 'farms' && s.kind === 'lane') along(s, side, () => 70, () => rnd() < 0.5 ? { type: 'barn', w: 14, d: 10 } : { type: 'home', w: 10, d: 9, roof: 0x7a4e3a });
        else if (zone.id === 'mill') along(s, side, () => 12, () => ({ type: 'mill', w: 22 + rnd() * 8, d: 14 }));
        else if (zone.id === 'beach' && side === 1) along(s, side, () => 60, () => ({ type: 'kiosk', w: 5, d: 4 }));
      }
    }
    // Harbourside yards: a second row of sheds, and stacks of containers wherever there's room
    seed = 21;
    for (let x = -190; x <= 290; x += 24) for (let z = 128; z <= 286; z += 22) {
      if (zoneAt(x, z) !== ZONES[2]) continue;
      const shed = rnd() < 0.45, w = shed ? 20 : 14, d = shed ? 14 : 8, rot = rnd() < 0.5 ? 0 : Math.PI / 2;
      if (overlaps(x, z, w, d, rot)) continue;
      const b = { id: 'b' + nextId++, type: shed ? 'warehouse' : 'stack', w, d, x, z, rot, district: 'Harbourside', zoneId: 'harbour', street: 'Anchor Way' };
      b.name = `Yard ${nextId} Anchor Way`; claim(b);
      if (shed) addBuilding(b);
      else { const M = new THREE.Matrix4().makeRotationY(rot).setPosition(x, GROUND, z), cc = [0xd9453b, 0x2e74c9, 0x2f8f5b, 0xf2a531, 0xe8e2d6]; for (let i = 0; i < 2; i++) for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) boxAt('trim', M, 12, 2.6, 2.5, 0, k * 2.6, (i - 0.5) * 2.8, C(pick(cc))); }
    }
    flushBuildings();
  }

  // ---------- the harbour: quay walls, cranes, containers and ships ----------
  function buildHarbour() {
    const g = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.8 });
    const box = (w, h, d, x, y, z, m, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    // the quay: a stone wall along the bay, with bollards
    const qz0 = 306, qz1 = 342, qy = GROUND + 0.2;
    box(340, qy + 7, 48, 52, -7, 334, M(0xb7b0a2));
    box(340, 0.3, 48, 52, qy - 0.1, 334, M(0xcfc9bb));
    for (let x = -112; x <= 216; x += 14) box(0.7, 0.9, 0.7, x, qy + 0.2, 356, M(0x2e3640));
    // two gantry cranes
    for (const x of [-30, 110]) {
      const m = M(0xf2a531), dark = M(0x2b3440);
      box(1.2, 26, 1.2, x - 7, qy, 336, m); box(1.2, 26, 1.2, x + 7, qy, 336, m); box(1.2, 26, 1.2, x - 7, qy, 352, m); box(1.2, 26, 1.2, x + 7, qy, 352, m);
      box(16, 2.2, 52, x, qy + 26, 360, m); box(5, 4, 6, x, qy + 28, 350, dark); box(0.3, 14, 0.3, x, qy + 14, 372, dark);
    }
    // stacks of containers
    const cols = [0xd9453b, 0x2e74c9, 0x2f8f5b, 0xf2a531, 0x8a4fd6, 0xe8e2d6].map(c => M(c));
    seed = 5;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) box(12, 2.6, 2.6, -95 + i * 16 + (i > 2 ? 60 : 0), qy + k * 2.6, 312 + j * 3, pick(cols));
    // ships: a container ship at the quay, a ferry, fishing boats and sailboats in the bay
    const hull = (L, B, H, c, deckC) => { const s = new THREE.Group(); const shape = new THREE.Shape(); shape.moveTo(-L / 2, -B / 2); shape.lineTo(L / 2 - B * 0.9, -B / 2); shape.quadraticCurveTo(L / 2 + B * 0.2, 0, L / 2 - B * 0.9, B / 2); shape.lineTo(-L / 2, B / 2); shape.lineTo(-L / 2, -B / 2);
      const hg = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false }).rotateX(-Math.PI / 2); const hm = new THREE.Mesh(hg, M(c)); hm.position.y = -1.2; hm.castShadow = true; s.add(hm);
      const dk = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), M(deckC)); dk.position.y = H - 1.19; s.add(dk); return s; };
    const ship = hull(70, 13, 6, 0x1f3f6b, 0x8c5a40); ship.position.set(70, 0, 367); ship.rotation.y = 0;
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(11, 2.6, 2.6 * 4), pick(cols)); c.position.set(-18 + i * 12, 6.1 + k * 2.6, 0); c.castShadow = true; ship.add(c); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 11), M(0xf4f1ea)); br.position.set(-29, 8.6, 0); br.castShadow = true; ship.add(br);
    g.add(ship);
    const ferry = hull(38, 10, 4, 0xf4f1ea, 0xdfe6ec); ferry.position.set(-60, 0, 420); ferry.rotation.y = 0.5;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 8), M(0x2e74c9)); cab.position.set(-2, 5, 0); ferry.add(cab); g.add(ferry);
    const boats = [];
    for (let i = 0; i < 6; i++) { const b = hull(9, 3.2, 2, pick([0xe94f4f, 0xf4f1ea, 0x2f8f5b, 0xf2a531]), 0xc79b6b); b.position.set(-100 + i * 50 + rnd() * 20, 0, 380 + rnd() * 70); b.rotation.y = rnd() * 6; if (i % 2) { const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9), M(0xeeeeee)); mast.position.y = 5.5; b.add(mast); const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 9.5, 0), new THREE.Vector3(0, 1.5, 3.8)]), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })); sail.geometry.computeVertexNormals(); b.add(sail); } g.add(b); boats.push(b); }
    tick.push((dt, t) => { boats.forEach((b, i) => { b.position.y = Math.sin(t * 1.2 + i) * 0.18; b.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.03; }); ship.position.y = Math.sin(t * 0.5) * 0.08; ferry.position.y = Math.sin(t * 0.8) * 0.12; });
    // a wooden pier for the fishing boats
    box(6, 0.4, 60, -150, qy - 0.6, 395, M(0xa77b52)); for (let z = 370; z <= 422; z += 8) for (const x of [-152.5, -147.5]) box(0.5, 8, 0.5, x, -6, z, M(0x6b4a33));
    // the lighthouse on its islet
    const lh = new THREE.Group(); lh.position.set(ISLET.x + 10, GROUND, ISLET.z + 18);
    const seg = (r0, r1, h, y, c) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 16), M(c)); o.position.y = y + h / 2; o.castShadow = true; lh.add(o); };
    seg(4.2, 3.6, 7, 0, 0xf4f1ea); seg(3.6, 3.1, 7, 7, 0xd9453b); seg(3.1, 2.7, 7, 14, 0xf4f1ea); seg(2.7, 2.4, 3, 21, 0xd9453b);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3, 12), new THREE.MeshStandardMaterial({ color: lin(0xfff3b0), emissive: lin(0x8a6a10) })); lamp.position.y = 25.5; lh.add(lamp);
    const capm = new THREE.Mesh(new THREE.ConeGeometry(3, 3, 12), M(0x2b3440)); capm.position.y = 28.5; lh.add(capm);
    g.add(lh);
    scene.add(g);
  }

  // ---------- nature and fields ----------
  function buildNature() {
    // fields in Greenfields: striped crops in soft greens and golds
    const fields = [[-640, -40, -470, 70], [-560, 120, -450, 210], [-410, 120, -300, 290], [-640, 120, -600, 290], [-410, -40, -300, 70]];
    const fcol = [0xb7d36a, 0xe2c25a, 0x8fc35f, 0xd7b45b, 0xa6cc6a];
    fields.forEach(([x0, z0, x1, z1], i) => {
      const cv = canvasTex(64, 64, (g) => { g.fillStyle = '#' + fcol[i].toString(16).padStart(6, '0'); g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(70,90,30,.22)'; for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 3); }, true);
      const m = flatMesh([[[x0, z0], 0, 0], [[x0, z1], 0, (z1 - z0) / 8], [[x1, z0], (x1 - x0) / 8, 0], [[x1, z0], (x1 - x0) / 8, 0], [[x0, z1], 0, (z1 - z0) / 8], [[x1, z1], (x1 - x0) / 8, (z1 - z0) / 8]], GROUND + 0.1, off(new THREE.MeshStandardMaterial({ map: cv, roughness: 1 }), -1));
      m.material.map.repeat.set(1, 1);
    });
    // trees: a forest on the hills, street trees in Old Town, the park, palms on the beach
    const trees = [];
    seed = 99;
    for (let i = 0; i < 20000 && trees.length < 4200; i++) {
      const x = -760 + rnd() * 1500, z = -560 + rnd() * 1050, s = land(x, z);
      if (s < 24 || zoneAt(x, z) || roadDist(x, z) < 6) continue;
      const north = z < -120 || x < -480;
      if (!north && (fbm(x * 2.2, z * 2.2) < 0.5 ? rnd() < 0.93 : rnd() < 0.25)) continue; // open land gets groves and scattered trees, not bare lawn
      if (fields.some(([x0, z0, x1, z1]) => x > x0 - 4 && x < x1 + 4 && z > z0 - 4 && z < z1 + 4)) continue;
      trees.push([x, heightAt(x, z, s), z, 0.8 + rnd() * 0.7, north && rnd() < 0.6 ? 1 : 0]);
    }
    for (let x = -66; x <= -14; x += 13) for (let z = -46; z <= 6; z += 13) if (Math.hypot(x + 40, z + 20) > 9) trees.push([x + rnd() * 3, GROUND, z + rnd() * 3, 0.9, 0]);
    for (const s of R) { const zn = zoneAt((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2); if (!zn || zn.id !== 'oldtown' || s.w < 8) continue; const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz); for (let t = 18; t < L - 18; t += 22) for (const side of [1, -1]) { const nx = -dz / L * side, nz = dx / L * side, x = s.a[0] + dx / L * t + nx * (s.w / 2 + 2), z = s.a[1] + dz / L * t + nz * (s.w / 2 + 2); if (!placed.some(p => Math.abs(p.x - x) < p.hw + 1 && Math.abs(p.z - z) < p.hd + 1)) trees.push([x, GROUND + 0.18, z, 0.6, 0]); } }
    const leaf = new THREE.IcosahedronGeometry(3.2, 0).translate(0, 6, 0), pine = new THREE.ConeGeometry(2.8, 8, 7).translate(0, 7.5, 0), trunk = new THREE.CylinderGeometry(0.35, 0.45, 3.4, 6).translate(0, 1.7, 0);
    const mk = (geo, c, list) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.9, flatShading: true }), list.length); list.forEach((t, i) => { tmp.position.set(t[0], t[1], t[2]); tmp.rotation.set(0, t[0] % 6, 0); tmp.scale.setScalar(t[3]); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); }); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
    mk(trunk, 0x7a5236, trees); mk(leaf, 0x5fae4f, trees.filter(t => !t[4])); mk(pine, 0x3f8a4a, trees.filter(t => t[4]));
    // the park: a fountain and paths
    const pk = World.park, pg = new THREE.Group();
    const pm = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.8 });
    const fo = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 0.8, 24), pm(0xd8d2c4)); fo.position.set(pk[0], GROUND + 0.4, pk[1]); pg.add(fo);
    const wa = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.2, 24), pm(0x5fc3d8)); wa.position.set(pk[0], GROUND + 0.75, pk[1]); pg.add(wa);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: lin(0xdff6ff), transparent: true, opacity: 0.8 })); jet.position.set(pk[0], GROUND + 2.6, pk[1]); pg.add(jet);
    flatMesh([[[pk[0] - 34, pk[1] - 2], 0, 0], [[pk[0] - 34, pk[1] + 2], 0, 1], [[pk[0] + 34, pk[1] - 2], 1, 0], [[pk[0] + 34, pk[1] - 2], 1, 0], [[pk[0] - 34, pk[1] + 2], 0, 1], [[pk[0] + 34, pk[1] + 2], 1, 1], [[pk[0] - 2, pk[1] - 34], 0, 0], [[pk[0] - 2, pk[1] + 34], 0, 1], [[pk[0] + 2, pk[1] - 34], 1, 0], [[pk[0] + 2, pk[1] - 34], 1, 0], [[pk[0] - 2, pk[1] + 34], 0, 1], [[pk[0] + 2, pk[1] + 34], 1, 1]], GROUND + 0.12, off(pm(0xe6dcc6), -1));
    scene.add(pg);
    // logs at the timber mill and beach umbrellas
    const logs = [], umb = [];
    for (let i = 0; i < 40; i++) logs.push([-90 + (i % 10) * 3.2, GROUND + 0.8 + Math.floor(i / 10) * 1.4, -330 + Math.floor(i / 20) * 9]);
    const logM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 0.7, 7, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: lin(0xa0703f), roughness: 0.9 }), logs.length);
    logs.forEach((l, i) => { tmp.position.set(l[0], l[1], l[2]); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); logM.setMatrixAt(i, tmp.matrix); }); logM.castShadow = true; scene.add(logM);
    for (let z = -150; z < 330; z += 26) for (let k = 0; k < 2; k++) { const x = 640 + k * 18 + (z % 3) * 4, s = land(x, z); if (s > 6 && s < 60) umb.push([x, heightAt(x, z, s), z, k]); }
    const ucol = [0xe94f4f, 0x2e74c9, 0xf2a531];
    umb.forEach((u, i) => { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3), new THREE.MeshStandardMaterial({ color: 0xffffff })); pole.position.set(u[0], u[1] + 1.5, u[2]); const top = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1, 8), new THREE.MeshStandardMaterial({ color: lin(ucol[i % 3]), flatShading: true })); top.position.set(u[0], u[1] + 3.2, u[2]); top.castShadow = true; scene.add(pole, top); });
  }

  // ---------- life: cars on the roads ----------
  function buildLife() {
    const segs = R.filter(s => s.kind !== 'bridge' && s.kind !== 'lane'), n = 160, cars = [];
    const body = new THREE.BoxGeometry(2, 1.2, 4.2).translate(0, 0.9, 0), cabin = new THREE.BoxGeometry(1.7, 0.8, 2.2).translate(0, 1.8, -0.2);
    const geo = mergeTwo(body, cabin);
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.5 }), n), col = [0xe94f4f, 0x2e74c9, 0xf2a531, 0xf4f1ea, 0x2f8f5b, 0x3b3f48, 0x8a4fd6].map(c => lin(c));
    seed = 3;
    for (let i = 0; i < n; i++) { cars.push({ s: pick(segs), t: rnd(), v: (8 + rnd() * 6) * (rnd() < 0.5 ? 1 : -1) }); m.setColorAt(i, pick(col)); }
    m.castShadow = true; scene.add(m);
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
  }
  function mergeTwo(a, b) { const g = new THREE.BufferGeometry(), A = a.toNonIndexed(), B = b.toNonIndexed(); for (const k of ['position', 'normal']) g.setAttribute(k, new THREE.Float32BufferAttribute([...A.attributes[k].array, ...B.attributes[k].array], 3)); return g; }

  // ---------- each frame: camera clipping, shadows that follow the view, fading detail ----------
  const SUN = new THREE.Vector3(-0.55, 0.62, 0.5).normalize();
  function frame(dt) {
    clock += dt;
    controls.update();
    // keep the camera over the island
    const t = controls.target; t.x = clamp(t.x, -700, 680); t.z = clamp(t.z, -500, 520); t.y = GROUND;
    const dist = camera.position.distanceTo(t);
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
    for (const f2 of tick) f2(dt, clock);
    renderer.render(scene, camera);
  }

  // ---------- camera helpers ----------
  function view(x, z, dist, polar, az) { return { t: new THREE.Vector3(x, GROUND, z), dist, polar, az }; }
  function place(v) { const s = Math.sin(v.polar) * v.dist; controls.target.copy(v.t); camera.position.set(v.t.x + Math.sin(v.az) * s, v.t.y + Math.cos(v.polar) * v.dist, v.t.z + Math.cos(v.az) * s); camera.lookAt(v.t); }
  function current() { const d = camera.position.clone().sub(controls.target), dist = d.length(); return { t: controls.target.clone(), dist, polar: Math.acos(clamp(d.y / dist, -1, 1)), az: Math.atan2(d.x, d.z) }; }
  let fly = null;
  function flyTo(v, secs = 1.6, done) { fly = { a: current(), b: v, k: 0, secs, done }; controls.enabled = false; }
  function step(dt) {
    if (fly) {
      fly.k = Math.min(1, fly.k + dt / fly.secs); const e = fly.k < 0.5 ? 4 * fly.k ** 3 : 1 - (-2 * fly.k + 2) ** 3 / 2, a = fly.a, b = fly.b;
      let daz = b.az - a.az; daz = Math.atan2(Math.sin(daz), Math.cos(daz));
      place({ t: a.t.clone().lerp(b.t, e), dist: Math.exp(Math.log(a.dist) * (1 - e) + Math.log(b.dist) * e), polar: a.polar + (b.polar - a.polar) * e, az: a.az + daz * e });
      if (fly.k >= 1) { const d = fly.done; fly = null; controls.enabled = true; if (d) d(); }
    }
    frame(dt);
  }
  const fit = d => d * clamp(1.3 / camera.aspect, 1, 2.1); // narrow (portrait) screens stand further back so the whole building fits
  const homeView = () => view(World.home.x, World.home.z, fit(78), 0.8, World.home.rot + 0.6);
  const overview = () => view(-10, -10, 1600, 0.62, 0.35);
  function viewOf(b) { return view(b.x, b.z, fit(clamp(Math.max(b.w, b.d, b.h) * 3, 70, 420)), 0.85, b.rot + 0.55); }

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
    const vis = marker && marker.visible; if (marker) marker.visible = false;
    for (const [m] of fadeMats) { m.opacity = 1; m.visible = true; }
    const old = { fn: scene.fog.near, ff: scene.fog.far }; scene.fog.near = 1e5; scene.fog.far = 2e5;
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
    scene.fog.near = old.fn; scene.fog.far = old.ff; if (marker) marker.visible = vis;
    const BW = W * SS, BH = H * SS, px = new Uint8Array(BW * BH * 4); renderer.readRenderTargetPixels(rt, 0, 0, BW, BH, px);
    const big = document.createElement('canvas'); big.width = BW; big.height = BH; const bg = big.getContext('2d'), img = bg.createImageData(BW, BH);
    for (let y = 0; y < BH; y++) img.data.set(px.subarray((BH - 1 - y) * BW * 4, (BH - y) * BW * 4), y * BW * 4); // flip: WebGL rows start at the bottom
    bg.putImageData(img, 0, 0);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, W, H);
    const url = cv.toDataURL('image/jpeg', 0.86); shots.set(key, url);
    return url;
  }

  return { init, step, frame, place, view, flyTo, current, homeView, overview, viewOf, pickAt, mark, photo, buildings, ZONES, land, heightAt, get camera() { return camera; }, get renderer() { return renderer; }, get scene() { return scene; }, get controls() { return controls; }, get flying() { return !!fly; } };
})();
