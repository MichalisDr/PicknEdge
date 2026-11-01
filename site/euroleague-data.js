/* Pick n Edge · Κοινή μηχανή δεδομένων EuroLeague
   Μία μονάδα για Fantasy και Betting. Δεν ξέρει τίποτα για πίνακες, κάρτες ή σελίδες.
   Πηγή: επίσημα δεδομένα EuroLeague.
   - Πρόγραμμα / ποιοι αγώνες ολοκληρώθηκαν: feeds.incrowdsports.com (το feed του euroleaguebasketball.net)
   - Box score και play-by-play: live.euroleague.net
   Κάνει: λήψη (με περιορισμό αιτημάτων), προσωρινή μνήμη στον browser, ανάλυση box score / play-by-play,
   κατοχές, πεντάδες (παίκτες εντός γηπέδου) και ελέγχους εγκυρότητας (λεπτά έναντι box score, σουτ έναντι box score).
   Δίνει: EuroLeagueData.records()[κωδικός] = {sides, players, on, src, onErr, onBad, calc,…}, info, rosters, schedule, state,
   και το event 'euroleague-data' σε κάθε αλλαγή. Κοινοί ορισμοί δεικτών: EuroLeagueData.metrics.
   Κατοχές: καταμέτρηση από το play-by-play. Αν λείπει ή δεν συμφωνεί με το box score, χρησιμοποιείται εκτίμηση Oliver και ο αγώνας σημειώνεται.
   Seeds (tests/fixtures): μόνο για τα τεστ· το site δεν τα φορτώνει.
   Η EuroLeague μπλοκάρει προσωρινά όποιον στέλνει πολλά αιτήματα, γι' αυτό: 2 παράλληλα αιτήματα,
   αποθήκευση μετά από κάθε αγώνα και διακοπή στο πρώτο μπλοκάρισμα. */
