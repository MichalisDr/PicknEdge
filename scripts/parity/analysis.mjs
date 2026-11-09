// Parity for the card features (step 3.4b): radar axes, team opponent-production radar, with/without teammate, matchup (allowances, factors,
// verdict), expected eFG and the Efficient Scorers Venn. The OLD code is run in Node where it can be: fantasy-metrics.js through the harness,
// pieces of fantasy-workbench.js / fantasy-charts.js by evaluating their source text, and the Matchup code of the old player-card.js, taken
// from git history (it was removed from the live site; it is evaluated unchanged).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { parseCsv } from '../build/csv.mjs';
import { buildViews } from '../build/views.mjs';
import { METRICS } from '../metrics/registry.mjs';
import { matchup } from '../metrics/matchup.mjs';
import { withWithout } from '../metrics/samples.mjs';
import { venn } from '../metrics/venn.mjs';
import { evaluate, byId } from '../metrics/engine.mjs';

const require = createRequire(import.meta.url);
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => parseCsv(readFileSync(join(repo, 'data', 'clean', f), 'utf8'));
const { feed } = require('./harness.cjs');
const lines = f => readFileSync(join(repo, f), 'utf8').split('\n');

// ---- new numbers ----
const clean = { players: read('player_games.csv'), teams: read('team_games.csv'), dim: read('players.csv'), positions: read('position_games.csv') };
const views = buildViews(clean, { precise: true });
const ids = scope => METRICS.filter(m => m.scope === scope && !m.internal).map(m => m.id);
const cell = (w, kind, key, id) => { const v = views[w][kind].rows[key]; return v ? v.v[ids({ players: 'player', teams: 'team', positions: 'position' }[kind]).indexOf(id)]?.value ?? null : undefined; };
const W = { season: 'season', 3: 'l3', 5: 'l5' };
// The old allowances stored each game's position minutes rounded to 0.01; this variant of the views does the same, to prove the cause of the tiny factor differences.
const roundedPositions = clean.positions.map(r => ({ ...r, sec: Math.round(r.sec / 60 * 100) / 100 * 60 }));
const viewsRounded = buildViews({ ...clean, positions: roundedPositions }, { precise: true });
const cellRounded = (w, key, id) => viewsRounded[w].positions.rows[key]?.v[ids('position').indexOf(id)]?.value ?? null;

// ---- old numbers ----
const { c, E } = feed();
// The harness runs the old code without the roster endpoints, so positions are empty: give the old code the positions of players.csv (roster + manual overrides).
for (const d of clean.dim) { const info = E.info[d.player_id.slice(1)]; if (info) info.pos = d.position; }
c.FantasyLive.rebuild();
const M = c.FantasyMetrics, codeOf = Object.fromEntries(Object.entries(E.cid).map(([k, v]) => [v, k]));
const results = [];
const add = (feature, key, label, oldV, newV, alt) => results.push({ feature, key, label, old: Number.isFinite(oldV) ? oldV : (oldV ?? null), new: Number.isFinite(newV) ? newV : (newV ?? null), alt });

// 1) player radar axes (old rvals evaluated from the workbench source)
{
  const src = lines('site/fantasy-workbench.js'), pick = n => src.find(l => l.startsWith(n));
  const ctx = vm.createContext({ M });
  vm.runInContext(pick('const rs={mode'), ctx);                      // RAX, RSC ...
  const rvals = vm.runInContext(`${pick('function rvals')}; rvals`, ctx);
  const keys = ['ft', '2p', '3p', 'ast', 'dreb', 'oreb', 'stlblk', 'fd'];
  for (const period of ['season', '3', '5']) for (const p of M.rows('players', period)) for (const mode of ['game', 'per100']) {
    rvals(p, mode).forEach((v, i) => add('player radar', `${period} P${p.code} ${mode}`, `rd_${keys[i]}`, v.net, cell(W[period], 'players', 'P' + p.code, `rd_${keys[i]}${mode === 'game' ? '_g' : '_100'}`)));
  }
}

