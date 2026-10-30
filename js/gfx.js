// Capital Street graphics (Goal 21): made for recent phones, tablets and computers.
// Every frame is drawn in high dynamic range and finished like a film: bright things glow (bloom), colours are graded
// (cool shadows, warm highlights), the edges darken a little and distance fades into haze. The sun follows the game
// clock, so mornings are pale, evenings golden and nights dark blue with lit windows, glowing streets and stars.
// The sky has drifting clouds, glass towers reflect it, and the sea and rivers have moving waves that catch the sun.
// Devices that are likely too slow get a warning once; the game doesn't lower its graphics for them.
'use strict';
window.Post = (function () {
  const $ = id => document.getElementById(id);
  const caps = renderer.capabilities, gl = renderer.getContext();
  const hdr = caps.isWebGL2 && !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ---------- shared values every shader reads ----------
  const U = {
    time: { value: 0 }, night: { value: 0 }, amb: { value: new THREE.Color(1, 1, 1) },
    sunDir: { value: new THREE.Vector3().copy(SUN_DIR) }, sunCol: { value: new THREE.Color(1, 0.9, 0.75) }
  };
  const NOISE = `
    float gHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float gNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float gFbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * gNoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }`;

  // ---------- haze: distance fades into the colour of the horizon, never all the way ----------
  THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace('smoothstep( fogNear, fogFar, fogDepth )', 'smoothstep( fogNear, fogFar, fogDepth ) * 0.72');

  // ---------- the sky: gradient, sun glow and disc, drifting clouds, stars at night ----------
  const SKY_FS = `uniform vec3 top, bottom, sunDir, sunCol; uniform float time, night, env; varying vec3 vD;
    ${NOISE}
    void main(){
      vec3 d = normalize(vD); float y = d.y;
      vec3 c = mix(bottom, top, pow(clamp(y, 0.0, 1.0), 0.42));
      if (y < 0.0) c = bottom * mix(1.0, 0.8, clamp(-y * 5.0, 0.0, 1.0));
      float sd = max(dot(d, sunDir), 0.0), day = 1.0 - night;
      c += sunCol * (pow(sd, 5.0) * 0.28 + pow(sd, 48.0) * 0.55) * mix(0.15, 1.0, day);
      c = mix(c, sunCol * 1.15, pow(sd, 3.0) * 0.45 * day * (1.0 - clamp(y * 2.5, 0.0, 1.0))); // the sky glows around a low sun
      float cov = 0.0;
      if (y > 0.0) {
        vec2 uv = d.xz / (y + 0.1) * 1.3 + vec2(time * 0.006, time * 0.0025);
        float n = gFbm(uv);
        cov = smoothstep(0.5, 0.8, n) * smoothstep(0.0, 0.2, y);
        float lit = clamp(0.62 + (n - gFbm(uv + sunDir.xz * 0.08)) * 5.0, 0.2, 1.25);
        vec3 shade = mix(bottom * 0.62, vec3(0.03, 0.04, 0.07), night);
        vec3 bright = mix(vec3(1.0), sunCol, 0.55) * mix(1.15, 0.12, night);
        c = mix(c, mix(shade, bright, lit) + sunCol * pow(sd, 10.0) * 0.6 * day, cov * 0.92);
        vec3 s = floor(d * 420.0);
        float st = step(0.9983, gHash(s.xy + s.z * 7.13));
        c += vec3(st) * night * 2.0 * (1.0 - cov) * smoothstep(0.05, 0.3, y);
      }
      c += sunCol * smoothstep(0.99935, 0.99975, sd) * (1.0 - cov) * (env > 0.5 ? 2.0 : 30.0) * mix(0.25, 1.0, day);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`;
  skyMat.uniforms.sunDir = U.sunDir; skyMat.uniforms.sunCol = U.sunCol; skyMat.uniforms.time = U.time; skyMat.uniforms.night = U.night; skyMat.uniforms.env = { value: 0 };
  skyMat.fragmentShader = SKY_FS; skyMat.needsUpdate = true;
  // reflections: the same sky (with a softer sun) baked into an environment map, again whenever the light changes
  const envMat = skyMat.clone();
  envMat.uniforms.env.value = 1;
  const envScene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), envMat));
  const envGround = new THREE.MeshBasicMaterial({ color: lin(0x55524c) });
  envScene.add(new THREE.Mesh(new THREE.CircleGeometry(9.9, 32).rotateX(-Math.PI / 2).translate(0, -1, 0), envGround));
  let envRT = null;
  function bakeEnv() {
    for (const k of ['top', 'bottom']) envMat.uniforms[k].value.copy(skyMat.uniforms[k].value);
    envMat.uniforms.sunDir.value.copy(U.sunDir.value); envMat.uniforms.sunCol.value.copy(U.sunCol.value); envMat.uniforms.night.value = U.night.value; envMat.uniforms.time.value = U.time.value;
    envGround.color.setRGB(0.09, 0.085, 0.08).multiplyScalar(1 - 0.8 * U.night.value);
    const rt = pmrem.fromScene(envScene, 0.02);
    scene.environment = rt.texture;
    if (envRT) envRT.dispose();
    envRT = rt;
  }

  // ---------- buildings: mirror-like glass towers, and windows that light up at night ----------
  {
    const orig = buildingMat.onBeforeCompile;
    buildingMat.onBeforeCompile = (sh, r) => {
      orig(sh, r);
      sh.uniforms.uNight = U.night;
      sh.fragmentShader = sh.fragmentShader
        .replace('uniform vec3 awnC[8];', 'uniform vec3 awnC[8];\nuniform float uNight;')
        .replace('float gMask = 0.0;', 'float gMask = 0.0; float gLit = 0.0;')
        .replace('gMask = win;', 'gMask = win; { float seed = floor(vWP.x * 0.05) * 7.7 + floor(vWP.z * 0.05) * 13.3; gLit = win * mix(step(0.7, hash1(floor(fy) * 17.0 + floor(fx) * 3.1 + seed)), step(0.78, hash1(floor(fy) * 5.0 + floor(fx / 3.0) * 11.0 + seed)) * 0.8, far); }')
        .replace('roughnessFactor = mix(roughnessFactor, 0.3, gMask);', 'roughnessFactor = mix(roughnessFactor, mat == 9.0 ? 0.05 : 0.12, gMask);')
        .replace('metalnessFactor = mix(metalnessFactor, 0.25, gMask);', 'metalnessFactor = mix(metalnessFactor, mat == 9.0 ? 0.75 : 0.5, gMask);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += mix(vec3(1.0, 0.62, 0.3), vec3(0.75, 0.85, 1.0), step(0.75, hash1(floor(vWP.y * 0.3) + floor(vWP.x * 0.1)))) * gLit * uNight * 1.15;')
        .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n#if defined( RE_IndirectSpecular )\nradiance *= 1.0 + 1.8 * gMask;\n#endif');
    };
    buildingMat.envMapIntensity = 0.6;
    buildingMat.needsUpdate = true;
  }

  // ---------- water: waves, sky reflections and the sun's glitter ----------
  const water = new THREE.ShaderMaterial({
    fog: true, depthWrite: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, deep: { value: lin(0x0b3d5c) } }]),
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      uniform float time, night; uniform vec3 sunDir, sunCol, top, bottom, deep; varying vec3 vW;
      ${NOISE}
      // the slope of drifting noise at one size, faded out where it would be smaller than a pixel
      vec2 wv(vec2 p, float L, vec2 drift, float a, float px) {
        float fade = 1.0 - smoothstep(0.15, 0.6, px / L);
        if (fade <= 0.0) return vec2(0.0);
        vec2 q = p / L + drift * time, e = vec2(0.07, 0.0);
        float c = gNoise(q);
        return vec2(gNoise(q + e.xy) - c, gNoise(q + e.yx) - c) / 0.07 * a * fade;
      }
      void main(){
        vec3 toC = cameraPosition - vW; float dist = length(toC); vec3 v = toC / dist; vec2 p = vW.xz;
        float px = dist * 0.0022 / max(v.y, 0.08); // about how many metres one pixel covers along the water
        vec2 g = wv(p, 210.0, vec2(0.012, 0.004), 0.05, px) + wv(p, 75.0, vec2(-0.02, 0.03), 0.06, px) + wv(p, 26.0, vec2(0.05, -0.03), 0.07, px)
               + wv(p, 9.0, vec2(-0.09, -0.05), 0.07, px) + wv(p, 3.2, vec2(0.12, 0.15), 0.06, px);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 r = reflect(-v, n); r.y = abs(r.y);
        float sd = max(dot(r, sunDir), 0.0);
        vec3 sky = mix(bottom, top, pow(clamp(r.y, 0.0, 1.0), 0.42)) + sunCol * pow(sd, 6.0) * 0.25 * (1.0 - night);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 body = deep * (0.25 + 0.75 * clamp(sunDir.y * 2.0, 0.0, 1.0)) * (1.0 - 0.85 * night);
        vec3 c = mix(body, sky, fres);
        c += sunCol * (pow(sd, 900.0) * 40.0 + pow(sd, 120.0) * 0.8) * step(0.0, sunDir.y);
        c += vec3(1.0, 0.62, 0.3) * night * 0.025 * (0.6 + 0.4 * sin(p.x * 0.05 + time) * sin(p.y * 0.04));
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`
  });
  Object.assign(water.uniforms, { time: U.time, night: U.night, sunDir: U.sunDir, sunCol: U.sunCol });

  // ---------- ground: grass and parks vary in colour, streets glow at night ----------
  function grassy(m) {
    const basic = m.isMeshBasicMaterial; // unlit layers (the world map) take the light's colour from uAmb
    m.onBeforeCompile = sh => {
      if (basic) sh.uniforms.uAmb = U.amb;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vGW;' + (basic ? '\nuniform vec3 uAmb;' : '') + NOISE)
        .replace('#include <color_fragment>', `#include <color_fragment>
          { float n = gFbm(vGW * 0.0019) * 0.6 + gFbm(vGW * 0.016) * 0.4;
            diffuseColor.rgb *= mix(0.74, 1.16, n);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.02, 0.7), smoothstep(0.58, 0.82, n) * 0.6);${basic ? ' diffuseColor.rgb *= uAmb;' : ''} }`);
    };
    m.needsUpdate = true;
  }
  const streets = [];
  let upgraded = false;
  function upgradeWorld() {
    const same = (c, hex) => c && c.equals(lin(hex));
    scene.traverse(o => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      const m = o.material;
      if (m.isMeshBasicMaterial && same(m.color, OCEAN)) o.material = water;
      else if (same(m.color, LAND) || same(m.color, 0x6aaa4c) || same(m.color, PAVEMENT)) grassy(m);
      else if (m.isMeshStandardMaterial && (same(m.color, ASPHALT) || same(m.color, SIDEWALK))) {
        if (same(m.color, SIDEWALK)) m.color.copy(lin(0xa8a397)); // pale pavements read as white from afar
        if (m.color.equals(lin(ASPHALT))) streets.push(m);
      }
    });
    upgraded = true;
  }

  // ---------- the sun follows the clock ----------
  const C = hex => lin(hex);
  const SKY = {
    dayTop: C(0x2f7fe0), dayBot: C(0xc9e3f8), goldTop: C(0x3a5fbf), goldBot: C(0xffb27a), nightTop: C(0x040817), nightBot: C(0x16203d),
    sunDay: new THREE.Color(1, 0.95, 0.88), sunGold: new THREE.Color(1, 0.56, 0.26), moon: new THREE.Color(0.5, 0.62, 1)
  };
  let hemi = null, envKey = -1;
  const t1 = new THREE.Color(), t2 = new THREE.Color();
  function light(hour) {
    const a = (hour - 6.2) / 13.6 * Math.PI, up = Math.sin(a);
    const day = smooth(-0.1, 0.18, up), gold = 1 - smooth(0.04, 0.5, Math.abs(up)), night = 1 - smooth(-0.08, 0.2, up);
    const dir = U.sunDir.value;
    if (up > -0.05) dir.set(Math.cos(a), Math.max(0.035, up * 0.88), 0.42 + 0.2 * up).normalize();
    else dir.set(-Math.cos(a) * 0.6, 0.55, -0.35).normalize(); // the moon
    SUN_DIR.copy(dir);
    U.night.value = night;
    U.sunCol.value.copy(SKY.sunDay).lerp(SKY.sunGold, gold * day).lerp(SKY.moon, night);
    sunLight.color.copy(U.sunCol.value);
    sunLight.intensity = 3.3 * day * (1 - 0.35 * gold) + 0.32 * night;
    t1.copy(SKY.dayTop).lerp(SKY.goldTop, gold * 0.8).lerp(SKY.nightTop, night);
    t2.copy(SKY.dayBot).lerp(SKY.goldBot, gold * 0.85).lerp(SKY.nightBot, night);
    skyMat.uniforms.top.value.copy(t1); skyMat.uniforms.bottom.value.copy(t2);
    water.uniforms.top.value.copy(t1); water.uniforms.bottom.value.copy(t2);
    scene.fog.color.copy(t2);
    if (!hemi) scene.traverse(o => { if (o.isHemisphereLight) hemi = o; });
    if (hemi) { hemi.intensity = 0.12 + 0.36 * day; hemi.color.copy(t2).lerp(SKY.dayBot, 0.5); }
    exposure = 1.0 + 0.7 * night - 0.08 * gold;
    U.amb.value.setRGB(0.82, 0.84, 0.8).lerp(SKY.sunGold, gold * day * 0.35).multiplyScalar(0.14 + 0.86 * day).add(t1.setRGB(0.02, 0.03, 0.06).multiplyScalar(night));
    for (const m of streets) m.emissive.setRGB(0.07, 0.036, 0.012).multiplyScalar(night); // street lights
    const key = Math.round(hour * 4);
    if (key !== envKey) { envKey = key; bakeEnv(); }
  }
  let exposure = 1, force = null; // force: an hour to show, for trying the lighting out
  const MENU_HOUR = 18.95; // the menu is always at golden hour
  frameHooks.push((dt, dist) => {
    U.time.value += dt;
    if (!window.CS) return;
    if (!upgraded) upgradeWorld();
    const inMenu = !$('title').hidden || !window.Market;
    light(force != null ? force : inMenu ? MENU_HOUR : (Market.state.time % 1440 + 1440) % 1440 / 60);
    scene.fog.near = dist * 1.1 + 900; scene.fog.far = dist * 9 + 26000; // haze: frame() set it a moment ago, this wins
  });

  // ---------- the film finish: bloom, grading, vignette ----------
  let on = true;
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false; quadScene.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const pass = (fs, uniforms, extra) => new THREE.ShaderMaterial(Object.assign({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false }, extra));
  const pre = pass(`uniform sampler2D t; uniform float thr; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb; float b = max(c.r, max(c.g, c.b)), k = thr * 0.5;
      float s = clamp(b - thr + k, 0.0, 2.0 * k); s = s * s / (4.0 * k + 1e-4);
      gl_FragColor = vec4(min(c * max(s, b - thr) / max(b, 1e-4), vec3(40.0)), 1.0); }`, { t: { value: null }, thr: { value: 1.7 } });
  const down = pass(`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb * 4.0 + texture2D(t, vUv - px).rgb + texture2D(t, vUv + px).rgb
      + texture2D(t, vUv + vec2(px.x, -px.y)).rgb + texture2D(t, vUv + vec2(-px.x, px.y)).rgb; gl_FragColor = vec4(c / 8.0, 1.0); }`, { t: { value: null }, px: { value: new THREE.Vector2() } });
  const up = pass(`uniform sampler2D t; uniform vec2 px; uniform float k; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv + vec2(-px.x * 2.0, 0.0)).rgb + texture2D(t, vUv + vec2(px.x * 2.0, 0.0)).rgb
      + texture2D(t, vUv + vec2(0.0, -px.y * 2.0)).rgb + texture2D(t, vUv + vec2(0.0, px.y * 2.0)).rgb
      + (texture2D(t, vUv + px).rgb + texture2D(t, vUv - px).rgb + texture2D(t, vUv + vec2(px.x, -px.y)).rgb + texture2D(t, vUv + vec2(-px.x, px.y)).rgb) * 2.0;
      gl_FragColor = vec4(c / 12.0 * k, 1.0); }`, { t: { value: null }, px: { value: new THREE.Vector2() }, k: { value: 1 } }, { blending: THREE.AdditiveBlending });
  const comp = pass(`uniform sampler2D tS, tB; uniform float exposure, bloom, vig, time; varying vec2 vUv;
    vec3 rrt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c) {
      const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      return clamp(O * rrt(I * (c / 0.6)), 0.0, 1.0);
    }
    void main(){
      vec3 c = texture2D(tS, vUv).rgb + texture2D(tB, vUv).rgb * bloom;
      c = aces(c * exposure);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.35); // a gentle S-curve for depth
      l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.18);
      c *= mix(vec3(0.95, 0.99, 1.06), vec3(1.05, 1.0, 0.93), smoothstep(0.05, 0.75, l));
      vec2 q = vUv - 0.5; c *= 1.0 - vig * dot(q, q) * 1.5;
      c = max(c, 0.0);
      c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      c += (fract(sin(dot(gl_FragCoord.xy + fract(time) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }`, { tS: { value: null }, tB: { value: null }, exposure: { value: 1 }, bloom: { value: 0.2 }, vig: { value: 0.55 }, time: U.time });

  const opts = { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  let main = null, w = 0, h = 0;
  const chain = [], sz = new THREE.Vector2();
  function size() {
    renderer.getDrawingBufferSize(sz);
    if (sz.x === w && sz.y === h && main) return;
    w = sz.x; h = sz.y;
    if (main) main.dispose();
    for (const c of chain) c.dispose();
    chain.length = 0;
    const o = Object.assign({}, opts, { depthBuffer: true });
    if (caps.isWebGL2 && GFX.aa && THREE.WebGLMultisampleRenderTarget) { main = new THREE.WebGLMultisampleRenderTarget(w, h, o); main.samples = 4; } else main = new THREE.WebGLRenderTarget(w, h, o);
    let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < 6 && bw > 8 && bh > 8; i++) { chain.push(new THREE.WebGLRenderTarget(bw, bh, opts)); bw >>= 1; bh >>= 1; }
  }
  function blit(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }
  function finish() {
    pre.uniforms.t.value = main.texture; blit(pre, chain[0]);
    for (let i = 1; i < chain.length; i++) { down.uniforms.t.value = chain[i - 1].texture; down.uniforms.px.value.set(1 / chain[i - 1].width, 1 / chain[i - 1].height); blit(down, chain[i]); }
    for (let i = chain.length - 2; i >= 0; i--) { up.uniforms.t.value = chain[i + 1].texture; up.uniforms.px.value.set(0.5 / chain[i + 1].width, 0.5 / chain[i + 1].height); up.uniforms.k.value = 1; blit(up, chain[i]); }
    comp.uniforms.tS.value = main.texture; comp.uniforms.tB.value = chain[0].texture; comp.uniforms.exposure.value = exposure * renderer.toneMappingExposure;
    blit(comp, null);
  }
  // draw(): clears and draws the world (index.html's renderGlobeAndCity), here into the HDR picture
  function frame(dist, draw) {
    if (!on) { draw(dist); return; }
    size();
    renderer.setRenderTarget(main);
    draw(dist);
    finish();
  }
  function shot(cam) { // a still of the city from another camera, finished the same way (property photos)
    size();
    renderer.setRenderTarget(main); renderer.clear(); renderer.render(scene, cam);
    finish();
  }
  // tone mapping moves into the finish above: the scene itself is drawn in plain linear light
  renderer.toneMapping = THREE.NoToneMapping;

  // ---------- slow devices: say so once ----------
  function slowDevice() {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info'), gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency;
    const weakGpu = /SwiftShader|llvmpipe|Software|Mali-4|Mali-T|Mali-G(31|51|52|57|68|71|72)\b|Adreno \(TM\) ([1-5]\d\d|6[0-2]\d)\b|PowerVR|Intel\(R\) (HD|UHD) Graphics( [2-6]\d\d)?\b|GMA/i.test(gpu);
    return { slow: !caps.isWebGL2 || weakGpu || (mem && mem <= 3) || (cores && cores <= 2), gpu };
  }
  function warn(why) {
    try { if (localStorage.getItem('cs-slow-ok')) return; } catch (e) { /* storage blocked: ask every visit */ }
    const el = document.createElement('div');
    el.id = 'slowDev';
    el.innerHTML = `<div class="sdbox"><div class="sdic">⚡</div><b>This device may be too slow</b>
      <p>Capital Street is made for recent phones, tablets and computers, like an iPhone 15 or newer, a recent iPad, a Mac or a gaming laptop. ${why} It will probably lag here.</p>
      <div class="sdrow"><button class="btn pri" id="sdOk">Play anyway</button><button class="btn" id="sdNo">Don't show again</button></div></div>`;
    document.body.appendChild(el);
    $('sdOk').onclick = () => el.remove();
    $('sdNo').onclick = () => { try { localStorage.setItem('cs-slow-ok', '1'); } catch (e) { /* fine */ } el.remove(); };
  }
  const ready = setInterval(() => {
    if (!window.CS || !$('load').hidden) return;
    clearInterval(ready);
    const d = slowDevice();
    if (d.slow) warn(d.gpu ? `Its graphics chip (${d.gpu.replace(/[<>&]/g, '')}) isn't one of them.` : '');
    // or it turns out slow: under 24 frames a second for 20 seconds of play
    let low = 0, frames = 0, t0 = performance.now(), told = false;
    frameHooks.push(() => {
      if (told || document.hidden || !$('title').hidden) return;
      frames++;
      const now = performance.now();
      if (now - t0 < 1000) return;
      low = frames * 1000 / (now - t0) < 24 ? low + 1 : 0; frames = 0; t0 = now;
      if (low >= 20) { told = true; warn('It has been running below 24 frames a second.'); }
    });
  }, 300);

  return { frame, shot, U, set hour(h) { force = h; }, get hour() { return force; }, get on() { return on; }, hdr, light, bakeEnv };
})();
