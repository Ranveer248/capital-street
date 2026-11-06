const {test}=require('node:test'), assert=require('node:assert/strict'), H=require('./housing');
test('build, rent, collect once, renovate, live, demolish and rebuild; reload retains parcel',()=>{
 let cash=2340-400, homes={[H.PLOTS[0].id]:H.empty(0)};
 const id=H.PLOTS[0].id;
 function act(a,t){const q=H.quote(homes[id],a,t);assert(cash>=q.cost);cash+=q.income+q.salvage-q.cost;homes[id]=q.home;}
 act('build',0); assert.equal(cash,1340);
 assert.throws(()=>act('rent',1000),/progress/);
 act('rent',20000); act('collect',620000); assert.equal(cash,1350);
 assert.throws(()=>act('collect',620000),/No rent/);
 act('renovate',620000); act('home',635000);
 assert.equal(homes[id].level,2); assert.equal(H.due(homes[id],99999999),0);
 act('demolish',635000); assert.equal(homes[id].level,0); assert.equal(cash,925);
 act('build',635000); homes=JSON.parse(JSON.stringify(homes));
 assert.equal(homes[id].level,1); assert.equal(cash,325);
});
test('closed-app rent caps at six periods, without repeat collection or clock reversal',()=>{
 const h={...H.empty(0),level:1,mode:'rent'};
 assert.equal(H.due(h,-600000),0);
 const q=H.quote(h,'collect',H.PERIOD*100);
 assert.equal(q.income,60); assert.equal(H.due(q.home,H.PERIOD*100),0);
});
test('invalid actions leave old saves untouched; no ownership is invented',()=>{
 const save={cash:2340,owned:{b17:{at:123}},eco:{farm:{qty:4}}}, before=JSON.stringify(save);
 assert.throws(()=>H.quote(null,'build',0),/Buy/);
 assert.throws(()=>H.quote(H.empty(0),'renovate',0),/standard/);
 assert.throws(()=>H.quote(H.empty(0),'unknown',0),/Unknown/);
 assert.equal(JSON.stringify(save),before);
});
