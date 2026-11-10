// THE metric registry: every metric is defined here once, as numerator / denominator over clean-table
// components. No formula lives anywhere else (site/data/metrics.json and docs/METRICS.md are generated from this file).
//
// Term list = linear combination of components: [[coefficient, name], ...]. A name is a column of the clean
// table for the metric's scope, or an entry of DERIVED below.
//   player scope: rows of player_games (only games the player played count)
//   team scope:   rows of team_games, plus the opponent's figures of the same game as o_<column> (see join.mjs)
//
// Entry fields
//   id, label, scope ('player' | 'team'), tags (['fantasy','betting']), description (one line), digits, unit?
//   kind  per100  100 x Σnum / Σden        pct     100 x Σnum / Σden, num is a part of the whole den
//         perGame Σnum / Σden (den = games) perMin  60 x Σnum / Σseconds
//         ratio   mult x Σnum / Σden (mult given)  count  Σnum
//         custom  fn(sums) of the window's SUMMED components listed in `needs` (never per-game results)
//   mult  overrides the kind's multiplier (REB/100 uses 200, Pace uses 1200)
// Naming rule: "/100" = count x100 / possessions on court: offense stats (PTS, AST, TOV, OREB, FD) per 100 team
// offensive possessions, defense stats (STL, BLK, DREB) per 100 team defensive possessions, total REB/100 over both
// phases (x200 / (OfPo + DePo)). "%" = part of a defined whole. No suffix = per game or per minute, in the label.
// A game is skipped for a metric when a component it needs is empty; results report games used out of games played.

export const DERIVED = {
  pts: [[1, 'm1'], [2, 'm2'], [3, 'm3']],
  o_pts: [[1, 'o_m1'], [2, 'o_m2'], [3, 'o_m3']],
  misses: [[1, 'a1'], [-1, 'm1'], [1, 'a2'], [-1, 'm2'], [1, 'a3'], [-1, 'm3']],
  reb: [[1, 'oreb'], [1, 'dreb']],
  fga: [[1, 'a2'], [1, 'a3']],
  fgm: [[1, 'm2'], [1, 'm3']],
  o_fga: [[1, 'o_a2'], [1, 'o_a3']],
  used: [[1, 'sa'], [1, 'tov']],                       // possessions used by the player: shot attempts, free-throw trips, turnovers
  team_used_on: [[1, 'team_sa_on'], [1, 'team_tov_on']],
  nonscoring: [[1, 'oreb'], [1, 'dreb'], [1, 'ast'], [1, 'stl'], [1, 'blk'], [1, 'fd'], [-1, 'pf'], [-1, 'blk_against'], [-1, 'tov']],
  pir: [[1, 'pts'], [-1, 'misses'], [1, 'nonscoring']],  // PIR = (points - missed shots) + non scoring PIR
};

import { ZONES, SUBS, MAINS, zonesOfSub, zonesOfMain } from './zones.mjs';

// Zone sums (sub-areas and areas) for own figures and the opponent's (o_ prefix); zones themselves are build-time columns z_<zone>_a / _m.
DERIVED.zall_a = ZONES.map(z => [1, 'z_' + z.key + '_a']);   // every classified attempt of a player: the whole of the zone shares
for (const p of ['', 'o_']) for (const q of ['a', 'm']) {
  for (const sub of SUBS) DERIVED[`${p}zs_${sub.key}_${q}`] = zonesOfSub(sub.key).map(z => [1, `${p}z_${z}_${q}`]);
  for (const main of MAINS) DERIVED[`${p}zm_${main.key}_${q}`] = zonesOfMain(main.key).map(z => [1, `${p}z_${z}_${q}`]);
}

const F = ['fantasy'], B = ['betting'], FB = ['fantasy', 'betting'];
const S = n => [[1, n]];                              // single component
const P = 'player', T = 'team';
const e = (id, label, scope, kind, num, den, tags, digits, description, extra = {}) => ({ id, label, scope, kind, num, den, tags, digits, description, ...extra });

