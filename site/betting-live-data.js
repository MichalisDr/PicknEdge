/* Court Vision · Betting live data
   Πηγή: επίσημα δεδομένα EuroLeague. Ενημέρωση σε κάθε άνοιγμα της σελίδας.
   - Πρόγραμμα / ποιοι αγώνες ολοκληρώθηκαν: feeds.incrowdsports.com (το feed του euroleaguebasketball.net)
   - Box score και play-by-play: live.euroleague.net
   Γεμίζει:
   - BETTING_TEAMS    σύνολα σεζόν ανά ομάδα, με τα πεδία που διαβάζει το betting-stats.js
   - BETTING_HISTORY  game logs ανά ομάδα (Last 3 / 5 / 10, γραφήματα, game log)
   - BETTING_SCHEDULE οι αγώνες των αγωνιστικών που διαβάστηκαν (και οι επόμενοι)
   - γραμμές παικτών ανά αγώνα (records()[code].players) και BETTING_PLAYER_INFO / BETTING_ROSTERS για τις κάρτες παικτών
   Ακατέργαστα μεγέθη: επίσημα σύνολα ομάδας του box score.
   Κατοχές: καταμέτρηση από το play-by-play (κάθε αλλαγή κατοχής). Αν λείπει ή δεν συμφωνεί με το box score,
   χρησιμοποιείται εκτίμηση Oliver και ο αγώνας σημειώνεται.
   Το betting-games-seed.js (ομάδες) και το betting-players-seed.js (παίκτες) δίνουν έτοιμους τους παλιότερους αγώνες·
   κατεβαίνουν μόνο όσοι λείπουν. Θέση και ύψος νέων παικτών: ρόστερ ομάδας από το feeds.incrowdsports.com, μόνο όταν χρειάζεται.
   Η EuroLeague μπλοκάρει προσωρινά όποιον στέλνει πολλά αιτήματα, γι' αυτό: 2 παράλληλα αιτήματα,
   αποθήκευση μετά από κάθε αγώνα και διακοπή στο πρώτο μπλοκάρισμα. */
