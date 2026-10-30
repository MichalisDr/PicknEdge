(function(global){
'use strict';
const div=(n,d,k=1)=>Number.isFinite(n)&&Number.isFinite(d)&&d>0?k*n/d:null;
const fmt=(v,suffix='')=>v===null||!Number.isFinite(v)?'—':v.toFixed(1)+suffix;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Δείκτες που εμφανίζονται ως ποσοστό. */
const PCT=i=>(i>=2&&i<=8)||i>=10;
/* Κατεύθυνση κατάταξης ανά πλευρά: 1 = μεγαλύτερο είναι καλύτερο, -1 = μικρότερο είναι καλύτερο,
   0 = στυλ παιχνιδιού (κατάταξη από το μεγαλύτερο, χωρίς χρώμα καλό/κακό).
   Άμυνα: η #1 είναι η ομάδα που αφήνει τα λιγότερα στον αντίπαλο. */
const DIR={offense:[0,1,1,1,1,0,1,1,-1,1,-1,-1],defense:[0,-1,-1,-1,-1,-1,-1,1,1,-1,1,1]};
function aggregate(teams){const out={};for(const t of teams)for(const [key,value] of Object.entries(t))if(typeof value==='number')out[key]=(out[key]||0)+value;return out;}
function metrics(t,side){
 const off=side==='offense',p=off?'T':'O',poss=off?t.OfPo:t.DePo;
 const m1=t[p+'M1'],m2=t[p+'M2'],m3=t[p+'M3'],a1=t[p+'A1'],a2=t[p+'A2'],a3=t[p+'A3'],fga=a2+a3;
 const pts=m1+2*m2+3*m3,reb=off?t.TOR:t.TDR,rebOpp=off?t.ODR:t.OOR;
 /* Επίθεση: πόσα από τα δικά της δίποντα κόβονται και πόσες κατοχές χάνει από κλέψιμο.
    Άμυνα: κοψίματα της ομάδας ανά δίποντο αντιπάλου και κλεψίματα ανά αμυντική κατοχή. */
 const blk=off?t.OBl:t.TBl,blkBase=off?t.TA2:t.OA2,stl=off?t.OSt:t.TSt;
 const required=[[t.OfPo,t.DePo,t.Sec],[m1,m2,m3,poss],[m2,m3,a2,a3],[m2,a2],[m3,a3],[a3,a2],[a1,a2,a3],[reb,rebOpp],[t[p+'Tv'],poss],[t[p+'As'],poss],[blk,blkBase],[stl,poss]];
 return [div(t.OfPo+t.DePo,t.Sec,1200),div(pts,poss,100),div(m2+1.5*m3,fga,100),div(m2,a2,100),div(m3,a3,100),div(a3,fga,100),div(a1,fga,100),div(reb,reb+rebOpp,100),div(t[p+'Tv'],poss,100),div(t[p+'As'],poss,100),div(blk,blkBase,100),div(stl,poss,100)].map((v,i)=>required[i].every(Number.isFinite)?v:null);
}
function columns(side){const off=side==='offense',opp=off?'':'Opp ';
 return [
 ['Pace','/ 40′','Κατοχές ανά 40 λεπτά: μέσος επιθετικών και αμυντικών κατοχών, με προσαρμογή στον χρόνο.'],
 [off?'ORtg':'DRtg','PTS / 100',off?'Πόντοι ανά 100 επιθετικές κατοχές.':'Πόντοι αντιπάλων ανά 100 αμυντικές κατοχές.'],
 [opp+'eFG%','EFFICIENCY','(Εύστοχα δίποντα + 1,5 × εύστοχα τρίποντα) / προσπάθειες εντός παιδιάς.'],
 [opp+'2P%','ACCURACY','Εύστοχα δίποντα / προσπάθειες διπόντων.'],
 [opp+'3P%','ACCURACY',off?'Εύστοχα τρίποντα / προσπάθειες τριπόντων.':'Εύστοχα τρίποντα αντιπάλων / προσπάθειες. Σε λίγους αγώνες εξαρτάται πολύ από την τύχη· πιο σταθερό είναι πόσα τρίποντα αφήνει (Opp 3PA/FGA).'],
 [opp+'3PA/FGA','SHOT MIX','Προσπάθειες τριπόντων / συνολικές προσπάθειες εντός παιδιάς.'],
 [opp+'FTA/FGA','FT RATE','Προσπάθειες βολών / προσπάθειες εντός παιδιάς, εκφρασμένο ως ποσοστό.'],
 [off?'OREB%':'DREB%','REBOUND SHARE',off?'Επιθετικά ριμπάουντ / (δικά της επιθετικά + αμυντικά ριμπάουντ αντιπάλων).':'Αμυντικά ριμπάουντ / (δικά της αμυντικά + επιθετικά ριμπάουντ αντιπάλων).'],
 [opp+'TOV%','PER POSSESSION',off?'Λάθη ανά 100 επιθετικές κατοχές.':'Λάθη αντιπάλων ανά 100 αμυντικές κατοχές.'],
 [opp+'AST','/ 100 POSS',off?'Ασίστ ανά 100 επιθετικές κατοχές.':'Ασίστ αντιπάλων ανά 100 αμυντικές κατοχές.'],
 [off?'2PA BLKD%':'BLK%','RIM',off?'Ποσοστό των δικών της διπόντων που κόβονται από τον αντίπαλο.':'Κοψίματα / προσπάθειες διπόντων αντιπάλου: πόσο προστατεύει τη ρακέτα.'],
 [off?'STL AGAINST':'STL%','/ 100 POSS',off?'Κλεψίματα που δέχεται ανά 100 επιθετικές κατοχές.':'Κλεψίματα ανά 100 αμυντικές κατοχές.']];
}
function detail(t,side,i){const p=side==='offense'?'T':'O',g=t.Gm,pg=n=>fmt(div(n,g)),tag=side==='offense'?'':'αντιπάλων ',off=side==='offense';
 const values=[['Κατοχές / αγώνα',fmt(div(t.OfPo+t.DePo,2*g))],['Πόντοι '+tag+'/ αγώνα',pg(t[p+'M1']+2*t[p+'M2']+3*t[p+'M3'])],['FGM / FGA ανά αγώνα',pg(t[p+'M2']+t[p+'M3'])+' / '+pg(t[p+'A2']+t[p+'A3'])],['2PM / 2PA ανά αγώνα',pg(t[p+'M2'])+' / '+pg(t[p+'A2'])],['3PM / 3PA ανά αγώνα',pg(t[p+'M3'])+' / '+pg(t[p+'A3'])],['3PA / αγώνα',pg(t[p+'A3'])],['FTA / αγώνα',pg(t[p+'A1'])],[off?'OREB / αγώνα':'DREB / αγώνα',pg(off?t.TOR:t.TDR)],['Λάθη '+tag+'/ αγώνα',pg(t[p+'Tv'])],['Ασίστ '+tag+'/ αγώνα',pg(t[p+'As'])],[off?'Κοψίματα που δέχεται / αγώνα':'Κοψίματα / αγώνα',pg(off?t.OBl:t.TBl)],[off?'Κλεψίματα που δέχεται / αγώνα':'Κλεψίματα / αγώνα',pg(off?t.OSt:t.TSt)]];
 return values[i];
}
/* Κατάταξη 1–20 όλων των ομάδων σε κάθε δείκτη, για τη συγκεκριμένη πλευρά και δείγμα. */
const rankCache=new Map();
function ranks(side,period='season'){
 const teams=global.BETTING_TEAMS||[],key=side+'|'+period+'|'+teams.length+'|'+(global.BettingLive?.state?.games||0)+'|'+(global.BettingLive?.state?.updated||0);
 if(rankCache.has(key))return rankCache.get(key);
 const vals=teams.map(t=>[t.CID,metrics(global.TeamHistory?TeamHistory.sample(t,period):t,side)]),out={};
 teams.forEach(t=>out[t.CID]=[]);
 for(let i=0;i<DIR[side].length;i++){const d=DIR[side][i]===-1?-1:1;vals.filter(([,v])=>v[i]!==null).sort((a,b)=>(b[1][i]-a[1][i])*d).forEach(([id],k)=>out[id][i]=k+1);}
 out.n=teams.length;rankCache.set(key,out);if(rankCache.size>40)rankCache.delete(rankCache.keys().next().value);return out;}
/* good = στις 5 καλύτερες, bad = στις 5 χειρότερες, neutral = δείκτης στυλ. */
function tone(side,i,rank,n){if(!rank)return '';if(DIR[side][i]===0)return 'neutral';if(rank<=5)return 'good';if(rank>=n-4)return 'bad';return '';}
const ord=r=>r?r+'η':'—';
const state={side:'offense',entity:'teams',col:1,dir:-1,query:'',period:'season'};
let host=null,pinned=null;
function feed(){const L=global.BettingLive?.state;return {L,live:Boolean(L&&L.games&&global.BETTING_HISTORY)};}
function isoShort(d){return d?d.split('-').reverse().slice(0,2).join('/'):'—';}
function pill(){const {L,live}=feed();if(state.period!=='season')return 'LAST '+state.period+' · TEAM GAMES';return live?'ROUND '+L.round+' · SEASON TOTALS':'ROUND 7 · SNAPSHOT';}
function statusLine(){const {L,live}=feed();if(global.BETTING_STATIC)return `<p class="live-status" data-live="live" role="status"><span>${escape(global.BETTING_STATIC.label)}</span></p>`;if(!L)return '';const when=t=>t?new Date(t).toLocaleString('el-GR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';let text;
 if(L.status==='loading')text='Ενημέρωση από EuroLeague…'+(L.progress&&L.progress.total?' '+L.progress.done+'/'+L.progress.total+' νέοι αγώνες':'');
 else if(L.status==='live')text='EuroLeague · '+L.games+' αγώνες έως '+isoShort(L.date)+' · ενημερώθηκε '+when(L.updated);
 else if(live)text='EuroLeague · '+L.games+' αγώνες έως '+isoShort(L.date)+(L.error?' · '+L.error:'');
 else text='Snapshot 3StepsBasket · 7η αγωνιστική'+(L.error?' · '+L.error:'');
 if(L.status!=='loading'){const n=(k,one,many)=>k+' '+(k===1?one:many);if(L.estimated)text+=' · '+n(L.estimated,'αγώνας','αγώνες')+' με εκτίμηση κατοχών (χωρίς play-by-play)';if(L.live&&L.live.length)text+=' · '+n(L.live.length,'αγώνας σε εξέλιξη, μπαίνει μόλις τελειώσει','αγώνες σε εξέλιξη, μπαίνουν μόλις τελειώσουν');}
 return `<p class="live-status" data-live="${escape(L.status)}" role="status"><span>${escape(text)}</span>${L.status==='loading'?'':'<button type="button" class="live-refresh" data-live-refresh>Ανανέωση</button>'}</p>`;}
function method(){const {live}=feed(),n=(global.BETTING_TEAMS||[]).length;
 const common=`<p>League average: λόγος αθροισμάτων από όλες τις ${n} ομάδες, όχι μέσος όρος των επιμέρους ποσοστών. Η αναζήτηση δεν αλλάζει το δείγμα του average. Pace = 1.200 × (επιθετικές + αμυντικές κατοχές) / δευτερόλεπτα. Οι χρόνοι περιλαμβάνουν παρατάσεις (2.400″ + 300″ ανά παράταση). AST, TOV και κλεψίματα χρησιμοποιούν τις κατοχές της αντίστοιχης πλευράς. BLK%: κοψίματα της ομάδας / δίποντα του αντιπάλου (άμυνα) ή κοψίματα που δέχεται / δικά της δίποντα (επίθεση).</p><p>Κατάταξη: #1 είναι η καλύτερη ομάδα της λίγκας για τη συγκεκριμένη πλευρά. Στην επίθεση η #1 παράγει τα περισσότερα (ή χάνει τις λιγότερες μπάλες)· στην άμυνα η #1 αφήνει τα λιγότερα. Πράσινο: 5 καλύτερες, κόκκινο: 5 χειρότερες. Pace και 3PA/FGA επίθεσης είναι στυλ παιχνιδιού και κατατάσσονται από το μεγαλύτερο, χωρίς χρώμα. Δίπλα στην κατάταξη σεζόν φαίνεται η κατάταξη στους 3 τελευταίους αγώνες (L3)· το βέλος σημαίνει αλλαγή 5 θέσεων ή περισσότερο.</p><p>Τα ποσοστά σουτ και ριμπάουντ περιγράφουν το διαθέσιμο δείγμα. Δεν έχει γίνει προσαρμογή για τη δυναμικότητα αντιπάλων.</p>`;
 return live?`<p>Πηγή: επίσημα box score και play-by-play της EuroLeague, με ενημέρωση σε κάθε άνοιγμα της σελίδας. Σουτ, βολές, ριμπάουντ, ασίστ, λάθη, κλεψίματα και κοψίματα είναι τα επίσημα σύνολα ομάδας κάθε αγώνα. Last 3 / 5 / 10: οι τελευταίοι αγώνες κάθε ομάδας από τα ίδια game logs.</p><p>Κατοχές: καταμέτρηση από το play-by-play, όχι εκτίμηση τύπου. Νέα κατοχή μετρά κάθε φορά που η μπάλα αλλάζει ομάδα (σουτ, βολές, λάθος, αμυντικό ριμπάουντ, κλέψιμο) και στην αρχή κάθε περιόδου· οι βολές τεχνικής ποινής δεν αλλάζουν κατοχή. Αν λείπει το play-by-play ενός αγώνα, χρησιμοποιείται η εκτίμηση Oliver και αναφέρεται στη γραμμή κατάστασης.</p><p>Έλεγχος με το snapshot 3StepsBasket της 7ης αγωνιστικής (20 ομάδες): ποσοστά σουτ και ρυθμοί έως ±0,2 μονάδες, ριμπάουντ έως ±0,6, Pace έως ±0,6, ORtg/DRtg έως ±1,4 (μέση απόκλιση ±0,4). Οι μικρές διαφορές προέρχονται από διορθώσεις του επίσημου box score και από τον τρόπο μέτρησης των κατοχών.</p>${common}`
 :`<p>Πηγή: αποθηκευμένα αθροιστικά στοιχεία 3StepsBasket του υπάρχοντος dashboard. Η ζωντανή ενημέρωση από την EuroLeague δεν είναι διαθέσιμη αυτή τη στιγμή. Η κάλυψη εμφανίζεται στη στήλη GP· το snapshot ενημερώθηκε από το αρχείο της 7ης αγωνιστικής.</p>${common}`;}
function mount(target){host=target;draw();}
function rows(){const teams=global.BETTING_TEAMS||[];const all=teams.filter(t=>t.Cl.toLocaleLowerCase('el').includes(state.query.toLocaleLowerCase('el'))).map(t=>({t:TeamHistory.sample(t,state.period),name:t.Cl,id:t.CID,average:false}));all.push({t:state.period==='season'?aggregate(teams):(teams.every(t=>global.PERIOD_DATA?.[state.period]?.raw.some(r=>r.CID===t.CID)||TeamHistory.games(t.CID).length)?TeamHistory.sum(teams.map(t=>TeamHistory.sample(t,state.period)).flatMap(t=>[t])):TeamHistory.sum([])),name:'League average',average:true});all.forEach(r=>r.values=metrics(r.t,state.side));return all.sort((a,b)=>{const x=a.values[state.col],y=b.values[state.col];return x===null?(y===null?0:1):y===null?-1:(x-y)*state.dir||Number(b.average)-Number(a.average)||a.name.localeCompare(b.name)});}
/* Κατάταξη μέσα στο κελί: κατάταξη δείγματος και, στη σεζόν, κατάταξη L3 με βέλος αλλαγής. */
function rankHtml(id,i,R,R3){const r=R[id]?.[i];if(!r)return '';const t=tone(state.side,i,r,R.n);let extra='';
 if(R3){const r3=R3[id]?.[i];if(r3){const d=r-r3,neutral=DIR[state.side][i]===0,arrow=Math.abs(d)>=5?(d>0?'↑':'↓'):'';extra=`<span class="rk3 ${arrow&&!neutral?(d>0?'up':'down'):''}">L3 ${r3}${neutral?'':arrow}</span>`;}}
 return `<span class="rk-line"><span class="rk ${t}">#${r}</span>${extra}</span>`;}
function draw(){
 if(!host)return;pinned=null;
 const teams=global.BETTING_TEAMS||[],defs=columns(state.side),list=rows(),R=ranks(state.side,state.period),R3=state.period==='season'&&global.BETTING_HISTORY?ranks(state.side,'3'):null;
 const games=teams.map(t=>t.Gm),range=games.length?(Math.min(...games)===Math.max(...games)?String(games[0]):Math.min(...games)+'–'+Math.max(...games)):'—';
 host.innerHTML=`<section class="bet-stats"><div class="stats-heading"><div><div class="eyebrow">BETTING / STATISTICS</div><h1>${state.entity==='players'?'Το προφίλ κάθε παίκτη.':'Το προφίλ κάθε ομάδας.'}</h1><p>${state.entity==='players'?'Ρόλος, λεπτά και ρυθμοί σε σεζόν και τελευταίους αγώνες.':'Σύγκρινε το παιχνίδι της με τον μέσο όρο της διοργάνωσης.'}</p></div><span class="pill">${pill()}</span></div>${statusLine()}
 <div class="entity-switch" role="group" aria-label="Κατηγορία στατιστικών"><button data-entity="teams" aria-pressed="${state.entity==='teams'}">Teams <span>${teams.length}</span></button><button data-entity="players" aria-pressed="${state.entity==='players'}">Players ${global.BettingPlayers?`<span>${Object.keys(BettingPlayers.data().player).length}</span>`:'<small>Σύντομα</small>'}</button></div>
 ${state.entity==='players'?(global.BettingPlayers?'<div id="players-host"></div>':'<div class="empty"><h2>Τα δεδομένα παικτών δεν φορτώθηκαν.</h2><button class="btn" data-entity="teams">Επιστροφή στις ομάδες</button></div>'):`
 <div class="stats-toolbar"><div class="side-switch" role="group" aria-label="Πλευρά παιχνιδιού"><button data-side="offense" aria-pressed="${state.side==='offense'}">Επίθεση</button><button data-side="defense" aria-pressed="${state.side==='defense'}">Άμυνα</button></div>${TeamHistory.periods(state.period,'data-period')}<span class="stats-scope">${state.period==='season'?range+' αγώνες / ομάδα · συνολικό δείγμα':'Πρόσφατο δείγμα · '+(feed().live?'game logs EuroLeague':'εισαγωγή 3StepsBasket')}</span><label class="team-search"><span class="sr-only">Αναζήτηση ομάδας</span><input id="team-search" type="search" placeholder="Αναζήτηση ομάδας…" value="${escape(state.query)}"></label></div>
 ${state.period!=='season'?'<p class="history-status">Οι τιμές, η κατάταξη και το average υπολογίζονται από τα σύνολα του επιλεγμένου δείγματος. GP: αγώνες δείγματος / επιλεγμένο παράθυρο.</p>':''}<div class="stats-caption"><span>${state.side==='offense'?'Τι παράγει η ομάδα':'Τι επιτρέπει στον αντίπαλο'}</span><span class="rank-legend"><span class="rk good">#1–5</span> καλύτερες <span class="rk bad">#16–20</span> χειρότερες${R3?' · L3 = κατάταξη στους 3 τελευταίους αγώνες':''} · Hover ή πάτημα σε τιμή για λεπτομέρειες</span></div>
 <div class="stats-scroll" tabindex="0" aria-label="Πίνακας ομάδων με οριζόντια κύλιση"><table class="teams-table ranked"><caption class="sr-only">${state.side==='offense'?'Επιθετικά':'Αμυντικά'} στατιστικά ομάδων, κατάταξη και μέσος όρος διοργάνωσης</caption><thead><tr><th scope="col" class="club-head">Ομάδα</th><th scope="col">GP</th>${defs.map((d,i)=>`<th scope="col" aria-sort="${i===state.col?(state.dir===1?'ascending':'descending'):'none'}"><button data-sort="${i}" title="${escape(d[2])}">${escape(d[0])}<span class="sort-arrow">${i===state.col?(state.dir===1?'↑':'↓'):'↕'}</span><small>${d[1]}</small></button></th>`).join('')}</tr></thead><tbody>${list.map((r,ri)=>`<tr class="${r.average?'league-average':''}"><th scope="row"><span class="club-mark">${r.average?'—':escape(r.name.slice(0,2).toUpperCase())}</span>${r.average?escape(r.name):`<button class="team-open" data-team-open="${escape(r.id)}">${escape(r.name)}</button>`}${r.average?'<small>Σταθμισμένο · όλες οι ομάδες</small>':''}</th><td class="gp">${r.average?'—':state.period==='season'?r.t.Gm:(r.t.Gm||0)+'/'+state.period}</td>${r.values.map((v,i)=>`<td class="${i===state.col?'sorted-column':''}"><button class="stat-cell" data-row="${ri}" data-metric="${i}" aria-label="${escape(r.name+' · '+defs[i][0]+': '+fmt(v)+(r.average?'':'. Κατάταξη '+ord(R[r.id]?.[i])))+'. Λεπτομέρειες'}"><span class="v">${fmt(v,PCT(i)?'%':'')}</span>${r.average?'':rankHtml(r.id,i,R,R3)}</button></td>`).join('')}</tr>`).join('')}</tbody></table></div>
 ${list.length===1?'<p class="empty">Δεν βρέθηκε ομάδα. Ο μέσος όρος παραμένει για ολόκληρη τη διοργάνωση.</p>':''}
 <div class="stats-foot"><span><i></i> Το average ταξινομείται μαζί με τις ομάδες βάσει της επιλεγμένης στήλης.</span><span>${list.length-1} / ${teams.length} ομάδες</span></div>
 <details class="stats-method"><summary>Δείγμα & υπολογισμοί</summary>${method()}</details>`}
 <div id="stats-tooltip" class="stats-tooltip" role="tooltip" hidden></div></section>`;
 const ph=host.querySelector('#players-host');if(ph&&global.BettingPlayers)BettingPlayers.table(ph);
 host.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{state.period=b.dataset.period;draw();host.querySelector('[data-period="'+state.period+'"]').focus()});
 host.querySelectorAll('[data-team-open]').forEach(b=>b.onclick=()=>{const t=teams.find(t=>t.CID===b.dataset.teamOpen);TeamHistory.open(t,state.side,state.lastMetric??state.col,state.period)});
 host.querySelectorAll('[data-entity]').forEach(b=>b.onclick=()=>{state.entity=b.dataset.entity;draw()});
 bindLive();
 host.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{state.side=b.dataset.side;draw()});
 host.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const col=Number(b.dataset.sort);state.dir=state.col===col?-state.dir:-1;state.col=col;state.lastMetric=col;draw();host.querySelector('[data-sort="'+col+'"]').focus()});
 const search=host.querySelector('#team-search');if(search)search.oninput=()=>{const caret=search.selectionStart;state.query=search.value;draw();const n=host.querySelector('#team-search');n.focus();try{n.setSelectionRange(caret,caret)}catch{}};
 const tip=host.querySelector('#stats-tooltip');
 function hide(){tip.hidden=true;host.querySelectorAll('[aria-describedby="stats-tooltip"]').forEach(b=>b.removeAttribute('aria-describedby'));}
 function show(b){const r=list[Number(b.dataset.row)],i=Number(b.dataset.metric),d=detail(r.t,state.side,i);hide();
  let rankText='';if(!r.average){const parts=[];for(const p of ['season','3','5']){const rr=ranks(state.side,p)[r.id]?.[i];if(rr)parts.push((p==='season'?'Σεζόν':'L'+p)+' '+ord(rr));}rankText=`<span class="tip-rank">Κατάταξη: ${escape(parts.join(' · '))} / ${R.n}</span>`;}
  tip.innerHTML=`<strong>${escape(r.name)} · ${escape(defs[i][0])}</strong>${rankText}<span>${escape(d[0])}</span><b>${escape(d[1])}</b><p>${escape(defs[i][2])}</p>${TeamHistory.hover(r.t,state.side,i,state.period)}`;tip.hidden=false;b.setAttribute('aria-describedby','stats-tooltip');const rect=b.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.max(8,Math.min(innerWidth-w-8,rect.left+rect.width/2-w/2))+'px';tip.style.top=Math.max(8,rect.bottom+h+12<innerHeight?rect.bottom+8:rect.top-h-8)+'px';}
 host.querySelectorAll('.stat-cell').forEach(b=>{b.onmouseenter=()=>{state.lastMetric=Number(b.dataset.metric);if(!pinned)show(b)};b.onmouseleave=()=>{if(!pinned)hide()};b.onfocus=()=>{state.lastMetric=Number(b.dataset.metric);show(b)};b.onblur=()=>{if(pinned===b)pinned=null;hide()};b.onclick=()=>{if(pinned===b){pinned=null;hide()}else{pinned=b;show(b)}}});
 host.onkeydown=e=>{if(e.key==='Escape'){pinned=null;hide()}};
 const scroller=host.querySelector('.stats-scroll');if(scroller)scroller.onscroll=()=>{pinned=null;hide()};
 host.onclick=e=>{if(!e.target.closest('.stat-cell')&&!e.target.closest('.stats-tooltip')){pinned=null;hide()}};
}
function bindLive(){host?.querySelectorAll('[data-live-refresh]').forEach(b=>b.onclick=()=>global.BettingLive?.refresh());}
function onLive(e){rankCache.clear();if(!host||!host.isConnected||!host.querySelector('.bet-stats'))return;if(e.detail?.status==='loading'){const el=host.querySelector('.live-status');if(el){el.outerHTML=statusLine();bindLive();}return;}
 const active=document.activeElement,typing=active&&active.id==='team-search',open=host.querySelector('details.stats-method')?.open;draw();
 if(open)host.querySelector('details.stats-method').open=true;if(typing){const n=host.querySelector('#team-search');if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length)}catch{}}}}
if(typeof window!=='undefined'){window.addEventListener('hashchange',()=>TeamHistory.close());window.addEventListener('betting-live',onLive);}
global.BettingStats={mount,metrics,aggregate,columns,detail,rows,state,ranks,tone,DIR,PCT};
})(globalThis);
