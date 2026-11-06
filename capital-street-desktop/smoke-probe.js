'use strict';

// Serialized into the renderer by the --smoke check only. Keep this function
// self-contained: it runs without Node globals in the sandboxed game window.
module.exports = function smokeProbe() {
  const load = document.getElementById('load');
  if (!load || load.classList.contains('bad')) return false;

  // A fresh CI profile must make the same first-run choice as a player.
  // Low suits the software renderer; clicking must not itself count as success.
  if (!load.hidden && window.Boot && window.Boot.waiting()) {
    const low = document.querySelector('#lq [data-q="low"]');
    if (low) low.click();
  }

  return !!(window.CS && load.hidden && window.Land && window.Land.plots.size);
};
