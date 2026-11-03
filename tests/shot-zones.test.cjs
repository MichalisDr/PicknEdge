const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function boot(){const c=vm.createContext({console,Event,CustomEvent:Event,setTimeout:()=>{},addEventListener(){},dispatchEvent(){},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},EUROLEAGUE_DATA_DISABLED:true,FANTASY_SHOTS_DISABLED:true});c.window=c;for(const f of ['site/team-assets.js','tests/fixtures/betting-games-seed.js','tests/fixtures/betting-players-seed.js','site/euroleague-data.js','site/betting-live-data.js','site/shot-zones.js','site/fantasy-live.js','tests/fixtures/fantasy-shots-seed.js','site/fantasy-shots.js','site/fantasy-metrics.js','site/fantasy-viz.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});return c;}
const c=boot(),Z=c.ShotZones,M=c.FantasyMetrics,S=c.FANTASY_SHOTS_SEED;
const allEvents=()=>{const out=[];for(const code in S)for(const r of S[code])if(/^[23]FG[AM]$/.test(r[2]))out.push({x:r[3],y:r[4],three:r[2][0]==='3',made:r[2].endsWith('M'),zone:Z.classify(r[3],r[4],r[2][0]==='3')});return out;};
const key=k=>Z.ZONES[k].key,sum=a=>a.reduce((n,x)=>n+x,0);

test('12 zones follow the shared constants: rim, rectangular paint, Mid/Baseline rays, Arc thirds, Corner by J',()=>{
 const z=(x,y,three)=>key(Z.classify(x,y,three)),pol=(r,d)=>[r*Math.cos(d*Math.PI/180),r*Math.sin(d*Math.PI/180)];
 assert.equal(Z.ZONES.length,12);assert.equal(Z.CORNER_Y.toFixed(1),'141.5');assert.equal(Z.B_DEG.toFixed(1),'12.1');assert.equal(Z.RIM_R,130);assert.equal(Z.DIAG_DEG,67);
 assert.equal(z(0,0,false),'rim');assert.equal(z(129,10,false),'rim');assert.equal(z(0,129,false),'rim');assert.equal(z(0,131,false),'paint');assert.equal(z(131,0,false),'paint');
 assert.equal(z(100,-30,false),'rim');assert.equal(z(130,-37.5,false),'rim');assert.equal(z(131,-30,false),'paint');assert.equal(z(100,-100,false),'paint','the rim does not reach the baseline');
 assert.equal(z(244,422,false),'paint');assert.equal(z(240,300,false),'paint');assert.equal(z(0,422.5,false),'paint');assert.equal(z(0,423,false),'midC');assert.equal(z(-245,-157.5,false),'paint');
 assert.equal(z(246,100,false),'midR');assert.equal(z(240,430,false),'midR');assert.equal(z(100,430,false),'midC');assert.equal(z(-240,430,false),'midL');assert.equal(z(-300,230,false),'midL');
 assert.equal(z(400,60,false),'baseR');assert.equal(z(-400,60,false),'baseL');assert.equal(z(400,100,false),'midR');
 assert.equal(z(300,-50,false),'baseR');assert.equal(z(-300,-50,false),'baseL');assert.equal(z(-250,-100,false),'baseL','behind the hoop: baseline by the sign of x');
 assert.equal(z(...pol(500,Z.B_DEG+.1),false),'midR');assert.equal(z(...pol(500,Z.B_DEG-.1),false),'baseR');assert.equal(z(...pol(500,180-Z.B_DEG-.1),false),'midL');assert.equal(z(...pol(500,180-Z.B_DEG+.1),false),'baseL');
 assert.equal(z(...pol(500,66.9),false),'midR');assert.equal(z(...pol(500,67.1),false),'midC');assert.equal(z(...pol(500,112.9),false),'midC');assert.equal(z(...pol(500,113.1),false),'midL');
 assert.equal(z(-690,100,true),'cornerL');assert.equal(z(690,141,true),'cornerR');assert.equal(z(666,150,true),'arcR');
 assert.equal(z(0,700,true),'arcC');assert.equal(z(200,700,true),'arcC');assert.equal(z(300,700,true),'arcR');assert.equal(z(-300,700,true),'arcL');assert.equal(z(-560,400,true),'arcL');assert.equal(z(560,400,true),'arcR');
 assert.equal(z(...pol(800,66.9),true),'arcR');assert.equal(z(...pol(800,67.1),true),'arcC');assert.equal(z(...pol(800,113.1),true),'arcL');
 assert.equal(Z.classify(NaN,0,false),-1);
 assert.equal(JSON.stringify(Z.MAINS.map(m=>m.key+':'+Array.from(m.ids))),JSON.stringify(['3p:7,8,9,10,11','mid:2,3,4,5,6','paint:0,1']));
 assert.equal(JSON.stringify(Z.SUBS.map(s=>s.key+':'+Array.from(s.ids))),JSON.stringify(['rim:0','paint:1','mid:2,3,4','base:5,6','arc:7,8,9','corner:10,11']));
});test('Every attempt lands in exactly one zone of the right family; 12 → 6 → 3 partition',()=>{
 const ev=allEvents();assert.ok(ev.length>10000);
 for(const e of ev){assert.ok(e.zone>=0&&e.zone<12);assert.equal(e.zone>=7,e.three);}
 assert.equal(JSON.stringify(Array.from(Z.SUBS.flatMap(s=>Array.from(s.ids))).sort((a,b)=>a-b)),JSON.stringify([...Array(12).keys()]));
 assert.equal(JSON.stringify(Array.from(Z.MAINS.flatMap(m=>Array.from(m.ids))).sort((a,b)=>a-b)),JSON.stringify([...Array(12).keys()]));
 const made=Array(12).fill(0),att=Array(12).fill(0);ev.forEach(e=>{att[e.zone]++;if(e.made)made[e.zone]++;});const r=Z.rollup(made,att);
 for(const lvl of ['zones','subs','mains']){assert.equal(sum(r[lvl].map(x=>x.att)),ev.length);assert.equal(sum(r[lvl].map(x=>x.made)),ev.filter(e=>e.made).length);}
 assert.equal(r.mains.find(m=>m.key==='3p').att,ev.filter(e=>e.three).length);
 assert.ok(r.zones.every(zn=>zn.att>0),'every zone is populated in real data');
});
const sat=(a,b)=>{for(const poly of [a,b])for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],ax=-(q[1]-p[1]),ay=q[0]-p[0],pr=P=>P.map(v=>v[0]*ax+v[1]*ay),A=pr(a),B=pr(b);if(Math.max(...A)<=Math.min(...B)+1e-6||Math.max(...B)<=Math.min(...A)+1e-6)return false;}return true;};
function checkBin(events,label){
 const {cells,max}=Z.bin(events);
 assert.equal(sum(cells.map(x=>x.n)),events.length,label+': every attempt in exactly one cell');
 assert.equal(max,Math.max(...cells.map(x=>x.n)));
 for(let z=0;z<12;z++)assert.equal(sum(cells.map(x=>x.zones[z])),events.filter(e=>e.zone===z).length,label+': true zone kept '+key(z));
 for(const e of events){const [q,r]=Z.cellOf(e.x,e.y),[cx,cy]=Z.cellCenter(q,r),d=Math.hypot(e.x-cx,e.y-cy);assert.ok(d<=Z.CELL+1e-9,label+': point inside its own cell');
  for(const [dq,dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]){const [nx,ny]=Z.cellCenter(q+dq,r+dr);assert.ok(d<=Math.hypot(e.x-nx,e.y-ny)+1e-9,label+': nearest lattice centre');}}
 cells.forEach(x=>{assert.ok(x.n>=1);assert.ok(Math.abs(x.radius**2/Z.MAX_R**2-x.n/max)<1e-9,label+': area ∝ attempts / max');assert.ok(x.radius<=Z.MAX_R+1e-9&&Z.MAX_R<Z.CELL);});
 assert.ok(Math.abs(Math.max(...cells.map(x=>x.radius))-Z.MAX_R)<1e-9,label+': busiest cell uses maxRadius');
 const polys=cells.map(x=>Z.hexPts(x.x,x.y,x.radius));
 for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){if(Math.hypot(cells[i].x-cells[j].x,cells[i].y-cells[j].y)>cells[i].radius+cells[j].radius)continue;assert.equal(sat(polys[i],polys[j]),false,label+': hexagons overlap');}
 return cells;
}
test('Hex grid: all attempts counted once, none moved by volume, areas proportional, no overlaps',()=>{
 const ev=allEvents();assert.ok(checkBin(ev,'league').length<ev.length);
 for(const period of ['season','3','5'])for(const t of M.rows('teams',period)){const e=c.FantasyShots.eventsOf(t.shotKeys);assert.equal(e.length,sum(t.attempts));const cells=checkBin(e,t.CID+' '+period);for(let z=0;z<12;z++)assert.equal(sum(cells.map(x=>x.zones[z])),t.attempts[z],'matches summary zone '+key(z));}
 for(const period of ['season','3','5'])for(const p of M.rows('players',period).filter(p=>p.shotComplete).slice(0,40)){const e=c.FantasyShots.eventsOf(p.shotKeys);assert.equal(e.length,sum(p.attempts),p.PID);checkBin(e,p.PID+' '+period);}
});
test('Dynamic scale is per chart: same count, same radius inside one chart; a lone shot fills maxRadius; grouping ignores screen size',()=>{
 const a=Z.bin([{x:0,y:300,zone:3},{x:0,y:300,zone:3},{x:500,y:600,zone:9}]);
 assert.equal(a.max,2);assert.ok(Math.abs(a.cells[1].radius-Z.MAX_R)<1e-9||Math.abs(a.cells[0].radius-Z.MAX_R)<1e-9);
 const big=a.cells.find(x=>x.n===2),small=a.cells.find(x=>x.n===1);assert.ok(Math.abs(small.radius**2*2-big.radius**2)<1e-9);
 assert.equal(JSON.stringify(Z.bin(allEvents())),JSON.stringify(Z.bin(allEvents())),'deterministic, no viewport input');
 const lone=Z.bin([{x:10,y:10,zone:0}]);assert.ok(Math.abs(lone.cells[0].radius-Z.MAX_R)<1e-9);
 /* cell straddling two true zones keeps both */
 const two=Z.bin([{x:0,y:124,zone:0},{x:0,y:126,zone:1}]);assert.equal(sum(two.cells.map(x=>x.n)),2);
});
test('Rendered Shooting: Hex default, Shots on the same data and geometry',()=>{
 for(const period of ['season','3','5']){
  const t=M.rows('teams',period)[0],q={...t,M1:t.OM1,A1:t.OA1,M2:t.OM2,A2:t.OA2,M3:t.OM3,A3:t.OA3},html=c.FantasyViz.shooting(q,{team:true,model:null});
  const hexSvg=html.match(/<svg[^>]*data-shotview="hex"[\s\S]*?<\/svg>/)[0],shotSvg=html.match(/<svg[^>]*data-shotview="shots"[\s\S]*?<\/svg>/)[0],ev=c.FantasyShots.eventsOf(t.shotKeys);
  assert.ok(!/^<svg[^>]*hidden/.test(hexSvg)&&/^<svg[^>]*hidden/.test(shotSvg),'Hex is the default');
  assert.equal((hexSvg.match(/<polygon/g)||[]).length,Z.bin(ev).cells.length);
  assert.equal((shotSvg.match(/<circle class="sz-made"/g)||[]).length,ev.filter(e=>e.made).length);assert.equal((shotSvg.match(/<circle class="sz-miss"/g)||[]).length,ev.filter(e=>!e.made).length);
  const vb=s=>s.match(/viewBox="[^"]+"/)[0],court=s=>s.match(/<g class="sz-borders"[\s\S]*?<\/g><g class="sz-lines"[\s\S]*?<\/g>/)[0];
  assert.equal(vb(hexSvg),vb(shotSvg));assert.equal(court(hexSvg),court(shotSvg));
  assert.ok(html.includes('class="sz-head"')&&!html.includes('pc-section-head'),'switch is not inside the element the workbench CSS hides');
  assert.ok(html.includes('aria-pressed="true">Hex<')&&html.includes('>Shots<'));
 }
 const bad=c.FantasyViz.shooting({made:Array(12).fill(0),attempts:Array(12).fill(0),shotKeys:[['nope','X']],Gm:1,M1:0,A1:0,M2:0,A2:0,M3:0,A3:0},{team:false});assert.ok(bad.includes('fw-empty'),'missing data is not drawn as zero');
});const S5=(rows,k)=>Array.from({length:12},(_,i)=>rows.reduce((n,t)=>n+t[k][i],0));
const modelFor=(kind,period)=>{const teams=M.rows('teams',period).filter(x=>x.shotComplete);return c.ShotZones.model(S5(teams,'made'),S5(teams,'attempts'));};
test('League FG% per zone is Σ made / Σ attempts of the period, not a mean of rates',()=>{
 for(const period of ['season','3','5']){const teams=M.rows('teams',period).filter(t=>t.shotComplete),mdl=modelFor('players',period);
  for(let z=0;z<12;z++){const m=teams.reduce((n,t)=>n+t.made[z],0),a=teams.reduce((n,t)=>n+t.attempts[z],0);assert.equal(mdl[z].p0,m/a);assert.equal(mdl[z].attempts,a);assert.equal(mdl[z].made,m);}
  const all=allEvents();if(period==='season')for(let z=0;z<12;z++)assert.equal(mdl[z].attempts,all.filter(e=>e.zone===z).length,'league sample = every shot');}
});
test('Grading: fixed gap bands −10/−5/+5/+10 pp on the recorded FG%, exact boundaries, no shrinkage',()=>{
 assert.equal(JSON.stringify(Array.from(Z.GAP_CUTS)),JSON.stringify([-10,-5,5,10]));
 const lg=Z.model(Array(12).fill(40),Array(12).fill(100)),lv=(m,n)=>Z.grade(lg[7],m,n).level;
 assert.equal(lv(29.9,100),0);assert.equal(lv(30,100),1,'−10 exactly → bad');assert.equal(lv(34.9,100),1);assert.equal(lv(35,100),2,'−5 exactly → average');
 assert.equal(lv(40,100),2);assert.equal(lv(44.9,100),2);assert.equal(lv(45,100),3,'+5 exactly → good');assert.equal(lv(49.9,100),3);assert.equal(lv(50,100),4,'+10 exactly → very good');
 /* exact arithmetic where floating point would drift: 23/60 − 1/3 = +5 pp */
 assert.equal(Z.grade(Z.model(Array(12).fill(1),Array(12).fill(3))[0],23,60).level,3);
 const gr=Z.grade(lg[0],3,3);assert.equal(gr.level,4);assert.ok(Math.abs(gr.gap-60)<1e-9,'recorded 3/3 is graded as recorded, no shrinkage');
 assert.equal(Z.grade(lg[0],0,0),null,'no attempts: no grade');assert.equal(Z.grade(Z.model(Array(12).fill(0),Array(12).fill(0))[0],5,10),null,'no league sample: no grade');
 let prev=-1;for(let m=0;m<=40;m++){const l=Z.grade(lg[3],m,40).level;assert.ok(l>=prev);prev=l;}
 /* same FG% and same gap → same grade whatever the attempts or the league volume */
 let tested=0;for(const kind of ['players','teams'])for(const period of ['season','3','5']){const mdl=modelFor(kind,period);for(const e of M.rows(kind,period).filter(x=>x.shotComplete))for(let z=0;z<12;z++){const n=e.attempts[z];if(!n||!mdl[z].attempts)continue;const a=Z.grade(mdl[z],e.made[z],n),b=Z.grade(mdl[z],4*e.made[z],4*n),big=Z.grade(Z.model(Array(12).fill(1000*mdl[z].made),Array(12).fill(1000*mdl[z].attempts))[z],e.made[z],n);assert.equal(a.level,b.level);assert.equal(a.level,big.level,'league volume does not move the bands');tested++;}}
 assert.ok(tested>4000);
 assert.equal(Z.levelColor(0),Z.LEVEL_COLORS[0]);assert.equal(Z.levelColor(4),Z.LEVEL_COLORS[4]);assert.equal(Z.levelColor(2),Z.NEUTRAL);assert.equal(Z.levelColor(null),Z.NEUTRAL);assert.equal(Z.LEVEL_COLORS[4],'#38b27f');assert.ok(Z.LEVEL_COLORS[0].startsWith('#d'));
 /* teams: opponents shooting far above the league = very bad defence = green; far below = very good defence = red */
 assert.equal(Z.levelName(4,true),'very bad');assert.equal(Z.levelName(0,true),'very good');assert.equal(Z.levelName(4,false),'very good');assert.equal(Z.levelName(2,true),'average');
});

