// Mount only the requested entity after its existing profile renderer initializes.
(()=>{
  const root=document.getElementById('basket-dashboard');
  const [view,id]=location.hash.slice(1).split('/').map(decodeURIComponent);
  const player=view==='players';
  if((player&&globalThis.PlayerCard)||(!player&&globalThis.TeamCard)){
    const period=location.pathname.includes('profiles-3')?'3':location.pathname.includes('profiles-5')?'5':'season';
    root.querySelectorAll('style').forEach(style=>document.head.append(style));
    (player?PlayerCard:TeamCard).mount(root,id,period);
    document.body.style.visibility='visible';window.scrollTo(0,0);return;
  }
  const selected=root?.querySelector(player?'[data-player="'+CSS.escape(id||'')+'"][aria-pressed="true"]':'[data-team="'+CSS.escape(id||'')+'"][aria-pressed="true"]');
  const card=root?.querySelector(player?'#players-profile':'#milan-defense');
  if(!id||!selected||!card){
    if(root)root.innerHTML='<p class="profile-unavailable">This profile is unavailable in the selected sample. Close this card to return to the table.</p>';
    document.body.style.visibility='visible';return;
  }
  // Preserve the profile styles before removing the legacy dashboard shell.
  root.querySelectorAll('style').forEach(style=>document.head.append(style));
  if(player){
    card.querySelector('.position-filters').hidden=true;
    card.querySelector('.choices').hidden=true;
  }else{
    card.querySelector('[aria-label="Ομάδα"]')?.setAttribute('hidden','');
  }
  root.replaceChildren(card);
 if(!player&&globalThis.FantasyHistory){const host=document.createElement('div');card.append(host);const period=location.pathname.includes('profiles-3')?'3':location.pathname.includes('profiles-5')?'5':'season';const render=metric=>FantasyHistory.mount(host,{kind:'teams',id,period,metric});render('oppPir');const data=period==='season'?FANTASY_DATA:PERIOD_DATA[period],raw=data.raw.find(t=>t.CID===id);card.querySelectorAll('.stat').forEach(cell=>{const label=cell.querySelector('.label')?.textContent.trim();const key={'OPP eFG%':'oppEfg','DREB%':'drebPct','OPP AST / 100':'oppAssists','OPP FTA RATE':'oppFtr'}[label];if(label==='OPP AST / 100'&&raw?.DePo)cell.querySelector('.value').textContent=(100*raw.OAs/raw.DePo).toFixed(1);if(key){cell.setAttribute('role','button');cell.tabIndex=0;const open=()=>{render(key);host.scrollIntoView({block:'nearest',behavior:'smooth'})};cell.onclick=open;cell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}}});}
  root.className='entity-profile-card';
  root.setAttribute('aria-label',(player?'Player':'Team')+' profile');
  card.hidden=false;
  document.title=card.querySelector('h2')?.textContent+' · Fantasy';
  document.body.style.visibility='visible';
  window.scrollTo(0,0);
})();


