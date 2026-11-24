/* Fantasy · Charts mode: which comparative scatter charts exist. One entry per chart (two metric ids from metrics.json); `x` / `y` are the axes,
   `equal` draws the x = y diagonal, `residual` colours by actual minus expected, `noAvg` hides the league lines.
   `fit` draws the least-squares line of y on x over the players drawn, tints the zones above (good) / below (bad) it and labels them (fit.js); `move` animates a change of window (tween.js);
   `domain: 'listed'` computes the axes over the players the table lists by its own eligibility rule (all four windows), so a player with a few minutes cannot stretch them.
   An x / y that is not a metric id of metrics.json (cr) is read through axes.js. */
export const CHARTS = [
  { id: 'teams-pace-drtg', entity: 'teams', view: 'profile', title: 'Pace × DRtg', x: 'pace', y: 'drtg' },
  { id: 'teams-efg-tov', entity: 'teams', view: 'profile', title: 'Opp eFG% × Opp TOV', x: 'o_efg', y: 'o_tov100' },
  { id: 'teams-dreb-efg', entity: 'teams', view: 'profile', title: 'Shooting & Rebounding Defense', subtitle: 'DREB% × Opp eFG%', x: 't_dreb_pct', y: 'o_efg',
    note: 'Shooting allowed and defensive-rebound control; on its own it does not show how the result is produced.' },
  { id: 'teams-3pa-3p', entity: 'teams', view: 'shooting', title: 'Opp 3PA × Opp 3P%', x: 'o_a3_rate', y: 'o_fg3_pct' },
  { id: 'teams-expected-efg', entity: 'teams', view: 'shooting', title: 'Expected vs Actual eFG%', subtitle: 'Opp Expected eFG% × Opp eFG% · zone-based estimate, no defender pressure', x: 'o_exp_efg', y: 'o_efg', equal: true, residual: true, noAvg: true,
    note: 'Zone-based estimate: it does not include defender pressure. The residual (actual − expected) is not attributed automatically to contest quality or luck.' },
  { id: 'teams-rim-defense', entity: 'teams', view: 'shooting', title: 'At-the-Rim Defense', subtitle: 'Opp rim FGA share × Opp rim FG%', x: 'o_rim_rate', y: 'o_zs_rim_pct',
    note: 'Only shots at the rim, not the whole paint.' },
  { id: 'players-price-pir', entity: 'players', view: 'profile', title: 'Performance vs price', subtitle: 'Credits × PIR / game · line = typical PIR at that price (fit across the players shown)', x: 'cr', y: 'pir', noAvg: true, fit: true, move: true, domain: 'listed',
    zones: ['Above typical for the price', 'Below typical for the price'],
    note: 'The line is the fit of this season\'s players at their current price; it moves with the window and the filters. It is not how Fantasy changes prices.' },
];

/** Is there at least one chart for this table (entity + view)? */
export const available = (kind, view) => CHARTS.some(c => c.entity === kind && c.view === view);
