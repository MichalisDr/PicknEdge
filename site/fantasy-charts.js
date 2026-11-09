/* Comparative charts for Fantasy → Charts mode.
   CHARTS is the registry: one entry per chart, grouped by entity (teams/players) and view (profile/shooting).
   RENDERERS maps an entry's `type` to { prepare, render, tooltip, legend, [controls], [detail] }. The gallery, previews and modal only know that interface,
   so a new scatter is one CHARTS entry and a new type (e.g. venn) is one RENDERERS entry. Radars are not part of this: they stay in the entity cards. */
(function(g){
'use strict';
const M=g.FantasyMetrics,E=g.EuroLeagueData.metrics,Z=g.ShotZones,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {good:GOOD,bad:BAD,avg:NEUTRAL}=M.EVAL;/* same palette as the table ranks */
const POS={G:'#4cc3d9',F:'#f2c14e',C:'#c58af9'},POS_NAME={G:'Guard',F:'Forward',C:'Center'},SET_COL=['#5aa9e6','#f2a65a','#a58bf2'];
const PERIOD=p=>p==='season'?'Season':'Last '+p;

/* ---- shared zone mapping (one definition for every zone chart). Zones come from shot-zones.js, so each shot is in exactly one group:
   Rim = At the rim · Paint = rest of paint · Mid-range = Mid + Baseline · Corner 3 = both corners · Above-the-break 3 = all Arc zones.
   w = eFG weight of a made shot of that group (2P 1, 3P 1.5). */
const sub=k=>Z.SUBS.find(s=>s.key===k).ids;
const ZG={rim:{ids:sub('rim'),w:1},paint:{ids:sub('paint'),w:1},mid:{ids:[...sub('mid'),...sub('base')],w:1},corner:{ids:sub('corner'),w:1.5},atb:{ids:sub('arc'),w:1.5}};
const zsum=(arr,ids)=>Array.isArray(arr)?ids.reduce((n,i)=>n+arr[i],0):null;
const zone=(t,k)=>({a:zsum(t.attempts,ZG[k].ids),m:zsum(t.made,ZG[k].ids)});/* opponent attempts / makes of a team row (or summed totals) */
const zoneTotal=t=>Object.keys(ZG).reduce((n,k)=>n===null?null:(a=>a===null?null:n+a)(zone(t,k).a),0);
/* League benchmark of a period: Σ made and Σ attempts per group over every team with complete shot data, never an average of rates. */
function bench(rows){const b={n:0};for(const k in ZG)b[k]={a:0,m:0};for(const t of rows){if(!t.shotComplete)continue;b.n++;for(const k in ZG){const z=zone(t,k);b[k].a+=z.a;b[k].m+=z.m;}}return b;}
/* Expected Opp eFG% = Σ[zone FGA × league FG% of the zone × weight] / total FGA (null if a zone the team shot from has no league attempts). */
function expectedEfg(t,b){let A=0,S=0;for(const k in ZG){const z=zone(t,k);if(z.a===null)return null;A+=z.a;if(z.a>0){if(!(b[k].a>0))return null;S+=z.a*(b[k].m/b[k].a)*ZG[k].w;}}return M.div(S,A,100);}

/* Chart-only metrics (not table columns). get(row, env): env = {bench}. A zero denominator gives null (unavailable), never 0. */
const OPP_3PA={label:'Opp 3PA',unit:'/100 poss',neutral:true,get:t=>M.div(t.OA3,t.DePo,100),full:'Opponent three-point attempts per 100 possessions'};
const RIM_RATE={label:'Opp Rim FGA',unit:'/100 poss',neutral:true,get:t=>M.div(zone(t,'rim').a,t.DePo,100),full:'Opponent at-the-rim field goal attempts per 100 possessions'};
const RIM_PCT={label:'Opp Rim FG%',unit:'',pct:true,get:t=>M.div(zone(t,'rim').m,zone(t,'rim').a,100),full:'Opponent field goal percentage at the rim'};
const RIM_SHARE={label:'Opp Rim FGA share',unit:'% of Opp FGA',pct:true,neutral:true,get:t=>M.div(zone(t,'rim').a,zoneTotal(t),100),full:'Opponent at-the-rim attempts ÷ total opponent field goal attempts'};
const CORNER_SHARE={label:'Opp Corner 3PA share',unit:'% of Opp FGA',pct:true,neutral:true,get:t=>M.div(zone(t,'corner').a,zoneTotal(t),100),full:'Opponent corner three-point attempts ÷ total opponent field goal attempts'};
const EXP_EFG={label:'Opp Expected eFG%',unit:'',pct:true,neutral:true,get:(t,e)=>expectedEfg(t,e.bench),full:'Zone-based estimate: Σ[Opp FGA in zone × league FG% of the zone × weight (2P 1, 3P 1.5)] ÷ Opp FGA'};
const TS={key:'ts',label:'TS%',unit:'',pct:true,neutral:true,get:p=>M.div(E.pts(p),2*E.sa(p),100),full:'True shooting: points ÷ (2 × (FGA + 0.44 × FTA))'};
const T_ITEM=(label,unit,digits,get,pct)=>({label,unit,digits,get,pct});

const QUAD=(tl,tr,bl,br)=>({tl,tr,bl,br});
/* x / y: a metric key of the chart's own view (taken from FantasyMetrics.defs, so label, unit, digits and favourable direction are the table's),
   or {key, ...overrides}, or a literal metric {label, unit, get, ...}. Favourable = good for the opposing Fantasy players: goodHigher / neutral of the metric.
   Optional: shots (zone data: only teams with complete shot data), equal (same scale on both axes + y=x diagonal), residual (colour by y−x), color:'position',
   labels:false, pool (player pool with chart-local GP/MIN filters), quad (quadrant texts), tip (extra tooltip rows: key | {view,key} | literal), note. */
const CHARTS=[
 {id:'teams-pace-drtg',entity:'teams',view:'profile',type:'scatter',title:'Pace × DRtg',x:{key:'pace',unit:'poss / 40′'},y:'drtg'},
 {id:'teams-efg-tov',entity:'teams',view:'profile',type:'scatter',title:'Opp eFG% × Opp TOV',x:'efg',y:'tov'},
 {id:'teams-ast-tov',entity:'teams',view:'profile',type:'scatter',title:'Opp AST × Opp TOV',x:'ast',y:'tov'},
 {id:'teams-dreb-efg',entity:'teams',view:'profile',type:'scatter',title:'Shooting & Rebounding Defense',subtitle:'DREB% × Opp eFG%',x:'dreb',y:'efg',
  tip:['sc','tov','ftr','drtg'],quad:QUAD('Υψηλή επιτρεπόμενη ευστοχία · χαμηλό DREB%','Υψηλή επιτρεπόμενη ευστοχία · υψηλό DREB%','Χαμηλή επιτρεπόμενη ευστοχία · χαμηλό DREB%','Χαμηλή επιτρεπόμενη ευστοχία · υψηλό DREB%'),
  note:'Ευστοχία που επιτρέπεται και έλεγχος αμυντικού ριμπάουντ· δεν δείχνει από μόνο του πώς παράγεται το αποτέλεσμα στην άμυνα.'},
 {id:'teams-3pa-3p',entity:'teams',view:'shooting',type:'scatter',title:'Opp 3PA × Opp 3P%',x:OPP_3PA,y:{key:'shot3',label:'Opp 3P%'}},
 {id:'teams-expected-efg',entity:'teams',view:'shooting',type:'scatter',title:'Expected vs Actual eFG%',subtitle:'Opp Expected eFG% × Opp eFG% · Εκτίμηση βάσει ζωνών — δεν περιλαμβάνει πίεση αμυντικού',shots:true,equal:true,residual:true,noAvg:true,x:EXP_EFG,y:'efg',
  tip:[T_ITEM('Opp FGA (δείγμα)','',0,t=>zoneTotal(t))],
  note:'Εκτίμηση βάσει ζωνών — δεν περιλαμβάνει πίεση αμυντικού. Το residual (πραγματικό − αναμενόμενο) δεν αποδίδεται αυτόματα σε contest ή τύχη.'},
 {id:'teams-rim-defense',entity:'teams',view:'shooting',type:'scatter',title:'At-the-Rim Defense',subtitle:'Opp Rim FGA/100 × Opp Rim FG%',shots:true,x:RIM_RATE,y:RIM_PCT,
  tip:[T_ITEM('Opp Rim FGA (δείγμα)','',0,t=>zone(t,'rim').a),T_ITEM('Team BLK','/100 poss',1,t=>M.div(t.TBl,t.DePo,100)),{view:'profile',key:'ftr'}],
  quad:QUAD('Λίγες εκτελέσεις στη στεφάνη · υψηλή ευστοχία','Πολλές εκτελέσεις στη στεφάνη · υψηλή ευστοχία','Λίγες εκτελέσεις στη στεφάνη · χαμηλή ευστοχία','Πολλές εκτελέσεις στη στεφάνη · χαμηλή ευστοχία'),
  note:'Αφορά μόνο τα σουτ «At the rim», όχι ολόκληρο το ζωγραφιστό.'},
 {id:'teams-rim-corner',entity:'teams',view:'shooting',type:'scatter',title:'Rim & Corner Exposure',subtitle:'Opp Rim FGA share × Opp Corner 3PA share',shots:true,x:RIM_SHARE,y:CORNER_SHARE,
  tip:[T_ITEM('Opp 3PA share','',1,t=>M.div(t.OA3,t.OA2+t.OA3,100),true),T_ITEM('Opp Rim FG%','',1,t=>RIM_PCT.get(t),true),T_ITEM('Opp Corner 3P%','',1,t=>M.div(zone(t,'corner').m,zone(t,'corner').a,100),true),T_ITEM('Opp Rim FGA (δείγμα)','',0,t=>zone(t,'rim').a),T_ITEM('Opp Corner 3PA (δείγμα)','',0,t=>zone(t,'corner').a)],
  quad:QUAD('Μικρότερο μερίδιο στη στεφάνη · μεγαλύτερο στις γωνίες','Μεγαλύτερο μερίδιο στη στεφάνη · μεγαλύτερο στις γωνίες','Μικρότερο μερίδιο στη στεφάνη · μικρότερο στις γωνίες','Μεγαλύτερο μερίδιο στη στεφάνη · μικρότερο στις γωνίες'),
  note:'Μερίδια προσπαθειών ανά ζώνη· δεν είναι πλήρης μέτρηση shot quality ούτε απόδειξη συγκεκριμένης αμυντικής τακτικής.'},
 {id:'players-usg-ts',entity:'players',view:'profile',type:'scatter',title:'Usage & Scoring Efficiency',subtitle:'USG% × TS%',pool:true,color:'position',labels:false,x:{key:'usg',neutral:true},y:TS,
  tip:['min','tov',{key:'ast'},T_ITEM('AST','/game',1,p=>M.div(p.As,p.Gm)),'ftr',T_ITEM('PTS','/game',1,p=>M.div(E.pts(p),p.Gm)),'pir'],
  quad:QUAD('Χαμηλό φορτίο · υψηλή αποτελεσματικότητα','Υψηλό φορτίο · υψηλή αποτελεσματικότητα','Χαμηλό φορτίο · χαμηλή αποτελεσματικότητα','Υψηλό φορτίο · χαμηλή αποτελεσματικότητα'),
  note:'Φορτίο και αποτελεσματικότητα σκοραρίσματος σε σχέση με τον μέσο όρο της λίγκας· όλα τα σημεία έχουν το ίδιο μέγεθος (όχι βάρος λεπτών).'},
 {id:'players-efficient-scorers',entity:'players',view:'profile',type:'venn',title:'Efficient Scorers',subtitle:'USG% top · TOV% bottom · TS% top',pool:true,
  sets:[{key:'usg',metric:'usg',dir:'high',p:30},{key:'tov',metric:'tov',dir:'low',p:30},{key:'ts',metric:TS,dir:'high',p:30}]}
];

const fmt=(d,v)=>M.format(v,d.digits??1)+(d.pct&&Number.isFinite(v)?'%':'');
const sign=d=>d.neutral?0:d.goodHigher===false?-1:1;/* +1: higher is favourable, −1: lower is favourable, 0: neutral */
const axisTitle=d=>d.label+(d.unit?' · '+d.unit:'');
/* Colour of a point/quadrant from its side of each average: both axes favourable → good, both unfavourable → bad, otherwise neutral. Neutral axes do not vote. */
function tone(sx,dx,sy,dy){const n=(sx!==0)+(sy!==0);if(!n)return NEUTRAL;const s=(sx*dx+sy*dy)/n;return s>0?GOOD:s<0?BAD:NEUTRAL;}
function resolve(spec,defs){const a=typeof spec==='string'?{key:spec}:spec;return a.get?a:{...defs.find(d=>d.key===a.key),...a};}
function nice(lo,hi,count){const raw=(hi-lo)/count,mag=Math.pow(10,Math.floor(Math.log10(raw))),step=+([1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=raw-1e-12)||10*mag).toPrecision(6),out=[];for(let v=Math.ceil(lo/step-1e-9)*step;v<=hi+1e-9;v+=step)out.push(+v.toFixed(8));return {ticks:out,dec:(String(step).split('.')[1]||'').length};}

/* Chart-local options (GP / MIN minimums, percentile thresholds). Not stored until the user changes them: until then they follow the page filters / the registry defaults. */
const OPTS={},SEL={};let seq=0;
const optsOf=(chart,ctx)=>({minGp:ctx.minGp??1,minMin:ctx.minMin??0,...Object.fromEntries((chart.sets||[]).map((s,k)=>['p'+k,s.p])),...OPTS[chart.id]});
/* Player pool: the page's position / team filters (never the name search) and the chart's own GP / MIN-per-game minimums. */
const poolOf=(ctx,o)=>(ctx.pool||ctx.rows).filter(p=>p.Gm>=o.minGp&&p.Sec/60/p.Gm>=o.minMin);
const numInput=(opt,label,v,min,max)=>`<label>${label}<input type="number" data-fc-opt="${opt}" min="${min}"${max!==undefined?` max="${max}"`:''} step="1" value="${v}"></label>`;
const poolControls=o=>numInput('minGp','GP ≥',o.minGp,1)+numInput('minMin','MIN/αγώνα ≥',o.minMin,0);

/* Logo backdrop: light logos (mostly white marks) get a dark disc, the rest a light one. Measured once per logo from its opaque pixels. */
const LIGHT={};
function measure(url){if(url in LIGHT)return;LIGHT[url]=false;const img=new Image();img.onload=()=>{try{const cv=document.createElement('canvas'),n=cv.width=cv.height=24,cx=cv.getContext('2d');cx.drawImage(img,0,0,n,n);const px=cx.getImageData(0,0,n,n).data;let s=0,a=0;for(let i=0;i<px.length;i+=4){const al=px[i+3]/255;s+=al*(.2126*px[i]+.7152*px[i+1]+.0722*px[i+2])/255;a+=al;}if(a&&s/a>.72){LIGHT[url]=true;if(modal)paint();}}catch(e){/* tainted/blocked canvas: keep the light disc */}};img.src=url;}
const RENDERERS={
 scatter:{
  prepare(chart,ctx){
   const defs=M.defs(ctx.kind,chart.view),xd=resolve(chart.x,defs),yd=resolve(chart.y,defs),q=String(ctx.query||'').toLowerCase(),o=optsOf(chart,ctx),all=M.rows(ctx.kind,ctx.period);
   /* Reference (average) lines: the whole league of the active period, independent of search and page filters. Zone charts: teams with complete shot data only. */
   const ref=chart.shots?all.filter(t=>t.shotComplete):all,env={bench:chart.shots?bench(all):null};
   const pool=chart.pool?poolOf(ctx,o):ctx.rows,rows=chart.shots?pool.filter(t=>t.shotComplete):pool;
   const tipDefs=(chart.tip||[]).map(s=>typeof s==='string'?defs.find(d=>d.key===s):s.view?M.defs(ctx.kind,s.view).find(d=>d.key===s.key):s.get?s:{...defs.find(d=>d.key===s.key),...s}).filter(Boolean);
   const pts=rows.map(p=>({id:ctx.id(p),name:ctx.name(p),label:p.label||ctx.name(p),logo:ctx.kind==='teams'?ctx.logo?.(p)||'':'',pos:p.Pos,gp:p.Gm,row:p,x:xd.get(p,env),y:yd.get(p,env),dim:!!q&&!ctx.name(p).toLowerCase().includes(q)})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
   const avg=d=>chart.noAvg?null:M.average(ref.filter(p=>Number.isFinite(d.get(p,env))),{get:t=>d.get(t,env)});
   return {xd,yd,pts,env,tipDefs,avgX:avg(xd),avgY:avg(yd),total:rows.length,period:ctx.period,noun:ctx.kind==='teams'?'ομάδες':'παίκτες',opts:o,benchN:env.bench?.n};
  },
  render(chart,d,o){
   const {W,H,compact:c}=o,narrow=!c&&W<460,m=c?{l:40,r:10,t:10,b:36}:narrow?{l:46,r:12,t:14,b:50}:{l:60,r:24,t:18,b:54},sx=sign(d.xd),sy=sign(d.yd);
   let pw=W-m.l-m.r,ph=H-m.t-m.b;
   if(!d.pts.length)return `<p class="fw-empty">Δεν υπάρχουν ακόμη επαρκή δεδομένα για αυτό το chart (η λήψη EuroLeague μπορεί να συνεχίζεται ή τα φίλτρα αποκλείουν όλους).</p>`;
   if(chart.equal){const s=Math.min(pw,ph);m.l+=(pw-s)/2;m.t+=(ph-s)/2;pw=ph=s;}/* same pixels per unit on both axes */
   const dom=k=>{const v=d.pts.map(p=>p[k]),lo=Math.min(...v),hi=Math.max(...v),pad=(hi-lo||Math.abs(hi)||1)*.08;return [lo-pad,hi+pad];};
   let [x0,x1]=dom('x'),[y0,y1]=dom('y');if(chart.equal){x0=y0=Math.min(x0,y0);x1=y1=Math.max(x1,y1);}
   const X=v=>m.l+(v-x0)/(x1-x0)*pw,Y=v=>m.t+ph-(v-y0)/(y1-y0)*ph,mode=chart.residual?'residual':chart.color==='position'?'position':'tone';
   const xt=nice(x0,x1,c?4:chart.equal?6:7),yt=nice(y0,y1,c?4:6),hasAvg=Number.isFinite(d.avgX)&&Number.isFinite(d.avgY),ax=X(d.avgX),ay=Y(d.avgY),side=(v,a)=>Number.isFinite(a)?Math.sign(v-a):0,tick=(dd,v)=>v.toFixed(dd.dec);
   const quad=mode!=='tone'||!hasAvg?'':[[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy])=>{const col=tone(sx,dx,sy,dy);if(col===NEUTRAL)return '';const xa=dx<0?m.l:ax,xb=dx<0?ax:m.l+pw,ya=dy>0?m.t:ay,yb=dy>0?ay:m.t+ph;return `<rect x="${xa}" y="${ya}" width="${xb-xa}" height="${yb-ya}" fill="${col}" fill-opacity=".07"/>`;}).join('');
   /* y = x: above the diagonal opponents shoot better than expected (favourable), below worse */
   const diag=!chart.equal?'':`<polygon points="${X(x0)},${Y(y0)} ${X(x0)},${Y(y1)} ${X(x1)},${Y(y1)}" fill="${GOOD}" fill-opacity=".07"/><polygon points="${X(x0)},${Y(y0)} ${X(x1)},${Y(y0)} ${X(x1)},${Y(y1)}" fill="${BAD}" fill-opacity=".07"/>`;
   const diagLine=!chart.equal?'':`<line class="fc-avg fc-diag" x1="${X(x0)}" y1="${Y(x0)}" x2="${X(x1)}" y2="${Y(x1)}"/>${c?'':`<text class="fc-avg-l" x="${X(x1)-6}" y="${Y(x1)+14}" text-anchor="end">y = x</text>`}`;
   const grid=xt.ticks.map(v=>`<line class="fc-grid" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${m.t+ph}"/><text class="fc-tick" x="${X(v)}" y="${m.t+ph+(c?12:16)}" text-anchor="middle">${tick(xt,v)}${d.xd.pct?'%':''}</text>`).join('')+yt.ticks.map(v=>`<line class="fc-grid" y1="${Y(v)}" y2="${Y(v)}" x1="${m.l}" x2="${m.l+pw}"/><text class="fc-tick" x="${m.l-6}" y="${Y(v)+3.5}" text-anchor="end">${tick(yt,v)}${d.yd.pct?'%':''}</text>`).join('');
   const avg=!hasAvg?'':`<line class="fc-avg" x1="${ax}" x2="${ax}" y1="${m.t}" y2="${m.t+ph}"/><line class="fc-avg" y1="${ay}" y2="${ay}" x1="${m.l}" x2="${m.l+pw}"/>${c||narrow?'':`<text class="fc-avg-l" x="${Math.min(ax+4,m.l+pw-60)}" y="${m.t+11}">AVG ${fmt(d.xd,d.avgX)}</text><text class="fc-avg-l" x="${m.l+pw-4}" y="${ay-5}" text-anchor="end">AVG ${fmt(d.yd,d.avgY)}</text>`}`;
   const qt=chart.quad&&!c&&pw>=520?[['tl',m.l+8,m.t+15,'start'],['tr',m.l+pw-8,m.t+15,'end'],['bl',m.l+8,m.t+ph-8,'start'],['br',m.l+pw-8,m.t+ph-8,'end']].map(([k,x,y,a])=>`<text class="fc-quad" x="${x}" y="${y}" text-anchor="${a}">${esc(chart.quad[k])}</text>`).join(''):'';
   const R=15,pc=p=>mode==='residual'?(Math.abs(p.y-p.x)<.05?NEUTRAL:p.y>p.x?GOOD:BAD):mode==='position'?POS[p.pos]||'#8f9bad':tone(sx,side(p.x,d.avgX),sy,side(p.y,d.avgY));
   const dots=d.pts.map((p,i)=>{const cx=X(p.x),cy=Y(p.y),col=pc(p),aria=`${esc(p.name)}: ${esc(fmt(d.xd,p.x))}, ${esc(fmt(d.yd,p.y))}`;
    /* Full chart + logo: fixed-size logo centred on the exact point, ring = favourable / unfavourable / neutral. Previews keep dots. */
    if(!c&&p.logo){measure(p.logo);return `<g class="fc-pt fc-logo${p.dim?' fc-dim':''}" style="--tone:${col};--disc:${LIGHT[p.logo]?'#243143':'#f3f6fa'}"><circle data-pt="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R}" tabindex="0" role="img" aria-label="${aria}"/><image href="${esc(p.logo)}" x="${(cx-R+4).toFixed(1)}" y="${(cy-R+4).toFixed(1)}" width="${2*R-8}" height="${2*R-8}" preserveAspectRatio="xMidYMid meet" pointer-events="none"/></g>`;}
    const late=cx>m.l+pw*.86,lab=!c&&!narrow&&chart.labels!==false;return `<g class="fc-pt${p.dim?' fc-dim':''}"><circle data-pt="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${c?(d.pts.length>40?2.6:4):chart.labels===false?5:6.5}" style="fill:${col}"${c?'':` tabindex="0" role="img" aria-label="${aria}"`}/>${lab?`<text class="fc-pl" x="${(cx+(late?-10:10)).toFixed(1)}" y="${(cy+3.5).toFixed(1)}" text-anchor="${late?'end':'start'}">${esc(p.label)}</text>`:''}</g>`;}).join('');
   return `<svg class="fc-svg${c?' fc-compact':''}" viewBox="0 0 ${W} ${H}" role="${c?'presentation':'group'}" aria-label="${esc(chart.title)}">${quad}${diag}${grid}<rect class="fc-frame" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/>${avg}${diagLine}${qt}${dots}<text class="fc-ax" x="${m.l+pw/2}" y="${chart.equal?Math.min(H-(c?3:8),m.t+ph+(c?26:38)):H-(c?3:8)}" text-anchor="middle">${esc(axisTitle(d.xd))}</text><text class="fc-ax" transform="translate(${chart.equal?Math.max(c?10:14,m.l-(c?30:46)):c?10:14} ${m.t+ph/2}) rotate(-90)" text-anchor="middle">${esc(axisTitle(d.yd))}</text></svg>`;
  },
  tooltip(chart,d,i){
   const p=d.pts[i],sx=sign(d.xd),sy=sign(d.yd);if(!p)return '';
   const unit=def=>def.unit&&!def.pct?' <small>'+esc(def.unit)+'</small>':'';
   const plain=(def,v)=>`<div><span>${esc(def.label)}</span><b>${esc(fmt(def,v))}${unit(def)}</b></div>`;
   const row=(def,v,avg,s)=>{if(!Number.isFinite(avg))return plain(def,v);const diff=v-avg,zero=Math.abs(diff)<Math.pow(10,-(def.digits??1))/2,col=!s||zero?'':(s*diff>0?GOOD:BAD);return `<div><span>${esc(def.label)}</span><b>${esc(fmt(def,v))}${unit(def)}</b><em${col?` style="color:${col}"`:''}>${zero?'= AVG':(diff<0?'−':'+')+Math.abs(diff).toFixed(def.digits??1)+(def.pct?' pp':'')+' vs AVG'}</em></div>`;};
   const gap=p.y-p.x,resid=chart.residual?`<div><span>Διαφορά (πραγματικό − αναμενόμενο)</span><b style="color:${Math.abs(gap)<.05?'inherit':gap>0?GOOD:BAD}">${gap<0?'−':'+'}${Math.abs(gap).toFixed(1)} pp</b></div>`:'';
   const pos=p.pos?` · ${esc(POS_NAME[p.pos]||p.pos)}`:'';
   return `<strong>${esc(p.name)}</strong><small>${p.gp} GP · ${esc(PERIOD(d.period))}${pos}</small>${row(d.xd,p.x,d.avgX,sx)}${row(d.yd,p.y,d.avgY,sy)}${resid}${d.tipDefs.map(def=>plain(def,def.get(p.row,d.env))).join('')}`;
  },
  controls(chart,d){return chart.pool?poolControls(d.opts):'';},
  legend(chart,d){
   const dir=def=>def.neutral?'ουδέτερος άξονας':def.goodHigher===false?'χαμηλότερο = ευνοϊκό':'υψηλότερο = ευνοϊκό';
   const mode=chart.residual?'residual':chart.color==='position'?'position':'tone';
   const keys={tone:`<li><i style="background:${GOOD}"></i>Ευνοϊκό για τους αντίπαλους Fantasy παίκτες</li><li><i style="background:${BAD}"></i>Δυσμενές</li><li><i style="background:${NEUTRAL}"></i>Μικτό / ουδέτερο</li>`,
    residual:`<li><i style="background:${GOOD}"></i>Πάνω από τη διαγώνιο: οι αντίπαλοι ευστοχούν περισσότερο από το αναμενόμενο (ευνοϊκό για αντίπαλους Fantasy παίκτες)</li><li><i style="background:${BAD}"></i>Κάτω από τη διαγώνιο: λιγότερο από το αναμενόμενο</li><li><i class="fc-avg-key"></i>Διαγώνιος y = x (ίδια κλίμακα στους δύο άξονες)</li>`,
    position:Object.entries(POS).map(([k,col])=>`<li><i style="background:${col}"></i>${POS_NAME[k]} (${k})</li>`).join('')}[mode];
   const avgKey=chart.noAvg?'':`<li><i class="fc-avg-key"></i>Μέσος όρος λίγκας (άθροισμα ÷ άθροισμα, όπως στον πίνακα)</li>`;
   const dirs=mode==='tone'?`${esc(d.xd.label)}: ${dir(d.xd)} · ${esc(d.yd.label)}: ${dir(d.yd)} · `:'';
   const cover=chart.shots?` · ${d.benchN} ομάδες με πλήρη δεδομένα σουτ στο benchmark`:'';
   return `<ul class="fc-legend">${keys}${avgKey}</ul><p class="fc-note">${dirs}${d.pts.length}/${d.total} ${d.noun} · ${esc(PERIOD(d.period))}${cover}</p>${chart.quad?`<ul class="fc-quads">${[['tl','↖'],['tr','↗'],['bl','↙'],['br','↘']].map(([k,a])=>`<li><b>${a}</b> ${esc(chart.quad[k])}</li>`).join('')}</ul>`:''}${chart.note?`<p class="fc-note">${esc(chart.note)}</p>`:''}${[d.xd,d.yd].map(def=>def.full?`<p class="fc-note"><b>${esc(def.label)}</b>: ${esc(def.full)}${def.unit?' ('+esc(def.unit)+')':''}</p>`:'').join('')}`;
  }
 },
 /* Venn of three top/bottom-percentile sets. Thresholds are percentiles of the eligible pool (page position/team filters + chart GP/MIN minimums, before the name search);
    ties at the cut-off are included; nothing is auto-adjusted when a region is empty. */
 venn:{
  prepare(chart,ctx){
   const defs=M.defs(ctx.kind,chart.view),o=optsOf(chart,ctx),minDef=defs.find(d=>d.key==='min'),q=String(ctx.query||'').toLowerCase();
   const sets=chart.sets.map((s,k)=>({...s,def:resolve(s.metric,defs),pct:o['p'+k]}));
   const pool=poolOf(ctx,o),eligible=pool.map(r=>({r,v:sets.map(s=>s.def.get(r))})).filter(x=>x.v.every(Number.isFinite));
   sets.forEach((s,k)=>{const vals=eligible.map(x=>x.v[k]).sort((a,b)=>s.dir==='low'?a-b:b-a),n=vals.length;s.cut=n?vals[Math.min(n-1,Math.max(0,Math.ceil(n*s.pct/100)-1))]:null;s.count=0;});
   const regions={};for(let m=0;m<8;m++)regions[m.toString(2).padStart(3,'0')]={n:0,list:[]};
   for(const x of eligible){const key=sets.map((s,k)=>{const yes=s.dir==='low'?x.v[k]<=s.cut:x.v[k]>=s.cut;if(yes)s.count++;return yes?1:0;}).join('');
    const rg=regions[key];rg.n++;rg.list.push({name:ctx.name(x.r),team:x.r.Cl,pos:x.r.Pos,gp:x.r.Gm,min:minDef?.get(x.r),v:x.v,hit:!!q&&ctx.name(x.r).toLowerCase().includes(q)});}
   return {sets,regions,n:eligible.length,pool:pool.length,unavailable:pool.length-eligible.length,opts:o,period:ctx.period,position:ctx.position,total:(ctx.pool||ctx.rows).length};
  },
  render(chart,d,o){
   const {W,H,compact:c}=o;if(!d.n)return `<p class="fw-empty">Δεν υπάρχουν παίκτες με διαθέσιμα USG%, TOV% και TS% στο τρέχον δείγμα και φίλτρα.</p>`;
   const uid='v'+(++seq),top0=c?6:38,bot=c?6:36,availH=H-top0-bot,R=Math.min(availH/2.909,W*.26),dd=R*1.05,rc=dd/Math.sqrt(3),hgt=1.5*rc+2*R,topY=top0+(availH-hgt)/2,cy=topY+R+rc/2,cx=W/2;
   const C=[[cx-dd/2,cy-rc/2],[cx+dd/2,cy-rc/2],[cx,cy+rc]],G=[cx,cy],circ=([x,y])=>`M${x-R} ${y}a${R} ${R} 0 1 0 ${2*R} 0a${R} ${R} 0 1 0 ${-2*R} 0Z`;
   const unit=(p,q)=>{const dx=p[0]-q[0],dy=p[1]-q[1],l=Math.hypot(dx,dy)||1;return [dx/l,dy/l];},at=(p,u,k)=>[p[0]+u[0]*k,p[1]+u[1]*k];
   const defs=C.map((p,k)=>`<clipPath id="${uid}i${k}"><path d="${circ(p)}"/></clipPath><clipPath id="${uid}o${k}"><path clip-rule="evenodd" d="M0 0H${W}V${H}H0Z${circ(p)}"/></clipPath>`).join('');
   const keyOf=m=>[0,1,2].map(k=>m>>(2-k)&1).join(''),sel=SEL[chart.id];
   const spot=key=>{const on=[...key].map((b,k)=>b==='1'?k:-1).filter(k=>k>=0);if(on.length===3)return G;if(on.length===1)return at(C[on[0]],unit(C[on[0]],G),R*.5);const mid=[(C[on[0]][0]+C[on[1]][0])/2,(C[on[0]][1]+C[on[1]][1])/2];return at(G,unit(mid,G),R*.77);};
   const name=key=>{const on=[...key].map((b,k)=>b==='1'?d.sets[k].def.label:null).filter(Boolean);return on.length===1?on[0]+' μόνο':on.length===3?on.join(' + '):on.join(' + ')+' (χωρίς '+d.sets[[...key].indexOf('0')].def.label+')';};
   const hit=[1,2,3,4,5,6,7].map(m=>{const key=keyOf(m);let g='<rect class="fc-vr'+(sel===key?' on':'')+'" width="'+W+'" height="'+H+'"'+(c?'':` data-pt="${key}" data-region="${key}" data-follow tabindex="0" role="button" aria-label="${esc(name(key))}: ${d.regions[key].n} παίκτες"`)+'/>';for(let k=2;k>=0;k--)g=`<g clip-path="url(#${uid}${key[k]==='1'?'i':'o'}${k})">${g}</g>`;return g;}).join('');
   const circles=C.map((p,k)=>`<path d="${circ(p)}" fill="${SET_COL[k]}" fill-opacity=".2" stroke="${SET_COL[k]}" stroke-width="1.6" pointer-events="none"/>`).join('');
   const nums=[1,2,3,4,5,6,7].map(m=>{const key=keyOf(m),[x,y]=spot(key),n=d.regions[key].n;return `<text class="fc-vn${n?'':' zero'}${c?' sm':''}" x="${x.toFixed(1)}" y="${(y+(c?5:7)).toFixed(1)}" text-anchor="middle">${n}</text>`;}).join('');
   const dirTxt=s=>(s.dir==='low'?'bottom ':'top ')+s.pct+'%',cut=s=>(s.dir==='low'?'≤ ':'≥ ')+fmt(s.def,s.cut);
   const lab=c?'':[[0,'start',Math.max(6,C[0][0]-R),topY-22],[1,'end',Math.min(W-6,C[1][0]+R),topY-22],[2,'middle',cx,C[2][1]+R+15]].map(([k,a,x,y])=>`<text class="fc-vl" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${a}" fill="${SET_COL[k]}">${esc(d.sets[k].def.label)} ${dirTxt(d.sets[k])}</text><text class="fc-vl sub" x="${x.toFixed(1)}" y="${(y+14).toFixed(1)}" text-anchor="${a}">${esc(cut(d.sets[k]))}</text>`).join('');
   const short=c?[0,1,2].map(k=>{const p=at(C[k],unit(C[k],G),R*.95);return `<text class="fc-vl sm" x="${p[0].toFixed(1)}" y="${(p[1]+(k===2?10:-2)).toFixed(1)}" text-anchor="middle" fill="${SET_COL[k]}">${esc(d.sets[k].def.label)}</text>`;}).join(''):'';
   return `<svg class="fc-svg${c?' fc-compact':''}" viewBox="0 0 ${W} ${H}" role="${c?'presentation':'group'}" aria-label="${esc(chart.title)}"><defs>${defs}</defs>${circles}${hit}${nums}${lab}${short}</svg>`;
  },
  tooltip(chart,d,key){
   const rg=d.regions[key];if(!rg)return '';const on=[...key].map((b,k)=>b==='1'?d.sets[k].def.label:null).filter(Boolean);
   return `<strong>${on.length===1?esc(on[0])+' μόνο':on.length===3?esc(on.join(' + ')):esc(on.join(' + '))+' (χωρίς '+esc(d.sets[[...key].indexOf('0')].def.label)+')'}</strong><small>${rg.n} παίκτες · κλικ για τη λίστα</small>`;
  },
  controls(chart,d){return poolControls(d.opts)+d.sets.map((s,k)=>numInput('p'+k,esc(s.def.label)+(s.dir==='low'?' bottom %':' top %'),d.opts['p'+k],1,99)).join('');},
  detail(chart,d){
   const key=SEL[chart.id];if(!key||!d.regions[key])return `<p class="fc-note">Κλικ σε περιοχή του διαγράμματος (ή σε chip κάτω) για τη λίστα των παικτών της.</p>`;
   const rg=d.regions[key],title=key==='000'?'Εκτός όλων των συνόλων':[...key].map((b,k)=>b==='1'?d.sets[k].def.label:null).filter(Boolean).join(' + ')+(key.split('1').length-1<3?' (αποκλειστική περιοχή)':'');
   const list=[...rg.list].sort((a,b)=>b.v[2]-a.v[2]);
   return `<section class="fc-detail"><h3>${esc(title)} · ${rg.n} παίκτες</h3>${list.length?`<div class="fc-tbl"><table><thead><tr><th>Παίκτης</th><th>GP</th><th>MIN/αγ.</th>${d.sets.map(s=>`<th>${esc(s.def.label)}</th>`).join('')}</tr></thead><tbody>${list.map(r=>`<tr${r.hit?' class="hit"':''}><th>${esc(r.name)}<small>${esc(r.team)} · ${esc(r.pos||'—')}</small></th><td>${r.gp}</td><td>${M.format(r.min)}</td>${r.v.map((v,k)=>`<td>${esc(fmt(d.sets[k].def,v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="fc-note">Καμία (κενή περιοχή — τα όρια δεν αλλάζουν αυτόματα).</p>'}</section>`;
  },
  legend(chart,d){
   const keys=[1,2,3,4,5,6,7].map(m=>[0,1,2].map(k=>m>>(2-k)&1).join('')),on=(key)=>[...key].map((b,k)=>b==='1'?d.sets[k].def.label:null).filter(Boolean),nm=key=>on(key).length===1?on(key)[0]+' μόνο':on(key).length===3?on(key).join(' + '):on(key).join(' + ')+' (χωρίς '+d.sets[[...key].indexOf('0')].def.label+')';
   const chip=(key,label)=>`<button type="button" class="fc-chip${SEL[chart.id]===key?' on':''}" data-region="${key}">${esc(label)} <b>${d.regions[key].n}</b></button>`;
   return `<ul class="fc-legend">${d.sets.map((s,k)=>`<li><i style="background:${SET_COL[k]}"></i>${esc(s.def.label)} ${s.dir==='low'?'bottom':'top'} ${s.pct}% → ${s.dir==='low'?'≤':'≥'} <b>${esc(fmt(s.def,s.cut))}</b> · ${s.count} παίκτες</li>`).join('')}</ul><div class="fc-chips">${keys.map(k=>chip(k,nm(k))).join('')}${chip('000','Εκτός όλων των συνόλων')}</div><p class="fc-note">Πληθυσμός: ${d.n} παίκτες (θέση: ${esc(d.position&&d.position!=='ALL'?d.position:'όλες')} · GP ≥ ${d.opts.minGp} · MIN/αγώνα ≥ ${d.opts.minMin}${d.unavailable?` · ${d.unavailable} χωρίς διαθέσιμο USG%/TOV%/TS% εξαιρούνται`:''}). Τα percentiles υπολογίζονται σε αυτόν τον πληθυσμό, πριν από την αναζήτηση ονόματος· οι ισοβαθμίες στο όριο περιλαμβάνονται, οπότε ένα σύνολο μπορεί να έχει λίγο περισσότερους από το ονομαστικό ποσοστό. Τα όρια δεν προσαρμόζονται αυτόματα όταν μια περιοχή είναι κενή.</p>${d.sets.map(s=>s.def.full?`<p class="fc-note"><b>${esc(s.def.label)}</b>: ${esc(s.def.full||s.def.description)}</p>`:'').join('')}`;
  }
 }
};

/* ---- gallery + modal: generic over CHARTS / RENDERERS ---- */
let items=[],ctxNow=null,modal=null,rootNow=null;
const available=(kind,view)=>CHARTS.filter(c=>c.entity===kind&&c.view===view&&RENDERERS[c.type]);
const build=(chart,ctx)=>({chart,data:RENDERERS[chart.type].prepare(chart,ctx)});
const cardInner=({chart,data})=>`<span class="fc-card-title">${esc(chart.title)}</span><span class="fc-card-sub">${esc(chart.subtitle||'')}</span>${RENDERERS[chart.type].render(chart,data,{W:360,H:250,compact:true})}`;
function html(ctx){
 ctxNow=ctx;items=available(ctx.kind,ctx.view).map(c=>build(c,ctx));
 const where=(ctx.kind==='teams'?'Teams':'Players')+' · '+(ctx.view==='profile'?'Profile':'Shooting')+' · '+PERIOD(ctx.period);
 if(!items.length)return `<section class="fc-gallery"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)}</span></div><p class="fw-empty">Δεν υπάρχουν ακόμη συγκριτικά charts για αυτή την καρτέλα. Τα radar των ${ctx.kind==='teams'?'ομάδων':'παικτών'} βρίσκονται στην ατομική καρτέλα (πάτημα στο όνομα, στο Table).</p></section>`;
 return `<section class="fc-gallery"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)} · ${items.length} ${items.length===1?'chart':'charts'}</span></div><div class="fc-grid-gallery">${items.map((it,i)=>`<button type="button" class="fc-card" data-chart="${i}" aria-label="${esc(it.chart.title)} · μεγέθυνση">${cardInner(it)}</button>`).join('')}</div></section>`;
}
function wire(root,ctx){
 ctxNow=ctx;rootNow=root;root.querySelectorAll('[data-chart]').forEach(b=>b.onclick=()=>openModal(Number(b.dataset.chart),b));
 if(modal){const at=items.findIndex(i=>i.chart.id===modal.id);if(at<0)closeModal();else{modal.index=at;paint();}}
}
function closeModal(){if(!modal)return;const {dlg,opener,ro}=modal;ro?.disconnect();modal=null;dlg.close();dlg.remove();if(opener?.isConnected)opener.focus();}
function openModal(index,opener){
 const dlg=document.createElement('dialog');dlg.className='fw-dialog fc-dialog';
 dlg.innerHTML='<button type="button" class="fw-close" data-fc-close aria-label="Κλείσιμο">×</button><header class="fc-mhead"><h2></h2><div class="fw-switch fc-period" role="group" aria-label="Χρονικό δείγμα">' + ['season','5','3'].map(k=>'<button type="button" data-fc-period="'+k+'">'+PERIOD(k)+'</button>').join('') + '</div><div class="fc-nav"><button type="button" data-fc-step="-1" aria-label="Προηγούμενο chart">‹</button><b></b><button type="button" data-fc-step="1" aria-label="Επόμενο chart">›</button></div></header><div class="fc-controls" hidden></div><div class="fc-stage"></div><div class="fc-detail-wrap"></div><div class="fc-legend-wrap"></div><div class="fc-tip" role="tooltip" hidden></div>';
 document.body.append(dlg);modal={dlg,index,id:items[index].chart.id,opener,w:0,ctl:null};
 dlg.onclick=e=>{if(e.target===dlg||e.target.closest('[data-fc-close]'))closeModal();const s=e.target.closest('[data-fc-step]');if(s)step(Number(s.dataset.fcStep));const pe=e.target.closest('[data-fc-period]');if(pe&&ctxNow.setPeriod&&pe.dataset.fcPeriod!==ctxNow.period)ctxNow.setPeriod(pe.dataset.fcPeriod);const rg=e.target.closest('[data-region]');if(rg)pick(rg.dataset.region);else{const pt=e.target.closest('[data-pt]');if(pt)tip(pt,e);}};
 dlg.onchange=e=>{const i=e.target.closest?.('[data-fc-opt]');if(i)setOpt(i);};
 dlg.oncancel=e=>{e.preventDefault();closeModal();};
 dlg.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest?.('[data-region]')){e.preventDefault();pick(e.target.closest('[data-region]').dataset.region);return;}if(e.target.closest?.('input'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}};
 dlg.addEventListener('pointerover',e=>{const pt=e.target.closest?.('[data-pt]');if(pt)tip(pt,e);});dlg.addEventListener('pointermove',e=>{const pt=e.target.closest?.('[data-follow]');if(pt)tip(pt,e);});dlg.addEventListener('focusin',e=>{const pt=e.target.closest?.('[data-pt]');if(pt)tip(pt);});
 dlg.addEventListener('pointerout',hideTip);dlg.addEventListener('focusout',hideTip);
 dlg.showModal();paint();
 if(g.ResizeObserver){modal.ro=new ResizeObserver(()=>{if(modal&&Math.abs(modal.dlg.querySelector('.fc-stage').clientWidth-modal.w)>2)paint();});modal.ro.observe(dlg.querySelector('.fc-stage'));}
}
function step(by){if(!modal||items.length<2)return;modal.index=(modal.index+by+items.length)%items.length;modal.id=items[modal.index].chart.id;paint();}
/* Region selection (venn): click again to clear. */
function pick(key){if(!modal)return;const id=items[modal.index].chart.id;SEL[id]=SEL[id]===key?null:key;paint();}
/* A chart-local option changed: rebuild only that chart from the same definition, then refresh its preview card and the modal. */
function setOpt(input){
 if(!modal)return;const at=modal.index,{chart}=items[at],k=input.dataset.fcOpt,lo=Number(input.min),hi=input.max===''?Infinity:Number(input.max);
 const o=OPTS[chart.id]||(OPTS[chart.id]={});if(input.value.trim()==='')delete o[k];else o[k]=Math.min(hi,Math.max(lo,Math.round(Number(input.value))||lo));
 items[at]=build(chart,ctxNow);input.value=items[at].data.opts[k];
 const card=rootNow?.querySelector(`[data-chart="${at}"]`);if(card)card.innerHTML=cardInner(items[at]);
 paint(true);
}
/* Same chart definition and same prepared data as the preview; only the size differs. */
function paint(keepControls){
 const {dlg,index}=modal,{chart,data}=items[index],R=RENDERERS[chart.type],stage=dlg.querySelector('.fc-stage'),W=Math.max(280,Math.min(960,stage.clientWidth||dlg.clientWidth-52)),H=W<520?Math.round(W*.95):Math.round(Math.max(300,Math.min(W*.62,innerHeight*.58)));
 modal.w=W;dlg.querySelector('h2').innerHTML=esc(chart.title)+(chart.subtitle?'<small>'+esc(chart.subtitle)+'</small>':'');dlg.querySelector('.fc-nav b').textContent=(index+1)+' / '+items.length;dlg.querySelectorAll('[data-fc-step]').forEach(b=>b.disabled=items.length<2);dlg.querySelectorAll('[data-fc-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fcPeriod===ctxNow.period)));
 const ctl=dlg.querySelector('.fc-controls'),html=R.controls?R.controls(chart,data):'';
 if(modal.ctl!==chart.id||!keepControls&&!dlg.contains(document.activeElement?.closest?.('.fc-controls'))){ctl.innerHTML=html;modal.ctl=chart.id;}
 ctl.hidden=!html;
 stage.innerHTML=R.render(chart,data,{W,H,compact:false});dlg.querySelector('.fc-detail-wrap').innerHTML=R.detail?R.detail(chart,data):'';dlg.querySelector('.fc-legend-wrap').innerHTML=R.legend(chart,data);hideTip();
}
function tip(el,e){
 if(!modal)return;const {chart,data}=items[modal.index],t=modal.dlg.querySelector('.fc-tip');t.innerHTML=RENDERERS[chart.type].tooltip(chart,data,el.dataset.pt);t.hidden=false;
 const r=e&&el.hasAttribute('data-follow')&&e.clientX!==undefined?{left:e.clientX,right:e.clientX,top:e.clientY-4,bottom:e.clientY+12,width:0}:el.getBoundingClientRect(),w=t.offsetWidth,h=t.offsetHeight;
 t.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2))+'px';t.style.top=(r.top-h-10<8?r.bottom+10:r.top-h-10)+'px';
}
function hideTip(){const t=modal?.dlg.querySelector('.fc-tip');if(t)t.hidden=true;}
g.addEventListener('hashchange',closeModal);
g.FantasyCharts={CHARTS,RENDERERS,available,html,wire,zones:ZG,bench,expectedEfg};
})(globalThis);
