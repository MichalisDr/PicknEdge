// The card's bars chart and the table's hover sparkline, drawn from the generated data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { useRealData } from '../helpers/site-data.mjs';

useRealData();
const { loadSeries } = await import('../../site/core/game-series.js');
const { barsChart } = await import('../../site/fantasy/cards/bars-chart.js');
const { sparkline } = await import('../../site/fantasy/tables/game-sparkline.js');
const { Data } = await import('../../site/core/data.js');

test('bars chart: one bar and one round label per game, season line and rolling line, no grid lines', async () => {
  const s = await loadSeries('teams', 'ZAL', 'pace'), html = barsChart(s, s.metric);
  assert.equal((html.match(/class="fw-bar"/g) || []).length, s.points.length);
  assert.equal((html.match(/>R\d+</g) || []).length, s.points.length);
  assert.ok(html.includes('class="fw-avg"') && html.includes('class="fw-roll"'));
});

test('bars chart: a player who missed games has fewer bars than slots', async () => {
  const p = await Data.games('players'), t = await Data.games('teams'), n = {}, gp = {};
  for (const r of t) n[r.team] = (n[r.team] || 0) + 1;
  for (const r of p) gp[r.player_id] = (gp[r.player_id] || 0) + 1;
  const id = p.find(r => gp[r.player_id] < n[r.team] - 1).player_id, s = await loadSeries('players', id, 'pts_g'), html = barsChart(s, s.metric);
  assert.equal((html.match(/class="fw-bar"/g) || []).length, gp[id]);
  assert.ok(s.points.length > gp[id]);
});

test('sparkline: faint game line, bold rolling line with the last point marked, dashed season line, no text', async () => {
  const s = await loadSeries('teams', 'ZAL', 'ortg'), html = sparkline(s, s.metric, 5);
  assert.ok(html.includes('fw-spark-game') && html.includes('class="fw-roll"') && html.includes('fw-spark-dot') && html.includes('class="fw-avg"'));
  assert.ok(!/<text/.test(html) && html.includes('Rolling 5'));
});
