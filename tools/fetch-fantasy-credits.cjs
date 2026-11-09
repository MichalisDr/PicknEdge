/* Κατεβάζει τις τιμές (credits) από την επίσημη EuroLeague Fantasy και γράφει το site/fantasy-credits.json.
   Περιβάλλον: FANTASY_API_URL (το URL του endpoint με τους παίκτες), FANTASY_API_TOKEN (Bearer token).
   Εναλλακτικά FANTASY_API_FILE: τοπικό αρχείο με την ίδια απάντηση (χειροκίνητο export).
   Γράφει μόνο όταν αλλάζουν οι τιμές. Κωδικός εξόδου 2 = ληγμένο/άκυρο token. */
const fs=require('fs');
const OUT='site/fantasy-credits.json';
const pick=(o,keys)=>{for(const k of keys)if(o[k]!==undefined&&o[k]!==null&&o[k]!=='')return o[k];};
const list=j=>Array.isArray(j)?j:(['data','players','items','results'].map(k=>j?.[k]).find(Array.isArray)||[]);
function normalize(j){
 const rows=[];
 for(const p of list(j)){
  const price=Number(pick(p,['quotation','price','cost','credits','cr','value']));
  const first=pick(p,['firstName','first_name','name']),last=pick(p,['lastName','last_name','surname']);
  const full=pick(p,['fullName','full_name','displayName','playerName'])||[first,last].filter(Boolean).join(' ');
  if(!full||!Number.isFinite(price))continue;
  const team=pick(p,['teamCode','team_code','clubCode','teamName','team','club']);
  rows.push({name:String(full),team:team&&typeof team==='object'?String(pick(team,['code','name'])||''):String(team||''),pos:String(pick(p,['position','positionName','pos'])||''),cr:price});}
 return rows;}
async function main(){
 let json;
 if(process.env.FANTASY_API_FILE)json=JSON.parse(fs.readFileSync(process.env.FANTASY_API_FILE,'utf8'));
 else{
  const url=process.env.FANTASY_API_URL,token=process.env.FANTASY_API_TOKEN;
  if(!url||!token){console.error('Λείπουν τα FANTASY_API_URL / FANTASY_API_TOKEN.');process.exit(1);}
  /* Πίνακας με σελίδες: ζητά per_page=200 και διαβάζει σελίδες μέχρι να αδειάσουν ή να φτάσει το last_page. */
  const all=[];
  for(let page=1;page<=50;page++){
   const u=new URL(url);u.searchParams.set('page',page);u.searchParams.set('per_page','200');
   const r=await fetch(u,{headers:{Authorization:/^bearer /i.test(token)?token:'Bearer '+token,Accept:'application/json'}});
   if(r.status===401||r.status===403){console.error('Το token της Fantasy έληξε ή δεν είναι έγκυρο (HTTP '+r.status+'). Ανανέωσε το secret FANTASY_API_TOKEN.');process.exit(2);}
   if(!r.ok){console.error('HTTP '+r.status+' από το API της Fantasy.');process.exit(1);}
   const j=await r.json(),rows=list(j);
   if(!rows.length)break;
   all.push(...rows);
   const last=j?.meta?.last_page??j?.last_page;
   if((last&&page>=last)||rows.length<200)break;}
  json=all;}
 const players=normalize(json).sort((a,b)=>a.name.localeCompare(b.name));
 if(players.length<100){console.error('Ύποπτα λίγοι παίκτες ('+players.length+'). Δεν γράφω αρχείο· έλεγξε το σχήμα της απάντησης.');process.exit(1);}
 const same=(()=>{try{return JSON.stringify(JSON.parse(fs.readFileSync(OUT,'utf8')).players)===JSON.stringify(players);}catch{return false;}})();
 if(same){console.log('Καμία αλλαγή τιμών ('+players.length+' παίκτες).');return;}
 fs.writeFileSync(OUT,JSON.stringify({source:'EuroLeague Fantasy',updated:new Date().toISOString(),players},null,1)+'\n');
 console.log('Γράφτηκαν '+players.length+' τιμές.');}
main().catch(e=>{console.error(e);process.exit(1);});
