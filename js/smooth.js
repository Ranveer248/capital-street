// Capital Street, Goal 12: smoother and brighter.
// The mouse wheel eases the camera to the new height instead of jumping a step per click, the camera glides a little
// longer after a drag, the daylight is brighter and more saturated, and the money pills bump when cash changes.
'use strict';
(function () {
  const $ = id => document.getElementById(id), canvas = $('c');

  // ---------- brighter daylight: a bluer sky, more fill light, a touch more exposure ----------
  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
  renderer.toneMappingExposure = 1.0;
  skyMat.uniforms.top.value = lin(0x3f8fe8); skyMat.uniforms.bottom.value = lin(0xcde6fb);
  scene.fog.color = lin(0xcde6fb);
  scene.traverse(o => { if (o.isHemisphereLight) o.intensity = 0.5; });
  sunLight.intensity = 3.2;

  // ---------- smooth zoom ----------
  controls.dampingFactor = 0.08;
  let zoomTo = 0;
  canvas.addEventListener('wheel', e => {
    if (fly || !controls.enabled || !controls.enableZoom) return;
    e.preventDefault(); e.stopImmediatePropagation(); // ours instead of MapControls' step zoom
    const dy = Math.max(-300, Math.min(300, e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1)));
    const from = zoomTo || camera.position.distanceTo(controls.target);
    zoomTo = Math.min(controls.maxDistance, Math.max(controls.minDistance, from * Math.exp(dy * 0.0013)));
  }, { capture: true, passive: false });
  const off = new THREE.Vector3();
  frameHooks.push(dt => {
    if (!zoomTo) return;
    if (fly || !controls.enabled) { zoomTo = 0; return; }
    off.copy(camera.position).sub(controls.target);
    const d = off.length(), k = 1 - Math.exp(-dt * 11);
    const nd = Math.exp(Math.log(d) + (Math.log(zoomTo) - Math.log(d)) * k); // ease in log space: as smooth high up as down low
    off.setLength(nd); camera.position.copy(controls.target).add(off);
    if (Math.abs(nd - zoomTo) / zoomTo < 0.003) zoomTo = 0;
  });

  // ---------- money pills bump when cash changes ----------
  const num = el => +String(el.textContent).replace(/[^0-9.-]/g, '') || 0;
  function watch(id, min) {
    const el = $(id); if (!el) return;
    let last = num(el), t = 0;
    new MutationObserver(() => {
      const v = num(el), d = v - last; last = v;
      if (Math.abs(d) < Math.max(1, Math.abs(v) * min)) return;
      const box = el.parentElement;
      box.classList.remove('bump', 'gain', 'loss'); void box.offsetWidth;
      box.classList.add('bump', d > 0 ? 'gain' : 'loss');
      clearTimeout(t); t = setTimeout(() => box.classList.remove('gain', 'loss'), 700);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  watch('cashV', 0); watch('worthV', 0.01);
})();
