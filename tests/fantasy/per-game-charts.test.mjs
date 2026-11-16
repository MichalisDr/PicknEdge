// The card's bars chart and the table's hover sparkline, drawn from the generated data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { useRealData } from '../helpers/site-data.mjs';

useRealData();
const { loadSeries } = await import('../../site/core/game-series.js');
const { barsChart } = await import('../../site/fantasy/cards/bars-chart.js');
const { sparkline } = await import('../../site/fantasy/tables/game-sparkline.js');
const { Data } = await import('../../site/core/data.js');

test('bars chart: one bar and one round label per game, rolling 5 on the last 5 rounds, window and season lines with names and values', async () => {
  const s = await loadSeries('teams', 'ZAL', 'pace'), m = s.metric, v = (await Data.view('teams', 'l5')).get('ZAL', 'pace').value;
  const html = barsChart(s, m, { windowLabel: 'Last 5', windowValue: v, seasonValue: s.average, isSeason: false });
  assert.equal((html.match(/class="fw-bar"/g) || []).length, s.points.length);
  assert.equal((html.match(/>R[0-9]+</g) || []).length, s.points.length);
  assert.equal((html.match(/class="fw-roll [a-z]+" points="([^"]*)"/)[1].split(' ')).length, 5);
  assert.ok(html.includes(`data-tip="Last 5 ${v.toFixed(1)}"`) && html.includes(`data-tip="Season ${s.average.toFixed(1)}"`));
  assert.ok(html.includes('fw-avg-season') && !html.includes('Per game'));
  const season = barsChart(s, m, { windowValue: s.average, seasonValue: s.average, isSeason: true });
  assert.equal((season.match(/class="fw-ln"/g) || []).length, 1, 'window = Season: one line');
});

test('bars chart: a player who missed games has fewer bars than slots', async () => {
  const p = await Data.games('players'), t = await Data.games('teams'), n = {}, gp = {};
  for (const r of t) n[r.team] = (n[r.team] || 0) + 1;
  for (const r of p) gp[r.player_id] = (gp[r.player_id] || 0) + 1;
  const id = p.find(r => gp[r.player_id] < n[r.team] - 1).player_id, s = await loadSeries('players', id, 'pts_g'), html = barsChart(s, s.metric);
  assert.equal((html.match(/class="fw-bar"/g) || []).length, gp[id]);
  assert.ok(s.points.length > gp[id]);
});

test('sparkline: lines only (faint games, bold rolling 5 with the last point marked, one dashed window line), no title, value or text', async () => {
  const s = await loadSeries('teams', 'ZAL', 'ortg'), html = sparkline(s, (await Data.view('teams', 'l5')).get('ZAL', 'ortg').value);
  assert.ok(html.includes('fw-spark-game') && html.includes('fw-spark-dot'));
  assert.equal((html.match(/class="fw-avg"/g) || []).length, 1);
  assert.equal((html.match(/class="fw-roll [a-z]+"/g) || []).length, 1);
  assert.ok(!/<text|<strong|<p>/.test(html) && html.startsWith('<svg'));
});

const xs = (html, cls) => { const m = html.match(new RegExp('<line class="' + cls + '" x1="([0-9.]+)" x2="([0-9.]+)"')); return [+m[1], +m[2]]; };

test('bars chart: the window line covers the first to the last bar of the window; the season line stays full width; Season = one full-width line', async () => {
  const s = await loadSeries('teams', 'ZAL', 'pace'), m = s.metric, bar = i => { const r = [...barsChart(s, m).matchAll(/class="fw-bar" x="([0-9.]+)" y="[0-9.]+" width="([0-9.]+)"/g)][i]; return [+r[1], +r[1] + +r[2]]; };
  const opts = n => ({ windowLabel: 'Last ' + n, windowValue: s.window(n).value, seasonValue: s.average, isSeason: false, windowGames: n });
  for (const n of [3, 5, 10]) {
    const html = barsChart(s, m, opts(n)), [x1, x2] = xs(html, 'fw-avg'), count = s.points.length;
    assert.ok(Math.abs(x1 - bar(count - n)[0]) < 0.11 && Math.abs(x2 - bar(count - 1)[1]) < 0.11, 'Last ' + n);
    const [s1, s2] = xs(html, 'fw-avg-season'), [a1, a2] = xs(barsChart(s, m, { windowValue: s.average, seasonValue: s.average, isSeason: true }), 'fw-avg');
    assert.equal(s1, a1); assert.equal(s2, a2);
    assert.ok(x1 > s1 && x2 < s2);
  }
});

test('sparkline: the dashed window line covers only the window part, the Season the full width', async () => {
  const s = await loadSeries('teams', 'ZAL', 'ortg'), all = xs(sparkline(s, 100), 'fw-avg'), l3 = xs(sparkline(s, 100, { windowGames: 3 }), 'fw-avg');
  assert.ok(l3[0] > all[0] && l3[1] === all[1]);
  assert.ok(Math.abs((l3[1] - l3[0]) / (all[1] - all[0]) - 2 / (s.points.length - 1)) < 0.01);
});