(function(g){
'use strict';
const SEASON='E2026',API='https://live.euroleague.net/api/',FEED='https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons/'+SEASON+'/games';
const KEY='courtvision-betting-live-'+SEASON+'-v3',VERSION=3,PEOPLE_KEY='courtvision-betting-people-'+SEASON+'-v1',CLUBS='https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons/'+SEASON+'/clubs/',PEOPLE_RETRY=12*60*60*1000,PARALLEL=2,MAX_ROUND=38,MAX_CODE=400,BLOCK=10,RECHECK_DAYS=2,RECHECK_AFTER=60*60*1000;
const CID={IST:'anadolu-efes-istanbul',ASV:'asvel-lyon-villeurbanne',BAR:'barcelona',BAS:'baskonia',MUN:'bayern-munich',BES:'besiktas',DUB:'dubai',ULK:'fenerbahce-ulker',HTA:'hapoel-tel-aviv',RED:'kk-crvena-zvezda',TEL:'maccabi-tel-aviv',MIL:'milano',OLY:'olympiacos',PAN:'panathinaikos',PRS:'paris-basketball',PAR:'partizan',MAD:'real-madrid',PAM:'valencia',VIR:'virtus-bologna',ZAL:'zalgiris-kaunas'};
const FIELDS=['M1','A1','M2','A2','M3','A3','OR','DR','As','St','Tv','Bl','FC'];
/* Γραμμή παίκτη σε κάθε αγώνα: [κωδικός παίκτη, ...PFIELDS]. BA = κοψίματα που δέχτηκε (χρειάζεται για το PIR). */
const PFIELDS=['GS','Sec','M2','A2','M3','A3','M1','A1','OR','DR','As','St','Tv','Bl','FD','PF','BA'];
const POS={Guard:'G',Forward:'F',Center:'C'};
const QUARTERS=['FirstQuarter','SecondQuarter','ThirdQuarter','ForthQuarter','ExtraTime'];
const OWN=new Set(['2FGA','2FGM','3FGA','3FGM','FTA','FTM','TO','O','D','ST','AS']),SHOTS=new Set(['2FGA','2FGM','3FGA','3FGM']),TECH=new Set(['CMT1','CMT2','C','B']);
const snapshot=Array.isArray(g.BETTING_TEAMS)?g.BETTING_TEAMS:[];
const state={status:'snapshot',games:0,round:null,date:null,updated:null,estimated:0,missing:[],live:[],error:null,progress:null};
let records={},schedule=[],running=null,blocked=false,seedAt={},people={};
/* Μητρώο παικτών: κωδικός → {name, team, pos, dorsal, height}. Ρόστερ: ομάδα → κωδικοί ενεργών παικτών. */
const info={},rosters={};

/* ---------- αποθήκευση ---------- */
function seed(){const s=g.BETTING_GAMES_SEED,ps=g.BETTING_PLAYERS_SEED,out={};if(!s||s.season!==SEASON)return out;const f=s.fields,at=Date.parse(s.created)||0;
 const pl=ps&&ps.season===SEASON&&Array.isArray(ps.players)&&ps.fields.join()===PFIELDS.join()?ps:null,id=k=>pl.players[k][0];
 if(pl){pl.players.forEach(([pid,name,team,pos,dorsal,height])=>{info[pid]={name,team,pos,dorsal,height};});for(const [team,list] of Object.entries(pl.rosters||{}))rosters[team]=list.map(id);}
 for(const [code,round,date,home,away,sh,sa,sec,src,H,A] of s.games){const side=v=>Object.fromEntries(f.map((k,i)=>[k,v[i]]));out[code]={code,round,date,home,away,score:[sh,sa],sec,src,sides:{[home]:side(H),[away]:side(A)},at};
  const lines=pl&&pl.games[code];if(lines)out[code].players={[home]:lines[0].map(r=>[id(r[0]),...r.slice(1)]),[away]:lines[1].map(r=>[id(r[0]),...r.slice(1)])};
  seedAt[code]=at;}
 return out;}
function read(){try{localStorage.removeItem('courtvision-betting-live-'+SEASON+'-v2');}catch{}try{const c=JSON.parse(localStorage.getItem(KEY)||'null');return c&&c.v===VERSION&&c.games?c.games:{};}catch{return {};}}
/* Αποθηκεύονται μόνο οι αγώνες που δεν υπάρχουν στο seed (ή ξαναδιαβάστηκαν μετά από αυτό). */
function write(){try{const games=Object.fromEntries(Object.entries(records).filter(([c,r])=>!(c in seedAt)||r.at>seedAt[c]));localStorage.setItem(KEY,JSON.stringify({v:VERSION,saved:Date.now(),games}));}catch{}}
/* Ρόστερ που κατέβηκαν από το feed: ομάδα → {at, list:[[κωδικός, όνομα, θέση, νούμερο, ύψος, ενεργός]]} */
function usePeople(team,list){rosters[team]=[];for(const [pid,name,pos,dorsal,height,active] of list){const old=info[pid];
  if(active||!old||!old.pos)info[pid]={name:old?.name||name,team:active?team:(old?.team||team),pos:pos||old?.pos||'',dorsal,height:height||old?.height||0};
  if(active&&!rosters[team].includes(pid))rosters[team].push(pid);}}
function readPeople(){try{const c=JSON.parse(localStorage.getItem(PEOPLE_KEY)||'null');if(c&&c.teams)people=c.teams;}catch{}for(const [t,x] of Object.entries(people))if(x.list)usePeople(t,x.list);}
function writePeople(){try{localStorage.setItem(PEOPLE_KEY,JSON.stringify({saved:Date.now(),teams:people}));}catch{}}
function emit(){try{g.dispatchEvent(new CustomEvent('betting-live',{detail:state}));}catch{}}

/* ---------- ανάλυση ενός αγώνα ---------- */
const pid=v=>String(v??'').trim().replace(/^P/,'');
function clock(m){const [a,b]=String(m||'').split(':').map(Number);return Number.isFinite(a)?a*60+(b||0):0;}
/* Γραμμές παικτών ενός box score. Όσοι δεν αγωνίστηκαν (0″) παραλείπονται. */
function lines(stats,team){const out=[];for(const p of stats?.PlayersStats||[]){const s=clock(p.Minutes),id=pid(p.Player_ID);if(!s||!id)continue;
  if(!info[id])info[id]={name:String(p.Player||'').trim(),team,pos:'',dorsal:String(p.Dorsal??'').trim(),height:0};
  out.push([id,p.IsStarter?1:0,s,p.FieldGoalsMade2,p.FieldGoalsAttempted2,p.FieldGoalsMade3,p.FieldGoalsAttempted3,p.FreeThrowsMade,p.FreeThrowsAttempted,p.OffensiveRebounds,p.DefensiveRebounds,p.Assistances,p.Steals,p.Turnovers,p.BlocksFavour,p.FoulsReceived,p.FoulsCommited,p.BlocksAgainst].map((v,i)=>i?Number(v)||0:v));}
 return out;}
function side(t){return {M1:t.FreeThrowsMade,A1:t.FreeThrowsAttempted,M2:t.FieldGoalsMade2,A2:t.FieldGoalsAttempted2,M3:t.FieldGoalsMade3,A3:t.FieldGoalsAttempted3,OR:t.OffensiveRebounds,DR:t.DefensiveRebounds,As:t.Assistances,St:t.Steals,Tv:t.Turnovers,Bl:t.BlocksFavour,FC:t.FoulsCommited};}
function seconds(minutes){const [m,s]=String(minutes||'').split(':').map(Number),team=((m||0)*60+(s||0))/5;return 2400+300*Math.max(0,Math.round((team-2400)/300));}
function oliver(s,o){const fga=s.A2+s.A3,fgm=s.M2+s.M3,orb=s.OR+o.DR;return fga+0.44*s.A1-1.07*(orb?s.OR/orb:0)*(fga-fgm)+s.Tv;}
/* Κατοχή = συνεχόμενη σειρά γεγονότων της ίδιας ομάδας (σουτ, βολές, λάθη, ριμπάουντ, κλεψίματα, ασίστ).
   Νέα κατοχή μετρά σε κάθε αλλαγή ομάδας και στην αρχή κάθε περιόδου.
   Οι βολές τεχνικής ποινής (στην ίδια χρονική στιγμή με την τεχνική) δεν αλλάζουν κατοχή. */
function possessions(pbp,a,b){
 const count={[a]:0,[b]:0},fga={[a]:0,[b]:0},other={[a]:b,[b]:a},tech={[a]:0,[b]:0};let events=0,techTime=null;
 for(const q of QUARTERS){let owner=null;
  for(const e of pbp?.[q]||[]){const type=String(e.PLAYTYPE||'').trim(),team=String(e.CODETEAM||'').trim(),time=String(e.MARKERTIME||'').trim();
   if(type==='BP'){owner=null;tech[a]=tech[b]=0;techTime=null;continue;}
   if(techTime!==null&&time&&time!==techTime){tech[a]=tech[b]=0;techTime=null;}
   if(!(team in count))continue;
   if(TECH.has(type)){tech[other[team]]+=type==='CMT2'?2:1;techTime=time;continue;}
   if(!OWN.has(type))continue;
   events++;if(SHOTS.has(type))fga[team]++;
   if((type==='FTA'||type==='FTM')&&tech[team]>0){tech[team]--;if(owner!==team)continue;}
   if(team!==owner){count[team]++;owner=team;}
  }}
 return {count,fga,events};}
function isoDate(d){const s=String(d||'');if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const [day,month,year]=s.split('/');return year?`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`:'';}
/* x: {home, away, homeName, awayName, round, date, score} από το πρόγραμμα ή το Header */
function parse(code,x,box,pbp){
 const a=x.home,b=x.away,st=box.Stats||[],up=s=>String(s||'').trim().toUpperCase();
 const home=st.find(s=>up(s.Team)===up(x.homeName))||st[0],away=st.find(s=>s!==home&&up(s.Team)===up(x.awayName))||st.find(s=>s!==home);
 if(!a||!b||!home||!away)throw new Error('Ελλιπή στοιχεία αγώνα '+code);
 const sides={[a]:side(home.totr),[b]:side(away.totr)},sec=Math.max(seconds(home.totr.Minutes),seconds(away.totr.Minutes));
 const p=possessions(pbp,a,b),fgaOK=[a,b].every(c=>Math.abs(p.fga[c]-(sides[c].A2+sides[c].A3))<=2),countOK=[a,b].every(c=>p.count[c]>40)&&Math.abs(p.count[a]-p.count[b])<=6;
 const src=p.events&&fgaOK&&countOK?'pbp':'est';
 sides[a].Po=src==='pbp'?p.count[a]:Math.round(oliver(sides[a],sides[b])*10)/10;
 sides[b].Po=src==='pbp'?p.count[b]:Math.round(oliver(sides[b],sides[a])*10)/10;
 const pts=s=>s.M1+2*s.M2+3*s.M3;
 return {code,round:Number(x.round)||Math.ceil(code/10),date:isoDate(x.date),home:a,away:b,score:[pts(sides[a]),pts(sides[b])],sec,src,sides,players:{[a]:lines(home,a),[b]:lines(away,b)},at:Date.now()};}

/* ---------- λήψη ---------- */
async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status+' · '+url.split('?')[0].split('/').pop());const t=await r.text();return t.trim()?JSON.parse(t):null;}
const api=(path,code)=>json(API+path+'?gamecode='+code+'&seasoncode='+SEASON);
async function round(n){const d=await json(FEED+'?roundNumber='+n);return (d?.data||[]).map(x=>({code:x.code,round:x.round?.round??n,date:x.date,status:x.status,home:x.home?.code,away:x.away?.code,homeName:x.home?.name,awayName:x.away?.name,score:[x.home?.score,x.away?.score],ot:Boolean(x.home?.quarters?.ot1)}));}
/* Αγωνιστικές από την τελευταία γνωστή μέχρι την πρώτη χωρίς αποτέλεσμα. */
async function fixtures(){
 const known=Object.values(records),start=known.length?Math.max(...known.map(r=>r.round)):1,out=[];
 for(let n=start;n<=MAX_ROUND;n++){const games=await round(n);out.push(...games);if(!games.some(x=>x.status==='result'))break;}
 return out;}
