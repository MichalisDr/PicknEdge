/* Official shot events, independent of Betting's cache. Never treat incomplete coverage as zero. */
(function(g){
'use strict';
const KEY='picknedge-shots-E2026-v1',data={...(g.FANTASY_SHOTS_SEED||{})},state={loading:false,error:null};
try{Object.assign(data,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{}
const compact=r=>[String(r.TEAM||'').trim(),String(r.ID_PLAYER||'').trim().replace(/^P/,''),String(r.ID_ACTION).trim(),Number(r.COORD_X),Number(r.COORD_Y),Number(r.POINTS),String(r.FASTBREAK)==='1'?1:0,String(r.SECOND_CHANCE)==='1'?1:0,String(r.POINTS_OFF_TURNOVER)==='1'?1:0];
const hasPot=rows=>Array.isArray(rows)&&rows.every(r=>r.length>8);
function valid(rows,rec){return Array.isArray(rows)&&[rec.home,rec.away].every(team=>{const a=rows.filter(r=>r[0]===team),s=rec.sides[team];return ['2','3'].every(k=>a.filter(r=>r[2]===k+'FGA'||r[2]===k+'FGM').length===s['A'+k]&&a.filter(r=>r[2]===k+'FGM').length===s['M'+k])&&a.reduce((n,r)=>n+r[5],0)===s.M1+2*s.M2+3*s.M3;});}
/* Zone boundaries live in shot-zones.js, shared with the chart. -1 = unusable coordinates (the game then counts as incomplete). */
function zone(r){return g.ShotZones.classify(r[3],r[4],r[2][0]==='3');}
function summary(code,team,player){const rec=g.EuroLeagueData?.records()[code],all=data[code];if(!rec||!valid(all,rec))return null;const rows=all.filter(r=>r[0]===team&&(!player||r[1]===player)),made=Array(g.ShotZones.COUNT).fill(0),attempts=Array(g.ShotZones.COUNT).fill(0);let fb=0,sc=0,pot=hasPot(all)?0:null;for(const r of rows){fb+=r[6]?r[5]:0;sc+=r[7]?r[5]:0;if(pot!==null)pot+=r[8]?r[5]:0;if(!/^[23]FG[AM]$/.test(r[2]))continue;const z=zone(r);if(z<0)return null;attempts[z]++;if(r[2].endsWith('M'))made[z]++;}return {made,attempts,fb,sc,pot};}
/* Real shot coordinates (EuroLeague units) with the same zone index as summary(); for the court chart. */
function events(code,team,player){const rec=g.EuroLeagueData?.records()[code],all=data[code];if(!rec||!valid(all,rec))return null;return all.filter(r=>r[0]===team&&(!player||r[1]===player)&&/^[23]FG[AM]$/.test(r[2])).map(r=>({x:r[3],y:r[4],three:r[2][0]==='3',made:r[2].endsWith('M'),zone:zone(r)}));}
/* Every shot of the sample: [{code,team,player}] -> events, or null if any game is missing/unusable. */
function eventsOf(keys){const out=[];for(const [code,team,player] of keys){const ev=events(code,team,player);if(!ev||ev.some(e=>e.zone<0))return null;out.push(...ev);}return out;}
/* Ένα αίτημα τη φορά. Σε 429: αναμονή όσο λέει το Retry-After (ή αυξανόμενη), το πολύ 3 επαναλήψεις, μετά διακοπή χωρίς παράκαμψη. */
async function getPoints(code){await new Promise(r=>setTimeout(r,500));for(let attempt=0;;attempt++){let res;try{res=await fetch('https://live.euroleague.net/api/Points?gamecode='+code+'&seasoncode=E2026');}catch(e){if(attempt<2){await new Promise(r=>setTimeout(r,20000*(attempt+1)));continue;}throw e;}if(res.status===429&&attempt<3){const h=res.headers.get('Retry-After'),s=Number(h),d=Date.parse(h||'');await new Promise(r=>setTimeout(r,h&&Number.isFinite(s)?Math.min(s,120)*1000:Number.isFinite(d)?Math.min(Math.max(d-Date.now(),1000),120000):15000*(attempt+1)));continue;}if(!res.ok)throw Error('HTTP '+res.status);return res.json();}}
let running=false;
async function refresh(){if(running||g.FANTASY_SHOTS_DISABLED)return;running=true;state.loading=true;state.error=null;try{for(const rec of Object.values(g.EuroLeagueData?.records()||{})){if(valid(data[rec.code],rec)&&hasPot(data[rec.code]))continue;const raw=await getPoints(rec.code),rows=(raw.Rows||[]).map(compact);if(!valid(rows,rec))throw Error('Ελλιπή δεδομένα σουτ αγώνα '+rec.code);data[rec.code]=rows;try{const extra=Object.fromEntries(Object.entries(data).filter(([k])=>!g.FANTASY_SHOTS_SEED?.[k]));localStorage.setItem(KEY,JSON.stringify(extra));}catch{}g.FantasyLive?.rebuild();}}catch(e){state.error=String(e.message||e);}finally{running=false;state.loading=false;g.dispatchEvent(new Event('fantasy-shots'));if(state.error&&(state.retries=(state.retries||0)+1)<=5)setTimeout(refresh,75000);}}
g.FantasyShots={summary,events,eventsOf,refresh,state,compact,valid,zone};
g.addEventListener('euroleague-data',e=>{if(e.detail?.status!=='loading')refresh();});
g.FantasyLive?.rebuild();refresh();
})(globalThis);
