(function(g){
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defs={minutes:['Minutes','min'],points:['Points','PTS'],rebounds:['Rebounds','REB'],assists:['Assists','AST'],pir:['PIR','PIR'],netSfp:['Net SFP','SFP'],ftr:['Free throw rate','%'],efg:['Effective FG','%'],two:['2P accuracy','%'],three:['3P accuracy','%'],ft:['FT accuracy','%'],Tv:['Turnovers','TOV'],oppPoints:['Opponent points','PTS'],oppAssists:['Opponent assists','AST'],oppEfg:['Opponent eFG','%'],oppFtr:['Opponent FTr','%'],drebPct:['Defensive rebound share','%'],oppPir:['Opponent PIR','PIR'],oppTwo:['Opponent 2P accuracy','%'],oppThree:['Opponent 3P accuracy','%'],oppFt:['Opponent FT accuracy','%']};
const map={'MIN / GAME':'minutes','PTS / GAME':'points','REB / 100':'reb100','AST / 100':'ast100','PIR / GAME':'pir','NET SFP / GAME':'netSfp','FTr':'ftr','TOV%':'tovPercent','USG%':'usage'};
function series(kind,id,period){const a=g.FANTASY_HISTORY?.[kind]?.[id]||[],through=g.FANTASY_HISTORY?.throughRound||8;return period==='season'?a:a.filter(r=>r.round>through-Number(period)&&r.round<=through);}
function mount(host,{kind='players',id,period='season',metric='pir',intro='',onMetric=()=>{}}){
 if(g.FantasyTrends?.defs[metric])return g.FantasyTrends.mount(host,{kind,id,period,metric});
 const a=series(kind,id,period),player=kind==='players';
 const available=player?['minutes','points','rebounds','assists','pir','netSfp','ftr','efg','two','three','ft','Tv']:['oppPoints','oppAssists','oppPir','oppEfg','oppFtr','drebPct','oppTwo','oppThree','oppFt'];
 const missing=(player?g.FANTASY_HISTORY?.missingByPlayer:g.FANTASY_HISTORY?.missingByTeam)?.[id]||[];
 function draw(){const unsupported=!defs[metric],label=defs[metric]||['Usage','%'];const rows=a.map(r=>({...r,value:!player||r.played?r[metric]:null})),valid=rows.filter(r=>Number.isFinite(r.value));
 const lo=Math.min(0,...valid.map(r=>r.value)),hi=Math.max(1,...valid.map(r=>r.value)),span=hi-lo||1;
 const pt=(r,i)=>[52+(rows.length>1?i/(rows.length-1):.5)*620,175-(r.value-lo)/span*130];
 const segments=[];let segment=[];rows.forEach((r,i)=>{if(i&&r.round>rows[i-1].round+1){if(segment.length)segments.push(segment);segment=[];}if(Number.isFinite(r.value))segment.push(pt(r,i).join(','));else{if(segment.length)segments.push(segment);segment=[];}});if(segment.length)segments.push(segment);
 host.innerHTML=`<section class="fh-panel"><div class="fh-head"><h3>Game-by-game trend</h3><label>Statistic <select aria-label="Trend statistic">${unsupported?'<option value="usage">Usage · not verified</option>':''}${available.map(k=>`<option value="${k}" ${k===metric?'selected':''}>${defs[k][0]}</option>`).join('')}</select></label></div>${intro?`<p class="fh-note">${esc(intro)}</p>`:''}<p class="fh-note">EuroLeague · ${g.FANTASY_HISTORY?.season||''} · through Round ${g.FANTASY_HISTORY?.throughRound||7} · ${valid.length} values in this window. Summary cards: 3StepsBasket through Round ${g.FANTASY_DATA?.[player?'playerThroughRound':'teamThroughRound']||7}.</p>${unsupported?'<p class="fh-empty">Usage and on-court possessions have not yet passed comparison with 3StepsBasket. Choose another statistic to view verified boxscore history.</p>':!valid.length?'<p class="fh-empty">No recorded values in this window.</p>':`<h4>${label[0]} · ${label[1]}</h4><svg viewBox="0 0 720 220" role="img" aria-label="${esc(label[0])} by game">${[0,.5,1].map(f=>{const y=175-f*130;return `<path d="M52 ${y}H680" stroke="#344254"/><text x="42" y="${y+4}" text-anchor="end">${(lo+span*f).toFixed(1)}</text>`}).join('')}${segments.map(s=>`<polyline points="${s.join(' ')}" fill="none" stroke="#eda65f" stroke-width="2.5"/>`).join('')}${rows.map((r,i)=>{const [x,y]=pt(r,i);return `<text x="${x}" y="202" text-anchor="middle">R${r.round}</text>${Number.isFinite(r.value)?`<circle cx="${x}" cy="${y}" r="4" fill="#eda65f"><title>${esc(r.date+' · '+r.opponent+': '+r.value.toFixed(1))}</title></circle>`:''}`}).join('')}</svg>`}${missing.length?'<p class="fh-note">Coverage is incomplete: '+missing.length+' game feeds are temporarily unavailable. Missing games are not treated as zero.</p>':''}<details><summary>Game log · ${a.length} records</summary><div class="fh-scroll"><table><thead><tr><th>Round</th><th>Date / opponent</th><th>${esc(label[0])}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>R${r.round}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.date+' · '+(r.home?'vs ':'@ ')+r.opponent)}</a></td><td>${player&&!r.played?'DNP':Number.isFinite(r.value)?r.value.toFixed(1):'—'}</td></tr>`).join('')}</tbody></table></div></details></section>`;
 host.querySelector('select').value=metric;host.querySelector('select').onchange=e=>{metric=e.target.value;intro='';onMetric(metric);draw();host.querySelector('select').focus()};
 }
 draw();
}
g.FantasyHistory={mount,series,map};
})(globalThis);




