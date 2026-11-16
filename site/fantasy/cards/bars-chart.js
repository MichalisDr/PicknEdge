/* The per-game bars chart of a card (shown when a stat is clicked): one bar per game of the season, a round label under each bar, a light value scale,
   the season average (dashed) and the rolling 5 (line through the bar tops). Takes the series of core/game-series.js; colours come from the theme
   through the style sheet, the scale (zero baseline or data range) from the metric's `chartScale`. wireBars() adds the hover / tap read-out. */
import { esc } from '../../core/html.js';
import { size } from '../../core/sizes.js';

const ROLL = 5;

function niceTicks(lo, hi) {
  const raw = (hi - lo) / 3 || 1, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw - 1e-12) || 10 * mag, out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(8));
  return { ticks: out, dec: Math.min(4, (String(+step.toPrecision(6)).split('.')[1] || '').length) };
}
const segments = (xs, ys) => {   // consecutive points with a value; a missing one breaks the line
  const out = []; let line = [];
  ys.forEach((y, i) => { if (y === null) { if (line.length > 1) out.push(line); line = []; } else line.push(xs[i].toFixed(1) + ',' + y.toFixed(1)); });
  if (line.length > 1) out.push(line);
  return out;
};

export function barsChart(series, m) {
  const { points } = series, values = points.map(p => p.value).filter(Number.isFinite);
  if (!values.length) return '<p class="fw-empty">Not enough data for this metric.</p>';
  const W = size('fantasy.player-card.trend-chart.plot-width'), H = size('fantasy.player-card.trend-chart.plot-height'), MS = size('fantasy.player-card.trend-chart.margin-side'), MB = size('fantasy.player-card.trend-chart.margin-bottom'), MT = size('fantasy.player-card.trend-chart.margin-top');
  const dig = m.format.digits, suffix = m.format.suffix, n = points.length, slot = (W - 2 * MS) / n, bw = Math.min(slot * .62, 40);
  const min = Math.min(...values), max = Math.max(...values), avg = series.average, zero = m.chartScale !== 'range';
  let lo, hi;
  if (zero) { lo = Math.min(0, min); hi = Math.max(0, max); } else { const span = max - min || Math.abs(max) * .1 || 1; lo = min - .25 * span; hi = max + .06 * span; }
  if (hi === lo) hi = lo + 1;
  const nt = niceTicks(lo, hi), y = v => H - MB - (v - lo) / (hi - lo) * (H - MB - MT), base = y(zero ? 0 : lo), cx = i => MS + (i + .5) * slot;
  const step = Math.ceil(26 / slot), fmtV = v => v.toFixed(dig) + suffix;
  const roll = series.rolling(ROLL).map(v => (Number.isFinite(v) ? y(v) : null));
  const bars = points.map((p, i) => {
    const x = cx(i), label = i % step === 0 ? `<text x="${x.toFixed(1)}" y="${H - MB + 16}" text-anchor="middle">R${p.round}</text>` : '';
    if (!Number.isFinite(p.value)) return label;   // a game not played: empty slot, no bar
    const top = Math.min(y(p.value), base), h = Math.max(1.5, Math.abs(base - y(p.value)));
    return `<g class="fw-bg" tabindex="0" data-x="${x.toFixed(1)}" data-tip="R${p.round} · ${p.home ? 'vs' : '@'} ${esc(p.opponent)} · ${fmtV(p.value)}" aria-label="R${p.round}: ${fmtV(p.value)}"><rect class="fw-hit" x="${(x - slot / 2).toFixed(1)}" y="${MT}" width="${slot.toFixed(1)}" height="${H - MB - MT}"/><rect class="fw-bar" x="${(x - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"/></g>${label}`;
  }).join('');
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="fw-bars" role="img" aria-label="${esc(m.label)} per game">`
    + `<line class="fw-axis" x1="${MS}" x2="${MS}" y1="${MT}" y2="${H - MB}"/>`
    + nt.ticks.map(v => `<text x="${MS - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v.toFixed(nt.dec)}</text>`).join('')
    + `<line class="fw-axis" x1="${MS}" x2="${W - MS}" y1="${base.toFixed(1)}" y2="${base.toFixed(1)}"/>${bars}`
    + (Number.isFinite(avg) ? `<line class="fw-avg" x1="${MS}" x2="${W - MS}" y1="${y(avg).toFixed(1)}" y2="${y(avg).toFixed(1)}"/>` : '')
    + segments(points.map((_, i) => cx(i)), roll).map(l => `<polyline class="fw-roll" points="${l.join(' ')}"/>`).join('')
    + '</svg>';
  return `<div class="fw-bars-wrap" data-bars>${svg}<div class="fw-bar-tip" role="status" hidden></div></div>`
    + `<div class="fw-leg"><span><i class="fw-k-bar"></i>Per game</span><span><i class="fw-k-r"></i>Rolling ${ROLL}</span>${Number.isFinite(avg) ? `<span><i class="fw-k-s"></i>Season ${fmtV(avg)}</span>` : ''}</div>`;
}

/** Hover (or focus, or tap) on a bar shows its round and value above it. */
export function wireBars(wrap) {
  const tip = wrap.querySelector('.fw-bar-tip'), svg = wrap.querySelector('svg');
  if (!tip || !svg) return;
  const show = g => {
    const bar = g.querySelector('.fw-bar').getBoundingClientRect(), w = wrap.getBoundingClientRect();
    tip.textContent = g.dataset.tip; tip.hidden = false;
    const half = tip.offsetWidth / 2, x = bar.left + bar.width / 2 - w.left;
    tip.style.left = Math.max(half, Math.min(w.width - half, x)) + 'px';
    tip.style.top = (bar.top - w.top - 4) + 'px';
  };
  wrap.querySelectorAll('.fw-bg').forEach(g => {
    g.onmouseenter = g.onfocus = () => show(g);
    g.onmouseleave = g.onblur = () => { tip.hidden = true; };
    g.onclick = () => show(g);   // tap on touch
  });
}