export const METRICS = [
  // ---------- players: volume ----------
  e('gp', 'GP', P, 'count', S('played'), null, FB, 0, 'Games played (minutes > 0).'),
  e('min', 'MIN / game', P, 'perGame', [[1 / 60, 'sec']], S('played'), FB, 1, 'Minutes per game played.'),
  e('pts_g', 'PTS / game', P, 'perGame', S('pts'), S('played'), FB, 1, 'Points per game played.'),
  e('reb_g', 'REB / game', P, 'perGame', S('reb'), S('played'), FB, 1, 'Rebounds per game played.'),
  e('ast_g', 'AST / game', P, 'perGame', S('ast'), S('played'), FB, 1, 'Assists per game played.'),
  e('stl_g', 'STL / game', P, 'perGame', S('stl'), S('played'), FB, 1, 'Steals per game played.'),
  e('blk_g', 'BLK / game', P, 'perGame', S('blk'), S('played'), FB, 1, 'Blocks per game played.'),
  e('tov_g', 'TOV / game', P, 'perGame', S('tov'), S('played'), FB, 1, 'Turnovers per game played.'),
  e('fd_g', 'FD / game', P, 'perGame', S('fd'), S('played'), FB, 1, 'Fouls drawn per game played.'),
  e('pf_g', 'PF / game', P, 'perGame', S('pf'), S('played'), FB, 1, 'Personal fouls per game played.'),

  // ---------- players: per 100 possessions on court ----------
  e('pts100', 'PTS / 100 poss', P, 'per100', S('pts'), S('poss_off_on'), FB, 1, 'Points per 100 team offensive possessions while the player is on court.'),
  e('ast100', 'AST / 100 poss', P, 'per100', S('ast'), S('poss_off_on'), FB, 1, 'Assists per 100 team offensive possessions while on court.'),
  e('tov100', 'TOV / 100 poss', P, 'per100', S('tov'), S('poss_off_on'), FB, 1, 'Turnovers per 100 team offensive possessions while on court.'),
  e('oreb100', 'OREB / 100 poss', P, 'per100', S('oreb'), S('poss_off_on'), FB, 1, 'Offensive rebounds per 100 team offensive possessions while on court.'),
  e('fd100', 'FD / 100 poss', P, 'per100', S('fd'), S('poss_off_on'), FB, 1, 'Fouls drawn per 100 team offensive possessions while on court.'),
  e('stl100', 'STL / 100 poss', P, 'per100', S('stl'), S('poss_def_on'), FB, 1, 'Steals per 100 team defensive possessions while on court.'),
  e('blk100', 'BLK / 100 poss', P, 'per100', S('blk'), S('poss_def_on'), FB, 1, 'Blocks per 100 team defensive possessions while on court.'),
  e('dreb100', 'DREB / 100 poss', P, 'per100', S('dreb'), S('poss_def_on'), FB, 1, 'Defensive rebounds per 100 team defensive possessions while on court.'),
  e('reb100', 'REB / 100 poss', P, 'per100', S('reb'), [[1, 'poss_off_on'], [1, 'poss_def_on']], FB, 1,
    'Total rebounds x200 / (offensive + defensive possessions on court): combines both phases, so it uses the average of the two.', { mult: 200 }),

  // ---------- players: shares of a defined whole ----------
  e('usg', 'USG%', P, 'pct', S('used'), S('team_used_on'), FB, 1, 'Share of the team\'s shot attempts and turnovers, while on court, that the player used.'),
  e('tov_pct', 'TOV%', P, 'pct', S('tov'), S('used'), FB, 1, 'Turnovers as a share of the player\'s own possessions used (shot attempts + free-throw trips + turnovers).'),
  e('oreb_pct', 'OREB%', P, 'pct', S('oreb'), [[1, 'team_oreb_on'], [1, 'opp_dreb_on']], FB, 1, 'Share of the offensive rebounds available while on court (own team OREB + opponent DREB) that the player took.'),
  e('dreb_pct', 'DREB%', P, 'pct', S('dreb'), [[1, 'team_dreb_on'], [1, 'opp_oreb_on']], FB, 1, 'Share of the defensive rebounds available while on court (own team DREB + opponent OREB) that the player took.'),

  e('gs', 'GS', P, 'count', S('starter'), null, B, 0, 'Games started.'),
  e('oreb_g', 'OREB / game', P, 'perGame', S('oreb'), S('played'), B, 1, 'Offensive rebounds per game played.'),
  e('dreb_g', 'DREB / game', P, 'perGame', S('dreb'), S('played'), B, 1, 'Defensive rebounds per game played.'),
  e('m3_g', '3PM / game', P, 'perGame', S('m3'), S('played'), B, 1, 'Three-pointers made per game played.'),
  e('a3_g', '3PA / game', P, 'perGame', S('a3'), S('played'), B, 1, 'Three-point attempts per game played.'),
  e('a1_g', 'FTA / game', P, 'perGame', S('a1'), S('played'), B, 1, 'Free-throw attempts per game played.'),
  e('m3_100', '3PM / 100 poss', P, 'per100', S('m3'), S('poss_off_on'), B, 1, 'Three-pointers made per 100 team offensive possessions while on court.'),
  e('a3_100', '3PA / 100 poss', P, 'per100', S('a3'), S('poss_off_on'), B, 1, 'Three-point attempts per 100 team offensive possessions while on court.'),
  e('a1_100', 'FTA / 100 poss', P, 'per100', S('a1'), S('poss_off_on'), B, 1, 'Free-throw attempts per 100 team offensive possessions while on court.'),
  e('pf100', 'PF / 100 poss', P, 'per100', S('pf'), S('poss_def_on'), B, 1, 'Personal fouls per 100 team defensive possessions while on court.'),
  e('ast_pct', 'AST%', P, 'pct', S('ast'), [[1, 'team_fgm_on'], [-1, 'fgm']], B, 1, 'Share of team field goals made while on court (excluding his own) that the player assisted.'),
  e('blk_pct', 'BLK%', P, 'pct', S('blk'), S('opp_a2_on'), B, 1, 'Blocks as a share of opponent two-point attempts while on court.'),

  // ---------- players: shooting ----------
  e('efg', 'eFG%', P, 'pct', [[1, 'm2'], [1.5, 'm3']], S('fga'), FB, 1, 'Effective field-goal percentage: (2P made + 1.5 x 3P made) / field-goal attempts.'),
  e('fg2_pct', '2FG%', P, 'pct', S('m2'), S('a2'), FB, 1, 'Two-point field-goal percentage.'),
  e('fg3_pct', '3FG%', P, 'pct', S('m3'), S('a3'), FB, 1, 'Three-point field-goal percentage.'),
  e('ft_pct', 'FT%', P, 'pct', S('m1'), S('a1'), FB, 1, 'Free-throw percentage.'),
  e('ftr', 'FTr', P, 'pct', S('a1'), S('fga'), FB, 1, 'Free-throw rate: free-throw attempts per field-goal attempt, x100.'),
  e('a3_rate', '3PA / FGA', P, 'pct', S('a3'), S('fga'), B, 1, 'Share of field-goal attempts that are three-pointers.'),
  e('ts_pct', 'TS%', P, 'pct', S('pts'), [[2, 'a2'], [2, 'a3'], [0.88, 'a1']], B, 1, 'True shooting: points / (2 x (FGA + 0.44 x FTA)).'),

  // ---------- players: PIR family ----------
  e('pir', 'PIR / game', P, 'perGame', S('pir'), S('played'), FB, 1, 'Performance Index Rating per game: points, rebounds, assists, steals, blocks and fouls drawn minus misses, turnovers, fouls and blocks against.'),
  e('pir_min', 'PIR / min', P, 'perMin', S('pir'), null, F, 3, 'PIR per minute played (total PIR / total minutes).'),
  e('nspir100', 'nsPIR / 100 poss', P, 'per100', S('nonscoring'), [[1, 'poss_off_on'], [1, 'poss_def_on']], F, 1,
    'Non Scoring PIR (nsPIR) per 100 possessions: PIR minus its scoring part (points minus missed field goals and free throws), that is rebounds + assists + steals + blocks + fouls drawn - personal fouls - blocks against - turnovers. Per 100 uses x200 / (offensive + defensive possessions on court), like total REB / 100, because PIR combines offense and defense. Shown inside PIR, not as a column.', { mult: 200 }),

  // ---------- players: Ben Taylor family (custom, from the window's summed components) ----------
  e('bc', 'Box Creation', P, 'custom', null, null, F, 1,
    'Ben Taylor\'s Box Creation per 100 offensive possessions on court (AST, PTS+TOV and 3-point proficiency from window totals).',
    { needs: ['ast', 'pts', 'tov', 'm3', 'a3', 'poss_off_on'], fn: s => boxCreation(s) }),
  e('load', 'Offensive Load', P, 'custom', null, null, F, 1,
    'Ben Taylor\'s Offensive Load per 100 offensive possessions on court; uses the play-by-play shot attempts instead of FGA + 0.44 x FTA.',
    { needs: ['ast', 'pts', 'tov', 'm3', 'a3', 'poss_off_on', 'sa'], fn: s => offensiveLoad(s) }),
  e('ctov', 'cTOV%', P, 'custom', null, null, F, 1,
    'Ben Taylor\'s creation-adjusted turnover rate: turnovers per 100 possessions divided by Offensive Load, x100.',
    { needs: ['ast', 'pts', 'tov', 'm3', 'a3', 'poss_off_on', 'sa'], fn: s => { const l = offensiveLoad(s); return l > 0 ? 100 * (s.tov * 100 / s.poss_off_on) / l : null; } }),

  // ---------- teams: pace and ratings ----------
  e('pace', 'Pace (poss / 40 min)', T, 'ratio', [[1, 'poss'], [1, 'o_poss']], S('sec'), FB, 1, 'Possessions per 40 minutes (average of both teams\' possessions).', { mult: 1200 }),
  e('ortg', 'ORtg', T, 'per100', S('pts'), S('poss'), B, 1, 'Points scored per 100 own possessions.'),
  e('drtg', 'DRtg', T, 'per100', S('o_pts'), S('o_poss'), FB, 1, 'Points allowed per 100 opponent possessions.'),
  e('t_pts_g', 'PTS / game', T, 'perGame', S('pts'), S('games'), B, 1, 'Points scored per game.'),
  e('o_pts_g', 'Opp PTS / game', T, 'perGame', S('o_pts'), S('games'), FB, 1, 'Points allowed per game.'),

  // ---------- teams: shooting (own and opponent) ----------
  e('t_efg', 'eFG%', T, 'pct', [[1, 'm2'], [1.5, 'm3']], S('fga'), B, 1, 'Effective field-goal percentage.'),
  e('o_efg', 'Opp eFG%', T, 'pct', [[1, 'o_m2'], [1.5, 'o_m3']], S('o_fga'), FB, 1, 'Opponent effective field-goal percentage.'),
  e('t_fg2_pct', '2FG%', T, 'pct', S('m2'), S('a2'), B, 1, 'Two-point field-goal percentage.'),
  e('o_fg2_pct', 'Opp 2FG%', T, 'pct', S('o_m2'), S('o_a2'), FB, 1, 'Opponent two-point field-goal percentage.'),
  e('t_fg3_pct', '3FG%', T, 'pct', S('m3'), S('a3'), B, 1, 'Three-point field-goal percentage.'),
  e('o_fg3_pct', 'Opp 3FG%', T, 'pct', S('o_m3'), S('o_a3'), FB, 1, 'Opponent three-point field-goal percentage.'),
  e('t_ftr', 'FTr', T, 'pct', S('a1'), S('fga'), B, 1, 'Free-throw attempts per field-goal attempt, x100.'),
  e('o_ftr', 'Opp FTr', T, 'pct', S('o_a1'), S('o_fga'), FB, 1, 'Opponent free-throw attempts per field-goal attempt, x100.'),
  e('t_a3_rate', '3PA / FGA', T, 'pct', S('a3'), S('fga'), B, 1, 'Share of field-goal attempts that are three-pointers.'),
  e('o_a3_rate', 'Opp 3PA / FGA', T, 'pct', S('o_a3'), S('o_fga'), B, 1, 'Share of opponent field-goal attempts that are three-pointers.'),

  // ---------- teams: rebounds ----------
  e('t_oreb_pct', 'OREB%', T, 'pct', S('oreb'), [[1, 'oreb'], [1, 'o_dreb']], B, 1, 'Offensive rebounds taken / offensive rebounds available (own OREB + opponent DREB).'),
  e('t_dreb_pct', 'DREB%', T, 'pct', S('dreb'), [[1, 'dreb'], [1, 'o_oreb']], FB, 1, 'Defensive rebounds taken / defensive rebounds available (own DREB + opponent OREB).'),

  // ---------- teams: per 100 possessions (offense stats on own possessions, defense stats on opponent possessions) ----------
  e('t_tov100', 'TOV / 100 poss', T, 'per100', S('tov'), S('poss'), B, 1, 'Own turnovers per 100 own possessions.'),
  e('o_tov100', 'Opp TOV / 100 poss', T, 'per100', S('o_tov'), S('o_poss'), FB, 1, 'Opponent turnovers per 100 opponent possessions.'),
  e('t_ast100', 'AST / 100 poss', T, 'per100', S('ast'), S('poss'), B, 1, 'Own assists per 100 own possessions.'),
  e('o_ast100', 'Opp AST / 100 poss', T, 'per100', S('o_ast'), S('o_poss'), FB, 1, 'Opponent assists per 100 opponent possessions.'),
  e('t_stl100', 'STL / 100 poss', T, 'per100', S('stl'), S('o_poss'), B, 1, 'Own steals per 100 defensive (= opponent) possessions.'),
  e('o_stl100', 'Opp STL / 100 poss', T, 'per100', S('o_stl'), S('poss'), B, 1, 'Opponent steals per 100 of their defensive (= own) possessions.'),
  e('t_blk_pct', 'BLK%', T, 'pct', S('blk'), S('o_a2'), B, 1, 'Own blocks as a share of opponent two-point attempts.'),
  e('o_blk_pct', 'Opp BLK%', T, 'pct', S('o_blk'), S('a2'), B, 1, 'Opponent blocks as a share of own two-point attempts.'),

  // ---------- teams: where opponents shoot from (Charts) ----------
  e('o_rim_rate', 'Opp At the rim FGA share', T, 'pct', S('o_zs_rim_a'), S('o_fga'), FB, 1, 'Share of opponent field-goal attempts taken at the rim.'),

  // ---------- teams: tagged points (official shot feed) ----------
  e('t_fb100', 'Fast break PTS / 100 poss', T, 'per100', S('pts_fastbreak'), S('poss'), B, 1, 'Own fast-break points per 100 own possessions.'),
  e('o_fb100', 'Opp Fast break PTS / 100 poss', T, 'per100', S('o_pts_fastbreak'), S('o_poss'), FB, 1, 'Opponent fast-break points per 100 opponent possessions.'),
  e('t_sc100', 'Second chance PTS / 100 poss', T, 'per100', S('pts_second_chance'), S('poss'), B, 1, 'Own second-chance points per 100 own possessions.'),
  e('o_sc100', 'Opp Second chance PTS / 100 poss', T, 'per100', S('o_pts_second_chance'), S('o_poss'), FB, 1, 'Opponent second-chance points per 100 opponent possessions (categories overlap; do not add them up).'),
  e('t_pot100', 'PTS off TO / 100 poss', T, 'per100', S('pts_off_turnover'), S('poss'), B, 1, 'Own points off turnovers per 100 own possessions.'),
  e('o_pot100', 'Opp PTS off TO / 100 poss', T, 'per100', S('o_pts_off_turnover'), S('o_poss'), FB, 1, 'Opponent points off turnovers per 100 opponent possessions.'),
];

