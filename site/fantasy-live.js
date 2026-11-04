/* Pick n Edge · Fantasy · live δεδομένα
   Χτίζει τα δεδομένα του Fantasy από τους αγώνες της κοινής μηχανής euroleague-data.js (επίσημα box score
   και play-by-play της EuroLeague). Δεν κάνει δικά του αιτήματα. Ξαναχτίζει σε κάθε ενημέρωση της μηχανής (event euroleague-data).

   Παράγει, με το ίδιο σχήμα που διάβαζε μέχρι τώρα το site από τα χειροκίνητα αρχεία:
   - FANTASY_DATA (Season) και FANTASY_PERIOD_DATA['3'|'5'] (Last 3 / Last 5)
   - FANTASY_HISTORY (γραμμές ανά αγώνα, για καμπύλες, «Λεπτά & ρόλος» και Matchup)
   - FANTASY_MATCHUP, FANTASY_FIXTURES, FANTASY_SCHEDULE (τι έδωσε κάθε ομάδα σε G/F/C, πρόγραμμα με Turn)

   Κανόνες (METRICS.md):
   - Last N = οι τελευταίοι N αγώνες της ομάδας. Το GP του παίκτη = σε πόσους από αυτούς έπαιξε.
   - Όλα τα ποσοστά και τα «ανά 100» από αθροίσματα του δείγματος.
   - Κατοχές στο γήπεδο ≈ Σ(μερίδιο λεπτών × κατοχές ομάδας), όπως στο Betting. Ακριβείς πεντάδες έρχονται στο Βήμα 2.
   - USG% = (FGA + 0,44·FTA + TOV) ÷ Σ(μερίδιο × ίδια μεγέθη ομάδας), ίδιος τύπος με το Betting.
   - Ζώνες σουτ, θέσεις και ύψη: επίσημα δεδομένα EuroLeague. Ομάδες και σήματα: team-assets.js.
*/
(function(g){
'use strict';
const TEAMS=g.PICKNEDGE_TEAMS||[];
/* Κοινοί ορισμοί δεικτών (METRICS.md) από τη μηχανή· το Betting χρησιμοποιεί τους ίδιους. */
const M=g.EuroLeagueData.metrics,{r2,div}=M,pirOf=M.pir,ptsOf=M.pts;
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
function identity(){return {map:{...KNOWN_IDS}};}

/* ---------- επιλεξιμότητα παικτών ----------
   Ίδιοι ορισμοί με τα Last 3 / Last 5 του συστήματος: δείγμα = οι τελευταίοι N ολοκληρωμένοι αγώνες της ομάδας του παίκτη,
   GP = αγώνες με χρόνο > 0, MIN/game = Σ λεπτά ÷ GP, PIR/game = Σ PIR ÷ GP (τα γραμμικά PIR αθροίζονται ανά αγώνα).
   Υπολογίζεται μόνο από τα βασικά δεδομένα (Sec και στατιστικά ανά αγώνα), πριν από οποιαδήποτε βαριά ανάλυση ή chart,
   και δεν εξαρτάται από το επιλεγμένο tab. Τιμή που δεν είναι αριθμός = ελλιπές δεδομένο: ούτε συμμετοχή, ούτε μηδέν.
   Κανόνας: GP3≥1 AND MIN3≥10 AND ((GP5≥3 AND PIR5≥5) OR PIR3≥5). Οι συγκρίσεις γίνονται με αθροίσματα (χωρίς διαίρεση/στρογγυλοποίηση). */
const ELIGIBLE={gp5:3,gp3:1,min3:10,pir:5};
const played=sec=>Number.isFinite(sec)&&sec>0;
function windowStats(games){let gp=0,sec=0,pir=0,pirOk=true;for(const x of games){if(!played(x.sec))continue;gp++;sec+=x.sec;if(Number.isFinite(x.pir))pir+=x.pir;else pirOk=false;}return {gp,sec,pir:pirOk?pir:null};}
/* teamGames: για κάθε ολοκληρωμένο αγώνα της ομάδας (παλιότερος πρώτα) {sec,pir} του παίκτη· {sec:0} όταν δεν αγωνίστηκε. */
function eligibility(teamGames){
 const w5=windowStats(teamGames.slice(-5)),w3=windowStats(teamGames.slice(-3));
 const c1=w5.gp>=ELIGIBLE.gp5,c2=w3.gp>=ELIGIBLE.gp3,c3=w3.gp>0&&w3.sec>=ELIGIBLE.min3*60*w3.gp;
 const c4a=w5.gp>0&&w5.pir!==null&&w5.pir>=ELIGIBLE.pir*w5.gp,c4b=w3.gp>0&&w3.pir!==null&&w3.pir>=ELIGIBLE.pir*w3.gp;
 return {eligible:c2&&c3&&((c1&&c4a)||c4b),gp5:w5.gp,gp3:w3.gp,min3:w3.gp?w3.sec/60/w3.gp:null,pir5:w5.gp&&w5.pir!==null?w5.pir/w5.gp:null,pir3:w3.gp&&w3.pir!==null?w3.pir/w3.gp:null,c1,c2,c3,c4:c4a||c4b};}
/* ---------- αγώνες ---------- */
function games(L){
 const X=Object.fromEntries(L.PFIELDS.map((k,i)=>[k,i+1])),hasBA='BA' in X;
 const list=Object.values(L.records()).filter(r=>r.players&&r.sides).sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.round-b.round||a.code-b.code);
 const out=[];
 for(const r of list)for(const [me,op] of [[r.home,r.away],[r.away,r.home]]){
  const cid=L.cid[me],ocid=L.cid[op];if(!cid||!ocid)continue;
  const s=r.sides[me],o=r.sides[op];
  const rows=(r.players[me]||[]).map(x=>({id:x[0],GS:x[X.GS],Sec:x[X.Sec],M2:x[X.M2],A2:x[X.A2],M3:x[X.M3],A3:x[X.A3],M1:x[X.M1],A1:x[X.A1],OR:x[X.OR],DR:x[X.DR],As:x[X.As],St:x[X.St],Tv:x[X.Tv],BF:x[X.Bl],FR:x[X.FD],FC:x[X.PF],BA:hasBA?x[X.BA]:0}));
  out.push({code:r.code,round:r.round,date:r.date,sec:r.sec,cid,ocid,home:me===r.home,src:r.src,s,o,rows,orows:null,teamCode:me,oppCode:op,on:r.on?.[me]||null,onErr:r.onErr||(r.on?undefined:'pbp')});}
 const byKey=new Map(out.map(x=>[x.code+'|'+x.cid,x]));
 for(const x of out)x.orows=byKey.get(x.code+'|'+x.ocid)?.rows||[];
 return {list:out,hasBA};}

/* ---------- σύνολα ---------- */
function teamTotals(gs){
 const t={Sec:0,Gm:gs.length,OfPo:0,DePo:0};for(const f of TEAM_FIELDS){t['T'+f]=0;t['O'+f]=0;}
 for(const x of gs){t.Sec+=x.sec;t.OfPo+=x.s.Po;t.DePo+=x.o.Po;for(const f of TEAM_FIELDS){t['T'+f]+=x.s[f]||0;t['O'+f]+=x.o[f]||0;}}
 t.TSA=r2(M.sa({A1:t.TA1,A2:t.TA2,A3:t.TA3}));t.OSA=r2(M.sa({A1:t.OA1,A2:t.OA2,A3:t.OA3}));
 for(const k of ['OfPo','DePo'])t[k]=r2(t[k]);return t;}
function playerTotals(rows){
 const p={Gm:0,Sec:0,M1:0,A1:0,M2:0,A2:0,M3:0,A3:0,OR:0,DR:0,As:0,St:0,Tv:0,BF:0,BA:0,FC:0,FR:0,GS:0,OfPo:0,DePo:0,TSA:0,TTv:0,USA:0,TUSA:0,OnG:0,OfPoR:0,DePoR:0};
 for(const f of TEAM_FIELDS){p['T'+f]=0;p['O'+f]=0;}
 for(const {x,gm} of rows){if(!(x.Sec>0))continue;p.Gm++;p.GS+=x.GS?1:0;
  for(const k of ['Sec','M1','A1','M2','A2','M3','A3','OR','DR','As','St','Tv','BF','BA','FC','FR'])p[k]+=x[k]||0;
  const o=gm.on?.[x.id];if(o){p.OnG++;p.USA+=o[0];p.TUSA+=o[1]+o[2];p.OfPoR+=o[3];p.DePoR+=o[4];}
   const share=x.Sec/gm.sec;p.OfPo+=share*gm.s.Po;p.DePo+=share*gm.o.Po;
  p.TSA+=share*M.sa(gm.s);p.TTv+=share*gm.s.Tv;
  for(const f of TEAM_FIELDS){p['T'+f]+=share*(gm.s[f]||0);p['O'+f]+=share*(gm.o[f]||0);}}
 p.SA=r2(M.sa(p));
 /* Κατοχές στο γήπεδο και USG: πραγματική καταμέτρηση από play-by-play/πεντάδες. Αν λείπει έστω ένας αγώνας του δείγματος: null (εμφανίζεται «—»). */
 for(const k of ['OfPo','DePo','TSA','TTv',...TEAM_FIELDS.flatMap(f=>['T'+f,'O'+f])])p[k]=r2(p[k]);
 p.onCourtExact=p.Gm>0&&p.OnG===p.Gm;
 if(p.onCourtExact){p.OfPo=p.OfPoR;p.DePo=p.DePoR;}else{p.OfPo=null;p.DePo=null;p.USA=null;p.TUSA=null;}
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
 for(const x of (L.schedule()||[])){const home=L.cid[x.home],away=L.cid[x.away];if(!home||!away)continue;all.set(x.round+'|'+home+'|'+away,{round:Number(x.round),home,away,date:x.date,code:x.code});}
 for(const f of played.values())all.set(f.round+'|'+f.home+'|'+f.away,{...(all.get(f.round+'|'+f.home+'|'+f.away)||{}),...f,date:all.get(f.round+'|'+f.home+'|'+f.away)?.date||f.date});
 const arr=[...all.values()].map(f=>({...f,played:Boolean(f.played)||[...played.values()].some(p=>p.round===f.round&&p.home===f.home&&p.away===f.away)}));
 const byRound={};arr.forEach(f=>{(byRound[f.round]=byRound[f.round]||[]).push(f)});
 for(const fs of Object.values(byRound)){const days=[...new Set(fs.map(f=>athensDay(f.date)))].sort();fs.forEach(f=>f.turn=days.indexOf(athensDay(f.date))+1);}
 return arr.sort((a,b)=>a.round-b.round||String(a.date).localeCompare(String(b.date)));}

/* ---------- κύριο χτίσιμο ---------- */
function gsFor(byTeam,id,n){const rows=byTeam[id]||[];return n?rows.slice(-n):rows;}
function shotTotals(gs,ids,opponent){const N=g.ShotZones.COUNT;let made=Array(N).fill(0),attempts=Array(N).fill(0),assisted=Array(N).fill(0),unassisted=Array(N).fill(0),unknown=Array(N).fill(0),covered=0;const shotKeys=[];gs.forEach((gm,i)=>{const team=opponent?gm.oppCode:gm.teamCode,sh=g.FantasyShots?.summary(gm.code,team,ids?.[i]);if(!sh)return;covered++;shotKeys.push([gm.code,team,ids?.[i]]);sh.made.forEach((v,k)=>made[k]+=v);sh.attempts.forEach((v,k)=>attempts[k]+=v);sh.ma.forEach((v,k)=>assisted[k]+=v);sh.mu.forEach((v,k)=>unassisted[k]+=v);sh.mn.forEach((v,k)=>unknown[k]+=v);});return {made,attempts,assisted,unassisted,unknown,shotKeys,shotGames:covered,shotExpected:gs.length,shotComplete:covered===gs.length&&gs.length>0,shotSource:'EuroLeague'};}
function teamExtras(gs){let fb=0,sc=0,pot=0,covered=0,potCovered=0;const zm=Array(g.ShotZones.COUNT).fill(0),za=Array(g.ShotZones.COUNT).fill(0),production={Gm:gs.length,OfPo:0,DePo:0};for(const k of ['M1','A1','M2','A2','M3','A3','OR','DR','As','St','BF','FR'])production[k]=0;for(const gm of gs){production.OfPo+=gm.o.Po;production.DePo+=gm.o.Po;for(const row of gm.orows)for(const k of ['M1','A1','M2','A2','M3','A3','OR','DR','As','St','BF','FR'])production[k]+=row[k]||0;const sh=g.FantasyShots?.summary(gm.code,gm.oppCode);if(sh){covered++;fb+=sh.fb;sc+=sh.sc;sh.made.forEach((v,i)=>{zm[i]+=v;za[i]+=sh.attempts[i];});if(sh.pot!==null){potCovered++;pot+=sh.pot;}}}return {OFB:covered===gs.length?fb:null,OSC:covered===gs.length?sc:null,OPT:potCovered===gs.length?pot:null,...(covered===gs.length?{made:zm,attempts:za}:{}),shotCoverage:covered,production};}
function build(){
 const L=g.EuroLeagueData;if(!L||!TEAMS.length)return false;
 const {list,hasBA}=games(L);if(!list.length)return false;
 const {map}=identity(),info=L.info||{};
 const teamsSnap=TEAMS,teamName=cid=>teamsSnap.find(t=>t.id===cid)?.name||cid,clName=teamName;
 const through=Math.max(...list.map(x=>x.round));
 const byTeam={};for(const x of list)(byTeam[x.cid]=byTeam[x.cid]||[]).push(x);
 const pidOf=id=>{if(map[id])return map[id];const nm=splitName(info[id]?.name);return slug(nm.Fn+' '+nm.Sn)||'p'+id;};
 /* γραμμές ανά παίκτη */
 const lines={};for(const x of list)for(const y of x.rows){const pid=pidOf(y.id);(lines[pid]=lines[pid]||{id:y.id,rows:[]}).rows.push({x:y,gm:x});}
 const currentTeam=pid=>{const r=lines[pid].rows;return r[r.length-1].gm.cid;};
 /* Έλεγχος ένταξης από τα βασικά δεδομένα, πριν από playerTotals/σουτ/ιστορικό. Οι αποκλεισμένοι παραλείπονται από όλα τα παρακάτω. */
 const elig={};for(const [pid,P] of Object.entries(lines)){const cid=currentTeam(pid);elig[pid]=eligibility((byTeam[cid]||[]).slice(-5).map(gm=>{const r=P.rows.find(r=>r.gm.code===gm.code&&r.gm.cid===cid);return r?{sec:r.x.Sec,pir:pirOf(r.x)}:{sec:0};}));}
 const windows={season:null,'3':3,'5':5};const out={};
 for(const [key,n] of Object.entries(windows)){
  const codes={};for(const [cid,gs] of Object.entries(byTeam))codes[cid]=new Set((n?gs.slice(-n):gs).map(x=>x.code));
  const inWin=gm=>codes[gm.cid]?.has(gm.code);
  const players=[];
  for(const [pid,P] of Object.entries(lines)){if(!elig[pid].eligible)continue;const rows=P.rows.filter(r=>!n||codes[currentTeam(pid)]?.has(r.gm.code));const t=playerTotals(rows);if(!t.Gm)continue;
   const cid=currentTeam(pid),nm=splitName(info[P.id]?.name),pos=info[P.id]?.pos||'';
   const p={PID:pid,code:P.id,Fn:nm.Fn,Sn:nm.Sn,He:info[P.id]?.height?info[P.id].height/100:null,Pos:pos,CID:cid,Cl:clName(cid),label:nm.Sn,...t,noSample:false};
   const sh=shotTotals(rows.map(r=>r.gm),rows.map(r=>r.x.id),false);Object.assign(p,sh);p.estimatedPossessions=!p.onCourtExact;players.push(p);}
  const raw=Object.entries(byTeam).map(([cid,gs])=>({CID:cid,Cl:clName(cid),...teamTotals(gs.filter(inWin)),...teamExtras(gs.filter(inWin))}));
  const teams=teamsSnap.map(t=>{const rw=raw.find(r=>r.CID===t.id);return {...t,...shotTotals(gsFor(byTeam,t.id,n),null,true),games:rw?.Gm||0,pace:rw?M.pace(rw.OfPo,rw.DePo,rw.Sec):null};});
  const rounds=list.filter(inWin).map(x=>x.round);
  out[key]={players,raw,teams,teamThroughRound:through,playerThroughRound:through,fromRound:Math.min(...rounds),toRound:Math.max(...rounds),live:true};}
 /* ιστορικό */
 const histPlayers={},histTeams={},missingByPlayer={},missingByTeam={};
 for(const [pid,P] of Object.entries(lines)){if(!elig[pid].eligible)continue;const cid=currentTeam(pid),own=new Map(P.rows.map(r=>[r.gm.code+'|'+r.gm.cid,r]));
  const gamesOf=[...new Set([...P.rows.map(r=>r.gm),...(byTeam[cid]||[])])].sort((a,b)=>a.round-b.round||String(a.date).localeCompare(String(b.date)));
  histPlayers[pid]=gamesOf.map(gm=>{const r=own.get(gm.code+'|'+gm.cid),played=Boolean(r&&r.x.Sec>0);const base={game:gm.code,cid:gm.cid,round:gm.round,date:gm.date,opponent:teamName(gm.ocid),home:gm.home,source:'EuroLeague',url:url(gm.code)};
   if(!played)return {...base,M1:0,A1:0,M2:0,A2:0,M3:0,A3:0,OR:0,DR:0,As:0,St:0,Tv:0,BF:0,BA:0,FC:0,FR:0,minutes:null,points:0,pir:0,rebounds:0,assists:0,netSfp:0,ftr:null,efg:null,two:null,three:null,ft:null,played:false};
   return {...base,...statRow(r.x),totals:playerTotals([r]),minutes:r.x.Sec/60,starter:Boolean(r.x.GS),played:true};});
  missingByPlayer[pid]=[];}
 for(const [cid,gs] of Object.entries(byTeam)){missingByTeam[cid]=[];
  histTeams[cid]=gs.map(gm=>{const me=teamSide(gm.s,gm.rows,gm.sec),op=teamSide(gm.o,gm.orows,gm.sec);
   const byPos={G:0,F:0,C:0},cover={known:0,total:gm.orows.filter(y=>y.Sec>0).length};
   for(const y of gm.orows){if(!(y.Sec>0))continue;const pos=info[y.id]?.pos;if(byPos[pos]===undefined)continue;byPos[pos]+=pirOf(y);cover.known++;}
   return {game:gm.code,round:gm.round,date:gm.date,opponent:teamName(gm.ocid),home:gm.home,source:'EuroLeague',url:url(gm.code),...me,totals:{...teamTotals([gm]),...teamExtras([gm])},
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
 g.FANTASY_ELIGIBILITY=elig;
 g.FANTASY_FIXTURES=fx;g.FANTASY_SCHEDULE=fx.map(f=>[f.round,f.home,f.away]);
 Object.assign(state,{ready:true,through,upstreamStatus:L.state.status,upstreamError:L.state.error,upstreamUpdated:L.state.updated,games:list.length/2,players:out.season.players.length,excluded:Object.values(elig).filter(e=>!e.eligible).length,positionsMissing:out.season.players.filter(p=>!p.Pos).length,onMissing:new Set(list.filter(x=>!x.on).map(x=>x.code)).size,builtAt:new Date().toISOString(),pirExact:hasBA,error:null});
 g.FANTASY_LIVE=state;
 return true;}

function rebuild(){try{if(!build())return;}catch(e){state.error=String(e.message||e);g.FANTASY_LIVE=state;console.error('[fantasy-live]',e);return;}
 try{g.dispatchEvent(new CustomEvent('fantasy-live',{detail:state}));}catch{}}
g.FantasyLive={state,rebuild,build,eligibility};
rebuild();
try{g.addEventListener('euroleague-data',e=>{if(e.detail?.status==='loading')return;rebuild();});}catch{}
})(globalThis);
