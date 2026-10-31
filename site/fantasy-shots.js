/* Official shot events, independent of Betting's cache. Never treat incomplete coverage as zero. */
(function(g){
'use strict';
const KEY='picknedge-shots-E2026-v1',data={...(g.FANTASY_SHOTS_SEED||{})},state={loading:false,error:null};
try{Object.assign(data,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{}
const compact=r=>[String(r.TEAM||'').trim(),String(r.ID_PLAYER||'').trim().replace(/^P/,''),String(r.ID_ACTION).trim(),Number(r.COORD_X),Number(r.COORD_Y),Number(r.POINTS),String(r.FASTBREAK)==='1'?1:0,String(r.SECOND_CHANCE)==='1'?1:0,String(r.POINTS_OFF_TURNOVER)==='1'?1:0];
const hasPot=rows=>Array.isArray(rows)&&rows.every(r=>r.length>8);
function valid(rows,rec){return Array.isArray(rows)&&[rec.home,rec.away].every(team=>{const a=rows.filter(r=>r[0]===team),s=rec.sides[team];return ['2','3'].every(k=>a.filter(r=>r[2]===k+'FGA'||r[2]===k+'FGM').length===s['A'+k]&&a.filter(r=>r[2]===k+'FGM').length===s['M'+k])&&a.reduce((n,r)=>n+r[5],0)===s.M1+2*s.M2+3*s.M3;});}
function zone(r){const x=r[3],y=r[4],angle=Math.atan2(y,x)*180/Math.PI;if(r[2][0]==='3'){if(y<300&&Math.abs(x)>600)return x<0?0:4;return angle<68?9:angle<=112?10:8;}if(Math.abs(x)<=245&&y<=422.5)return 2;return angle<30?3:angle<70?6:angle<=110?7:angle<=150?5:1;}
function summary(code,team,player){const rec=g.BettingLive?.records()[code],all=data[code];if(!rec||!valid(all,rec))return null;const rows=all.filter(r=>r[0]===team&&(!player||r[1]===player)),made=Array(11).fill(0),attempts=Array(11).fill(0);let fb=0,sc=0,pot=hasPot(all)?0:null;for(const r of rows){fb+=r[6]?r[5]:0;sc+=r[7]?r[5]:0;if(pot!==null)pot+=r[8]?r[5]:0;if(!/^[23]FG[AM]$/.test(r[2]))continue;const z=zone(r);attempts[z]++;if(r[2].endsWith('M'))made[z]++;}return {made,attempts,fb,sc,pot};}
/* Real shot coordinates (EuroLeague units) with the same zone index as summary(); for the court chart. */
function events(code,team,player){const rec=g.BettingLive?.records()[code],all=data[code];if(!rec||!valid(all,rec))return null;return all.filter(r=>r[0]===team&&(!player||r[1]===player)&&/^[23]FG[AM]$/.test(r[2])).map(r=>({x:r[3],y:r[4],three:r[2][0]==='3',made:r[2].endsWith('M'),zone:zone(r)}));}
let running=false;
async function refresh(){if(running||g.FANTASY_SHOTS_DISABLED)return;running=true;state.loading=true;state.error=null;try{for(const rec of Object.values(g.BettingLive?.records()||{})){if(valid(data[rec.code],rec)&&hasPot(data[rec.code]))continue;const res=await fetch('https://live.euroleague.net/api/Points?gamecode='+rec.code+'&seasoncode=E2026');if(!res.ok)throw Error('HTTP '+res.status);const raw=await res.json(),rows=(raw.Rows||[]).map(compact);if(!valid(rows,rec))throw Error('Ελλιπή δεδομένα σουτ αγώνα '+rec.code);data[rec.code]=rows;try{const extra=Object.fromEntries(Object.entries(data).filter(([k])=>!g.FANTASY_SHOTS_SEED?.[k]));localStorage.setItem(KEY,JSON.stringify(extra));}catch{}g.FantasyLive?.rebuild();}}catch(e){state.error=String(e.message||e);}finally{running=false;state.loading=false;g.dispatchEvent(new Event('fantasy-shots'));}}
g.FantasyShots={summary,events,refresh,state,compact,valid,zone};
g.addEventListener('betting-live',e=>{if(e.detail?.status!=='loading')refresh();});
g.FantasyLive?.rebuild();refresh();
})(globalThis);
