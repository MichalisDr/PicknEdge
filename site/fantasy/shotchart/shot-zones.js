/* Shot zones: geometry, classification, hex grid, grading and drawing of the shot chart.
   Units are the EuroLeague Points feed's: centimetres, hoop at (0,0), +y towards midcourt, baseline at y=-157.5.
   Theta = atan2(y,x) in degrees. Lane 4.9 m (|x|<=245), free-throw line y=422.5, arc 6.75 m, corner line x=660, J = height where the arc meets the corner line.
   Zone-map choices (not official dimensions): RIM_R, RIM_STRIP_Y and DIAG_DEG. */
const BASELINE=-157.5,LANE=245,FT=422.5,ARC=675,CORNER_X=660,SIDE=750,HALF=1242.5,
 CORNER_Y=Math.sqrt(ARC*ARC-CORNER_X*CORNER_X),/* J */
 B_DEG=Math.atan2(CORNER_Y,CORNER_X)*180/Math.PI,/* ray from the hoop to the arc/corner junction: Baseline below it, Mid above it */
 RIM_R=130,RIM_STRIP_Y=-37.5,/* At the rim: half disc in front of the hoop plus the strip behind it (not as far as the baseline) */
 DIAG_DEG=67;/* Arc and Mid are split right < 67°, centre 67°..113°, left > 113° */const ZONES=[
 {key:'rim',name:'At the rim',sub:'rim'},{key:'paint',name:'Rest of paint',sub:'paint'},
 {key:'midL',name:'Mid left',sub:'mid'},{key:'midC',name:'Mid center',sub:'mid'},{key:'midR',name:'Mid right',sub:'mid'},
 {key:'baseL',name:'Baseline left',sub:'base'},{key:'baseR',name:'Baseline right',sub:'base'},
 {key:'arcL',name:'Arc left',sub:'arc'},{key:'arcC',name:'Arc center',sub:'arc'},{key:'arcR',name:'Arc right',sub:'arc'},
 {key:'cornerL',name:'Corner left',sub:'corner'},{key:'cornerR',name:'Corner right',sub:'corner'}
];
const SUBS=[{key:'rim',name:'At the rim',main:'paint'},{key:'paint',name:'Rest of paint',main:'paint'},{key:'mid',name:'Mid-range',main:'mid'},{key:'base',name:'Baseline',main:'mid'},{key:'arc',name:'Arc 3',main:'3p'},{key:'corner',name:'Corner 3',main:'3p'}];
const MAINS=[{key:'3p',name:'3P'},{key:'mid',name:'Mid'},{key:'paint',name:'Paint'}];
SUBS.forEach(s=>s.ids=ZONES.map((z,i)=>z.sub===s.key?i:-1).filter(i=>i>=0));
MAINS.forEach(m=>m.ids=ZONES.map((z,i)=>SUBS.find(s=>s.key===z.sub).main===m.key?i:-1).filter(i=>i>=0));
const COUNT=ZONES.length,finite=(x,y)=>Number.isFinite(x)&&Number.isFinite(y);
const inRim=(x,y)=>y>=0?x*x+y*y<=RIM_R*RIM_R:y>=RIM_STRIP_Y&&Math.abs(x)<=RIM_R;
const inPaint=(x,y)=>Math.abs(x)<=LANE&&y>=BASELINE&&y<=FT;
/* Zone of a shot. `three` comes from the official event type (2FG/3FG), the position gives the zone. -1 = unusable coordinates. */
function classify(x,y,three){
 if(!finite(x,y))return -1;
 const th=Math.atan2(y,x)*180/Math.PI;
 if(three){
  if(y<=CORNER_Y)return x<0?10:11;
  return th<DIAG_DEG?9:th<=180-DIAG_DEG?8:7;
 }
 if(inRim(x,y))return 0;
 if(inPaint(x,y))return 1;
 if(y<0)return x<0?5:6;
 if(th<B_DEG)return 6;
 if(th<DIAG_DEG)return 4;
 if(th<=180-DIAG_DEG)return 3;
 if(th<=180-B_DEG)return 2;
 return 5;
}function rollup(made,att){
 const mk=ids=>{const m=ids.reduce((n,i)=>n+(made[i]||0),0),a=ids.reduce((n,i)=>n+(att[i]||0),0);return {made:m,att:a,fg:a>0?100*m/a:null};};
 return {zones:ZONES.map((z,i)=>({...z,i,...mk([i])})),subs:SUBS.map(s=>({...s,...mk(s.ids)})),mains:MAINS.map(m=>({...m,...mk(m.ids)}))};
}

