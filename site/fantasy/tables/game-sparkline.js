/* The hover of a main metric value in the tables: title, value, a sparkline of the season's games and a one-line legend. No axes, no labels.
   Faint line = the real value of each game (gaps for games not played); bold line = the rolling value over the table window's length (Season 5, Last 10, 5, 3),
   computed from totals like the cell, its last point marked; dashed line = the season average. The series comes from core/game-series.js. */
import { esc } from '../../core/html.js';
import { size } from '../../core/sizes.js';
import { loadSeries, rollLength } from '../../core/game-series.js';

const segments = (pts, key) => {
  const out = []; let line = [];
  for (const p of pts) { if (Number.isFinite(p[key])) line.push(p); else { out.push(line); line = []; } }
  out.push(line);
  return out.filter(l => l.length);
};
const path = (l, key) => l.map(p => p.x.toFixed(1) + ',' + p[key].toFixed(1)).join(' ');

/** The sparkline and its legend for a series; n = the rolling length. */
export function sparkline(series, m, n) {
  const { points, average } = series, rolling = series.rolling(n), cells = points.map((p, i) => ({ value: p.value, roll: rolling[i] }));
  const all = [...cells.flatMap(c => [c.value, c.roll]), average].filter(Number.isFinite);
  if (!all.some(Number.isFinite) || !points.some(p => Number.isFinite(p.value))) return '<p class="fw-empty">Not enough data for this metric.</p>';
  const W = size('fantasy.player-card.trend-chart.small-plot-width'), H = size('fantasy.player-card.trend-chart.small-plot-height'), pad = size('fantasy.player-card.trend-chart.small-plot-padding');
  const lo = Math.min(...all), span = Math.max(...all) - lo || 1, x = i => pad + (points.length > 1 ? i * (W - 2 * pad) / (points.length - 1) : (W - 2 * pad) / 2), y = v => H - pad - (v - lo) / span * (H - 2 * pad);
  const pts = cells.map((c, i) => ({ x: x(i), value: Number.isFinite(c.value) ? y(c.value) : null, roll: Number.isFinite(c.roll) ? y(c.roll) : null }));
  const lines = key => segments(pts, key);
  const lastRoll = [...pts].reverse().find(p => p.roll !== null), dig = m.format.digits;
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="fw-spark" role="img" aria-label="${esc(m.label)} per game">`
    + (Number.isFinite(average) ? `<line class="fw-avg" x1="${pad}" x2="${W - pad}" y1="${y(average).toFixed(1)}" y2="${y(average).toFixed(1)}"/>` : '')
    + lines('value').map(l => (l.length > 1 ? `<polyline class="fw-spark-game" points="${path(l, 'value')}"/>` : `<circle class="fw-spark-pt" cx="${l[0].x.toFixed(1)}" cy="${l[0].value.toFixed(1)}" r="1.3"/>`)).join('')
    + lines('roll').filter(l => l.length > 1).map(l => `<polyline class="fw-roll" points="${path(l, 'roll')}"/>`).join('')
    + (lastRoll ? `<circle class="fw-spark-dot" cx="${lastRoll.x.toFixed(1)}" cy="${lastRoll.roll.toFixed(1)}" r="3"/>` : '')
    + '</svg>';
  return svg + `<div class="fw-leg"><span><i class="fw-k-g"></i>Per game</span><span><i class="fw-k-r"></i>Rolling ${n}</span>${Number.isFinite(average) ? `<span><i class="fw-k-s"></i>Season ${average.toFixed(dig)}${m.format.suffix}</span>` : ''}</div>`;
}

/** The chart of the hover for a table state: sparkline html of entity `id` and metric `metricId` with the rolling length of the table's window. */
export async function hoverSparkline(entity, id, metricId, win) {
  const series = await loadSeries(entity, id, metricId);
  return sparkline(series, series.metric, rollLength(win));
}
