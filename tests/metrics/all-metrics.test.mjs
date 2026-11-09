// One hand-checked case per registry metric. Expected values are written as the arithmetic on the fixture numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { byId, evaluate } from '../../scripts/metrics/engine.mjs';
import { METRICS } from '../../scripts/metrics/registry.mjs';

// One player-game: 30 min; 19 pts (3 FT, 5 two, 2 three); 16 shot attempts (SA); on court for 50 own / 48 opponent possessions.
const P = { played: 1, sec: 1800, m1: 3, a1: 4, m2: 5, a2: 9, m3: 2, a3: 5, oreb: 1, dreb: 4, ast: 3, stl: 2, blk: 1, tov: 2, blk_against: 1, pf: 3, fd: 5,
  starter: 1, team_fgm_on: 15, opp_a2_on: 30, sa: 16, team_sa_on: 40, team_tov_on: 10, poss_off_on: 50, poss_def_on: 48, team_oreb_on: 8, team_dreb_on: 20, opp_oreb_on: 10, opp_dreb_on: 25 };
// PTS = 3 + 10 + 6 = 19; misses = 1 + 4 + 3 = 8; non scoring PIR = (1+4+3+2+1+5) - 3 - 1 - 2 = 10; PIR = 19 - 8 + 10 = 21.
const approx = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

const PLAYER = {
  gs: 1, oreb_g: 1, dreb_g: 4, m3_g: 2, a3_g: 5, a1_g: 4, m3_100: 2 / 50 * 100, a3_100: 5 / 50 * 100, a1_100: 4 / 50 * 100, pf100: 3 / 48 * 100,
  ast_pct: 3 / (15 - (5 + 2)) * 100, blk_pct: 1 / 30 * 100, a3_rate: 5 / 14 * 100,
  gp: 1, min: 30, pts_g: 19, reb_g: 5, ast_g: 3, stl_g: 2, blk_g: 1, tov_g: 2, fd_g: 5, pf_g: 3,
  pts100: 19 / 50 * 100, ast100: 3 / 50 * 100, tov100: 2 / 50 * 100, oreb100: 1 / 50 * 100, fd100: 5 / 50 * 100,
  stl100: 2 / 48 * 100, blk100: 1 / 48 * 100, dreb100: 4 / 48 * 100, reb100: 5 * 200 / (50 + 48),
  usg: (16 + 2) / (40 + 10) * 100, tov_pct: 2 / (16 + 2) * 100, oreb_pct: 1 / (8 + 25) * 100, dreb_pct: 4 / (20 + 10) * 100,
  efg: (5 + 1.5 * 2) / 14 * 100, fg2_pct: 5 / 9 * 100, fg3_pct: 2 / 5 * 100, ft_pct: 3 / 4 * 100, ftr: 4 / 14 * 100, ts_pct: 19 / (2 * (14 + 0.44 * 4)) * 100,
  pir: 21, pir_min: 21 / 30, nspir100: 10 * 200 / (50 + 48),   // nsPIR = 10 (see above): x200 / (offensive + defensive possessions on court)
};
// Box Creation by hand: k = 2; AST = 6; PTS+TOV = 42; proficiency = (2/(1+e^-10) - 1) x 0.4 = 0.39996;
// BC = 0.1843x6 + 0.0969x42 - 2.3021x0.39996 + 0.0582x6x42x0.39996 - 1.1942 = 8.9267
// Load = (6 - 0.38x8.9267) x 0.75 + 16x2 + 8.9267 + 2x2 = 46.8824;  cTOV% = 100 x (2x100/50) / 46.8824 = 8.532
const RADAR_NET = { ft: 2 * 3 - 4, '2p': 3 * 5 - 9, '3p': 4 * 2 - 5, ast: 3 - 2, dreb: 4, oreb: 1, stlblk: 2 + 1 - 1, fd: 5 - 3 };
const RADAR_GROSS = { ft: 3, '2p': 10, '3p': 6, ast: 3, dreb: 4, oreb: 1, stlblk: 2 + 1, fd: 5 };   // positive contributions only
for (const [k, v] of Object.entries(RADAR_GROSS)) {
  PLAYER['rg_' + k + '_g'] = v;
  PLAYER['rg_' + k + '_100'] = k === 'dreb' ? v / 48 * 100 : k === 'stlblk' || k === 'fd' ? v * 200 / (50 + 48) : v / 50 * 100;
}
for (const [k, v] of Object.entries(RADAR_NET)) {
  PLAYER['rd_' + k + '_g'] = v;
  PLAYER['rd_' + k + '_100'] = k === 'dreb' ? v / 48 * 100 : k === 'stlblk' || k === 'fd' ? v * 200 / (50 + 48) : v / 50 * 100;
}
const PLAYER_APPROX = { bc: [8.9267, 1e-3], load: [46.8824, 1e-3], ctov: [8.532, 5e-3] };

