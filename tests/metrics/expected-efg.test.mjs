// Hand-checked cases for the expected opponent eFG. Run: node --test tests/metrics
import test from 'node:test';
import assert from 'node:assert/strict';
import { byId, evaluate } from '../../scripts/metrics/engine.mjs';
import { METRICS } from '../../scripts/metrics/registry.mjs';

const approx = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

// ---- expected opponent eFG% from zones and the league benchmark ----
const Z = { o_z_rim_a: 10, o_z_paint_a: 5, o_z_midL_a: 2, o_z_midC_a: 2, o_z_midR_a: 0, o_z_baseL_a: 0, o_z_baseR_a: 1, o_z_cornerL_a: 3, o_z_cornerR_a: 1, o_z_arcL_a: 2, o_z_arcC_a: 3, o_z_arcR_a: 1 };
const BENCH = { o_zs_rim_pct: 60, o_zs_paint_pct: 40, o_zm_mid_pct: 40, o_zs_corner_pct: 40, o_zs_arc_pct: 35 };
test('expected eFG% = 100 x Σ(attempts x league FG% x weight) / attempts (hand-checked 51.83)', () => {
  // rim 10 x .60 + paint 5 x .40 + mid 5 x .40 + corner 4 x .40 x 1.5 + arc 6 x .35 x 1.5 = 15.55 over 30 attempts
  approx(evaluate(byId('o_exp_efg'), [Z], BENCH).value, 100 * 15.55 / 30);
  assert.equal(evaluate(byId('o_exp_efg'), [Z]).value, null, 'no benchmark, no value');
});