/* ---------- evaluation of a zone against the league ----------
   League FG% of a zone = Σ made / Σ attempts of the league sample of the selected period (never an average of rates).
   Gap = recorded FG% of the entity − league FG%, in percentage points. No shrinkage, dispersion, percentiles, points conversion or quotas:
   volume and small-sample reliability are handled separately (the hexagon size already shows volume).
   Five grades by fixed cut-offs on the gap: very bad < −10 ≤ bad < −5 ≤ average < +5 ≤ good < +10 ≤ very good (a gap exactly on a cut-off goes to the higher grade).
   The cut-offs are a Pick n Edge presentation convention (round, symmetric steps of about 1 make in 20 and 1 in 10); the same for every zone, Players and Teams, and period. */
const GAP_CUTS=[-10,-5,5,10],LEVEL_NAMES=['very bad','bad','average','good','very good'];
/* One entry per zone for a period: league made/attempts and FG% (null without attempts). */
function model(leagueMade,leagueAtt){
 return ZONES.map((_,z)=>({made:leagueMade[z],attempts:leagueAtt[z],p0:leagueAtt[z]>0?leagueMade[z]/leagueAtt[z]:null}));
}
/* Grade of an entity's recorded FG% in a zone. Exact integer comparison: 100·(m/n − M/A) >= cut ⇔ 100·(m·A − M·n) >= cut·n·A. */
function grade(mz,made,att){
 if(!mz||!(mz.attempts>0)||!(att>0))return null;
 const num=made*mz.attempts-mz.made*att,den=att*mz.attempts;
 return {level:GAP_CUTS.filter(c=>100*num>=c*den).length,gap:100*num/den};
}
/* Raw opponent FG% defensive rank. Exact ties share competition rank; no attempts have no rank.
   Rank is independent of grade/colour and never recomputed on a search-filtered cohort. */
function teamRanks(made,att,cohort){
 const current=rollup(made,att),others=cohort.filter(t=>t.shotComplete).map(t=>rollup(t.made,t.attempts));
 return Object.fromEntries(['zones','subs','mains'].map(level=>[level,current[level].map((v,i)=>{
  if(!v.att)return null;const valid=others.map(o=>o[level][i]).filter(o=>o.att>0);if(!valid.length)return null;
  return {rank:1+valid.filter(o=>o.made*v.att<v.made*o.att).length,n:valid.length};
 })]));
}

/* Players: very bad red … very good green. Teams (opponent shooting against them): very bad (opponents shoot well) green … very good red. */
const levelClass=level=>level===null?'g-none':'g'+level;/* style class of a grade; teams use the same index: opponents shooting well = very bad defence = green; only the name flips */
const levelName=(level,team)=>team?LEVEL_NAMES[4-level]:LEVEL_NAMES[level];
/* Where each zone's FG% label sits (cm), inside the zone. */
const LABELS=[[0,45],[0,290],[-400,330],[0,548],[400,330],[-480,-20],[480,-20],[-598,501],[0,780],[598,501],[-705,-8],[705,-8]];
/* ---------- hex grid: fixed lattice in court coordinates (pointy-top, circumradius CELL) ---------- */
const DOT_R=8,/* radius of a single shot marker (cm) */
 CELL=24,GAP=.92,MAX_R=CELL*GAP;/* the largest hexagon fits its cell with a small gap, so none can overlap */
const SQ3=Math.sqrt(3);
function cellOf(x,y){/* axial coordinates of the lattice cell containing the point */
 const q=(SQ3/3*x-y/3)/CELL,r=(2/3*y)/CELL;let cx=q,cz=r,cy=-q-r,rx=Math.round(cx),ry=Math.round(cy),rz=Math.round(cz);
 const dx=Math.abs(rx-cx),dy=Math.abs(ry-cy),dz=Math.abs(rz-cz);
 if(dx>dy&&dx>dz)rx=-ry-rz;else if(dy>dz)ry=-rx-rz;else rz=-rx-ry;
 return [rx,rz];
}
const cellCenter=(q,r)=>[CELL*SQ3*(q+r/2),CELL*1.5*r];
const hexPts=(cx,cy,r)=>Array.from({length:6},(_,k)=>{const a=Math.PI/6+k*Math.PI/3;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];});
/* events [{x,y,zone}] -> cells [{q,r,x,y,n,zones}] and the radius function of THIS sample:
   radius = MAX_R × sqrt(cellAttempts / maxCellAttempts). Every attempt stays in the cell of its own coordinates. */
