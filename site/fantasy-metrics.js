/* One definition per metric: tables, cards and history use these same functions. */
(function(g){
const div=(n,d,k=1)=>Number.isFinite(n)&&Number.isFinite(d)&&d>0?k*n/d:null;
const pts=p=>p.M1+2*p.M2+3*p.M3;
const net=p=>pts(p)-(p.A1-p.M1)-(p.A2-p.M2)-(p.A3-p.M3)-p.Tv;
const other=p=>p.OR+p.DR+p.As+p.St+p.BF+p.FR-p.FC-p.BA;
const pir=p=>net(p)+other(p),sfp=p=>other(p)-p.Tv;
const metric=(key,label,unit,get,options={})=>({key,label,unit,get,...options});
const pg=(p,n)=>div(n,p.Gm),per=(p,n)=>div(n,p.OfPo,100);
const players=[
 metric('min','MIN','/ GAME',p=>div(p.Sec,60*p.Gm),{description:'Συνολικά λεπτά / πραγματικές συμμετοχές.'}),
 metric('usg','USG%','',p=>div(p.SA+p.Tv,p.TSA+p.TTv,100),{pct:true,estimated:true,description:'(FGA + 0,44 × FTA + TOV) / εκτιμώμενες χρήσεις ομάδας όσο παίζει. Δεν έχει επαληθευτεί ως ταυτόσημο με 3StepsBasket.'}),
 metric('pts','PTS','/ 100 POSS',p=>per(p,pts(p)),{estimated:true,secondary:p=>pg(p,pts(p)),secondaryUnit:'/ GAME'}),
 metric('ast','AST','/ 100 POSS',p=>per(p,p.As),{estimated:true,secondary:p=>pg(p,p.As),secondaryUnit:'/ GAME'}),
 metric('tov','TOV%','',p=>div(p.Tv,p.SA+p.Tv,100),{pct:true,description:'TOV / (FGA + 0,44 × FTA + TOV). Τύπος εκτίμησης χρήσεων, ίδιος με την τρέχουσα υλοποίηση.',secondary:p=>pg(p,p.Tv),secondaryUnit:'/ GAME'}),
 metric('reb','REB','/ 100 POSS',p=>div(p.OR+p.DR,p.OfPo+p.DePo,200),{estimated:true,secondary:p=>pg(p,p.OR+p.DR),secondaryUnit:'/ GAME',detail:p=>'OREB / GAME '+format(pg(p,p.OR))+' · DREB / GAME '+format(pg(p,p.DR)),description:'Σ ριμπάουντ / μέσο επιθετικών και αμυντικών κατοχών όσο παίζει × 100.'}),
 metric('ftr','FTr','FTA / FGA',p=>div(p.A1,p.A2+p.A3,100),{pct:true}),
 metric('fd','FD','/ 100 POSS',p=>per(p,p.FR),{estimated:true,secondary:p=>pg(p,p.FR),secondaryUnit:'/ GAME',description:'Φάουλ που κέρδισε. Ίδια βάση με τα PTS και AST (κατοχές στο γήπεδο).'}),
 metric('pir','PIR','/ GAME',p=>pg(p,pir(p)),{section:'fantasy',secondary:p=>div(pir(p),p.Sec/60),secondaryUnit:'/ MIN',secondaryDigits:3,description:'Το δευτερεύον PIR / MIN = Σ PIR ÷ Σ λεπτά.'}),
 metric('sfp','Non-scoring PIR','/ GAME',p=>pg(p,sfp(p)),{section:'fantasy',secondary:p=>div(sfp(p),p.Sec/60),secondaryUnit:'/ MIN',secondaryDigits:3,description:'Ό,τι δεν είναι σκοράρισμα: REB + AST + STL + BLK + FD − PF − BA − TOV, ανά συμμετοχή (πρώην NET SFP).'}),
 metric('netUsage','NET PIR / USG','scoring only',p=>div(net(p),p.SA+p.Tv),{section:'fantasy',digits:3,description:'Καθαρή συνεισφορά σκοραρίσματος (πόντοι − άστοχα − λάθη) / εκτιμώμενη χρήση (FGA + 0,44 × FTA + TOV). Δεν είναι συνολικό PIR / USG%. Ο ορισμός και το όνομα δεν έχουν κλειδώσει.'}),
 metric('cr','CR','credits',p=>Number.isFinite(p.CR)?p.CR:null,{section:'fantasy',description:'Τιμή Fantasy. Δεν υπάρχει ακόμη πηγή τιμών· εμφανίζεται — μέχρι να συνδεθεί.'}),
 metric('value','Value','PIR/G ÷ CR',p=>div(pg(p,pir(p)),p.CR),{section:'fantasy',digits:2,description:'PIR ανά αγώνα ÷ CR. Χωρίς CR εμφανίζεται —.'})
];
const teams=[
 metric('pace','Pace','/ 40′',t=>div(t.OfPo+t.DePo,t.Sec,1200),{neutral:true,description:'Ρυθμός ανά 40 λεπτά. Η υψηλή τιμή δεν σημαίνει αδύναμη άμυνα.'}),
 metric('drtg','DRtg','PTS / 100',t=>div(t.OM1+2*t.OM2+3*t.OM3,t.DePo,100),{rankHigher:false,secondary:t=>div(t.OM1+2*t.OM2+3*t.OM3,t.Gm),secondaryUnit:'/ GAME'}),
 metric('efg','Opp eFG%','',t=>div(t.OM2+1.5*t.OM3,t.OA2+t.OA3,100),{pct:true}),
 metric('tov','Opp TOV / 100','/ 100 POSS',t=>div(t.OTv,t.DePo,100),{goodHigher:false,description:'Λάθη αντιπάλων × 100 / αμυντικές κατοχές. Παρονομαστής για όλους τους δείκτες «Opp … / 100» που ακολουθούν.'}),
 metric('ast','Opp AST / 100','/ 100 POSS',t=>div(t.OAs,t.DePo,100),{secondary:t=>div(t.OAs,t.Gm),secondaryUnit:'/ GAME'}),
 metric('dreb','DREB%','',t=>div(t.TDR,t.TDR+t.OOR,100),{pct:true,goodHigher:false,description:'Αμυντικά ριμπάουντ / (αμυντικά + επιθετικά ριμπάουντ αντιπάλων).'}),
 metric('ftr','Opp FTr','FTA / FGA',t=>div(t.OA1,t.OA2+t.OA3,100),{pct:true}),
 metric('sc','Opp Second Chance PTS / 100','/ 100 POSS',t=>div(t.OSC,t.DePo,100),{secondary:t=>div(t.OSC,t.Gm),secondaryUnit:'/ GAME',description:'Πόντοι αντιπάλων με επίσημο tag SECOND_CHANCE × 100 / αμυντικές κατοχές. Οι κατηγορίες μπορεί να επικαλύπτονται· δεν αθροίζονται.'}),
 metric('fb','Opp Fast Break PTS / 100','/ 100 POSS',t=>div(t.OFB,t.DePo,100),{secondary:t=>div(t.OFB,t.Gm),secondaryUnit:'/ GAME',description:'Πόντοι αντιπάλων με επίσημο tag FASTBREAK × 100 / αμυντικές κατοχές. Ελλιπής κάλυψη εμφανίζεται ως —.'}),
 metric('pot','Opp Points off TO / 100','/ 100 POSS',t=>div(t.OPT,t.DePo,100),{secondary:t=>div(t.OPT,t.Gm),secondaryUnit:'/ GAME',description:'Πόντοι αντιπάλων με επίσημο tag POINTS_OFF_TURNOVER × 100 / αμυντικές κατοχές (ίδιος παρονομαστής με το Opp TOV / 100). Ελλιπής κάλυψη εμφανίζεται ως —.'})
];
/* Zone indexes follow fantasy-viz.js / fantasy-shots.js: 0,4 corner 3 · 1,3,5,6,7 mid-range · 2 paint · 8,9,10 arc 3. */
const ZONE_GROUPS=[['paint','Paint',[2]],['mid','Mid',[1,3,5,6,7]],['corner','Corner',[0,4]],['arc','Arc',[8,9,10]]];
const zoneSum=(arr,idx)=>Array.isArray(arr)?idx.reduce((n,i)=>n+(arr[i]||0),0):null;
function shooting(kind){const team=kind==='teams',k=key=>team?'O'+key:key;return [
 metric('efg',team?'Opp eFG%':'eFG%','',p=>div(p[k('M2')]+1.5*p[k('M3')],p[k('A2')]+p[k('A3')],100),{pct:true}),
 ...['2','3',...(team?[]:['1'])].map(n=>metric('shot'+n,(team?'Opp ':'')+(n==='1'?'FT%':n+'FG%'),'',p=>div(p[k('M'+n)],p[k('A'+n)],100),{pct:true,detail:p=>format(div(p[k('M'+n)],p.Gm))+' / '+format(div(p[k('A'+n)],p.Gm))+' M/A / GAME'})),
 ...(team?ZONE_GROUPS.map(([key,label,idx])=>metric('zone'+key,'Opp '+label+' FG%','',t=>div(zoneSum(t.made,idx),zoneSum(t.attempts,idx),100),{pct:true,detail:t=>zoneSum(t.attempts,idx)===null?'':zoneSum(t.made,idx)+'/'+zoneSum(t.attempts,idx)+' FGA',description:'FG% αντιπάλων στη ζώνη, από τις ζώνες σουτ EuroLeague. Ο όγκος προσπαθειών φαίνεται στο hover.'})):[])
];}
function defs(kind,view){return view==='shooting'?shooting(kind):kind==='teams'?teams:players;}
function dataset(period){return period==='season'?g.FANTASY_DATA:g.FANTASY_PERIOD_DATA[period];}
function rows(kind,period){const d=dataset(period);return kind==='teams'?d.raw.map(p=>({...p,...d.teams.find(t=>t.id===p.CID),Gm:p.Gm})):d.players;}
function history(kind,id,period){const all=g.FANTASY_HISTORY?.[kind]?.[id]||[];let selected=all;if(period!=='season'){if(kind==='teams')selected=all.slice(-Number(period));else{const p=g.FANTASY_DATA.players.find(p=>p.PID===id),games=new Set((g.FANTASY_HISTORY?.teams?.[p?.CID]||[]).slice(-Number(period)).map(r=>r.game));selected=all.filter(r=>games.has(r.game));}}return selected.filter(r=>kind==='teams'||r.played);}
function series(kind,id,period,def){return history(kind,id,period).map(r=>({round:r.round,game:r.game,date:r.date,opponent:r.opponent,value:r.totals?def.get(r.totals):null}));}
function average(list,def){const totals={};for(const p of list)for(const [k,v] of Object.entries(p)){if(typeof v==='number')totals[k]=totals[k]===null?null:(totals[k]||0)+v;else if(v===null)totals[k]=null;else if(Array.isArray(v)&&v.every(Number.isFinite))totals[k]=Array.isArray(totals[k])?totals[k].map((n,i)=>n+v[i]):v.slice();}return def.get(totals);}
function rank(list,p,def){const value=def.get(p),valid=list.map(def.get).filter(Number.isFinite);if(!Number.isFinite(value)||!valid.length)return null;const position=1+valid.filter(v=>def.rankHigher===false?v<value-1e-9:v>value+1e-9).length;const goodness=1+valid.filter(v=>def.goodHigher===false?v<value-1e-9:v>value+1e-9).length;return {position,n:valid.length,color:def.neutral?'#bdc7d5':goodness<=Math.ceil(valid.length/3)?'#7fc6ac':goodness>Math.ceil(valid.length*2/3)?'#e7919b':'#b8c6d7'};}
function format(value,digits=1){return Number.isFinite(value)?value.toFixed(digits):'—';}
g.FantasyMetrics={defs,rows,dataset,history,series,average,rank,format,div,pir,net,sfp};
})(globalThis);