/* ---------- Ben Taylor formulas (Nylon Calculus 2017, Thinking Basketball 2017); inputs are window sums ---------- */
function boxCreation(s) {
  const o = s.poss_off_on;
  if (!(o > 0)) return null;
  const k = 100 / o, ast = s.ast * k, pt = (s.pts + s.tov) * k;
  const prof = (2 / (1 + Math.exp(-s.a3 * k)) - 1) * (s.a3 > 0 ? s.m3 / s.a3 : 0);   // 3-point proficiency
  const v = 0.1843 * ast + 0.0969 * pt - 2.3021 * prof + 0.0582 * ast * pt * prof - 1.1942;
  return Number.isFinite(v) ? v : null;
}
function offensiveLoad(s) {
  const bc = boxCreation(s);
  if (bc === null) return null;
  const k = 100 / s.poss_off_on, v = (s.ast * k - 0.38 * bc) * 0.75 + s.sa * k + bc + s.tov * k;   // SA from play-by-play replaces FGA + 0.44 x FTA
  return Number.isFinite(v) ? v : null;
}

/* ---------- shot-zone FG% (from the build's zone classification of every shot) ---------- */
const zoneEntries = (scope, p, idp, labelp, tags) => [
  ...ZONES.map(z => e(`${idp}z_${z.key}_pct`, `${labelp}${z.name} FG%`, scope, 'pct', S(`${p}z_${z.key}_m`), S(`${p}z_${z.key}_a`), tags, 1, `Field-goal percentage in the zone "${z.name}".`)),
  ...SUBS.map(z => e(`${idp}zs_${z.key}_pct`, `${labelp}${z.name} FG%`, scope, 'pct', S(`${p}zs_${z.key}_m`), S(`${p}zs_${z.key}_a`), tags, 1, `Field-goal percentage in the sub-area "${z.name}" (sum of its zones).`)),
  ...MAINS.map(z => e(`${idp}zm_${z.key}_pct`, `${labelp}${z.name} FG%`, scope, 'pct', S(`${p}zm_${z.key}_m`), S(`${p}zm_${z.key}_a`), tags, 1, `Field-goal percentage in the area "${z.name}" (sum of its zones).`)),
];
METRICS.push(
  e('fga100', 'FGA / 100 poss', P, 'per100', S('fga'), S('poss_off_on'), F, 1, 'Field-goal attempts per 100 team offensive possessions while on court.'),
  e('a2_rate', '2PA / FGA', P, 'pct', S('a2'), S('fga'), F, 1, 'Share of field-goal attempts that are two-pointers.'),
  // Player sub-area detail for the Shooting card (the six sub-areas of zones.mjs): makes, attempts, share of the player's classified shots, attempts per 100 team offensive possessions.
  ...SUBS.flatMap(z => [
    e('zs_' + z.key + '_made', z.name + ' makes', P, 'count', S('zs_' + z.key + '_m'), null, F, 0, 'Field goals made in the sub-area "' + z.name + '".'),
    e('zs_' + z.key + '_att', z.name + ' attempts', P, 'count', S('zs_' + z.key + '_a'), null, F, 0, 'Field-goal attempts in the sub-area "' + z.name + '".'),
    e('zs_' + z.key + '_share', z.name + ' share of FGA', P, 'pct', S('zs_' + z.key + '_a'), S('zall_a'), F, 1, 'Share of the classified field-goal attempts taken in "' + z.name + '".'),
    e('zs_' + z.key + '_a100', z.name + ' FGA / 100 poss', P, 'per100', S('zs_' + z.key + '_a'), S('poss_off_on'), F, 1, 'Field-goal attempts in "' + z.name + '" per 100 team offensive possessions while on court.'),
  ]),
  // Opponent sub-area makes and attempts (Teams Shooting table: the makes/attempts line under the opponent FG%).
  ...SUBS.flatMap(z => [
    e('o_zs_' + z.key + '_made', 'Opp ' + z.name + ' makes', T, 'count', S('o_zs_' + z.key + '_m'), null, F, 0, 'Field goals made by opponents in the sub-area "' + z.name + '".'),
    e('o_zs_' + z.key + '_att', 'Opp ' + z.name + ' attempts', T, 'count', S('o_zs_' + z.key + '_a'), null, F, 0, 'Field-goal attempts by opponents in the sub-area "' + z.name + '".'),
  ]),
  ...zoneEntries(P, '', '', '', FB), ...zoneEntries(T, '', 't_', '', B), ...zoneEntries(T, 'o_', 'o_', 'Opp ', FB));

