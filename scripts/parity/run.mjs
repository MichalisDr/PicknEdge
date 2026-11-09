// Parity gate: CURRENT site metric code (run in Node on the same 100 games) vs the new registry.
// Every compared (entity, window, metric) is classed (a) identical, (b) intentional change (named decision), (c) unexplained.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../build/csv.mjs';
import { buildViews } from '../build/views.mjs';
import { METRICS } from '../metrics/registry.mjs';

const require = createRequire(import.meta.url);
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => parseCsv(readFileSync(join(repo, 'data', 'clean', f), 'utf8'));
const { feed } = require('./harness.cjs');

// ---- new numbers (full precision) ----
const clean = { players: read('player_games.csv'), teams: read('team_games.csv'), dim: read('players.csv') };
const views = buildViews(clean, { precise: true });
const ids = scope => METRICS.filter(m => m.scope === scope).map(m => m.id);
const newVal = (scope, w, key, id) => { const v = views[w][scope === 'player' ? 'players' : 'teams'].rows[key]; return v ? v.v[ids(scope).indexOf(id)] : undefined; };

// ---- old numbers ----
const { c, E } = feed();
c.FantasyLive.rebuild();
const M = c.FantasyMetrics, codeOf = Object.fromEntries(Object.entries(E.cid).map(([k, v]) => [v, k]));
const bl = c.BettingLive.build(), BS = c.BettingStats;

// old definition key -> new metric ids (primary value, then secondary value)
const PLAYER_MAP = { min: ['min'], usg: ['usg'], pts: ['pts100', 'pts_g'], ast: ['ast100', 'ast_g'], tov: ['tov_pct', 'tov_g'], reb: ['reb100', 'reb_g'], ftr: ['ftr'], fd: ['fd100', 'fd_g'],
  pir: ['pir', 'pir_min'], sfp: ['nspir', 'nspir_min'], netUsage: ['net_pir_usg'], load: ['load', 'bc'], ctov: ['ctov', 'tov100'] };
const PLAYER_SHOOT = { efg: ['efg'], shot2: ['fg2_pct'], shot3: ['fg3_pct'], shot1: ['ft_pct'] };
const TEAM_MAP = { pace: ['pace'], drtg: ['drtg', 'o_pts_g'], efg: ['o_efg'], tov: ['o_tov100'], ast: ['o_ast100'], dreb: ['t_dreb_pct'], ftr: ['o_ftr'], sc: ['o_sc100'], fb: ['o_fb100'], pot: ['o_pot100'] };
const TEAM_SHOOT = { efg: ['o_efg'], shot2: ['o_fg2_pct'], shot3: ['o_fg3_pct'] };
const BET_OFF = ['pace', 'ortg', 't_efg', 't_fg2_pct', 't_fg3_pct', 't_a3_rate', 't_ftr', 't_oreb_pct', 't_tov100', 't_ast100', 'o_blk_pct', 'o_stl100'];
const BET_DEF = ['pace', 'drtg', 'o_efg', 'o_fg2_pct', 'o_fg3_pct', 'o_a3_rate', 'o_ftr', 't_dreb_pct', 'o_tov100', 'o_ast100', 't_blk_pct', 't_stl100'];

const results = [];   // {entity, window, key, id, old, new, cov}
const W = { season: 'season', 3: 'l3', 5: 'l5' };
const add = (entity, window, key, id, old, nv) => {
  const fin = Number.isFinite(old);
  results.push({ entity, window, key, id, old: fin ? old : null, new: nv === undefined ? undefined : nv === null ? null : nv.value, cov: nv && nv.used < nv.of ? `${nv.used}/${nv.of}` : '' });
};

const oldPlayers = new Set();
for (const period of ['season', '3', '5']) {
  for (const p of M.rows('players', period)) {
    const key = 'P' + p.code; oldPlayers.add(key);
    for (const [view, map] of [[undefined, PLAYER_MAP], ['shooting', PLAYER_SHOOT]]) for (const d of M.defs('players', view)) {
      const to = map[d.key]; if (!to) continue;
      [d.get(p), d.secondary?.(p)].forEach((ov, i) => { if (i < to.length) add('player', W[period], key, to[i], ov, newVal('player', W[period], key, to[i])); });
    }
  }
  for (const t of M.rows('teams', period)) {
    const key = codeOf[t.CID] || t.CID;
    for (const [view, map] of [[undefined, TEAM_MAP], ['shooting', TEAM_SHOOT]]) for (const d of M.defs('teams', view)) {
      const to = map[d.key]; if (!to) continue;
      [d.get(t), d.secondary?.(t)].forEach((ov, i) => { if (i < to.length) add('team', W[period], key, to[i], ov, newVal('team', W[period], key, to[i])); });
    }
  }
}
// Betting teams: season, last 3, last 5, last 10 team games, both sides
for (const [period, n] of [['season', Infinity], ['l3', 3], ['l5', 5], ['l10', 10]]) for (const [cid, entry] of Object.entries(bl.byTeam)) {
  const team = codeOf[cid] || cid, t = BS.aggregate(entry.games.slice(-n));
  for (const [side, map] of [['offense', BET_OFF], ['defense', BET_DEF]]) BS.metrics(t, side).forEach((ov, i) => add('betting-team-' + side, period, team, map[i], ov, newVal('team', period, team, map[i])));
}

// ---- classification ----
const same = (a, b) => (a === null && b === null) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));
// Named decisions that make a difference intentional. A difference not matched by any rule stays (c).
const RULES = [];
for (const r of results) {
  if (same(r.old, r.new)) { r.cls = 'a'; continue; }
  const rule = RULES.find(x => x.when(r));
  [r.cls, r.decision] = rule ? ['b', rule.decision] : ['c', ''];
}

const count = f => results.filter(f).length;
console.log(`compared values: ${results.length}  (${oldPlayers.size} players visible in the old code; windows season/L3/L5, L10 for Betting teams)`);
console.log('class                          count');
for (const [k, n] of [['(a) identical', count(r => r.cls === 'a')], ['(b) intentional change', count(r => r.cls === 'b')], ['(c) unexplained', count(r => r.cls === 'c')]]) console.log(k.padEnd(30), n);
const playedIds = [...new Set(clean.players.filter(r => r.played).map(r => r.player_id))];
console.log(`players with minutes in the new views but hidden by the old eligibility filter: ${playedIds.filter(id => !oldPlayers.has(id)).length} of ${playedIds.length}`);
const groups = {};
for (const r of results.filter(r => r.cls !== 'a')) (groups[`${r.cls}|${r.decision}|${r.entity}|${r.id}`] ||= []).push(r);
for (const [k, list] of Object.entries(groups).sort((x, y) => y[1].length - x[1].length)) {
  const [cls, decision, entity, id] = k.split('|'), ex = list[0];
  console.log(`(${cls}) ${entity} ${id}: ${list.length} diffs${decision ? ' [' + decision + ']' : ''}; e.g. ${ex.window} ${ex.key}: old ${ex.old} new ${ex.new}${ex.cov ? ' cov ' + ex.cov : ''}`);
}
mkdirSync(join(repo, '.build-tmp'), { recursive: true });
writeFileSync(join(repo, '.build-tmp', 'parity.json'), JSON.stringify(results));
