/* Court Vision · Betting live data
   Επεξεργασία και παρουσίαση για το Betting πάνω στην κοινή μηχανή euroleague-data.js (λήψη, cache, κατοχές, πεντάδες).
   Γεμίζει:
   - BETTING_TEAMS    σύνολα σεζόν ανά ομάδα, με τα πεδία που διαβάζει το betting-stats.js
   - BETTING_HISTORY  game logs ανά ομάδα (Last 3 / 5 / 10, γραφήματα, game log)
   - BETTING_SCHEDULE οι αγώνες των αγωνιστικών που διαβάστηκαν (και οι επόμενοι)
   - BETTING_PLAYER_INFO / BETTING_ROSTERS για τις κάρτες παικτών
   Ακατέργαστα μεγέθη: επίσημα σύνολα ομάδας του box score. Δεν κάνει δικά του αιτήματα.
   Event 'betting-live': σε κάθε ενημέρωση της μηχανής, αφού ξαναχτιστούν τα παραπάνω. */
(function(g){
'use strict';
const E=g.EuroLeagueData;
if(!E)throw new Error('betting-live-data.js: λείπει το euroleague-data.js');
const {state,cid:CID,FIELDS,season:SEASON}=E;
const snapshot=(g.PICKNEDGE_TEAMS||[]).map(t=>({CID:t.id,Cl:t.name}));/* μόνο ταυτότητα ομάδων, καμία στατιστική */

/* ---------- σύνολα και game logs ---------- */
function build(){
 const records=E.records(),names=Object.fromEntries(snapshot.map(t=>[t.CID,t.Cl])),list=Object.values(records).sort((x,y)=>x.date.localeCompare(y.date)||x.code-y.code),byTeam={};
 for(const r of list)for(const [me,op] of [[r.home,r.away],[r.away,r.home]]){
  const id=CID[me];if(!id)throw new Error('Άγνωστος κωδικός ομάδας: '+me);
  const s=r.sides[me],o=r.sides[op],home=me===r.home,game={CID:id,code:r.code,round:r.round,date:r.date,opponent:names[CID[op]]||op,venue:home?'Εντός':'Εκτός',score:home?r.score.join('-'):[...r.score].reverse().join('-'),poss:r.src,Gm:1,Sec:r.sec,OfPo:s.Po,DePo:o.Po};
  for(const f of FIELDS){game['T'+f]=s[f];game['O'+f]=o[f];}
  (byTeam[id]=byTeam[id]||{complete:true,games:[]}).games.push(game);}
 const order=[...snapshot.map(t=>t.CID).filter(id=>byTeam[id]),...Object.keys(byTeam).filter(id=>!snapshot.some(t=>t.CID===id)).sort()];
 const teams=order.map(id=>{const games=byTeam[id].games;games.forEach((x,i)=>x.order=i+1);const t={CID:id,Cl:names[id]||id,Gm:games.length};
  for(const k of ['Sec','OfPo','DePo',...FIELDS.flatMap(f=>['T'+f,'O'+f])])t[k]=Math.round(games.reduce((n,x)=>n+x[k],0)*10)/10;return t;});
 return {teams,byTeam,list};}
function apply(){
 g.BETTING_PLAYER_INFO=E.info;g.BETTING_ROSTERS=E.rosters;
 const sch=E.schedule();if(sch.length)g.BETTING_SCHEDULE=sch;
 if(!Object.keys(E.records()).length){if(!state.games){g.BETTING_TEAMS=[];delete g.BETTING_HISTORY;}return false;}
 const {teams,byTeam}=build();
 g.BETTING_TEAMS=teams;g.BETTING_HISTORY={source:'EuroLeague',season:SEASON,byTeam};
 return true;}
function sync(){try{apply();}catch(e){state.error=String(e.message||e);console.error('[betting-live]',e);}
 try{g.dispatchEvent(new CustomEvent('betting-live',{detail:state}));}catch{}}

/* Άμεση εμφάνιση από τη μνήμη της μηχανής, μετά ενημέρωση σε κάθε event της. */
try{apply();}catch(e){state.error=String(e.message||e);}
try{g.addEventListener('euroleague-data',sync);}catch{}

g.BettingLive={state,refresh:E.refresh,reset:E.reset,records:E.records,schedule:E.schedule,possessions:E.possessions,parse:E.parse,build,season:SEASON,cid:CID,info:E.info,rosters:E.rosters,PFIELDS:E.PFIELDS};
})(globalThis);