// 2) team opponent-production radar (arithmetic of the old radar(): production of the opposing PLAYERS per 100 opponent possessions)
{
  const keys = ['2p', '3p', 'ft', 'ast', 'dreb', 'oreb', 'blk', 'stl'];
  for (const period of ['season', '3', '5']) for (const t of M.rows('teams', period)) {
    const q = t.production, a = [3 * q.M2 - q.A2, 4 * q.M3 - q.A3, 2 * q.M1 - q.A1, q.As, q.DR, q.OR, q.BF, q.St];
    a.forEach((v, i) => add('team radar', `${period} ${codeOf[t.CID]}`, `rt_${keys[i]}_100`, M.div(v, q.OfPo / 100), cell(W[period], 'teams', codeOf[t.CID], `rt_${keys[i]}_100`)));
  }
}

// 3) with / without teammate (old M.withWithout vs the new row selection + engine)
{
  const played = clean.players.filter(r => r.played), rowsBy = new Map(), teamOf = new Map(), roundOf = new Map();
  for (const r of played) (rowsBy.get(r.player_id) || rowsBy.set(r.player_id, []).get(r.player_id)).push(r);
  for (const [pid, rows] of rowsBy) teamOf.set(pid, rows.slice().sort((a, b) => a.date_utc.localeCompare(b.date_utc) || a.game - b.game).at(-1).team);
  for (const t of clean.teams) (roundOf.get(t.team) || roundOf.set(t.team, new Map()).get(t.team)).set(t.game, t.round);
  const defs = M.defs('players'), pairs = [['pir', 'pir'], ['usg', 'usg'], ['pts', 'pts100'], ['min', 'min']];
  const season = M.rows('players', 'season'), idOf = Object.fromEntries(season.map(p => [p.PID, 'P' + p.code]));
  for (const p of season) {
    const mine = withWithout('P' + p.code, rowsBy, roundOf, teamOf);
    for (const [oldKey, newId] of pairs) {
      const d = defs.find(x => x.key === oldKey), old = M.withWithout(p.PID, d), m = byId(newId);
      add('with/without', `P${p.code} ${newId}`, 'mates', old.mates.length, mine.length);
      for (const om of old.mates) {
        const nm = mine.find(x => x.pid === idOf[om.pid]);
        add('with/without', `P${p.code} ${newId} ${om.pid}`, 'nWith', om.nWith, nm?.nWith); add('with/without', `P${p.code} ${newId} ${om.pid}`, 'nWithout', om.nWithout, nm?.nWithout);
        add('with/without', `P${p.code} ${newId} ${om.pid}`, 'with', om.withValue, nm ? evaluate(m, nm.withRows).value : undefined);
        add('with/without', `P${p.code} ${newId} ${om.pid}`, 'without', om.withoutValue, nm ? evaluate(m, nm.withoutRows).value : undefined);
      }
    }
  }
}

