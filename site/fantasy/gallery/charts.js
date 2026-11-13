/* Fantasy · Charts mode: which comparative scatter charts exist. One entry per chart (two metric ids from metrics.json); `x` / `y` are the axes,
   `equal` draws the x = y diagonal, `residual` colours by actual minus expected, `noAvg` hides the league lines. */
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
];

/** Is there at least one chart for this table (entity + view)? */
export const available = (kind, view) => CHARTS.some(c => c.entity === kind && c.view === view);
