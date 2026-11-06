const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('./enterprise');
const own=k=>E.SITES.filter(p=>k.includes(p.kind)).filter((p,i,a)=>a.findIndex(v=>v.kind===p.kind)===i);
test('permanent catalog IDs and starter addresses never overlap',()=>{
 assert.equal(new Set(E.SITES.map(s=>s.id)).size,E.SITES.length);
 const flats=E.SITES.filter(p=>p.kind==='starter');assert.equal(flats.length,64);assert.equal(new Set(flats.map(p=>`${p.x},${p.z}`)).size,64);
 for(const p of E.SITES)assert(p.price>0&&Number.isFinite(p.x)&&Number.isFinite(p.z));
});
test('property ownership gates mining, retail and share work',()=>{
 for(const [action,item]of [['mine','ridge:mine:0'],['wholesale','sneakers'],['buyshare','MAR']])assert.throws(()=>E.quote(E.fresh(),action,item,5,200000,{cash:9999,owned:[]}),/Buy/);
 assert.throws(()=>E.quote(E.fresh(),'mine','ridge:mine:0',5,0,{cash:9999,owned:own(['mine'])}),/harbour/);
});
test('finite extraction, busy crew, full stores, voyage and payment once survive reload',()=>{
 let s=E.fresh(),cash=2340;const owned=own(['mine','harbour']);
 const act=(a,i,q,t)=>{const r=E.quote(s,a,i,q,t,{cash,owned,id:'voyage'});s=r.state;cash+=r.delta;};
 act('mine','ridge:mine:0',10,0);assert.equal(cash,2320);assert.throws(()=>act('mine','ridge:mine:0',10,100),/busy/);
 s=JSON.parse(JSON.stringify(s));E.settle(s,20000);assert.equal(s.stock.coal,10);E.settle(s,30000);assert.equal(s.stock.coal,10);
 act('export','coal',10,30000);assert.equal(s.stock.coal,0);assert.equal(cash,2285);
 assert.throws(()=>act('collect','voyage',1,40000),/received/);act('collect','voyage',1,180000);assert.equal(cash,2365);assert.equal(s.profit,25);
 assert.throws(()=>act('collect','voyage',1,180001),/collected/);
 s.used['ridge:mine:0']=2000;assert.throws(()=>act('mine','ridge:mine:0',1,180001),/exhausted/);
});
test('larger harbours and upgrades expand capacity, while resource storage is separate from shop stock',()=>{
 const ports=E.SITES.filter(p=>p.kind==='harbour');assert(E.capacity([ports[3]],E.fresh())>E.capacity([ports[0]],E.fresh()));
 const s=E.fresh();s.portLevel=3;assert.equal(E.capacity([ports[0]],s),80);
 s.stock={sneakers:40};assert.equal(E.total(s),0);
 assert.throws(()=>E.quote(E.fresh(),'mine','ridge:mine:0',25,0,{cash:9999,owned:own(['mine','harbour'])}),/storage/);
});
test('retail basis and share fees are charged; trading can lose and closed sessions reject orders',()=>{
 let s=E.fresh(),cash=9999;const owned=own(['shop','office']);
 const buy=E.quote(s,'wholesale','sneakers',5,0,{cash,owned});s=buy.state;cash+=buy.delta;
 const sale=E.quote(s,'resell','sneakers',5,0,{cash,owned});assert.equal(sale.delta,120);assert.equal(sale.state.profit,30);
 const t=200000,p=E.price('MAR',t),q=E.quote(E.fresh(),'buyshare','MAR',5,t,{cash,owned});assert.equal(q.delta,-5*p-Math.max(1,Math.ceil(5*p*.01)));
 const sell=E.quote(q.state,'sellshare','MAR',5,t,{cash:9999,owned});assert(sell.state.profit<0);
 assert.throws(()=>E.quote(E.fresh(),'buyshare','MAR',5,24*20000,{cash,owned}),/closed/);
});

test('new district streets stay clear of building footprints',()=>{
 const conflicts=[];
 for(const b of E.SITES.filter(p=>p.kind!=='mine'))for(const [a,c]of E.STREETS){
  const overlap=Math.min(a[0],c[0])<b.x+b.w/2+3.5&&Math.max(a[0],c[0])>b.x-b.w/2-3.5&&Math.min(a[1],c[1])<b.z+b.d/2+3.5&&Math.max(a[1],c[1])>b.z-b.d/2-3.5;
  if(overlap)conflicts.push(b.id);
 }assert.deepEqual(conflicts,[]);
});
test('factory ownership and oil inputs are required; refining preserves basis and pays only on export',()=>{
 const s=E.fresh();s.stock.oil=10;s.basis.oil=40;const owned=own(['factory','harbour']);
 const r=E.quote(s,'refine','oil',10,0,{cash:1000,owned});assert.equal(r.delta,-30);assert.equal(r.state.stock.oil,0);
 E.settle(r.state,30000);assert.equal(r.state.stock.fuel,10);assert.equal(r.state.basis.fuel,70);
 assert.throws(()=>E.quote(s,'refine','oil',10,0,{cash:1000,owned:[]}),/factory/);
});
