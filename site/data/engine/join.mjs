// Team-scope rows: each team_games row gets the opponent's figures of the same game as o_<column>, and games = 1.
import { ZONES } from './zones.mjs';

const OPP_COLUMNS = ['sec', 'pts', 'm1', 'a1', 'm2', 'a2', 'm3', 'a3', 'oreb', 'dreb', 'ast', 'stl', 'tov', 'blk', 'blk_against', 'pf', 'fd',
  'poss', 'sa', 'pts_fastbreak', 'pts_second_chance', 'pts_off_turnover',
  ...ZONES.flatMap(z => [`z_${z.key}_a`, `z_${z.key}_m`])];

export function withOpponent(teamRows) {
  const byKey = new Map(teamRows.map(r => [`${r.game}|${r.team}`, r]));
  return teamRows.map(r => {
    const o = byKey.get(`${r.game}|${r.opp}`);
    if (!o) throw new Error(`game ${r.game}: missing opponent row for ${r.team}`);
    const out = { ...r, games: 1 };
    for (const c of OPP_COLUMNS) out['o_' + c] = o[c];
    return out;
  });
}
