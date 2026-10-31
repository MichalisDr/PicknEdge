(function(g){
'use strict';
const KEY='picknedge-fantasy-credits-v1', SEASON='2026/27';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
const ratio=(n,d)=>Number.isFinite(n)&&Number.isFinite(d)&&d>0?n/d:null;
const empty=()=>({version:1,season:SEASON,activeRound:null,rounds:{}});
const validRound=r=>/^\d+$/.test(String(r))&&Number(r)>0&&Number(r)<=100;
const validPrice=p=>typeof p==='number'&&Number.isFinite(p)&&p>0;
const safeId=id=>typeof id==='string'&&id.length>0&&id.length<150&&!['__proto__','constructor','prototype'].includes(id);
function validate(value){
 if(!value||value.version!==1||value.season!==SEASON||!value.rounds||typeof value.rounds!=='object'||Array.isArray(value.rounds))throw Error('Το αρχείο δεν είναι αντίγραφο CR της σεζόν '+SEASON+'.');
 const clean=empty();
 for(const [r,entry] of Object.entries(value.rounds)){
  if(!validRound(r)||String(Number(r))!==r||!entry?.prices||typeof entry.prices!=='object'||Array.isArray(entry.prices))throw Error('Μη έγκυρος γύρος τιμών.');
  const prices={};for(const [id,price] of Object.entries(entry.prices)){if(!safeId(id)||!validPrice(price))throw Error('Μη έγκυρη τιμή CR.');prices[id]=price;}
  if(!Object.keys(prices).length)throw Error('Κενός γύρος τιμών.');
  clean.rounds[r]={prices};
 }
 if(value.activeRound!==null){if(!validRound(value.activeRound)||!clean.rounds[Number(value.activeRound)])throw Error('Ο επιλεγμένος γύρος δεν υπάρχει.');clean.activeRound=Number(value.activeRound);}
 return clean;
}
let state=empty(),storageError='';
function read(){try{const raw=g.localStorage.getItem(KEY);state=raw?validate(JSON.parse(raw)):empty();storageError='';}catch(e){storageError='Δεν διαβάστηκε το αποθηκευμένο αρχείο CR. Κράτησε αντίγραφο πριν δοκιμάσεις εισαγωγή.';}}
function persist(next){const clean=validate(next);if(storageError)throw Error(storageError);g.localStorage.setItem(KEY,JSON.stringify(clean));state=clean;g.dispatchEvent(new Event('fantasy-credits'));}
function mergeRound(base,round,entries){
 if(!validRound(round))throw Error('Διάλεξε γύρο τιμών από 1 έως 100.');
 if(!entries.length)throw Error('Δεν υπάρχουν τιμές για αποθήκευση.');
 const next=validate(base),prices={...(next.rounds[Number(round)]?.prices||{})},seen=new Set();
 for(const {id,price} of entries){if(!safeId(id)||!validPrice(price))throw Error('Διόρθωσε τις αντιστοιχίσεις και τις τιμές.');if(seen.has(id))throw Error('Ο ίδιος παίκτης εμφανίζεται δύο φορές.');seen.add(id);prices[id]=price;}
 next.rounds[Number(round)]={prices};next.activeRound=Number(round);return next;
}
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function parse(text,players){
 const lines=text.trim().split(/\r?\n/).filter(s=>s.trim());
 return lines.map((line,i)=>{
  const m=line.trim().match(/^(.*?)\s*[;\t]\s*([+-]?[\d.,]+)\s*$/)||line.trim().match(/^(.*?)\s+([+-]?[\d.,]+)\s*$/);
  if(!m)return {source:line,id:'',price:null,error:'Όνομα ή ID ; CR'};
  const source=m[1].trim(),price=Number(m[2].replace(',','.'));
  const matches=players.filter(p=>String(p.PID)===source||norm(p.Fn+' '+p.Sn)===norm(source)||norm(p.Sn+' '+p.Fn)===norm(source));
  return {source,id:matches.length===1?String(matches[0].PID):'',price:validPrice(price)?price:null,error:!validPrice(price)?'Το CR πρέπει να είναι θετικός αριθμός.':matches.length===1?'':matches.length>1?'Πολλαπλές αντιστοιχίσεις — διάλεξε παίκτη.':'Διάλεξε παίκτη.'};
 });
}
function totalPIR(p){return p.M1+2*p.M2+3*p.M3-(p.A1-p.M1)-(p.A2-p.M2)-(p.A3-p.M3)+p.OR+p.DR+p.As+p.St+p.BF+p.FR-p.Tv-p.FC-p.BA;}
function calculate(p,cr){const pir=totalPIR(p);return {cr:validPrice(cr)?cr:null,game:validPrice(cr)?ratio(ratio(pir,p.Gm),cr):null,minute:validPrice(cr)?ratio(ratio(pir,p.Sec/60),cr):null};}
function values(p){return calculate(p,state.rounds[state.activeRound]?.prices[p.PID]);}
const priceLabel=()=>state.activeRound?'CR γύρου '+state.activeRound:'Χωρίς επιλεγμένες τιμές CR';
function select(round){const next=validate(state);next.activeRound=Number(round);persist(next);}
function selector(){return `<label class="cr-inline">Τιμές CR <select data-cr-round aria-label="Γύρος τιμών CR"><option value="" ${state.activeRound===null?'selected':''} disabled>Επίλεξε γύρο</option>${Object.keys(state.rounds).sort((a,b)=>b-a).map(r=>`<option value="${r}" ${Number(r)===state.activeRound?'selected':''}>Γύρος ${r}</option>`).join('')}</select></label>`;}
function bindSelector(root){root.querySelectorAll('[data-cr-round]').forEach(el=>el.onchange=()=>{try{select(el.value);}catch(e){el.setCustomValidity('Η αποθήκευση απέτυχε.');el.reportValidity();}});}
function series(p,period,metric){
 if(metric==='cr'){
  const rounds=Object.keys(state.rounds).map(Number);if(!rounds.length)return [];
  return Array.from({length:Math.max(...rounds)-Math.min(...rounds)+1},(_,i)=>{const r=Math.min(...rounds)+i;return {r,y:state.rounds[r]?.prices[p.PID]??null};});
 }
 let h=(g.FANTASY_HISTORY?.players?.[p.PID]||[]);
 if(period!=='season'){
  const team=(g.FANTASY_HISTORY?.teams?.[p.CID]||[]).slice(-Number(period));
  const rounds=new Set(team.map(r=>r.round));h=h.filter(r=>rounds.has(r.round));
 }
 const cr=values(p).cr;
 return h.filter(r=>r.played).map(r=>({r:r.round,y:cr===null?null:metric==='value_min'?ratio(ratio(r.pir,r.minutes),cr):ratio(r.pir,cr)}));
}
function graph(points,label){
 const valid=points.filter(p=>Number.isFinite(p.y));if(!valid.length)return '<p class="cr-empty">Δεν υπάρχουν διαθέσιμες τιμές.</p>';
 const W=640,H=190,lo=Math.min(...valid.map(p=>p.y)),hi=Math.max(...valid.map(p=>p.y)),span=hi-lo||1,minR=Math.min(...points.map(p=>p.r)),maxR=Math.max(...points.map(p=>p.r));
 const x=r=>38+(r-minR)/(maxR-minR||1)*560,y=v=>145-(v-lo)/span*110;
 let paths=[],segment=[];for(const point of points){if(Number.isFinite(point.y)){segment.push(`${x(point.r)},${y(point.y)}`);}else if(segment.length){paths.push(segment);segment=[];}}if(segment.length)paths.push(segment);
 return `<svg class="cr-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><line x1="38" x2="598" y1="145" y2="145" stroke="#354255"/>${paths.map(a=>`<polyline points="${a.join(' ')}" fill="none" stroke="#f4a45c" stroke-width="2"/>`).join('')}${valid.map(p=>`<g><circle cx="${x(p.r)}" cy="${y(p.y)}" r="4" fill="#f4a45c"><title>R${p.r}: ${fmt(p.y,3)}</title></circle><text x="${x(p.r)}" y="${y(p.y)-10}" text-anchor="middle">${fmt(p.y)}</text><text x="${x(p.r)}" y="172" text-anchor="middle">R${p.r}</text></g>`).join('')}</svg>`;
}
function trendHTML(p,period,metric){const title=metric==='cr'?'CR · ιστορικό καταχωρισμένων τιμών':metric==='value_min'?'Value / λεπτό · ανά αγώνα':'Value / αγώνα';return `<section class="cr-trend"><h3>${title}</h3><p>${metric==='cr'?'Οι γύροι χωρίς καταχώριση δεν συμπληρώνονται.':esc(priceLabel())+' · ίδια τιμή σε όλα τα παιχνίδια του επιλεγμένου δείγματος'}</p>${graph(series(p,period,metric),title)}</section>`;}
function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='picknedge-credits-2026-27.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function mount(root){
 let preview=[],round='',message='',backup=null;
 const players=()=>g.FANTASY_DATA?.players||[];
 function draw(){
  const ps=players(),options=[...ps].sort((a,b)=>(a.Fn+' '+a.Sn).localeCompare(b.Fn+' '+b.Sn)).map(p=>`<option value="${esc(p.PID)}">${esc(p.Fn+' '+p.Sn+' · '+p.Cl)}</option>`).join('');
  root.innerHTML=`<section class="cr-page"><div class="eyebrow">FANTASY / CREDITS</div><h1>Τιμές &amp; Value</h1><p>Εισάγεις τις τιμές του γύρου μία φορά. Το Value ακολουθεί το Season / Last 3 / Last 5.</p><div class="cr-toolbar">${selector()}<button class="btn" data-export ${Object.keys(state.rounds).length?'':'disabled'}>Εξαγωγή αντιγράφου</button><label class="btn cr-file">Εισαγωγή αντιγράφου<input data-backup type="file" accept=".json,application/json"></label><a class="btn" href="#fantasy">Πίνακας παικτών ↗</a></div><p class="cr-storage">Σεζόν ${SEASON} · Οι τιμές αποθηκεύονται σε αυτόν τον browser. Χρησιμοποίησε το αντίγραφο για άλλη συσκευή.</p><p role="status" class="cr-message">${esc(storageError||message)}</p><section class="card"><h2>Εισαγωγή τιμών</h2><label>Γύρος τιμών<input data-import-round type="number" min="1" max="100" step="1" value="${esc(round)}" placeholder="π.χ. 9"></label><label>Παίκτης ή ID ; CR — μία γραμμή ανά παίκτη<textarea data-prices placeholder="Όνομα Επώνυμο ; 12,5"></textarea></label><button class="btn" data-preview>Έλεγχος αντιστοιχίσεων</button><div class="cr-preview">${preview.length?`<p>${preview.length} γραμμές · Οι υπάρχουσες τιμές αυτών των παικτών στον ίδιο γύρο θα αντικατασταθούν.</p><div class="cr-scroll"><table><thead><tr><th>Εισαγωγή</th><th>Παίκτης</th><th>CR</th></tr></thead><tbody>${preview.map((r,i)=>`<tr><td>${esc(r.source)}${r.error?`<small>${esc(r.error)}</small>`:''}</td><td><select data-match="${i}" aria-label="Παίκτης γραμμής ${i+1}"><option value="">Επίλεξε παίκτη</option>${options}</select></td><td><input data-price="${i}" aria-label="CR γραμμής ${i+1}" type="number" min="0.01" step="any" value="${r.price??''}"></td></tr>`).join('')}</tbody></table></div><button class="btn cr-primary" data-save>Αποθήκευση τιμών γύρου</button>`:''}</div></section>${backup?`<section class="card"><h2>Αντίγραφο: ${Object.keys(backup.rounds).length} γύροι</h2><p>Θα προστεθούν οι τιμές του αντιγράφου. Σε ίδιο γύρο και παίκτη υπερισχύει το αντίγραφο.</p><button class="btn cr-primary" data-restore>Εφαρμογή αντιγράφου</button><button class="btn" data-cancel>Ακύρωση</button></section>`:''}<section class="card"><h2>Αποθηκευμένοι γύροι</h2>${Object.keys(state.rounds).length?`<div class="cr-rounds">${Object.keys(state.rounds).sort((a,b)=>b-a).map(r=>`<button class="btn" data-select="${r}" aria-pressed="${Number(r)===state.activeRound}">R${r} · ${Object.keys(state.rounds[r].prices).length} παίκτες</button>`).join('')}</div><details><summary>Τιμές επιλεγμένου γύρου</summary><div class="cr-scroll"><table><thead><tr><th>Παίκτης</th><th>CR</th></tr></thead><tbody>${Object.entries(state.rounds[state.activeRound]?.prices||{}).map(([id,price])=>{const p=ps.find(p=>String(p.PID)===id);return `<tr><td>${esc(p?p.Fn+' '+p.Sn:id)}</td><td>${fmt(price,1)}</td></tr>`;}).join('')}</tbody></table></div></details>`:'<p>Δεν έχουν καταχωριστεί τιμές.</p>'}</section></section>`;
  const report=e=>{message=e.message||'Η αποθήκευση απέτυχε.';root.querySelector('[role=status]').textContent=message;};
  root.querySelector('a[href="#fantasy"]').onclick=()=>{if(g.FantasyStats){g.FantasyStats.state.entity='players';g.FantasyStats.state.view='stats';g.FantasyStats.state.col=11;g.FantasyStats.state.dir=-1;g.FantasyStats.state.position='ALL';}};
  const run=fn=>{try{fn();}catch(e){report(e);}};
  bindSelector(root);root.querySelector('[data-cr-round]').onchange=e=>run(()=>{select(e.target.value);draw();});
  root.querySelector('[data-export]').onclick=download;
  root.querySelector('[data-import-round]').oninput=e=>round=e.target.value;
  root.querySelector('[data-preview]').onclick=()=>run(()=>{if(!validRound(round))throw Error('Συμπλήρωσε πρώτα τον γύρο τιμών.');preview=parse(root.querySelector('[data-prices]').value,ps);if(!preview.length)throw Error('Πρόσθεσε τουλάχιστον μία τιμή.');message='Έλεγξε τους παίκτες και πάτησε Αποθήκευση.';draw();});
  root.querySelectorAll('[data-match]').forEach(el=>{el.value=preview[Number(el.dataset.match)].id;el.onchange=()=>{preview[Number(el.dataset.match)].id=el.value;};});
  root.querySelectorAll('[data-price]').forEach(el=>el.oninput=()=>{preview[Number(el.dataset.price)].price=Number(el.value);});
  root.querySelector('[data-save]')?.addEventListener('click',()=>run(()=>{const ids=new Set(ps.map(p=>String(p.PID)));if(preview.some(r=>!ids.has(r.id)))throw Error('Αντιστοίχισε όλες τις γραμμές σε παίκτη.');persist(mergeRound(state,round,preview));message='Αποθηκεύτηκαν '+preview.length+' τιμές για τον γύρο '+round+'.';preview=[];draw();}));
  root.querySelectorAll('[data-select]').forEach(el=>el.onclick=()=>run(()=>{select(el.dataset.select);draw();}));
  root.querySelector('[data-backup]').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2e6)throw Error('Το αρχείο είναι πολύ μεγάλο.');backup=validate(JSON.parse(await file.text()));message='Έλεγξε το αντίγραφο πριν την εφαρμογή.';draw();}catch(e){report(e);}};
  root.querySelector('[data-cancel]')?.addEventListener('click',()=>{backup=null;draw();});
  root.querySelector('[data-restore]')?.addEventListener('click',()=>run(()=>{let next=validate(state);for(const [r,e] of Object.entries(backup.rounds))next=mergeRound(next,r,Object.entries(e.prices).map(([id,price])=>({id,price})));next.activeRound=backup.activeRound??next.activeRound;persist(next);backup=null;message='Το αντίγραφο εφαρμόστηκε.';draw();}));
 }
 draw();
}
read();
g.addEventListener('storage',e=>{if(e.key===KEY||e.key===null){read();g.dispatchEvent(new Event('fantasy-credits'));}});
g.FantasyCredits={mount,values,priceLabel,selector,bindSelector,series,trendHTML,calculate,totalPIR,parse,validate,mergeRound,select,getState:()=>JSON.parse(JSON.stringify(state))};
})(globalThis);
