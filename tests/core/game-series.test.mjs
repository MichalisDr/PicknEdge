// The per-game series (core/game-series.js): gaps for games not played, the rolling length of each table window, and the last point of a window
// equal to the table cell of that window (for a count metric and a ratio metric, players and a team).
import test from 'node:test';
import assert from 'node:assert/strict';
import { useRealData } from '../helpers/site-data.mjs';

useRealData();
const { Data } = await import('../../site/core/data.js');
const { loadSeries, buildSeries, trendOf, TREND_FLAT_BELOW, TREND_TOKEN } = await import('../../site/core/game-series.js');
const WIN = { l10: 10, l5: 5, l3: 3 };

/** Two players with gaps (they missed team games) and at least 4 games, preferring the most games played. */
async function pickPlayers() {
  const p = await Data.games('players'), t = await Data.games('teams'), games = {}, gp = {}, team = {};
  for (const r of t) games[r.team] = (games[r.team] || 0) + 1;
  for (const r of p) { gp[r.player_id] = (gp[r.player_id] || 0) + 1; team[r.player_id] = r.team; }
  const ok = Object.keys(gp).filter(id => gp[id] >= 4 && gp[id] < games[team[id]]).sort((a, b) => gp[b] - gp[a]);
  assert.ok(ok.length >= 2, 'needs two players who missed games');
  return ok.slice(0, 2);
}

test('recentRolling is always rolling 5, over the last 5 rounds only (fewer when fewer exist)', () => {
  const rows = [1, 2, 3, 4, 5, 6, 7].map(game => ({ game, v: game }));
  const evaluate = (def, list) => ({ value: list.length ? list.reduce((n, r) => n + r.v, 0) / list.length : null });
  const roll = n => buildSeries({ slots: Array.from({ length: n }, (_, i) => ({ game: i + 1 })), rows, def: {}, evaluate }).recentRolling();
  assert.deepEqual(roll(7), [null, null, null, null, 3, 4, 5]);   // the last 5 slots; rounds 1-4 have no rolling 5 yet
  assert.deepEqual(roll(5), [null, null, null, null, 3]);   // the first point is at round 5
});

test('a game not played is an empty slot, and rolling has one value per slot (null before n games)', async () => {
  const [id] = await pickPlayers(), s = await loadSeries('players', id, 'pts_g'), gp = (await Data.games('players')).filter(r => r.player_id === id).length;
  assert.equal(s.points.filter(p => p.played).length, gp);
  assert.ok(s.points.some(p => !p.played && p.value === null), 'a missed game has no value');
  for (const n of [3, 5, 10]) {
    const roll = s.rolling(n);
    assert.equal(roll.length, s.points.length);
    assert.ok(roll.slice(0, n - 1).every(v => v === null));
    assert.ok(Number.isFinite(roll.at(-1)));
  }
});

test('buildSeries: rolling is computed from the window totals, not from per-game values', () => {
  const rows = [{ game: 1, a: 1, d: 2 }, { game: 2, a: 3, d: 4 }, { game: 3, a: 5, d: 6 }];
  const evaluate = (def, list) => ({ value: list.length ? list.reduce((n, r) => n + r.a, 0) / list.reduce((n, r) => n + r.d, 0) : null });
  const s = buildSeries({ slots: [1, 2, 3, 4].map(game => ({ game })), rows, def: {}, evaluate });
  assert.deepEqual(s.points.map(p => p.played), [true, true, true, false]);
  assert.equal(s.rolling(2)[2], 8 / 10);                 // (3 + 5) / (4 + 6), not the mean of 3/4 and 5/6
  assert.equal(s.rolling(2)[3], 5 / 6);                  // the missed game 4 is empty: only game 3 is in the window
  assert.equal(s.window(2).used, 1);
});

for (const [metric, kind] of [['fg3_made', 'count'], ['ts_pct', 'ratio']]) {
  test(`the last rolling point equals the table cell of Last 10 / 5 / 3 (${kind}: ${metric}), two players`, async () => {
    for (const id of await pickPlayers()) {
      const s = await loadSeries('players', id, metric), line = [];
      for (const [w, n] of Object.entries(WIN)) {
        const cell = (await Data.view('players', w)).get(id, metric).value;
        assert.ok(Math.abs(s.rolling(n).at(-1) - cell) < 1e-5, `${id} ${metric} ${w}`);
        assert.ok(Math.abs(s.window(n).value - cell) < 1e-5);
        line.push(`${w} ${cell.toFixed(3)}`);
      }
      console.log(`  ${(await Data.roster()).players[id].name} · ${metric}: last rolling point = cell (${line.join(', ')})`);
    }
  });
}

test('teams: the last rolling point equals the table cell (Pace, a ratio)', async () => {
  const s = await loadSeries('teams', 'ZAL', 'pace'), line = [];
  assert.equal(s.metric.chartScale, 'range');
  assert.ok(s.points.every(p => p.played && Number.isFinite(p.value)));
  for (const [w] of Object.entries(WIN)) {
    const cell = (await Data.view('teams', w)).get('ZAL', 'pace').value;
    assert.ok(Math.abs(s.rolling(WIN[w]).at(-1) - cell) < 1e-5, w);
    line.push(`${w} ${cell.toFixed(3)}`);
  }
  console.log(`  ZAL · pace: last rolling point = cell (${line.join(', ')})`);
});

