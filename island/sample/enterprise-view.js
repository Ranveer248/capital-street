// Original Eastbank district and North Ridge. Uses the game's existing architecture.
window.EnterpriseView=(()=>{
 let W,freight=[],stamp='',ambient=null;const lots=new Map();
 const mat=c=>new THREE.MeshStandardMaterial({color:new THREE.Color(c).convertSRGBToLinear(),roughness:.82});
 function box(g,x,y,z,w,h,d,c){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y+h/2,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
 function ribbon(points,width,color,y=.12){const sampled=[];for(let n=0;n<points.length-1;n++){const p=points[n],q=points[n+1],steps=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/4));for(let k=0;k<steps;k++)sampled.push([p[0]+(q[0]-p[0])*k/steps,p[1]+(q[1]-p[1])*k/steps]);}sampled.push(points[points.length-1]);points=sampled;const a=[];for(let i=0;i<points.length-1;i++){
   const p=points[i],q=points[i+1],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<.01)continue;const nx=-dz/len*width/2,nz=dx/len*width/2;
   const v=(p,x,z)=>[p[0]+x,y===6?3.2+6*Math.sin(Math.PI*Math.max(0,Math.min(1,(p[0]+x-224)/196))):W.heightAt(p[0]+x,p[1]+z)+y,p[1]+z];
   const A=v(p,nx,nz),B=v(p,-nx,-nz),C=v(q,nx,nz),D=v(q,-nx,-nz);a.push(...A,...C,...B,...B,...C,...D);
  }const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(a,3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,mat(color));m.receiveShadow=true;W.scene.add(m);return m;
 }
 function init(world){
  W=world;
  const sites=Enterprise.SITES.map(p=>({...p,sign:13,roof:p.kind==='office'?0x356b77:0xbc7257,color:p.kind==='starter'?0xe2d4b7:0xe8e5d6,floors:p.kind==='office'?5+(Number(p.id.split(':').pop())%4):p.kind==='hotel'?7:2,noPath:true}));
  W.addDistrict(sites);for(const b of sites){lots.set(b.id,b);W.LABELS.push({text:b.name,level:'place',x:b.x,y:b.h+5,z:b.z,small:true,b});}
  const roads=Enterprise.STREETS;
  roads.forEach(p=>{ribbon(p,10,0xc7d3c9,.09);ribbon(p,7,0x526570,.14);});
  // The new harbour road crosses the strait on a raised bridge.
  ribbon([[224,12],[320,135],[420,240]],10,0x71818a,6);
  const bridge=new THREE.Group();for(let k=0;k<5;k++)box(bridge,255+k*32,-3,55+k*36,3,15,3,0xb7c4c4);W.scene.add(bridge);
  const northern=[[-212,-386],[-230,-465],[-300,-500],[-520,-500],[-560,-640],[-300,-690]];
  ribbon(northern,8,0x617078);
  for(const p of sites.filter(p=>p.kind==='mine'))ribbon([[p.x,p.z+16],[p.x,-500],[-300,-500]],5,0xb9a887);
  // A visible river, boardwalk and bridges give the expansion its own geography.
  const river=[];for(let k=0;k<22;k++)river.push([610+Math.sin(k*.45)*3,180+k*34]);ribbon(river,9,0x38b8c8,.2);
  const decor=new THREE.Group();
  for(let i=0;i<28;i++){
   const x=620+Math.sin(i*.5)*3,z=220+i*25;box(decor,x,3.2,z,2.8,.5,1,0x9b684c);box(decor,x-1,3,z,.2,.5,.7,0x3c555e);box(decor,x+1,3,z,.2,.5,.7,0x3c555e);
  }
  for(const p of sites.filter(p=>p.kind==='farm'))for(let row=0;row<5;row++){box(decor,p.x-19,3.1,p.z-11+row*4,12,.18,2,0x9c764a);box(decor,p.x-19,3.3,p.z-11+row*4,11,.5,.5,0x69a34c);}
  for(const p of sites.filter(p=>p.kind==='harbour')){
   box(decor,p.x,2.5,p.z+24,55,.5,15,0xa6b4b2);
   for(let n=0;n<4;n++){box(decor,p.x-18+n*9,3,p.z+19,7,3.5,3,[0xd18057,0x4b9f9e,0xdebf69,0x5d7e9d][n]);}
   box(decor,p.x+24,3,p.z+17,1.3,15,1.3,0xe5b34e);box(decor,p.x+18,17,p.z+17,14,1,1,0xe5b34e);
  }
  for(const p of sites.filter(p=>p.kind==='mine')){
   const good=Enterprise.resource(p.id);if(good==='oil'){box(decor,p.x-8,3,p.z,1,9,1,0x314951);const beam=box(decor,p.x-8,11,p.z,12,1,1.3,0xd6a652);beam.rotation.z=.18;}
   else for(let i=0;i<5;i++){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(2+i*.4,0),mat(good==='coal'?0x3e4d53:0xae7d53));m.position.set(p.x-12+i*5,4,p.z+12);decor.add(m);}
  }
  // Lighthouse, civic monument, beach shelters and distinct luxury homes.
  box(decor,1030,3,790,6,24,6,0xf0eee3);box(decor,1030,27,790,8,2,8,0xd77957);
  box(decor,817,3,662,12,1,12,0xe2d7bd);box(decor,817,4,662,2,14,2,0x6c9a91);
  for(let i=0;i<12;i++){const x=1090,z=310+i*35;box(decor,x,3,z,4,.5,5,0xe1d0aa);box(decor,x,6,z,6,.4,6,0xd7a767);}
  W.scene.add(decor);
  for(const z of Array.from({length:9},(_,i)=>282+i*36)){const bridge=new THREE.Group();box(bridge,610,3.4,z,15,.6,11,0xc8d5ca);W.scene.add(bridge);}
  const body=new THREE.InstancedMesh(new THREE.BoxGeometry(.55,1.1,.4),mat(0xffffff),48),head=new THREE.InstancedMesh(new THREE.SphereGeometry(.23,7,5),mat(0xc58b65),48),car=new THREE.InstancedMesh(new THREE.BoxGeometry(2,1.4,4),mat(0xffffff),12);
  const tmp=new THREE.Object3D(),c=new THREE.Color(),tracks=[];
  for(let i=0;i<48;i++){const road=roads[i%roads.length],a=road[0],b=road[1];tracks.push({a,b,speed:.003+(i%4)*.0007,offset:i*.137});body.setColorAt(i,c.set([0x315c71,0x789071,0xe0c392,0x7d6a82,0xc27f65,0x404e55][i%6]).convertSRGBToLinear());}
  for(let i=0;i<12;i++)car.setColorAt(i,c.set([0xede6d0,0x356b78,0xdba75b,0x4b585e][i%4]).convertSRGBToLinear());
  W.scene.add(body,head,car);ambient={body,head,car,tmp,tracks,factories:[]};
  for(const p of sites.filter(p=>p.kind==='factory')){const g=new THREE.Group();box(g,0,.5,0,2.4,2.2,5,0x45978f);box(g,0,.5,3.1,2.4,2.2,1.6,0xe4bb6d);for(const x of [-1.3,1.3])for(const z of [-1.4,2.4])box(g,x,0,z,.3,.8,.8,0x30464b);W.scene.add(g);ambient.factories.push({g,p});}

  // Three roundabout gardens at street intersections (the new district traffic uses these roads).
  for(const [x,z]of [[625,790],[926,790],[1006,240]]){const m=new THREE.Mesh(new THREE.CylinderGeometry(6,6,.4,24),mat(0x77a56f));m.position.set(x,3.3,z);W.scene.add(m);}
  W.LABELS.push({text:'Eastbank City',level:'district',x:780,y:35,z:440},{text:'North Ridge',level:'district',x:-420,y:45,z:-590},{text:'Ocean Gate · Exports',level:'district',x:770,y:30,z:880},{text:'Riverbend',level:'district',x:520,y:25,z:700},{text:'Coral Bay',level:'district',x:1040,y:30,z:620});
 }
 function animate(time){
  if(!ambient)return;const {body,head,car,tmp,tracks}=ambient,t=time/1000;
  tracks.forEach((v,i)=>{const k=(t*v.speed+v.offset)%2,q=k<1?k:2-k,x=v.a[0]+(v.b[0]-v.a[0])*q,z=v.a[1]+(v.b[1]-v.a[1])*q;tmp.position.set(x+4.3,3.9,z+4.3);tmp.updateMatrix();body.setMatrixAt(i,tmp.matrix);tmp.position.y=4.7;tmp.updateMatrix();head.setMatrixAt(i,tmp.matrix);});
  for(let i=0;i<12;i++){const row=i%7,z0=282+row*36,q=(t*(4+i%3)+i*43)%672;let x,z,az;if(q<300){x=506+q;z=z0;az=Math.PI/2;}else if(q<336){x=806;z=z0+q-300;az=0;}else if(q<636){x=806-(q-336);z=z0+36;az=-Math.PI/2;}else{x=506;z=z0+36-(q-636);az=Math.PI;}tmp.position.set(x,Math.abs(x-610)<8?4.7:3.9,z);tmp.rotation.y=az;tmp.updateMatrix();car.setMatrixAt(i,tmp.matrix);}tmp.rotation.y=0;
  for(const f of ambient.factories){const phase=(t+f.p.x)%42;const z=phase<14?f.p.z+35-phase*1.8:phase<24?f.p.z+10:f.p.z+10+(phase-24)*1.4;f.g.position.set(f.p.x,3,z);f.g.rotation.y=phase<24?Math.PI:0;}
  body.instanceMatrix.needsUpdate=head.instanceMatrix.needsUpdate=car.instanceMatrix.needsUpdate=true;
 }
 function sync(state,owned,time){
  if(!W)return;const next=JSON.stringify(state.ships.map(s=>s.id));
  if(next!==stamp){stamp=next;for(const f of freight)W.scene.remove(f.g);freight=[];
   for(const ship of state.ships){const g=new THREE.Group();box(g,0,0,0,3,2.4,8,0x42a9a0);box(g,0,0,5,3,2.4,2.5,0xf5d482);W.scene.add(g);
    const port=owned.find(p=>p.kind==='harbour')||{x:750,z:850};
    const pts=[[port.x,3,port.z-20],[port.x,3,port.z+22],[port.x,0,1020],[380,0,1100],[100,0,1050]];
    freight.push({g,ship,pts,port});
   }
  }
  for(const f of freight){const s=f.ship,sea=time>=s.sea,frac=Math.max(0,Math.min(1,(time-(sea?s.sea:s.start))/(sea?s.end-s.sea:s.sea-s.start)));
   const p=sea?f.pts.slice(2):f.pts.slice(0,2),segments=p.length-1,k=Math.min(segments-1,Math.floor(frac*segments)),a=p[k],b=p[k+1],v=Math.min(1,frac*segments-k);f.g.position.set(a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v+.5,a[2]+(b[2]-a[2])*v);f.g.rotation.y=Math.atan2(b[0]-a[0],b[2]-a[2]);f.g.scale.set(sea?2:1,1,sea?3:1);f.g.visible=time<s.end;
  }
 }
 return {init,sync,animate,lots};
})();
