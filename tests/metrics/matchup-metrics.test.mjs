// Hand-checked cases for the team radar, expected eFG, matchup (position) and source metrics. Run: node --test tests/metrics
import test from 'node:test';
import assert from 'node:assert/strict';
import { byId, evaluate } from '../../scripts/metrics/engine.mjs';
import { METRICS } from '../../scripts/metrics/registry.mjs';

const approx = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

// ---- team radar: opponent production per 100 opponent possessions (68), rebounds = player-assigned (team rebounds excluded) ----
const T = { o_poss: 68, o_m1: 10, o_a1: 14, o_m2: 18, o_a2: 35, o_m3: 9, o_a3: 28, o_ast: 17, o_blk: 4, o_stl: 8, o_oreb: 11, o_dreb: 22, o_oreb_players: 7, o_dreb_players: 20 };
const RADAR = { rt_2p_100: (3 * 18 - 35) / 68 * 100, rt_3p_100: (4 * 9 - 28) / 68 * 100, rt_ft_100: (2 * 10 - 14) / 68 * 100, rt_ast_100: 17 / 68 * 100,
  rt_dreb_100: 20 / 68 * 100, rt_oreb_100: 7 / 68 * 100, rt_blk_100: 4 / 68 * 100, rt_stl_100: 8 / 68 * 100 };
for (const [id, want] of Object.entries(RADAR)) test(`team radar ${id} (rebounds exclude team rebounds)`, () => approx(evaluate(byId(id), [T]).value, want));

// ---- expected opponent eFG% from zones and the league benchmark ----
const Z = { o_z_rim_a: 10, o_z_paint_a: 5, o_z_midL_a: 2, o_z_midC_a: 2, o_z_midR_a: 0, o_z_baseL_a: 0, o_z_baseR_a: 1, o_z_cornerL_a: 3, o_z_cornerR_a: 1, o_z_arcL_a: 2, o_z_arcC_a: 3, o_z_arcR_a: 1 };
const BENCH = { o_zs_rim_pct: 60, o_zs_paint_pct: 40, o_zm_mid_pct: 40, o_zs_corner_pct: 40, o_zs_arc_pct: 35 };
test('expected eFG% = 100 x Σ(attempts x league FG% x weight) / attempts (hand-checked 51.83)', () => {
  // rim 10 x .60 + paint 5 x .40 + mid 5 x .40 + corner 4 x .40 x 1.5 + arc 6 x .35 x 1.5 = 15.55 over 30 attempts
  approx(evaluate(byId('o_exp_efg'), [Z], BENCH).value, 100 * 15.55 / 30);
  assert.equal(evaluate(byId('o_exp_efg'), [Z]).value, null, 'no benchmark, no value');
});

// ---- matchup: what a team allows to a position (10 minutes of play) and factors against the league ----
const POS = { sec: 600, m2: 4, a2: 9, m3: 2, a3: 6, a1: 5, fd: 3, dreb: 5, oreb: 2, ast: 3, tov: 2 };
const LEAGUE = { pm_m2: .5, pm_a2: .6, pm_a3: .4, pm_a1: .25, pm_fd: .3, pm_dr: .4, pm_or: .2, pm_as: .2, pm_tv: .1, pos_fg2_pct: 50, pos_fg3_pct: 40 };
const PM = { pm_m2: .4, pm_a2: .9, pm_a3: .6, pm_a1: .5, pm_fd: .3, pm_dr: .5, pm_or: .2, pm_as: .3, pm_tv: .2 };
const POSV = { ...PM, pos_fg2_pct: 4 / 9 * 100, pos_fg3_pct: 2 / 6 * 100,
  mu_m2: .4 / .5, mu_a2: .9 / .6, mu_a3: .6 / .4, mu_a1: .5 / .25, mu_fd: 1, mu_dr: .5 / .4, mu_or: 1, mu_as: .3 / .2, mu_tv: .2 / .1, mu_p2: (4 / 9) / .5, mu_p3: (2 / 6) / .4 };
for (const [id, want] of Object.entries(POSV)) test(`position ${id}`, () => approx(evaluate(byId(id), [POS], LEAGUE).value, want));
test('a factor needs the league benchmark and a positive league value', () => {
  assert.equal(evaluate(byId('mu_m2'), [POS]).value, null);
  assert.equal(evaluate(byId('mu_m2'), [POS], { ...LEAGUE, pm_m2: 0 }).value, null);
});

// ---- sources of a player's PIR (negative ones as negatives) and possessions per game ----
const SRC = { src_stlblk_g: 2 + 1, src_tov_g: -2, src_pf_g: -(3 + 1) };
for (const [id, want] of Object.entries(SRC)) test(`player source ${id}`, () => approx(evaluate(byId(id), [{ played: 1, stl: 2, blk: 1, tov: 2, pf: 3, blk_against: 1 }]).value, want));
test('poss_g = possessions per game', () => approx(evaluate(byId('poss_g'), [{ poss: 70, games: 1 }, { poss: 80, games: 1 }]).value, 75));

test('every new metric family has a case here', () => {
  const covered = new Set([...Object.keys(RADAR), 'o_exp_efg', ...Object.keys(POSV), ...Object.keys(SRC), 'poss_g']);
  const want = METRICS.map(m => m.id).filter(id => /^(rt_|pm_|mu_|pos_fg|src_)|^o_exp_efg$|^poss_g$/.test(id));
  assert.deepEqual(want.filter(id => !covered.has(id)), []);
});
