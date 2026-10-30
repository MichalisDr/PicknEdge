(function(g){
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const div=(n,d,k=1)=>Number.isFinite(n)&&Number.isFinite(d)&&d>0?k*n/d:null;
const fmt=(v,n=1)=>Number.isFinite(v)?v.toFixed(n):'—';
const radarValues=(p,b)=>g.FantasyViz.values(p,b);
function values(p){const pts=p.M1+2*p.M2+3*p.M3,net=pts-(p.A1-p.M1)-(p.A2-p.M2)-(p.A3-p.M3)-p.Tv,other=p.OR+p.DR+p.As+p.St+p.BF+p.FR-p.FC-p.BA;return {pts,pir:net+other,sfp:other-p.Tv,eff:div(net,p.SA+p.Tv),usage:div(p.SA+p.Tv,p.TSA+p.TTv,100),tov:div(p.Tv,p.SA+p.Tv,100),ftr:div(p.A1,p.A2+p.A3,100)};}
/* ===== MATCHUP: where the player's PIR comes from × what the opponent gives at his position ===== */
const MK=['min','m2','a2','m3','a3','m1','a1','or','dr','as','st','tv','bl','fd','pf','ba','pir'],MI=Object.fromEntries(MK.map((k,i)=>[k,i]));
// sources of a player's PIR; opp = how the opponent's allowance is measured for it (per minute of the position)
const SRC=[
 {k:'2P',name:'Δίποντα',val:r=>2*r.M2-(r.A2-r.M2),opp:'m2',show:['a2','p2'],note:''},
 {k:'3P',name:'Τρίποντα',val:r=>3*r.M3-(r.A3-r.M3),opp:'a3',show:['a3','p3'],note:'το ποσοστό του αντιπάλου στο τρίποντο έχει πολύ θόρυβο· μετράει ο όγκος'},
 {k:'FT',name:'Βολές',val:r=>r.M1-(r.A1-r.M1),opp:'a1',show:['a1'],note:'σταθερή πηγή'},
 {k:'FD',name:'Κερδισμένα φάουλ',val:r=>r.FR,opp:'fd',show:['fd'],note:'σταθερή πηγή'},
 {k:'DREB',name:'Αμυντικά ριμπάουντ',val:r=>r.DR,opp:'dr',show:['dr'],note:''},
 {k:'OREB',name:'Επιθετικά ριμπάουντ',val:r=>r.OR,opp:'or',show:['or'],note:''},
 {k:'AST',name:'Ασίστ',val:r=>r.As,opp:'as',show:['as'],note:''},
 {k:'STL',name:'Κλεψίματα + μπλοκ',val:r=>r.St+r.BF,opp:null,show:[],note:''},
 {k:'TOV',name:'Λάθη',val:r=>-r.Tv,opp:'tv',show:['tv'],note:'',neg:true},
 {k:'PF',name:'Φάουλ + μπλοκ που δέχτηκε',val:r=>-(r.FC+r.BA),opp:null,show:[],note:'',neg:true}
];
const SHOWLAB={a2:'προσπάθειες 2P',p2:'2P%',a3:'προσπάθειες 3P',p3:'3P%',a1:'βολές',fd:'κερδισμένα φάουλ',dr:'αμυντικά ριμπ.',or:'επιθετικά ριμπ.',as:'ασίστ',tv:'λάθη'};
const mxState={opp:null,win:'5'};
function teamGames(cid,n){const a=g.FANTASY_MATCHUP?.teams?.[cid]||[];return a.slice(-n);}
function posTotals(cid,pos,n){const t=MK.map(()=>0);for(const gm of teamGames(cid,n))gm.allow[pos].forEach((x,i)=>t[i]+=x);return t;}
function leagueTotals(pos,n){const t=MK.map(()=>0);for(const cid of Object.keys(g.FANTASY_MATCHUP.teams))posTotals(cid,pos,n).forEach((x,i)=>t[i]+=x);return t;}
function factor(key,t,l){if(key==='p2')return t[MI.a2]&&l[MI.a2]?(t[MI.m2]/t[MI.a2])/(l[MI.m2]/l[MI.a2]):null;if(key==='p3')return t[MI.a3]&&l[MI.a3]?(t[MI.m3]/t[MI.a3])/(l[MI.m3]/l[MI.a3]):null;
 const i=MI[key];return t[0]>0&&l[0]>0&&l[i]>0?(t[i]/t[0])/(l[i]/l[0]):null;}
function pct(key,t){const m=key==='p2'?[MI.m2,MI.a2]:[MI.m3,MI.a3];return t[m[1]]?100*t[m[0]]/t[m[1]]:null;}
function paceOf(cid,n){const gs=teamGames(cid,n);return gs.length?gs.reduce((a,x)=>a+x.po,0)/gs.length:null;}
function leaguePace(n){const ids=Object.keys(g.FANTASY_MATCHUP.teams);return ids.reduce((a,c)=>a+(paceOf(c,n)||0),0)/ids.length;}
function fixturesFor(cid){const through=g.FANTASY_MATCHUP?.through||0;return (g.FANTASY_FIXTURES||[]).filter(f=>f.round>through&&(f.home===cid||f.away===cid)).map(f=>({round:f.round,opp:f.home===cid?f.away:f.home,home:f.home===cid,turn:f.turn,date:f.date}));}
const cls=(f,neg)=>!Number.isFinite(f)?'na':neg?(f>=1.08?'cut':f<=0.92?'give':'neu'):(f>=1.08?'give':f<=0.92?'cut':'neu');
const CLS={give:['ΔΙΝΕΙ','#7fc6ac'],neu:['ΟΥΔΕΤΕΡΟ','#b8c6d7'],cut:['ΚΟΒΕΙ','#e7919b'],na:['—','#6e839b']};
function matchupHtml(p,data,esc2){
 if(!g.FANTASY_MATCHUP)return '<p class="pc-empty">Φορτώνω τα δεδομένα αντιπάλων…</p>';
 const teamsAll=g.FANTASY_DATA.teams,nameOf=id=>teamsAll.find(t=>t.id===id)?.label||id;
 const next=fixturesFor(p.CID);if(!mxState.opp||mxState.opp===p.CID)mxState.opp=next[0]?.opp||teamsAll.find(t=>t.id!==p.CID).id;
 const opp=mxState.opp,pos=p.Pos,fx=next.find(f=>f.opp===opp);
 const H=g.FANTASY_HISTORY,hist=(H?.players?.[p.PID]||[]).filter(r=>r.played),n=Number(mxState.win),rows=hist.slice(-n);
 const sel=`<div class="mu-controls"><label>Αντίπαλος <select data-mu="opp" aria-label="Αντίπαλος">${next.length?`<optgroup label="Επόμενοι αγώνες">${next.map(f=>`<option value="${f.opp}" ${f.opp===opp?'selected':''}>${esc2(`R${f.round} · T${f.turn} · ${nameOf(f.opp)} (${f.home?'εντός':'εκτός'})`)}</option>`).join('')}</optgroup>`:''}<optgroup label="Όλες οι ομάδες">${teamsAll.filter(t=>t.id!==p.CID).map(t=>`<option value="${t.id}" ${t.id===opp&&!fx?'selected':''}>${esc2(t.label)}</option>`).join('')}</optgroup></select></label><div role="group" aria-label="Δείγμα παίκτη"><button data-mu="win" data-v="3" aria-pressed="${mxState.win==='3'}">Παίκτης: τελ. 3</button><button data-mu="win" data-v="5" aria-pressed="${mxState.win==='5'}">Παίκτης: τελ. 5</button></div></div>`;
 if(!rows.length)return sel+'<p class="pc-empty">Δεν υπάρχουν πρόσφατοι αγώνες για τον παίκτη.</p>';
 const t3=posTotals(opp,pos,3),t5=posTotals(opp,pos,5),l3=leagueTotals(pos,3),l5=leagueTotals(pos,5);
 const src=SRC.map(s=>{const v=rows.reduce((a,r)=>a+s.val(r),0)/rows.length;const f3=s.opp?factor(s.opp,t3,l3):null,f5=s.opp?factor(s.opp,t5,l5):null;const f=Number.isFinite(f3)&&Number.isFinite(f5)?(f3+f5)/2:(f3??f5);
  const shows=s.show.map(k=>({k,f3:factor(k,t3,l3),f5:factor(k,t5,l5),p3:k[0]==='p'?pct(k,t3):null,p5:k[0]==='p'?pct(k,t5):null,lp3:k[0]==='p'?pct(k,l3):null,lp5:k[0]==='p'?pct(k,l5):null}));
  return {...s,v,f3,f5,f,c:cls(f,s.neg),shows};});
 const posTotal=src.filter(s=>s.v>0).reduce((a,s)=>a+s.v,0)||1,pirAvg=rows.reduce((a,r)=>a+r.pir,0)/rows.length;
 src.forEach(s=>s.share=s.v>0?s.v/posTotal:0);
 const main=src.filter(s=>s.opp&&s.v>0).sort((a,b)=>b.v-a.v)[0];
 const weighted=src.reduce((a,s)=>a+(Number.isFinite(s.f)?(s.neg?-(s.f-1)*Math.abs(s.v)/posTotal:s.share*(s.f-1)):0),0);
 let overall=weighted>=.04?'fav':weighted<=-.04?'neg':'neu';
 if(main&&main.c==='cut'&&weighted<.05)overall='neg';if(main&&main.c==='give'&&weighted>-.05)overall='fav';
 const V={fav:['ΘΕΤΙΚΟ','#7fc6ac'],neu:['ΟΥΔΕΤΕΡΟ','#b8c6d7'],neg:['ΑΡΝΗΤΙΚΟ','#e7919b']}[overall];
 const mainTxt=main?`Κύρια πηγή: <b>${main.name}</b> (${Math.round(100*main.share)}% του θετικού PIR του) · ο αντίπαλος ${main.c==='give'?'<b style="color:#7fc6ac">τη δίνει</b>':main.c==='cut'?'<b style="color:#e7919b">την κόβει</b>':'είναι <b>ουδέτερος</b> σε αυτήν'}${main.note==='σταθερή πηγή'?' · σταθερή πηγή, δίνει πάτωμα':''}`:'';
 const f2=x=>Number.isFinite(x)?'×'+x.toFixed(2):'—',f1=x=>Number.isFinite(x)?x.toFixed(1):'—';
 const maxAbs=Math.max(1,...src.map(s=>Math.abs(s.v)));
 const srcRows=src.filter(s=>Math.abs(s.v)>=.2||s===main).sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).map(s=>{const [cl,cc]=CLS[s.c];
  const det=s.shows.map(x=>x.k[0]==='p'?`${SHOWLAB[x.k]} ${f1(x.p3)}% / ${f1(x.p5)}% (λίγκα ${f1(x.lp5)}%)`:`${SHOWLAB[x.k]} ${f2(x.f3)} / ${f2(x.f5)}`).join(' · ');
  return `<div class="mu-src${s===main?' main':''}" data-c="${s.c}"><div class="mu-src-head"><span class="mu-src-name">${s.name}${s===main?' <em>κύρια πηγή</em>':''}</span><span class="mu-src-val">${s.v>=0?'+':''}${f1(s.v)} <small>PIR/αγ.${s.v>0?' · '+Math.round(100*s.share)+'%':''}</small></span>${s.opp?`<b class="mu-verdict" style="color:${cc};border-color:${cc}">${cl}</b>`:'<b class="mu-verdict na">—</b>'}</div><div class="mu-src-bar"><i style="width:${(100*Math.abs(s.v)/maxAbs).toFixed(0)}%;background:${s.v<0?'#e7919b55':'#eda65f88'}"></i></div>${s.opp?`<p class="mu-note">${esc2(nameOf(opp))} σε ${pos} (τελ. 3 / τελ. 5, ανά λεπτό θέσης έναντι λίγκας): ${det}${s.note?' · <i>'+s.note+'</i>':''}</p>`:`<p class="mu-note">Δεν εξαρτάται άμεσα από τον αντίπαλο.</p>`}</div>`;}).join('');
 const myPace3=paceOf(p.CID,3),myPace5=paceOf(p.CID,5),op3=paceOf(opp,3),op5=paceOf(opp,5),lp3=leaguePace(3),lp5=leaguePace(5);
 const mins=rows.map(r=>Math.round(r.minutes));
 return `${sel}<section class="mu-summary" data-v="${overall}"><div><h3>${esc2(p.Fn+' '+p.Sn)} (${pos}) · ${fx?`R${fx.round} · T${fx.turn} · ${fx.home?'εντός':'εκτός'} · `:''}vs ${esc2(nameOf(opp))}</h3><p class="mu-big" style="color:${V[1]}">${V[0]}</p><p class="mu-main">${mainTxt}</p></div><div class="mu-ctx"><div><span>PIR τελ. ${rows.length}</span><strong>${f1(pirAvg)}</strong><small>${rows.map(r=>r.pir).join(', ')}</small></div><div><span>Λεπτά</span><strong>${f1(rows.reduce((a,r)=>a+r.minutes,0)/rows.length)}′</strong><small>${mins.join(', ')}</small></div><div><span>Ρυθμός (κατοχές/αγ.)</span><strong>${f1(op5)}</strong><small>${esc2(nameOf(opp))} τελ.3 ${f1(op3)} · ${esc2(nameOf(p.CID))} ${f1(myPace5)} · λίγκα ${f1(lp5)}</small></div></div></section>
 <section class="mu-group"><h3>ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ ΤΟ PIR ΤΟΥ · ΤΙ ΚΑΝΕΙ Ο ΑΝΤΙΠΑΛΟΣ ΣΕ ΑΥΤΟ</h3>${srcRows}</section>
 <p class="pc-note">Παίκτης: μέσος όρος ανά αγώνα στους τελευταίους ${rows.length} αγώνες του (καθαρό: εύστοχα − άστοχα). Αντίπαλος: τι έδωσε σε ${pos} (ετικέτες θέσεων EuroLeague) στους τελευταίους 3 και 5 αγώνες του, ανά λεπτό της θέσης, σε σχέση με όλη τη λίγκα στο ίδιο διάστημα. ΔΙΝΕΙ ≥ ×1.08 · ΚΟΒΕΙ ≤ ×0.92 (μέσος όρος τελ. 3 και 5). Η ετυμηγορία ακολουθεί την κύρια πηγή του παίκτη· αν δεν την αγγίζει ο αντίπαλος, μετράει το ζυγισμένο σύνολο. Δεδομένα έως Γύρο ${g.FANTASY_MATCHUP.through}.</p>`;
}
function ensureMatchupData(cb){if(g.FANTASY_MATCHUP||ensureMatchupData.loading)return;ensureMatchupData.loading=true;const s=document.createElement('script');s.src='fantasy-matchup-data.js?v='+(g.FANTASY_ASSET_VERSION||'20261029-matchup2');s.onload=cb;document.head.append(s);}
function roleHtml(p,v,id,period){
 const H=g.FANTASY_HISTORY,through=H?.throughRound||8,all=(H?.players?.[id]||[]).filter(r=>r.played&&Number.isFinite(r.minutes));
 const rows=period==='season'?all:all.filter(r=>r.round>through-Number(period));
 if(!rows.length)return '';
 const n=rows.length,avg=k=>rows.reduce((a,r)=>a+(r[k]||0),0)/n,min=avg('minutes'),pir=avg('pir'),mins=rows.map(r=>r.minutes),sd=Math.sqrt(rows.reduce((a,r)=>a+(r.pir-pir)**2,0)/n);
 const last3=all.slice(-3),l3=last3.reduce((a,r)=>a+r.pir,0)/(last3.length||1),all_pir=all.reduce((a,r)=>a+r.pir,0)/all.length;
 const poss=(p.OfPo+p.DePo)/2,pir100=poss>0?100*v.pir/poss:null,bigMin=Math.max(40,...mins);
 const list=rows.slice(-8).reverse().map(r=>`<tr><td>R${r.round}</td><td>${r.home?'vs':'@'} ${esc(String(r.opponent||'').replace(/^FC /i,'').slice(0,16))}</td><td><span class="rl-bar" style="--w:${(100*r.minutes/bigMin).toFixed(0)}%"></span>${fmt(r.minutes,0)}′</td><td>${r.points}</td><td><span class="rl-bar pir ${r.pir<pir-sd?'low':r.pir>pir+sd?'high':''}" style="--w:${Math.max(0,Math.min(100,100*r.pir/40)).toFixed(0)}%"></span>${r.pir}</td><td>${fmt(r.pir/Math.max(r.minutes,1),2)}</td></tr>`).join('');
 return `<section class="pc-role"><div class="pc-section-head"><h3>ΛΕΠΤΑ &amp; ΡΟΛΟΣ</h3></div><div class="rl-sum"><div><span>MIN μ.ό.</span><strong>${fmt(min)}</strong><small>εύρος ${fmt(Math.min(...mins),0)}–${fmt(Math.max(...mins),0)}</small></div><div><span>PIR μ.ό.</span><strong>${fmt(pir)}</strong><small>±${fmt(sd)} (τυπ. απόκλιση)</small></div><div><span>PIR / MIN</span><strong>${fmt(pir/Math.max(min,1),2)}</strong><small>ανά λεπτό</small></div><div><span>PIR / 100</span><strong>${fmt(pir100)}</strong><small>ανά 100 κατοχές</small></div><div><span>ΤΕΛ. 3 PIR</span><strong>${fmt(l3)}</strong><small class="${l3>all_pir+1?'up':l3<all_pir-1?'down':''}">${l3-all_pir>=0?'+':''}${fmt(l3-all_pir)} vs σεζόν</small></div></div><table class="rl-table"><thead><tr><th>Γύρος</th><th>Αγώνας</th><th>Λεπτά</th><th>PTS</th><th>PIR</th><th>PIR/λ</th></tr></thead><tbody>${list}</tbody></table><p class="pc-note">Μόνο αγώνες με συμμετοχή· χρώμα PIR: πάνω/κάτω από 1 τυπ. απόκλιση από τον μέσο όρο του δείγματος.</p></section>`;
}
function mount(root,id,initialPeriod){
 let period=initialPeriod,tab='profile',basis='game',mode='fg',trend=null;
 const original=g.FANTASY_DATA.players.find(p=>p.PID===id);if(!original)return;
 root.className='entity-profile-card';root.setAttribute('aria-label','Player profile');
 function draw(){
 const data=period==='season'?g.FANTASY_DATA:g.FANTASY_PERIOD_DATA[period],p=data.players.find(p=>p.PID===id)||{...original,noSample:true,Gm:0},v=values(p),pg=n=>fmt(div(n,p.Gm)),per=n=>fmt(div(n,p.OfPo+p.DePo,200));
 p.rateRanks=[];
 const metric=(label,value,tip)=>`<div class="pc-metric"><button type="button" aria-label="${esc(label+': '+value+'. '+tip)}" aria-expanded="false"><span>${label}</span><strong>${value}</strong><i aria-hidden="true">ⓘ</i></button><div class="pc-tip" role="tooltip" hidden>${esc(tip)}</div></div>`;
 const group=(title,cells)=>`<section class="pc-group"><h3>${title}</h3><div class="pc-metrics" style="--n:${cells.length}">${cells.join('')}</div></section>`;
 if(tab==='matchup'&&!g.FANTASY_MATCHUP)ensureMatchupData(draw);
 const tabs=[['profile','Profile'],['shooting','Shooting'],['matchup','Matchup']];
 root.innerHTML=`<article class="player-card"><header class="pc-identity"><img src="${esc(original.logo||data.teams.find(t=>t.id===p.CID)?.logo)}" alt="${esc(p.Cl)}"><div><h2>${esc(p.Fn+' '+p.Sn)}</h2><p>${esc(p.Cl)} · ${esc(p.Pos)}</p></div><span class="pc-gp"><b>${p.Gm}</b> GP</span></header><div class="pc-controls"><div role="group" aria-label="Player card period">${['season','3','5'].map(k=>`<button data-period="${k}" aria-pressed="${period===k}">${k==='season'?'Season':'Last '+k}</button>`).join('')}</div><span>${period==='season'?'Round '+(data.playerThroughRound||7)+' totals':'Rounds '+data.fromRound+'–'+data.toRound+' · actual appearances'}</span></div><nav class="pc-tabs" role="tablist" aria-label="Player card views">${tabs.map(([k,l])=>`<button role="tab" data-tab="${k}" aria-selected="${tab===k}" aria-controls="pc-panel">${l}</button>`).join('')}</nav><section id="pc-panel" role="tabpanel" aria-label="${tabs.find(t=>t[0]===tab)[1]}">${tab==='matchup'?matchupHtml(p,data,esc):p.noSample?'<p class="pc-empty">No recorded appearances in this sample. Choose another period.</p>':tab==='profile'?`<div class="pc-summary">${group('TIME & ROLE',[
 metric('MIN / GAME',pg(p.Sec/60),'Average playing time per recorded appearance.'),
 metric('USG%',fmt(v.usage)+'%','(shot actions + turnovers) / team equivalents while on court.'),
 metric('TOV%',fmt(v.tov)+'%','Turnovers / (shot actions + turnovers). Turnovers/game: '+pg(p.Tv)),
 metric('FTr',fmt(v.ftr)+'%','FTA / FGA. Free-throw attempts/game: '+pg(p.A1)+' · Field-goal attempts/game: '+pg(p.A2+p.A3))
 ])}${group('PRODUCTION',[
 metric('PTS / GAME',pg(v.pts),'Points per recorded appearance.'),
 metric('PTS / 100',fmt(div(v.pts,p.OfPo,100)),'Points per 100 team offensive possessions while on court.'),
 metric('REB / 100',per(p.OR+p.DR),'OREB/100: '+fmt(div(p.OR,p.OfPo,100))+' · DREB/100: '+fmt(div(p.DR,p.DePo,100))+' · Rebounds/game: '+pg(p.OR+p.DR)),
 metric('AST / 100',fmt(div(p.As,p.OfPo,100)),'Assists/game: '+pg(p.As)+'. Per 100 uses offensive possessions while on court.')
 ])}${group('FANTASY',[
 metric('PIR / GAME',pg(v.pir),'PIR/minute: '+fmt(div(v.pir,p.Sec/60),3)+'. PIR is not Fantasy points.'),
 metric('NET PIR / USAGE',fmt(v.eff,3),'Net PIR per used possession: (points − missed FG − missed FT − turnovers) ÷ (shot actions + turnovers). Usage: '+fmt(v.usage)+'%.'),
 metric('NET SFP / GAME',pg(v.sfp),'Net SFP/minute: '+fmt(div(v.sfp,p.Sec/60),3)+'. REB + AST + STL + BLK + fouls drawn − fouls committed − blocks received − turnovers.')
 ])}</div><section class="pc-radar"><div class="pc-section-head"><h3>PRODUCTION RADAR</h3><div role="group" aria-label="Radar basis"><button data-basis="game" aria-pressed="${basis==='game'}">Per game</button><button data-basis="poss" aria-pressed="${basis==='poss'}">Per 100 poss</button></div></div>${g.FantasyViz.radar(p,data.players,basis)}<p class="pc-note">Net PIR contributions · missed shots are deducted.</p></section>${roleHtml(p,v,id,period)}`:g.FantasyViz.shooting(p,mode,null,data.teams)}</section></article>`;
 root.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;draw();root.querySelector('[data-period="'+period+'"]').focus()});
 root.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>{tab=b.dataset.tab;trend=null;draw();root.querySelector('[data-tab="'+tab+'"]').focus()};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const T=tabs.map(t=>t[0]);tab=T[(T.indexOf(tab)+(e.key==='ArrowRight'?1:T.length-1))%T.length];trend=null;draw();root.querySelector('[data-tab="'+tab+'"]').focus()}}});
 root.querySelectorAll('[data-mu]').forEach(el=>{if(el.tagName==='SELECT')el.onchange=()=>{mxState.opp=el.value;draw();};else el.onclick=()=>{mxState[el.dataset.mu]=el.dataset.v;draw();root.querySelector('[data-mu="'+el.dataset.mu+'"][data-v="'+el.dataset.v+'"]')?.focus()};});
 root.querySelectorAll('[data-basis]').forEach(b=>b.onclick=()=>{basis=b.dataset.basis;draw();root.querySelector('[data-basis="'+basis+'"]').focus()});
 root.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;draw();root.querySelector('[data-mode="'+mode+'"]').focus()});
 root.querySelectorAll('.pc-metric').forEach((cell,i)=>{const b=cell.querySelector('button'),t=cell.querySelector('.pc-tip');t.id='pc-tip-'+i;b.setAttribute('aria-describedby',t.id);let pinned=false;const show=()=>{t.hidden=false;b.setAttribute('aria-expanded','true')},hide=()=>{t.hidden=true;b.setAttribute('aria-expanded','false')};b.onmouseenter=show;b.onmouseleave=()=>{if(!pinned)hide()};b.onfocus=show;b.onblur=()=>{pinned=false;hide()};b.onclick=()=>{pinned=!pinned;pinned?show():hide()};b.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();pinned=false;hide()}}});
 root.querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>{root.querySelector('.pc-radar-detail').textContent=b.getAttribute('aria-label')});
 root.querySelectorAll('[data-zone]').forEach(b=>{b.onclick=()=>{root.querySelector('.pc-shot-detail').textContent=b.getAttribute('aria-label')};b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click()}}});
 if(trend&&!p.noSample&&g.FantasyHistory){const panel=document.createElement('div');const radar=root.querySelector('.pc-radar');if(radar)radar.replaceWith(panel);else{root.querySelector('.pc-court')?.setAttribute('hidden','');root.querySelector('.hex-zone-key')?.setAttribute('hidden','');root.querySelector('#pc-panel').append(panel);}g.FantasyHistory.mount(panel,{id,period,metric:trend.metric,intro:trend.intro,onMetric:metric=>{trend={metric,intro:''};draw()}});}
 root.querySelectorAll('.pc-metric button').forEach(b=>{const name=b.querySelector('span').textContent;const key=g.FantasyHistory?.map[name];if(!key)return;b.setAttribute('aria-pressed',String(trend?.metric===key));b.onclick=()=>{trend=trend?.metric===key?null:{metric:key,intro:name.includes('/ 100')?'Game history shows actual '+(key==='assists'?'assists':'rebounds')+' per appearance. On-court possession rates remain unverified.':name==='TOV%'?'Game history shows turnover counts. TOV% needs verified scoring-attempt counts.':''};draw();root.querySelector('.fh-panel')?.scrollIntoView({block:'nearest',behavior:'smooth'});};});
 root.querySelectorAll('.pc-shoot-rates>div').forEach((b,i)=>{b.setAttribute('role','button');b.setAttribute('aria-pressed',String(trend?.metric===['efg','two','three','ft'][i]));b.tabIndex=0;const select=()=>{const key=['efg','two','three','ft'][i];trend=trend?.metric===key?null:{metric:key,intro:''};draw();root.querySelector('.fh-panel')?.scrollIntoView({block:'nearest',behavior:'smooth'});};b.onclick=select;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}};});
 document.title=p.Fn+' '+p.Sn+' · Fantasy';
 }
 draw();
}
g.PlayerCard={mount,values,radarValues,shooting:(p,v,mode)=>g.FantasyViz.shooting(p,mode)};
})(globalThis);
