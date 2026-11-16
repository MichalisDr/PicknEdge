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
  assert.equal((html.match(/class="fw-roll" points="([^"]*)"/)[1].split(' ')).length, 5);
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
  assert.equal((html.match(/class="fw-roll"/g) || []).length, 1);
  assert.ok(!/<text|<strong|<p>/.test(html) && html.startsWith('<svg'));
});
