// Fictional island businesses. The catalog also generates permanent server parcel IDs.
(function(root){
 'use strict';
 const SITES=[];
 function site(id,kind,name,x,z,price,w=20,d=18){SITES.push({id,lot:id,kind,name,x,z,price,w,d,area:kind==='mine'?'North Ridge':'Eastbank',type:({starter:'flat',home:'villa',farm:'house',shop:'shophouse',office:'tower',harbour:'warehouse',mine:'warehouse',factory:'warehouse',hotel:'hotel'})[kind],sale:kind!=='starter',rot:0,y:3});}
 for(let i=0;i<64;i++)site('starter:'+i,'starter',`${i+1} Founders Lane`,520+i%8*36,300+Math.floor(i/8)*36,250,15,16);
 for(let i=0;i<12;i++){site('east:office:'+i,'office',`Eastbank Office ${i+1}`,870+i%3*48,280+Math.floor(i/3)*55,650,25,24);site('east:shop:'+i,'shop',`Market Arcade ${i+1}`,870+i%3*48,550+Math.floor(i/3)*48,450,25,20);}
 for(let i=0;i<8;i++){site('east:farm:'+i,'farm',`Riverbend Farm ${i+1}`,465+i%2*65,610+Math.floor(i/2)*48,500,20,18);site('east:port:'+i,'harbour',`Ocean Gate Berth ${i+1}`,650+i%4*76,820+Math.floor(i/4)*65,1000+(i%4)*350,30+(i%4)*12,28);site('east:villa:'+i,'home',`Coral Bay Villa ${i+1}`,1030,280+i*58,1600,24,25);}
 for(let i=0;i<6;i++)site('ridge:mine:'+i,'mine',`${['Coal','Copper','Oil'][i%3]} concession ${Math.floor(i/3)+1}`,-520+i%3*110,-540-Math.floor(i/3)*110,550+i%3*200,32,30);
 for(let i=0;i<4;i++){site('east:factory:'+i,'factory',`Seabright Works ${i+1}`,680+i%2*75,670+Math.floor(i/2)*65,1800,42,30);site('east:hotel:'+i,'hotel',`Coral Bay Hotel ${i+1}`,450,310+i*66,2400,28,32);}

 const STREETS=[];
 for(let i=0;i<9;i++){STREETS.push([[498+i*36,270],[498+i*36,590]]);STREETS.push([[498,282+i*36],[828,282+i*36]]);}
 for(const z of [252,307,362,417,472])STREETS.push([[845,z],[995,z]]);
 for(const z of [528,576,624,672,720])STREETS.push([[845,z],[995,z]]);
 for(const x of [845,893,941,989])STREETS.push([[x,240],[x,740]]);
 for(const z of [586,634,682,730,778])STREETS.push([[420,z],[580,z]]);
 for(const z of [640,700,770])STREETS.push([[625,z],[810,z]]);
 for(const z of [796,861,916])STREETS.push([[612,z],[926,z]]);
 for(const x of [420,495,580])STREETS.push([[x,240],[x,790]]);
 for(const x of [625,717.5,810])STREETS.push([[x,600],[x,790]]);
 STREETS.push([[420,240],[1006,240]],[[1006,240],[1006,930]],[[580,790],[1006,790]],[[625,770],[625,930]],[[926,770],[926,930]]);
 function clearAt(x,z){
  if(z>180&&z<930&&Math.abs(x-610)<10)return true;
  if(SITES.some(p=>Math.abs(x-p.x+(p.kind==='farm'?10:0))<p.w/2+(p.kind==='farm'?18:4)&&Math.abs(z-p.z)<p.d/2+4))return true;
  return STREETS.some(([a,b])=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<7;});
 }

 const RES={fuel:{name:'Refined fuel',cost:7,price:30},coal:{name:'Coal',cost:2,price:8},copper:{name:'Copper ore',cost:3,price:13},oil:{name:'Crude oil',cost:4,price:18}};
 const GOODS={sneakers:{name:'Sneakers',buy:18,sell:24},electronics:{name:'Electronics',buy:30,sell:39}};
 const SHARES={MAR:{name:'Mariner Logistics',base:38,mul:3},PAL:{name:'Palm Retail',base:24,mul:5},MET:{name:'Ridge Metals',base:54,mul:7}};
 const resource=id=>['coal','copper','oil'][Number(id.split(':').pop())%3];
 const fresh=()=>({revision:0,stock:{},basis:{},used:{},jobs:[],ships:[],positions:{},profit:0,portLevel:1,completed:0});
 const total=s=>Object.entries(s.stock).filter(([g])=>RES[g]).reduce((a,[g,n])=>a+n,0);
 const capacity=(owned,s)=>owned.filter(b=>b.kind==='harbour').reduce((n,b)=>n+(b.capacity||Math.max(20,Math.floor(b.w*b.d/50))),0)*(2**((s.portLevel||1)-1));
 const marketOpen=t=>Math.floor(t/20000)%30<24;
 function price(k,t){const b=SHARES[k];if(!b)throw Error('Unknown share');const tick=Math.floor(t/20000),base=b.base+(tick*b.mul%13)-6;return Math.max(2,Math.floor(base*(tick%90<3?.65:1)));}
 function settle(s,t){for(const j of s.jobs.filter(j=>j.end<=t)){s.stock[j.good]=(s.stock[j.good]||0)+j.qty;s.basis[j.good]=(s.basis[j.good]||0)+j.cost;}s.jobs=s.jobs.filter(j=>j.end>t);return s;}
 function quote(state,action,item,qty,t,ctx){
  const s=settle(JSON.parse(JSON.stringify(state)),t),owned=ctx.owned||[];let delta=0,xp=0;
  if(!Number.isSafeInteger(qty)||qty<1||qty>100)throw Error('Choose 1–100 units.');
  const has=k=>owned.some(p=>p.kind===k),give=(g,q,c)=>{s.stock[g]=(s.stock[g]||0)+q;s.basis[g]=(s.basis[g]||0)+c;};
  const take=(g,q)=>{if((s.stock[g]||0)<q)throw Error('Not enough stock.');const c=(s.basis[g]||0)*q/s.stock[g];give(g,-q,-c);return c;};
  if(action==='mine'){
   const p=owned.find(p=>p.id===item&&p.kind==='mine');if(!p)throw Error('Buy this mining concession first.');if(!has('harbour'))throw Error('Buy a harbour for resource storage and exports.');
   const good=resource(item),r=RES[good];if(qty>25)throw Error('A shift handles at most 25 units.');if(s.jobs.length)throw Error('Your extraction crew is busy.');
   if((s.used[item]||0)+qty>2000)throw Error('Deposit exhausted: choose another concession.');
   if(total(s)+qty>capacity(owned,s))throw Error('Harbour storage is full. Export stock or expand your harbour.');
   delta=-qty*r.cost;s.used[item]=(s.used[item]||0)+qty;s.jobs.push({lot:item,good,qty,cost:-delta,start:t,end:t+qty*2000});
  }else if(action==='refine'){
   if(!has('factory')||!has('harbour'))throw Error('Own a factory and a harbour to refine oil.');if(qty>25||s.jobs.length)throw Error('Production crew busy or batch exceeds 25 units.');const basis=take('oil',qty);delta=-qty*3;s.jobs.push({kind:'refine',lot:owned.find(p=>p.kind==='factory').id,good:'fuel',qty,cost:basis-delta,start:t,end:t+qty*3000});
  }else if(action==='export'){
   if(!has('harbour'))throw Error('Buy a harbour first.');if(!RES[item])throw Error('Choose a resource.');if(qty>capacity(owned,s))throw Error('Cargo exceeds your harbour capacity.');if(s.ships.length>=2)throw Error('Both export slots are busy.');
   const basis=take(item,qty);delta=-35;s.ships.push({id:ctx.id,good:item,qty,basis,fee:35,payout:qty*RES[item].price,start:t,sea:t+90000,end:t+150000});
  }else if(action==='collect'){
   const i=s.ships.findIndex(v=>v.id===item);if(i<0)throw Error('Shipment already collected or missing.');const v=s.ships[i];if(t<v.end)throw Error('The overseas buyer has not received this cargo yet.');
   delta=v.payout;s.profit+=delta-v.basis-v.fee;s.completed++;xp=Math.min(60,Math.max(1,Math.floor((delta-v.basis-v.fee)/4)));s.ships.splice(i,1);
  }else if(action==='wholesale'||action==='resell'){
   if(!has('shop'))throw Error('Buy a shop to run a resale business.');const g=GOODS[item];if(!g)throw Error('Unknown retail goods.');if(qty>25)throw Error('Trade up to 25 units per order.');
   if(action==='wholesale'){if(Object.entries(s.stock).filter(([g])=>GOODS[g]).reduce((n,[g,v])=>n+v,0)+qty>40)throw Error('Your stores are full.');delta=-qty*g.buy;give(item,qty,-delta);}else{const basis=take(item,qty);delta=qty*g.sell;s.profit+=delta-basis;xp=Math.min(30,Math.floor((delta-basis)/4));}
  }else if(action==='buyshare'||action==='sellshare'){
   if(!has('office'))throw Error('Buy an office to access the trading desk.');if(!marketOpen(t))throw Error('Market closed. The next session opens within two minutes.');
   const p=price(item,t),fee=Math.max(1,Math.ceil(qty*p*.01)),h=s.positions[item]||(s.positions[item]={qty:0,cost:0});
   if(action==='buyshare'){if(h.qty+qty>1000)throw Error('Position limit is 1,000 shares.');delta=-qty*p-fee;h.qty+=qty;h.cost+=-delta;}
   else{if(h.qty<qty)throw Error('Not enough shares.');const basis=h.cost*qty/h.qty;h.qty-=qty;h.cost-=basis;delta=qty*p-fee;s.profit+=delta-basis;}
  }else if(action==='portupgrade'){
   if(!has('harbour'))throw Error('Buy a harbour first.');if(s.portLevel>=3)throw Error('Your berths are fully expanded.');delta=-800*s.portLevel;s.portLevel++;
  }else throw Error('Unknown business action.');
  if(ctx.cash+delta<0)throw Error('Not enough cash.');s.revision++;return {state:s,delta:Math.round(delta*100)/100,xp};
 }
 const api={SITES,STREETS,clearAt,RES,GOODS,SHARES,resource,fresh,total,capacity,price,marketOpen,settle,quote};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.Enterprise=api;
})(typeof window==='object'?window:this);
