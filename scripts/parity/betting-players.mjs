// Old vs new Betting-player values (no parity expected: definitions changed on purpose).
// Usage: node scripts/parity/betting-players.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../build/csv.mjs';
import { buildViews } from '../build/views.mjs';
import { METRICS } from '../metrics/registry.mjs';

const require = createRequire(import.meta.url), repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => parseCsv(readFileSync(join(repo, 'data', 'clean', f), 'utf8'));
const clean = { players: read('player_games.csv'), teams: read('team_games.csv'), dim: read('players.csv') };
const views = buildViews(clean, { precise: true }).season.players.rows;
const ids = METRICS.filter(m => m.scope === 'player').map(m => m.id);
const nv = (pid, id) => views['P' + pid]?.v[ids.indexOf(id)]?.value ?? null;

const { feed } = require('./harness.cjs');
const { c } = feed();
const BP = c.BettingPlayers, p100 = (o, k) => { const n = (o.po + o.dpo) / 2; return n > 0 ? 100 * o[k] / n : null; };

// [label, old value from betting-players.js, new metric id]
const PAIRS = [
  ['USG%', o => o.usg, 'usg'], ['TOV%', o => o.tovp, 'tov_pct'], ['TS%', o => o.ts, 'ts_pct'], ['eFG%', o => o.efg, 'efg'], ['AST%', o => o.astp, 'ast_pct'],
  ['OREB%', o => o.orp, 'oreb_pct'], ['DREB%', o => o.drp, 'dreb_pct'], ['STL% / STL100', o => o.stlp, 'stl100'], ['BLK%', o => o.blkp, 'blk_pct'],
  ['3PA/FGA', o => o.p3r, 'a3_rate'], ['FTr', o => o.ftr, 'ftr'], ['2FG%', o => o.p2, 'fg2_pct'], ['3FG%', o => o.p3, 'fg3_pct'], ['FT%', o => o.ft, 'ft_pct'],
  ['MIN', o => o.min, 'min'],
  ['PTS/100', o => p100(o, 'pts'), 'pts100'], ['REB/100', o => p100(o, 'reb'), 'reb100'], ['OREB/100', o => p100(o, 'OR'), 'oreb100'], ['DREB/100', o => p100(o, 'DR'), 'dreb100'],
  ['AST/100', o => p100(o, 'As'), 'ast100'], ['3PM/100', o => p100(o, 'M3'), 'm3_100'], ['3PA/100', o => p100(o, 'A3'), 'a3_100'], ['FTA/100', o => p100(o, 'A1'), 'a1_100'],
  ['STL/100', o => p100(o, 'St'), 'stl100'], ['BLK/100', o => p100(o, 'Bl'), 'blk100'], ['TOV/100', o => p100(o, 'Tv'), 'tov100'], ['FD/100', o => p100(o, 'FD'), 'fd100'], ['PF/100', o => p100(o, 'PF'), 'pf100'],
];
const players = Object.keys(BP.data().player).map(pid => ({ pid, o: BP.stats(pid, 'season') })).filter(x => x.o.gp > 0 && views['P' + x.pid]);
players.sort((a, b) => b.o.sec - a.o.sec);
const name = pid => (BP.fullName ? BP.fullName(c.EuroLeagueData.info[pid]?.name || pid) : pid);

console.log('TOP 15 BY MINUTES (season): old -> new');
const SHOW = ['USG%', 'TOV%', 'TS%', 'AST%', 'OREB%', 'DREB%', 'BLK%', 'PTS/100', 'STL/100'];
console.log(['player', 'MIN', ...SHOW].join(' | '));
for (const { pid, o } of players.slice(0, 15)) {
  const cells = SHOW.map(l => { const [, f, id] = PAIRS.find(p => p[0] === l); const a = f(o), b = nv(pid, id); return Number.isFinite(a) && Number.isFinite(b) ? `${a.toFixed(1)}→${b.toFixed(1)}` : '—'; });
  console.log([name(pid), (o.sec / 60 / o.gp).toFixed(1), ...cells].join(' | '));
}
console.log('\nDIFFERENCE BY METRIC (all players with >= 150 minutes; new minus old)');
console.log('metric | n | mean diff | mean |diff| | max |diff| (player) | mean |diff| as % of old');
for (const [label, f, id] of PAIRS) {
  const rows = players.filter(x => x.o.sec >= 150 * 60).map(x => ({ pid: x.pid, a: f(x.o), b: nv(x.pid, id) })).filter(x => Number.isFinite(x.a) && Number.isFinite(x.b));
  const d = rows.map(x => x.b - x.a), abs = d.map(Math.abs), mean = v => v.reduce((s, x) => s + x, 0) / v.length;
  const mx = rows.reduce((m, x) => Math.abs(x.b - x.a) > Math.abs(m.b - m.a) ? x : m, rows[0]);
  const rel = mean(rows.map(x => x.a ? Math.abs(x.b - x.a) / Math.abs(x.a) * 100 : 0));
  console.log(`${label} | ${rows.length} | ${mean(d).toFixed(2)} | ${mean(abs).toFixed(2)} | ${Math.max(...abs).toFixed(2)} (${name(mx.pid)}: ${mx.a.toFixed(1)}→${mx.b.toFixed(1)}) | ${rel.toFixed(1)}%`);
}