test('Defensive zone ranks use raw FG%, exact ties, valid denominators, and all teams',()=>{
 const entities=Array.from({length:20},(_,i)=>({shotComplete:true,made:Array(12).fill(10+i),attempts:Array(12).fill(100)}));
 for(const [i,e] of entities.entries())for(const group of Object.values(Z.teamRanks(e.made,e.attempts,entities)))for(const r of group){assert.equal(r.rank,i+1);assert.equal(r.n,20);}
 const ties=[{shotComplete:true,made:Array(12).fill(1),attempts:Array(12).fill(3)},{shotComplete:true,made:Array(12).fill(2),attempts:Array(12).fill(6)},{shotComplete:true,made:Array(12).fill(2),attempts:Array(12).fill(3)}];
 assert.equal(Z.teamRanks(ties[1].made,ties[1].attempts,ties).zones[0].rank,1);
 assert.equal(Z.teamRanks(ties[2].made,ties[2].attempts,ties).zones[0].rank,3);
 const noShots={shotComplete:true,made:Array(12).fill(0),attempts:Array(12).fill(0)};
 assert.equal(Z.teamRanks(noShots.made,noShots.attempts,[...ties,noShots]).zones[0],null);
 assert.equal(Z.teamRanks(ties[0].made,ties[0].attempts,[...ties,noShots,{...ties[0],shotComplete:false}]).zones[0].n,3);
});