function bin(events){
 const m=new Map();
 for(const e of events){if(!finite(e.x,e.y))continue;const [q,r]=cellOf(e.x,e.y),k=q+','+r;let c=m.get(k);if(!c){const [x,y]=cellCenter(q,r);c={q,r,x,y,n:0,zones:Array(COUNT).fill(0)};m.set(k,c);}c.n++;if(e.zone>=0)c.zones[e.zone]++;}
 const cells=[...m.values()].sort((a,b)=>a.r-b.r||a.q-b.q),max=cells.reduce((n,c)=>Math.max(n,c.n),0);
 cells.forEach(c=>c.radius=MAX_R*Math.sqrt(c.n/max));
 return {cells,max};
}

/* ---------- court ---------- */
const SC=.3,OX=230,OY=24-BASELINE*SC,VIEW={w:460,h:Math.round(OY+HALF*SC+6)};
const X=x=>+(OX+SC*x).toFixed(2),Y=y=>+(OY+SC*y).toFixed(2),P=(x,y)=>X(x)+' '+Y(y),R=r=>+(SC*r).toFixed(2);
const polar=(deg,r)=>[r*Math.cos(deg*Math.PI/180),r*Math.sin(deg*Math.PI/180)];
const edge=deg=>{const c=Math.abs(Math.cos(deg*Math.PI/180)),s=Math.abs(Math.sin(deg*Math.PI/180));return Math.min(SIDE/(c||1e-9),HALF/(s||1e-9));};
/* Where a ray from the hoop leaves the paint (only the part outside the paint is drawn). */
const paintExit=deg=>{const c=Math.cos(deg*Math.PI/180),s=Math.sin(deg*Math.PI/180);return Math.min(c>1e-9?LANE/c:Infinity,s>1e-9?FT/s:Infinity);};
function court(){
 const rays=[];
 for(const sx of [-1,1]){const dir=d=>sx<0?180-d:d;
  const seg=(d,r0,r1)=>{const [a,b]=polar(dir(d),r0),[c,e]=polar(dir(d),r1);return `M${P(a,b)}L${P(c,e)}`;};
  rays.push(seg(DIAG_DEG,paintExit(DIAG_DEG),edge(DIAG_DEG)),seg(B_DEG,paintExit(B_DEG),ARC),`M${P(sx*CORNER_X,CORNER_Y)}H${X(sx*SIDE)}`);}
 const marks=`M${P(-SIDE,BASELINE)}V${Y(HALF)}H${X(SIDE)}V${Y(BASELINE)}Z M${P(-LANE,BASELINE)}V${Y(FT)}H${X(LANE)}V${Y(BASELINE)} M${P(-RIM_R,RIM_STRIP_Y)}V${Y(0)}A${R(RIM_R)} ${R(RIM_R)} 0 0 0 ${P(RIM_R,0)}V${Y(RIM_STRIP_Y)}Z M${P(-CORNER_X,BASELINE)}V${Y(CORNER_Y)}A${R(ARC)} ${R(ARC)} 0 0 0 ${P(CORNER_X,CORNER_Y)}V${Y(BASELINE)} M${P(-180,FT)}A${R(180)} ${R(180)} 0 0 1 ${P(180,FT)} M${P(-90,-37.5)}H${X(90)}`;
 return `<g class="sz-borders" fill="none" stroke="var(--fantasy-shot-chart-court-outline-line)" stroke-width=".8" stroke-dasharray="3 3"><path d="${rays.join('')}"/></g><g class="sz-lines" fill="none" stroke="var(--fantasy-shot-chart-court-markings-line)" stroke-width="1"><path d="${marks}"/><circle cx="${X(0)}" cy="${Y(0)}" r="${R(22.5)}"/></g>`;
}
export const ShotZones={BASELINE,LANE,FT,RIM_R,RIM_STRIP_Y,ARC,CORNER_X,CORNER_Y,DIAG_DEG,B_DEG,ZONES,SUBS,MAINS,COUNT,CELL,MAX_R,DOT_R,GAP_CUTS,LEVEL_NAMES,LABELS,model,grade,teamRanks,levelClass,levelName,VIEW,SC,classify,rollup,cellOf,cellCenter,hexPts,bin,court,X,Y};
