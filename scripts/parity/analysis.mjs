// Parity for the card features: player radar axes (net and gross), team opponent-production radar, expected eFG and the Efficient Scorers Venn.
// The OLD code is run in Node: fantasy-metrics.js through the harness, pieces of fantasy-workbench.js / fantasy-charts.js by evaluating their source text.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parseCsv } from '../build/csv.mjs';
import { buildViews } from '../build/views.mjs';
import { METRICS } from '../metrics/registry.mjs';
import { venn } from '../metrics/venn.mjs';
import { evaluate, byId } from '../metrics/engine.mjs';

const require = createRequire(import.meta.url);
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => parseCsv(readFileSync(join(repo, 'data', 'clean', f), 'utf8'));
const { feed } = require('./harness.cjs');
const lines = f => readFileSync(join(repo, f), 'utf8').split('\n');

// ---- new numbers ----
const clean = { players: read('player_games.csv'), teams: read('team_games.csv'), dim: read('players.csv') };
const views = buildViews(clean, { precise: true });
const ids = scope => METRICS.filter(m => m.scope === scope && !m.internal).map(m => m.id);
const cell = (w, kind, key, id) => { const v = views[w][kind].rows[key]; return v ? v.v[ids({ players: 'player', teams: 'team' }[kind]).indexOf(id)]?.value ?? null : undefined; };
const W = { season: 'season', 3: 'l3', 5: 'l5' };
// ---- old numbers ----
const { c, E } = feed();
c.FantasyLive.rebuild();
const M = c.FantasyMetrics, codeOf = Object.fromEntries(Object.entries(E.cid).map(([k, v]) => [v, k]));
const results = [];
const add = (feature, key, label, oldV, newV) => results.push({ feature, key, label, old: Number.isFinite(oldV) ? oldV : (oldV ?? null), new: Number.isFinite(newV) ? newV : (newV ?? null) });

// 1) player radar axes (old rvals evaluated from the workbench source)
{
  const src = lines('site/fantasy-workbench.js'), pick = n => src.find(l => l.startsWith(n));
  const ctx = vm.createContext({ M });
  vm.runInContext(pick('const rs={mode'), ctx);                      // RAX, RSC ...
  const rvals = vm.runInContext(`${pick('function rvals')}; rvals`, ctx);
  const keys = ['ft', '2p', '3p', 'ast', 'dreb', 'oreb', 'stlblk', 'fd'];
  for (const period of ['season', '3', '5']) for (const p of M.rows('players', period)) for (const mode of ['game', 'per100']) {
    rvals(p, mode).forEach((v, i) => {
      const suffix = mode === 'game' ? '_g' : '_100';
      add('player radar', `${period} P${p.code} ${mode}`, `rd_${keys[i]}`, v.net, cell(W[period], 'players', 'P' + p.code, `rd_${keys[i]}${suffix}`));
      add('player radar (gross)', `${period} P${p.code} ${mode}`, `rg_${keys[i]}`, v.gross, cell(W[period], 'players', 'P' + p.code, `rg_${keys[i]}${suffix}`));
    });
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

// 3) expected eFG (old zone-group formula from fantasy-charts.js evaluated unchanged)
{
  const src = lines('site/fantasy-charts.js'), a = src.findIndex(l => l.startsWith('const sub=k=>')), b = src.findIndex(l => l.startsWith('function expectedEfg'));
  const fns = new Function('Z', 'M', `${src.slice(a, b + 1).join('\n')}\nreturn {bench, expectedEfg};`)(c.ShotZones, M);
  for (const period of ['season', '3', '5']) {
    const rows = M.rows('teams', period), bench = fns.bench(rows);
    for (const t of rows.filter(t => t.shotComplete)) add('expected eFG', `${period} ${codeOf[t.CID]}`, 'o_exp_efg', fns.expectedEfg(t, bench), cell(W[period], 'teams', codeOf[t.CID], 'o_exp_efg'));
  }
}

// 4) Efficient Scorers Venn (old metric definitions for the values; the old cut-off / region rule is the one ported)
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
const RULES = [];   // named decisions that make a difference intentional; anything else stays (c)
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
