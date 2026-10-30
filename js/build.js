// Capital Street building (Goal 25): knock down a building you own and put up a new one in the style you pick.
// The real city stays as it is: no new land, only what stands on it changes. A new building goes up over a few game
// hours as a construction site with a crane, then it's yours to rent out or to sell to other players at auction.
// You pay for what the new building adds (plus 5% to knock the old one down), so it pays when you put something bigger
// and better on a good spot: a little on the price, and more in rent. The build time keeps it level with the other jobs.
// Builds are kept in the save (state.builds by property key) and on the server (cs_buildings.design, server/schema.sql),
// so every player sees what you built, and the design stays with the building when you sell it to another player.
'use strict';
window.Build = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const B = () => { if (!M.state.builds) M.state.builds = {}; return M.state.builds; };

  // ---------- the designs: our own toy-like buildings, drawn by the same facade shader as the city ----------
  // typ / mat: see the list above buildingMat in index.html. tiers: [top as a share of the height, width]
  const DESIGNS = [
    { id: 'cottage', name: 'Cottage', icon: 'house', typ: 0, mat: 10, floors: 2, minA: 40, mult: 1.15, time: 90, tiers: [[1, 1]], pitched: true, cols: ['#f6d77a', '#a8dcef', '#f7b0a8', '#c4e8a8'] },
    { id: 'shop', name: 'Corner shop', icon: 'shop', typ: 3, mat: 5, floors: 2, minA: 60, mult: 1.3, time: 120, tiers: [[1, 1]], flags: 8 + 16 * 2, cols: ['#ffffff', '#ffe3a8', '#ffd0d8', '#d7f0ff'] },
    { id: 'townhouse', name: 'Townhouses', icon: 'townhouse', typ: 1, mat: 0, floors: 4, minA: 80, mult: 1.15, time: 180, tiers: [[1, 1]], cols: ['#c8674e', '#e3b072', '#9c6650', '#d98e72'] },
    { id: 'apartments', name: 'Apartments', icon: 'apartments', typ: 2, mat: 6, floors: 9, minA: 250, mult: 1.2, time: 300, tiers: [[1, 1]], flags: 8 + 16 * 3, cols: ['#f3c98b', '#bfe0f2', '#f2b8c6', '#cfe7b4'] },
    { id: 'offices', name: 'Offices', icon: 'offices', typ: 4, mat: 4, floors: 14, minA: 400, mult: 1.25, time: 420, tiers: [[0.8, 1], [1, 0.8]], cols: ['#efe3c4', '#d8e6ef', '#e9d2b6', '#e3e3e3'] },
    { id: 'tower', name: 'Glass tower', icon: 'tower', typ: 5, mat: 9, floors: 32, minA: 600, mult: 1.35, time: 720, tiers: [[0.7, 1], [0.92, 0.82], [1, 0.6]], cols: ['#5aa9e6', '#5fc7c0', '#7b8ff0', '#62b38c'] },
    { id: 'sky', name: 'Skyscraper', icon: 'skyscraper', typ: 5, mat: 9, floors: 60, minA: 1100, mult: 1.45, time: 1200, tiers: [[0.55, 1], [0.8, 0.8], [0.95, 0.6], [1, 0.4]], spire: true, cols: ['#4c8dff', '#38c6d9', '#9a7bff', '#4cc38a'] },
    { id: 'factory', name: 'Factory', icon: 'factory', typ: 6, mat: 11, floors: 2, minA: 300, mult: 1.1, time: 180, tiers: [[1, 1]], cols: ['#c9cdd3', '#e0b36a', '#9fc0d8', '#d98068'] }
  ];
  const D = id => DESIGNS.find(d => d.id === id);
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

  // ---------- a building's ground outline and where it sits ----------
  function outline(g) {
    const list = (groups.get(g) || []).map(i => pieces[i]), XY = Property.data()['b.xy'];
    if (!list.length) return null;
    const ground = list.filter(p => p.mh < 1), big = (ground.length ? ground : list).reduce((a, b) => b.area > a.area ? b : a);
    const pts = [];
    for (let j = 0; j < big.k; j++) pts.push(new THREE.Vector2(XY[big.off + 2 * j] / 2, XY[big.off + 2 * j + 1] / 2));
    return { pts, x: big.x, z: big.z, area: big.area, list };
  }
  const inPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > z) !== (b.y > z) && x < (b.x - a.x) * (z - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };

  // ---------- knocking the old building down (only on screen: the map data never changes) ----------
  const cleared = new Map(); // g -> { polys: outlines of all its pieces, undo: what was moved, to put it back }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), mtx = new THREE.Matrix4(), pos = new THREE.Vector3();
  function clear(g) {
    if (cleared.has(g)) return;
    const ids = new Set(groups.get(g) || []), XY = Property.data()['b.xy'], polys = [];
    for (const i of ids) { const p = pieces[i], pts = []; for (let j = 0; j < p.k; j++) pts.push(new THREE.Vector2(XY[p.off + 2 * j] / 2, XY[p.off + 2 * j + 1] / 2)); polys.push(pts); }
    const undo = [];
    cleared.set(g, { polys, undo });
    for (const t of tiles) { // sink the walls and roofs below the street
      const P = t.mesh.geometry.attributes.position; let hit = false;
      for (let v = 0; v < t.pid.length; v++) if (ids.has(t.pid[v])) { undo.push({ P, v, y: P.getY(v) }); P.setY(v, -3); hit = true; }
      if (hit) P.needsUpdate = true;
    }
    const inside = (x, z) => polys.some(pts => inPoly(x, z, pts));
    for (const m of roofThings.concat(cityTiles.filter(t => t.kind === 'crown' || t.kind === 'detail').map(t => t.mesh))) { // water towers, plant rooms, domes, spires
      if (!m.isInstancedMesh) continue;
      let hit = false;
      for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, mtx); pos.setFromMatrixPosition(mtx); if (inside(pos.x, pos.z)) { undo.push({ m, i, mtx: mtx.clone() }); m.setMatrixAt(i, zero); hit = true; } }
      if (hit) m.instanceMatrix.needsUpdate = true;
    }
    const o = outline(g); if (o) refreshPitched(o.x, o.z);
  }
  const inCleared = (x, z) => { for (const c of cleared.values()) if (c.polys.some(pts => inPoly(x, z, pts))) return true; return false; };
  function restore(g) { // the old building comes back (a design was taken off the server)
    const c = cleared.get(g); if (!c) return;
    for (const u of c.undo) if (u.P) { u.P.setY(u.v, u.y); u.P.needsUpdate = true; } else { u.m.setMatrixAt(u.i, u.mtx); u.m.instanceMatrix.needsUpdate = true; }
    cleared.delete(g);
    const o = outline(g); if (o) refreshPitched(o.x, o.z);
  }
  // what stands on a building: your own build from the save, or what its owner built, from the server
  function rec(k) {
    const net = window.Net && Net.designOf ? Net.designOf(k) : null, theirs = window.Net && Net.ownerOf ? Net.ownerOf(k) : null, mine = B()[k];
    if (mine && !theirs) return mine;
    if (!net || !D(net.d) || !(net.f > 0)) return null;
    return { d: net.d, c: net.c | 0, floors: net.f, fp: net.fp, start: 0, end: net.done || !theirs ? -Infinity : Infinity, remote: true };
  }
  const share = (k, r, done) => window.Net && Net.setDesign ? Net.setDesign(k, { d: r.d, c: r.c, f: r.floors, fp: r.fp, done }) : null;

  // ---------- the new building's shape ----------
  function geometry(o, d, col, floors) {
    const b = { pos: [], nor: [], col: [], fac: [], idx: [] }, rgb = hex(col), H = floors * (d.typ <= 1 ? 3.1 : 3.6) + (d.typ === 6 ? 4 : 0);
    const code = d.typ * 16 + d.mat + 256 * (d.flags || 0);
    const shrink = (s, inset) => o.pts.map(p => { const dx = p.x - o.x, dz = p.y - o.z, l = Math.hypot(dx, dz) || 1, k = Math.max(0.2, s - inset / l); return new THREE.Vector2(o.x + dx * k, o.z + dz * k); });
    let y0 = 0;
    for (const [top, w] of d.tiers) {
      const pts = shrink(w, 0.6), y1 = H * top, first = b.pos.length / 3, m = pts.length;
      let u = 0;
      for (let j = 0; j <= m; j++) {
        const a = pts[j % m], n = pts[(j + 1) % m], L = a.distanceTo(n) || 1, nX = Math.round((n.y - a.y) / L * 127), nZ = Math.round(-(n.x - a.x) / L * 127);
        b.pos.push(a.x, y0, a.y, a.x, y1, a.y); b.nor.push(nX, 0, nZ, nX, 0, nZ); b.col.push(...rgb, ...rgb); b.fac.push(u, y1 + 2, code, u, y1 + 2, code);
        u += L;
      }
      for (let j = 0; j < m; j++) { const a0 = first + 2 * j, a1 = a0 + 2; b.idx.push(a0, a1 + 1, a1, a0, a0 + 1, a1 + 1); }
      for (const t of THREE.ShapeUtils.triangulateShape(pts, [])) {
        const p0 = pts[t[0]], p1 = pts[t[1]], p2 = pts[t[2]], ok = (p1.y - p0.y) * (p2.x - p0.x) - (p1.x - p0.x) * (p2.y - p0.y) > 0;
        b.idx.push(first + 2 * t[0] + 1, first + 2 * t[ok ? 1 : 2] + 1, first + 2 * t[ok ? 2 : 1] + 1);
      }
      y0 = y1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(b.nor), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(b.col), 3, true));
    g.setAttribute('fac', new THREE.Float32BufferAttribute(b.fac, 3));
    g.setIndex(b.idx); g.computeBoundingSphere();
    return { g, H };
  }
  const roofM = new THREE.MeshStandardMaterial({ color: lin(0xd8644a), roughness: 0.8, flatShading: true });
  const steel = new THREE.MeshStandardMaterial({ color: lin(0x9aa3ad), roughness: 0.4, metalness: 0.6 });
  function pitchedRoof(o, H, col) { // a simple gable over the outline's long side
    let L = 0, ang = 0;
    for (let j = 0; j < o.pts.length; j++) { const a = o.pts[j], c = o.pts[(j + 1) % o.pts.length], l = a.distanceTo(c); if (l > L) { L = l; ang = Math.atan2(c.y - a.y, c.x - a.x); } }
    const W = Math.max(4, Math.min(L, Math.sqrt(o.area) * 0.9)), len = Math.max(4, o.area / W * 0.92);
    const shape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, W * 0.42)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2).rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geo, roofM.clone()); m.material.color.set(lin(col));
    m.position.set(o.x, H, o.z); m.rotation.y = -ang; m.castShadow = true;
    return m;
  }

  // ---------- what stands on each rebuilt spot: a construction site, then the new building ----------
  const built = new Map(); // g -> THREE.Group
  const site = { scaff: new THREE.MeshStandardMaterial({ color: lin(0xe0a83a), roughness: 0.7, transparent: true, opacity: 0.55 }), crane: new THREE.MeshStandardMaterial({ color: lin(0xffc21f), roughness: 0.5 }), fence: new THREE.MeshStandardMaterial({ color: lin(0x2c4a7a), roughness: 0.8 }) };
  function draw(g) {
    const k = keyOf(g), r = rec(k), o = outline(g);
    if (built.has(g)) { const old = built.get(g); scene.remove(old); old.traverse(x => { if (x.geometry) x.geometry.dispose(); }); built.delete(g); }
    if (!r || !o) { restore(g); return; }
    clear(g);
    const d = D(r.d), grp = new THREE.Group(), now = M.state.time, done = now >= r.end;
    const { g: geo, H } = geometry(o, d, d.cols[r.c] || d.cols[0], r.floors);
    if (done) {
      const m = new THREE.Mesh(geo, buildingMat); m.castShadow = m.receiveShadow = true; m.renderOrder = 10; grp.add(m);
      if (d.pitched) grp.add(pitchedRoof(o, H, ['#d8644a', '#4a7fc0', '#5c9e5a', '#8a5a44'][r.c] || '#d8644a'));
      if (d.spire) { const s = new THREE.Mesh(new THREE.ConeGeometry(1.2, H * 0.18, 8).translate(0, H * 0.09, 0), steel); s.position.set(o.x, H, o.z); grp.add(s); }
    } else { // the site: a fence, the frame going up as the work goes on, and a crane
      const f = Math.max(0.06, Math.min(1, (now - r.start) / (r.end - r.start)));
      const frame = new THREE.Mesh(geo, site.scaff); frame.scale.y = f; grp.add(frame);
      const R = Math.sqrt(o.area) / 2 + 3, mast = H * Math.max(f, 0.3) + 18;
      const box = (w, h, dd, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), mat); m.position.set(x, y, z); m.castShadow = true; grp.add(m); return m; };
      box(1.6, mast, 1.6, o.x + R * 0.6, mast / 2, o.z + R * 0.6, site.crane);
      const jib = box(R * 2.4, 1.1, 1.1, o.x + R * 0.6, mast, o.z + R * 0.6, site.crane); jib.position.x -= R * 0.6; grp.userData.jib = jib;
      box(3.2, 2.4, 3.2, o.x + R * 0.6 + R * 0.5, mast - 1.6, o.z + R * 0.6, site.fence);
      grp.userData.site = true;
    }
    grp.userData.g = g;
    scene.add(grp); built.set(g, grp);
  }
  const keyOf = g => Property.key(g);

  // ---------- costs ----------
  function quote(g, d) {
    const it = Property.info(g), p = M.state.props[keyOf(g)];
    const fp = Math.round(it.floorPrice * d.mult / 10) * 10, floors = d.floors;
    const value = floors * fp * M.state.reIndex, now = p ? p.floors * M.floorValue(p) : 0;
    const knock = Math.round(now * 0.05), cost = Math.round(Math.max(0.25 * value, 0.95 * (value - now))) + knock; // you pay for what the new building adds
    const mins = Math.round(d.time * 4 * (1 + floors / 40));
    return { fp, floors, value, cost, knock, mins, gain: value - now - cost, rent: floors * fp * M.state.reIndex * M.PROP_YIELD * 7, ok: it.footprint >= d.minA };
  }
  const hm = m => m >= 1440 ? `${Math.round(m / 144) / 10} days` : m >= 60 ? `${Math.round(m / 6) / 10} h` : `${m} min`;

  // ---------- the builder: pick a design and a colour ----------
  const el = document.createElement('div');
  el.id = 'builder'; el.className = 'ov2'; el.hidden = true;
  document.body.appendChild(el);
  let pick = 'apartments', colour = 0, at = null;
  function art(d, c) { // a small isometric picture of the design
    const col = d.cols[c] || d.cols[0], f = Math.min(1, d.floors / 60), hgt = 18 + 62 * Math.sqrt(f), base = 92;
    const shade = (h, k) => { const [r, g, b] = hex(h); return `rgb(${r * k | 0},${g * k | 0},${b * k | 0})`; };
    let s = `<svg viewBox="0 0 120 110" aria-hidden="true"><ellipse cx="60" cy="${base + 4}" rx="48" ry="12" fill="#7fc65a"/>`;
    let w = 30, y = base;
    d.tiers.forEach(([top], i) => {
      const prev = i ? d.tiers[i - 1][0] : 0, th = hgt * (top - prev), ww = w * d.tiers[i][1];
      s += `<polygon points="${60 - ww},${y - ww * 0.5} 60,${y} 60,${y - th} ${60 - ww},${y - ww * 0.5 - th}" fill="${col}" stroke="#0a0f2e" stroke-width="2" stroke-linejoin="round"/>`;
      s += `<polygon points="60,${y} ${60 + ww},${y - ww * 0.5} ${60 + ww},${y - ww * 0.5 - th} 60,${y - th}" fill="${shade(col, 0.78)}" stroke="#0a0f2e" stroke-width="2" stroke-linejoin="round"/>`;
      for (let fy = y - 7; fy > y - th + 3; fy -= 8) s += `<line x1="${60 - ww + 4}" y1="${fy - ww * 0.5 + 2}" x2="56" y2="${fy - 2}" stroke="#2a4f8a" stroke-width="2.4" stroke-dasharray="3 3"/><line x1="64" y1="${fy - 2}" x2="${60 + ww - 4}" y2="${fy - ww * 0.5 + 2}" stroke="#244273" stroke-width="2.4" stroke-dasharray="3 3"/>`;
      y -= th;
      if (i === d.tiers.length - 1) s += d.pitched ? `<polygon points="${60 - ww},${y - ww * 0.5} 60,${y - ww - 14} ${60 + ww},${y - ww * 0.5} 60,${y}" fill="#d8644a" stroke="#0a0f2e" stroke-width="2" stroke-linejoin="round"/>`
        : `<polygon points="${60 - ww},${y - ww * 0.5} 60,${y - ww} ${60 + ww},${y - ww * 0.5} 60,${y}" fill="${shade(col, 1.08)}" stroke="#0a0f2e" stroke-width="2" stroke-linejoin="round"/>`;
      if (d.spire && i === d.tiers.length - 1) s += `<line x1="60" y1="${y - ww * 0.5}" x2="60" y2="${y - ww * 0.5 - 16}" stroke="#0a0f2e" stroke-width="3"/>`;
      w = ww;
    });
    return s + '</svg>';
  }
  function open(g) {
    at = g; el.hidden = false;
    const it = Property.info(g); if (!quote(g, D(pick)).ok) pick = DESIGNS.filter(d => quote(g, d).ok).pop().id;
    drawBuilder(it);
  }
  function drawBuilder(it) {
    const d = D(pick), q = quote(at, d), cash = M.state.cash;
    el.innerHTML = `<div class="ebox bld"><button class="ex" id="bdX" aria-label="Close">${IC('close')}</button>
      <b>Rebuild ${esc(it.name)}</b><p>Knock down the ${esc(it.type.toLowerCase())} and put up something new. Bigger designs need a bigger plot (${Math.round(it.footprint)} m² here).</p>
      <div class="bdgrid">${DESIGNS.map(x => { const qq = quote(at, x); return `<button data-d="${x.id}" class="${x.id === pick ? 'on' : ''}" ${qq.ok ? '' : 'disabled'}>${art(x, x.id === pick ? colour : 0)}<b>${x.name}</b><small>${qq.ok ? x.floors + ' floor' + (x.floors > 1 ? 's' : '') : 'Plot too small'}</small></button>`; }).join('')}</div>
      <div class="bdcols"><span>Colour</span>${d.cols.map((c, i) => `<button data-c="${i}" class="${i === colour ? 'on' : ''}" style="background:${c}" aria-label="Colour ${i + 1}"></button>`).join('')}</div>
      <div class="bdsum"><div>Cost<b>${usd(q.cost)}</b></div><div>Build time<b>${hm(q.mins)}</b></div><div>Worth when done<b class="up">${usd(q.value)}</b><small class="${q.gain >= 0 ? 'up' : 'dn'}">${q.gain >= 0 ? '+' : '-'}${usd(Math.abs(q.gain))} on what you pay</small></div><div>Rent<b class="up">${usd(q.rent)}/wk</b></div></div>
      ${q.knock ? `<p class="note">Includes ${usd(q.knock)} to knock down the old building. No rent comes in while it's being built.</p>` : ''}
      <button class="btn pri big" id="bdGo" ${q.cost > cash ? 'disabled' : ''}>${q.cost > cash ? `You need ${usd(q.cost)}` : 'Knock down and build'}</button></div>`;
    $('bdX').onclick = () => { el.hidden = true; };
    el.onclick = e => { if (e.target === el) el.hidden = true; };
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { pick = b.dataset.d; colour = Math.min(colour, D(pick).cols.length - 1); drawBuilder(it); });
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { colour = +b.dataset.c; drawBuilder(it); });
    $('bdGo').onclick = () => { const r = start(at, pick, colour); if (!r.ok) { toast('Can\'t build', r.why); return; } el.hidden = true; };
  }
  function start(g, id, c) {
    const k = keyOf(g), p = M.state.props[k], it = Property.info(g), d = D(id), q = quote(g, d);
    if (!p || p.floors < it.floors) return { ok: false, why: 'You need to own the whole building' };
    if (window.Office && Office.hq() === g) return { ok: false, why: 'This is your office. Move your office first' };
    if (!q.ok) return { ok: false, why: 'The plot is too small for that' };
    if (q.cost > M.state.cash) return { ok: false, why: `You need ${usd(q.cost)} in cash` };
    M.state.cash -= q.cost;
    p.paid += q.cost; p.uc = true; p.floors = q.floors; p.totalFloors = q.floors; p.floorPrice = q.fp; p.type = d.name;
    const r = B()[k] = { d: id, c, floors: q.floors, fp: q.fp, start: M.state.time, end: M.state.time + q.mins };
    M.save(); Property.forget(g); draw(g);
    if (window.Net) Net.claim(k, q.floors, it.name).then(() => share(k, r, false));
    if (window.Levels) Levels.give(Math.min(400, 20 + q.floors * 4), 'Building');
    toast('Building started', `${d.name} at ${it.name}: ready in ${hm(q.mins)}`);
    Property.redraw();
    return { ok: true };
  }

  // the listing card's part: a Rebuild button, or how far along the building is
  function section(g) {
    const k = keyOf(g), p = M.state.props[k], r = rec(k), it = Property.info(g);
    if (r && M.state.time < r.end && !r.remote) { const f = (M.state.time - r.start) / (r.end - r.start); return `<div class="bdprog"><span>${IC('crane')} ${esc(D(r.d).name)} going up</span><i><b style="width:${Math.round(f * 100)}%"></b></i><small>Ready in ${hm(Math.max(1, Math.round(r.end - M.state.time)))}</small></div>`; }
    if (!p || p.floors < it.floors) return '';
    return `<button class="buy" id="lsBuild">${IC('crane')} Rebuild</button>`;
  }
  function bind(root, g) { const b = root.querySelector('#lsBuild'); if (b) b.onclick = () => open(g); }

  // a rebuilt building reports its new size to the listing, the rent and the price
  function adjust(it) {
    const r = rec(keyOf(it.g)); if (!r) return it;
    const d = D(r.d);
    return Object.assign({}, it, { floors: r.floors, maxH: r.floors * 3.6, floorPrice: r.fp, type: d.name, kind: d.typ <= 2 ? 'homes' : d.typ === 3 ? 'shops' : d.typ === 6 ? 'factories' : r.floors > 12 ? 'towers' : 'offices', rebuilt: true });
  }

  // ---------- every frame: put up what's in the save, finish what's done, turn the cranes ----------
  let ready = false;
  frameHooks.push(dt => {
    if (!ready) { if (!window.Property || !Property.loaded()) return; ready = true; sync(); if (window.Net) Net.on(t => { if (t === 'owners') sync(); }); }
    for (const [g, grp] of built) {
      if (!grp.userData.site) continue;
      const k = keyOf(g), r = rec(k);
      if (grp.userData.jib) grp.userData.jib.rotation.y += dt * 0.15;
      if (!r || r.remote) continue;
      if (M.state.time >= r.end) { const p = M.state.props[k]; if (p) delete p.uc; M.save(); draw(g); share(k, r, true); Property.forget(g); toast('Building finished', `Your ${D(r.d).name.toLowerCase()} is ready. Tenants move in tonight.`); Property.redraw(); }
      else if ((grp.userData.t = (grp.userData.t || 0) + dt) > 3) { grp.userData.t = 0; draw(g); } // the frame grows
    }
  });
  const tapMeshes = () => [...built.values()];
  // draw every building with a design here (yours and other players'), and send yours to the server if it's missing
  const drawn = new Map(); // g -> what was drawn, to redraw only what changed
  function sync() {
    const keys = new Set(Object.keys(B()).filter(Property.isHere));
    if (window.Net) for (const [k, o] of Net.owners) if (o.design && Property.isHere(k)) keys.add(k);
    for (const g of drawn.keys()) keys.add(keyOf(g));
    for (const k of keys) {
      const g = Property.gOf(k), r = rec(k), sig = r ? JSON.stringify([r.d, r.c, r.floors, r.end === -Infinity || M.state.time >= r.end]) : '';
      if (drawn.get(g) !== sig) { drawn.set(g, sig); Property.forget(g); draw(g); }
      const mine = B()[k], net = window.Net && Net.designOf ? Net.designOf(k) : null, own = M.state.props[k] && window.Net && Net.owners.has(k) && !Net.ownerOf(k);
      if (mine && own && (!net || net.d !== mine.d || net.c !== mine.c || net.f !== mine.floors || !!net.done !== (M.state.time >= mine.end))) share(k, mine, M.state.time >= mine.end);
    }
    if (window.Property) Property.redraw();
  }

  return { DESIGNS, open, section, bind, adjust, inCleared, tapMeshes, quote, start };
})();
