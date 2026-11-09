// Hand-checked examples, one per metric. Run: node --test tests/metrics
import test from 'node:test';
import assert from 'node:assert/strict';
import { byId, evaluate } from '../../scripts/metrics/engine.mjs';
import { METRICS } from '../../scripts/metrics/registry.mjs';

const row = o => ({ played: 1, ...o });
const val = (id, rows) => evaluate(byId(id), rows);

test('pts100 = Σpoints / Σoffensive possessions on court × 100 (not an average of ratios)', () => {
  const a = row({ m1: 2, m2: 3, m3: 1, poss_off_on: 50 });   // 2 + 6 + 3 = 11 pts -> 22.0 per 100
  const b = row({ m1: 0, m2: 2, m3: 2, poss_off_on: 30 });   // 0 + 4 + 6 = 10 pts -> 33.3 per 100
  assert.equal(val('pts100', [a]).value, 22);
  assert.equal(val('pts100', [a, b]).value, 26.25);           // 21 / 80 × 100; the average of ratios would be 27.67
});

test('pts100 skips games without on-court data and reports coverage', () => {
  const a = row({ m1: 2, m2: 3, m3: 1, poss_off_on: 50 });
  const b = row({ m1: 0, m2: 2, m3: 2, poss_off_on: null });
  assert.deepEqual(val('pts100', [a, b]), { value: 22, used: 1, of: 2 });
});

test('dreb_pct = DREB / (team DREB + opponent OREB) on court', () => {
  assert.equal(val('dreb_pct', [row({ dreb: 4, team_dreb_on: 10, opp_oreb_on: 5 })]).value, 100 * 4 / 15);
  const two = [row({ dreb: 4, team_dreb_on: 10, opp_oreb_on: 5 }), row({ dreb: 2, team_dreb_on: 6, opp_oreb_on: 4 })];
  assert.equal(val('dreb_pct', two).value, 100 * 6 / 25);
});

test('tov_pct = TOV / (SA + TOV)', () => {
  assert.equal(val('tov_pct', [row({ tov: 2, sa: 8 })]).value, 20);
  assert.equal(val('tov_pct', [row({ tov: 2, sa: 8 }), row({ tov: 1, sa: 9 })]).value, 100 * 3 / 20);
});

test('usg = (SA + TOV) / (team SA + team TOV on court)', () => {
  assert.equal(val('usg', [row({ sa: 8, tov: 2, team_sa_on: 40, team_tov_on: 10 })]).value, 20);
});

test('pir = points + other credits - misses - debits (hand-checked row, equals official 13)', () => {
  const r = row({ m1: 2, a1: 3, m2: 4, a2: 6, m3: 1, a3: 3, oreb: 1, dreb: 3, ast: 2, stl: 1, blk: 0, fd: 4, tov: 2, pf: 3, blk_against: 1 });
  assert.equal(val('pir', [r]).value, 13);               // pts 13, misses 5: 13 - 5 + 1 + 3 + 2 + 1 + 0 + 4 - 2 - 3 - 1
});

test('players who did not play are not counted', () => {
  assert.deepEqual(val('usg', [{ played: 0, sa: 0, tov: 0, team_sa_on: null, team_tov_on: null }]), { value: null, used: 0, of: 0 });
});

test('every registry entry is well formed', () => {
  const ids = new Set();
  for (const m of METRICS) {
    assert.ok(!ids.has(m.id), `duplicate id ${m.id}`); ids.add(m.id);
    for (const k of ['id', 'label', 'scope', 'kind', 'tags', 'description']) assert.ok(m[k], `${m.id}: missing ${k}`);
    assert.ok(['player', 'team', 'position'].includes(m.scope) && ['per100', 'pct', 'perGame', 'perMin', 'ratio', 'count', 'custom'].includes(m.kind), `${m.id}: scope/kind`);
    assert.ok([-1, 0, 1].includes(m.direction), `${m.id}: direction`);
    if (m.kind === 'custom') { assert.ok(m.needs?.length && typeof m.fn === 'function', `${m.id}: custom needs needs + fn`); if (m.bench) assert.ok(m.bench.every(id => METRICS.some(x => x.id === id)), `${m.id}: bench ids exist`); }
    else { assert.ok(m.num, `${m.id}: num`); if (!['count', 'perMin'].includes(m.kind)) assert.ok(m.den, `${m.id}: den`); }
  }
});
