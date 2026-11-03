/* Comparative charts for Fantasy → Charts mode.
   CHARTS is the registry: one entry per chart, grouped by entity (teams/players) and view (profile/shooting).
   RENDERERS maps an entry's `type` to { prepare, render, tooltip, legend }. The gallery, previews and modal only know that interface,
   so a new scatter is one CHARTS entry and a new type (e.g. venn) is one RENDERERS entry. Radars are not part of this: they stay in the entity cards. */
(function(g){
'use strict';
const M=g.FantasyMetrics,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GOOD='#7fc6ac',BAD='#e7919b',NEUTRAL='#b8c6d7';/* same palette as the table ranks */
const PERIOD=p=>p==='season'?'Season':'Last '+p;

/* Chart-only axes (not table columns): same fields and the same denominator as Opp TOV / 100. */
const OPP_3PA={label:'Opp 3PA',unit:'/100 poss',neutral:true,get:t=>M.div(t.OA3,t.DePo,100),full:'Opponent three-point attempts per 100 possessions'};

/* x / y: a metric key of the chart's own view (taken from FantasyMetrics.defs, so label, unit, digits and favourable direction are the table's),
   or {key, ...overrides}, or a literal metric {label, unit, get, ...}. Favourable = good for the opposing Fantasy players: goodHigher / neutral of the metric. */
const CHARTS=[
 {id:'teams-pace-drtg',entity:'teams',view:'profile',type:'scatter',title:'Pace × DRtg',x:{key:'pace',unit:'poss / 40′'},y:'drtg'},
 {id:'teams-efg-tov',entity:'teams',view:'profile',type:'scatter',title:'Opp eFG% × Opp TOV',x:'efg',y:'tov'},
 {id:'teams-ast-tov',entity:'teams',view:'profile',type:'scatter',title:'Opp AST × Opp TOV',x:'ast',y:'tov'},
 {id:'teams-dreb-scp',entity:'teams',view:'profile',type:'scatter',title:'DREB% × Opp SCP',x:'dreb',y:'sc'},
 {id:'teams-3pa-3p',entity:'teams',view:'shooting',type:'scatter',title:'Opp 3PA × Opp 3P%',x:OPP_3PA,y:{key:'shot3',label:'Opp 3P%'}}
];

const fmt=(d,v)=>M.format(v,d.digits??1)+(d.pct&&Number.isFinite(v)?'%':'');
const sign=d=>d.neutral?0:d.goodHigher===false?-1:1;/* +1: higher is favourable, −1: lower is favourable, 0: neutral */
const axisTitle=d=>d.label+(d.unit?' · '+d.unit:'');
/* Colour of a point/quadrant from its side of each average: both axes favourable → good, both unfavourable → bad, otherwise neutral. Neutral axes do not vote. */
function tone(sx,dx,sy,dy){const n=(sx!==0)+(sy!==0);if(!n)return NEUTRAL;const s=(sx*dx+sy*dy)/n;return s>0?GOOD:s<0?BAD:NEUTRAL;}
function resolve(spec,defs){const a=typeof spec==='string'?{key:spec}:spec;return a.get?a:{...defs.find(d=>d.key===a.key),...a};}
function nice(lo,hi,count){const raw=(hi-lo)/count,mag=Math.pow(10,Math.floor(Math.log10(raw))),step=+([1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=raw-1e-12)||10*mag).toPrecision(6),out=[];for(let v=Math.ceil(lo/step-1e-9)*step;v<=hi+1e-9;v+=step)out.push(+v.toFixed(8));return {ticks:out,dec:(String(step).split('.')[1]||'').length};}

const RENDERERS={
 scatter:{
  prepare(chart,ctx){
   const defs=M.defs(ctx.kind,chart.view),xd=resolve(chart.x,defs),yd=resolve(chart.y,defs),q=String(ctx.query||'').toLowerCase();
   const pts=ctx.rows.map(p=>({id:ctx.id(p),name:ctx.name(p),label:p.label||ctx.name(p),gp:p.Gm,x:xd.get(p),y:yd.get(p),dim:!!q&&!ctx.name(p).toLowerCase().includes(q)})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
   return {xd,yd,pts,avgX:M.average(ctx.rows,xd),avgY:M.average(ctx.rows,yd),total:ctx.rows.length,period:ctx.period,noun:ctx.kind==='teams'?'ομάδες':'παίκτες'};
  },
  render(chart,d,o){
   const {W,H,compact:c}=o,narrow=!c&&W<460,m=c?{l:40,r:10,t:10,b:36}:narrow?{l:46,r:12,t:14,b:50}:{l:60,r:24,t:18,b:54},pw=W-m.l-m.r,ph=H-m.t-m.b,sx=sign(d.xd),sy=sign(d.yd);
   if(!d.pts.length)return `<p class="fw-empty">Δεν υπάρχουν ακόμη επαρκή δεδομένα για αυτό το chart (η λήψη EuroLeague μπορεί να συνεχίζεται).</p>`;
   const dom=k=>{const v=d.pts.map(p=>p[k]),lo=Math.min(...v),hi=Math.max(...v),pad=(hi-lo||Math.abs(hi)||1)*.08;return [lo-pad,hi+pad];};
   const [x0,x1]=dom('x'),[y0,y1]=dom('y'),X=v=>m.l+(v-x0)/(x1-x0)*pw,Y=v=>m.t+ph-(v-y0)/(y1-y0)*ph;
   const xt=nice(x0,x1,c?4:7),yt=nice(y0,y1,c?4:6),hasAvg=Number.isFinite(d.avgX)&&Number.isFinite(d.avgY),ax=X(d.avgX),ay=Y(d.avgY),side=(v,a)=>Number.isFinite(a)?Math.sign(v-a):0,tick=(dd,v)=>v.toFixed(dd.dec);
   const quad=!hasAvg?'':[[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy])=>{const col=tone(sx,dx,sy,dy);if(col===NEUTRAL)return '';const xa=dx<0?m.l:ax,xb=dx<0?ax:m.l+pw,ya=dy>0?m.t:ay,yb=dy>0?ay:m.t+ph;return `<rect x="${xa}" y="${ya}" width="${xb-xa}" height="${yb-ya}" fill="${col}" fill-opacity=".07"/>`;}).join('');
   const grid=xt.ticks.map(v=>`<line class="fc-grid" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${m.t+ph}"/><text class="fc-tick" x="${X(v)}" y="${m.t+ph+(c?12:16)}" text-anchor="middle">${tick(xt,v)}${d.xd.pct?'%':''}</text>`).join('')+yt.ticks.map(v=>`<line class="fc-grid" y1="${Y(v)}" y2="${Y(v)}" x1="${m.l}" x2="${m.l+pw}"/><text class="fc-tick" x="${m.l-6}" y="${Y(v)+3.5}" text-anchor="end">${tick(yt,v)}${d.yd.pct?'%':''}</text>`).join('');
   const avg=!hasAvg?'':`<line class="fc-avg" x1="${ax}" x2="${ax}" y1="${m.t}" y2="${m.t+ph}"/><line class="fc-avg" y1="${ay}" y2="${ay}" x1="${m.l}" x2="${m.l+pw}"/>${c||narrow?'':`<text class="fc-avg-l" x="${Math.min(ax+4,m.l+pw-60)}" y="${m.t+11}">AVG ${fmt(d.xd,d.avgX)}</text><text class="fc-avg-l" x="${m.l+pw-4}" y="${ay-5}" text-anchor="end">AVG ${fmt(d.yd,d.avgY)}</text>`}`;
   const dots=d.pts.map((p,i)=>{const cx=X(p.x),cy=Y(p.y),late=cx>m.l+pw*.86;return `<g class="fc-pt${p.dim?' fc-dim':''}"><circle data-pt="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${c?4:6.5}" style="fill:${tone(sx,side(p.x,d.avgX),sy,side(p.y,d.avgY))}"${c?'':` tabindex="0" role="img" aria-label="${esc(p.name)}: ${esc(fmt(d.xd,p.x))}, ${esc(fmt(d.yd,p.y))}"`}/>${c||narrow?'':`<text class="fc-pl" x="${(cx+(late?-10:10)).toFixed(1)}" y="${(cy+3.5).toFixed(1)}" text-anchor="${late?'end':'start'}">${esc(p.label)}</text>`}</g>`;}).join('');
   return `<svg class="fc-svg${c?' fc-compact':''}" viewBox="0 0 ${W} ${H}" role="${c?'presentation':'group'}" aria-label="${esc(chart.title)}">${quad}${grid}<rect class="fc-frame" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/>${avg}${dots}<text class="fc-ax" x="${m.l+pw/2}" y="${H-(c?3:8)}" text-anchor="middle">${esc(axisTitle(d.xd))}</text><text class="fc-ax" transform="translate(${c?10:14} ${m.t+ph/2}) rotate(-90)" text-anchor="middle">${esc(axisTitle(d.yd))}</text></svg>`;
  },
  tooltip(chart,d,i){
   const p=d.pts[i],sx=sign(d.xd),sy=sign(d.yd);if(!p)return '';
   const row=(def,v,avg,s)=>{if(!Number.isFinite(avg))return `<div><span>${esc(def.label)}</span><b>${esc(fmt(def,v))}</b></div>`;const diff=v-avg,zero=Math.abs(diff)<Math.pow(10,-(def.digits??1))/2,col=!s||zero?'':(s*diff>0?GOOD:BAD);return `<div><span>${esc(def.label)}</span><b>${esc(fmt(def,v))}${def.unit&&!def.pct?' <small>'+esc(def.unit)+'</small>':''}</b><em${col?` style="color:${col}"`:''}>${zero?'= AVG':(diff<0?'−':'+')+Math.abs(diff).toFixed(def.digits??1)+(def.pct?' pp':'')+' vs AVG'}</em></div>`;};
   return `<strong>${esc(p.name)}</strong><small>${p.gp} GP · ${esc(PERIOD(d.period))}</small>${row(d.xd,p.x,d.avgX,sx)}${row(d.yd,p.y,d.avgY,sy)}`;
  },
  legend(chart,d){
   const dir=def=>def.neutral?'ουδέτερος άξονας':def.goodHigher===false?'χαμηλότερο = ευνοϊκό':'υψηλότερο = ευνοϊκό';
   return `<ul class="fc-legend"><li><i style="background:${GOOD}"></i>Ευνοϊκό για τους αντίπαλους Fantasy παίκτες</li><li><i style="background:${BAD}"></i>Δυσμενές</li><li><i style="background:${NEUTRAL}"></i>Μικτό / ουδέτερο</li><li><i class="fc-avg-key"></i>Μέσος όρος (άθροισμα ÷ άθροισμα, όπως στον πίνακα)</li></ul><p class="fc-note">${esc(d.xd.label)}: ${dir(d.xd)} · ${esc(d.yd.label)}: ${dir(d.yd)} · ${d.pts.length}/${d.total} ${d.noun} · ${esc(PERIOD(d.period))}</p>${[d.xd,d.yd].map(def=>def.full?`<p class="fc-note"><b>${esc(def.label)}</b>: ${esc(def.full)}${def.unit?' ('+esc(def.unit)+')':''}</p>`:'').join('')}`;
  }
 }
};

/* ---- gallery + modal: generic over CHARTS / RENDERERS ---- */
let items=[],ctxNow=null,modal=null;
const available=(kind,view)=>CHARTS.filter(c=>c.entity===kind&&c.view===view&&RENDERERS[c.type]);
const build=(chart,ctx)=>({chart,data:RENDERERS[chart.type].prepare(chart,ctx)});
function html(ctx){
 ctxNow=ctx;items=available(ctx.kind,ctx.view).map(c=>build(c,ctx));
 const where=(ctx.kind==='teams'?'Teams':'Players')+' · '+(ctx.view==='profile'?'Profile':'Shooting')+' · '+PERIOD(ctx.period);
 if(!items.length)return `<section class="fc-gallery"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)}</span></div><p class="fw-empty">Δεν υπάρχουν ακόμη συγκριτικά charts για αυτή την καρτέλα. Τα radar των ${ctx.kind==='teams'?'ομάδων':'παικτών'} βρίσκονται στην ατομική καρτέλα (πάτημα στο όνομα, στο Table).</p></section>`;
 return `<section class="fc-gallery"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)} · ${items.length} ${items.length===1?'chart':'charts'}</span></div><div class="fc-grid-gallery">${items.map(({chart,data},i)=>`<button type="button" class="fc-card" data-chart="${i}" aria-label="${esc(chart.title)} · μεγέθυνση"><span class="fc-card-title">${esc(chart.title)}</span><span class="fc-card-sub">${esc(chart.subtitle||'')}</span>${RENDERERS[chart.type].render(chart,data,{W:360,H:250,compact:true})}</button>`).join('')}</div></section>`;
}
function wire(root,ctx){
 ctxNow=ctx;root.querySelectorAll('[data-chart]').forEach(b=>b.onclick=()=>openModal(Number(b.dataset.chart),b));
 if(modal){const at=items.findIndex(i=>i.chart.id===modal.id);if(at<0)closeModal();else{modal.index=at;paint();}}
}
function closeModal(){if(!modal)return;const {dlg,opener,ro}=modal;ro?.disconnect();modal=null;dlg.close();dlg.remove();if(opener?.isConnected)opener.focus();}
function openModal(index,opener){
 const dlg=document.createElement('dialog');dlg.className='fw-dialog fc-dialog';
 dlg.innerHTML='<button type="button" class="fw-close" data-fc-close aria-label="Κλείσιμο">×</button><header class="fc-mhead"><h2></h2><div class="fc-nav"><button type="button" data-fc-step="-1" aria-label="Προηγούμενο chart">‹</button><b></b><button type="button" data-fc-step="1" aria-label="Επόμενο chart">›</button></div></header><div class="fc-stage"></div><div class="fc-legend-wrap"></div><div class="fc-tip" role="tooltip" hidden></div>';
 document.body.append(dlg);modal={dlg,index,id:items[index].chart.id,opener,w:0};
 dlg.onclick=e=>{if(e.target===dlg||e.target.closest('[data-fc-close]'))closeModal();const s=e.target.closest('[data-fc-step]');if(s)step(Number(s.dataset.fcStep));const pt=e.target.closest('[data-pt]');if(pt)tip(pt);};
 dlg.oncancel=e=>{e.preventDefault();closeModal();};
 dlg.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}};
 dlg.addEventListener('pointerover',e=>{const pt=e.target.closest?.('[data-pt]');if(pt)tip(pt);});dlg.addEventListener('focusin',e=>{const pt=e.target.closest?.('[data-pt]');if(pt)tip(pt);});
 dlg.addEventListener('pointerout',hideTip);dlg.addEventListener('focusout',hideTip);
 dlg.showModal();paint();
 if(g.ResizeObserver){modal.ro=new ResizeObserver(()=>{if(modal&&Math.abs(modal.dlg.querySelector('.fc-stage').clientWidth-modal.w)>2)paint();});modal.ro.observe(dlg.querySelector('.fc-stage'));}
}
function step(by){if(!modal||items.length<2)return;modal.index=(modal.index+by+items.length)%items.length;modal.id=items[modal.index].chart.id;paint();}
/* Same chart definition and same prepared data as the preview; only the size differs. */
function paint(){
 const {dlg,index}=modal,{chart,data}=items[index],R=RENDERERS[chart.type],stage=dlg.querySelector('.fc-stage'),W=Math.max(280,Math.min(960,stage.clientWidth||dlg.clientWidth-52)),H=W<520?Math.round(W*.95):Math.round(Math.max(300,Math.min(W*.62,innerHeight*.58)));
 modal.w=W;dlg.querySelector('h2').textContent=chart.title;dlg.querySelector('.fc-nav b').textContent=(index+1)+' / '+items.length;dlg.querySelectorAll('[data-fc-step]').forEach(b=>b.disabled=items.length<2);
 stage.innerHTML=R.render(chart,data,{W,H,compact:false});dlg.querySelector('.fc-legend-wrap').innerHTML=R.legend(chart,data);hideTip();
}
function tip(el){
 if(!modal)return;const {chart,data}=items[modal.index],t=modal.dlg.querySelector('.fc-tip');t.innerHTML=RENDERERS[chart.type].tooltip(chart,data,el.dataset.pt);t.hidden=false;
 const r=el.getBoundingClientRect(),w=t.offsetWidth,h=t.offsetHeight;
 t.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2))+'px';t.style.top=(r.top-h-10<8?r.bottom+10:r.top-h-10)+'px';
}
function hideTip(){const t=modal?.dlg.querySelector('.fc-tip');if(t)t.hidden=true;}
g.addEventListener('hashchange',closeModal);
g.FantasyCharts={CHARTS,RENDERERS,available,html,wire};
})(globalThis);
