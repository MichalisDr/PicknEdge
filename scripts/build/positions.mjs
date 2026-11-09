// What each team allowed to each position (G / F / C): the production of the opposing players who played, grouped by roster position.
// One row per team-game and position. Components only; positions come from the roster (feeds API) and data/manual overrides (players.csv).
export const POSITION_COLUMNS = [
  ['season', 'folder name'], ['game', 'folder name'], ['round', 'game.round.round'], ['date_utc', 'game.date'], ['team', 'defending team'], ['opp', 'the team whose players produced'],
  ['home', 'defending team is home'], ['pos', 'roster position (G / F / C)'], ['players', 'opposing players who played in that position'], ['sec', 'their seconds'],
  ['m1', 'FreeThrowsMade'], ['a1', 'FreeThrowsAttempted'], ['m2', 'FieldGoalsMade2'], ['a2', 'FieldGoalsAttempted2'], ['m3', 'FieldGoalsMade3'], ['a3', 'FieldGoalsAttempted3'],
  ['oreb', 'OffensiveRebounds'], ['dreb', 'DefensiveRebounds'], ['ast', 'Assistances'], ['stl', 'Steals'], ['tov', 'Turnovers'], ['blk', 'BlocksFavour'], ['fd', 'FoulsReceived'],
  ['pf', 'FoulsCommited'], ['blk_against', 'BlocksAgainst'],
].map(([name, src]) => ({ name, src: name === 'season' || name === 'game' || name.length > 7 || src.length > 20 ? src : 'boxscore ' + src }));

const SUMMED = ['sec', 'm1', 'a1', 'm2', 'a2', 'm3', 'a3', 'oreb', 'dreb', 'ast', 'stl', 'tov', 'blk', 'fd', 'pf', 'blk_against'];

/** playerRows: player_games rows; teamRows: team_games rows; positionOf: player_id -> 'G' | 'F' | 'C' | ''. */
export function positionGames(playerRows, teamRows, positionOf) {
  const byTeamGame = new Map();
  for (const r of playerRows) if (r.played) { const k = r.game + '|' + r.team; (byTeamGame.get(k) || byTeamGame.set(k, []).get(k)).push(r); }
  const out = [];
  for (const t of teamRows) {
    const opponents = byTeamGame.get(t.game + '|' + t.opp) || [];
    for (const pos of ['G', 'F', 'C']) {
      const ps = opponents.filter(r => positionOf[r.player_id] === pos);
      const row = { season: t.season, game: t.game, round: t.round, date_utc: t.date_utc, team: t.team, opp: t.opp, home: t.home, pos, players: ps.length };
      for (const k of SUMMED) row[k] = ps.reduce((n, r) => n + r[k], 0);
      out.push(row);
    }
  }
  return out;
}
