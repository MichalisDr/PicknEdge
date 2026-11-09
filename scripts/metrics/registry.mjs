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
  net: [[1, 'pts'], [-1, 'misses'], [-1, 'tov']],      // scoring-only contribution
  nonscoring: [[1, 'oreb'], [1, 'dreb'], [1, 'ast'], [1, 'stl'], [1, 'blk'], [1, 'fd'], [-1, 'pf'], [-1, 'blk_against'], [-1, 'tov']],
  pir: [[1, 'net'], [1, 'nonscoring'], [1, 'tov']],    // net + (credits - fouls - blocks against), turnovers counted once in net
};

import { ZONES, SUBS, MAINS, zonesOfSub, zonesOfMain } from './zones.mjs';

// Zone sums (sub-areas and areas) for own figures and the opponent's (o_ prefix); zones themselves are build-time columns z_<zone>_a / _m.
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
  e('nspir', 'Non-scoring PIR / game', P, 'perGame', S('nonscoring'), S('played'), F, 1, 'Everything that is not scoring: rebounds, assists, steals, blocks, fouls drawn minus fouls, blocks against and turnovers, per game.'),
  e('nspir_min', 'Non-scoring PIR / min', P, 'perMin', S('nonscoring'), null, F, 3, 'Non-scoring PIR per minute played.'),
  e('net_pir_usg', 'NET PIR / USG', P, 'ratio', S('net'), S('used'), F, 3, 'Scoring-only contribution (points - misses - turnovers) per possession used (shot attempts + free-throw trips + turnovers).', { mult: 1 }),

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
METRICS.push(...zoneEntries(P, '', '', '', FB), ...zoneEntries(T, '', 't_', '', B), ...zoneEntries(T, 'o_', 'o_', 'Opp ', FB));

/* ---------- direction: which way is better FOR THE ENTITY (+1 higher, -1 lower, 0 style / volume, no judgement) ----------
   Opponent figures (o_*) are better when low, except opponent turnovers (a defence wants them high). The Fantasy lens
   (green = good for the opposing player) is the UI's inversion of this. */
const NEUTRAL = new Set(['gp', 'gs', 'min', 'usg', 'ftr', 'load', 'bc', 'a3_rate', 'a3_g', 'a1_g', 'a3_100', 'a1_100', 'pace', 't_a3_rate']);
const LOWER = new Set(['pf_g', 'pf100', 'tov_g', 'tov100', 'tov_pct', 'ctov', 'drtg', 't_tov100']);
for (const m of METRICS) {
  m.direction = NEUTRAL.has(m.id) ? 0 : LOWER.has(m.id) || (m.scope === 'team' && m.id.startsWith('o_') && m.id !== 'o_tov100') ? -1 : 1;
}
