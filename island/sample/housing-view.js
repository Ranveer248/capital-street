// One reusable exterior on a new parcel. Existing buildings/batches are untouched.
window.HousingView = (() => {
  let world, signature=''; const plots=new Map(), groups=new Map();
  function init(w) {
    world=w;
    for(const p of Housing.PLOTS){
      const b={...p,parcel:true,type:'parcel',area:'Orchard Close',rot:0,y:3,h:1,sale:false};
      world.buildings.push(b); plots.set(p.id,b);
      world.LABELS.push({text:p.name,level:'place',x:p.x,y:8,z:p.z,small:true});
    }
    update({});
  }
  function update(homes) {
    if(!world)return;
    const next=JSON.stringify(Housing.PLOTS.map(p=>[p.id,homes[p.id]||null,!!(homes[p.id]&&homes[p.id].ready>Date.now())]));
    if(next===signature)return; signature=next;
    for(const p of Housing.PLOTS){
      const old=groups.get(p.id);
      if(old){world.scene.remove(old);old.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});}
      const h=homes[p.id], b=plots.get(p.id), g=new THREE.Group(); g.position.set(p.x,3,p.z);groups.set(p.id,g);world.scene.add(g);
      function box(x,y,z,w,ht,d,c){const m=new THREE.Mesh(new THREE.BoxGeometry(w,ht,d),new THREE.MeshStandardMaterial({color:new THREE.Color(c).convertSRGBToLinear(),roughness:.85}));m.position.set(x,y+ht/2,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
      box(0,0,0,24,.12,28,0x88b964);
      // A clear drive meets the existing Villa Point approach; gate opens toward the road.
      const reach=world.housingAccess(p);
      const drive=[];
      for(let z=14;z<reach;z+=.75){
        const end=Math.min(reach,z+.75), point=(x,z)=>[x,world.heightAt(p.x+x,p.z+z)-3+.13,z];
        const a=point(-1.5,z),b=point(1.5,z),c=point(-1.5,end),d=point(1.5,end);
        drive.push(...a,...c,...b,...b,...c,...d);
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(drive,3));geo.computeVertexNormals();
      const driveway=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:new THREE.Color(0xd9d3c6).convertSRGBToLinear(),roughness:.9}));driveway.receiveShadow=true;g.add(driveway);
      box(-11.5,.12,0,.3,.8,28,0xf2ece0);box(11.5,.12,0,.3,.8,28,0xf2ece0);
      box(0,.12,-13.5,23,.8,.3,0xf2ece0);box(-7,.12,13.5,9,.8,.3,0xf2ece0);box(7,.12,13.5,9,.8,.3,0xf2ece0);
      const building=h&&h.level, working=building&&h.ready>Date.now(); b.h=building?(working?3:h.level===2?9:6):1;
      if(building){
        box(0,.12,0,13,.35,12,0xd9d3c6);
        if(working){
          for(const x of [-5.5,5.5])for(const z of [-5,5])box(x,.47,z,.4,2.8,.4,0xc29b65);
          box(0,.47,0,6,.8,4,0xc29b65);box(0,1.3,0,5,.3,3,0xb28855);
        }else{
          const height=h.level===2?6.4:3.4, color=h.level===2?0xdce9e6:0xffe7bf;
          box(0,.47,0,12,height,10,color);
          box(0,height+.47,0,13,.35,11,0xf4eee2);
          const roof=new THREE.Mesh(new THREE.ConeGeometry(9,2.5,4),new THREE.MeshStandardMaterial({color:new THREE.Color(h.level===2?0x426f78:0xc46743).convertSRGBToLinear()}));roof.rotation.y=Math.PI/4;roof.scale.z=.86;roof.position.y=height+1.95;roof.castShadow=true;g.add(roof);
          // Exterior door and a front porch (no traversable interior in this milestone).
          box(0,.47,5.06,1.4,2.6,.16,0x614b3c);box(0,.12,7,3,.35,4,0xd9d3c6);
          for(const y of [1.7,...(h.level===2?[4.7]:[])])for(const x of [-3.6,3.6]){
            box(x,y-.1,5.07,2.2,1.7,.18,0xffffff);box(x,y,5.19,1.85,1.4,.05,0x6aa6bd);
            box(x,y+.65,5.23,1.85,.08,.05,0xffffff);box(x,y,5.23,.08,1.4,.05,0xffffff);
          }
          if(h.level===2){box(-7,.12,-3,1.1,1.8,2.6,0x478857);box(7,.12,-3,1.1,1.8,2.6,0x478857);}
        }
      }else{
        box(-7,.12,9,.2,2,.2,0x624b3e);box(-7,1.4,9,4,1.2,.18,0x245c73);
      }
      world.invalidatePhoto(p.id);
    }
  }
  return {init,update,plots};
})();