(function(g){
'use strict';
const SEASON='E2026',API='https://live.euroleague.net/api/',FEED='https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons/'+SEASON+'/games';
const SCHEDULE_KEY='picknedge-schedule-'+SEASON+'-v1',KEY='courtvision-betting-live-'+SEASON+'-v3',VERSION=3,CALC=2,PEOPLE_KEY='courtvision-betting-people-'+SEASON+'-v1',CLUBS='https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons/'+SEASON+'/clubs/',PEOPLE_RETRY=12*60*60*1000,PARALLEL=2,MAX_ROUND=38,MAX_CODE=400,BLOCK=10,RECHECK_DAYS=2,RECHECK_AFTER=60*60*1000;
const CID={IST:'anadolu-efes-istanbul',ASV:'asvel-lyon-villeurbanne',BAR:'barcelona',BAS:'baskonia',MUN:'bayern-munich',BES:'besiktas',DUB:'dubai',ULK:'fenerbahce-ulker',HTA:'hapoel-tel-aviv',RED:'kk-crvena-zvezda',TEL:'maccabi-tel-aviv',MIL:'milano',OLY:'olympiacos',PAN:'panathinaikos',PRS:'paris-basketball',PAR:'partizan',MAD:'real-madrid',PAM:'valencia',VIR:'virtus-bologna',ZAL:'zalgiris-kaunas'};
const FIELDS=['M1','A1','M2','A2','M3','A3','OR','DR','As','St','Tv','Bl','FC'];
/* Γραμμή παίκτη σε κάθε αγώνα: [κωδικός παίκτη, ...PFIELDS]. BA = κοψίματα που δέχτηκε (χρειάζεται για το PIR). */
const PFIELDS=['GS','Sec','M2','A2','M3','A3','M1','A1','OR','DR','As','St','Tv','Bl','FD','PF','BA'];
const POS={Guard:'G',Forward:'F',Center:'C'};
const QUARTERS=['FirstQuarter','SecondQuarter','ThirdQuarter','ForthQuarter','ExtraTime'];
const OWN=new Set(['2FGA','2FGM','3FGA','3FGM','FTA','FTM','TO','O','D','ST','AS']),SHOTS=new Set(['2FGA','2FGM','3FGA','3FGM']),TECH=new Set(['CMT1','CMT2','C','B']);
const state={status:'snapshot',games:0,round:null,date:null,updated:null,estimated:0,missing:[],live:[],error:null,progress:null};/* μόνο μεταδεδομένα φόρτωσης· κανένα στατιστικό */
let records={},schedule=[],running=null,blocked=false,seedAt={},people={},pauseUntil=0;
/* Μητρώο παικτών: κωδικός → {name, team, pos, dorsal, height}. Ρόστερ: ομάδα → κωδικοί ενεργών παικτών. */
const info={},rosters={};

/* ---------- αποθήκευση ---------- */
/* Seeds: μόνο για τα τεστ (tests/fixtures). Το site δεν τα φορτώνει· όλα τα δεδομένα έρχονται από την EuroLeague και την προσωρινή μνήμη του browser. */
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
/* Τελευταίο έγκυρο πρόγραμμα της EuroLeague, για όταν το feed δεν απαντά. */
function readSchedule(){try{const c=JSON.parse(localStorage.getItem(SCHEDULE_KEY)||'null');return c&&Array.isArray(c.list)?c.list:[];}catch{return [];}}
function writeSchedule(list){try{localStorage.setItem(SCHEDULE_KEY,JSON.stringify({saved:Date.now(),list}));}catch{}}
function emit(){try{g.dispatchEvent(new CustomEvent('euroleague-data',{detail:state}));}catch{}}

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
function possessions(pbp,a,b,track){
 const count={[a]:0,[b]:0},fga={[a]:0,[b]:0},other={[a]:b,[b]:a},tech={[a]:0,[b]:0};let events=0,techTime=null,lastFT='',lastFGM='';
 QUARTERS.forEach((q,qi)=>{let owner=null;track?.start(qi);
  for(const e of pbp?.[q]||[]){const type=String(e.PLAYTYPE||'').trim(),team=String(e.CODETEAM||'').trim(),time=String(e.MARKERTIME||'').trim();
   track?.event(e,type,team,time);
   if(type==='BP'){owner=null;tech[a]=tech[b]=0;techTime=null;continue;}
   if(techTime!==null&&time&&time!==techTime){tech[a]=tech[b]=0;techTime=null;}
   if(!(team in count))continue;
   if(TECH.has(type)){tech[other[team]]+=type==='CMT2'?2:1;techTime=time;continue;}
   if(!OWN.has(type))continue;
   events++;if(SHOTS.has(type))fga[team]++;
   const key=team+'|'+String(e.PLAYER_ID||'').trim()+'|'+qi+'|'+time;
   if(SHOTS.has(type)){track?.sa(team,e);if(type.endsWith('M'))lastFGM=key;}
   if(type==='TO')track?.tov(team);
   if((type==='FTA'||type==='FTM')){const isTech=tech[team]>0;
    /* Σεριά βολών = 1 SA. And-one (βολή στην ίδια στιγμή με εύστοχο σουτ του ίδιου παίκτη) δεν προσθέτει SA. Βολές τεχνικής δεν μετρούν. */
    if(!isTech&&key!==lastFT&&key!==lastFGM)track?.sa(team,e);if(!isTech)lastFT=key;
    if(isTech){tech[team]--;if(owner!==team)continue;}}
   if(team!==owner){count[team]++;owner=team;track?.poss(team);}
  }track?.end(qi);});
 return {count,fga,events};}
/* Πεντάδες και εκτός/εντός γηπέδου από το play-by-play: για κάθε παίκτη, SA/TOV/κατοχές ομάδας όσο παίζει. Επαλήθευση: δευτερόλεπτα έναντι box score. */
const TOL=75;/* ανοχή ανά παίκτη (δευτερόλεπτα): αργοπορημένες καταγραφές αλλαγών στο play-by-play */
function tracker(a,b,boxLines){
 const lineup={[a]:new Set(),[b]:new Set()},sec={},on={},own={},teamOf={},Q=[600,600,600,600,300];let last=0,qstart=0,qlen=600,sawSub=false,any=false;
 for(const t of [a,b])for(const r of boxLines[t]||[]){teamOf[r[0]]=t;if(r[1])lineup[t].add(r[0]);}
 const row=id=>on[id]||(on[id]=[0,0,0,0]),each=(t,fn)=>{for(const id of lineup[t])fn(row(id));};
 const adv=t=>{const d=Math.max(0,t-last);if(d){for(const x of [a,b])for(const id of lineup[x])sec[id]=(sec[id]||0)+d;}last=t;};
 return {
  start(qi){any=false;qstart=Q.slice(0,qi).reduce((n,x)=>n+x,0);qlen=Q[qi];last=qstart;},
  end(){if(any)adv(qstart+qlen);},
  /* Το play-by-play βάζει στην αρχή της περιόδου μερικές φορές το τελευταίο σουτ της προηγούμενης (ώρα 00:00, MINUTE πρώτου λεπτού της νέας περιόδου, π.χ. αγώνας 75, #168/#169). Η ώρα τους δεν είναι αξιόπιστη: δεν προχωρούν το ρολόι. */
  trusted(e,time){const m=Number(e.MINUTE);if(!Number.isFinite(m)||!m)return true;const elapsed=Math.max(0,qlen-clock(time));return Math.abs(m-(qstart/60+Math.max(1,Math.ceil(elapsed/60))))<=1;},
  event(e,type,team,time){any=true;let t=last;if(/^\d+:\d+$/.test(time)&&this.trusted(e,time))t=Math.min(qstart+qlen,Math.max(last,qstart+qlen-clock(time)));adv(t);
   const id=pid(e.PLAYER_ID);if((type==='IN'||type==='OUT')&&team in lineup&&id){sawSub=true;type==='IN'?lineup[team].add(id):lineup[team].delete(id);}},
  sa(team,e){const id=pid(e.PLAYER_ID);if(id)own[id]=(own[id]||0)+1;each(team,r=>{r[0]++;});},
  tov(team){each(team,r=>{r[1]++;});},
  poss(team){each(team,r=>{r[2]++;});each(team===a?b:a,r=>{r[3]++;});},
  /* [SA παίκτη, SA ομάδας, TOV ομάδας, OfPo, DePo] ανά παίκτη· null αν οι πεντάδες δεν συμφωνούν με το box score */
  seconds(){return {...sec};},
  result(){const out={a:{},b:{}},bad=[];
   for(const t of [a,b])for(const r of boxLines[t]||[]){const s=sec[r[0]]||0;if(Math.abs(s-r[2])>TOL)bad.push(r[0]+':'+Math.round(s)+'/'+r[2]);const o=on[r[0]]||[0,0,0,0];out[t===a?'a':'b'][r[0]]=[own[r[0]]||0,o[0],o[1],o[2],o[3]];}
   const fine=sawSub&&!bad.length;
   return fine?{[a]:out.a,[b]:out.b}:{bad:sawSub?bad:['no-substitutions']};}
 };}
function isoDate(d){const s=String(d||'');if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const [day,month,year]=s.split('/');return year?`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`:'';}
/* x: {home, away, homeName, awayName, round, date, score} από το πρόγραμμα ή το Header */
function parse(code,x,box,pbp){
 const a=x.home,b=x.away,st=box.Stats||[],up=s=>String(s||'').trim().toUpperCase();
 const home=st.find(s=>up(s.Team)===up(x.homeName))||st[0],away=st.find(s=>s!==home&&up(s.Team)===up(x.awayName))||st.find(s=>s!==home);
 if(!a||!b||!home||!away)throw new Error('Ελλιπή στοιχεία αγώνα '+code);
 const sides={[a]:side(home.totr),[b]:side(away.totr)},sec=Math.max(seconds(home.totr.Minutes),seconds(away.totr.Minutes));
 const boxLines={[a]:lines(home,a),[b]:lines(away,b)},trk=pbp?tracker(a,b,boxLines):null,p=possessions(pbp,a,b,trk),fgaOK=[a,b].every(c=>Math.abs(p.fga[c]-(sides[c].A2+sides[c].A3))<=2),countOK=[a,b].every(c=>p.count[c]>40)&&Math.abs(p.count[a]-p.count[b])<=6;
 const src=p.events&&fgaOK&&countOK?'pbp':'est';
 sides[a].Po=src==='pbp'?p.count[a]:Math.round(oliver(sides[a],sides[b])*10)/10;
 sides[b].Po=src==='pbp'?p.count[b]:Math.round(oliver(sides[b],sides[a])*10)/10;
 const pts=s=>s.M1+2*s.M2+3*s.M3;
 const res=src==='pbp'&&trk?trk.result():null,on=res&&!res.bad?res:null;
 return {code,round:Number(x.round)||Math.ceil(code/10),date:isoDate(x.date),home:a,away:b,score:[pts(sides[a]),pts(sides[b])],sec,src,sides,players:boxLines,on,onErr:on?undefined:(src==='pbp'?'lineup':'pbp'),onBad:res?.bad,onTol:TOL,calc:CALC,at:Date.now()};}

/* ---------- λήψη ---------- */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function retryAfter(r,attempt){const h=r.headers.get('Retry-After'),s=Number(h);if(h&&Number.isFinite(s))return Math.min(s,120)*1000;const d=Date.parse(h||'');return Number.isFinite(d)?Math.min(Math.max(d-Date.now(),1000),120000):15000*(attempt+1);}
/* 429: αναμονή όσο ζητά το Retry-After (ή αυξανόμενη), κοινή για όλα τα αιτήματα, το πολύ 3 επαναλήψεις. Μετά, διακοπή χωρίς παράκαμψη. */
let nextAt=0;const GAP=800,RESUME=75000,CYCLES=5;
/* Ελάχιστη απόσταση μεταξύ αιτημάτων. Το μπλοκάρισμα της EuroLeague φτάνει στον browser ως σφάλμα δικτύου (χωρίς CORS headers), άρα η αναμονή είναι αυξανόμενη και περιορισμένη (2 επαναλήψεις). */
async function json(url){for(let attempt=0;;attempt++){const wait=Math.max(pauseUntil,nextAt)-Date.now();nextAt=Math.max(Date.now(),nextAt)+GAP;if(wait>0)await sleep(wait);let r;try{r=await fetch(url,{cache:'no-store'});}catch(e){if(attempt<2){pauseUntil=Date.now()+20000*(attempt+1);continue;}throw e;}if(r.status===429&&attempt<3){pauseUntil=Date.now()+retryAfter(r,attempt);continue;}if(!r.ok)throw new Error('HTTP '+r.status+' · '+url.split('?')[0].split('/').pop());const t=await r.text();return t.trim()?JSON.parse(t):null;}}
const api=(path,code)=>json(API+path+'?gamecode='+code+'&seasoncode='+SEASON);
async function round(n){const d=await json(FEED+'?roundNumber='+n);return (d?.data||[]).map(x=>({code:x.code,round:x.round?.round??n,date:x.date,status:x.status,home:x.home?.code,away:x.away?.code,homeName:x.home?.name,awayName:x.away?.name,score:[x.home?.score,x.away?.score],ot:Boolean(x.home?.quarters?.ot1)}));}
/* Αγωνιστικές από την τελευταία γνωστή μέχρι την πρώτη χωρίς αποτέλεσμα. */
async function fixtures(){
 const start=1,out=[];/* πάντα από τον γύρο 1: αλλιώς μερική cache δεν συμπληρώνει ποτέ τους προηγούμενους γύρους */
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

/* ---------- κοινοί ορισμοί δεικτών (METRICS.md) ----------
   Πεδία γραμμής παίκτη: M1,A1,M2,A2,M3,A3,OR,DR,As,St,Tv,BF (κοψίματα υπέρ),FR (φάουλ που κέρδισε),FC (φάουλ),BA (κοψίματα που δέχτηκε). */
const M={
 r2:v=>Math.round(v*100)/100,
 div:(n,d,k=1)=>Number.isFinite(n)&&Number.isFinite(d)&&d>0?k*n/d:null,
 pts:p=>p.M1+2*p.M2+3*p.M3,
 /* Σουτ/χρήσεις: FGA + 0,44·FTA. Με Tv προστίθενται τα λάθη (παρονομαστής USG% και TOV%). */
 saOf:(fga,fta)=>fga+0.44*fta,
 sa:p=>M.saOf(p.A2+p.A3,p.A1),
 usage:p=>M.sa(p)+p.Tv,
 net:p=>M.pts(p)-(p.A1-p.M1)-(p.A2-p.M2)-(p.A3-p.M3)-p.Tv,
 other:p=>p.OR+p.DR+p.As+p.St+p.BF+p.FR-p.FC-p.BA,
 pir:p=>M.net(p)+M.other(p),
 sfp:p=>M.other(p)-p.Tv,
 pace:(po,dpo,sec)=>M.div(po+dpo,sec,1200)
};

/* ---------- σύνοψη ---------- */
/* Μετρητές κατάστασης από τους αγώνες που κρατά η μνήμη. Όχι στατιστικά: αυτά χτίζονται από Fantasy/Betting. */
function apply(){
 if(!Object.keys(records).length)return false;
 const list=Object.values(records).sort((x,y)=>x.date.localeCompare(y.date)||x.code-y.code),last=list[list.length-1];
 for(const r of list)if(!CID[r.home]||!CID[r.away])throw new Error('Άγνωστος κωδικός ομάδας: '+(CID[r.home]?r.away:r.home));
 Object.assign(state,{games:list.length,round:Math.max(...list.map(r=>r.round)),date:last.date,estimated:list.filter(r=>r.src!=='pbp').length});
 return true;}

/* Αγώνας που πρέπει να ξαναληφθεί: δεν υπάρχει, είναι πρόσφατος, ή έμεινε χωρίς επαληθευμένες πεντάδες με παλαιότερη έκδοση υπολογισμού (CALC) — έτσι ανανεώνονται και τα παλιά αποθηκευμένα αποτυχημένα αποτελέσματα. */
function needs(x){const r=records[x.code];return !r||recheck(r)||(!r.on&&r.calc!==CALC&&!(x.code in seedAt));}

async function refresh(){
 if(running)return running;
 running=(async()=>{
  blocked=false;Object.assign(state,{status:'loading',error:null,missing:[],live:[],progress:{done:0,total:0}});emit();
  try{
   let list;try{list=await fixtures();schedule=list;writeSchedule(list);}catch{list=await scan();}
   const todo=list.filter(x=>x.status==='result'&&needs(x));
   state.live=list.filter(x=>/live|play|progress/i.test(String(x.status||''))).map(x=>x.code);
   state.progress.total=todo.length;emit();
   let failed=[],queue=todo;
   /* Μπλοκάρισμα: αναμονή και συνέχιση από όπου έμεινε (οι αγώνες αποθηκεύονται ένας ένας), το πολύ CYCLES φορές. */
   for(let cycle=0;cycle<CYCLES;cycle++){failed=[];await pool(queue,async x=>{const r=await loadGame(x);if(r.state!=='error'&&r.state!=='skipped')state.progress.done++;if(r.state==='error'||r.state==='skipped')failed.push(x);emit();});queue=failed.filter(x=>!records[x.code]);if(!blocked||!queue.length||cycle===CYCLES-1)break;state.progress.wait=Math.round(RESUME/1000);emit();await sleep(RESUME);delete state.progress.wait;blocked=false;}
   apply();
   try{await fillPeople();}catch{}
   state.missing=failed.filter(x=>!records[x.code]).map(x=>`R${x.round} ${x.home}–${x.away}`);
   if(blocked)state.error='Η EuroLeague περιόρισε προσωρινά τα αιτήματα. '+(state.missing.length?'Λείπουν: '+state.missing.join(', ')+'. ':'')+'Ξαναδοκίμασε σε λίγα λεπτά.';
   state.status=state.missing.length?'partial':'live';state.updated=Date.now();
  }catch(e){
   state.error='Δεν ήταν δυνατή η ενημέρωση από την EuroLeague ('+String(e.message||e)+').';
   state.status=state.games?'cached':'snapshot';
  }finally{state.progress=null;running=null;emit();}
 })();
 return running;}

function reset(){records=seed();try{localStorage.removeItem(KEY);}catch{}return refresh();}

/* Άμεση εμφάνιση από seed + προσωρινή μνήμη του browser, μετά ενημέρωση στο παρασκήνιο. */
records=Object.assign(seed(),read());readPeople();schedule=readSchedule();
try{if(apply())state.status='cached';}catch(e){records={};state.error=String(e.message||e);}

g.EuroLeagueData={state,refresh,reset,records:()=>records,schedule:()=>schedule,possessions,parse,tracker,season:SEASON,cid:CID,info,rosters,PFIELDS,FIELDS,TOL,CALC,needs,metrics:M};
if(typeof fetch==='function'&&!g.EUROLEAGUE_DATA_DISABLED&&!g.BETTING_LIVE_DISABLED&&typeof setTimeout==='function')setTimeout(refresh,0);/* μετά τη φόρτωση όλων των scripts, ώστε να προλάβουν να ακούσουν το event */
})(globalThis);
