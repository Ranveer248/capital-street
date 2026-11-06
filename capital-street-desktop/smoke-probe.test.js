'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const probe = require('./smoke-probe');

function fixture({ hidden = false, failed = false, waiting = true, plots = 0, button = true } = {}) {
  let clicks = 0;
  const load = { hidden, classList: { contains: () => failed } };
  const context = {
    window: { CS: {}, Boot: { waiting: () => waiting }, Land: { plots: { size: plots } } },
    document: {
      getElementById: id => id==='load'?load:null,
      querySelector: selector => {
        assert.equal(selector, '#lq [data-q="low"]');
        return button ? { click: () => { clicks++; waiting = false; } } : null;
      },
    },
  };
  return { context, load, clicks: () => clicks, run: () => vm.runInNewContext(`(${probe.toString()})()`, context) };
}

test('fresh profile chooses Low once, then waits for real city readiness', () => {
  const f = fixture();
  assert.equal(f.run(), false);
  assert.equal(f.clicks(), 1);
  assert.equal(f.run(), false);
  assert.equal(f.clicks(), 1);
  f.load.hidden = true;
  assert.equal(f.run(), false); // Hiding the loader alone is not enough.
  f.context.window.Land.plots.size = 10;
  assert.equal(f.run(), true);
});
test('an existing graphics choice is preserved', () => {
  const f = fixture({ waiting: false });
  assert.equal(f.run(), false);
  assert.equal(f.clicks(), 0);
});
test('a graphics failure never becomes a successful smoke check', () => {
  const f = fixture({ failed: true, hidden: true, plots: 10 });
  assert.equal(f.run(), false);
  assert.equal(f.clicks(), 0);
});
test('missing page or pending controls keep the check waiting', () => {
  const f = fixture({ button: false });
  assert.equal(f.run(), false);
  f.context.document.getElementById = () => null;
  assert.equal(f.run(), false);
});
test('a loaded city passes without changing graphics', () => {
  const f = fixture({ hidden: true, waiting: false, plots: 10 });
  assert.equal(f.run(), true);
  assert.equal(f.clicks(), 0);
});

test('island startup waits for the expanded world and a visible HUD',()=>{
 let clicks=0;const cover={hidden:false},hud={hidden:true},play={disabled:false,click:()=>clicks++};
 const context={window:{World:{buildings:[]}},document:{getElementById:id=>({cover,hud,play})[id]||null,querySelector:()=>null}};
 const run=()=>vm.runInNewContext(`(${probe.toString()})()`,context);
 assert.equal(run(),false);assert.equal(clicks,1);cover.hidden=true;assert.equal(run(),false);
 context.window.World.buildings.push({id:'east:port:0'});assert.equal(run(),false);hud.hidden=false;assert.equal(run(),true);
});
