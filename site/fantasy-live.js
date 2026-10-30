/* Pick n Edge · Fantasy · live δεδομένα
   Χτίζει τα δεδομένα του Fantasy από τους αγώνες που κατεβάζει το betting-live-data.js (επίσημα box score
   και play-by-play της EuroLeague). Δεν κάνει δικά του αιτήματα. Ξαναχτίζει σε κάθε ενημέρωση του BettingLive.

   Παράγει, με το ίδιο σχήμα που διάβαζε μέχρι τώρα το site από τα χειροκίνητα αρχεία:
   - FANTASY_DATA (Season) και FANTASY_PERIOD_DATA['3'|'5'] (Last 3 / Last 5)
   - FANTASY_HISTORY (γραμμές ανά αγώνα, για καμπύλες, «Λεπτά & ρόλος» και Matchup)
   - FANTASY_MATCHUP, FANTASY_FIXTURES, FANTASY_SCHEDULE (τι έδωσε κάθε ομάδα σε G/F/C, πρόγραμμα με Turn)

   Κανόνες (METRICS.md):
   - Last N = οι τελευταίοι N αγώνες της ομάδας. Το GP του παίκτη = σε πόσους από αυτούς έπαιξε.
   - Όλα τα ποσοστά και τα «ανά 100» από αθροίσματα του δείγματος.
   - Κατοχές στο γήπεδο ≈ Σ(μερίδιο λεπτών × κατοχές ομάδας), όπως στο Betting. Ακριβείς πεντάδες έρχονται στο Βήμα 2.
   - USG% = (FGA + 0,44·FTA + TOV) ÷ Σ(μερίδιο × ίδια μεγέθη ομάδας), ίδιος τύπος με το Betting.
   - Ζώνες σουτ: μένουν από το στιγμιότυπο 3StepsBasket (FANTASY_SNAPSHOT) μέχρι το Βήμα 3.
*/
(function(g){
'use strict';
const SNAP={data:g.FANTASY_DATA,period:g.FANTASY_PERIOD_DATA,history:g.FANTASY_HISTORY,fixtures:g.FANTASY_FIXTURES||[]};
g.FANTASY_SNAPSHOT=SNAP;
const r2=v=>Math.round(v*100)/100;
const div=(a,b,k=1)=>b>0?k*a/b:null;
const TEAM_FIELDS=['M1','A1','M2','A2','M3','A3','OR','DR','As','St','Tv','Bl','FC'];
const MATCHUP_KEYS=['min','m2','a2','m3','a3','m1','a1','or','dr','as','st','tv','bl','fd','pf','ba','pir'];
/* Κωδικός EuroLeague → PID για τους παίκτες που υπήρχαν πριν (κρατά τα ★ που έχουν ήδη αποθηκευτεί). */
const KNOWN_IDS={"009846":"elijah-bryant","003469":"aleksandar-vezenkov","007027":"theo-maledon","010042":"jean-montero","011286":"dwayne-bacon","008987":"zach-leday","003842":"mathias-lessort","014108":"aliou-fadiala-diarra","012878":"moses-wright","012707":"marcus-joshua-carr","012731":"mbaye-ndiaye","006661":"scottie-wilbekin","014168":"braxton-key","008192":"azuolas-tubelis","011247":"feliz-andres","011982":"semi-ojeleye","008099":"matthew-strazel","011212":"elie-okobo","011052":"yam-madar","004554":"ante-zizic","012609":"collin-malcolm","000898":"jonas-valanciunas","007975":"sylvain-francisco","013699":"jimmy-clark-iii","012613":"mikael-jantunen","012608":"tj-shorts-ii","012796":"mfiondu-kabengele","013369":"carlik-jones","000796":"nikola-mirotic","014008":"justin-robinson","015143":"tyson-etienne","006643":"josep-puerto","007960":"dejan-davidovac","012611":"sebastian-herrera","003526":"david-lighty","013373":"leo-cavaliere","010262":"nikola-djurisic","003733":"alberto-abalde","002328":"marius-grigonis","002580":"vasilije-micic","009863":"wade-baldwin-iv","012640":"nadir-hifi","009862":"kevin-xavier-punter","009048":"codi-miller-mcintyre","014737":"wendell-moore-jr","015164":"hugo-besson","007866":"konstantinos-mitoglou","008962":"nigel-hayes","003112":"dario-saric","012788":"daniel-oturu","012403":"mouhamed-faye","010390":"kevarrius-hayes","010568":"chris-jones","013363":"jordan-nwora","003941":"nikola-milutinov","007831":"shavon-shields","014213":"cameron-payne"};
const state={ready:false,through:0,games:0,players:0,builtAt:null,pirExact:false,error:null};

/* ---------- ταυτότητα παικτών ---------- */
const strip=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'');
const slug=s=>strip(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const title=s=>String(s||'').toLowerCase().replace(/(^|[\s\-'’.])([a-zà-ÿ])/g,(m,a,b)=>a+b.toUpperCase());
function splitName(name){const [last,first]=String(name||'').split(',').map(x=>x.trim());return first?{Fn:title(first),Sn:title(last)}:{Fn:'',Sn:title(last)};}
function identity(){
 const map={...KNOWN_IDS};const snapPlayers=SNAP.data?.players||[];
 for(const [code,pid] of Object.entries(SNAP.history?.identityMap||{}))map[code.replace(/^P/,'')]=pid;
 return {map,byPid:Object.fromEntries(snapPlayers.map(p=>[p.PID,p]))};}

/* ---------- αγώνες ---------- */
function games(L){
 const X=Object.fromEntries(L.PFIELDS.map((k,i)=>[k,i+1])),hasBA='BA' in X;
 const list=Object.values(L.records()).filter(r=>r.players&&r.sides).sort((a,b)=>a.round-b.round||String(a.date).localeCompare(String(b.date))||a.code-b.code);
 const out=[];
 for(const r of list)for(const [me,op] of [[r.home,r.away],[r.away,r.home]]){
  const cid=L.cid[me],ocid=L.cid[op];if(!cid||!ocid)continue;
  const s=r.sides[me],o=r.sides[op];
  const rows=(r.players[me]||[]).map(x=>({id:x[0],GS:x[X.GS],Sec:x[X.Sec],M2:x[X.M2],A2:x[X.A2],M3:x[X.M3],A3:x[X.A3],M1:x[X.M1],A1:x[X.A1],OR:x[X.OR],DR:x[X.DR],As:x[X.As],St:x[X.St],Tv:x[X.Tv],BF:x[X.Bl],FR:x[X.FD],FC:x[X.PF],BA:hasBA?x[X.BA]:0}));
  out.push({code:r.code,round:r.round,date:r.date,sec:r.sec,cid,ocid,home:me===r.home,src:r.src,s,o,rows,orows:null});}
 const byKey=new Map(out.map(x=>[x.code+'|'+x.cid,x]));
 for(const x of out)x.orows=byKey.get(x.code+'|'+x.ocid)?.rows||[];
 return {list:out,hasBA};}
const pirOf=x=>x.M1+2*x.M2+3*x.M3+x.OR+x.DR+x.As+x.St+x.BF+x.FR-(x.A2-x.M2)-(x.A3-x.M3)-(x.A1-x.M1)-x.Tv-x.FC-x.BA;
const ptsOf=x=>x.M1+2*x.M2+3*x.M3;

/* ---------- σύνολα ---------- */
function teamTotals(gs){
 const t={Sec:0,Gm:gs.length,OfPo:0,DePo:0};for(const f of TEAM_FIELDS){t['T'+f]=0;t['O'+f]=0;}
 for(const x of gs){t.Sec+=x.sec;t.OfPo+=x.s.Po;t.DePo+=x.o.Po;for(const f of TEAM_FIELDS){t['T'+f]+=x.s[f]||0;t['O'+f]+=x.o[f]||0;}}
 t.TSA=r2(t.TA2+t.TA3+0.44*t.TA1);t.OSA=r2(t.OA2+t.OA3+0.44*t.OA1);
 for(const k of ['OfPo','DePo'])t[k]=r2(t[k]);return t;}
function playerTotals(rows){
 const p={Gm:0,Sec:0,M1:0,A1:0,M2:0,A2:0,M3:0,A3:0,OR:0,DR:0,As:0,St:0,Tv:0,BF:0,BA:0,FC:0,FR:0,GS:0,OfPo:0,DePo:0,TSA:0,TTv:0};
 for(const f of TEAM_FIELDS){p['T'+f]=0;p['O'+f]=0;}
 for(const {x,gm} of rows){if(!(x.Sec>0))continue;p.Gm++;p.GS+=x.GS?1:0;
  for(const k of ['Sec','M1','A1','M2','A2','M3','A3','OR','DR','As','St','Tv','BF','BA','FC','FR'])p[k]+=x[k]||0;
  const share=x.Sec/gm.sec;p.OfPo+=share*gm.s.Po;p.DePo+=share*gm.o.Po;
  p.TSA+=share*(gm.s.A2+gm.s.A3+0.44*gm.s.A1);p.TTv+=share*gm.s.Tv;
  for(const f of TEAM_FIELDS){p['T'+f]+=share*(gm.s[f]||0);p['O'+f]+=share*(gm.o[f]||0);}}
 p.SA=r2(p.A2+p.A3+0.44*p.A1);
 for(const k of ['OfPo','DePo','TSA','TTv',...TEAM_FIELDS.flatMap(f=>['T'+f,'O'+f])])p[k]=r2(p[k]);
 return p;}

/* ---------- σειρές ιστορικού ---------- */
function statRow(x){const pts=ptsOf(x),fga=x.A2+x.A3;return {M1:x.M1,A1:x.A1,M2:x.M2,A2:x.A2,M3:x.M3,A3:x.A3,OR:x.OR,DR:x.DR,As:x.As,St:x.St,Tv:x.Tv,BF:x.BF,BA:x.BA,FC:x.FC,FR:x.FR,
 points:pts,pir:pirOf(x),rebounds:x.OR+x.DR,assists:x.As,netSfp:x.OR+x.DR+x.As+x.St+x.BF+x.FR-x.FC-x.BA-x.Tv,
 ftr:div(x.A1,fga,100),efg:div(x.M2+1.5*x.M3,fga,100),two:div(x.M2,x.A2,100),three:div(x.M3,x.A3,100),ft:div(x.M1,x.A1,100)};}
const url=code=>'https://live.euroleague.net/api/Boxscore?gamecode='+code+'&seasoncode=E2026';
function teamSide(side,rows,sec){const sum=k=>rows.reduce((n,y)=>n+(y[k]||0),0);const x={M1:side.M1,A1:side.A1,M2:side.M2,A2:side.A2,M3:side.M3,A3:side.A3,OR:side.OR,DR:side.DR,As:side.As,St:side.St,Tv:side.Tv,BF:side.Bl,BA:sum('BA'),FC:side.FC,FR:sum('FR')};
 const r=statRow(x);r.minutes=Math.round(sec*5/60);return r;}/* PIR ομάδας = επίσημο valuation ομάδας (μαζί με ριμπάουντ/λάθη ομάδας) */

/* ---------- πρόγραμμα ---------- */
const athensDay=d=>{try{return new Date(d).toLocaleDateString('sv-SE',{timeZone:'Europe/Athens'});}catch{return String(d).slice(0,10);}};
function fixtures(L,list){
 const played=new Map();for(const x of list)if(x.home)played.set(x.code,{round:x.round,home:x.cid,away:x.ocid,date:x.date,code:x.code,played:true});
 const all=new Map();
 for(const f of SNAP.fixtures)all.set(f.round+'|'+f.home+'|'+f.away,{...f});
 for(const x of (L.schedule()||[])){const home=L.cid[x.home],away=L.cid[x.away];if(!home||!away)continue;all.set(x.round+'|'+home+'|'+away,{round:Number(x.round),home,away,date:x.date,code:x.code});}
 for(const f of played.values())all.set(f.round+'|'+f.home+'|'+f.away,{...(all.get(f.round+'|'+f.home+'|'+f.away)||{}),...f,date:all.get(f.round+'|'+f.home+'|'+f.away)?.date||f.date});
 const arr=[...all.values()].map(f=>({...f,played:Boolean(f.played)||[...played.values()].some(p=>p.round===f.round&&p.home===f.home&&p.away===f.away)}));
 const byRound={};arr.forEach(f=>{(byRound[f.round]=byRound[f.round]||[]).push(f)});
 for(const fs of Object.values(byRound)){const days=[...new Set(fs.map(f=>athensDay(f.date)))].sort();fs.forEach(f=>f.turn=days.indexOf(athensDay(f.date))+1);}
 return arr.sort((a,b)=>a.round-b.round||String(a.date).localeCompare(String(b.date)));}

/* ---------- κύριο χτίσιμο ---------- */
function build(){
 const L=g.BettingLive;if(!L||!SNAP.data)return false;
 const {list,hasBA}=games(L);if(!list.length)return false;
 const {map,byPid}=identity(),info=L.info||{};
 const teamsSnap=SNAP.data.teams||[],teamName=cid=>teamsSnap.find(t=>t.id===cid)?.name||cid,clName=cid=>(SNAP.data.raw||[]).find(t=>t.CID===cid)?.Cl||teamName(cid);
 const through=Math.max(...list.map(x=>x.round));
 const byTeam={};for(const x of list)(byTeam[x.cid]=byTeam[x.cid]||[]).push(x);
 const pidOf=id=>{if(map[id])return map[id];const nm=splitName(info[id]?.name);return slug(nm.Fn+' '+nm.Sn)||'p'+id;};
 /* γραμμές ανά παίκτη */
 const lines={};for(const x of list)for(const y of x.rows){const pid=pidOf(y.id);(lines[pid]=lines[pid]||{id:y.id,rows:[]}).rows.push({x:y,gm:x});}
 const currentTeam=pid=>{const r=lines[pid].rows;return r[r.length-1].gm.cid;};
 const windows={season:null,'3':3,'5':5};const out={};
 for(const [key,n] of Object.entries(windows)){
  const codes={};for(const [cid,gs] of Object.entries(byTeam))codes[cid]=new Set((n?gs.slice(-n):gs).map(x=>x.code));
  const inWin=gm=>codes[gm.cid]?.has(gm.code);
  const snapSet=key==='season'?SNAP.data:SNAP.period?.[key];const snapBy=Object.fromEntries((snapSet?.players||[]).map(p=>[p.PID,p]));
  const players=[];
  for(const [pid,P] of Object.entries(lines)){const rows=P.rows.filter(r=>inWin(r.gm));const t=playerTotals(rows);if(!t.Gm)continue;
   const base=snapBy[pid]||byPid[pid],cid=currentTeam(pid),nm=splitName(info[P.id]?.name),pos=base?.Pos||info[P.id]?.pos||'';
   const p={...(base||{made:Array(11).fill(0),attempts:Array(11).fill(0),assists:Array(11).fill(0),shotGames:0,shotPoss:0}),
    PID:pid,code:P.id,Fn:base?.Fn||nm.Fn,Sn:base?.Sn||nm.Sn,He:base?.He||(info[P.id]?.height?info[P.id].height/100:null),Pos:pos,CID:cid,Cl:clName(cid),label:base?.label||nm.Sn,...t,noSample:false};
   for(const k of ['OfPl','DePl','PA','TPA','OPA'])delete p[k];
   if(!snapBy[pid]){p.made=Array(11).fill(0);p.attempts=Array(11).fill(0);p.assists=Array(11).fill(0);p.shotGames=0;p.shotPoss=0;}
   players.push(p);}
  const raw=Object.entries(byTeam).map(([cid,gs])=>({CID:cid,Cl:clName(cid),...teamTotals(gs.filter(inWin))}));
  const teams=teamsSnap.map(t=>{const rw=raw.find(r=>r.CID===t.id);return {...t,games:rw?.Gm||0,pace:rw?div(rw.OfPo+rw.DePo,rw.Sec,1200):null};});
  const rounds=list.filter(inWin).map(x=>x.round);
  out[key]={players,raw,teams,teamShots:snapSet?.teamShots||SNAP.data.teamShots,teamThroughRound:through,playerThroughRound:through,fromRound:Math.min(...rounds),toRound:Math.max(...rounds),live:true};}
 /* ιστορικό */
 const histPlayers={},histTeams={},missingByPlayer={},missingByTeam={};
 for(const [pid,P] of Object.entries(lines)){const cid=currentTeam(pid),own=new Map(P.rows.map(r=>[r.gm.code+'|'+r.gm.cid,r]));
  const gamesOf=[...new Set([...P.rows.map(r=>r.gm),...(byTeam[cid]||[])])].sort((a,b)=>a.round-b.round||String(a.date).localeCompare(String(b.date)));
  histPlayers[pid]=gamesOf.map(gm=>{const r=own.get(gm.code+'|'+gm.cid),played=Boolean(r&&r.x.Sec>0);const base={game:gm.code,round:gm.round,date:gm.date,opponent:teamName(gm.ocid),home:gm.home,source:'EuroLeague',url:url(gm.code)};
   if(!played)return {...base,M1:0,A1:0,M2:0,A2:0,M3:0,A3:0,OR:0,DR:0,As:0,St:0,Tv:0,BF:0,BA:0,FC:0,FR:0,minutes:null,points:0,pir:0,rebounds:0,assists:0,netSfp:0,ftr:null,efg:null,two:null,three:null,ft:null,played:false};
   return {...base,...statRow(r.x),minutes:r.x.Sec/60,starter:Boolean(r.x.GS),played:true};});
  missingByPlayer[pid]=[];}
 for(const [cid,gs] of Object.entries(byTeam)){missingByTeam[cid]=[];
  histTeams[cid]=gs.map(gm=>{const me=teamSide(gm.s,gm.rows,gm.sec),op=teamSide(gm.o,gm.orows,gm.sec);
   const byPos={G:0,F:0,C:0},cover={known:0,total:gm.orows.filter(y=>y.Sec>0).length};
   for(const y of gm.orows){if(!(y.Sec>0))continue;const pos=info[y.id]?.pos;if(byPos[pos]===undefined)continue;byPos[pos]+=pirOf(y);cover.known++;}
   return {game:gm.code,round:gm.round,date:gm.date,opponent:teamName(gm.ocid),home:gm.home,source:'EuroLeague',url:url(gm.code),...me,
    opponentStats:op,oppTwo:op.two,oppThree:op.three,oppFt:op.ft,oppPoints:op.points,oppAssists:op.assists,oppEfg:op.efg,oppFtr:op.ftr,
    drebPct:div(gm.s.DR,gm.s.DR+gm.o.OR,100),oppPir:op.pir,pirByPosition:byPos,positionCoverage:cover,possessions:{own:gm.s.Po,opp:gm.o.Po,source:gm.src}};});}
 const identityMap={};for(const P of Object.values(lines))identityMap['P'+P.id]=pidOf(P.id);
 /* matchup */
 const mteams={};
 for(const [cid,gs] of Object.entries(byTeam))mteams[cid]=gs.map(gm=>{const allow={G:MATCHUP_KEYS.map(()=>0),F:MATCHUP_KEYS.map(()=>0),C:MATCHUP_KEYS.map(()=>0)};
  for(const y of gm.orows){const pos=info[y.id]?.pos;if(!allow[pos]||!(y.Sec>0))continue;
   const v=[y.Sec/60,y.M2,y.A2,y.M3,y.A3,y.M1,y.A1,y.OR,y.DR,y.As,y.St,y.Tv,y.BF,y.FR,y.FC,y.BA,pirOf(y)];v.forEach((n,i)=>allow[pos][i]+=n);}
  for(const p in allow)allow[p]=allow[p].map(r2);
  return {round:gm.round,opp:gm.ocid,home:gm.home,po:gm.s.Po,opo:gm.o.Po,allow};});
 const fx=fixtures(L,list);
 /* δημοσίευση */
 g.FANTASY_DATA=out.season;g.FANTASY_PERIOD_DATA={'3':out['3'],'5':out['5']};
 g.FANTASY_HISTORY={season:'2026/27',throughRound:through,source:'EuroLeague official boxscores (live)',retrievedAt:new Date().toISOString(),missingGames:[],missingByTeam,missingByPlayer,players:histPlayers,teams:histTeams,identityMap};
 g.FANTASY_MATCHUP={through,keys:MATCHUP_KEYS,teams:mteams,live:true};
 g.FANTASY_FIXTURES=fx;g.FANTASY_SCHEDULE=fx.map(f=>[f.round,f.home,f.away]);
 Object.assign(state,{ready:true,through,games:list.length/2,players:out.season.players.length,builtAt:new Date().toISOString(),pirExact:hasBA,error:null});
 g.FANTASY_LIVE=state;
 return true;}

function rebuild(){try{if(!build())return;}catch(e){state.error=String(e.message||e);g.FANTASY_LIVE=state;console.error('[fantasy-live]',e);return;}
 try{g.dispatchEvent(new CustomEvent('fantasy-live',{detail:state}));}catch{}}
g.FantasyLive={state,rebuild,build};
rebuild();
try{g.addEventListener('betting-live',e=>{if(e.detail?.status==='loading')return;rebuild();});}catch{}
})(globalThis);
