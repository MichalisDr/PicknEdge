/* Official shot events, independent of Betting's cache. Never treat incomplete coverage as zero. */
(function(g){
'use strict';
const KEY='picknedge-shots-E2026-v2',data={...(g.FANTASY_SHOTS_SEED||{})},state={loading:false,error:null};
try{Object.assign(data,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{}
/* Last field: 1 = assisted FG, 0 = unassisted FG (or any other row), null = assist data of the game could not be linked exactly (never treated as unassisted). */
const compact=(r,assisted)=>[String(r.TEAM||'').trim(),String(r.ID_PLAYER||'').trim().replace(/^P/,''),String(r.ID_ACTION).trim(),Number(r.COORD_X),Number(r.COORD_Y),Number(r.POINTS),String(r.FASTBREAK)==='1'?1:0,String(r.SECOND_CHANCE)==='1'?1:0,String(r.POINTS_OFF_TURNOVER)==='1'?1:0,/^[23]FGM$/.test(String(r.ID_ACTION).trim())?(assisted&&assisted.ok.has(String(r.TEAM||'').trim())?(assisted.set.has(Number(r.NUM_ANOT))?1:0):null):0];
const hasPot=rows=>Array.isArray(rows)&&rows.every(r=>r.length>8),hasAst=rows=>Array.isArray(rows)&&rows.every(r=>r.length>9);
/* Assist linkage per game. Points NUM_ANOT = play-by-play NUMBEROFPLAY, so the made FG of a shot is known exactly.
   The sequence of plays is the order the feed delivers them (quarter by quarter): the numbers of re-entered plays (a corrected FG or FT) are out of order, the clock is not reliable for AS plays.
   An AS belongs to: (1) the play right before it when that is a made FG of the same team by another player not yet assisted;
   (2) otherwise a free-throw trip: the play right before it is a made FT of the same team by another player, or (3) a FT/FTA of the same team by another player with the same clock within 12 plays in the same quarter.
   Such an assist is counted in the team's assists but never marks a field goal. Anything else is unresolved.
   A team's game is valid only if every AS of the team is resolved, the team's AS count equals its box-score assists and every made FG of the Points feed is the same made FG (number, team, player) in the play-by-play with unique numbers.
   Returns {set: NUM_ANOT of assisted made FGs, ok: Set of valid team codes} or null; an invalid team-game is never treated as unassisted. */
function assistedShots(pbp,points,rec){
 const plays=['FirstQuarter','SecondQuarter','ThirdQuarter','ForthQuarter','ExtraTime'].flatMap((q,qi)=>(pbp?.[q]||[]).map(e=>({n:Number(e.NUMBEROFPLAY),q:qi,team:String(e.CODETEAM||'').trim(),player:String(e.PLAYER_ID||'').trim().replace(/^P/,''),type:String(e.PLAYTYPE||'').trim(),mt:String(e.MARKERTIME||'').trim()}))),
  isMake=e=>/^[23]FGM$/.test(e.type),set=new Set(),count={},bad=new Set();
 if(!plays.length||!rec)return null;
 const makes=new Map();for(const e of plays.filter(isMake)){if(makes.has(e.n))return null;makes.set(e.n,e);}
 plays.forEach((e,i)=>{if(e.type!=='AS')return;count[e.team]=(count[e.team]||0)+1;const prev=plays[i-1],other=m=>m&&m.team===e.team&&m.player!==e.player;
  if(other(prev)&&isMake(prev)&&!set.has(prev.n))set.add(prev.n);
  else if(other(prev)&&prev.type==='FTM');
  else if(plays.some((m,j)=>other(m)&&/^FT[AM]$/.test(m.type)&&m.q===e.q&&m.mt===e.mt&&Math.abs(j-i)<=12));
  else bad.add(e.team);});
 for(const r of points||[]){if(!/^[23]FGM$/.test(String(r.ID_ACTION).trim()))continue;const m=makes.get(Number(r.NUM_ANOT));if(!m||m.team!==String(r.TEAM||'').trim()||m.player!==String(r.ID_PLAYER||'').trim().replace(/^P/,''))return null;}
 const ok=new Set([rec.home,rec.away].filter(team=>!bad.has(team)&&(count[team]||0)===rec.sides[team].As));
 return {set,ok};
}function valid(rows,rec){return Array.isArray(rows)&&[rec.home,rec.away].every(team=>{const a=rows.filter(r=>r[0]===team),s=rec.sides[team];return ['2','3'].every(k=>a.filter(r=>r[2]===k+'FGA'||r[2]===k+'FGM').length===s['A'+k]&&a.filter(r=>r[2]===k+'FGM').length===s['M'+k])&&a.reduce((n,r)=>n+r[5],0)===s.M1+2*s.M2+3*s.M3;});}
/* Zone boundaries live in shot-zones.js, shared with the chart. -1 = unusable coordinates (the game then counts as incomplete). */
function zone(r){return g.ShotZones.classify(r[3],r[4],r[2][0]==='3');}
function summary(code,team,player){const rec=g.EuroLeagueData?.records()[code],all=data[code];if(!rec||!valid(all,rec))return null;const rows=all.filter(r=>r[0]===team&&(!player||r[1]===player)),made=Array(g.ShotZones.COUNT).fill(0),attempts=Array(g.ShotZones.COUNT).fill(0),ma=Array(g.ShotZones.COUNT).fill(0),mu=Array(g.ShotZones.COUNT).fill(0),mn=Array(g.ShotZones.COUNT).fill(0);let fb=0,sc=0,pot=hasPot(all)?0:null;for(const r of rows){fb+=r[6]?r[5]:0;sc+=r[7]?r[5]:0;if(pot!==null)pot+=r[8]?r[5]:0;if(!/^[23]FG[AM]$/.test(r[2]))continue;const z=zone(r);if(z<0)return null;attempts[z]++;if(r[2].endsWith('M')){made[z]++;if(r[9]===1)ma[z]++;else if(r[9]===0)mu[z]++;else mn[z]++;}}return {made,attempts,ma,mu,mn,fb,sc,pot};}
/* Real shot coordinates (EuroLeague units) with the same zone index as summary(); for the court chart. */
function events(code,team,player){const rec=g.EuroLeagueData?.records()[code],all=data[code];if(!rec||!valid(all,rec))return null;return all.filter(r=>r[0]===team&&(!player||r[1]===player)&&/^[23]FG[AM]$/.test(r[2])).map(r=>({x:r[3],y:r[4],three:r[2][0]==='3',made:r[2].endsWith('M'),ast:r[9]===1?1:r[9]===0?0:null,zone:zone(r)}));}
/* Every shot of the sample: [{code,team,player}] -> events, or null if any game is missing/unusable. */
function eventsOf(keys){const out=[];for(const [code,team,player] of keys){const ev=events(code,team,player);if(!ev||ev.some(e=>e.zone<0))return null;out.push(...ev);}return out;}
/* Ένα αίτημα τη φορά. Σε 429: αναμονή όσο λέει το Retry-After (ή αυξανόμενη), το πολύ 3 επαναλήψεις, μετά διακοπή χωρίς παράκαμψη. */
async function getFeed(kind,code){await new Promise(r=>setTimeout(r,500));for(let attempt=0;;attempt++){let res;try{res=await fetch('https://live.euroleague.net/api/'+kind+'?gamecode='+code+'&seasoncode=E2026');}catch(e){if(attempt<2){await new Promise(r=>setTimeout(r,20000*(attempt+1)));continue;}throw e;}if(res.status===429&&attempt<3){const h=res.headers.get('Retry-After'),s=Number(h),d=Date.parse(h||'');await new Promise(r=>setTimeout(r,h&&Number.isFinite(s)?Math.min(s,120)*1000:Number.isFinite(d)?Math.min(Math.max(d-Date.now(),1000),120000):15000*(attempt+1)));continue;}if(!res.ok)throw Error('HTTP '+res.status);return res.json();}}
let running=false,shown=0;/* games arrive one by one: redraw an open chart at most every 4 s while loading */
async function refresh(){if(running||g.FANTASY_SHOTS_DISABLED)return;running=true;state.loading=true;state.error=null;try{for(const rec of Object.values(g.EuroLeagueData?.records()||{})){if(valid(data[rec.code],rec)&&hasPot(data[rec.code])&&hasAst(data[rec.code]))continue;const raw=await getFeed('Points',rec.code),pbp=await getFeed('PlayByPlay',rec.code),flags=assistedShots(pbp,raw.Rows,rec),rows=(raw.Rows||[]).map(r=>compact(r,flags));if(!valid(rows,rec))throw Error('Ελλιπή δεδομένα σουτ αγώνα '+rec.code);data[rec.code]=rows;try{const extra=Object.fromEntries(Object.entries(data).filter(([k])=>!g.FANTASY_SHOTS_SEED?.[k]));localStorage.setItem(KEY,JSON.stringify(extra));}catch{}g.FantasyLive?.rebuild();if(Date.now()-shown>4000){shown=Date.now();g.dispatchEvent(new Event('fantasy-shots'));}}}catch(e){state.error=String(e.message||e);}finally{running=false;state.loading=false;g.dispatchEvent(new Event('fantasy-shots'));if(state.error&&(state.retries=(state.retries||0)+1)<=5)setTimeout(refresh,75000);}}
g.FantasyShots={summary,events,eventsOf,refresh,state,compact,valid,zone,assistedShots};
g.addEventListener('euroleague-data',e=>{if(e.detail?.status!=='loading')refresh();});
g.FantasyLive?.rebuild();refresh();
})(globalThis);