/* Generic share of a whole: the site passes counts ({ n, of }) for splits that are not columns of the clean tables
   (shot-chart zone shares, assisted / unassisted splits), so even these ratios are defined here. */
METRICS.push(e('share', 'Share', T, 'pct', S('n'), S('of'), FB, 1, 'A part as a percentage of its whole (counts supplied by the caller).', { internal: true }));

/* ---------- player radar: net contributions per category, per game and per 100 possessions ----------
   Shooting categories count points minus misses (FT = made - missed, 2P = 2 x made - missed ...); AST is net of turnovers, FD of fouls,
   STL+BLK of blocks against. Offensive categories use team offensive possessions on court, DREB the defensive ones, the two mixed
   categories the average of both (x200 / (off + def)). */
const RADAR = [   // key, name, net terms, gross terms (positive contributions only), basis
  ['ft', 'Free throws', [[2, 'm1'], [-1, 'a1']], [[1, 'm1']], 'off'], ['2p', 'Two-pointers', [[3, 'm2'], [-1, 'a2']], [[2, 'm2']], 'off'], ['3p', 'Three-pointers', [[4, 'm3'], [-1, 'a3']], [[3, 'm3']], 'off'],
  ['ast', 'Assists − turnovers', [[1, 'ast'], [-1, 'tov']], [[1, 'ast']], 'off'], ['dreb', 'Defensive rebounds', [[1, 'dreb']], [[1, 'dreb']], 'def'], ['oreb', 'Offensive rebounds', [[1, 'oreb']], [[1, 'oreb']], 'off'],
  ['stlblk', 'Steals + blocks − blocks against', [[1, 'stl'], [1, 'blk'], [-1, 'blk_against']], [[1, 'stl'], [1, 'blk']], 'both'], ['fd', 'Fouls drawn − fouls', [[1, 'fd'], [-1, 'pf']], [[1, 'fd']], 'both'],
];
for (const [key, name, terms, gross, basis] of RADAR) {
  const den = basis === 'off' ? S('poss_off_on') : basis === 'def' ? S('poss_def_on') : [[1, 'poss_off_on'], [1, 'poss_def_on']];
  METRICS.push(
    e(`rg_${key}_g`, `Gross ${name} / game`, P, 'perGame', gross, S('played'), F, 1, `Positive contributions only (no misses, turnovers or fouls) of ${name.toLowerCase()} per game played (radar gross view).`),
    e(`rg_${key}_100`, `Gross ${name} / 100 poss`, P, 'per100', gross, den, F, 1, `Positive contributions only of ${name.toLowerCase()} per 100 team possessions on court (radar gross view).`, basis === 'both' ? { mult: 200 } : {}),
  );
  METRICS.push(
    e(`rd_${key}_g`, `Net ${name} / game`, P, 'perGame', terms, S('played'), F, 1, `Net contribution of ${name.toLowerCase()} per game played (radar axis).`),
    e(`rd_${key}_100`, `Net ${name} / 100 poss`, P, 'per100', terms, basis === 'off' ? S('poss_off_on') : basis === 'def' ? S('poss_def_on') : [[1, 'poss_off_on'], [1, 'poss_def_on']], F, 1,
      `Net contribution of ${name.toLowerCase()} per 100 team possessions on court (radar axis).`, basis === 'both' ? { mult: 200 } : {}),
  );
}

