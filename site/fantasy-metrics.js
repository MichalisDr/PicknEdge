/* One definition per metric: tables, cards and history use these same functions. */
(function(g){
const {div,pts,net,pir,sfp,pace}=g.EuroLeagueData.metrics;/* ορισμοί κοινοί με το Betting (euroleague-data.js) */
const metric=(key,label,unit,get,options={})=>({key,label,unit,get,...options});
const pg=(p,n)=>div(n,p.Gm),per=(p,n)=>div(n,p.OfPo,100);
const players=[
 metric('min','MIN','/game',p=>div(p.Sec,60*p.Gm),{description:'Συνολικά λεπτά / πραγματικές συμμετοχές.'}),
 metric('usg','USG%','',p=>div(p.USA+p.Tv,p.TUSA,100),{pct:true,description:'100 × (SA + TOV παίκτη) / (SA + TOV ομάδας όσο παίζει). SA = σουτ ή σειρά βολών (and-one = 1, χωρίς AST και βολές τεχνικής). Πεντάδες/αλλαγές από play-by-play, επαληθευμένες έναντι των λεπτών του box score. Χωρίς πλήρη κάλυψη: —.'}),
 metric('pts','PTS','/100 poss',p=>per(p,pts(p)),{secondary:p=>pg(p,pts(p)),secondaryUnit:'/game'}),
 metric('ast','AST','/100 poss',p=>per(p,p.As),{secondary:p=>pg(p,p.As),secondaryUnit:'/game'}),
 metric('tov','TOV%','',p=>div(p.Tv,p.SA+p.Tv,100),{pct:true,goodHigher:false,description:'TOV / (FGA + 0,44 × FTA + TOV). Τύπος εκτίμησης χρήσεων, ίδιος με την τρέχουσα υλοποίηση.',secondary:p=>pg(p,p.Tv),secondaryUnit:'/game'}),
 metric('reb','REB','/100 poss',p=>div(p.OR+p.DR,p.OfPo+p.DePo,200),{secondary:p=>pg(p,p.OR+p.DR),secondaryUnit:'/game',detail:p=>'OREB / GAME '+format(pg(p,p.OR))+' · DREB / GAME '+format(pg(p,p.DR)),description:'Σ ριμπάουντ / μέσο επιθετικών και αμυντικών κατοχών όσο παίζει × 100 (πραγματική καταμέτρηση).'}),
 metric('ftr','FTr','FTA/FGA',p=>div(p.A1,p.A2+p.A3,100),{pct:true}),
 metric('fd','FD','/100 poss',p=>per(p,p.FR),{secondary:p=>pg(p,p.FR),secondaryUnit:'/game',description:'Φάουλ που κέρδισε. Ίδια βάση με τα PTS και AST (πραγματικές κατοχές στο γήπεδο).'}),
 metric('pir','PIR','/game',p=>pg(p,pir(p)),{section:'fantasy',secondary:p=>div(pir(p),p.Sec/60),secondaryUnit:'/ MIN',secondaryDigits:3,description:'Το δευτερεύον PIR / MIN = Σ PIR ÷ Σ λεπτά.'}),
 metric('sfp','Non-scoring PIR','/game',p=>pg(p,sfp(p)),{section:'fantasy',secondary:p=>div(sfp(p),p.Sec/60),secondaryUnit:'/ MIN',secondaryDigits:3,description:'Ό,τι δεν είναι σκοράρισμα: REB + AST + STL + BLK + FD − PF − BA − TOV, ανά συμμετοχή (πρώην NET SFP).'}),
 metric('netUsage','NET PIR / USG','scoring only',p=>div(net(p),p.SA+p.Tv),{section:'fantasy',digits:3,description:'Καθαρή συνεισφορά σκοραρίσματος (πόντοι − άστοχα − λάθη) / εκτιμώμενη χρήση (FGA + 0,44 × FTA + TOV). Δεν είναι συνολικό PIR / USG%. Ο ορισμός και το όνομα δεν έχουν κλειδώσει.'}),
 metric('cr','CR','credits',p=>Number.isFinite(p.CR)?p.CR:null,{section:'fantasy',description:'Τιμή Fantasy. Δεν υπάρχει ακόμη πηγή τιμών· εμφανίζεται — μέχρι να συνδεθεί.'}),
 metric('value','Value','PIR/G ÷ CR',p=>div(pg(p,pir(p)),p.CR),{section:'fantasy',digits:2,secondary:p=>div(div(pir(p),p.Sec/60),p.CR),secondaryUnit:'/ MIN',secondaryDigits:3,description:'PIR ανά αγώνα ÷ CR. Χωρίς CR εμφανίζεται —.'})
];
const teams=[
 metric('pace','Pace','/40′',t=>pace(t.OfPo,t.DePo,t.Sec),{neutral:true,full:'Possessions per 40 minutes',description:'Ρυθμός ανά 40 λεπτά. Η υψηλή τιμή δεν σημαίνει αδύναμη άμυνα.'}),
 metric('drtg','DRtg','PTS/100',t=>div(t.OM1+2*t.OM2+3*t.OM3,t.DePo,100),{rankHigher:false,full:'Defensive rating: opponent points per 100 possessions',secondary:t=>div(t.OM1+2*t.OM2+3*t.OM3,t.Gm),secondaryUnit:'/game'}),
 metric('efg','Opp eFG%','',t=>div(t.OM2+1.5*t.OM3,t.OA2+t.OA3,100),{pct:true,rankHigher:false,full:'Opponent effective field goal percentage'}),
 metric('tov','Opp TOV','/100 poss',t=>div(t.OTv,t.DePo,100),{goodHigher:false,full:'Opponent turnovers per 100 possessions',description:'Λάθη αντιπάλων × 100 / αμυντικές κατοχές. Παρονομαστής για όλους τους δείκτες «Opp … / 100» που ακολουθούν.'}),
 metric('ast','Opp AST','/100 poss',t=>div(t.OAs,t.DePo,100),{rankHigher:false,full:'Opponent assists per 100 possessions',secondary:t=>div(t.OAs,t.Gm),secondaryUnit:'/game'}),
 metric('dreb','DREB%','',t=>div(t.TDR,t.TDR+t.OOR,100),{pct:true,goodHigher:false,full:'Defensive rebound percentage',description:'Αμυντικά ριμπάουντ / (αμυντικά + επιθετικά ριμπάουντ αντιπάλων).'}),
 metric('ftr','Opp FTr','FTA/FGA',t=>div(t.OA1,t.OA2+t.OA3,100),{pct:true,rankHigher:false,full:'Opponent free throw rate'}),
 metric('sc','OppSCP','/100 poss',t=>div(t.OSC,t.DePo,100),{rankHigher:false,full:'Opponent second chance points per 100 possessions',secondary:t=>div(t.OSC,t.Gm),secondaryUnit:'/game',description:'Πόντοι αντιπάλων με επίσημο tag SECOND_CHANCE × 100 / αμυντικές κατοχές. Οι κατηγορίες μπορεί να επικαλύπτονται· δεν αθροίζονται.'}),
 metric('fb','OppFBP','/100 poss',t=>div(t.OFB,t.DePo,100),{rankHigher:false,full:'Opponent fast break points per 100 possessions',secondary:t=>div(t.OFB,t.Gm),secondaryUnit:'/game',description:'Πόντοι αντιπάλων με επίσημο tag FASTBREAK × 100 / αμυντικές κατοχές. Ελλιπής κάλυψη εμφανίζεται ως —.'}),
 metric('pot','OppPOT','/100 poss',t=>div(t.OPT,t.DePo,100),{rankHigher:false,full:'Opponent points off turnovers per 100 possessions',secondary:t=>div(t.OPT,t.Gm),secondaryUnit:'/game',description:'Πόντοι αντιπάλων με επίσημο tag POINTS_OFF_TURNOVER × 100 / αμυντικές κατοχές (ίδιος παρονομαστής με το Opp TOV / 100). Ελλιπής κάλυψη εμφανίζεται ως —.'})
];
/* The 6 sub-areas and their zones come from shot-zones.js, the same definition the shot chart draws. */
const ZONE_GROUPS=g.ShotZones.SUBS.map(s=>[s.key,s.name,s.ids]);
const zoneSum=(arr,idx)=>Array.isArray(arr)?idx.reduce((n,i)=>n+(arr[i]||0),0):null;
function shooting(kind){const team=kind==='teams',k=key=>team?'O'+key:key;return [
 metric('efg',team?'Opp eFG%':'eFG%','',p=>div(p[k('M2')]+1.5*p[k('M3')],p[k('A2')]+p[k('A3')],100),{pct:true,rankHigher:false}),
 ...['2','3',...(team?[]:['1'])].map(n=>metric('shot'+n,(team?'Opp ':'')+(n==='1'?'FT%':n+'FG%'),'',p=>div(p[k('M'+n)],p[k('A'+n)],100),{pct:true,rankHigher:false,detail:p=>format(div(p[k('M'+n)],p.Gm))+' / '+format(div(p[k('A'+n)],p.Gm))+' M/A / GAME'})),
 ...(team?ZONE_GROUPS.map(([key,label,idx])=>metric('zone'+key,'Opp '+label+' FG%','',t=>div(zoneSum(t.made,idx),zoneSum(t.attempts,idx),100),{pct:true,rankHigher:false,detail:t=>zoneSum(t.attempts,idx)===null?'':zoneSum(t.made,idx)+'/'+zoneSum(t.attempts,idx)+' FGA',description:'FG% αντιπάλων στην υποπεριοχή (άθροισμα εύστοχων ÷ άθροισμα προσπαθειών των ζωνών της), από τα σουτ EuroLeague. Ζώνες: shot-zones.js.'})):[])
];}
function defs(kind,view){return view==='shooting'?shooting(kind):kind==='teams'?teams:players;}
function dataset(period){return period==='season'?g.FANTASY_DATA:g.FANTASY_PERIOD_DATA[period];}
function rows(kind,period){const d=dataset(period);return kind==='teams'?d.raw.map(p=>({...p,...d.teams.find(t=>t.id===p.CID),Gm:p.Gm})):d.players;}
function history(kind,id,period){const all=g.FANTASY_HISTORY?.[kind]?.[id]||[];let selected=all;if(period!=='season'){if(kind==='teams')selected=all.slice(-Number(period));else{const p=g.FANTASY_DATA.players.find(p=>p.PID===id),games=new Set((g.FANTASY_HISTORY?.teams?.[p?.CID]||[]).slice(-Number(period)).map(r=>r.game));selected=all.filter(r=>games.has(r.game));}}return selected.filter(r=>kind==='teams'||r.played);}
function series(kind,id,period,def){return history(kind,id,period).map(r=>({round:r.round,game:r.game,date:r.date,opponent:r.opponent,value:r.totals?def.get(r.totals):null}));}
function average(list,def){const totals={};for(const p of list)for(const [k,v] of Object.entries(p)){if(typeof v==='number')totals[k]=totals[k]===null?null:(totals[k]||0)+v;else if(v===null)totals[k]=null;else if(Array.isArray(v)&&v.every(Number.isFinite))totals[k]=Array.isArray(totals[k])?totals[k].map((n,i)=>n+v[i]):v.slice();}return def.get(totals);}
/* Direction of improvement: +1 higher is better, −1 lower is better, 0 no clear direction. Teams: better defence (rank order); players: goodHigher. */
const NEUTRAL_PLAYER=new Set(['min','usg','ftr','cr']);
function direction(kind,def){if(def.neutral)return 0;if(kind==='teams')return def.rankHigher===false?-1:1;if(NEUTRAL_PLAYER.has(def.key))return 0;return def.goodHigher===false?-1:1;}
/* Whole-season curve: per-game value plus the rolling value of the last n appearances (from the n-th on), both from summed totals, independent of the selected sample. */
function trend(kind,id,def,n=5){const h=history(kind,id,'season');return h.map((r,i)=>{const win=i+1>=n?h.slice(i+1-n,i+1):null,roll=win&&win.every(x=>x.totals)?average(win.map(x=>x.totals),def):null;return {round:r.round,game:r.game,date:r.date,opponent:r.opponent,value:r.totals?def.get(r.totals):null,roll:Number.isFinite(roll)?roll:null};});}
function quantile(sorted,q){if(!sorted.length)return null;const x=(sorted.length-1)*q,lo=Math.floor(x),hi=Math.ceil(x);return sorted[lo]+(sorted[hi]-sorted[lo])*(x-lo);}
/* League distribution of per-game values over a list of season rows (the pool the page filters leave). */
function league(kind,def,list){const v=[];for(const p of list)for(const r of history(kind,p.PID||p.CID,'season'))if(r.totals){const x=def.get(r.totals);if(Number.isFinite(x))v.push(x);}v.sort((a,b)=>a-b);return {n:v.length,p2:quantile(v,.02),p25:quantile(v,.25),p75:quantile(v,.75),p98:quantile(v,.98)};}
function spread(values){const v=values.filter(Number.isFinite),n=v.length;if(!n)return {n:0,min:null,max:null,sd:null};const m=v.reduce((a,b)=>a+b,0)/n;return {n,min:Math.min(...v),max:Math.max(...v),sd:n>1?Math.sqrt(v.reduce((a,b)=>a+(b-m)*(b-m),0)/(n-1)):null};}
/* With / without each current teammate, whole season, same game IDs only: games the player played for his current team in which the teammate
   either played (with) or was a recorded absence (without: a team game after his first appearance for the team in which he has no appearance).
   Games before his first appearance for the team (outside the roster) or missing from his history are neither. Values from summed totals. */
function withWithout(pid,def){
 const D=g.FANTASY_DATA,H=g.FANTASY_HISTORY?.players||{},me=D?.players.find(p=>p.PID===pid);if(!me||!H[pid])return {games:0,mates:[]};
 const cid=me.CID,mine=H[pid].filter(r=>r.cid===cid&&r.played&&r.totals),sum=list=>list.length?average(list.map(r=>r.totals),def):null,mates=[];
 for(const t of D.players){if(t.CID!==cid||t.PID===pid||!H[t.PID])continue;
  const rows=new Map(H[t.PID].filter(r=>r.cid===cid).map(r=>[r.game,r])),start=[...rows.values()].find(r=>r.played)?.round;if(start===undefined)continue;
  const w=[],wo=[];for(const r of mine){const q=rows.get(r.game);if(!q)continue;if(q.played)w.push(r);else if(q.round>start)wo.push(r);}
  if(!wo.length)continue;
  const a=sum(w),b=sum(wo);
  mates.push({pid:t.PID,name:[t.Fn,t.Sn].filter(Boolean).join(' '),pos:t.Pos,nWith:w.length,nWithout:wo.length,withValue:a,withoutValue:b,diff:Number.isFinite(a)&&Number.isFinite(b)?b-a:null,
   games:wo.map(r=>({game:r.game,round:r.round,opponent:r.opponent,value:r.totals?def.get(r.totals):null}))});}
 mates.sort((x,y)=>y.nWithout-x.nWithout||x.name.localeCompare(y.name));
 return {games:mine.length,mates};}
const EVAL={good:'#DFFBE9',avg:'#FBFFDF',bad:'#F6E0E3'};/* shared good / average / bad evaluation palette */
function rank(list,p,def){const value=def.get(p),valid=list.map(def.get).filter(Number.isFinite);if(!Number.isFinite(value)||!valid.length)return null;const position=1+valid.filter(v=>def.rankHigher===false?v<value-1e-9:v>value+1e-9).length;const goodness=1+valid.filter(v=>def.goodHigher===false?v<value-1e-9:v>value+1e-9).length;return {position,n:valid.length,color:def.neutral?'#bdc7d5':goodness<=Math.ceil(valid.length/3)?EVAL.good:goodness>Math.ceil(valid.length*2/3)?EVAL.bad:EVAL.avg};}
function format(value,digits=1){return Number.isFinite(value)?value.toFixed(digits):'—';}
g.FantasyMetrics={EVAL,defs,rows,dataset,history,series,trend,league,spread,direction,withWithout,average,rank,format,div,pir,net,sfp};
})(globalThis);