async function loadGame(x){
 if(blocked)return {code:x.code,state:'skipped'};
 try{
  const [box,pbp]=await Promise.all([api('Boxscore',x.code),api('PlayByPlay',x.code).catch(()=>null)]);
  if(!box||box.Live===true||!(box.Stats||[]).length)return {code:x.code,state:'pending'};
  const rec=parse(x.code,x,box,pbp);records[rec.code]=rec;write();return {code:x.code,state:'final'};
 }catch(e){blocked=true;return {code:x.code,state:'error',error:String(e.message||e)};}}
/* Θέση/ύψος για παίκτες που δεν υπάρχουν στο seed: ρόστερ της ομάδας τους (ένα αίτημα ανά ομάδα, το πολύ ανά 12 ώρες). */
async function fillPeople(){
 const need=new Set();for(const r of Object.values(records))for(const [team,rows] of Object.entries(r.players||{}))for(const row of rows)if(!info[row[0]]?.pos)need.add(team);
 const teams=[...need].filter(t=>!people[t]||Date.now()-people[t].at>PEOPLE_RETRY);if(!teams.length)return;
 for(const team of teams){try{const d=await json(CLUBS+team+'/people');const list=(Array.isArray(d)?d:d?.data||[]).filter(x=>x.type==='J'&&x.person).map(x=>[pid(x.person.code),String(x.person.name||'').trim(),POS[x.positionName]||'',String(x.dorsal??''),Number(x.person.height)||0,x.active===false?0:1]);
   people[team]={at:Date.now(),list};usePeople(team,list);}catch{people[team]={at:Date.now(),list:null};}}
 writePeople();}