/* ---------- team radar: production of the OPPOSING players against the team, per 100 opponent possessions ----------
   Rebounds use the opponents' player-assigned rebounds (o_oreb_players / o_dreb_players). Team totals also contain "team rebounds"
   (credited to no player, e.g. rebounds off the buzzer or out of bounds), which are not production of any player; the radar measures
   what players did, so they are left out. All other categories are identical in team totals and player lines. */
const TEAM_RADAR = [
  ['2p', 'Two-pointers', [[3, 'o_m2'], [-1, 'o_a2']]], ['3p', 'Three-pointers', [[4, 'o_m3'], [-1, 'o_a3']]], ['ft', 'Free throws', [[2, 'o_m1'], [-1, 'o_a1']]],
  ['ast', 'Assists', [[1, 'o_ast']]], ['dreb', 'Defensive rebounds', [[1, 'o_dreb_players']]], ['oreb', 'Offensive rebounds', [[1, 'o_oreb_players']]],
  ['blk', 'Blocks', [[1, 'o_blk']]], ['stl', 'Steals', [[1, 'o_stl']]],
];
for (const [key, name, terms] of TEAM_RADAR) {
  METRICS.push(e(`rt_${key}_100`, `Opp net ${name.toLowerCase()} / 100 opp poss`, T, 'per100', terms, S('o_poss'), F, 1,
    `Net contribution of ${name.toLowerCase()} by the opposing players per 100 opponent possessions (team radar axis; rebounds exclude team rebounds).`));
}

