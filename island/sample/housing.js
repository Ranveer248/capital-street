// Housing rules shared by the island UI and its regression tests. Dollars, UTC milliseconds.
(function(root) {
  'use strict';
  const PLOTS = [{ id: 'parcel:orchard-01', name: '1 Orchard Close', x: -253, z: 24, w: 24, d: 28, price: 400 }];
  const BUILD = 600, RENOVATE = 450, DEMOLISH = 75, SALVAGE = 100, PERIOD = 600000, CAP = 6;
  const empty = t => ({ level: 0, mode: 'vacant', ready: 0, at: t, revision: 0 });
  const due = (h, t) => h && h.mode === 'rent' && !h.ready ? Math.min(CAP, Math.max(0, Math.floor((t-h.at)/PERIOD))) * (h.level === 2 ? 18 : 10) : 0;
  function quote(h, action, t) {
    if (!h) throw Error('Buy this plot first.');
    const n = Object.assign({}, h), income = due(n,t);
    if (n.ready && t >= n.ready) n.ready = 0;
    if (n.ready) throw Error('Construction is still in progress.');
    let cost = 0, salvage = 0;
    if (action === 'build') { if (n.level) throw Error('There is already a house here.'); cost=BUILD; n.level=1; n.ready=t+20000; n.mode='vacant'; }
    else if (action === 'renovate') { if (n.level!==1) throw Error('Renovation needs a standard house.'); cost=RENOVATE; n.level=2; n.ready=t+15000; n.mode='vacant'; }
    else if (action === 'demolish') { if (!n.level) throw Error('There is no house to demolish.'); cost=DEMOLISH; salvage=SALVAGE; n.level=0; n.mode='vacant'; }
    else if (action === 'home' || action === 'rent') { if (!n.level) throw Error('Build a house first.'); if (n.mode===action) throw Error('This house already has that use.'); n.mode=action; }
    else if (action === 'collect') { if (!income) throw Error('No rent is ready yet.'); }
    else throw Error('Unknown housing action.');
    if (action === 'collect') n.at = t-h.at >= CAP*PERIOD ? t : h.at + Math.floor((t-h.at)/PERIOD)*PERIOD;
    else n.at=t;
    n.revision=(h.revision||0)+1;
    return { home:n, cost, income, salvage };
  }
  const api={PLOTS,BUILD,RENOVATE,DEMOLISH,SALVAGE,PERIOD,CAP,empty,due,quote};
  if (typeof module==='object' && module.exports) module.exports=api; else root.Housing=api;
})(typeof window==='object'?window:this);
