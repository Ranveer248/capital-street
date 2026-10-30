// Capital Street city life (Goal 24): the things you'd see from a real skyscraper. Cars switch their headlights and red
// tail lights on after dark, ferries and boats cross the rivers and the bay on their real routes, and tour and news
// helicopters fly up the Hudson and circle over the city. Planes (js/sky.js) come more often too.
'use strict';
window.Life = (function () {
  const $ = id => document.getElementById(id);
  const night = () => window.Post ? Post.U.night.value : 0;
  const W = () => typeof walkers !== 'undefined' && walkers.meshes ? walkers : null; // js/city.js

  // ---------- car lights: white at the front, red at the back, on the same matrices as the cars ----------
  let carLights = null;
  function lights() {
    const cars = W() && W().meshes.cars;
    if (!cars) return null;
    const parts = [];
    for (const z of [-0.62, 0.62]) {
      parts.push([new THREE.BoxGeometry(0.12, 0.22, 0.34).translate(2.17, 0.82, z), [1, 0.92, 0.75]]);
      parts.push([new THREE.BoxGeometry(0.12, 0.2, 0.36).translate(-2.17, 0.9, z), [1, 0.04, 0.02]]);
    }
    const m = new THREE.InstancedMesh(mergeColoured(parts), new THREE.MeshBasicMaterial({ vertexColors: true }), cars.count);
    m.instanceMatrix = cars.instanceMatrix; // the cars' own matrices, so the lights move with them for free
    m.frustumCulled = false; m.renderOrder = 10;
    scene.add(m);
    return m;
  }

  // ---------- boats ----------
  const mat = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.55, metalness: 0.1 });
  const glow = c => new THREE.MeshBasicMaterial({ color: c });
  function boat(kind) {
    const g = new THREE.Group(), add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    if (kind === 'ferry') { // the big orange commuter ferry
      add(new THREE.BoxGeometry(92, 4, 20), mat(0xe8742a), 0, 1);
      add(new THREE.BoxGeometry(80, 4, 18), mat(0xf2efe8), 0, 5);
      add(new THREE.BoxGeometry(60, 3.4, 15), mat(0xe8742a), 0, 8.7);
      add(new THREE.BoxGeometry(14, 3, 8), mat(0xf2efe8), 0, 11.6);
      g.userData.light = add(new THREE.SphereGeometry(0.8, 8, 6), glow(new THREE.Color(10, 10, 9)), 0, 13.6);
    } else if (kind === 'ship') { // a container ship heading for the port
      add(new THREE.BoxGeometry(190, 9, 30), mat(0x24334a), 0, 2);
      add(new THREE.BoxGeometry(190, 1, 30.4), mat(0xa33a2e), 0, -2);
      const cols = [0xb5523b, 0x2f6fb0, 0xe8c25a, 0x3e8a5a, 0x9aa3ad, 0xd0d4da];
      for (let i = 0; i < 12; i++) add(new THREE.BoxGeometry(12, 5 + (i % 3) * 2.6, 26), mat(cols[(i * 5) % cols.length]), -70 + i * 13, 9 + (i % 3) * 1.3);
      add(new THREE.BoxGeometry(12, 20, 26), mat(0xf2efe8), 84, 16);
      g.userData.light = add(new THREE.SphereGeometry(1, 8, 6), glow(new THREE.Color(10, 10, 9)), 84, 27);
    } else { // a white tour boat
      add(new THREE.BoxGeometry(38, 3, 9), mat(0xf2f4f7), 0, 0.8);
      add(new THREE.BoxGeometry(28, 3, 8), mat(0x2c4a7a), -2, 3.6);
      add(new THREE.BoxGeometry(26, 0.5, 8.4), mat(0xf2f4f7), -2, 5.3);
      g.userData.light = add(new THREE.SphereGeometry(0.5, 8, 6), glow(new THREE.Color(10, 10, 9)), 8, 6.2);
    }
    const wake = add(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }), 0, 0.3);
    g.userData.wake = wake;
    g.traverse(o => { if (o.isMesh && o !== wake && o !== g.userData.light) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  // routes in latitude and longitude, along the middle of the water; boats go to the end and back
  const ROUTES = {
    nyc: [
      { kind: 'ferry', v: 8, pts: [[40.7006, -74.0128], [40.6900, -74.0260], [40.6440, -74.0715]] },
      { kind: 'ferry', v: 8, pts: [[40.6440, -74.0715], [40.6900, -74.0260], [40.7006, -74.0128]] },
      { kind: 'tour', v: 6, pts: [[40.7010, -74.0175], [40.6905, -74.0420], [40.6985, -74.0390]] },
      { kind: 'tour', v: 7, pts: [[40.7000, -74.0250], [40.7220, -74.0220], [40.7450, -74.0180], [40.7700, -74.0030], [40.7900, -73.9930], [40.8200, -73.9720], [40.8500, -73.9570]] },
      { kind: 'tour', v: 6, pts: [[40.7010, -74.0040], [40.7050, -73.9930], [40.7100, -73.9780], [40.7220, -73.9670], [40.7370, -73.9670], [40.7480, -73.9630], [40.7570, -73.9570]] },
      { kind: 'ship', v: 5, pts: [[40.6000, -74.0400], [40.6400, -74.0500], [40.6480, -74.0850]] }
    ]
  };
  const boats = [];
  function launch() {
    for (const r of ROUTES[CITY.id] || []) {
      const pts = r.pts.map(([a, b]) => { const [x, z] = ll(a, b); return new THREE.Vector2(x, z); });
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const mesh = boat(r.kind);
      scene.add(mesh);
      boats.push({ mesh, pts, cum, len: cum[cum.length - 1], s: Math.random() * cum[cum.length - 1], dir: 1, v: r.v });
    }
  }
  const p2 = new THREE.Vector2();
  function sail(b, dt) {
    b.s += b.v * b.dir * dt * 4; // a little faster than life, so you can see them move
    if (b.s > b.len || b.s < 0) { b.s = Math.min(b.len, Math.max(0, b.s)); b.dir = -b.dir; }
    let i = 0; while (i < b.cum.length - 2 && b.s > b.cum[i + 1]) i++;
    const a = b.pts[i], c = b.pts[i + 1], f = (b.s - b.cum[i]) / ((b.cum[i + 1] - b.cum[i]) || 1);
    p2.copy(a).lerp(c, f);
    const dx = (c.x - a.x) * b.dir, dz = (c.y - a.y) * b.dir;
    b.mesh.position.set(p2.x, 0.4 + Math.sin(performance.now() / 900 + b.len) * 0.25, p2.y);
    b.mesh.rotation.y = -Math.atan2(dz, dx);
    const w = b.mesh.userData.wake; w.scale.set(60, 1, 10); w.position.x = -60;
  }

  // ---------- helicopters ----------
  function heli(col) {
    const g = new THREE.Group(), add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    add(new THREE.SphereGeometry(1.6, 14, 10).scale(1.5, 1, 1), mat(col));
    add(new THREE.SphereGeometry(1.2, 12, 8).scale(1, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, metalness: 0.6 }), 1.3, 0.2);
    add(new THREE.CylinderGeometry(0.25, 0.4, 6, 8).rotateZ(Math.PI / 2), mat(col), -4.6, 0.4);
    add(new THREE.BoxGeometry(0.2, 1.8, 1), mat(col), -7.4, 1.1);
    add(new THREE.BoxGeometry(5, 0.15, 0.15), mat(0x2c2f36), 0, -1.8, 0.9); add(new THREE.BoxGeometry(5, 0.15, 0.15), mat(0x2c2f36), 0, -1.8, -0.9);
    const rotor = add(new THREE.BoxGeometry(11, 0.08, 0.5), mat(0x2c2f36), 0, 1.9);
    const rotor2 = add(new THREE.BoxGeometry(11, 0.08, 0.5), mat(0x2c2f36), 0, 1.9); rotor2.rotation.y = Math.PI / 2;
    const tail = add(new THREE.BoxGeometry(2.2, 0.06, 0.25), mat(0x2c2f36), -7.4, 1.2, 0.2); tail.rotation.x = Math.PI / 2;
    g.userData = { rotor, rotor2, tail, strobe: add(new THREE.SphereGeometry(0.3, 6, 4), glow(new THREE.Color(14, 0.4, 0.3)), 0, -1.6) };
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  const helis = [];
  function hover() {
    // a tour loop up the Hudson from the downtown heliport and back, and a news helicopter circling over the city
    if (CITY.id === 'nyc') {
      const [x0, z0] = ll(40.7013, -74.0105), [x1, z1] = ll(40.7700, -74.0060);
      helis.push({ mesh: heli(0xf2f4f7), t: 0, f: t => { const k = (1 - Math.cos(t * 0.05)) / 2, side = Math.sin(t * 0.05) * 260; return [x0 + (x1 - x0) * k + side, 180 + 60 * Math.sin(t * 0.1), z0 + (z1 - z0) * k]; } });
    }
    const cx = controls.target.x, cz = controls.target.z;
    helis.push({ mesh: heli(0x1d4ed8), t: 0, f: t => [cx + Math.cos(t * 0.06) * 700, 300, cz + Math.sin(t * 0.06) * 700] });
    for (const h of helis) scene.add(h.mesh);
  }
  const v3 = new THREE.Vector3();
  function fly(h, dt) {
    h.t += dt;
    const [x, y, z] = h.f(h.t), [x2, , z2] = h.f(h.t + 0.5);
    h.mesh.position.set(x, y, z);
    h.mesh.rotation.y = -Math.atan2(z2 - z, x2 - x);
    h.mesh.rotation.z = -0.12; // nose down, flying forward
    const u = h.mesh.userData;
    u.rotor.rotation.y += dt * 40; u.rotor2.rotation.y = u.rotor.rotation.y + Math.PI / 2; u.tail.rotation.z += dt * 60;
    u.strobe.visible = (performance.now() / 1000) % 1 < 0.1;
  }

  // ---------- every frame ----------
  let ready = false;
  frameHooks.push((dt, dist) => {
    if (!ready) {
      if (!window.CS || !$('load').hidden || !W()) return;
      ready = true; carLights = lights(); launch(); hover();
    }
    const n = night(), near = dist < 30000;
    if (carLights) {
      carLights.visible = W().meshes.cars.visible && n > 0.12;
      carLights.material.color.setScalar(1 + 7 * n);
    }
    for (const b of boats) { b.mesh.visible = near; if (near) sail(b, dt); b.mesh.userData.light.visible = n > 0.2; }
    for (const h of helis) { h.mesh.visible = dist < 15000; if (h.mesh.visible) fly(h, dt); }
  });

  return { boats, helis };
})();