/* ---------- expected opponent eFG% (zone benchmark) ----------
   Expected = Σ [opponent FGA in zone group x league FG% of the group x weight (2P 1, 3P 1.5)] / opponent FGA, with the league FG% of the
   same window. Groups: rim, rest of paint, mid-range + baseline, corner 3, arc 3. An estimate from zones; it does not include defender pressure. */
const EXP_GROUPS = [['o_zs_rim', 1], ['o_zs_paint', 1], ['o_zm_mid', 1], ['o_zs_corner', 1.5], ['o_zs_arc', 1.5]];
METRICS.push({
  id: 'o_exp_efg', label: 'Opp Expected eFG%', scope: T, kind: 'custom', tags: F, digits: 1, num: null, den: null,
  description: 'Zone-based estimate of opponent eFG%: their attempts in each zone group x the league FG% of that group x the eFG weight, over their attempts. Does not include defender pressure.',
  needs: EXP_GROUPS.map(([k]) => k + '_a'), bench: EXP_GROUPS.map(([k]) => k + '_pct'),
  fn: (s, b) => {
    let A = 0, S_ = 0;
    for (const [k, w] of EXP_GROUPS) { const a = s[k + '_a']; A += a; if (a > 0) { const p = b[k + '_pct']; if (!(p > 0 || p === 0)) return null; S_ += a * (p / 100) * w; } }
    return A > 0 ? 100 * S_ / A : null;
  },
});

/* ---------- direction: which way is better FOR THE ENTITY (+1 higher, -1 lower, 0 style / volume, no judgement) ----------
   Opponent figures (o_*) are better when low, except opponent turnovers (a defence wants them high). The Fantasy lens
   (green = good for the opposing player) is the UI's inversion of this. */
const NEUTRAL = new Set(['fga100', 'a2_rate', 'gp', 'gs', 'min', 'usg', 'ftr', 'load', 'bc', 'a3_rate', 'a3_g', 'a1_g', 'a3_100', 'a1_100', 'pace', 't_a3_rate']);
const LOWER = new Set(['pf_g', 'pf100', 'tov_g', 'tov100', 'tov_pct', 'ctov', 'drtg', 't_tov100']);
for (const m of METRICS) {
  m.direction = NEUTRAL.has(m.id) || /^(o_)?zs_[a-z0-9]+_(made|att|share|a100)$/.test(m.id) ? 0 : LOWER.has(m.id) || (m.scope === 'team' && m.id.startsWith('o_') && m.id !== 'o_tov100') ? -1 : 1;
}
