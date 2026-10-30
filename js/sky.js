// Capital Street skies (Goal 23): airliners cross the city with blinking lights, and the rare plane crash in the news
// (js/market.js, "PLANE CRASHES INTO A MIDTOWN TOWER") is shown: an airliner with a failed engine comes down into a
// tower, with a fireball, a flash and the smoke that follows. Very rarely it is one of your buildings: insurance covers
// most of it, the repairs don't come free, and the whole market takes another fall.
'use strict';
window.Sky = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = v => '$' + Math.round(v).toLocaleString('en-US');

  // ---------- a small airliner, about 40 m long, built once and copied ----------
  function airliner() {
    const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: lin(0xf2f4f7), roughness: 0.35, metalness: 0.3 });
    const blue = new THREE.MeshStandardMaterial({ color: lin(0x1d4ed8), roughness: 0.4, metalness: 0.3 }), grey = new THREE.MeshStandardMaterial({ color: lin(0x9aa3ad), roughness: 0.4, metalness: 0.6 });
    const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(new THREE.CylinderGeometry(2, 2, 30, 14).rotateX(Math.PI / 2), white);
    add(new THREE.SphereGeometry(2, 14, 10).scale(1, 1, 2.2), white, 0, 0, 15);
    add(new THREE.ConeGeometry(2, 9, 14).rotateX(-Math.PI / 2), white, 0, 0.4, -19.5);
    add(new THREE.BoxGeometry(36, 0.5, 5).translate(0, -0.8, 0), white).rotation.y = 0;
    add(new THREE.BoxGeometry(13, 0.4, 3), white, 0, 0.6, -20);
    add(new THREE.BoxGeometry(0.5, 7, 4.5), blue, 0, 4, -20);
    add(new THREE.CylinderGeometry(1.1, 1.1, 4.5, 10).rotateX(Math.PI / 2), grey, -7, -2, 1.5);
    add(new THREE.CylinderGeometry(1.1, 1.1, 4.5, 10).rotateX(Math.PI / 2), grey, 7, -2, 1.5);
    add(new THREE.BoxGeometry(4.1, 0.6, 26).translate(0, -1.3, 0), blue); // the belly stripe
    const lamp = (c, x, y, z) => { const m = add(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: c }), x, y, z); return m; };
    g.userData.red = lamp(new THREE.Color(14, 0.4, 0.3), -18, -0.8, 0);
    g.userData.green = lamp(new THREE.Color(0.3, 12, 1), 18, -0.8, 0);
    g.userData.strobe = lamp(new THREE.Color(20, 20, 20), 0, 6.5, -22);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  const proto = airliner();
  const flights = [];
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

  // ---------- everyday traffic: one every minute or so, passing near where you're looking ----------
  let next = 8;
  function spawn() {
    const t = controls.target, head = Math.random() * Math.PI * 2, off = (Math.random() - 0.5) * 2600;
    const dir = new THREE.Vector3(Math.cos(head), 0, Math.sin(head)), side = new THREE.Vector3(-dir.z, 0, dir.x);
    const alt = 450 + Math.random() * 800, len = 9000;
    const from = new THREE.Vector3(t.x, alt, t.z).addScaledVector(side, off).addScaledVector(dir, -len / 2);
    const to = from.clone().addScaledVector(dir, len);
    to.y += (Math.random() - 0.5) * 300; // climbing out or coming in
    fly({ from, to, speed: 115 + Math.random() * 45 });
  }
  function fly(f) {
    f.mesh = proto.clone(); f.t = 0; f.len = f.from.distanceTo(f.to);
    f.mesh.position.copy(f.from); f.mesh.lookAt(f.to);
    scene.add(f.mesh); flights.push(f);
    return f;
  }
  frameHooks.push((dt, dist) => {
    if (!window.CS) return;
    if ((next -= dt) <= 0) { next = 35 + Math.random() * 55; if (dist < 25000 && $('title').hidden && flights.length < 3) spawn(); }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t += dt * f.speed / f.len;
      const k = f.crash ? f.t * f.t : f.t; // a falling plane speeds up
      f.mesh.position.lerpVectors(f.from, f.to, Math.min(1, k));
      if (f.crash) f.mesh.rotation.z += dt * 0.35; // rolling over on the way down
      const u = f.mesh.userData, blink = (performance.now() / 1000) % 1.2;
      u.strobe.visible = blink < 0.08; u.red.visible = u.green.visible = true;
      if (f.t >= 1) { scene.remove(f.mesh); flights.splice(i, 1); if (f.done) f.done(); }
    }
    for (let i = booms.length - 1; i >= 0; i--) if (booms[i](dt)) booms.splice(i, 1);
  });

  // ---------- the crash ----------
  const booms = [];
  function fireball(at, size) {
    const mats = [], g = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 3.2, 0.6), transparent: true, depthWrite: false });
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), m);
      s.position.set((Math.random() - 0.5) * size, (Math.random() - 0.3) * size * 0.6, (Math.random() - 0.5) * size);
      s.userData.v = s.position.clone().normalize().multiplyScalar(6 + Math.random() * 10);
      g.add(s); mats.push(m);
    }
    g.position.copy(at); scene.add(g);
    const light = new THREE.PointLight(0xffa040, 60, size * 14, 2); light.position.copy(at); scene.add(light);
    let age = 0;
    booms.push(dt => {
      age += dt;
      const k = Math.min(1, age / 3.2);
      g.children.forEach(s => { s.position.addScaledVector(s.userData.v, dt); s.scale.setScalar(size * (0.25 + 0.9 * Math.sqrt(k))); });
      for (const m of mats) { m.opacity = 1 - k; m.color.setRGB(9 * (1 - k) + 0.3, 3.2 * (1 - k) * (1 - k) + 0.1, 0.6 * (1 - k)); }
      light.intensity = 60 * (1 - k) * (1 - k);
      if (k >= 1) { scene.remove(g, light); g.children.forEach(s => s.geometry.dispose()); mats.forEach(m => m.dispose()); return true; }
      return false;
    });
  }
  function yourBuildings() {
    if (!window.Property) return [];
    return Object.keys(M.state.props).filter(k => CITY.id === 'nyc' ? !k.includes(':') : k.startsWith(CITY.id + ':'))
      .map(k => Property.info(Number(k.includes(':') ? k.split(':')[1] : k))).filter(it => it && it.maxH > 25);
  }
  // picks the tower (sometimes yours), starts the plane, and returns where it will hit, for the news' "Look" button
  function crash() {
    const mine = yourBuildings();
    let target, yours = null;
    if (mine.length && Math.random() < 0.12) { yours = mine[Math.floor(Math.random() * mine.length)]; target = { x: yours.x, z: yours.z, h: yours.maxH }; }
    else {
      const mid = towers.filter(t => Math.hypot(t[0], t[1]) < 2500), list = mid.length ? mid : towers;
      const t = list[Math.floor(Math.random() * list.length)];
      target = { x: t[0], z: t[1], h: t[2] };
    }
    const hit = new THREE.Vector3(target.x, target.h * 0.72, target.z), head = Math.random() * Math.PI * 2;
    const from = hit.clone().add(v1.set(Math.cos(head) * 1500, 300, Math.sin(head) * 1500));
    const f = fly({ from, to: hit, speed: 120, crash: true });
    f.mesh.rotation.z = 0.3;
    f.done = () => {
      fireball(hit, Math.max(18, target.h * 0.12));
      if (typeof smokeAt === 'function') smokeAt(target.x, target.z, target.h);
      if (yours) hitYours(yours);
    };
    return [target.x, target.z];
  }
  function hitYours(it) {
    const value = Property.wholePrice(it), repair = Math.round(value * 0.25);
    M.state.cash -= repair; M.save();
    if (window.CSUI) setTimeout(() => CSUI.story(`<small>BREAKING NEWS</small><b>The plane hit your building.</b><p>${it.name} is badly damaged. Insurance pays for most of the repairs, but you have to cover ${usd(repair)}. Investors panic: the whole market is falling.</p>`, [['Oh no', () => {}]]), 2500);
    M.triggerEvent('crash');
  }
  const ready = setInterval(() => { if (window.CS) { clearInterval(ready); CS.smoke = crash; } }, 200);

  return { crash, spawn, flights };
})();
