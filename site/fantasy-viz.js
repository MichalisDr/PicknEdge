(function(g){
const fmt=n=>Number.isFinite(n)?n.toFixed(1):'—';
const axes=['2PT NET','3PT NET','FT NET','OREB','DREB','AST','STL','BLK','FD'];
const names=['Net PIR from two-pointers','Net PIR from three-pointers','Net PIR from free throws','Offensive rebounds','Defensive rebounds','Assists','Steals','Blocks','Fouls drawn'];
const net=p=>[3*p.M2-p.A2,4*p.M3-p.A3,2*p.M1-p.A1,p.OR,p.DR,p.As,p.St,p.BF,p.FR];
function values(p,basis='game'){return net(p).map((v,i)=>{const d=basis==='game'?p.Gm:([0,1,2,3,5].includes(i)?p.OfPo/100:[4,6,7].includes(i)?p.DePo/100:(p.OfPo+p.DePo)/200);return Number.isFinite(v)&&d>0?v/d:null;});}
function radar(p,cohort,basis='game',label='Net production radar'){
const v=values(p,basis),limits=axes.map(()=>Math.max(1,...cohort.filter(p=>p.Gm>0).flatMap(p=>values(p,basis).map(v=>Math.ceil(v||0))))),pt=(i,f)=>[260+Math.sin(i*2*Math.PI/axes.length)*145*f,205-Math.cos(i*2*Math.PI/axes.length)*145*f],poly=f=>axes.map((_,i)=>pt(i,f).join(',')).join(' ');
return `<svg class="pc-radar-svg" viewBox="0 0 520 420" role="group" aria-label="${label}">${[.25,.5,.75,1].map(f=>`<polygon points="${poly(f)}" fill="none" stroke="#354457"/>`).join('')}${axes.map((_,i)=>`<path d="M260 205L${pt(i,1).join(' ')}" stroke="#354457"/>`).join('')}<polygon points="${v.map((n,i)=>pt(i,Math.max(0,n||0)/limits[i]).join(',')).join(' ')}" fill="#ef3d2527" stroke="#ef3d25" stroke-width="2.5"/>${axes.map((a,i)=>{const [x,y]=pt(i,1.22),gross=i===0?2*p.M2:i===1?3*p.M3:p.M1,miss=i===0?p.A2-p.M2:i===1?p.A3-p.M3:p.A1-p.M1,tip=names[i]+': '+fmt(v[i])+(i<3?' · Sample totals: '+gross+' points − '+miss+' misses = '+net(p)[i]+' net PIR':'')+' · axis max '+limits[i];return `<foreignObject x="${x-43}" y="${y-20}" width="86" height="44"><button xmlns="http://www.w3.org/1999/xhtml" data-axis="${i}" aria-label="${tip}" title="${tip}">${a}<b style="color:${v[i]<0?'#e88b8b':'#ff8a78'}">${fmt(v[i])}</b></button></foreignObject>`}).join('')}</svg><p class="pc-radar-detail" aria-live="polite">Select an axis for its calculation.</p><p class="pc-note">Net contributions: shooting points minus missed attempts. Negative values remain in labels; the shape stops at zero. Selected categories, not total PIR. All axes share the same PIR scale across this cohort, so their lengths show comparable contributions.</p>`;
}
function rank(value,arr,higher=true){const valid=arr.filter(Number.isFinite);if(!Number.isFinite(value)||!valid.length)return null;const rank=1+valid.filter(x=>higher?x>value+1e-9:x<value-1e-9).length;return {rank,n:valid.length,color:rank<=Math.ceil(valid.length/3)?'#7fc6ac':rank>Math.ceil(2*valid.length/3)?'#e7919b':'#b8c6d7'};}
/* Shot chart: zones, lattice, grading and court lines come from shot-zones.js. Hex = fixed lattice, area ∝ attempts of the cell, colour = grade of the cell's zone;
   Shots = every attempt at its own coordinate (filled = made, hollow = missed). */
const SZ=g.ShotZones;let shotView='hex',hl=null,pinned=null;
const pctText=x=>Number.isFinite(x)?x.toFixed(1)+'%':'—',hexPath=(cx,cy,r)=>SZ.hexPts(cx,cy,r).map(([a,b])=>SZ.X(a)+','+SZ.Y(b)).join(' ');
const dec=x=>x.toFixed(1).replace('.',','),pc=x=>Number.isFinite(x)?dec(x)+'%':'—',signed=x=>(x<0?'−':'+')+dec(Math.abs(x)),attr=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const sumIds=(arr,ids)=>ids.reduce((n,i)=>n+(arr?.[i]||0),0);
/* Share of a category in ALL makes of the zone/area; unavailable (null) when any make has no confirmed assist record or there are no makes. */
const share=(k,a,u,uk)=>uk>0||a+u===0?null:100*k/(a+u);
/* FG% change of a zone against the same entity's Season; Season itself shows none. Without attempts in either sample: «—», no arrow. */
function change(cmp,cur,base){
 if(!cmp)return null;
 if(!base||!(cur.att>0)||!(base.att>0))return '—';
 const d=100*cur.made/cur.att-100*base.made/base.att,flat=dec(Math.abs(d))==='0,0';
 return (flat?'':d>0?'↑ ':'↓ ')+(flat?'0,0':signed(d))+' ποσοστιαίες μονάδες έναντι Season';
}
/* Hover/tap card of a zone. Normal view: FG% facts; with Assisted/Unassisted active: only the split of the zone's makes. */
function tipHtml(z,mode,team){
 if(mode==='a'||mode==='u'){
  const tot=z.as+z.un+z.uk,row=(k,l,n)=>`<div class="sz-pop-row${mode===k?' sz-pop-sel':''}"><span>${l}</span><b>${n} / ${tot} · ${pc(share(n,z.as,z.un,z.uk))}</b></div>`;
  return `<strong>${z.n}</strong>${row('a','Assisted',z.as)}${row('u','Unassisted',z.un)}${z.uk?`<small>Ποσοστό μη διαθέσιμο: ${z.uk} από ${tot} εύστοχα χωρίς επιβεβαιωμένη ασίστ (assisted ${z.as}, unassisted ${z.un}).</small>`:''}`;
 }
 const row=(l,v)=>`<div class="sz-pop-row"><span>${l}</span><b>${v}</b></div>`;
 return `<strong>${z.n}</strong>${row('Εύστοχα / προσπάθειες',z.m+' / '+z.a+' · '+pc(z.fg))}${row('League FG%',pc(z.lg))}${row('Διαφορά',(z.gap===null?'—':signed(z.gap)+' pp')+(z.lv?' · '+z.lv:''))}${row('Μερίδιο προσπαθειών',pc(z.sh))}${team?row('Θέση άμυνας',z.rk?'#'+z.rk:'—'):''}${z.d!==null?`<div class="sz-pop-d">${z.d}</div>${team&&z.d!=='—'?'<small>Αύξηση αντίπαλου FG% = χειρότερη άμυνα.</small>':''}`:''}`;
}
function shooting(p,opts={}){
 const team=!!opts.team,events=g.FantasyShots?.eventsOf(p.shotKeys||[]);
 if(!events)return `<p class="fw-empty">Σουτ EuroLeague: οι συντεταγμένες δεν είναι διαθέσιμες για όλο το δείγμα.</p>`;
 const total=p.attempts.reduce((a,b)=>a+b,0),rate=(m,a)=>a>0?100*m/a:null;
 const rateDefs=[['eFG%',rate(p.M2+1.5*p.M3,p.A2+p.A3),'Effective FG percentage'],['2P%',rate(p.M2,p.A2),fmt(p.M2/p.Gm)+' / '+fmt(p.A2/p.Gm)+' M/A per game'],['3P%',rate(p.M3,p.A3),fmt(p.M3/p.Gm)+' / '+fmt(p.A3/p.Gm)+' M/A per game'],['FT%',rate(p.M1,p.A1),fmt(p.M1/p.Gm)+' / '+fmt(p.A1/p.Gm)+' M/A per game']];
 const rates=rateDefs.map(([l,v,t],i)=>{const r=p.rateRanks?.[i];return `<div><span>${l}</span><strong${r?` style="color:${r.color}"`:''}>${pctText(v)}</strong><small>${t}</small>${r?`<b class="metric-rank" style="color:${r.color}">Θέση ${r.rank} / ${r.n}</b>`:''}</div>`}).join('');
 const roll=SZ.rollup(p.made,p.attempts),mdl=opts.model,ranks=team?SZ.teamRanks(p.made,p.attempts,opts.cohort||[]):null,rankText=r=>r?'#'+r.rank+' / '+r.n:'';
 const zone=roll.zones.map(z=>{const gr=SZ.grade(mdl?.[z.i],z.made,z.att);return {...z,gr,rank:ranks?.zones[z.i],color:SZ.levelColor(gr?gr.level:null)};});
 /* Assisted / Unassisted: shares of the makes with a valid assist record (an invalid team-game is never counted as unassisted). */
 const cmp=!!opts.period&&opts.period!=='season',base=cmp&&opts.base?.shotComplete?opts.base:null,hlMode=shotView==='shots'?hl:null;
 const info=zone.map(z=>{const m=mdl?.[z.i],lg=m&&m.p0!==null?100*m.p0:null;return {n:z.name,m:z.made,a:z.att,fg:z.fg,lg,gap:z.gr?z.gr.gap:null,lv:z.gr?SZ.levelName(z.gr.level,team):null,sh:total>0?100*z.att/total:null,rk:z.rank?z.rank.rank+' / '+z.rank.n:null,d:change(cmp,{made:z.made,att:z.att},base&&{made:base.made[z.i],att:base.attempts[z.i]}),as:p.assisted?.[z.i]||0,un:p.unassisted?.[z.i]||0,uk:p.unknown?.[z.i]||0};});
 const unknown=sumIds(p.unknown,info.map((_,i)=>i));
 const variants=(m,fg,a,u)=>`<${m.tag} data-m="fg"${m.cls?` class="${m.cls}"`:''}>${fg}</${m.tag}><${m.tag} data-m="a"${m.cls?` class="${m.cls}"`:''}>${a}</${m.tag}><${m.tag} data-m="u"${m.cls?` class="${m.cls}"`:''}>${u}</${m.tag}>`;
 const areas=['paint','mid','3p'].map(k=>roll.mains.find(m=>m.key===k)).map(m=>{const r=ranks?.mains[roll.mains.indexOf(m)],a=sumIds(p.assisted,m.ids),u=sumIds(p.unassisted,m.ids),k=sumIds(p.unknown,m.ids),tot=a+u+k;return `<div class="sz-area"><span>${m.name}</span>${variants({tag:'strong'},pctText(m.fg),pctText(share(a,a,u,k)),pctText(share(u,a,u,k)))}${variants({tag:'small'},m.made+'/'+m.att,a+'/'+tot,u+'/'+tot)}${r?`<b class="sz-area-rank" data-m="fg" aria-label="Θέση άμυνας ${r.rank} από ${r.n}">${rankText(r)}</b>`:''}</div>`;}).join('');
 const {cells}=SZ.bin(events),dominant=c=>c.zones.reduce((b,n,i)=>n>c.zones[b]?i:b,0);
 const hexSvg=cells.map(c=>`<polygon points="${hexPath(c.x,c.y,c.radius)}" style="fill:${zone[dominant(c)].color}" data-n="${c.n}"/>`).join('');
 const dot=SZ.DOT_R*SZ.SC,at=e=>`cx="${SZ.X(e.x)}" cy="${SZ.Y(e.y)}" r="${dot}"`,shotSvg=events.map(e=>`<circle class="${e.made?'sz-made':'sz-miss'}" ${at(e)}/>`).join(''),
  hlSvg=events.filter(e=>e.made&&e.ast!==null).map(e=>`<circle class="sz-hl" data-m="${e.ast?'a':'u'}" ${at(e)}/>`).join('');
 const labels=zone.map(z=>{const [lx,ly]=SZ.LABELS[z.i],w=32,cx=SZ.X(lx),cy=SZ.Y(ly),i=info[z.i],rect=(m,h,c)=>`<rect data-m="${m}"${c?` class="${c}"`:''} x="${cx-w/2}" y="${cy-7}" width="${w}" height="${h}" rx="3"${m==='fg'?` style="stroke:${z.att?z.color:'#56667a'}"`:''}/>`,text=(m,s)=>`<text data-m="${m}" x="${cx}" y="${cy+3.2}" text-anchor="middle">${s}</text>`;return `<g class="sz-label" data-zone="${z.i}"><title>${z.name}: ${z.made}/${z.att}${z.gr?' · '+SZ.levelName(z.gr.level,team):''}${z.rank?' · θέση άμυνας '+z.rank.rank+'/'+z.rank.n:''}</title>${rect('fg',z.rank?24:14)}${text('fg',z.att?z.fg.toFixed(1)+'%':'—')}${z.rank?`<text data-m="fg" class="sz-zone-rank" x="${cx}" y="${cy+12.5}" text-anchor="middle">${rankText(z.rank)}</text>`:''}${rect('a',14,'sz-au-r')}${text('a',pctText(share(i.as,i.as,i.un,i.uk)))}${rect('u',14,'sz-au-r')}${text('u',pctText(share(i.un,i.as,i.un,i.uk)))}</g>`;}).join('');
 const svg=(view,body)=>`<svg class="pc-court sz-court" data-shotview="${view}" viewBox="0 0 ${SZ.VIEW.w} ${SZ.VIEW.h}" role="img" aria-label="${team?'Opponent':'Player'} shots, ${view==='hex'?'hexagon volume':'individual shots'}"${shotView===view?'':' hidden'}>${SZ.court()}${body}${labels}</svg>`;
 const who=team?' (αντίπαλα καλάθια)':'',mode=(k,l)=>`<p class="sz-mode" data-m="${k}">${l}: ποσοστό επί όλων των εύστοχων κάθε ζώνης και περιοχής${who}${unknown?` · «—» όπου η ασίστ δεν είναι επιβεβαιωμένη (${unknown} εύστοχα)`:''}.</p>`;
 return `<div class="pc-shooting" data-hl="${hlMode||'none'}" data-zones="${attr(JSON.stringify({team,zones:info}))}"><div class="pc-shoot-rates">${rates}</div><div class="sz-head"><div class="sz-switch" role="group" aria-label="Shot chart view">${[['hex','Hex'],['shots','Shots']].map(([k,l])=>`<button type="button" data-shotview-btn="${k}" aria-pressed="${shotView===k}">${l}</button>`).join('')}</div><div class="sz-switch sz-au" role="group" aria-label="Assisted / Unassisted${who}"${shotView==='shots'?'':' hidden'}>${[['a','Assisted'],['u','Unassisted']].map(([k,l])=>`<button type="button" data-hl-btn="${k}" aria-pressed="${hlMode===k}">${l}</button>`).join('')}</div></div>${mode('a','Assisted')}${mode('u','Unassisted')}<div class="sz-areas">${areas}</div>${svg('hex',`<g class="sz-hex">${hexSvg}</g>`)}${svg('shots',`<g class="sz-shots">${shotSvg}</g><g class="sz-hlg">${hlSvg}</g>`)}<div class="sz-pop" role="status" hidden></div><p class="pc-note">${p.shotGames} GP · ${total} FGA${team?' · Θέση άμυνας: #1 = χαμηλότερο αντίπαλο FG%.':''}</p></div>`;
}
if(g.document){
 const doc=g.document,roots=()=>[...doc.querySelectorAll('.pc-shooting')],halfW=750;
 /* Zone under the pointer, from the same classification as the shots (-1 outside the court). */
 function zoneAt(svg,e){const r=svg.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*SZ.VIEW.w,sy=(e.clientY-r.top)/r.height*SZ.VIEW.h,x=(sx-SZ.X(0))/SZ.SC,y=(sy-SZ.Y(0))/SZ.SC;if(!(y>=SZ.BASELINE)||Math.abs(x)>halfW||sy>SZ.VIEW.h)return -1;return SZ.classify(x,y,y<=SZ.CORNER_Y?Math.abs(x)>SZ.CORNER_X:Math.hypot(x,y)>SZ.ARC);}
 function showTip(root,zoneIdx,e){const tip=root.querySelector('.sz-pop'),data=JSON.parse(root.dataset.zones);if(!tip)return;tip.innerHTML=tipHtml(data.zones[zoneIdx],root.dataset.hl,data.team);tip.hidden=false;const rr=root.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,x=e.clientX-rr.left,y=e.clientY-rr.top;tip.style.left=Math.max(4,Math.min(rr.width-w-4,x+12>rr.width-w-4?x-w-12:x+12))+'px';tip.style.top=Math.max(4,Math.min(rr.height-h-4,y-h-14>=4?y-h-14:y+14))+'px';}
 const hideTips=()=>doc.querySelectorAll('.sz-pop').forEach(t=>t.hidden=true);
 function setHl(mode){hl=mode;roots().forEach(r=>{r.dataset.hl=mode||'none';r.querySelectorAll('[data-hl-btn]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hlBtn===mode)));});if(pinned&&pinned.root.isConnected)showTip(pinned.root,pinned.zone,pinned.e);}
 function clearAll(){pinned=null;hideTips();if(hl)setHl(null);}
 const live=()=>{if(pinned&&!pinned.root.isConnected)pinned=null;};
 doc.addEventListener('pointermove',e=>{live();if(e.pointerType!=='mouse'||pinned)return;const svg=e.target.closest?.('svg.sz-court'),root=svg?.closest('.pc-shooting'),z=svg?zoneAt(svg,e):-1;if(root&&z>=0)showTip(root,z,e);else hideTips();});
 doc.addEventListener('click',e=>{
  live();const t=e.target,view=t.closest?.('[data-shotview-btn]'),au=t.closest?.('[data-hl-btn]');
  if(view){shotView=view.dataset.shotviewBtn;pinned=null;hideTips();if(shotView!=='shots')setHl(null);roots().forEach(root=>{root.querySelectorAll('[data-shotview-btn]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.shotviewBtn===shotView)));root.querySelectorAll('svg[data-shotview]').forEach(s=>s.toggleAttribute('hidden',s.dataset.shotview!==shotView));/* SVG elements have no .hidden property */root.querySelector('.sz-au')?.toggleAttribute('hidden',shotView!=='shots');});return;}
  if(au){setHl(hl===au.dataset.hlBtn?null:au.dataset.hlBtn);return;}
  const svg=t.closest?.('svg.sz-court');
  if(svg){const root=svg.closest('.pc-shooting'),z=zoneAt(svg,e);if(z<0){clearAll();return;}if(pinned&&pinned.root===root&&pinned.zone===z){pinned=null;hideTips();}else{pinned={root,zone:z,e:{clientX:e.clientX,clientY:e.clientY}};showTip(root,z,e);}return;}
  if(t.closest?.('.sz-areas,.sz-head,.sz-pop'))return;
  if(hl||pinned)clearAll();
 });
}
g.FantasyViz={net,values,radar,rank,shooting,tipHtml,change};
})(globalThis);
