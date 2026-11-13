/* The data of the Betting statistics tables: ranks, tones and the rows of the team and player tables, from the views. No markup here. */
import { Data } from '../core/data.js';
import * as Windows from '../core/windows.js';
import { state } from './table-state.js';
import { TEAM_COLUMNS, PLAYER_VIEWS, TREND, GOOD_TOP } from './columns.js';

const EPS = 1e-9;

/* Rank 1..n for one metric (1 = best by the metric's direction; style metrics rank from the highest). */
export function ranks(view, id, direction) {
  const list = view.keys.map(k => [k, view.get(k, id).value]).filter(([, v]) => Number.isFinite(v)), out = {};
  for (const [k, v] of list) out[k] = 1 + list.filter(([, o]) => (direction === 0 ? 1 : direction) * (o - v) > EPS).length;
  out.n = list.length;
  return out;
}
export const tone = (direction, rank, n) => !rank ? '' : direction === 0 ? 'neutral' : rank <= GOOD_TOP ? 'good' : rank >= n - GOOD_TOP + 1 ? 'bad' : '';
export async function teamModel(byId, roster) {
  const ids = TEAM_COLUMNS[state.side], defs = ids.map(id => byId[id]);
  const view = await Windows.view('teams', state);
  const l3 = state.win === 'season' ? await Data.view('teams', 'l3') : null;
  const rk = Object.fromEntries(ids.map(id => [id, ranks(view, id, byId[id].direction)]));
  const rk3 = l3 ? Object.fromEntries(ids.map(id => [id, ranks(l3, id, byId[id].direction)])) : null;
  const q = state.query.trim().toLowerCase();
  const rows = view.keys.filter(k => !q || (roster.teams[k] || k).toLowerCase().includes(q)).map(k => ({ id: k, name: roster.teams[k] || k, games: view.row(k).games, avg: false }));
  rows.push({ id: null, name: 'League average', avg: true });
  const col = Math.min(state.col, ids.length - 1), sortId = ids[col];
  const val = r => (r.avg ? view.league(sortId) : view.get(r.id, sortId)).value;
  rows.sort((a, b) => { const x = val(a), y = val(b); return !Number.isFinite(x) ? (Number.isFinite(y) ? 1 : 0) : !Number.isFinite(y) ? -1 : (x - y) * state.dir || Number(b.avg) - Number(a.avg) || a.name.localeCompare(b.name); });
  const lastN = Windows.LIST.find(w => w[0] === state.win)[2].last;
  return { kind: 'teams', ids, defs, view, rows, rk, rk3, col, nTeams: view.keys.length, lastN, byId };
}

export async function playerModel(byId, roster) {
  const [pv, tv] = await Promise.all([Windows.view('players', state), Windows.view('teams', state)]);
  const need = state.pl.view === 'role' ? await Promise.all([Data.view('players', 'l3'), Data.view('players', 'season')]) : [null, null];
  const [l3, season] = need;
  const pl = state.pl, [, ids] = PLAYER_VIEWS[pl.view], q = pl.query.trim().toLowerCase();
  const rows = [];
  for (const id of pv.keys) {
    const r = pv.row(id), gp = pv.get(id, 'gp').value, min = pv.get(id, 'min').value;
    if (!gp || (min ?? 0) < pl.min) continue;
    if (pl.team && r.team !== pl.team) continue;
    if (pl.pos && r.pos !== pl.pos) continue;
    const name = roster.players[id]?.name || r.name || id;
    if (q && !name.toLowerCase().includes(q)) continue;
    let trend = null;
    if (l3) {
      const g3 = l3.get(id, 'gp').value, s = season.get(id, 'gp').value;
      trend = g3 && s ? { min: l3.get(id, 'min').value - season.get(id, 'min').value, usg: (l3.get(id, 'usg').value ?? NaN) - (season.get(id, 'usg').value ?? NaN), gp: g3 } : s ? { none: true } : null;
    }
    rows.push({ id, name, team: r.team, pos: r.pos, gp, teamGames: tv.row(r.team)?.games ?? null, trend });
  }
  const col = ids.includes(pl.col) ? pl.col : ids[0];
  const valueOf = r => col === 'trend' ? (r.trend?.min ?? null) : pv.get(r.id, col).value;
  rows.sort((a, b) => { const x = valueOf(a), y = valueOf(b); return !Number.isFinite(x) ? (Number.isFinite(y) ? 1 : 0) : !Number.isFinite(y) ? -1 : (x - y) * pl.dir || a.name.localeCompare(b.name); });
  const defs = ids.map(id => id === 'trend' ? { id, ...TREND } : byId[id]);
  return { kind: 'players', pv, rows, defs, col, teams: roster.teams, total: pv.keys.length };
}
