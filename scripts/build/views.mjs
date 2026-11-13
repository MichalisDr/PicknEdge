// data/clean -> Season / L3 / L5 / L10 views and the metric catalog (metrics.json).
// Library: views (window x entity) and metric catalog. The CLI is scripts/build/site-data.mjs.
// Window = the team's last N games; a player's window is his rows in his current team's last N games.
import { METRICS } from '../metrics/registry.mjs';
import { evaluate, evaluateAll } from '../metrics/engine.mjs';
import { withOpponent } from '../metrics/join.mjs';


export const WINDOWS = { season: Infinity, l3: 3, l5: 5, l10: 10 };
const PLAYER_METRICS = METRICS.filter(m => m.scope === 'player' && !m.internal), TEAM_METRICS = METRICS.filter(m => m.scope === 'team' && !m.internal);   // internal metrics are for the site's engine calls only
const byGame = (a, b) => a.date_utc.localeCompare(b.date_utc) || a.game - b.game;
const roundedCell = r => r.value === null ? null : r.used === r.of ? +r.value.toFixed(6) : [+r.value.toFixed(6), r.used, r.of];   // [value, used, of] when coverage is partial

export function buildViews({ players, teams, dim }, { precise = false } = {}) {
  const cell = precise ? r => r : roundedCell;                         // precise = full-precision {value, used, of} (parity gate)
  const teamRows = withOpponent(teams);
  const gamesOf = {};                                                 // team -> games, oldest first
  for (const r of [...teams].sort(byGame)) (gamesOf[r.team] ||= []).push(r.game);
  const lastN = (team, n) => new Set(gamesOf[team].slice(-n));
  const byPlayer = {};
  for (const r of [...players].sort(byGame)) (byPlayer[r.player_id] ||= []).push(r);
  const info = Object.fromEntries(dim.map(d => [d.player_id, d]));
  const views = {};
  for (const [w, n] of Object.entries(WINDOWS)) {
    const prows = {}, pAll = [], tAll = [];
    for (const [pid, list] of Object.entries(byPlayer)) {
      if (!list.some(r => r.played)) continue;                        // never played this season (a window with no appearance keeps the player, with gp = 0)
      const team = list.at(-1).team, set = lastN(team, n);
      const rows = list.filter(r => r.team === team && set.has(r.game));
      pAll.push(...rows);
      prows[pid] = { team, name: list.at(-1).player, pos: info[pid]?.position || '', v: PLAYER_METRICS.map(m => cell(evaluate(m, rows))) };
    }
    const trows = {}, byTeam = {};
    for (const team of Object.keys(gamesOf)) {
      const set = lastN(team, n);
      byTeam[team] = { rows: teamRows.filter(r => r.team === team && set.has(r.game)), games: set.size };
      tAll.push(...byTeam[team].rows);
    }
    for (const [team, { rows, games }] of Object.entries(byTeam)) {          // metrics compared with the league use the league of the same window
      const res = evaluateAll(TEAM_METRICS, rows, tAll);
      trows[team] = { games, v: TEAM_METRICS.map(m => cell(res[m.id])) };
    }
    const tLeague = evaluateAll(TEAM_METRICS, tAll, tAll);
    views[w] = {
      players: { window: w, metrics: PLAYER_METRICS.map(m => m.id), league: PLAYER_METRICS.map(m => cell(evaluate(m, pAll))), rows: prows },
      teams: { window: w, metrics: TEAM_METRICS.map(m => m.id), league: TEAM_METRICS.map(m => cell(tLeague[m.id])), rows: trows }
    };
  }
  return views;
}

/* ---------- metric catalog (metrics.json) ---------- */
export const catalog = () => METRICS.map(m => ({
  id: m.id, label: m.label, scope: m.scope, kind: m.kind, tags: m.tags, description: m.description,
  direction: m.direction, format: { digits: m.digits, suffix: m.kind === 'pct' ? '%' : '' },
}));
