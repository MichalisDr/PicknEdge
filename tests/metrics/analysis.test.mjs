// Matchup verdict, with/without selection and the Venn, hand-checked. Run: node --test tests/metrics
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchup, classify } from '../../scripts/metrics/matchup.mjs';
import { withWithout } from '../../scripts/metrics/samples.mjs';
import { venn } from '../../scripts/metrics/venn.mjs';

test('matchup: classes read the thresholds, negative sources the other way round', () => {
  assert.equal(classify(1.08, false), 'give'); assert.equal(classify(0.92, false), 'cut'); assert.equal(classify(1.0, false), 'neu');
  assert.equal(classify(1.2, true), 'cut'); assert.equal(classify(0.8, true), 'give'); assert.equal(classify(null, false), 'na');
});

test('matchup verdict: the main source overrides a flat weighted total', () => {
  // 2P +4 per game (factors 1.2 / 1.1 -> 1.15 give), AST +2 (0.8 / 0.8 -> cut), turnovers -1 (1.2 / 1.2 -> cut for a negative source)
  const r = matchup({ '2P': 4, '3P': 0, FT: 0, FD: 0, DREB: 0, OREB: 0, AST: 2, STL: 0, TOV: -1, PF: 0 },
    { '2P': [1.2, 1.1], AST: [0.8, 0.8], TOV: [1.2, 1.2] });
  assert.equal(r.posTotal, 6);
  assert.equal(r.main.k, '2P');
  // weighted = 4/6 x 0.15 + 2/6 x (-0.2) - 0.2 x 1 / 6 = 0.1 - 0.0667 - 0.0333 = 0
  assert.ok(Math.abs(r.weighted) < 1e-12);
  assert.equal(r.overall, 'fav');                                   // the total is neutral but the main source is "given"
  assert.equal(r.sources.find(s => s.k === '2P').c, 'give');
  assert.equal(r.sources.find(s => s.k === 'AST').c, 'cut');
  assert.equal(r.sources.find(s => s.k === 'TOV').c, 'cut');
});

test('matchup verdict: weighted total decides when the main source is neutral or absent', () => {
  const r = matchup({ '2P': 0, '3P': 0, FT: 0, FD: 3, DREB: 0, OREB: 0, AST: 0, STL: 1, TOV: 0, PF: 0 }, { FD: [1.0, 1.0] });
  assert.equal(r.main.k, 'FD'); assert.equal(r.overall, 'neu');
  const none = matchup({ '2P': 0, '3P': 0, FT: 0, FD: 0, DREB: 0, OREB: 0, AST: 0, STL: 2, TOV: 0, PF: 0 }, {});
  assert.equal(none.main, null); assert.equal(none.overall, 'neu');
});

test('with / without: games before the teammate first appearance are neither', () => {
  // team A played games 1..6 (rounds 1..6). Me: played 1..6. Mate: first appearance in game 3, played 3 and 5.
  const row = (p, g, team = 'A') => ({ player_id: p, team, game: g });
  const rowsBy = new Map([['me', [1, 2, 3, 4, 5, 6].map(g => row('me', g))], ['mate', [3, 5].map(g => row('mate', g))], ['other', [row('other', 1, 'B')]]]);
  const roundOf = new Map([['A', new Map([1, 2, 3, 4, 5, 6].map(g => [g, g]))]]);
  const teamOf = new Map([['me', 'A'], ['mate', 'A'], ['other', 'B']]);
  const res = withWithout('me', rowsBy, roundOf, teamOf);
  assert.equal(res.length, 1);                                      // a player of another team is not a teammate
  assert.equal(res[0].pid, 'mate');
  assert.deepEqual(res[0].withRows.map(r => r.game), [3, 5]);       // he played in 3 and 5
  assert.deepEqual(res[0].withoutRows.map(r => r.game), [4, 6]);    // absent in 4 and 6; games 1 and 2 are before his first appearance
});

test('venn: percentile cut-offs and region counts (hand-checked, 10 players)', () => {
  // values[0] = i (top 30% = 7, 8, 9), values[1] = 9 - i (bottom 30% = 0, 1, 2 -> i = 7, 8, 9), values[2] = i % 5 (top 30%: cut 3 -> i = 3, 4, 8, 9)
  const items = Array.from({ length: 10 }, (_, i) => ({ id: 'p' + i, values: [i, 9 - i, i % 5] }));
  items.push({ id: 'missing', values: [1, 2, NaN] });
  const r = venn(items, [{ dir: 'high', pct: 30 }, { dir: 'low', pct: 30 }, { dir: 'high', pct: 30 }]);
  assert.equal(r.n, 10); assert.equal(r.unavailable, 1);
  assert.deepEqual(r.cuts, [7, 2, 3]);
  assert.deepEqual(r.counts, [3, 3, 4]);
  assert.deepEqual(Object.fromEntries(Object.entries(r.regions).filter(([, v]) => v.n).map(([k, v]) => [k, v.ids])), { '000': ['p0', 'p1', 'p2', 'p5', 'p6'], '001': ['p3', 'p4'], '110': ['p7'], '111': ['p8', 'p9'] });
});