test('Teams show rank in all 12 zones and the 3 summary boxes; Players do not',()=>{
 for(const period of ['season','3','5']){
  const teams=M.rows('teams',period).filter(t=>t.shotComplete),t=teams[0],html=c.FantasyViz.shooting({...t,M1:t.OM1,A1:t.OA1,M2:t.OM2,A2:t.OA2,M3:t.OM3,A3:t.OA3},{team:true,model:modelFor('teams',period),cohort:teams});
  assert.equal((html.match(/class="sz-area-rank"/g)||[]).length,3);
  assert.equal((html.match(/class="sz-zone-rank"/g)||[]).length,24);
  const rr=Z.teamRanks(t.made,t.attempts,teams);
  for(const r of rr.zones)if(r)assert.ok(html.includes('#'+r.rank+' / '+r.n));
  const p=M.rows('players',period).find(p=>p.shotComplete),ph=c.FantasyViz.shooting(p,{team:false,model:modelFor('players',period),cohort:teams});
  assert.ok(!ph.includes('sz-zone-rank')&&!ph.includes('sz-area-rank'));
 }
});
test('Rendered Shooting: three area boxes, 12 labels, zone-graded hexes, sums 12 → 6 → 3 agree',()=>{
 for(const kind of ['teams','players'])for(const period of ['season','3','5']){
  const rows=M.rows(kind,period).filter(r=>r.shotComplete),mdl=modelFor(kind,period);
  for(const r of rows.slice(0,8)){const q=kind==='teams'?{...r,M1:r.OM1,A1:r.OA1,M2:r.OM2,A2:r.OA2,M3:r.OM3,A3:r.OA3}:r,html=c.FantasyViz.shooting(q,{team:kind==='teams',model:mdl});
   const roll=Z.rollup(r.made,r.attempts);
   for(const m of roll.mains){const subs=roll.subs.filter(s=>s.main===m.key);assert.equal(subs.reduce((n,s)=>n+s.att,0),m.att);assert.equal(subs.reduce((n,s)=>n+s.made,0),m.made);
    const zs=roll.zones.filter(zn=>m.ids.includes(zn.i));assert.equal(zs.reduce((n,s)=>n+s.att,0),m.att);
    assert.ok(html.includes('<span>'+m.name+'</span><strong>'+(m.att?m.fg.toFixed(1)+'%':'—')+'</strong><small>'+m.made+'/'+m.att+'</small>'),m.name);}
   assert.equal(html.split('class="sz-area"').length-1,3);assert.equal(html.split('class="sz-label"').length-1,24,'12 labels in each of the 2 views');
   const bad=roll.zones.filter(zn=>!zn.att).length;assert.equal((html.match(/>—<\/text>/g)||[]).length,2*bad,'no attempts show a dash, not 0%');
   assert.ok(html.indexOf('sz-areas')<html.indexOf('<svg'),'boxes sit above the chart');
  }}
});