/* Εναλλακτική αν δεν απαντήσει το feed προγράμματος: σάρωση με το Header του live.euroleague.net. */
async function scan(){
 const out=[];const last=Math.max(0,...Object.keys(records).map(Number));
 for(let start=Math.floor(last/BLOCK)*BLOCK+1;start<=MAX_CODE;start+=BLOCK){let any=false;
  for(let c=start;c<start+BLOCK;c++){if(records[c]){any=true;continue;}const h=await api('Header',c);if(!h)continue;any=true;
   out.push({code:c,round:h.Round,date:h.Date,status:h.Live===true||String(h.Live)==='true'?'live':'result',home:String(h.CodeTeamA||'').trim(),away:String(h.CodeTeamB||'').trim(),homeName:h.TeamA,awayName:h.TeamB});}
  if(!any)break;}
 return out;}
async function pool(items,fn){let i=0;await Promise.all(Array.from({length:Math.min(PARALLEL,items.length)},async()=>{while(i<items.length)await fn(items[i++]);}));}
function recheck(r){return Date.now()-r.at>RECHECK_AFTER&&Date.now()-Date.parse(r.date)<RECHECK_DAYS*864e5;}

/* ---------- σύνολα και game logs ---------- */
function build(){
 const names=Object.fromEntries(snapshot.map(t=>[t.CID,t.Cl])),list=Object.values(records).sort((x,y)=>x.date.localeCompare(y.date)||x.code-y.code),byTeam={};
 for(const r of list)for(const [me,op] of [[r.home,r.away],[r.away,r.home]]){
  const id=CID[me];if(!id)throw new Error('Άγνωστος κωδικός ομάδας: '+me);
  const s=r.sides[me],o=r.sides[op],home=me===r.home,game={CID:id,code:r.code,round:r.round,date:r.date,opponent:names[CID[op]]||op,venue:home?'Εντός':'Εκτός',score:home?r.score.join('-'):[...r.score].reverse().join('-'),poss:r.src,Gm:1,Sec:r.sec,OfPo:s.Po,DePo:o.Po};
  for(const f of FIELDS){game['T'+f]=s[f];game['O'+f]=o[f];}
  (byTeam[id]=byTeam[id]||{complete:true,games:[]}).games.push(game);}
 const missing=snapshot.filter(t=>!byTeam[t.CID]);if(snapshot.length&&missing.length)throw new Error('Λείπουν αγώνες για: '+missing.map(t=>t.Cl).join(', '));
 const order=snapshot.length?snapshot.map(t=>t.CID):Object.keys(byTeam).sort();
 const teams=order.map(id=>{const games=byTeam[id].games;games.forEach((x,i)=>x.order=i+1);const t={CID:id,Cl:names[id]||id,Gm:games.length};
  for(const k of ['Sec','OfPo','DePo',...FIELDS.flatMap(f=>['T'+f,'O'+f])])t[k]=Math.round(games.reduce((n,x)=>n+x[k],0)*10)/10;return t;});
 return {teams,byTeam,list};}