// 4) matchup: the removed old code (git history) evaluated unchanged
{
  const first = execFileSync('git', ['log', '--all', '--format=%h', '--diff-filter=D', '-1', '--', 'site/player-card.js'], { cwd: repo }).toString().trim();
  const old = execFileSync('git', ['show', `${first}^:site/player-card.js`], { cwd: repo, maxBuffer: 1 << 26 }).toString().split('\n');
  const body = old.slice(6, 34).join('\n');                           // lines 7-34: sources, allowances, factors (pure functions of FANTASY_MATCHUP)
  const verdictSrc = old.slice(43, 52).join('\n');                    // lines 44-52: the verdict (sources, main, weighted, overall)
  const ctx = { FANTASY_MATCHUP: c.FANTASY_MATCHUP, FANTASY_FIXTURES: [] };
  const fns = new Function('g', `${body}\nreturn {MK,MI,SRC,posTotals,leagueTotals,factor,pct,cls};`)(ctx);
  const startV = verdictSrc.indexOf('const src=SRC.map('), endV = verdictSrc.indexOf("overall='fav';") + "overall='fav';".length;
  const verdict = new Function('rows', 't3', 't5', 'l3', 'l5', 'fns', `const {SRC,factor,pct,cls,MI}=fns;${verdictSrc.slice(startV, endV)}\nreturn {src,main,weighted,overall};`);
  const teams = Object.keys(c.FANTASY_MATCHUP.teams);
  // allowances per team-game and position
  for (const cid of teams) c.FANTASY_MATCHUP.teams[cid].forEach((gm, i) => {
    const team = codeOf[cid], rows = clean.positions.filter(r => r.team === team).sort((a, b) => a.date_utc.localeCompare(b.date_utc) || a.game - b.game);
    for (const pos of ['G', 'F', 'C']) {
      const mine = rows.filter(r => r.pos === pos)[i]; if (!mine) continue;
      const o = gm.allow[pos], v = [mine.sec / 60, mine.m2, mine.a2, mine.m3, mine.a3, mine.m1, mine.a1, mine.oreb, mine.dreb, mine.ast, mine.stl, mine.tov, mine.blk, mine.fd, mine.pf, mine.blk_against, evaluate(byId('pir'), [{ ...mine, played: 1 }]).value];
      fns.MK.forEach((k, j) => add('matchup allowance', `${team} ${pos} g${i + 1}`, k, Math.round(o[j] * 100) / 100, Math.round(v[j] * 100) / 100));
    }
  });
  // factors per team, position and window, against the new positions views
  const F = { m2: 'mu_m2', a2: 'mu_a2', a3: 'mu_a3', a1: 'mu_a1', fd: 'mu_fd', dr: 'mu_dr', or: 'mu_or', as: 'mu_as', tv: 'mu_tv', p2: 'mu_p2', p3: 'mu_p3' };
  for (const n of [3, 5]) for (const cid of teams) for (const pos of ['G', 'F', 'C']) {
    const t = fns.posTotals(cid, pos, n), l = fns.leagueTotals(pos, n);
    for (const [k, id] of Object.entries(F)) add('matchup factor', `${codeOf[cid]} ${pos} L${n}`, id, fns.factor(k, t, l), cell('l' + n, 'positions', `${codeOf[cid]}|${pos}`, id), cellRounded('l' + n, `${codeOf[cid]}|${pos}`, id));
  }
  // verdicts: every visible player against every other team
  const H = c.FANTASY_HISTORY.players, season = M.rows('players', 'season');
  const sourceMetric = Object.fromEntries(['2P', '3P', 'FT', 'FD', 'DREB', 'OREB', 'AST', 'STL', 'TOV', 'PF'].map((k, i) => [k, ['rd_2p_g', 'rd_3p_g', 'rd_ft_g', 'fd_g', 'dreb_g', 'oreb_g', 'ast_g', 'src_stlblk_g', 'src_tov_g', 'src_pf_g'][i]]));
  for (const p of season) for (const n of [3, 5]) {
    const rows = (H[p.PID] || []).slice(-n).filter(r => r.played); if (!rows.length) continue;
    const myCid = p.CID, pos = p.Pos, id = 'P' + p.code, pv = (k) => cell('l' + n, 'players', id, sourceMetric[k]);
    for (const opp of teams.filter(t => t !== myCid)) {
      const t3 = fns.posTotals(opp, pos, 3), t5 = fns.posTotals(opp, pos, 5), l3 = fns.leagueTotals(pos, 3), l5 = fns.leagueTotals(pos, 5);
      const o = verdict(rows, t3, t5, l3, l5, fns), values = {}, factors = {};
      for (const s of fns.SRC) {
        values[s.k] = pv(s.k);
        if (s.opp) factors[s.k] = [cell('l3', 'positions', `${codeOf[opp]}|${pos}`, F[s.opp]), cell('l5', 'positions', `${codeOf[opp]}|${pos}`, F[s.opp])];
      }
      const r = matchup(values, factors), key = `P${p.code} vs ${codeOf[opp]} n${n}`;
      const altFactors = {};
      for (const s of fns.SRC) if (s.opp) altFactors[s.k] = [cellRounded('l3', `${codeOf[opp]}|${pos}`, F[s.opp]), cellRounded('l5', `${codeOf[opp]}|${pos}`, F[s.opp])];
      const ra = matchup(values, altFactors);
      add('matchup verdict', key, 'weighted', o.weighted, r.weighted, ra.weighted);
      add('matchup verdict', key, 'overall', o.overall, r.overall, ra.overall);
      add('matchup verdict', key, 'main', o.main?.k ?? 'none', r.main?.k ?? 'none', ra.main?.k ?? 'none');
    }
  }
}

