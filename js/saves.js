// Capital Street save status and backups (Goal 31). Shows whether your game is really saved, on this device and on your
// account, warns you as soon as saving fails (a full or blocked browser storage, no connection, another device), and
// lets you download your whole game as a backup file and load it again later or on another browser.
'use strict';
window.Saves = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ago = t => { if (!t) return 'not yet'; const s = Math.round((Date.now() - t) / 1000); return s < 10 ? 'just now' : s < 60 ? `${s} seconds ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleString(); };
  const KEEP = /^(cs-name|cs-tutorial-done|cs-city|cs-gfx|cs-gfx-picked)$/; // settings that go in a backup (never the sign-in)
  const WHY = { full: 'This browser\'s storage for the game is full.', blocked: 'This browser is blocking storage (private browsing or a privacy setting).' };

  // ---------- what's true right now ----------
  function cloud() { return window.Net && Net.cloud ? Net.cloud : { state: 'off' }; }
  function problem() {
    const l = M.saveStatus(), c = cloud();
    if (!l.ok && c.state !== 'ok') return `Your progress isn't being saved. ${WHY[l.why] || ''}`;
    if (!l.ok) return `Can't save on this device. ${WHY[l.why] || ''} Your account still has your game.`;
    if (c.state === 'conflict') return 'Your game was saved from another device or tab. This one stopped saving to your account so it can\'t overwrite that.';
    if (c.state === 'error' && c.fails >= 2) return `Can't reach your account to save (${c.why}). Saved on this device; it uploads when the connection is back.`;
    return '';
  }

  // ---------- a chip in the top bar, and a warning that stays until it's fixed ----------
  const chip = document.createElement('button');
  chip.id = 'saveSt'; chip.setAttribute('aria-label', 'Save status');
  const bar = $('bar'); if (bar) bar.insertBefore(chip, $('speed'));
  const warn = document.createElement('div');
  warn.id = 'saveWarn'; warn.hidden = true; warn.setAttribute('role', 'alert');
  document.body.appendChild(warn);
  let shut = '';
  function draw() {
    const l = M.saveStatus(), c = cloud(), p = problem();
    chip.className = p ? 'bad' : c.state === 'saving' ? 'busy' : '';
    chip.textContent = p ? '⚠ Not saved' : c.state === 'saving' ? '☁ Saving…' : c.state === 'ok' ? '☁ Saved' : l.at ? '✓ Saved' : '';
    chip.title = p || (c.state === 'ok' ? `Saved to your account ${ago(c.at)}` : `Saved on this device ${ago(l.at)}`);
    warn.hidden = !p || p === shut;
    if (!warn.hidden) {
      const fix = cloud().state === 'conflict';
      warn.innerHTML = `<b>⚠</b><span>${esc(p)}</span><button class="btn" id="swExp">${fix ? 'SORT IT OUT' : 'DOWNLOAD A BACKUP'}</button><button class="lnk" id="swX" aria-label="Hide">✕</button>`;
      $('swExp').onclick = fix ? () => window.PC && PC.openSettings('save') : exportSave; $('swX').onclick = () => { shut = p; draw(); };
    }
  }
  chip.onclick = () => window.PC && PC.openSettings('save');
  M.on(t => { if (t === 'save') draw(); });
  if (window.Net) Net.on(t => { if (t === 'cloud' || t === 'me') draw(); });
  setInterval(draw, 5000);
  addEventListener('keydown', e => { if (e.key === 'F9' && window.PC) { e.preventDefault(); PC.openSettings('save'); } });

  // ---------- a backup file ----------
  function pack() {
    const extra = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (KEEP.test(k)) extra[k] = localStorage.getItem(k); } } catch (e) { /* storage blocked */ }
    return { game: 'capital-street', v: 1, exported: new Date().toISOString(), player: window.Net && Net.me ? Net.me.name : null, market: M.state, extra };
  }
  function exportSave() {
    M.save();
    const blob = new Blob([JSON.stringify(pack())], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `capital-street-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    try { localStorage.setItem('cs-last-export', String(Date.now())); } catch (e) { /* fine */ }
    toast('Backup downloaded', 'Keep the file somewhere safe. Load it from Settings → Your save.');
  }
  function check(d) {
    if (!d || d.game !== 'capital-street' || !d.market || typeof d.market.cash !== 'number' || !d.market.stocks) return 'That isn\'t a Capital Street save file.';
    return '';
  }
  let pending = null;
  async function importFile(file) {
    let d;
    try { d = JSON.parse(await file.text()); } catch (e) { return { ok: false, why: 'The file couldn\'t be read.' }; }
    const why = check(d); if (why) return { ok: false, why };
    pending = d; return { ok: true };
  }
  function applyImport() {
    const d = pending; pending = null;
    try {
      localStorage.setItem(M.SAVE_KEY + '-backup', localStorage.getItem(M.SAVE_KEY) || '');
      localStorage.setItem(M.SAVE_KEY, JSON.stringify(d.market));
      for (const [k, v] of Object.entries(d.extra || {})) if (KEEP.test(k)) localStorage.setItem(k, v);
      localStorage.setItem('cs-cloud-import', '1'); // js/net.js uploads this game to your account instead of loading the account's copy
    } catch (e) { toast('Can\'t load the backup', WHY.full); return; }
    M.freeze(); // the old game must not save over the backup on the way out
    location.reload();
  }

  // ---------- Settings → Your save ----------
  function html() {
    const l = M.saveStatus(), c = cloud(), p = problem();
    let size = 0; try { size = (localStorage.getItem(M.SAVE_KEY) || '').length; } catch (e) { /* blocked */ }
    let lastExp = 0; try { lastExp = +localStorage.getItem('cs-last-export') || 0; } catch (e) { /* blocked */ }
    const online = window.Net && Net.configured;
    const cl = !online ? 'Not available in this copy of the game' : c.state === 'off' ? 'Not signed in: this device only' : c.state === 'ok' ? `Saved ${ago(c.at)}` : c.state === 'saving' ? 'Saving…' : c.state === 'conflict' ? 'Stopped: a newer save came from another device or tab' : c.state === 'error' ? `Failed: ${esc(c.why)}. Retrying` : 'Waiting';
    return `<h3>Your save</h3><p>Your game saves by itself every few seconds and whenever you buy or sell. ${online ? 'When you\'re online it also goes to your account, so it follows you to other devices.' : ''}</p>
      ${p ? `<p class="swarn">⚠ ${esc(p)}</p>` : ''}
      ${row('On this device', l.ok ? `Saved ${ago(l.at)} · ${(size / 1024).toFixed(0)} KB` : `<span class="bad">Not saving: ${esc(WHY[l.why] || '')}</span>`, `<span class="sst ${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '⚠'}</span>`)}
      ${row('On your account', cl, `<span class="sst ${c.state === 'ok' ? 'ok' : c.state === 'error' || c.state === 'conflict' ? 'bad' : ''}">${c.state === 'ok' ? '✓' : c.state === 'error' || c.state === 'conflict' ? '⚠' : '–'}</span>`)}
      ${c.state === 'conflict' ? `<div class="srow"><div><b>Use this device's game</b><small>Replaces the save on your account with the game on this screen. The other copy is lost.</small></div><button class="btn" id="svForce">UPLOAD THIS ONE</button></div>
        <div class="srow"><div><b>Load the newer save</b><small>Reloads with your account's save. This screen's unsaved progress is lost.</small></div><button class="btn pri" id="svLoad">LOAD IT</button></div>` : ''}
      ${row('Backup file', `Your cash, shares, property, office and progress in one file (no password or sign-in). Last downloaded: ${lastExp ? ago(lastExp) : 'never'}`, '<button class="btn pri" id="svExp">DOWNLOAD</button>')}
      ${row('Load a backup', pending ? '<span class="bad">This replaces the game you\'re playing now. Your current save is kept as a backup on this device.</span>' : 'Pick a file you downloaded before', pending ? '<button class="btn danger" id="svApply">REPLACE MY GAME</button>' : '<label class="btn" id="svPick">CHOOSE FILE<input type="file" id="svFile" accept=".json,application/json" hidden></label>')}`;
  }
  const row = (label, help, ctl) => `<div class="srow"><div><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div>${ctl}</div>`;
  function bind(body, redraw) {
    $('svExp').onclick = exportSave;
    if ($('svFile')) $('svFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; const r = await importFile(f); if (!r.ok) toast('Can\'t load the backup', r.why); redraw(); };
    if ($('svApply')) $('svApply').onclick = applyImport;
    if ($('svForce')) $('svForce').onclick = async () => { const r = await Net.resolveConflict('upload'); toast(r.ok ? 'Uploaded' : 'Can\'t upload', r.ok ? 'Your account now has this game.' : r.why); redraw(); };
    if ($('svLoad')) $('svLoad').onclick = () => Net.resolveConflict('load');
  }
  // ---------- the same game in two tabs would save over itself: only one tab plays at a time ----------
  const TAB = Math.random().toString(36).slice(2), tabOv = document.createElement('div');
  tabOv.id = 'tabOv'; tabOv.className = 'ov2'; tabOv.hidden = true; document.body.appendChild(tabOv);
  let bc = null, asleep = false, asked = false;
  try { bc = new BroadcastChannel('cs-tabs'); } catch (e) { bc = null; }
  function sleepHere() {
    if (asleep) return; asleep = true;
    M.save(); M.freeze(); if (window.Net && Net.pause) Net.pause();
    tabOv.innerHTML = '<div class="jbox"><b>Playing in another tab</b><p>Capital Street is open in another tab, so this one stopped. That way the two can\'t save over each other.</p><button class="btn pri big" id="tabHere">PLAY HERE INSTEAD</button></div>';
    tabOv.hidden = false; $('tabHere').onclick = () => location.reload();
  }
  function ask() {
    tabOv.innerHTML = '<div class="jbox"><b>Already open in another tab</b><p>Playing in two tabs at once can lose progress. Play here, and the other tab stops.</p><div class="jrow"><button class="btn pri" id="tabTake">PLAY HERE</button><button class="btn" id="tabNo">USE THE OTHER TAB</button></div></div>';
    tabOv.hidden = false;
    $('tabTake').onclick = () => { bc.postMessage({ t: 'take', tab: TAB }); tabOv.innerHTML = '<div class="jbox"><b>Taking over…</b></div>'; setTimeout(() => location.reload(), 400); }; // reload to pick up what the other tab saved
    $('tabNo').onclick = () => { tabOv.hidden = true; sleepHere(); };
  }
  if (bc) {
    bc.onmessage = e => {
      const d = e.data || {}; if (d.tab === TAB || asleep) return;
      if (d.t === 'hello') bc.postMessage({ t: 'here', tab: TAB });
      else if (d.t === 'here' && !asked) { asked = true; ask(); }
      else if (d.t === 'take') sleepHere();
    };
    bc.postMessage({ t: 'hello', tab: TAB });
  }

  setTimeout(draw, 1000);
  return { html, bind, exportSave, problem, draw };
})();