// One team-game: 76 pts (12/16 FT, 20/40 two, 8/25 three), 70 possessions; opponent 73 pts, 68 possessions.
const T = { games: 1, sec: 2400, poss: 70, o_poss: 68, m1: 12, a1: 16, m2: 20, a2: 40, m3: 8, a3: 25, oreb: 9, dreb: 24, ast: 15, stl: 7, tov: 12, blk: 3,
  o_m1: 10, o_a1: 14, o_m2: 18, o_a2: 35, o_m3: 9, o_a3: 28, o_oreb: 11, o_dreb: 22, o_ast: 17, o_stl: 8, o_tov: 14, o_blk: 4,
  o_z_rim_a: 20, o_z_cornerL_a: 5, o_z_cornerR_a: 3, pts_fastbreak: 10, pts_second_chance: 12, pts_off_turnover: 14, o_pts_fastbreak: 8, o_pts_second_chance: 9, o_pts_off_turnover: 16 };
const TEAM_EXTRA = { share: 100 * 3 / 8 };
const TEAM = {
  pace: (70 + 68) * 1200 / 2400, ortg: 76 / 70 * 100, drtg: 73 / 68 * 100, t_pts_g: 76, o_pts_g: 73,
  t_efg: (20 + 12) / 65 * 100, o_efg: (18 + 13.5) / 63 * 100, t_fg2_pct: 20 / 40 * 100, o_fg2_pct: 18 / 35 * 100, t_fg3_pct: 8 / 25 * 100, o_fg3_pct: 9 / 28 * 100,
  t_ftr: 16 / 65 * 100, o_ftr: 14 / 63 * 100, t_a3_rate: 25 / 65 * 100, o_a3_rate: 28 / 63 * 100,
  t_oreb_pct: 9 / (9 + 22) * 100, t_dreb_pct: 24 / (24 + 11) * 100,
  t_tov100: 12 / 70 * 100, o_tov100: 14 / 68 * 100, t_ast100: 15 / 70 * 100, o_ast100: 17 / 68 * 100,
  t_stl100: 7 / 68 * 100, o_stl100: 8 / 70 * 100, t_blk_pct: 3 / 35 * 100, o_blk_pct: 4 / 40 * 100,
  o_rim_rate: 20 / 63 * 100, o_corner3_rate: (5 + 3) / 63 * 100,
  t_fb100: 10 / 70 * 100, o_fb100: 8 / 68 * 100, t_sc100: 12 / 70 * 100, o_sc100: 9 / 68 * 100, t_pot100: 14 / 70 * 100, o_pot100: 16 / 68 * 100,
};

test('every registry metric has a hand-checked case', () => {
  const covered = new Set([...Object.keys(PLAYER), ...Object.keys(PLAYER_APPROX), ...Object.keys(TEAM), ...Object.keys(TEAM_EXTRA)]);
  assert.deepEqual(METRICS.map(m => m.id).filter(id => !covered.has(id) && !/^(t_|o_)?z[sm]?_/.test(id) && !/^rt_|^o_exp_efg$/.test(id)), []);   // zone metrics: zones.test.mjs; team radar and expected eFG: radar-expected.test.mjs
  assert.deepEqual([...covered].filter(id => !METRICS.some(m => m.id === id)), []);
});
for (const [id, want] of Object.entries(PLAYER)) test(`player ${id}`, () => approx(evaluate(byId(id), [P]).value, want));
for (const [id, [want, tol]] of Object.entries(PLAYER_APPROX)) test(`player ${id} (custom, from summed components)`, () => approx(evaluate(byId(id), [P]).value, want, tol));
for (const [id, want] of Object.entries(TEAM)) test(`team ${id}`, () => approx(evaluate(byId(id), [T]).value, want));
test('share = n / of x 100', () => approx(evaluate(byId('share'), [{ n: 3, of: 8 }]).value, TEAM_EXTRA.share));

test('custom metrics use window sums, not per-game results', () => {
  const b = { ...P, ast: 9, m3: 0, a3: 4, sa: 10, tov: 1, poss_off_on: 40 };
  const sum = { ...P };
  for (const k of ['ast', 'm1', 'a1', 'm2', 'a2', 'm3', 'a3', 'tov', 'sa', 'poss_off_on', 'sec']) sum[k] = P[k] + b[k];
  const together = evaluate(byId('load'), [P, b]).value, onSums = evaluate(byId('load'), [sum]).value;
  approx(together, onSums);
  assert.notEqual(together, (evaluate(byId('load'), [P]).value + evaluate(byId('load'), [b]).value) / 2);
});
