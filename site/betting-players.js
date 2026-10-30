/* Court Vision · Betting · Παίκτες
   Πίνακας παικτών, κάρτα παίκτη, rotation και «τι επιτρέπει ανά θέση» για την κάρτα ομάδας,
   απουσίες και πιθανοί ωφελημένοι για τα σημεία του προγράμματος.
   Πηγή: γραμμές box score ανά αγώνα από το betting-live-data.js (seed + νέοι αγώνες).
   Όλοι οι ρυθμοί είναι λόγοι αθροισμάτων του δείγματος, όχι μέσοι όροι ποσοστών.
   Μερίδιο συμμετοχής σε κάθε αγώνα = δευτερόλεπτα παίκτη / (δευτερόλεπτα ομάδας / 5): με αυτό εκτιμάται τι έγινε
   όσο ήταν στο παρκέ (κατοχές, ριμπάουντ προς διεκδίκηση, εύστοχα συμπαικτών). */
(function(g){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Θέσεις στη γραμμή παίκτη: [κωδικός, GS, Sec, M2, A2, M3, A3, M1, A1, OR, DR, As, St, Tv, Bl, FD, PF] */
const X={GS:1,Sec:2,M2:3,A2:4,M3:5,A3:6,M1:7,A1:8,OR:9,DR:10,As:11,St:12,Tv:13,Bl:14,FD:15,PF:16};
const POS={G:'Guard',F:'Forward',C:'Center'},POSGR={G:'γκαρντ',F:'φόργουορντ',C:'σέντερ'};
const LABEL={season:'Σεζόν',3:'Last 3',5:'Last 5',10:'Last 10'};
const ROTATION=10;/* λεπτά ανά αγώνα για να θεωρείται κάποιος μέρος του rotation */
const pts=r=>r[X.M1]+2*r[X.M2]+3*r[X.M3];
/* Αγορές για τον μετρητή γραμμής. */
const MARKETS=[['pts','Πόντοι',pts],['reb','Ριμπάουντ',r=>r[X.OR]+r[X.DR]],['or','Επιθετικά ριμπάουντ',r=>r[X.OR]],['dr','Αμυντικά ριμπάουντ',r=>r[X.DR]],['ast','Ασίστ',r=>r[X.As]],['m3','Τρίποντα',r=>r[X.M3]],['a3','Προσπάθειες τριπόντων',r=>r[X.A3]],['pra','Πόντοι + Ριμπ. + Ασίστ',r=>pts(r)+r[X.OR]+r[X.DR]+r[X.As]],['pr','Πόντοι + Ριμπάουντ',r=>pts(r)+r[X.OR]+r[X.DR]],['pa','Πόντοι + Ασίστ',r=>pts(r)+r[X.As]],['ra','Ριμπάουντ + Ασίστ',r=>r[X.OR]+r[X.DR]+r[X.As]],['sb','Κλεψίματα + Κοψίματα',r=>r[X.St]+r[X.Bl]],['tov','Λάθη',r=>r[X.Tv]],['fta','Προσπάθειες βολών',r=>r[X.A1]],['min','Λεπτά',r=>r[X.Sec]/60]];
const market=k=>MARKETS.find(m=>m[0]===k)||MARKETS[0];

/* ---------- ονόματα, ομάδες ---------- */
const SUF=/^(I|II|III|IV|V)$/i;
function cap(w){return String(w||'').toLowerCase().split(/([-'’ .])/).map(p=>/^[-'’ .]$/.test(p)||!p?p:SUF.test(p)?p.toUpperCase():p[0].toUpperCase()+p.slice(1)).join('').replace(/\bMc([a-z])/g,(m,c)=>'Mc'+c.toUpperCase()).replace(/\s+,/g,',');}
const FIX={Leday:'LeDay',Dibartolomeo:'DiBartolomeo',Dejulius:'DeJulius',Mcintyre:'McIntyre'};
const fix=s=>s.replace(/[A-Za-z]+/g,w=>FIX[w]||w);
function fullName(raw){const [last,first]=String(raw||'').split(/\s*,\s*/);return fix(first?cap(first)+' '+cap(last):cap(last));}
function shortName(raw){const [last,first]=String(raw||'').split(/\s*,\s*/);return fix(first?cap(first)[0]+'. '+cap(last):cap(last));}
const info=()=>g.BettingLive?.info||g.BETTING_PLAYER_INFO||{};
const cidOf=code=>g.BettingLive?.cid?.[code];
const codeOf=cid=>Object.entries(g.BettingLive?.cid||{}).find(([,v])=>v===cid)?.[0];
function teamName(code){const cid=cidOf(code);return (g.BETTING_TEAMS||[]).find(t=>t.CID===cid)?.Cl||code;}
function nameOf(id){return fullName(info()[id]?.name||id);}
function shortOf(id){return shortName(info()[id]?.name||id);}
function posOf(id){return info()[id]?.pos||'';}

/* ---------- δεδομένα ---------- */
let D=null,DK='';
function data(){const L=g.BettingLive;if(!L)return {list:[],team:{},player:{},allow:{}};const recs=L.records(),k=(L.state.games||0)+'|'+(L.state.updated||0)+'|'+Object.keys(recs).length+'|'+Object.keys(L.info||{}).length;
 if(D&&DK===k)return D;DK=k;D=build(recs);return D;}
function build(recs){
 const list=Object.values(recs).filter(r=>r.players&&r.sides).sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.code-b.code),team={},player={};
 const S=(rows,i)=>rows.reduce((n,x)=>n+(x[i]||0),0);
 const ctx=rows=>({sec:S(rows,X.Sec),fga:S(rows,X.A2)+S(rows,X.A3),fgm:S(rows,X.M2)+S(rows,X.M3),fta:S(rows,X.A1),tov:S(rows,X.Tv),or:S(rows,X.OR),dr:S(rows,X.DR),a2:S(rows,X.A2)});
 for(const r of list)for(const [me,op] of [[r.home,r.away],[r.away,r.home]]){
  const rows=r.players[me]||[],orows=r.players[op]||[];if(!rows.length)continue;
  const tm=ctx(rows),opp=ctx(orows);tm.po=r.sides[me]?.Po;opp.po=r.sides[op]?.Po;
  const home=me===r.home,score=home?r.score:[r.score[1],r.score[0]];
  const tg={code:r.code,round:r.round,date:r.date,team:me,opp:op,home,score,won:score[0]>score[1],tm,op:opp,rows,orows,ids:new Set(rows.map(x=>x[0]))};
  (team[me]=team[me]||[]).push(tg);
  for(const row of rows)(player[row[0]]=player[row[0]]||[]).push({g:tg,row});}
 return {list,team,player,allow:{}};}
function teamOf(id){const t=info()[id]?.team;if(t)return t;const e=data().player[id];return e&&e.length?e[e.length-1].g.team:'';}
function teamGames(code,period='season'){const all=data().team[code]||[];return period==='season'?all:all.slice(-Number(period));}
/* Δείγμα παίκτη: Σεζόν = όλοι οι αγώνες του· Last N = οι τελευταίοι N αγώνες της ομάδας του (μετρούν και οι απουσίες). */
function sample(id,period='season'){const all=data().player[id]||[],team=teamOf(id);
 if(period==='season')return {lines:all,n:Math.max(all.length,teamGames(team).length),games:teamGames(team)};
 const tg=teamGames(team,period),set=new Set(tg);return {lines:all.filter(e=>set.has(e.g)),n:tg.length,games:tg};}
function agg(lines){
 const o={gp:lines.length,gs:0,sec:0,M2:0,A2:0,M3:0,A3:0,M1:0,A1:0,OR:0,DR:0,As:0,St:0,Tv:0,Bl:0,FD:0,PF:0,use:0,fgmOn:0,orb:0,drb:0,po:0,dpo:0,oa2:0,secs:[]};
 for(const {g:t,row} of lines){const sh=t.tm.sec?row[X.Sec]/(t.tm.sec/5):0;o.gs+=row[X.GS];o.sec+=row[X.Sec];o.secs.push(row[X.Sec]);
  for(const [k,i] of Object.entries(X))if(i>2)o[k]+=row[i];
  o.use+=sh*(t.tm.fga+0.44*t.tm.fta+t.tm.tov);o.fgmOn+=sh*t.tm.fgm;o.orb+=sh*(t.tm.or+t.op.dr);o.drb+=sh*(t.tm.dr+t.op.or);o.po+=sh*(t.tm.po||0);o.dpo+=sh*(t.op.po||0);o.oa2+=sh*t.op.a2;}
 const fga=o.A2+o.A3,fgm=o.M2+o.M3,p=o.M1+2*o.M2+3*o.M3,r=(a,b,k=100)=>b>0?k*a/b:null;
 Object.assign(o,{pts:p,fga,fgm,reb:o.OR+o.DR,min:o.gp?o.sec/60/o.gp:null,
  usg:r(fga+0.44*o.A1+o.Tv,o.use),ts:r(p,2*(fga+0.44*o.A1)),efg:r(o.M2+1.5*o.M3,fga),astp:r(o.As,o.fgmOn-fgm),orp:r(o.OR,o.orb),drp:r(o.DR,o.drb),
  tovp:r(o.Tv,fga+0.44*o.A1+o.Tv),stlp:r(o.St,o.dpo),blkp:r(o.Bl,o.oa2),p3r:r(o.A3,fga),ftr:r(o.A1,fga),p2:r(o.M2,o.A2),p3:r(o.M3,o.A3),ft:r(o.M1,o.A1)});
 return o;}
/* Ανά 100 κατοχές: κατοχές όσο ήταν στο παρκέ = μέσος όρος επιθετικών και αμυντικών (όπως το Pace της ομάδας). */
const pg=(o,k)=>o.gp?o[k]/o.gp:null,p100=(o,k)=>{const n=(o.po+o.dpo)/2;return n>0?100*o[k]/n:null;};
function stats(id,period){const s=sample(id,period);return Object.assign(agg(s.lines),{n:s.n});}
/* Απλά στατιστικά λεπτών. */
function spread(secs){if(!secs.length)return null;const m=secs.map(s=>s/60).sort((a,b)=>a-b),avg=m.reduce((a,b)=>a+b,0)/m.length,mid=m.length%2?m[(m.length-1)/2]:(m[m.length/2-1]+m[m.length/2])/2;
 return {lo:m[0],hi:m[m.length-1],med:mid,avg,sd:Math.sqrt(m.reduce((a,b)=>a+(b-avg)**2,0)/m.length)};}

/* ---------- τι επιτρέπει κάθε άμυνα ανά θέση ---------- */
const ASTATS=[['pts','Πόντοι'],['reb','Ριμπάουντ'],['or','Επιθ. ριμπ.'],['as','Ασίστ'],['m3','Τρίποντα']];
/* own=false: τι αφήνει η άμυνα στους αντιπάλους ανά θέση (κατάταξη: #1 αφήνει τα λιγότερα).
   own=true: τι παράγουν οι δικοί της παίκτες ανά θέση (κατάταξη: #1 παράγει τα περισσότερα). */
function allowance(period='season',own=false){const d=data(),key=(own?'own:':'')+period;if(d.allow[key])return d.allow[key];const I=info(),out={},z=()=>({sec:0,pp:0,pts:0,reb:0,or:0,as:0,m3:0});
 for(const [code,games] of Object.entries(d.team)){const sel=period==='season'?games:games.slice(-Number(period)),t={G:z(),F:z(),C:z(),po:0,gm:sel.length};
  for(const tg of sel){const side=own?tg.tm:tg.op,poss=(side.po||0);t.po+=poss;for(const row of (own?tg.rows:tg.orows)){const q=t[I[row[0]]?.pos];if(!q)continue;q.sec+=row[X.Sec];q.pp+=side.sec?row[X.Sec]/(side.sec/5)*poss:0;q.pts+=pts(row);q.reb+=row[X.OR]+row[X.DR];q.or+=row[X.OR];q.as+=row[X.As];q.m3+=row[X.M3];}}
  out[code]=t;}
 const codes=Object.keys(out),lg={po:codes.reduce((n,c)=>n+out[c].po,0)};
 for(const p of ['G','F','C']){lg[p]={};for(const [k] of ASTATS)lg[p][k]=lg.po?100*codes.reduce((n,c)=>n+out[c][p][k],0)/lg.po:null;
  lg[p].share=null;
  for(const c of codes){const t=out[c],all=t.G.sec+t.F.sec+t.C.sec;t[p].per={};t[p].pp100={};t[p].rank={};t[p].share=all?100*t[p].sec/all:null;for(const [k] of ASTATS){t[p].per[k]=t.po?100*t[p][k]/t.po:null;t[p].pp100[k]=t[p].pp?100*t[p][k]/t[p].pp:null;}}
  {const sec=codes.reduce((n,c)=>n+out[c][p].sec,0),all=codes.reduce((n,c)=>n+out[c].G.sec+out[c].F.sec+out[c].C.sec,0);lg[p].share=all?100*sec/all:null;const pp=codes.reduce((n,c)=>n+out[c][p].pp,0);lg[p].pp100={};for(const [k] of ASTATS)lg[p].pp100[k]=pp?100*codes.reduce((n,c)=>n+out[c][p][k],0)/pp:null;}
  for(const [k] of ASTATS)codes.filter(c=>Number.isFinite(out[c][p].per[k])).sort((a,b)=>(out[a][p].per[k]-out[b][p].per[k])*(own?-1:1)).forEach((c,i)=>out[c][p].rank[k]=i+1);}
 const res={teams:out,league:lg,n:codes.length};d.allow[key]=res;return res;}
const production=period=>allowance(period,true);
/* Χρώμα κατάταξης άμυνας: #1 = αφήνει τα λιγότερα (πράσινο), 5 τελευταίες = αφήνει τα περισσότερα (κόκκινο). */
function aTone(r,n){return !r?'':r<=5?'good':r>=n-4?'bad':'';}

/* ---------- κοινά βοηθητικά UI ---------- */
const f1=v=>Number.isFinite(v)?v.toFixed(1):'—',f1p=v=>Number.isFinite(v)?v.toFixed(1)+'%':'—';
const sign=v=>Number.isFinite(v)?(v>0?'+':v<0?'−':'±')+Math.abs(v).toFixed(1):'—';
function nextGame(code){const S=g.BettingSchedule,list=g.BETTING_SCHEDULE||[];if(!S||!list.length)return null;const nx=S.nextRound(list);if(!nx)return null;const x=nx.games.find(x=>x.home===code||x.away===code);return x?{x,opp:x.home===code?x.away:x.home,home:x.home===code,round:nx.round}:null;}
function when(d){try{return new Date(d).toLocaleString('el-GR',{timeZone:'Europe/Athens',weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}catch{return d||'';}}
const dshort=d=>d?String(d).slice(5).split('-').reverse().join('/'):'';
/* Ράβδοι ανά αγώνα με προαιρετική γραμμή. */
function bars(items,line,opt={}){const w=opt.w||620,h=opt.h||130,l=26,r=8,top=10,bottom=22,vals=items.map(x=>x.v).filter(Number.isFinite);if(!items.length)return '';
 const max=Math.max(1,...vals,Number.isFinite(line)?line:0)*1.12,bw=(w-l-r)/items.length,y=v=>top+(h-top-bottom)*(1-v/max);
 const grid=[0,.5,1].map(q=>{const v=max*q/1.12;return `<line x1="${l}" x2="${w-r}" y1="${y(v)}" y2="${y(v)}" stroke="#2a3748" stroke-dasharray="3 5"/><text x="${l-5}" y="${y(v)+4}" text-anchor="end">${v.toFixed(0)}</text>`;}).join('');
 const b=items.map((x,i)=>{const cx=l+i*bw,lbl=`<text x="${cx+bw/2}" y="${h-6}" text-anchor="middle">${esc(x.label)}</text>`;
  if(!Number.isFinite(x.v))return `<text x="${cx+bw/2}" y="${y(0)-4}" text-anchor="middle" class="dnp">×</text>${lbl}`;
  const cls=x.cls||(Number.isFinite(line)?(x.v>line?'over':'under'):'');return `<rect class="${cls}" x="${cx+bw*.18}" y="${y(x.v)}" width="${bw*.64}" height="${Math.max(1,y(0)-y(x.v))}" rx="2"><title>${esc(x.title||x.label+' · '+x.v)}</title></rect>${lbl}`;}).join('');
 const ln=Number.isFinite(line)?`<line x1="${l}" x2="${w-r}" y1="${y(line)}" y2="${y(line)}" class="bar-line"/>`:'';
 return `<svg class="pl-bars" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(opt.label||'Τιμές ανά αγώνα')}">${grid}${b}${ln}</svg>`;}

/* ---------- πίνακας παικτών ---------- */
const T={period:'season',view:'role',team:'',pos:'',min:10,query:'',col:'min',dir:-1};
const VIEWS={role:'Ρόλος & αποδοτικότητα',p100:'Ανά 100 κατοχές',pg:'Ανά αγώνα'};
function cols(view){const P=(k,lab,sub,tip)=>[k,lab,sub,tip];
 if(view==='p100')return [P('min','MIN','/ ΑΓΩΝΑ','Λεπτά ανά αγώνα που έπαιξε.'),...[['pts','PTS'],['reb','REB'],['OR','OREB'],['DR','DREB'],['As','AST'],['M3','3PM'],['A3','3PA'],['A1','FTA'],['St','STL'],['Bl','BLK'],['Tv','TOV'],['FD','FD']].map(([k,l])=>P('100'+k,l,'/ 100 ΚΑΤΟΧΕΣ',l+' ανά 100 κατοχές όσο ήταν στο παρκέ.'))];
 if(view==='pg')return [P('gp','GP','ΑΓΩΝΕΣ','Αγώνες που έπαιξε / αγώνες της ομάδας στο δείγμα.'),P('min','MIN','/ ΑΓΩΝΑ','Λεπτά ανά αγώνα που έπαιξε.'),...[['pts','PTS'],['reb','REB'],['OR','OREB'],['DR','DREB'],['As','AST'],['M3','3PM'],['A3','3PA'],['A1','FTA'],['St','STL'],['Bl','BLK'],['Tv','TOV'],['PF','PF'],['FD','FD']].map(([k,l])=>P('g'+k,l,'/ ΑΓΩΝΑ',l+' ανά αγώνα που έπαιξε.'))];
 return [P('gp','GP','ΑΓΩΝΕΣ','Αγώνες που έπαιξε / αγώνες της ομάδας στο δείγμα.'),P('gs','GS','ΒΑΣΙΚΟΣ','Αγώνες ως βασικός.'),P('min','MIN','/ ΑΓΩΝΑ','Λεπτά ανά αγώνα που έπαιξε.'),P('trend','L3 vs ΣΕΖΟΝ','ΔMIN · ΔUSG','Διαφορά λεπτών και usage στους 3 τελευταίους αγώνες της ομάδας από τη σεζόν. Χρώμα από ±4.'),P('usg','USG%','ΡΟΛΟΣ','Μερίδιο των κατοχών της ομάδας που τελειώνουν σε σουτ, βολές ή λάθος του παίκτη όσο είναι στο παρκέ.'),P('ts','TS%','ΑΠΟΔΟΣΗ','Πόντοι / (2 × (FGA + 0,44 × FTA)).'),P('astp','AST%','ΔΗΜΙΟΥΡΓΙΑ','Ποσοστό των καλαθιών των συμπαικτών όσο είναι στο παρκέ που έγιναν με δική του ασίστ.'),P('tovp','TOV%','ΛΑΘΗ','Λάθη / (FGA + 0,44 × FTA + λάθη).'),P('orp','OREB%','ΡΙΜΠΑΟΥΝΤ','Επιθετικά ριμπάουντ / διαθέσιμα επιθετικά ριμπάουντ όσο είναι στο παρκέ.'),P('drp','DREB%','ΡΙΜΠΑΟΥΝΤ','Αμυντικά ριμπάουντ / διαθέσιμα αμυντικά ριμπάουντ όσο είναι στο παρκέ.'),P('p3r','3PA/FGA','ΣΟΥΤ','Μερίδιο τριπόντων στις προσπάθειές του.'),P('ftr','FTA/FGA','ΒΟΛΕΣ','Προσπάθειες βολών ανά προσπάθεια εντός παιδιάς.')];}
const PCTK=new Set(['usg','ts','astp','tovp','orp','drp','p3r','ftr','efg','stlp','blkp']);
function val(o,k){if(k==='gp')return o.gp;if(k==='gs')return o.gs;if(k==='min')return o.min;if(k==='trend')return o.trend?.min??null;if(k.startsWith('100'))return p100(o,k.slice(3));if(k.startsWith('g')&&k.length>1&&k!=='gs'&&k!=='gp')return pg(o,k.slice(1));return o[k]??null;}
function cell(o,k){const v=val(o,k);if(k==='gp')return o.n&&T.period!=='season'?`${o.gp}/${o.n}`:String(o.gp);if(k==='gs')return String(o.gs);
 if(k==='trend'){const t=o.trend;if(t&&t.none)return `<small class="miss">δεν έπαιξε στους ${t.n} τελευταίους</small>`;if(!t||!Number.isFinite(t.min))return '<span class="muted">—</span>';const c=x=>Math.abs(x)>=4?(x>0?'up':'down'):'';return `<span class="trend ${c(t.min)}">${sign(t.min)}′</span><small class="trend ${Number.isFinite(t.usg)?c(t.usg):''}">USG ${sign(t.usg)}</small>${t.gp<t.n?`<small class="miss">έπαιξε ${t.gp}/${t.n}</small>`:''}`;}
 return PCTK.has(k)?f1p(v):f1(v);}
function rows(){const I=info(),d=data(),q=T.query.toLocaleLowerCase('el'),ids=new Set([...Object.keys(d.player),...Object.values(g.BettingLive?.rosters||{}).flat()]);
 const out=[];for(const id of ids){const p=I[id]||{},team=teamOf(id);if(T.team&&team!==T.team)continue;if(T.pos&&p.pos!==T.pos)continue;
  const nm=fullName(p.name||id);if(q&&!nm.toLocaleLowerCase('el').includes(q)&&!String(p.name||'').toLocaleLowerCase('el').includes(q))continue;
  const o=stats(id,T.period);if(!o.gp||(o.min??0)<T.min)continue;
  const s=T.period==='season'?o:stats(id,'season'),l3=stats(id,'3');o.trend=l3.gp&&s.gp?{min:l3.min-s.min,usg:Number.isFinite(l3.usg)&&Number.isFinite(s.usg)?l3.usg-s.usg:null,gp:l3.gp,n:l3.n}:s.gp?{min:null,none:true,n:l3.n}:null;
  out.push({id,name:nm,team,pos:p.pos||'',o,active:(g.BettingLive?.rosters?.[team]||[]).includes(id)});}
 return out.sort((a,b)=>{const x=val(a.o,T.col),y=val(b.o,T.col);return x===null?(y===null?0:1):y===null?-1:(x-y)*T.dir||a.name.localeCompare(b.name);});}
let host=null;
function table(target){host=target;drawTable();}
function drawTable(){if(!host)return;const list=rows(),defs=cols(T.view),teams=Object.keys(data().team).sort((a,b)=>teamName(a).localeCompare(teamName(b)));
 const periods=['season','3','5','10'].map(k=>`<button data-pl-period="${k}" aria-pressed="${T.period===k}">${LABEL[k]}</button>`).join('');
 host.innerHTML=`<div class="stats-toolbar pl-toolbar"><div class="side-switch" role="group" aria-label="Προβολή">${Object.entries(VIEWS).map(([k,t])=>`<button data-pl-view="${k}" aria-pressed="${T.view===k}">${t}</button>`).join('')}</div><div class="period-switch" role="group" aria-label="Χρονικό δείγμα">${periods}</div></div>
 <div class="stats-toolbar pl-filters"><label>Ομάδα<select id="pl-team"><option value="">Όλες</option>${teams.map(c=>`<option value="${esc(c)}" ${T.team===c?'selected':''}>${esc(teamName(c))}</option>`).join('')}</select></label><label>Θέση<select id="pl-pos"><option value="">Όλες</option>${['G','F','C'].map(p=>`<option value="${p}" ${T.pos===p?'selected':''}>${POS[p]}</option>`).join('')}</select></label><label>Λεπτά / αγώνα<select id="pl-min">${[0,5,10,15,20,25].map(m=>`<option value="${m}" ${T.min===m?'selected':''}>${m?'≥ '+m:'Όλοι'}</option>`).join('')}</select></label><label class="team-search"><span class="sr-only">Αναζήτηση παίκτη</span><input id="pl-search" type="search" placeholder="Αναζήτηση παίκτη…" value="${esc(T.query)}"></label></div>
 <div class="stats-caption"><span>${T.period==='season'?'Σεζόν · όλοι οι αγώνες του παίκτη':LABEL[T.period]+' · οι τελευταίοι '+T.period+' αγώνες της ομάδας του (μετρούν και οι απουσίες)'}</span><span>Πάτα όνομα για την κάρτα παίκτη · ${list.length} παίκτες</span></div>
 <div class="stats-scroll" tabindex="0" aria-label="Πίνακας παικτών με οριζόντια κύλιση"><table class="teams-table players-table"><caption class="sr-only">Στατιστικά παικτών</caption><thead><tr><th scope="col" class="club-head">Παίκτης</th>${defs.map(d=>`<th scope="col" aria-sort="${d[0]===T.col?(T.dir===1?'ascending':'descending'):'none'}"><button data-pl-sort="${d[0]}" title="${esc(d[3])}">${esc(d[1])}<span class="sort-arrow">${d[0]===T.col?(T.dir===1?'↑':'↓'):'↕'}</span><small>${esc(d[2])}</small></button></th>`).join('')}</tr></thead>
 <tbody>${list.map(r=>`<tr><th scope="row"><button class="team-open" data-player="${esc(r.id)}">${esc(r.name)}</button><small class="pl-sub">${esc(r.team)} · ${esc(r.pos||'—')}${r.active?'':' · εκτός ρόστερ'}</small></th>${defs.map(d=>`<td class="${d[0]===T.col?'sorted-column':''}">${cell(r.o,d[0])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
 ${list.length?'':'<p class="empty">Κανένας παίκτης με αυτά τα φίλτρα.</p>'}
 <details class="stats-method"><summary>Δείγμα & υπολογισμοί παικτών</summary>${methodText()}</details>`;
 host.querySelectorAll('[data-pl-view]').forEach(b=>b.onclick=()=>{T.view=b.dataset.plView;if(!cols(T.view).some(c=>c[0]===T.col))T.col='min';drawTable();});
 host.querySelectorAll('[data-pl-period]').forEach(b=>b.onclick=()=>{T.period=b.dataset.plPeriod;drawTable();host.querySelector('[data-pl-period="'+T.period+'"]')?.focus();});
 host.querySelectorAll('[data-pl-sort]').forEach(b=>b.onclick=()=>{const c=b.dataset.plSort;T.dir=T.col===c?-T.dir:-1;T.col=c;drawTable();host.querySelector('[data-pl-sort="'+c+'"]')?.focus();});
 host.querySelector('#pl-team').onchange=e=>{T.team=e.target.value;drawTable();};host.querySelector('#pl-pos').onchange=e=>{T.pos=e.target.value;drawTable();};host.querySelector('#pl-min').onchange=e=>{T.min=Number(e.target.value);drawTable();};
 const s=host.querySelector('#pl-search');s.oninput=()=>{const c=s.selectionStart;T.query=s.value;drawTable();const n=host.querySelector('#pl-search');n.focus();try{n.setSelectionRange(c,c)}catch{}};
 bindOpen(host);}
function methodText(){return `<p>Πηγή: οι γραμμές box score κάθε παίκτη από τα επίσημα δεδομένα της EuroLeague (ίδιοι αγώνες με τα στατιστικά ομάδων). Οι ρυθμοί υπολογίζονται από αθροίσματα του δείγματος. Μερίδιο συμμετοχής σε κάθε αγώνα = λεπτά παίκτη / (λεπτά ομάδας / 5)· με αυτό εκτιμώνται οι κατοχές, τα διαθέσιμα ριμπάουντ και τα καλάθια των συμπαικτών όσο ήταν στο παρκέ (χωρίς δεδομένα πεντάδων, όπως στο Basketball-Reference).</p><p>USG% = (FGA + 0,44 × FTA + TOV) / (μερίδιο × (FGA + 0,44 × FTA + TOV ομάδας)). AST% = AST / (μερίδιο × εύστοχα ομάδας − δικά του εύστοχα). OREB% / DREB% = ριμπάουντ / (μερίδιο × διαθέσιμα ριμπάουντ). TS% = PTS / (2 × (FGA + 0,44 × FTA)). Ανά 100 κατοχές = σύνολο / κατοχές όσο ήταν στο παρκέ × 100, με κατοχές στο παρκέ = μερίδιο × (κατοχές ομάδας + αντιπάλου) / 2, όπως το Pace των ομάδων. Έτσι ο ρυθμός του παίκτη δεν επηρεάζεται ούτε από τα λεπτά του ούτε από το πόσο γρήγορα παίζει η ομάδα του. Τα ριμπάουντ ομάδας (team rebounds) δεν μετρούν στα διαθέσιμα.</p><p>Σεζόν = όλοι οι αγώνες του παίκτη. Last N = οι τελευταίοι N αγώνες της ομάδας του· στη στήλη GP φαίνεται σε πόσους έπαιξε. Θέση: από το επίσημο ρόστερ (Guard / Forward / Center).</p>`;}
function bindOpen(root){root.querySelectorAll('[data-player]').forEach(b=>b.onclick=e=>{e.stopPropagation();open(b.dataset.player);});}

/* ---------- κάρτα παίκτη ---------- */
const C={id:null,market:'pts',line:null,mate:'',role:'all'};let dialog=null,returnFocus=null;
function close(){if(dialog){const d=dialog;dialog=null;try{d.close();}catch{}d.remove();}returnFocus?.focus?.();}
function open(id,opt={}){if(g.TeamHistory)TeamHistory.close();close();returnFocus=opt.focus||document.activeElement;Object.assign(C,{id,market:'pts',line:null,mate:'',role:'all'});
 dialog=document.createElement('dialog');dialog.className='team-dialog player-dialog';dialog.setAttribute('aria-label','Κάρτα παίκτη '+nameOf(id));document.body.append(dialog);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
 drawCard();dialog.showModal();dialog.querySelector('[data-close]')?.focus();}
function compare(id){const ks=['season','5','3'],S=ks.map(k=>stats(id,k));
 const rowsDef=[['Αγώνες',o=>o.n&&o!==S[0]?`${o.gp}/${o.n}`:String(o.gp),null],['Βασικός',o=>`${o.gs}/${o.gp}`,null],['Λεπτά / αγώνα',o=>f1(o.min),o=>o.min],['USG%',o=>f1p(o.usg),o=>o.usg],['TS%',o=>f1p(o.ts),o=>o.ts],['Πόντοι / 100 κατοχές',o=>f1(p100(o,'pts')),o=>p100(o,'pts')],['Ριμπάουντ / 100 κατοχές',o=>f1(p100(o,'reb')),o=>p100(o,'reb')],['OREB% · DREB%',o=>f1p(o.orp)+' · '+f1p(o.drp),o=>o.orp],['Ασίστ / 100 · AST%',o=>f1(p100(o,'As'))+' · '+f1p(o.astp),o=>p100(o,'As')],['3PA / 100 · 3P%',o=>f1(p100(o,'A3'))+' · '+f1p(o.p3),o=>p100(o,'A3')],['FTA / 100',o=>f1(p100(o,'A1')),o=>p100(o,'A1')],['TOV%',o=>f1p(o.tovp),null],['Πόντοι · Ριμπ. · Ασίστ / αγώνα',o=>[pg(o,'pts'),pg(o,'reb'),pg(o,'As')].map(f1).join(' · '),o=>pg(o,'pts')]];
 const th=v=>Math.max(Math.abs(v)*0.15,0.8);
 return `<div class="stats-scroll pl-compare"><table class="teams-table"><thead><tr><th>Δείκτης</th><th>Σεζόν</th><th>Last 5</th><th>Last 3</th></tr></thead><tbody>${rowsDef.map(([l,f,v])=>`<tr><th>${esc(l)}</th>${S.map((o,i)=>{let cls='';if(v&&i>0&&o.gp&&S[0].gp){const a=v(o),b=v(S[0]);if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)>=th(b))cls=a>b?'up':'down';}return `<td class="${cls?'trend '+cls:''}">${o.gp?esc(f(o)):'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="history-caption">Last 5 / Last 3: οι τελευταίοι αγώνες της ομάδας του. Πράσινο / κόκκινο: διαφορά από τη σεζόν πάνω από 15% (ή 0,8).</p>`;}
function minutesBlock(id){const team=teamOf(id),tg=teamGames(team),mine=new Map((data().player[id]||[]).map(e=>[e.g,e.row]));
 const items=tg.map(t=>{const r=mine.get(t);return {label:'R'+t.round,v:r?r[X.Sec]/60:NaN,cls:r?(r[X.GS]?'start':'bench'):'',title:`R${t.round} ${t.home?'vs':'@'} ${t.opp} · ${r?(r[X.Sec]/60).toFixed(1)+'′ · '+(r[X.GS]?'βασικός':'πάγκος'):'δεν αγωνίστηκε'}`};});
 const all=agg([...mine.entries()].map(([g0,row])=>({g:g0,row}))),sp=spread(all.secs),miss=tg.filter(t=>!mine.has(t)),l3=agg((data().player[id]||[]).filter(e=>tg.slice(-3).includes(e.g)));
 const stab=sp?(sp.sd<=3?'σταθερά':sp.sd<=6?'μέτρια διακύμανση':'μεγάλη διακύμανση'):'';
 return `<section class="pl-block"><h3>Λεπτά & ρόλος</h3><div class="pl-kpis"><div><span>Εύρος</span><b>${sp?sp.lo.toFixed(0)+'–'+sp.hi.toFixed(0)+'′':'—'}</b><small>διάμεσος ${sp?sp.med.toFixed(1):'—'}′</small></div><div><span>Σταθερότητα</span><b>${sp?'±'+sp.sd.toFixed(1)+'′':'—'}</b><small>${esc(stab)}</small></div><div><span>Βασικός</span><b>${all.gs}/${all.gp}</b><small>${all.gp?Math.round(100*all.gs/all.gp)+'%':''}</small></div><div><span>Last 3</span><b>${f1(l3.min)}′</b><small>σεζόν ${f1(all.min)}′ · έπαιξε ${l3.gp}/${Math.min(3,tg.length)}</small></div></div>
 ${bars(items,all.min,{label:'Λεπτά ανά αγώνα',h:120})}<div class="chart-legend"><span class="lg-start">■ Βασικός</span><span class="lg-bench">■ Από πάγκο</span><span>× Δεν αγωνίστηκε</span><span class="lg-line">— Μέσος όρος σεζόν</span></div>
 ${miss.length?`<p class="history-caption">Δεν αγωνίστηκε: ${miss.map(t=>`R${t.round} ${t.home?'vs':'@'} ${esc(t.opp)}`).join(', ')}.</p>`:''}</section>`;}
function teammates(id){const team=teamOf(id),tg=teamGames(team),mine=(data().player[id]||[]).filter(e=>e.g.team===team);
 return (g.BettingLive?.rosters?.[team]||[]).filter(x=>x!==id).map(x=>{const o=stats(x,'season');const missed=mine.filter(e=>!e.g.ids.has(x)).length;return {id:x,min:o.min||0,gp:o.gp,missed};}).filter(x=>x.gp&&x.min>=ROTATION).sort((a,b)=>b.min-a.min);}
function filtered(id){const team=teamOf(id);let L=(data().player[id]||[]);
 if(C.role==='start')L=L.filter(e=>e.row[X.GS]);else if(C.role==='bench')L=L.filter(e=>!e.row[X.GS]);
 if(C.mate){const [mode,mid]=C.mate.split(':');L=L.filter(e=>e.g.team===team&&(mode==='with'?e.g.ids.has(mid):!e.g.ids.has(mid)));}
 return L;}
function lineBlock(id){const m=market(C.market),all=data().player[id]||[];const vals=all.map(e=>m[2](e.row)).sort((a,b)=>a-b);
 if(C.line===null&&vals.length){const med=vals.length%2?vals[(vals.length-1)/2]:(vals[vals.length/2-1]+vals[vals.length/2])/2;C.line=Math.floor(med)+0.5;}
 const L=filtered(id),line=C.line,cnt=list=>{const v=list.map(e=>m[2](e.row));const o=v.filter(x=>x>line).length;return {o,n:v.length};};
 const wins=[['Σεζόν',L],['Last 10',L.slice(-10)],['Last 5',L.slice(-5)],['Last 3',L.slice(-3)]].map(([t,l])=>{const c=cnt(l);return `<div><span>${t}</span><b>${c.n?c.o+'/'+c.n:'—'}</b><small>${c.n?Math.round(100*c.o/c.n)+'% πάνω από '+line:'κανένας αγώνας'}</small></div>`;}).join('');
 const v=L.map(e=>m[2](e.row)),avg=v.length?v.reduce((a,b)=>a+b,0)/v.length:null,med=v.length?[...v].sort((a,b)=>a-b)[Math.floor((v.length-1)/2)]:null;
 const items=L.slice(-12).map(e=>({label:'R'+e.g.round,v:m[2](e.row),title:`R${e.g.round} ${e.g.home?'vs':'@'} ${e.g.opp} · ${+m[2](e.row).toFixed(1)} · ${(e.row[X.Sec]/60).toFixed(0)}′${e.row[X.GS]?' · βασικός':''}`}));
 const mates=teammates(id);
 return `<section class="pl-block"><h3>Μετρητής γραμμής</h3><div class="pl-line-controls"><label>Αγορά<select id="pl-market">${MARKETS.map(([k,t])=>`<option value="${k}" ${k===C.market?'selected':''}>${esc(t)}</option>`).join('')}</select></label><label>Γραμμή (Over)<input id="pl-line" type="number" step="0.5" min="0" value="${line??''}"></label><label>Ρόλος<select id="pl-role"><option value="all" ${C.role==='all'?'selected':''}>Όλοι οι αγώνες</option><option value="start" ${C.role==='start'?'selected':''}>Ως βασικός</option><option value="bench" ${C.role==='bench'?'selected':''}>Από πάγκο</option></select></label><label>Συμπαίκτης<select id="pl-mate"><option value="">Όλοι οι αγώνες</option>${mates.map(x=>`<option value="with:${esc(x.id)}" ${C.mate==='with:'+x.id?'selected':''}>Με ${esc(shortOf(x.id))}</option><option value="without:${esc(x.id)}" ${C.mate==='without:'+x.id?'selected':''}>Χωρίς ${esc(shortOf(x.id))}${x.missed?'':' (0 αγώνες)'}</option>`).join('')}</select></label></div>
 <div class="pl-kpis">${wins}</div>${items.length?bars(items,line,{label:m[1]+' ανά αγώνα',h:120}):''}<p class="history-caption">${esc(m[1])}: μέσος όρος ${f1(avg)} · διάμεσος ${f1(med)} σε ${v.length} αγώνες που έπαιξε${C.role!=='all'||C.mate?' (με τα φίλτρα)':''}. Μετρούν μόνο οι αγώνες που αγωνίστηκε. Πράσινο = πάνω από τη γραμμή.</p></section>`;}
function withoutBlock(id){const mates=teammates(id).filter(x=>x.missed>0),team=teamOf(id);if(!mates.length)return `<section class="pl-block"><h3>Με / χωρίς συμπαίκτη</h3><p class="muted">Δεν υπάρχει αγώνας του όπου έλειψε συμπαίκτης του rotation (≥ ${ROTATION}′ / αγώνα).</p></section>`;
 const mine=(data().player[id]||[]).filter(e=>e.g.team===team);
 const row=x=>{const w=agg(mine.filter(e=>e.g.ids.has(x.id))),wo=agg(mine.filter(e=>!e.g.ids.has(x.id)));const c=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)>=Math.max(Math.abs(b)*0.15,1)?(a>b?'up':'down'):'';
  const cells=[[o=>o.min,f1],[o=>o.usg,f1p],[o=>p100(o,'pts'),f1],[o=>p100(o,'reb'),f1],[o=>p100(o,'As'),f1],[o=>pg(o,'pts'),f1]];
  return `<tr><th><button class="link" data-player="${esc(x.id)}">${esc(shortOf(x.id))}</button><small class="pl-sub">${esc(posOf(x.id)||'—')} · ${f1(x.min)}′</small></th><td>${w.gp} / ${wo.gp}</td>${cells.map(([v,f])=>`<td>${f(v(w))} <span class="arrow">→</span> <b class="trend ${wo.gp?c(v(wo),v(w)):''}">${wo.gp?f(v(wo)):'—'}</b></td>`).join('')}</tr>`;};
 return `<section class="pl-block"><h3>Με / χωρίς συμπαίκτη</h3><div class="stats-scroll"><table class="teams-table pl-with"><thead><tr><th>Συμπαίκτης</th><th>Αγώνες<small>ΜΕ / ΧΩΡΙΣ</small></th><th>MIN</th><th>USG%</th><th>PTS<small>/ 100 ΚΑΤΟΧΕΣ</small></th><th>REB<small>/ 100 ΚΑΤΟΧΕΣ</small></th><th>AST<small>/ 100 ΚΑΤΟΧΕΣ</small></th><th>PTS / αγώνα</th></tr></thead><tbody>${mates.map(row).join('')}</tbody></table></div><p class="history-caption">Τιμή όταν έπαιξε ο συμπαίκτης → τιμή όταν έλειψε. Μόνο αγώνες με την τωρινή ομάδα. Λίγοι αγώνες «χωρίς» σημαίνουν μικρό δείγμα.</p></section>`;}
function opponentBlock(id){const team=teamOf(id),nx=nextGame(team),pos=posOf(id);if(!nx)return '';const opp=nx.opp,name=teamName(opp);
 if(!pos)return `<section class="pl-block"><h3>Επόμενος αντίπαλος · ${esc(name)}</h3><p class="muted">Η θέση του παίκτη δεν είναι γνωστή.</p></section>`;
 const A=allowance('season'),A5=allowance('5'),t=A.teams[opp],t5=A5.teams[opp];if(!t)return '';
 return `<section class="pl-block"><h3>Επόμενος αντίπαλος · ${nx.home?'vs':'@'} ${esc(name)} <span class="muted">${esc(when(nx.x.date))}</span></h3><p class="muted">Τι αφήνει η ${esc(name)} στους ${POSGR[pos]} των αντιπάλων, ανά 100 αμυντικές κατοχές. #1 = αφήνει τα λιγότερα.</p><div class="stats-scroll"><table class="teams-table"><thead><tr><th>Στατιστικό (${POS[pos]})</th><th>Σεζόν<small>/ 100 ΚΑΤΟΧΕΣ</small></th><th>Κατάταξη</th><th>Last 5<small>/ 100 ΚΑΤΟΧΕΣ</small></th><th>Κατάταξη L5</th><th>League avg<small>/ 100 ΚΑΤΟΧΕΣ</small></th><th>Ανά 100 κατοχές θέσης<small>${esc(name.toUpperCase())} · AVG</small></th></tr></thead><tbody>${ASTATS.map(([k,l])=>`<tr><th>${esc(l)}</th><td>${f1(t[pos].per[k])}</td><td><span class="rk ${aTone(t[pos].rank[k],A.n)}">#${t[pos].rank[k]||'—'}</span></td><td>${t5?f1(t5[pos].per[k]):'—'}</td><td>${t5?`<span class="rk ${aTone(t5[pos].rank[k],A5.n)}">#${t5[pos].rank[k]||'—'}</span>`:'—'}</td><td>${f1(A.league[pos][k])}</td><td>${f1(t[pos].pp100[k])} <small class="muted">· ${f1(A.league[pos].pp100[k])}</small></td></tr>`).join('')}</tbody></table></div><p class="history-caption">Κόκκινο = στις 5 άμυνες που αφήνουν τα περισσότερα σε αυτή τη θέση (ανά 100 κατοχές). Οι ${POSGR[pos]} των αντιπάλων της έπαιξαν το ${f1(t[pos].share)}% των λεπτών (μέσος όρος ${f1(A.league[pos].share)}%)· γι' αυτό φαίνεται και η τιμή ανά 100 κατοχές που έπαιξαν οι ${POSGR[pos]} απέναντί της (ανεξάρτητη από το πόσο έπαιξαν).</p></section>`;}
function logBlock(id){const team=teamOf(id),mine=new Map((data().player[id]||[]).map(e=>[e.g,e.row])),games=[...(data().player[id]||[]).map(e=>e.g).filter(t=>t.team!==team),...teamGames(team)].sort((a,b)=>String(a.date).localeCompare(String(b.date))).reverse();
 const r2=(a,b)=>a+'-'+b;
 return `<section class="pl-block profile-log"><h3>Game log <span class="muted">${mine.size} αγώνες</span></h3><div class="stats-scroll"><table class="teams-table pl-log"><thead><tr><th>Αγώνας</th><th>Αντίπαλος</th><th>Σκορ</th><th>GS</th><th>MIN</th><th>PTS</th><th>REB</th><th>OR-DR</th><th>AST</th><th>3PM-A</th><th>2PM-A</th><th>FTM-A</th><th>STL</th><th>BLK</th><th>TOV</th><th>PF</th><th>FD</th></tr></thead><tbody>${games.map(t=>{const r=mine.get(t),head=`<th>R${t.round} <small class="pl-sub">${esc(dshort(t.date))}</small></th><td>${t.home?'vs':'@'} ${esc(t.opp)}</td><td class="${t.won?'win':'loss'}">${t.won?'Ν':'Η'} ${t.score.join('-')}</td>`;
  if(!r)return `<tr class="dnp-row">${head}<td colspan="14">Δεν αγωνίστηκε</td></tr>`;
  return `<tr>${head}<td>${r[X.GS]?'●':''}</td><td>${(r[X.Sec]/60).toFixed(0)}</td><td><b>${pts(r)}</b></td><td>${r[X.OR]+r[X.DR]}</td><td>${r2(r[X.OR],r[X.DR])}</td><td>${r[X.As]}</td><td>${r2(r[X.M3],r[X.A3])}</td><td>${r2(r[X.M2],r[X.A2])}</td><td>${r2(r[X.M1],r[X.A1])}</td><td>${r[X.St]}</td><td>${r[X.Bl]}</td><td>${r[X.Tv]}</td><td>${r[X.PF]}</td><td>${r[X.FD]}</td></tr>`;}).join('')}</tbody></table></div></section>`;}
function drawCard(){if(!dialog)return;const id=C.id,p=info()[id]||{},team=teamOf(id),nx=nextGame(team),active=(g.BettingLive?.rosters?.[team]||[]).includes(id),scroll=dialog.scrollTop;
 dialog.innerHTML=`<div class="team-dialog-head"><div><div class="eyebrow">BETTING / PLAYER PROFILE</div><h2>${esc(fullName(p.name||id))}</h2><p><button class="link" data-team-card="${esc(team)}">${esc(teamName(team))}</button> · ${p.pos?POS[p.pos]:'Θέση άγνωστη'}${p.dorsal?' · #'+esc(p.dorsal):''}${p.height?' · '+p.height+' cm':''}${active?'':' · <span class="miss">εκτός ενεργού ρόστερ</span>'}</p>${nx?`<p class="pl-next">Επόμενος αγώνας: <b>${nx.home?'vs':'@'} ${esc(teamName(nx.opp))}</b> · ${esc(when(nx.x.date))}</p>`:''}</div><button class="btn" data-close aria-label="Κλείσιμο καρτέλας">✕</button></div>
 <section class="pl-block"><h3>Σεζόν · Last 5 · Last 3</h3>${compare(id)}</section>${minutesBlock(id)}${lineBlock(id)}${withoutBlock(id)}${opponentBlock(id)}${logBlock(id)}`;
 dialog.scrollTop=scroll;
 dialog.querySelector('[data-close]').onclick=close;
 const tc=dialog.querySelector('[data-team-card]');if(tc)tc.onclick=()=>{const cid=cidOf(tc.dataset.teamCard),t=(g.BETTING_TEAMS||[]).find(x=>x.CID===cid);if(t&&g.TeamHistory){const f=returnFocus;close();returnFocus=null;TeamHistory.open(t,'offense',1,'season');}};
 const on=(sel,fn)=>{const el=dialog.querySelector(sel);if(el)el.onchange=el.oninput=fn;};
 on('#pl-market',e=>{C.market=e.target.value;C.line=null;drawCard();dialog.querySelector('#pl-market')?.focus();});
 const li=dialog.querySelector('#pl-line');if(li){li.onchange=()=>{const v=Number(li.value);C.line=Number.isFinite(v)?v:C.line;drawCard();dialog.querySelector('#pl-line')?.focus();};li.oninput=null;}
 on('#pl-role',e=>{C.role=e.target.value;drawCard();dialog.querySelector('#pl-role')?.focus();});
 on('#pl-mate',e=>{C.mate=e.target.value;drawCard();dialog.querySelector('#pl-mate')?.focus();});
 dialog.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>{Object.assign(C,{id:b.dataset.player,market:'pts',line:null,mate:'',role:'all'});dialog.scrollTop=0;drawCard();dialog.setAttribute('aria-label','Κάρτα παίκτη '+nameOf(C.id));dialog.querySelector('[data-close]')?.focus();});}

/* ---------- για την κάρτα ομάδας ---------- */
function rotation(code){const roster=g.BettingLive?.rosters?.[code]||[],tg=teamGames(code),last=tg[tg.length-1];
 const ids=new Set([...roster,...tg.flatMap(t=>[...t.ids])]);
 return [...ids].map(id=>{const s=agg((data().player[id]||[]).filter(e=>e.g.team===code)),l3=agg((data().player[id]||[]).filter(e=>tg.slice(-3).includes(e.g))),lr=last?last.rows.find(r=>r[0]===id):null;
  return {id,s,l3,last:lr,active:roster.includes(id)};}).filter(x=>x.s.gp).sort((a,b)=>(b.s.min||0)-(a.s.min||0));}
function absences(code){const tg=teamGames(code),last=tg[tg.length-1];if(!last)return [];
 return rotation(code).filter(x=>x.active&&x.s.gp>=2&&(x.s.min||0)>=ROTATION&&!last.ids.has(x.id)).map(x=>({...x,missed3:tg.slice(-3).filter(t=>!t.ids.has(x.id)).length}));}
function roleShifts(code){return rotation(code).filter(x=>x.active&&x.l3.gp>=2&&x.s.gp>=4&&Math.abs((x.l3.min||0)-(x.s.min||0))>=5).map(x=>({...x,d:x.l3.min-x.s.min})).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));}
function teamSections(team,period='season'){const code=codeOf(team.CID);if(!code||!data().team[code])return '';const tg=teamGames(code),last=tg[tg.length-1],R=rotation(code),ab=absences(code),A=allowance(period),t=A.teams[code];
 const chip=(x,extra)=>`<button type="button" class="glance-chip" data-player="${esc(x.id)}">${esc(shortOf(x.id))} <small>${esc(extra)}</small></button>`;
 const rot=`<section class="pl-block team-rotation"><h3>Rotation <span class="muted">σεζόν vs τελευταίοι 3 αγώνες</span></h3>
 <div class="glance-row"><span class="glance-k">Εκτός τελευταίου</span><span class="glance-chips">${ab.length?ab.map(x=>chip(x,f1(x.s.min)+'′ σεζόν'+(x.missed3>1?' · έλειψε '+x.missed3+'/3':''))).join(''):'<span class="muted">Κανένας παίκτης του rotation</span>'}</span></div>
 ${(()=>{const sh=roleShifts(code);return sh.length?`<div class="glance-row"><span class="glance-k">Αλλαγή ρόλου</span><span class="glance-chips">${sh.map(x=>chip(x,sign(x.d)+'′ L3')).join('')}</span></div>`:'';})()}
 <div class="stats-scroll"><table class="teams-table pl-rotation"><thead><tr><th>Παίκτης</th><th>GP</th><th>GS</th><th>MIN<small>ΣΕΖΟΝ</small></th><th>MIN<small>L3</small></th><th>USG%<small>ΣΕΖΟΝ</small></th><th>USG%<small>L3</small></th><th>PTS<small>/ ΑΓΩΝΑ</small></th><th>REB<small>/ ΑΓΩΝΑ</small></th><th>AST<small>/ ΑΓΩΝΑ</small></th><th>Τελευταίος<small>${last?'R'+last.round+' '+(last.home?'vs':'@')+' '+esc(last.opp):''}</small></th></tr></thead><tbody>${R.map(x=>{const d=x.l3.gp?x.l3.min-x.s.min:null,c=Number.isFinite(d)&&Math.abs(d)>=4?(d>0?'up':'down'):'';
  return `<tr class="${x.active?'':'inactive'}"><th><button class="team-open" data-player="${esc(x.id)}">${esc(shortOf(x.id))}</button><small class="pl-sub">${esc(posOf(x.id)||'—')}${x.active?'':' · εκτός ρόστερ'}</small></th><td>${x.s.gp}</td><td>${x.s.gs}</td><td>${f1(x.s.min)}</td><td class="trend ${c}">${x.l3.gp?f1(x.l3.min)+(x.l3.gp<Math.min(3,tg.length)?' <small>('+x.l3.gp+'/'+Math.min(3,tg.length)+')</small>':''):'—'}</td><td>${f1p(x.s.usg)}</td><td>${x.l3.gp?f1p(x.l3.usg):'—'}</td><td>${f1(pg(x.s,'pts'))}</td><td>${f1(pg(x.s,'reb'))}</td><td>${f1(pg(x.s,'As'))}</td><td>${x.last?(x.last[X.Sec]/60).toFixed(0)+'′'+(x.last[X.GS]?' ●':''):'<span class="miss">—</span>'}</td></tr>`;}).join('')}</tbody></table></div>
 <p class="history-caption">Εκτός τελευταίου: παίκτες του ενεργού ρόστερ με ≥ ${ROTATION}′ ανά αγώνα που δεν αγωνίστηκαν στον τελευταίο αγώνα (δεν είναι ανακοίνωση τραυματισμού). Αλλαγή ρόλου: διαφορά λεπτών L3 από τη σεζόν ±5′ ή περισσότερο. ● = βασικός.</p></section>`;
 const pos=t?`<section class="pl-block team-allow"><h3>Τι επιτρέπει ανά θέση <span class="muted">${LABEL[period]} · ανά 100 αμυντικές κατοχές</span></h3><div class="stats-scroll"><table class="teams-table"><thead><tr><th>Θέση αντιπάλου</th><th>Λεπτά<small>ΜΕΡΙΔΙΟ</small></th>${ASTATS.map(([,l])=>`<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${['G','F','C'].map(p=>`<tr><th>${POS[p]}</th><td>${f1p(t[p].share)}<small class="pl-sub">avg ${f1p(A.league[p].share)}</small></td>${ASTATS.map(([k])=>`<td>${f1(t[p].per[k])} <span class="rk ${aTone(t[p].rank[k],A.n)}">#${t[p].rank[k]||'—'}</span><small class="pl-sub">avg ${f1(A.league[p][k])}</small></td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="history-caption">#1 = η άμυνα που αφήνει τα λιγότερα σε αυτή τη θέση. Κόκκινο: στις 5 που αφήνουν τα περισσότερα — σημείο για τους παίκτες αυτής της θέσης στον αντίπαλο. Θέση από το επίσημο ρόστερ.</p></section>`:'';
 return rot+pos;}
function bindTeam(root){bindOpen(root);}

/* ---------- για το πρόγραμμα ---------- */
/* Ποιοι παίκτες σχετίζονται με κάθε οικογένεια σημείων (δείκτης i του BettingStats.metrics). */
const BEN={1:{who:'off',key:'usg',lab:'USG%',pct:true},3:{who:'off',key:'a2',lab:'2PA/100',fn:o=>p100(o,'A2')},5:{who:'off',key:'a3',lab:'3PA/100',fn:o=>p100(o,'A3')},6:{who:'off',key:'fta',lab:'FTA/100',fn:o=>p100(o,'A1')},7:{who:'off',key:'orp',lab:'OREB%',pct:true},9:{who:'off',key:'astp',lab:'AST%',pct:true},8:{who:'both',key:'tov',lab:'TOV/100',title:'Λάθη',fn:o=>p100(o,'Tv'),def:{lab:'STL/100',title:'Κλεψίματα',fn:o=>p100(o,'St')}},11:{who:'def',lab:'STL/100',title:'Κλεψίματα',fn:o=>p100(o,'St')},10:{who:'def',lab:'BLK/100',title:'Κοψίματα',fn:o=>p100(o,'Bl')}};
function leaders(code,fn,n=3){const roster=g.BettingLive?.rosters?.[code]||[];return roster.map(id=>{const s=stats(id,'season'),l3=stats(id,'3');return {id,s,l3,v:fn(s),v3:l3.gp?fn(l3):null};}).filter(x=>x.s.gp>=2&&(x.s.min||0)>=12&&x.l3.gp>=1&&(x.l3.min||0)>=10&&Number.isFinite(x.v)).sort((a,b)=>b.v-a.v).slice(0,n);}
/* Πιθανοί ωφελημένοι για ένα σημείο: A = επίθεση, B = άμυνα (κωδικοί ομάδων). */
function beneficiaries(spot,Acode,Bcode){const b=BEN[spot.f.i];if(!b)return [];const out=[];
 const fnA=b.fn||(o=>o[b.key]);
 if(spot.type==='off'&&(b.who==='off'||b.who==='both'))out.push({team:Acode,lab:b.lab,pct:b.pct,list:leaders(Acode,fnA),title:'Παίκτες'});
 if(spot.type==='def'){if(b.who==='off'||b.who==='both')out.push({team:Acode,lab:b.lab,pct:b.pct,list:leaders(Acode,fnA),title:b.title||'Under για'});
  if(b.who==='def')out.push({team:Bcode,lab:b.lab,list:leaders(Bcode,b.fn),title:b.title});if(b.def)out.push({team:Bcode,lab:b.def.lab,list:leaders(Bcode,b.def.fn),title:b.def.title});}
 return out.filter(x=>x.list.length);}
function benHtml(spot,Acode,Bcode){const groups=beneficiaries(spot,Acode,Bcode);if(!groups.length)return '';const fv=(v,p)=>p?f1p(v):f1(v);
 return `<div class="spot-players">${groups.map(gr=>`<p><span>${esc(gr.title)} · ${esc(teamName(gr.team))} <small>${esc(gr.lab)} σεζόν · L3</small></span>${gr.list.map(x=>`<button type="button" class="glance-chip" data-player="${esc(x.id)}">${esc(shortOf(x.id))} <small>${fv(x.v,gr.pct)} · ${fv(x.v3,gr.pct)}</small></button>`).join('')}</p>`).join('')}</div>`;}
function benText(spot,Acode,Bcode){return beneficiaries(spot,Acode,Bcode).map(gr=>`${gr.title} · ${teamName(gr.team)} (${gr.lab} σεζόν/L3): `+gr.list.map(x=>`${shortOf(x.id)} ${gr.pct?f1p(x.v):f1(x.v)}/${gr.pct?f1p(x.v3):f1(x.v3)}`).join(', ')).join('\n');}
/* Σημεία θέσης: η άμυνα B στις 6 που αφήνουν τα περισσότερα σε μια θέση στη σεζόν (και στις 10 χειρότερες στα L5),
   ή στις 6 χειρότερες στα L5 και στις 8 χειρότερες στη σεζόν,
   σε πόντους / ριμπάουντ / ασίστ, και η A έχει παίκτες αυτής της θέσης με ρόλο. */
function positionSpots(Acode,Bcode){const A=allowance('season'),A5=allowance('5'),P=production('season'),P5=production('5'),t=A.teams[Bcode],t5=A5.teams[Bcode],o=P.teams[Acode],o5=P5.teams[Acode];if(!t||!o)return [];const n=A.n,BOT=n-5,out=[];
 for(const p of ['G','F','C']){const hits=[];for(const [k,l] of ASTATS.filter(([k])=>['pts','reb','as'].includes(k))){const r=t[p].rank[k],r5=t5?.[p]?.rank?.[k],q=o[p].rank[k],q5=o5?.[p]?.rank?.[k];
   const weak=(r>=BOT&&(!r5||r5>=n-9))||(r5&&r5>=BOT&&r>=n-7),strong=q<=8||(q5&&q5<=6&&q<=10);
   if(weak&&strong)hits.push({k,l,r,r5,q,q5});}
  if(!hits.length)continue;
  const players=(g.BettingLive?.rosters?.[Acode]||[]).filter(id=>posOf(id)===p).map(id=>({id,s:stats(id,'season'),l3:stats(id,'3')})).filter(x=>x.s.gp>=2&&(x.s.min||0)>=12&&x.l3.gp>=1&&(x.l3.min||0)>=10).sort((a,b)=>(b.l3.min||0)-(a.l3.min||0)).slice(0,3);
  if(players.length)out.push({p,hits,players,A:Acode,B:Bcode});}
 return out;}
function gameHtml(Hcode,Acode){if(!data().team[Hcode]||!data().team[Acode])return '<p class="muted players-note">Δεν υπάρχουν ακόμη δεδομένα παικτών για αυτό το ματς.</p>';
 const chip=(x,extra)=>`<button type="button" class="glance-chip" data-player="${esc(x.id)}">${esc(shortOf(x.id))} <small>${esc(extra)}</small></button>`;
 const teamLine=code=>{const ab=absences(code),sh=roleShifts(code);return `<div class="glance-row"><span class="glance-k">${esc(teamName(code))}</span><span class="glance-chips">${ab.map(x=>chip(x,'εκτός τελευταίου · '+f1(x.s.min)+'′')).join('')}${sh.map(x=>chip(x,'L3 '+sign(x.d)+'′')).join('')}${!ab.length&&!sh.length?'<span class="muted">Καμία απουσία ή αλλαγή ρόλου</span>':''}</span></div>`;};
 const ps=[...positionSpots(Hcode,Acode),...positionSpots(Acode,Hcode)];
 return `<div class="game-players"><h3>Παίκτες</h3>${teamLine(Hcode)}${teamLine(Acode)}
 ${ps.length?`<h4>Σημεία θέσης</h4><ul class="pos-spots">${ps.map(s=>`<li><strong>${POS[s.p]} ${esc(teamName(s.A))}</strong> <span class="muted">απέναντι στη ${esc(teamName(s.B))}:</span> ${s.hits.map(h=>`${esc(h.l)}: παράγει <span class="rk good">#${h.q}</span>${h.q5?` <small>L5 #${h.q5}</small>`:''} · αφήνει <span class="rk bad">#${h.r}</span>${h.r5?` <small>L5 #${h.r5}</small>`:''}`).join(' · ')}<div class="glance-chips">${s.players.map(x=>chip(x,f1(x.l3.min)+'′ L3')).join('')}</div></li>`).join('')}</ul>`:''}
 <p class="history-caption">Εκτός τελευταίου: παίκτες του rotation που δεν έπαιξαν στον τελευταίο αγώνα της ομάδας τους (όχι ανακοίνωση τραυματισμού). Σημεία θέσης (ανά 100 κατοχές, G/F/C από το ρόστερ): οι παίκτες μιας θέσης της επίθεσης παράγουν πολύ (στις 8 καλύτερες στη σεζόν ή στις 6 στα L5) και η άμυνα αφήνει πολλά σε αυτή τη θέση (στις 6 χειρότερες στη σεζόν, ή στα L5 με τη σεζόν να δείχνει προς την ίδια μεριά). «Παράγει #1» = τα περισσότερα, «αφήνει #20» = τα περισσότερα. Δίπλα στους παίκτες: λεπτά στους 3 τελευταίους αγώνες.</p></div>`;}

g.BettingPlayers={data,stats,sample,agg,allowance,production,table,open,close,teamSections,bindTeam,gameHtml,benHtml,benText,beneficiaries,positionSpots,absences,roleShifts,rotation,fullName,shortName,teamOf,MARKETS,state:T};
if(typeof window!=='undefined')window.addEventListener('betting-live',e=>{if(e.detail?.status==='loading')return;if(host&&host.isConnected&&host.querySelector('.players-table'))drawTable();if(dialog&&dialog.open)drawCard();});
})(globalThis);