function apply(){
 if(!Object.keys(records).length)return false;
 const {teams,byTeam,list}=build(),last=list[list.length-1];
 g.BETTING_TEAMS=teams;g.BETTING_HISTORY={source:'EuroLeague',season:SEASON,byTeam};
 Object.assign(state,{games:list.length,round:Math.max(...list.map(r=>r.round)),date:last.date,estimated:list.filter(r=>r.src!=='pbp').length});
 return true;}

async function refresh(){
 if(running)return running;
 running=(async()=>{
  blocked=false;Object.assign(state,{status:'loading',error:null,missing:[],live:[],progress:{done:0,total:0}});emit();
  try{
   let list;try{list=await fixtures();schedule=list;g.BETTING_SCHEDULE=list;}catch{list=await scan();}
   const todo=list.filter(x=>x.status==='result'&&(!records[x.code]||recheck(records[x.code])));
   state.live=list.filter(x=>/live|play|progress/i.test(String(x.status||''))).map(x=>x.code);
   state.progress.total=todo.length;emit();
   const failed=[];
   await pool(todo,async x=>{const r=await loadGame(x);state.progress.done++;if(r.state==='error'||r.state==='skipped')failed.push(x);emit();});
   apply();
   try{await fillPeople();}catch{}
   state.missing=failed.filter(x=>!records[x.code]).map(x=>`R${x.round} ${x.home}–${x.away}`);
   if(blocked)state.error='Η EuroLeague περιόρισε προσωρινά τα αιτήματα. '+(state.missing.length?'Λείπουν: '+state.missing.join(', ')+'. ':'')+'Ξαναδοκίμασε σε λίγα λεπτά.';
   state.status=state.missing.length?'partial':'live';state.updated=Date.now();
  }catch(e){
   state.error='Δεν ήταν δυνατή η ενημέρωση από την EuroLeague ('+String(e.message||e)+').';
   state.status=state.games?'cached':'snapshot';
   if(!state.games){g.BETTING_TEAMS=snapshot;delete g.BETTING_HISTORY;}
  }finally{state.progress=null;running=null;emit();}
 })();
 return running;}

function reset(){records=seed();try{localStorage.removeItem(KEY);}catch{}return refresh();}
g.BETTING_PLAYER_INFO=info;g.BETTING_ROSTERS=rosters;

/* Άμεση εμφάνιση από seed + προσωρινή μνήμη του browser, μετά ενημέρωση στο παρασκήνιο. */
records=Object.assign(seed(),read());readPeople();
try{if(apply())state.status='cached';}catch(e){records={};state.error=String(e.message||e);}
g.BETTING_SNAPSHOT=snapshot;
g.BettingLive={state,refresh,reset,records:()=>records,schedule:()=>schedule,possessions,parse,build,season:SEASON,cid:CID,info,rosters,PFIELDS};
if(typeof fetch==='function'&&!g.BETTING_LIVE_DISABLED)refresh();
})(globalThis);
