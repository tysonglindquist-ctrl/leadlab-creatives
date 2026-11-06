(function(){
  const A = window.ANALYTICS_DATA || {ads:[], labels:{}, full_account:{}, regions:[], placements:[], age_gender:[], monthly:[], notes:{}};
  const MEDIA_BASE = (window.MEDIA_BASE != null && window.MEDIA_BASE !== '')
    ? String(window.MEDIA_BASE).replace(/\/$/,'')
    : ((window.BOARD_DATA||{}).media_base || './media').replace(/\/$/,'');

  const state = {
    category: 'all', // all | final_expense | mortgage_protection | iul | trucker
    avatar: 'all',
    angle: 'all',
    minSpend: 500,
    scope: 'swipe', // swipe | full
    regionMin: 1000,
    regionSort: 'cpl',
    regionMode: 'winners', // winners | bleeders
    breakdownView: 'avatar', // avatar | angle | duration
  };

  const $ = (id)=> document.getElementById(id);
  const money = (n)=>{
    n=Number(n||0);
    if(n>=1000000) return '$'+(n/1e6).toFixed(2).replace(/\.00$/,'')+'M';
    if(n>=1000) return '$'+(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'')+'k';
    return '$'+Math.round(n).toLocaleString();
  };
  const moneyExact = (n)=> '$'+Math.round(Number(n||0)).toLocaleString();
  const cplStr = (n)=> n==null || !isFinite(n) ? 'n/a' : '$'+Number(n).toFixed(2);
  const pct = (n)=> (n==null || !isFinite(n)) ? 'n/a' : (n*100).toFixed(0)+'%';
  const pct1 = (n)=> (n==null || !isFinite(n)) ? 'n/a' : (n*100).toFixed(1)+'%';
  const esc = (s)=> String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const mediaUrl = (rel)=> !rel ? '' : (rel.startsWith('http')? rel : MEDIA_BASE+'/'+String(rel).replace(/^\.?\/?media\//,'').replace(/^\//,''));

  function median(nums){
    const a=nums.filter(x=>x!=null && isFinite(x)).sort((x,y)=>x-y);
    if(!a.length) return null;
    const m=Math.floor(a.length/2);
    return a.length%2 ? a[m] : (a[m-1]+a[m])/2;
  }
  function wCpl(spend, leads){ return leads>0 ? spend/leads : null; }

  function filteredAds(){
    return (A.ads||[]).filter(a=>{
      if(state.category==='trucker'){ if(!a.trucker) return false; }
      else if(state.category!=='all' && a.account!==state.category) return false;
      if(state.avatar!=='all' && a.avatar!==state.avatar) return false;
      if(state.angle!=='all' && a.msg_angle!==state.angle) return false;
      if(a.spend < state.minSpend) return false;
      return true;
    });
  }

  function catLabel(){
    return ({
      all:'All Categories', final_expense:'Final Expense', mortgage_protection:'Mortgage Protection',
      iul:'IUL', trucker:'Trucker / CDL (IUL Niche)'
    })[state.category] || state.category;
  }

  function parseURL(){
    const p=new URLSearchParams(location.search);
    if(p.get('category') || p.get('cat')) state.category=p.get('category') || p.get('cat');
    if(p.get('avatar')) state.avatar=p.get('avatar');
    if(p.get('angle')) state.angle=p.get('angle');
    if(p.get('minSpend')!=null && p.get('minSpend')!=='') state.minSpend=Number(p.get('minSpend'));
    if(p.get('scope')) state.scope=p.get('scope');
    if(p.get('regionMin')) state.regionMin=Number(p.get('regionMin'));
    if(p.get('regionSort')) state.regionSort=p.get('regionSort');
    if(p.get('regionMode')) state.regionMode=p.get('regionMode');
    if(p.get('breakdown')) state.breakdownView=p.get('breakdown');
  }
  function writeURL(){
    const p=new URLSearchParams(location.search);
    const tab=p.get('tab')||'board';
    // preserve tab
    const next=new URLSearchParams();
    next.set('tab', tab);
    if(tab==='analytics'){
      if(state.category!=='all'){ next.set('category', state.category); next.set('cat', state.category); }
      if(state.avatar!=='all') next.set('avatar', state.avatar);
      if(state.angle!=='all') next.set('angle', state.angle);
      if(state.minSpend!==500) next.set('minSpend', String(state.minSpend));
      if(state.scope!=='swipe') next.set('scope', state.scope);
      if(state.regionMin!==1000) next.set('regionMin', String(state.regionMin));
      if(state.regionSort!=='cpl') next.set('regionSort', state.regionSort);
      if(state.regionMode!=='winners') next.set('regionMode', state.regionMode);
      if(state.breakdownView!=='avatar') next.set('breakdown', state.breakdownView);
    } else {
      // board params left to board script via its own write; merge board keys already in URL if present
      for(const k of ['account','tier','format','style','state','q','trucker','playable','sort']){
        if(p.get(k)!=null) next.set(k, p.get(k));
      }
      if(p.get('minSpend') && tab==='board') next.set('minSpend', p.get('minSpend'));
    }
    const qs=next.toString();
    history.replaceState(null,'', qs? ('?'+qs) : location.pathname);
  }

  function formatHeadToHead(ads){
    const groups={video:[], static:[]};
    ads.forEach(a=>{
      const k = (a.format==='video' || a.media_kind==='video' || a.media_kind==='page_locked') ? 'video' : 'static';
      // page_locked counts as video creative type
      if(a.format==='carousel') return;
      groups[k].push(a);
    });
    function stats(list){
      const spend=list.reduce((s,a)=>s+a.spend,0);
      const leads=list.reduce((s,a)=>s+a.leads,0);
      const impressions=list.reduce((s,a)=>s+(a.impressions||0),0);
      const clicks=list.reduce((s,a)=>s+(a.clicks||0),0);
      const tops=list.filter(a=>a.tier==='top').length;
      const cpls=list.map(a=>a.cpl).filter(x=>x!=null);
      const winSpend=list.filter(a=>a.tier==='top').reduce((s,a)=>s+a.spend,0);
      const winCount=tops||0;
      return {
        ads:list.length, spend, leads, impressions, clicks,
        cpl:wCpl(spend,leads),
        medianCpl:median(cpls),
        hitRate: list.length? tops/list.length : null,
        ctr: impressions? 100*clicks/impressions : null,
        cpc: clicks? spend/clicks : null,
        cpm: impressions? 1000*spend/impressions : null,
        scaleEff: winCount? winSpend/winCount : null,
        tops,
        top3: list.slice().sort((a,b)=>(a.cpl??9999)-(b.cpl??9999) || b.spend-a.spend).filter(a=>a.leads>0).slice(0,3),
      };
    }
    return {video:stats(groups.video), static:stats(groups.static), totalSpend: groups.video.concat(groups.static).reduce((s,a)=>s+a.spend,0)};
  }

  function groupBy(ads, keyFn){
    const bag={};
    ads.forEach(a=>{
      const k=keyFn(a); if(!k) return;
      (bag[k]=bag[k]||[]).push(a);
    });
    return Object.entries(bag).map(([key,list])=>{
      const spend=list.reduce((s,a)=>s+a.spend,0);
      const leads=list.reduce((s,a)=>s+a.leads,0);
      const impressions=list.reduce((s,a)=>s+(a.impressions||0),0);
      const clicks=list.reduce((s,a)=>s+(a.clicks||0),0);
      const tops=list.filter(a=>a.tier==='top').length;
      return {
        key, list, ads:list.length, spend, leads,
        cpl:wCpl(spend,leads),
        hitRate: list.length? tops/list.length : null,
        ctr: impressions? 100*clicks/impressions : null,
        tops,
        top3: list.slice().sort((a,b)=>(a.cpl??9999)-(b.cpl??9999)).slice(0,3),
      };
    }).sort((a,b)=> (a.cpl??9999)-(b.cpl??9999) || b.spend-a.spend);
  }

  function executiveBullets(ads, hh){
    const cat=catLabel();
    const bullets=[];
    const v=hh.video, s=hh.static;
    if(v.ads && s.ads && v.cpl!=null && s.cpl!=null){
      const cheaper = s.cpl < v.cpl ? 'Static' : 'Video';
      const win= cheaper==='Static'? s:v; const lose=cheaper==='Static'? v:s;
      const diff = lose.cpl>0 ? ((lose.cpl-win.cpl)/lose.cpl) : 0;
      const spendShareV = hh.totalSpend? v.spend/hh.totalSpend : 0;
      bullets.push(`In ${cat}, Video drives ${pct1(spendShareV)} of swipe-set spend at ${cplStr(v.cpl)} CPL vs Static at ${cplStr(s.cpl)} CPL (${cheaper} is ${pct1(diff)} cheaper CPL · Static hit rate ${pct(s.hitRate)} · Video hit rate ${pct(v.hitRate)}).`);
    } else if(v.ads){
      bullets.push(`In ${cat}, Video is the primary format in this filter (${v.ads} ads, ${money(v.spend)} spend, ${cplStr(v.cpl)} weighted CPL, hit rate ${pct(v.hitRate)}).`);
    } else if(s.ads){
      bullets.push(`In ${cat}, Static dominates this filter (${s.ads} ads, ${money(s.spend)} spend, ${cplStr(s.cpl)} weighted CPL).`);
    }
    // top avatar
    const byAv=groupBy(ads, a=>a.avatar_label);
    if(byAv.length){
      const best=byAv.filter(x=>x.spend>=Math.min(500, state.minSpend) && x.leads>=5).sort((a,b)=>(a.cpl??999)-(b.cpl??999))[0] || byAv[0];
      const star=best.top3[0];
      bullets.push(`Top avatar / style: ${best.key} (${cplStr(best.cpl)} CPL on ${best.ads} ads${star? `, best unit ${star.name} at ${cplStr(star.cpl)}`:''}).`);
    }
    // top states from callouts
    const bySt={};
    ads.forEach(a=> (a.states||[]).forEach(st=>{
      const b=bySt[st]||(bySt[st]={spend:0,leads:0});
      b.spend+=a.spend; b.leads+=a.leads;
    }));
    const stRows=Object.entries(bySt).map(([region,v])=>({region, ...v, cpl:wCpl(v.spend,v.leads)}))
      .filter(r=>r.spend>=1000 && r.leads>=10)
      .sort((a,b)=>(a.cpl??999)-(b.cpl??999));
    if(stRows.length){
      bullets.push(`Top states by efficiency ($1k+ spend on state-callout creatives): ${stRows.slice(0,3).map(r=>r.region).join(', ')}.`);
    } else {
      // fallback delivery spend leaders for category
      const regs=regionRows().filter(r=>r.spend>=state.regionMin).sort((a,b)=>b.spend-a.spend).slice(0,3);
      if(regs.length) bullets.push(`Highest Meta delivery spend states in this category: ${regs.map(r=>r.region).join(', ')} (lead reporting in region breakdowns is sparse, so treat as delivery share).`);
    }
    if(!bullets.length) bullets.push(`Not enough spend in this filter yet. Lower the min spend threshold or clear an avatar / angle filter.`);
    return bullets.slice(0,3);
  }

  function accountKeyForBreakdown(){
    if(state.category==='trucker' || state.category==='iul') return 'iul';
    if(state.category==='all') return null;
    return state.category;
  }

  function regionRows(){
    const acct=accountKeyForBreakdown();
    const rows=(A.regions||[]).filter(r=>!acct || r.account===acct);
    // if all categories, aggregate by region
    if(!acct){
      const bag={};
      rows.forEach(r=>{
        const b=bag[r.region]||(bag[r.region]={region:r.region,spend:0,impressions:0,clicks:0,leads:0});
        b.spend+=r.spend; b.impressions+=r.impressions; b.clicks+=r.clicks; b.leads+=r.leads;
      });
      return Object.values(bag).map(b=>({
        ...b,
        ctr: b.impressions? 100*b.clicks/b.impressions:null,
        cpm: b.impressions? 1000*b.spend/b.impressions:null,
        cpl: wCpl(b.spend,b.leads),
      }));
    }
    return rows.map(r=>({...r, cpl:r.cpl ?? wCpl(r.spend,r.leads)}));
  }

  function thumbStack(list){
    return `<div class="thumbs">${(list||[]).slice(0,3).map(a=>{
      const src=mediaUrl(a.thumb||a.poster||a.image);
      return `<button type="button" class="thumb" data-ad="${esc(a.id)}" title="${esc(a.name)}">${src?`<img src="${src}" alt="" loading="lazy">`:'<span class="ph"></span>'}</button>`;
    }).join('')}</div>`;
  }

  function metricCard(label, value, sub){
    return `<div class="mcard"><div class="ml">${esc(label)}</div><div class="mv">${value}</div>${sub?`<div class="ms">${sub}</div>`:''}</div>`;
  }

  function renderFilters(){
    const cats=[
      ['all','All'],
      ['final_expense','Final Expense'],
      ['mortgage_protection','Mortgage Protection'],
      ['iul','IUL'],
      ['trucker','Trucker · CDL'],
    ];
    const catBar=$('anCatBar');
    if(catBar){
      catBar.innerHTML = cats.map(([k,l])=>{
        const on=state.category===k?' on':'';
        const tag=k==='trucker'?'<span class="tag">IUL</span>':'';
        return `<button type="button" class="segchip${on}" data-k="category" data-v="${k}">${l}${tag}</button>`;
      }).join('');
    }

    const activeCat=catBar && catBar.querySelector('.segchip.on');
    if(activeCat && activeCat.scrollIntoView){ try{ activeCat.scrollIntoView({inline:'center', block:'nearest', behavior:'instant'}); }catch(e){} }

    // Avatar select with live counts against category+spend (ignore avatar/angle to show available options)
    const base=(A.ads||[]).filter(a=>{
      if(state.category==='trucker'){ if(!a.trucker) return false; }
      else if(state.category!=='all' && a.account!==state.category) return false;
      if(a.spend < state.minSpend) return false;
      return true;
    });
    const avatarCounts={};
    const angleCounts={};
    base.forEach(a=>{ avatarCounts[a.avatar]=(avatarCounts[a.avatar]||0)+1; angleCounts[a.msg_angle]=(angleCounts[a.msg_angle]||0)+1; });

    const avSel=$('anAvatarSel');
    if(avSel){
      const opts=[['all','All Formats & Avatars']].concat(
        Object.entries(A.labels.avatar||{}).map(([k,l])=>[k, `${l} (${avatarCounts[k]||0})`])
      );
      avSel.innerHTML = opts.map(([k,l])=>`<option value="${k}" ${state.avatar===k?'selected':''}>${esc(l)}</option>`).join('');
    }
    const anSel=$('anAngleSel');
    if(anSel){
      const opts=[['all','All Angles']].concat(
        Object.entries(A.labels.angle||{}).map(([k,l])=>[k, `${l} (${angleCounts[k]||0})`])
      );
      anSel.innerHTML = opts.map(([k,l])=>`<option value="${k}" ${state.angle===k?'selected':''}>${esc(l)}</option>`).join('');
    }

    if($('anMinSpend')) $('anMinSpend').value=String(state.minSpend);
    if($('anScope')) $('anScope').value=state.scope;
    const dirty = state.category!=='all' || state.avatar!=='all' || state.angle!=='all' || state.minSpend!==500 || state.scope!=='swipe';
    if($('anReset')) $('anReset').hidden = !dirty;
    const spendLabel = state.minSpend>0 ? ('$'+Number(state.minSpend).toLocaleString()+'+') : 'All spend';
    const scopeLabel = state.scope==='full' ? 'Full account' : 'Swipe set';
    if($('anScopeBtn')) $('anScopeBtn').textContent = `Scope: ${spendLabel} · ${scopeLabel} ▾`;

    // legacy empty mounts (no-op)
    if($('anCat')) $('anCat').innerHTML='';
    if($('anAvatar')) $('anAvatar').innerHTML='';
    if($('anAngle')) $('anAngle').innerHTML='';
  }

  function render(){
    writeURL();
    renderFilters();
    const ads=filteredAds();
    const hh=formatHeadToHead(ads);
    const bullets=executiveBullets(ads, hh);
    const totalSpend=ads.reduce((s,a)=>s+a.spend,0);
    const totalLeads=ads.reduce((s,a)=>s+a.leads,0);
    const wcpl=wCpl(totalSpend,totalLeads);

    const tops=ads.filter(a=>a.tier==='top').length;
    const hit=ads.length? tops/ads.length : 0;
    $('anKpis').innerHTML = `
      <div class="m"><div class="ml">Spend</div><div class="mv">${money(totalSpend)}</div><div class="ms">${ads.length} creatives</div></div>
      <div class="m"><div class="ml">Leads</div><div class="mv">${totalLeads.toLocaleString()}</div></div>
      <div class="m"><div class="ml">Avg CPL</div><div class="mv accent">${cplStr(wcpl)}</div></div>
      <div class="m"><div class="ml">Winners</div><div class="mv">${tops} / ${ads.length}</div><div class="ms">${Math.round(hit*100)}% hit rate</div></div>`;

    $('anTakeaway').innerHTML = `<div class="take-title">Executive readout · ${esc(catLabel())}${state.avatar!=='all'?' · '+esc((A.labels.avatar||{})[state.avatar]||state.avatar):''}</div>
      <ul>${bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
      <div class="take-note">${esc(A.notes?.swipe_set||'')} ${state.scope==='full' ? esc(A.notes?.full_account||'') : ''}</div>`;

    // Format H2H
    const winner = (hh.video.cpl!=null && hh.static.cpl!=null)
      ? (hh.static.cpl < hh.video.cpl ? 'static' : 'video') : (hh.video.ads? 'video':'static');
    const winPct = (hh.video.cpl!=null && hh.static.cpl!=null && Math.max(hh.video.cpl,hh.static.cpl)>0)
      ? Math.abs(hh.video.cpl-hh.static.cpl)/Math.max(hh.video.cpl,hh.static.cpl) : null;

    function fmtCol(key, st){
      const shareSpend = hh.totalSpend? st.spend/hh.totalSpend : 0;
      const shareLeads = (hh.video.leads+hh.static.leads)>0 ? st.leads/(hh.video.leads+hh.static.leads) : 0;
      const isWin = winner===key;
      return `<div class="fmtcol ${isWin?'win':''}">
        <div class="fmthead"><span class="pill ${key==='video'?'p-vid':'p-stat'}">${key==='video'?'Video':'Static'}</span>
          ${isWin && winPct!=null ? `<span class="winbadge">Wins CPL by ${pct1(winPct)}</span>`:''}
        </div>
        <div class="fmtgrid">
          ${metricCard('Spend', money(st.spend), pct1(shareSpend)+' of filter')}
          ${metricCard('Leads', st.leads.toLocaleString(), pct1(shareLeads)+' of filter')}
          ${metricCard('Weighted CPL', cplStr(st.cpl), st.ads+' ads')}
          ${metricCard('Median CPL', cplStr(st.medianCpl), 'outlier-resistant')}
          ${metricCard('Hit rate', pct(st.hitRate), st.tops+' Top Performers')}
          ${metricCard('CTR', st.ctr!=null? st.ctr.toFixed(2)+'%':'n/a', st.cpc!=null?('CPC '+cplStr(st.cpc)):'')}
          ${metricCard('CPM', st.cpm!=null? cplStr(st.cpm):'n/a', '')}
          ${metricCard('Scale efficiency', st.scaleEff!=null? money(st.scaleEff):'n/a', 'avg spend / winning creative')}
        </div>
        <div class="fmtthumbs"><div class="ml">Top 3 winning ${key==='video'?'videos':'statics'}</div>${thumbStack(st.top3)}</div>
      </div>`;
    }
    $('anFormat').innerHTML = fmtCol('video', hh.video)+fmtCol('static', hh.static);

    // Full account comparison strip when scope=full
    if(state.scope==='full'){
      const fa=(A.full_account||{}).by_format||[];
      const fv=fa.find(x=>x.key==='video')||{};
      const fs=fa.find(x=>x.key==='static')||{};
      $('anFullStrip').style.display='block';
      $('anFullStrip').innerHTML = `<b>Full account history snapshot</b> (lifetime Meta export, not limited to the 681 swipe creatives):
        Video ${money(fv.spend)} · ${Number(fv.leads||0).toLocaleString()} leads · ${cplStr(fv.cpl)} CPL ·
        Static ${money(fs.spend)} · ${Number(fs.leads||0).toLocaleString()} leads · ${cplStr(fs.cpl)} CPL.
        ${(A.full_account||{}).trucker_niche ? `Trucker / CDL niche across IUL history: ${money(A.full_account.trucker_niche.spend)} · ${A.full_account.trucker_niche.leads} leads · ${cplStr(A.full_account.trucker_niche.cpl)} CPL.` : ''}`;
    } else {
      $('anFullStrip').style.display='none';
    }

    // Breakdown tables
    renderBreakdown(ads, totalSpend, wcpl);

    // States
    renderStates(ads);

    // Placement / age / monthly / winners
    renderSnapshots(ads);
    renderWinners(ads);
  }

  function renderBreakdown(ads, totalSpend, catCpl){
    const view=state.breakdownView;
    $('anBreakTabs').querySelectorAll('.chip').forEach(b=> b.classList.toggle('on', b.dataset.v===view));
    let rows=[];
    if(view==='avatar') rows=groupBy(ads, a=>a.avatar).map(r=>({...r, label:(A.labels.avatar||{})[r.key]||r.key}));
    else if(view==='angle') rows=groupBy(ads, a=>a.msg_angle).map(r=>({...r, label:(A.labels.angle||{})[r.key]||r.key}));
    else rows=groupBy(ads.filter(a=>a.duration_bucket), a=>a.duration_bucket).map(r=>({...r, label:(A.labels.duration||{})[r.key]||r.key}));

    const maxSpend=Math.max(1, ...rows.map(r=>r.spend));
    $('anBreakBody').innerHTML = rows.map(r=>{
      const cplCls = (catCpl && r.cpl!=null) ? (r.cpl<=catCpl*0.9?'good': r.cpl<=catCpl*1.15?'mid':'bad') : '';
      const boardFilter = view==='avatar' ? `avatar=${r.key}` : view==='angle' ? `angle=${r.key}` : `duration=${r.key}`;
      return `<tr>
        <td class="l">${thumbStack(r.top3)}<div class="bname">${esc(r.label)}</div></td>
        <td>${r.ads}</td>
        <td>${pct(r.hitRate)}</td>
        <td class="l"><div class="barwrap"><div class="bar" style="width:${(100*r.spend/maxSpend).toFixed(1)}%"></div><span>${money(r.spend)}</span></div></td>
        <td>${r.leads.toLocaleString()}</td>
        <td class="${cplCls}"><b>${cplStr(r.cpl)}</b></td>
        <td>${r.ctr!=null? r.ctr.toFixed(2)+'%':'n/a'}</td>
        <td><button type="button" class="linkish" data-jump="${esc(boardFilter)}" data-label="${esc(r.label)}">View ads</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="8" class="empty">No rows for this breakdown.</td></tr>`;
  }

  function renderStates(ads){
    // A) Meta delivery
    let regs=regionRows().filter(r=>r.spend>=state.regionMin);
    if(state.regionSort==='cpl'){
      // prefer rows with leads; else by CPM/CTR efficiency proxy
      regs=regs.slice().sort((a,b)=>{
        const ac=a.leads>0? a.cpl : 999999;
        const bc=b.leads>0? b.cpl : 999999;
        if(ac!==bc) return ac-bc;
        return (a.cpm??999)-(b.cpm??999);
      });
    } else if(state.regionSort==='leads'){
      regs=regs.slice().sort((a,b)=> b.leads-a.leads || b.spend-a.spend);
    } else {
      regs=regs.slice().sort((a,b)=> b.spend-a.spend);
    }
    if(state.regionMode==='bleeders'){
      regs=regs.slice().sort((a,b)=> (b.cpl??0)-(a.cpl??0) || b.spend-a.spend);
    }
    const show=regs.slice(0,15);
    $('anMetaStates').innerHTML = show.map((r,i)=>`<tr>
      <td>${i+1}</td><td class="l">${esc(r.region)}</td>
      <td>${money(r.spend)}</td>
      <td>${Number(r.leads||0).toLocaleString()}</td>
      <td>${r.leads>0? cplStr(r.cpl): '<span class="mut">sparse</span>'}</td>
      <td>${r.ctr!=null? Number(r.ctr).toFixed(2)+'%':'n/a'}</td>
      <td>${r.cpm!=null? cplStr(r.cpm):'n/a'}</td>
    </tr>`).join('') || `<tr><td colspan="7" class="empty">No states above min spend.</td></tr>`;
    $('anRegionNote').textContent = A.notes?.region_note || '';

    // B) State-callout creatives
    const bag={};
    ads.forEach(a=> (a.states||[]).forEach(st=>{
      const b=bag[st]||(bag[st]={region:st,spend:0,leads:0,ads:0,list:[]});
      b.spend+=a.spend; b.leads+=a.leads; b.ads+=1; b.list.push(a);
    }));
    let callouts=Object.values(bag).map(b=>({...b, cpl:wCpl(b.spend,b.leads), top3:b.list.slice().sort((a,c)=>(a.cpl??999)-(c.cpl??999)).slice(0,3)}))
      .filter(b=>b.spend>=Math.max(250, state.minSpend/2));
    callouts.sort((a,b)=> (a.cpl??999)-(b.cpl??999) || b.leads-a.leads);
    $('anCalloutStates').innerHTML = callouts.slice(0,15).map((r,i)=>`<tr>
      <td>${i+1}</td>
      <td class="l">${thumbStack(r.top3)}<div class="bname">${esc(r.region)}</div></td>
      <td>${r.ads}</td>
      <td>${money(r.spend)}</td>
      <td>${r.leads.toLocaleString()}</td>
      <td><b>${cplStr(r.cpl)}</b></td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty">No state-callout creatives in this filter.</td></tr>`;
  }

  function renderSnapshots(ads){
    const acct=accountKeyForBreakdown();
    // Placement rollup
    let places=(A.placements||[]).filter(p=>!acct || p.account===acct);
    const pbag={};
    places.forEach(p=>{
      const label = `${p.platform||'?'} / ${p.position||'?'}`.replace(/_/g,' ');
      const b=pbag[label]||(pbag[label]={label,spend:0,leads:0,impressions:0,clicks:0});
      b.spend+=p.spend; b.leads+=p.leads; b.impressions+=p.impressions; b.clicks+=p.clicks;
    });
    const prows=Object.values(pbag).map(b=>({...b, cpl:wCpl(b.spend,b.leads), ctr:b.impressions?100*b.clicks/b.impressions:null}))
      .sort((a,b)=>b.spend-a.spend).slice(0,8);
    const pmax=Math.max(1,...prows.map(p=>p.spend));
    $('anPlacement').innerHTML = prows.map(p=>`<div class="snaprow">
      <div class="snapl">${esc(p.label)}</div>
      <div class="barwrap"><div class="bar" style="width:${(100*p.spend/pmax).toFixed(1)}%"></div></div>
      <div class="snapr">${money(p.spend)} · ${cplStr(p.cpl)} CPL · ${p.ctr!=null?p.ctr.toFixed(2)+'% CTR':'n/a'}</div>
    </div>`).join('') || `<div class="empty">No placement rows.</div>`;

    // Age/gender
    let ag=(A.age_gender||[]).filter(p=>!acct || p.account===acct);
    ag=ag.slice().sort((a,b)=> (a.cpl??9999)-(b.cpl??9999)).filter(x=>x.spend>=500 && x.leads>=5).slice(0,8);
    if(!ag.length){
      ag=(A.age_gender||[]).filter(p=>!acct || p.account===acct).slice().sort((a,b)=>b.spend-a.spend).slice(0,8);
    }
    $('anAgeGender').innerHTML = ag.map(p=>`<div class="snaprow">
      <div class="snapl">${esc(p.age)} · ${esc(p.gender)}</div>
      <div class="snapr">${money(p.spend)} · ${Number(p.leads||0)} leads · <b>${p.leads?cplStr(p.cpl):'n/a'}</b></div>
    </div>`).join('') || `<div class="empty">No age / gender rows.</div>`;

    // Monthly trend (last 12)
    let months=(A.monthly||[]).filter(p=>!acct || p.account===acct);
    if(!acct){
      const bag={};
      months.forEach(m=>{
        const k=(m.date_start||'').slice(0,7);
        const b=bag[k]||(bag[k]={key:k,spend:0,leads:0});
        b.spend+=m.spend; b.leads+=m.leads;
      });
      months=Object.values(bag).map(b=>({date_start:b.key, spend:b.spend, leads:b.leads, cpl:wCpl(b.spend,b.leads)}));
    }
    months=months.slice().sort((a,b)=> String(a.date_start).localeCompare(String(b.date_start))).slice(-12);
    const mmax=Math.max(1,...months.map(m=>m.spend));
    $('anMonthly').innerHTML = months.map(m=>`<div class="monthcol" title="${esc(m.date_start)}">
      <div class="mbar" style="height:${Math.max(4,(70*m.spend/mmax)).toFixed(0)}px"></div>
      <div class="mlbl">${esc(String(m.date_start).slice(2,7))}</div>
      <div class="msub">${cplStr(m.cpl)}</div>
    </div>`).join('') || `<div class="empty">No monthly rows.</div>`;
  }

  function renderWinners(ads){
    const winners=ads.slice().filter(a=>a.leads>0).sort((a,b)=>(a.cpl??999)-(b.cpl??999) || b.spend-a.spend).slice(0,10);
    $('anWinners').innerHTML = winners.map((a,i)=>`<tr>
      <td>${i+1}</td>
      <td class="l">
        <button type="button" class="winthumb" data-ad="${esc(a.id)}">${mediaUrl(a.thumb||a.poster||a.image)?`<img src="${mediaUrl(a.thumb||a.poster||a.image)}" alt="" loading="lazy">`:'<span class="ph"></span>'}</button>
        <div class="bname">${esc(a.name)}</div>
        <div class="mut">${esc(a.account_label)} · ${esc(a.avatar_label)}</div>
      </td>
      <td><span class="pill ${a.format==='video'?'p-vid':'p-stat'}">${esc(a.format)}</span></td>
      <td class="l">${esc(a.msg_angle_label)}</td>
      <td>${money(a.spend)}</td>
      <td>${a.leads}</td>
      <td><b>${cplStr(a.cpl)}</b></td>
      <td>${a.ctr!=null? Number(a.ctr).toFixed(2)+'%':'n/a'}</td>
      <td><button type="button" class="linkish" data-ad="${esc(a.id)}">Details</button></td>
    </tr>`).join('') || `<tr><td colspan="9" class="empty">No winners in this filter.</td></tr>`;
  }

  function openAd(id){
    // Prefer existing board drawer if present
    const boardAd = (window.BOARD_DATA&&window.BOARD_DATA.ads||[]).find(a=>a.id===id);
    const a = (A.ads||[]).find(x=>x.id===id) || boardAd;
    if(!a) return;
    if(typeof window.openBoardDetails==='function' && boardAd){
      window.openBoardDetails(id);
      return;
    }
    // local modal fallback using board overlay if available
    const ov=$('ov'); const title=$('dTitle'); const body=$('dBody');
    if(!ov||!title||!body){ return; }
    title.textContent=a.name||id;
    const vid=mediaUrl(a.video), img=mediaUrl(a.image||a.poster||a.thumb);
    let media='';
    if(a.media_kind==='video' && vid){
      media=`<video controls playsinline autoplay preload="metadata" poster="${mediaUrl(a.poster||a.thumb)||''}" src="${vid}"></video>`;
    } else if(img){
      media=`<img src="${img}" alt="">`;
    } else media=`<div style="color:#94a3b8;padding:40px">No media</div>`;
    body.innerHTML=`<div class="dgrid"><div class="dmedia">${media}</div><div class="dmeta">
      <div class="row2">
        <div class="stat"><div class="l">Spend</div><div class="v">${moneyExact(a.spend)}</div></div>
        <div class="stat"><div class="l">Leads</div><div class="v">${a.leads}</div></div>
        <div class="stat"><div class="l">CPL</div><div class="v">${cplStr(a.cpl)}</div></div>
        <div class="stat"><div class="l">CTR</div><div class="v" style="font-size:15px">${a.ctr!=null?Number(a.ctr).toFixed(2)+'%':'n/a'}</div></div>
      </div>
      <div class="kv">
        <div>Account</div><div>${esc(a.account_label||a.account)}</div>
        <div>Avatar</div><div>${esc(a.avatar_label||'')}</div>
        <div>Angle</div><div>${esc(a.msg_angle_label||'')}</div>
        <div>Campaign</div><div>${esc(a.campaign||'')}</div>
        <div>Ad ID</div><div><code>${esc(a.id)}</code></div>
      </div>
      ${a.primary? `<div class="copybox"><h4>Primary text</h4><p>${esc(a.primary)}</p></div>`:''}
      <div class="dbtns">
        <button type="button" id="anToBoard">Open in Swipe Board</button>
        ${a.drive_link? `<a class="sec" href="${a.drive_link}" target="_blank" rel="noopener">Open in Google Drive</a>`:''}
      </div>
    </div></div>`;
    ov.classList.add('on');
    body.querySelector('#anToBoard')?.addEventListener('click', ()=>{
      jumpToBoard(a);
    });
  }

  function jumpToBoard(a){
    const p=new URLSearchParams();
    p.set('tab','board');
    if(a.account) p.set('account', a.account);
    if(a.trucker) p.set('trucker','1');
    p.set('q', a.name || a.id);
    location.search = p.toString();
  }

  function jumpFilter(spec){
    // switch to board with best-effort filters
    const p=new URLSearchParams();
    p.set('tab','board');
    if(state.category==='trucker'){ p.set('account','iul'); p.set('trucker','1'); }
    else if(state.category!=='all') p.set('account', state.category);
    // map avatar/angle to search text
    if(spec.startsWith('avatar=')){
      const key=spec.slice(7);
      const label=(A.labels.avatar||{})[key]||key;
      p.set('q', label.split('/')[0].trim());
    } else if(spec.startsWith('angle=')){
      const key=spec.slice(6);
      p.set('q', (A.labels.angle||{})[key]||key);
    }
    location.search=p.toString();
  }

  function bind(){
    if(bind._wired) return; bind._wired=true;
    $('panelAnalytics').addEventListener('click', (e)=>{
      const cat=e.target.closest('#anCatBar [data-k="category"]');
      if(cat){ state.category=cat.dataset.v; render(); return; }
      const br=e.target.closest('#anBreakTabs .chip');
      if(br){ state.breakdownView=br.dataset.v; render(); return; }
      const adBtn=e.target.closest('[data-ad]');
      if(adBtn){ openAd(adBtn.dataset.ad); return; }
      const jump=e.target.closest('[data-jump]');
      if(jump){ jumpFilter(jump.dataset.jump); return; }
      if(e.target.id==='anScopeBtn'){
        $('anScopePanel')?.classList.toggle('on');
        return;
      }
      if(e.target.id==='anReset'){
        state.category='all'; state.avatar='all'; state.angle='all'; state.minSpend=500; state.scope='swipe';
        $('anScopePanel')?.classList.remove('on');
        render(); return;
      }
    });
    ['anAvatarSel','anAngleSel','anMinSpend','anScope','anRegionMin','anRegionSort','anRegionMode'].forEach(id=>{
      $(id)?.addEventListener('change', ()=>{
        state.avatar=$('anAvatarSel')?.value || 'all';
        state.angle=$('anAngleSel')?.value || 'all';
        state.minSpend=Number($('anMinSpend').value||0);
        state.scope=$('anScope').value;
        state.regionMin=Number($('anRegionMin')?.value||0);
        state.regionSort=$('anRegionSort')?.value || 'cpl';
        state.regionMode=$('anRegionMode')?.value || 'winners';
        render();
      });
    });
  }

  window.renderAnalytics = render;
  window.initAnalytics = function(){
    parseURL();
    bind();
    render();
  };
})();
