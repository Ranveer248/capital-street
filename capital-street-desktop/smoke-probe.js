'use strict';

// Serialized into the renderer by the --smoke check only. Keep this function
// self-contained: it runs without Node globals in the sandboxed game window.
module.exports = function smokeProbe() {
  const cover=document.getElementById('cover');
  if(cover){
    if(!cover.hidden){
      const low=document.querySelector('#gfx [data-q="low"]');if(low)low.click();
      const play=document.getElementById('play');if(play&&!play.disabled)play.click();
      return false;
    }
    const hud=document.getElementById('hud');
    return !!(hud&&!hud.hidden&&window.World&&window.World.buildings&&window.World.buildings.some(b=>b.id==='east:port:0'));
  }
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
