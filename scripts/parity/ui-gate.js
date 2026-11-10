// Browser side of the Phase 3 UI gate. Served for the run as /_gate/ui-gate.js (copied to site/_gate, git-ignored) and loaded with
//   const { run } = await import('/_gate/ui-gate.js'); await run('fantasy-players')
// It opens windows and sides on the CURRENT page, reads the displayed cells and compares them with the OLD numbers in /_gate/ui-expected.json
// rounded as metrics.json says. Returns {checked, matched, mismatches[], notDisplayed[]}.
const wait = ms => new Promise(r => setTimeout(r, ms));
const BET = {
  offense: ['pace', 'ortg', 't_efg', 't_fg2_pct', 't_fg3_pct', 't_a3_rate', 't_ftr', 't_oreb_pct', 't_tov100', 't_ast100', 'o_blk_pct', 'o_stl100'],
  defense: ['pace', 'drtg', 'o_efg', 'o_fg2_pct', 'o_fg3_pct', 'o_a3_rate', 'o_ftr', 't_dreb_pct', 'o_tov100', 'o_ast100', 't_blk_pct', 't_stl100'],
};
const number = t => { const m = String(t).match(/-?\d+(\.\d+)?/); return m ? m[0] : null; };

async function compare(expected, rows, columns, exp, where, out) {
  for (const e of expected) {
    const row = rows.get(e.name);
    if (!row) { out.notDisplayed.push(`${where}: ${e.name}`); continue; }
    columns.forEach((id, i) => {
      if (e.v[id] === undefined || e.v[id] === null) return;
      const want = Number(e.v[id]).toFixed(exp.digits[id]), got = number(row[i]);
      out.checked++;
      if (got === want) out.matched++; else out.mismatches.push(`${where}: ${e.name} ${id} shows ${row[i]}, expected ${want}`);
    });
  }
}

export async function run(page) {
  const exp = await (await fetch('/_gate/ui-expected.json')).json(), out = { page, checked: 0, matched: 0, mismatches: [], notDisplayed: [] };
  const click = async sel => { const b = document.querySelector(sel); if (!b) throw new Error('missing ' + sel); b.click(); await wait(900); };
  if (page === 'fantasy-players' || page === 'fantasy-teams') {
    const teams = page === 'fantasy-teams', ids = FantasyTables.COLUMNS[teams ? 'teams' : 'players'].profile;
    for (const w of ['season', 'l5', 'l3']) {
      await click(`[data-window=${w}]`);
      if (!teams) { await click('[data-filters]'); const all = document.querySelector('[data-filter=showAll]'); if (!all.checked) { all.click(); await wait(700); } await click('[data-filters]'); }   // show everyone: eligibility is display-only
      const rows = new Map();
      document.querySelectorAll('.fw-table-wrap tbody tr').forEach(tr => { const n = tr.querySelector('.fw-name')?.textContent; if (n) rows.set(n, [...tr.querySelectorAll('td')].slice(1).map(td => td.textContent)); });
      await compare(exp[teams ? 'teams' : 'players'][w], rows, ids, exp, `${page} ${w}`, out);
    }
  } else if (page === 'cards') {
    // Smoke test: every card view of a player and of a team must draw without an error message.
    for (const kind of ['players', 'teams']) {
      location.hash = kind === 'teams' ? '#fantasy' : '#fantasy/players'; await wait(1200);
      document.querySelector('.fw-name[data-open]').click(); await wait(2200);
      const steps = kind === 'teams' ? ['profile', 'shooting'] : ['profile', 'shooting'];
      for (const v of steps) {
        document.querySelector(`[data-card-view=${v}]`)?.click(); await wait(v === 'shooting' ? 3000 : 1200);
        out.checked++;
        const txt = document.querySelector('.fw-card')?.innerText || '';
        if (!/Could not/.test(txt) && document.querySelector('.fw-visual')) out.matched++; else out.mismatches.push(`card ${kind} ${v}: ${txt.slice(0, 80)}`);
      }
      document.querySelector('.fw-close')?.click(); await wait(300);
    }
  } else if (page === 'betting-teams') {
    for (const side of ['offense', 'defense']) {
      await click(`[data-side=${side}]`);
      for (const w of ['season', 'l10', 'l5', 'l3']) {
        await click(`[data-window=${w}]`);
        const rows = new Map();
        document.querySelectorAll('.teams-table tbody tr:not(.league-average)').forEach(tr => { const th = tr.querySelector('th'); const n = [...th.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join('').trim(); rows.set(n, [...tr.querySelectorAll('.stat-cell .v')].map(v => v.textContent)); });
        await compare(exp.bettingTeams[side][w], rows, BET[side], exp, `betting ${side} ${w}`, out);
      }
    }
  }
  return out;
}
