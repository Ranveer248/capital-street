window.HousingUI = (() => {
  let A, busy=false, lastStamp='';
  const stamp=()=>JSON.stringify(Housing.PLOTS.map(p=>{const h=A.homes()[p.id];return h?[h.revision,Math.max(0,Math.ceil((h.ready-Date.now())/1000)),Housing.due(h,Date.now())]:null;}));
  function sync(){if(!A||A.panel()!=='housing')return;const next=stamp();if(next!==lastStamp){lastStamp=next;A.refresh();}}
  const names={buy:'Buy plot',build:'Build cottage',renovate:'Renovate house',home:'Make my home',rent:'Rent to NPC tenant',collect:'Collect rent',demolish:'Demolish house'};
  function install(api){
    A=api;
    for(const page of ['home','build']){
      const old=A.panels[page];
      A.panels[page]=(...args)=>{
        const r=old(...args), bind=r.bind;
        r.html=`<button class="row" id="housingOpen"><span class="ic">${A.ic('home')}</span><div><b>Land & houses</b><small>Buy a plot · build · live or rent · renovate</small></div></button>`+r.html;
        r.bind=el=>{if(bind)bind(el);document.getElementById('housingOpen').onclick=()=>A.open('housing',Housing.PLOTS[0].id,true);};return r;
      };
    }
    A.panels.housing=id=>{
      lastStamp=stamp();
      const p=Housing.PLOTS.find(p=>p.id===id)||Housing.PLOTS[0], h=A.homes()[p.id], b=HousingView.plots.get(p.id), mine=h&&(!A.net.online||h.owner===A.net.me), can=!A.net.online||A.net.housing;
      const pending=h&&h.ready>Date.now(), ready=h&&h.level&&!pending, due=Housing.due(h,Date.now()), level=h&&h.level===2?'Renovated house':h&&h.level?'Cottage':'Vacant land';
      const action=(a,label)=>`<button class="btn ${a==='demolish'?'ghost':'go'}" data-ha="${a}" ${busy||!can?'disabled':''}>${label||names[a]}</button>`;
      return {title:'Land & houses',html:`<div class="ph" data-house-photo></div><b class="big">${p.name}</b><p class="note">Orchard Close · ${p.w} × ${p.d} m · ${level}</p>
        ${!can?'<p class="note why">Online housing is not available on this server yet. Your current property is safe.</p>':''}
        ${h?`<p class="note">${mine?'Your land':`Owned by ${A.esc(h.name||'another player')}`} · ${pending?'Construction in progress':h.mode==='home'?'Your home base':h.mode==='rent'?'NPC tenant in residence':'Not in use'}</p>`:'<p class="note">A serviced residential plot beside Villa Point’s approach. Includes road access. Your starter flat remains available.</p>'}
        ${pending?`<div class="step"><b>Building works</b><small>Ready in ${Math.max(1,Math.ceil((h.ready-Date.now())/1000))} s</small></div>`:''}
        ${ready?`<div class="stats"><div>${h.mode==='rent'?'Net rent':'If rented'}<b>$${h.level===2?18:10}/10 min</b></div><div>Ready to collect<b>$${due}</b></div><div>Use<b>${h.mode==='rent'?'Rental':h.mode==='home'?'Home':'Vacant'}</b></div></div><p class="note">Rent shown is after upkeep. At most one hour accrues between collections. NPC tenants work without other players.</p>`:''}
        <div class="acts"><button class="btn ghost" id="houseView">VIEW ON MAP</button>${!h?action('buy',`BUY LAND · $${p.price}`):mine&&!pending?(!h.level?action('build',`BUILD COTTAGE · $${Housing.BUILD}`):`${h.mode!=='home'?action('home'):''}${h.mode!=='rent'?action('rent'):''}${due?action('collect',`COLLECT $${due}`):''}${h.level===1?action('renovate',`RENOVATE · $${Housing.RENOVATE}`):''}${action('demolish')}`):''}</div>
        <p class="note">Demolition removes only this house; the plot stays yours. Rebuild on the same land. Construction is 20 s; renovation is 15 s.</p>`,bind:el=>{
          A.picture(el.querySelector('[data-house-photo]'),b);document.getElementById('houseView').onclick=()=>A.visit(b);
          el.querySelectorAll('[data-ha]').forEach(btn=>btn.onclick=()=>A.open('homequote',{id:p.id,action:btn.dataset.ha,revision:h?h.revision:0},true));
        }};
    };
    A.panels.homequote=o=>{
      const p=Housing.PLOTS.find(p=>p.id===o.id),h=A.homes()[o.id];let q,error='';
      try{q=o.action==='buy'?{cost:p.price,income:0,salvage:0}:Housing.quote(h,o.action,Date.now());if(o.action==='buy'&&h)throw Error('Someone already owns this plot.');if(A.state.cash<q.cost)throw Error('Not enough cash.');}catch(e){error=e.message;}
      return {title:names[o.action],html:`<b class="big">${p.name}</b>${error?`<p class="note why">${A.esc(error)}</p>`:`<dl class="kv"><dt>Pay now</dt><dd>$${q.cost}</dd><dt>Rent collected</dt><dd>$${q.income}</dd><dt>Salvage returned</dt><dd>$${q.salvage}</dd><dt>Cash after</dt><dd>$${A.state.cash-q.cost+q.income+q.salvage}</dd></dl>`}
        ${o.action==='demolish'?'<p class="note why">The house and its renovation are removed. Your land stays yours. You return to the starter flat if this is your home. Demolition costs $75 and returns $100 of materials.</p>':''}
        ${o.action==='renovate'?'<p class="note">Construction pauses use and rent. Afterwards choose Home or an NPC tenant again. Net rent rises to $18 per 10 minutes.</p>':''}
        <div class="acts sticky"><button class="btn ghost" id="houseCancel">CANCEL</button><button class="btn go" id="houseConfirm" ${error||busy?'disabled':''}>CONFIRM ${names[o.action].toUpperCase()}</button></div>`,bind:()=>{
          document.getElementById('houseCancel').onclick=()=>A.open('housing',o.id);
          document.getElementById('houseConfirm').onclick=()=>act(o);
        }};
    };
  }
  async function act(o){
    if(busy)return;busy=true;document.getElementById('houseConfirm').disabled=true;
    try{
      if(A.net.online) A.apply(await A.net.call('ci_home_action',{p_id:A.uuid(),p_lot:o.id,p_action:o.action,p_revision:o.revision}));
      else{
        const homes=A.homes(),h=homes[o.id];if((h?h.revision:0)!==o.revision)throw Error('This property changed. Review it again.');
        if(o.action==='buy'){
          if(h)throw Error('Already owned.');const p=Housing.PLOTS.find(p=>p.id===o.id);if(A.state.cash<p.price)throw Error('Not enough cash.');
          A.cash(-p.price,'Bought land: '+p.name);homes[o.id]=Housing.empty(Date.now());
        }else{
          const q=Housing.quote(h,o.action,Date.now());if(A.state.cash<q.cost)throw Error('Not enough cash.');
          A.cash(q.income+q.salvage-q.cost,names[o.action]+': '+o.id);homes[o.id]=q.home;
        }
        A.save();
      }
      A.toast(names[o.action]+' confirmed','Your plot ownership is retained.');
    }catch(e){A.toast('Not completed',e.message,true);}
    finally{busy=false;HousingView.update(A.homes());A.open('housing',o.id);}
  }
  return {install,sync};
})();
