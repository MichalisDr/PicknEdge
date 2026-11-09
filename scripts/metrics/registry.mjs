// THE metric registry: every metric is defined here once, as numerator / denominator over clean-table
// components. No formula lives anywhere else (site/data/metrics.json and docs/METRICS.md are generated from this file).
//
// A term list is a linear combination of components: [[coefficient, name], ...].
// A name is either a column of the clean table for the metric's scope, or an entry of DERIVED below.
//
// Entry fields
//   id, label, scope ('player' | 'team'), tags (['fantasy','betting']), description (one line)
//   kind: per100 | pct | perGame | perMin | count
//         per100 -> 100 * Σnum / Σden       pct -> 100 * Σnum / Σden (num is part of den's whole)
//         perGame -> Σnum / Σden (den = games played)   perMin -> 60 * Σnum / Σseconds   count -> Σnum
//   num, den: term lists      digits: decimals shown      unit: short text after the number (optional)
// A game (row) is skipped for a metric when any component it needs is empty (e.g. on-court data of an
// unverified lineup); the result reports how many games were used out of how many were played.

export const DERIVED = {
  pts: [[1, 'm1'], [2, 'm2'], [3, 'm3']],
  misses: [[1, 'a1'], [-1, 'm1'], [1, 'a2'], [-1, 'm2'], [1, 'a3'], [-1, 'm3']],
  pir: [[1, 'pts'], [-1, 'misses'], [1, 'oreb'], [1, 'dreb'], [1, 'ast'], [1, 'stl'], [1, 'blk'], [1, 'fd'], [-1, 'tov'], [-1, 'pf'], [-1, 'blk_against']],
};

export const METRICS = [
  {
    id: 'pts100', label: 'PTS / 100 poss', scope: 'player', kind: 'per100', tags: ['fantasy', 'betting'], digits: 1,
    num: [[1, 'pts']], den: [[1, 'poss_off_on']],
    description: 'Points per 100 team offensive possessions while the player is on court.',
  },
  {
    id: 'dreb_pct', label: 'DREB%', scope: 'player', kind: 'pct', tags: ['fantasy', 'betting'], digits: 1,
    num: [[1, 'dreb']], den: [[1, 'team_dreb_on'], [1, 'opp_oreb_on']],
    description: 'Share of the defensive rebounds available while on court (own team DREB + opponent OREB) that the player took.',
  },
  {
    id: 'tov_pct', label: 'TOV%', scope: 'player', kind: 'pct', tags: ['fantasy', 'betting'], digits: 1,
    num: [[1, 'tov']], den: [[1, 'sa'], [1, 'tov']],
    description: 'Turnovers as a share of the player\'s own possessions used (shot attempts + free-throw trips + turnovers).',
  },
  {
    id: 'usg', label: 'USG%', scope: 'player', kind: 'pct', tags: ['fantasy', 'betting'], digits: 1,
    num: [[1, 'sa'], [1, 'tov']], den: [[1, 'team_sa_on'], [1, 'team_tov_on']],
    description: 'Share of the team\'s shot attempts and turnovers, while on court, that the player used.',
  },
  // Needed by the build audit (our PIR vs the official valuation of every player-game).
  {
    id: 'pir', label: 'PIR / game', scope: 'player', kind: 'perGame', tags: ['fantasy', 'betting'], digits: 1,
    num: [[1, 'pir']], den: [[1, 'played']],
    description: 'Performance Index Rating per game played: points, rebounds, assists, steals, blocks and fouls drawn minus misses, turnovers, fouls and blocks against.',
  },
];
