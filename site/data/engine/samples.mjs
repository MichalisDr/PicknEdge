// Row selections for "with / without a teammate". Pure functions; values are then evaluated by the engine over the returned rows.
//   with     = games the player played for his current team in which the teammate also played
//   without  = games the player played in which the teammate did not, AFTER the teammate's first appearance for the team
//              (games before it, when he was not on the roster yet, are neither)

/**
 * @param pid     the player
 * @param rowsBy  Map player_id -> his player_games rows (played only), any order
 * @param roundOf Map team -> Map game -> round
 * @param teamOf  Map player_id -> current team
 * @returns [{pid, nWith, nWithout, withRows, withoutRows}] for teammates with at least one game without, most games without first
 */
export function withWithout(pid, rowsBy, roundOf, teamOf) {
  const team = teamOf.get(pid), mine = (rowsBy.get(pid) || []).filter(r => r.team === team), out = [];
  if (!mine.length) return out;
  for (const [mate, rows] of rowsBy) {
    if (mate === pid || teamOf.get(mate) !== team) continue;
    const played = new Map(rows.filter(r => r.team === team).map(r => [r.game, r]));
    if (!played.size) continue;
    const rounds = roundOf.get(team), start = Math.min(...[...played.keys()].map(g => rounds.get(g)));
    const withRows = [], withoutRows = [];
    for (const r of mine) {
      if (played.has(r.game)) withRows.push(r);
      else if (rounds.get(r.game) > start) withoutRows.push(r);
    }
    if (withoutRows.length) out.push({ pid: mate, nWith: withRows.length, nWithout: withoutRows.length, withRows, withoutRows });
  }
  return out.sort((a, b) => b.nWithout - a.nWithout);
}
