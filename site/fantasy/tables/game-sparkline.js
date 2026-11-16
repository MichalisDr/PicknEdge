/* The hover of a main metric value in the tables: a compact sparkline, lines only (no title, value, axes or labels).
   Faint line = the real value of each game of the season (gaps for games not played); bold line = rolling 5 over the last 5 rounds, its last point marked;
   dashed line = the average of the table's window (the cell value). The series comes from core/game-series.js. */
import { size } from '../../core/sizes.js';
import { loadSeries } from '../../core/game-series.js';

const segments = (pts, key) => {
  const out = []; let line = [];
  for (const p of pts) { if (Number.isFinite(p[key])) line.push(p); else { out.push(line); line = []; } }
  out.push(line);
  return out.filter(l => l.length);
};
const path = (l, key) => l.map(p => p.x.toFixed(1) + ',' + p[key].toFixed(1)).join(' ');

/** The sparkline svg for a series; average = the cell value of the table's window. */
export function sparkline(series, average) {
  const { points } = series, rolling = series.recentRolling(), cells = points.map((p, i) => ({ value: p.value, roll: rolling[i] }));
  if (!points.some(p => Number.isFinite(p.value))) return '';
  const all = [...cells.flatMap(c => [c.value, c.roll]), average].filter(Number.isFinite);
  const W = size('fantasy.player-card.trend-chart.small-plot-width'), H = size('fantasy.player-card.trend-chart.small-plot-height'), pad = size('fantasy.player-card.trend-chart.small-plot-padding');
  const lo = Math.min(...all), span = Math.max(...all) - lo || 1, x = i => pad + (points.length > 1 ? i * (W - 2 * pad) / (points.length - 1) : (W - 2 * pad) / 2), y = v => H - pad - (v - lo) / span * (H - 2 * pad);
  const pts = cells.map((c, i) => ({ x: x(i), value: Number.isFinite(c.value) ? y(c.value) : null, roll: Number.isFinite(c.roll) ? y(c.roll) : null }));
  const lastRoll = [...pts].reverse().find(p => p.roll !== null);
  return `<svg viewBox="0 0 ${W} ${H}" class="fw-spark" aria-hidden="true">`
    + (Number.isFinite(average) ? `<line class="fw-avg" x1="${pad}" x2="${W - pad}" y1="${y(average).toFixed(1)}" y2="${y(average).toFixed(1)}"/>` : '')
    + segments(pts, 'value').map(l => (l.length > 1 ? `<polyline class="fw-spark-game" points="${path(l, 'value')}"/>` : `<circle class="fw-spark-pt" cx="${l[0].x.toFixed(1)}" cy="${l[0].value.toFixed(1)}" r="1.3"/>`)).join('')
    + segments(pts, 'roll').filter(l => l.length > 1).map(l => `<polyline class="fw-roll" points="${path(l, 'roll')}"/>`).join('')
    + (lastRoll ? `<circle class="fw-spark-dot" cx="${lastRoll.x.toFixed(1)}" cy="${lastRoll.roll.toFixed(1)}" r="2.5"/>` : '')
    + '</svg>';
}

/** The sparkline of entity `id` and metric `metricId`; cellValue = the table cell of the current window. Empty string when there is nothing to draw. */
export async function hoverSparkline(entity, id, metricId, cellValue) {
  return sparkline(await loadSeries(entity, id, metricId), cellValue);
}