test('the metric config decides the bars scale: counts, PIR and per-100 from zero, % and Pace on the data range', async () => {
  const { byId } = await Data.metrics();
  assert.deepEqual(['pts_g', 'pir', 'pts100', 'ortg'].map(id => byId[id].chartScale), ['zero', 'zero', 'zero', 'zero']);
  assert.deepEqual(['ts_pct', 'efg', 'pace', 'o_efg'].map(id => byId[id].chartScale), ['range', 'range', 'range', 'range']);
});

test('Elijah Bryant, PIR: window averages equal the table cells; rolling 5 over the last 5 rounds ends on the Last 5 value', async () => {
  const roster = await Data.roster(), id = Object.keys(roster.players).find(k => roster.players[k].name === 'Elijah Bryant');
  assert.ok(id, 'Elijah Bryant is in the roster');
  const s = await loadSeries('players', id, 'pir'), out = [];
  for (const [w, n] of [['season', Infinity], ['l10', 10], ['l5', 5], ['l3', 3]]) {
    const cell = (await Data.view('players', w)).get(id, 'pir').value;
    assert.ok(Math.abs(s.window(n).value - cell) < 1e-5, w);
    out.push(w + ' ' + cell.toFixed(1));
  }
  const roll = s.recentRolling(), shown = roll.filter(v => v !== null);
  assert.ok(roll.length - roll.findLastIndex(v => v !== null) === 1 && shown.length <= 5);
  assert.ok(Math.abs(shown.at(-1) - (await Data.view('players', 'l5')).get(id, 'pir').value) < 1e-5);
  console.log('  Elijah Bryant PIR: ' + out.join(', ') + ' | rolling 5, last 5 rounds: ' + shown.map(v => v.toFixed(1)).join(', '));
  console.log('  per game (round: PIR): ' + s.points.map(p => 'R' + p.round + ': ' + (p.value === null ? '-' : p.value)).join(', '));
});

test('trendOf: up, down, flat inside the threshold, lower-is-better swaps the colours, zero values', () => {
  assert.equal(TREND_FLAT_BELOW, 0.04);
  assert.deepEqual(['trend', 'tone'].map(k => trendOf([10, 11, 12], 1)[k]), ['up', 'good']);
  assert.deepEqual(['trend', 'tone'].map(k => trendOf([12, 11, 10], 1)[k]), ['down', 'bad']);
  assert.deepEqual(['trend', 'tone'].map(k => trendOf([10, 11, 12], -1)[k]), ['up', 'bad']);      // lower is better: a rise is bad
  assert.deepEqual(['trend', 'tone'].map(k => trendOf([12, 11, 10], -1)[k]), ['down', 'good']);
  assert.equal(trendOf([100, 103.9], 1).tone, 'flat');                                              // 3.9 / 103.9 < 0.04
  assert.equal(trendOf([100, 104.5], 1).trend, 'up');                                               // 4.5 / 104.5 > 0.04
  assert.equal(trendOf([0, 0, 0], 1).tone, 'flat');                                                 // both 0
  assert.equal(trendOf([0, 5], 1).trend, 'up');                                                     // from 0: change = 1
  assert.equal(trendOf([-5, 5], 1).trend, 'up');                                                    // sign change: 10 / 5 = 2
  assert.deepEqual(trendOf([null, 4, null, 5, 6], 1).trend, 'up');                                  // gaps ignored
  assert.equal(trendOf([1], 1).tone, 'flat');
  assert.equal(trendOf([1, 9], 0).tone, 'flat');                                                    // no direction, no judgement
  assert.equal(trendOf([1, 9], 1).token, 'fantasy.stat-table.value-good.text');
});

test('trend of the shown rolling line: Bryant PIR and a lower-is-better metric, from the rule itself (no data-of-the-day expectation)', async () => {
  // What the line shows comes from the one trendOf; here the expectation is computed from the same series by the documented rule, so a data update cannot break it.
  const expected = (rolling, direction) => {
    const v = rolling.filter(x => x !== null && Number.isFinite(x)), first = v[0], last = v.at(-1), top = Math.max(Math.abs(first), Math.abs(last));
    const change = top === 0 ? 0 : (last - first) / top;
    const trend = Math.abs(change) < TREND_FLAT_BELOW ? 'flat' : change > 0 ? 'up' : 'down';
    const tone = trend === 'flat' || !direction ? 'flat' : (trend === 'up') === (direction > 0) ? 'good' : 'bad';
    return { change, trend, tone, token: TREND_TOKEN[tone] };
  };
  const roster = await Data.roster(), id = Object.keys(roster.players).find(k => roster.players[k].name === 'Elijah Bryant');
  assert.ok(id, 'Elijah Bryant is in the roster');
  const pir = await loadSeries('players', id, 'pir'), a = trendOf(pir.recentRolling(), pir.metric.direction);
  assert.equal(pir.metric.direction, 1);
  assert.deepEqual(a, expected(pir.recentRolling(), pir.metric.direction));
  const tov = await loadSeries('players', id, 'tov_g'), b = trendOf(tov.recentRolling(), tov.metric.direction);
  assert.equal(tov.metric.direction, -1);
  assert.deepEqual(b, expected(tov.recentRolling(), tov.metric.direction));
  console.log(`  Bryant PIR rolling ${pir.recentRolling().filter(v => v !== null).map(v => v.toFixed(1)).join(' -> ')}: change ${(a.change * 100).toFixed(1)}%, ${a.trend}, ${a.tone} (${a.token})`);
  console.log(`  Bryant TOV / game (direction -1) rolling ${tov.recentRolling().filter(v => v !== null).map(v => v.toFixed(1)).join(' -> ')}: change ${(b.change * 100).toFixed(1)}%, ${b.trend}, ${b.tone} (${b.token})`);
});
