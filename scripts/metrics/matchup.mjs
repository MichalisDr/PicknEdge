// Matchup: where a player's PIR comes from x what the opponent allows to his position. The verdict logic lives here once (tested);
// the site only supplies numbers: the player's per-game sources (from his window view) and the opponent's factors (from the positions views).
//   source value  v  = the player's average per game of that PIR source (negative sources are stored as negatives)
//   factor        f  = (team allows per minute to the position) / (league per minute), mean of the Last-3 and Last-5 factors
// A positive source is "given" when the opponent allows >= 1.08 x the league, "cut" when <= 0.92 x. Negative sources (turnovers, fouls) read the other
// way round. The overall verdict follows the player's main source, otherwise the weighted total. The thresholds are heuristics to be evaluated.

export const GIVE = 1.08, CUT = 0.92, WEIGHTED = 0.04, MAIN_GUARD = 0.05;

/** metric = player metric id (per game), factor = position-view factor id (null: not driven by the opponent), show = detail factor ids */
export const SOURCES = [
  { k: '2P', name: 'Two-pointers', metric: 'rd_2p_g', factor: 'mu_m2', show: ['mu_a2', 'mu_p2'], note: '' },
  { k: '3P', name: 'Three-pointers', metric: 'rd_3p_g', factor: 'mu_a3', show: ['mu_a3', 'mu_p3'], note: 'the opponent three-point percentage is very noisy; volume counts' },
  { k: 'FT', name: 'Free throws', metric: 'rd_ft_g', factor: 'mu_a1', show: ['mu_a1'], note: 'stable source' },
  { k: 'FD', name: 'Fouls drawn', metric: 'fd_g', factor: 'mu_fd', show: ['mu_fd'], note: 'stable source' },
  { k: 'DREB', name: 'Defensive rebounds', metric: 'dreb_g', factor: 'mu_dr', show: ['mu_dr'], note: '' },
  { k: 'OREB', name: 'Offensive rebounds', metric: 'oreb_g', factor: 'mu_or', show: ['mu_or'], note: '' },
  { k: 'AST', name: 'Assists', metric: 'ast_g', factor: 'mu_as', show: ['mu_as'], note: '' },
  { k: 'STL', name: 'Steals + blocks', metric: 'src_stlblk_g', factor: null, show: [], note: '' },
  { k: 'TOV', name: 'Turnovers', metric: 'src_tov_g', factor: 'mu_tv', show: ['mu_tv'], note: '', neg: true },
  { k: 'PF', name: 'Fouls + blocks against', metric: 'src_pf_g', factor: null, show: [], note: '', neg: true },
];

export const classify = (f, neg) => !Number.isFinite(f) ? 'na' : neg ? (f >= GIVE ? 'cut' : f <= CUT ? 'give' : 'neu') : (f >= GIVE ? 'give' : f <= CUT ? 'cut' : 'neu');

/**
 * @param values  {sourceKey: per-game value}
 * @param factors {sourceKey: [factor over the opponent's last 3, factor over its last 5]} (null when unavailable)
 */
export function matchup(values, factors) {
  const mean = ([a, b]) => Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : (Number.isFinite(a) ? a : Number.isFinite(b) ? b : null);
  const src = SOURCES.map(s => { const f = s.factor ? mean(factors[s.k] || [null, null]) : null; return { ...s, v: values[s.k], f, c: s.factor ? classify(f, s.neg) : 'na' }; });
  const posTotal = src.filter(s => s.v > 0).reduce((a, s) => a + s.v, 0) || 1;
  src.forEach(s => { s.share = s.v > 0 ? s.v / posTotal : 0; });
  const main = src.filter(s => s.factor && s.v > 0).sort((a, b) => b.v - a.v)[0] || null;
  const weighted = src.reduce((a, s) => a + (Number.isFinite(s.f) ? (s.neg ? -(s.f - 1) * Math.abs(s.v) / posTotal : s.share * (s.f - 1)) : 0), 0);
  let overall = weighted >= WEIGHTED ? 'fav' : weighted <= -WEIGHTED ? 'neg' : 'neu';
  if (main && main.c === 'cut' && weighted < MAIN_GUARD) overall = 'neg';
  if (main && main.c === 'give' && weighted > -MAIN_GUARD) overall = 'fav';
  return { sources: src, main, weighted, overall, posTotal };
}
