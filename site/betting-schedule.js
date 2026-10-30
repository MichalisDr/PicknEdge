/* Court Vision · Betting · Βάσει προγράμματος
   Για κάθε αγώνα της επόμενης αγωνιστικής βρίσκει «σημεία»: πού η επίθεση της μίας ομάδας είναι δυνατή
   εκεί που η άμυνα της άλλης είναι αδύνατη (ή το ανάποδο), από την κατάταξη 1–20 σε σεζόν και L3.
   Δεν προβλέπει αποτέλεσμα και δεν υπολογίζει πιθανότητες· δίνει υποψήφια σημεία για έλεγχο στην αγορά.
   Πηγές: BETTING_SCHEDULE / BETTING_TEAMS / BETTING_HISTORY (betting-live-data.js), κατάταξη από BettingStats.ranks. */
(function(g){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TOP=6;/* «δυνατό»: στις 6 καλύτερες· «αδύνατο»: στις 6 χειρότερες */
/* Οικογένειες: δείκτης i του BettingStats.metrics (ίδιος για επίθεση και άμυνα).
   off = σημείο υπέρ της επίθεσης (δυνατή επίθεση, αδύνατη άμυνα), def = υπέρ της άμυνας (αδύνατη επίθεση, δυνατή άμυνα). */
const FAMILIES=[
 {i:1,name:'Παραγωγή πόντων',stat:'πόντοι / 100 κατοχές',off:'πόντοι ομάδας (team total)',def:'Under πόντων της επίθεσης'},
 {i:3,name:'Ρακέτα (δίποντο)',stat:'2P%',off:'πόντοι ψηλών, πόντοι ομάδας',def:'Under πόντων ψηλών της επίθεσης'},
 {i:5,name:'Όγκος τριπόντων',stat:'3PA/FGA',off:'τρίποντα ομάδας, σουτέρ',def:'Under τριπόντων της επίθεσης',volume:true},
 {i:6,name:'Βολές',stat:'FTA/FGA',off:'βολές ομάδας, πόντοι όσων κερδίζουν φάουλ',def:'Under βολών της επίθεσης'},
 {i:7,name:'Επιθετικά ριμπάουντ',stat:'OREB% / DREB%',off:'επιθετικά ριμπάουντ ομάδας, ριμπάουντ ψηλών',def:'Under επιθετικών ριμπάουντ της επίθεσης'},
 {i:9,name:'Ασίστ',stat:'ασίστ / 100 κατοχές',off:'ασίστ ομάδας, ασίστ χειριστών',def:'Under ασίστ της επίθεσης'},
 {i:8,name:'Λάθη',stat:'TOV%',off:null,def:'λάθη της επίθεσης, κλεψίματα της άμυνας'},
 {i:11,name:'Κλεψίματα',stat:'κλεψίματα / 100 κατοχές',off:null,def:'κλεψίματα της άμυνας'},
 {i:10,name:'Κοψίματα',stat:'BLK%',off:null,def:'κοψίματα της άμυνας, Under πόντων ψηλών της επίθεσης'}];
let host=null;
const teamsById=()=>Object.fromEntries((g.BETTING_TEAMS||[]).map(t=>[t.CID,t]));
const cidOf=code=>g.BettingLive?.cid?.[code];
const ord=r=>r?r+'η':'—';
function when(d){try{return new Date(d).toLocaleString('el-GR',{timeZone:'Europe/Athens',weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}catch{return d||'';}}
/* Η επόμενη αγωνιστική: η πρώτη που έχει αγώνες χωρίς τελικό αποτέλεσμα. */
function nextRound(list){const open=list.filter(x=>x.status!=='result');if(!open.length)return null;const r=Math.min(...open.map(x=>x.round));return {round:r,games:list.filter(x=>x.round===r).sort((a,b)=>String(a.date).localeCompare(String(b.date)))};}
function ranksAll(){const S=g.BettingStats,hist=Boolean(g.BETTING_HISTORY);return {o:S.ranks('offense','season'),d:S.ranks('defense','season'),o3:hist?S.ranks('offense','3'):null,d3:hist?S.ranks('defense','3'):null};}
/* Σημεία μιας κατεύθυνσης: επίθεση A απέναντι στην άμυνα B. */
function spots(A,B,R){const n=R.o.n,BOT=n-TOP+1,out=[];
 const rk=(tab,id,i)=>tab?.[id]?.[i]||null;
 for(const f of FAMILIES){const rA=rk(R.o,A,f.i),rB=rk(R.d,B,f.i),rA3=rk(R.o3,A,f.i),rB3=rk(R.d3,B,f.i);if(!rA||!rB)continue;
  const l3=rA3&&rB3;
  /* Υπέρ της επίθεσης: επίθεση στις καλύτερες, άμυνα στις χειρότερες. Στον όγκο τριπόντων η #1 της επίθεσης
     είναι αυτή που σουτάρει τα περισσότερα και η #20 της άμυνας αυτή που αφήνει τα περισσότερα. */
  if(f.off){const season=rA<=TOP&&rB>=BOT,recent=l3&&rA3<=TOP&&rB3>=BOT&&rA<=10&&rB>=n-9;
   if(season||recent)out.push({type:'off',f,A,B,rA,rB,rA3,rB3,why:season?(recent?'σεζόν και L3':'σεζόν'):'L3',score:(n+1-rA)+rB+(recent?4:0)});}
  /* Υπέρ της άμυνας: επίθεση στις χειρότερες (στον όγκο τριπόντων: σουτάρει πολλά) και άμυνα στις καλύτερες. */
  const weak=f.volume?(x=>x<=TOP):(x=>x>=BOT),weakSoft=f.volume?(x=>x<=10):(x=>x>=n-9);
  const season=weak(rA)&&rB<=TOP,recent=l3&&weak(rA3)&&rB3<=TOP&&weakSoft(rA)&&rB<=10;
  if(season||recent)out.push({type:'def',f,A,B,rA,rB,rA3,rB3,why:season?(recent?'σεζόν και L3':'σεζόν'):'L3',score:(f.volume?(n+1-rA):rA)+(n+1-rB)+(recent?4:0)});}
 return out;}
function pace(H,A,R,S){const p=S.ranks('offense','season'),p3=g.BETTING_HISTORY?S.ranks('offense','3'):null,n=p.n,h=p[H]?.[0],a=p[A]?.[0];if(!h||!a)return null;
 const h3=p3?.[H]?.[0],a3=p3?.[A]?.[0];
 if(h<=TOP&&a<=TOP)return {fast:true,h,a,h3,a3};if(h>=n-TOP+1&&a>=n-TOP+1)return {fast:false,h,a,h3,a3};return null;}
function hypothesis(s,names,codes){const off=s.type==='off',a=names[s.A],b=names[s.B],pl=g.BettingPlayers&&codes?g.BettingPlayers.benText(s,codes[s.A],codes[s.B]):'';
 return `${a} – ${b} · ${s.f.name}\n${off?'Υπέρ επίθεσης':'Υπέρ άμυνας'}: ${a} ${ord(s.rA)} στην επίθεση (${s.f.stat}${s.rA3?', L3 '+ord(s.rA3):''}) απέναντι σε ${b} ${ord(s.rB)} στην άμυνα${s.rB3?' (L3 '+ord(s.rB3)+')':''}.\nΑγορά προς έλεγχο: ${off?s.f.off:s.f.def}.${pl?'\n'+pl:''}\nΈλεγχος: η γραμμή είναι στο κανονικό επίπεδο των ομάδων ή έχει ήδη μετακινηθεί; Απουσίες και ρόλοι;`;}
function spotHtml(s,names,k,codes){const off=s.type==='off',a=esc(names[s.A]),b=esc(names[s.B]);
 const rr=(r,r3)=>`<b>${ord(r)}</b>${r3?`<small> L3 ${ord(r3)}</small>`:''}`;
 return `<li class="spot ${off?'spot-off':'spot-def'}"><div class="spot-head"><span class="spot-tag">${off?'Υπέρ επίθεσης':'Υπέρ άμυνας'}</span><strong>${off?a:b} · ${esc(s.f.name)}</strong><span class="spot-why">${esc(s.why)}</span></div>
 <p class="spot-ranks"><button type="button" class="link" data-team="${esc(s.A)}" data-side="offense" data-metric="${s.f.i}">${a}</button> επίθεση ${rr(s.rA,s.rA3)} <span class="muted">(${esc(s.f.stat)})</span> &nbsp;vs&nbsp; <button type="button" class="link" data-team="${esc(s.B)}" data-side="defense" data-metric="${s.f.i}">${b}</button> άμυνα ${rr(s.rB,s.rB3)}</p>
 <p class="spot-market"><span>Στην αγορά:</span> ${esc(off?s.f.off:s.f.def)}</p>
 ${g.BettingPlayers&&codes?g.BettingPlayers.benHtml(s,codes[s.A],codes[s.B]):''}
 ${g.BETTING_STATIC?'':`<button type="button" class="btn spot-new" data-hyp="${k}">Νέα ανάλυση →</button>`}</li>`;}
/* Πλήρες matchup: όλοι οι δείκτες, επίθεση της μίας απέναντι στην άμυνα της άλλης. */
function matrix(H,A,R,names){const S=g.BettingStats,co=S.columns('offense'),cd=S.columns('defense'),n=R.o.n;
 const cell=(tab,tab3,side,id,i)=>{const r=tab?.[id]?.[i],r3=tab3?.[id]?.[i],t=S.tone(side,i,r,n);return `<td><span class="rk ${t}">${r?'#'+r:'—'}</span>${r3?`<small> L3 ${r3}</small>`:''}</td>`;};
 const row=i=>`<tr><th>${esc(co[i][0])} <span class="muted">/ ${esc(cd[i][0])}</span></th>${cell(R.o,R.o3,'offense',H,i)}${cell(R.d,R.d3,'defense',A,i)}${cell(R.o,R.o3,'offense',A,i)}${cell(R.d,R.d3,'defense',H,i)}</tr>`;
 return `<details class="matchup-matrix"><summary>Πλήρες matchup · όλοι οι δείκτες</summary><div class="stats-scroll"><table class="teams-table"><thead><tr><th>Δείκτης</th><th>${esc(names[H])}<small>επίθεση</small></th><th>${esc(names[A])}<small>άμυνα</small></th><th>${esc(names[A])}<small>επίθεση</small></th><th>${esc(names[H])}<small>άμυνα</small></th></tr></thead><tbody>${co.map((_,i)=>row(i)).join('')}</tbody></table></div><p class="history-caption">#1 = καλύτερη στη λίγκα για την πλευρά της. Στην άμυνα η #1 αφήνει τα λιγότερα. Pace και 3PA/FGA επίθεσης κατατάσσονται από το μεγαλύτερο.</p></details>`;}
function draw(){
 if(!host)return;const S=g.BettingStats,list=g.BETTING_SCHEDULE||[],L=g.BettingLive?.state,byId=teamsById();
 const intro=`<div class="hero"><div class="intro"><div class="eyebrow">BETTING / DISCOVER</div><h1>Από το matchup στην υπόθεση.</h1><p>Για κάθε αγώνα της αγωνιστικής: πού η μία ομάδα είναι δυνατή εκεί που η άλλη είναι αδύνατη, με κατάταξη σεζόν και τελευταίων 3 αγώνων. Δεν είναι προβλέψεις· είναι σημεία προς έλεγχο στην αγορά.</p></div><span class="pill">${L&&L.round?'ΔΕΔΟΜΕΝΑ ΕΩΣ ROUND '+L.round:'ΦΟΡΤΩΣΗ'}</span></div>`;
 if(!S||!S.ranks||!(g.BETTING_TEAMS||[]).length){host.innerHTML=intro+'<div class="empty"><h2>Φόρτωση στατιστικών…</h2></div>';return;}
 const nx=nextRound(list);
 if(!nx){host.innerHTML=intro+`<div class="empty"><h2>${L&&L.status==='loading'?'Φόρτωση προγράμματος από την EuroLeague…':'Το πρόγραμμα δεν είναι διαθέσιμο αυτή τη στιγμή.'}</h2><p>Το πρόγραμμα διαβάζεται μαζί με τα στατιστικά. ${L&&L.error?esc(L.error):''}</p>${L&&L.status!=='loading'?'<button type="button" class="btn" data-live-refresh>Ανανέωση</button>':''} <a class="btn" href="#data">Στατιστικά Betting</a></div>`;bindLive();return;}
 const R=ranksAll(),names={},hyps=[];let total=0;
 const cards=nx.games.map(x=>{const H=cidOf(x.home),A=cidOf(x.away);names[H]=byId[H]?.Cl||x.homeName||x.home;names[A]=byId[A]?.Cl||x.awayName||x.away;
  if(!H||!A||!byId[H]||!byId[A])return `<article class="card game-card"><h2>${esc(x.homeName||x.home)} – ${esc(x.awayName||x.away)}</h2><p class="muted">Δεν βρέθηκαν στατιστικά για μία από τις ομάδες.</p></article>`;
  const list2=[...spots(H,A,R),...spots(A,H,R)].sort((a,b)=>b.score-a.score);total+=list2.length;const codes={[H]:x.home,[A]:x.away};
  const shown=list2;
  const pc=pace(H,A,R,S);
  const status=x.status==='result'?`<span class="game-status done">Τελικό ${esc((x.score||[]).join('–'))}</span>`:/live|play|progress/i.test(String(x.status))?'<span class="game-status live">Σε εξέλιξη</span>':`<span class="game-status">${esc(when(x.date))}</span>`;
  return `<article class="card game-card" id="game-${esc(x.code)}"><div class="game-head"><h2><button type="button" class="link" data-team="${esc(H)}" data-side="offense" data-metric="1">${esc(names[H])}</button> <span class="muted">–</span> <button type="button" class="link" data-team="${esc(A)}" data-side="offense" data-metric="1">${esc(names[A])}</button></h2>${status}</div>
  ${pc?`<p class="pace-note">${pc.fast?'Γρήγορο ματς:':'Αργό ματς:'} ρυθμός ${esc(names[H])} ${ord(pc.h)}${pc.h3?' (L3 '+ord(pc.h3)+')':''}, ${esc(names[A])} ${ord(pc.a)}${pc.a3?' (L3 '+ord(pc.a3)+')':''}. Στην αγορά: ${pc.fast?'Over':'Under'} συνόλου πόντων, ${pc.fast?'πολλές':'λίγες'} κατοχές.</p>`:''}
  ${shown.length?`<ul class="spot-list">${shown.map(s=>{hyps.push(hypothesis(s,names,codes));return spotHtml(s,names,hyps.length-1,codes);}).join('')}</ul>`:'<p class="muted no-spots">Κανένα καθαρό σημείο με τα όρια κατάταξης (6 καλύτερες απέναντι σε 6 χειρότερες). Το πλήρες matchup δείχνει όλους τους δείκτες.</p>'}
  ${matrix(H,A,R,names)}
  ${g.BettingPlayers?g.BettingPlayers.gameHtml(x.home,x.away):''}</article>`;}).join('');
 host.innerHTML=intro+`<div class="schedule-head"><h2>Αγωνιστική ${nx.round} <span class="muted">· ${nx.games.length} αγώνες · ${total} σημεία · ώρες Ελλάδας</span></h2></div>${statusNote(L)}<div class="game-grid">${cards}</div>
 <details class="stats-method"><summary>Πώς βγαίνουν τα σημεία</summary><p>Για κάθε δείκτη (πόντοι/100, δίποντο, όγκος τριπόντων, βολές, επιθετικά ριμπάουντ, ασίστ, λάθη, κλεψίματα, κοψίματα) συγκρίνεται η κατάταξη της επίθεσης της μίας ομάδας με την κατάταξη της άμυνας της άλλης στον ίδιο δείκτη. <b>Υπέρ επίθεσης</b>: επίθεση στις 6 καλύτερες και άμυνα στις 6 χειρότερες. <b>Υπέρ άμυνας</b>: το ανάποδο. Ισχύει στη σεζόν ή στους 3 τελευταίους αγώνες, εφόσον και η σεζόν δείχνει προς την ίδια μεριά (επίθεση στις 10 καλύτερες, άμυνα στις 10 χειρότερες).</p><p>Παίκτες κάτω από κάθε σημείο: οι 3 του ενεργού ρόστερ με τη μεγαλύτερη τιμή σεζόν στο σχετικό στατιστικό (π.χ. OREB% για τα επιθετικά ριμπάουντ, 3PA ανά 100 κατοχές για τα τρίποντα), με ≥ 12′ ανά αγώνα στη σεζόν και ≥ 10′ στους τελευταίους 3 αγώνες της ομάδας, ώστε να μη μπαίνει όποιος έχει χάσει ρόλο. Δίπλα φαίνεται η τιμή L3. Σημεία θέσης: η άμυνα στις 6 που αφήνουν τα περισσότερα σε πόντους, ριμπάουντ ή ασίστ σε μία θέση (G/F/C), ανά 100 κατοχές.</p><p>Οι απουσίες βγαίνουν από το ποιος δεν έπαιξε στον τελευταίο αγώνα· δεν υπάρχει πηγή τραυματισμών. Τα σημεία δεν λένε τι να παίξεις· λένε πού να κοιτάξεις. Το επόμενο βήμα είναι η αγορά: είναι η γραμμή στο κανονικό επίπεδο αυτών των ομάδων ή έχει ήδη μετακινηθεί;</p></details>`;
 host.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{const t=byId[b.dataset.team];if(t&&g.TeamHistory)TeamHistory.open(t,b.dataset.side,Number(b.dataset.metric),'season');});
 if(g.BettingPlayers)host.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>g.BettingPlayers.open(b.dataset.player));
 host.querySelectorAll('[data-hyp]').forEach(b=>b.onclick=()=>{try{sessionStorage.setItem('cv-hypothesis',hyps[Number(b.dataset.hyp)]);}catch{}location.hash='manual';});
 bindLive();}
function statusNote(L){if(g.BETTING_STATIC)return `<p class="live-status" data-live="live"><span>${esc(g.BETTING_STATIC.label)}</span></p>`;if(!L)return '';if(L.status==='loading')return '<p class="live-status" data-live="loading"><span>Ενημέρωση από EuroLeague…</span></p>';
 return `<p class="live-status" data-live="${esc(L.status)}"><span>Κατάταξη από ${esc(L.games)} αγώνες${L.error?' · '+esc(L.error):''}</span><button type="button" class="live-refresh" data-live-refresh>Ανανέωση</button></p>`;}
function bindLive(){host?.querySelectorAll('[data-live-refresh]').forEach(b=>b.onclick=()=>g.BettingLive?.refresh());}
function mount(target){host=target;draw();}
if(typeof window!=='undefined')window.addEventListener('betting-live',()=>{if(host&&host.isConnected&&host.querySelector('.game-grid,.empty,.hero'))draw();});
g.BettingSchedule={mount,draw,spots,nextRound,FAMILIES};
})(globalThis);
