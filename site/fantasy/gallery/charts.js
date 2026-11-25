/* Fantasy · Charts mode: which comparative scatter charts exist. One entry per chart (two metric ids from metrics.json); `x` / `y` are the axes,
   `equal` draws the x = y diagonal, `residual` colours by actual minus expected, `noAvg` hides the league lines.
   `fit` draws the least-squares line of y on x over the whole pool of the window (every player of the window's view with both values: the league row's players), tints the zones above (good) / below (bad) it and labels them (fit.js);
   the line never depends on a filter; `domain: 'listed'` takes the AXES from the players the table lists by its thresholds (and the "below the thresholds" toggle), over all four windows; position, search and the drawer only hide dots;
   `move` animates a change of window (tween.js).
   `corners` tints only the right of the vertical league line (above the horizontal one good, below bad) and writes the three zone labels; `curves` draws iso-points curves (curves.js); `extremes` names that many dots farthest from the league lines;
   `size` ({ id, key }) gives each dot the radius of that amount (scatter.js bubbleRadius) and adds a size key with the sample amounts `key` to the opened card;
   `hover` lists the figures of the read-out after name and team: [metric id, label].
   An x / y that is not a metric id of metrics.json (cr) is read through axes.js, which also declares the axis step of every metric drawn: no chart sets a range. */
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
  { id: 'players-price-pir', entity: 'players', view: 'profile', title: 'Performance vs price', subtitle: 'Credits × PIR / game · line = typical PIR at that price (fit across all players with a price)', x: 'cr', y: 'pir', noAvg: true, fit: true, move: true, domain: 'listed',
    zones: ['Above typical for the price', 'Below typical for the price'],
    note: 'The line is the fit of all players with a price in the selected window; filters only hide dots. It is not how Fantasy changes prices.' },
  { id: 'players-volume-efficiency', entity: 'players', view: 'shooting', title: 'Volume vs efficiency', subtitle: 'SA / 100 poss × TS%', x: 'sa100', y: 'ts_pct', domain: 'listed', move: true,
    corners: { upperRight: 'High volume, efficient', lowerRight: 'High volume, below average', upperLeft: 'Low volume, efficient' }, curves: [15, 20, 25, 30, 35], extremes: 9, size: { id: 'sa_att', key: [5, 20, 60, 190] },
    hover: [['sa100', 'SA/100'], ['ts_pct', 'TS%'], ['pts100', 'PTS/100'], ['sa_att', 'SA'], ['efg', 'eFG%'], ['ftr', 'FT rate']],
    note: 'Volume is how many of the team\'s possessions end in a shot or a free-throw trip while he is on court; TS% is points per shot attempt (2 x TS%). TS% moves a lot with few attempts, so check SA in the hover.' },
];

/** Is there at least one chart for this table (entity + view)? */
export const available = (kind, view) => CHARTS.some(c => c.entity === kind && c.view === view);