// 5) expected eFG (old zone-group formula from fantasy-charts.js evaluated unchanged)
{
  const src = lines('site/fantasy-charts.js'), a = src.findIndex(l => l.startsWith('const sub=k=>')), b = src.findIndex(l => l.startsWith('function expectedEfg'));
  const fns = new Function('Z', 'M', `${src.slice(a, b + 1).join('\n')}\nreturn {bench, expectedEfg};`)(c.ShotZones, M);
  for (const period of ['season', '3', '5']) {
    const rows = M.rows('teams', period), bench = fns.bench(rows);
    for (const t of rows.filter(t => t.shotComplete)) add('expected eFG', `${period} ${codeOf[t.CID]}`, 'o_exp_efg', fns.expectedEfg(t, bench), cell(W[period], 'teams', codeOf[t.CID], 'o_exp_efg'));
  }
}

// 6) Efficient Scorers Venn (old metric definitions for the values; the old cut-off / region rule is the one ported)
{
  const defs = M.defs('players'), d = k => defs.find(x => x.key === k), E_ = c.EuroLeagueData.metrics;
  const TS = p => M.div(E_.pts(p), 2 * E_.sa(p), 100);
  for (const period of ['season', '3', '5']) {
    const rows = M.rows('players', period).filter(p => p.Gm >= 1);
    const oldItems = rows.map(p => ({ id: 'P' + p.code, values: [d('usg').get(p), d('tov').get(p), TS(p)] }));
    const newItems = rows.map(p => ({ id: 'P' + p.code, values: [cell(W[period], 'players', 'P' + p.code, 'usg'), cell(W[period], 'players', 'P' + p.code, 'tov_pct'), cell(W[period], 'players', 'P' + p.code, 'ts_pct')] }));
    const sets = [{ dir: 'high', pct: 30 }, { dir: 'low', pct: 30 }, { dir: 'high', pct: 30 }], o = venn(oldItems, sets), n = venn(newItems, sets);
    o.cuts.forEach((v, k) => add('venn', period, 'cut ' + k, v, n.cuts[k]));
    for (const [key, r] of Object.entries(o.regions)) add('venn', period, 'region ' + key, [...r.ids].sort().join(','), [...n.regions[key].ids].sort().join(','));
  }
}

// ---- classification ----
const same = (a, b) => (a === null && b === null) || a === b || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));
// Named decisions that make a difference intentional; anything else stays (c).
const RULES = [
  { decision: 'position minutes in exact seconds (the old code rounded each game to 0.01 min); the rounded variant reproduces the old numbers exactly', when: r => /^matchup/.test(r.feature) && r.alt !== undefined && same(r.old, r.alt) },
  { decision: 'eligibility is display-only: teammates below the form thresholds are included in with/without', when: r => r.feature === 'with/without' && r.label === 'mates' && r.new > r.old },
];
for (const r of results) {
  if (same(r.old, r.new)) { r.cls = 'a'; continue; }
  const rule = RULES.find(x => x.when(r));
  [r.cls, r.decision] = rule ? ['b', rule.decision] : ['c', ''];
}
const features = [...new Set(results.map(r => r.feature))];
console.log('feature'.padEnd(22), 'compared'.padStart(9), '(a) identical'.padStart(14), '(b) intended'.padStart(13), '(c) unexplained'.padStart(16));
for (const f of features) { const rs = results.filter(r => r.feature === f); console.log(f.padEnd(22), String(rs.length).padStart(9), String(rs.filter(r => r.cls === 'a').length).padStart(14), String(rs.filter(r => r.cls === 'b').length).padStart(13), String(rs.filter(r => r.cls === 'c').length).padStart(16)); }
console.log('total'.padEnd(22), String(results.length).padStart(9), String(results.filter(r => r.cls === 'a').length).padStart(14), String(results.filter(r => r.cls === 'b').length).padStart(13), String(results.filter(r => r.cls === 'c').length).padStart(16));
const groups = {};
for (const r of results.filter(r => r.cls !== 'a')) (groups[`${r.cls}|${r.decision}|${r.feature}|${r.label}`] ||= []).push(r);
for (const [k, list] of Object.entries(groups).sort((x, y) => y[1].length - x[1].length).slice(0, 40)) { const [cls, decision, feature, label] = k.split('|'), ex = list[0]; console.log(`(${cls}) ${feature} ${label}: ${list.length} diffs${decision ? ' [' + decision + ']' : ''}; e.g. ${ex.key}: old ${ex.old} new ${ex.new}`); }
mkdirSync(join(repo, '.build-tmp'), { recursive: true });
writeFileSync(join(repo, '.build-tmp', 'parity-analysis.json'), JSON.stringify(results));
