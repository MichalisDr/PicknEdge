/* Betting · Statistics: which metric columns each table shows (ids from metrics.json), the player views, and the texts of the extra columns. */
export const TEAM_COLUMNS = {
  offense: ['pace', 'ortg', 't_efg', 't_fg2_pct', 't_fg3_pct', 't_a3_rate', 't_ftr', 't_oreb_pct', 't_tov100', 't_ast100', 'o_blk_pct', 'o_stl100'],
  defense: ['pace', 'drtg', 'o_efg', 'o_fg2_pct', 'o_fg3_pct', 'o_a3_rate', 'o_ftr', 't_dreb_pct', 'o_tov100', 'o_ast100', 't_blk_pct', 't_stl100'],
};
export const PLAYER_VIEWS = {
  role: ['Role & efficiency', ['gp', 'gs', 'min', 'trend', 'usg', 'ts_pct', 'ast_pct', 'tov_pct', 'oreb_pct', 'dreb_pct', 'a3_rate', 'ftr']],
  p100: ['Per 100 possessions', ['min', 'pts100', 'reb100', 'oreb100', 'dreb100', 'ast100', 'm3_100', 'a3_100', 'a1_100', 'stl100', 'blk100', 'tov100', 'fd100']],
  pg: ['Per game', ['gp', 'min', 'pts_g', 'reb_g', 'oreb_g', 'dreb_g', 'ast_g', 'm3_g', 'a3_g', 'a1_g', 'stl_g', 'blk_g', 'tov_g', 'pf_g', 'fd_g']],
};
export const TREND = { label: 'L3 vs Season', description: 'Difference of the last 3 team games from the season: minutes per game and USG%. Colour from ±4.' };
export const POSITIONS = { G: 'Guard', F: 'Forward', C: 'Center' };
export const GOOD_TOP = 5;   // the best / worst five of a ranking get a colour
